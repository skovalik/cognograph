/**
 * Keyboard Shortcut System
 *
 * Defines all customizable shortcuts and provides matching utilities.
 * Shortcuts are defined as a combo string like "Ctrl+S", "Alt+H", "Shift+N".
 */

export interface ShortcutDefinition {
  id: string
  label: string
  defaultCombo: string
  category: 'file' | 'edit' | 'view' | 'create' | 'panels' | 'navigation' | 'ai'
}

/**
 * Parse a combo string like "Ctrl+Shift+S" into components.
 */
export function parseCombo(combo: string): {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
} {
  const parts = combo.split('+')
  const key = parts[parts.length - 1] || ''
  return {
    ctrl: parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    meta: parts.includes('Meta'),
    key: key.length === 1 ? key : key // Keep as-is for special keys like "Delete", "Escape"
  }
}

/**
 * Check if a keyboard event matches a combo string.
 */
export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  const parsed = parseCombo(combo)

  const ctrlOrMeta = e.ctrlKey || e.metaKey
  if (parsed.ctrl !== ctrlOrMeta) return false
  if (parsed.shift !== e.shiftKey) return false
  if (parsed.alt !== e.altKey) return false

  // Key comparison — case-insensitive for letters
  const eventKey = e.key.length === 1 ? e.key : e.key
  const comboKey = parsed.key

  // Handle special keys
  if (comboKey === 'Delete') return e.key === 'Delete' || e.key === 'Backspace'
  if (comboKey === 'Escape') return e.key === 'Escape'
  if (comboKey === 'Tab') return e.key === 'Tab'
  if (comboKey === '?') return e.key === '?'
  if (comboKey === '/') return e.key === '/'
  if (comboKey === '\\') return e.key === '\\'
  if (comboKey === '[') return e.key === '['
  if (comboKey === ']') return e.key === ']'

  // For single characters, compare case-insensitively
  return eventKey.toLowerCase() === comboKey.toLowerCase()
}

/**
 * Format a combo for display (e.g., "Ctrl+S" → "⌘S" on Mac)
 */
export function formatCombo(combo: string): string {
  const isMac = navigator.platform.includes('Mac')

  return combo
    .replace('Ctrl+', isMac ? '\u2318' : 'Ctrl+')
    .replace('Shift+', isMac ? '\u21E7' : 'Shift+')
    .replace('Alt+', isMac ? '\u2325' : 'Alt+')
    .replace('Meta+', isMac ? '\u2318' : 'Win+')
}

/**
 * Convert a keyboard event to a combo string for recording.
 */
export function eventToCombo(e: KeyboardEvent): string | null {
  // Ignore bare modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  // Normalize the key
  let key = e.key
  if (key === ' ') key = 'Space'
  if (key.length === 1) key = key.toUpperCase()

  parts.push(key)
  return parts.join('+')
}

