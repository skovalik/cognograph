import { BrowserWindow, app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { notionService } from './notionService'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WorkspaceData {
  id: string
  filePath: string
  version: number
  title?: string
  nodes: Array<{
    id: string
    type: string
    data: any
  }>
  edges: any[]
  [key: string]: any
}

interface SyncQueueEntry {
  timestamp: number
  canvasId: string
  payload: {
    canvasId: string
    title: string
    version: number
    nodeCount: number
    edgeCount: number
  }
}

interface CanvasDebounceState {
  timer: ReturnType<typeof setTimeout> | null
  lastSyncVersion: number
  firstChangeTime: number
}

// -----------------------------------------------------------------------------
// Persistent Sync Queue
// -----------------------------------------------------------------------------

class PersistentSyncQueue {
  private queueDir: string
  private inMemoryFallback = new Map<string, SyncQueueEntry>()
  private readonly MAX_QUEUE_SIZE = 1000
  private readonly TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

  constructor() {
    this.queueDir = join(app.getPath('userData'), 'notion-sync-queue')
  }

  async ensureQueueDir(): Promise<void> {
    try {
      await fs.mkdir(this.queueDir, { recursive: true })
    } catch (err) {
      console.error('[NotionSync] Failed to create queue directory:', err)
    }
  }

  async enqueue(entry: SyncQueueEntry): Promise<void> {
    try {
      await this.ensureQueueDir()

      const filename = `${entry.timestamp}-${entry.canvasId}.json`
      const tmpPath = join(this.queueDir, `${filename}.tmp`)
      const finalPath = join(this.queueDir, filename)

      // Atomic write: write to .tmp then rename
      await fs.writeFile(tmpPath, JSON.stringify(entry, null, 2), 'utf-8')
      await fs.rename(tmpPath, finalPath)

      // Clear in-memory fallback if it succeeded
      this.inMemoryFallback.delete(entry.canvasId)
    } catch (err) {
      console.error('[NotionSync] Failed to write queue file, falling back to memory:', err)

      // Disk-full fallback: hold in memory
      this.inMemoryFallback.set(entry.canvasId, entry)

      // Show warning toast
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          // TODO: This should trigger a toast in the renderer
          // For now just log it
          console.warn('[NotionSync] SYNC QUEUE WRITE FAILED - data held in memory, do not close app')
        }
      }
    }
  }

  async dequeue(): Promise<SyncQueueEntry[]> {
    try {
      await this.ensureQueueDir()
      const files = await fs.readdir(this.queueDir)

      const entries: SyncQueueEntry[] = []
      const now = Date.now()

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const filePath = join(this.queueDir, file)

        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const entry = JSON.parse(content) as SyncQueueEntry

          // Discard entries older than TTL
          if (now - entry.timestamp > this.TTL_MS) {
            console.warn(`[NotionSync] Discarding stale queue entry (>${Math.floor(this.TTL_MS / 86400000)} days old):`, file)
            await fs.unlink(filePath)
            continue
          }

          entries.push({ ...entry, _filePath: filePath } as any)
        } catch (parseErr) {
          // Corruption - rename to .corrupt and continue
          console.warn('[NotionSync] Queue file corrupted, renaming:', file, parseErr)
          try {
            await fs.rename(filePath, `${filePath}.corrupt`)
          } catch (renameErr) {
            console.error('[NotionSync] Failed to rename corrupt file:', renameErr)
          }
        }
      }

      // Dedup: keep LAST (newest timestamp) per Canvas ID
      const deduped = new Map<string, SyncQueueEntry & { _filePath?: string }>()
      for (const entry of entries) {
        const existing = deduped.get(entry.canvasId)
        if (!existing || entry.timestamp > existing.timestamp) {
          deduped.set(entry.canvasId, entry as any)
        }
      }

      // Sort by timestamp (FIFO after dedup)
      const sorted = Array.from(deduped.values()).sort((a, b) => a.timestamp - b.timestamp)

      // Check queue size limit
      if (sorted.length > this.MAX_QUEUE_SIZE) {
        console.warn(`[NotionSync] Queue exceeds ${this.MAX_QUEUE_SIZE} entries, evicting oldest`)
        const toEvict = sorted.splice(0, sorted.length - this.MAX_QUEUE_SIZE)
        for (const entry of toEvict) {
          if ((entry as any)._filePath) {
            try {
              await fs.unlink((entry as any)._filePath)
            } catch {
              // Ignore
            }
          }
        }
      }

      return sorted
    } catch (err) {
      console.error('[NotionSync] Failed to dequeue:', err)
      return []
    }
  }

  async deleteEntry(entry: SyncQueueEntry & { _filePath?: string }): Promise<void> {
    const filePath = (entry as any)._filePath
    if (!filePath) return

    try {
      await fs.unlink(filePath)
    } catch (err) {
      console.error('[NotionSync] Failed to delete queue file:', filePath, err)
    }
  }

  getInMemoryCount(): number {
    return this.inMemoryFallback.size
  }
}

// -----------------------------------------------------------------------------
// Workflow Sync Service
// -----------------------------------------------------------------------------

class WorkflowSync {
  private debounceStates = new Map<string, CanvasDebounceState>()
  private queue = new PersistentSyncQueue()
  private isReplaying = false

  async initialize(): Promise<void> {
    // Replay queued entries on startup
    await this.replayQueue()

    // Subscribe to workspace:saved events
    // Note: This runs in main process - can't use ipcRenderer
    // We'll emit from workspace.ts and listen via app events
  }

