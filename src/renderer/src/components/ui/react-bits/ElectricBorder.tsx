/**
 * ElectricBorder — animated electric/glowing border effect.
 *
 * Adapted from React Bits (reactbits.dev) for Cognograph.
 * Uses a canvas-based noise displacement algorithm to create an organic,
 * electrically animated border around the wrapped content.
 *
 * When WebGL/Canvas is unavailable or the user prefers reduced motion,
 * falls back to a static CSS glow ring.
 */

import { useEffect, useRef, useCallback, type ReactNode, type CSSProperties } from 'react'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { supportsWebGL } from '../../../utils/gpuDetection'
import { cn } from '../../../lib/utils'

export interface ElectricBorderProps {
  children: ReactNode
  /** Border color. Defaults to the current accent. Use a CSS color string. */
  color?: string
  /** Animation speed multiplier (1 = default) */
  speed?: number
  /** Chaos/displacement amount (0-1). Higher = more jagged border. */
  chaos?: number
  /** Border radius in px */
  borderRadius?: number
  className?: string
  style?: CSSProperties
}

// ---------- Noise helpers (pure functions, no React) ----------

function pseudoRandom(x: number): number {
  return (Math.sin(x * 12.9898) * 43758.5453) % 1
}

function noise2D(x: number, y: number): number {
  const i = Math.floor(x)
  const j = Math.floor(y)
  const fx = x - i
  const fy = y - j

  const a = pseudoRandom(i + j * 57)
  const b = pseudoRandom(i + 1 + j * 57)
  const c = pseudoRandom(i + (j + 1) * 57)
  const d = pseudoRandom(i + 1 + (j + 1) * 57)

  const ux = fx * fx * (3.0 - 2.0 * fx)
  const uy = fy * fy * (3.0 - 2.0 * fy)

  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy
}

function octavedNoise(
  x: number,
  octaves: number,
  lacunarity: number,
  gain: number,
  baseAmplitude: number,
  baseFrequency: number,
  time: number,
  seed: number,
  baseFlatness: number,
): number {
  let y = 0
  let amplitude = baseAmplitude
  let frequency = baseFrequency

  for (let i = 0; i < octaves; i++) {
    const octaveAmplitude = i === 0 ? amplitude * baseFlatness : amplitude
    y += octaveAmplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3)
    frequency *= lacunarity
    amplitude *= gain
  }

  return y
}

interface Point {
  x: number
  y: number
}

function getCornerPoint(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  arcLength: number,
  progress: number,
): Point {
  const angle = startAngle + progress * arcLength
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  }
}

function getRoundedRectPoint(
  t: number,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
): Point {
  const straightWidth = width - 2 * radius
  const straightHeight = height - 2 * radius
  const cornerArc = (Math.PI * radius) / 2
  const totalPerimeter = 2 * straightWidth + 2 * straightHeight + 4 * cornerArc
  const distance = t * totalPerimeter

  let accumulated = 0

  // Top edge
  if (distance <= accumulated + straightWidth) {
    const progress = (distance - accumulated) / straightWidth
    return { x: left + radius + progress * straightWidth, y: top }
  }
  accumulated += straightWidth

  // Top-right corner
  if (distance <= accumulated + cornerArc) {
    const progress = (distance - accumulated) / cornerArc
    return getCornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, progress)
  }
  accumulated += cornerArc

  // Right edge
  if (distance <= accumulated + straightHeight) {
    const progress = (distance - accumulated) / straightHeight
    return { x: left + width, y: top + radius + progress * straightHeight }
  }
  accumulated += straightHeight

  // Bottom-right corner
  if (distance <= accumulated + cornerArc) {
    const progress = (distance - accumulated) / cornerArc
    return getCornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, progress)
  }
  accumulated += cornerArc

  // Bottom edge
  if (distance <= accumulated + straightWidth) {
    const progress = (distance - accumulated) / straightWidth
    return { x: left + width - radius - progress * straightWidth, y: top + height }
  }
  accumulated += straightWidth

  // Bottom-left corner
  if (distance <= accumulated + cornerArc) {
    const progress = (distance - accumulated) / cornerArc
    return getCornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, progress)
  }
  accumulated += cornerArc

  // Left edge
  if (distance <= accumulated + straightHeight) {
    const progress = (distance - accumulated) / straightHeight
    return { x: left, y: top + height - radius - progress * straightHeight }
  }
  accumulated += straightHeight

  // Top-left corner
  const progress = (distance - accumulated) / cornerArc
  return getCornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, progress)
}

// ---------- Static fallback ----------

