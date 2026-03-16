// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * LivingGrid — Cursor-responsive dot grid with magnetic attraction
 *
 * Canvas2D overlay that renders as a sibling of ReactFlow, positioned
 * absolutely behind it. Dots within 120px of the cursor brighten (gold,
 * 0.4 opacity) and drift toward the cursor (2-3px magnetic attraction).
 *
 * Architecture:
 * - Screen-fixed canvas that reads React Flow viewport state
 * - Renders world-space grid positions in screen space
 * - Dots stay visually consistent regardless of zoom level
 * - pointer-events: none — all clicks pass through to ReactFlow
 *
 * Performance:
 * - Targets 30fps via requestAnimationFrame throttling
 * - Only redraws when cursor moves or viewport changes
 * - Respects prefers-reduced-motion (static brightening only, no drift)
 */

import { useRef, useEffect, useCallback, memo } from 'react'
import { useViewport } from '@xyflow/react'
import { useEffectiveReducedMotion } from '../stores/programStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Grid spacing in world units — matches ReactFlow's Background gap={20} */
const GRID_SPACING = 20

/** Radius (in screen pixels) within which dots respond to the cursor */
const ATTRACTION_RADIUS = 120

/** Maximum pixel displacement toward cursor */
const MAX_DRIFT = 3

/** Target frame interval in ms (~30fps) */
const FRAME_INTERVAL = 1000 / 30

/** Base dot radius in screen pixels */
const DOT_RADIUS = 1.5

/** Base dot opacity (at rest) */
const DOT_OPACITY_BASE = 0.04

/** Activated dot opacity (near cursor) */
const DOT_OPACITY_ACTIVE = 0.4

/** Default gold accent color */
const GOLD_DEFAULT = '#C8963E'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a CSS color string (hex or rgb/rgba) to [r, g, b].
 * Falls back to gold if parsing fails.
 */
function parseColor(color: string): [number, number, number] {
  // Try hex
  const hex = color.replace('#', '')
  if (/^[0-9a-fA-F]{3,8}$/.test(hex)) {
    const full = hex.length <= 4
      ? hex.split('').map(c => c + c).join('')
      : hex
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16)
    ]
  }
  // Try rgb(a)
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]!), parseInt(rgbMatch[2]!), parseInt(rgbMatch[3]!)]
  }
  // Fallback gold
  return [200, 150, 62]
}

/**
 * Read --accent-glow from CSS custom properties, with gold fallback.
 */
function getAccentColor(): string {
  if (typeof document === 'undefined') return GOLD_DEFAULT
  const val = getComputedStyle(document.documentElement).getPropertyValue('--accent-glow').trim()
  return val || GOLD_DEFAULT
}

/**
 * Read --grid-dot-color opacity from CSS. Used for base dot rendering.
 */
