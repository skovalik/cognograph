// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { ActionStep, ActionTrigger } from '@shared/actionTypes'
import type { NodeData } from '@shared/types'
import { useWorkspaceStore } from '../stores/workspaceStore'

// Tool definition shape (matches what getChatToolDefinitions returns)
interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

// ── Tool Definitions ────────────────────────────────────────────────────────

const CREATE_AGENT_TOOL: ToolDefinition = {
  name: 'create_agent',
  description:
    'Create an agent node on the canvas that autonomously executes a task. Use this when a task requires 5+ tool calls or ongoing autonomous work. The agent will be visible on the canvas with its own conversation thread.',
  input_schema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'The task description for the agent to execute' },
      title: {
        type: 'string',
        description: 'Display title for the agent node (defaults to truncated task)',
      },
      connectToNodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Node IDs to connect as context sources for the agent',
      },
      autoStart: {
        type: 'boolean',
        description: 'Whether to start the agent immediately (default: true)',
      },
    },
    required: ['task'],
  },
}

const CREATE_ACTION_TOOL: ToolDefinition = {
  name: 'create_action',
  description:
    'Create an action node with automation rules. Actions have triggers (manual, region-enter, region-exit, schedule, connection-made) and steps that execute when triggered.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Display title for the action' },
      triggerType: {
        type: 'string',
        enum: ['manual', 'region-enter', 'region-exit', 'schedule', 'connection-made'],
        description: 'What triggers this action',
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['tag', 'move', 'notify', 'llm-transform', 'create-node', 'link-nodes'],
            },
            config: { type: 'object', description: 'Step-specific configuration' },
          },
        },
        description: 'Ordered list of steps to execute when triggered',
      },
      regionId: {
        type: 'string',
        description: 'For region-enter/region-exit triggers: which region activates this action',
      },
    },
    required: ['title', 'triggerType'],
  },
}

const CREATE_REGION_TOOL: ToolDefinition = {
  name: 'create_region',
  description:
    'Create a spatial region on the canvas. Regions are rectangular areas that can trigger actions when nodes enter or leave them.',
  input_schema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'Display label for the region' },
      x: { type: 'number', description: 'X position (flow coordinates)' },
      y: { type: 'number', description: 'Y position (flow coordinates)' },
      width: { type: 'number', description: 'Width in pixels (default: 400)' },
      height: { type: 'number', description: 'Height in pixels (default: 300)' },
      color: { type: 'string', description: 'Region tint color (default: accent color)' },
    },
    required: ['label'],
  },
}

const EXECUTE_PLAN_TOOL: ToolDefinition = {
  name: 'execute_plan',
  description:
    'Execute a multi-step mutation plan that creates multiple nodes and edges in a single batch. Use this for complex workspace setups with 5+ nodes.',
  input_schema: {
    type: 'object',
    properties: {
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tempId: {
              type: 'string',
              description: 'Temporary ID for referencing in edges',
            },
            type: {
              type: 'string',
              enum: [
                'note',
                'task',
                'conversation',
                'project',
                'artifact',
                'action',
                'orchestrator',
                'text',
                'workspace',
              ],
            },
            title: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['tempId', 'type', 'title'],
        },
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Source node tempId' },
            target: { type: 'string', description: 'Target node tempId' },
          },
          required: ['source', 'target'],
        },
      },
    },
    required: ['nodes'],
  },
}

// ── Viewport Helper ─────────────────────────────────────────────────────────

function getViewportCenter(jitter = 100): { x: number; y: number } {
  const vp = (window as any).__cognograph_viewport as
    | { x: number; y: number; zoom: number }
    | undefined
  if (vp) {
    return {
      x: (-vp.x + window.innerWidth / 2) / vp.zoom + (Math.random() - 0.5) * jitter,
      y: (-vp.y + window.innerHeight / 2) / vp.zoom + (Math.random() - 0.5) * jitter,
    }
  }
  return {
    x: 500 + (Math.random() - 0.5) * jitter,
    y: 400 + (Math.random() - 0.5) * jitter,
  }
}

// ── Tool Executors ──────────────────────────────────────────────────────────

