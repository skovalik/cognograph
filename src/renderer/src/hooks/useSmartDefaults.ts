/**
 * Smart Defaults Hook
 *
 * Provides context-aware defaults for the AI Editor based on the current selection.
 * Reduces cognitive load by pre-selecting appropriate mode, scope, and quick actions.
 */

import { useMemo } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { AIEditorMode, AIEditorScope, NodeData } from '@shared/types'

export interface QuickAction {
  id: string
  label: string
  prompt: string
  mode?: AIEditorMode
  scope?: AIEditorScope
  icon?: string
}

export interface SmartDefaults {
  mode: AIEditorMode
  scope: AIEditorScope
  quickActions: QuickAction[]
  contextMessage: string
  nodeTypeBreakdown?: Record<string, number>
}

// Quick actions by node type (for single node selection)
const NODE_TYPE_ACTIONS: Record<string, QuickAction[]> = {
  project: [
    { id: 'add-task', label: '+ Add task', prompt: 'Add a new task to this project:', mode: 'generate' },
    { id: 'add-note', label: '+ Add note', prompt: 'Add a context note to this project:', mode: 'generate' },
    { id: 'reorganize', label: 'Reorganize', prompt: 'Reorganize children by priority', mode: 'organize' },
    { id: 'summarize', label: 'Summarize', prompt: 'Create a summary of this project', mode: 'fix' }
  ],
  conversation: [
    { id: 'continue', label: 'Continue', prompt: 'Continue this conversation with:', mode: 'fix' },
    { id: 'summarize', label: 'Summarize', prompt: 'Summarize key points from this conversation', mode: 'fix' },
    { id: 'extract-tasks', label: 'Extract tasks', prompt: 'Extract action items as tasks', mode: 'generate' },
    { id: 'branch', label: 'Branch', prompt: 'Create a branch conversation to explore:', mode: 'generate' }
  ],
  note: [
    { id: 'expand', label: 'Expand', prompt: 'Expand on this note with more details:', mode: 'fix' },
    { id: 'summarize', label: 'Summarize', prompt: 'Create a shorter summary of this note', mode: 'fix' },
    { id: 'extract', label: 'Extract tasks', prompt: 'Extract any tasks from this note', mode: 'generate' },
    { id: 'connect', label: 'Find related', prompt: 'Find related nodes to connect to', mode: 'organize' }
  ],
  task: [
    { id: 'break-down', label: 'Break down', prompt: 'Break this task into subtasks', mode: 'generate' },
    { id: 'add-context', label: '+ Context', prompt: 'Add context notes for this task', mode: 'generate' },
    { id: 'estimate', label: 'Estimate', prompt: 'Add effort/time estimate to this task', mode: 'fix' },
    { id: 'dependencies', label: 'Dependencies', prompt: 'Identify dependencies for this task', mode: 'organize' }
  ],
  artifact: [
    { id: 'explain', label: 'Explain', prompt: 'Explain what this artifact does', mode: 'fix' },
    { id: 'improve', label: 'Improve', prompt: 'Suggest improvements for this artifact', mode: 'refactor' },
    { id: 'document', label: 'Document', prompt: 'Generate documentation for this artifact', mode: 'generate' },
    { id: 'connect', label: 'Connect', prompt: 'Find conversations that could use this artifact', mode: 'organize' }
  ],
  workspace: [
    { id: 'overview', label: 'Overview', prompt: 'Create an overview of this workspace', mode: 'fix' },
    { id: 'organize', label: 'Organize', prompt: 'Organize nodes within this workspace', mode: 'organize' },
    { id: 'add-conversation', label: '+ Chat', prompt: 'Add a new conversation to this workspace', mode: 'generate' }
  ],
  text: [
    { id: 'expand', label: 'Expand', prompt: 'Expand this text with more detail', mode: 'fix' },
    { id: 'convert', label: 'To Note', prompt: 'Convert this text to a note node', mode: 'refactor' },
    { id: 'connect', label: 'Connect', prompt: 'Connect this text to related nodes', mode: 'organize' }
  ],
  action: [
    { id: 'configure', label: 'Configure', prompt: 'Configure this action node', mode: 'fix' },
    { id: 'test', label: 'Test', prompt: 'Create a test workflow for this action', mode: 'generate' }
  ]
}

