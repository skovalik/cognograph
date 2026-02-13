// =============================================================================
// PreviewToolbar.tsx -- Toolbar for ArtifactNode live preview mode
//
// Renders viewport preset buttons, scale slider, refresh, auto-refresh toggle,
// interaction mode toggle, and open-in-browser button.
// Replaces standard ArtifactNode header buttons when previewEnabled is true.
// =============================================================================

import { memo, useCallback } from 'react'
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  RotateCw,
  MousePointer,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { PreviewViewport } from '@shared/types'
import {
  clampPreviewScale,
  PREVIEW_VIEWPORT_WIDTHS,
} from '../../utils/previewUrlValidation'

interface PreviewToolbarProps {
  /** Current viewport preset */
  viewport: PreviewViewport
  /** Current scale value */
  scale: number
  /** Whether auto-refresh is enabled */
  autoRefresh: boolean
  /** Whether interaction mode is active (overlay removed) */
  interactionMode: boolean
  /** The full preview URL being displayed */
  previewUrl: string
  /** Callback to change viewport preset */
  onViewportChange: (viewport: PreviewViewport) => void
  /** Callback to change scale */
  onScaleChange: (scale: number) => void
  /** Callback to toggle auto-refresh */
  onAutoRefreshToggle: () => void
  /** Callback to manually refresh the iframe */
  onRefresh: () => void
  /** Callback to toggle interaction mode */
  onInteractionModeToggle: () => void
  /** Callback to toggle preview mode (back to code view) */
  onPreviewToggle: () => void
}

const VIEWPORT_PRESETS: { key: PreviewViewport; label: string; icon: typeof Monitor; width: number }[] = [
  { key: 'mobile', label: 'Mobile', icon: Smartphone, width: PREVIEW_VIEWPORT_WIDTHS.mobile },
  { key: 'tablet', label: 'Tablet', icon: Tablet, width: PREVIEW_VIEWPORT_WIDTHS.tablet },
  { key: 'desktop', label: 'Desktop', icon: Monitor, width: PREVIEW_VIEWPORT_WIDTHS.desktop },
]

function PreviewToolbarComponent({
  viewport,
  scale,
  autoRefresh,
  interactionMode,
  previewUrl,
  onViewportChange,
  onScaleChange,
  onAutoRefreshToggle,
  onRefresh,
  onInteractionModeToggle,
  onPreviewToggle,
}: PreviewToolbarProps): JSX.Element {
  const clampedScale = clampPreviewScale(scale)

  const handleScaleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value)
      onScaleChange(clampPreviewScale(value))
    },
    [onScaleChange]
  )

  const handleOpenInBrowser = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (previewUrl) {
        // Use window.open which is intercepted by main process setWindowOpenHandler
        // and opened in the default browser via shell.openExternal
        window.open(previewUrl, '_blank')
      }
    },
    [previewUrl]
  )

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 border-b overflow-x-auto"
      style={{
        backgroundColor: 'var(--node-bg-secondary)',
        borderColor: 'var(--node-border-secondary)',
      }}
      // Prevent drag from toolbar
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Viewport preset buttons */}
      {VIEWPORT_PRESETS.map(({ key, label, icon: Icon, width }) => (
        <button
          key={key}
          onClick={(e) => {
            e.stopPropagation()
            onViewportChange(key)
          }}
          className={`p-1 rounded transition-colors ${
            viewport === key
              ? 'bg-cyan-600/30'
              : 'hover:bg-black/10 dark:hover:bg-white/10'
          }`}
          title={`${label} (${width}px)`}
          style={{
            color:
              viewport === key
                ? 'var(--node-text-primary)'
                : 'var(--node-text-secondary)',
          }}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}

      {/* Divider */}
      <div
        className="w-px h-4 mx-0.5"
        style={{ backgroundColor: 'var(--node-border-secondary)' }}
      />

      {/* Scale slider */}
      <div className="flex items-center gap-1" title={`Scale: ${Math.round(clampedScale * 100)}%`}>
        <input
          type="range"
          min="0.5"
          max="1.0"
          step="0.05"
          value={clampedScale}
          onChange={handleScaleChange}
          onClick={(e) => e.stopPropagation()}
          className="w-12 h-1 accent-cyan-500"
        />
        <span
          className="text-[10px] w-7 text-center tabular-nums"
          style={{ color: 'var(--node-text-muted)' }}
        >
          {Math.round(clampedScale * 100)}%
        </span>
      </div>

      {/* Divider */}
      <div
        className="w-px h-4 mx-0.5"
        style={{ backgroundColor: 'var(--node-border-secondary)' }}
      />

      {/* Refresh button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRefresh()
        }}
        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
        title="Refresh preview"
      >
        <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--node-text-secondary)' }} />
      </button>

      {/* Auto-refresh toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAutoRefreshToggle()
        }}
        className={`p-1 rounded transition-colors ${
          autoRefresh
            ? 'bg-cyan-600/30'
            : 'hover:bg-black/10 dark:hover:bg-white/10'
        }`}
        title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
      >
        <RotateCw
          className="w-3.5 h-3.5"
          style={{
            color: autoRefresh
              ? 'var(--node-text-primary)'
              : 'var(--node-text-secondary)',
          }}
        />
      </button>

      {/* Interaction mode toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onInteractionModeToggle()
        }}
        className={`p-1 rounded transition-colors ${
          interactionMode
            ? 'bg-cyan-600/30'
            : 'hover:bg-black/10 dark:hover:bg-white/10'
        }`}
        title={interactionMode ? 'Exit interaction mode (Escape)' : 'Enter interaction mode'}
      >
        <MousePointer
          className="w-3.5 h-3.5"
          style={{
            color: interactionMode
              ? 'var(--node-text-primary)'
              : 'var(--node-text-secondary)',
          }}
        />
      </button>

      {/* Open in browser */}
      <button
        onClick={handleOpenInBrowser}
        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
        title="Open in default browser"
      >
        <ExternalLink className="w-3.5 h-3.5" style={{ color: 'var(--node-text-secondary)' }} />
      </button>

      {/* Toggle back to code view */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPreviewToggle()
        }}
        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors ml-auto"
        title="Switch to code view"
      >
        <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--node-text-secondary)' }} />
      </button>
    </div>
  )
}

export const PreviewToolbar = memo(PreviewToolbarComponent)
