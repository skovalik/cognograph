import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { Palette, Sun, Moon, ChevronDown, ChevronRight, Settings, Sparkles, GitBranch } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useProgramStore } from '../stores/programStore'
import { THEME_PRESETS } from '../constants/themePresets'
import { performThemeTransition, performPresetTransition } from '../utils/themeTransition'
import { EFFECTS_BY_CATEGORY } from './ambient/effectRegistry'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { DEFAULT_GLASS_SETTINGS, DEFAULT_AMBIENT_EFFECT, type ThemeMode, type GlassStyle, type EdgeStyle } from '@shared/types'

interface ThemeMenuProps {
  onOpenAdvancedSettings: () => void
  externalOpen?: boolean // For keyboard shortcut control
  onExternalOpenChange?: (open: boolean) => void
}

// Glass style display labels (outcome-based, not technical)
const GLASS_MODE_LABELS: Record<GlassStyle, string> = {
  'auto': 'Automatic',
  'fluid-glass': 'Immersive',
  'soft-blur': 'Subtle',
  'solid': 'Minimal'
}

// Edge style options (matches ThemeSettingsModal)
const EDGE_STYLE_OPTIONS: { value: EdgeStyle; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'smooth', label: 'Smooth' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'rounded', label: 'Rounded' }
]

/**
 * Theme Menu Dropdown
 *
 * Quick access to theme settings:
 * - Dark/Light toggle (primary)
 * - Recent presets (3, collapsible to show all 8)
 * - Glass style radio (4 options)
 * - "More settings..." link to modal
 *
 * Keyboard shortcut: Cmd+T
 */
