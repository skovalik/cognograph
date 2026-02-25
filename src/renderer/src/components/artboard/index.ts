/**
 * Artboard component barrel exports.
 *
 * Phase 3A: NodeArtboard, ArtboardTabBar, ArtboardSplitPane (infrastructure)
 * Phase 3B: ContextTreePanel, MiniKanban, ExecutionLog, PipelineDiagram, ArtboardRouter
 */

// Infrastructure (Phase 3A)
export { NodeArtboard } from './NodeArtboard'

export { ArtboardTabBar } from './ArtboardTabBar'
export type { ArtboardTab, ArtboardTabBarProps } from './ArtboardTabBar'

export { ArtboardSplitPane } from './ArtboardSplitPane'
export type { ArtboardSplitPaneProps } from './ArtboardSplitPane'

// Panel components (Phase 3B)
export { ContextTreePanel } from './ContextTreePanel'
export type { ContextTreePanelProps } from './ContextTreePanel'

export { MiniKanban } from './MiniKanban'
export type { MiniKanbanProps } from './MiniKanban'

export { ExecutionLog } from './ExecutionLog'
export type { ExecutionLogProps, LogEntry } from './ExecutionLog'

export { PipelineDiagram } from './PipelineDiagram'
export type { PipelineDiagramProps, PipelineAgent, AgentPipelineStatus } from './PipelineDiagram'

// Router (Phase 3B)
export { ArtboardRouter } from './ArtboardRouter'
