// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * IPC handler for folder listing — reads directory contents for project/artifact
 * node file listing feature. Validates paths, caps at 200 entries.
 *
 * Security (SEC-0.1f): Workspace-scoped path validation.
 * Only allows listing directories within:
 * - The active workspace root directory
 * - The user's home directory
 * - Trusted paths from MCP server configs
 */

import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { validatePath } from '../agent/filesystemTools'
import { FolderListInputSchema } from './schemas'

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

// -----------------------------------------------------------------------------
// Sandbox State (SEC-0.1f)
// -----------------------------------------------------------------------------

/** Allowed root directories for folder listing. Updated on workspace load. */
let allowedRoots: string[] = []

/**
 * Set the allowed root directories for folder listing.
 * Called when a workspace is loaded or when MCP server configs change.
 */
export function setFolderListingRoots(workspaceRoot: string | null, trustedPaths?: string[]): void {
  allowedRoots = []

  // Always allow the user's home directory
  const home = os.homedir()
  if (home) {
    allowedRoots.push(path.resolve(home))
  }

  // Add workspace root if available
  if (workspaceRoot) {
    allowedRoots.push(path.resolve(workspaceRoot))
  }

  // Add trusted symlink targets from MCP server configs
  if (trustedPaths && trustedPaths.length > 0) {
    for (const tp of trustedPaths) {
      allowedRoots.push(path.resolve(tp))
    }
  }
}

/**
 * Get the current allowed roots (for testing/inspection).
 * @internal
 */
export function getFolderListingRoots(): string[] {
  return [...allowedRoots]
}

// -----------------------------------------------------------------------------
// IPC Handler
// -----------------------------------------------------------------------------

export function registerFolderHandlers(): void {
  ipcMain.handle('folder:list', async (_event, folderPath: unknown): Promise<FolderListResult> => {
    // Zod schema validation (SEC-0.1j)
    const parsed = FolderListInputSchema.safeParse({ folderPath })
    if (!parsed.success) {
      return { success: false, entries: [], total: 0, truncated: false, error: `Validation failed: ${parsed.error.issues[0]?.message || 'Invalid input'}` }
    }
    const validatedPath = parsed.data.folderPath

    if (validatedPath.includes('\x00')) {
      return { success: false, entries: [], total: 0, truncated: false, error: 'Invalid path characters' }
    }

    if (!path.isAbsolute(validatedPath)) {
      return { success: false, entries: [], total: 0, truncated: false, error: 'Path must be absolute' }
    }

    const pathParsed = path.parse(validatedPath)
    if (pathParsed.root === validatedPath) {
      return { success: false, entries: [], total: 0, truncated: false, error: 'Cannot list root directory' }
    }

    // SEC-0.1f: Workspace-scoped path validation
    if (allowedRoots.length === 0) {
      return { success: false, entries: [], total: 0, truncated: false, error: 'No workspace loaded — folder listing is disabled' }
    }

    const pathValidation = validatePath(validatedPath, allowedRoots)
    if (!pathValidation.valid) {
      return { success: false, entries: [], total: 0, truncated: false, error: `Access denied: path is outside allowed directories` }
    }

    try {
      const resolved = pathValidation.resolved
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
