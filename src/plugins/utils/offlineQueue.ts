// Persistent Offline Queue
// Generic disk-backed queue with TTL, deduplication, and in-memory fallback

import { promises as fs } from 'fs'
import { join } from 'path'

interface QueueEntry<T> {
  timestamp: number
  data: T
  _filePath?: string
}

export interface PersistentQueueOptions<T> {
  /** Directory to store queue files */
  dir: string
  /** Time-to-live for queue entries (ms) */
  ttlMs?: number
  /** Maximum queue size (oldest evicted first) */
  maxSize?: number
  /** Deduplicate by this field (keeps newest entry per unique value) */
  deduplicateBy?: keyof T
}

/**
 * Persistent queue with disk storage, TTL, and deduplication.
 *
 * Features:
 * - Atomic writes (tmp file + rename)
 * - TTL-based expiration
 * - Deduplication by key field
 * - In-memory fallback if disk write fails
 * - Corruption recovery (renames corrupt files)
 *
 * Example:
 *   const queue = new PersistentQueue({
 *     dir: '/path/to/queue',
 *     ttlMs: 7 * 24 * 60 * 60 * 1000,  // 7 days
 *     maxSize: 1000,
 *     deduplicateBy: 'canvasId'
 *   })
 *
 *   await queue.enqueue({ canvasId: 'abc', data: {...} })
 *
 *   const entries = await queue.dequeue()
 *   for (const entry of entries) {
 *     try {
 *       await processEntry(entry.data)
 *       await queue.deleteEntry(entry)
 *     } catch {
 *       // Entry remains in queue for next replay
 *     }
 *   }
 */
export class PersistentQueue<T extends Record<string, unknown>> {
  private queueDir: string
  private inMemoryFallback = new Map<string, QueueEntry<T>>()
  private readonly MAX_QUEUE_SIZE: number
  private readonly TTL_MS: number
  private readonly deduplicateBy?: keyof T

  constructor(options: PersistentQueueOptions<T>) {
    this.queueDir = options.dir
    this.TTL_MS = options.ttlMs ?? 7 * 24 * 60 * 60 * 1000 // 7 days
    this.MAX_QUEUE_SIZE = options.maxSize ?? 1000
    this.deduplicateBy = options.deduplicateBy
  }

  private async ensureQueueDir(): Promise<void> {
    try {
      await fs.mkdir(this.queueDir, { recursive: true })
    } catch (err) {
      console.error('[PersistentQueue] Failed to create queue directory:', err)
    }
  }

