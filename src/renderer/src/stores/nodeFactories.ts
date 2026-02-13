/**
 * Node Data Factories
 *
 * Factory functions for creating default node data objects.
 * Extracted from workspaceStore for use in multiple stores.
 *
 * Created as part of Batch 0C: Store Split Migration
 */

import type {
  NodeData,
  ConversationNodeData,
  ProjectNodeData,
  NoteNodeData,
  TaskNodeData,
  ArtifactNodeData,
  ArtifactContentType,
  ArtifactSource,
  WorkspaceNodeData,
  TextNodeData,
  ActionNodeData
} from '@shared/types'
import {
  DEFAULT_WORKSPACE_LLM_SETTINGS,
  DEFAULT_WORKSPACE_CONTEXT_RULES,
  NODE_DEFAULTS
} from '@shared/types'

// Re-export NODE_DEFAULTS as DEFAULT_NODE_DIMENSIONS for backwards compatibility
export const DEFAULT_NODE_DIMENSIONS = NODE_DEFAULTS
import { createActionData } from '@shared/actionTypes'
import { createOrchestratorData } from '@shared/types'

// Re-export createActionData for convenience
export { createActionData }

// Re-export createOrchestratorData for convenience
export { createOrchestratorData }

/**
 * Create default conversation node data
 */
export const createConversationData = (): ConversationNodeData => ({
  type: 'conversation',
  title: 'New Conversation',
  messages: [],
  provider: 'anthropic',
  createdAt: Date.now(),
  updatedAt: Date.now()
})

/**
 * Create default project node data
 */
export const createProjectData = (color?: string): ProjectNodeData => ({
  type: 'project',
  title: 'New Project',
  description: '',
  collapsed: false,
  childNodeIds: [],
  color: color || '#64748b',
  createdAt: Date.now(),
  updatedAt: Date.now()
})

/**
 * Create default note node data
 */
export const createNoteData = (): NoteNodeData => ({
  type: 'note',
  title: 'New Note',
  content: '',
  createdAt: Date.now(),
  updatedAt: Date.now()
})

/**
 * Create default task node data
 */
export const createTaskData = (): TaskNodeData => ({
  type: 'task',
  title: 'New Task',
  description: '',
  status: 'todo',
  priority: 'none',
  createdAt: Date.now(),
  updatedAt: Date.now()
})

/**
 * Create default artifact node data
 */
export const createArtifactData = (
  contentType: ArtifactContentType = 'text',
  source: ArtifactSource = { type: 'created', method: 'manual' }
): ArtifactNodeData => ({
  type: 'artifact',
  title: 'New Artifact',
  content: '',
  contentType,
  source,
  version: 1,
  versionHistory: [],
  versioningMode: 'update',
  injectionFormat: 'full',
  collapsed: false,
  previewLines: 10,
  createdAt: Date.now(),
  updatedAt: Date.now()
})

/**
 * Create default workspace node data
 */
export const createWorkspaceData = (): WorkspaceNodeData => ({
  type: 'workspace',
  title: 'New Workspace',
  description: '',
  showOnCanvas: true,
  showLinks: false,
  linkColor: '#ef4444',
  linkDirection: 'to-members',
  llmSettings: { ...DEFAULT_WORKSPACE_LLM_SETTINGS },
  contextRules: { ...DEFAULT_WORKSPACE_CONTEXT_RULES },
  themeDefaults: {},
  includedNodeIds: [],
  excludedNodeIds: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
})

/**
 * Create default text node data
 */
export const createTextData = (): TextNodeData => ({
  type: 'text',
  content: '',
  createdAt: Date.now(),
  updatedAt: Date.now()
})


/**
 * Create node data for a given type
 */
export function createNodeData(type: NodeData['type'], options?: { projectColor?: string }): NodeData {
  switch (type) {
    case 'conversation':
      return createConversationData()
    case 'project':
      return createProjectData(options?.projectColor)
    case 'note':
      return createNoteData()
    case 'task':
      return createTaskData()
    case 'artifact':
      return createArtifactData()
    case 'workspace':
      return createWorkspaceData()
    case 'text':
      return createTextData()
    case 'action':
      return createActionData()
    case 'orchestrator':
      return createOrchestratorData()
    default:
      throw new Error(`Unknown node type: ${type}`)
  }
}