export const ThemeMenu = memo<ThemeMenuProps>(({ onOpenAdvancedSettings, externalOpen, onExternalOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const [showAllPresets, setShowAllPresets] = useState(false)
  const [isFirstTimeHover, setIsFirstTimeHover] = useState(false)

  // Use external control if provided, otherwise internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof value === 'function' ? value(open) : value
    if (onExternalOpenChange) {
      onExternalOpenChange(newValue)
    } else {
      setInternalOpen(newValue)
    }
  }, [open, onExternalOpenChange])

  // Theme state
  const themeMode = useWorkspaceStore((state) => state.themeSettings.mode)
  const currentPresetId = useWorkspaceStore((state) => state.themeSettings.currentPresetId)
  const glassSettings = useWorkspaceStore((state) => state.themeSettings.glassSettings)
  const ambientEffect = useWorkspaceStore((state) => state.themeSettings.ambientEffect)
  const edgeStyle = useWorkspaceStore((state) => state.themeSettings.edgeStyle || 'rounded')
  const setThemeMode = useWorkspaceStore((state) => state.setThemeMode)
  const applyThemePreset = useWorkspaceStore((state) => state.applyThemePreset)
  const updateThemeSettings = useWorkspaceStore((state) => state.updateThemeSettings)
  const setEdgeStyle = useWorkspaceStore((state) => state.setEdgeStyle)

  // Recent presets tracking (stored in programStore for persistence across workspaces)
  const recentPresetIds = useProgramStore((state) => state.recentThemePresets || [])
  const addRecentPreset = useProgramStore((state) => state.addRecentThemePreset)

  // First-time tooltip state (stored in programStore)
  const hasSeenThemeMenuTooltip = useProgramStore((state) => state.hasSeenThemeMenuTooltip)
  const markThemeMenuTooltipSeen = useProgramStore((state) => state.markThemeMenuTooltipSeen)

  // Get recent presets (3 most recent, excluding current)
  const recentPresets = THEME_PRESETS
    .filter(p => recentPresetIds.includes(p.id) && p.id !== currentPresetId)
    .sort((a, b) => recentPresetIds.indexOf(a.id) - recentPresetIds.indexOf(b.id))
    .slice(0, 3)

  // Get remaining presets (all others)
  const remainingPresets = THEME_PRESETS.filter(
    p => !recentPresets.find(rp => rp.id === p.id) && p.id !== currentPresetId
  )

  /**
   * Toggle dark/light mode with optional click-origin circular reveal.
   * @param event - Mouse event for click-origin transition (keyboard = center fade)
   */
  const handleThemeModeToggle = useCallback((event?: React.MouseEvent) => {
    const newMode: ThemeMode = themeMode === 'dark' ? 'light' : 'dark'
    performThemeTransition(newMode, event)
  }, [themeMode])

  // Select theme preset with transition and tracking
  const handlePresetSelect = useCallback((presetId: string) => {
    performPresetTransition(presetId)
    addRecentPreset(presetId)
  }, [addRecentPreset])

  // Update glass style directly in store (with debouncing handled by store)
  const handleGlassStyleChange = useCallback((style: GlassStyle) => {
    // Direct update to workspaceStore.themeSettings.glassSettings
    useWorkspaceStore.setState((state) => ({
      themeSettings: {
        ...state.themeSettings,
        glassSettings: {
          ...DEFAULT_GLASS_SETTINGS,
          ...state.themeSettings.glassSettings,
          userPreference: style
        }
      }
    }))
  }, [])

  // Select ambient effect
  const handleEffectSelect = useCallback((effectId: string) => {
    const current = ambientEffect ?? DEFAULT_AMBIENT_EFFECT
    if (effectId === 'none') {
      updateThemeSettings({ ambientEffect: { ...current, effect: 'none', enabled: false } })
    } else {
      updateThemeSettings({ ambientEffect: { ...current, effect: effectId as any, enabled: true } })
    }
  }, [ambientEffect, updateThemeSettings])

  // Mark first-time tooltip as seen on hover
  const handleFirstHover = useCallback(() => {
    if (!hasSeenThemeMenuTooltip) {
      setIsFirstTimeHover(true)
      // Mark as seen after 2 seconds
      setTimeout(() => {
        markThemeMenuTooltipSeen()
      }, 2000)
    }
  }, [hasSeenThemeMenuTooltip, markThemeMenuTooltipSeen])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              className="p-2 gui-button rounded transition-colors group"
              aria-label="Theme & Appearance (Cmd+T)"
              onMouseEnter={handleFirstHover}
            >
              <Palette
                className="w-5 h-5 group-hover:brightness-125"
                style={{ color: 'var(--gui-toolbar-icon-default)' }}
              />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <div>Theme & Appearance (Cmd+T)</div>
          {isFirstTimeHover && !hasSeenThemeMenuTooltip && (
            <div className="text-xs text-muted-foreground mt-1">
              Customize your theme here
            </div>
          )}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-56">
        {/* Dark/Light Toggle - Primary action */}
        <div className="p-1">
          <button
            onClick={(e) => handleThemeModeToggle(e)}
            className="w-full flex items-center justify-between px-2 py-3 rounded-md gui-button hover:bg-[var(--surface-panel-secondary)] transition-colors"
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
          >
            <div className="flex items-center gap-2">
              {themeMode === 'dark' ? (
                <>
                  <Moon className="w-4 h-4" />
                  <span className="font-medium">Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4" />
                  <span className="font-medium">Light Mode</span>
                </>
              )}
            </div>
            <span className="text-xs text-[var(--text-muted)]">D</span>
          </button>
        </div>

        <DropdownMenuSeparator />

        {/* Recent Presets (3 most recent) */}
        {recentPresets.length > 0 && (
          <>
            <DropdownMenuLabel>Recent Themes</DropdownMenuLabel>
            {recentPresets.map((preset) => {
              const isActive = currentPresetId === preset.id
              return (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={isActive ? 'font-medium' : ''}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className="w-4 h-4 rounded border border-[var(--border-subtle)]"
                      style={{
                        background: themeMode === 'dark'
                          ? preset.dark.nodeColors.conversation
                          : preset.light.nodeColors.conversation
                      }}
                    />
                    <span>{preset.name}</span>
                  </div>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
          </>
        )}

        {/* All Presets (collapsible) */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="w-4 h-4 mr-2" />
            All Themes
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {THEME_PRESETS.map((preset) => {
              const isActive = currentPresetId === preset.id
              return (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={isActive ? 'font-medium' : ''}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className="w-4 h-4 rounded border border-[var(--border-subtle)]"
                      style={{
                        background: themeMode === 'dark'
                          ? preset.dark.nodeColors.conversation
                          : preset.light.nodeColors.conversation
                      }}
                    />
                    <span>{preset.name}</span>
                  </div>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Glass Style Radio */}
        <DropdownMenuLabel>Glass Style</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={glassSettings?.userPreference || 'auto'}
          onValueChange={(value) => handleGlassStyleChange(value as GlassStyle)}
        >
          {(['auto', 'fluid-glass', 'soft-blur', 'solid'] as GlassStyle[]).map((style) => (
            <DropdownMenuRadioItem key={style} value={style}>
              {GLASS_MODE_LABELS[style]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Canvas Effects Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sparkles className="w-4 h-4 mr-2" />
            Canvas Effects
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48 max-h-80 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => handleEffectSelect('none')}
              className={!ambientEffect?.enabled ? 'font-medium' : ''}
            >
              None
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {EFFECTS_BY_CATEGORY.map(({ category, effects }) => (
              <div key={category}>
                <DropdownMenuLabel className="text-[10px]">{category}</DropdownMenuLabel>
                {effects.map((entry) => {
                  const isActive = ambientEffect?.enabled && ambientEffect.effect === entry.id
                  return (
                    <DropdownMenuItem
                      key={entry.id}
                      onClick={() => handleEffectSelect(entry.id)}
                      className={isActive ? 'font-medium' : ''}
                    >
                      <span className="w-5 text-center text-[10px] mr-1.5 opacity-60">{entry.icon}</span>
                      {entry.name}
                    </DropdownMenuItem>
                  )
                })}
              </div>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Edge Shape Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <GitBranch className="w-4 h-4 mr-2" />
            Edge Shape
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <DropdownMenuRadioGroup
              value={edgeStyle}
              onValueChange={(value) => setEdgeStyle(value as EdgeStyle)}
            >
              {EDGE_STYLE_OPTIONS.map(({ value, label }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* More Settings Link */}
        <DropdownMenuItem onClick={() => {
          setOpen(false)
          onOpenAdvancedSettings()
        }}>
          <Settings className="w-4 h-4 mr-2" />
          More Settings...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

ThemeMenu.displayName = 'ThemeMenu'
