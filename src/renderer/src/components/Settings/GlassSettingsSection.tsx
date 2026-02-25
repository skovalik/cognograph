/**
 * Glass Settings Section - Three-tier glassmorphism UI controls
 *
 * Allows users to choose between solid, soft-blur, fluid-glass, or auto modes.
 * Shows effective style, GPU tier, and performance info.
 */

import { memo, useCallback } from 'react'
import { Eye, Sparkles, Info, AlertTriangle, Lightbulb } from 'lucide-react'
import type { GlassSettings, GlassStyle } from '@shared/types'
import { getGPUTier } from '@/utils/gpuDetection'
import { resolveGlassStyle } from '@/utils/glassUtils'
import { Slider } from '../ui/slider'
import { logger } from '@/utils/logger'

interface GlassSettingsSectionProps {
  glassSettings: GlassSettings
  ambientEnabled: boolean
  onGlassSettingsChange: (settings: Partial<GlassSettings>) => void
}

function GlassSettingsSectionInner({
  glassSettings,
  ambientEnabled,
  onGlassSettingsChange
}: GlassSettingsSectionProps) {
  const gpuTier = getGPUTier()
  const effectiveStyle = resolveGlassStyle(
    glassSettings.userPreference,
    gpuTier.tier,
    ambientEnabled
  )

  const handleStyleChange = useCallback((style: GlassStyle) => {
    onGlassSettingsChange({ userPreference: style, effectiveStyle: style === 'auto' ? effectiveStyle : style })
  }, [onGlassSettingsChange, effectiveStyle])

  const handleBlurRadiusChange = useCallback((value: number[]) => {
    onGlassSettingsChange({ blurRadius: value[0] })
  }, [onGlassSettingsChange])

  const handlePanelOpacityChange = useCallback((value: number[]) => {
    logger.log('[SLIDER] Panel opacity changed to:', value[0])
    onGlassSettingsChange({ panelOpacity: value[0] })
  }, [onGlassSettingsChange])

  const handleNoiseOpacityChange = useCallback((value: number[]) => {
    onGlassSettingsChange({ noiseOpacity: value[0] })
  }, [onGlassSettingsChange])

  const handleShimmerSpeedChange = useCallback((value: number[]) => {
    onGlassSettingsChange({ shimmerSpeed: value[0] })
  }, [onGlassSettingsChange])

  // Get GPU tier label
  const gpuTierLabel = {
    high: 'High (FluidGlass capable)',
    medium: 'Medium (Soft Blur only)',
    low: 'Low (Solid recommended)'
  }[gpuTier.tier]

  // Get effective style label
  const effectiveStyleLabel = {
    solid: 'Solid (No glass)',
    'soft-blur': 'Soft Blur (CSS only)',
    'fluid-glass': 'FluidGlass (Premium)'
  }[effectiveStyle]

  // Check if user choice is different from effective
  const isDowngraded = glassSettings.userPreference !== 'auto' && effectiveStyle !== glassSettings.userPreference

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <label className="block text-sm font-medium gui-text mb-2">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Glass Style
          </span>
        </label>
        <p className="text-xs gui-text-secondary">
          Choose glassmorphism effect for panels and modals.
        </p>
      </div>

      {/* Style Radio Group */}
      <div className="space-y-2">
        <StyleRadio
          selected={glassSettings.userPreference === 'auto'}
          onClick={() => handleStyleChange('auto')}
          label="Auto"
          description="Automatic based on GPU tier"
        />
        <StyleRadio
          selected={glassSettings.userPreference === 'fluid-glass'}
          onClick={() => handleStyleChange('fluid-glass')}
          label="FluidGlass"
          description="Full GPU glass with shimmer (high-end)"
          disabled={gpuTier.tier === 'low'}
        />
        <StyleRadio
          selected={glassSettings.userPreference === 'soft-blur'}
          onClick={() => handleStyleChange('soft-blur')}
          label="Soft Blur"
          description="CSS backdrop-filter only (balanced)"
        />
        <StyleRadio
          selected={glassSettings.userPreference === 'solid'}
          onClick={() => handleStyleChange('solid')}
          label="Solid"
          description="No glass effect (minimal)"
        />
      </div>

      {/* Info Card: Effective Style */}
      <div className="gui-panel-secondary p-3 rounded space-y-1.5 text-xs">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 gui-text-secondary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="gui-text">
              <span className="font-medium">GPU Tier:</span> {gpuTierLabel}
            </div>
            <div className="gui-text">
              <span className="font-medium">Effective Style:</span> {effectiveStyleLabel}
            </div>
            {isDowngraded && (
              <div className="gui-text-secondary flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Auto-downgraded for performance</span>
              </div>
            )}
            {effectiveStyle === 'soft-blur' && ambientEnabled && gpuTier.tier === 'medium' && (
              <div className="gui-text-secondary flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>FluidGlass disabled (ambient + medium GPU)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Blur Radius Slider */}
      <div>
        <label className="block text-xs font-medium gui-text mb-2">
          Blur Radius: {glassSettings.blurRadius}px
        </label>
        <Slider
          min={8}
          max={24}
          step={2}
          value={[glassSettings.blurRadius]}
          onValueChange={handleBlurRadiusChange}
          disabled={effectiveStyle === 'solid'}
          className="w-full"
        />
        <p className="text-xs gui-text-secondary mt-1">
          Higher values = more blur (affects performance)
        </p>
      </div>

      {/* Panel Opacity Slider */}
      <div>
        <label className="block text-xs font-medium gui-text mb-2">
          Panel Opacity: {glassSettings.panelOpacity}%
        </label>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[glassSettings.panelOpacity]}
          onValueChange={handlePanelOpacityChange}
          className="w-full"
        />
        <p className="text-xs gui-text-secondary mt-1">
          Lower values = more transparency. Below 50% may reduce readability.
        </p>
      </div>

      {/* NOTE: Removed "Keep text opaque" toggle - text stays opaque by default
           since text colors use separate CSS properties (--gui-text-primary)
           while backgrounds use --glass-opacity. No toggle needed. */}

      {/* Noise Opacity Slider (FluidGlass only) */}
      {effectiveStyle === 'fluid-glass' && (
        <div>
          <label className="block text-xs font-medium gui-text mb-2">
            Noise Texture: {glassSettings.noiseOpacity}%
          </label>
          <Slider
            min={0}
            max={20}
            step={1}
            value={[glassSettings.noiseOpacity]}
            onValueChange={handleNoiseOpacityChange}
            className="w-full"
          />
          <p className="text-xs gui-text-secondary mt-1">
            Subtle grain texture for premium look
          </p>
        </div>
      )}

      {/* Shimmer Speed Slider (FluidGlass only) */}
      {effectiveStyle === 'fluid-glass' && (
        <div>
          <label className="block text-xs font-medium gui-text mb-2">
            Shimmer Speed: {glassSettings.shimmerSpeed.toFixed(1)}x
          </label>
          <Slider
            min={0.5}
            max={2.0}
            step={0.1}
            value={[glassSettings.shimmerSpeed]}
            onValueChange={handleShimmerSpeedChange}
            className="w-full"
          />
          <p className="text-xs gui-text-secondary mt-1">
            Animation speed of shimmer effect
          </p>
        </div>
      )}

      {/* Apply To Checkboxes */}
      <div className="pt-4 border-t gui-border">
        <label className="block text-xs font-medium gui-text mb-3">
          Apply glass effects to:
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={glassSettings.applyTo?.nodes ?? false}
              onChange={(e) => onGlassSettingsChange({
                applyTo: { ...glassSettings.applyTo, nodes: e.target.checked }
              })}
              className="w-4 h-4 rounded border-gui-border text-gui-accent-primary focus:ring-2 focus:ring-gui-accent-primary/20"
            />
            <span className="text-sm gui-text">Nodes</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={glassSettings.applyTo?.modals ?? false}
              onChange={(e) => onGlassSettingsChange({
                applyTo: { ...glassSettings.applyTo, modals: e.target.checked }
              })}
              className="w-4 h-4 rounded border-gui-border text-gui-accent-primary focus:ring-2 focus:ring-gui-accent-primary/20"
            />
            <span className="text-sm gui-text">Modals & dialogs</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={glassSettings.applyTo?.panels ?? false}
              onChange={(e) => onGlassSettingsChange({
                applyTo: { ...glassSettings.applyTo, panels: e.target.checked }
              })}
              className="w-4 h-4 rounded border-gui-border text-gui-accent-primary focus:ring-2 focus:ring-gui-accent-primary/20"
            />
            <span className="text-sm gui-text">Toolbars & side panels</span>
          </label>
        </div>
        <p className="text-xs gui-text-secondary mt-2 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
          <span>Toggle these to enable/disable glass on specific UI surfaces</span>
        </p>
      </div>
    </div>
  )
}

// Radio button for glass style selection
interface StyleRadioProps {
  selected: boolean
  onClick: () => void
  label: string
  description: string
  disabled?: boolean
}

function StyleRadio({ selected, onClick, label, description, disabled = false }: StyleRadioProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-3 rounded border transition-all ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : selected
            ? 'border-gui-accent-primary gui-panel-secondary'
            : 'border-gui-border hover:border-gui-accent-primary/50 gui-panel-secondary hover:gui-panel'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all ${
            selected
              ? 'border-gui-accent-primary bg-gui-accent-primary ring-2 ring-gui-accent-primary/20'
              : 'border-gui-border'
          }`}
        >
          {selected && (
            <div className="w-full h-full rounded-full bg-white scale-50" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium gui-text">{label}</div>
          <div className="text-xs gui-text-secondary">{description}</div>
        </div>
      </div>
    </button>
  )
}

export const GlassSettingsSection = memo(GlassSettingsSectionInner)
GlassSettingsSection.displayName = 'GlassSettingsSection'
