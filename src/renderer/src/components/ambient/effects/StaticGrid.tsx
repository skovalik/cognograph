// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * StaticGrid — Clean dot grid with cursor proximity glow.
 *
 * Inspired by Google Stitch: dots are fixed in position (no drift/physics),
 * but brighten when the cursor is nearby. Smooth radial falloff.
 * Canvas2D for cursor tracking, minimal overhead (~15fps, only redraws on mouse move).
 */

'use client'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import type { AdaptiveQualityState } from '../../../hooks/useAdaptiveQuality'

interface StaticGridProps {
  dotSize?: number
  gap?: number
  color?: string
  opacity?: number
  glowColor?: string
  glowOpacity?: number
  glowRadius?: number
  quality?: AdaptiveQualityState
  containerRef?: React.RefObject<HTMLDivElement | null>
}

function StaticGridComponent({
  dotSize = 1,
  gap = 20,
  color = '#ffffff',
  opacity = 0.07,
  glowColor = '#C8963E',
  glowOpacity = 0.4,
  glowRadius = 120,
}: StaticGridProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const rafRef = useRef<number | null>(null)
  const needsDrawRef = useRef(true)

  // Parse colors once
  const colors = useMemo(() => {
    const parseHex = (hex: string) => ({
      r: parseInt(hex.slice(1, 3), 16) || 255,
      g: parseInt(hex.slice(3, 5), 16) || 255,
      b: parseInt(hex.slice(5, 7), 16) || 255,
    })
    return { base: parseHex(color), glow: parseHex(glowColor) }
  }, [color, glowColor])

  // Draw the grid
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const mouse = mouseRef.current
    const { base, glow } = colors
    const glowR2 = glowRadius * glowRadius

    ctx.clearRect(0, 0, w, h)

    for (let x = gap / 2; x < w; x += gap) {
      for (let y = gap / 2; y < h; y += gap) {
        let r = base.r,
          g2 = base.g,
          b = base.b,
          a = opacity

        // Cursor proximity brightening
        if (mouse) {
          const dx = x - mouse.x
          const dy = y - mouse.y
          const dist2 = dx * dx + dy * dy
          if (dist2 < glowR2) {
            const t = 1 - Math.sqrt(dist2) / glowRadius
            const smooth = t * t * (3 - 2 * t) // smoothstep
            r = Math.round(base.r + (glow.r - base.r) * smooth)
            g2 = Math.round(base.g + (glow.g - base.g) * smooth)
            b = Math.round(base.b + (glow.b - base.b) * smooth)
            a = opacity + (glowOpacity - opacity) * smooth
          }
        }

        ctx.fillStyle = `rgba(${r},${g2},${b},${a})`
        ctx.beginPath()
        ctx.arc(x, y, dotSize, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [colors, dotSize, gap, opacity, glowOpacity, glowRadius])

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = parent.clientWidth * dpr
      canvas.height = parent.clientHeight * dpr
      canvas.style.width = `${parent.clientWidth}px`
      canvas.style.height = `${parent.clientHeight}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
      // Reset dimensions for draw loop (use CSS dimensions)
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
      needsDrawRef.current = true
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Mouse tracking
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      needsDrawRef.current = true
    }
    const handleLeave = () => {
      mouseRef.current = null
      needsDrawRef.current = true
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseleave', handleLeave)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  // Render loop — only redraws when mouse moves (no idle cost)
  useEffect(() => {
    let lastDraw = 0
    const FRAME_MS = 1000 / 20 // 20fps is plenty for smooth glow

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      if (!needsDrawRef.current) return
      const now = performance.now()
      if (now - lastDraw < FRAME_MS) return
      lastDraw = now
      needsDrawRef.current = false
      draw()
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  )
}

export default React.memo(StaticGridComponent)
