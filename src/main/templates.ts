/**
 * Template System - Main Process IPC Handlers
 *
 * Handles template library storage at %APPDATA%/cognograph/templates/library.json
 * Templates are stored globally and available across all workspaces.
 */

import { ipcMain, app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import type { TemplateLibrary } from '@shared/types'
import { DEFAULT_TEMPLATE_LIBRARY, SYSTEM_TEMPLATES } from '@shared/types'

const TEMPLATES_DIR = join(app.getPath('userData'), 'templates')
const LIBRARY_FILE = join(TEMPLATES_DIR, 'library.json')

async function ensureTemplatesDir(): Promise<void> {
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true })
  } catch {
    // Directory already exists
  }
}

async function loadLibrary(): Promise<TemplateLibrary> {
  try {
    await ensureTemplatesDir()
    const content = await fs.readFile(LIBRARY_FILE, 'utf-8')
    const data = JSON.parse(content) as TemplateLibrary

    // Schema migration check - add new fields if missing
    if (!data.schemaVersion) {
      data.schemaVersion = 1
    }
    if (!data.templates) {
      data.templates = []
    }
    if (!data.folders) {
      data.folders = []
    }
    if (!data.lastUsedTemplateIds) {
      data.lastUsedTemplateIds = []
    }
    if (!data.favoriteTemplateIds) {
      data.favoriteTemplateIds = []
    }

    // Ensure system templates are always present
    for (const systemTemplate of SYSTEM_TEMPLATES) {
      if (!data.templates.some((t) => t.id === systemTemplate.id)) {
        data.templates.push(systemTemplate)
      }
    }

    return data
  } catch {
    // Return default library with system templates if file doesn't exist or is invalid
    return {
      ...DEFAULT_TEMPLATE_LIBRARY,
      templates: [...SYSTEM_TEMPLATES]
    }
  }
}

async function saveLibrary(library: TemplateLibrary): Promise<void> {
  await ensureTemplatesDir()
  await fs.writeFile(LIBRARY_FILE, JSON.stringify(library, null, 2), 'utf-8')
}

export function registerTemplateHandlers(): void {
  // Load entire template library
  ipcMain.handle('templates:load', async () => {
    try {
      const library = await loadLibrary()
      return { success: true, data: library }
    } catch (error) {
      console.error('[Templates] Failed to load library:', error)
      return { success: false, error: String(error) }
    }
  })

  // Save entire template library
  ipcMain.handle('templates:save', async (_event, library: TemplateLibrary) => {
    try {
      await saveLibrary(library)
      return { success: true }
    } catch (error) {
      console.error('[Templates] Failed to save library:', error)
      return { success: false, error: String(error) }
    }
  })

  // Get templates directory path (for debugging)
  ipcMain.handle('templates:getPath', async () => {
    return TEMPLATES_DIR
  })
}
