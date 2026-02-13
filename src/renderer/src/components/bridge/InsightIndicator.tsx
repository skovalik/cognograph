/**
 * InsightIndicator Component (Phase 5: Graph Intelligence)
 *
 * Renders a subtle indicator on nodes with graph intelligence insights.
 * Features:
 * - Ambient glow effect using the insight's type color
 * - Popover with insight details on click
 * - Apply/Dismiss action buttons
 * - Badge count for multiple insights
 * - Progressive mode: badge count only (no glow) when node count > 250
 */

import { memo, useState, useCallback } from 'react'
import {
  Lightbulb,
  Link2,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Check,
  X,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Separator } from '../ui/separator'
import { useGraphIntelligenceStore } from '../../stores/graphIntelligenceStore'
import { emitInsightApplied, emitInsightDismissed } from '../../utils/auditHooks'
import type { GraphInsight, InsightType } from '@shared/types/bridge'

// =============================================================================
// Icon and Color Maps
// =============================================================================

const INSIGHT_ICONS: Record<InsightType, typeof Lightbulb> = {
  'orphaned-cluster': Link2,
  'missing-connection': Link2,
  'redundant-nodes': AlertTriangle,
  'unbalanced-graph': BarChart3,
  'cost-anomaly': AlertTriangle,
  'workflow-optimization': TrendingUp,
  'stale-content': AlertTriangle,
  'pattern-detected': Lightbulb,
}

const INSIGHT_COLORS: Record<InsightType, string> = {
  'orphaned-cluster': '#f59e0b',
  'missing-connection': '#3b82f6',
  'redundant-nodes': '#f97316',
  'unbalanced-graph': '#a855f7',
  'cost-anomaly': '#dc2626',
  'workflow-optimization': '#22c55e',
  'stale-content': '#6b7280',
  'pattern-detected': '#3b82f6',
}

// =============================================================================
// Component
// =============================================================================

interface InsightIndicatorProps {
  nodeId: string
  insights: GraphInsight[]
  progressiveMode?: boolean
}

function InsightIndicatorComponent({
  nodeId,
  insights,
  progressiveMode = false,
}: InsightIndicatorProps): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false)
  const applyInsight = useGraphIntelligenceStore((s) => s.applyInsight)
  const dismissInsight = useGraphIntelligenceStore((s) => s.dismissInsight)
  const viewInsight = useGraphIntelligenceStore((s) => s.viewInsight)

  // Filter to only active insights
  const activeInsights = insights.filter(
    (i) => i.status === 'new' || i.status === 'viewed'
  )

  if (activeInsights.length === 0) return null

  const primaryInsight = activeInsights[0]
  const InsightIcon = INSIGHT_ICONS[primaryInsight.type] || Lightbulb
  const color = INSIGHT_COLORS[primaryInsight.type] || '#3b82f6'

  const handleApply = useCallback(
    (insightId: string) => {
      applyInsight(insightId)
      emitInsightApplied(insightId)
      if (activeInsights.length <= 1) setIsOpen(false)
    },
    [applyInsight, activeInsights.length]
  )

  const handleDismiss = useCallback(
    (insightId: string) => {
      dismissInsight(insightId)
      emitInsightDismissed(insightId)
      if (activeInsights.length <= 1) setIsOpen(false)
    },
    [dismissInsight, activeInsights.length]
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (open) {
        // Mark all as viewed
        for (const insight of activeInsights) {
          if (insight.status === 'new') {
            viewInsight(insight.id)
          }
        }
      }
    },
    [activeInsights, viewInsight]
  )

  // Progressive mode: just show a badge count, no glow
  if (progressiveMode) {
    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className="absolute bottom-[-4px] left-[-4px] z-[3] flex items-center justify-center rounded-full"
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: 'var(--surface-panel)',
              border: `1.5px solid ${color}`,
              color: color,
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
            }}
            aria-label={`${activeInsights.length} insight${activeInsights.length > 1 ? 's' : ''} for this node`}
          >
            {activeInsights.length}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px]" side="right" align="start">
          {renderInsightList(activeInsights, handleApply, handleDismiss)}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="insight-indicator"
          style={
            {
              '--insight-color': color,
              position: 'absolute',
              bottom: '-6px',
              left: '-6px',
              width: '24px',
              height: '24px',
              borderRadius: '9999px',
              backgroundColor: 'var(--surface-panel)',
              border: `1.5px solid ${color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
              cursor: 'pointer',
              transition: 'transform 150ms ease, box-shadow 150ms ease',
              zIndex: 3,
              boxShadow: `0 0 6px color-mix(in srgb, ${color} 30%, transparent)`,
            } as React.CSSProperties
          }
          aria-label={`${activeInsights.length} insight${activeInsights.length > 1 ? 's' : ''} for this node`}
        >
          <InsightIcon className="w-3 h-3" />
          {activeInsights.length > 1 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '14px',
                height: '14px',
                borderRadius: '9999px',
                backgroundColor: color,
                color: 'white',
                fontSize: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
              }}
            >
              {activeInsights.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px]" side="right" align="start">
        {renderInsightList(activeInsights, handleApply, handleDismiss)}
      </PopoverContent>
    </Popover>
  )
}

// =============================================================================
// Insight List Renderer
// =============================================================================

function renderInsightList(
  insights: GraphInsight[],
  onApply: (id: string) => void,
  onDismiss: (id: string) => void
): JSX.Element {
  return (
    <div className="space-y-0">
      {insights.map((insight, i) => {
        const InsightIcon = INSIGHT_ICONS[insight.type] || Lightbulb
        const color = INSIGHT_COLORS[insight.type] || '#3b82f6'

        return (
          <div key={insight.id}>
            {i > 0 && <Separator className="my-2" />}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <InsightIcon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {insight.title}
                </span>
              </div>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                {insight.description}
              </p>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[9px] px-1 h-4">
                  {insight.confidence > 0.8
                    ? 'High confidence'
                    : insight.confidence > 0.5
                      ? 'Medium confidence'
                      : 'Low confidence'}
                </Badge>
                <Badge variant="outline" className="text-[9px] px-1 h-4">
                  {insight.source}
                </Badge>
              </div>
              <div className="flex items-center gap-1 pt-1">
                {insight.suggestedChanges &&
                  insight.suggestedChanges.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: 'var(--color-success, #22c55e)',
                      }}
                      onClick={() => onApply(insight.id)}
                    >
                      <Check className="w-3 h-3 mr-0.5" />
                      Apply
                    </Button>
                  )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2"
                  onClick={() => onDismiss(insight.id)}
                >
                  <X className="w-3 h-3 mr-0.5" />
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const InsightIndicator = memo(InsightIndicatorComponent)
