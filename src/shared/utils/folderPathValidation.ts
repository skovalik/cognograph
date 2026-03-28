// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Folder path validation — shared between renderer (properties panel),
 * main process (IPC handlers, MCP tools), and preload bridge.
 */

import * as path from 'path'

export interface FolderPathValidationResult {
  valid: boolean
  resolved?: string
  error?: string
}

/**
 * Validate a folder path for use as a project/artifact folder reference.
 * Rejects: non-strings, empty, non-absolute, root directories, null bytes.
 * Returns the resolved (normalized) path on success.
 */
export function validateFolderPath(input: unknown): FolderPathValidationResult {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Folder path must be a string' }
  }

  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return { valid: false, error: 'Folder path cannot be empty' }
  }

  // Reject null bytes
  if (trimmed.includes('\x00')) {
    return { valid: false, error: 'Folder path contains invalid characters' }
  }

  // Must be absolute
  if (!path.isAbsolute(trimmed)) {
    return { valid: false, error: 'Folder path must be absolute' }
  }

  const resolved = path.resolve(trimmed)

  // Reject root directories
  const parsed = path.parse(resolved)
  if (parsed.root === resolved || (parsed.dir === parsed.root && !parsed.base)) {
    return { valid: false, error: 'Cannot use a root directory as a project folder' }
  }

  return { valid: true, resolved }
}
