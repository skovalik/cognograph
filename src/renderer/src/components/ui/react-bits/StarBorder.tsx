/**
 * StarBorder — animated twinkling star/sparkle border effect.
 *
 * Adapted from React Bits (reactbits.dev) for Cognograph.
 * Uses CSS radial-gradient animations to create a traveling sparkle effect
 * along the top and bottom edges. Pure CSS, no canvas required.
 *
 * When the user prefers reduced motion, renders a static bordered container.
 */

import { type ReactNode, type CSSProperties, type ElementType } from 'react'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { cn } from '../../../lib/utils'

export interface StarBorderProps {
  /** The HTML element to render as. Defaults to 'div'. */
  as?: ElementType
  children: ReactNode
  /** Sparkle color. Defaults to the accent color. */
  color?: string
  /** Animation cycle duration (CSS time string, e.g. '6s'). */
  speed?: string
  /** Border thickness in px */
  thickness?: number
  /** Border radius in px or CSS string */
  borderRadius?: number | string
  /** Whether to animate. If false, renders static border. Defaults to true. */
  animate?: boolean
  className?: string
  style?: CSSProperties
}

const keyframesInjected = { current: false }

function ensureKeyframes(): void {
  if (keyframesInjected.current) return
  keyframesInjected.current = true

  const sheet = document.createElement('style')
  sheet.textContent = `
    @keyframes rb-star-move-bottom {
      0%   { transform: translate(0%, 0%); opacity: 1; }
      100% { transform: translate(-100%, 0%); opacity: 0; }
    }
    @keyframes rb-star-move-top {
      0%   { transform: translate(0%, 0%); opacity: 1; }
      100% { transform: translate(100%, 0%); opacity: 0; }
    }
  `
  document.head.appendChild(sheet)
}

export function StarBorder({
  as: Component = 'div',
  children,
  color = 'var(--accent-primary)',
  speed = '6s',
  thickness = 1,
  borderRadius = 12,
  animate = true,
  className,
  style,
}: StarBorderProps): JSX.Element {
  const prefersReducedMotion = useReducedMotion()

  ensureKeyframes()

  const resolvedBorderRadius =
    typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius

  // Render static border if animation disabled or user prefers reduced motion
  if (!animate || prefersReducedMotion) {
    return (
      <Component
        className={cn('relative inline-block', className)}
        style={{
          borderRadius: resolvedBorderRadius,
          border: `${thickness}px solid ${color}`,
          ...style,
        }}
      >
        {children}
      </Component>
    )
  }

  const gradientStyle = `radial-gradient(circle, ${color}, transparent 10%)`

  return (
    <Component
      className={cn('relative inline-block overflow-hidden', className)}
      style={{
        padding: `${thickness}px 0`,
        borderRadius: resolvedBorderRadius,
        ...style,
      }}
    >
      {/* Bottom sparkle band */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '300%',
          height: '50%',
          opacity: 0.7,
          bottom: '-12px',
          right: '-250%',
          borderRadius: '50%',
          background: gradientStyle,
          animation: `rb-star-move-bottom ${speed} linear infinite alternate`,
          zIndex: 0,
        }}
      />

      {/* Top sparkle band */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '300%',
          height: '50%',
          opacity: 0.7,
          top: '-12px',
          left: '-250%',
          borderRadius: '50%',
          background: gradientStyle,
          animation: `rb-star-move-top ${speed} linear infinite alternate`,
          zIndex: 0,
        }}
      />

      {/* Inner content */}
      <div
        className="relative"
        style={{
          borderRadius: resolvedBorderRadius,
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </Component>
  )
}
