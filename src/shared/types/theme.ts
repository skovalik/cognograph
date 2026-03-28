// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

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

// Accent color theme presets (legacy flat list — prefer PRESET_ACCENT_PALETTES)
export type AccentTheme = 'aurochs-gold' | 'cobalt' | 'copper' | 'emerald' | 'rose' | 'violet' | 'custom';

export interface AccentPreset {
  id: AccentTheme;
  name: string;
  accent: string;
  accentGlow: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'aurochs-gold', name: 'Gold', accent: '#C8963E', accentGlow: '#E5B95C' },
  { id: 'cobalt', name: 'Cobalt', accent: '#3B6BF5', accentGlow: '#5A85F7' },
  { id: 'copper', name: 'Copper', accent: '#D4763A', accentGlow: '#E8925A' },
  { id: 'emerald', name: 'Emerald', accent: '#10B981', accentGlow: '#34D399' },
  { id: 'rose', name: 'Rose', accent: '#F43F5E', accentGlow: '#FB7185' },
  { id: 'violet', name: 'Violet', accent: '#A855F7', accentGlow: '#C084FC' },
];

// Per-preset accent palettes — harmonized accent options per theme preset (matches DS v3)
export interface PresetAccent {
  label: string;
  glow: string;      // Dark mode accent color
  glowLight: string;  // Light mode accent color
}

export const PRESET_ACCENT_PALETTES: Record<string, PresetAccent[]> = {
  default: [
    { label: 'Gold', glow: '#C8963E', glowLight: '#A67B30' },
    { label: 'Amber', glow: '#E5B95C', glowLight: '#B8872C' },
    { label: 'Cobalt', glow: '#5A85F7', glowLight: '#3B6BF5' },
    { label: 'Copper', glow: '#E8925A', glowLight: '#C06830' },
    { label: 'Patina', glow: '#8EAB7A', glowLight: '#5C7A48' },
  ],
  crimson: [
    { label: 'Rose', glow: '#e11d48', glowLight: '#be123c' },
    { label: 'Blush', glow: '#fb7185', glowLight: '#f43f5e' },
    { label: 'Ember', glow: '#f97316', glowLight: '#ea580c' },
    { label: 'Gold', glow: '#fbbf24', glowLight: '#d97706' },
    { label: 'Mauve', glow: '#c084fc', glowLight: '#9333ea' },
  ],
  forest: [
    { label: 'Leaf', glow: '#22c55e', glowLight: '#15803d' },
    { label: 'Mint', glow: '#4ade80', glowLight: '#16a34a' },
    { label: 'Lime', glow: '#bef264', glowLight: '#65a30d' },
    { label: 'Teal', glow: '#2dd4bf', glowLight: '#0d9488' },
    { label: 'Bark', glow: '#a8845a', glowLight: '#7a5c30' },
  ],
  ocean: [
    { label: 'Sky', glow: '#0ea5e9', glowLight: '#0369a1' },
    { label: 'Cyan', glow: '#22d3ee', glowLight: '#0891b2' },
    { label: 'Azure', glow: '#38bdf8', glowLight: '#0284c7' },
    { label: 'Seafoam', glow: '#2dd4bf', glowLight: '#0f766e' },
    { label: 'Coral', glow: '#fb923c', glowLight: '#ea580c' },
  ],
  sunset: [
    { label: 'Orange', glow: '#f97316', glowLight: '#c2410c' },
    { label: 'Peach', glow: '#fb923c', glowLight: '#ea580c' },
    { label: 'Marigold', glow: '#fcd34d', glowLight: '#ca8a04' },
    { label: 'Sienna', glow: '#dc6843', glowLight: '#b45030' },
    { label: 'Plum', glow: '#c084fc', glowLight: '#7c3aed' },
  ],
  violet: [
    { label: 'Iris', glow: '#a855f7', glowLight: '#7c3aed' },
    { label: 'Lilac', glow: '#c084fc', glowLight: '#9333ea' },
    { label: 'Fuchsia', glow: '#e879f9', glowLight: '#c026d3' },
    { label: 'Pink', glow: '#f472b6', glowLight: '#db2777' },
    { label: 'Indigo', glow: '#818cf8', glowLight: '#4f46e5' },
  ],
  slate: [
    { label: 'Steel', glow: '#64748b', glowLight: '#334155' },
    { label: 'Silver', glow: '#94a3b8', glowLight: '#475569' },
    { label: 'Smoke', glow: '#a1a1aa', glowLight: '#52525b' },
    { label: 'Graphite', glow: '#78716c', glowLight: '#44403c' },
    { label: 'Ice', glow: '#a5b4fc', glowLight: '#4f46e5' },
  ],
  midnight: [
    { label: 'Indigo', glow: '#818cf8', glowLight: '#4338ca' },
    { label: 'Periwinkle', glow: '#a5b4fc', glowLight: '#4f46e5' },
    { label: 'Lavender', glow: '#c4b5fd', glowLight: '#6d28d9' },
    { label: 'Azure', glow: '#93c5fd', glowLight: '#2563eb' },
    { label: 'Peach', glow: '#fdba74', glowLight: '#ea580c' },
  ],
};

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

