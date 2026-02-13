/**
 * ColorPicker Component
 *
 * A comprehensive color picker with:
 * - Color wheel for hue/saturation selection
 * - Lightness slider
 * - Hex input
 * - Complementary color generation (2-10 colors)
 * - AI-powered palette generation
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Palette, Wand2, Copy, Check, Plus, Minus, Save, Pipette, X } from 'lucide-react'

interface ColorPickerProps {
  color: string // Current color in hex format
  onChange: (color: string) => void
  onSaveColor?: (color: string) => void
  onRemoveSavedColor?: (color: string) => void
  savedColors?: string[] // Custom saved colors to display
  onGeneratePalette?: (colors: string[], instruction?: string) => void
  isLightMode?: boolean
  showAIGeneration?: boolean
  aiGenerationEnabled?: boolean
}

// Convert hex to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result || !result[1] || !result[2] || !result[3]) return { h: 0, s: 100, l: 50 }

  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

// Convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number): string => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Generate complementary colors based on color theory
function generateComplementaryColors(baseHex: string, count: number): string[] {
  const { h, s, l } = hexToHSL(baseHex)
  const colors: string[] = [baseHex]

  if (count === 2) {
    // Complementary (opposite on color wheel)
    colors.push(hslToHex((h + 180) % 360, s, l))
  } else if (count === 3) {
    // Triadic (120 degrees apart)
    colors.push(hslToHex((h + 120) % 360, s, l))
    colors.push(hslToHex((h + 240) % 360, s, l))
  } else if (count === 4) {
    // Tetradic/Square (90 degrees apart)
    colors.push(hslToHex((h + 90) % 360, s, l))
    colors.push(hslToHex((h + 180) % 360, s, l))
    colors.push(hslToHex((h + 270) % 360, s, l))
  } else {
    // Distribute evenly around the color wheel
    const step = 360 / count
    for (let i = 1; i < count; i++) {
      colors.push(hslToHex((h + step * i) % 360, s, l))
    }
  }

  return colors
}

// Generate analogous colors (similar hues)
function generateAnalogousColors(baseHex: string, count: number): string[] {
  const { h, s, l } = hexToHSL(baseHex)
  const colors: string[] = []
  const spread = 30 // degrees of spread between colors
  const startOffset = -((count - 1) / 2) * spread

  for (let i = 0; i < count; i++) {
    colors.push(hslToHex((h + startOffset + i * spread + 360) % 360, s, l))
  }

  return colors
}

// Generate split-complementary colors
function generateSplitComplementary(baseHex: string): string[] {
  const { h, s, l } = hexToHSL(baseHex)
  return [
    baseHex,
    hslToHex((h + 150) % 360, s, l),
    hslToHex((h + 210) % 360, s, l)
  ]
}

function ColorPickerComponent({
  color,
  onChange,
  onSaveColor,
  onRemoveSavedColor,
  savedColors = [],
  onGeneratePalette,
  isLightMode: _isLightMode = false,
  showAIGeneration = false,
  aiGenerationEnabled = false
}: ColorPickerProps): JSX.Element {
  const [hsl, setHsl] = useState(() => hexToHSL(color))
  const [hexInput, setHexInput] = useState(color)
  const [complementaryCount, setComplementaryCount] = useState(3)
  const [generatedColors, setGeneratedColors] = useState<string[]>([])
  const [colorScheme, setColorScheme] = useState<'complementary' | 'analogous' | 'split'>('complementary')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [aiInstruction, setAiInstruction] = useState('')
  const [isEyedropperActive, setIsEyedropperActive] = useState(false)

  const wheelRef = useRef<HTMLCanvasElement>(null)
  const lightnessRef = useRef<HTMLCanvasElement>(null)

  // Eyedropper tool using the EyeDropper API (Chrome/Edge)
  const handleEyedropper = useCallback(async () => {
    // Check if EyeDropper API is available
    if (!('EyeDropper' in window)) {
      console.warn('EyeDropper API not supported')
      return
    }

    setIsEyedropperActive(true)
    try {
      // @ts-expect-error EyeDropper API is not in TypeScript types yet
      const eyeDropper = new window.EyeDropper()
      const result = await eyeDropper.open()
      const pickedColor = result.sRGBHex
      setHsl(hexToHSL(pickedColor))
      setHexInput(pickedColor)
      onChange(pickedColor)
    } catch (err) {
      // User cancelled or error occurred
      console.log('Eyedropper cancelled or error:', err)
    } finally {
      setIsEyedropperActive(false)
    }
  }, [onChange])

  // Update HSL when external color changes
  useEffect(() => {
    const newHsl = hexToHSL(color)
    setHsl(newHsl)
    setHexInput(color)
  }, [color])

  // Draw color wheel
  useEffect(() => {
    const canvas = wheelRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = canvas.width
    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - 2

    // Clear canvas
    ctx.clearRect(0, 0, size, size)

    // Draw color wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = ((angle - 1) * Math.PI) / 180
      const endAngle = ((angle + 1) * Math.PI) / 180

      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()

      // Create gradient for saturation
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
      gradient.addColorStop(0, hslToHex(angle, 0, hsl.l))
      gradient.addColorStop(1, hslToHex(angle, 100, hsl.l))

      ctx.fillStyle = gradient
      ctx.fill()
    }

    // Draw current position indicator
    const indicatorAngle = (hsl.h * Math.PI) / 180
    const indicatorRadius = (hsl.s / 100) * radius
    const indicatorX = centerX + Math.cos(indicatorAngle) * indicatorRadius
    const indicatorY = centerY + Math.sin(indicatorAngle) * indicatorRadius

    ctx.beginPath()
    ctx.arc(indicatorX, indicatorY, 6, 0, 2 * Math.PI)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(indicatorX, indicatorY, 4, 0, 2 * Math.PI)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [hsl])

  // Draw lightness slider
  useEffect(() => {
    const canvas = lightnessRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0)
    gradient.addColorStop(0, hslToHex(hsl.h, hsl.s, 0))
    gradient.addColorStop(0.5, hslToHex(hsl.h, hsl.s, 50))
    gradient.addColorStop(1, hslToHex(hsl.h, hsl.s, 100))

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Draw indicator
    const indicatorX = (hsl.l / 100) * width
    ctx.beginPath()
    ctx.moveTo(indicatorX, 0)
    ctx.lineTo(indicatorX, height)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [hsl])

  // Handle wheel click/drag
  const handleWheelInteraction = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = wheelRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left - canvas.width / 2
    const y = e.clientY - rect.top - canvas.height / 2
    const radius = canvas.width / 2 - 2

    let h = (Math.atan2(y, x) * 180) / Math.PI
    if (h < 0) h += 360

    let s = Math.min(100, (Math.sqrt(x * x + y * y) / radius) * 100)

    const newHsl = { ...hsl, h, s }
    setHsl(newHsl)
    const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l)
    setHexInput(newHex)
    onChange(newHex)
  }, [hsl, onChange])

  // Handle lightness slider
  const handleLightnessInteraction = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = lightnessRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const l = Math.max(0, Math.min(100, (x / canvas.width) * 100))

    const newHsl = { ...hsl, l }
    setHsl(newHsl)
    const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l)
    setHexInput(newHex)
    onChange(newHex)
  }, [hsl, onChange])

  // Handle hex input
  const handleHexChange = useCallback((value: string) => {
    setHexInput(value)
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      setHsl(hexToHSL(value))
      onChange(value)
    }
  }, [onChange])

  // Generate colors based on scheme
  const handleGenerateColors = useCallback(() => {
    let colors: string[]
    switch (colorScheme) {
      case 'analogous':
        colors = generateAnalogousColors(color, complementaryCount)
        break
      case 'split':
        colors = generateSplitComplementary(color)
        break
      case 'complementary':
      default:
        colors = generateComplementaryColors(color, complementaryCount)
        break
    }
    setGeneratedColors(colors)
    if (onGeneratePalette) {
      onGeneratePalette(colors)
    }
  }, [color, complementaryCount, colorScheme, onGeneratePalette])

  // Copy color to clipboard
  const handleCopyColor = useCallback(async (colorToCopy: string, index: number) => {
    try {
      await navigator.clipboard.writeText(colorToCopy)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [])

  // Theme-aware styling using design tokens
  const borderClasses = 'border-[var(--border-subtle)]'
  const textClasses = 'text-[var(--text-primary)]'
  const textMutedClasses = 'text-[var(--text-secondary)]'
  const inputBgClasses = 'bg-[var(--surface-panel-secondary)]'
  const buttonBgClasses = 'bg-[var(--surface-panel-secondary)] hover:bg-[var(--surface-panel)]'

  // Current color preview
  const currentColor = useMemo(() => hslToHex(hsl.h, hsl.s, hsl.l), [hsl])

  return (
    <div className="space-y-3">
      {/* Color Wheel */}
      <div className="flex items-start gap-3">
        <canvas
          ref={wheelRef}
          width={120}
          height={120}
          className="rounded-full cursor-crosshair border border-[var(--border-subtle)]"
          onClick={handleWheelInteraction}
          onMouseDown={(e) => {
            handleWheelInteraction(e)
            const onMove = (moveE: MouseEvent): void => {
              handleWheelInteraction(moveE as unknown as React.MouseEvent<HTMLCanvasElement>)
            }
            const onUp = (): void => {
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
            }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          }}
        />
        <div className="flex-1 space-y-2">
          {/* Current color preview */}
          <div className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded border-2 ${borderClasses}`}
              style={{ backgroundColor: currentColor }}
            />
            <div className="flex-1">
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                className={`w-full ${inputBgClasses} border ${borderClasses} rounded px-2 py-1 text-xs ${textClasses} font-mono focus:outline-none focus:gui-border-active`}
                maxLength={7}
              />
            </div>
            {/* Eyedropper button */}
            {'EyeDropper' in window && (
              <button
                onClick={handleEyedropper}
                className={`px-2 py-1 rounded text-[10px] transition-colors ${
                  isEyedropperActive
                    ? 'bg-blue-600 text-white'
                    : buttonBgClasses + ' ' + textMutedClasses
                }`}
                title="Pick color from screen"
              >
                <Pipette className="w-3 h-3" />
              </button>
            )}
            {onSaveColor && (
              <button
                onClick={() => onSaveColor(currentColor)}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] transition-colors"
                title="Save color"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Saved Colors Section */}
          {savedColors.length > 0 && (
            <div className="space-y-1">
              <span className={`text-[10px] ${textMutedClasses}`}>Saved Colors</span>
              <div className="flex flex-wrap gap-1">
                {savedColors.map((savedColor, index) => (
                  <div key={`saved-${savedColor}-${index}`} className="group relative">
                    <button
                      onClick={() => {
                        onChange(savedColor)
                        setHexInput(savedColor)
                        setHsl(hexToHSL(savedColor))
                      }}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        currentColor === savedColor ? 'gui-border-active scale-110' : borderClasses
                      }`}
                      style={{ backgroundColor: savedColor }}
                      title={savedColor}
                    />
                    {onRemoveSavedColor && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveSavedColor(savedColor)
                        }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove color"
                      >
                        <X className="w-2 h-2 text-white" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lightness slider */}
          <div className="space-y-1">
            <span className={`text-[10px] ${textMutedClasses}`}>Lightness</span>
            <canvas
              ref={lightnessRef}
              width={150}
              height={16}
              className={`w-full h-4 rounded cursor-ew-resize border ${borderClasses}`}
              onClick={handleLightnessInteraction}
              onMouseDown={(e) => {
                handleLightnessInteraction(e)
                const onMove = (moveE: MouseEvent): void => {
                  handleLightnessInteraction(moveE as unknown as React.MouseEvent<HTMLCanvasElement>)
                }
                const onUp = (): void => {
                  document.removeEventListener('mousemove', onMove)
                  document.removeEventListener('mouseup', onUp)
                }
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
            />
          </div>
        </div>
      </div>

      {/* Complementary Colors Section */}
      <div className={`border-t ${borderClasses} pt-3`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-medium ${textMutedClasses} uppercase`}>Generate Palette</span>
        </div>

        {/* Color scheme selector */}
        <div className="flex gap-1 mb-2">
          {(['complementary', 'analogous', 'split'] as const).map((scheme) => (
            <button
              key={scheme}
              onClick={() => setColorScheme(scheme)}
              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                colorScheme === scheme
                  ? 'gui-bg-accent text-white'
                  : buttonBgClasses + ' ' + textMutedClasses
              }`}
            >
              {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
            </button>
          ))}
        </div>

        {/* Count selector (not for split) */}
        {colorScheme !== 'split' && (
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] ${textMutedClasses}`}>Colors:</span>
            <button
              onClick={() => setComplementaryCount(Math.max(2, complementaryCount - 1))}
              className={`p-1 ${buttonBgClasses} rounded`}
              disabled={complementaryCount <= 2}
            >
              <Minus className={`w-3 h-3 ${textMutedClasses}`} />
            </button>
            <span className={`text-sm ${textClasses} w-4 text-center`}>{complementaryCount}</span>
            <button
              onClick={() => setComplementaryCount(Math.min(10, complementaryCount + 1))}
              className={`p-1 ${buttonBgClasses} rounded`}
              disabled={complementaryCount >= 10}
            >
              <Plus className={`w-3 h-3 ${textMutedClasses}`} />
            </button>
            <button
              onClick={handleGenerateColors}
              className="ml-auto px-2 py-1 gui-bg-accent text-white rounded text-[10px] transition-colors flex items-center gap-1"
            >
              <Palette className="w-3 h-3" />
              Generate
            </button>
          </div>
        )}

        {colorScheme === 'split' && (
          <button
            onClick={handleGenerateColors}
            className="w-full mb-2 px-2 py-1 gui-bg-accent text-white rounded text-[10px] transition-colors flex items-center justify-center gap-1"
          >
            <Palette className="w-3 h-3" />
            Generate Split-Complementary
          </button>
        )}

        {/* Generated colors display */}
        {generatedColors.length > 0 && (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              {generatedColors.map((genColor, index) => (
                <div key={`${genColor}-${index}`} className="group relative">
                  <button
                    onClick={() => {
                      onChange(genColor)
                      setHexInput(genColor)
                      setHsl(hexToHSL(genColor))
                    }}
                    className={`w-7 h-7 rounded border-2 transition-all ${
                      currentColor === genColor ? 'gui-border-active' : borderClasses
                    }`}
                    style={{ backgroundColor: genColor }}
                    title={`Click to use: ${genColor}`}
                  />
                  {/* Copy button - top right */}
                  <button
                    onClick={() => handleCopyColor(genColor, index)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--surface-panel)] hover:bg-[var(--surface-panel-secondary)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy color"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-2 h-2 text-green-400" />
                    ) : (
                      <Copy className="w-2 h-2 text-[var(--text-secondary)]" />
                    )}
                  </button>
                  {/* Save button - bottom right */}
                  {onSaveColor && (
                    <button
                      onClick={() => onSaveColor(genColor)}
                      className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Save to custom colors"
                    >
                      <Save className="w-2 h-2 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {onSaveColor && (
              <button
                onClick={() => generatedColors.forEach(c => onSaveColor?.(c))}
                className={`text-[10px] ${textMutedClasses} hover:${textClasses} transition-colors`}
              >
                Save all to custom colors
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI Generation Section */}
      {showAIGeneration && (
        <div className={`border-t ${borderClasses} pt-3`}>
          <div className="flex items-center gap-1.5 mb-2">
            <Wand2 className="w-3 h-3" style={{ color: 'var(--gui-accent-primary)' }} />
            <span className={`text-xs font-medium ${textMutedClasses} uppercase`}>AI Palette</span>
            {!aiGenerationEnabled && (
              <span className={`text-[9px] ${textMutedClasses} ml-auto`}>(Disabled)</span>
            )}
          </div>

          {aiGenerationEnabled ? (
            <div className="space-y-2">
              <input
                type="text"
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder="e.g., warm sunset, ocean breeze, forest..."
                className={`w-full ${inputBgClasses} border ${borderClasses} rounded px-2 py-1.5 text-[10px] ${textClasses} focus:outline-none focus:gui-border-active`}
              />
              <button
                onClick={() => onGeneratePalette?.([], aiInstruction)}
                className="w-full px-2 py-1.5 gui-bg-accent text-white rounded text-[10px] transition-colors flex items-center justify-center gap-1"
              >
                <Wand2 className="w-3 h-3" />
                Generate with AI
              </button>
            </div>
          ) : (
            <p className={`text-[10px] ${textMutedClasses}`}>
              Enable AI generation in settings to create palettes from text descriptions.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export const ColorPicker = memo(ColorPickerComponent)
