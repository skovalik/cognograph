// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * ParticleDrift — Context Flow Particles
 *
 * Renders tiny gold particles (2-3px, 0.3 opacity) that drift slowly along
 * edge paths between connected nodes. Creates a subtle sense of data flowing
 * through the workspace graph.
 *
 * Architecture: Canvas2D overlay positioned behind ReactFlow nodes (zIndex -1).
 * Reads edge/node/viewport data from React Flow hooks.
 *
 * Performance constraints:
 *   - 30fps RAF loop (not 60 — purely decorative)
 *   - Particle count = min(edges.length, canvasArea / 40000)
 *   - prefers-reduced-motion: disables entirely
 *   - pointer-events: none (fully non-interactive)
 */

import { useEdges, useNodes, useViewport } from '@xyflow/react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { selectReduceMotion, useProgramStore } from '../stores/programStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Particle {
  /** Index into the resolved edges array */
  edgeIndex: number
  /** Progress along the edge path, 0 = source, 1 = target */
  progress: number
  /** Progress increment per frame (calibrated for 8-12s cycle at 30fps) */
  speed: number
  /** Trail positions for motion blur (newest first) */
  trail: Array<{ x: number; y: number }>
}

interface EdgeEndpoints {
  sx: number // source center x (flow coords)
  sy: number // source center y (flow coords)
  tx: number // target center x (flow coords)
  ty: number // target center y (flow coords)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Target frame interval — ~30fps */
const FRAME_INTERVAL_MS = 1000 / 30

/** Gold color matching --accent-glow / Aurochs brand gold */
const PARTICLE_COLOR = '#C8963E'

/** Base particle radius in CSS pixels */
const PARTICLE_RADIUS = 1.5

/** Base particle opacity */
const PARTICLE_OPACITY = 0.3

/** Number of trail positions to keep for motion blur */
const TRAIL_LENGTH = 3

/** Area divisor for particle cap: 1 particle per this many px squared */
const AREA_PER_PARTICLE = 40000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve edge source/target to center pixel positions in flow coordinates.
 * Returns null if either node cannot be found.
 */
function resolveEdgeEndpoints(
  edge: { source: string; target: string },
  nodeMap: Map<string, { x: number; y: number; w: number; h: number }>,
): EdgeEndpoints | null {
  const src = nodeMap.get(edge.source)
  const tgt = nodeMap.get(edge.target)
  if (!src || !tgt) return null

  return {
    sx: src.x + src.w / 2,
    sy: src.y + src.h / 2,
    tx: tgt.x + tgt.w / 2,
    ty: tgt.y + tgt.h / 2,
  }
}

/**
 * Evaluate a point along a cubic bezier approximation of a React Flow edge.
 * For simplicity we use a single control point offset (quadratic bezier feel)
 * that mimics React Flow's default bezier routing.
 */
function bezierPoint(t: number, ep: EdgeEndpoints): { x: number; y: number } {
  // React Flow default bezier: control points offset vertically by half the
  // y-distance from source/target. We approximate with a quadratic midpoint
  // control that gives a gentle curve.
  const dx = ep.tx - ep.sx
  const dy = ep.ty - ep.sy

  // Control point: midpoint shifted perpendicular to the line
  const mx = (ep.sx + ep.tx) / 2
  const my = (ep.sy + ep.ty) / 2

  // Offset perpendicular — gives a gentle arc. The offset magnitude is
  // proportional to the distance, capped to avoid extreme curves.
  const dist = Math.sqrt(dx * dx + dy * dy)
  const offset = Math.min(dist * 0.15, 60)

  // Perpendicular direction (rotated 90 degrees from dx,dy)
  const nx = -dy / (dist || 1)
  const ny = dx / (dist || 1)

  const cx = mx + nx * offset
  const cy = my + ny * offset

  // Quadratic bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * C + t^2 * P1
  const u = 1 - t
  return {
    x: u * u * ep.sx + 2 * u * t * cx + t * t * ep.tx,
    y: u * u * ep.sy + 2 * u * t * cy + t * t * ep.ty,
  }
}

/**
 * Convert flow coordinates to screen (canvas pixel) coordinates.
 */
function flowToScreen(
  fx: number,
  fy: number,
  vp: { x: number; y: number; zoom: number },
): { x: number; y: number } {
  return {
    x: fx * vp.zoom + vp.x,
    y: fy * vp.zoom + vp.y,
  }
}

/**
 * Create a new particle assigned to a random edge.
 */
function createParticle(edgeCount: number): Particle {
  const edgeIndex = Math.floor(Math.random() * edgeCount)
  // 8-12 second cycle at 30fps = 240-360 frames
  // speed = 1 / frames, so 1/240 to 1/360
  const cycleFps = 240 + Math.random() * 120 // 240-360 frames
  return {
    edgeIndex,
    progress: Math.random(), // stagger start positions
    speed: 1 / cycleFps,
    trail: [],
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ParticleDriftComponent(): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // React Flow data
  const edges = useEdges()
  const nodes = useNodes()
  const viewport = useViewport()

  // Reduced motion — respect both OS and app preferences
  const osReducedMotion = useReducedMotion()
  const appReduceMotionPref = useProgramStore(selectReduceMotion)
  const shouldReduceMotion =
    appReduceMotionPref === 'always' || (appReduceMotionPref === 'system' && osReducedMotion)

  // Build a stable node position map: id -> { x, y, w, h }
  const nodeMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number; w: number; h: number }>()
    for (const node of nodes) {
      map.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        w: (node.measured?.width ?? (node as any).width ?? 200) as number,
        h: (node.measured?.height ?? (node as any).height ?? 100) as number,
      })
    }
    return map
  }, [nodes])

  // Resolve edge endpoints (flow coordinates)
  const edgeEndpoints = useMemo(() => {
    const result: EdgeEndpoints[] = []
    for (const edge of edges) {
      const ep = resolveEdgeEndpoints(edge, nodeMap)
      if (ep) result.push(ep)
    }
    return result
  }, [edges, nodeMap])

  // Compute max particle count based on canvas area
  const maxParticles = useMemo(() => {
    const container = containerRef.current
    if (!container) return 0
    const area = container.clientWidth * container.clientHeight
    return Math.max(0, Math.floor(area / AREA_PER_PARTICLE))
  }, [
    // Re-evaluate when container might have resized (viewport changes proxy this)
    viewport.zoom,
  ])

  // Read accent color from CSS custom property (if set), fallback to constant
  const accentColor = useMemo(() => {
    if (typeof document === 'undefined') return PARTICLE_COLOR
    const style = getComputedStyle(document.documentElement)
    const glow = style.getPropertyValue('--accent-glow').trim()
    return glow && glow.startsWith('#') ? glow : PARTICLE_COLOR
  }, [])

  // Stable references for the RAF loop
  const stateRef = useRef({
    edgeEndpoints,
    viewport,
    maxParticles,
    accentColor,
  })
  useEffect(() => {
    stateRef.current = { edgeEndpoints, viewport, maxParticles, accentColor }
  }, [edgeEndpoints, viewport, maxParticles, accentColor])

  // ------ Animation loop ------
  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) {
      rafRef.current = requestAnimationFrame(animate)
      return
    }

    // Zoom performance tier — read from store (no React subscription needed)
    const tier = useWorkspaceStore.getState().zoomPerfTier ?? 'full'

    // At minimal tier: clear canvas but keep RAF alive
    if (tier === 'minimal') {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const dpr = window.devicePixelRatio || 1
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
      }
      rafRef.current = requestAnimationFrame(animate)
      return
    }

    // Tier-aware frame throttle: 15fps at reduced, 30fps at full
    const effectiveInterval = tier === 'reduced' ? 66 : FRAME_INTERVAL_MS
    const elapsed = timestamp - lastFrameRef.current
    if (elapsed < effectiveInterval) {
      rafRef.current = requestAnimationFrame(animate)
      return
    }
    lastFrameRef.current = timestamp

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(animate)
      return
    }

    const {
      edgeEndpoints: eps,
      viewport: vp,
      maxParticles: maxP,
      accentColor: color,
    } = stateRef.current

    // Resize canvas to match container (handle DPR for sharpness)
    const container = canvas.parentElement
    if (container) {
      const dpr = window.devicePixelRatio || 1
      const w = container.clientWidth
      const h = container.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }

    // Clear
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

    // Nothing to draw if no edges
    if (eps.length === 0 || maxP === 0) {
      rafRef.current = requestAnimationFrame(animate)
      return
    }

    // Reconcile particle count — cap at 20 in reduced tier
    const particles = particlesRef.current
    const effectiveMax = tier === 'reduced' ? Math.min(20, maxP) : maxP
    const targetCount = Math.min(eps.length, effectiveMax)

    // Add particles if needed
    while (particles.length < targetCount) {
      particles.push(createParticle(eps.length))
    }
    // Remove excess particles
    if (particles.length > targetCount) {
      particles.length = targetCount
    }

    // Update and draw each particle
    for (const p of particles) {
      // Ensure edge index is valid (edges may have changed)
      if (p.edgeIndex >= eps.length) {
        p.edgeIndex = Math.floor(Math.random() * eps.length)
        p.progress = 0
        p.trail = []
      }

      const ep = eps[p.edgeIndex]

      // Advance progress
      p.progress += p.speed
      if (p.progress >= 1) {
        // Reset — assign to a random edge for variety
        p.progress = 0
        p.edgeIndex = Math.floor(Math.random() * eps.length)
        p.trail = []
        continue // skip drawing this frame to avoid a flash at origin
      }

      // Compute position along bezier in flow coords, then convert to screen
      const flowPos = bezierPoint(p.progress, ep)
      const screenPos = flowToScreen(flowPos.x, flowPos.y, vp)

      // Update trail (push current position, keep last N)
      p.trail.unshift({ x: screenPos.x, y: screenPos.y })
      if (p.trail.length > TRAIL_LENGTH) {
        p.trail.length = TRAIL_LENGTH
      }

      // Draw motion blur trail (oldest = most transparent)
      for (let i = p.trail.length - 1; i >= 0; i--) {
        const pos = p.trail[i]
        const trailOpacity = PARTICLE_OPACITY * (1 - i / TRAIL_LENGTH) * 0.6
        const trailRadius = PARTICLE_RADIUS * (1 - i * 0.15)

        ctx.beginPath()
        ctx.arc(pos.x, pos.y, Math.max(0.5, trailRadius), 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = trailOpacity
        ctx.fill()
      }

      // Draw main particle (on top of trail)
      ctx.beginPath()
      ctx.arc(screenPos.x, screenPos.y, PARTICLE_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = PARTICLE_OPACITY
      ctx.fill()
    }

    // Reset alpha
    ctx.globalAlpha = 1

    rafRef.current = requestAnimationFrame(animate)
  }, [])

  // Start/stop animation loop
  useEffect(() => {
    if (shouldReduceMotion) {
      // Clean up any running animation
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [shouldReduceMotion, animate])

  // Don't render anything if reduced motion
  if (shouldReduceMotion) return null

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

export const ParticleDrift = memo(ParticleDriftComponent)
export default ParticleDrift