function getGridDotColor(): string {
  if (typeof document === 'undefined') return 'rgba(240, 237, 232, 0.04)'
  const val = getComputedStyle(document.documentElement).getPropertyValue('--grid-dot-color').trim()
  return val || 'rgba(240, 237, 232, 0.04)'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LivingGrid = memo(function LivingGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  /** Cursor position in canvas-local coordinates (not viewport clientX/Y) */
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 })
  /** Cached CSS colors — refreshed every ~1s, not every frame */
  const colorsRef = useRef<{
    accent: [number, number, number]
    baseDot: string
    lastUpdate: number
  }>({ accent: [200, 150, 62], baseDot: 'rgba(240, 237, 232, 0.04)', lastUpdate: 0 })

  // Read viewport from React Flow (reactive)
  const viewport = useViewport()
  const reducedMotion = useEffectiveReducedMotion()

  // Keep viewport ref in sync (avoid stale closures in RAF)
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  // ------------------------------------------
  // Mouse tracking (throttled by RAF, not here)
  // ------------------------------------------
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Convert to canvas-local coords (accounts for sidebar offset etc.)
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      cursorRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    } else {
      cursorRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    cursorRef.current = null
  }, [])

  // ------------------------------------------
  // Canvas sizing
  // ------------------------------------------
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = window.devicePixelRatio || 1
    const rect = parent.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
  }, [])

  // ------------------------------------------
  // Draw loop
  // ------------------------------------------
  const draw = useCallback((timestamp: number) => {
    // Throttle to ~30fps
    const elapsed = timestamp - lastFrameTimeRef.current
    if (elapsed < FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }
    lastFrameTimeRef.current = timestamp

    const canvas = canvasRef.current
    if (!canvas) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    // Clear
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const vp = viewportRef.current
    const { x: vpX, y: vpY, zoom } = vp
    const cursor = cursorRef.current

    // Refresh cached colors every ~1s (avoid getComputedStyle per frame)
    const colors = colorsRef.current
    if (timestamp - colors.lastUpdate > 1000) {
      colors.accent = parseColor(getAccentColor())
      colors.baseDot = getGridDotColor()
      colors.lastUpdate = timestamp
    }
    const [ar, ag, ab] = colors.accent
    const baseDotColor = colors.baseDot

    // Calculate visible world-space range
    const worldLeft = -vpX / zoom
    const worldTop = -vpY / zoom
    const worldRight = worldLeft + w / zoom
    const worldBottom = worldTop + h / zoom

    // Snap to grid lines (with 1-cell padding for drift)
    const startCol = Math.floor(worldLeft / GRID_SPACING) - 1
    const endCol = Math.ceil(worldRight / GRID_SPACING) + 1
    const startRow = Math.floor(worldTop / GRID_SPACING) - 1
    const endRow = Math.ceil(worldBottom / GRID_SPACING) + 1

    // Pre-compute cursor in screen space
    const cursorSx = cursor?.x ?? -9999
    const cursorSy = cursor?.y ?? -9999
    const hasCursor = cursor !== null
    const radiusSq = ATTRACTION_RADIUS * ATTRACTION_RADIUS

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        // World position of this grid dot
        const wx = col * GRID_SPACING
        const wy = row * GRID_SPACING

        // Convert to screen position
        let sx = wx * zoom + vpX
        let sy = wy * zoom + vpY

        // Skip if off-screen (with margin for glow)
        if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue

        // Calculate distance to cursor (in screen space)
        let opacity = DOT_OPACITY_BASE
        let dotColor = baseDotColor

        if (hasCursor) {
          const dx = sx - cursorSx
          const dy = sy - cursorSy
          const distSq = dx * dx + dy * dy

          if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq)
            // Smoothstep-like falloff: 1 at center, 0 at radius edge
            const t = 1 - dist / ATTRACTION_RADIUS
            const smoothT = t * t * (3 - 2 * t) // smoothstep

            // Interpolate opacity
            opacity = DOT_OPACITY_BASE + (DOT_OPACITY_ACTIVE - DOT_OPACITY_BASE) * smoothT

            // Gold accent color for activated dots
            dotColor = `rgba(${ar}, ${ag}, ${ab}, ${opacity})`

            // Magnetic drift toward cursor (only if motion is allowed)
            if (!reducedMotion && dist > 0.1) {
              const driftAmount = MAX_DRIFT * smoothT
              // Drift toward cursor
              sx += (-dx / dist) * driftAmount
              sy += (-dy / dist) * driftAmount
            }
          }
        }

        // Draw the dot
        ctx.beginPath()
        ctx.arc(sx, sy, DOT_RADIUS, 0, Math.PI * 2)

        if (dotColor === baseDotColor) {
          // Use the CSS grid dot color for non-activated dots
          ctx.fillStyle = baseDotColor
        } else {
          ctx.fillStyle = dotColor
        }

        ctx.fill()
      }
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [reducedMotion])

  // ------------------------------------------
  // Mount / unmount
  // ------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const parent = canvas.parentElement
    if (!parent) return

    // Initial size
    resizeCanvas()

    // Listen for mouse on parent (the flex-1 relative container)
    parent.addEventListener('mousemove', handleMouseMove, { passive: true })
    parent.addEventListener('mouseleave', handleMouseLeave)

    // Resize observer for responsive canvas
    const ro = new ResizeObserver(() => resizeCanvas())
    ro.observe(parent)

    // Start draw loop
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      parent.removeEventListener('mousemove', handleMouseMove)
      parent.removeEventListener('mouseleave', handleMouseLeave)
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
    }
  }, [draw, handleMouseMove, handleMouseLeave, resizeCanvas])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  )
})

export default LivingGrid
