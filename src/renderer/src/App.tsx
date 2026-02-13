import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  ConnectionLineType,
  ConnectionMode,
  SelectionMode,
  type OnConnectStart,
  type OnConnectEnd,
  type Connection,
  type Node,
  type OnSelectionChangeFunc
} from '@xyflow/react'
import { Toaster, toast } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import { SciFiToast, sciFiToast } from './components/ui/SciFiToast'
import { TokenIndicator } from './components/TokenIndicator'
import { SplashScreen } from './components/SplashScreen'
import '@xyflow/react/dist/style.css'

import { nodeTypes } from './components/nodes'
import { edgeTypes } from './components/edges'
import { Toolbar } from './components/Toolbar'
import { AlignmentToolbar } from './components/AlignmentToolbar'
import { PropertiesPanel } from './components/PropertiesPanel'
import { ConnectionPropertiesPanel } from './components/ConnectionPropertiesPanel'
import { ChatPanel } from './components/ChatPanel'
import { LeftSidebar } from './components/LeftSidebar'
import { ExtractionPanel, ExtractionDragPreview } from './components/extractions'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SaveTemplateModal, PasteTemplateModal, TemplateBrowser } from './components/templates'
import { ContextMenu } from './components/ContextMenu'
import { ThemeSettingsModal } from './components/ThemeSettingsModal'
import { SettingsModal } from './components/SettingsModal'
import { WorkspaceInfo } from './components/WorkspaceInfo'
import { FloatingPropertiesModal } from './components/FloatingPropertiesModal'
import { PinnedWindowsContainer } from './components/PinnedWindow'
import { CollapsibleMinimap } from './components/CollapsibleMinimap'
import { ZoomIndicator } from './components/ZoomIndicator'
import { ClipboardIndicator } from './components/ClipboardIndicator'
import { AIEditorModal, AIEditorPreview, InlinePrompt, SelectionActionBar, AISidebar } from './components/ai-editor'
import { AmbientEffectLayer } from './components/ambient'
import { ClickSpark } from './components/ui/react-bits'
import WorkflowProgress from './components/ai-editor/WorkflowProgress'
import { CommandPalette, useCommandPalette } from './components/CommandPalette'
import { UndoHistoryPanel } from './components/UndoHistoryPanel'
import { TrashPanel } from './components/TrashPanel'
import { ArchivePanel } from './components/ArchivePanel'
import { WelcomeOverlay } from './components/onboarding/WelcomeOverlay'
import { OnboardingTooltip } from './components/onboarding/OnboardingTooltip'
import { TutorialOverlay } from './components/onboarding/TutorialOverlay'
import { ExportDialog } from './components/ExportDialog'
import { TemplatePicker } from './components/TemplatePicker'
import { FilterViewDropdown } from './components/FilterViewDropdown'
import { ProgressIndicator } from './components/ProgressIndicator'
import { SavedViewsPanel } from './components/SavedViewsPanel'
import { TimelineView } from './components/TimelineView'
import { EmptyCanvasHint } from './components/EmptyCanvasHint'
import { FocusModeIndicator } from './components/FocusModeIndicator'
import { KeyboardShortcutsHelp, useShortcutHelpStore } from './components/KeyboardShortcutsHelp'
import { useWorkspaceStore, getHistoryActionLabel } from './stores/workspaceStore'
import { initCCBridgeListener } from './stores/ccBridgeStore'
import { initOrchestratorIPC } from './stores/orchestratorStore'
import { initBridgeIPC, useBridgeStore } from './stores/bridgeStore'
import { useProposalStore } from './stores/proposalStore'
import { ProposalCard } from './components/bridge/ProposalCard'
import { CommandBar } from './components/bridge/CommandBar'
import { BridgeStatusBar } from './components/bridge/BridgeStatusBar'
import { useUIStore } from './stores/uiStore'
import { SyncProviderWrapper, useSyncProvider } from './sync'
import { useTemplateStore } from './stores/templateStore'
import { TooltipProvider } from './components/ui'
import { useContextMenuStore } from './stores/contextMenuStore'
import { useAIEditorStore } from './stores/aiEditorStore'
import { suggestTemplateName } from './utils/templateUtils'
import { useProgramStore, selectKeyboardOverrides } from './stores/programStore'
import { matchesShortcut } from './utils/shortcuts'
import { useActionSubscription } from './hooks/useActionSubscription'
import { useScheduleService } from './hooks/useScheduleService'
import { useOnboardingTooltips } from './hooks/useOnboardingTooltips'
import { useAnalyticsTracking } from './hooks/useAnalyticsTracking'
import { SpatialRegionOverlay } from './components/action/SpatialRegionOverlay'
import { SuggestedAutomations } from './components/action/SuggestedAutomations'
import { MessageSquare, FileText, CheckSquare, Folder, Code, Boxes, Link2 } from 'lucide-react'
import { calculateSnapGuides, type SnapGuide } from './utils/snapGuides'
import { filterParentProjects } from './utils/selectionUtils'
import type { NodeData, WorkspaceNodeData, GuiColors, EdgeData } from '@shared/types'
import { DEFAULT_AMBIENT_EFFECT, DEFAULT_GLASS_SETTINGS } from '@shared/types'
import { DEFAULT_GUI_DARK, DEFAULT_GUI_LIGHT } from './constants/themePresets'
import { getGPUTier } from './utils/gpuDetection'
import { resolveGlassStyle } from './utils/glassUtils'
import type { Edge } from '@xyflow/react'
import { UserCursors } from './components/Presence/UserCursors'
import { ConnectionStatus, SessionExpiredModal } from './components/Multiplayer'
import { usePresence } from './hooks/usePresence'
import { useSemanticZoomClass } from './hooks/useSemanticZoom'
import { useNavigationHistory } from './hooks/useNavigationHistory'
import { useShiftDragEdgeCreation } from './hooks/useShiftDragEdgeCreation'
import { usePhysicsSimulation, DEFAULT_PHYSICS_CONFIG, getPhysicsConfigForStrength } from './hooks/usePhysicsSimulation'
import { playSound } from './services/audioService'
import { performThemeTransition } from './utils/themeTransition'
import './styles/nodes.css'
import './styles/token-estimator.css'
import './styles/presence.css'
import './styles/bridgeAnimations.css'

// Resizable wrapper for the properties sidebar
interface ResizablePropertiesPanelProps {
  width: number
  onWidthChange?: (width: number) => void
  compact?: boolean
}

function ResizablePropertiesPanel({ width, onWidthChange, compact = false }: ResizablePropertiesPanelProps): JSX.Element {
  const [isResizing, setIsResizing] = useState(false)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!onWidthChange) return
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (moveE: MouseEvent): void => {
      // Dragging left edge means moving left = wider, moving right = narrower
      const deltaX = startX - moveE.clientX
      const newWidth = Math.max(280, Math.min(600, startWidth + deltaX))
      onWidthChange(newWidth)
    }

    const handleMouseUp = (): void => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [width, onWidthChange])

  return (
    <div
      className="pointer-events-auto relative"
      style={{ width, transition: isResizing ? 'none' : 'width 0.15s ease-out' }}
    >
      {/* Left edge resize handle - wider hit area for easier grabbing */}
      {onWidthChange && (
        <div
          className="absolute left-0 top-0 w-2 h-full cursor-ew-resize z-20 group"
          onMouseDown={handleResizeStart}
        >
          {/* Visual indicator line */}
          <div className="absolute left-0 top-0 w-0.5 h-full bg-transparent group-hover:bg-blue-500/50 transition-colors" />
        </div>
      )}
      <PropertiesPanel compact={compact} />
    </div>
  )
}

// Connection state for hover-based connection system
interface PendingConnection {
  sourceNodeId: string
  sourceHandleId: string | null
}

interface ConnectionTarget {
  nodeId: string
  handleId: string
  nodeColor: string
}

