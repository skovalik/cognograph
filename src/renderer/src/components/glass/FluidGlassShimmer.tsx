/**
 * FluidGlassShimmer - Optional GPU-accelerated noise overlay
 *
 * Adds subtle animated grain texture on top of .glass-fluid elements.
 * Auto-detects GPU tier and glass style - only renders when both are 'high'/'fluid'.
 *
 * Usage:
 * ```tsx
 * <div className="glass-fluid">
 *   <FluidGlassShimmer />
 *   {content}
 * </div>
 * ```
 */

import { memo, useEffect, useRef } from 'react'
import { useGlassStyle } from '@/hooks/useGlassStyle'
import { getGPUTier } from '@/utils/gpuDetection'

interface FluidGlassShimmerProps {
  /** Override auto-detection to force render (for testing/preview) */
  forceRender?: boolean
}

function FluidGlassShimmerInner({ forceRender = false }: FluidGlassShimmerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const glassStyle = useGlassStyle()
  const gpuTier = getGPUTier()

  // Only render on high-tier GPU with fluid-glass style
  const shouldRender = forceRender || (gpuTier.tier === 'high' && glassStyle === 'fluid-glass')

  useEffect(() => {
    if (!shouldRender || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    // Match canvas size to container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width
        canvas.height = rect.height
      }
    }

    resizeCanvas()
    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(canvas)

    // Generate animated noise pattern
    let lastFrameTime = 0
    const FPS = 20 // Throttle to 20fps to reduce CPU load
    const frameDuration = 1000 / FPS

    const drawNoise = (timestamp: number) => {
      if (timestamp - lastFrameTime < frameDuration) {
        animationFrameRef.current = requestAnimationFrame(drawNoise)
        return
      }
      lastFrameTime = timestamp

      const { width, height } = canvas
      if (width === 0 || height === 0) {
        animationFrameRef.current = requestAnimationFrame(drawNoise)
        return
      }

      // Create noise pattern using ImageData
      const imageData = ctx.createImageData(width, height)
      const data = imageData.data

      // Generate subtle grain (low opacity)
      for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 255
        data[i] = noise // R
        data[i + 1] = noise // G
        data[i + 2] = noise // B
        data[i + 3] = 8 // A (very low opacity)
      }

      ctx.putImageData(imageData, 0, 0)
      animationFrameRef.current = requestAnimationFrame(drawNoise)
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReducedMotion) {
      animationFrameRef.current = requestAnimationFrame(drawNoise)
    }

    // Cleanup
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      resizeObserver.disconnect()
    }
  }, [shouldRender])

  if (!shouldRender) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className="fluid-glass-shimmer"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        borderRadius: 'inherit',
        mixBlendMode: 'overlay',
        opacity: 0.4
      }}
      aria-hidden="true"
    />
  )
}

export const FluidGlassShimmer = memo(FluidGlassShimmerInner)
FluidGlassShimmer.displayName = 'FluidGlassShimmer'