// Default actions for generic single node
const DEFAULT_SINGLE_ACTIONS: QuickAction[] = [
  { id: 'expand', label: 'Expand', prompt: 'Expand on this node', mode: 'fix' },
  { id: 'summarize', label: 'Summarize', prompt: 'Summarize this node', mode: 'fix' },
  { id: 'connect', label: 'Connect', prompt: 'Find connections for this node', mode: 'organize' }
]

// Actions for empty canvas
const EMPTY_CANVAS_ACTIONS: QuickAction[] = [
  { id: 'create-project', label: 'Create project', prompt: 'Create a new project for', mode: 'generate' },
  { id: 'add-conversation', label: 'Add conversation', prompt: 'Add a new AI conversation about', mode: 'generate' },
  { id: 'import-ideas', label: 'Import ideas', prompt: 'Create notes for these ideas:', mode: 'generate' }
]

// Actions for multiple nodes of same type
const MULTI_SAME_TYPE_ACTIONS: QuickAction[] = [
  { id: 'organize', label: 'Organize', prompt: 'Organize these nodes', mode: 'organize' },
  { id: 'summarize', label: 'Summarize all', prompt: 'Create a summary of all selected nodes', mode: 'fix' },
  { id: 'connect', label: 'Find connections', prompt: 'Find and create connections between these nodes', mode: 'organize' }
]

// Actions for mixed type selection
const MULTI_MIXED_ACTIONS: QuickAction[] = [
  { id: 'group', label: 'Group', prompt: 'Group these into a new project', mode: 'generate' },
  { id: 'connect', label: 'Connect', prompt: 'Connect these nodes where relevant', mode: 'organize' },
  { id: 'summarize', label: 'Summarize', prompt: 'Create a summary of these items', mode: 'fix' }
]

function countNodeTypes(nodes: { data: NodeData }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const node of nodes) {
    const type = node.data.type
    counts[type] = (counts[type] || 0) + 1
  }
  return counts
}

function getDominantType(counts: Record<string, number>): string {
  let maxCount = 0
  let dominant = 'node'
  for (const [type, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      dominant = type
    }
  }
  return dominant
}

function formatTypeCount(counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
  return parts.join(', ')
}

function getNodeTitle(data: NodeData): string {
  if ('title' in data && typeof data.title === 'string') {
    return data.title
  }
  if (data.type === 'text' && 'content' in data && typeof data.content === 'string') {
    return data.content.slice(0, 30) || 'Text'
  }
  return data.type.charAt(0).toUpperCase() + data.type.slice(1)
}

export function useSmartDefaults(selectedNodeIds: string[]): SmartDefaults {
  const nodes = useWorkspaceStore((state) =>
    selectedNodeIds
      .map((id) => state.nodes.find((n) => n.id === id))
      .filter((n): n is NonNullable<typeof n> => n !== undefined)
  )

  return useMemo(() => {
    // Empty selection - empty canvas state
    if (nodes.length === 0) {
      return {
        mode: 'generate',
        scope: 'canvas',
        quickActions: EMPTY_CANVAS_ACTIONS,
        contextMessage: 'Your canvas is empty — let\'s create something!'
      }
    }

    // Single node selection
    if (nodes.length === 1) {
      const node = nodes[0]
      const nodeType = node.data.type
      const title = getNodeTitle(node.data)
      const actions = NODE_TYPE_ACTIONS[nodeType] || DEFAULT_SINGLE_ACTIONS

      return {
        mode: 'fix',
        scope: 'single',
        quickActions: actions,
        contextMessage: `Working with: ${title}`
      }
    }

    // Multiple nodes - analyze types
    const typeCount = countNodeTypes(nodes)
    const numTypes = Object.keys(typeCount).length
    const dominantType = getDominantType(typeCount)

    // All same type
    if (numTypes === 1) {
      // Customize actions based on dominant type
      const typeSpecificActions = MULTI_SAME_TYPE_ACTIONS.map((action) => ({
        ...action,
        prompt: action.prompt.replace('these nodes', `these ${dominantType}s`)
      }))

      return {
        mode: 'organize',
        scope: 'selection',
        quickActions: typeSpecificActions,
        contextMessage: `Working with: ${nodes.length} ${dominantType}s`,
        nodeTypeBreakdown: typeCount
      }
    }

    // Mixed types
    return {
      mode: 'organize',
      scope: 'selection',
      quickActions: MULTI_MIXED_ACTIONS,
      contextMessage: `Working with: ${nodes.length} nodes (${formatTypeCount(typeCount)})`,
      nodeTypeBreakdown: typeCount
    }
  }, [nodes])
}

export default useSmartDefaults
