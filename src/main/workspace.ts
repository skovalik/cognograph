// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { promises as fs, watch as fsWatch, type FSWatcher } from 'fs'
import type { WorkspaceData, WorkspaceInfo } from '@shared/types'
import { backupManager } from './backupManager'
import { validateWorkspaceData } from './workspaceValidation'
import { workflowSync } from './services/notionSync'
import { emitPluginEvent, updateWorkspaceCache } from '@plugins/registry'
import { migrateInlineMessages } from './ipc/conversationPersistence'
import {
  WorkspaceLoadSchema,
  WorkspaceSaveSchema,
  WorkspaceSaveAsSchema,
  WorkspaceDeleteSchema,
  WorkspaceLoadFromPathSchema,
  WorkspaceWatchSchema,
} from './ipc/schemas'

// File watcher state
const activeWatchers = new Map<string, FSWatcher>()
const activeDebounceTimers = new Map<string, NodeJS.Timeout>()
let lastSaveTimestamp = 0
const SELF_WRITE_GRACE_MS = 1000 // Ignore file changes within 1s of our own save

// -----------------------------------------------------------------------------
// Atomic Save + Single-Flight Queue (0.2b, 0.3h)
// -----------------------------------------------------------------------------

/** Per-workspace save queue state. Ensures at most one save runs at a time. */
interface SaveQueueEntry {
  inFlight: boolean
  pending: WorkspaceData | null
}
const saveQueues = new Map<string, SaveQueueEntry>()

/**
 * Atomic write: write to a temp file on the same drive, then rename.
 * On Windows, same-drive fs.rename() is guaranteed atomic (single NTFS MFT update).
 * On Unix, rename(2) is POSIX-atomic.
 */
async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const tmpPath = filePath + '.tmp'
  await fs.writeFile(tmpPath, content, 'utf-8')
  await fs.rename(tmpPath, filePath)
}

/**
 * Drain the save queue for a workspace. If a pending save exists when the
 * current one finishes, execute it immediately (single-flight pattern).
 */
async function drainSaveQueue(workspaceId: string, saveFn: (data: WorkspaceData) => Promise<void>): Promise<void> {
  const entry = saveQueues.get(workspaceId)
  if (!entry) return

  // Keep draining as long as new saves were queued during execution
  while (entry.pending) {
    const nextData = entry.pending
    entry.pending = null
    await saveFn(nextData)
  }

  entry.inFlight = false
}

// Artifact download request type
interface ArtifactDownloadRequest {
  title: string
  content: string
  contentType: string
  language?: string
  files?: Array<{ filename: string; content: string; contentType: string }>
  isBase64?: boolean
}

// Get file extension based on content type
function getExtensionForContentType(contentType: string, language?: string): string {
  if (language) {
    const langMap: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      rust: 'rs',
      java: 'java',
      go: 'go',
      cpp: 'cpp',
      c: 'c',
      csharp: 'cs',
      ruby: 'rb',
      php: 'php',
      swift: 'swift',
      kotlin: 'kt',
      scala: 'scala',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      yaml: 'yaml',
      yml: 'yml',
      xml: 'xml',
      sql: 'sql',
      shell: 'sh',
      bash: 'sh',
      powershell: 'ps1',
      dockerfile: 'dockerfile'
    }
    return langMap[language.toLowerCase()] || 'txt'
  }

  const typeMap: Record<string, string> = {
    code: 'txt',
    markdown: 'md',
    html: 'html',
    svg: 'svg',
    mermaid: 'mmd',
    json: 'json',
    csv: 'csv',
    image: 'png',
    text: 'txt'
  }
  return typeMap[contentType] || 'txt'
}

// Dialog options types for IPC
interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

interface OpenDialogOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
}

const WORKSPACES_DIR = join(app.getPath('userData'), 'workspaces')

async function ensureWorkspacesDir(): Promise<void> {
  try {
    await fs.mkdir(WORKSPACES_DIR, { recursive: true })
  } catch {
    // Directory already exists
  }
}

