/**
 * ClickSpark — click feedback animation with sparks/particles.
 *
 * Adapted from React Bits (reactbits.dev) for Cognograph.
 * Renders a transparent canvas overlay that draws spark lines radiating
 * from the click position. Uses requestAnimationFrame for smooth animation
 * and cleans up properly on unmount.
 *
 * When reduced motion is preferred or the canvas is unavailable,
 * the spark effect is silently skipped (children still render normally).
 */

import {
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { cn } from '../../../lib/utils'

export interface ClickSparkProps {
  children: ReactNode
  /** Spark line color */
  color?: string
  /** Length of each spark line in px */
  sparkSize?: number
  /** Radius the sparks travel outward in px */
  sparkRadius?: number
  /** Number of spark lines per click */
  sparkCount?: number
  /** Duration of the spark animation in ms */
  duration?: number
  /** Easing function name */
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  className?: string
  style?: CSSProperties
}

interface Spark {
  x: number
  y: number
  angle: number
  startTime: number
}

function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'linear':
      return t
    case 'ease-in':
      return t * t
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    default: // ease-out
      return t * (2 - t)
  }
}

export function ClickSpark({
  children,
  color = 'var(--accent-primary)',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  className,
  style,
}: ClickSparkProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sparksRef = useRef<Spark[]>([])
  const animationRef = useRef<number>(0)
  const prefersReducedMotion = useReducedMotion()

  // Resolve CSS variable color for canvas rendering
  const resolvedColorRef = useRef(color)
  useEffect(() => {
    if (!color.startsWith('var(')) {
      resolvedColorRef.current = color
      return
    }
    const varName = color.replace(/^var\(/, '').replace(/\)$/, '')
    const computed = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    resolvedColorRef.current = computed || '#9333ea'
  }, [color])

  // Resize canvas to match parent
  useEffect(() => {
    if (prefersReducedMotion) return

    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    let resizeTimeout: ReturnType<typeof setTimeout>

    const resizeCanvas = (): void => {
      const { width, height } = parent.getBoundingClientRect()
      if (canvas.width !== Math.round(width) || canvas.height !== Math.round(height)) {
        canvas.width = Math.round(width)
        canvas.height = Math.round(height)
      }
    }

    const handleResize = (): void => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(resizeCanvas, 100)
    }

    const ro = new ResizeObserver(handleResize)
    ro.observe(parent)
    resizeCanvas()

    return () => {
      ro.disconnect()
      clearTimeout(resizeTimeout)
    }
  }, [prefersReducedMotion])

  // Animation loop
  useEffect(() => {
    if (prefersReducedMotion) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = (timestamp: number): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime
        if (elapsed >= duration) return false

        const progress = elapsed / duration
        const eased = applyEasing(progress, easing)

        const dist = eased * sparkRadius
        const lineLen = sparkSize * (1 - eased)

        const x1 = spark.x + dist * Math.cos(spark.angle)
        const y1 = spark.y + dist * Math.sin(spark.angle)
        const x2 = spark.x + (dist + lineLen) * Math.cos(spark.angle)
        const y2 = spark.y + (dist + lineLen) * Math.sin(spark.angle)

        ctx.strokeStyle = resolvedColorRef.current
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()

        return true
      })

      animationRef.current = requestAnimationFrame(draw)
    }

    animationRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [prefersReducedMotion, sparkSize, sparkRadius, duration, easing])

  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return

      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const now = performance.now()
      const newSparks: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
        x,
        y,
        angle: (2 * Math.PI * i) / sparkCount,
        startTime: now,
      }))

      sparksRef.current.push(...newSparks)
    },
    [prefersReducedMotion, sparkCount],
  )

  return (
    <div
      className={cn('relative', className)}
      style={{ width: '100%', height: '100%', ...style }}
      onClick={handleClick}
    >
      {!prefersReducedMotion && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block pointer-events-none"
          style={{ width: '100%', height: '100%', userSelect: 'none' }}
        />
      )}
      {children}
    </div>
  )
}
