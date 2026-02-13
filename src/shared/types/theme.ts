// =============================================================================
// theme.ts -- Theme and visual settings
//
// Contains: ThemeSettings, presets, GuiColors, ambient effect types,
// link colors, light mode presets, default theme settings
// =============================================================================

import type { EdgeStyle } from './edges'
import type { GlassSettings } from './glass'

// -----------------------------------------------------------------------------
// Theme Settings Types
// -----------------------------------------------------------------------------

export type ThemeMode = 'dark' | 'light'

// Colors for a single mode (dark or light)
export interface ThemePresetColors {
  canvasBackground: string // Hex color OR CSS gradient
  canvasGridColor: string
  nodeColors: {
    conversation: string
    project: string
    note: string
    task: string
    artifact: string
    workspace: string
    text: string
    action: string
    orchestrator: string
  }
  guiColors?: GuiColors // Optional GUI colors for theming UI elements
}

// Complete theme preset definition
export interface ThemePreset {
  id: string
  name: string
  description?: string
  dark: ThemePresetColors
  light: ThemePresetColors
  glassSettings?: GlassSettings // Optional glass defaults for this preset
}

// User-saved custom theme preset
export interface CustomThemePreset {
  id: string
  name: string
  nodeColors: {
    conversation: string
    project: string
    note: string
    task: string
    artifact: string
    workspace: string
    text: string
    action: string
    orchestrator: string
  }
  // Link colors
  linkColors?: {
    default: string
    active: string
    inactive: string
    selected: string
  }
  linkColorsDark?: {
    default: string
    active: string
    inactive: string
    selected: string
  }
  linkColorsLight?: {
    default: string
    active: string
    inactive: string
    selected: string
  }
  linkGradientEnabled?: boolean
  canvasBackground: string // Legacy: used if per-mode colors not set
  canvasGridColor: string // Legacy: used if per-mode colors not set
  canvasBackgroundDark?: string
  canvasGridColorDark?: string
  canvasBackgroundLight?: string
  canvasGridColorLight?: string
}

// GUI Colors for theming UI elements (modals, buttons, toolbar icons)
export interface GuiColors {
  // Panel/modal backgrounds
  panelBackground: string // Modal/sidebar bg (dark: gray-900, light: white)
  panelBackgroundSecondary: string // Nested sections (dark: gray-800, light: gray-50)

  // Text colors
  textPrimary: string // Main text (dark: gray-100, light: gray-900)
  textSecondary: string // Muted text (dark: gray-400, light: gray-600)

  // Accent colors for buttons/actions
  accentPrimary: string // Primary action color (purple-600)
  accentSecondary: string // Secondary action color (blue-600)

  // Toolbar icon colors
  toolbarIconDefault: string // Default icon color (gray-400/gray-600)
  toolbarIconAccent: string[] // 4 accent colors for right icons [purple, cyan, emerald, pink]
}

// Default GUI colors for dark mode - Cogno theme (cool blue accent, deep space panels)
export const DEFAULT_GUI_COLORS_DARK: GuiColors = {
  panelBackground: '#0d0d14', // Deep space black
  panelBackgroundSecondary: '#14161e', // Dark charcoal with blue hint
  textPrimary: '#f0f4f8', // Crisp white
  textSecondary: '#94a3b8', // Slate-400
  accentPrimary: '#3b82f6', // Blue-500 (cool, professional)
  accentSecondary: '#06b6d4', // Cyan
  toolbarIconDefault: '#94a3b8',
  // Rainbow progression: blue -> purple -> amber -> emerald
  toolbarIconAccent: ['#3b82f6', '#a855f7', '#f59e0b', '#10b981']
}

// Default GUI colors for light mode - Cogno theme (cool blue accent)
export const DEFAULT_GUI_COLORS_LIGHT: GuiColors = {
  panelBackground: '#ffffff',
  panelBackgroundSecondary: '#f8fafc', // Slight blue tint
  textPrimary: '#1e293b', // Slate-800
  textSecondary: '#64748b', // Slate-500
  accentPrimary: '#2563eb', // Blue-600 (cool, professional)
  accentSecondary: '#0891b2', // Cyan-600
  toolbarIconDefault: '#64748b',
  // Rainbow progression: blue -> purple -> amber -> emerald
  toolbarIconAccent: ['#2563eb', '#9333ea', '#d97706', '#059669']
}

export interface ThemeSettings {
  mode: ThemeMode
  currentPresetId: string | null // Track active preset (null = custom)
  nodeColors: {
    conversation: string
    project: string
    note: string
    task: string
    artifact: string
    workspace: string
    text: string
    action: string
    orchestrator: string
  }
  // Link/Connection colors - for edges between nodes
  linkColors?: {
    default: string // Default link color
    active: string // Color for active/highlighted links
    inactive: string // Color for inactive/disabled links
    selected: string // Color when link is selected
  }
  linkColorsDark?: {
    default: string
    active: string
    inactive: string
    selected: string
  }
  linkColorsLight?: {
    default: string
    active: string
    inactive: string
    selected: string
  }
  linkGradientEnabled?: boolean // Use gradient from source to destination node colors
  // Canvas colors - separate for dark and light modes
  canvasBackground: string // Current active background (for backward compat)
  canvasGridColor: string // Current active grid color (for backward compat)
  canvasBackgroundDark?: string // Dark mode background
  canvasGridColorDark?: string // Dark mode grid
  canvasBackgroundLight?: string // Light mode background
  canvasGridColorLight?: string // Light mode grid
  customColors?: string[] // User-saved custom colors for quick access
  customPresets?: CustomThemePreset[] // User's saved custom presets (max 4)
  aiPaletteEnabled?: boolean // Enable AI-powered palette generation
  edgeStyle?: EdgeStyle // Edge line shape style (default: 'rounded')
  // GUI colors - separate for dark and light modes
  guiColors?: GuiColors // Current active GUI colors (for backward compat)
  guiColorsDark?: GuiColors // Dark mode GUI colors
  guiColorsLight?: GuiColors // Light mode GUI colors
  // Behavior settings
  inheritParentStyle?: boolean // When node joins project, inherit parent's color (default: true)
  // Layout settings
  layoutSpacing?: 'narrow' | 'default' | 'wide' // Spacing preset for auto-layout (default: 'default')
  // Physics simulation settings
  physicsEnabled?: boolean // Enable real-time spring physics for edge lengths (default: false)
  physicsIdealEdgeLength?: number // Target spring length in pixels (default: 120)
  physicsStrength?: 'gentle' | 'medium' | 'strong' // Physics force strength preset (default: 'medium')
  // Ambient canvas effects
  ambientEffect?: AmbientEffectSettings // Background animation settings
  // Glassmorphism settings
  glassSettings?: GlassSettings // Three-tier glassmorphism UI (solid, soft-blur, fluid-glass)
}

