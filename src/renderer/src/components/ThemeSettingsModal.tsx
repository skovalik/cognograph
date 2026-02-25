import { memo, useState, useCallback, useRef } from 'react'
import { X, Palette, RotateCcw, MessageSquare, Folder, FileText, CheckSquare, Code, Boxes, Layout, Sun, Moon, Layers, Sparkles, Plus, Save, Download, Upload, Wand2, ChevronDown, ChevronRight, RefreshCw, Check, Monitor, Link, Type, Pencil, Workflow } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { DEFAULT_THEME_SETTINGS, LIGHT_MODE_PRESETS, DEFAULT_LINK_COLORS_DARK, DEFAULT_LINK_COLORS_LIGHT, DEFAULT_AMBIENT_EFFECT } from '@shared/types'
import { DEFAULT_GUI_DARK, DEFAULT_GUI_LIGHT } from '../constants/themePresets'
import type { NodeData, ThemeMode, CustomThemePreset, ThemeSettings, EdgeStyle, GuiColors, AmbientEffectType, AmbientEffectSettings as AmbientEffectSettingsType } from '@shared/types'
import { EFFECTS_BY_CATEGORY, EFFECT_REGISTRY } from './ambient/effectRegistry'
import { EffectControlsPanel } from './ambient/EffectControlsPanel'
import { hexToRgbFloat, generatePaletteFromAccents, deriveColor } from './ambient/utils/colorConvert'
import { performThemeTransition, performPresetTransition } from '../utils/themeTransition'
import { CollapsibleSection } from './CollapsibleSection'
import { ThemePresetSelector } from './ThemePresetSelector'
import { ColorPicker } from './ColorPicker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet'

// Types for AI theme generation preview
interface PreviewState {
  isActive: boolean
  originalTheme: ThemeSettings | null
  generatedTheme: Partial<ThemeSettings> | null
  description: string
  isGenerating: boolean
}

interface ThemeSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Colors organized by hue - warm to cool spectrum
const COLOR_PALETTE = {
  warm: [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#facc15', // yellow
  ],
  green: [
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#14b8a6', // teal
  ],
  cool: [
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
    '#6366f1', // indigo
  ],
  purple: [
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
  ],
  neutral: [
    '#64748b', // slate
    '#71717a', // zinc
    '#78716c', // stone
    '#737373', // neutral
  ]
}

// Flatten for easy access
const ALL_COLORS = Object.values(COLOR_PALETTE).flat()

// Secondary palette for backgrounds and text - neutral/grayscale colors
const BACKGROUND_PALETTE = {
  dark: [
    '#000000', // black
    '#0a0a0a', // near black
    '#111827', // gray-900
    '#1f2937', // gray-800
    '#0f172a', // slate-900
    '#1e293b', // slate-800
    '#18181b', // zinc-900
    '#27272a', // zinc-800
  ],
  light: [
    '#ffffff', // white
    '#fafafa', // zinc-50
    '#f9fafb', // gray-50
    '#f3f4f6', // gray-100
    '#f8fafc', // slate-50
    '#f1f5f9', // slate-100
    '#fafaf9', // stone-50
    '#f5f5f4', // stone-100
  ]
}

const TEXT_PALETTE = {
  dark: [
    '#ffffff', // white
    '#f9fafb', // gray-50
    '#f3f4f6', // gray-100
    '#e5e7eb', // gray-200
    '#d1d5db', // gray-300
    '#9ca3af', // gray-400
    '#6b7280', // gray-500
    '#4b5563', // gray-600
  ],
  light: [
    '#030712', // gray-950
    '#111827', // gray-900
    '#1f2937', // gray-800
    '#374151', // gray-700
    '#4b5563', // gray-600
    '#6b7280', // gray-500
    '#9ca3af', // gray-400
    '#d1d5db', // gray-300
  ]
}

// Canvas background presets - dark themes
const DARK_CANVAS_PRESETS = [
  { color: '#1a1a2e', label: 'Navy' },
  { color: '#0f0f23', label: 'Black' },
  { color: '#1e1e1e', label: 'VS Code' },
  { color: '#282c34', label: 'One Dark' },
  { color: '#2d2a2e', label: 'Monokai' },
  { color: '#1a1b26', label: 'Tokyo' },
  { color: '#0d1117', label: 'GitHub' },
  { color: '#1f2937', label: 'Gray' }
]

// Dark grid color presets - neutral grays for better visibility
const DARK_GRID_PRESETS = [
  { color: '#1e1e2e', label: 'Default' },
  { color: '#2a2a3a', label: 'Light' },
  { color: '#1a1a28', label: 'Dark' },
  { color: '#27272a', label: 'Zinc' },
  { color: '#transparent', label: 'None' }
]

// Default colors for each node type
const DEFAULT_NODE_COLORS: Record<NodeData['type'], string> = DEFAULT_THEME_SETTINGS.nodeColors

// Node type configuration
const NODE_TYPES: { type: NodeData['type']; label: string; icon: JSX.Element }[] = [
  { type: 'conversation', label: 'Conversation', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { type: 'project', label: 'Project', icon: <Folder className="w-3.5 h-3.5" /> },
  { type: 'note', label: 'Note', icon: <FileText className="w-3.5 h-3.5" /> },
  { type: 'task', label: 'Task', icon: <CheckSquare className="w-3.5 h-3.5" /> },
  { type: 'artifact', label: 'Artifact', icon: <Code className="w-3.5 h-3.5" /> },
  { type: 'workspace', label: 'Workspace', icon: <Boxes className="w-3.5 h-3.5" /> },
  { type: 'text', label: 'Text', icon: <Type className="w-3.5 h-3.5" /> },
  { type: 'orchestrator', label: 'Orchestrator', icon: <Workflow className="w-3.5 h-3.5" /> }
]

// Edge style options (industry standard: 4 core types)
const EDGE_STYLE_OPTIONS: { value: EdgeStyle; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'smooth', label: 'Smooth' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'rounded', label: 'Rounded' }
]


/**
 * Ambient Effect Settings Sub-component — registry-driven
 */
interface AmbientEffectSettingsProps {
  settings: AmbientEffectSettingsType
  onChange: (settings: AmbientEffectSettingsType) => void
  textMuted: string
  textSecondary: string
  buttonBg: string
  accentColor?: string
  accentSecondary?: string
  isDark?: boolean
}