// Default GUI colors for dark mode — Gold accent (matches DS v3)
export const DEFAULT_GUI_COLORS_DARK: GuiColors = {
  panelBackground: '#0A0908',
  panelBackgroundSecondary: '#12110F',
  textPrimary: '#EDE8E0',
  textSecondary: '#9E978D',
  accentPrimary: '#E5B95C',      // Warm Gold — primary interactive accent
  accentSecondary: '#C8963E',    // Gold glow — secondary/decorative
  toolbarIconDefault: '#5A554E',
  toolbarIconAccent: ['#E5B95C', '#E5B95C', '#E5B95C', '#E5B95C'],
}

// Default GUI colors for light mode — Gold accent (matches DS v3)
export const DEFAULT_GUI_COLORS_LIGHT: GuiColors = {
  panelBackground: '#FAFAF8',
  panelBackgroundSecondary: '#FFFFFF',
  textPrimary: '#1A1816',
  textSecondary: '#6B6560',
  accentPrimary: '#A67B30',      // Dark Gold — primary interactive accent
  accentSecondary: '#A67B30',    // Gold glow — secondary/decorative
  toolbarIconDefault: '#9E978D',
  toolbarIconAccent: ['#A67B30', '#A67B30', '#A67B30', '#A67B30'],
}

/** Canvas grid rendering style */
export type GridStyle = 'dots' | 'hash' | 'none';

// Font theme system — lazy-loaded web fonts
export type FontTheme = 'space-grotesk' | 'satoshi' | 'instrument' | 'general-sans';

export const FONT_THEMES: Record<FontTheme, { sans: string; display: string; mono: string; label: string }> = {
  'space-grotesk': {
    sans: "'Space Grotesk', system-ui, sans-serif",
    display: "'Space Grotesk', system-ui, sans-serif",
    mono: "'Space Mono', monospace",
    label: 'Space Grotesk',
  },
  'satoshi': {
    sans: "'Satoshi', system-ui, sans-serif",
    display: "'Satoshi', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
    label: 'Satoshi',
  },
  'instrument': {
    sans: "'Instrument Sans', system-ui, sans-serif",
    display: "'Instrument Serif', Georgia, serif",
    mono: "'JetBrains Mono', monospace",
    label: 'Instrument',
  },
  'general-sans': {
    sans: "'General Sans', system-ui, sans-serif",
    display: "'General Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
    label: 'General Sans',
  },
};

