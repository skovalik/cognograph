// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Artboard component barrel exports.
 *
 * Phase 3A: NodeArtboard, ArtboardTabBar, ArtboardSplitPane (infrastructure)
 * Phase 3B: ContextTreePanel, MiniKanban, ExecutionLog, PipelineDiagram, ArtboardRouter
 */

// Router (Phase 3B)
export { ArtboardRouter } from './ArtboardRouter'
export type { ArtboardSplitPaneProps } from './ArtboardSplitPane'
export { ArtboardSplitPane } from './ArtboardSplitPane'
export type { ArtboardTab, ArtboardTabBarProps } from './ArtboardTabBar'
export { ArtboardTabBar } from './ArtboardTabBar'
export type { ContextTreePanelProps } from './ContextTreePanel'
// Panel components (Phase 3B)
export { ContextTreePanel } from './ContextTreePanel'
export type { ExecutionLogProps, LogEntry } from './ExecutionLog'
export { ExecutionLog } from './ExecutionLog'
export type { MiniKanbanProps } from './MiniKanban'
export { MiniKanban } from './MiniKanban'
// Infrastructure (Phase 3A)
export { NodeArtboard } from './NodeArtboard'
export type { AgentPipelineStatus, PipelineAgent, PipelineDiagramProps } from './PipelineDiagram'
export { PipelineDiagram } from './PipelineDiagram'
