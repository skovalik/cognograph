/**
 * Activity Watcher — Main Process
 *
 * Monitors the Claude Code activity JSONL file (.cognograph-activity/events.jsonl)
 * using fs.watch. When new lines are appended by the CC PostToolUse hook, this
 * service reads the new content, parses events, and forwards them to the renderer
 * via IPC on the 'cc-bridge:activity' channel.
 *
 * Key design decisions:
 * - Uses fs.watch (not chokidar) — chokidar is not in package.json (GAP-F6).
 * - Windows fs.watch fires duplicate events — debounced with configurable interval.
 * - Tracks byte offset (lastSize) to only read newly appended lines.
 * - Partial JSON lines (mid-write race) are caught by try/catch and retried on next trigger.
 * - Auto-creates the .cognograph-activity/ directory at startup.
 *
 * @module activityWatcher
 */

import { watch, readFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { BrowserWindow } from 'electron'
import path from 'path'
import type { FSWatcher } from 'fs'
import type { CCActivityEvent, CCBridgeConfig } from '@shared/bridge-types'
import { DEFAULT_CC_BRIDGE_CONFIG } from '@shared/bridge-types'

// -----------------------------------------------------------------------------
// Module State
// -----------------------------------------------------------------------------

let watcher: FSWatcher | null = null
let lastSize = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let currentConfig: CCBridgeConfig = { ...DEFAULT_CC_BRIDGE_CONFIG }
let currentEventsPath: string | null = null

// In-memory ring buffer for getHistory (main-process side)
const eventHistory: CCActivityEvent[] = []
const MAX_HISTORY = 1000

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Start watching the Claude Code activity events file.
 *
 * @param projectDir - The project root directory where .cognograph-activity/ lives.
 * @param config - Optional bridge configuration overrides.
 */
export function startActivityWatcher(
  projectDir: string,
  config?: Partial<CCBridgeConfig>
): void {
  // Merge config
  currentConfig = { ...DEFAULT_CC_BRIDGE_CONFIG, ...config }

  const activityDir = path.join(projectDir, currentConfig.activityDir)
  const eventsFile = path.join(activityDir, 'events.jsonl')
  currentEventsPath = eventsFile

  // Auto-create the activity directory if it does not exist
  mkdirSync(activityDir, { recursive: true })

  // Stop any existing watcher before starting a new one
  stopActivityWatcher()

  // Initialize lastSize from current file size (if file exists)
  try {
    if (existsSync(eventsFile)) {
      const stat = statSync(eventsFile)
      lastSize = stat.size
    } else {
      lastSize = 0
    }
  } catch {
    lastSize = 0
  }

  console.log(`[ActivityWatcher] Watching: ${eventsFile}`)

  // Watch the activity directory (not the file) to handle file creation/deletion
  // fs.watch on a directory is more reliable on Windows than watching a file that
  // may not exist yet.
  try {
    watcher = watch(activityDir, (eventType, filename) => {
      // Only react to changes to events.jsonl
      if (filename !== 'events.jsonl') return

      // Handle rename: file was deleted or recreated
      if (eventType === 'rename') {
        if (!existsSync(eventsFile)) {
          lastSize = 0
          return
        }
        // File was recreated — reset and read from beginning
        lastSize = 0
      }

      // Debounce: Windows fs.watch fires duplicate 'change' events
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        readNewEvents(eventsFile)
      }, currentConfig.watchDebounceMs)
    })

    watcher.on('error', (err) => {
      console.error('[ActivityWatcher] Watcher error:', err)
    })
  } catch (err) {
    console.error('[ActivityWatcher] Failed to start watcher:', err)
  }
}

/**
 * Stop the activity watcher and clean up resources.
 */
export function stopActivityWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (watcher) {
    watcher.close()
    watcher = null
  }
  lastSize = 0
  currentEventsPath = null
  console.log('[ActivityWatcher] Stopped')
}

/**
 * Get recent events from the in-memory history buffer.
 *
 * @param limit - Maximum number of events to return (default: 100)
 * @returns Array of recent events in chronological order
 */
export function getEventHistory(limit = 100): CCActivityEvent[] {
  const start = Math.max(0, eventHistory.length - limit)
  return eventHistory.slice(start)
}

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

/**
 * Read newly appended lines from the events JSONL file and dispatch to renderer.
 */
function readNewEvents(eventsFile: string): void {
  if (!existsSync(eventsFile)) return

  try {
    const content = readFileSync(eventsFile, 'utf8')
    const newContent = content.slice(lastSize)

    if (!newContent.trim()) return

    const lines = newContent.trim().split('\n')
    let bytesSuccessfullyParsed = 0
    const newEvents: CCActivityEvent[] = []

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as CCActivityEvent
        // Basic validation: must have type and timestamp
        if (parsed.type && parsed.timestamp && parsed.sessionId) {
          newEvents.push(parsed)
        }
        // Track bytes of successfully parsed lines (line + newline char)
        bytesSuccessfullyParsed += Buffer.byteLength(line + '\n', 'utf8')
      } catch {
        // Partial line (mid-write race) — stop here.
        // This line and any after it will be re-read on the next watch trigger.
        break
      }
    }

    // Advance lastSize only by bytes of successfully parsed lines
    lastSize += bytesSuccessfullyParsed

    // Add to history buffer (with FIFO eviction)
    for (const event of newEvents) {
      eventHistory.push(event)
    }
    while (eventHistory.length > MAX_HISTORY) {
      eventHistory.shift()
    }

    // Send events to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow && !mainWindow.isDestroyed()) {
      for (const event of newEvents) {
        mainWindow.webContents.send('cc-bridge:activity', event)
      }
    }
  } catch (error) {
    console.error('[ActivityWatcher] Error reading events:', error)
  }
}
