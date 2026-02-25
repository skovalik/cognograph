import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { X, Settings, Monitor, Palette, Layout, FolderOpen, Info, Coins, Brain, SlidersHorizontal, Accessibility, Eye, Volume2, Keyboard, Save, Download, Upload, BarChart3 } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useProgramStore, type ReduceMotionPreference } from '../stores/programStore'
import { useShortcutHelpStore } from './KeyboardShortcutsHelp'
import { ConnectorsTab } from './Settings/ConnectorsTab'
import { DefaultPropertySettings } from './Settings/DefaultPropertySettings'
import { KeyboardSettings } from './Settings/KeyboardSettings'
import { GlassSettingsSection } from './Settings/GlassSettingsSection'
import { UsageStats } from './UsageStats'
import { Switch } from './ui/switch'
import { Slider } from './ui/slider'
import { createFocusTrap } from '../utils/accessibility'
import { performThemeTransition } from '../utils/themeTransition'
import type { PropertiesDisplayMode, ChatDisplayMode, ExtractionSettings, GlassSettings } from '@shared/types'
import { DEFAULT_EXTRACTION_SETTINGS, DEFAULT_GLASS_SETTINGS, CONNECTOR_PROVIDER_INFO, type ConnectorProvider } from '@shared/types'
import { logger } from '../utils/logger'
import { getPluginSettingsTabs } from '@plugins/renderer-registry'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type SettingsCategory = 'workspace' | 'ai' | 'preferences' | 'keyboard' | 'defaults' | 'usage' | `plugin:${string}`

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

// -----------------------------------------------------------------------------
// SettingsModal Component
// -----------------------------------------------------------------------------