async function executeCreateAgent(
  input: Record<string, unknown>,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const store = useWorkspaceStore.getState()
    const task = input.task as string
    const title =
      (input.title as string | undefined) || task.slice(0, 50) + (task.length > 50 ? '...' : '')
    const connectToNodeIds = (input.connectToNodeIds as string[] | undefined) || []

    const pos = getViewportCenter()

    // Create agent node (conversation node in agent mode)
    const nodeId = store.addAgentNode(pos)
    store.updateNode(nodeId, { title })

    // Connect context source nodes → agent node
    for (const sourceId of connectToNodeIds) {
      store.addEdge({ source: sourceId, target: nodeId, sourceHandle: null, targetHandle: null })
    }

    // If autoStart (default true), add the task as the initial user message
    const autoStart = input.autoStart !== false
    if (autoStart) {
      store.addMessage(nodeId, 'user', task)
    }

    return { success: true, result: { nodeId, title, connected: connectToNodeIds.length } }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

async function executeCreateAction(
  input: Record<string, unknown>,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const store = useWorkspaceStore.getState()
    const title = input.title as string
    const triggerType = input.triggerType as string
    const regionId = input.regionId as string | undefined

    const pos = getViewportCenter()
    const nodeId = store.addNode('action', pos)

    // Build a typed ActionTrigger from the input
    let trigger: ActionTrigger
    if (triggerType === 'region-enter' && regionId) {
      trigger = { type: 'region-enter', regionId }
    } else if (triggerType === 'region-exit' && regionId) {
      trigger = { type: 'region-exit', regionId }
    } else if (triggerType === 'connection-made') {
      trigger = { type: 'connection-made' }
    } else if (triggerType === 'schedule') {
      trigger = { type: 'schedule', cron: '0 9 * * *' } // sensible default: 9am daily
    } else {
      trigger = { type: 'manual' }
    }

    const steps = ((input.steps as any[] | undefined) || []) as ActionStep[]

    store.updateNode(nodeId, {
      title,
      trigger,
      actions: steps,
      enabled: true,
    } as any)

    return { success: true, result: { nodeId, title, triggerType } }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

async function executeCreateRegion(
  input: Record<string, unknown>,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // Import spatialRegionStore dynamically to avoid circular deps
    const { useSpatialRegionStore } = await import('../stores/spatialRegionStore')
    const regionStore = useSpatialRegionStore.getState()

    const vp = (window as any).__cognograph_viewport as
      | { x: number; y: number; zoom: number }
      | undefined
    const defaultPos = vp
      ? {
          x: (-vp.x + window.innerWidth / 2) / vp.zoom - 200,
          y: (-vp.y + window.innerHeight / 2) / vp.zoom - 150,
        }
      : { x: 300, y: 200 }

    const regionId = regionStore.addRegion({
      name: input.label as string,
      bounds: {
        x: (input.x as number | undefined) ?? defaultPos.x,
        y: (input.y as number | undefined) ?? defaultPos.y,
        width: (input.width as number | undefined) ?? 400,
        height: (input.height as number | undefined) ?? 300,
      },
      color: (input.color as string | undefined) || undefined,
    })

    return { success: true, result: { regionId, label: input.label } }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

async function executeExecutePlan(
  input: Record<string, unknown>,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const store = useWorkspaceStore.getState()
    const planNodes = (input.nodes as any[] | undefined) || []
    const planEdges = (input.edges as any[] | undefined) || []

    // Map tempId -> realId
    const idMap: Record<string, string> = {}

    const vp = (window as any).__cognograph_viewport as
      | { x: number; y: number; zoom: number }
      | undefined
    const centerX = vp ? (-vp.x + window.innerWidth / 2) / vp.zoom : 500
    const centerY = vp ? (-vp.y + window.innerHeight / 2) / vp.zoom : 400

    // Create all nodes in a grid layout centered on viewport
    for (let i = 0; i < planNodes.length; i++) {
      const n = planNodes[i]
      const col = i % 4
      const row = Math.floor(i / 4)
      const pos = {
        x: centerX + col * 350 - Math.min(planNodes.length - 1, 3) * 175,
        y: centerY + row * 300 - 150,
      }
      const nodeId = store.addNode(n.type as NodeData['type'], pos)
      store.updateNode(nodeId, {
        title: n.title,
        ...(n.content ? { content: n.content } : {}),
      })
      idMap[n.tempId] = nodeId
    }

    // Create all edges
    let edgeCount = 0
    for (const e of planEdges) {
      const sourceId = idMap[e.source]
      const targetId = idMap[e.target]
      if (sourceId && targetId) {
        store.addEdge({
          source: sourceId,
          target: targetId,
          sourceHandle: null,
          targetHandle: null,
        })
        edgeCount++
      }
    }

    return {
      success: true,
      result: {
        nodeMap: idMap,
        edgeCount,
        totalNodes: planNodes.length,
      },
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getWorkspaceToolDefinitions(): ToolDefinition[] {
  return [CREATE_AGENT_TOOL, CREATE_ACTION_TOOL, CREATE_REGION_TOOL, EXECUTE_PLAN_TOOL]
}

export async function executeWorkspaceTool(
  name: string,
  input: Record<string, unknown>,
): Promise<{ success: boolean; result?: any; error?: string }> {
  switch (name) {
    case 'create_agent':
      return executeCreateAgent(input)
    case 'create_action':
      return executeCreateAction(input)
    case 'create_region':
      return executeCreateRegion(input)
    case 'execute_plan':
      return executeExecutePlan(input)
    default:
      return { success: false, error: `Unknown workspace tool: ${name}` }
  }
}
