/**
 * Keyboard Mode Indicator — HUD badge
 *
 * Persistent pill badge in the bottom-center showing current
 * keyboard mode: Navigate (default), Edit (text focused), Terminal, Artboard.
 *
 * PFD Phase 5B: Canvas Interaction Patterns
 * Phase 3C: Added Artboard mode detection when in-place expansion is active.
 */

import { memo, useEffect, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'

type KeyboardMode = 'Navigate' | 'Edit' | 'Terminal' | 'Artboard'

const MODE_COLORS: Record<KeyboardMode, string> = {
  Navigate: 'bg-blue-600/80 text-blue-50',
  Edit: 'bg-green-600/80 text-green-50',
  Terminal: 'bg-amber-600/80 text-amber-50',
  Artboard: 'bg-purple-600/80 text-purple-50'
}

const MODE_ICONS: Record<KeyboardMode, string> = {
  Navigate: '\u2328', // keyboard icon
  Edit: '\u270E',     // pencil icon
  Terminal: '\u25B6',  // terminal arrow
  Artboard: '\u25A3'  // filled square with inner square (artboard metaphor)
}

function detectMode(): KeyboardMode {
  const el = document.activeElement
  if (!el) return 'Navigate'

  // Terminal detection
  if (el.hasAttribute('data-terminal') || el.closest?.('[data-terminal]')) {
    return 'Terminal'
  }

  // Edit detection: text inputs, textareas, contenteditable
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el.getAttribute('contenteditable') === 'true' ||
    el.closest?.('[contenteditable="true"]')
  ) {
    return 'Edit'
  }

  return 'Navigate'
}

export const KeyboardModeIndicator = memo(function KeyboardModeIndicator(): JSX.Element {
  const [mode, setMode] = useState<KeyboardMode>('Navigate')
  const inPlaceExpandedNodeId = useWorkspaceStore((state) => state.inPlaceExpandedNodeId)

  useEffect(() => {
    const handleFocusChange = (): void => {
      // Small delay to let activeElement update
      requestAnimationFrame(() => {
        setMode(detectMode())
      })
    }

    document.addEventListener('focusin', handleFocusChange)
    document.addEventListener('focusout', handleFocusChange)

    return () => {
      document.removeEventListener('focusin', handleFocusChange)
      document.removeEventListener('focusout', handleFocusChange)
    }
  }, [])

  // Artboard mode overrides all other modes when active
  const displayMode: KeyboardMode = inPlaceExpandedNodeId ? 'Artboard' : mode

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[var(--gui-z-dropdowns,40)] flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-md backdrop-blur-sm transition-colors duration-200 ${MODE_COLORS[displayMode]}`}
      style={{ pointerEvents: 'none' }}
    >
      <span aria-hidden="true">{MODE_ICONS[displayMode]}</span>
      <span>{displayMode}</span>
    </div>
  )
})
