// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { useCallback, useEffect, useRef, useState, useMemo, Suspense, lazy } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  useUpdateNodeInternals,
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
// ChatPanel import removed — chat is now rendered in-node (ConversationNode expanded mode)
import { LeftSidebar } from './components/LeftSidebar'
import { IconRail } from './components/IconRail'
import { ExtractionPanel, ExtractionDragPreview } from './components/extractions'
import { ErrorBoundary, InlineErrorBoundary } from './components/ErrorBoundary'
import { OfflineIndicatorCompact } from './components/OfflineIndicator'
import { initOfflineListeners } from './stores/offlineStore'
import { SaveTemplateModal, PasteTemplateModal, TemplateBrowser } from './components/templates'
import { ContextMenu } from './components/ContextMenu'
import { ThemeSettingsModal } from './components/ThemeSettingsModal'
import { SettingsModal } from './components/SettingsModal'
import { FloatingPropertiesModal } from './components/FloatingPropertiesModal'
import { PinnedWindowsContainer } from './components/PinnedWindow'
import { CollapsibleMinimap } from './components/CollapsibleMinimap'
import { ZoomIndicator } from './components/ZoomIndicator'
import { ClipboardIndicator } from './components/ClipboardIndicator'
import { AIEditorModal, AIEditorPreview, InlinePrompt, SelectionActionBar, AISidebar } from './components/ai-editor'
const AmbientEffectLayer = lazy(() => import('./components/ambient/AmbientEffectLayer'))
import { LivingGrid } from './effects/LivingGrid'
const ParticleDrift = lazy(() => import('./effects/ParticleDrift'))
import { ClickSpark } from './components/ui/react-bits'
import WorkflowProgress from './components/ai-editor/WorkflowProgress'
import { CommandPalette, useCommandPalette } from './components/CommandPalette'
import { UndoHistoryPanel } from './components/UndoHistoryPanel'
import { TrashPanel } from './components/TrashPanel'
import { ArchivePanel } from './components/ArchivePanel'
import { WelcomeOverlay } from './components/onboarding/WelcomeOverlay'
import { OnboardingOverlay } from './components/onboarding/OnboardingOverlay'
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
import { ArtboardOverlay, FocusModeHint } from './components/ArtboardOverlay'
import { useArtboardMode } from './hooks/useArtboardMode'
import { KeyboardShortcutsHelp, useShortcutHelpStore } from './components/KeyboardShortcutsHelp'
import { useWorkspaceStore, getHistoryActionLabel } from './stores/workspaceStore'
import './stores/storeSyncBridge' // Bidirectional sync: workspaceStore ↔ nodesStore/edgesStore
import { initCCBridgeListener } from './stores/ccBridgeStore'
import { initConsoleLogBridge } from './stores/consoleLogStore'
import { initOrchestratorIPC } from './stores/orchestratorStore'
import { initBridgeIPC, useBridgeStore } from './stores/bridgeStore'
import { initSdkToolBridge } from './services/sdkToolBridge'
import { useGraphIntelligenceStore } from './stores/graphIntelligenceStore'
import { useProposalStore } from './stores/proposalStore'
// NOTE: ProposalCard, CommandBar, and bridge/BridgeStatusBar are deferred to v0.3.0.
// See docs/TODO-BRIDGE.md. Uncomment these imports when re-enabling.
// import { ProposalCard } from './components/bridge/ProposalCard'
// import { CommandBar } from './components/bridge/CommandBar'
// import { BridgeStatusBar as BridgeStatusBarOld } from './components/bridge/BridgeStatusBar'
import { BridgeStatusBar } from './components/BridgeStatusBar'
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
import { CanvasDistrictOverlay } from './components/canvas/CanvasDistrictOverlay'
import { ContextScopeBadge } from './components/ContextScopeBadge'
import { NodeHoverPreview } from './components/NodeHoverPreview'
import { SessionReEntryPrompt } from './components/SessionReEntryPrompt'
import { CanvasTableOfContents } from './components/CanvasTableOfContents'
import { CognitiveLoadMeter } from './components/CognitiveLoadMeter'
import { EdgeGrammarLegend } from './components/EdgeGrammarLegend'
import { ExecutionStatusOverlay } from './components/ExecutionStatusOverlay'
import { useContextVisualizationStore } from './stores/contextVisualizationStore'
import { useContextVisualization } from './hooks/useContextVisualization'
import { SuggestedAutomations } from './components/action/SuggestedAutomations'
import { WorkspaceManager } from '../../web/components/WorkspaceManager'
import { StorageWarning } from '../../web/components/StorageWarning'
import { DemoBanner } from '../../web/components/DemoBanner'
import { MessageSquare, FileText, CheckSquare, Folder, Code, Boxes, Link2 } from 'lucide-react'
import { calculateSnapGuides, type SnapGuide } from './utils/snapGuides'
import { calculateAutoFitDimensions, AUTO_FIT_CONSTRAINTS } from './utils/nodeUtils'
import { filterParentProjects } from './utils/selectionUtils'
import type { NodeData, WorkspaceNodeData, GuiColors, EdgeData } from '@shared/types'
import { DEFAULT_AMBIENT_EFFECT, DEFAULT_GLASS_SETTINGS, FONT_THEMES, FONT_LOAD_URLS } from '@shared/types'
import type { FontTheme } from '@shared/types'
import { DEFAULT_GUI_DARK, DEFAULT_GUI_LIGHT } from './constants/themePresets'
import { getGPUTier } from './utils/gpuDetection'
import { layoutEvents } from './utils/layoutEvents'
import { calculateOptimalHandles, assignSpreadHandles } from './utils/positionResolver'
import { resolveGlassStyle } from './utils/glassUtils'
import { computeZoomPerfTier } from './hooks/useZoomPerformanceTier'

import type { Edge } from '@xyflow/react'
import { UserCursors } from './components/Presence/UserCursors'
import { ConnectionStatus, SessionExpiredModal } from './components/Multiplayer'
import { initRendererPlugins } from '@plugins/renderer-registry'
import { usePresence } from './hooks/usePresence'
import { useSemanticZoomClass } from './hooks/useSemanticZoom'
import { useNavigationHistory } from './hooks/useNavigationHistory'
import { useSpacebarPan } from './hooks/useSpacebarPan'
import { ZoomOverlay } from './components/canvas/ZoomOverlay'
import { ClusterOverlay } from './components/canvas/ClusterOverlay'
import { KeyboardModeIndicator } from './components/canvas/KeyboardModeIndicator'
import { DirectionalGuides } from './components/DirectionalGuides'
import { KeyboardLegend } from './components/KeyboardLegend'
import { useContextSelectionStore } from './stores/contextSelectionStore'
import { useSpatialRegionStore } from './stores/spatialRegionStore'
import { tidyUpLayout } from './utils/tidyUpLayout'
import type { LayoutNode, LayoutEdge } from './utils/tidyUpLayout'
import { useIsMobile, useIsTouch } from './hooks/useIsMobile'
import { useLongPress } from './hooks/useLongPress'
import { useShiftDragEdgeCreation } from './hooks/useShiftDragEdgeCreation'
import { useSpatialNavigation } from './hooks/useSpatialNavigation'
import { usePhysicsSimulation, DEFAULT_PHYSICS_CONFIG, getPhysicsConfigForStrength } from './hooks/usePhysicsSimulation'
import { playSound } from './services/audioService'
import { performThemeTransition } from './utils/themeTransition'
import { escapeManager, EscapePriority } from './utils/EscapeManager'
import './styles/nodes.css'
import './styles/token-estimator.css'
import './styles/presence.css'
import './styles/bridgeAnimations.css'

// Web build detection — set by vite.config.web.ts
const isWeb = import.meta.env.VITE_BUILD_TARGET === 'web'