function SettingsModalComponent({ isOpen, onClose }: SettingsModalProps): JSX.Element | null {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('workspace')

  // Theme settings
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const setAIPaletteEnabled = useWorkspaceStore((state) => state.setAIPaletteEnabled)

  // Display mode settings
  const workspacePreferences = useWorkspaceStore((state) => state.workspacePreferences)
  const setPropertiesDisplayMode = useWorkspaceStore((state) => state.setPropertiesDisplayMode)
  const setChatDisplayMode = useWorkspaceStore((state) => state.setChatDisplayMode)
  const setPropertiesSidebarWidth = useWorkspaceStore((state) => state.setPropertiesSidebarWidth)
  const setShowTokenEstimates = useWorkspaceStore((state) => state.setShowTokenEstimates)

  // Accessibility settings (program-level)
  const accessibilitySettings = useProgramStore((state) => state.accessibility)
  const setReduceMotion = useProgramStore((state) => state.setReduceMotion)
  const setHighContrastFocus = useProgramStore((state) => state.setHighContrastFocus)
  const setAnnounceActions = useProgramStore((state) => state.setAnnounceActions)

  // Auto-save settings (program-level)
  const autoSave = useProgramStore((state) => state.autoSave)
  const setAutoSaveEnabled = useProgramStore((state) => state.setAutoSaveEnabled)
  const setAutoSaveInterval = useProgramStore((state) => state.setAutoSaveInterval)

  // Workspace settings
  const workspaceName = useWorkspaceStore((state) => state.workspaceName)
  const updateWorkspaceName = useWorkspaceStore((state) => state.updateWorkspaceName)
  const leftSidebarWidth = useWorkspaceStore((state) => state.leftSidebarWidth)
  const setLeftSidebarWidth = useWorkspaceStore((state) => state.setLeftSidebarWidth)
  const contextSettings = useWorkspaceStore((state) => state.contextSettings)

  // Handlers
  const handleThemeModeChange = useCallback((mode: 'dark' | 'light', event?: React.MouseEvent) => {
    performThemeTransition(mode, event)
  }, [])

  const handleAIPaletteToggle = useCallback(() => {
    setAIPaletteEnabled(!themeSettings.aiPaletteEnabled)
  }, [setAIPaletteEnabled, themeSettings.aiPaletteEnabled])

  const handleGlassSettingsChange = useCallback((updates: Partial<GlassSettings>) => {
    logger.log('[SETTINGS] handleGlassSettingsChange called with:', updates)
    const currentGlass = themeSettings.glassSettings ?? DEFAULT_GLASS_SETTINGS
    logger.log('[SETTINGS] Current glass settings:', currentGlass)
    // Ensure all fields have defaults — protects against partial/corrupted glassSettings
    const currentApplyTo = currentGlass.applyTo ?? DEFAULT_GLASS_SETTINGS.applyTo
    const newGlassSettings = {
      ...DEFAULT_GLASS_SETTINGS,
      ...currentGlass,
      ...updates,
      applyTo: updates.applyTo
        ? { ...DEFAULT_GLASS_SETTINGS.applyTo, ...currentApplyTo, ...updates.applyTo }
        : { ...DEFAULT_GLASS_SETTINGS.applyTo, ...currentApplyTo }
    }
    logger.log('[SETTINGS] New glass settings:', newGlassSettings)
    useWorkspaceStore.setState((state) => ({
      themeSettings: {
        ...state.themeSettings,
        glassSettings: newGlassSettings
      },
      isDirty: true
    }))
    logger.log('[SETTINGS] State updated, isDirty set to true')
  }, [themeSettings.glassSettings])

  const handlePropertiesDisplayModeChange = useCallback((mode: PropertiesDisplayMode) => {
    setPropertiesDisplayMode(mode)
  }, [setPropertiesDisplayMode])

  const handleChatDisplayModeChange = useCallback((mode: ChatDisplayMode) => {
    setChatDisplayMode(mode)
  }, [setChatDisplayMode])

  const handleReduceMotionChange = useCallback((preference: ReduceMotionPreference) => {
    setReduceMotion(preference)
  }, [setReduceMotion])

  const handleHighContrastFocusToggle = useCallback(() => {
    setHighContrastFocus(!accessibilitySettings.highContrastFocus)
  }, [setHighContrastFocus, accessibilitySettings.highContrastFocus])

  const handleAnnounceActionsToggle = useCallback(() => {
    setAnnounceActions(!accessibilitySettings.announceActions)
  }, [setAnnounceActions, accessibilitySettings.announceActions])

  const handleTokenEstimatesToggle = useCallback(() => {
    setShowTokenEstimates(!workspacePreferences.showTokenEstimates)
  }, [setShowTokenEstimates, workspacePreferences.showTokenEstimates])

  const handleWorkspaceNameChange = useCallback((name: string) => {
    updateWorkspaceName(name)
  }, [updateWorkspaceName])

  const handleContextDepthChange = useCallback((depth: number) => {
    useWorkspaceStore.setState((state) => ({
      contextSettings: { ...state.contextSettings, globalDepth: depth },
      isDirty: true
    }))
  }, [])

  const handlePropertiesSidebarWidthChange = useCallback((width: number) => {
    setPropertiesSidebarWidth(width)
  }, [setPropertiesSidebarWidth])

  const handlePhysicsEnabledChange = useCallback((enabled: boolean) => {
    useWorkspaceStore.setState((state) => ({
      themeSettings: { ...state.themeSettings, physicsEnabled: enabled },
      isDirty: true
    }))
  }, [])

  const handlePhysicsEdgeLengthChange = useCallback((length: number) => {
    useWorkspaceStore.setState((state) => ({
      themeSettings: { ...state.themeSettings, physicsIdealEdgeLength: length },
      isDirty: true
    }))
  }, [])

  const handlePhysicsStrengthChange = useCallback((strength: 'gentle' | 'medium' | 'strong') => {
    useWorkspaceStore.setState((state) => ({
      themeSettings: { ...state.themeSettings, physicsStrength: strength },
      isDirty: true
    }))
  }, [])

  const handleLeftSidebarWidthChange = useCallback((width: number) => {
    setLeftSidebarWidth(width)
  }, [setLeftSidebarWidth])

  // Focus trap and keyboard handling
  const modalRef = useRef<HTMLDivElement>(null)
  const focusTrapRef = useRef<ReturnType<typeof createFocusTrap> | null>(null)

  useEffect(() => {
    if (isOpen && modalRef.current) {
      focusTrapRef.current = createFocusTrap(modalRef.current)
      focusTrapRef.current.activate()
    }
    return () => {
      focusTrapRef.current?.deactivate()
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const navItems: Array<{ id: SettingsCategory; label: string; icon: typeof Monitor }> = [
    { id: 'workspace', label: 'Workspace', icon: FolderOpen },
    { id: 'ai', label: 'AI & Connectors', icon: Brain },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
    { id: 'defaults', label: 'Defaults', icon: Layout },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
  ]

  // Get plugin settings tabs from registry
  const pluginTabs = getPluginSettingsTabs()

  return (
    <div className="fixed inset-0 gui-z-modals flex items-center justify-center pointer-events-none">
      <div ref={modalRef} className="gui-modal glass-fluid w-[680px] max-h-[80vh] flex flex-col pointer-events-auto" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        {/* Header */}
        <div className="gui-panel-header p-4">
          <div className="gui-panel-header-title">
            <Settings className="w-5 h-5" style={{ color: 'var(--gui-accent-secondary)' }} />
            <h2 id="settings-modal-title" className="font-semibold gui-text">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="gui-btn gui-btn-ghost gui-btn-icon rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Navigation */}
          <div className="w-48 border-r gui-border p-2 space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveCategory(id)}
                className={`gui-nav-item w-full ${activeCategory === id ? 'gui-nav-item-active' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            {pluginTabs.length > 0 && (
              <>
                <div className="my-2 border-t gui-border" />
                {pluginTabs.map(tab => {
                  const isActive = activeCategory === `plugin:${tab.pluginId}`
                  return (
                    <button
                      key={tab.pluginId}
                      onClick={() => setActiveCategory(`plugin:${tab.pluginId}` as SettingsCategory)}
                      className={`gui-nav-item w-full ${isActive ? 'gui-nav-item-active' : ''}`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </>
            )}
          </div>

          {/* Right: Settings content */}
          <div className="flex-1 p-4 overflow-y-auto" style={{ minHeight: '400px' }}>
            {activeCategory === 'workspace' && (
              <WorkspaceSettings
                workspaceName={workspaceName}
                contextDepth={contextSettings.globalDepth}
                propertiesSidebarWidth={workspacePreferences.propertiesSidebarWidth}
                leftSidebarWidth={leftSidebarWidth}
                physicsEnabled={themeSettings.physicsEnabled ?? false}
                physicsIdealEdgeLength={themeSettings.physicsIdealEdgeLength ?? 120}
                physicsStrength={themeSettings.physicsStrength ?? 'medium'}
                onWorkspaceNameChange={handleWorkspaceNameChange}
                onContextDepthChange={handleContextDepthChange}
                onPropertiesSidebarWidthChange={handlePropertiesSidebarWidthChange}
                onLeftSidebarWidthChange={handleLeftSidebarWidthChange}
                onPhysicsEnabledChange={handlePhysicsEnabledChange}
                onPhysicsEdgeLengthChange={handlePhysicsEdgeLengthChange}
                onPhysicsStrengthChange={handlePhysicsStrengthChange}
              />
            )}
            {activeCategory === 'ai' && (
              <AISettings />
            )}
            {activeCategory === 'preferences' && (
              <PreferencesSettings
                reduceMotion={accessibilitySettings.reduceMotion}
                highContrastFocus={accessibilitySettings.highContrastFocus}
                announceActions={accessibilitySettings.announceActions}
                autoSaveEnabled={autoSave.enabled}
                autoSaveIntervalMs={autoSave.intervalMs}
                glassSettings={themeSettings.glassSettings ?? DEFAULT_GLASS_SETTINGS}
                ambientEnabled={themeSettings.ambientEffect?.enabled ?? false}
                onReduceMotionChange={handleReduceMotionChange}
                onHighContrastFocusToggle={handleHighContrastFocusToggle}
                onAnnounceActionsToggle={handleAnnounceActionsToggle}
                onAutoSaveEnabledChange={setAutoSaveEnabled}
                onAutoSaveIntervalChange={setAutoSaveInterval}
                onGlassSettingsChange={handleGlassSettingsChange}
              />
            )}
            {activeCategory === 'keyboard' && (
              <div>
                <h3 className="text-lg font-semibold gui-text-primary mb-2">Keyboard Shortcuts</h3>
                <p className="text-sm gui-text-secondary mb-4">
                  Customize keyboard shortcuts for all actions
                </p>
                <KeyboardSettings />
              </div>
            )}
            {activeCategory === 'defaults' && (
              <DefaultPropertySettings />
            )}
            {activeCategory === 'usage' && (
              <UsageStats />
            )}

            {activeCategory.startsWith('plugin:') && (() => {
              const pluginId = activeCategory.slice('plugin:'.length)
              const tab = pluginTabs.find(t => t.pluginId === pluginId)
              return tab?.render() ?? null
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t gui-border">
          <button
            onClick={onClose}
            className="gui-btn gui-btn-accent"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Toggle helper
// -----------------------------------------------------------------------------

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }): JSX.Element {
  return (
    <Switch
      checked={enabled}
      onCheckedChange={onToggle}
    />
  )
}

// -----------------------------------------------------------------------------
// Option button helper (for theme mode, display mode selectors)
// -----------------------------------------------------------------------------

function OptionButton({ selected, onClick, children }: {
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded border text-sm transition-colors ${
        selected
          ? 'gui-btn-accent'
          : 'gui-card'
      }`}
    >
      {children}
    </button>
  )
}

// -----------------------------------------------------------------------------
// Preferences Settings Section (merged Keyboard + Accessibility + Auto-save)
// -----------------------------------------------------------------------------

interface PreferencesSettingsProps {
  reduceMotion: ReduceMotionPreference
  highContrastFocus: boolean
  announceActions: boolean
  autoSaveEnabled: boolean
  autoSaveIntervalMs: number
  glassSettings: GlassSettings
  ambientEnabled: boolean
  onReduceMotionChange: (preference: ReduceMotionPreference) => void
  onHighContrastFocusToggle: () => void
  onAnnounceActionsToggle: () => void
  onAutoSaveEnabledChange: (enabled: boolean) => void
  onAutoSaveIntervalChange: (intervalMs: number) => void
  onGlassSettingsChange: (updates: Partial<GlassSettings>) => void
}

function PreferencesSettings({
  reduceMotion,
  highContrastFocus,
  announceActions,
  autoSaveEnabled,
  autoSaveIntervalMs,
  glassSettings,
  ambientEnabled,
  onReduceMotionChange,
  onHighContrastFocusToggle,
  onAnnounceActionsToggle,
  onAutoSaveEnabledChange,
  onAutoSaveIntervalChange,
  onGlassSettingsChange,
}: PreferencesSettingsProps): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium gui-text mb-1">Preferences</h3>
        <p className="text-xs gui-text-secondary">
          Accessibility and auto-save settings
        </p>
      </div>

      {/* Accessibility Section */}
      <div className="pt-4 border-t gui-border">
        <h4 className="text-sm font-medium gui-text mb-4 flex items-center gap-2">
          <Accessibility className="w-4 h-4" />
          Accessibility
        </h4>

        {/* Reduce Motion */}
        <div className="mb-4">
          <label className="block text-sm font-medium gui-text mb-2">
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Reduce Motion
            </span>
          </label>
          <div className="flex gap-2">
            <OptionButton
              selected={reduceMotion === 'system'}
              onClick={() => onReduceMotionChange('system')}
            >
              Follow OS
            </OptionButton>
            <OptionButton
              selected={reduceMotion === 'always'}
              onClick={() => onReduceMotionChange('always')}
            >
              Always
            </OptionButton>
            <OptionButton
              selected={reduceMotion === 'never'}
              onClick={() => onReduceMotionChange('never')}
            >
              Never
            </OptionButton>
          </div>
          <p className="text-xs gui-text-secondary mt-1">
            Control animations and transitions. "Follow OS" respects your system preference.
          </p>
        </div>

        {/* High Contrast Focus */}
        <div className="mb-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium gui-text flex items-center gap-2">
              <Eye className="w-4 h-4" />
              High Contrast Focus
            </span>
            <ToggleSwitch enabled={highContrastFocus} onToggle={onHighContrastFocusToggle} />
          </label>
          <p className="text-xs gui-text-secondary mt-1">
            Thicker, more visible focus rings for keyboard navigation.
          </p>
        </div>

        {/* Announce Actions */}
        <div>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium gui-text flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Announce Actions
            </span>
            <ToggleSwitch enabled={announceActions} onToggle={onAnnounceActionsToggle} />
          </label>
          <p className="text-xs gui-text-secondary mt-1">
            Announce important actions to screen readers.
          </p>
        </div>
      </div>

      {/* Auto-save Section */}
      <div className="pt-4 border-t gui-border">
        <div>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium gui-text flex items-center gap-2">
              <Save className="w-4 h-4" />
              Auto-save
            </span>
            <ToggleSwitch enabled={autoSaveEnabled} onToggle={() => onAutoSaveEnabledChange(!autoSaveEnabled)} />
          </label>
          <p className="text-xs gui-text-secondary mt-1">
            Automatically save workspace changes.
          </p>
        </div>

        {autoSaveEnabled && (
          <div className="mt-3">
            <label className="block text-sm gui-text mb-2">
              Save interval: {Math.round(autoSaveIntervalMs / 1000)}s
            </label>
            <Slider
              min={2000}
              max={60000}
              step={1000}
              value={[autoSaveIntervalMs]}
              onValueChange={(values) => onAutoSaveIntervalChange(values[0] ?? autoSaveIntervalMs)}
              className="w-full"
            />
            <div className="flex justify-between text-xs gui-text-secondary mt-1">
              <span>2s (Frequent)</span>
              <span>60s (Relaxed)</span>
            </div>
          </div>
        )}
      </div>

      {/* Glass Settings Section */}
      <GlassSettingsSection
        glassSettings={glassSettings}
        ambientEnabled={ambientEnabled}
        onGlassSettingsChange={onGlassSettingsChange}
      />
    </div>
  )
}

// -----------------------------------------------------------------------------
// Program Settings Section (DEPRECATED - kept for reference)
// -----------------------------------------------------------------------------

interface ProgramSettingsProps {
  themeMode: 'dark' | 'light'
  aiPaletteEnabled: boolean
  glassSettings: GlassSettings
  ambientEnabled: boolean
  showTokenEstimates: boolean
  propertiesDisplayMode: PropertiesDisplayMode
  chatDisplayMode: ChatDisplayMode
  reduceMotion: ReduceMotionPreference
  highContrastFocus: boolean
  announceActions: boolean
  autoSaveEnabled: boolean
  autoSaveIntervalMs: number
  onThemeModeChange: (mode: 'dark' | 'light', event?: React.MouseEvent) => void
  onAIPaletteToggle: () => void
  onGlassSettingsChange: (updates: Partial<GlassSettings>) => void
  onTokenEstimatesToggle: () => void
  onPropertiesDisplayModeChange: (mode: PropertiesDisplayMode) => void
  onChatDisplayModeChange: (mode: ChatDisplayMode) => void
  onReduceMotionChange: (preference: ReduceMotionPreference) => void
  onHighContrastFocusToggle: () => void
  onAnnounceActionsToggle: () => void
  onAutoSaveEnabledChange: (enabled: boolean) => void
  onAutoSaveIntervalChange: (intervalMs: number) => void
  onClose: () => void
}

function ProgramSettings({
  themeMode,
  aiPaletteEnabled,
  glassSettings,
  ambientEnabled,
  showTokenEstimates,
  propertiesDisplayMode,
  chatDisplayMode,
  reduceMotion,
  highContrastFocus,
  announceActions,
  autoSaveEnabled,
  autoSaveIntervalMs,
  onThemeModeChange,
  onAIPaletteToggle,
  onGlassSettingsChange,
  onTokenEstimatesToggle,
  onPropertiesDisplayModeChange,
  onChatDisplayModeChange,
  onReduceMotionChange,
  onHighContrastFocusToggle,
  onAnnounceActionsToggle,
  onAutoSaveEnabledChange,
  onAutoSaveIntervalChange,
  onClose,
}: ProgramSettingsProps): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium gui-text mb-1">Program Settings</h3>
        <p className="text-xs gui-text-secondary">
          These settings apply to the application globally.
        </p>
      </div>

      {/* Theme Mode */}
      <div>
        <label className="block text-sm font-medium gui-text mb-2">
          <span className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Theme Mode
          </span>
        </label>
        <div className="flex gap-2">
          <OptionButton selected={themeMode === 'dark'} onClick={(e) => onThemeModeChange('dark', e)}>
            Dark
          </OptionButton>
          <OptionButton selected={themeMode === 'light'} onClick={(e) => onThemeModeChange('light', e)}>
            Light
          </OptionButton>
        </div>
      </div>

      {/* AI Palette Enabled */}
      <div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium gui-text flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Enable AI Palette Generation
          </span>
          <ToggleSwitch enabled={aiPaletteEnabled} onToggle={onAIPaletteToggle} />
        </label>
        <p className="text-xs gui-text-secondary mt-1">
          Allow AI to generate color themes based on descriptions.
        </p>
      </div>

      {/* Glass Settings Section */}
      <GlassSettingsSection
        glassSettings={glassSettings}
        ambientEnabled={ambientEnabled}
        onGlassSettingsChange={onGlassSettingsChange}
      />

      {/* Token Estimates Toggle */}
      <div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium gui-text flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Show Token Estimates & Cost
          </span>
          <ToggleSwitch enabled={showTokenEstimates} onToggle={onTokenEstimatesToggle} />
        </label>
        <p className="text-xs gui-text-secondary mt-1">
          Show estimated token count and USD cost in chat panels.
        </p>
      </div>

      {/* Properties Display Mode */}
      <div>
        <label className="block text-sm font-medium gui-text mb-2">
          <span className="flex items-center gap-2">
            <Layout className="w-4 h-4" />
            Properties Display
          </span>
        </label>
        <div className="flex gap-2">
          <OptionButton selected={propertiesDisplayMode === 'sidebar'} onClick={() => onPropertiesDisplayModeChange('sidebar')}>
            Sidebar
          </OptionButton>
          <OptionButton selected={propertiesDisplayMode === 'modal'} onClick={() => onPropertiesDisplayModeChange('modal')}>
            Floating Modal
          </OptionButton>
        </div>
        <p className="text-xs gui-text-secondary mt-1">
          Choose how node properties are displayed when editing.
        </p>
      </div>

      {/* Chat Display Mode */}
      <div>
        <label className="block text-sm font-medium gui-text mb-2">
          <span className="flex items-center gap-2">
            <Layout className="w-4 h-4" />
            Chat Display
          </span>
        </label>
        <div className="flex gap-2">
          <OptionButton selected={chatDisplayMode === 'column'} onClick={() => onChatDisplayModeChange('column')}>
            Column
          </OptionButton>
          <OptionButton selected={chatDisplayMode === 'modal'} onClick={() => onChatDisplayModeChange('modal')}>
            Floating Modal
          </OptionButton>
        </div>
        <p className="text-xs gui-text-secondary mt-1">
          Choose how chat panels are displayed.
        </p>
      </div>

      {/* Accessibility Section */}
      <div className="pt-4 border-t gui-border">
        <h4 className="text-sm font-medium gui-text mb-4 flex items-center gap-2">
          <Accessibility className="w-4 h-4" />
          Accessibility
        </h4>

        {/* Reduce Motion */}
        <div className="mb-4">
          <label className="block text-sm font-medium gui-text mb-2">
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Reduce Motion
            </span>
          </label>
          <div className="flex gap-2">
            <OptionButton
              selected={reduceMotion === 'system'}
              onClick={() => onReduceMotionChange('system')}
            >
              Follow OS
            </OptionButton>
            <OptionButton
              selected={reduceMotion === 'always'}
              onClick={() => onReduceMotionChange('always')}
            >
              Always
            </OptionButton>
            <OptionButton
              selected={reduceMotion === 'never'}
              onClick={() => onReduceMotionChange('never')}
            >
              Never
            </OptionButton>
          </div>
          <p className="text-xs gui-text-secondary mt-1">
            Control animations and transitions. "Follow OS" respects your system preference.
          </p>
        </div>

        {/* High Contrast Focus */}
        <div className="mb-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium gui-text flex items-center gap-2">
              <Eye className="w-4 h-4" />
              High Contrast Focus
            </span>
            <ToggleSwitch enabled={highContrastFocus} onToggle={onHighContrastFocusToggle} />
          </label>
          <p className="text-xs gui-text-secondary mt-1">
            Thicker, more visible focus rings for keyboard navigation.
          </p>
        </div>

        {/* Announce Actions */}
        <div>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium gui-text flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Announce Actions
            </span>
            <ToggleSwitch enabled={announceActions} onToggle={onAnnounceActionsToggle} />
          </label>
          <p className="text-xs gui-text-secondary mt-1">
            Announce important actions to screen readers.
          </p>
        </div>
      </div>

      {/* Auto-save Section */}
      <div className="pt-4 border-t gui-border">
        <div>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium gui-text flex items-center gap-2">
              <Save className="w-4 h-4" />
              Auto-save
            </span>
            <ToggleSwitch enabled={autoSaveEnabled} onToggle={() => onAutoSaveEnabledChange(!autoSaveEnabled)} />
          </label>
          <p className="text-xs gui-text-secondary mt-1">
            Automatically save workspace changes.
          </p>
        </div>

        {autoSaveEnabled && (
          <div className="mt-3">
            <label className="block text-sm gui-text mb-2">
              Save interval: {Math.round(autoSaveIntervalMs / 1000)}s
            </label>
            <Slider
              min={2000}
              max={60000}
              step={1000}
              value={[autoSaveIntervalMs]}
              onValueChange={(values) => onAutoSaveIntervalChange(values[0] ?? autoSaveIntervalMs)}
              className="w-full"
            />
            <div className="flex justify-between text-xs gui-text-secondary mt-1">
              <span>2s (Frequent)</span>
              <span>60s (Relaxed)</span>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Links */}
      <div className="pt-4 border-t gui-border space-y-2">
        <button
          onClick={() => {
            onClose()
            useShortcutHelpStore.getState().open()
          }}
          className="gui-btn gui-btn-ghost w-full flex items-center gap-2 justify-center"
        >
          <Keyboard className="w-4 h-4" />
          <span className="text-sm">View Keyboard Shortcuts</span>
          <kbd className="px-1.5 py-0.5 rounded text-xs gui-card">?</kbd>
        </button>
      </div>

      {/* Version Info */}
      <div className="pt-4 border-t gui-border">
        <p className="text-xs gui-text-secondary text-center">
          Cognograph v0.1.0
        </p>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Workspace Settings Section
// -----------------------------------------------------------------------------

interface WorkspaceSettingsProps {
  workspaceName: string
  contextDepth: number
  propertiesSidebarWidth: number
  leftSidebarWidth: number
  physicsEnabled: boolean
  physicsIdealEdgeLength: number
  physicsStrength: 'gentle' | 'medium' | 'strong'
  onWorkspaceNameChange: (name: string) => void
  onContextDepthChange: (depth: number) => void
  onPropertiesSidebarWidthChange: (width: number) => void
  onLeftSidebarWidthChange: (width: number) => void
  onPhysicsEnabledChange: (enabled: boolean) => void
  onPhysicsEdgeLengthChange: (length: number) => void
  onPhysicsStrengthChange: (strength: 'gentle' | 'medium' | 'strong') => void
}

function WorkspaceSettings({
  workspaceName,
  contextDepth,
  propertiesSidebarWidth,
  leftSidebarWidth,
  physicsEnabled,
  physicsIdealEdgeLength,
  physicsStrength,
  onWorkspaceNameChange,
  onContextDepthChange,
  onPropertiesSidebarWidthChange,
  onLeftSidebarWidthChange,
  onPhysicsEnabledChange,
  onPhysicsEdgeLengthChange,
  onPhysicsStrengthChange,
}: WorkspaceSettingsProps): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium gui-text mb-1">Workspace Settings</h3>
        <p className="text-xs gui-text-secondary">
          These settings are specific to the current workspace.
        </p>
      </div>

      {/* Workspace Name */}
      <div>
        <label className="block text-sm font-medium gui-text mb-2">
          Workspace Name
        </label>
        <input
          type="text"
          value={workspaceName}
          onChange={(e) => onWorkspaceNameChange(e.target.value)}
          className="gui-input w-full px-3 py-2 rounded"
          placeholder="Enter workspace name..."
        />
      </div>

      {/* Context Depth */}
      <div>
        <label className="block text-sm font-medium gui-text mb-2">
          Context Depth: {contextDepth}
        </label>
        <Slider
          min={1}
          max={5}
          step={1}
          value={[contextDepth]}
          onValueChange={(values) => onContextDepthChange(values[0] ?? contextDepth)}
          className="w-full"
        />
        <div className="flex justify-between text-xs gui-text-secondary mt-1">
          <span>1 (Direct only)</span>
          <span>5 (Deep)</span>
        </div>
        <p className="text-xs gui-text-secondary mt-2 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Controls how many "hops" away from a conversation node context is gathered.
          </span>
        </p>
      </div>

      {/* Properties Sidebar Width */}
      <div>
        <label className="block text-sm font-medium gui-text mb-2">
          Properties Sidebar Width: {propertiesSidebarWidth}px
        </label>
        <Slider
          min={280}
          max={600}
          step={10}
          value={[propertiesSidebarWidth]}
          onValueChange={(values) => onPropertiesSidebarWidthChange(values[0] ?? propertiesSidebarWidth)}
          className="w-full"
        />
        <div className="flex justify-between text-xs gui-text-secondary mt-1">
          <span>280px (Narrow)</span>
          <span>600px (Wide)</span>
        </div>
      </div>

      {/* Left Sidebar Width */}
      <div>
        <label className="block text-sm font-medium gui-text mb-2">
          Left Sidebar Width: {leftSidebarWidth}px
        </label>
        <Slider
          min={200}
          max={400}
          step={10}
          value={[leftSidebarWidth]}
          onValueChange={(values) => onLeftSidebarWidthChange(values[0] ?? leftSidebarWidth)}
          className="w-full"
        />
        <div className="flex justify-between text-xs gui-text-secondary mt-1">
          <span>200px (Narrow)</span>
          <span>400px (Wide)</span>
        </div>
      </div>

      {/* Live Physics */}
      <div className="border-t border-[var(--border-subtle)] pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <label className="block text-sm font-medium gui-text">
              Live Physics
            </label>
            <p className="text-xs gui-text-secondary mt-0.5">
              Edges act as springs, pulling nodes toward ideal distances
            </p>
          </div>
          <ToggleSwitch
            enabled={physicsEnabled}
            onToggle={() => onPhysicsEnabledChange(!physicsEnabled)}
          />
        </div>

        {physicsEnabled && (
          <div className="mt-3 space-y-4">
            {/* Physics Strength */}
            <div>
              <label className="block text-sm font-medium gui-text mb-2">
                Physics Strength
              </label>
              <div className="flex gap-1">
                {(['gentle', 'medium', 'strong'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => onPhysicsStrengthChange(level)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      physicsStrength === level
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'gui-surface-secondary gui-text-secondary hover:gui-text'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs gui-text-muted mt-1">
                {physicsStrength === 'gentle' && 'Subtle, slow-moving physics'}
                {physicsStrength === 'medium' && 'Balanced spring forces'}
                {physicsStrength === 'strong' && 'Snappy, responsive physics'}
              </p>
            </div>

            {/* Ideal Edge Length */}
            <div>
              <label className="block text-sm font-medium gui-text mb-2">
                Ideal Edge Length: {physicsIdealEdgeLength}px
              </label>
              <Slider
                min={60}
                max={240}
                step={10}
                value={[physicsIdealEdgeLength]}
                onValueChange={(values) => onPhysicsEdgeLengthChange(values[0] ?? physicsIdealEdgeLength)}
                className="w-full"
              />
              <div className="flex justify-between text-xs gui-text-secondary mt-1">
                <span>60px (Tight)</span>
                <span>240px (Spread)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export / Import */}
      <div className="border-t border-[var(--border-subtle)] pt-4">
        <h4 className="text-sm font-medium gui-text mb-3 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export / Import
        </h4>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const state = useWorkspaceStore.getState()
              const data = state.getWorkspaceData()
              const result = await window.api.dialog.showSaveDialog({
                title: 'Export Workspace',
                defaultPath: `${data.name || 'workspace'}.json`,
                filters: [
                  { name: 'Cognograph Workspace', extensions: ['json'] },
                  { name: 'All Files', extensions: ['*'] }
                ]
              })
              if (!result.canceled && result.filePath) {
                await window.api.workspace.saveAs(data, result.filePath)
              }
            }}
            className="gui-btn gui-btn-ghost flex-1 flex items-center gap-2 justify-center"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
          <button
            onClick={async () => {
              const result = await window.api.dialog.showOpenDialog({
                title: 'Import Workspace',
                filters: [
                  { name: 'Cognograph Workspace', extensions: ['json'] },
                  { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
              })
              if (!result.canceled && result.filePaths?.[0]) {
                const loadResult = await window.api.workspace.loadFromPath(result.filePaths[0])
                if (loadResult.success && loadResult.data) {
                  useWorkspaceStore.getState().loadWorkspace(loadResult.data)
                }
              }
            }}
            className="gui-btn gui-btn-ghost flex-1 flex items-center gap-2 justify-center"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Import</span>
          </button>
        </div>
        <p className="text-xs gui-text-secondary mt-2">
          Export saves a snapshot to any location. Import loads a workspace from a file.
        </p>
      </div>

      {/* Info box */}
      <div className="gui-card p-3">
        <p className="text-xs gui-text-secondary">
          Workspace settings are saved automatically when you save the workspace file.
        </p>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// AI Settings Section
// -----------------------------------------------------------------------------

function AISettings(): JSX.Element {
  // Workspace-level extraction defaults
  const contextSettings = useWorkspaceStore((state) => state.contextSettings)
  const [defaultProvider, setDefaultProvider] = useState<ConnectorProvider>(
    (contextSettings as Record<string, unknown>).defaultProvider as ConnectorProvider || 'anthropic'
  )
  const [extractionDefaults, setExtractionDefaults] = useState<ExtractionSettings>(
    (contextSettings as Record<string, unknown>).extractionDefaults as ExtractionSettings || DEFAULT_EXTRACTION_SETTINGS
  )

  // Save default provider to workspace context settings
  const handleDefaultProviderChange = useCallback((provider: ConnectorProvider) => {
    setDefaultProvider(provider)
    useWorkspaceStore.setState((state) => ({
      contextSettings: { ...state.contextSettings, defaultProvider: provider } as typeof state.contextSettings,
      isDirty: true
    }))
  }, [])

  // Save extraction defaults to workspace context settings
  const updateExtractionDefaults = useCallback((updates: Partial<ExtractionSettings>) => {
    setExtractionDefaults(prev => {
      const next = { ...prev, ...updates }
      useWorkspaceStore.setState((state) => ({
        contextSettings: { ...state.contextSettings, extractionDefaults: next } as typeof state.contextSettings,
        isDirty: true
      }))
      return next
    })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium gui-text mb-1">AI Settings</h3>
        <p className="text-xs gui-text-secondary">
          Configure AI providers, default models, and extraction behavior.
        </p>
      </div>

      {/* Default Provider */}
      <div>
        <label className="block text-sm font-medium gui-text mb-2">
          <span className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Default Provider
          </span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {(Object.entries(CONNECTOR_PROVIDER_INFO) as Array<[ConnectorProvider, typeof CONNECTOR_PROVIDER_INFO[ConnectorProvider]]>)
            .filter(([key]) => key !== 'custom')
            .map(([key, info]) => (
              <OptionButton
                key={key}
                selected={defaultProvider === key}
                onClick={() => handleDefaultProviderChange(key)}
              >
                {info.label}
              </OptionButton>
            ))}
        </div>
        <p className="text-xs gui-text-secondary mt-1">
          New conversations will use this provider by default.
        </p>
      </div>

      {/* Extraction Defaults */}
      <div className="border-t gui-border pt-4">
        <h4 className="text-sm font-medium gui-text mb-3">Extraction Defaults</h4>

        <div className="space-y-4">
          {/* Auto-extract toggle */}
          <div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm gui-text">Auto-extract notes & tasks</span>
              <ToggleSwitch
                enabled={extractionDefaults.autoExtractEnabled}
                onToggle={() => updateExtractionDefaults({ autoExtractEnabled: !extractionDefaults.autoExtractEnabled })}
              />
            </label>
            <p className="text-xs gui-text-secondary mt-1">
              Automatically detect and suggest notes and tasks from AI responses.
            </p>
          </div>

          {/* Trigger mode */}
          <div>
            <label className="block text-sm gui-text mb-2">Extraction Trigger</label>
            <div className="flex gap-2">
              {(['per-message', 'on-demand', 'on-close'] as const).map((trigger) => (
                <OptionButton
                  key={trigger}
                  selected={extractionDefaults.extractionTrigger === trigger}
                  onClick={() => updateExtractionDefaults({ extractionTrigger: trigger })}
                >
                  {trigger === 'per-message' ? 'Per Message' : trigger === 'on-demand' ? 'On Demand' : 'On Close'}
                </OptionButton>
              ))}
            </div>
          </div>

          {/* Confidence threshold */}
          <div>
            <label className="block text-sm gui-text mb-2">
              Confidence Threshold: {Math.round(extractionDefaults.extractionConfidenceThreshold * 100)}%
            </label>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[Math.round(extractionDefaults.extractionConfidenceThreshold * 100)]}
              onValueChange={(values) => updateExtractionDefaults({ extractionConfidenceThreshold: (values[0] ?? 50) / 100 })}
              className="w-full"
            />
            <div className="flex justify-between text-xs gui-text-secondary mt-1">
              <span>0% (Show all)</span>
              <span>100% (High confidence only)</span>
            </div>
          </div>

          {/* Extraction types */}
          <div>
            <label className="block text-sm gui-text mb-2">Extract Types</label>
            <div className="flex gap-3">
              {(['notes', 'tasks'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extractionDefaults.extractionTypes.includes(type)}
                    onChange={(e) => {
                      const types = e.target.checked
                        ? [...extractionDefaults.extractionTypes, type]
                        : extractionDefaults.extractionTypes.filter(t => t !== type)
                      updateExtractionDefaults({ extractionTypes: types })
                    }}
                    className="rounded"
                    style={{ accentColor: 'var(--gui-accent-secondary)' }}
                  />
                  <span className="text-sm gui-text capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LLM Providers (ConnectorsTab) */}
      <div className="border-t gui-border pt-4">
        <ConnectorsTab />
      </div>
    </div>
  )
}

export const SettingsModal = memo(SettingsModalComponent)
