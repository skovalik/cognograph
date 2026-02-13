/**
 * Audit Service (Phase 2: Bridge Log - Main Process)
 *
 * Handles:
 * - Undo operations for audit events (node create/delete/update, edge create/delete)
 * - Export file generation (delegates to renderer via IPC response)
 * - Audit event persistence (future: external audit log sinks)
 */

import { ipcMain, BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'fs'

// =============================================================================
// Undo Handler
// =============================================================================

/**
 * Process an undo request for a previously logged audit event.
 *
 * This function determines the type of undo from the undoData shape
 * and returns success/failure. The actual state mutation is performed
 * on the renderer side via workspaceStore actions after this returns.
 */
export async function undoAuditEvent(
  _eventId: string,
  undoData: unknown
): Promise<{ success: boolean; undoType?: string; error?: string }> {
  try {
    const data = undoData as Record<string, unknown>

    // Undo a creation: data has nodeId but no node snapshot
    if (data.nodeId && !data.node) {
      return {
        success: true,
        undoType: 'delete-created-node',
      }
    }

    // Undo a deletion: data has full node snapshot
    if (data.node) {
      return {
        success: true,
        undoType: 'restore-deleted-node',
      }
    }

    // Undo an update: data has before state and targetId
    if (data.before && data.targetId) {
      return {
        success: true,
        undoType: 'revert-node-update',
      }
    }

    // Undo an edge creation
    if (data.edgeId && !data.edge) {
      return {
        success: true,
        undoType: 'delete-created-edge',
      }
    }

    // Undo an edge deletion
    if (data.edge) {
      return {
        success: true,
        undoType: 'restore-deleted-edge',
      }
    }

    return { success: false, error: 'Unknown undo data format' }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// =============================================================================
// Export Handler
// =============================================================================

/**
 * Save audit export to file via native dialog.
 */
export async function exportAuditToFile(
  content: string,
  format: 'csv' | 'json'
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No focused window' }

    const ext = format === 'json' ? 'json' : 'csv'
    const defaultFilename = `bridge-log-${new Date().toISOString().slice(0, 10)}.${ext}`

    const result = await dialog.showSaveDialog(win, {
      title: `Export Bridge Log as ${format.toUpperCase()}`,
      defaultPath: defaultFilename,
      filters: [
        {
          name: format === 'json' ? 'JSON Files' : 'CSV Files',
          extensions: [ext],
        },
      ],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled' }
    }

    await fs.writeFile(result.filePath, content, 'utf-8')
    return { success: true, path: result.filePath }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// =============================================================================
// IPC Registration
// =============================================================================

export function registerAuditHandlers(): void {
  // Undo an audit event
  ipcMain.handle(
    'bridge:audit-undo',
    async (_event, eventId: string, undoData: unknown) => {
      return undoAuditEvent(eventId, undoData)
    }
  )

  // Export audit log to file
  ipcMain.handle(
    'bridge:audit-export',
    async (_event, content: string, format: 'csv' | 'json') => {
      return exportAuditToFile(content, format)
    }
  )
}