export const FONT_LOAD_URLS: Record<FontTheme, string> = {
  'space-grotesk': '',
  'satoshi': 'https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap',
  'instrument': 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap',
  'general-sans': 'https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap',
};

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
  edgeStyle?: EdgeStyle // Edge line shape style (default: 'smooth')
  // GUI colors - separate for dark and light modes
  guiColors?: GuiColors // Current active GUI colors (for backward compat)
  guiColorsDark?: GuiColors // Dark mode GUI colors
  guiColorsLight?: GuiColors // Light mode GUI colors
  // Behavior settings
  inheritParentStyle?: boolean // When node joins project, inherit parent's color (default: true)
  // Canvas grid style
  gridStyle?: GridStyle // Canvas grid rendering: 'dots' (default), 'hash', or 'none'
  // Layout settings
  layoutSpacing?: 'narrow' | 'default' | 'wide' // Spacing preset for auto-layout (default: 'default')
  // Physics simulation settings
  physicsEnabled?: boolean // Enable real-time spring physics for edge lengths (default: false)
  physicsIdealEdgeLength?: number // Target spring length in pixels (default: 120)
  physicsStrength?: 'gentle' | 'medium' | 'strong' // Physics force strength preset (default: 'medium')
  // Ambient canvas effects
  ambientEffect?: AmbientEffectSettings // Background animation settings
  // Canvas overlay effects
  livingGridEnabled?: boolean // Cursor-responsive dot grid with magnetic attraction (default: true)
  particleDriftEnabled?: boolean // Gold particles flowing along edge paths (default: true)
  // Glassmorphism settings
  glassSettings?: GlassSettings // Three-tier glassmorphism UI (solid, soft-blur, fluid-glass)
  // Font/size preferences
  fontTheme: FontTheme // Active font family preset (default: 'space-grotesk')
  fontSize: number // Base font size in px (default: 12, range 10-16)
  // Accent color theme
  accentTheme: AccentTheme // Active accent color preset (default: 'aurochs-gold')
  accentIndex?: number // Index into PRESET_ACCENT_PALETTES for current preset (default: 0)
  customAccentColor?: string // Hex color for custom accent theme
  themeSource?: 'system' | 'manual' // Whether mode follows OS preference (default: 'system')
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
  | 'dither-cursor'

export interface AmbientEffectSettings {
  /** Master toggle for ambient effects */
  enabled: boolean
  /** Which effect to display */
  effect: AmbientEffectType
  /** Bloom post-processing intensity (0-100, 0 = disabled) */
  bloomIntensity?: number
  /** Performance mode: auto (adaptive FPS), quality (max res), battery (min res + frame skip) */
  performanceMode?: 'auto' | 'quality' | 'battery'
  /** Per-effect native prop overrides, keyed by effect type */
  effectProps: Record<string, Record<string, unknown>>
}

export const DEFAULT_AMBIENT_EFFECT: AmbientEffectSettings = {
  enabled: true,
  effect: 'particles',
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
  default: '#4a5568', // gray-600 — muted default edge color
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
    conversation: '#3b82f6', // blue — primary, keep vivid
    project: '#7C7CAB', // muted violet
    note: '#f59e0b', // amber — primary, keep vivid
    task: '#6B9E84', // muted sage-green (warm)
    artifact: '#5A8EAB', // muted steel-blue (cool)
    workspace: '#AB6A6A', // muted rose
    text: '#94a3b8', // already muted, keep
    action: '#C4845A', // muted copper
    orchestrator: '#a855f7' // purple — primary, keep vivid
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
  gridStyle: 'dots',
  ambientEffect: DEFAULT_AMBIENT_EFFECT,
  livingGridEnabled: true,
  particleDriftEnabled: true,
  fontTheme: 'space-grotesk' as FontTheme,
  fontSize: 12,
  accentTheme: 'aurochs-gold' as AccentTheme,
  accentIndex: 0,
  themeSource: 'system' as const
}

export const LIGHT_THEME_DEFAULTS: Partial<ThemeSettings> = {
  mode: 'light',
  canvasBackground: 'linear-gradient(135deg, #fafbff 0%, #f5f3ff 50%, #fafbff 100%)',
  canvasGridColor: '#e2e4f0',
  canvasBackgroundLight: 'linear-gradient(135deg, #fafbff 0%, #f5f3ff 50%, #fafbff 100%)',
  canvasGridColorLight: '#e2e4f0'
}
