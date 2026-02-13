import type { ThemePreset, GuiColors } from '@shared/types'
import { DEFAULT_GLASS_SETTINGS } from '@shared/types'

// Default GUI colors for dark mode - cool blue-focused with rainbow accents
export const DEFAULT_GUI_DARK: GuiColors = {
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

// Default GUI colors for light mode - cool blue-focused with rainbow accents
export const DEFAULT_GUI_LIGHT: GuiColors = {
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

/**
 * Theme Presets for Cognograph
 *
 * Each preset includes carefully selected colors for both dark and light modes:
 * - Canvas background (solid color or CSS gradient)
 * - Canvas grid color
 * - 6 node type colors (conversation, project, note, task, artifact, workspace)
 * - Full GUI colors for panels and UI elements
 *
 * Design principles:
 * - Each theme has a distinct personality and mood
 * - Colors are harmonious within each theme
 * - Text colors ensure excellent readability
 * - Accent colors provide clear visual hierarchy
 */

export const THEME_PRESETS: ThemePreset[] = [
  // ============================================================================
  // 1. COGNO - Default theme with cool blue accent and rainbow node colors
  // ============================================================================
  {
    id: 'default',
    name: 'Cogno',
    description: 'Cool blue accent with vibrant rainbow nodes',
    glassSettings: {
      ...DEFAULT_GLASS_SETTINGS,
      userPreference: 'auto' // Professional default
    },
    dark: {
      canvasBackground: 'linear-gradient(135deg, #0d0d14 0%, #0f0f1a 50%, #0d0d14 100%)',
      canvasGridColor: '#1e1e2e',
      nodeColors: {
        conversation: '#3b82f6', // blue-500 (primary communication)
        project: '#a855f7', // purple-500 (organization)
        note: '#f59e0b', // amber-500 (ideas/notes)
        task: '#10b981', // emerald-500 (action)
        artifact: '#06b6d4', // cyan-500 (artifacts)
        workspace: '#ef4444', // red-500 (workspaces)
        text: '#94a3b8',
        action: '#f97316', // orange-500 (automation)
        orchestrator: '#8b5cf6' // violet-500
      },
      guiColors: DEFAULT_GUI_DARK
    },
    light: {
      canvasBackground: 'linear-gradient(135deg, #fafbff 0%, #f5f3ff 50%, #fafbff 100%)',
      canvasGridColor: '#e2e4f0',
      nodeColors: {
        conversation: '#2563eb', // blue-600
        project: '#9333ea', // purple-600
        note: '#d97706', // amber-600
        task: '#059669', // emerald-600
        artifact: '#0891b2', // cyan-600
        workspace: '#dc2626', // red-600
        text: '#64748b',
        action: '#ea580c', // orange-600
        orchestrator: '#7c3aed' // violet-600
      },
      guiColors: DEFAULT_GUI_LIGHT
    }
  },

  // ============================================================================
  // 2. CRIMSON - Bold cinematic red and rose
  // ============================================================================
  {
    id: 'crimson',
    name: 'Crimson',
    description: 'Bold cinematic reds and roses',
    glassSettings: {
      ...DEFAULT_GLASS_SETTINGS,
      userPreference: 'fluid-glass', // Dramatic cinematic glass
      blurRadius: 20,
      noiseOpacity: 8
    },
    dark: {
      canvasBackground: 'linear-gradient(160deg, #0f0a0c 0%, #1a0f14 50%, #0d0608 100%)',
      canvasGridColor: '#2d1f24',
      nodeColors: {
        conversation: '#fb7185', // rose-400
        project: '#e11d48', // rose-600
        note: '#fbbf24', // amber-400
        task: '#f97316', // orange-500
        artifact: '#f472b6', // pink-400
        workspace: '#a855f7', // purple-500
        text: '#94a3b8',
        action: '#fb923c', // orange-400
        orchestrator: '#c084fc' // purple-400
      },
      guiColors: {
        panelBackground: '#0f0a0c',
        panelBackgroundSecondary: '#1a1014',
        textPrimary: '#fdf2f4',
        textSecondary: '#fda4af',
        accentPrimary: '#fb7185',
        accentSecondary: '#e11d48',
        toolbarIconDefault: '#fda4af',
        toolbarIconAccent: ['#fb7185', '#fbbf24', '#f97316', '#f472b6']
      }
    },
    light: {
      canvasBackground: 'linear-gradient(160deg, #fff1f3 0%, #ffe4e8 50%, #fef2f2 100%)',
      canvasGridColor: '#fecdd3',
      nodeColors: {
        conversation: '#e11d48', // rose-600
        project: '#be123c', // rose-700
        note: '#b45309', // amber-700
        task: '#c2410c', // orange-700
        artifact: '#db2777', // pink-600
        workspace: '#7c3aed', // purple-600
        text: '#64748b',
        action: '#ea580c', // orange-600
        orchestrator: '#9333ea' // purple-600
      },
      guiColors: {
        panelBackground: '#ffffff',
        panelBackgroundSecondary: '#fff1f3',
        textPrimary: '#4c0519',
        textSecondary: '#9f1239',
        accentPrimary: '#e11d48',
        accentSecondary: '#be123c',
        toolbarIconDefault: '#9f1239',
        toolbarIconAccent: ['#e11d48', '#b45309', '#c2410c', '#db2777']
      }
    }
  },

  // ============================================================================
  // 3. FOREST - Natural deep green wilderness
  // ============================================================================
  {
    id: 'forest',
    name: 'Forest',
    description: 'Natural deep green wilderness',
    glassSettings: {
      ...DEFAULT_GLASS_SETTINGS,
      userPreference: 'solid' // Understated natural aesthetic
    },
    dark: {
      canvasBackground: 'linear-gradient(145deg, #071108 0%, #0c1a0e 50%, #061008 100%)',
      canvasGridColor: '#1e3324',
      nodeColors: {
        conversation: '#4ade80', // green-400
        project: '#22c55e', // green-500
        note: '#bef264', // lime-300
        task: '#86efac', // green-300
        artifact: '#2dd4bf', // teal-400
        workspace: '#f472b6', // pink-400
        text: '#94a3b8',
        action: '#fbbf24', // amber-400
        orchestrator: '#a78bfa' // violet-400
      },
      guiColors: {
        panelBackground: '#071108',
        panelBackgroundSecondary: '#0e1c10',
        textPrimary: '#ecfdf5',
        textSecondary: '#86efac',
        accentPrimary: '#4ade80',
        accentSecondary: '#22c55e',
        toolbarIconDefault: '#86efac',
        toolbarIconAccent: ['#4ade80', '#bef264', '#86efac', '#2dd4bf']
      }
    },
    light: {
      canvasBackground: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 50%, #ecfdf5 100%)',
      canvasGridColor: '#bbf7d0',
      nodeColors: {
        conversation: '#16a34a', // green-600
        project: '#15803d', // green-700
        note: '#65a30d', // lime-600
        task: '#059669', // emerald-600
        artifact: '#0d9488', // teal-600
        workspace: '#db2777', // pink-600
        text: '#64748b',
        action: '#d97706', // amber-600
        orchestrator: '#7c3aed' // violet-600
      },
      guiColors: {
        panelBackground: '#ffffff',
        panelBackgroundSecondary: '#f0fdf4',
        textPrimary: '#14532d',
        textSecondary: '#166534',
        accentPrimary: '#16a34a',
        accentSecondary: '#15803d',
        toolbarIconDefault: '#166534',
        toolbarIconAccent: ['#16a34a', '#65a30d', '#059669', '#0d9488']
      }
    }
  },

  // ============================================================================
  // 4. OCEAN - Deep aquatic blues and teals
  // ============================================================================
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep aquatic blues and teals',
    glassSettings: {
      ...DEFAULT_GLASS_SETTINGS,
      userPreference: 'auto' // Professional default
    },
    dark: {
      canvasBackground: 'linear-gradient(180deg, #030a1a 0%, #0c1929 50%, #041220 100%)',
      canvasGridColor: '#1a3048',
      nodeColors: {
        conversation: '#38bdf8', // sky-400
        project: '#0ea5e9', // sky-500
        note: '#22d3ee', // cyan-400
        task: '#67e8f9', // cyan-300
        artifact: '#2dd4bf', // teal-400
        workspace: '#ec4899', // pink-500
        text: '#94a3b8',
        action: '#fb923c', // orange-400
        orchestrator: '#a78bfa' // violet-400
      },
      guiColors: {
        panelBackground: '#030a1a',
        panelBackgroundSecondary: '#0c1929',
        textPrimary: '#e0f7ff',
        textSecondary: '#7dd3fc',
        accentPrimary: '#38bdf8',
        accentSecondary: '#0ea5e9',
        toolbarIconDefault: '#7dd3fc',
        toolbarIconAccent: ['#38bdf8', '#22d3ee', '#67e8f9', '#2dd4bf']
      }
    },
    light: {
      canvasBackground: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 50%, #ecfeff 100%)',
      canvasGridColor: '#bae6fd',
      nodeColors: {
        conversation: '#0284c7', // sky-600
        project: '#0369a1', // sky-700
        note: '#0891b2', // cyan-600
        task: '#0e7490', // cyan-700
        artifact: '#0f766e', // teal-700
        workspace: '#be185d', // pink-700
        text: '#64748b',
        action: '#ea580c', // orange-600
        orchestrator: '#7c3aed' // violet-600
      },
      guiColors: {
        panelBackground: '#ffffff',
        panelBackgroundSecondary: '#f0f9ff',
        textPrimary: '#0c4a6e',
        textSecondary: '#0369a1',
        accentPrimary: '#0284c7',
        accentSecondary: '#0369a1',
        toolbarIconDefault: '#0369a1',
        toolbarIconAccent: ['#0284c7', '#0891b2', '#0e7490', '#0f766e']
      }
    }
  },

  // ============================================================================
  // 5. SUNSET - Warm gradients of orange to pink
  // ============================================================================
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm gradients of orange to pink',
    glassSettings: {
      ...DEFAULT_GLASS_SETTINGS,
      userPreference: 'fluid-glass', // Dramatic warm glass
      blurRadius: 18,
      noiseOpacity: 10
    },
    dark: {
      canvasBackground: 'linear-gradient(135deg, #1a0f08 0%, #1c1008 40%, #1a0d10 100%)',
      canvasGridColor: '#3d2820',
      nodeColors: {
        conversation: '#fb923c', // orange-400
        project: '#f97316', // orange-500
        note: '#fcd34d', // amber-300
        task: '#fdba74', // orange-300
        artifact: '#f9a8d4', // pink-300
        workspace: '#c084fc', // purple-400
        text: '#94a3b8',
        action: '#ef4444', // red-500
        orchestrator: '#c084fc' // purple-400
      },
      guiColors: {
        panelBackground: '#1a0f08',
        panelBackgroundSecondary: '#251812',
        textPrimary: '#fef3c7',
        textSecondary: '#fdba74',
        accentPrimary: '#fb923c',
        accentSecondary: '#f97316',
        toolbarIconDefault: '#fdba74',
        toolbarIconAccent: ['#fb923c', '#fcd34d', '#fdba74', '#f9a8d4']
      }
    },
    light: {
      canvasBackground: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 40%, #fef2f2 100%)',
      canvasGridColor: '#fed7aa',
      nodeColors: {
        conversation: '#ea580c', // orange-600
        project: '#c2410c', // orange-700
        note: '#ca8a04', // amber-600
        task: '#d97706', // amber-600
        artifact: '#db2777', // pink-600
        workspace: '#7c3aed', // purple-600
        text: '#64748b',
        action: '#dc2626', // red-600
        orchestrator: '#9333ea' // purple-600
      },
      guiColors: {
        panelBackground: '#ffffff',
        panelBackgroundSecondary: '#fffbeb',
        textPrimary: '#78350f',
        textSecondary: '#b45309',
        accentPrimary: '#ea580c',
        accentSecondary: '#c2410c',
        toolbarIconDefault: '#b45309',
        toolbarIconAccent: ['#ea580c', '#ca8a04', '#d97706', '#db2777']
      }
    }
  },

  // ============================================================================
  // 6. VIOLET - Rich purple and magenta cosmic
  // ============================================================================
  {
    id: 'violet',
    name: 'Violet',
    description: 'Rich purple and magenta cosmic',
    glassSettings: {
      ...DEFAULT_GLASS_SETTINGS,
      userPreference: 'auto' // Professional default
    },
    dark: {
      canvasBackground: 'linear-gradient(155deg, #0f0a18 0%, #150d20 50%, #0d081a 100%)',
      canvasGridColor: '#2e2245',
      nodeColors: {
        conversation: '#c084fc', // purple-400
        project: '#a855f7', // purple-500
        note: '#f0abfc', // fuchsia-300
        task: '#d8b4fe', // purple-300
        artifact: '#f472b6', // pink-400
        workspace: '#22d3ee', // cyan-400
        text: '#94a3b8',
        action: '#fb923c', // orange-400
        orchestrator: '#e879f9' // fuchsia-400
      },
      guiColors: {
        panelBackground: '#0f0a18',
        panelBackgroundSecondary: '#181024',
        textPrimary: '#f5f0ff',
        textSecondary: '#d8b4fe',
        accentPrimary: '#c084fc',
        accentSecondary: '#a855f7',
        toolbarIconDefault: '#d8b4fe',
        toolbarIconAccent: ['#c084fc', '#f0abfc', '#d8b4fe', '#f472b6']
      }
    },
    light: {
      canvasBackground: 'linear-gradient(155deg, #faf5ff 0%, #f5f0ff 50%, #fdf4ff 100%)',
      canvasGridColor: '#e9d5ff',
      nodeColors: {
        conversation: '#9333ea', // purple-600
        project: '#7c3aed', // violet-600
        note: '#c026d3', // fuchsia-600
        task: '#a855f7', // purple-500
        artifact: '#db2777', // pink-600
        workspace: '#0891b2', // cyan-600
        text: '#64748b',
        action: '#ea580c', // orange-600
        orchestrator: '#c026d3' // fuchsia-600
      },
      guiColors: {
        panelBackground: '#ffffff',
        panelBackgroundSecondary: '#faf5ff',
        textPrimary: '#4c1d95',
        textSecondary: '#7c3aed',
        accentPrimary: '#9333ea',
        accentSecondary: '#7c3aed',
        toolbarIconDefault: '#7c3aed',
        toolbarIconAccent: ['#9333ea', '#c026d3', '#a855f7', '#db2777']
      }
    }
  },

  // ============================================================================
  // 7. SLATE - Sophisticated neutral monochrome
  // ============================================================================
  {
    id: 'slate',
    name: 'Slate',
    description: 'Sophisticated neutral monochrome',
    glassSettings: {
      ...DEFAULT_GLASS_SETTINGS,
      userPreference: 'solid' // Understated monochrome
    },
    dark: {
      canvasBackground: '#0c1017',
      canvasGridColor: '#1e2836',
      nodeColors: {
        conversation: '#94a3b8', // slate-400
        project: '#64748b', // slate-500
        note: '#a1a1aa', // zinc-400
        task: '#a8a29e', // stone-400
        artifact: '#9ca3af', // gray-400
        workspace: '#d4d4d8', // zinc-300
        text: '#94a3b8',
        action: '#78716c', // stone-500
        orchestrator: '#a1a1aa' // zinc-400
      },
      guiColors: {
        panelBackground: '#0c1017',
        panelBackgroundSecondary: '#141c26',
        textPrimary: '#e2e8f0',
        textSecondary: '#94a3b8',
        accentPrimary: '#94a3b8',
        accentSecondary: '#64748b',
        toolbarIconDefault: '#94a3b8',
        toolbarIconAccent: ['#94a3b8', '#a1a1aa', '#a8a29e', '#9ca3af']
      }
    },
    light: {
      canvasBackground: '#f8fafc',
      canvasGridColor: '#cbd5e1',
      nodeColors: {
        conversation: '#475569', // slate-600
        project: '#334155', // slate-700
        note: '#52525b', // zinc-600
        task: '#57534e', // stone-600
        artifact: '#4b5563', // gray-600
        workspace: '#3f3f46', // zinc-700
        text: '#64748b',
        action: '#44403c', // stone-700
        orchestrator: '#52525b' // zinc-600
      },
      guiColors: {
        panelBackground: '#ffffff',
        panelBackgroundSecondary: '#f8fafc',
        textPrimary: '#1e293b',
        textSecondary: '#475569',
        accentPrimary: '#475569',
        accentSecondary: '#334155',
        toolbarIconDefault: '#475569',
        toolbarIconAccent: ['#475569', '#52525b', '#57534e', '#4b5563']
      }
    }
  },

  // ============================================================================
  // 8. MIDNIGHT - Deep indigo starlit night
  // ============================================================================
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep indigo starlit night',
    glassSettings: {
      ...DEFAULT_GLASS_SETTINGS,
      userPreference: 'auto' // Professional default
    },
    dark: {
      canvasBackground: 'linear-gradient(180deg, #07081a 0%, #0d0f28 50%, #050614 100%)',
      canvasGridColor: '#252855',
      nodeColors: {
        conversation: '#a5b4fc', // indigo-300
        project: '#818cf8', // indigo-400
        note: '#c4b5fd', // violet-300
        task: '#93c5fd', // blue-300
        artifact: '#e0e7ff', // indigo-200
        workspace: '#f9a8d4', // pink-300
        text: '#94a3b8',
        action: '#fdba74', // orange-300
        orchestrator: '#c4b5fd' // violet-300
      },
      guiColors: {
        panelBackground: '#07081a',
        panelBackgroundSecondary: '#0d1025',
        textPrimary: '#e0e7ff',
        textSecondary: '#a5b4fc',
        accentPrimary: '#a5b4fc',
        accentSecondary: '#818cf8',
        toolbarIconDefault: '#a5b4fc',
        toolbarIconAccent: ['#a5b4fc', '#c4b5fd', '#93c5fd', '#e0e7ff']
      }
    },
    light: {
      canvasBackground: 'linear-gradient(180deg, #eef2ff 0%, #e0e7ff 50%, #f5f3ff 100%)',
      canvasGridColor: '#c7d2fe',
      nodeColors: {
        conversation: '#4f46e5', // indigo-600
        project: '#4338ca', // indigo-700
        note: '#6d28d9', // violet-700
        task: '#2563eb', // blue-600
        artifact: '#6366f1', // indigo-500
        workspace: '#db2777', // pink-600
        text: '#64748b',
        action: '#ea580c', // orange-600
        orchestrator: '#7c3aed' // violet-600
      },
      guiColors: {
        panelBackground: '#ffffff',
        panelBackgroundSecondary: '#eef2ff',
        textPrimary: '#312e81',
        textSecondary: '#4338ca',
        accentPrimary: '#4f46e5',
        accentSecondary: '#4338ca',
        toolbarIconDefault: '#4338ca',
        toolbarIconAccent: ['#4f46e5', '#6d28d9', '#2563eb', '#6366f1']
      }
    }
  }
]

// Helper to find a preset by ID
export function getThemePresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => preset.id === id)
}

// Get preset colors for a specific mode
export function getPresetColors(presetId: string, mode: 'dark' | 'light') {
  const preset = getThemePresetById(presetId)
  if (!preset) return null
  return mode === 'dark' ? preset.dark : preset.light
}
