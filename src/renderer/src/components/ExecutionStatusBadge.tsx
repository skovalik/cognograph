// ExecutionStatusBadge — Phase 5A: Visible Execution State Badges
// Shape-coded status indicator for orchestrated workflow nodes.
// Uses WCAG 1.4.1 shape redundancy: circle (active), square (queued),
// checkmark (complete), triangle (error) — not color-only.

import { memo } from 'react'
import type { ExecutionStatus } from '../stores/executionStatusStore'

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus
  message?: string
  className?: string
}

/** Active: pulsing green circle */
function ActiveShape(): JSX.Element {
  return (
    <span
      className="execution-status-badge__shape execution-status-badge__shape--active"
      style={{
        display: 'block',
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: 'var(--accent-green, #22c55e)',
      }}
    />
  )
}

/** Queued: static amber square */
function QueuedShape(): JSX.Element {
  return (
    <span
      className="execution-status-badge__shape execution-status-badge__shape--queued"
      style={{
        display: 'block',
        width: 10,
        height: 10,
        borderRadius: 2,
        backgroundColor: 'var(--accent-amber, #f59e0b)',
      }}
    />
  )
}

/** Complete: green checkmark SVG */
function CompleteShape(): JSX.Element {
  return (
    <svg
      className="execution-status-badge__shape execution-status-badge__shape--complete"
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 6.5L4.5 9L10 3"
        stroke="var(--accent-green, #22c55e)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Error: red triangle SVG */
function ErrorShape(): JSX.Element {
  return (
    <svg
      className="execution-status-badge__shape execution-status-badge__shape--error"
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 1L11 10.5H1L6 1Z"
        fill="var(--accent-red, #ef4444)"
      />
      <path
        d="M6 5V7"
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx={6} cy={8.5} r={0.7} fill="white" />
    </svg>
  )
}

const SHAPE_MAP: Record<ExecutionStatus, () => JSX.Element> = {
  active: ActiveShape,
  queued: QueuedShape,
  complete: CompleteShape,
  error: ErrorShape,
}

export const ExecutionStatusBadge = memo(function ExecutionStatusBadge({
  status,
  message,
  className,
}: ExecutionStatusBadgeProps): JSX.Element {
  const Shape = SHAPE_MAP[status]
  const ariaLabel = `Execution status: ${status}${message ? `: ${message}` : ''}`

  return (
    <div
      className={`execution-status-badge execution-status-badge--${status}${className ? ` ${className}` : ''}`}
      role="status"
      aria-label={ariaLabel}
      title={message || `Status: ${status}`}
    >
      <Shape />
    </div>
  )
})
