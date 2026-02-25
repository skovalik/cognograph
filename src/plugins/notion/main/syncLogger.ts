// SyncLogger — Structured log file writer for node-level sync
// Spec: COGNOGRAPH-NOTION-NODE-SYNC-SPEC.md Section 9e
//
// Format: [ISO timestamp] [LEVEL] [EVENT] wsId={workspaceId} {details}
// Rotation: Max 5MB per file, keeps last 2 files (notion-sync.log, notion-sync.log.1)
// Location: {dataDir}/notion-sync.log (plugin data directory)

import { promises as fs } from 'fs'
import { join } from 'path'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LogLevel = 'INFO' | 'WARN' | 'ERROR'

type LogEvent =
  | 'PUSH_SUCCESS'
  | 'PUSH_SKIP'
  | 'PUSH_FAILED'
  | 'PULL_SUCCESS'
  | 'PULL_SKIP'
  | 'PULL_CONFLICT'
  | 'PULL_404'
  | 'PULL_FAILED'
  | 'QUEUE_ADD'
  | 'QUEUE_DRAIN'
  | 'QUEUE_DROP'
  | 'QUEUE_EVICT'
  | 'SCHEMA_INIT'
  | 'SCHEMA_ERROR'
  | 'SYNC_START'
  | 'SYNC_COMPLETE'
  | 'SYNC_SUSPENDED'
  | 'BACKOFF'
  | 'DUPLICATION'
  | 'RECOVERY'

interface LogEntry {
  level: LogLevel
  event: LogEvent
  workspaceId: string
  details: Record<string, string | number | boolean>
}

// -----------------------------------------------------------------------------
// SyncLogger
// -----------------------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024  // 5MB
const MAX_ROTATED_FILES = 1  // Keep notion-sync.log + notion-sync.log.1

