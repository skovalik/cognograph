/**
 * ClipboardIndicator Component
 *
 * Small floating indicator showing clipboard state (cut/copy) with node count and clear button.
 * Positioned in the canvas area, similar to AlignmentToolbar.
 */

import { memo } from 'react'
import { Scissors, Copy, X } from 'lucide-react'
import { useCanvasStore } from '../stores'

function ClipboardIndicatorComponent(): JSX.Element | null {
  const clipboardState = useCanvasStore((s) => s.clipboardState)
  const clearClipboard = useCanvasStore((s) => s.clearClipboard)

  if (!clipboardState) return null

  const isCut = clipboardState.mode === 'cut'
  const Icon = isCut ? Scissors : Copy
  const label = isCut ? 'Cut' : 'Copied'
  const count = clipboardState.nodeIds.length

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg border text-xs font-medium ${
        isCut
          ? 'bg-yellow-900/80 border-yellow-600/50 text-yellow-200'
          : 'bg-blue-900/80 border-blue-600/50 text-blue-200'
      }`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{label} {count} node{count !== 1 ? 's' : ''}</span>
        <button
          onClick={clearClipboard}
          className="ml-1 p-0.5 rounded-full hover:bg-white/10 transition-colors"
          title="Clear clipboard (Esc)"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export const ClipboardIndicator = memo(ClipboardIndicatorComponent)
