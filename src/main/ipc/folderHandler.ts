// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * IPC handler for folder listing — reads directory contents for project/artifact
 * node file listing feature. Validates paths, caps at 200 entries.
 */

import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface FolderListEntry {
  name: string
  type: 'file' | 'directory'
}

export interface FolderListResult {
  success: boolean
  entries: FolderListEntry[]
  total: number
  truncated: boolean
  error?: string
}

const MAX_ENTRIES = 200

export function registerFolderHandlers(): void {
  ipcMain.handle('folder:list', async (_event, folderPath: string): Promise<FolderListResult> => {
    // Validate input
    if (typeof folderPath !== 'string' || !folderPath.trim()) {
      return { success: false, entries: [], total: 0, truncated: false, error: 'Invalid path' }
    }

    if (folderPath.includes('\x00')) {
      return { success: false, entries: [], total: 0, truncated: false, error: 'Invalid path characters' }
    }

    if (!path.isAbsolute(folderPath)) {
      return { success: false, entries: [], total: 0, truncated: false, error: 'Path must be absolute' }
    }

    const parsed = path.parse(folderPath)
    if (parsed.root === folderPath) {
      return { success: false, entries: [], total: 0, truncated: false, error: 'Cannot list root directory' }
    }

    try {
      const resolved = path.resolve(folderPath)
      const stat = fs.statSync(resolved)

      if (!stat.isDirectory()) {
        return { success: false, entries: [], total: 0, truncated: false, error: 'Not a directory' }
      }

      const dirents = fs.readdirSync(resolved, { withFileTypes: true })
      const total = dirents.length

      // Sort: directories first, then files, alphabetical within each group
      const sorted = dirents.sort((a, b) => {
        const aIsDir = a.isDirectory() ? 0 : 1
        const bIsDir = b.isDirectory() ? 0 : 1
        if (aIsDir !== bIsDir) return aIsDir - bIsDir
        return a.name.localeCompare(b.name)
      })

      const entries: FolderListEntry[] = sorted
        .slice(0, MAX_ENTRIES)
        .map(d => ({
          name: d.name,
          type: d.isDirectory() ? 'directory' as const : 'file' as const,
        }))

      return {
        success: true,
        entries,
        total,
        truncated: total > MAX_ENTRIES,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('ENOENT')) {
        return { success: false, entries: [], total: 0, truncated: false, error: 'Folder not found' }
      }
      if (message.includes('EACCES') || message.includes('EPERM')) {
        return { success: false, entries: [], total: 0, truncated: false, error: 'Permission denied' }
      }
      return { success: false, entries: [], total: 0, truncated: false, error: message }
    }
  })
}