  async replayQueue(): Promise<void> {
    if (this.isReplaying) return

    this.isReplaying = true
    console.log('[NotionSync] Replaying sync queue...')

    const entries = await this.queue.dequeue()
    if (entries.length === 0) {
      this.isReplaying = false
      return
    }

    console.log(`[NotionSync] Found ${entries.length} queued sync operations`)

    // Show status in footer
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        // TODO: Send event to show "Syncing N queued changes..." in footer
        console.log(`[NotionSync] Syncing ${entries.length} queued changes...`)
      }
    }

    let successCount = 0
    let failCount = 0

    for (const entry of entries) {
      const result = await this.syncToNotion(entry.payload)

      if (result.success) {
        // Process-before-delete: delete only after successful sync
        await this.queue.deleteEntry(entry as any)
        successCount++
      } else {
        failCount++
        // Leave in queue for next replay
        console.warn(`[NotionSync] Queue replay failed for canvas ${entry.canvasId}:`, result.error)
      }
    }

    console.log(`[NotionSync] Queue replay complete: ${successCount} succeeded, ${failCount} failed`)
    this.isReplaying = false
  }

  onWorkspaceSaved(data: { filePath: string; canvasId: string; version: number }): void {
    const { canvasId, version } = data

    // Check if sync is enabled
    if (!notionService.isSyncEnabled()) {
      return
    }

    // Get or create debounce state
    let state = this.debounceStates.get(canvasId)
    if (!state) {
      state = {
        timer: null,
        lastSyncVersion: -1,
        firstChangeTime: Date.now()
      }
      this.debounceStates.set(canvasId, state)
    }

    // Clear existing timer
    if (state.timer) {
      clearTimeout(state.timer)
    }

    // Dirty check: skip if version hasn't changed since last sync
    if (version === state.lastSyncVersion) {
      console.log(`[NotionSync] Skipping sync for canvas ${canvasId} - version unchanged (${version})`)
      return
    }

    // Set up new timer with 500ms debounce + 30s max-wait
    const timeElapsed = Date.now() - state.firstChangeTime
    const shouldForceSync = timeElapsed > 30000 // 30 second max-wait

    const debounceMs = shouldForceSync ? 0 : 500

    state.timer = setTimeout(async () => {
      state.timer = null

      try {
        // Load workspace data to get full payload
        const workspaceData = await this.loadWorkspaceData(data.filePath)
        if (!workspaceData) {
          console.error('[NotionSync] Failed to load workspace data for sync')
          return
        }

        const payload = {
          canvasId: workspaceData.id,
          title: workspaceData.title || `Canvas ${workspaceData.id.slice(0, 8)}`,
          version: workspaceData.version,
          nodeCount: workspaceData.nodes?.length || 0,
          edgeCount: workspaceData.edges?.length || 0
        }

        const result = await this.syncToNotion(payload)

        if (result.success) {
          state.lastSyncVersion = version
          state.firstChangeTime = Date.now()
        } else {
          // On failure, enqueue for later
          if (!result.shouldSuspend) {
            await this.queue.enqueue({
              timestamp: Date.now(),
              canvasId,
              payload
            })
          }
        }
      } catch (err) {
        console.error('[NotionSync] Sync error:', err)
      }
    }, debounceMs)
  }

  private async loadWorkspaceData(filePath: string): Promise<WorkspaceData | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch (err) {
      console.error('[NotionSync] Failed to load workspace:', err)
      return null
    }
  }

  private async syncToNotion(payload: {
    canvasId: string
    title: string
    version: number
    nodeCount: number
    edgeCount: number
  }): Promise<{ success: boolean; error?: string; shouldSuspend?: boolean }> {
    const config = notionService.getConfig()
    if (!config) {
      return { success: false, error: 'Notion databases not configured' }
    }

    const properties = {
      'Name': {
        title: [{ text: { content: payload.title } }]
      },
      'Canvas ID': {
        rich_text: [{ text: { content: payload.canvasId } }]
      },
      'Version': {
        number: payload.version
      },
      'Node Count': {
        number: payload.nodeCount
      },
      'Edge Count': {
        number: payload.edgeCount
      },
      'Last Synced': {
        date: { start: new Date().toISOString() }
      }
    }

    // Query first: find existing page by Canvas ID (upsert logic)
    const queryResult = await notionService.request(
      async (client) => {
        return await client.databases.query({
          database_id: config.workflowsDbId,
          filter: {
            property: 'Canvas ID',
            rich_text: { equals: payload.canvasId }
          }
        })
      },
      'queryWorkflow'
    )

    if (queryResult.success && queryResult.data?.results?.length > 0) {
      // Update existing page
      const existingPageId = queryResult.data.results[0].id
      if (queryResult.data.results.length > 1) {
        console.warn(`[NotionSync] Found ${queryResult.data.results.length} pages for canvas ${payload.canvasId}, updating first`)
      }
      const updateResult = await notionService.request(
        async (client) => {
          return await client.pages.update({
            page_id: existingPageId,
            properties
          })
        },
        'updateWorkflow'
      )
      return updateResult.success
        ? { success: true }
        : { success: false, error: updateResult.error, shouldSuspend: updateResult.shouldSuspend }
    }

    // No existing page found — create new
    const createResult = await notionService.request(
      async (client) => {
        return await client.pages.create({
          parent: { database_id: config.workflowsDbId },
          properties
        })
      },
      'createWorkflow'
    )

    return createResult.success
      ? { success: true }
      : { success: false, error: createResult.error, shouldSuspend: createResult.shouldSuspend }
  }
}

// Singleton instance
export const workflowSync = new WorkflowSync()
