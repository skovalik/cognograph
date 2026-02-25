// =============================================================================
// SessionStatusIndicator.tsx -- Visual status indicator for CC terminal sessions
//
// WCAG 1.4.1: Uses shape + color redundancy (NOT color-only):
//   running: filled circle + pulse animation
//   idle:    hollow square outline, static
//   exited:  X mark (crossed lines), static
//
// Respects prefers-reduced-motion for the pulse animation.
// =============================================================================

import { memo } from 'react'

interface SessionStatusIndicatorProps {
  state: 'running' | 'idle' | 'exited'
  accentColor: string
  size?: number
  className?: string
}

export const SessionStatusIndicator = memo(function SessionStatusIndicator({
  state,
  accentColor,
  size = 8,
  className = '',
}: SessionStatusIndicatorProps): JSX.Element {
  const label = `Session status: ${state}`

  if (state === 'running') {
    // Filled circle with pulse
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 8 8"
        aria-label={label}
        role="img"
        className={`session-status--running ${className}`.trim()}
      >
        <circle cx="4" cy="4" r="3.5" fill={accentColor} />
      </svg>
    )
  }

  if (state === 'idle') {
    // Hollow square outline — 50% opacity
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 8 8"
        aria-label={label}
        role="img"
        className={className || undefined}
      >
        <rect
          x="1"
          y="1"
          width="6"
          height="6"
          fill="none"
          stroke={accentColor}
          strokeWidth="1.5"
          opacity="0.5"
        />
      </svg>
    )
  }

  // exited: X mark — 30% opacity
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      aria-label={label}
      role="img"
      className={className || undefined}
    >
      <line
        x1="1.5"
        y1="1.5"
        x2="6.5"
        y2="6.5"
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <line
        x1="6.5"
        y1="1.5"
        x2="1.5"
        y2="6.5"
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  )
})