export function registerWorkspaceHandlers(): void {
  // TEST ONLY: Force new empty workspace (clears autosaved state)
  ipcMain.handle('workspace:reset-for-test', async (_event) => {
    try {
      // Clear the autosaved workspace file
      const defaultWorkspace = join(WORKSPACES_DIR, 'autosave.cg')
      try {
        await fs.unlink(defaultWorkspace)
      } catch {
        // File doesn't exist, that's fine
      }

      return { success: true }
    } catch (error) {
      console.error('[Workspace] Failed to reset for test:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace:save', async (_event, data: WorkspaceData) => {
    // Zod validation (SEC-0.1j)
    const validated = WorkspaceSaveSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: `Validation failed: ${validated.error.issues[0]?.message || 'Invalid input'}` }
    }

    try {
      await ensureWorkspacesDir()

      // Single-flight save queue (0.3h): if a save is already in progress
      // for this workspace, queue this one and return immediately.
      let entry = saveQueues.get(data.id)
      if (!entry) {
        entry = { inFlight: false, pending: null }
        saveQueues.set(data.id, entry)
      }

      if (entry.inFlight) {
        // Replace any previously pending save — only the latest state matters
        entry.pending = data
        return { success: true, queued: true }
      }

      entry.inFlight = true

      const executeSave = async (saveData: WorkspaceData): Promise<void> => {
        const filePath = join(WORKSPACES_DIR, `${saveData.id}.json`)
        lastSaveTimestamp = Date.now()

        // Atomic save (0.2b): write to .tmp then rename
        await atomicWriteFile(filePath, JSON.stringify(saveData, null, 2))

        // Cancel any pending watcher debounce for this workspace to prevent
        // our own save from triggering loadWorkspace in the renderer.
        const pendingTimer = activeDebounceTimers.get(saveData.id)
        if (pendingTimer) {
          clearTimeout(pendingTimer)
          activeDebounceTimers.delete(saveData.id)
        }

        // Update last workspace ID (also atomic)
        const settingsPath = join(app.getPath('userData'), 'settings.json')
        try {
          const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
          settings.lastWorkspaceId = saveData.id
          await atomicWriteFile(settingsPath, JSON.stringify(settings, null, 2))
        } catch {
          await atomicWriteFile(settingsPath, JSON.stringify({ lastWorkspaceId: saveData.id }, null, 2))
        }

        // Emit workspace:saved event to all windows for Notion sync
        try {
          const windows = BrowserWindow.getAllWindows()
          const eventData = {
            filePath,
            canvasId: saveData.id,
            version: saveData.version
          }

          for (const win of windows) {
            if (!win.isDestroyed()) {
              win.webContents.send('workspace:saved', eventData)
            }
          }

          // Emit plugin event and update workspace cache for plugin workspace-read access
          // Note: workflowSync is triggered via plugin event handler, not directly
          emitPluginEvent('workspace:saved', eventData)
          updateWorkspaceCache({ nodes: saveData.nodes, edges: saveData.edges })
        } catch (eventError) {
          // Event emission failure should not break the save
          console.warn('[Workspace] Failed to emit workspace:saved event:', eventError)
        }
      }

      await executeSave(data)
      await drainSaveQueue(data.id, executeSave)

      return { success: true }
    } catch (error) {
      // Ensure queue is released on error so future saves aren't permanently blocked
      const entry = saveQueues.get(data.id)
      if (entry) entry.inFlight = false
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace:load', async (_event, id: string) => {
    // Zod validation (SEC-0.1j)
    const parsed = WorkspaceLoadSchema.safeParse({ id })
    if (!parsed.success) {
      return { success: false, error: `Validation failed: ${parsed.error.issues[0]?.message || 'Invalid input'}` }
    }

    try {
      await ensureWorkspacesDir()
      const filePath = join(WORKSPACES_DIR, `${id}.json`)
      const content = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(content)
      const data = validateWorkspaceData(parsed) as unknown as WorkspaceData
      backupManager.start(id)

      // Phase 4B: Migrate inline conversation messages to JSONL sidecar
      try {
        await migrateInlineMessages(id, filePath)
      } catch (migrationError) {
        // Non-fatal: migration failure should not block workspace load
        console.warn('[Workspace] JSONL migration failed (non-fatal):', migrationError)
      }

      // Populate plugin workspace cache and emit lifecycle event for NodeSyncEngine
      try {
        updateWorkspaceCache({ nodes: data.nodes, edges: data.edges })
        emitPluginEvent('workspace:loaded', { filePath, canvasId: data.id })
      } catch (loadEventError) {
        console.warn('[Workspace] Failed to emit workspace:loaded event:', loadEventError)
      }

      return { success: true, data }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace:list', async () => {
    try {
      await ensureWorkspacesDir()
      const files = await fs.readdir(WORKSPACES_DIR)
      const workspaces: WorkspaceInfo[] = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const filePath = join(WORKSPACES_DIR, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const parsed = JSON.parse(content)
          const data = validateWorkspaceData(parsed) as unknown as WorkspaceData
          workspaces.push({
            id: data.id,
            name: data.name,
            path: filePath,
            updatedAt: data.updatedAt,
            nodeCount: data.nodes.length
          })
        } catch {
          // Skip invalid files
        }
      }

      return { success: true, data: workspaces }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace:delete', async (_event, id: string) => {
    // Zod validation (SEC-0.1j)
    const validated = WorkspaceDeleteSchema.safeParse({ id })
    if (!validated.success) {
      return { success: false, error: `Validation failed: ${validated.error.issues[0]?.message || 'Invalid input'}` }
    }

    try {
      const filePath = join(WORKSPACES_DIR, `${id}.json`)
      await fs.unlink(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace:getLastId', async () => {
    try {
      const settingsPath = join(app.getPath('userData'), 'settings.json')
      const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
      return settings.lastWorkspaceId || null
    } catch {
      return null
    }
  })

  // Save workspace to arbitrary file path (Save As) — also atomic (0.2b)
  ipcMain.handle('workspace:saveAs', async (_event, data: WorkspaceData, filePath: string) => {
    // Zod validation (SEC-0.1j)
    const parsed = WorkspaceSaveAsSchema.safeParse({ data, filePath })
    if (!parsed.success) {
      return { success: false, error: `Validation failed: ${parsed.error.issues[0]?.message || 'Invalid input'}` }
    }

    try {
      await atomicWriteFile(filePath, JSON.stringify(data, null, 2))
      return { success: true, path: filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Load workspace from arbitrary file path
  ipcMain.handle('workspace:loadFromPath', async (_event, filePath: string) => {
    // Zod validation (SEC-0.1j)
    const validated = WorkspaceLoadFromPathSchema.safeParse({ filePath })
    if (!validated.success) {
      return { success: false, error: `Validation failed: ${validated.error.issues[0]?.message || 'Invalid input'}` }
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(content)
      const data = validateWorkspaceData(parsed) as unknown as WorkspaceData
      return { success: true, data, path: filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Watch a workspace file for external changes
  ipcMain.handle('workspace:watch', async (_event, id: string) => {
    // Zod validation (SEC-0.1j)
    const parsed = WorkspaceWatchSchema.safeParse({ id })
    if (!parsed.success) {
      return { success: false, error: `Validation failed: ${parsed.error.issues[0]?.message || 'Invalid input'}` }
    }

    try {
      // Stop any existing watcher for this ID
      const existingTimer = activeDebounceTimers.get(id)
      if (existingTimer) clearTimeout(existingTimer)
      activeDebounceTimers.delete(id)

      const existing = activeWatchers.get(id)
      if (existing) {
        existing.close()
        activeWatchers.delete(id)
      }

      await ensureWorkspacesDir()
      const filePath = join(WORKSPACES_DIR, `${id}.json`)

      // Verify file exists before watching
      await fs.access(filePath)

      const watcher = fsWatch(filePath, async (eventType) => {
        // Handle both 'change' and 'rename' events (Windows editors use write-to-temp-then-rename)
        if (eventType === 'rename') {
          // Verify the file still exists (was replaced, not deleted)
          try { await fs.access(filePath) } catch { return }
        } else if (eventType !== 'change') {
          return
        }

        // Self-write detection: ignore changes within grace period of our own save
        if (Date.now() - lastSaveTimestamp < SELF_WRITE_GRACE_MS) return

        // Debounce rapid changes (editors may write multiple times)
        const existingTimer = activeDebounceTimers.get(id)
        if (existingTimer) clearTimeout(existingTimer)

        const timer = setTimeout(() => {
          activeDebounceTimers.delete(id)
          // Notify all renderer windows
          const windows = BrowserWindow.getAllWindows()
          for (const win of windows) {
            if (!win.isDestroyed()) {
              win.webContents.send('workspace:external-change', id)
            }
          }
        }, 500)
        activeDebounceTimers.set(id, timer)
      })

      watcher.on('error', (err) => {
        console.error(`[Workspace watcher] Error watching ${id}:`, err)
        const timer = activeDebounceTimers.get(id)
        if (timer) clearTimeout(timer)
        activeDebounceTimers.delete(id)
        activeWatchers.delete(id)
      })

      activeWatchers.set(id, watcher)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Stop watching a workspace file
  ipcMain.handle('workspace:unwatch', async (_event, id: string) => {
    try {
      const timer = activeDebounceTimers.get(id)
      if (timer) clearTimeout(timer)
      activeDebounceTimers.delete(id)

      const watcher = activeWatchers.get(id)
      if (watcher) {
        watcher.close()
        activeWatchers.delete(id)
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Show save dialog
  ipcMain.handle('dialog:showSaveDialog', async (_event, options: SaveDialogOptions) => {
    try {
      const window = BrowserWindow.getFocusedWindow()
      const result = await dialog.showSaveDialog(window || undefined as unknown as BrowserWindow, {
        title: options.title || 'Save Workspace',
        defaultPath: options.defaultPath,
        filters: options.filters || [
          { name: 'Cognograph Workspace', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      return { success: true, canceled: result.canceled, filePath: result.filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Show open dialog
  ipcMain.handle('dialog:showOpenDialog', async (_event, options: OpenDialogOptions) => {
    try {
      const window = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(window || undefined as unknown as BrowserWindow, {
        title: options.title || 'Open Workspace',
        defaultPath: options.defaultPath,
        filters: options.filters || [
          { name: 'Cognograph Workspace', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: options.properties || ['openFile']
      })
      return { success: true, canceled: result.canceled, filePaths: result.filePaths }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Download artifact to file
  ipcMain.handle('artifact:download', async (_event, artifact: ArtifactDownloadRequest) => {
    try {
      const window = BrowserWindow.getFocusedWindow()

      // Determine file extension and default filename
      const ext = getExtensionForContentType(artifact.contentType, artifact.language)
      const sanitizedTitle = artifact.title.replace(/[<>:"/\\|?*]/g, '_')
      const defaultFilename = `${sanitizedTitle}.${ext}`

      // For multi-file artifacts, we'd need archiver but for now just handle single file
      // Multi-file support can be added later with npm archiver package
      if (artifact.files && artifact.files.length > 1) {
        // For now, show dialog to save first file and inform user
        // Full zip support would require adding archiver dependency
        const firstFile = artifact.files[0]!
        const result = await dialog.showSaveDialog(window || undefined as unknown as BrowserWindow, {
          title: 'Save Artifact (Multi-file - saving first file)',
          defaultPath: firstFile.filename,
          filters: [{ name: 'All Files', extensions: ['*'] }]
        })

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true }
        }

        await fs.writeFile(result.filePath, firstFile.content, 'utf-8')
        return { success: true, path: result.filePath, note: 'Multi-file artifact: only first file saved. Full zip support coming soon.' }
      }

      // Single file download
      const result = await dialog.showSaveDialog(window || undefined as unknown as BrowserWindow, {
        title: 'Save Artifact',
        defaultPath: defaultFilename,
        filters: [
          { name: `${artifact.contentType.toUpperCase()} Files`, extensions: [ext] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      // Handle base64 images differently
      if (artifact.isBase64 && artifact.content.startsWith('data:')) {
        const base64Data = artifact.content.split(',')[1] ?? ''
        await fs.writeFile(result.filePath, Buffer.from(base64Data, 'base64'))
      } else {
        await fs.writeFile(result.filePath, artifact.content, 'utf-8')
      }

      return { success: true, path: result.filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
