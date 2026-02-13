/**
 * EffectControlsPanel — Data-driven per-effect controls
 *
 * Reads propSchema from the effect registry and renders sliders,
 * toggles, selects, and color pickers for each effect's native props.
 * Theme-linked props show a reset button when overridden by the user.
 */

import React, { memo, useCallback } from 'react'
import type { AmbientEffectType, AmbientEffectSettings } from '@shared/types'
import { EFFECT_REGISTRY, type PropSchema } from './effectRegistry'
import { hexToRgbFloat, rgbFloatToHex } from './utils/colorConvert'
import { Link, RotateCcw } from 'lucide-react'

interface EffectControlsPanelProps {
  effectType: AmbientEffectType
  settings: AmbientEffectSettings
  onChange: (settings: AmbientEffectSettings) => void
  textMuted: string
  /** Theme-resolved prop values — used as display fallback for theme-linked props */
  resolvedValues?: Record<string, unknown>
}

function EffectControlsPanelComponent({
  effectType,
  settings,
  onChange,
  textMuted,
  resolvedValues,
}: EffectControlsPanelProps): JSX.Element | null {
  const entry = EFFECT_REGISTRY[effectType]
  if (!entry) return null

  const userOverrides = settings.effectProps[effectType] ?? {}
  // Theme-linked = direct themeColorProps + derived-from props
  const themeLinkedKeys = new Set([
    ...entry.themeColorProps,
    ...entry.propSchema.filter(s => s.deriveFrom).map(s => s.key),
  ])

  const updateProp = useCallback(
    (key: string, value: unknown) => {
      const newEffectProps = {
        ...settings.effectProps,
        [effectType]: {
          ...(settings.effectProps[effectType] ?? {}),
          [key]: value,
        },
      }
      onChange({ ...settings, effectProps: newEffectProps })
    },
    [effectType, settings, onChange]
  )

  const resetProp = useCallback(
    (key: string) => {
      const current = settings.effectProps[effectType]
      if (!current) return
      const updated = { ...current }
      delete updated[key]
      const newEffectProps = { ...settings.effectProps }
      if (Object.keys(updated).length === 0) {
        delete newEffectProps[effectType]
      } else {
        newEffectProps[effectType] = updated
      }
      onChange({ ...settings, effectProps: newEffectProps })
    },
    [effectType, settings, onChange]
  )

  const resetDefaults = useCallback(() => {
    const newEffectProps = { ...settings.effectProps }
    delete newEffectProps[effectType]
    onChange({ ...settings, effectProps: newEffectProps })
  }, [effectType, settings, onChange])

  const getValue = (schema: PropSchema): unknown => {
    if (schema.key in userOverrides) return userOverrides[schema.key]
    // For theme-linked props, show the resolved (accent-derived) value
    if (resolvedValues && schema.key in resolvedValues) return resolvedValues[schema.key]
    return entry.defaultProps[schema.key]
  }

  return (
    <div className="space-y-2">
      <div className={`text-[9px] ${textMuted} uppercase tracking-wider`}>Effect Settings</div>

      {entry.propSchema.map((schema) => {
        const isLinked = themeLinkedKeys.has(schema.key)
        const isOverridden = schema.key in userOverrides

        return (
          <div key={schema.key} className="relative group/control">
            <ControlRow
              schema={schema}
              value={getValue(schema)}
              onChange={(v) => updateProp(schema.key, v)}
              textMuted={textMuted}
              isThemeLinked={isLinked}
              isOverridden={isOverridden}
            />
            {isLinked && isOverridden && (
              <button
                onClick={() => resetProp(schema.key)}
                title="Reset to theme color"
                className="absolute -right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover/control:opacity-100 transition-opacity gui-bg-accent text-white"
              >
                <RotateCcw size={8} />
              </button>
            )}
          </div>
        )
      })}

      {Object.keys(userOverrides).length > 0 && (
        <button
          onClick={resetDefaults}
          className={`text-[9px] ${textMuted} underline hover:no-underline mt-1`}
        >
          Reset All to Defaults
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual control renderers
// ---------------------------------------------------------------------------

function ControlRow({
  schema,
  value,
  onChange,
  textMuted,
  isThemeLinked,
  isOverridden,
}: {
  schema: PropSchema
  value: unknown
  onChange: (v: unknown) => void
  textMuted: string
  isThemeLinked: boolean
  isOverridden: boolean
}): JSX.Element {
  const labelEl = (
    <span className={`text-[10px] ${textMuted} w-20 truncate inline-flex items-center gap-0.5`}>
      {isThemeLinked && !isOverridden && (
        <Link size={7} className="shrink-0 opacity-50" />
      )}
      {schema.label}
    </span>
  )

  switch (schema.controlType) {
    case 'slider':
      return (
        <SliderControl
          schema={schema}
          value={value as number}
          onChange={onChange}
          textMuted={textMuted}
          labelEl={labelEl}
        />
      )
    case 'toggle':
      return (
        <ToggleControl
          schema={schema}
          value={value as boolean}
          onChange={onChange}
          textMuted={textMuted}
        />
      )
    case 'select':
      return (
        <SelectControl
          schema={schema}
          value={value as string}
          onChange={onChange}
          textMuted={textMuted}
          labelEl={labelEl}
        />
      )
    case 'color':
      return (
        <ColorControl
          schema={schema}
          value={value}
          onChange={onChange}
          textMuted={textMuted}
          labelEl={labelEl}
        />
      )
    case 'color-array':
      return (
        <ColorArrayControl
          schema={schema}
          value={value as string[]}
          onChange={onChange}
          textMuted={textMuted}
          isThemeLinked={isThemeLinked}
          isOverridden={isOverridden}
        />
      )
    default:
      return <></>
  }
}

function SliderControl({
  schema,
  value,
  onChange,
  textMuted,
  labelEl,
}: {
  schema: PropSchema
  value: number
  onChange: (v: number) => void
  textMuted: string
  labelEl: React.ReactNode
}) {
  const decimals = schema.step && schema.step < 1
    ? Math.max(1, -Math.floor(Math.log10(schema.step)))
    : 0
  const displayValue = decimals > 0
    ? (value ?? 0).toFixed(decimals)
    : String(value ?? 0)

  return (
    <div className="flex items-center gap-2">
      {labelEl}
      <input
        type="range"
        min={schema.min ?? 0}
        max={schema.max ?? 100}
        step={schema.step ?? 1}
        value={value ?? schema.min ?? 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-[var(--gui-accent-primary)]"
      />
      <span className={`text-[10px] ${textMuted} w-10 text-right`}>{displayValue}</span>
    </div>
  )
}

function ToggleControl({
  schema,
  value,
  onChange,
  textMuted,
}: {
  schema: PropSchema
  value: boolean
  onChange: (v: boolean) => void
  textMuted: string
}) {
  return (
    <label className={`flex items-center gap-1.5 text-[10px] ${textMuted} cursor-pointer`}>
      <input
        type="checkbox"
        checked={value ?? false}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3 h-3 rounded accent-[var(--gui-accent-primary)]"
      />
      {schema.label}
    </label>
  )
}

function SelectControl({
  schema,
  value,
  onChange,
  textMuted,
  labelEl,
}: {
  schema: PropSchema
  value: string
  onChange: (v: string) => void
  textMuted: string
  labelEl: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      {labelEl}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 text-[10px] ${textMuted} bg-transparent border border-current/20 rounded px-1 py-0.5`}
      >
        {schema.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function ColorControl({
  schema,
  value,
  onChange,
  textMuted,
  labelEl,
}: {
  schema: PropSchema
  value: unknown
  onChange: (v: unknown) => void
  textMuted: string
  labelEl: React.ReactNode
}) {
  // Handle rgb-float [r,g,b] 0-1 format
  const isRgbFloat = schema.colorFormat === 'rgb-float'
  const hexValue = isRgbFloat
    ? rgbFloatToHex(value as [number, number, number])
    : (value as string) || '#ffffff'

  const handleChange = (hex: string) => {
    if (isRgbFloat) {
      onChange(hexToRgbFloat(hex))
    } else {
      onChange(hex)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {labelEl}
      <input
        type="color"
        value={hexValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
      />
      <span className={`text-[10px] ${textMuted}`}>{hexValue}</span>
    </div>
  )
}

function ColorArrayControl({
  schema,
  value,
  onChange,
  textMuted,
  isThemeLinked,
  isOverridden,
}: {
  schema: PropSchema
  value: string[]
  onChange: (v: string[]) => void
  textMuted: string
  isThemeLinked: boolean
  isOverridden: boolean
}) {
  const colors = Array.isArray(value) ? value : ['#ffffff']

  const updateColor = (index: number, hex: string) => {
    const newColors = [...colors]
    newColors[index] = hex
    onChange(newColors)
  }

  const addColor = () => {
    onChange([...colors, colors[colors.length - 1] || '#ffffff'])
  }

  const removeColor = (index: number) => {
    if (colors.length <= 1) return
    onChange(colors.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-1">
      <span className={`text-[10px] ${textMuted} inline-flex items-center gap-0.5`}>
        {isThemeLinked && !isOverridden && (
          <Link size={7} className="shrink-0 opacity-50" />
        )}
        {schema.label}
      </span>
      <div className="flex flex-wrap gap-1 items-center">
        {colors.map((color, i) => (
          <div key={i} className="relative group">
            <input
              type="color"
              value={color}
              onChange={(e) => updateColor(i, e.target.value)}
              className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
            {colors.length > 1 && (
              <button
                onClick={() => removeColor(i)}
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 text-white text-[7px] leading-none hidden group-hover:flex items-center justify-center"
              >
                x
              </button>
            )}
          </div>
        ))}
        {colors.length < 8 && (
          <button
            onClick={addColor}
            className={`w-5 h-5 rounded border border-dashed ${textMuted} text-[10px] flex items-center justify-center hover:brightness-125`}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}

export const EffectControlsPanel = memo(EffectControlsPanelComponent)
export default EffectControlsPanel