function StaticElectricBorder({
  children,
  color,
  borderRadius,
  className,
  style,
}: Pick<ElectricBorderProps, 'children' | 'color' | 'borderRadius' | 'className' | 'style'>): JSX.Element {
  return (
    <div
      className={cn('relative', className)}
      style={{
        borderRadius,
        boxShadow: `0 0 0 2px ${color ?? 'var(--accent-primary)'}66, 0 0 12px ${color ?? 'var(--accent-primary)'}33`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ---------- Main component ----------

export function ElectricBorder({
  children,
  color = 'var(--accent-primary)',
  speed = 1,
  chaos = 0.12,
  borderRadius = 12,
  className,
  style,
}: ElectricBorderProps): JSX.Element {
  const prefersReducedMotion = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)
  const lastFrameTimeRef = useRef(0)

  // Resolve CSS variable color to a real color string for canvas strokeStyle
  const resolvedColorRef = useRef(color)
  useEffect(() => {
    if (!color.startsWith('var(')) {
      resolvedColorRef.current = color
      return
    }
    // Read computed CSS variable
    const varName = color.replace(/^var\(/, '').replace(/\)$/, '')
    const computed = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    resolvedColorRef.current = computed || '#9333ea'
  }, [color])

  const drawBorder = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      containerWidth: number,
      containerHeight: number,
      borderOffset: number,
      currentTime: number,
    ) => {
      const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000
      timeRef.current += deltaTime * speed
      lastFrameTimeRef.current = currentTime

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)

      ctx.strokeStyle = resolvedColorRef.current
      ctx.lineWidth = 1
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const octaves = 10
      const lacunarity = 1.6
      const gain = 0.7
      const amplitude = chaos
      const frequency = 10
      const baseFlatness = 0
      const displacement = 60
      const left = borderOffset
      const top = borderOffset
      const bw = containerWidth - 2 * borderOffset
      const bh = containerHeight - 2 * borderOffset
      const maxRadius = Math.min(bw, bh) / 2
      const radius = Math.min(borderRadius, maxRadius)
      const approxPerimeter = 2 * (bw + bh) + 2 * Math.PI * radius
      const sampleCount = Math.floor(approxPerimeter / 2)

      ctx.beginPath()

      for (let i = 0; i <= sampleCount; i++) {
        const progress = i / sampleCount
        const point = getRoundedRectPoint(progress, left, top, bw, bh, radius)

        const xNoise = octavedNoise(
          progress * 8, octaves, lacunarity, gain, amplitude, frequency,
          timeRef.current, 0, baseFlatness,
        )
        const yNoise = octavedNoise(
          progress * 8, octaves, lacunarity, gain, amplitude, frequency,
          timeRef.current, 1, baseFlatness,
        )

        const dx = point.x + xNoise * displacement
        const dy = point.y + yNoise * displacement

        if (i === 0) {
          ctx.moveTo(dx, dy)
        } else {
          ctx.lineTo(dx, dy)
        }
      }

      ctx.closePath()
      ctx.stroke()
    },
    [chaos, borderRadius, speed],
  )

  useEffect(() => {
    if (prefersReducedMotion || !supportsWebGL()) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const borderOffset = 60

    const updateSize = (): { width: number; height: number } => {
      const rect = container.getBoundingClientRect()
      const w = rect.width + borderOffset * 2
      const h = rect.height + borderOffset * 2
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.scale(dpr, dpr)
      return { width: w, height: h }
    }

    let { width, height } = updateSize()

    const animate = (currentTime: number): void => {
      drawBorder(ctx, canvas, width, height, borderOffset, currentTime)
      animationRef.current = requestAnimationFrame(animate)
    }

    const ro = new ResizeObserver(() => {
      const newSize = updateSize()
      width = newSize.width
      height = newSize.height
    })
    ro.observe(container)

    lastFrameTimeRef.current = performance.now()
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationRef.current)
      ro.disconnect()
    }
  }, [prefersReducedMotion, drawBorder])

  // Use static fallback when reduced motion or no canvas support
  if (prefersReducedMotion || !supportsWebGL()) {
    return (
      <StaticElectricBorder
        color={color}
        borderRadius={borderRadius}
        className={className}
        style={style}
      >
        {children}
      </StaticElectricBorder>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-visible', className)}
      style={{
        borderRadius,
        isolation: 'isolate',
        ...style,
      }}
    >
      {/* Canvas layer — behind content, no pointer events */}
      <div
        className="absolute pointer-events-none"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }}
      >
        <canvas ref={canvasRef} className="block" />
      </div>

      {/* Glow layers */}
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius, zIndex: 0 }}>
        <div
          className="absolute inset-0"
          style={{
            borderRadius,
            border: `2px solid ${color}`,
            opacity: 0.6,
            filter: 'blur(1px)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            borderRadius,
            border: `2px solid ${color}`,
            filter: 'blur(4px)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            borderRadius,
            zIndex: -1,
            transform: 'scale(1.1)',
            filter: 'blur(32px)',
            opacity: 0.3,
            background: `linear-gradient(-30deg, ${color}, transparent, ${color})`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative" style={{ borderRadius, zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