// Initialize plugin renderer registry
// Returns Promise<void> — no await needed at module level (fire-and-forget)
initRendererPlugins()

// Expose stores on window for diagnostic server + dogfood testing (dev only)
if (import.meta.env.DEV) {
  ;(window as any).workspaceStore = useWorkspaceStore
  ;(window as any).programStore = useProgramStore
}

// Lazy font loading — module-level Set tracks which fonts have been loaded
const loadedFonts = new Set<string>(['space-grotesk'])

function ensureFontLoaded(fontTheme: FontTheme): void {
  if (loadedFonts.has(fontTheme)) return
  loadedFonts.add(fontTheme)
  const href = FONT_LOAD_URLS[fontTheme]
  if (!href) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

// PFD Phase 5B: Rect overlap check for auto-grow (used in handleNodeDragStop)
function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

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
          className="absolute left-0 top-0 w-3 h-full cursor-ew-resize z-[51] group"
          onMouseDown={handleResizeStart}
        >
          {/* Visual indicator line */}
          <div className="absolute left-0 top-0 w-0.5 h-full bg-[var(--border-subtle)] opacity-0 group-hover:opacity-100 transition-opacity" />
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
  const { getViewport, screenToFlowPosition, getInternalNode, setCenter, fitView, zoomTo } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const semanticZoomClass = useSemanticZoomClass()
  const { goBack, goForward, canGoBack, canGoForward } = useNavigationHistory()
  const demoMode = useWorkspaceStore((s) => s.demoMode)
  const isMobile = useIsMobile()
  const isTouch = useIsTouch()

  // Layout pipeline event bridge — listen for fitView requests from chatToolService
  // Uses nodesRef declared below (line ~354) to avoid dependency on nodes array
  // Initialize offline detection listeners
  useEffect(() => {
    const cleanup = initOfflineListeners()
    return cleanup
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeIds, padding, duration, minZoom } = (e as CustomEvent).detail
      const targets = nodesRef.current.filter((n: any) => nodeIds.includes(n.id))
      if (targets.length) fitView({ nodes: targets, padding, duration, minZoom: minZoom ?? 0.35 })
    }
    layoutEvents.addEventListener('fitView', handler)
    return () => layoutEvents.removeEventListener('fitView', handler)
  }, [fitView])

  // PFD Phase 5B: Spacebar + Arrow key panning
  useSpacebarPan()

  // Task 26: Spatial keyboard navigation (Arrow keys, Tab, Shift+Arrow)
  useSpatialNavigation()

  // PFD Phase 5B: Context selection store (transient Ctrl+Click context)
  const toggleContextSelection = useContextSelectionStore((s) => s.toggle)

  // PFD Phase 5B: Spatial region auto-grow
  const autoGrowRegion = useSpatialRegionStore((s) => s.autoGrowRegion)
  const spatialRegions = useSpatialRegionStore((s) => s.regions)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsCategory, setSettingsCategory] = useState<string | undefined>(undefined)
  const [showCanvasTOC, setShowCanvasTOC] = useState(false)
  const [showEdgeLegend, setShowEdgeLegend] = useState(false)
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

  // Snap-to-guide state — use ref + counter to avoid full App re-render on every drag frame
  const snapGuidesRef = useRef<SnapGuide[]>([])
  const [snapGuidesVersion, setSnapGuidesVersion] = useState(0)
  const snapGuides = snapGuidesRef.current
  const setSnapGuides = useCallback((guides: SnapGuide[]) => {
    const prev = snapGuidesRef.current
    // Only trigger re-render if guides actually changed (empty→empty is common)
    if (prev.length === 0 && guides.length === 0) return
    snapGuidesRef.current = guides
    setSnapGuidesVersion(v => v + 1)
  }, [])
  const snapResultRef = useRef<{ x: number; y: number } | null>(null)
  const viewportRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 })
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [indicatorZoom, setIndicatorZoom] = useState(1)
  const lastIndicatorZoomRef = useRef(1)

  // Multiplayer presence
  const { broadcastCursor, clearCursor } = usePresence()

  const nodes = useWorkspaceStore((state) => state.nodes) ?? []
  const hiddenNodeTypes = useWorkspaceStore((state) => state.hiddenNodeTypes)
  const edges = useWorkspaceStore((state) => state.edges) ?? []
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const leftSidebarOpen = useWorkspaceStore((state) => state.leftSidebarOpen)
  const leftSidebarWidth = useWorkspaceStore((state) => state.leftSidebarWidth)

  // Keyboard shortcut overrides (program-level)
  const keyboardOverrides = useProgramStore(selectKeyboardOverrides)

  // Ghost node/edge elements from proposal store
  const ghostNodes = useProposalStore(s => s.ghostNodes)
  const ghostEdges = useProposalStore(s => s.ghostEdges)
  const activeProposalId = useProposalStore(s => s.activeProposalId)
  const _activeProposal = useProposalStore(s => activeProposalId ? s.proposals[activeProposalId] : null)

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
  // Workspace manager panel visibility (web only)
  const [showWorkspaceManager, setShowWorkspaceManager] = useState(false)
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

  // PFD Phase 5B: Apply context-selection-ring CSS class to context-selected nodes
  useEffect(() => {
    const unsub = useContextSelectionStore.subscribe((state) => {
      // Remove ring from all nodes first
      document.querySelectorAll('.context-selection-ring').forEach(el => {
        el.classList.remove('context-selection-ring')
      })
      // Add ring to context-selected nodes
      state.selectedNodeIds.forEach(nodeId => {
        const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`)
        if (el) el.classList.add('context-selection-ring')
      })
    })
    return unsub
  }, [])

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

  // Listen for mobile toolbar panel toggles
  useEffect(() => {
    const tocHandler = () => setShowCanvasTOC(p => !p)
    window.addEventListener('toggle-canvas-toc', tocHandler)
    return () => window.removeEventListener('toggle-canvas-toc', tocHandler)
  }, [])

  // Listen for open-template-picker events from Command Palette
  useEffect(() => {
    const handler = (): void => setShowTemplatePicker(true)
    window.addEventListener('open-template-picker', handler)
    return () => window.removeEventListener('open-template-picker', handler)
  }, [])

  // Initialize CC Bridge + Orchestrator + Spatial Bridge IPC listeners (Electron only)
  useEffect(() => {
    if (!(window as any).__ELECTRON__) return
    const cleanupCCBridge = initCCBridgeListener()
    const cleanupOrch = initOrchestratorIPC()       // Must init BEFORE bridge
    const cleanupSpatialBridge = initBridgeIPC()     // Bridge subscribes to orchestrator events
    initSdkToolBridge()                              // Agent SDK in-process MCP tool bridge

    // Wire graph intelligence insights from main process
    let unsubInsights: (() => void) | undefined
    if (window.api?.bridge?.onInsights) {
      unsubInsights = window.api.bridge.onInsights((rawInsights: unknown) => {
        if (!Array.isArray(rawInsights)) return
        const insights = rawInsights.map((i: any) => ({
          ...i,
          status: i.status || 'new',
          detectedAt: i.detectedAt || Date.now(),
        }))
        useGraphIntelligenceStore.getState().addInsights(insights)
      })
    }

    // Wire graph intelligence snapshot requests from main process (Fix 2.2)
    // Responds to IPC snapshot requests with minimal graph data (no content bodies or credentials)
    let unsubSnapshot: (() => void) | undefined
    if (window.api?.bridge?.onSnapshotRequest) {
      unsubSnapshot = window.api.bridge.onSnapshotRequest((requestId: string) => {
        try {
          const { nodes, edges } = useWorkspaceStore.getState()
          const snapshot = {
            nodes: nodes.map((n) => ({
              id: n.id,
              type: n.data?.type || n.type || 'unknown',
              title: n.data?.title || '',
              updatedAt: n.data?.updatedAt || 0,
              createdAt: n.data?.createdAt || 0,
              position: { x: n.position.x, y: n.position.y },
            })),
            edges: edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              bidirectional: (e.data as any)?.bidirectional ?? false,
            })),
            timestamp: Date.now(),
          }
          window.api.bridge.respondSnapshot(requestId, snapshot)
        } catch {
          window.api.bridge.respondSnapshot(requestId, null)
        }
      })
    }

    return () => {
      cleanupSpatialBridge()
      cleanupCCBridge()
      cleanupOrch()
      unsubInsights?.()
      unsubSnapshot?.()
    }
  }, [])

  // Initialize main process console log bridge (Electron only)
  useEffect(() => {
    if (!(window as any).__ELECTRON__) return
    let cleanup: (() => void) | undefined
    initConsoleLogBridge().then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [])

  // Global terminal output tee — persists across artboard open/close so node cards
  // always show fresh terminal preview lines, even when TerminalPanel is unmounted
  useEffect(() => {
    if (!(window as any).__ELECTRON__) return
    if (!window.api?.terminal?.onDataGlobal) return

    const buffers = new Map<string, string>()
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = window.api.terminal.onDataGlobal((nodeId: string, data: string) => {
      const existing = buffers.get(nodeId) || ''
      buffers.set(nodeId, existing + data)

      if (flushTimer) return
      flushTimer = setTimeout(() => {
        flushTimer = null
        const updateNode = useWorkspaceStore.getState().updateNode
        for (const [nid, buf] of buffers.entries()) {
          const clean = buf.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
          const lines = clean.split('\n').filter((l: string) => l.trim().length > 0)
          const last12 = lines.slice(-12).map((l: string) => l.slice(0, 120))
          if (last12.length > 0) {
            updateNode(nid, { terminalPreviewLines: last12 })
          }
        }
        for (const [nid, buf] of buffers.entries()) {
          if (buf.length > 4096) buffers.set(nid, buf.slice(-4096))
        }
      }, 200)
    })

    return () => {
      cleanup()
      if (flushTimer) clearTimeout(flushTimer)
    }
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

    // Sync core design tokens so all UI (nav, toolbar, menus) responds to theme
    root.style.setProperty('--surface-panel', guiColors.panelBackground)
    root.style.setProperty('--surface-panel-secondary', guiColors.panelBackgroundSecondary)
    root.style.setProperty('--text-primary', guiColors.textPrimary)
    root.style.setProperty('--text-secondary', guiColors.textSecondary)
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
      root.style.setProperty('--glass-opacity', `${glassSettings.panelOpacity}`) // Unitless number for calc()
      root.style.setProperty('--glass-noise-opacity', `${glassSettings.noiseOpacity / 100}`)
      root.style.setProperty('--glass-shimmer-speed', `${glassSettings.shimmerSpeed}`)

      // Set all data attributes atomically
      const applyTo = glassSettings.applyTo ?? DEFAULT_GLASS_SETTINGS.applyTo

      const attrs = {
        'data-glass-style': effectiveStyle,
        'data-glass-modals': applyTo.modals,
        'data-glass-panels': applyTo.panels,
        'data-glass-overlays': applyTo.overlays,
        'data-glass-toolbar': applyTo.toolbar
        // NOTE: data-glass-nodes removed — content-first: no glass on nodes
      }

      Object.entries(attrs).forEach(([key, value]) => {
        root.setAttribute(key, String(value))
      })
    })

    // Cleanup on unmount
    return () => {
      const root = document.documentElement
      root.removeAttribute('data-glass-style')
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

  // Apply accent colors from theme's guiColors (accent is theme-driven, not separate)
  useEffect(() => {
    const guiColors = themeSettings.guiColors ||
      (themeSettings.mode === 'light' ? DEFAULT_GUI_LIGHT : DEFAULT_GUI_DARK)
    const accent = guiColors.accentPrimary
    const glow = guiColors.accentSecondary

    document.documentElement.style.setProperty('--cg-accent', accent)
    document.documentElement.style.setProperty('--accent-glow', glow)
    document.documentElement.style.setProperty('--accent-glow-subtle', `${glow}26`)
    document.documentElement.style.setProperty('--accent-glow-strong', `${glow}59`)
  }, [themeSettings.guiColors, themeSettings.mode])

  // Apply font theme CSS variables (lazy-loads non-default fonts)
  useEffect(() => {
    const fontTheme = themeSettings.fontTheme || 'space-grotesk'
    ensureFontLoaded(fontTheme as FontTheme)
    const fonts = FONT_THEMES[fontTheme as FontTheme]
    if (fonts) {
      document.documentElement.style.setProperty('--font-sans', fonts.sans)
      document.documentElement.style.setProperty('--font-display', fonts.display)
      document.documentElement.style.setProperty('--font-mono', fonts.mono)
    }
  }, [themeSettings.fontTheme])

  // Apply base font size CSS variable
  useEffect(() => {
    const size = themeSettings.fontSize || 14
    document.documentElement.style.setProperty('--font-base', `${size}px`)
  }, [themeSettings.fontSize])

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
  // openChatNodeIds removed — chat is now rendered in-node

  // PFD Phase 4: Context Visualization
  const contextVizActive = useContextVisualizationStore((state) => state.active)
  const contextVizTargetNodeId = useContextVisualizationStore((state) => state.targetNodeId)
  const contextVizIsTerminal = useContextVisualizationStore((state) => state.isTerminalTarget)
  const contextVizNodeIds = useContextVisualizationStore((state) => state.includedNodeIds)
  const contextVizEdgeIds = useContextVisualizationStore((state) => state.includedEdgeIds)
  const { showContextScope, hideContextScope } = useContextVisualization()

  // PFD Phase 5A: In-Place Expansion
  const inPlaceExpandedNodeId = useWorkspaceStore((state) => state.inPlaceExpandedNodeId)
  const collapseInPlaceExpansion = useWorkspaceStore((state) => state.collapseInPlaceExpansion)

  // PFD Phase 6C: Session interaction recording
  const recordInteraction = useWorkspaceStore((state) => state.recordInteraction)
  const lastSessionNodeId = useWorkspaceStore((state) => state.lastSessionNodeId)

  // PFD Phase 7B: Calm Mode
  const calmMode = useWorkspaceStore((state) => state.calmMode)
  const toggleCalmMode = useWorkspaceStore((state) => state.toggleCalmMode)

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
  const isDirty = useWorkspaceStore((state) => state.isDirty)
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

  // Artboard mode - Cmd/Ctrl+Enter to expand selected node into editing panel
  useArtboardMode()

  // Contextual onboarding tooltips - shows tips on first-time actions
  const { activeTooltip, dismiss: dismissTooltip } = useOnboardingTooltips()

  // Shift+drag edge creation - allows creating edges by Shift+dragging from node to node
  const handleShiftDragEdgeCreate = useCallback(
    (sourceId: string, targetId: string) => {
      addEdge({ source: sourceId, target: targetId, sourceHandle: null, targetHandle: null })
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

  // Utility: apply creation pop animation to a newly created node
  const animateNodeCreation = useCallback((nodeId: string) => {
    // Wait for React Flow to render the DOM node, then apply animation
    requestAnimationFrame(() => {
      const nodeEl = document.querySelector(`[data-id="${nodeId}"]`)
      if (nodeEl) {
        nodeEl.classList.add('node-just-created')
        setTimeout(() => nodeEl.classList.remove('node-just-created'), 800)
      }
    })
  }, [])

  // Utility: apply flash animation to a newly created edge
  const animateEdgeCreation = useCallback((edgeId: string) => {
    requestAnimationFrame(() => {
      const edgePath = document.querySelector(`[data-testid="rf__edge-${edgeId}"] .react-flow__edge-path`)
      if (edgePath) {
        edgePath.classList.add('edge-just-connected')
        setTimeout(() => edgePath.classList.remove('edge-just-connected'), 800)
      }
    })
  }, [])

  // Compute combined edges including workspace member links
  const combinedEdges = useMemo(() => {
    // Start with the regular edges
    const allEdges: Edge[] = [...(edges || [])]

    // Find workspace nodes with showLinks enabled
    const workspaceNodesWithLinks = (nodes || []).filter(
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
  // Use className cache to avoid creating new node references during drag (breaks React Flow diffing)
  const classNameCacheRef = useRef(new Map<string, typeof nodes[0]>())
  const filteredNodes = useMemo(() => {
    const cache = classNameCacheRef.current
    const realNodes = (nodes || [])
      .filter(node => !node.data.isArchived && !hiddenNodeTypes.has(node.data.type))
      .map(node => {
        // Build className from multiple sources
        const classes: string[] = []
        if (contextProviderNodeIds.has(node.id)) {
          classes.push('context-provider-node')
        }

        // PFD Phase 6C: Recency indicators
        const updatedAt = (node.data as { updatedAt?: number }).updatedAt
        if (updatedAt) {
          const hoursAgo = (Date.now() - updatedAt) / (1000 * 60 * 60)
          if (hoursAgo < 24) classes.push('recency-fresh')
          else if (hoursAgo < 48) classes.push('recency-warm')
        }

        // PFD Phase 4: Context visualization classes
        if (contextVizActive) {
          if (node.id === contextVizTargetNodeId) {
            classes.push('context-viz-target')
          } else if (contextVizNodeIds.has(node.id)) {
            const info = contextVizNodeIds.get(node.id)!
            classes.push('context-viz-included')
            if (info.depth >= 2) classes.push(`context-viz-depth-${Math.min(info.depth, 3)}`)
          }
        }

        if (classes.length === 0) return node

        const className = classes.join(' ')
        // Reuse cached spread if the underlying node reference hasn't changed
        const cached = cache.get(node.id)
        if (cached && cached.id === node.id && cached.className === className && (cached as { _sourceRef?: unknown })._sourceRef === node) {
          return cached
        }
        const withClass = { ...node, className, _sourceRef: node } as typeof node
        cache.set(node.id, withClass)
        return withClass
      })

    // Append ghost nodes from proposal store (they have type: 'ghost')
    if (ghostNodes.length > 0) {
      return [...realNodes, ...ghostNodes as unknown as typeof realNodes]
    }

    return realNodes
  }, [nodes, hiddenNodeTypes, contextProviderNodeIds, ghostNodes, contextVizActive, contextVizTargetNodeId, contextVizNodeIds])

  // PFD Phase 4: Apply context edge classes for visualization
  // Terminal UX: Gold glow variant when target is a terminal node
  const vizEdges = useMemo(() => {
    if (!contextVizActive) return combinedEdges
    const ccClass = contextVizIsTerminal ? ' context-edge-terminal' : ''
    return combinedEdges.map(edge => {
      if (contextVizEdgeIds.has(edge.id)) {
        return { ...edge, className: `${edge.className || ''} context-edge-included${ccClass}`.trim() }
      }
      return edge
    })
  }, [combinedEdges, contextVizActive, contextVizEdgeIds, contextVizIsTerminal])

  // PFD Phase 4: Activate/deactivate context viz when chat focus changes
  useEffect(() => {
    if (activeChatNodeId) {
      showContextScope(activeChatNodeId)
    } else {
      hideContextScope()
    }
  }, [activeChatNodeId, showContextScope, hideContextScope])

  // Terminal UX: Gold glow context viz is available for terminal nodes
  // but NOT auto-triggered on selection (it dims everything and blocks interaction).
  // Trigger via activeChatNodeId like regular nodes instead.

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

  // Open workspace handler - web: opens workspace manager panel; desktop: shows file picker dialog
  const handleOpen = useCallback(async (): Promise<void> => {
    if (isWeb) {
      setShowWorkspaceManager(true)
      return
    }
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

  // Save As handler - shows file picker dialog for custom save location (Electron only)
  const handleSaveAs = useCallback(async (): Promise<void> => {
    if (!(window as any).__ELECTRON__) return
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

  // Viewport change handlers — throttle shader quality during pan/zoom
  const canvasInteractTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMoveStart = useCallback((): void => {
    useUIStore.getState().setCanvasInteracting(true)
    if (canvasInteractTimerRef.current) clearTimeout(canvasInteractTimerRef.current)
  }, [])

  const handleMoveEnd = useCallback((): void => {
    const viewport = getViewport()
    setViewport(viewport)
    // Debounce 500ms before restoring shader quality
    if (canvasInteractTimerRef.current) clearTimeout(canvasInteractTimerRef.current)
    canvasInteractTimerRef.current = setTimeout(() => {
      useUIStore.getState().setCanvasInteracting(false)
    }, 500)
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

  // Determine closest side when hovering over a node during connection.
  // Returns the side name (top/bottom/left/right) — React Flow's native hit-test
  // governs actual handle snapping for spread handles.
  const calculateClosestSide = useCallback(
    (targetNodeId: string, clientX: number, clientY: number): { side: string } | null => {
      const targetNode = getInternalNode(targetNodeId)
      if (!targetNode) return null

      const cursorPos = screenToFlowPosition({ x: clientX, y: clientY })
      const nodeX = targetNode.internals.positionAbsolute.x
      const nodeY = targetNode.internals.positionAbsolute.y
      const nodeWidth = targetNode.measured?.width || 300
      const nodeHeight = targetNode.measured?.height || 150

      const sides: Array<{ side: string; x: number; y: number }> = [
        { side: 'top', x: nodeX + nodeWidth / 2, y: nodeY },
        { side: 'bottom', x: nodeX + nodeWidth / 2, y: nodeY + nodeHeight },
        { side: 'left', x: nodeX, y: nodeY + nodeHeight / 2 },
        { side: 'right', x: nodeX + nodeWidth, y: nodeY + nodeHeight / 2 }
      ]

      let closestSide = sides[0]!
      let minDistance = Infinity
      for (const s of sides) {
        const dx = cursorPos.x - s.x
        const dy = cursorPos.y - s.y
        const distance = dx * dx + dy * dy
        if (distance < minDistance) {
          minDistance = distance
          closestSide = s
        }
      }
      return { side: closestSide.side }
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
        const result = calculateClosestSide(targetNodeId, e.clientX, e.clientY)
        if (result) {
          // Get the target node's color
          const targetNode = nodesRef.current.find(n => n.id === targetNodeId)
          const targetData = targetNode?.data as NodeData | undefined
          const nodeType = targetData?.type || 'conversation'
          // First check for custom node color, then fall back to theme color for that node type
          const nodeColor = targetData?.color ||
            themeSettings.nodeColors[nodeType as keyof typeof themeSettings.nodeColors] ||
            '#6366f1'

          // Use side for visual highlighting; RF's native hit-test handles actual handle snapping
          const target = { nodeId: targetNodeId, handleId: `${result.side}-target`, nodeColor }
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
  }, [pendingConnection, calculateClosestSide, themeSettings.nodeColors])

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

      // Let React Flow's native hit-test provide the correct handle (including spread handles)
      onConnect(connection)

      // Visual + audio feedback for successful connection
      playSound('connect')
      if (connection.source && connection.target) {
        const edgeId = `${connection.source}-${connection.target}`
        animateEdgeCreation(edgeId)
      }
    },
    [onConnect, animateEdgeCreation]
  )

  // Node drag start handler - capture initial positions for undo/redo
  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: { id: string }): void => {
      // Track all selected nodes if this node is selected, otherwise just this node
      const nodesToTrack = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id]
      startNodeDrag(nodesToTrack)
      snapResultRef.current = null
      setIsDraggingNode(true)  // Pause physics during drag
      useUIStore.getState().setCanvasInteracting(true) // Throttle shader quality during drag
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

      // Recalculate edge handles via spread distribution for all edges connected to dragged nodes
      try {
        const draggedIds = new Set(nodesToCommit)
        const affectedEdges = useWorkspaceStore.getState().edges.filter(
          (e) => draggedIds.has(e.source) || draggedIds.has(e.target)
        )

        // Build nodePositions from FRESH store state (not stale closed-over `nodes`)
        const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>()
        for (const n of useWorkspaceStore.getState().nodes) {
          nodePositions.set(n.id, {
            x: n.position.x, y: n.position.y,
            width: n.measured?.width ?? (n.width as number) ?? 280,
            height: n.measured?.height ?? (n.height as number) ?? 140
          })
        }

        const spreadAssignments = assignSpreadHandles(affectedEdges, nodePositions)
        const handleUpdates: Array<{ edgeId: string; sourceHandle: string; targetHandle: string }> = []
        for (const [edgeId, handles] of spreadAssignments) {
          handleUpdates.push({ edgeId, sourceHandle: handles.sourceHandle, targetHandle: handles.targetHandle })
        }
        if (handleUpdates.length > 0) {
          useWorkspaceStore.getState().updateEdgeHandlesBatch(handleUpdates)
        }
      } catch { /* edge handle recalc non-critical */ }

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

      // PFD Phase 5B: Auto-grow spatial regions when nodes are dropped inside
      draggedIds.forEach(id => {
        const draggedNode = nodesRef.current.find(n => n.id === id)
        if (!draggedNode) return
        const nodeW = (draggedNode.width as number) || 280
        const nodeH = (draggedNode.height as number) || 140
        const nodeBounds = {
          x: draggedNode.position.x,
          y: draggedNode.position.y,
          width: nodeW,
          height: nodeH
        }
        // Check all regions and auto-grow if the node overlaps
        for (const region of spatialRegions) {
          if (rectsOverlap(nodeBounds, region.bounds)) {
            autoGrowRegion(region.id, nodeBounds)
          }
        }
      })

      // Resume physics after drag
      setIsDraggingNode(false)
      useUIStore.getState().setCanvasInteracting(false) // Restore shader quality
    },
    [addNodeToProject, removeNodeFromProject, selectedNodeIds, commitNodeDrag, onNodesChange, updateNode, spatialRegions, autoGrowRegion]
  )

  // File drop handler - creates artifact nodes from dropped files
  // Max file size: 5MB for text, 10MB for images
  const MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024
  const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024
  const MAX_FILES_PER_DROP = 20

  const handleFileDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
      event.preventDefault()
      event.stopPropagation()
      setIsDraggingFile(false)

      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return

      if (files.length > MAX_FILES_PER_DROP) {
        toast.error(`Too many files (${files.length}). Maximum ${MAX_FILES_PER_DROP} files per drop.`)
        return
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })

      let successCount = 0
      let errorCount = 0

      // Process each dropped file
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file) continue

        const offset = { x: i * 340, y: i * 20 } // Cascade multiple files

        try {
          // Check if it's an image file
          const isImage = file.type.startsWith('image/')

          // File size check
          const maxSize = isImage ? MAX_IMAGE_FILE_SIZE : MAX_TEXT_FILE_SIZE
          if (file.size > maxSize) {
            const maxMB = Math.round(maxSize / (1024 * 1024))
            toast.error(`${file.name} too large (${(file.size / (1024 * 1024)).toFixed(1)}MB, max ${maxMB}MB)`)
            errorCount++
            continue
          }

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

          const nodeId = createArtifactFromFile(
            { name: file.name, content, isBase64: isImage },
            { x: position.x + offset.x, y: position.y + offset.y }
          )
          successCount++

          // Apply creation highlight animation
          requestAnimationFrame(() => {
            const nodeEl = document.querySelector(`[data-id="${nodeId}"]`)
            if (nodeEl) {
              nodeEl.classList.add('node-just-created')
              setTimeout(() => nodeEl.classList.remove('node-just-created'), 800)
            }
          })
        } catch (error) {
          console.error('Error reading file:', error)
          errorCount++
        }
      }

      // Summary toast
      if (successCount > 0 && errorCount === 0) {
        sciFiToast(
          successCount === 1
            ? `Created artifact: ${files[0]?.name ?? 'file'}`
            : `Created ${successCount} artifacts`,
          'success'
        )
      } else if (successCount > 0 && errorCount > 0) {
        sciFiToast(`Created ${successCount} artifact${successCount !== 1 ? 's' : ''}, ${errorCount} failed`, 'warning')
      } else if (errorCount > 0) {
        toast.error(`Failed to read ${errorCount} file${errorCount !== 1 ? 's' : ''}`)
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

  // Node click handler - handles Ctrl/Cmd+click to toggle selection + context selection
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey

      // PFD Phase 6C: Record interaction for session re-entry
      recordInteraction(node.id, 'select')

      if (isCtrlOrCmd) {
        // PFD Phase 5B: Toggle context selection for this node
        toggleContextSelection(node.id)

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
    [onNodesChange, recordInteraction, toggleContextSelection]
  )

  // Canvas click handler - records position for template paste
  // Also handles double-click detection (event.detail === 2) to create nodes
  // ND-friendly: Fast creation without keyboard shortcuts or menus
  const handlePaneClick = useCallback(
    (event: React.MouseEvent): void => {
      closeContextMenu()
      setQuickConnectPopup(null)

      // PFD Phase 5A: Collapse in-place expansion on canvas click
      if (inPlaceExpandedNodeId && event.button === 0) {
        collapseInPlaceExpansion()
      }

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
        if (showSettingsModal || showThemeModal) return

        // Create conversation at click position
        const newId = addNode('conversation', flowPosition)
        setSelectedNodes([newId])
        animateNodeCreation(newId)
        sciFiToast('New conversation created', 'success', 1500)
      }
    },
    [screenToFlowPosition, recordCanvasClick, closeContextMenu, showThemeModal, showSettingsModal, addNode, setSelectedNodes, animateNodeCreation, inPlaceExpandedNodeId, collapseInPlaceExpansion]
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

  // Long-press handler for touch devices — mirrors handleContextMenu logic
  const handleLongPress = useCallback(
    (position: { clientX: number; clientY: number }, target: HTMLElement) => {
      const nodeElement = target.closest('[data-id]')
      const edgeElement = target.closest('.react-flow__edge')

      const screenPosition = { x: position.clientX, y: position.clientY }

      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id')
        if (nodeId) {
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
          const flowPosition = screenToFlowPosition({
            x: position.clientX,
            y: position.clientY
          })
          openContextMenu(screenPosition, { type: 'edge', edgeId, position: flowPosition })
          return
        }
      }

      // Canvas long-press
      const flowPosition = screenToFlowPosition({
        x: position.clientX,
        y: position.clientY
      })
      openContextMenu(screenPosition, { type: 'canvas', position: flowPosition })
    },
    [screenToFlowPosition, openContextMenu, selectedNodeIds]
  )

  const longPressHandlers = useLongPress(handleLongPress, {
    delay: 500,
    moveThreshold: 10,
    enabled: isTouch && !demoMode
  })

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

      animateNodeCreation(newNodeId)
      setQuickConnectPopup(null)
    },
    [quickConnectPopup, addNode, addEdge, animateNodeCreation]
  )

  // Close quick-connect popup on Escape or outside click
  const quickConnectRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!quickConnectPopup) return

    const closePopup = () => setQuickConnectPopup(null)
    escapeManager.register('popover-quick-connect', EscapePriority.POPOVER, closePopup)

    const handleMouseDown = (e: MouseEvent): void => {
      // Don't close if clicking inside the popup
      if (quickConnectRef.current?.contains(e.target as HTMLElement)) return
      setQuickConnectPopup(null)
    }

    // Delay adding mousedown to avoid closing on the same mouseup that opened it
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleMouseDown)
    }, 100)

    return () => {
      escapeManager.unregister('popover-quick-connect')
      window.removeEventListener('mousedown', handleMouseDown)
      clearTimeout(timer)
    }
  }, [quickConnectPopup])

  // Keyboard shortcuts (placed after all handlers are defined)
  // Uses matchesShortcut() for customizable bindings from programStore
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Demo mode: suppress ALL keyboard shortcuts
      if (demoMode) return

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

      // Escape is now handled by EscapeManager (canvas-level progressive exit)
      // See the separate useEffect below that registers at CANVAS priority.

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
      // Paste is handled by the 'paste' event listener below (handlePaste),
      // NOT here in keydown. This allows ClipboardEvent.clipboardData access
      // for image detection. See Task 1, Step 2.
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
      // PFD Phase 7A: Toggle Canvas Table of Contents (Ctrl + Shift + T)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T' && !isInputFocused) {
        e.preventDefault()
        setShowCanvasTOC(prev => !prev)
      }
      // PFD Phase 7B: Toggle Calm Mode (Ctrl + Shift + M)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M' && !isInputFocused) {
        e.preventDefault()
        toggleCalmMode()
        sciFiToast(calmMode ? 'Calm Mode off' : 'Calm Mode on', 'info', 1500)
      }
      // PFD Phase 5B: Tidy-up layout (Ctrl + Shift + L)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L' && !isInputFocused) {
        e.preventDefault()
        const currentNodes = nodesRef.current
        const currentEdges = edgesRef.current
        // Use selected nodes, or all nodes if none selected
        const targetNodeIds = selectedNodeIds.length > 0 ? selectedNodeIds : currentNodes.map(n => n.id)
        const layoutNodes: LayoutNode[] = currentNodes
          .filter(n => targetNodeIds.includes(n.id))
          .map(n => ({
            id: n.id,
            x: n.position.x,
            y: n.position.y,
            width: (n.width as number) || 280,
            height: (n.height as number) || 140,
            pinned: (n.data as { layoutMode?: string })?.layoutMode === 'pinned' && !targetNodeIds.includes(n.id)
          }))
        const layoutEdges: LayoutEdge[] = currentEdges
          .filter(edge => targetNodeIds.includes(edge.source) || targetNodeIds.includes(edge.target))
          .map(edge => ({ source: edge.source, target: edge.target }))

        const result = tidyUpLayout(layoutNodes, layoutEdges)
        const changes = result.map(r => ({
          type: 'position' as const,
          id: r.id,
          position: { x: r.x, y: r.y }
        }))
        if (changes.length > 0) {
          onNodesChange(changes)
          sciFiToast(`Tidied ${changes.length} nodes`, 'success', 1500)
        }
      }
      // Fit to Content (Shift+F) — resize selected nodes to fit their content
      if (m('fitToContent') && !isInputFocused && selectedNodeIds.length > 0) {
        e.preventDefault()
        const currentNodes = nodesRef.current
        const items: Array<{ nodeId: string; width: number; height: number }> = []

        for (const nodeId of selectedNodeIds) {
          const node = currentNodes.find((n) => n.id === nodeId)
          if (!node) continue
          const nodeData = node.data as Record<string, unknown>
          if ((nodeData as { collapsed?: boolean }).collapsed) continue

          const nodeType = nodeData.type as string
          let headerH = 40
          let footerH = 36
          let title: string = (nodeData.title as string) || ''
          let content: string = ''

          switch (nodeType) {
            case 'note':
              headerH = 44
              content = (nodeData.content as string) || ''
              break
            case 'task':
              content = (nodeData.description as string) || ''
              break
            case 'text':
              headerH = 0
              footerH = 0
              title = ''
              content = (nodeData.content as string) || ''
              break
            case 'artifact': {
              const files = nodeData.files as Array<{ id: string; content: string }> | undefined
              const activeFileId = nodeData.activeFileId as string | undefined
              if (files && files.length > 0) {
                const activeFile = activeFileId ? files.find((f) => f.id === activeFileId) : files[0]
                content = activeFile?.content || (nodeData.content as string) || ''
              } else {
                content = (nodeData.content as string) || ''
              }
              break
            }
            default:
              content = (nodeData.description as string) || (nodeData.content as string) || ''
              break
          }

          const currentW = node.measured?.width ?? (node.width as number) ?? 280
          const { width, height } = calculateAutoFitDimensions(title, content, headerH, footerH, currentW)
          items.push({
            nodeId,
            width: Math.max(AUTO_FIT_CONSTRAINTS.minWidth, width),
            height: Math.max(AUTO_FIT_CONSTRAINTS.minHeight, height)
          })
        }

        if (items.length > 0) {
          useWorkspaceStore.getState().batchFitNodesToContent(items)
          items.forEach((item) => updateNodeInternals(item.nodeId))
          const msg = items.length === 1 ? 'Fitted to content' : `Fitted ${items.length} nodes to content`
          sciFiToast(msg, 'success', 1500)
        }
      }
      // Edge Grammar Legend (Ctrl + Shift + E)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E' && !isInputFocused) {
        e.preventDefault()
        setShowEdgeLegend(prev => !prev)
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

      // --- Zoom shortcuts (Ctrl+0/+/-) — always fire, even when node fills viewport ---
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        fitView({ padding: 0.15, duration: 300, minZoom: 0.2 })
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault()
        const currentZoom = viewportRef.current.zoom
        zoomTo(Math.max(0.1, currentZoom * 0.75), { duration: 200 })
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        const currentZoom = viewportRef.current.zoom
        zoomTo(Math.min(4, currentZoom * 1.33), { duration: 200 })
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
        // Toggle theme settings modal
        setShowThemeModal(prev => !prev)
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
            animateNodeCreation(newId)
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
          animateNodeCreation(newId)
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

      // Canvas keyboard navigation — Arrow keys + Tab handled by useSpatialNavigation hook.
      // SelectionActionBar trigger (Tab with multi-select) stays here since it's UI chrome.
      if (!isInputFocused && e.key === 'Tab' && !e.shiftKey && selectedNodeIds.length > 1) {
        e.preventDefault()
        setSelectionActionBarPosition({
          x: mousePositionRef.current.x,
          y: mousePositionRef.current.y
        })
        setSelectionActionBarOpen(true)
      }
    }

    const handlePaste = async (e: ClipboardEvent): Promise<void> => {
      // Demo mode: suppress all interactions
      if (demoMode) return

      // Don't intercept paste in input fields — let native behavior work
      const activeElement = document.activeElement
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true'
      if (isInputFocused) return

      // Check for image files in the clipboard
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        // Filter to image files only
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
        if (imageFiles.length > 0) {
          e.preventDefault()

          const viewportCenter = screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
          })

          let successCount = 0
          let errorCount = 0
          for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i]!
            const offset = { x: i * 340, y: i * 20 }

            // Enforce same 10MB limit as file drop
            if (file.size > 10 * 1024 * 1024) {
              toast.error(`Image too large (${(file.size / (1024 * 1024)).toFixed(1)}MB, max 10MB)`)
              errorCount++
              continue
            }

            try {
              const content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(file)
              })

              // Derive a filename — clipboard images typically have no name
              const ext = file.type.split('/')[1] || 'png'
              const name = file.name && file.name !== 'image.png'
                ? file.name
                : `pasted-image-${Date.now()}.${ext}`

              const nodeId = createArtifactFromFile(
                { name, content, isBase64: true },
                { x: viewportCenter.x + offset.x, y: viewportCenter.y + offset.y }
              )
              successCount++

              // Apply creation highlight animation (same as file drop)
              requestAnimationFrame(() => {
                const nodeEl = document.querySelector(`[data-id="${nodeId}"]`)
                if (nodeEl) {
                  nodeEl.classList.add('node-just-created')
                  setTimeout(() => nodeEl.classList.remove('node-just-created'), 800)
                }
              })
            } catch (error) {
              console.error('Error reading pasted image:', error)
              errorCount++
            }
          }

          if (successCount > 0 && errorCount === 0) {
            sciFiToast(
              successCount === 1
                ? 'Created artifact from pasted image'
                : `Created ${successCount} artifacts from pasted images`,
              'success'
            )
          } else if (successCount > 0 && errorCount > 0) {
            sciFiToast(`Created ${successCount} artifact${successCount !== 1 ? 's' : ''}, ${errorCount} failed`, 'warning')
          } else if (errorCount > 0) {
            toast.error(`Failed to read pasted image${errorCount !== 1 ? 's' : ''}`)
          }
          return // Image handled — don't fall through to node paste
        }
      }

      // No image in clipboard — fall through to internal node paste
      e.preventDefault()
      const viewportCenter = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      })
      pasteNodes(viewportCenter)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('paste', handlePaste)
    }
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
    createArtifactFromFile,
    demoMode,
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
    inPlaceExpandedNodeId,
    collapseInPlaceExpansion,
    toggleBookmark,
    bookmarkedNodeId,
    setNumberedBookmark,
    numberedBookmarks,
    setCenter,
    toggleShortcutHelp,
    lastCanvasClick,
    addNode,
    getViewport,
    keyboardOverrides,
    calmMode,
    toggleCalmMode,
    onNodesChange,
    fitView,
    zoomTo,
    updateNodeInternals
  ])

  // Canvas-level Escape: progressive exit (collapse > focus > clipboard > selection > zoom-out)
  // Registered at CANVAS priority so modals/dialogs/popovers take precedence.
  useEffect(() => {
    const handleCanvasEscape = () => {
      if (demoMode) return
      if (inPlaceExpandedNodeId) {
        collapseInPlaceExpansion()
      } else if (focusModeNodeId) {
        setFocusModeNode(null)
        sciFiToast('Focus mode exited', 'info', 1500)
      } else if (clipboardState) {
        clearClipboard()
      } else if (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) {
        clearSelection()
      } else {
        // Last resort: if zoomed in far enough to be trapped, zoom out to fit
        const currentZoom = viewportRef.current.zoom
        if (currentZoom > 1.5) {
          fitView({ padding: 0.15, duration: 300, minZoom: 0.35 })
        }
      }
    }
    escapeManager.register('canvas-progressive-exit', EscapePriority.CANVAS, handleCanvasEscape)
    return () => escapeManager.unregister('canvas-progressive-exit')
  }, [demoMode, inPlaceExpandedNodeId, collapseInPlaceExpansion, focusModeNodeId, setFocusModeNode, clipboardState, clearClipboard, clearSelection, selectedNodeIds, selectedEdgeIds, fitView])

  return (
    <div className="h-screen w-screen relative flex flex-col overflow-hidden">
      {demoMode && <DemoBanner />}
      {/* Storage warning disabled for now */}

      <div
        className="flex-1 relative flex overflow-hidden"
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
      {/* SPATIAL COMMAND BRIDGE UI - DISABLED FOR v0.2.0 RELEASE
          Backend infrastructure complete (stores, services, optimizations).
          Frontend integration has debugging issues (components not rendering).
          Deferred to v0.3.0. See docs/TODO-BRIDGE.md for details. */}

      {/* Bridge Status Bar (Phase 1) — re-enabled for v0.3.0 */}
      <InlineErrorBoundary name="BridgeStatusBar-canvas">
        <BridgeStatusBar />
      </InlineErrorBoundary>

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

      {/* Icon rail + Left sidebar */}
      <IconRail
        onOpenSettings={() => setShowSettingsModal(true)}
      />
      <LeftSidebar />

      {/* Main canvas area */}
      <div
        ref={canvasContainerRef}
        className="flex-1 relative"
        data-zoom-tier="full"
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

        {/* Living Grid — cursor-responsive dot glow with magnetic attraction */}
        {(themeSettings.livingGridEnabled ?? true) && <LivingGrid />}

        {/* Particle Drift — gold particles flowing along edge paths */}
        {(themeSettings.particleDriftEnabled ?? true) && (
          <Suspense fallback={null}>
            <ParticleDrift />
          </Suspense>
        )}

        <ErrorBoundary componentName="Canvas">
        <ClickSpark>
        <ReactFlow
          className={`${semanticZoomClass} ${shiftDragState.isShiftHeld && !shiftDragState.isActive ? 'shift-drag-ready' : ''} ${shiftDragState.isActive ? 'shift-drag-active' : ''} ${focusModeNodeId ? 'focus-mode-active' : ''} ${contextVizActive ? 'context-viz-active' : ''} ${contextVizIsTerminal ? 'context-viz-terminal' : ''} ${inPlaceExpandedNodeId ? 'in-place-expansion-active' : ''} ${calmMode ? 'calm-mode-active' : ''}`}
          nodes={filteredNodes}
          edges={vizEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onMoveStart={handleMoveStart}
          onMoveEnd={handleMoveEnd}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onReconnect={handleReconnect}
          edgesReconnectable={true}
          reconnectRadius={20}
          onPaneClick={handlePaneClick}
          onContextMenu={demoMode || isTouch ? undefined : handleContextMenu}
          {...(isTouch && !demoMode ? longPressHandlers : {})}
          onSelectionChange={handleSelectionChange}
          onNodeClick={handleNodeClick}
          nodesConnectable={!demoMode}
          fitView={!demoMode}
          defaultViewport={demoMode ? { x: 50, y: 50, zoom: 0.28 } : undefined}
          fitViewOptions={{
            padding: 0.2,
            maxZoom: 1.0  // Prevent over-zooming in tests (single nodes would zoom to 400%+)
          }}
          defaultEdgeOptions={{
            type: 'custom',
            animated: false
          }}
          connectionLineType={ConnectionLineType.Bezier}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          selectionOnDrag={!isTouch}
          selectionMode={isTouch ? SelectionMode.Full : SelectionMode.Partial}
          panOnDrag={isTouch ? [0] : [1, 2]}
          onViewportChange={(viewport) => {
            const prevZoom = viewportRef.current.zoom
            viewportRef.current = viewport
            const newZoom = viewport.zoom
            if (Math.abs(newZoom - lastIndicatorZoomRef.current) > 0.01) {
              lastIndicatorZoomRef.current = newZoom
              setIndicatorZoom(newZoom)
            }
            // Zoom perf tier — only compute when zoom actually changed (not on pan)
            if (newZoom !== prevZoom) {
              const prevTier = useWorkspaceStore.getState().zoomPerfTier ?? 'full'
              const newTier = computeZoomPerfTier(newZoom, prevTier)
              if (newTier !== prevTier) {
                useWorkspaceStore.setState({ zoomPerfTier: newTier })
                canvasContainerRef.current?.setAttribute('data-zoom-tier', newTier)
              }
            }
          }}
          selectNodesOnDrag={false}
          multiSelectionKeyCode="Shift"
          selectionKeyCode={null}
          minZoom={0.1}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
          style={{ background: themeSettings.canvasBackground }}
        >
        {/* Canvas grid — configurable via themeSettings.gridStyle */}
        {(themeSettings.gridStyle ?? 'dots') === 'dots' && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="var(--grid-dot-color)"
            className="!transition-none"
          />
        )}
        {themeSettings.gridStyle === 'hash' && (
          <Background
            variant={BackgroundVariant.Cross}
            gap={20}
            size={4}
            color="var(--grid-line-color)"
            lineWidth={0.5}
            className="!transition-none"
          />
        )}
        {/* gridStyle === 'none' renders no Background component */}
        {/* Ambient canvas effects layer — lazy-loaded, decorative so no fallback needed */}
        <Suspense fallback={null}>
          <AmbientEffectLayer
            settings={themeSettings.ambientEffect ?? DEFAULT_AMBIENT_EFFECT}
            accentColor={themeSettings.guiColors?.accentPrimary}
            accentSecondary={themeSettings.guiColors?.accentSecondary}
            isDark={themeSettings.mode !== 'light'}
          />
        </Suspense>
        {/* Controls (zoom +/-) removed — DS v3 chrome cleanup */}
        <EmptyCanvasHint />
        {!isMobile && minimapVisible && <CollapsibleMinimap />}
        {!isMobile && <ZoomIndicator zoom={indicatorZoom} />}
        {indicatorZoom > 1.5 && (
          <button
            className="fixed bottom-4 right-4 z-50 px-2 py-1 rounded bg-[var(--surface-panel)]/80 text-xs backdrop-blur hover:bg-[var(--surface-panel)]"
            onClick={() => fitView({ padding: 0.15, duration: 300, minZoom: 0.35 })}
            title="Fit all nodes (Ctrl+0)"
          >
            Fit View
          </button>
        )}
        <CanvasDistrictOverlay />
        <SpatialRegionOverlay />
        <ExecutionStatusOverlay />
        <ContextScopeBadge />
        <NodeHoverPreview />
        {/* SessionReEntryPrompt disabled — removed per Stefan's request */}
        {showCanvasTOC && <CanvasTableOfContents onClose={() => setShowCanvasTOC(false)} />}
        <CognitiveLoadMeter />
        {!isMobile && showEdgeLegend && <EdgeGrammarLegend onClose={() => setShowEdgeLegend(false)} />}

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
        </ErrorBoundary>

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

        {/* PFD Phase 6B: L0 cluster summary bubbles */}
        <ClusterOverlay />

        {/* PFD Phase 5B: Z-key zoom overlay */}
        <ZoomOverlay />

        {/* PFD Phase 5B: Keyboard mode indicator HUD */}
        <KeyboardModeIndicator />

        {/* Task 27: Directional guide lines for keyboard navigation targets */}
        {!isMobile && <DirectionalGuides />}

        {/* Task 28: Contextual keyboard shortcut legend */}
        {!isMobile && <KeyboardLegend />}

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
          onToggleAISidebar={() => setAiSidebarOpen(prev => !prev)}
          onOpenInlinePrompt={() => {
            setInlinePromptPosition({
              x: Math.round(window.innerWidth / 2 - 200),
              y: Math.round(window.innerHeight / 3)
            })
            setInlinePromptOpen(true)
          }}
          onOpenThemeSettings={() => setShowThemeModal(true)}
        />

        {/* Alignment toolbar - shows when multiple nodes selected */}
        {!isMobile && <AlignmentToolbar />}

        {/* Clipboard indicator - shows when nodes are cut/copied */}
        <ClipboardIndicator />

        {/* Offline status indicator */}
        <OfflineIndicatorCompact />

        {/* Spatial extraction system - floating panel and drag preview */}
        <ExtractionPanel />
        <ExtractionDragPreview />

        {/* Bottom-left controls - filter & automation suggestions (desktop only) */}
        {!isMobile && (
          <div
            className="absolute bottom-4 gui-z-panels flex items-center gap-2 transition-all duration-200"
            style={{ left: '16px' }}
          >
            <FilterViewDropdown />
            {/* SuggestedAutomations disabled — too intrusive during normal use */}
          </div>
        )}

        {/* Focus mode indicator - shows when in focus mode */}
        {!isMobile && <FocusModeIndicator />}

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
          propertiesPanelWidth={workspacePreferences.propertiesSidebarWidth}
        /> */}

        {/* Side panels container — hidden on mobile (PFD R1) */}
        {!isMobile && (
          <div className="absolute top-0 right-0 h-full flex pointer-events-none">
            {/* Node Properties panel - show when nodes selected AND in sidebar mode */}
            {selectedNodeIds.length > 0 && selectedEdgeIds.length === 0 && workspacePreferences.propertiesDisplayMode === 'sidebar' && (
              <ResizablePropertiesPanel
                width={workspacePreferences.propertiesSidebarWidth}
                onWidthChange={setPropertiesSidebarWidth}
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

            {/* Chat is now rendered in-node — see ConversationNode expanded mode */}
          </div>
        )}

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
        {!demoMode && <ContextMenu />}

        {/* Floating Properties Modals (supports multiple pinned modals) */}
        {floatingPropertiesNodeIds.map((nodeId, index) => (
          <FloatingPropertiesModal key={nodeId} nodeId={nodeId} index={index} />
        ))}

        {/* Pinned Windows (nodes popped out as floating windows) */}
        <PinnedWindowsContainer />

        {/* Artboard Mode — full-viewport editing overlay (Cmd/Ctrl+Enter) */}
        <ArtboardOverlay />
        <FocusModeHint />

        <WorkflowProgress />

        {/* AI Editor InlinePrompt (/ key) */}
        {inlinePromptOpen && (
          <InlinePrompt
            position={inlinePromptPosition}
            onClose={() => setInlinePromptOpen(false)}
          />
        )}

        {/* AI Editor SelectionActionBar (Tab with multiple nodes selected) */}
        {!demoMode && selectionActionBarOpen && selectedNodeIds.length > 1 && (
          <SelectionActionBar
            selectedNodeIds={selectedNodeIds}
            position={selectionActionBarPosition}
            onClose={() => setSelectionActionBarOpen(false)}
          />
        )}

        {/* AI Sidebar (Ctrl+Shift+A) */}
        {!demoMode && <AISidebar
          isOpen={aiSidebarOpen}
          onClose={() => setAiSidebarOpen(false)}
        />}

        {/* Command Palette */}
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={closePalette} />

        {/* Settings Modal */}
        <SettingsModal isOpen={showSettingsModal} onClose={() => { setShowSettingsModal(false); setSettingsCategory(undefined) }} defaultCategory={settingsCategory as any} />

        {/* Export Dialog (Electron only — uses native file dialog) */}
        {(window as any).__ELECTRON__ && (
          <ExportDialog isOpen={showExportDialog} onClose={() => setShowExportDialog(false)} />
        )}

        {/* Template Picker */}
        {!demoMode && <TemplatePicker isOpen={showTemplatePicker} onClose={() => setShowTemplatePicker(false)} />}

        {/* Workspace Manager (web only) */}
        {isWeb && (
          <WorkspaceManager
            isOpen={showWorkspaceManager}
            onClose={() => setShowWorkspaceManager(false)}
          />
        )}

        {/* Welcome Overlay - shown on first launch only (desktop only — web has WebWelcomeModal) */}
        {!isWeb && <WelcomeOverlay onOpenSettings={() => { setSettingsCategory('ai'); setShowSettingsModal(true) }} />}

        {/* Command Bar (Phase 4) - TEMPORARILY DISABLED FOR DEBUGGING */}
        {/* <CommandBar /> */}

        {/* Splash Screen */}
        <AnimatePresence>
          {!isReady && <SplashScreen />}
        </AnimatePresence>
      </div>

      {/* AI Editor Modal and Preview - Outside flex container for guaranteed fixed positioning */}
      {!demoMode && <AIEditorModal />}
      {isAIEditorOpen && <AIEditorPreview />}
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
        {/* Global orchestrator status indicator (Electron only) */}
        {(window as any).__ELECTRON__ && (
          <InlineErrorBoundary name="BridgeStatusBar">
            <BridgeStatusBar />
          </InlineErrorBoundary>
        )}
      </SyncProviderWrapper>
    </TooltipProvider>
  )
}

export default App