  async enqueue(data: T): Promise<void> {
    const entry: QueueEntry<T> = {
      timestamp: Date.now(),
      data
    }

    try {
      await this.ensureQueueDir()

      // Generate unique filename
      const key = this.deduplicateBy ? String(data[this.deduplicateBy]) : String(entry.timestamp)
      const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 64)
      const filename = `${entry.timestamp}-${safeKey}.json`
      const tmpPath = join(this.queueDir, `${filename}.tmp`)
      const finalPath = join(this.queueDir, filename)

      // Atomic write: write to .tmp then rename
      await fs.writeFile(tmpPath, JSON.stringify(entry, null, 2), 'utf-8')
      await fs.rename(tmpPath, finalPath)

      // Clear in-memory fallback if it succeeded
      if (this.deduplicateBy) {
        this.inMemoryFallback.delete(String(data[this.deduplicateBy]))
      }
    } catch (err) {
      console.error('[PersistentQueue] Failed to write queue file, falling back to memory:', err)

      // Disk-full fallback: hold in memory
      if (this.deduplicateBy) {
        this.inMemoryFallback.set(String(data[this.deduplicateBy]), entry)
      }
    }
  }

  async dequeue(): Promise<Array<QueueEntry<T> & { _filePath?: string }>> {
    try {
      await this.ensureQueueDir()
      const files = await fs.readdir(this.queueDir)

      const entries: Array<QueueEntry<T> & { _filePath?: string }> = []
      const now = Date.now()

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const filePath = join(this.queueDir, file)

        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const entry = JSON.parse(content) as QueueEntry<T>

          // Discard entries older than TTL
          if (now - entry.timestamp > this.TTL_MS) {
            console.warn(`[PersistentQueue] Discarding stale entry (>${Math.floor(this.TTL_MS / 86400000)} days old):`, file)
            await fs.unlink(filePath)
            continue
          }

          entries.push({ ...entry, _filePath: filePath })
        } catch (parseErr) {
          // Corruption - rename to .corrupt and continue
          console.warn('[PersistentQueue] Queue file corrupted, renaming:', file, parseErr)
          try {
            await fs.rename(filePath, `${filePath}.corrupt`)
          } catch (renameErr) {
            console.error('[PersistentQueue] Failed to rename corrupt file:', renameErr)
          }
        }
      }

      // Add in-memory fallback entries
      for (const entry of this.inMemoryFallback.values()) {
        entries.push(entry)
      }

      // Dedup: keep LAST (newest timestamp) per deduplication key
      let deduped: Array<QueueEntry<T> & { _filePath?: string }> = entries
      if (this.deduplicateBy) {
        const dedupMap = new Map<string, QueueEntry<T> & { _filePath?: string }>()
        for (const entry of entries) {
          const key = String(entry.data[this.deduplicateBy])
          const existing = dedupMap.get(key)
          if (!existing || entry.timestamp > existing.timestamp) {
            dedupMap.set(key, entry)
          }
        }
        deduped = Array.from(dedupMap.values())
      }

      // Sort by timestamp (FIFO after dedup)
      const sorted = deduped.sort((a, b) => a.timestamp - b.timestamp)

      // Check queue size limit
      if (sorted.length > this.MAX_QUEUE_SIZE) {
        console.warn(`[PersistentQueue] Queue exceeds ${this.MAX_QUEUE_SIZE} entries, evicting oldest`)
        const toEvict = sorted.splice(0, sorted.length - this.MAX_QUEUE_SIZE)
        for (const entry of toEvict) {
          if (entry._filePath) {
            try {
              await fs.unlink(entry._filePath)
            } catch {
              // Ignore
            }
          }
        }
      }

      return sorted
    } catch (err) {
      console.error('[PersistentQueue] Failed to dequeue:', err)
      return []
    }
  }

  async deleteEntry(entry: QueueEntry<T> & { _filePath?: string }): Promise<void> {
    if (!entry._filePath) return

    try {
      await fs.unlink(entry._filePath)
    } catch (err) {
      console.error('[PersistentQueue] Failed to delete queue file:', entry._filePath, err)
    }
  }

  /** Replay all queued entries through a handler function */
  async replay(handler: (data: T) => Promise<void>): Promise<void> {
    const entries = await this.dequeue()

    for (const entry of entries) {
      try {
        await handler(entry.data)
        await this.deleteEntry(entry)
      } catch (err) {
        console.error('[PersistentQueue] Handler failed for entry:', entry, err)
        // Entry remains in queue for next replay
      }
    }
  }

  /** Flush all entries (called on app quit) */
  async flush(): Promise<void> {
    // In-memory entries should be written to disk if possible
    const memoryEntries = Array.from(this.inMemoryFallback.values())
    for (const entry of memoryEntries) {
      try {
        const key = this.deduplicateBy ? String(entry.data[this.deduplicateBy]) : String(entry.timestamp)
        const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 64)
        const filename = `${entry.timestamp}-${safeKey}.json`
        const filePath = join(this.queueDir, filename)

        await this.ensureQueueDir()
        await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8')

        // Remove from in-memory fallback
        if (this.deduplicateBy) {
          this.inMemoryFallback.delete(String(entry.data[this.deduplicateBy]))
        }
      } catch (err) {
        console.error('[PersistentQueue] Failed to flush in-memory entry to disk:', err)
      }
    }
  }
}