function Canvas(): JSX.Element {
  const { getViewport, screenToFlowPosition, getInternalNode, setCenter } = useReactFlow()
  const semanticZoomClass = useSemanticZoomClass()
  const { goBack, goForward, canGoBack, canGoForward } = useNavigationHistory()
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isReady, setIsReady] = useState(false)

  // Connection hover state
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null)
  const pendingConnectionRef = useRef<PendingConnection | null>(null)
  const [connectionTarget, setConnectionTarget] = useState<ConnectionTarget | null>(null)
  const connectionTargetRef = useRef<ConnectionTarget | null>(null)
  const lastConnectionMousePos = useRef<{ x: number; y: number } | null>(null)
  const lastConnectionCtrlRef = useRef(false)

  // Quick-connect popup state
  const [quickConnectPopup, setQuickConnectPopup] = useState<{
    screenPosition: { x: number; y: number }
    flowPosition: { x: number; y: number }
    sourceNodeId: string
    sourceHandleId: string | null
  } | null>(null)

  // Snap-to-guide state
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const snapResultRef = useRef<{ x: number; y: number } | null>(null)
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 })
  const [indicatorZoom, setIndicatorZoom] = useState(1)
  const lastIndicatorZoomRef = useRef(1)

  // Multiplayer presence
  const { broadcastCursor, clearCursor } = usePresence()

  const nodes = useWorkspaceStore((state) => state.nodes)
  const hiddenNodeTypes = useWorkspaceStore((state) => state.hiddenNodeTypes)
  const edges = useWorkspaceStore((state) => state.edges)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const leftSidebarOpen = useWorkspaceStore((state) => state.leftSidebarOpen)
  const leftSidebarWidth = useWorkspaceStore((state) => state.leftSidebarWidth)

  // Keyboard shortcut overrides (program-level)
  const keyboardOverrides = useProgramStore(selectKeyboardOverrides)

  // Ghost node/edge elements from proposal store
  const ghostNodes = useProposalStore(s => s.ghostNodes)
  const ghostEdges = useProposalStore(s => s.ghostEdges)
  const activeProposalId = useProposalStore(s => s.activeProposalId)
  const activeProposal = useProposalStore(s => activeProposalId ? s.proposals[activeProposalId] : null)

  // Refs for nodes/edges to avoid recreating callbacks on every position change
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  // FPS counter (dev tool, toggled with Ctrl+Shift+F)
  const [showFps, setShowFps] = useState(false)
  // Minimap visibility (toggled with Alt+M)
  const [minimapVisible, setMinimapVisible] = useState(true)
  // Undo history panel visibility (toggled with Alt+H)
  const [showUndoHistory, setShowUndoHistory] = useState(false)
  // Trash panel visibility (toggled with Alt+T)
  const [showTrash, setShowTrash] = useState(false)
  // Archive panel visibility (toggled with Alt+A)
  const [showArchive, setShowArchive] = useState(false)
  // Saved views panel visibility (toggled with Alt+V)
  const [showSavedViews, setShowSavedViews] = useState(false)
  // Timeline view visibility (toggled with Alt+L)
  const [showTimeline, setShowTimeline] = useState(false)
  // Export dialog visibility (toggled with Ctrl+Shift+X)
  const [showExportDialog, setShowExportDialog] = useState(false)
  // Template picker visibility
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  // InlinePrompt visibility and position (toggled with / key)
  const [inlinePromptOpen, setInlinePromptOpen] = useState(false)
  const [inlinePromptPosition, setInlinePromptPosition] = useState({ x: 0, y: 0 })
  // SelectionActionBar visibility and position (toggled with Tab when nodes selected)
  const [selectionActionBarOpen, setSelectionActionBarOpen] = useState(false)
  const [selectionActionBarPosition, setSelectionActionBarPosition] = useState({ x: 0, y: 0 })
  // AISidebar visibility (toggled with Ctrl+Shift+A)
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false)
  // Mouse position ref for InlinePrompt/SelectionActionBar positioning
  const mousePositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 })
  const fpsElRef = useRef<HTMLDivElement | null>(null)

  // Analytics tracking for onboarding metrics
  useAnalyticsTracking()

  // FPS counter animation loop
  useEffect(() => {
    if (!showFps) return
    let raf: number
    const tick = (): void => {
      fpsRef.current.frames++
      const now = performance.now()
      if (now - fpsRef.current.lastTime >= 1000) {
        fpsRef.current.fps = fpsRef.current.frames
        fpsRef.current.frames = 0
        fpsRef.current.lastTime = now
        if (fpsElRef.current) {
          fpsElRef.current.textContent = `${fpsRef.current.fps} FPS`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [showFps])

  // Set data-theme attribute on body for CSS variable theming
  useEffect(() => {
    document.body.setAttribute('data-theme', themeSettings.mode)
  }, [themeSettings.mode])

  // Listen for open-settings events from child components (e.g. AIPropertyAssist)
  useEffect(() => {
    const handler = (): void => setShowSettingsModal(true)
    window.addEventListener('open-settings', handler)
    return () => window.removeEventListener('open-settings', handler)
  }, [])

  // Listen for open-template-picker events from Command Palette
  useEffect(() => {
    const handler = (): void => setShowTemplatePicker(true)
    window.addEventListener('open-template-picker', handler)
    return () => window.removeEventListener('open-template-picker', handler)
  }, [])

  // Initialize CC Bridge + Orchestrator + Spatial Bridge IPC listeners
  useEffect(() => {
    const cleanupCCBridge = initCCBridgeListener()
    const cleanupOrch = initOrchestratorIPC()       // Must init BEFORE bridge
    const cleanupSpatialBridge = initBridgeIPC()     // Bridge subscribes to orchestrator events
    return () => { cleanupSpatialBridge(); cleanupCCBridge(); cleanupOrch() }
  }, [])

  // Reset bridge + proposal state when workspace changes
  useEffect(() => {
    const unsub = useWorkspaceStore.subscribe(
      (state) => state.workspaceId,
      (_newId, _prevId) => {
        useBridgeStore.getState().resetBridgeState()
        useProposalStore.getState().clearAllProposals()
      }
    )
    return unsub
  }, [])

  // Set GUI CSS variables when theme changes
  useEffect(() => {
    const guiColors: GuiColors = themeSettings.guiColors ||
      (themeSettings.mode === 'light' ? DEFAULT_GUI_LIGHT : DEFAULT_GUI_DARK)

    const root = document.documentElement
    root.style.setProperty('--gui-panel-bg', guiColors.panelBackground)
    root.style.setProperty('--gui-panel-bg-secondary', guiColors.panelBackgroundSecondary)
    root.style.setProperty('--gui-text-primary', guiColors.textPrimary)
    root.style.setProperty('--gui-text-secondary', guiColors.textSecondary)
    root.style.setProperty('--gui-accent-primary', guiColors.accentPrimary)
    root.style.setProperty('--gui-accent-secondary', guiColors.accentSecondary)
    root.style.setProperty('--gui-toolbar-icon-default', guiColors.toolbarIconDefault)
    root.style.setProperty('--gui-toolbar-icon-1', guiColors.toolbarIconAccent[0] || '#a855f7')
    root.style.setProperty('--gui-toolbar-icon-2', guiColors.toolbarIconAccent[1] || '#22d3ee')
    root.style.setProperty('--gui-toolbar-icon-3', guiColors.toolbarIconAccent[2] || '#34d399')
    root.style.setProperty('--gui-toolbar-icon-4', guiColors.toolbarIconAccent[3] || '#a855f7')

    // Also apply GUI text colors to canvas nodes for consistent theming
    root.style.setProperty('--node-text-primary', guiColors.textPrimary)
    root.style.setProperty('--node-text-secondary', guiColors.textSecondary)
  }, [themeSettings.guiColors, themeSettings.mode])

  // Set glass CSS variables and data attributes for glassmorphism system
  useEffect(() => {
    const glassSettings = themeSettings.glassSettings ?? structuredClone(DEFAULT_GLASS_SETTINGS)
    const gpuTier = getGPUTier()
    const ambientActive = themeSettings.ambientEffect?.enabled ?? false
    const effectiveStyle = resolveGlassStyle(
      glassSettings.userPreference,
      gpuTier.tier,
      ambientActive
    )

    // Atomic batch update to prevent race conditions
    requestAnimationFrame(() => {
      const root = document.documentElement

      // Set CSS variables
      root.style.setProperty('--glass-blur', `${glassSettings.blurRadius}px`)
      root.style.setProperty('--glass-opacity', glassSettings.panelOpacity) // Unitless number for calc()
      root.style.setProperty('--glass-noise-opacity', `${glassSettings.noiseOpacity / 100}`)
      root.style.setProperty('--glass-shimmer-speed', `${glassSettings.shimmerSpeed}`)

      // Set all data attributes atomically
      const applyTo = glassSettings.applyTo ?? DEFAULT_GLASS_SETTINGS.applyTo

      const attrs = {
        'data-glass-style': effectiveStyle,
        'data-glass-nodes': applyTo.nodes,
        'data-glass-modals': applyTo.modals,
        'data-glass-panels': applyTo.panels,
        'data-glass-overlays': applyTo.overlays,
        'data-glass-toolbar': applyTo.toolbar
        // NOTE: Removed data-glass-opaque-content - text stays opaque by default
      }

      Object.entries(attrs).forEach(([key, value]) => {
        root.setAttribute(key, String(value))
      })
    })

    // Cleanup on unmount
    return () => {
      const root = document.documentElement
      root.removeAttribute('data-glass-style')
      root.removeAttribute('data-glass-nodes')
      root.removeAttribute('data-glass-modals')
      root.removeAttribute('data-glass-panels')
      root.removeAttribute('data-glass-overlays')
      root.removeAttribute('data-glass-toolbar')
    }
  }, [themeSettings.glassSettings, themeSettings.ambientEffect])

  // Set canvas CSS variables for immediate background/grid updates
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--canvas-background', themeSettings.canvasBackground)
    root.style.setProperty('--canvas-grid-color', themeSettings.canvasGridColor === '#transparent' ? 'transparent' : themeSettings.canvasGridColor)
  }, [themeSettings.canvasBackground, themeSettings.canvasGridColor])

  // Template store actions
  const loadTemplateLibrary = useTemplateStore((state) => state.loadLibrary)
  const openTemplateBrowser = useTemplateStore((state) => state.openBrowser)
  const openSaveTemplateModal = useTemplateStore((state) => state.openSaveModal)
  const onNodesChange = useWorkspaceStore((state) => state.onNodesChange)
  const onEdgesChange = useWorkspaceStore((state) => state.onEdgesChange)
  const onConnect = useWorkspaceStore((state) => state.onConnect)
  const addEdge = useWorkspaceStore((state) => state.addEdge)
  const deleteNodes = useWorkspaceStore((state) => state.deleteNodes)
  const softDeleteNodes = useWorkspaceStore((state) => state.softDeleteNodes)
  const deleteEdges = useWorkspaceStore((state) => state.deleteEdges)
  const reconnectEdge = useWorkspaceStore((state) => state.reconnectEdge)
  const selectedNodeIds = useWorkspaceStore((state) => state.selectedNodeIds)
  const selectedEdgeIds = useWorkspaceStore((state) => state.selectedEdgeIds)
  const clearSelection = useWorkspaceStore((state) => state.clearSelection)
  const setSelectedNodes = useWorkspaceStore((state) => state.setSelectedNodes)
  const activeChatNodeId = useWorkspaceStore((state) => state.activeChatNodeId)
  const openChatNodeIds = useWorkspaceStore((state) => state.openChatNodeIds)
  const undo = useWorkspaceStore((state) => state.undo)
  const redo = useWorkspaceStore((state) => state.redo)
  const history = useWorkspaceStore((state) => state.history)
  const historyIndex = useWorkspaceStore((state) => state.historyIndex)
  const historyRef = useRef(history)
  const historyIndexRef = useRef(historyIndex)
  useEffect(() => { historyRef.current = history }, [history])
  useEffect(() => { historyIndexRef.current = historyIndex }, [historyIndex])
  const copyNodes = useWorkspaceStore((state) => state.copyNodes)
  const cutNodes = useWorkspaceStore((state) => state.cutNodes)
  const pasteNodes = useWorkspaceStore((state) => state.pasteNodes)
  const getWorkspaceData = useWorkspaceStore((state) => state.getWorkspaceData)
  const markClean = useWorkspaceStore((state) => state.markClean)
  const newWorkspace = useWorkspaceStore((state) => state.newWorkspace)
  const loadWorkspace = useWorkspaceStore((state) => state.loadWorkspace)
  const setViewport = useWorkspaceStore((state) => state.setViewport)
  const addNodeToProject = useWorkspaceStore((state) => state.addNodeToProject)
  const removeNodeFromProject = useWorkspaceStore((state) => state.removeNodeFromProject)
  const createArtifactFromFile = useWorkspaceStore((state) => state.createArtifactFromFile)
  const toggleLeftSidebar = useWorkspaceStore((state) => state.toggleLeftSidebar)
  const recordCanvasClick = useWorkspaceStore((state) => state.recordCanvasClick)
  const lastCanvasClick = useWorkspaceStore((state) => state.lastCanvasClick)
  const workspacePreferences = useWorkspaceStore((state) => state.workspacePreferences)
  const setPropertiesSidebarWidth = useWorkspaceStore((state) => state.setPropertiesSidebarWidth)
  const openFloatingProperties = useWorkspaceStore((state) => state.openFloatingProperties)
  const floatingPropertiesNodeIds = useWorkspaceStore((state) => state.floatingPropertiesNodeIds)
  const startNodeDrag = useWorkspaceStore((state) => state.startNodeDrag)
  const commitNodeDrag = useWorkspaceStore((state) => state.commitNodeDrag)
  const addNode = useWorkspaceStore((state) => state.addNode)
  const addAgentNode = useWorkspaceStore((state) => state.addAgentNode)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const linkAllNodes = useWorkspaceStore((state) => state.linkAllNodes)
  const unlinkSelectedNodes = useWorkspaceStore((state) => state.unlinkSelectedNodes)
  const moveNodesForward = useWorkspaceStore((state) => state.moveNodesForward)
  const moveNodesBackward = useWorkspaceStore((state) => state.moveNodesBackward)
  const toggleFocusMode = useWorkspaceStore((state) => state.toggleFocusMode)
  const toggleNodeCollapsed = useWorkspaceStore((state) => state.toggleNodeCollapsed)
  const getChildNodeIds = useWorkspaceStore((state) => state.getChildNodeIds)
  const focusModeNodeId = useWorkspaceStore((state) => state.focusModeNodeId)
  const setFocusModeNode = useWorkspaceStore((state) => state.setFocusModeNode)
  const toggleBookmark = useWorkspaceStore((state) => state.toggleBookmark)
  const bookmarkedNodeId = useWorkspaceStore((state) => state.bookmarkedNodeId)
  const setNumberedBookmark = useWorkspaceStore((state) => state.setNumberedBookmark)
  const numberedBookmarks = useWorkspaceStore((state) => state.numberedBookmarks)
  const numberedBookmarksRef = useRef(numberedBookmarks)
  numberedBookmarksRef.current = numberedBookmarks
  const clearClipboard = useWorkspaceStore((state) => state.clearClipboard)
  const clipboardState = useWorkspaceStore((state) => state.clipboardState)
  const lastCreatedNodeId = useWorkspaceStore((state) => state.lastCreatedNodeId)
  const clearLastCreatedNodeId = useWorkspaceStore((state) => state.clearLastCreatedNodeId)

  // Context menu
  const openContextMenu = useContextMenuStore((state) => state.open)
  const closeContextMenu = useContextMenuStore((state) => state.close)

  // AI Editor
  const openAIEditor = useAIEditorStore((state) => state.openModal)
  const isAIEditorOpen = useAIEditorStore((state) => state.isOpen)

  // Command Palette
  const { isOpen: isCommandPaletteOpen, openPalette, closePalette } = useCommandPalette()

  // Keyboard Shortcuts Help
  const toggleShortcutHelp = useShortcutHelpStore((s) => s.toggle)

  // Sync provider for routing manual saves through debounce-cancelling saveImmediate()
  const syncProvider = useSyncProvider()

  // Action node event bus - watches for workspace changes and triggers actions
  useActionSubscription()

  // Schedule service - emits schedule-tick events for action nodes with cron triggers
  useScheduleService()

  // Contextual onboarding tooltips - shows tips on first-time actions
  const { activeTooltip, dismiss: dismissTooltip } = useOnboardingTooltips()

  // Shift+drag edge creation - allows creating edges by Shift+dragging from node to node
  const handleShiftDragEdgeCreate = useCallback(
    (sourceId: string, targetId: string) => {
      addEdge({ source: sourceId, target: targetId })
      toast('Connection created', { duration: 1500, icon: <Link2 size={16} className="text-blue-400" /> })
    },
    [addEdge]
  )

  const { state: shiftDragState } = useShiftDragEdgeCreation({
    onEdgeCreate: handleShiftDragEdgeCreate,
    existingEdges: edges
  })

  // Physics simulation for spring-based edge lengths
  const physicsConfig = useMemo(() => ({
    ...DEFAULT_PHYSICS_CONFIG,
    ...getPhysicsConfigForStrength(themeSettings.physicsStrength ?? 'medium'),
    enabled: themeSettings.physicsEnabled ?? false,
    idealEdgeLength: themeSettings.physicsIdealEdgeLength ?? 120
  }), [themeSettings.physicsEnabled, themeSettings.physicsIdealEdgeLength, themeSettings.physicsStrength])

  const handlePhysicsPositionChange = useCallback((positions: Map<string, { x: number; y: number }>) => {
    // Convert physics positions to React Flow node changes
    const changes = Array.from(positions.entries()).map(([id, pos]) => ({
      type: 'position' as const,
      id,
      position: pos
    }))
    if (changes.length > 0) {
      onNodesChange(changes)
    }
  }, [onNodesChange])

  usePhysicsSimulation(
    nodes,
    edges,
    physicsConfig,
    handlePhysicsPositionChange,
    isDraggingNode
  )

  // Compute combined edges including workspace member links
  const combinedEdges = useMemo(() => {
    // Start with the regular edges
    const allEdges: Edge[] = [...edges]

    // Find workspace nodes with showLinks enabled
    const workspaceNodesWithLinks = nodes.filter(
      (n) => n.data.type === 'workspace' && (n.data as WorkspaceNodeData).showLinks
    )

    // Create edges from workspace to each member node
    for (const wsNode of workspaceNodesWithLinks) {
      const wsData = wsNode.data as WorkspaceNodeData
      const memberIds = wsData.includedNodeIds.filter(
        (id) => !wsData.excludedNodeIds.includes(id)
      )

      const linkDirection = wsData.linkDirection || 'to-members'
      const isBidirectional = linkDirection === 'bidirectional'

      for (const memberId of memberIds) {
        // Check if member node exists
        const memberNode = nodes.find((n) => n.id === memberId)
        if (!memberNode) continue

        // Create a workspace membership edge
        const edgeId = `ws-link-${wsNode.id}-${memberId}`

        // Skip if this edge already exists in regular edges
        if (allEdges.some((e) => e.id === edgeId)) continue

        // Determine source/target based on direction
        // 'to-members': workspace → member (default)
        // 'from-members': member → workspace
        // 'bidirectional': workspace → member with bidirectional markers
        const source = linkDirection === 'from-members' ? memberId : wsNode.id
        const target = linkDirection === 'from-members' ? wsNode.id : memberId

        allEdges.push({
          id: edgeId,
          source,
          target,
          type: 'custom',
          animated: false,
          data: {
            label: '',
            active: true,
            weight: 3,
            direction: isBidirectional ? 'bidirectional' : 'unidirectional',
            isWorkspaceLink: true,
            workspaceId: wsNode.id,
            linkColor: wsData.linkColor || '#ef4444'
          },
          style: {
            strokeDasharray: '5 5',
            stroke: wsData.linkColor || '#ef4444',
            strokeWidth: 1.5,
            opacity: 0.6
          }
        })
      }
    }

    // Append ghost edges from proposal store (they have type: 'ghost')
    if (ghostEdges.length > 0) {
      return [...allEdges, ...ghostEdges as unknown as typeof allEdges]
    }

    return allEdges
  }, [nodes, edges, ghostEdges])

  // Compute context provider node IDs: nodes that feed context into selected conversations
  const contextProviderNodeIds = useMemo(() => {
    const providerIds = new Set<string>()
    if (selectedNodeIds.length === 0) return providerIds

    // Find selected conversation nodes
    const selectedConversationIds = new Set(
      nodes
        .filter(n => selectedNodeIds.includes(n.id) && n.data.type === 'conversation')
        .map(n => n.id)
    )
    if (selectedConversationIds.size === 0) return providerIds

    // For each edge, check if it feeds context into a selected conversation
    for (const edge of combinedEdges) {
      const edgeData = edge.data as EdgeData | undefined
      if (edgeData && !edgeData.active) continue // skip inactive edges
      if (edgeData?.isWorkspaceLink) continue // skip workspace links

      const isBidirectional = edgeData?.direction === 'bidirectional'

      // Inbound to conversation: source provides context
      if (selectedConversationIds.has(edge.target)) {
        providerIds.add(edge.source)
      }
      // Bidirectional with conversation as source: target provides context
      if (isBidirectional && selectedConversationIds.has(edge.source)) {
        providerIds.add(edge.target)
      }
    }

    return providerIds
  }, [selectedNodeIds, nodes, combinedEdges])

  // Filter nodes based on hidden node types and archived status, plus ghost nodes
  const filteredNodes = useMemo(() => {
    const realNodes = nodes
      .filter(node => !node.data.isArchived && !hiddenNodeTypes.has(node.data.type))
      .map(node => contextProviderNodeIds.has(node.id)
        ? { ...node, className: 'context-provider-node' }
        : node
      )

    // Append ghost nodes from proposal store (they have type: 'ghost')
    if (ghostNodes.length > 0) {
      return [...realNodes, ...ghostNodes as unknown as typeof realNodes]
    }

    return realNodes
  }, [nodes, hiddenNodeTypes, contextProviderNodeIds, ghostNodes])

  // Auto-focus newly created nodes (NoteNode, TaskNode editors)
  useEffect(() => {
    if (!lastCreatedNodeId) return
    const nodeId = lastCreatedNodeId
    clearLastCreatedNodeId()

    requestAnimationFrame(() => {
      const nodeEl = document.querySelector(`[data-id="${nodeId}"]`)
      if (!nodeEl) return
      const focusable = nodeEl.querySelector('[data-focusable="true"] .tiptap')
      if (focusable instanceof HTMLElement) {
        focusable.focus()
      }
    })
  }, [lastCreatedNodeId, clearLastCreatedNodeId])

  // Load last workspace on mount
  useEffect(() => {
    const loadLastWorkspace = async (): Promise<void> => {
      try {
        const lastId = await window.api.workspace.getLastWorkspaceId()
        if (lastId) {
          const result = await window.api.workspace.load(lastId)
          if (result.success && result.data) {
            loadWorkspace(result.data as Parameters<typeof loadWorkspace>[0])
          } else {
            newWorkspace()
          }
        } else {
          newWorkspace()
        }
      } catch (error) {
        console.error('Failed to load workspace:', error)
        newWorkspace()
      }
      setIsReady(true)
    }

    loadLastWorkspace()
  }, [loadWorkspace, newWorkspace])

  // Load template library on mount
  useEffect(() => {
    loadTemplateLibrary()
  }, [loadTemplateLibrary])

  // Auto-open floating properties when node is selected in modal mode
  useEffect(() => {
    const firstSelectedId = selectedNodeIds[0]
    if (
      workspacePreferences.propertiesDisplayMode === 'modal' &&
      selectedNodeIds.length === 1 &&
      firstSelectedId &&
      !floatingPropertiesNodeIds.includes(firstSelectedId)
    ) {
      openFloatingProperties(firstSelectedId)
    }
  }, [selectedNodeIds, workspacePreferences.propertiesDisplayMode, openFloatingProperties, floatingPropertiesNodeIds])

  // Save handler - routes through sync provider to cancel any pending debounced save
  const handleSave = useCallback(async (): Promise<void> => {
    try {
      const data = getWorkspaceData()
      const success = syncProvider
        ? await syncProvider.saveImmediate(data)
        : (await window.api.workspace.save(data)).success
      if (success) {
        markClean()
        sciFiToast('Workspace saved', 'success')
      } else {
        toast.error('Failed to save workspace')
      }
    } catch (error) {
      toast.error('Failed to save workspace')
      console.error('Save error:', error)
    }
  }, [getWorkspaceData, markClean, syncProvider])

  // New workspace handler
  const handleNew = useCallback((): void => {
    newWorkspace()
    sciFiToast('New workspace created', 'success')
  }, [newWorkspace])

  // Open workspace handler - shows file picker dialog
  const handleOpen = useCallback(async (): Promise<void> => {
    try {
      const dialogResult = await window.api.dialog.showOpenDialog({
        title: 'Open Workspace',
        filters: [
          { name: 'Cognograph Workspace', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
        return // User cancelled
      }

      const filePath = dialogResult.filePaths[0]!
      const loadResult = await window.api.workspace.loadFromPath(filePath)
      if (loadResult.success && loadResult.data) {
        loadWorkspace(loadResult.data as Parameters<typeof loadWorkspace>[0])
        sciFiToast('Loaded workspace from file', 'success')
      } else {
        toast.error('Failed to load: ' + (loadResult.error || 'Unknown error'))
      }
    } catch (error) {
      toast.error('Failed to open workspace')
      console.error('Open error:', error)
    }
  }, [loadWorkspace])

  // Save As handler - shows file picker dialog for custom save location
  const handleSaveAs = useCallback(async (): Promise<void> => {
    try {
      const data = getWorkspaceData()
      const dialogResult = await window.api.dialog.showSaveDialog({
        title: 'Save Workspace As',
        defaultPath: `${data.name || 'workspace'}.json`,
        filters: [
          { name: 'Cognograph Workspace', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (dialogResult.canceled || !dialogResult.filePath) {
        return // User cancelled
      }

      const result = await window.api.workspace.saveAs(data, dialogResult.filePath)
      if (result.success) {
        markClean()
        sciFiToast('Workspace saved to file', 'success')
      } else {
        toast.error('Failed to save: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      toast.error('Failed to save workspace')
      console.error('Save As error:', error)
    }
  }, [getWorkspaceData, markClean])

  // Viewport change handler
  const handleMoveEnd = useCallback((): void => {
    const viewport = getViewport()
    setViewport(viewport)
  }, [getViewport, setViewport])

  // Edge double-click handler - show connection info or delete option
  const handleEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: { id: string; source: string; target: string }): void => {
      const sourceNode = nodesRef.current.find((n) => n.id === edge.source)
      const targetNode = nodesRef.current.find((n) => n.id === edge.target)

      if (sourceNode && targetNode) {
        sciFiToast(
          `Connection: ${sourceNode.data.title || 'Untitled'} \u2192 ${targetNode.data.title || 'Untitled'}`,
          'info', 2000
        )
      }
    },
    []
  )

  // Handle edge reconnection (dragging edge endpoints)
  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null }): void => {
      if (newConnection.source && newConnection.target) {
        reconnectEdge(oldEdge as Edge<EdgeData>, {
          source: newConnection.source,
          target: newConnection.target,
          sourceHandle: newConnection.sourceHandle ?? null,
          targetHandle: newConnection.targetHandle ?? null
        })
      }
    },
    [reconnectEdge]
  )

  // Connection start handler - track when user starts dragging a connection
  const handleConnectStart: OnConnectStart = useCallback(
    (_event, params) => {
      if (params.nodeId) {
        const conn = {
          sourceNodeId: params.nodeId,
          sourceHandleId: params.handleId
        }
        pendingConnectionRef.current = conn
        setPendingConnection(conn)
      }
    },
    []
  )

  // Connection end handler - show quick-connect popup if dropped on empty canvas or Ctrl held
  const handleConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const mouseEvent = event as MouseEvent | TouchEvent
      const ctrlHeld = lastConnectionCtrlRef.current || ('ctrlKey' in mouseEvent && mouseEvent.ctrlKey)
      const conn = pendingConnectionRef.current

      if (conn && lastConnectionMousePos.current && ctrlHeld) {
        // Show quick-connect popup (only when Ctrl is held)
        const { x, y } = lastConnectionMousePos.current
        const flowPos = screenToFlowPosition({ x, y })
        setQuickConnectPopup({
          screenPosition: { x, y },
          flowPosition: flowPos,
          sourceNodeId: conn.sourceNodeId,
          sourceHandleId: conn.sourceHandleId
        })
      }
      pendingConnectionRef.current = null
      setPendingConnection(null)
      setConnectionTarget(null)
      connectionTargetRef.current = null
      lastConnectionMousePos.current = null
      lastConnectionCtrlRef.current = false
    },
    [screenToFlowPosition]
  )

  // Calculate closest handle when hovering over a node during connection
  const calculateClosestHandle = useCallback(
    (targetNodeId: string, clientX: number, clientY: number): { handleId: string; position: { x: number; y: number } } | null => {
      const targetNode = getInternalNode(targetNodeId)
      if (!targetNode) return null

      // Get flow position of cursor
      const cursorPos = screenToFlowPosition({ x: clientX, y: clientY })

      // Node bounds in flow coordinates
      const nodeX = targetNode.internals.positionAbsolute.x
      const nodeY = targetNode.internals.positionAbsolute.y
      const nodeWidth = targetNode.measured?.width || 300
      const nodeHeight = targetNode.measured?.height || 150

      // Handle positions (center of each side)
      const handles: Array<{ id: string; x: number; y: number }> = [
        { id: 'top-target', x: nodeX + nodeWidth / 2, y: nodeY },
        { id: 'bottom-target', x: nodeX + nodeWidth / 2, y: nodeY + nodeHeight },
        { id: 'left-target', x: nodeX, y: nodeY + nodeHeight / 2 },
        { id: 'right-target', x: nodeX + nodeWidth, y: nodeY + nodeHeight / 2 }
      ]

      // Find closest handle
      let closestHandle: { id: string; x: number; y: number } = handles[0]!
      let minDistance = Infinity

      for (const handle of handles) {
        const dx = cursorPos.x - handle.x
        const dy = cursorPos.y - handle.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < minDistance) {
          minDistance = distance
          closestHandle = handle
        }
      }

      return { handleId: closestHandle.id, position: { x: closestHandle.x, y: closestHandle.y } }
    },
    [getInternalNode, screenToFlowPosition]
  )

  // Track mouse movement during connection to update target handle
  useEffect(() => {
    if (!pendingConnection) return

    const handleMouseMove = (e: MouseEvent): void => {
      // Track last mouse position and Ctrl state for quick-connect popup
      lastConnectionMousePos.current = { x: e.clientX, y: e.clientY }
      lastConnectionCtrlRef.current = e.ctrlKey

      // Find the node element under the cursor
      const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY)
      let targetNodeId: string | null = null

      for (const el of elementsUnderCursor) {
        const nodeElement = el.closest('.react-flow__node')
        if (nodeElement) {
          const nodeId = nodeElement.getAttribute('data-id')
          // Don't connect to self
          if (nodeId && nodeId !== pendingConnection.sourceNodeId) {
            targetNodeId = nodeId
            break
          }
        }
      }

      if (targetNodeId) {
        const result = calculateClosestHandle(targetNodeId, e.clientX, e.clientY)
        if (result) {
          // Get the target node's color
          const targetNode = nodesRef.current.find(n => n.id === targetNodeId)
          const targetData = targetNode?.data as NodeData | undefined
          const nodeType = targetData?.type || 'conversation'
          // First check for custom node color, then fall back to theme color for that node type
          const nodeColor = targetData?.color ||
            themeSettings.nodeColors[nodeType as keyof typeof themeSettings.nodeColors] ||
            '#6366f1'

          const target = { nodeId: targetNodeId, handleId: result.handleId, nodeColor }
          connectionTargetRef.current = target
          setConnectionTarget(target)
        }
      } else {
        connectionTargetRef.current = null
        setConnectionTarget(null)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [pendingConnection, calculateClosestHandle, themeSettings.nodeColors])

  // Apply visual feedback class to target node's handle
  useEffect(() => {
    // Remove previous highlight and reset styles
    document.querySelectorAll('.connection-target-highlight').forEach(el => {
      el.classList.remove('connection-target-highlight')
    })
    // Also remove the CSS variable from any previously highlighted nodes
    document.querySelectorAll('.react-flow__node').forEach(el => {
      ;(el as HTMLElement).style.removeProperty('--target-highlight-color')
    })

    if (connectionTarget) {
      // Find the node element first
      const nodeElement = document.querySelector(`.react-flow__node[data-id="${connectionTarget.nodeId}"]`) as HTMLElement | null
      if (nodeElement) {
        // Set the color variable on the node element so it cascades to children and animations
        nodeElement.style.setProperty('--target-highlight-color', connectionTarget.nodeColor)

        // Determine which position class to look for based on handle ID
        const positionClass = connectionTarget.handleId.includes('top') ? 'react-flow__handle-top' :
          connectionTarget.handleId.includes('bottom') ? 'react-flow__handle-bottom' :
          connectionTarget.handleId.includes('left') ? 'react-flow__handle-left' :
          'react-flow__handle-right'

        // Find all handles with that position (there may be source and target)
        const handles = nodeElement.querySelectorAll(`.${positionClass}`)
        handles.forEach(handle => {
          handle.classList.add('connection-target-highlight')
        })
      }
    }
  }, [connectionTarget])

  // Custom onConnect that uses the calculated closest handle
  const handleConnect = useCallback(
    (connection: Connection): void => {
      // If Ctrl was held, don't auto-connect - let quick-connect popup handle it
      if (lastConnectionCtrlRef.current) return

      // If we have a calculated target, use that handle
      if (connectionTarget && connection.target === connectionTarget.nodeId) {
        onConnect({
          ...connection,
          targetHandle: connectionTarget.handleId
        })
      } else {
        onConnect(connection)
      }
    },
    [onConnect, connectionTarget]
  )

  // Node drag start handler - capture initial positions for undo/redo
  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: { id: string }): void => {
      // Track all selected nodes if this node is selected, otherwise just this node
      const nodesToTrack = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id]
      startNodeDrag(nodesToTrack)
      snapResultRef.current = null
      setIsDraggingNode(true)  // Pause physics during drag
    },
    [selectedNodeIds, startNodeDrag]
  )

  // Node drag handler - calculate snap guides during drag
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: { id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number }; width?: number; height?: number }): void => {
      const currentNodes = nodesRef.current
      const draggedIds = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id]
      const staticNodeRects = currentNodes
        .filter(n => !draggedIds.includes(n.id))
        .map(n => ({
          position: n.position,
          width: (n.width as number) || n.measured?.width || 280,
          height: (n.height as number) || n.measured?.height || 140
        }))

      const primaryRect = {
        position: node.position,
        width: (node.width as number) || node.measured?.width || 280,
        height: (node.height as number) || node.measured?.height || 140
      }

      const result = calculateSnapGuides(
        draggedIds.map(id => {
          const n = currentNodes.find(nd => nd.id === id)
          return n ? {
            position: n.position,
            width: (n.width as number) || n.measured?.width || 280,
            height: (n.height as number) || n.measured?.height || 140
          } : primaryRect
        }),
        staticNodeRects,
        node.position,
        primaryRect
      )

      setSnapGuides(result.guides)
      snapResultRef.current = result.snappedPosition
    },
    [selectedNodeIds]
  )

  // Node drag stop handler - apply snap and check if dropped on a project
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: { id: string; type?: string; position: { x: number; y: number } }): void => {
      // Apply snap if available
      if (snapResultRef.current) {
        const snapped = snapResultRef.current
        if (snapped.x !== node.position.x || snapped.y !== node.position.y) {
          const draggedIds = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id]
          const deltaX = snapped.x - node.position.x
          const deltaY = snapped.y - node.position.y

          // Apply snap offset to all dragged nodes
          onNodesChange(
            draggedIds.map(id => {
              const n = nodesRef.current.find(nd => nd.id === id)
              return {
                type: 'position' as const,
                id,
                position: {
                  x: (n?.position.x || 0) + deltaX,
                  y: (n?.position.y || 0) + deltaY
                }
              }
            })
          )
        }
        snapResultRef.current = null
      }
      setSnapGuides([])

      // Commit drag to history for undo/redo
      const nodesToCommit = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id]
      commitNodeDrag(nodesToCommit)

      // Don't allow projects to be nested
      if (node.type === 'project') return

      // Find the project node under the dropped position
      const projectElements = document.querySelectorAll('[data-project-id]')
      const draggedElement = document.querySelector(`[data-id="${node.id}"]`)

      if (!draggedElement) return

      const draggedRect = draggedElement.getBoundingClientRect()
      const draggedCenter = {
        x: draggedRect.left + draggedRect.width / 2,
        y: draggedRect.top + draggedRect.height / 2
      }

      let foundProject: string | null = null

      projectElements.forEach((el) => {
        const projectId = el.getAttribute('data-project-id')
        if (projectId === node.id) return // Can't drop on self

        const rect = el.getBoundingClientRect()
        if (
          draggedCenter.x >= rect.left &&
          draggedCenter.x <= rect.right &&
          draggedCenter.y >= rect.top &&
          draggedCenter.y <= rect.bottom
        ) {
          foundProject = projectId
        }
      })

      // Get current parent of the node
      const currentParentId = nodesRef.current.find((n) => n.id === node.id)?.data?.parentId as
        | string
        | undefined

      if (foundProject) {
        // Only add if not already in this project
        if (currentParentId !== foundProject) {
          addNodeToProject(node.id, foundProject)
          sciFiToast('Node added to project', 'success')
        }
      } else if (currentParentId) {
        // Node was dragged out of its parent project
        removeNodeFromProject(node.id)
        sciFiToast('Node removed from project', 'success')
      }

      // Auto-pin nodes when manually dragged (flexible positioning feature)
      const draggedIds = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id]
      draggedIds.forEach(id => {
        const draggedNode = nodesRef.current.find(n => n.id === id)
        if (draggedNode && draggedNode.data?.layoutMode !== 'pinned') {
          updateNode(id, { layoutMode: 'pinned' })
        }
      })

      // Apply spring physics animation on drag end
      draggedIds.forEach(id => {
        const nodeEl = document.querySelector(`.react-flow__node[data-id="${id}"]`)
        if (nodeEl) {
          nodeEl.classList.add('node-drag-end')
          setTimeout(() => nodeEl.classList.remove('node-drag-end'), 150)
        }
      })

      // Resume physics after drag
      setIsDraggingNode(false)
    },
    [addNodeToProject, removeNodeFromProject, selectedNodeIds, commitNodeDrag, onNodesChange, updateNode]
  )

  // File drop handler - creates artifact nodes from dropped files
  const handleFileDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
      event.preventDefault()
      event.stopPropagation()
      setIsDraggingFile(false)

      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })

      // Process each dropped file
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file) continue

        const offset = { x: i * 340, y: i * 20 } // Cascade multiple files

        try {
          // Check if it's an image file
          const isImage = file.type.startsWith('image/')

          let content: string
          if (isImage) {
            // Convert to base64 for images
            content = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
          } else {
            // Read as text for other files
            content = await file.text()
          }

          createArtifactFromFile(
            { name: file.name, content, isBase64: isImage },
            { x: position.x + offset.x, y: position.y + offset.y }
          )

          sciFiToast(`Created artifact: ${file.name}`, 'success')
        } catch (error) {
          console.error('Error reading file:', error)
          toast.error(`Failed to read: ${file.name}`)
        }
      }
    },
    [screenToFlowPosition, createArtifactFromFile]
  )

  // File drag handlers
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    // Check if dragging files (not nodes)
    if (event.dataTransfer?.types.includes('Files')) {
      setIsDraggingFile(true)
    }
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    // Only reset if leaving the main container
    if (event.currentTarget === event.target) {
      setIsDraggingFile(false)
    }
  }, [])

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer?.types.includes('Files')) {
      setIsDraggingFile(true)
    }
  }, [])

  // Selection change handler - filters out parent projects when children are selected
  // This prevents selecting the project container when marquee-selecting inside it
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      // Skip if no nodes selected or only one node
      if (selectedNodes.length <= 1) return

      // Fast path: no projects selected
      const hasProjects = selectedNodes.some((n) => n.data.type === 'project')
      if (!hasProjects) return

      const projectsToDeselect = filterParentProjects(selectedNodes)

      if (projectsToDeselect.length === 0) return

      // Dispatch selection changes through onNodesChange
      const deselectChanges = projectsToDeselect.map((id) => ({
        type: 'select' as const,
        id,
        selected: false
      }))

      onNodesChange(deselectChanges)
    },
    [onNodesChange]
  )

  // Node click handler - handles Ctrl/Cmd+click to toggle selection
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey

      if (isCtrlOrCmd) {
        // Toggle this node's selection
        onNodesChange([
          {
            type: 'select',
            id: node.id,
            selected: !node.selected
          }
        ])
        // Prevent default behavior (which would clear selection and select only this node)
        event.stopPropagation()
      }
      // Otherwise, let React Flow handle normally (default click behavior)
    },
    [onNodesChange]
  )

  // Canvas click handler - records position for template paste
  // Also handles double-click detection (event.detail === 2) to create nodes
  // ND-friendly: Fast creation without keyboard shortcuts or menus
  const handlePaneClick = useCallback(
    (event: React.MouseEvent): void => {
      closeContextMenu()
      setQuickConnectPopup(null)

      // Close theme modal on left click only (not middle-click for panning)
      if (event.button === 0 && showThemeModal) {
        setShowThemeModal(false)
      }

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })
      recordCanvasClick(flowPosition)

      // Double-click detection: event.detail === 2 indicates double click
      // React Flow doesn't have onPaneDoubleClick, so we detect it here
      if (event.detail === 2 && event.button === 0) {
        // Don't create if other UI is open
        if (showSettingsModal) return

        // Create conversation at click position
        const newId = addNode('conversation', flowPosition)
        setSelectedNodes([newId])
        sciFiToast('New conversation created', 'success', 1500)
      }
    },
    [screenToFlowPosition, recordCanvasClick, closeContextMenu, showThemeModal, showSettingsModal, addNode, setSelectedNodes]
  )

  // Context menu handler
  const handleContextMenu = useCallback(
    (event: React.MouseEvent): void => {
      event.preventDefault()

      // Check if we clicked on a node or edge
      const target = event.target as HTMLElement
      const nodeElement = target.closest('[data-id]')
      const edgeElement = target.closest('.react-flow__edge')

      const screenPosition = { x: event.clientX, y: event.clientY }

      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id')
        if (nodeId) {
          // Check if multiple nodes selected
          if (selectedNodeIds.length > 1 && selectedNodeIds.includes(nodeId)) {
            openContextMenu(screenPosition, { type: 'nodes', nodeIds: selectedNodeIds })
          } else {
            openContextMenu(screenPosition, { type: 'node', nodeId })
          }
          return
        }
      }

      if (edgeElement) {
        const edgeId = edgeElement.getAttribute('data-testid')?.replace('rf__edge-', '')
        if (edgeId) {
          // Convert screen position to flow coordinates for waypoint placement
          const flowPosition = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY
          })
          openContextMenu(screenPosition, { type: 'edge', edgeId, position: flowPosition })
          return
        }
      }

      // Clicked on canvas
      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })
      openContextMenu(screenPosition, { type: 'canvas', position: flowPosition })
    },
    [screenToFlowPosition, openContextMenu, selectedNodeIds]
  )

  // Quick-connect: create node + edge when popup option is selected
  const handleQuickConnectSelect = useCallback(
    (type: NodeData['type']) => {
      if (!quickConnectPopup) return

      const newNodeId = addNode(type, quickConnectPopup.flowPosition)

      // Determine target handle based on source handle side
      const sourceHandle = quickConnectPopup.sourceHandleId || 'right-source'
      let targetHandle = 'left-target'
      if (sourceHandle.includes('left')) targetHandle = 'right-target'
      else if (sourceHandle.includes('top')) targetHandle = 'bottom-target'
      else if (sourceHandle.includes('bottom')) targetHandle = 'top-target'

      addEdge({
        source: quickConnectPopup.sourceNodeId,
        sourceHandle: quickConnectPopup.sourceHandleId,
        target: newNodeId,
        targetHandle
      })

      setQuickConnectPopup(null)
    },
    [quickConnectPopup, addNode, addEdge]
  )

  // Close quick-connect popup on Escape or outside click
  const quickConnectRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!quickConnectPopup) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setQuickConnectPopup(null)
    }
    const handleMouseDown = (e: MouseEvent): void => {
      // Don't close if clicking inside the popup
      if (quickConnectRef.current?.contains(e.target as HTMLElement)) return
      setQuickConnectPopup(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    // Delay adding mousedown to avoid closing on the same mouseup that opened it
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleMouseDown)
    }, 100)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
      clearTimeout(timer)
    }
  }, [quickConnectPopup])

  // Keyboard shortcuts (placed after all handlers are defined)
  // Uses matchesShortcut() for customizable bindings from programStore
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Helper: match shortcut ID against current event + user overrides
      const m = (id: string): boolean => matchesShortcut(e, id, keyboardOverrides)

      // Check if user is typing in an input field
      const activeElement = document.activeElement
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true'

      // Delete selected nodes/edges (but not when typing)
      if (m('delete') && !isInputFocused) {
        if (selectedNodeIds.length > 0) {
          softDeleteNodes(selectedNodeIds)
        }
        if (selectedEdgeIds.length > 0) {
          deleteEdges(selectedEdgeIds)
        }
      }

      // Escape: exit focus mode > clear clipboard > clear selection (progressive exit)
      if (e.key === 'Escape') {
        if (focusModeNodeId) {
          setFocusModeNode(null)
          sciFiToast('Focus mode exited', 'info', 1500)
        } else if (clipboardState) {
          clearClipboard()
        } else {
          clearSelection()
        }
      }

      // --- File shortcuts ---
      if (m('undo')) {
        e.preventDefault()
        const action = historyRef.current[historyIndexRef.current]
        undo()
        playSound('undo')
        if (action) sciFiToast(`Undo: ${getHistoryActionLabel(action)}`, 'info', 1500)
      }
      if (m('redo')) {
        e.preventDefault()
        const action = historyRef.current[historyIndexRef.current + 1]
        redo()
        playSound('redo')
        if (action) sciFiToast(`Redo: ${getHistoryActionLabel(action)}`, 'info', 1500)
      }
      if (m('copy') && !isInputFocused && selectedNodeIds.length > 0) {
        e.preventDefault()
        copyNodes(selectedNodeIds)
      }
      if (m('cut') && !isInputFocused && selectedNodeIds.length > 0) {
        e.preventDefault()
        cutNodes(selectedNodeIds)
      }
      if (m('paste') && !isInputFocused) {
        e.preventDefault()
        const viewportCenter = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        })
        pasteNodes(viewportCenter)
      }
      if (m('save')) {
        e.preventDefault()
        handleSave()
      }
      if (m('saveAs') && !isInputFocused) {
        e.preventDefault()
        handleSaveAs()
      }
      if (m('export') && !isInputFocused) {
        e.preventDefault()
        setShowExportDialog(prev => !prev)
      }
      // Toggle FPS counter (Ctrl + Shift + F) — not customizable
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F' && !isInputFocused) {
        e.preventDefault()
        setShowFps(prev => !prev)
      }
      if (m('newWorkspace') && !isInputFocused) {
        e.preventDefault()
        handleNew()
      }
      if (m('openWorkspace') && !isInputFocused) {
        e.preventDefault()
        handleOpen()
      }
      if (m('selectAll') && !isInputFocused) {
        e.preventDefault()
        const allNodeIds = nodesRef.current.map((n) => n.id)
        setSelectedNodes(allNodeIds)
      }

      // --- View shortcuts ---
      if (m('toggleSidebar')) {
        e.preventDefault()
        toggleLeftSidebar()
      }
      if (m('linkNodes') && !isInputFocused) {
        e.preventDefault()
        if (selectedNodeIds.length >= 2) {
          linkAllNodes(selectedNodeIds)
        }
      }
      if (m('unlinkNodes') && !isInputFocused) {
        e.preventDefault()
        if (selectedNodeIds.length >= 2) {
          unlinkSelectedNodes(selectedNodeIds)
        }
      }
      if (m('bringForward') && !isInputFocused) {
        e.preventDefault()
        if (selectedNodeIds.length > 0) {
          moveNodesForward(selectedNodeIds)
          sciFiToast('Moved forward in layers', 'success', 1200)
        }
      }
      if (m('sendBackward') && !isInputFocused) {
        e.preventDefault()
        if (selectedNodeIds.length > 0) {
          moveNodesBackward(selectedNodeIds)
          sciFiToast('Moved backward in layers', 'success', 1200)
        }
      }
      if (m('commandPalette') && !isInputFocused) {
        e.preventDefault()
        openPalette()
      }
      if (m('themeMenu') && !isInputFocused) {
        e.preventDefault()
        // Toggle theme menu dropdown
        setShowThemeMenu(prev => !prev)
      }

      // --- AI shortcuts ---
      if (m('templateBrowser') && !isInputFocused) {
        e.preventDefault()
        openTemplateBrowser()
      }
      if (m('openAIEditor') && !isInputFocused) {
        e.preventDefault()
        openAIEditor()
      }
      if (m('saveAsTemplate') && !isInputFocused) {
        e.preventDefault()
        if (selectedNodeIds.length > 0) {
          const selectedNodes = nodesRef.current.filter((n) => selectedNodeIds.includes(n.id))
          const selectedEdgesForTemplate = edgesRef.current.filter(
            (ed) => selectedNodeIds.includes(ed.source) && selectedNodeIds.includes(ed.target)
          )
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
          for (const node of selectedNodes) {
            minX = Math.min(minX, node.position.x)
            maxX = Math.max(maxX, node.position.x + (node.width || 300))
            minY = Math.min(minY, node.position.y)
            maxY = Math.max(maxY, node.position.y + (node.height || 150))
          }
          const rootNode = selectedNodes.reduce((best, node) => {
            const score = node.position.y * 10000 + node.position.x
            const bestScore = best.position.y * 10000 + best.position.x
            return score < bestScore ? node : best
          })
          openSaveTemplateModal({
            nodeIds: selectedNodeIds,
            edgeIds: selectedEdgesForTemplate.map((ed) => ed.id),
            suggestedName: suggestTemplateName(selectedNodes as import('@xyflow/react').Node<NodeData>[]),
            bounds: { width: maxX - minX, height: maxY - minY },
            rootNodeId: rootNode.id
          })
        } else {
          sciFiToast('Select nodes first to save as template', 'warning')
        }
      }
      if (m('toggleAISidebar') && !isInputFocused) {
        e.preventDefault()
        setAiSidebarOpen(prev => !prev)
      }

      // --- Quick node creation (Shift+letter) ---
      if (!isInputFocused) {
        const getSpawnPosition = (): { x: number; y: number } => {
          if (lastCanvasClick && Date.now() - lastCanvasClick.time < 5000) {
            return { x: lastCanvasClick.x, y: lastCanvasClick.y }
          }
          const viewport = getViewport()
          return {
            x: (-viewport.x + window.innerWidth / 2) / viewport.zoom,
            y: (-viewport.y + window.innerHeight / 2) / viewport.zoom
          }
        }

        const nodeShortcutMap: Array<{ id: string; type: Parameters<typeof addNode>[0]; label: string }> = [
          { id: 'createNote', type: 'note', label: 'New note created' },
          { id: 'createConversation', type: 'conversation', label: 'New conversation created' },
          { id: 'createTask', type: 'task', label: 'New task created' },
          { id: 'createProject', type: 'project', label: 'New project created' },
          { id: 'createArtifact', type: 'artifact', label: 'New artifact created' },
          { id: 'createWorkspace', type: 'workspace', label: 'New workspace created' },
          { id: 'createText', type: 'text', label: 'New text node created' },
          { id: 'createAction', type: 'action', label: 'New action created' },
          { id: 'createOrchestrator', type: 'orchestrator', label: 'New orchestrator created' }
        ]

        for (const ns of nodeShortcutMap) {
          if (m(ns.id)) {
            e.preventDefault()
            const pos = getSpawnPosition()
            const newId = addNode(ns.type, pos)
            setSelectedNodes([newId])
            sciFiToast(ns.label, 'success', 1500)
            break
          }
        }

        // Special case: createAgent (uses addAgentNode instead of addNode)
        if (m('createAgent')) {
          e.preventDefault()
          const pos = getSpawnPosition()
          const newId = addAgentNode(pos)
          setSelectedNodes([newId])
          sciFiToast('New agent created', 'success', 1500)
        }
      }

      // --- Sidebar tab shortcuts (Ctrl+1/2/3) ---
      const sidebarTabMap: Array<{ id: string; tab: 'layers' | 'activity' | 'dispatch' }> = [
        { id: 'sidebarOutline', tab: 'layers' },
        { id: 'sidebarActivity', tab: 'activity' },
        { id: 'sidebarDispatch', tab: 'dispatch' },
      ]
      for (const st of sidebarTabMap) {
        if (m(st.id)) {
          e.preventDefault()
          const ui = useUIStore.getState()
          ui.setLeftSidebarTab(st.tab)
          if (!useWorkspaceStore.getState().leftSidebarOpen) toggleLeftSidebar()
          break
        }
      }

      // --- Navigation shortcuts ---
      if (m('toggleFocusMode') && !isInputFocused) {
        e.preventDefault()
        toggleFocusMode()
        if (!focusModeNodeId && selectedNodeIds.length === 1) {
          sciFiToast('Focus mode enabled', 'info', 1500)
        } else if (focusModeNodeId) {
          sciFiToast('Focus mode disabled', 'info', 1500)
        }
      }

      // Cycle node mode (M key) for mode-aware nodes
      if (m('cycleNodeMode') && !isInputFocused && selectedNodeIds.length === 1) {
        e.preventDefault()
        const selectedId = selectedNodeIds[0]!
        const node = nodesRef.current.find((n) => n.id === selectedId)
        if (node) {
          const nodeData = node.data as any
          // Conversation nodes: chat <-> agent
          if (node.type === 'conversation') {
            const currentMode = nodeData.mode || 'chat'
            const newMode = currentMode === 'chat' ? 'agent' : 'chat'
            updateNode(selectedId, { mode: newMode })
            sciFiToast(`Mode: ${newMode}`, 'info', 1500)
          }
          // Note nodes: cycle through 10 modes
          else if (node.type === 'note') {
            const modes = ['freeform', 'page', 'component', 'content-model', 'wp-config', 'feature', 'user-story', 'bug-report', 'tech-spec', 'meeting-note']
            const currentMode = nodeData.mode || 'freeform'
            const currentIndex = modes.indexOf(currentMode as string)
            const nextIndex = (currentIndex + 1) % modes.length
            const newMode = modes[nextIndex]
            updateNode(selectedId, { mode: newMode })
            sciFiToast(`Mode: ${newMode}`, 'info', 1500)
          }
        }
      }

      if (m('toggleCollapse') && !isInputFocused) {
        e.preventDefault()
        if (selectedNodeIds.length === 1) {
          const selectedId = selectedNodeIds[0]!
          const childCount = getChildNodeIds(selectedId).length
          if (childCount > 0) {
            toggleNodeCollapsed(selectedId)
            const node = nodesRef.current.find(n => n.id === selectedId)
            if (node?.data?.collapsed) {
              sciFiToast(`Expanded ${childCount} children`, 'info', 1500)
            } else {
              sciFiToast(`Collapsed ${childCount} children`, 'info', 1500)
            }
          }
        }
      }

      if (m('bookmarkNode') && !isInputFocused) {
        e.preventDefault()
        if (selectedNodeIds.length === 1) {
          const selectedId = selectedNodeIds[0]!
          if (bookmarkedNodeId === selectedId) {
            sciFiToast('Bookmark removed', 'info', 1500)
          } else {
            sciFiToast('Bookmark set — press Alt+G to jump back', 'success', 2000)
          }
          toggleBookmark()
        }
      }

      if (m('jumpToBookmark') && !isInputFocused) {
        e.preventDefault()
        if (bookmarkedNodeId) {
          const bookmarkedNode = nodesRef.current.find(n => n.id === bookmarkedNodeId)
          if (bookmarkedNode) {
            setSelectedNodes([bookmarkedNodeId])
            const nodeWidth = bookmarkedNode.measured?.width ?? 200
            const nodeHeight = bookmarkedNode.measured?.height ?? 100
            setCenter(
              bookmarkedNode.position.x + nodeWidth / 2,
              bookmarkedNode.position.y + nodeHeight / 2,
              { zoom: 1, duration: 300 }
            )
            sciFiToast('Jumped to bookmark', 'info', 1500)
          }
        } else {
          sciFiToast('No bookmark set — press Alt+B on a node', 'warning', 2000)
        }
      }

      // Numbered bookmarks (1-9) — not customizable
      if (!isInputFocused && !(e.ctrlKey || e.metaKey)) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= 9) {
          e.preventDefault()
          if (e.shiftKey) {
            if (selectedNodeIds.length === 1) {
              const selectedId = selectedNodeIds[0]!
              const currentBookmark = numberedBookmarks[num]
              if (currentBookmark === selectedId) {
                setNumberedBookmark(num, null)
                sciFiToast(`Bookmark ${num} cleared`, 'info', 1500)
              } else {
                setNumberedBookmark(num, selectedId)
                sciFiToast(`Bookmark ${num} set — press ${num} to jump`, 'success', 2000)
              }
            } else {
              sciFiToast('Select a node first', 'warning', 1500)
            }
          } else {
            const nodeId = numberedBookmarksRef.current[num]
            if (nodeId) {
              const targetNode = nodesRef.current.find(n => n.id === nodeId)
              if (targetNode) {
                setSelectedNodes([nodeId])
                const nodeWidth = targetNode.measured?.width ?? 200
                const nodeHeight = targetNode.measured?.height ?? 100
                const x = targetNode.position.x + nodeWidth / 2
                const y = targetNode.position.y + nodeHeight / 2
                const currentZoom = getViewport().zoom
                setCenter(x, y, { zoom: Math.max(currentZoom, 0.8), duration: 300 })
                const title = (targetNode.data?.title as string) || 'Untitled'
                sciFiToast(`→ ${title} [${num}]`, 'info', 1500)
              } else {
                // Node was deleted but bookmark persists — auto-clear
                setNumberedBookmark(num, null)
                sciFiToast(`Bookmark ${num} cleared — node was deleted`, 'warning', 2000)
              }
            } else {
              sciFiToast(`No bookmark ${num} set — Shift+${num} on a node`, 'warning', 2000)
            }
          }
        }
      }

      // --- Panel toggles ---
      if (m('toggleMinimap') && !isInputFocused) {
        e.preventDefault()
        setMinimapVisible(prev => {
          const newVal = !prev
          sciFiToast(newVal ? 'Minimap shown' : 'Minimap hidden', 'info', 1500)
          return newVal
        })
      }
      if (m('toggleTheme') && !isInputFocused) {
        e.preventDefault()
        const newMode = themeSettings.mode === 'dark' ? 'light' : 'dark'
        performThemeTransition(newMode)
      }
      if (m('navigateBack') && canGoBack) {
        e.preventDefault()
        if (goBack()) {
          sciFiToast('Navigated back', 'info', 1000)
        }
      }
      if (m('navigateForward') && canGoForward) {
        e.preventDefault()
        if (goForward()) {
          sciFiToast('Navigated forward', 'info', 1000)
        }
      }
      if (m('toggleUndoHistory') && !isInputFocused) {
        e.preventDefault()
        setShowUndoHistory(prev => !prev)
      }
      if (m('toggleTrash') && !isInputFocused) {
        e.preventDefault()
        setShowTrash(prev => !prev)
      }
      if (m('toggleArchive') && !isInputFocused) {
        e.preventDefault()
        setShowArchive(prev => !prev)
      }
      if (m('toggleSavedViews') && !isInputFocused) {
        e.preventDefault()
        setShowSavedViews(prev => !prev)
      }
      if (m('toggleTimeline') && !isInputFocused) {
        e.preventDefault()
        setShowTimeline(prev => !prev)
      }

      // --- Misc non-modifier shortcuts ---
      if (m('shortcutHelp') && !isInputFocused) {
        e.preventDefault()
        toggleShortcutHelp()
      }
      if (m('inlinePrompt') && !isInputFocused) {
        e.preventDefault()
        setInlinePromptPosition({
          x: mousePositionRef.current.x,
          y: mousePositionRef.current.y
        })
        setInlinePromptOpen(true)
      }

      // Canvas keyboard navigation (Tab + Arrows) — not customizable
      if (!isInputFocused && nodesRef.current.length > 0) {
        if (e.key === 'Tab') {
          e.preventDefault()
          if (selectedNodeIds.length > 1 && !e.shiftKey) {
            setSelectionActionBarPosition({
              x: mousePositionRef.current.x,
              y: mousePositionRef.current.y
            })
            setSelectionActionBarOpen(true)
            return
          }
          const allNodes = nodesRef.current
          if (allNodes.length === 0) return
          const currentIndex = selectedNodeIds.length === 1
            ? allNodes.findIndex(n => n.id === selectedNodeIds[0])
            : -1
          let nextIndex: number
          if (e.shiftKey) {
            nextIndex = currentIndex <= 0 ? allNodes.length - 1 : currentIndex - 1
          } else {
            nextIndex = currentIndex >= allNodes.length - 1 ? 0 : currentIndex + 1
          }
          const nextNode = allNodes[nextIndex]
          if (nextNode) {
            setSelectedNodes([nextNode.id])
          }
        }

        // Arrow keys: spatial navigation to nearest node in direction
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !e.altKey) {
          e.preventDefault()
          const allNodes = nodesRef.current
          if (allNodes.length === 0 || selectedNodeIds.length !== 1) return
          const currentNode = allNodes.find(n => n.id === selectedNodeIds[0])
          if (!currentNode) return
          const currentCenterX = currentNode.position.x + ((currentNode.width as number) || 280) / 2
          const currentCenterY = currentNode.position.y + ((currentNode.height as number) || 140) / 2
          let bestNode: typeof currentNode | null = null
          let bestScore = Infinity
          for (const node of allNodes) {
            if (node.id === currentNode.id) continue
            const nodeCenterX = node.position.x + ((node.width as number) || 280) / 2
            const nodeCenterY = node.position.y + ((node.height as number) || 140) / 2
            const dx = nodeCenterX - currentCenterX
            const dy = nodeCenterY - currentCenterY
            const distance = Math.sqrt(dx * dx + dy * dy)
            let isInDirection = false
            let directionalScore = distance
            switch (e.key) {
              case 'ArrowUp':
                isInDirection = dy < -20
                directionalScore = distance + Math.abs(dx) * 2
                break
              case 'ArrowDown':
                isInDirection = dy > 20
                directionalScore = distance + Math.abs(dx) * 2
                break
              case 'ArrowLeft':
                isInDirection = dx < -20
                directionalScore = distance + Math.abs(dy) * 2
                break
              case 'ArrowRight':
                isInDirection = dx > 20
                directionalScore = distance + Math.abs(dy) * 2
                break
            }
            if (isInDirection && directionalScore < bestScore) {
              bestScore = directionalScore
              bestNode = node
            }
          }
          if (bestNode) {
            setSelectedNodes([bestNode.id])
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedNodeIds,
    selectedEdgeIds,
    deleteNodes,
    softDeleteNodes,
    deleteEdges,
    clearSelection,
    undo,
    redo,
    copyNodes,
    cutNodes,
    pasteNodes,
    screenToFlowPosition,
    setSelectedNodes,
    handleSave,
    handleSaveAs,
    handleNew,
    handleOpen,
    toggleLeftSidebar,
    openTemplateBrowser,
    openSaveTemplateModal,
    openAIEditor,
    openPalette,
    linkAllNodes,
    unlinkSelectedNodes,
    moveNodesForward,
    moveNodesBackward,
    clearClipboard,
    clipboardState,
    toggleFocusMode,
    focusModeNodeId,
    setFocusModeNode,
    toggleBookmark,
    bookmarkedNodeId,
    setNumberedBookmark,
    numberedBookmarks,
    setCenter,
    toggleShortcutHelp,
    lastCanvasClick,
    addNode,
    getViewport,
    keyboardOverrides
  ])

  return (
    <div
      className="h-screen w-screen relative flex"
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* SPATIAL COMMAND BRIDGE UI - DISABLED FOR v0.2.0 RELEASE
          Backend infrastructure complete (stores, services, optimizations).
          Frontend integration has debugging issues (components not rendering).
          Deferred to v0.3.0. See docs/TODO-BRIDGE.md for details. */}

      {/* Bridge Status Bar (Phase 1) */}
      {/* <BridgeStatusBar /> */}

      {/* Proposal Card (Phase 3) - shows when agent proposes changes */}
      {/* {activeProposal && activeProposal.status === 'pending' && (
        <ProposalCard
          proposal={activeProposal}
          open={!!activeProposalId}
          onOpenChange={(open) => {
            if (!open) useProposalStore.getState().setActiveProposal(null)
          }}
        />
      )} */}

      {/* Left sidebar */}
      <LeftSidebar />

      {/* Main canvas area */}
      <div
        className="flex-1 relative"
        onMouseMove={(e) => {
          // Track mouse position for InlinePrompt positioning
          mousePositionRef.current = { x: e.clientX, y: e.clientY }
          // Broadcast cursor position for multiplayer presence
          const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          broadcastCursor(flowPos.x, flowPos.y)
        }}
        onMouseLeave={clearCursor}
      >
        {/* File drop overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 gui-z-panels bg-blue-500/10 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
            <div className="gui-panel px-8 py-6 rounded-lg text-center shadow-xl" style={{ opacity: 0.95 }}>
              <FileText size={48} className="mx-auto mb-4 text-blue-400" />
              <div className="text-xl font-semibold gui-text">Drop files to create artifacts</div>
              <div className="gui-text-secondary mt-2">Supports code, markdown, images, JSON, and more</div>
            </div>
          </div>
        )}

        <ClickSpark>
        <ReactFlow
          className={`${semanticZoomClass} ${shiftDragState.isShiftHeld && !shiftDragState.isActive ? 'shift-drag-ready' : ''} ${shiftDragState.isActive ? 'shift-drag-active' : ''} ${focusModeNodeId ? 'focus-mode-active' : ''}`}
          nodes={filteredNodes}
          edges={combinedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onMoveEnd={handleMoveEnd}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onReconnect={handleReconnect}
          edgesReconnectable={true}
          reconnectRadius={20}
          onPaneClick={handlePaneClick}
          onContextMenu={handleContextMenu}
          onSelectionChange={handleSelectionChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: 'custom',
            animated: false
          }}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnDrag={[1, 2]}
          onViewportChange={(viewport) => {
            viewportRef.current = viewport
            const newZoom = viewport.zoom
            if (Math.abs(newZoom - lastIndicatorZoomRef.current) > 0.01) {
              lastIndicatorZoomRef.current = newZoom
              setIndicatorZoom(newZoom)
            }
          }}
          selectNodesOnDrag={false}
          multiSelectionKeyCode="Shift"
          selectionKeyCode="Shift"
          minZoom={0.1}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
          style={{ background: themeSettings.canvasBackground }}
        >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color={themeSettings.canvasGridColor === '#transparent' ? 'transparent' : themeSettings.canvasGridColor}
          className="!transition-none"
        />
        {/* Ambient canvas effects layer */}
        <AmbientEffectLayer
          settings={themeSettings.ambientEffect ?? DEFAULT_AMBIENT_EFFECT}
          accentColor={themeSettings.guiColors?.accentPrimary}
          accentSecondary={themeSettings.guiColors?.accentSecondary}
          isDark={themeSettings.mode !== 'light'}
        />
        <Controls className="!rounded-lg" />
        <EmptyCanvasHint />
        {minimapVisible && <CollapsibleMinimap />}
        <ZoomIndicator zoom={indicatorZoom} />
        <SpatialRegionOverlay />

        {/* Snap alignment guide lines */}
        {snapGuides.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            style={{ zIndex: 999 }}
          >
            {snapGuides.map((guide, i) => {
              const vp = viewportRef.current
              if (guide.type === 'vertical') {
                const sx = guide.position * vp.zoom + vp.x
                const sy1 = guide.start * vp.zoom + vp.y
                const sy2 = guide.end * vp.zoom + vp.y
                return (
                  <line
                    key={i}
                    x1={sx} y1={sy1} x2={sx} y2={sy2}
                    stroke="var(--gui-accent-primary, #06b6d4)"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    opacity={0.8}
                  />
                )
              } else {
                const sy = guide.position * vp.zoom + vp.y
                const sx1 = guide.start * vp.zoom + vp.x
                const sx2 = guide.end * vp.zoom + vp.x
                return (
                  <line
                    key={i}
                    x1={sx1} y1={sy} x2={sx2} y2={sy}
                    stroke="var(--gui-accent-primary, #06b6d4)"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    opacity={0.8}
                  />
                )
              }
            })}
          </svg>
        )}

        </ReactFlow>
        </ClickSpark>

        {/* Shift+drag edge creation preview line - positioned outside ReactFlow to avoid internal transforms */}
        {shiftDragState.isActive && shiftDragState.sourcePosition && shiftDragState.cursorPosition && (() => {
          const vp = getViewport()
          const x1 = shiftDragState.sourcePosition.x * vp.zoom + vp.x
          const y1 = shiftDragState.sourcePosition.y * vp.zoom + vp.y
          const x2 = shiftDragState.cursorPosition.x * vp.zoom + vp.x
          const y2 = shiftDragState.cursorPosition.y * vp.zoom + vp.y
          return (
            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              style={{ zIndex: 1000 }}
            >
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={shiftDragState.isValidTarget ? 'var(--gui-success, #22c55e)' : 'var(--gui-accent-primary, #3b82f6)'}
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={0.9}
              />
              {/* Target indicator circle */}
              <circle
                cx={x2}
                cy={y2}
                r={6}
                fill={shiftDragState.isValidTarget ? 'var(--gui-success, #22c55e)' : shiftDragState.targetNodeId ? 'var(--gui-error, #ef4444)' : 'var(--gui-accent-primary, #3b82f6)'}
                opacity={0.8}
              />
            </svg>
          )
        })()}

        {/* Multiplayer: Remote cursors overlay */}
        <UserCursors />

        {/* Multiplayer: Connection status indicator */}
        <div className="absolute top-2 right-2 gui-z-panels">
          <ConnectionStatus />
        </div>

        {/* Multiplayer: Session expired modal */}
        <SessionExpiredModal onClose={() => { /* Modal auto-hides when status changes */ }} />

        {/* FPS counter overlay (toggle with Ctrl+Shift+F) */}
        {showFps && (
          <div
            ref={fpsElRef}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 gui-z-panels bg-black/70 text-green-400 px-2 py-1 text-xs font-mono rounded"
          >
            -- FPS
          </div>
        )}

        {/* Quick-connect popup - appears when connection dropped on empty canvas */}
        {quickConnectPopup && (
          <div
            ref={quickConnectRef}
            className="fixed gui-z-modals"
            style={{
              left: Math.min(quickConnectPopup.screenPosition.x, window.innerWidth - 200),
              top: Math.min(quickConnectPopup.screenPosition.y, window.innerHeight - 300)
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="min-w-[180px] gui-panel border gui-border rounded-lg shadow-xl py-1">
              <div className="px-3 py-1.5 text-xs gui-text-secondary border-b gui-border">Create & Connect</div>
              {([
                { type: 'conversation' as const, icon: MessageSquare, label: 'Conversation' },
                { type: 'note' as const, icon: FileText, label: 'Note' },
                { type: 'task' as const, icon: CheckSquare, label: 'Task' },
                { type: 'project' as const, icon: Folder, label: 'Project' },
                { type: 'artifact' as const, icon: Code, label: 'Artifact' },
                { type: 'workspace' as const, icon: Boxes, label: 'Workspace' },
              ]).map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm gui-text hover:gui-panel-secondary rounded transition-colors"
                  onClick={() => handleQuickConnectSelect(type)}
                >
                  <Icon className="w-4 h-4 gui-text-secondary" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Toolbar
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onNew={handleNew}
          onOpen={handleOpen}
          onOpenThemeSettings={() => setShowThemeModal(prev => !prev)}
          onOpenSettings={() => setShowSettingsModal(true)}
          showThemeMenu={showThemeMenu}
          onShowThemeMenuChange={setShowThemeMenu}
        />

        {/* Alignment toolbar - shows when multiple nodes selected */}
        <AlignmentToolbar />

        {/* Clipboard indicator - shows when nodes are cut/copied */}
        <ClipboardIndicator />

        {/* Spatial extraction system - floating panel and drag preview */}
        <ExtractionPanel />
        <ExtractionDragPreview />

        {/* Bottom-left controls - filter & automation suggestions */}
        <div
          className="fixed bottom-4 gui-z-panels flex items-center gap-2 transition-all duration-200"
          style={{ left: leftSidebarOpen ? `${leftSidebarWidth + 62}px` : '24px' }}
        >
          <FilterViewDropdown />
          <SuggestedAutomations />
        </div>

        {/* Focus mode indicator - shows when in focus mode */}
        <FocusModeIndicator />

        {/* Undo history panel - shows action history, press Alt+H to toggle */}
        <UndoHistoryPanel isOpen={showUndoHistory} onClose={() => setShowUndoHistory(false)} />

        {/* Trash panel - shows deleted nodes, press Alt+T to toggle */}
        <TrashPanel isOpen={showTrash} onClose={() => setShowTrash(false)} />

        {/* Archive panel - shows archived nodes, press Alt+A to toggle */}
        <ArchivePanel isOpen={showArchive} onClose={() => setShowArchive(false)} />

        {/* Saved views panel - quick context switching, press Alt+V to toggle */}
        <SavedViewsPanel isOpen={showSavedViews} onClose={() => setShowSavedViews(false)} />

        {/* Timeline view - time-based node browsing, press Alt+L to toggle */}
        <TimelineView isOpen={showTimeline} onClose={() => setShowTimeline(false)} />

        {/* Keyboard shortcuts help overlay - press ? to open */}
        <KeyboardShortcutsHelp />

        {/* Progress indicator - shows long-running operations */}
        <ProgressIndicator />

        {/* Workspace info display - DISABLED (causing dark bar bug) */}
        {/* <WorkspaceInfo
          hasPropertiesPanel={selectedNodeIds.length > 0 && selectedEdgeIds.length === 0 && workspacePreferences.propertiesDisplayMode === 'sidebar'}
          propertiesPanelWidth={openChatNodeIds.length > 0 ? 280 : workspacePreferences.propertiesSidebarWidth}
        /> */}

        {/* Side panels container - shows both when chat is open */}
        <div className="absolute top-0 right-0 h-full flex pointer-events-none">
          {/* Node Properties panel - show when nodes selected AND in sidebar mode */}
          {selectedNodeIds.length > 0 && selectedEdgeIds.length === 0 && workspacePreferences.propertiesDisplayMode === 'sidebar' && (
            <ResizablePropertiesPanel
              width={openChatNodeIds.length > 0 ? 280 : workspacePreferences.propertiesSidebarWidth}
              onWidthChange={openChatNodeIds.length > 0 ? undefined : setPropertiesSidebarWidth}
              compact={openChatNodeIds.length > 0}
            />
          )}

          {/* Connection Properties panel - show when edge selected (and no nodes) */}
          {selectedEdgeIds.length > 0 && selectedNodeIds.length === 0 && selectedEdgeIds[0] && (
            <div className="pointer-events-auto">
              <ConnectionPropertiesPanel
                edgeId={selectedEdgeIds[0]}
                onClose={clearSelection}
              />
            </div>
          )}

          {/* Theme Settings Modal */}
          <ThemeSettingsModal
            open={showThemeModal}
            onOpenChange={setShowThemeModal}
          />

          {/* Multiple Chat panels - column mode */}
          {workspacePreferences.chatDisplayMode === 'column' && openChatNodeIds.map((nodeId) => (
            <div key={nodeId} className="pointer-events-auto">
              <ErrorBoundary>
                <ChatPanel nodeId={nodeId} isFocused={nodeId === activeChatNodeId} />
              </ErrorBoundary>
            </div>
          ))}
        </div>

        {/* Multiple Chat panels - modal mode (floating centered modals) */}
        {workspacePreferences.chatDisplayMode === 'modal' && openChatNodeIds.map((nodeId, index) => (
          <div
            key={nodeId}
            className="fixed inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 100 + index }}
          >
            <div
              className="pointer-events-auto"
              style={{
                transform: `translate(${index * 30}px, ${index * 30}px)`
              }}
            >
              <ErrorBoundary>
                <ChatPanel nodeId={nodeId} isFocused={nodeId === activeChatNodeId} isModal />
              </ErrorBoundary>
            </div>
          </div>
        ))}

        <Toaster
          position="bottom-right"
          toastOptions={{
            className: '!bg-[var(--gui-panel-bg)] !text-[var(--gui-text-primary)] !border !border-[var(--gui-border)]',
            duration: 3000
          }}
        />
        <SciFiToast />
        <TokenIndicator />

        {/* Template System Modals */}
        <SaveTemplateModal />
        <PasteTemplateModal />
        <TemplateBrowser />

        {/* Context Menu */}
        <ContextMenu />

        {/* Floating Properties Modals (supports multiple pinned modals) */}
        {floatingPropertiesNodeIds.map((nodeId, index) => (
          <FloatingPropertiesModal key={nodeId} nodeId={nodeId} index={index} />
        ))}

        {/* Pinned Windows (nodes popped out as floating windows) */}
        <PinnedWindowsContainer />

        {/* AI Editor Modal and Preview */}
        <AIEditorModal />
        {isAIEditorOpen && <AIEditorPreview />}
        <WorkflowProgress />

        {/* AI Editor InlinePrompt (/ key) */}
        {inlinePromptOpen && (
          <InlinePrompt
            position={inlinePromptPosition}
            onClose={() => setInlinePromptOpen(false)}
          />
        )}

        {/* AI Editor SelectionActionBar (Tab with multiple nodes selected) */}
        {selectionActionBarOpen && selectedNodeIds.length > 1 && (
          <SelectionActionBar
            selectedNodeIds={selectedNodeIds}
            position={selectionActionBarPosition}
            onClose={() => setSelectionActionBarOpen(false)}
          />
        )}

        {/* AI Sidebar (Ctrl+Shift+A) */}
        <AISidebar
          isOpen={aiSidebarOpen}
          onClose={() => setAiSidebarOpen(false)}
        />

        {/* Command Palette */}
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={closePalette} />

        {/* Settings Modal */}
        <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

        {/* Export Dialog */}
        <ExportDialog isOpen={showExportDialog} onClose={() => setShowExportDialog(false)} />

        {/* Template Picker */}
        <TemplatePicker isOpen={showTemplatePicker} onClose={() => setShowTemplatePicker(false)} />

        {/* Welcome Overlay - shown on first launch only */}
        <WelcomeOverlay onOpenSettings={() => setShowSettingsModal(true)} />

        {/* Contextual onboarding tooltip */}
        {activeTooltip && (
          <OnboardingTooltip tooltip={activeTooltip} onDismiss={dismissTooltip} />
        )}

        {/* Interactive tutorial overlay */}
        <TutorialOverlay />

        {/* Command Bar (Phase 4) - TEMPORARILY DISABLED FOR DEBUGGING */}
        {/* <CommandBar /> */}

        {/* Splash Screen */}
        <AnimatePresence>
          {!isReady && <SplashScreen />}
        </AnimatePresence>
      </div>
    </div>
  )
}

function App(): JSX.Element {
  return (
    <TooltipProvider delayDuration={300}>
      <SyncProviderWrapper>
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
      </SyncProviderWrapper>
    </TooltipProvider>
  )
}

export default App