export class SyncLogger {
  private logPath: string
  private writeQueue: string[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private isRotating = false

  constructor(dataDir: string) {
    this.logPath = join(dataDir, 'notion-sync.log')
  }

  // ---------------------------------------------------------------------------
  // Public API — typed convenience methods
  // ---------------------------------------------------------------------------

  pushSuccess(wsId: string, nodeId: string, notionPageId: string, latencyMs: number): void {
    this.log({
      level: 'INFO',
      event: 'PUSH_SUCCESS',
      workspaceId: wsId,
      details: { nodeId, notionPageId, latencyMs }
    })
  }

  pushSkip(wsId: string, nodeId: string, reason: string): void {
    this.log({
      level: 'INFO',
      event: 'PUSH_SKIP',
      workspaceId: wsId,
      details: { nodeId, reason }
    })
  }

  pushFailed(wsId: string, nodeId: string, error: string, queued: boolean): void {
    this.log({
      level: 'ERROR',
      event: 'PUSH_FAILED',
      workspaceId: wsId,
      details: { nodeId, error, queued }
    })
  }

  pullSuccess(wsId: string, nodeId: string, fieldsUpdated: string): void {
    this.log({
      level: 'INFO',
      event: 'PULL_SUCCESS',
      workspaceId: wsId,
      details: { nodeId, fieldsUpdated }
    })
  }

  pullSkip(wsId: string, nodeId: string, reason: string): void {
    this.log({
      level: 'INFO',
      event: 'PULL_SKIP',
      workspaceId: wsId,
      details: { nodeId, reason }
    })
  }

  pullConflict(wsId: string, nodeId: string, fields: string): void {
    this.log({
      level: 'WARN',
      event: 'PULL_CONFLICT',
      workspaceId: wsId,
      details: { nodeId, fields }
    })
  }

  pull404(wsId: string, nodeId: string, notionPageId: string): void {
    this.log({
      level: 'ERROR',
      event: 'PULL_404',
      workspaceId: wsId,
      details: { nodeId, notionPageId, cleared: true }
    })
  }

  pullFailed(wsId: string, nodeId: string, error: string): void {
    this.log({
      level: 'ERROR',
      event: 'PULL_FAILED',
      workspaceId: wsId,
      details: { nodeId, error }
    })
  }

  queueAdd(wsId: string, nodeId: string, reason: string): void {
    this.log({
      level: 'INFO',
      event: 'QUEUE_ADD',
      workspaceId: wsId,
      details: { nodeId, reason }
    })
  }

  queueDrain(wsId: string, nodeId: string, success: boolean): void {
    this.log({
      level: success ? 'INFO' : 'WARN',
      event: 'QUEUE_DRAIN',
      workspaceId: wsId,
      details: { nodeId, success }
    })
  }

  queueDrop(wsId: string, nodeId: string, retryCount: number, reason: string): void {
    this.log({
      level: 'WARN',
      event: 'QUEUE_DROP',
      workspaceId: wsId,
      details: { nodeId, retryCount, reason }
    })
  }

  queueEvict(wsId: string, count: number, oldestAgeHours: number): void {
    this.log({
      level: 'WARN',
      event: 'QUEUE_EVICT',
      workspaceId: wsId,
      details: { count, oldestAge: `${oldestAgeHours}h` }
    })
  }

  schemaInit(wsId: string, dbId: string, propertyName: string): void {
    this.log({
      level: 'INFO',
      event: 'SCHEMA_INIT',
      workspaceId: wsId,
      details: { dbId, propertyName }
    })
  }

  schemaError(wsId: string, dbId: string, error: string): void {
    this.log({
      level: 'ERROR',
      event: 'SCHEMA_ERROR',
      workspaceId: wsId,
      details: { dbId, error }
    })
  }

  syncStart(wsId: string, nodeCount: number): void {
    this.log({
      level: 'INFO',
      event: 'SYNC_START',
      workspaceId: wsId,
      details: { nodeCount }
    })
  }

  syncComplete(wsId: string, pushed: number, skipped: number, failed: number, durationMs: number): void {
    this.log({
      level: 'INFO',
      event: 'SYNC_COMPLETE',
      workspaceId: wsId,
      details: { pushed, skipped, failed, durationMs }
    })
  }

  syncSuspended(wsId: string, reason: string): void {
    this.log({
      level: 'ERROR',
      event: 'SYNC_SUSPENDED',
      workspaceId: wsId,
      details: { reason }
    })
  }

  backoff(wsId: string, currentIntervalMs: number, consecutiveFailures: number): void {
    this.log({
      level: 'WARN',
      event: 'BACKOFF',
      workspaceId: wsId,
      details: { currentIntervalMs, consecutiveFailures }
    })
  }

  duplication(wsId: string, affectedNodeCount: number): void {
    this.log({
      level: 'WARN',
      event: 'DUPLICATION',
      workspaceId: wsId,
      details: { affectedNodeCount }
    })
  }

  recovery(wsId: string, action: string, nodeCount: number): void {
    this.log({
      level: 'INFO',
      event: 'RECOVERY',
      workspaceId: wsId,
      details: { action, nodeCount }
    })
  }

  // ---------------------------------------------------------------------------
  // Core log method
  // ---------------------------------------------------------------------------

  private log(entry: LogEntry): void {
    const timestamp = new Date().toISOString()
    const wsIdShort = entry.workspaceId.slice(0, 8)
    const detailParts = Object.entries(entry.details)
      .map(([k, v]) => `${k}=${typeof v === 'string' && v.includes(' ') ? `"${v}"` : v}`)
      .join(' ')

    const line = `[${timestamp}] ${entry.level.padEnd(5)} ${entry.event.padEnd(16)} wsId=${wsIdShort} ${detailParts}\n`

    this.writeQueue.push(line)
    this.scheduleFlush()
  }

  // ---------------------------------------------------------------------------
  // Buffered writes + rotation
  // ---------------------------------------------------------------------------

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => this.flush(), 100)
  }

  private async flush(): Promise<void> {
    this.flushTimer = null
    if (this.writeQueue.length === 0) return

    const lines = this.writeQueue.splice(0)
    const content = lines.join('')

    try {
      // Check for rotation before writing
      if (!this.isRotating) {
        await this.rotateIfNeeded()
      }

      await fs.appendFile(this.logPath, content, 'utf-8')
    } catch (err) {
      // Log file write failure — fall back to console
      console.error('[SyncLogger] Failed to write log file:', err)
      // Put lines back for retry on next flush
      this.writeQueue.unshift(...lines)
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stat = await fs.stat(this.logPath)
      if (stat.size < MAX_FILE_SIZE) return

      this.isRotating = true

      // Rotate: .log.1 → delete, .log → .log.1
      const rotatedPath = this.logPath + '.1'
      try {
        await fs.unlink(rotatedPath)
      } catch {
        // File may not exist — that's fine
      }

      await fs.rename(this.logPath, rotatedPath)
      this.isRotating = false
    } catch (err) {
      this.isRotating = false
      // File doesn't exist yet or stat failed — just proceed
    }
  }

  /**
   * Force flush all pending writes. Call on app:quit.
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await this.flush()
  }
}
