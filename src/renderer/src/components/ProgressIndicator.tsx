/**
 * ProgressIndicator - Shows progress for long-running operations
 *
 * ND-friendly feature: Visual progress reduces "is it working?" anxiety.
 * Knowing something is happening (and how far along) provides comfort.
 */

import { memo } from 'react'
import { Loader2 } from 'lucide-react'
import { create } from 'zustand'

// Store for global progress state
interface ProgressState {
  operations: Map<string, {
    label: string
    progress?: number // 0-100, undefined for indeterminate
    startTime: number
  }>
  start: (id: string, label: string) => void
  update: (id: string, progress: number) => void
  complete: (id: string) => void
}

export const useProgressStore = create<ProgressState>((set) => ({
  operations: new Map(),

  start: (id, label) => set((state) => {
    const newOps = new Map(state.operations)
    newOps.set(id, { label, startTime: Date.now() })
    return { operations: newOps }
  }),

  update: (id, progress) => set((state) => {
    const op = state.operations.get(id)
    if (!op) return state
    const newOps = new Map(state.operations)
    newOps.set(id, { ...op, progress })
    return { operations: newOps }
  }),

  complete: (id) => set((state) => {
    const newOps = new Map(state.operations)
    newOps.delete(id)
    return { operations: newOps }
  })
}))

// Helper functions for easy use
export const progress = {
  start: (id: string, label: string) => useProgressStore.getState().start(id, label),
  update: (id: string, progress: number) => useProgressStore.getState().update(id, progress),
  complete: (id: string) => useProgressStore.getState().complete(id)
}

function ProgressIndicatorComponent(): JSX.Element | null {
  const operations = useProgressStore((s) => s.operations)

  if (operations.size === 0) return null

  // Show most recent operation
  const entries = Array.from(operations.entries())
  const [id, op] = entries[entries.length - 1]

  return (
    <div
      className="fixed bottom-4 right-4 gui-z-panels animate-fade-in"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl min-w-[200px]"
        style={{
          backgroundColor: 'var(--gui-bg-secondary)',
          border: '1px solid var(--gui-border-subtle)'
        }}
      >
        {/* Spinner */}
        <Loader2
          className="w-4 h-4 animate-spin flex-shrink-0"
          style={{ color: 'var(--gui-accent-primary)' }}
        />

        {/* Label and progress */}
        <div className="flex-1 min-w-0">
          <div
            className="text-sm truncate"
            style={{ color: 'var(--gui-text-primary)' }}
          >
            {op.label}
          </div>

          {/* Progress bar (if determinate) */}
          {op.progress !== undefined && (
            <div className="mt-1.5">
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--gui-bg-tertiary)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${op.progress}%`,
                    backgroundColor: 'var(--gui-accent-primary)'
                  }}
                />
              </div>
              <div
                className="text-[10px] mt-0.5 text-right"
                style={{ color: 'var(--gui-text-muted)' }}
              >
                {Math.round(op.progress)}%
              </div>
            </div>
          )}
        </div>

        {/* Multiple operations indicator */}
        {operations.size > 1 && (
          <div
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'var(--gui-bg-tertiary)',
              color: 'var(--gui-text-muted)'
            }}
          >
            +{operations.size - 1}
          </div>
        )}
      </div>
    </div>
  )
}

export const ProgressIndicator = memo(ProgressIndicatorComponent)
