import { memo, useMemo, useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageSquare,
  Bot,
  Folder,
  FileText,
  CheckSquare,
  Save,
  SaveAll,
  FolderOpen,
  FilePlus,
  Undo2,
  Redo2,
  Code,
  Boxes,
  PanelRight,
  Layers,
  PanelRightOpen,
  Maximize2,
  Wand2,
  ArrowLeftRight,
  ArrowUpDown,
  PanelLeft,
  Settings,
  Type,
  Zap,
  Share2,
  Workflow,
  Plus,
  ChevronDown
} from 'lucide-react'
import {
  Separator,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuLabel
} from './ui'
import { useReactFlow } from '@xyflow/react'
import { toast } from 'react-hot-toast'
import { useWorkspaceStore, getHistoryActionLabel } from '../stores/workspaceStore'
import { useAIEditorStore } from '../stores/aiEditorStore'
import AIActionMenu from './ai-editor/AIActionMenu'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { ThemeMenu } from './ThemeMenu'
import type { NodeData } from '@shared/types'

// Width thresholds for toolbar layout modes
const VERTICAL_MODE_THRESHOLD = 900
const TWO_ROW_MODE_THRESHOLD = 1180

interface ToolbarProps {
  onSave: () => void
  onSaveAs: () => void
  onNew: () => void
  onOpen: () => void
  onOpenThemeSettings: () => void
  onOpenSettings: () => void
  showThemeMenu?: boolean
  onShowThemeMenuChange?: (show: boolean) => void
  onToggleAISidebar?: () => void
  onOpenInlinePrompt?: () => void
}

