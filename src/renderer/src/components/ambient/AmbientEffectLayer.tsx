/**
 * AmbientEffectLayer - Orchestrator for React Bits background effects
 *
 * Renders the selected ambient effect underneath React Flow nodes.
 * Uses a registry-driven architecture — each effect is lazy-loaded and
 * receives its own native props via effectRegistry.ts.
 */

import React, { Component, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { AmbientEffectSettings } from '@shared/types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { getGPUTier } from '../../utils/gpuDetection'
import { useProgramStore, selectReduceMotion } from '../../stores/programStore'
import { EFFECT_REGISTRY } from './effectRegistry'
import { hexToRgbFloat, generatePaletteFromAccents, deriveColor } from './utils/colorConvert'

// ---------------------------------------------------------------------------
// ErrorBoundary — catches WebGL/OGL crashes in ambient effects
// ---------------------------------------------------------------------------

interface EffectErrorBoundaryState {
  hasError: boolean
}

class EffectErrorBoundary extends Component<
  { children: React.ReactNode; effectName: string },
  EffectErrorBoundaryState
> {
  state: EffectErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): EffectErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error): void {
    console.warn(`[AmbientEffect] "${this.props.effectName}" crashed:`, error.message)
  }

  componentDidUpdate(prevProps: { effectName: string }): void {
    if (prevProps.effectName !== this.props.effectName) {
      this.setState({ hasError: false })
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) return null
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AmbientEffectLayerProps {
  settings: AmbientEffectSettings
  accentColor?: string
  accentSecondary?: string
  isDark?: boolean
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function getEffectColor(accentColor?: string): string {
  if (accentColor && accentColor.startsWith('#') && accentColor.length >= 4) {
    return accentColor
  }
  return '#8b5cf6' // fallback violet
}

// ---------------------------------------------------------------------------
// Build per-effect props from registry defaults + user overrides + theme color
// ---------------------------------------------------------------------------

function buildEffectProps(
  entry: (typeof EFFECT_REGISTRY)[string],
  userOverrides: Record<string, unknown>,
  themeBaseColor: string,
  themeSecondaryColor?: string,
  isDark = true
): Record<string, unknown> {
  // Start with registry defaults
  const props: Record<string, unknown> = { ...entry.defaultProps }

  // Apply theme-linked colors (only for props the user hasn't overridden)
  for (const propKey of entry.themeColorProps) {
    if (propKey in userOverrides) continue

    const schema = entry.propSchema.find((s) => s.key === propKey)
    if (!schema) continue

    if (schema.controlType === 'color-array') {
      const currentDefault = entry.defaultProps[propKey]
      const count = Array.isArray(currentDefault) ? currentDefault.length : 3
      if (schema.colorFormat === 'hex') {
        props[propKey] = generatePaletteFromAccents(themeBaseColor, themeSecondaryColor, count)
      } else {
        props[propKey] = generatePaletteFromAccents(themeBaseColor, themeSecondaryColor, count).map(h => hexToRgbFloat(h))
      }
    } else if (schema.colorFormat === 'rgb-float') {
      props[propKey] = hexToRgbFloat(themeBaseColor)
    } else {
      // hex color
      props[propKey] = themeBaseColor
    }
  }

  // Apply derived colors (props that auto-derive from another resolved prop)
  for (const schema of entry.propSchema) {
    if (!schema.deriveFrom || schema.key in userOverrides) continue
    const sourceValue = props[schema.deriveFrom.sourceKey]
    if (typeof sourceValue === 'string' && sourceValue.startsWith('#')) {
      props[schema.key] = deriveColor(sourceValue, schema.deriveFrom, isDark)
    }
  }

  // Inject isDark so effects can adapt to light/dark mode (before overrides
  // so a stale persisted value can't accidentally override the real theme mode)
  props.isDark = isDark

  // Apply user overrides last (highest priority)
  Object.assign(props, userOverrides)

  return props
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function AmbientEffectLayerComponent({
  settings,
  accentColor,
  accentSecondary,
  isDark = true,
}: AmbientEffectLayerProps): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null)
  const gpuTierRef = useRef(getGPUTier())
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  // Check reduced motion preference
  const osReducedMotion = useReducedMotion()
  const appReduceMotionPref = useProgramStore(selectReduceMotion)
  const shouldReduceMotion =
    appReduceMotionPref === 'always' ||
    (appReduceMotionPref === 'system' && osReducedMotion)

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const { clientWidth, clientHeight } = container
      if (clientWidth > 0 && clientHeight > 0) {
        setDimensions((prev) => {
          if (prev.width !== clientWidth || prev.height !== clientHeight) {
            return { width: clientWidth, height: clientHeight }
          }
          return prev
        })
      }
    }

    const rafId = requestAnimationFrame(updateDimensions)
    const observer = new ResizeObserver(updateDimensions)
    observer.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [])

  const hasValidDimensions = dimensions.width > 0 && dimensions.height > 0

  const shouldRenderEffect =
    settings.enabled &&
    settings.effect !== 'none' &&
    !shouldReduceMotion &&
    hasValidDimensions &&
    gpuTierRef.current.tier !== 'low'

  const effectColor = getEffectColor(accentColor)

  // Bloom settings — quadratic curve for more dramatic high end
  // Cap bloom at 30% on medium-tier GPUs to reduce GPU load
  const rawBloom = settings.bloomIntensity ?? 30
  const bloomIntensity = gpuTierRef.current.tier === 'medium' ? Math.min(rawBloom, 30) : rawBloom
  const showBloom = bloomIntensity > 0 && shouldRenderEffect
  const t = bloomIntensity / 100
  const bloomOpacity = t * (0.6 + 0.6 * t)   // 0→0, 50→0.45, 100→1.2 (clamped by CSS)
  const bloomBlurPx = Math.round(4 + t * t * 24) // 0→4px, 50→10px, 100→28px

  // Build final props for the active effect
  const resolvedProps = useMemo(() => {
    const entry = EFFECT_REGISTRY[settings.effect]
    if (!entry) return null

    const userOverrides = settings.effectProps[settings.effect] ?? {}
    return buildEffectProps(entry, userOverrides, effectColor, accentSecondary, isDark)
  }, [settings.effect, settings.effectProps, effectColor, accentSecondary, isDark])

  const renderEffect = () => {
    const entry = EFFECT_REGISTRY[settings.effect]
    if (!entry || !resolvedProps) return null

    const Component = entry.component
    return (
      <EffectErrorBoundary effectName={settings.effect}>
        <Suspense fallback={null}>
          <Component
            {...resolvedProps}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
            }}
          />
        </Suspense>
      </EffectErrorBoundary>
    )
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      {shouldRenderEffect && (
        <div
          key={`${settings.effect}-${effectColor}`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            animation: 'ambientFadeIn 300ms ease-out',
            background: !isDark ? 'var(--canvas-background, #ffffff)' : undefined,
          }}
        >
          {renderEffect()}
        </div>
      )}

      {showBloom && (
        <BloomLayer
          bloomBlurPx={bloomBlurPx}
          bloomOpacity={bloomOpacity}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BloomLayer — canvas-copy approach (works with any canvas-based effect)
// ---------------------------------------------------------------------------

function BloomLayerComponent({
  bloomBlurPx,
  bloomOpacity,
}: {
  bloomBlurPx: number
  bloomOpacity: number
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let animId: number | null = null

    const copyFrame = (): void => {
      const bloomCanvas = canvasRef.current
      if (!bloomCanvas) {
        animId = requestAnimationFrame(copyFrame)
        return
      }

      const container = bloomCanvas.parentElement
      const effectCanvas = container?.querySelector('canvas:not([data-bloom])') as HTMLCanvasElement | null
      if (!effectCanvas) {
        animId = requestAnimationFrame(copyFrame)
        return
      }

      if (bloomCanvas.width !== effectCanvas.width || bloomCanvas.height !== effectCanvas.height) {
        bloomCanvas.width = effectCanvas.width
        bloomCanvas.height = effectCanvas.height
      }

      const ctx = bloomCanvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height)
        ctx.drawImage(effectCanvas, 0, 0)
      }

      animId = requestAnimationFrame(copyFrame)
    }

    animId = requestAnimationFrame(copyFrame)

    return () => {
      if (animId !== null) cancelAnimationFrame(animId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      data-bloom="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        filter: `blur(${bloomBlurPx}px)`,
        opacity: bloomOpacity,
        mixBlendMode: 'screen',
      }}
    />
  )
}

const BloomLayer = memo(BloomLayerComponent)

export const AmbientEffectLayer = memo(AmbientEffectLayerComponent)
export default AmbientEffectLayer
