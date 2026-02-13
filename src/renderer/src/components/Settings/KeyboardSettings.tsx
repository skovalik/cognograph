/**
 * KeyboardSettings — Shortcut rebinding UI for the Settings modal.
 *
 * Shows all shortcuts grouped by category. Users can click a binding
 * to record a new key combo. Conflicts are detected in real time.
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { RotateCcw, AlertTriangle } from 'lucide-react'
import { useProgramStore, selectKeyboardOverrides } from '../../stores/programStore'
import {
  DEFAULT_SHORTCUTS,
  eventToCombo,
  formatCombo,
  getActiveCombo,
  findConflict,
  type ShortcutDefinition
} from '../../utils/shortcuts'

// Category display order and labels
const CATEGORY_ORDER: Array<{ key: ShortcutDefinition['category']; label: string }> = [
  { key: 'file', label: 'File' },
  { key: 'edit', label: 'Edit' },
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create Nodes' },
  { key: 'panels', label: 'Panels' },
  { key: 'navigation', label: 'Navigation' },
  { key: 'ai', label: 'AI' }
]

// Group shortcuts by category
function groupByCategory(): Map<string, ShortcutDefinition[]> {
  const map = new Map<string, ShortcutDefinition[]>()
  for (const s of DEFAULT_SHORTCUTS) {
    const arr = map.get(s.category) || []
    arr.push(s)
    map.set(s.category, arr)
  }
  return map
}

function KeyboardSettingsComponent(): JSX.Element {
  const overrides = useProgramStore(selectKeyboardOverrides)
  const setKeyboardOverride = useProgramStore((s) => s.setKeyboardOverride)
  const removeKeyboardOverride = useProgramStore((s) => s.removeKeyboardOverride)
  const resetKeyboardOverrides = useProgramStore((s) => s.resetKeyboardOverrides)

  // Which shortcut is being recorded (null = none)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const recordingRef = useRef<string | null>(null)
  recordingRef.current = recordingId

  const grouped = groupByCategory()

  // Listen for keydown while recording
  useEffect(() => {
    if (!recordingId) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()

      // Allow Escape to cancel recording
      if (e.key === 'Escape') {
        setRecordingId(null)
        setConflict(null)
        return
      }

      const combo = eventToCombo(e)
      if (!combo) return // bare modifier key

      // Check for conflicts
      const conflictId = findConflict(combo, recordingId, overrides)
      if (conflictId) {
        const conflictDef = DEFAULT_SHORTCUTS.find(s => s.id === conflictId)
        setConflict(`Conflicts with "${conflictDef?.label || conflictId}"`)
        // Still allow setting it — user just sees a warning
      } else {
        setConflict(null)
      }

      // Check if this matches the default (remove override if so)
      const def = DEFAULT_SHORTCUTS.find(s => s.id === recordingId)
      if (def && combo === def.defaultCombo) {
        removeKeyboardOverride(recordingId)
      } else {
        setKeyboardOverride(recordingId, combo)
      }

      setRecordingId(null)
      // Clear conflict after a short delay so it flashes briefly
      setTimeout(() => setConflict(null), 2000)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recordingId, overrides, setKeyboardOverride, removeKeyboardOverride])

  const handleStartRecording = useCallback((id: string) => {
    setRecordingId(id)
    setConflict(null)
  }, [])

  const handleResetOne = useCallback((id: string) => {
    removeKeyboardOverride(id)
    setRecordingId(null)
    setConflict(null)
  }, [removeKeyboardOverride])

  const handleResetAll = useCallback(() => {
    resetKeyboardOverrides()
    setRecordingId(null)
    setConflict(null)
  }, [resetKeyboardOverrides])

  const overrideCount = Object.keys(overrides).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium gui-text mb-1">Keyboard Shortcuts</h3>
          <p className="text-xs gui-text-secondary">
            Click a binding to reassign it. Press Escape to cancel.
          </p>
        </div>
        {overrideCount > 0 && (
          <button
            onClick={handleResetAll}
            className="gui-btn gui-btn-ghost text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            Reset all ({overrideCount})
          </button>
        )}
      </div>

      {/* Conflict warning */}
      {conflict && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--gui-warning, #f59e0b)' }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {conflict}
        </div>
      )}

      {/* Shortcut groups */}
      {CATEGORY_ORDER.map(({ key, label }) => {
        const shortcuts = grouped.get(key)
        if (!shortcuts || shortcuts.length === 0) return null

        return (
          <div key={key}>
            <h4 className="text-xs font-semibold gui-text-secondary uppercase tracking-wider mb-2">
              {label}
            </h4>
            <div className="space-y-0.5">
              {shortcuts.map(def => {
                const activeCombo = getActiveCombo(def.id, overrides)
                const isOverridden = !!overrides[def.id]
                const isRecording = recordingId === def.id

                return (
                  <div
                    key={def.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--gui-bg-hover)] transition-colors group"
                  >
                    <span className="text-sm gui-text">{def.label}</span>
                    <div className="flex items-center gap-1.5">
                      {isOverridden && (
                        <button
                          onClick={() => handleResetOne(def.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--gui-bg-hover)]"
                          title="Reset to default"
                        >
                          <RotateCcw className="w-3 h-3 gui-text-secondary" />
                        </button>
                      )}
                      <button
                        onClick={() => handleStartRecording(def.id)}
                        className={`min-w-[80px] px-2 py-1 rounded text-xs font-mono text-center transition-all ${
                          isRecording
                            ? 'ring-2 ring-[var(--gui-accent-secondary)] bg-[var(--gui-accent-secondary)]/.1 gui-text animate-pulse'
                            : isOverridden
                              ? 'gui-card gui-text border border-[var(--gui-accent-secondary)]/.3'
                              : 'gui-card gui-text-secondary'
                        }`}
                      >
                        {isRecording ? 'Press keys...' : formatCombo(activeCombo)}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="gui-card p-3">
        <p className="text-xs gui-text-secondary">
          Keyboard overrides persist across sessions. Some shortcuts (Tab navigation, number bookmarks, arrow spatial navigation) are not customizable.
        </p>
      </div>
    </div>
  )
}

export const KeyboardSettings = memo(KeyboardSettingsComponent)
