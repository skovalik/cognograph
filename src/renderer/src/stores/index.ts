// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

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

export { useActionStore } from './actionStore'
// Feature stores
export { useAIEditorStore } from './aiEditorStore'
export {
  selectActivationScore,
  selectAhaAchieved,
  selectMetrics,
  selectTemplateUsed,
  selectTimeToFirstChat,
  selectTimeToFirstConnection,
  selectTimeToFirstNode,
  selectTutorialCompleted,
  useAnalyticsStore,
} from './analyticsStore'
export {
  selectAuditEventCount,
  selectAuditEvents,
  selectAuditFilter,
  selectAuditTotalCost,
  selectIsSearching,
  useAuditStore,
} from './auditStore'
export {
  selectEdges,
  selectIsNodeStreaming,
  selectIsRecentlySpawned,
  selectNodes,
  selectSelectedEdgeIds,
  selectSelectedNodeIds,
  selectViewport,
  useCanvasStore,
} from './canvasStore'
export {
  useBookmarkedNodeId,
  useCanvasViewportStore,
  useFocusModeNodeId,
  useIsFocusModeActive,
  useIsNodeBookmarked,
  useLastCanvasClick,
  useNodeNumberedBookmark,
  useNumberedBookmarks,
  useSavedViews,
  useViewport,
} from './canvasViewportStore'
export {
  initCCBridgeListener,
  selectCCBridgeConnected,
  selectCCBridgeEvents,
  selectCCBridgeLastEventTime,
  selectCCBridgeSessionCount,
  useCCBridgeStore,
} from './ccBridgeStore'
export { useConnectorStore } from './connectorStore'
export { useContextMenuStore } from './contextMenuStore'
export { useEdgeById, useEdges, useEdgesStore } from './edgesStore'
export { useEntitlementsStore } from './entitlementsStore'
export {
  useExtractionCountForNode,
  useExtractionDrag,
  useExtractionStore,
  useExtractionsForNode,
  useIsExtracting,
  useIsExtractionPanelOpen,
  useLastAcceptedExtraction,
  useOpenExtractionPanelNodeId,
  usePendingExtractions,
  useSortedExtractionsForNode,
} from './extractionStore'
export {
  selectHistoryState,
  selectIsDirty,
  selectIsLoading,
  selectPendingExtractions,
  selectPendingExtractionsForSource,
  selectSaveStatus,
  selectSyncMode,
  selectTrash,
  selectWorkspaceId,
  selectWorkspaceName,
  useFeaturesStore,
} from './featuresStore'
export {
  selectActiveInsights,
  selectCostHistory,
  selectCurrentSessionCost,
  selectDailyBudgetLimit,
  selectDailyBudgetUsed,
  selectInsights,
  selectInsightsByNode,
  selectIsAnalyzing,
  useGraphIntelligenceStore,
} from './graphIntelligenceStore'
export {
  getHistoryActionLabel,
  useCanRedo,
  useCanUndo,
  useCurrentHistoryIndex,
  useHistoryActions,
  useHistoryLength,
  useHistoryStore,
} from './historyStore'
// Node factories
export {
  createActionData,
  createArtifactData,
  createConversationData,
  createNodeData,
  createNoteData,
  createProjectData,
  createTaskData,
  createTextData,
  createWorkspaceData,
  DEFAULT_NODE_DIMENSIONS,
} from './nodeFactories'
// Domain stores (Week 2 Stream B Track 2 Phase 2.2a)
export {
  useIsNodeSpawning,
  useIsSpawning,
  useNodeById,
  useNodes,
  useNodesStore,
  useNodeWarmth,
} from './nodesStore'
export { useOfflineStore } from './offlineStore'
export {
  selectOnboardingCompleted,
  selectOnboardingStep,
  selectOnboardingTemplate,
  useOnboardingStore,
} from './onboardingStore'
export { initOrchestratorIPC, useOrchestratorStore } from './orchestratorStore'
export { usePermissionStore } from './permissionStore'
export {
  useAutoSaveEnabled,
  useAutoSaveInterval,
  useIsDirty,
  useIsLoading,
  useLastSaved,
  usePersistenceStore,
  useSaveStatus,
  useWorkspaceId,
  useWorkspaceName,
  useWorkspacePath,
} from './persistenceStore'
export {
  useAllProperties,
  useCustomProperties,
  usePropertiesForNodeType,
  usePropertiesStore,
  usePropertyDefinition,
  usePropertySchema,
} from './propertiesStore'
export { useSavedViewsStore } from './savedViewsStore'
export {
  useBoxSelectRect,
  useIsEdgeSelected,
  useIsNodeSelected,
  useLastCreatedNodeId,
  useSelectedEdgeIds,
  useSelectedNodeIds,
  useSelectionCount,
  useSelectionStore,
} from './selectionStore'
export { useSessionStatsStore } from './sessionStatsStore'
export { selectDistricts, useSpatialRegionStore } from './spatialRegionStore'
export { useTemplateStore } from './templateStore'
// Types
export type {
  CanvasState,
  ExtractionDragState,
  FeaturesState,
  LastAcceptedExtraction,
  PinnedWindow,
  TrashedItem,
  UIState,
} from './types'
export {
  selectActiveChatNodeId,
  selectActivePanel,
  selectArtboardNodeId,
  selectIsArtboardActive,
  selectIsNodeExpanded,
  selectIsNodePinned,
  selectLeftSidebarOpen,
  selectLeftSidebarTab,
  selectPinnedWindows,
  selectThemeSettings,
  useUIStore,
} from './uiStore'
export { useWorkflowStore } from './workflowStore'
// Primary stores (legacy - keep for backward compatibility during migration)
export { useWorkspaceStore } from './workspaceStore'
