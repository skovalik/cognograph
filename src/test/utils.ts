/**
 * Test Utilities
 *
 * Helper functions for writing tests in Cognograph.
 */

import type { Node, Edge } from '@xyflow/react'
import type {
  NodeData,
  ConversationNodeData,
  NoteNodeData,
  TaskNodeData,
  ProjectNodeData,
  EdgeData
} from '@shared/types'

// -----------------------------------------------------------------------------
// Node Factories
// -----------------------------------------------------------------------------

let nodeIdCounter = 0

/**
 * Create a test node with default values.
 * Accepts partial overrides for customization.
 */
export function createTestNode<T extends NodeData>(
  type: T['type'],
  overrides: Partial<Node<T>> & { data?: Partial<T> } = {}
): Node<T> {
  const id = overrides.id ?? `test-node-${++nodeIdCounter}`
  const position = overrides.position ?? { x: 0, y: 0 }

  const baseData = {
    type,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  let data: T

  switch (type) {
    case 'conversation':
      data = {
        ...baseData,
        type: 'conversation',
        title: 'Test Conversation',
        messages: [],
        provider: 'anthropic',
        ...overrides.data
      } as unknown as T
      break

    case 'note':
      data = {
        ...baseData,
        type: 'note',
        title: 'Test Note',
        content: 'Test note content',
        ...overrides.data
      } as unknown as T
      break

    case 'task':
      data = {
        ...baseData,
        type: 'task',
        title: 'Test Task',
        description: 'Test task description',
        status: 'pending',
        ...overrides.data
      } as unknown as T
      break

    case 'project':
      data = {
        ...baseData,
        type: 'project',
        title: 'Test Project',
        description: 'Test project description',
        childNodeIds: [],
        ...overrides.data
      } as unknown as T
      break

    case 'artifact':
      data = {
        ...baseData,
        type: 'artifact',
        title: 'Test Artifact',
        content: 'Test artifact content',
        contentType: 'text/plain',
        ...overrides.data
      } as unknown as T
      break

    case 'workspace':
      data = {
        ...baseData,
        type: 'workspace',
        title: 'Test Workspace',
        description: 'Test workspace',
        includedNodeIds: [],
        ...overrides.data
      } as unknown as T
      break

    case 'text':
      data = {
        ...baseData,
        type: 'text',
        content: 'Test text content',
        ...overrides.data
      } as unknown as T
      break

    default:
      throw new Error(`Unknown node type: ${type}`)
  }

  // Extract data from overrides to avoid overwriting our constructed data
  const { data: _dataOverride, ...restOverrides } = overrides

  return {
    id,
    type,
    position,
    data,
    ...restOverrides
  } as Node<T>
}

/**
 * Create a conversation node with messages.
 */
export function createConversationNode(
  messages: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  overrides: Partial<Node<ConversationNodeData>> = {}
): Node<ConversationNodeData> {
  const data = {
    type: 'conversation' as const,
    title: 'Test Conversation',
    provider: 'anthropic' as const,
    messages: messages.map((m, i) => ({
      id: `msg-${i}`,
      role: m.role,
      content: m.content,
      timestamp: Date.now()
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides.data
  }
  return createTestNode<ConversationNodeData>('conversation', {
    ...overrides,
    data: data as unknown as ConversationNodeData & Partial<ConversationNodeData>
  })
}

/**
 * Create a note node with content.
 */
export function createNoteNode(
  content: string = 'Test note',
  overrides: Partial<Node<NoteNodeData>> = {}
): Node<NoteNodeData> {
  const data = {
    type: 'note' as const,
    title: 'Test Note',
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides.data
  }
  return createTestNode<NoteNodeData>('note', {
    ...overrides,
    data: data as unknown as NoteNodeData & Partial<NoteNodeData>
  })
}

/**
 * Create a task node.
 */
export function createTaskNode(
  status: 'todo' | 'in-progress' | 'done' = 'todo',
  overrides: Partial<Node<TaskNodeData>> = {}
): Node<TaskNodeData> {
  const data = {
    type: 'task' as const,
    title: 'Test Task',
    description: 'Test task description',
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides.data
  }
  return createTestNode<TaskNodeData>('task', {
    ...overrides,
    data: data as unknown as TaskNodeData & Partial<TaskNodeData>
  })
}

/**
 * Create a project node with children.
 */
export function createProjectNode(
  childNodeIds: string[] = [],
  overrides: Partial<Node<ProjectNodeData>> = {}
): Node<ProjectNodeData> {
  const data = {
    type: 'project' as const,
    title: 'Test Project',
    description: 'Test project description',
    childNodeIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides.data
  }
  return createTestNode<ProjectNodeData>('project', {
    ...overrides,
    data: data as unknown as ProjectNodeData & Partial<ProjectNodeData>
  })
}

// -----------------------------------------------------------------------------
// Edge Factories
// -----------------------------------------------------------------------------

let edgeIdCounter = 0

/**
 * Create a test edge between two nodes.
 */
export function createTestEdge(
  source: string,
  target: string,
  overrides: Omit<Partial<Edge<EdgeData>>, 'data'> & { data?: Partial<EdgeData> } = {}
): Edge<EdgeData> {
  const { data: dataOverrides, ...restOverrides } = overrides
  return {
    id: restOverrides.id ?? `edge-${++edgeIdCounter}`,
    source,
    target,
    data: {
      direction: 'unidirectional',
      weight: 1,
      active: true,
      ...dataOverrides
    },
    ...restOverrides
  }
}

// -----------------------------------------------------------------------------
// Test Helpers
// -----------------------------------------------------------------------------

/**
 * Reset all test counters between tests.
 */
export function resetTestCounters(): void {
  nodeIdCounter = 0
  edgeIdCounter = 0
}

/**
 * Create a simple workspace fixture with nodes and edges.
 */
export function createWorkspaceFixture(): {
  nodes: Node<NodeData>[]
  edges: Edge<EdgeData>[]
} {
  const conversation = createConversationNode(
    [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ],
    { id: 'conv-1', position: { x: 0, y: 0 } }
  )

  const note = createNoteNode('Important context for the conversation', {
    id: 'note-1',
    position: { x: -200, y: 0 }
  })

  const task = createTaskNode('todo', {
    id: 'task-1',
    position: { x: 200, y: 0 }
  })

  const project = createProjectNode(['conv-1', 'note-1'], {
    id: 'project-1',
    position: { x: 0, y: -200 }
  })

  const nodes: Node<NodeData>[] = [conversation, note, task, project]

  const edges: Edge<EdgeData>[] = [
    createTestEdge('note-1', 'conv-1', { id: 'edge-note-conv' }),
    createTestEdge('conv-1', 'task-1', { id: 'edge-conv-task' })
  ]

  return { nodes, edges }
}

/**
 * Wait for a condition to be true (useful for async tests).
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 1000,
  interval = 50
): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout')
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}