// =============================================================================
// Ambient Canvas Effects
// =============================================================================

export type AmbientEffectType =
  | 'none'
  | 'letter-glitch'
  | 'iridescence'
  | 'threads'
  | 'dot-grid'
  | 'dither'
  | 'prismatic-burst'
  | 'pixel-snow'
  | 'beams'
  | 'grainient'
  | 'plasma'
  | 'particles'
  | 'aurora'
  | 'color-bends'
  | 'pixel-blast'
  | 'floating-lines'
  | 'silk'
  | 'light-pillar'
  | 'prism'
  | 'liquid-ether'

export interface AmbientEffectSettings {
  /** Master toggle for ambient effects */
  enabled: boolean
  /** Which effect to display */
  effect: AmbientEffectType
  /** Bloom post-processing intensity (0-100, 0 = disabled) */
  bloomIntensity?: number
  /** Per-effect native prop overrides, keyed by effect type */
  effectProps: Record<string, Record<string, unknown>>
}

export const DEFAULT_AMBIENT_EFFECT: AmbientEffectSettings = {
  enabled: false,
  effect: 'none',
  bloomIntensity: 100,
  effectProps: {}
}

// Light mode presets
export const LIGHT_MODE_PRESETS = {
  canvasBackgrounds: [
    { color: '#ffffff', label: 'White' },
    { color: '#f8fafc', label: 'Slate' },
    { color: '#f5f5f4', label: 'Stone' },
    { color: '#fafaf9', label: 'Warm' },
    { color: '#f0f9ff', label: 'Sky' },
    { color: '#fef3c7', label: 'Amber' }
  ],
  canvasGridColors: [
    { color: '#e2e8f0', label: 'Default' },
    { color: '#d1d5db', label: 'Gray' },
    { color: '#e5e7eb', label: 'Light' },
    { color: '#transparent', label: 'None' }
  ]
}

// Default link colors for dark and light modes
export const DEFAULT_LINK_COLORS_DARK = {
  default: '#64748b', // slate-500
  active: '#3b82f6', // blue-500
  inactive: '#374151', // gray-700
  selected: '#8b5cf6' // purple-500
}

export const DEFAULT_LINK_COLORS_LIGHT = {
  default: '#94a3b8', // slate-400
  active: '#2563eb', // blue-600
  inactive: '#d1d5db', // gray-300
  selected: '#7c3aed' // purple-600
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: 'dark',
  currentPresetId: 'default', // Cogno preset
  nodeColors: {
    conversation: '#3b82f6', // blue-500
    project: '#a855f7', // purple-500
    note: '#f59e0b', // amber-500
    task: '#10b981', // emerald-500
    artifact: '#06b6d4', // cyan-500
    workspace: '#ef4444', // red-500
    text: '#94a3b8', // slate-400
    action: '#f97316', // orange-500
    orchestrator: '#8b5cf6' // violet-500
  },
  linkColors: DEFAULT_LINK_COLORS_DARK,
  linkColorsDark: DEFAULT_LINK_COLORS_DARK,
  linkColorsLight: DEFAULT_LINK_COLORS_LIGHT,
  linkGradientEnabled: true,
  guiColors: DEFAULT_GUI_COLORS_DARK,
  guiColorsDark: DEFAULT_GUI_COLORS_DARK,
  guiColorsLight: DEFAULT_GUI_COLORS_LIGHT,
  canvasBackground: 'linear-gradient(135deg, #0d0d14 0%, #0f0f1a 50%, #0d0d14 100%)',
  canvasGridColor: '#1e1e2e',
  canvasBackgroundDark: 'linear-gradient(135deg, #0d0d14 0%, #0f0f1a 50%, #0d0d14 100%)',
  canvasGridColorDark: '#1e1e2e',
  canvasBackgroundLight: 'linear-gradient(135deg, #fafbff 0%, #f5f3ff 50%, #fafbff 100%)',
  canvasGridColorLight: '#e2e4f0',
  ambientEffect: DEFAULT_AMBIENT_EFFECT
}

export const LIGHT_THEME_DEFAULTS: Partial<ThemeSettings> = {
  mode: 'light',
  canvasBackground: 'linear-gradient(135deg, #fafbff 0%, #f5f3ff 50%, #fafbff 100%)',
  canvasGridColor: '#e2e4f0',
  canvasBackgroundLight: 'linear-gradient(135deg, #fafbff 0%, #f5f3ff 50%, #fafbff 100%)',
  canvasGridColorLight: '#e2e4f0'
}
