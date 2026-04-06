// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * AnimatedContent — content transition animations (fade, slide, scale).
 *
 * Adapted from React Bits (reactbits.dev) for Cognograph.
 * Triggers on mount (or when `trigger` becomes true) using Framer Motion.
 *
 * When the user prefers reduced motion, content appears immediately.
 */

import { type AnimationPlaybackControls, animate } from 'framer-motion'
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { cn } from '../../../lib/utils'

export type AnimationDirection = 'vertical' | 'horizontal'

/** Cubic-bezier easing — default approximates GSAP power3.out */
export type EaseCurve = [number, number, number, number]

export interface AnimatedContentProps {
  children: ReactNode
  /** Distance in px to travel during the animation */
  distance?: number
  /** Slide direction */
  direction?: AnimationDirection
  /** If true, slides in from the opposite direction */
  reverse?: boolean
  /** Duration in seconds */
  duration?: number
  /** Cubic-bezier easing curve */
  ease?: EaseCurve
  /** Starting opacity (0-1) */
  initialOpacity?: number
  /** Whether to animate opacity alongside position */
  animateOpacity?: boolean
  /** Starting scale */
  scale?: number
  /** Delay before animation starts, in seconds */
  delay?: number
  /** When true, the animation plays. Defaults to true (animate on mount). */
  trigger?: boolean
  /** Called when the entrance animation completes */
  onComplete?: () => void
  className?: string
  style?: CSSProperties
}

export function AnimatedContent({
  children,
  distance = 50,
  direction = 'vertical',
  reverse = false,
  duration = 0.6,
  ease = [0.22, 1, 0.36, 1],
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  delay = 0,
  trigger = true,
  onComplete,
  className,
  style,
}: AnimatedContentProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const hasAnimated = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (hasAnimated.current) return

    // If reduced motion, just make content visible immediately
    if (prefersReducedMotion) {
      Object.assign(el.style, {
        opacity: '1',
        transform: 'translate(0, 0) scale(1)',
        visibility: 'visible',
      })
      hasAnimated.current = true
      return
    }

    if (!trigger) {
      Object.assign(el.style, {
        opacity: animateOpacity ? String(initialOpacity) : '1',
        visibility: 'hidden',
      })
      return
    }

    const isHorizontal = direction === 'horizontal'
    const offset = reverse ? -distance : distance

    // Set initial state
    const tx = isHorizontal ? offset : 0
    const ty = isHorizontal ? 0 : offset
    Object.assign(el.style, {
      transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
      opacity: animateOpacity ? String(initialOpacity) : '1',
      visibility: 'visible',
    })

    // Animate to final state
    let controls: AnimationPlaybackControls | undefined
    const timeoutId = window.setTimeout(() => {
      controls = animate(
        el,
        {
          transform: 'translate(0px, 0px) scale(1)',
          opacity: 1,
        },
        {
          duration,
          ease,
          onComplete() {
            hasAnimated.current = true
            onComplete?.()
          },
        },
      )
    }, delay * 1000)

    return () => {
      window.clearTimeout(timeoutId)
      controls?.stop()
    }
  }, [
    trigger,
    prefersReducedMotion,
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    delay,
    onComplete,
  ])

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        visibility: prefersReducedMotion ? 'visible' : 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
