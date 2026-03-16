/**
 * Keyboard Shortcut Legend — Contextual HUD
 *
 * Compact glassmorphic card in bottom-left showing keyboard shortcuts.
 * Only visible when keyboard navigation is active.
 * Auto-hides after 5s of no keyboard input. Re-shows on next key press.
 * User can permanently dismiss via (×) button (persisted to localStorage).
 *
 * Task 28: Design System v3 Implementation
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useUIStore, selectKeyboardNavActive } from '../stores/uiStore'

const STORAGE_KEY = 'cognograph.keyboard-legend-dismissed'
const AUTO_HIDE_MS = 5000

const isMac =
  typeof navigator !== 'undefined' &&
  (navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac'))

const MOD = isMac ? '\u2318' : 'Ctrl'

const SHORTCUTS = [
  { keys: '\u2190\u2191\u2193\u2192', label: 'Navigate nodes' },
  { keys: 'Tab', label: 'Cycle connected' },
  { keys: `\u21E7+\u2191\u2193`, label: 'Multi-select' },
  { keys: `${MOD}+\u21B5`, label: 'Focus mode' },
  { keys: 'Esc', label: 'Exit / Deselect' }
] as const

export const KeyboardLegend = memo(function KeyboardLegend(): JSX.Element | null {
  const keyboardNavActive = useUIStore(selectKeyboardNavActive)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  )
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, AUTO_HIDE_MS)
  }, [])

  // Show when keyboard nav activates; auto-hide after 5s
  useEffect(() => {
    if (dismissed) return

    if (keyboardNavActive) {
      setVisible(true)
      resetTimer()
    } else {
      setVisible(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [keyboardNavActive, dismissed, resetTimer])

  // Re-show on keyboard input while nav is active
  useEffect(() => {
    if (dismissed) return

    const handleKeyDown = (): void => {
      if (!useUIStore.getState().keyboardNavActive) return
      setVisible(true)
      resetTimer()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [dismissed, resetTimer])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, 'true')
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  if (dismissed || !visible) return null

  return (
    <div
      role="complementary"
      aria-label="Keyboard shortcuts"
      className="glass-soft"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 'var(--gui-z-panels, 30)' as unknown as number,
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 180,
        fontSize: 12,
        lineHeight: 1.5,
        pointerEvents: 'auto',
        animation: 'keyboard-legend-in 200ms ease-out'
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss keyboard shortcuts"
        style={{
          position: 'absolute',
          top: 4,
          right: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: 14,
          lineHeight: 1,
          color: 'var(--gui-text-secondary, #888)',
          opacity: 0.7,
          transition: 'opacity 150ms'
        }}
        onMouseEnter={(e) => {
          ;(e.target as HTMLElement).style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          ;(e.target as HTMLElement).style.opacity = '0.7'
        }}
      >
        {'\u00D7'}
      </button>

      {/* Shortcut rows */}
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {SHORTCUTS.map(({ keys, label }) => (
            <tr key={keys}>
              <td
                style={{
                  paddingRight: 12,
                  paddingTop: 1,
                  paddingBottom: 1,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 600,
                  color: 'var(--gui-text-primary, #eee)',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.02em'
                }}
              >
                {keys}
              </td>
              <td
                style={{
                  paddingTop: 1,
                  paddingBottom: 1,
                  color: 'var(--gui-text-secondary, #999)',
                  whiteSpace: 'nowrap'
                }}
              >
                {label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Inline keyframes for entry animation */}
      <style>{`
        @keyframes keyboard-legend-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .glass-soft[role="complementary"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
})
