/**
 * CountUp — animated number counter.
 *
 * Adapted from React Bits (reactbits.dev) for Cognograph.
 * Uses framer-motion spring physics to smoothly animate between numeric values.
 * Used for token counts, cost displays, agent turns, and workspace stats.
 *
 * The original React Bits component uses `motion/react` (the new Motion library).
 * This version uses `framer-motion` which is already installed in the project.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useMotionValue, useSpring, useInView } from 'framer-motion'
import { cn } from '../../../lib/utils'

export interface CountUpProps {
  /** Target value to count to */
  to: number
  /** Starting value. Defaults to 0. */
  from?: number
  /** Count direction: 'up' counts from→to, 'down' counts to→from */
  direction?: 'up' | 'down'
  /** Delay before animation starts, in seconds */
  delay?: number
  /** Approximate animation duration in seconds (controls spring stiffness/damping) */
  duration?: number
  /** Thousands separator character (e.g. ',' or ' '). Empty string = none. */
  separator?: string
  /** Whether to start animation. Defaults to true. */
  startWhen?: boolean
  /** Called when the animation starts */
  onStart?: () => void
  /** Called when the animation completes */
  onEnd?: () => void
  /** Format function applied to the final display string */
  format?: (value: string) => string
  className?: string
}

export function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  separator = '',
  startWhen = true,
  onStart,
  onEnd,
  format,
  className,
}: CountUpProps): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === 'down' ? to : from)
  const isInView = useInView(ref, { once: true })

  // Configure spring physics from desired duration
  const damping = 20 + 40 * (1 / duration)
  const stiffness = 100 * (1 / duration)

  const springValue = useSpring(motionValue, { damping, stiffness })

  // Calculate the maximum decimal places needed
  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to))

  const formatValue = useCallback(
    (latest: number): string => {
      if (!isFinite(latest)) return String(to)

      const hasDecimals = maxDecimals > 0
      const options: Intl.NumberFormatOptions = {
        useGrouping: separator !== '',
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0,
      }

      const formatted = new Intl.NumberFormat('en-US', options).format(latest)
      const withSeparator = separator ? formatted.replace(/,/g, separator) : formatted
      return format ? format(withSeparator) : withSeparator
    },
    [maxDecimals, separator, format, to],
  )

  // Set initial text content
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(direction === 'down' ? to : from)
    }
  }, [from, to, direction, formatValue])

  // Trigger animation when in view and startWhen is true
  useEffect(() => {
    if (!isInView || !startWhen) return

    onStart?.()

    const timeoutId = setTimeout(() => {
      motionValue.set(direction === 'down' ? from : to)
    }, delay * 1000)

    const durationTimeoutId = setTimeout(
      () => { onEnd?.() },
      (delay + duration) * 1000,
    )

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(durationTimeoutId)
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration])

  // Subscribe to spring value changes and update the DOM directly
  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest)
      }
    })
    return unsubscribe
  }, [springValue, formatValue])

  return <span className={cn(className)} ref={ref} />
}

// ---------- Helpers ----------

function getDecimalPlaces(num: number): number {
  const str = num.toString()
  if (!str.includes('.')) return 0
  const decimals = str.split('.')[1]
  if (decimals === undefined || parseInt(decimals) === 0) return 0
  return decimals.length
}
