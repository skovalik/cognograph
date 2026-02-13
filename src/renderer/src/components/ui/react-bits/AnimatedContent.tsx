/**
 * AnimatedContent — content transition animations (fade, slide, scale).
 *
 * Adapted from React Bits (reactbits.dev) for Cognograph.
 * The original component used GSAP ScrollTrigger which does not apply in
 * a canvas/pan-zoom app. This version triggers on mount (or when `trigger`
 * becomes true) using plain GSAP tweens.
 *
 * When the user prefers reduced motion, content appears immediately.
 */

import { useRef, useEffect, type ReactNode, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { cn } from '../../../lib/utils'

export type AnimationDirection = 'vertical' | 'horizontal'

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
  /** GSAP ease string */
  ease?: string
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
  ease = 'power3.out',
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
      gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1, visibility: 'visible' })
      hasAnimated.current = true
      return
    }

    if (!trigger) {
      // Keep hidden until trigger fires
      gsap.set(el, {
        opacity: animateOpacity ? initialOpacity : 1,
        visibility: 'hidden',
      })
      return
    }

    const axis = direction === 'horizontal' ? 'x' : 'y'
    const offset = reverse ? -distance : distance

    // Set initial state
    gsap.set(el, {
      [axis]: offset,
      scale,
      opacity: animateOpacity ? initialOpacity : 1,
      visibility: 'visible',
    })

    // Animate to final state
    const tween = gsap.to(el, {
      [axis]: 0,
      scale: 1,
      opacity: 1,
      duration,
      ease,
      delay,
      onComplete() {
        hasAnimated.current = true
        onComplete?.()
      },
    })

    return () => {
      tween.kill()
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
