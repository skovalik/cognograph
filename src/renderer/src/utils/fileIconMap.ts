// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Map file extensions to Lucide icon names for file listing display.
 */

export type FileIconName =
  | 'FileCode'
  | 'FileText'
  | 'FileImage'
  | 'FileVideo'
  | 'FileAudio'
  | 'File'
  | 'Folder'

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift',
  '.kt', '.scala', '.sh', '.bash', '.zsh', '.ps1', '.lua',
  '.r', '.sql', '.graphql', '.gql', '.wasm', '.zig', '.ex', '.exs',
])

const TEXT_EXTS = new Set([
  '.md', '.txt', '.csv', '.json', '.yaml', '.yml', '.toml',
  '.xml', '.html', '.htm', '.css', '.scss', '.less', '.ini',
  '.cfg', '.conf', '.env', '.log', '.lock', '.gitignore',
])

const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico',
  '.bmp', '.tiff', '.avif',
])

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv', '.flv'])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'])

export function getFileIconName(filename: string, isDirectory: boolean): FileIconName {
  if (isDirectory) return 'Folder'

  const ext = filename.includes('.')
    ? '.' + filename.split('.').pop()!.toLowerCase()
    : ''

  if (CODE_EXTS.has(ext)) return 'FileCode'
  if (TEXT_EXTS.has(ext)) return 'FileText'
  if (IMAGE_EXTS.has(ext)) return 'FileImage'
  if (VIDEO_EXTS.has(ext)) return 'FileVideo'
  if (AUDIO_EXTS.has(ext)) return 'FileAudio'
  return 'File'
}

/**
 * Normalize a file filter string into an array of lowercase extensions with leading dots.
 * Input: ".tsx, ts, .js" → [".tsx", ".ts", ".js"]
 * Input: "" or "  " → [] (no filter)
 */
export function normalizeFileFilter(filter: string | undefined): string[] {
  if (!filter || !filter.trim()) return []
  return filter
    .split(',')
    .map(ext => {
      const trimmed = ext.trim().toLowerCase()
      return trimmed.startsWith('.') ? trimmed : '.' + trimmed
    })
    .filter(ext => ext.length > 1) // reject bare "."
}

/**
 * Check if a filename matches the active filter.
 * Empty filter = everything matches.
 */
export function matchesFileFilter(filename: string, normalizedFilter: string[]): boolean {
  if (normalizedFilter.length === 0) return true
  const ext = filename.includes('.')
    ? '.' + filename.split('.').pop()!.toLowerCase()
    : ''
  return normalizedFilter.includes(ext)
}
