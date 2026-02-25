// NodeSyncQueue — Disk-backed FIFO queue for failed node-level syncs
// Spec: COGNOGRAPH-NOTION-NODE-SYNC-SPEC.md Section 5d
//
// Separate from workspace-level PersistentSyncQueue.
// Stores only IDs, not payloads — current node state is re-read at drain time.
// Atomic writes: .tmp → rename pattern. Corruption → .corrupt rename.

import { promises as fs } from 'fs'
import { join } from 'path'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface NodeSyncQueueEntry {
  nodeId: string
  workspaceId: string
  queuedAt: number        // Unix ms
  failureReason: string   // Human-readable error
  retryCount: number      // Incremented on each drain attempt
}

interface StoredEntry extends NodeSyncQueueEntry {
  _filePath?: string      // Internal: path for cleanup
}

// -----------------------------------------------------------------------------
// NodeSyncQueue
// -----------------------------------------------------------------------------

const MAX_QUEUE_SIZE = 1000
const TTL_MS = 7 * 24 * 60 * 60 * 1000  // 7 days
const MAX_RETRY_COUNT = 10

export class NodeSyncQueue {
  private queueDir: string
  private inMemoryFallback = new Map<string, NodeSyncQueueEntry>()

  constructor(dataDir: string) {
    this.queueDir = join(dataDir, 'node-sync-queue')
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Add a failed sync entry to the queue.
   * If a queue entry for this nodeId already exists, it will be superseded
   * on dequeue (dedup keeps the newest).
   */
  async enqueue(entry: NodeSyncQueueEntry): Promise<void> {
    try {
      await this.ensureDir()

      const filename = `${entry.queuedAt}-${entry.nodeId}.json`
      const tmpPath = join(this.queueDir, `${filename}.tmp`)
      const finalPath = join(this.queueDir, filename)

      // Atomic write: .tmp → rename
      await fs.writeFile(tmpPath, JSON.stringify(entry, null, 2), 'utf-8')
      await fs.rename(tmpPath, finalPath)

      this.inMemoryFallback.delete(entry.nodeId)
    } catch (err) {
      console.error('[NodeSyncQueue] Write failed, using in-memory fallback:', err)
      this.inMemoryFallback.set(entry.nodeId, entry)
    }
  }

  /**
   * Read all queued entries for a specific workspace.
   * Deduplicates by nodeId (keeps newest), sorts FIFO, enforces limits.
   * Does NOT delete entries — caller must call deleteEntry() after successful sync.
   */
  async getEntriesForWorkspace(workspaceId: string): Promise<StoredEntry[]> {
    const allEntries = await this.readAll()

    // Filter to requested workspace
    return allEntries.filter(e => e.workspaceId === workspaceId)
  }

  /**
   * Read all entries across all workspaces.
   * Deduplicates, enforces TTL and queue size.
   */
  async readAll(): Promise<StoredEntry[]> {
    const entries: StoredEntry[] = []

    // Read from disk
    try {
      await this.ensureDir()
      const files = await fs.readdir(this.queueDir)
      const now = Date.now()

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const filePath = join(this.queueDir, file)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const entry = JSON.parse(content) as NodeSyncQueueEntry

          // TTL enforcement
          if (now - entry.queuedAt > TTL_MS) {
            console.warn(`[NodeSyncQueue] Discarding stale entry (>7 days): nodeId=${entry.nodeId}`)
            await fs.unlink(filePath).catch(() => {})
            continue
          }

          entries.push({ ...entry, _filePath: filePath })
        } catch (parseErr) {
          // Corruption — rename to .corrupt
          console.warn(`[NodeSyncQueue] Corrupt file, renaming: ${file}`, parseErr)
          await fs.rename(filePath, `${filePath}.corrupt`).catch(() => {})
        }
      }
    } catch (err) {
      console.error('[NodeSyncQueue] Failed to read queue directory:', err)
    }

    // Merge in-memory fallback
    for (const entry of this.inMemoryFallback.values()) {
      entries.push(entry)
    }

    // Dedup: keep NEWEST per nodeId
    const deduped = new Map<string, StoredEntry>()
    for (const entry of entries) {
      const existing = deduped.get(entry.nodeId)
      if (!existing || entry.queuedAt > existing.queuedAt) {
        deduped.set(entry.nodeId, entry)
      }
    }

    // Sort FIFO (oldest first)
    const sorted = Array.from(deduped.values()).sort((a, b) => a.queuedAt - b.queuedAt)

    // Enforce queue size limit (evict oldest if over MAX_QUEUE_SIZE)
    if (sorted.length > MAX_QUEUE_SIZE) {
      const toEvict = sorted.splice(0, sorted.length - MAX_QUEUE_SIZE)
      for (const entry of toEvict) {
        if (entry._filePath) {
          await fs.unlink(entry._filePath).catch(() => {})
        }
      }
    }

    return sorted
  }

  /**
   * Delete a queue entry after successful sync.
   */
  async deleteEntry(entry: StoredEntry): Promise<void> {
    if (entry._filePath) {
      try {
        await fs.unlink(entry._filePath)
      } catch {
        // File may already be gone
      }
    }
    this.inMemoryFallback.delete(entry.nodeId)
  }

  /**
   * Increment retry count and re-queue. Returns true if the entry should
   * be permanently dropped (exceeded MAX_RETRY_COUNT).
   */
  async incrementRetry(entry: StoredEntry): Promise<{ dropped: boolean }> {
    const newCount = entry.retryCount + 1

    if (newCount >= MAX_RETRY_COUNT) {
      // Permanently drop — max retries exceeded
      await this.deleteEntry(entry)
      return { dropped: true }
    }

    // Delete old entry, enqueue with incremented count
    await this.deleteEntry(entry)
    await this.enqueue({
      nodeId: entry.nodeId,
      workspaceId: entry.workspaceId,
      queuedAt: entry.queuedAt,  // Keep original queue time for TTL
      failureReason: entry.failureReason,
      retryCount: newCount
    })

    return { dropped: false }
  }

  /**
   * Get count of entries (disk + in-memory).
   */
  async getCount(): Promise<number> {
    try {
      await this.ensureDir()
      const files = await fs.readdir(this.queueDir)
      const diskCount = files.filter(f => f.endsWith('.json')).length
      return diskCount + this.inMemoryFallback.size
    } catch {
      return this.inMemoryFallback.size
    }
  }

  /**
   * Get count of entries held in memory only (disk write failed).
   */
  getInMemoryCount(): number {
    return this.inMemoryFallback.size
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.queueDir, { recursive: true })
  }
}

// Export constants for tests
export { MAX_QUEUE_SIZE, TTL_MS, MAX_RETRY_COUNT }
