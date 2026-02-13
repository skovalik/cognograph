import { memo, useCallback, useState } from 'react'
import { Sparkles, Wand2 } from 'lucide-react'
import { useExtractionStore } from '../../stores'
import { extractFromNode } from '../../services/extractionService'

interface ExtractionControlsProps {
  nodeId: string
  /** Whether this node supports auto-extract toggle (only conversation nodes) */
  showAutoExtract?: boolean
}

function ExtractionControlsComponent({ nodeId, showAutoExtract = false }: ExtractionControlsProps): JSX.Element {
  const isExtracting = useExtractionStore((s) => s.isExtracting)
  const setIsExtracting = useExtractionStore((s) => s.setIsExtracting)
  const [autoExtractEnabled, setAutoExtractEnabled] = useState(false)

  const handleManualExtract = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isExtracting === nodeId) return

      setIsExtracting(nodeId)
      try {
        await extractFromNode(nodeId)
      } finally {
        setIsExtracting(null)
      }
    },
    [nodeId, isExtracting, setIsExtracting]
  )

  const handleToggleAutoExtract = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setAutoExtractEnabled(!autoExtractEnabled)
      // Note: Auto-extract for non-conversation nodes would need additional implementation
    },
    [autoExtractEnabled]
  )

  return (
    <div className="extraction-controls flex items-center gap-0.5">
      {showAutoExtract && (
        <button
          onClick={handleToggleAutoExtract}
          className={`p-1 rounded transition-colors ${
            !autoExtractEnabled ? 'hover:bg-black/10 dark:hover:bg-white/10' : ''
          }`}
          style={
            autoExtractEnabled
              ? {
                  backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 50%, transparent)',
                  color: 'color-mix(in srgb, var(--gui-accent-primary) 70%, white)'
                }
              : { color: 'var(--node-text-muted)' }
          }
          title={autoExtractEnabled ? 'Auto-extract enabled' : 'Enable auto-extract'}
        >
          <Sparkles className="w-3 h-3" />
        </button>
      )}
      <button
        onClick={handleManualExtract}
        disabled={isExtracting === nodeId}
        className={`p-1 rounded transition-colors ${
          isExtracting === nodeId
            ? 'text-blue-400 animate-pulse'
            : 'hover:bg-black/10 dark:hover:bg-white/10'
        }`}
        style={isExtracting !== nodeId ? { color: 'var(--node-text-muted)' } : undefined}
        title={isExtracting === nodeId ? 'Extracting...' : 'Extract notes & tasks'}
      >
        <Wand2 className="w-3 h-3" />
      </button>
    </div>
  )
}

export const ExtractionControls = memo(ExtractionControlsComponent)
