/**
 * FocusModeIndicator - Floating indicator when Focus Mode is active
 *
 * ND-friendly feature: Shows clear visual feedback when in a focused state,
 * with obvious "way out" (Escape key hint). Reduces anxiety about being
 * "stuck" in a mode.
 */

import { memo } from 'react'
import { Eye } from 'lucide-react'
import { useNodesStore, useCanvasViewportStore } from '../stores'

function FocusModeIndicatorComponent(): JSX.Element | null {
  const focusModeNodeId = useCanvasViewportStore((s) => s.focusModeNodeId)
  const nodes = useNodesStore((s) => s.nodes)

  // Only show when focus mode is active
  if (!focusModeNodeId) return null

  // Get the focused node's title
  const focusedNode = nodes.find(n => n.id === focusModeNodeId)
  const title = focusedNode?.data?.title as string | undefined

  return (
    <div
      className="absolute top-4 right-4 gui-z-panels flex items-center gap-2 px-3 py-2 rounded-lg animate-fade-in"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--gui-bg-tertiary) 95%, transparent)',
        border: '1px solid color-mix(in srgb, var(--gui-accent-primary) 40%, transparent)',
        boxShadow: '0 0 20px color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)'
      }}
    >
      <Eye
        className="w-4 h-4 animate-pulse"
        style={{ color: 'var(--gui-accent-primary)' }}
      />
      <div className="flex flex-col">
        <span className="text-xs font-medium" style={{ color: 'var(--gui-text-primary)' }}>
          Focus Mode
        </span>
        {title && (
          <span className="text-[10px] truncate max-w-[150px]" style={{ color: 'var(--gui-text-muted)' }}>
            {title}
          </span>
        )}
      </div>
      <span
        className="text-[10px] px-1.5 py-0.5 rounded ml-2"
        style={{
          backgroundColor: 'var(--gui-bg-secondary)',
          color: 'var(--gui-text-muted)'
        }}
      >
        Esc
      </span>
    </div>
  )
}

export const FocusModeIndicator = memo(FocusModeIndicatorComponent)
