/**
 * KeyboardShortcutsHelp - Overlay showing all available keyboard shortcuts
 *
 * ND-friendly feature: Makes all shortcuts discoverable in one place,
 * reducing memory load. Press ? to open (when not in an input field).
 */

import { memo, useEffect, useCallback } from 'react'
import { X, Keyboard } from 'lucide-react'
import { create } from 'zustand'

// Store for shortcut help visibility
interface ShortcutHelpStore {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useShortcutHelpStore = create<ShortcutHelpStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen }))
}))

// Shortcut categories
interface ShortcutCategory {
  title: string
  shortcuts: Array<{ keys: string; description: string }>
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'Tab', description: 'Cycle through nodes' },
      { keys: 'Shift+Tab', description: 'Cycle backwards' },
      { keys: 'Arrows', description: 'Navigate to nearest node in direction' },
      { keys: 'Alt+G', description: 'Jump to bookmarked node' },
      { keys: 'Alt+M', description: 'Toggle minimap' },
      { keys: 'Alt+D', description: 'Toggle dark/light mode' },
      { keys: 'Ctrl+K', description: 'Open command palette' },
      { keys: 'Ctrl+\\', description: 'Toggle sidebar' },
      { keys: 'Ctrl+1/2/3', description: 'Sidebar tab (Outline/Activity/Dispatch)' },
      { keys: 'Esc', description: 'Exit focus mode / Clear selection' },
      { keys: '+/-', description: 'Zoom in/out' },
      { keys: 'Alt+Left', description: 'Navigate back' },
      { keys: 'Alt+Right', description: 'Navigate forward' }
    ]
  },
  {
    title: 'Focus & Organization',
    shortcuts: [
      { keys: 'Alt+F', description: 'Toggle focus mode on selected node' },
      { keys: 'Alt+B', description: 'Toggle bookmark on selected node' },
      { keys: 'Shift+1-9', description: 'Set numbered bookmark on node' },
      { keys: '1-9', description: 'Jump to numbered bookmark' }
    ]
  },
  {
    title: 'Selection & Editing',
    shortcuts: [
      { keys: 'Delete', description: 'Delete selected nodes/edges' },
      { keys: 'Ctrl+C', description: 'Copy selected nodes' },
      { keys: 'Ctrl+X', description: 'Cut selected nodes' },
      { keys: 'Ctrl+V', description: 'Paste nodes' },
      { keys: 'Ctrl+Z', description: 'Undo' },
      { keys: 'Ctrl+Shift+Z', description: 'Redo' },
      { keys: 'Alt+H', description: 'Show undo history panel' },
      { keys: 'Alt+T', description: 'Show trash panel' },
      { keys: 'Alt+V', description: 'Show saved views panel' },
      { keys: 'Alt+L', description: 'Show timeline view' }
    ]
  },
  {
    title: 'Quick Creation',
    shortcuts: [
      { keys: 'Shift+N', description: 'New note' },
      { keys: 'Shift+C', description: 'New conversation' },
      { keys: 'Ctrl+Shift+A', description: 'New agent' },
      { keys: 'Shift+T', description: 'New task' },
      { keys: 'Shift+P', description: 'New project' },
      { keys: 'Shift+A', description: 'New artifact' },
      { keys: 'Shift+W', description: 'New workspace' },
      { keys: 'Shift+X', description: 'New text node' },
      { keys: 'Shift+Z', description: 'New action' },
      { keys: 'Shift+O', description: 'New orchestrator' }
    ]
  },
  {
    title: 'Node Editing',
    shortcuts: [
      { keys: 'Ctrl+A', description: 'Select all nodes' },
      { keys: 'M', description: 'Cycle node mode (for mode-aware nodes)' },
      { keys: 'Ctrl+Dbl-click', description: 'Auto-fit node width to title' }
    ]
  },
  {
    title: 'Connections',
    shortcuts: [
      { keys: 'Ctrl+L', description: 'Link all selected nodes together' },
      { keys: 'Ctrl+Shift+L', description: 'Unlink all selected nodes' }
    ]
  },
  {
    title: 'AI Assistant',
    shortcuts: [
      { keys: '/', description: 'Open inline AI prompt at cursor' },
      { keys: 'Tab (multi-select)', description: 'Quick actions for selected nodes' },
      { keys: 'Ctrl+E', description: 'Open AI Editor modal' },
      { keys: 'Ctrl+Shift+A', description: 'Toggle AI Sidebar' },
      { keys: 'Ctrl+K', description: 'Command palette with AI commands' }
    ]
  },
  {
    title: 'File Operations',
    shortcuts: [
      { keys: 'Ctrl+N', description: 'New workspace' },
      { keys: 'Ctrl+O', description: 'Open workspace' },
      { keys: 'Ctrl+S', description: 'Save workspace' },
      { keys: 'Ctrl+Shift+E', description: 'Save as / Export' }
    ]
  }
]

function KeyboardShortcutsHelpComponent(): JSX.Element | null {
  const isOpen = useShortcutHelpStore((s) => s.isOpen)
  const close = useShortcutHelpStore((s) => s.close)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === '?') {
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close])

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      close()
    }
  }, [close])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 gui-z-modals flex items-center justify-center animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-[600px] max-h-[80vh] rounded-lg overflow-hidden animate-scale-in"
        style={{
          backgroundColor: 'var(--gui-bg-secondary)',
          border: '1px solid var(--gui-border-subtle)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--gui-border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" style={{ color: 'var(--gui-accent-primary)' }} />
            <h2 className="text-lg font-medium" style={{ color: 'var(--gui-text-primary)' }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={close}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" style={{ color: 'var(--gui-text-muted)' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
          <div className="grid grid-cols-2 gap-6">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.title}>
                <h3
                  className="text-xs font-semibold uppercase mb-2"
                  style={{ color: 'var(--gui-text-muted)' }}
                >
                  {category.title}
                </h3>
                <div className="space-y-1.5">
                  {category.shortcuts.map((shortcut) => (
                    <div key={shortcut.keys} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--gui-text-secondary)' }}>
                        {shortcut.description}
                      </span>
                      <kbd
                        className="px-2 py-0.5 rounded text-xs font-mono"
                        style={{
                          backgroundColor: 'var(--gui-bg-tertiary)',
                          color: 'var(--gui-text-primary)',
                          border: '1px solid var(--gui-border-subtle)'
                        }}
                      >
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div
            className="mt-6 pt-4 text-center text-xs border-t"
            style={{ borderColor: 'var(--gui-border-subtle)', color: 'var(--gui-text-muted)' }}
          >
            Press <kbd className="px-1 rounded" style={{ backgroundColor: 'var(--gui-bg-tertiary)' }}>?</kbd> again or <kbd className="px-1 rounded" style={{ backgroundColor: 'var(--gui-bg-tertiary)' }}>Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  )
}

export const KeyboardShortcutsHelp = memo(KeyboardShortcutsHelpComponent)
