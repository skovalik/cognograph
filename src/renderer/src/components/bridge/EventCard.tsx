/**
 * EventCard Component
 *
 * Renders a single audit event in the Bridge Log with:
 * - Timestamp + actor badge
 * - Action description
 * - Cost/token metadata
 * - Expandable details with visual diff
 * - Undo button for reversible actions
 */

import { memo, useState, useCallback } from 'react'
import { Undo2, ChevronRight } from 'lucide-react'
import { Card } from '../ui/card'
import { Button } from '../ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { ActorBadge } from './ActorBadge'
import type { CanvasAuditEvent } from '@shared/types/bridge'

// =============================================================================
// Helpers
// =============================================================================

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatActionDescription(event: CanvasAuditEvent): string {
  const target = event.targetTitle || event.targetId.slice(0, 8)

  switch (event.action) {
    case 'node-created':
      return `Created "${target}" ${event.targetType}`
    case 'node-updated':
      return `Updated "${target}"`
    case 'node-deleted':
      return `Deleted "${target}" ${event.targetType}`
    case 'edge-created':
      return `Connected ${target}`
    case 'edge-deleted':
      return `Disconnected ${target}`
    case 'orchestration-started':
      return `Started orchestration`
    case 'orchestration-completed':
      return `Orchestration completed`
    case 'orchestration-failed':
      return `Orchestration failed`
    case 'orchestration-aborted':
      return `Orchestration aborted`
    case 'agent-started':
      return `Agent started processing`
    case 'agent-completed':
      return `Agent completed`
    case 'agent-failed':
      return `Agent failed`
    case 'proposal-created':
      return `Proposal created`
    case 'proposal-approved':
      return `Proposal approved`
    case 'proposal-rejected':
      return `Proposal rejected`
    case 'command-executed':
      return `Command: "${event.context.parentCommand || 'unknown'}"`
    case 'insight-applied':
      return `Applied insight suggestion`
    case 'insight-dismissed':
      return `Dismissed insight`
    case 'budget-warning':
      return `Budget warning`
    case 'budget-exceeded':
      return `Budget exceeded`
    default:
      return event.action
  }
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}): JSX.Element {
  return (
    <div className="flex gap-2">
      <span
        className="text-[10px] shrink-0"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}:
      </span>
      <span
        className={`text-[10px] truncate ${mono ? 'font-mono' : ''}`}
        style={{ color: 'var(--text-secondary)' }}
      >
        {value}
      </span>
    </div>
  )
}

// =============================================================================
// Component
// =============================================================================

interface EventCardProps {
  event: CanvasAuditEvent
  onUndo?: (eventId: string) => void
  isCompact: boolean
}

function EventCardComponent({
  event,
  onUndo,
  isCompact,
}: EventCardProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleUndo = useCallback(() => {
    if (onUndo) onUndo(event.id)
  }, [onUndo, event.id])

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  return (
    <Card className="p-2 mb-1 transition-colors" style={{
      backgroundColor: 'var(--surface-panel)',
      borderColor: 'var(--border-default)',
    }}>
      {/* Row 1: Timestamp + Actor Badge */}
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-mono"
          style={{ color: 'var(--text-muted)' }}
        >
          {formatTime(event.timestamp)}
        </span>
        <ActorBadge actor={event.actor} />
      </div>

      {/* Row 2: Action description */}
      <p
        className="text-xs mt-0.5 line-clamp-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {formatActionDescription(event)}
      </p>

      {/* Row 3: Cost + tokens (if applicable) */}
      {(event.context.costUSD !== undefined ||
        event.context.tokensUsed !== undefined) && (
        <div className="flex gap-2 mt-0.5">
          {event.context.costUSD !== undefined && event.context.costUSD > 0 && (
            <span
              className="text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              ${event.context.costUSD.toFixed(4)}
            </span>
          )}
          {event.context.tokensUsed !== undefined &&
            event.context.tokensUsed > 0 && (
              <span
                className="text-[10px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {event.context.tokensUsed.toLocaleString()} tokens
              </span>
            )}
        </div>
      )}

      {/* Row 4: Actions (Undo + Expand) */}
      <div className="flex items-center gap-1 mt-1">
        {event.undoable && onUndo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px]"
                onClick={handleUndo}
              >
                <Undo2 className="w-3 h-3 mr-0.5" />
                {!isCompact && 'Undo'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reverse this action</TooltipContent>
          </Tooltip>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-[10px] ml-auto"
          onClick={toggleExpand}
        >
          {!isCompact && 'Details'}
          <ChevronRight
            className={`w-3 h-3 ml-0.5 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </Button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div
          className="mt-2 pt-2 space-y-1"
          style={{ borderTop: '1px solid var(--border-default)' }}
        >
          <DetailRow
            label="Target"
            value={`${event.targetType}: ${event.targetTitle || event.targetId}`}
          />
          <DetailRow label="Target ID" value={event.targetId} mono />
          {event.context.orchestrationId && (
            <DetailRow
              label="Orchestration"
              value={event.context.orchestrationId}
              mono
            />
          )}
          {event.context.runId && (
            <DetailRow label="Run ID" value={event.context.runId} mono />
          )}
          {event.context.parentCommand && (
            <DetailRow label="Command" value={event.context.parentCommand} />
          )}
          {event.changes && (
            <div className="mt-1">
              <span
                className="text-[10px]"
                style={{ color: 'var(--text-muted)' }}
              >
                Changes:
              </span>
              {Object.entries(event.changes).map(
                ([key, { before, after }]) => (
                  <div key={key} className="ml-2 text-[10px]">
                    <span style={{ color: 'var(--text-muted)' }}>{key}: </span>
                    <span
                      className="line-through"
                      style={{ color: 'var(--color-error, #dc2626)' }}
                    >
                      {String(before).slice(0, 50)}
                    </span>{' '}
                    <span style={{ color: 'var(--color-success, #22c55e)' }}>
                      {String(after).slice(0, 50)}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export const EventCard = memo(EventCardComponent)