function ToolbarComponent({ onSave, onSaveAs, onNew, onOpen, onOpenThemeSettings, onOpenSettings, showThemeMenu, onShowThemeMenuChange, onToggleAISidebar, onOpenInlinePrompt }: ToolbarProps): JSX.Element {
  const addNode = useWorkspaceStore((state) => state.addNode)
  const addAgentNode = useWorkspaceStore((state) => state.addAgentNode)
  const undo = useWorkspaceStore((state) => state.undo)
  const redo = useWorkspaceStore((state) => state.redo)
  const history = useWorkspaceStore((state) => state.history)
  const historyIndex = useWorkspaceStore((state) => state.historyIndex)
  const historyLength = history.length

  // Computed based on subscribed state
  const canUndoValue = historyIndex >= 0
  const canRedoValue = historyIndex < historyLength - 1

  const undoAction = canUndoValue ? history[historyIndex] : null
  const redoAction = canRedoValue ? history[historyIndex + 1] : null
  const undoTitle = undoAction ? `Undo: ${getHistoryActionLabel(undoAction)} (Ctrl+Z)` : 'Undo (Ctrl+Z)'
  const redoTitle = redoAction ? `Redo: ${getHistoryActionLabel(redoAction)} (Ctrl+Shift+Z)` : 'Redo (Ctrl+Shift+Z)'
  const isDirty = useWorkspaceStore((state) => state.isDirty)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const workspacePreferences = useWorkspaceStore((state) => state.workspacePreferences)
  const setPropertiesDisplayMode = useWorkspaceStore((state) => state.setPropertiesDisplayMode)
  const setChatDisplayMode = useWorkspaceStore((state) => state.setChatDisplayMode)
  const openAIEditor = useAIEditorStore((state) => state.openModal)

  // AI Action Menu state
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [aiMenuAnchor, setAiMenuAnchor] = useState<DOMRect | null>(null)
  const aiButtonRef = useRef<HTMLButtonElement>(null)

  const handleAIButtonClick = useCallback(() => {
    if (aiButtonRef.current) {
      setAiMenuAnchor(aiButtonRef.current.getBoundingClientRect())
      setAiMenuOpen(prev => !prev)
    }
  }, [])

  const handleAIMenuClose = useCallback(() => {
    setAiMenuOpen(false)
  }, [])

  // Multiplayer
  const { isMultiplayer, shareWorkspace, connectionStatus } = useMultiplayer()

  const handleShare = useCallback(async () => {
    const result = await shareWorkspace()
    if (result.success && result.inviteUrl) {
      // Copy invite URL to clipboard
      await navigator.clipboard.writeText(result.inviteUrl)
      toast.success('Invite link copied to clipboard!')
    } else if (result.error) {
      toast.error(result.error)
    }
  }, [shareWorkspace])

  // Left sidebar toggle
  const leftSidebarOpen = useWorkspaceStore((state) => state.leftSidebarOpen)
  const toggleLeftSidebar = useWorkspaceStore((state) => state.toggleLeftSidebar)

  // Canvas position tracking for node spawning
  const lastCanvasClick = useWorkspaceStore((state) => state.lastCanvasClick)
  const { getViewport } = useReactFlow()

  // Toolbar orientation state from store (shared with WorkspaceInfo)
  const preferVertical = useWorkspaceStore((state) => state.workspacePreferences.preferVerticalToolbar)
  const setPreferVertical = useWorkspaceStore((state) => state.setPreferVerticalToolbar)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

  // Listen to window resize
  useEffect(() => {
    const handleResize = (): void => {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Determine toolbar layout mode
  const forceVertical = windowWidth < VERTICAL_MODE_THRESHOLD
  const forceTwoRow = !forceVertical && windowWidth < TWO_ROW_MODE_THRESHOLD
  const isVertical = forceVertical || preferVertical
  const isTwoRow = !isVertical && forceTwoRow

  // Memoize node colors for hover states
  const nodeColors = useMemo(() => ({
    conversation: themeSettings.nodeColors.conversation,
    project: themeSettings.nodeColors.project,
    note: themeSettings.nodeColors.note,
    task: themeSettings.nodeColors.task,
    artifact: themeSettings.nodeColors.artifact,
    workspace: themeSettings.nodeColors.workspace,
    text: themeSettings.nodeColors.text,
    action: themeSettings.nodeColors.action,
    orchestrator: themeSettings.nodeColors.orchestrator
  }), [themeSettings.nodeColors])

  const buttonHoverClasses = 'gui-button'
  const iconClasses = 'group-hover:brightness-125'
  const iconStyle = { color: 'var(--gui-toolbar-icon-default)' }

  const handleAddNode = useCallback((type: NodeData['type']): void => {
    let position: { x: number; y: number }

    // If user recently clicked on canvas (within 2 seconds), spawn node there
    if (lastCanvasClick && Date.now() - lastCanvasClick.time < 2000) {
      position = { x: lastCanvasClick.x, y: lastCanvasClick.y }
    } else {
      // Otherwise, spawn at center of current viewport
      const currentViewport = getViewport()
      // Calculate center of viewport in flow coordinates
      const centerX = (-currentViewport.x + window.innerWidth / 2) / currentViewport.zoom
      const centerY = (-currentViewport.y + window.innerHeight / 2) / currentViewport.zoom
      // Add small random offset to prevent stacking
      position = {
        x: centerX + (Math.random() - 0.5) * 50,
        y: centerY + (Math.random() - 0.5) * 50
      }
    }

    addNode(type, position)
  }, [addNode, lastCanvasClick, getViewport])

  // Divider component that adapts to orientation
  const Divider = (): JSX.Element => (
    <Separator orientation={isVertical ? 'horizontal' : 'vertical'} />
  )

  // Group 1: Sidebar, orientation, file ops, settings, history, node creation
  const ToolbarRow1 = (): JSX.Element => (
    <>
      {/* Sidebar toggle - first item */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleLeftSidebar}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group`}
            aria-label={leftSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <PanelLeft className={`w-5 h-5 ${iconClasses}`} style={leftSidebarOpen ? { color: 'var(--gui-accent-primary)' } : iconStyle} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {leftSidebarOpen ? 'Close sidebar (⌘\\)' : 'Open sidebar (⌘\\)'}
        </TooltipContent>
      </Tooltip>

      {/* Orientation toggle */}
      <button
        onClick={() => setPreferVertical(!preferVertical)}
        disabled={forceVertical}
        className={`p-2 ${buttonHoverClasses} rounded transition-colors group ${forceVertical ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={forceVertical ? 'Vertical mode (window too narrow)' : (preferVertical ? 'Switch to horizontal' : 'Switch to vertical')}
        aria-label={preferVertical ? 'Switch to horizontal toolbar' : 'Switch to vertical toolbar'}
      >
        {isVertical ? (
          <ArrowLeftRight className={`w-5 h-5 ${iconClasses}`} style={iconStyle} />
        ) : (
          <ArrowUpDown className={`w-5 h-5 ${iconClasses}`} style={iconStyle} />
        )}
      </button>

      <Divider />

      {/* File operations */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onNew}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group`}
            aria-label="New Workspace"
          >
            <FilePlus className={`w-5 h-5 ${iconClasses}`} style={iconStyle} />
          </button>
        </TooltipTrigger>
        <TooltipContent>New Workspace (N)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onOpen}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group`}
            aria-label="Open Workspace"
          >
            <FolderOpen className={`w-5 h-5 ${iconClasses}`} style={iconStyle} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Open Workspace (O)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onSave}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group relative`}
            aria-label="Save Workspace"
          >
            <Save className={`w-5 h-5 ${iconClasses}`} style={iconStyle} />
            {isDirty && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>Save Workspace (Ctrl+S)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onSaveAs}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group`}
            aria-label="Save As"
          >
            <SaveAll className={`w-5 h-5 ${iconClasses}`} style={iconStyle} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Save As... (Ctrl+Shift+E)</TooltipContent>
      </Tooltip>

      <Divider />

      {/* History - moved here before node creation */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              const action = history[historyIndex]
              undo()
              if (action) toast(`Undo: ${getHistoryActionLabel(action)}`, { duration: 1500 })
            }}
            disabled={!canUndoValue}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group disabled:opacity-40 disabled:cursor-not-allowed`}
            aria-label="Undo"
          >
            <Undo2 className={`w-5 h-5 ${iconClasses}`} style={iconStyle} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{undoTitle}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              const action = history[historyIndex + 1]
              redo()
              if (action) toast(`Redo: ${getHistoryActionLabel(action)}`, { duration: 1500 })
            }}
            disabled={!canRedoValue}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group disabled:opacity-40 disabled:cursor-not-allowed`}
            aria-label="Redo"
          >
            <Redo2 className={`w-5 h-5 ${iconClasses}`} style={iconStyle} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{redoTitle}</TooltipContent>
      </Tooltip>

      <Divider />

      {/* Quick-add buttons for most common node types */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleAddNode('conversation')}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Conversation (Shift+C)"
          >
            <MessageSquare className="w-5 h-5 transition-colors" style={{ color: nodeColors.conversation }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.conversation }}>Chat</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Conversation (Shift+C)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleAddNode('note')}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Note (Shift+N)"
          >
            <FileText className="w-5 h-5 transition-colors" style={{ color: nodeColors.note }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.note }}>Note</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Note (Shift+N)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleAddNode('task')}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Task (Shift+T)"
          >
            <CheckSquare className="w-5 h-5 transition-colors" style={{ color: nodeColors.task }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.task }}>Task</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Task (Shift+T)</TooltipContent>
      </Tooltip>

      {/* Additional node types - individual buttons with responsive labels */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleAddNode('project')}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Project (Shift+P)"
          >
            <Folder className="w-5 h-5 transition-colors" style={{ color: nodeColors.project }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.project }}>Project</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Project (Shift+P)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleAddNode('artifact')}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Artifact (Shift+A)"
          >
            <Code className="w-5 h-5 transition-colors" style={{ color: nodeColors.artifact }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.artifact }}>Artifact</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Artifact / Code (Shift+A)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleAddNode('text')}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Text (Shift+X)"
          >
            <Type className="w-5 h-5 transition-colors" style={{ color: nodeColors.text }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.text }}>Text</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Text (Shift+X)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleAddNode('workspace')}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Workspace (Shift+W)"
          >
            <Boxes className="w-5 h-5 transition-colors" style={{ color: nodeColors.workspace }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.workspace }}>Workspace</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Workspace (Shift+W)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleAddNode('action')}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Action (Shift+Z)"
          >
            <Zap className="w-5 h-5 transition-colors" style={{ color: nodeColors.action }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.action }}>Action</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Action (Shift+Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleAddNode('orchestrator')}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Orchestrator (Shift+O)"
          >
            <Workflow className="w-5 h-5 transition-colors" style={{ color: nodeColors.orchestrator }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.orchestrator }}>Orchestrator</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Orchestrator (Shift+O)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              let position: { x: number; y: number }
              if (lastCanvasClick && Date.now() - lastCanvasClick.time < 2000) {
                position = { x: lastCanvasClick.x, y: lastCanvasClick.y }
              } else {
                const currentViewport = getViewport()
                const centerX = (-currentViewport.x + window.innerWidth / 2) / currentViewport.zoom
                const centerY = (-currentViewport.y + window.innerHeight / 2) / currentViewport.zoom
                position = {
                  x: centerX + (Math.random() - 0.5) * 50,
                  y: centerY + (Math.random() - 0.5) * 50
                }
              }
              addAgentNode(position)
            }}
            className={`p-2 ${buttonHoverClasses} rounded transition-colors group flex items-center gap-1`}
            aria-label="Add Agent (Ctrl+Shift+A)"
          >
            <Bot className="w-5 h-5 transition-colors" style={{ color: nodeColors.conversation }} />
            <span className="toolbar-btn-label" style={{ color: nodeColors.conversation }}>Agent</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Agent (Ctrl+Shift+A)</TooltipContent>
      </Tooltip>
    </>
  )

  // Group 2: AI Editor, Display toggles, Theme
  const ToolbarRow2 = (): JSX.Element => (
    <>
      {/* AI Editor Menu */}
      <button
        ref={aiButtonRef}
        onClick={handleAIButtonClick}
        className={`p-2 ${buttonHoverClasses} rounded transition-colors group ${aiMenuOpen ? 'bg-white/10' : ''}`}
        title="AI Actions (Ctrl+E)"
        aria-label="Open AI Actions menu"
        aria-expanded={aiMenuOpen}
        aria-haspopup="menu"
      >
        <Wand2 className="w-5 h-5" style={{ color: 'var(--gui-toolbar-icon-1)' }} />
      </button>

      {/* Share / Multiplayer */}
      <button
        onClick={handleShare}
        className={`p-2 ${buttonHoverClasses} rounded transition-colors group`}
        title={isMultiplayer ? `Multiplayer: ${connectionStatus} (click to copy invite link)` : 'Share workspace (starts multiplayer)'}
        aria-label="Share workspace"
      >
        <Share2
          className="w-5 h-5"
          style={{ color: isMultiplayer ? 'var(--gui-accent-primary)' : 'var(--gui-toolbar-icon-1)' }}
        />
      </button>

      <Divider />

      {/* Properties Display Toggle */}
      <button
        onClick={() => setPropertiesDisplayMode(
          workspacePreferences.propertiesDisplayMode === 'modal' ? 'sidebar' : 'modal'
        )}
        className={`p-2 ${buttonHoverClasses} rounded transition-colors group`}
        title={`Properties: ${workspacePreferences.propertiesDisplayMode === 'modal' ? 'Floating Modal' : 'Sidebar'} (click to toggle)`}
        aria-label="Toggle properties display mode"
      >
        {workspacePreferences.propertiesDisplayMode === 'modal' ? (
          <Layers className="w-5 h-5" style={{ color: 'var(--gui-toolbar-icon-2)' }} />
        ) : (
          <PanelRight className="w-5 h-5" style={{ color: 'var(--gui-toolbar-icon-2)' }} />
        )}
      </button>

      {/* Chat Display Mode Toggle */}
      <button
        onClick={() => setChatDisplayMode(
          workspacePreferences.chatDisplayMode === 'modal' ? 'column' : 'modal'
        )}
        className={`p-2 ${buttonHoverClasses} rounded transition-colors group`}
        title={`Chat: ${workspacePreferences.chatDisplayMode === 'modal' ? 'Floating Modal' : 'Right Column'} (click to toggle)`}
        aria-label="Toggle chat display mode"
      >
        {workspacePreferences.chatDisplayMode === 'modal' ? (
          <Maximize2 className="w-5 h-5" style={{ color: 'var(--gui-toolbar-icon-3)' }} />
        ) : (
          <PanelRightOpen className="w-5 h-5" style={{ color: 'var(--gui-toolbar-icon-3)' }} />
        )}
      </button>

      <Divider />

      {/* Theme Menu */}
      <ThemeMenu
        onOpenAdvancedSettings={onOpenThemeSettings}
        externalOpen={showThemeMenu}
        onExternalOpenChange={onShowThemeMenuChange}
      />

      {/* Settings - at far right */}
      <button
        onClick={onOpenSettings}
        className={`p-2 ${buttonHoverClasses} rounded transition-colors group`}
        title="Settings"
        aria-label="Open settings"
      >
        <Settings className={`w-5 h-5 ${iconClasses}`} style={iconStyle} />
      </button>
    </>
  )

  // Vertical mode - single column
  if (isVertical) {
    return (
      <>
        <div
          className="absolute top-4 gui-z-panels transition-all duration-200"
          style={{ left: '16px' }}
        >
          <div className="gui-toolbar gui-toolbar--vertical glass-soft flex flex-col items-center gap-1">
            <ToolbarRow1 />
            <Divider />
            <ToolbarRow2 />
          </div>
        </div>
        <AIActionMenu
          isOpen={aiMenuOpen}
          onClose={handleAIMenuClose}
          anchorRect={aiMenuAnchor}
          onToggleAISidebar={onToggleAISidebar}
          onOpenInlinePrompt={onOpenInlinePrompt}
        />
      </>
    )
  }

  // Two-row mode (window between 900-1180px)
  if (isTwoRow) {
    return (
      <>
        <div
          className="absolute top-4 gui-z-panels transition-all duration-200"
          style={{ left: '16px' }}
        >
          <div className="gui-toolbar glass-soft flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <ToolbarRow1 />
            </div>
            <Separator />
            <div className="flex items-center gap-1">
              <ToolbarRow2 />
            </div>
          </div>
        </div>
        <AIActionMenu
          isOpen={aiMenuOpen}
          onClose={handleAIMenuClose}
          anchorRect={aiMenuAnchor}
          onToggleAISidebar={onToggleAISidebar}
          onOpenInlinePrompt={onOpenInlinePrompt}
        />
      </>
    )
  }

  // Single row mode (default, wide screens)
  return (
    <>
      <div
        className="absolute top-4 gui-z-panels transition-all duration-200"
        style={{ left: '16px' }}
      >
        <div className="gui-toolbar glass-soft flex items-center gap-1">
          <ToolbarRow1 />
          <Divider />
          <ToolbarRow2 />
        </div>
      </div>
      <AIActionMenu
        isOpen={aiMenuOpen}
        onClose={handleAIMenuClose}
        anchorRect={aiMenuAnchor}
        onToggleAISidebar={onToggleAISidebar}
        onOpenInlinePrompt={onOpenInlinePrompt}
      />
    </>
  )
}

export const Toolbar = memo(ToolbarComponent)
