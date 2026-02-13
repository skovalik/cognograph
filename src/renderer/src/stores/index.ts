/**
 * Store Index
 *
 * Central export point for all Zustand stores.
 * This enables cleaner imports throughout the codebase.
 *
 * Usage:
 *   import { useWorkspaceStore, useCanvasStore, useUIStore } from '@/stores'
 *
 * Created as part of Batch 0C: Store Split Migration
 */

// Primary stores (legacy - keep for backward compatibility during migration)
export { useWorkspaceStore } from './workspaceStore'
export { useCanvasStore, selectNodes, selectEdges, selectSelectedNodeIds, selectSelectedEdgeIds, selectViewport, selectIsNodeStreaming, selectIsRecentlySpawned } from './canvasStore'
export { useUIStore, selectActivePanel, selectActiveChatNodeId, selectLeftSidebarOpen, selectLeftSidebarTab, selectIsNodeExpanded, selectThemeSettings, selectPinnedWindows, selectIsNodePinned } from './uiStore'
export { useFeaturesStore, selectWorkspaceId, selectWorkspaceName, selectIsDirty, selectIsLoading, selectSaveStatus, selectHistoryState, selectPendingExtractions, selectPendingExtractionsForSource, selectTrash, selectSyncMode } from './featuresStore'

// Domain stores (Week 2 Stream B Track 2 Phase 2.2a)
export { useNodesStore, useNodes, useNodeById, useNodeWarmth, useIsSpawning, useIsNodeSpawning } from './nodesStore'
export { useEdgesStore, useEdges, useEdgeById } from './edgesStore'
export { useSelectionStore, useSelectedNodeIds, useSelectedEdgeIds, useIsNodeSelected, useIsEdgeSelected, useSelectionCount, useBoxSelectRect, useLastCreatedNodeId } from './selectionStore'
export { useHistoryStore, useCanUndo, useCanRedo, useHistoryLength, useCurrentHistoryIndex, useHistoryActions, getHistoryActionLabel } from './historyStore'
export { usePropertiesStore, usePropertySchema, usePropertiesForNodeType, usePropertyDefinition, useAllProperties, useCustomProperties } from './propertiesStore'
export { useExtractionStore, usePendingExtractions, useExtractionsForNode, useExtractionCountForNode, useSortedExtractionsForNode, useIsExtracting, useOpenExtractionPanelNodeId, useIsExtractionPanelOpen, useExtractionDrag, useLastAcceptedExtraction } from './extractionStore'
export { useCanvasViewportStore, useViewport, useFocusModeNodeId, useIsFocusModeActive, useBookmarkedNodeId, useIsNodeBookmarked, useNumberedBookmarks, useNodeNumberedBookmark, useSavedViews, useLastCanvasClick } from './canvasViewportStore'
export { usePersistenceStore, useWorkspaceName, useWorkspaceId, useWorkspacePath, useIsDirty, useIsLoading, useSaveStatus, useLastSaved, useAutoSaveEnabled, useAutoSaveInterval } from './persistenceStore'

// Feature stores
export { useAIEditorStore } from './aiEditorStore'
export { useActionStore } from './actionStore'
export { useConnectorStore } from './connectorStore'
export { useContextMenuStore } from './contextMenuStore'
export { useEntitlementsStore } from './entitlementsStore'
export { useOfflineStore } from './offlineStore'
export { usePermissionStore } from './permissionStore'
export { useSavedViewsStore } from './savedViewsStore'
export { useSpatialRegionStore } from './spatialRegionStore'
export { useTemplateStore } from './templateStore'
export { useWorkflowStore } from './workflowStore'
export { useCCBridgeStore, initCCBridgeListener, selectCCBridgeEvents, selectCCBridgeConnected, selectCCBridgeSessionCount, selectCCBridgeLastEventTime } from './ccBridgeStore'
export { useOrchestratorStore, initOrchestratorIPC } from './orchestratorStore'
export { useSessionStatsStore } from './sessionStatsStore'
export { useAuditStore, selectAuditEvents, selectAuditEventCount, selectAuditTotalCost, selectAuditFilter, selectIsSearching } from './auditStore'
export { useGraphIntelligenceStore, selectInsights, selectActiveInsights, selectInsightsByNode, selectCostHistory, selectDailyBudgetUsed, selectDailyBudgetLimit, selectCurrentSessionCost, selectIsAnalyzing } from './graphIntelligenceStore'
export { useAnalyticsStore, selectMetrics, selectActivationScore, selectTimeToFirstNode, selectTimeToFirstConnection, selectTimeToFirstChat, selectTutorialCompleted, selectTemplateUsed, selectAhaAchieved } from './analyticsStore'

// Types
export type { CanvasState, UIState, FeaturesState, PinnedWindow, TrashedItem, ExtractionDragState, LastAcceptedExtraction } from './types'

// Node factories
export { createNodeData, createConversationData, createProjectData, createNoteData, createTaskData, createArtifactData, createWorkspaceData, createTextData, createActionData, DEFAULT_NODE_DIMENSIONS } from './nodeFactories'
