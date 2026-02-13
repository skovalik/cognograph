import { ipcMain, dialog, shell, nativeImage, app } from 'electron'
import { join, basename, extname, resolve } from 'path'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import type { Attachment } from '@shared/types'

// Simple MIME type lookup by extension (no external dependency needed)
const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.yaml': 'application/x-yaml',
  '.yml': 'application/x-yaml',
  '.toml': 'application/toml',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.ts': 'application/typescript',
  '.tsx': 'application/typescript',
  '.jsx': 'application/javascript',
  '.py': 'application/x-python',
  '.rb': 'application/x-ruby',
  '.rs': 'text/x-rust',
  '.go': 'text/x-go',
  '.java': 'text/x-java',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c',
  '.hpp': 'text/x-c++',
  '.cs': 'text/x-csharp',
  '.swift': 'text/x-swift',
  '.kt': 'text/x-kotlin',
  '.sh': 'application/x-sh',
  '.bash': 'application/x-sh',
  '.sql': 'application/sql',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return MIME_MAP[ext] || 'application/octet-stream'
}

const WORKSPACES_DIR = join(app.getPath('userData'), 'workspaces')
const ATTACHMENTS_SUBDIR = 'attachments'
const MAX_TEXT_READ_SIZE = 50 * 1024 // 50KB limit for text content injection
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024 // 50MB max file size
const MAX_IMAGE_THUMBNAIL_SIZE = 20 * 1024 * 1024 // 20MB max for thumbnail generation
const THUMBNAIL_SIZE = 128

// Validate that a stored path resolves within the attachments directory (prevents path traversal)
function validateStoredPath(storedPath: string): string {
  const fullPath = resolve(join(WORKSPACES_DIR, storedPath))
  const attachmentsDir = resolve(join(WORKSPACES_DIR, ATTACHMENTS_SUBDIR))
  if (!fullPath.startsWith(attachmentsDir + '\\') && !fullPath.startsWith(attachmentsDir + '/') && fullPath !== attachmentsDir) {
    throw new Error('Invalid attachment path')
  }
  return fullPath
}

// Ensure attachments directory exists
async function ensureAttachmentsDir(): Promise<string> {
  const dir = join(WORKSPACES_DIR, ATTACHMENTS_SUBDIR)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

// Check if a MIME type is an image
function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

// Check if a MIME type is text-based (for context injection)
function isTextMime(mimeType: string): boolean {
  if (mimeType.startsWith('text/')) return true
  const textTypes = [
    'application/json',
    'application/xml',
    'application/javascript',
    'application/typescript',
    'application/x-yaml',
    'application/x-sh',
    'application/sql',
    'application/x-python',
    'application/x-ruby'
  ]
  return textTypes.includes(mimeType)
}

// Generate thumbnail for image files using Electron's nativeImage
async function generateThumbnail(filePath: string): Promise<string | undefined> {
  try {
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return undefined

    const size = image.getSize()
    const scale = Math.min(THUMBNAIL_SIZE / size.width, THUMBNAIL_SIZE / size.height, 1)
    const resized = image.resize({
      width: Math.round(size.width * scale),
      height: Math.round(size.height * scale),
      quality: 'good'
    })

    const jpeg = resized.toJPEG(70)
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return undefined
  }
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function registerAttachmentHandlers(): void {
  // Add attachment: open file picker, copy to attachments dir, return metadata
  ipcMain.handle('attachments:add', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Attach File',
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
          { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'doc', 'docx'] },
          { name: 'Code', extensions: ['ts', 'js', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'css', 'scss'] }
        ]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null }
      }

      const originalPath = result.filePaths[0]!
      const filename = basename(originalPath)
      const ext = extname(filename)
      const uuid = randomUUID()
      const storedFilename = `${uuid}${ext}`

      // Get file stats BEFORE copying to validate size
      const stats = await fs.stat(originalPath)
      if (stats.size > MAX_ATTACHMENT_SIZE) {
        return { success: false, error: `File too large (${formatFileSize(stats.size)}, max ${formatFileSize(MAX_ATTACHMENT_SIZE)})` }
      }

      // Ensure attachments directory exists
      const attachmentsDir = await ensureAttachmentsDir()
      const storedFullPath = join(attachmentsDir, storedFilename)

      // Copy file to attachments directory
      await fs.copyFile(originalPath, storedFullPath)

      // Determine MIME type
      const mimeType = getMimeType(filename)

      // Generate thumbnail for images (only if under size threshold)
      let thumbnail: string | undefined
      if (isImageMime(mimeType) && stats.size <= MAX_IMAGE_THUMBNAIL_SIZE) {
        thumbnail = await generateThumbnail(storedFullPath)
      }

      const attachment: Attachment = {
        id: uuid,
        filename,
        originalPath,
        storedPath: `${ATTACHMENTS_SUBDIR}/${storedFilename}`,
        mimeType,
        size: stats.size,
        addedAt: new Date().toISOString(),
        thumbnail
      }

      return { success: true, data: attachment }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Delete attachment: remove file from disk
  ipcMain.handle('attachments:delete', async (_event, storedPath: string) => {
    try {
      const fullPath = validateStoredPath(storedPath)
      await fs.unlink(fullPath)
      return { success: true }
    } catch (error) {
      // File might already be deleted - that's OK
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: true }
      }
      return { success: false, error: String(error) }
    }
  })

  // Open attachment in system default app
  ipcMain.handle('attachments:open', async (_event, storedPath: string) => {
    try {
      const fullPath = validateStoredPath(storedPath)
      // Verify file exists before trying to open
      await fs.access(fullPath)
      await shell.openPath(fullPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Read text content of attachment for AI context injection
  ipcMain.handle('attachments:readText', async (_event, storedPath: string) => {
    try {
      const fullPath = validateStoredPath(storedPath)
      const stats = await fs.stat(fullPath)

      // Skip files that are too large
      if (stats.size > MAX_TEXT_READ_SIZE) {
        return { success: true, data: null, reason: `File too large (${formatFileSize(stats.size)}, max ${formatFileSize(MAX_TEXT_READ_SIZE)})` }
      }

      // Determine MIME type from stored path
      const mimeType = getMimeType(storedPath)
      if (!isTextMime(mimeType)) {
        return { success: true, data: null, reason: 'Not a text file' }
      }

      const content = await fs.readFile(fullPath, 'utf-8')
      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