// =============================================================================
// Default Shortcut Definitions
// =============================================================================

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // File
  { id: 'save', label: 'Save', defaultCombo: 'Ctrl+S', category: 'file' },
  { id: 'saveAs', label: 'Save As', defaultCombo: 'Ctrl+Shift+E', category: 'file' },
  { id: 'newWorkspace', label: 'New Workspace', defaultCombo: 'Ctrl+N', category: 'file' },
  { id: 'openWorkspace', label: 'Open Workspace', defaultCombo: 'Ctrl+O', category: 'file' },
  { id: 'export', label: 'Export', defaultCombo: 'Ctrl+Shift+X', category: 'file' },

  // Edit
  { id: 'undo', label: 'Undo', defaultCombo: 'Ctrl+Z', category: 'edit' },
  { id: 'redo', label: 'Redo', defaultCombo: 'Ctrl+Shift+Z', category: 'edit' },
  { id: 'copy', label: 'Copy', defaultCombo: 'Ctrl+C', category: 'edit' },
  { id: 'cut', label: 'Cut', defaultCombo: 'Ctrl+X', category: 'edit' },
  { id: 'paste', label: 'Paste', defaultCombo: 'Ctrl+V', category: 'edit' },
  { id: 'selectAll', label: 'Select All', defaultCombo: 'Ctrl+A', category: 'edit' },
  { id: 'delete', label: 'Delete', defaultCombo: 'Delete', category: 'edit' },

  // View
  { id: 'toggleSidebar', label: 'Toggle Sidebar', defaultCombo: 'Ctrl+\\', category: 'view' },
  { id: 'toggleMinimap', label: 'Toggle Minimap', defaultCombo: 'Alt+M', category: 'view' },
  { id: 'linkNodes', label: 'Link Selected Nodes', defaultCombo: 'Ctrl+L', category: 'view' },
  { id: 'unlinkNodes', label: 'Unlink Selected Nodes', defaultCombo: 'Ctrl+Shift+L', category: 'view' },
  { id: 'commandPalette', label: 'Command Palette', defaultCombo: 'Ctrl+K', category: 'view' },
  { id: 'shortcutHelp', label: 'Keyboard Shortcuts', defaultCombo: '?', category: 'view' },
  { id: 'bringForward', label: 'Bring Forward', defaultCombo: 'Ctrl+]', category: 'view' },
  { id: 'sendBackward', label: 'Send Backward', defaultCombo: 'Ctrl+[', category: 'view' },

  // Create (Shift+letter)
  { id: 'createNote', label: 'New Note', defaultCombo: 'Shift+N', category: 'create' },
  { id: 'createConversation', label: 'New Conversation', defaultCombo: 'Shift+C', category: 'create' },
  { id: 'createAgent', label: 'New Agent', defaultCombo: 'Ctrl+Shift+A', category: 'create' },
  { id: 'createTask', label: 'New Task', defaultCombo: 'Shift+T', category: 'create' },
  { id: 'createProject', label: 'New Project', defaultCombo: 'Shift+P', category: 'create' },
  { id: 'createArtifact', label: 'New Artifact', defaultCombo: 'Shift+A', category: 'create' },
  { id: 'createWorkspace', label: 'New Workspace Node', defaultCombo: 'Shift+W', category: 'create' },
  { id: 'createText', label: 'New Text', defaultCombo: 'Shift+X', category: 'create' },
  { id: 'createAction', label: 'New Action', defaultCombo: 'Shift+Z', category: 'create' },
  { id: 'createOrchestrator', label: 'New Orchestrator', defaultCombo: 'Shift+O', category: 'create' },

  // Panels
  { id: 'sidebarOutline', label: 'Sidebar: Outline', defaultCombo: 'Ctrl+1', category: 'panels' },
  { id: 'sidebarActivity', label: 'Sidebar: Activity', defaultCombo: 'Ctrl+2', category: 'panels' },
  { id: 'sidebarDispatch', label: 'Sidebar: Dispatch', defaultCombo: 'Ctrl+3', category: 'panels' },
  { id: 'toggleUndoHistory', label: 'Undo History', defaultCombo: 'Alt+H', category: 'panels' },
  { id: 'toggleTrash', label: 'Trash Panel', defaultCombo: 'Alt+T', category: 'panels' },
  { id: 'toggleArchive', label: 'Archive Panel', defaultCombo: 'Alt+A', category: 'panels' },
  { id: 'toggleSavedViews', label: 'Saved Views', defaultCombo: 'Alt+V', category: 'panels' },
  { id: 'toggleTimeline', label: 'Timeline', defaultCombo: 'Alt+L', category: 'panels' },

  // Navigation
  { id: 'navigateBack', label: 'Navigate Back', defaultCombo: 'Alt+ArrowLeft', category: 'navigation' },
  { id: 'navigateForward', label: 'Navigate Forward', defaultCombo: 'Alt+ArrowRight', category: 'navigation' },
  { id: 'toggleFocusMode', label: 'Focus Mode', defaultCombo: 'Alt+F', category: 'navigation' },
  { id: 'bookmarkNode', label: 'Bookmark Node', defaultCombo: 'Alt+B', category: 'navigation' },
  { id: 'jumpToBookmark', label: 'Jump to Bookmark', defaultCombo: 'Alt+G', category: 'navigation' },
  { id: 'toggleCollapse', label: 'Toggle Collapse', defaultCombo: 'Alt+.', category: 'navigation' },
  { id: 'toggleTheme', label: 'Toggle Theme', defaultCombo: 'Alt+D', category: 'navigation' },
  { id: 'cycleNodeMode', label: 'Cycle Node Mode', defaultCombo: 'M', category: 'navigation' },

  // View (Theme)
  { id: 'themeMenu', label: 'Theme Menu', defaultCombo: 'Ctrl+T', category: 'view' },

  // AI
  { id: 'inlinePrompt', label: 'Inline Prompt', defaultCombo: '/', category: 'ai' },
  { id: 'toggleAISidebar', label: 'AI Sidebar', defaultCombo: 'Ctrl+Shift+I', category: 'ai' },
  { id: 'openAIEditor', label: 'AI Editor', defaultCombo: 'Ctrl+E', category: 'ai' },
  { id: 'templateBrowser', label: 'Template Browser', defaultCombo: 'Ctrl+Shift+T', category: 'ai' },
  { id: 'saveAsTemplate', label: 'Save as Template', defaultCombo: 'Ctrl+Shift+S', category: 'ai' }
]

/**
 * Get the active combo for a shortcut, accounting for user overrides.
 */
export function getActiveCombo(
  shortcutId: string,
  overrides: Record<string, string>
): string {
  if (overrides[shortcutId]) return overrides[shortcutId]
  const def = DEFAULT_SHORTCUTS.find(s => s.id === shortcutId)
  return def?.defaultCombo || ''
}

/**
 * Check if a keyboard event matches a named shortcut (with overrides).
 */
export function matchesShortcut(
  e: KeyboardEvent,
  shortcutId: string,
  overrides: Record<string, string>
): boolean {
  const combo = getActiveCombo(shortcutId, overrides)
  if (!combo) return false
  return matchesCombo(e, combo)
}

/**
 * Find conflicts: returns the shortcut ID that already uses the given combo.
 */
export function findConflict(
  combo: string,
  excludeId: string,
  overrides: Record<string, string>
): string | null {
  for (const def of DEFAULT_SHORTCUTS) {
    if (def.id === excludeId) continue
    const activeCombo = getActiveCombo(def.id, overrides)
    if (activeCombo === combo) return def.id
  }
  return null
}
