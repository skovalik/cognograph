/**
 * Backup Manager
 *
 * Creates periodic backups of workspace files with a tiered retention policy.
 */

import { app, ipcMain, shell } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const BACKUP_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes
const WORKSPACES_DIR = join(app.getPath('userData'), 'workspaces')

// Retention windows
const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS

// -----------------------------------------------------------------------------
// Backup Manager Class
// -----------------------------------------------------------------------------

class BackupManager {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private currentWorkspaceId: string | null = null
  private backupDir: string = ''

  start(workspaceId: string): void {
    this.stop()
    this.currentWorkspaceId = workspaceId
    this.backupDir = join(WORKSPACES_DIR, '.backups', workspaceId)

    // Create initial backup
    this.createBackup()

    // Schedule periodic backups
    this.intervalId = setInterval(() => {
      this.createBackup()
    }, BACKUP_INTERVAL_MS)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.currentWorkspaceId = null
  }

  async createBackup(): Promise<string | null> {
    if (!this.currentWorkspaceId) return null

    try {
      const sourcePath = join(WORKSPACES_DIR, `${this.currentWorkspaceId}.json`)

      // Check if source exists
      try {
        await fs.access(sourcePath)
      } catch {
        return null // Source doesn't exist yet
      }

      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true })

      // Create timestamped backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupName = `${this.currentWorkspaceId}_${timestamp}.json`
      const backupPath = join(this.backupDir, backupName)

      await fs.copyFile(sourcePath, backupPath)

      // Prune old backups
      await this.pruneBackups()

      return backupPath
    } catch (error) {
      console.error('[BackupManager] Failed to create backup:', error)
      return null
    }
  }

  async pruneBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir)
      const now = Date.now()

      // Parse backup files with their timestamps
      const backups = await Promise.all(
        files
          .filter((f) => f.endsWith('.json'))
          .map(async (f) => {
            const stat = await fs.stat(join(this.backupDir, f))
            return { name: f, mtime: stat.mtimeMs, age: now - stat.mtimeMs }
          })
      )

      // Sort newest first
      backups.sort((a, b) => b.mtime - a.mtime)

      const toDelete: string[] = []

      // Apply retention policy:
      // - Last hour: keep all
      // - 1-24 hours: keep 1 per hour
      // - 1-24 days: keep 1 per day
      // - Older: delete

      const hourBuckets = new Map<number, typeof backups>()
      const dayBuckets = new Map<number, typeof backups>()

      for (const backup of backups) {
        if (backup.age < ONE_HOUR_MS) {
          // Last hour: keep all
          continue
        } else if (backup.age < ONE_DAY_MS) {
          // 1-24 hours: bucket by hour
          const hourKey = Math.floor(backup.age / ONE_HOUR_MS)
          if (!hourBuckets.has(hourKey)) hourBuckets.set(hourKey, [])
          hourBuckets.get(hourKey)!.push(backup)
        } else if (backup.age < 24 * ONE_DAY_MS) {
          // 1-24 days: bucket by day
          const dayKey = Math.floor(backup.age / ONE_DAY_MS)
          if (!dayBuckets.has(dayKey)) dayBuckets.set(dayKey, [])
          dayBuckets.get(dayKey)!.push(backup)
        } else {
          // Older than 24 days: delete
          toDelete.push(backup.name)
        }
      }

      // For each hour bucket, keep only the newest
      for (const bucket of hourBuckets.values()) {
        bucket.sort((a, b) => b.mtime - a.mtime)
        for (let i = 1; i < bucket.length; i++) {
          const entry = bucket[i]
          if (entry) toDelete.push(entry.name)
        }
      }

      // For each day bucket, keep only the newest
      for (const bucket of dayBuckets.values()) {
        bucket.sort((a, b) => b.mtime - a.mtime)
        for (let i = 1; i < bucket.length; i++) {
          const entry = bucket[i]
          if (entry) toDelete.push(entry.name)
        }
      }

      // Delete files
      for (const name of toDelete) {
        try {
          await fs.unlink(join(this.backupDir, name))
        } catch {
          // Ignore deletion errors
        }
      }
    } catch (error) {
      console.error('[BackupManager] Failed to prune backups:', error)
    }
  }

  async listBackups(): Promise<Array<{ name: string; timestamp: number; size: number }>> {
    if (!this.backupDir) return []

    try {
      await fs.mkdir(this.backupDir, { recursive: true })
      const files = await fs.readdir(this.backupDir)

      const backups = await Promise.all(
        files
          .filter((f) => f.endsWith('.json'))
          .map(async (f) => {
            const stat = await fs.stat(join(this.backupDir, f))
            return { name: f, timestamp: stat.mtimeMs, size: stat.size }
          })
      )

      return backups.sort((a, b) => b.timestamp - a.timestamp)
    } catch {
      return []
    }
  }

  async restoreBackup(backupName: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentWorkspaceId) {
      return { success: false, error: 'No workspace active' }
    }

    try {
      const backupPath = join(this.backupDir, backupName)
      const targetPath = join(WORKSPACES_DIR, `${this.currentWorkspaceId}.json`)

      // Verify backup exists and is valid JSON
      const content = await fs.readFile(backupPath, 'utf-8')
      JSON.parse(content) // Validate JSON

      // Create a pre-restore backup
      const preRestoreName = `${this.currentWorkspaceId}_pre-restore_${Date.now()}.json`
      await fs.copyFile(targetPath, join(this.backupDir, preRestoreName))

      // Restore
      await fs.copyFile(backupPath, targetPath)

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  getBackupDir(): string {
    return this.backupDir
  }
}

// Singleton instance
export const backupManager = new BackupManager()

// -----------------------------------------------------------------------------
// IPC Handlers
// -----------------------------------------------------------------------------

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:list', async () => {
    return backupManager.listBackups()
  })

  ipcMain.handle('backup:restore', async (_event, backupName: string) => {
    return backupManager.restoreBackup(backupName)
  })

  ipcMain.handle('backup:openFolder', async () => {
    const dir = backupManager.getBackupDir()
    if (dir) {
      shell.openPath(dir)
    }
  })

  ipcMain.handle('backup:create', async () => {
    const path = await backupManager.createBackup()
    return { success: !!path, path }
  })
}