function AmbientEffectSettingsComponent({
  settings,
  onChange,
  textMuted,
  textSecondary,
  buttonBg,
  accentColor,
  accentSecondary,
  isDark = true,
}: AmbientEffectSettingsProps): JSX.Element {
  const updateSetting = <K extends keyof AmbientEffectSettingsType>(
    key: K,
    value: AmbientEffectSettingsType[K]
  ) => {
    onChange({ ...settings, [key]: value })
  }

  const isEffectSelected = settings.effect !== 'none'

  // Compute theme-resolved values for display in the controls panel
  const resolvedValues = (() => {
    const entry = EFFECT_REGISTRY[settings.effect]
    if (!entry) return undefined
    const baseColor = (accentColor && accentColor.startsWith('#') && accentColor.length >= 4) ? accentColor : '#8b5cf6'
    const resolved: Record<string, unknown> = {}
    for (const propKey of entry.themeColorProps) {
      const schema = entry.propSchema.find((s) => s.key === propKey)
      if (!schema) continue
      if (schema.controlType === 'color-array') {
        const currentDefault = entry.defaultProps[propKey]
        const count = Array.isArray(currentDefault) ? currentDefault.length : 3
        if (schema.colorFormat === 'hex') {
          resolved[propKey] = generatePaletteFromAccents(baseColor, accentSecondary, count)
        } else {
          resolved[propKey] = generatePaletteFromAccents(baseColor, accentSecondary, count).map(h => hexToRgbFloat(h))
        }
      } else if (schema.colorFormat === 'rgb-float') {
        resolved[propKey] = hexToRgbFloat(baseColor)
      } else {
        resolved[propKey] = baseColor
      }
    }
    // Derive colors from other resolved props (e.g., DotGrid baseColor from activeColor)
    for (const schema of entry.propSchema) {
      if (!schema.deriveFrom) continue
      const sourceValue = resolved[schema.deriveFrom.sourceKey]
      if (typeof sourceValue === 'string' && sourceValue.startsWith('#')) {
        resolved[schema.key] = deriveColor(sourceValue, schema.deriveFrom, isDark)
      }
    }
    return resolved
  })()

  return (
    <div className="space-y-3">
      <div className={`text-xs font-medium ${textSecondary} uppercase`}>Canvas Effects</div>

      {/* Off Button */}
      <button
        onClick={() => onChange({ ...settings, effect: 'none', enabled: false })}
        className={`px-3 py-1 rounded text-[10px] transition-all ${
          !isEffectSelected
            ? 'gui-bg-accent text-white'
            : `${buttonBg} ${textSecondary}`
        }`}
        aria-pressed={!isEffectSelected}
      >
        Off
      </button>

      {/* Effect Card Grid — grouped by category from registry */}
      <div className="space-y-2">
        {EFFECTS_BY_CATEGORY.map(({ category, effects }) => (
          <div key={category}>
            <h4 className={`text-[9px] ${textMuted} uppercase tracking-wider mb-1`}>
              {category}
            </h4>
            <div className="grid grid-cols-3 gap-1">
              {effects.map((entry) => {
                const isSelected = settings.effect === entry.id
                return (
                  <button
                    key={entry.id}
                    onClick={() => onChange({ ...settings, effect: entry.id, enabled: true })}
                    className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded transition-all text-center ${
                      isSelected
                        ? 'gui-bg-accent text-white ring-1 ring-[var(--gui-accent-primary)] shadow-[0_0_8px_rgba(var(--gui-accent-primary-rgb,100,100,255),0.3)]'
                        : `${buttonBg} ${textSecondary} hover:brightness-110`
                    }`}
                    aria-pressed={isSelected}
                    title={`Enable ${entry.name} effect`}
                  >
                    <span className="text-[11px] font-mono leading-none opacity-70">{entry.icon}</span>
                    <span className="text-[9px] leading-none">{entry.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Fine-Tuning (only shown when an effect is selected) */}
      {isEffectSelected && (
        <div className="space-y-2 pl-1">
          {/* Bloom Slider */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] ${textMuted} w-14`}>Bloom</span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.bloomIntensity ?? 30}
              onChange={(e) => updateSetting('bloomIntensity', parseInt(e.target.value))}
              className="flex-1 h-1 accent-[var(--gui-accent-primary)]"
            />
            <span className={`text-[10px] ${textMuted} w-8 text-right`}>{settings.bloomIntensity ?? 30}%</span>
          </div>

          {/* Per-Effect Controls — driven by registry propSchema */}
          <EffectControlsPanel
            effectType={settings.effect}
            settings={settings}
            onChange={onChange}
            textMuted={textMuted}
            resolvedValues={resolvedValues}
          />
        </div>
      )}
    </div>
  )
}

const AmbientEffectSettings = memo(AmbientEffectSettingsComponent)

function ThemeSettingsModalComponent({ open, onOpenChange }: ThemeSettingsModalProps): JSX.Element {
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const setThemeColor = useWorkspaceStore((state) => state.setThemeColor)
  const setCanvasBackground = useWorkspaceStore((state) => state.setCanvasBackground)
  const setCanvasGridColor = useWorkspaceStore((state) => state.setCanvasGridColor)
  const resetThemeColors = useWorkspaceStore((state) => state.resetThemeColors)
  const addCustomColor = useWorkspaceStore((state) => state.addCustomColor)
  const removeCustomColor = useWorkspaceStore((state) => state.removeCustomColor)
  const saveCustomPreset = useWorkspaceStore((state) => state.saveCustomPreset)
  const deleteCustomPreset = useWorkspaceStore((state) => state.deleteCustomPreset)
  const applyCustomPreset = useWorkspaceStore((state) => state.applyCustomPreset)
  const setAIPaletteEnabled = useWorkspaceStore((state) => state.setAIPaletteEnabled)
  const setEdgeStyle = useWorkspaceStore((state) => state.setEdgeStyle)
  const setGuiColors = useWorkspaceStore((state) => state.setGuiColors)
  const setLinkColors = useWorkspaceStore((state) => state.setLinkColors)
  const setLinkGradientEnabled = useWorkspaceStore((state) => state.setLinkGradientEnabled)
  const updateThemeSettings = useWorkspaceStore((state) => state.updateThemeSettings)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [expandedType, setExpandedType] = useState<NodeData['type'] | null>(null)
  const [customInput, setCustomInput] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorPickerNodeType, setColorPickerNodeType] = useState<NodeData['type'] | null>(null)
  // Generic color picker state (for saved colors, canvas bg, grid)
  const [showGenericColorPicker, setShowGenericColorPicker] = useState(false)
  const [genericColorPickerTarget, setGenericColorPickerTarget] = useState<'savedColors' | 'canvasBg' | 'canvasGrid' | null>(null)
  const [genericColorPickerValue, setGenericColorPickerValue] = useState('#000000')
  const [newPresetName, setNewPresetName] = useState('')
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [editingPresetName, setEditingPresetName] = useState('')

  // AI Theme Generation Preview State
  const [aiPreview, setAiPreview] = useState<PreviewState>({
    isActive: false,
    originalTheme: null,
    generatedTheme: null,
    description: '',
    isGenerating: false
  })
  const [showAiGenerateModal, setShowAiGenerateModal] = useState(false)
  const [aiThemeDescription, setAiThemeDescription] = useState('')

  // GUI Colors state
  const [showGuiColorPicker, setShowGuiColorPicker] = useState(false)
  const [guiColorTarget, setGuiColorTarget] = useState<string | null>(null)
  const [guiColorValue, setGuiColorValue] = useState('#000000')
  const [expandedGuiSection, setExpandedGuiSection] = useState<string | null>(null)

  // Link Colors state
  const [expandedLinkSection, setExpandedLinkSection] = useState<string | null>(null)
  const [showLinkColorPicker, setShowLinkColorPicker] = useState(false)
  const [linkColorTarget, setLinkColorTarget] = useState<string | null>(null)
  const [linkColorValue, setLinkColorValue] = useState('#000000')

  // Get custom colors from theme settings
  const customColors = themeSettings.customColors || []

  const isLightMode = themeSettings.mode === 'light'

  // Advanced section expand state with localStorage persistence
  const [advancedExpanded, setAdvancedExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('theme-panel-advanced-expanded')
      return saved === 'true'
    } catch {
      return false
    }
  })

  // Get appropriate presets based on mode
  const canvasPresets = isLightMode ? LIGHT_MODE_PRESETS.canvasBackgrounds : DARK_CANVAS_PRESETS
  const gridPresets = isLightMode ? LIGHT_MODE_PRESETS.canvasGridColors : DARK_GRID_PRESETS

  const handleModeToggle = (mode: ThemeMode, event: React.MouseEvent): void => {
    performThemeTransition(mode, event)
  }

  const handleColorSelect = (nodeType: NodeData['type'], color: string): void => {
    setThemeColor(nodeType, color)
  }

  const handleCustomColor = (nodeType: NodeData['type']): void => {
    if (customInput && /^#[0-9A-Fa-f]{6}$/.test(customInput)) {
      setThemeColor(nodeType, customInput)
      setCustomInput('')
      setExpandedType(null)
    }
  }


  const handleResetToDefault = (nodeType: NodeData['type']): void => {
    setThemeColor(nodeType, DEFAULT_NODE_COLORS[nodeType])
  }

  // Open generic color picker for different purposes
  const handleOpenGenericColorPicker = useCallback((target: 'savedColors' | 'canvasBg' | 'canvasGrid'): void => {
    setGenericColorPickerTarget(target)
    if (target === 'canvasBg') {
      setGenericColorPickerValue(themeSettings.canvasBackground)
    } else if (target === 'canvasGrid') {
      setGenericColorPickerValue(themeSettings.canvasGridColor === '#transparent' ? '#252542' : themeSettings.canvasGridColor)
    } else {
      setGenericColorPickerValue('#6366f1')
    }
    setShowGenericColorPicker(true)
  }, [themeSettings.canvasBackground, themeSettings.canvasGridColor])

  const handleGenericColorPickerChange = useCallback((color: string): void => {
    setGenericColorPickerValue(color)
    // Apply immediately for preview
    if (genericColorPickerTarget === 'canvasBg') {
      setCanvasBackground(color)
    } else if (genericColorPickerTarget === 'canvasGrid') {
      setCanvasGridColor(color)
    }
  }, [genericColorPickerTarget, setCanvasBackground, setCanvasGridColor])

  const handleGenericColorPickerSave = useCallback((): void => {
    if (genericColorPickerTarget === 'savedColors') {
      addCustomColor(genericColorPickerValue)
    }
    // Canvas bg/grid already applied via onChange
    setShowGenericColorPicker(false)
    setGenericColorPickerTarget(null)
  }, [genericColorPickerTarget, genericColorPickerValue, addCustomColor])

  const handleRemoveCustomColor = (color: string): void => {
    removeCustomColor(color)
  }

  // GUI Colors helpers and handlers
  const currentGuiColors: GuiColors = themeSettings.guiColors ||
    (isLightMode ? DEFAULT_GUI_LIGHT : DEFAULT_GUI_DARK)

  const handleOpenGuiColorPicker = useCallback((target: string): void => {
    setGuiColorTarget(target)
    // Get current value for the target
    if (target.startsWith('toolbarIconAccent.')) {
      const idx = parseInt(target.split('.')[1] ?? '0')
      setGuiColorValue(currentGuiColors.toolbarIconAccent[idx] ?? '#a855f7')
    } else {
      setGuiColorValue(currentGuiColors[target as keyof GuiColors] as string || '#000000')
    }
    setShowGuiColorPicker(true)
  }, [currentGuiColors])

  const handleGuiColorPickerChange = useCallback((color: string): void => {
    setGuiColorValue(color)
  }, [])

  const handleGuiColorPickerSave = useCallback((): void => {
    if (!guiColorTarget) return

    const newColors = { ...currentGuiColors }

    if (guiColorTarget.startsWith('toolbarIconAccent.')) {
      const idx = parseInt(guiColorTarget.split('.')[1] ?? '0')
      const newAccents = [...currentGuiColors.toolbarIconAccent]
      newAccents[idx] = guiColorValue
      newColors.toolbarIconAccent = newAccents
    } else {
      (newColors as Record<string, string | string[]>)[guiColorTarget] = guiColorValue
    }

    setGuiColors(newColors as GuiColors)
    setShowGuiColorPicker(false)
    setGuiColorTarget(null)
  }, [guiColorTarget, guiColorValue, currentGuiColors, setGuiColors])

  const handleResetGuiColors = useCallback((): void => {
    const defaults = isLightMode ? DEFAULT_GUI_LIGHT : DEFAULT_GUI_DARK
    setGuiColors(defaults)
    toast.success('GUI colors reset to defaults')
  }, [isLightMode, setGuiColors])

  // Quick set GUI color (for palette swatches - applies immediately without modal)
  const handleQuickSetGuiColor = useCallback((target: string, color: string): void => {
    const newColors = { ...currentGuiColors }

    if (target.startsWith('toolbarIconAccent.')) {
      const idx = parseInt(target.split('.')[1] ?? '0')
      const newAccents = [...currentGuiColors.toolbarIconAccent]
      newAccents[idx] = color
      newColors.toolbarIconAccent = newAccents
    } else {
      (newColors as Record<string, string | string[]>)[target] = color
    }

    setGuiColors(newColors as GuiColors)
  }, [currentGuiColors, setGuiColors])

  // Custom preset handlers (handleSavePreset reserved for future "Save as preset" button)
  const handleSavePreset = useCallback((): void => {
    const name = newPresetName.trim() || `Custom ${(themeSettings.customPresets?.length || 0) + 1}`
    const id = saveCustomPreset(name)
    if (id) {
      toast.success(`Preset "${name}" saved`)
      setNewPresetName('')
    } else {
      toast.error('Maximum 4 custom presets. Delete one to add a new one.')
    }
  }, [newPresetName, saveCustomPreset, themeSettings.customPresets?.length])
  void handleSavePreset // Reserved for future use

  const handleDeletePreset = useCallback((preset: CustomThemePreset): void => {
    deleteCustomPreset(preset.id)
    toast.success(`Preset "${preset.name}" deleted`)
  }, [deleteCustomPreset])

  const handleStartEditPreset = useCallback((preset: CustomThemePreset): void => {
    setEditingPresetId(preset.id)
    setEditingPresetName(preset.name)
  }, [])

  const handleSavePresetEdit = useCallback((): void => {
    if (editingPresetId && editingPresetName.trim()) {
      // Update the preset name in the store
      const state = useWorkspaceStore.getState()
      const preset = state.themeSettings.customPresets?.find(p => p.id === editingPresetId)
      if (preset) {
        preset.name = editingPresetName.trim()
        toast.success('Preset renamed')
      }
    }
    setEditingPresetId(null)
    setEditingPresetName('')
  }, [editingPresetId, editingPresetName])

  const handleExportPresets = useCallback((): void => {
    const presets = themeSettings.customPresets || []
    if (presets.length === 0) {
      toast.error('No custom presets to export')
      return
    }

    const data = JSON.stringify(presets, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cognograph-theme-presets.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Presets exported')
  }, [themeSettings.customPresets])

  const handleImportPresets = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event): void => {
      try {
        const imported = JSON.parse(event.target?.result as string)
        if (!Array.isArray(imported)) {
          throw new Error('Invalid format')
        }

        // Validate and import presets
        let importCount = 0
        const currentPresets = themeSettings.customPresets || []
        const availableSlots = 4 - currentPresets.length

        for (const preset of imported) {
          if (importCount >= availableSlots) break
          if (preset.id && preset.name && preset.nodeColors && preset.canvasBackground) {
            // Re-generate ID to avoid conflicts
            const presetName = preset.name
            const presetId = saveCustomPreset(presetName)
            if (presetId) {
              // Update the preset with imported colors
              const state = useWorkspaceStore.getState()
              const newPreset = state.themeSettings.customPresets?.find(p => p.id === presetId)
              if (newPreset) {
                newPreset.nodeColors = preset.nodeColors
                newPreset.canvasBackground = preset.canvasBackground
                newPreset.canvasGridColor = preset.canvasGridColor
              }
              importCount++
            }
          }
        }

        if (importCount > 0) {
          toast.success(`Imported ${importCount} preset(s)`)
        } else {
          toast.error('No valid presets found or no slots available')
        }
      } catch {
        toast.error('Failed to import presets: Invalid file format')
      }
    }
    reader.readAsText(file)
    // Reset file input
    e.target.value = ''
  }, [saveCustomPreset, themeSettings.customPresets])

  // AI Theme Generation handlers
  const hasEmptyPresetSlot = (themeSettings.customPresets?.length || 0) < 8
  const showSecondRow = (themeSettings.customPresets?.length || 0) >= 4

  const handleOpenAiGenerateModal = useCallback((): void => {
    if (!hasEmptyPresetSlot) {
      toast.error('Delete a preset to make room for AI-generated theme')
      return
    }
    setAiThemeDescription('')
    setShowAiGenerateModal(true)
  }, [hasEmptyPresetSlot])

  const handleGenerateAiTheme = useCallback(async (description: string): Promise<void> => {
    if (!window.api?.llm?.extract) {
      toast.error('AI generation not available')
      return
    }

    // Save original theme for potential revert
    const originalTheme = { ...themeSettings }

    setAiPreview({
      isActive: false,
      originalTheme,
      generatedTheme: null,
      description,
      isGenerating: true
    })
    setShowAiGenerateModal(false)

    try {
      // Build comprehensive prompt with few-shot examples for high-quality theme generation
      const systemPrompt = `You are an expert UI color theme designer for Cognograph, a spatial canvas application where users arrange AI conversations, notes, tasks, and projects as nodes on an infinite dark canvas.

## Node Types & Color Psychology
Each node type has semantic meaning. Colors should reflect their purpose:
- **Conversation** (AI chat): Communication, intelligence → blues, teals
- **Project** (containers): Organization, hierarchy → purples, violets
- **Note** (markdown): Ideas, knowledge → greens, yellows, limes
- **Task** (todos): Action, urgency → ambers, oranges, warm tones
- **Artifact** (code/files): Technical, precise → cyans, teals, cool blues
- **Workspace** (links): Connection, portals → pinks, magentas, roses

## Critical Design Principles
1. **Saturation matters**: Use vibrant, saturated colors (60-80% saturation) that pop against both dark and light backgrounds
2. **Value contrast**: Colors need enough lightness (50-70%) to be visible on dark backgrounds while not being washed out on light
3. **Color harmony**: Pick colors that relate to the theme while maintaining visual distinction between node types
4. **Canvas backgrounds**: Dark mode should feel immersive (deep, rich darks). Light mode should be TINTED, never pure white - use creams, pastels, or subtle colored backgrounds that complement the theme

## Example Themes (study these for quality reference)

**"Ocean"**:
{"nodeColors":{"conversation":"#0ea5e9","project":"#6366f1","note":"#22d3ee","task":"#f59e0b","artifact":"#06b6d4","workspace":"#ec4899"},"canvasBackgroundDark":"#0c1929","canvasGridColorDark":"#1e3a5f","canvasBackgroundLight":"#f0f9ff","canvasGridColorLight":"#bae6fd","guiColorsDark":{"panelBackground":"#0c1929","panelBackgroundSecondary":"#142d42","textPrimary":"#e0f2fe","textSecondary":"#7dd3fc","accentPrimary":"#0ea5e9","accentSecondary":"#14b8a6","toolbarIconDefault":"#7dd3fc","toolbarIconAccent":["#0ea5e9","#22d3ee","#38bdf8","#14b8a6"]},"guiColorsLight":{"panelBackground":"#ffffff","panelBackgroundSecondary":"#f0f9ff","textPrimary":"#0c4a6e","textSecondary":"#0369a1","accentPrimary":"#0284c7","accentSecondary":"#0f766e","toolbarIconDefault":"#4b5563","toolbarIconAccent":["#0284c7","#0891b2","#0369a1","#0f766e"]},"linkColorsDark":{"default":"#475569","active":"#0ea5e9","inactive":"#1e3a5f","selected":"#7dd3fc"},"linkColorsLight":{"default":"#94a3b8","active":"#0284c7","inactive":"#cbd5e1","selected":"#0ea5e9"}}

**"Forest"**:
{"nodeColors":{"conversation":"#10b981","project":"#8b5cf6","note":"#84cc16","task":"#f97316","artifact":"#14b8a6","workspace":"#f472b6"},"canvasBackgroundDark":"#0f1f17","canvasGridColorDark":"#1a3328","canvasBackgroundLight":"#f0fdf4","canvasGridColorLight":"#bbf7d0","guiColorsDark":{"panelBackground":"#14201a","panelBackgroundSecondary":"#1e3028","textPrimary":"#dcfce7","textSecondary":"#86efac","accentPrimary":"#22c55e","accentSecondary":"#2dd4bf","toolbarIconDefault":"#86efac","toolbarIconAccent":["#22c55e","#a3e635","#4ade80","#2dd4bf"]},"guiColorsLight":{"panelBackground":"#ffffff","panelBackgroundSecondary":"#f0fdf4","textPrimary":"#14532d","textSecondary":"#166534","accentPrimary":"#16a34a","accentSecondary":"#0d9488","toolbarIconDefault":"#4b5563","toolbarIconAccent":["#16a34a","#65a30d","#15803d","#0d9488"]},"linkColorsDark":{"default":"#4b5563","active":"#22c55e","inactive":"#1a3328","selected":"#86efac"},"linkColorsLight":{"default":"#9ca3af","active":"#16a34a","inactive":"#d1d5db","selected":"#22c55e"}}

**"Sunset"**:
{"nodeColors":{"conversation":"#f472b6","project":"#a855f7","note":"#fbbf24","task":"#ef4444","artifact":"#06b6d4","workspace":"#ec4899"},"canvasBackgroundDark":"#1f1315","canvasGridColorDark":"#3d2027","canvasBackgroundLight":"#fef7f0","canvasGridColorLight":"#fecaca","guiColorsDark":{"panelBackground":"#1a1410","panelBackgroundSecondary":"#2a211a","textPrimary":"#fef3c7","textSecondary":"#fcd34d","accentPrimary":"#f97316","accentSecondary":"#dc2626","toolbarIconDefault":"#fcd34d","toolbarIconAccent":["#f97316","#fbbf24","#fb923c","#f472b6"]},"guiColorsLight":{"panelBackground":"#ffffff","panelBackgroundSecondary":"#fffbeb","textPrimary":"#78350f","textSecondary":"#92400e","accentPrimary":"#c2410c","accentSecondary":"#b91c1c","toolbarIconDefault":"#6b7280","toolbarIconAccent":["#c2410c","#b45309","#c2410c","#be185d"]},"linkColorsDark":{"default":"#57534e","active":"#f97316","inactive":"#3d2027","selected":"#fcd34d"},"linkColorsLight":{"default":"#a8a29e","active":"#c2410c","inactive":"#d6d3d1","selected":"#f97316"}}

**"Cyberpunk"**:
{"nodeColors":{"conversation":"#06b6d4","project":"#a855f7","note":"#22c55e","task":"#f43f5e","artifact":"#3b82f6","workspace":"#f472b6"},"canvasBackgroundDark":"#0a0a1a","canvasGridColorDark":"#1a1a3a","canvasBackgroundLight":"#f5f3ff","canvasGridColorLight":"#ddd6fe","guiColorsDark":{"panelBackground":"#0f0f23","panelBackgroundSecondary":"#1a1a3e","textPrimary":"#e0e7ff","textSecondary":"#a5b4fc","accentPrimary":"#818cf8","accentSecondary":"#06b6d4","toolbarIconDefault":"#a5b4fc","toolbarIconAccent":["#a855f7","#06b6d4","#22c55e","#f43f5e"]},"guiColorsLight":{"panelBackground":"#ffffff","panelBackgroundSecondary":"#f5f3ff","textPrimary":"#312e81","textSecondary":"#4338ca","accentPrimary":"#7c3aed","accentSecondary":"#0891b2","toolbarIconDefault":"#6b7280","toolbarIconAccent":["#7c3aed","#0891b2","#16a34a","#dc2626"]},"linkColorsDark":{"default":"#4b5563","active":"#818cf8","inactive":"#1a1a3a","selected":"#a5b4fc"},"linkColorsLight":{"default":"#9ca3af","active":"#7c3aed","inactive":"#d1d5db","selected":"#818cf8"}}

## GUI Colors Guidelines
The guiColors object styles the application UI (panels, buttons, icons):
- **panelBackground**: Modal/sidebar background matching canvas feel
- **panelBackgroundSecondary**: Slightly lighter/different for nested sections
- **textPrimary**: Main text, high contrast (4.5:1 minimum)
- **textSecondary**: Muted text, still readable
- **accentPrimary**: Primary action buttons (should match theme mood)
- **accentSecondary**: Secondary actions (complementary color)
- **toolbarIconDefault**: Default toolbar icon color
- **toolbarIconAccent**: Array of 4 accent colors for special toolbar icons

## Link Colors Guidelines
The linkColors object styles the connections between nodes:
- **default**: Color for regular connections (muted, unobtrusive)
- **active**: Color for active/enabled connections (matches theme accent)
- **inactive**: Color for disabled connections (very muted)
- **selected**: Color for selected connections (accent or highlight color)

## Your Task
Generate a theme that:
1. Captures the MOOD and FEELING of the user's description
2. Uses colors that are harmonious but distinct enough to differentiate node types
3. Has dark mode canvas that feels immersive and rich (not just black)
4. Has light mode canvas with a TINTED background that matches the theme mood (never pure white)
5. Ensures all colors are vibrant enough to be clearly visible
6. Includes matching guiColors for both dark and light modes that complement the theme

Respond with ONLY valid JSON, no explanation.`

      const userPrompt = `Create a color theme for: "${description}"

Output ONLY the JSON object with nodeColors, canvas colors, guiColors, and linkColors for both dark and light modes.`

      const result = await window.api.llm.extract({
        systemPrompt,
        userPrompt,
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1200 // Increased for guiColors
      })

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to generate theme')
      }

      // Parse the JSON response
      let generatedTheme: Partial<ThemeSettings>
      try {
        // Extract JSON from the response (handle potential markdown code blocks)
        let jsonStr = result.data
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonStr = jsonMatch[0]
        }
        generatedTheme = JSON.parse(jsonStr)
      } catch {
        throw new Error('Failed to parse AI response as valid theme')
      }

      // Validate the response has required fields (now expects per-mode canvas colors)
      if (!generatedTheme.nodeColors || !generatedTheme.canvasBackgroundDark || !generatedTheme.canvasBackgroundLight) {
        throw new Error('AI response missing required theme fields')
      }

      // Save directly to first empty user slot for visual preview
      const presetName = description.slice(0, 20) || 'AI Theme'

      // Check if there's room for a new preset
      const currentPresets = themeSettings.customPresets || []
      if (currentPresets.length >= 4) {
        throw new Error('Delete a preset to make room for AI-generated theme')
      }

      // Apply the generated colors to current theme
      if (generatedTheme.nodeColors) {
        Object.entries(generatedTheme.nodeColors).forEach(([nodeType, color]) => {
          setThemeColor(nodeType as NodeData['type'], color as string)
        })
      }

      // Apply the appropriate canvas colors and GUI colors based on current mode
      const currentMode = themeSettings.mode
      if (currentMode === 'dark') {
        setCanvasBackground(generatedTheme.canvasBackgroundDark as string)
        setCanvasGridColor(generatedTheme.canvasGridColorDark as string || '#2e2e52')
        // Apply dark GUI colors if generated
        if ((generatedTheme as Record<string, unknown>).guiColorsDark) {
          setGuiColors((generatedTheme as Record<string, unknown>).guiColorsDark as GuiColors)
        }
        // Apply dark link colors if generated
        if ((generatedTheme as Record<string, unknown>).linkColorsDark) {
          setLinkColors((generatedTheme as Record<string, unknown>).linkColorsDark as { default: string; active: string; inactive: string; selected: string })
        }
      } else {
        setCanvasBackground(generatedTheme.canvasBackgroundLight as string)
        setCanvasGridColor(generatedTheme.canvasGridColorLight as string || '#e2e8f0')
        // Apply light GUI colors if generated
        if ((generatedTheme as Record<string, unknown>).guiColorsLight) {
          setGuiColors((generatedTheme as Record<string, unknown>).guiColorsLight as GuiColors)
        }
        // Apply light link colors if generated
        if ((generatedTheme as Record<string, unknown>).linkColorsLight) {
          setLinkColors((generatedTheme as Record<string, unknown>).linkColorsLight as { default: string; active: string; inactive: string; selected: string })
        }
      }

      // Store the per-mode colors in the store directly
      const state = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        ...state,
        themeSettings: {
          ...state.themeSettings,
          canvasBackgroundDark: generatedTheme.canvasBackgroundDark as string,
          canvasGridColorDark: generatedTheme.canvasGridColorDark as string || '#2e2e52',
          canvasBackgroundLight: generatedTheme.canvasBackgroundLight as string,
          canvasGridColorLight: generatedTheme.canvasGridColorLight as string || '#e2e8f0',
          // Also store per-mode GUI colors
          guiColorsDark: (generatedTheme as Record<string, unknown>).guiColorsDark as GuiColors | undefined,
          guiColorsLight: (generatedTheme as Record<string, unknown>).guiColorsLight as GuiColors | undefined,
          // Store per-mode link colors
          linkColorsDark: (generatedTheme as Record<string, unknown>).linkColorsDark as { default: string; active: string; inactive: string; selected: string } | undefined,
          linkColorsLight: (generatedTheme as Record<string, unknown>).linkColorsLight as { default: string; active: string; inactive: string; selected: string } | undefined
        }
      })

      // Now save to user slot (saveCustomPreset reads from current theme settings)
      const presetId = saveCustomPreset(presetName)
      if (!presetId) {
        throw new Error('Failed to save AI theme to preset slot')
      }

      // Update preview state to show overlay
      setAiPreview({
        isActive: true,
        originalTheme,
        generatedTheme: { ...generatedTheme, presetId } as Partial<ThemeSettings>, // Include presetId for reference
        description,
        isGenerating: false
      })

      toast.success(`Theme "${presetName}" saved to user slot!`)
    } catch (error) {
      console.error('[ThemeSettings] AI generation error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate theme')
      setAiPreview({
        isActive: false,
        originalTheme: null,
        generatedTheme: null,
        description: '',
        isGenerating: false
      })
    }
  }, [themeSettings, setThemeColor, setCanvasBackground, setCanvasGridColor, saveCustomPreset])

  const handleApproveAiTheme = useCallback((): void => {
    if (!aiPreview.generatedTheme) return

    // Theme is already saved to user slot during generation
    // Just clear preview state and show success message
    toast.success('Theme kept!')

    // Clear preview state
    setAiPreview({
      isActive: false,
      originalTheme: null,
      generatedTheme: null,
      description: '',
      isGenerating: false
    })
  }, [aiPreview])

  const handleRevertAiTheme = useCallback((): void => {
    if (!aiPreview.originalTheme) return

    // Delete the preset that was created during generation
    const presetId = (aiPreview.generatedTheme as { presetId?: string } | null)?.presetId
    if (presetId) {
      deleteCustomPreset(presetId)
    }

    // Restore original theme
    const original = aiPreview.originalTheme
    Object.entries(original.nodeColors).forEach(([nodeType, color]) => {
      setThemeColor(nodeType as NodeData['type'], color)
    })
    setCanvasBackground(original.canvasBackground)
    setCanvasGridColor(original.canvasGridColor)

    // Clear preview state
    setAiPreview({
      isActive: false,
      originalTheme: null,
      generatedTheme: null,
      description: '',
      isGenerating: false
    })
    toast.success('Theme reverted')
  }, [aiPreview.originalTheme, aiPreview.generatedTheme, setThemeColor, setCanvasBackground, setCanvasGridColor, deleteCustomPreset])

  const handleRegenerateAiTheme = useCallback((additionalPrompt?: string): void => {
    const newDescription = additionalPrompt
      ? `${aiPreview.description}. Additional: ${additionalPrompt}`
      : aiPreview.description

    // Delete the old preset first
    const presetId = (aiPreview.generatedTheme as { presetId?: string } | null)?.presetId
    if (presetId) {
      deleteCustomPreset(presetId)
    }

    // Revert to original first
    if (aiPreview.originalTheme) {
      const original = aiPreview.originalTheme
      Object.entries(original.nodeColors).forEach(([nodeType, color]) => {
        setThemeColor(nodeType as NodeData['type'], color)
      })
      setCanvasBackground(original.canvasBackground)
      setCanvasGridColor(original.canvasGridColor)
    }

    // Generate new theme
    handleGenerateAiTheme(newDescription)
  }, [aiPreview, setThemeColor, setCanvasBackground, setCanvasGridColor, handleGenerateAiTheme, deleteCustomPreset])

  const handleOpenColorPicker = useCallback((nodeType: NodeData['type']): void => {
    setColorPickerNodeType(nodeType)
    setShowColorPicker(true)
  }, [])

  const handleColorPickerChange = useCallback((color: string): void => {
    if (colorPickerNodeType) {
      setThemeColor(colorPickerNodeType, color)
    }
  }, [colorPickerNodeType, setThemeColor])

  // Panel styling - using GUI theme CSS classes
  // These class names are used throughout the component
  const panelBg = 'gui-panel'
  const panelBorder = 'gui-border'
  const textPrimary = 'gui-text'
  const textSecondary = 'gui-text-secondary'
  const textMuted = 'gui-text-secondary'
  const dividerColor = 'gui-border'
  const buttonBg = 'gui-button'
  const inputBg = 'gui-input'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[600px] overflow-y-auto" noOverlay>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" style={{ color: 'var(--gui-accent-primary)' }} />
            Theme Settings
          </SheetTitle>
          <SheetDescription>
            Customize colors, effects, and appearance
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="space-y-4">
        {/* Mode Toggle */}
        <div className="space-y-2">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${textSecondary} uppercase`}>
            Mode
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => handleModeToggle('dark', e)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors ${
                !isLightMode
                  ? 'gui-ring-active'
                  : `${buttonBg} ${textSecondary}`
              }`}
              style={!isLightMode ? {
                backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, var(--gui-panel-bg-secondary))',
                color: 'var(--gui-accent-primary)'
              } : undefined}
            >
              <Moon className="w-4 h-4" />
              <span className="text-xs">Dark</span>
            </button>
            <button
              onClick={(e) => handleModeToggle('light', e)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors ${
                isLightMode
                  ? 'gui-ring-active'
                  : `${buttonBg} ${textSecondary}`
              }`}
              style={isLightMode ? {
                backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, var(--gui-panel-bg-secondary))',
                color: 'var(--gui-accent-primary)'
              } : undefined}
            >
              <Sun className="w-4 h-4" />
              <span className="text-xs">Light</span>
            </button>
          </div>
        </div>

        <div className={`border-t ${dividerColor}`} />

        {/* Theme Presets Section */}
        <div className="space-y-2">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${textSecondary} uppercase`}>
            <Sparkles className="w-3 h-3" />
            Theme Presets
          </div>
          <ThemePresetSelector
            onSelect={performPresetTransition}
            currentPresetId={themeSettings.currentPresetId}
            mode={themeSettings.mode}
          />
        </div>

        <div className={`border-t ${dividerColor}`} />

        {/* Custom Presets Section - 8 horizontal boxes (4 per row), second row shows when 4+ exist */}
        <div className="space-y-2">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${textSecondary} uppercase`}>
            <Save className="w-3 h-3" />
            Custom Presets
          </div>

          {/* Row 1: slots 0-3 (always visible) */}
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((slotIndex) => {
              const preset = (themeSettings.customPresets || [])[slotIndex]

              if (preset) {
                // Filled slot
                return (
                  <div key={preset.id} className="group relative">
                    <button
                      onClick={() => applyCustomPreset(preset.id)}
                      className={`w-full p-1 rounded-lg border-2 transition-all ${
                        themeSettings.currentPresetId === preset.id
                          ? 'gui-ring-active'
                          : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                      }`}
                      title={preset.name}
                    >
                      {/* Mini canvas preview - shows current mode's colors */}
                      <div
                        className="w-full h-6 rounded-md mb-1 relative overflow-hidden"
                        style={{
                          background: isLightMode
                            ? (preset.canvasBackgroundLight || preset.canvasBackground)
                            : (preset.canvasBackgroundDark || preset.canvasBackground)
                        }}
                      >
                        {/* Grid dots preview */}
                        <div
                          className="absolute inset-0 opacity-50"
                          style={{
                            backgroundImage: `radial-gradient(${
                              isLightMode
                                ? (preset.canvasGridColorLight || preset.canvasGridColor)
                                : (preset.canvasGridColorDark || preset.canvasGridColor)
                            } 1px, transparent 1px)`,
                            backgroundSize: '4px 4px'
                          }}
                        />
                      </div>
                      {/* Node color swatches */}
                      <div className="flex gap-0.5 justify-center">
                        {Object.values(preset.nodeColors).slice(0, 6).map((color, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      {/* Preset name */}
                      <div className={`text-[7px] mt-0.5 text-center truncate text-[var(--text-muted)]`}>
                        {preset.name}
                      </div>
                    </button>
                    {/* Hover actions */}
                    <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartEditPreset(preset)
                        }}
                        className="w-4 h-4 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center"
                        title="Edit name"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePreset(preset)
                        }}
                        className="w-4 h-4 bg-red-600 hover:bg-red-500 text-white rounded flex items-center justify-center"
                        title="Delete preset"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                )
              } else {
                // Empty slot
                return (
                  <button
                    key={`empty-${slotIndex}`}
                    onClick={() => {
                      const name = `Custom ${slotIndex + 1}`
                      setNewPresetName(name)
                      const presetId = saveCustomPreset(name)
                      if (presetId) {
                        toast.success(`Preset "${name}" saved`)
                        setNewPresetName('')
                      }
                    }}
                    className={`p-1 rounded-lg border-2 border-dashed transition-all ${
                      'border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[var(--surface-panel-secondary)]'
                    }`}
                    title="Save current theme to this slot"
                  >
                    <div className="h-6 flex items-center justify-center">
                      <Plus className={`w-4 h-4 ${textMuted}`} />
                    </div>
                    <div className="h-2.5" /> {/* Spacer for alignment */}
                    <div className={`text-[7px] text-center ${textMuted}`}>
                      Empty
                    </div>
                  </button>
                )
              }
            })}
          </div>

          {/* Row 2: slots 4-7 (visible when 4+ presets exist) */}
          {showSecondRow && (
            <div className="grid grid-cols-4 gap-1.5">
              {[4, 5, 6, 7].map((slotIndex) => {
                const preset = (themeSettings.customPresets || [])[slotIndex]

                if (preset) {
                  // Filled slot
                  return (
                    <div key={preset.id} className="group relative">
                      <button
                        onClick={() => applyCustomPreset(preset.id)}
                        className={`w-full p-1 rounded-lg border-2 transition-all ${
                          themeSettings.currentPresetId === preset.id
                            ? 'gui-ring-active'
                            : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                        }`}
                        title={preset.name}
                      >
                        {/* Mini canvas preview - shows current mode's colors */}
                        <div
                          className="w-full h-6 rounded-md mb-1 relative overflow-hidden"
                          style={{
                            background: isLightMode
                              ? (preset.canvasBackgroundLight || preset.canvasBackground)
                              : (preset.canvasBackgroundDark || preset.canvasBackground)
                          }}
                        >
                          {/* Grid dots preview */}
                          <div
                            className="absolute inset-0 opacity-50"
                            style={{
                              backgroundImage: `radial-gradient(${
                                isLightMode
                                  ? (preset.canvasGridColorLight || preset.canvasGridColor)
                                  : (preset.canvasGridColorDark || preset.canvasGridColor)
                              } 1px, transparent 1px)`,
                              backgroundSize: '4px 4px'
                            }}
                          />
                        </div>
                        {/* Node color swatches */}
                        <div className="flex gap-0.5 justify-center">
                          {Object.values(preset.nodeColors).slice(0, 6).map((color, i) => (
                            <div
                              key={i}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        {/* Preset name */}
                        <div className={`text-[7px] mt-0.5 text-center truncate text-[var(--text-muted)]`}>
                          {preset.name}
                        </div>
                      </button>
                      {/* Hover actions */}
                      <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEditPreset(preset)
                          }}
                          className="w-4 h-4 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center"
                          title="Edit name"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePreset(preset)
                          }}
                          className="w-4 h-4 bg-red-600 hover:bg-red-500 text-white rounded flex items-center justify-center"
                          title="Delete preset"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  )
                } else {
                  // Empty slot
                  return (
                    <button
                      key={`empty-${slotIndex}`}
                      onClick={() => {
                        const name = `Custom ${slotIndex + 1}`
                        setNewPresetName(name)
                        const presetId = saveCustomPreset(name)
                        if (presetId) {
                          toast.success(`Preset "${name}" saved`)
                          setNewPresetName('')
                        }
                      }}
                      className={`p-1 rounded-lg border-2 border-dashed transition-all border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[var(--surface-panel-secondary)]`}
                      title="Save current theme to this slot"
                    >
                      <div className="h-6 flex items-center justify-center">
                        <Plus className={`w-4 h-4 ${textMuted}`} />
                      </div>
                      <div className="h-2.5" /> {/* Spacer for alignment */}
                      <div className={`text-[7px] text-center ${textMuted}`}>
                        Empty
                      </div>
                    </button>
                  )
                }
              })}
            </div>
          )}

          {/* AI Generate Theme Button with inline toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAiGenerateModal}
              disabled={!themeSettings.aiPaletteEnabled || !hasEmptyPresetSlot || aiPreview.isGenerating}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] transition-colors border-2 ${
                themeSettings.aiPaletteEnabled && hasEmptyPresetSlot && !aiPreview.isGenerating
                  ? ''
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{
                borderColor: 'var(--gui-accent-primary)',
                color: 'var(--gui-accent-primary)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                if (themeSettings.aiPaletteEnabled && hasEmptyPresetSlot && !aiPreview.isGenerating) {
                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--gui-accent-primary) 15%, transparent)'
                }
              }}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              title={
                !themeSettings.aiPaletteEnabled
                  ? 'Enable AI generation with the toggle'
                  : !hasEmptyPresetSlot
                    ? 'Delete a preset to make room for AI-generated theme'
                    : 'Generate a theme using AI'
              }
            >
              {aiPreview.isGenerating ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-3 h-3" />
                  AI Generate
                  {!hasEmptyPresetSlot && themeSettings.aiPaletteEnabled && <span className="text-[8px] ml-1">(need slot)</span>}
                </>
              )}
            </button>
            <button
              onClick={() => setAIPaletteEnabled(!themeSettings.aiPaletteEnabled)}
              className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
                themeSettings.aiPaletteEnabled ? 'gui-bg-accent' : 'bg-[var(--surface-panel-secondary)]'
              }`}
              title={themeSettings.aiPaletteEnabled ? 'AI enabled' : 'Enable AI generation'}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                  themeSettings.aiPaletteEnabled ? 'translate-x-[14px]' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Import/Export row */}
          <div className="flex gap-2">
            <button
              onClick={handleExportPresets}
              disabled={(themeSettings.customPresets?.length || 0) === 0}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 ${buttonBg} ${textSecondary} disabled:opacity-50 disabled:cursor-not-allowed rounded text-[10px] transition-colors`}
              title="Export presets to file"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={(themeSettings.customPresets?.length || 0) >= 8}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 ${buttonBg} ${textSecondary} disabled:opacity-50 disabled:cursor-not-allowed rounded text-[10px] transition-colors`}
              title="Import presets from file"
            >
              <Upload className="w-3 h-3" />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportPresets}
              className="hidden"
            />
          </div>

          {/* Edit preset name modal */}
          {editingPresetId && (
            <div className="p-2 rounded bg-[var(--surface-panel-secondary)]">
              <div className={`text-[10px] ${textMuted} mb-1`}>Rename preset:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingPresetName}
                  onChange={(e) => setEditingPresetName(e.target.value)}
                  className={`flex-1 ${inputBg} border rounded px-2 py-1 text-[10px] ${textPrimary} focus:outline-none focus:gui-border-active`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePresetEdit()
                    if (e.key === 'Escape') {
                      setEditingPresetId(null)
                      setEditingPresetName('')
                    }
                  }}
                />
                <button
                  onClick={handleSavePresetEdit}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingPresetId(null)
                    setEditingPresetName('')
                  }}
                  className={`px-2 py-1 ${buttonBg} ${textSecondary} rounded text-[10px] transition-colors`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`border-t ${dividerColor}`} />

        {/* Canvas Section */}
        <div className="space-y-2">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${textSecondary} uppercase`}>
            <Layout className="w-3 h-3" />
            Canvas
          </div>

          {/* Background */}
          <div className="flex items-center gap-2">
            <span className={`text-xs ${textMuted} w-12`}>BG</span>
            <div className="flex gap-1 flex-wrap flex-1">
              {canvasPresets.map(({ color, label }) => (
                <button
                  key={color}
                  onClick={() => setCanvasBackground(color)}
                  className={`w-5 h-5 rounded border transition-all ${
                    themeSettings.canvasBackground === color
                      ? 'gui-border-active'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                  }`}
                  style={{ backgroundColor: color }}
                  title={label}
                />
              ))}
            </div>
          </div>

          {/* Custom BG - pick color button and reset */}
          <div className="flex items-center gap-2 pl-12">
            <button
              onClick={() => handleOpenGenericColorPicker('canvasBg')}
              className={`flex items-center gap-1.5 px-2 py-1 ${buttonBg} ${textSecondary} rounded text-[10px] transition-colors`}
            >
              <Palette className="w-3 h-3" />
              Pick Color
            </button>
            <div
              className={`w-5 h-5 rounded-full border-2 border-[var(--border-subtle)]`}
              style={{ backgroundColor: themeSettings.canvasBackground }}
              title={themeSettings.canvasBackground}
            />
            <button
              onClick={() => setCanvasBackground(isLightMode ? '#ffffff' : '#1a1a2e')}
              className={`flex items-center gap-1 px-1.5 py-0.5 ${buttonBg} ${textMuted} rounded text-[10px] transition-colors hover:${textSecondary}`}
              title="Reset to default"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Grid */}
          <div className="flex items-center gap-2">
            <span className={`text-xs ${textMuted} w-12`}>Grid</span>
            <div className="flex gap-1 flex-1">
              {gridPresets.map(({ color, label }) => (
                <button
                  key={color}
                  onClick={() => setCanvasGridColor(color)}
                  className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                    themeSettings.canvasGridColor === color
                      ? 'gui-border-active'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                  }`}
                  style={{ backgroundColor: color === '#transparent' ? (isLightMode ? '#f5f5f5' : '#1a1a2e') : color }}
                  title={label}
                >
                  {color === '#transparent' && <X className={`w-2.5 h-2.5 ${textMuted}`} />}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Grid - pick color button and reset */}
          <div className="flex items-center gap-2 pl-12">
            <button
              onClick={() => handleOpenGenericColorPicker('canvasGrid')}
              className={`flex items-center gap-1.5 px-2 py-1 ${buttonBg} ${textSecondary} rounded text-[10px] transition-colors`}
            >
              <Palette className="w-3 h-3" />
              Pick Color
            </button>
            {themeSettings.canvasGridColor !== '#transparent' && (
              <div
                className={`w-5 h-5 rounded-full border-2 border-[var(--border-subtle)]`}
                style={{ backgroundColor: themeSettings.canvasGridColor }}
                title={themeSettings.canvasGridColor}
              />
            )}
            <button
              onClick={() => setCanvasGridColor(isLightMode ? '#e2e8f0' : '#2e2e52')}
              className={`flex items-center gap-1 px-1.5 py-0.5 ${buttonBg} ${textMuted} rounded text-[10px] transition-colors hover:${textSecondary}`}
              title="Reset to default"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Edge Style */}
          <div className="flex items-center gap-2">
            <span className={`text-xs ${textMuted} w-12`}>Edges</span>
            <div className="flex gap-1 flex-1 flex-wrap">
              {EDGE_STYLE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setEdgeStyle(value)}
                  className={`px-2 py-1 rounded text-[10px] transition-all ${
                    (themeSettings.edgeStyle || 'rounded') === value
                      ? 'gui-bg-accent text-white'
                      : `${buttonBg} ${textSecondary}`
                  }`}
                  title={label}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`border-t ${dividerColor}`} />

        {/* Canvas Effects Section */}
        <AmbientEffectSettings
          settings={themeSettings.ambientEffect ?? DEFAULT_AMBIENT_EFFECT}
          onChange={(newSettings) => {
            updateThemeSettings({ ambientEffect: newSettings })
          }}
          textMuted={textMuted}
          textSecondary={textSecondary}
          buttonBg={buttonBg}
          accentColor={themeSettings.guiColors?.accentPrimary}
          accentSecondary={themeSettings.guiColors?.accentSecondary}
          isDark={themeSettings.mode !== 'light'}
        />

        <div className={`border-t ${dividerColor}`} />

        {/* Node Colors Section */}
        <div className="space-y-2">
          <div className={`text-xs font-medium ${textSecondary} uppercase`}>Node Colors</div>

          {NODE_TYPES.map(({ type, label, icon }) => {
            const currentColor = themeSettings.nodeColors[type]
            const isDefault = currentColor === DEFAULT_NODE_COLORS[type]
            const isExpanded = expandedType === type

            return (
              <div key={type} className="space-y-1.5">
                {/* Node type row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedType(isExpanded ? null : type)}
                    className="flex items-center gap-1.5 flex-1 text-left group"
                  >
                    <span style={{ color: currentColor }}>{icon}</span>
                    <span className={`text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]`}>{label}</span>
                  </button>

                  {/* Quick color selection - just show current + a few popular */}
                  <div className="flex gap-0.5 items-center">
                    {!isDefault && (
                      <button
                        onClick={() => handleResetToDefault(type)}
                        className={`w-4 h-4 rounded-full border border-dashed border-[var(--border-subtle)] hover:border-[var(--border-default)] flex items-center justify-center transition-colors`}
                        title="Reset to default"
                      >
                        <RotateCcw className={`w-2 h-2 ${textMuted}`} />
                      </button>
                    )}
                    {/* Color circle - clickable to toggle expanded picker */}
                    <button
                      onClick={() => setExpandedType(isExpanded ? null : type)}
                      className="w-4 h-4 rounded-full border-2 border-white/50 hover:gui-ring-active transition-all cursor-pointer"
                      style={{ backgroundColor: currentColor }}
                      title={`${currentColor} - Click to edit`}
                    />
                  </div>
                </div>

                {/* Expanded color picker */}
                {isExpanded && (
                  <div className="pl-5 space-y-2">
                    {/* Saved custom colors (if any) - shown first for easy access */}
                    {customColors.length > 0 && (
                      <div className="space-y-1">
                        <div className={`text-[9px] ${textMuted} uppercase`}>Saved</div>
                        <div className="flex flex-wrap gap-0.5">
                          {customColors.map((color) => (
                            <button
                              key={`saved-${color}`}
                              onClick={() => handleColorSelect(type, color)}
                              className={`w-5 h-5 rounded-full border-2 transition-all ${
                                currentColor === color
                                  ? 'gui-border-active'
                                  : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                              }`}
                              style={{ backgroundColor: color }}
                              title={`Saved: ${color}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Color grid organized by hue */}
                    <div className="grid grid-cols-9 gap-0.5">
                      {/* Default button */}
                      <button
                        onClick={() => handleResetToDefault(type)}
                        className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center text-[8px] ${
                          isDefault
                            ? 'gui-border-active'
                            : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                        }`}
                        style={{ backgroundColor: DEFAULT_NODE_COLORS[type] }}
                        title="Default"
                      >
                        {isDefault && '✓'}
                      </button>

                      {/* All colors */}
                      {ALL_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => handleColorSelect(type, color)}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${
                            currentColor === color
                              ? 'gui-border-active'
                              : 'border-transparent hover:border-[var(--border-default)]'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>

                    {/* Custom hex input */}
                    <div className="flex gap-1 items-center flex-wrap">
                      <input
                        type="text"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="#hex"
                        className={`w-16 ${inputBg} border rounded px-1.5 py-0.5 text-[10px] ${textPrimary} focus:outline-none focus:gui-border-active font-mono`}
                        maxLength={7}
                      />
                      <button
                        onClick={() => handleCustomColor(type)}
                        disabled={!/^#[0-9A-Fa-f]{6}$/.test(customInput)}
                        className="px-1.5 py-0.5 gui-bg-accent disabled:bg-[var(--surface-panel-secondary)] disabled:text-[var(--text-muted)] text-white rounded text-[10px] transition-colors"
                      >
                        Set
                      </button>
                      {/^#[0-9A-Fa-f]{6}$/.test(customInput) && !customColors.includes(customInput) && (
                        <button
                          onClick={() => {
                            addCustomColor(customInput)
                          }}
                          className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] transition-colors"
                          title="Save this color for quick access"
                        >
                          + Save
                        </button>
                      )}
                      {/^#[0-9A-Fa-f]{6}$/.test(customInput) && (
                        <div
                          className={`w-4 h-4 rounded-full border border-[var(--border-subtle)]`}
                          style={{ backgroundColor: customInput }}
                        />
                      )}
                    </div>

                    {/* Advanced Color Picker button */}
                    <button
                      onClick={() => handleOpenColorPicker(type)}
                      className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 ${buttonBg} ${textSecondary} rounded text-[10px] transition-colors mt-1`}
                    >
                      <Palette className="w-3 h-3" />
                      Advanced Color Picker
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Color Picker Modal - no backdrop, doesn't close on outside click */}
        {showColorPicker && colorPickerNodeType && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <div
              className={`${panelBg} border ${panelBorder} rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 pointer-events-auto`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
                  <span className={`font-medium text-sm ${textPrimary}`}>
                    {NODE_TYPES.find(n => n.type === colorPickerNodeType)?.label} Color
                  </span>
                </div>
                <button onClick={() => setShowColorPicker(false)} className={`p-1 ${buttonBg} rounded transition-colors`} title="Close (Cancel)">
                  <X className={`w-4 h-4 ${textSecondary}`} />
                </button>
              </div>
              <ColorPicker
                color={themeSettings.nodeColors[colorPickerNodeType]}
                onChange={handleColorPickerChange}
                onSaveColor={addCustomColor}
                onRemoveSavedColor={removeCustomColor}
                savedColors={themeSettings.customColors || []}
                isLightMode={isLightMode}
                showAIGeneration={themeSettings.aiPaletteEnabled}
                aiGenerationEnabled={themeSettings.aiPaletteEnabled}
              />
              {/* Action buttons for explicit close */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowColorPicker(false)}
                  className={`flex-1 px-3 py-1.5 ${buttonBg} ${textSecondary} rounded text-xs transition-colors`}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`border-t ${dividerColor}`} />

        {/* ==================== ADVANCED SECTION ==================== */}
        <CollapsibleSection
          title="Advanced"
          icon={<Layers className="w-3 h-3" />}
          defaultExpanded={advancedExpanded}
          onExpandedChange={(expanded) => {
            setAdvancedExpanded(expanded)
            try {
              localStorage.setItem('theme-panel-advanced-expanded', String(expanded))
            } catch {
              // localStorage may be disabled
            }
          }}
          badge="Power User"
          badgeColor="accent"
        >
          {/* ==================== LINK COLORS ==================== */}
        <div className="space-y-3">
          <div className={`flex items-center justify-between`}>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${textSecondary} uppercase`}>
              <Link className="w-3 h-3" />
              Connection Colors
            </div>
            <button
              onClick={() => {
                const defaults = isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK
                setLinkColors(defaults)
              }}
              className={`flex items-center gap-1 px-1.5 py-0.5 ${buttonBg} rounded transition-colors`}
              title="Reset link colors to defaults"
            >
              <RotateCcw className={`w-3 h-3 ${textSecondary}`} />
            </button>
          </div>

          {/* Gradient Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${textSecondary}`}>Use node color gradient</span>
            </div>
            <button
              onClick={() => setLinkGradientEnabled(!themeSettings.linkGradientEnabled)}
              className={`w-8 h-4 rounded-full transition-colors ${
                themeSettings.linkGradientEnabled ? 'gui-bg-accent' : 'bg-[var(--surface-panel-secondary)]'
              }`}
            >
              <div
                className={`w-3 h-3 bg-white rounded-full transition-transform ${
                  themeSettings.linkGradientEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {themeSettings.linkGradientEnabled && (
            <p className={`text-[9px] ${textMuted} -mt-1`}>
              Connections will gradient from source to destination node colors
            </p>
          )}

          {/* Link color options - only show when gradient is disabled */}
          {!themeSettings.linkGradientEnabled && (
            <div className="space-y-2">
              {/* Default Color */}
              <div className="space-y-1.5">
                <button
                  onClick={() => setExpandedLinkSection(expandedLinkSection === 'default' ? null : 'default')}
                  className={`flex items-center justify-between w-full text-left`}
                >
                  <span className={`text-[10px] ${textMuted}`}>Default</span>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: (themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)).default }} />
                    {expandedLinkSection === 'default' ? <ChevronDown className={`w-3 h-3 ${textMuted}`} /> : <ChevronRight className={`w-3 h-3 ${textMuted}`} />}
                  </div>
                </button>
                {expandedLinkSection === 'default' && (
                  <div className="flex flex-wrap gap-0.5 pl-2">
                    {ALL_COLORS.map((color, i) => (
                      <button
                        key={`link-default-${i}`}
                        onClick={() => {
                          const current = themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)
                          setLinkColors({ ...current, default: color })
                        }}
                        className={`w-4 h-4 rounded-full border transition-all ${(themeSettings.linkColors?.default || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK).default) === color ? 'gui-border-active' : 'border-transparent hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <button
                      onClick={() => {
                        setLinkColorTarget('default')
                        setLinkColorValue((themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)).default)
                        setShowLinkColorPicker(true)
                      }}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* Active Color */}
              <div className="space-y-1.5">
                <button
                  onClick={() => setExpandedLinkSection(expandedLinkSection === 'active' ? null : 'active')}
                  className={`flex items-center justify-between w-full text-left`}
                >
                  <span className={`text-[10px] ${textMuted}`}>Active</span>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: (themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)).active }} />
                    {expandedLinkSection === 'active' ? <ChevronDown className={`w-3 h-3 ${textMuted}`} /> : <ChevronRight className={`w-3 h-3 ${textMuted}`} />}
                  </div>
                </button>
                {expandedLinkSection === 'active' && (
                  <div className="flex flex-wrap gap-0.5 pl-2">
                    {ALL_COLORS.map((color, i) => (
                      <button
                        key={`link-active-${i}`}
                        onClick={() => {
                          const current = themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)
                          setLinkColors({ ...current, active: color })
                        }}
                        className={`w-4 h-4 rounded-full border transition-all ${(themeSettings.linkColors?.active || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK).active) === color ? 'gui-border-active' : 'border-transparent hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <button
                      onClick={() => {
                        setLinkColorTarget('active')
                        setLinkColorValue((themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)).active)
                        setShowLinkColorPicker(true)
                      }}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* Inactive Color */}
              <div className="space-y-1.5">
                <button
                  onClick={() => setExpandedLinkSection(expandedLinkSection === 'inactive' ? null : 'inactive')}
                  className={`flex items-center justify-between w-full text-left`}
                >
                  <span className={`text-[10px] ${textMuted}`}>Inactive</span>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: (themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)).inactive }} />
                    {expandedLinkSection === 'inactive' ? <ChevronDown className={`w-3 h-3 ${textMuted}`} /> : <ChevronRight className={`w-3 h-3 ${textMuted}`} />}
                  </div>
                </button>
                {expandedLinkSection === 'inactive' && (
                  <div className="flex flex-wrap gap-0.5 pl-2">
                    {ALL_COLORS.map((color, i) => (
                      <button
                        key={`link-inactive-${i}`}
                        onClick={() => {
                          const current = themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)
                          setLinkColors({ ...current, inactive: color })
                        }}
                        className={`w-4 h-4 rounded-full border transition-all ${(themeSettings.linkColors?.inactive || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK).inactive) === color ? 'gui-border-active' : 'border-transparent hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <button
                      onClick={() => {
                        setLinkColorTarget('inactive')
                        setLinkColorValue((themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)).inactive)
                        setShowLinkColorPicker(true)
                      }}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* Selected Color */}
              <div className="space-y-1.5">
                <button
                  onClick={() => setExpandedLinkSection(expandedLinkSection === 'selected' ? null : 'selected')}
                  className={`flex items-center justify-between w-full text-left`}
                >
                  <span className={`text-[10px] ${textMuted}`}>Selected</span>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: (themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)).selected }} />
                    {expandedLinkSection === 'selected' ? <ChevronDown className={`w-3 h-3 ${textMuted}`} /> : <ChevronRight className={`w-3 h-3 ${textMuted}`} />}
                  </div>
                </button>
                {expandedLinkSection === 'selected' && (
                  <div className="flex flex-wrap gap-0.5 pl-2">
                    {ALL_COLORS.map((color, i) => (
                      <button
                        key={`link-selected-${i}`}
                        onClick={() => {
                          const current = themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)
                          setLinkColors({ ...current, selected: color })
                        }}
                        className={`w-4 h-4 rounded-full border transition-all ${(themeSettings.linkColors?.selected || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK).selected) === color ? 'gui-border-active' : 'border-transparent hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <button
                      onClick={() => {
                        setLinkColorTarget('selected')
                        setLinkColorValue((themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)).selected)
                        setShowLinkColorPicker(true)
                      }}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Link Color Picker Modal */}
        {showLinkColorPicker && linkColorTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <div className={`${panelBg} border ${panelBorder} rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 pointer-events-auto`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
                  <span className={`font-medium text-sm ${textPrimary}`}>
                    {linkColorTarget.charAt(0).toUpperCase() + linkColorTarget.slice(1)} Link Color
                  </span>
                </div>
                <button onClick={() => setShowLinkColorPicker(false)} className={`p-1 ${buttonBg} rounded transition-colors`} title="Close">
                  <X className={`w-4 h-4 ${textSecondary}`} />
                </button>
              </div>
              <ColorPicker
                color={linkColorValue}
                onChange={(color) => setLinkColorValue(color)}
                onSaveColor={addCustomColor}
                onRemoveSavedColor={removeCustomColor}
                savedColors={themeSettings.customColors || []}
                isLightMode={isLightMode}
                showAIGeneration={false}
                aiGenerationEnabled={false}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowLinkColorPicker(false)}
                  className={`flex-1 px-3 py-1.5 ${buttonBg} ${textSecondary} rounded text-xs transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const current = themeSettings.linkColors || (isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK)
                    setLinkColors({ ...current, [linkColorTarget]: linkColorValue })
                    setShowLinkColorPicker(false)
                    setLinkColorTarget(null)
                  }}
                  className="flex-1 px-3 py-1.5 rounded text-xs text-white transition-colors"
                  style={{ backgroundColor: 'var(--gui-accent-primary)' }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`border-t ${dividerColor}`} />

        {/* ==================== GUI COLORS ==================== */}
        <div className="space-y-3">
          <div className={`flex items-center justify-between`}>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${textSecondary} uppercase`}>
              <Monitor className="w-3 h-3" />
              GUI Colors
            </div>
            <button
              onClick={handleResetGuiColors}
              className={`flex items-center gap-1 px-1.5 py-0.5 ${buttonBg} rounded transition-colors`}
              title="Reset GUI colors to defaults"
            >
              <RotateCcw className={`w-3 h-3 ${textSecondary}`} />
            </button>
          </div>

          {/* Panel Backgrounds - with secondary (neutral) palette */}
          <div className="space-y-1.5">
            <button
              onClick={() => setExpandedGuiSection(expandedGuiSection === 'backgrounds' ? null : 'backgrounds')}
              className={`flex items-center justify-between w-full text-left`}
            >
              <span className={`text-[10px] ${textMuted}`}>Panel Backgrounds</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currentGuiColors.panelBackground }} title="Primary" />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currentGuiColors.panelBackgroundSecondary }} title="Secondary" />
                {expandedGuiSection === 'backgrounds' ? <ChevronDown className={`w-3 h-3 ${textMuted}`} /> : <ChevronRight className={`w-3 h-3 ${textMuted}`} />}
              </div>
            </button>
            {expandedGuiSection === 'backgrounds' && (
              <div className="pl-2 space-y-2">
                {/* Primary Background */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${textSecondary} w-14`}>Primary</span>
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--gui-accent-primary)', backgroundColor: currentGuiColors.panelBackground }} />
                  </div>
                  <div className="flex flex-wrap gap-0.5 pl-16">
                    {/* Secondary palette - neutral/grayscale backgrounds */}
                    {(isLightMode ? BACKGROUND_PALETTE.light : BACKGROUND_PALETTE.dark).map((color, i) => (
                      <button
                        key={`bg-preset-${i}`}
                        onClick={() => handleQuickSetGuiColor('panelBackground', color)}
                        className={`w-4 h-4 rounded-full border transition-all ${currentGuiColors.panelBackground === color ? 'gui-border-active' : 'border-[var(--border-subtle)]/30 hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    {/* Pick custom button */}
                    <button
                      onClick={() => handleOpenGuiColorPicker('panelBackground')}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                </div>
                {/* Secondary Background */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${textSecondary} w-14`}>Secondary</span>
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--gui-accent-primary)', backgroundColor: currentGuiColors.panelBackgroundSecondary }} />
                  </div>
                  <div className="flex flex-wrap gap-0.5 pl-16">
                    {(isLightMode ? BACKGROUND_PALETTE.light : BACKGROUND_PALETTE.dark).map((color, i) => (
                      <button
                        key={`bg2-preset-${i}`}
                        onClick={() => handleQuickSetGuiColor('panelBackgroundSecondary', color)}
                        className={`w-4 h-4 rounded-full border transition-all ${currentGuiColors.panelBackgroundSecondary === color ? 'gui-border-active' : 'border-[var(--border-subtle)]/30 hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <button
                      onClick={() => handleOpenGuiColorPicker('panelBackgroundSecondary')}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Text Colors - with secondary (neutral) palette */}
          <div className="space-y-1.5">
            <button
              onClick={() => setExpandedGuiSection(expandedGuiSection === 'text' ? null : 'text')}
              className={`flex items-center justify-between w-full text-left`}
            >
              <span className={`text-[10px] ${textMuted}`}>Text Colors</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currentGuiColors.textPrimary }} title="Primary" />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currentGuiColors.textSecondary }} title="Secondary" />
                {expandedGuiSection === 'text' ? <ChevronDown className={`w-3 h-3 ${textMuted}`} /> : <ChevronRight className={`w-3 h-3 ${textMuted}`} />}
              </div>
            </button>
            {expandedGuiSection === 'text' && (
              <div className="pl-2 space-y-2">
                {/* Primary Text */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${textSecondary} w-14`}>Primary</span>
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--gui-accent-primary)', backgroundColor: currentGuiColors.textPrimary }} />
                  </div>
                  <div className="flex flex-wrap gap-0.5 pl-16">
                    {/* Secondary palette - neutral/grayscale text */}
                    {(isLightMode ? TEXT_PALETTE.light : TEXT_PALETTE.dark).map((color, i) => (
                      <button
                        key={`text-preset-${i}`}
                        onClick={() => handleQuickSetGuiColor('textPrimary', color)}
                        className={`w-4 h-4 rounded-full border transition-all ${currentGuiColors.textPrimary === color ? 'gui-border-active' : 'border-[var(--border-subtle)]/30 hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    {/* Pick custom button */}
                    <button
                      onClick={() => handleOpenGuiColorPicker('textPrimary')}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                </div>
                {/* Secondary Text */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${textSecondary} w-14`}>Secondary</span>
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--gui-accent-primary)', backgroundColor: currentGuiColors.textSecondary }} />
                  </div>
                  <div className="flex flex-wrap gap-0.5 pl-16">
                    {(isLightMode ? TEXT_PALETTE.light : TEXT_PALETTE.dark).map((color, i) => (
                      <button
                        key={`text2-preset-${i}`}
                        onClick={() => handleQuickSetGuiColor('textSecondary', color)}
                        className={`w-4 h-4 rounded-full border transition-all ${currentGuiColors.textSecondary === color ? 'gui-border-active' : 'border-[var(--border-subtle)]/30 hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <button
                      onClick={() => handleOpenGuiColorPicker('textSecondary')}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accent Colors - with full color palette */}
          <div className="space-y-1.5">
            <button
              onClick={() => setExpandedGuiSection(expandedGuiSection === 'accents' ? null : 'accents')}
              className={`flex items-center justify-between w-full text-left`}
            >
              <span className={`text-[10px] ${textMuted}`}>Accent Colors</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currentGuiColors.accentPrimary }} title="Primary" />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currentGuiColors.accentSecondary }} title="Secondary" />
                {expandedGuiSection === 'accents' ? <ChevronDown className={`w-3 h-3 ${textMuted}`} /> : <ChevronRight className={`w-3 h-3 ${textMuted}`} />}
              </div>
            </button>
            {expandedGuiSection === 'accents' && (
              <div className="pl-2 space-y-2">
                {/* Primary Accent */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${textSecondary} w-14`}>Primary</span>
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--gui-accent-primary)', backgroundColor: currentGuiColors.accentPrimary }} />
                  </div>
                  <div className="flex flex-wrap gap-0.5 pl-16">
                    {/* Full color palette for accents */}
                    {ALL_COLORS.map((color, i) => (
                      <button
                        key={`acc-color-${i}`}
                        onClick={() => handleQuickSetGuiColor('accentPrimary', color)}
                        className={`w-4 h-4 rounded-full border transition-all ${currentGuiColors.accentPrimary === color ? 'gui-border-active' : 'border-transparent hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    {/* Pick custom button */}
                    <button
                      onClick={() => handleOpenGuiColorPicker('accentPrimary')}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                </div>
                {/* Secondary Accent */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${textSecondary} w-14`}>Secondary</span>
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--gui-accent-primary)', backgroundColor: currentGuiColors.accentSecondary }} />
                  </div>
                  <div className="flex flex-wrap gap-0.5 pl-16">
                    {ALL_COLORS.map((color, i) => (
                      <button
                        key={`acc2-color-${i}`}
                        onClick={() => handleQuickSetGuiColor('accentSecondary', color)}
                        className={`w-4 h-4 rounded-full border transition-all ${currentGuiColors.accentSecondary === color ? 'gui-border-active' : 'border-transparent hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <button
                      onClick={() => handleOpenGuiColorPicker('accentSecondary')}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Toolbar Icons - with full color palette */}
          <div className="space-y-1.5">
            <button
              onClick={() => setExpandedGuiSection(expandedGuiSection === 'toolbar' ? null : 'toolbar')}
              className={`flex items-center justify-between w-full text-left`}
            >
              <span className={`text-[10px] ${textMuted}`}>Toolbar Icons</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currentGuiColors.toolbarIconDefault }} title="Default" />
                {currentGuiColors.toolbarIconAccent.slice(0, 3).map((color, i) => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                ))}
                {expandedGuiSection === 'toolbar' ? <ChevronDown className={`w-3 h-3 ${textMuted}`} /> : <ChevronRight className={`w-3 h-3 ${textMuted}`} />}
              </div>
            </button>
            {expandedGuiSection === 'toolbar' && (
              <div className="pl-2 space-y-2">
                {/* Default Icon Color */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${textSecondary} w-14`}>Default</span>
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--gui-accent-primary)', backgroundColor: currentGuiColors.toolbarIconDefault }} />
                  </div>
                  <div className="flex flex-wrap gap-0.5 pl-16">
                    {/* Full color palette for toolbar icons */}
                    {ALL_COLORS.map((color, i) => (
                      <button
                        key={`icon-color-${i}`}
                        onClick={() => handleQuickSetGuiColor('toolbarIconDefault', color)}
                        className={`w-4 h-4 rounded-full border transition-all ${currentGuiColors.toolbarIconDefault === color ? 'gui-border-active' : 'border-transparent hover:border-[var(--border-default)]'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    {/* Pick custom button */}
                    <button
                      onClick={() => handleOpenGuiColorPicker('toolbarIconDefault')}
                      className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                      title="Pick custom color"
                    >
                      <Plus className={`w-2 h-2 ${textMuted}`} />
                    </button>
                  </div>
                </div>
                {/* Accent Icons 1-4 */}
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] ${textSecondary} w-14`}>Accent {idx + 1}</span>
                      <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--gui-accent-primary)', backgroundColor: currentGuiColors.toolbarIconAccent[idx] }} />
                    </div>
                    <div className="flex flex-wrap gap-0.5 pl-16">
                      {ALL_COLORS.map((color, i) => (
                        <button
                          key={`iconacc${idx}-color-${i}`}
                          onClick={() => handleQuickSetGuiColor(`toolbarIconAccent.${idx}`, color)}
                          className={`w-4 h-4 rounded-full border transition-all ${currentGuiColors.toolbarIconAccent[idx] === color ? 'gui-border-active' : 'border-transparent hover:border-[var(--border-default)]'}`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                      <button
                        onClick={() => handleOpenGuiColorPicker(`toolbarIconAccent.${idx}`)}
                        className={`w-4 h-4 rounded-full border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center`}
                        title="Pick custom color"
                      >
                        <Plus className={`w-2 h-2 ${textMuted}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* GUI Color Picker Modal */}
        {showGuiColorPicker && guiColorTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <div
              className={`${panelBg} border ${panelBorder} rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 pointer-events-auto`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
                  <span className={`font-medium text-sm ${textPrimary}`}>
                    {guiColorTarget === 'panelBackground' && 'Panel Background'}
                    {guiColorTarget === 'panelBackgroundSecondary' && 'Secondary Background'}
                    {guiColorTarget === 'textPrimary' && 'Primary Text'}
                    {guiColorTarget === 'textSecondary' && 'Secondary Text'}
                    {guiColorTarget === 'accentPrimary' && 'Primary Accent'}
                    {guiColorTarget === 'accentSecondary' && 'Secondary Accent'}
                    {guiColorTarget === 'toolbarIconDefault' && 'Default Icon Color'}
                    {guiColorTarget.startsWith('toolbarIconAccent') && `Toolbar Icon ${parseInt(guiColorTarget.split('.')[1] ?? '0') + 1}`}
                  </span>
                </div>
                <button onClick={() => setShowGuiColorPicker(false)} className={`p-1 ${buttonBg} rounded transition-colors`} title="Close">
                  <X className={`w-4 h-4 ${textSecondary}`} />
                </button>
              </div>
              <ColorPicker
                color={guiColorValue}
                onChange={handleGuiColorPickerChange}
                onSaveColor={addCustomColor}
                onRemoveSavedColor={removeCustomColor}
                savedColors={themeSettings.customColors || []}
                isLightMode={isLightMode}
                showAIGeneration={false}
                aiGenerationEnabled={false}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowGuiColorPicker(false)}
                  className={`flex-1 px-3 py-1.5 ${buttonBg} ${textSecondary} rounded text-xs transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGuiColorPickerSave}
                  className="flex-1 px-3 py-1.5 rounded text-xs text-white transition-colors"
                  style={{ backgroundColor: 'var(--gui-accent-primary)' }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`border-t ${dividerColor}`} />

        {/* Custom Saved Colors Section */}
        <div className="space-y-2">
          <div className={`flex items-center justify-between`}>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${textSecondary} uppercase`}>
              <Palette className="w-3 h-3" />
              Saved Colors
            </div>
            <button
              onClick={() => handleOpenGenericColorPicker('savedColors')}
              className={`flex items-center gap-1 px-1.5 py-0.5 ${buttonBg} rounded transition-colors`}
              title="Pick a color to save"
            >
              <Plus className={`w-3 h-3 ${textSecondary}`} />
              <span className={`text-[10px] ${textSecondary}`}>Pick</span>
            </button>
          </div>

          {/* Display saved colors */}
          {customColors.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {customColors.map((color) => (
                <div key={color} className="group relative">
                  <div
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-all ${
                      'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                  <button
                    onClick={() => handleRemoveCustomColor(color)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 hover:bg-red-600 rounded-full items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                    title="Remove color"
                  >
                    <X className="w-2 h-2" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-[10px] ${textMuted} italic`}>No saved colors. Click "Pick" to add colors.</p>
          )}

          {/* Tip about using saved colors */}
          {customColors.length > 0 && (
            <p className={`text-[10px] ${textMuted}`}>Click a node color row above, then select from saved colors.</p>
          )}
        </div>

        {/* Behavior Settings */}
        <div className={`border-t ${dividerColor}`} />

        <div className="space-y-3">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${textSecondary} uppercase`}>
            <Layers className="w-3 h-3" />
            Behavior
          </div>

          {/* Style Inheritance Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className={`text-[10px] ${textSecondary}`}>Inherit parent style</span>
              <span className={`text-[9px] ${textMuted}`}>Nodes adopt project color when added</span>
            </div>
            <button
              onClick={() => {
                const current = themeSettings.inheritParentStyle !== false
                updateThemeSettings({ inheritParentStyle: !current })
              }}
              className={`w-8 h-4 rounded-full transition-colors ${
                themeSettings.inheritParentStyle !== false ? 'gui-bg-accent' : 'bg-[var(--surface-panel-secondary)]'
              }`}
            >
              <div
                className={`w-3 h-3 bg-white rounded-full transition-transform ${
                  themeSettings.inheritParentStyle !== false ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Reset All Button */}
        <div className={`pt-2 border-t ${dividerColor}`}>
          <button
            onClick={resetThemeColors}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 ${buttonBg} ${textSecondary} hover:${textPrimary} rounded text-xs transition-colors`}
          >
            <RotateCcw className="w-3 h-3" />
            Reset All to Defaults
          </button>
        </div>
        </CollapsibleSection>

        {/* Generic Color Picker Modal (for saved colors, canvas bg, grid) - no backdrop, doesn't close on outside click */}
        {showGenericColorPicker && genericColorPickerTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <div
              className={`${panelBg} border ${panelBorder} rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 pointer-events-auto`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
                  <span className={`font-medium text-sm ${textPrimary}`}>
                    {genericColorPickerTarget === 'savedColors' && 'Add Saved Color'}
                    {genericColorPickerTarget === 'canvasBg' && 'Canvas Background'}
                    {genericColorPickerTarget === 'canvasGrid' && 'Canvas Grid Color'}
                  </span>
                </div>
                <button onClick={() => setShowGenericColorPicker(false)} className={`p-1 ${buttonBg} rounded transition-colors`} title="Close (Cancel)">
                  <X className={`w-4 h-4 ${textSecondary}`} />
                </button>
              </div>
              <ColorPicker
                color={genericColorPickerValue}
                onChange={handleGenericColorPickerChange}
                onSaveColor={addCustomColor}
                onRemoveSavedColor={removeCustomColor}
                savedColors={themeSettings.customColors || []}
                isLightMode={isLightMode}
                showAIGeneration={themeSettings.aiPaletteEnabled}
                aiGenerationEnabled={themeSettings.aiPaletteEnabled}
              />
              {/* Action buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowGenericColorPicker(false)}
                  className={`flex-1 px-3 py-1.5 ${buttonBg} ${textSecondary} rounded text-xs transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenericColorPickerSave}
                  className="flex-1 px-3 py-1.5 gui-bg-accent text-white rounded text-xs transition-colors"
                >
                  {genericColorPickerTarget === 'savedColors' ? 'Save Color' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Theme Generation Modal */}
        {showAiGenerateModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowAiGenerateModal(false)}>
            <div
              className={`${panelBg} border ${panelBorder} rounded-lg shadow-xl p-4 max-w-md w-full mx-4`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
                  <span className={`font-medium text-sm ${textPrimary}`}>Generate AI Theme</span>
                </div>
                <button onClick={() => setShowAiGenerateModal(false)} className={`p-1 ${buttonBg} rounded transition-colors`}>
                  <X className={`w-4 h-4 ${textSecondary}`} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={`block text-xs ${textSecondary} mb-1`}>Describe your theme</label>
                  <input
                    type="text"
                    value={aiThemeDescription}
                    onChange={(e) => setAiThemeDescription(e.target.value)}
                    placeholder="e.g., warm sunset, cyberpunk neon, forest nature..."
                    className={`w-full ${inputBg} border rounded px-3 py-2 text-sm ${textPrimary} focus:outline-none focus:gui-border-active`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && aiThemeDescription.trim()) {
                        handleGenerateAiTheme(aiThemeDescription.trim())
                      }
                    }}
                  />
                </div>

                <p className={`text-[10px] ${textMuted}`}>
                  The AI will generate a harmonious color palette matching your description,
                  preserving semantic associations for each node type.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAiGenerateModal(false)}
                    className={`flex-1 px-3 py-2 ${buttonBg} ${textSecondary} rounded text-xs transition-colors`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (aiThemeDescription.trim()) {
                        handleGenerateAiTheme(aiThemeDescription.trim())
                      }
                    }}
                    disabled={!aiThemeDescription.trim()}
                    className="flex-1 px-3 py-2 gui-bg-accent disabled:bg-[var(--surface-panel-secondary)] disabled:cursor-not-allowed text-white rounded text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Wand2 className="w-3 h-3" />
                    Generate
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Theme Preview Overlay */}
        {aiPreview.isActive && (
          <div className={`absolute bottom-0 left-0 right-0 ${panelBg} border-t ${panelBorder} p-3 shadow-lg z-[61]`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
                <span className={`text-xs font-medium ${textPrimary}`}>Theme Preview</span>
                <span className={`text-[10px] ${textMuted} truncate flex-1`}>"{aiPreview.description}"</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRevertAiTheme}
                  className={`flex-1 px-3 py-1.5 ${buttonBg} ${textSecondary} rounded text-xs transition-colors flex items-center justify-center gap-1`}
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
                <button
                  onClick={() => handleRegenerateAiTheme()}
                  disabled={aiPreview.isGenerating}
                  className={`flex-1 px-3 py-1.5 ${buttonBg} ${textSecondary} rounded text-xs transition-colors flex items-center justify-center gap-1`}
                >
                  {aiPreview.isGenerating ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Regenerate
                </button>
                <button
                  onClick={handleApproveAiTheme}
                  className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs transition-colors flex items-center justify-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export const ThemeSettingsModal = memo(ThemeSettingsModalComponent)
