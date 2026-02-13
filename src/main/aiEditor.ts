/**
 * AI Editor IPC Handlers
 *
 * Handles plan generation for the AI Workspace Editor.
 * Uses Anthropic API with tool use to generate mutation plans based on context.
 * Supports agent mode with query tools for smarter context gathering.
 */

import { ipcMain, safeStorage, BrowserWindow } from 'electron'
import Store from 'electron-store'
import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuid } from 'uuid'
import type {
  AIEditorContext,
  MutationPlan,
  MutationOp,
  PlanWarning,
  ConversationMessage
} from '../shared/types'
import type { IPCResponse } from '../shared/ipc-types'
import {
  createIPCSuccess,
  createIPCError,
  IPC_ERROR_CODES
} from '../shared/ipc-types'
import {
  createStreamingSession,
  cancelStreamingSession,
  updateSessionPhase,
  cleanupSession,
  emitStreamPhase,
  emitStreamComplete
} from './services/streaming'

interface EncryptedKeys {
  anthropic?: string
  gemini?: string
  openai?: string
}

const store = new Store()

// Current streaming session ID (for cancellation)
let currentStreamingSessionId: string | null = null

/**
 * Get the main browser window
 */
function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows[0] || null
}

// -----------------------------------------------------------------------------
// Query Tools for Agent Mode
// These tools let the AI gather more context before generating a plan
// -----------------------------------------------------------------------------

const QUERY_TOOLS: Anthropic.Tool[] = [
  {
    name: 'find_nodes',
    description: 'Search for nodes in the workspace by type, title, or tags. Use this to discover nodes that might be relevant to the task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['conversation', 'project', 'note', 'task', 'artifact', 'workspace', 'text', 'action'],
          description: 'Filter by node type'
        },
        titleContains: {
          type: 'string',
          description: 'Filter by title substring (case-insensitive)'
        },
        hasTag: {
          type: 'string',
          description: 'Filter by tag'
        },
        limit: {
          type: 'number',
          description: 'Max results (default: 20)'
        }
      }
    }
  },
  {
    name: 'get_node_details',
    description: 'Get full details of a specific node including all its data. Use this to inspect a node more closely.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nodeId: {
          type: 'string',
          description: 'The ID of the node to get details for'
        }
      },
      required: ['nodeId']
    }
  },
  {
    name: 'get_connected_nodes',
    description: 'Get all nodes connected to a specific node. Useful for understanding relationships.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nodeId: {
          type: 'string',
          description: 'The ID of the node to find connections for'
        }
      },
      required: ['nodeId']
    }
  },
  {
    name: 'ready_to_generate_plan',
    description: 'Call this when you have gathered enough context and are ready to generate the mutation plan. Pass your final plan as the argument.',
    input_schema: {
      type: 'object' as const,
      properties: {
        operations: {
          type: 'array',
          description: 'Array of mutation operations',
          items: { type: 'object' }
        },
        warnings: {
          type: 'array',
          description: 'Array of warnings',
          items: { type: 'object' }
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of what the plan does'
        }
      },
      required: ['operations', 'reasoning']
    }
  }
]

// Execute a query tool by forwarding to the renderer process
async function executeQueryTool(
  toolName: string,
  input: Record<string, unknown>,
  context: AIEditorContext
): Promise<unknown> {
  // Execute tools locally using the context we already have
  switch (toolName) {
    case 'find_nodes': {
      const { type, titleContains, hasTag, limit = 20 } = input
      let results = [...context.selectedNodes, ...context.visibleNodes]

      // Remove duplicates
      const seen = new Set<string>()
      results = results.filter((n) => {
        if (seen.has(n.id)) return false
        seen.add(n.id)
        return true
      })

      if (type) {
        results = results.filter((n) => n.type === type)
      }
      if (titleContains) {
        const search = (titleContains as string).toLowerCase()
        results = results.filter((n) => (n.title || '').toLowerCase().includes(search))
      }
      if (hasTag) {
        results = results.filter((n) => (n.tags || []).includes(hasTag as string))
      }

      return {
        nodes: results.slice(0, limit as number),
        total: results.length
      }
    }

    case 'get_node_details': {
      const { nodeId } = input
      const allNodes = [...context.selectedNodes, ...context.visibleNodes]
      const node = allNodes.find((n) => n.id === nodeId)
      if (!node) {
        return { error: `Node not found: ${nodeId}` }
      }
      return { node }
    }

    case 'get_connected_nodes': {
      const { nodeId } = input
      const connectedIds = new Set<string>()

      for (const edge of context.edges) {
        if (edge.source === nodeId) connectedIds.add(edge.target)
        if (edge.target === nodeId) connectedIds.add(edge.source)
      }

      const allNodes = [...context.selectedNodes, ...context.visibleNodes]
      const connectedNodes = allNodes.filter((n) => connectedIds.has(n.id))

      return {
        connectedNodes,
        edges: context.edges.filter((e) => e.source === nodeId || e.target === nodeId)
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

function getApiKey(provider: string): string | null {
  try {
    const encryptedKeys = store.get('encryptedApiKeys', {}) as EncryptedKeys
    const encrypted = encryptedKeys[provider as keyof EncryptedKeys]

    if (!encrypted) {
      return null
    }

    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encrypted, 'base64')
      return safeStorage.decryptString(buffer)
    }
    return encrypted
  } catch (error) {
    console.error(`[AIEditor:getApiKey] Error decrypting key:`, error)
    return null
  }
}

// System prompt for plan generation (non-agent mode)
function buildSystemPrompt(mode: AIEditorContext['mode']): string {
  const basePrompt = `You are an AI assistant that helps users build and modify their AI workflow orchestration canvas.

WHAT THIS SYSTEM IS:
Cognograph is a visual programming environment for AI workflows. It is NOT a simple planning/note app.
- Nodes represent EXECUTABLE components: AI conversations, context sources, data artifacts, tasks
- Edges represent DATA FLOW and CONTEXT INJECTION - connected nodes automatically provide context to AI conversations
- The graph structure determines WHAT INFORMATION each AI conversation can access

HOW IT WORKS:
- When a user chats with a "conversation" node, the system traverses incoming edges to gather context
- Connected "note" nodes inject their content as background knowledge
- Connected "artifact" nodes provide code, documents, or structured data
- Connected "project" nodes scope the conversation to a specific domain
- Connected "task" nodes inform the AI about what work needs to be done
- Edge strength (light/normal/strong) controls how much influence each connection has

THINK OF IT LIKE:
- A conversation node is like a function that takes context as input
- Edges are like import statements or dependency injection
- Notes/artifacts are like constants or data sources
- Projects are like namespaces or modules
- The graph topology defines the "program" that runs when the user chats

Your task is to analyze the current state and generate a mutation plan based on the user's request.

CRITICAL RULES:
1. You MUST respond with ONLY valid JSON. No markdown, no explanations, no questions.
2. NEVER ask clarifying questions - make your best interpretation and proceed.
3. If the request is ambiguous, make reasonable assumptions and note them in the "reasoning" field.
4. If there's nothing to do or the workspace is empty, return an empty operations array with a reasoning explaining why.
5. Always return a valid JSON object with "operations", "warnings", and "reasoning" fields.

The mutation plan should be a JSON object with this structure:
{
  "operations": [
    // Array of operations to perform
  ],
  "warnings": [
    // Array of warnings if any issues detected
  ],
  "reasoning": "Brief explanation of what the plan does"
}

Available operation types:

1. create-node: Create a new node
{
  "op": "create-node",
  "tempId": "temp-1", // Temporary ID for referencing in edges
  "type": "conversation" | "note" | "task" | "project" | "artifact" | "workspace" | "text" | "action",
  "position": {
    "type": "relative-to",
    "anchor": "existing-node-id-or-temp-id",
    "direction": "above" | "below" | "left" | "right",
    "offset": 50 // optional, default 50
  },
  "data": {
    "title": "Node title",
    // type-specific fields...
  }
}

2. delete-node: Delete an existing node
{
  "op": "delete-node",
  "nodeId": "existing-node-id",
  "reason": "Optional explanation"
}

3. update-node: Update node data
{
  "op": "update-node",
  "nodeId": "existing-node-id",
  "data": {
    // Fields to update
  }
}

4. move-node: Move a node to a new position
{
  "op": "move-node",
  "nodeId": "existing-node-id",
  "position": {
    "type": "relative-to",
    "anchor": "other-node-id",
    "direction": "right"
  }
}

5. create-edge: Create a connection between nodes
{
  "op": "create-edge",
  "source": "node-id-or-temp-id",
  "target": "node-id-or-temp-id",
  "data": {
    "label": "optional label",
    "strength": "normal" // "light" | "normal" | "strong"
  }
}

6. delete-edge: Remove a connection
{
  "op": "delete-edge",
  "edgeId": "existing-edge-id"
}

Position types:
- "absolute": { "type": "absolute", "x": 100, "y": 200 }
- "relative-to": { "type": "relative-to", "anchor": "node-id", "direction": "below", "offset": 50 }
- "center-of-selection": { "type": "center-of-selection" }
- "center-of-view": { "type": "center-of-view" }
- "below-selection": { "type": "below-selection", "index": 0 }
- "grid": { "type": "grid", "row": 0, "col": 1, "baseAnchor": "node-id", "spacing": 250 }
- "cluster": { "type": "cluster", "near": "node-id", "spread": 100 }

Node data fields by type:
- conversation: { title, provider: "anthropic"|"gemini"|"openai" }
- note: { title, content }
- task: { title, description, status: "todo"|"in-progress"|"done", priority: "low"|"medium"|"high" }
- project: { title, description }
- artifact: { title, content, contentType: "code"|"markdown"|"text"|etc }
- workspace: { title, description }
`

  const modeSpecificPrompt: Record<typeof mode, string> = {
    generate: `
MODE: GENERATE
Your goal is to create new workflow components based on the user's request:
- Create context sources (notes, artifacts) that conversations will need
- Create conversation nodes configured for specific tasks
- Wire up edges so context flows correctly to conversations
- Build complete mini-workflows, not isolated nodes
- Consider what context a new conversation would need to do its job

Think about: "What complete workflow structure would accomplish the user's goal?"`,

    edit: `
MODE: EDIT
Your goal is to fix and improve the existing workflow graph:
- Fix broken context chains (conversations missing needed context sources)
- Repair orphaned nodes that should be connected
- Improve edge structure to reduce redundant connections
- Restructure for better modularity and reusability
- Ensure conversations have appropriate context scoping

Think about: "How can this workflow be improved, fixed, and made more maintainable?"`,

    organize: `
MODE: ORGANIZE
Your goal is to arrange the visual layout to reflect the logical structure:
- Position context sources (notes, artifacts) above or to the left of conversations they feed into
- Align conversations that share context sources
- Create clear visual flow from inputs (context) to outputs (conversations)
- Group related workflows spatially
- Use consistent spacing to show relationships

Think about: "How can the layout make the data flow and dependencies immediately obvious?"`,

    automate: `
MODE: AUTOMATE
Your goal is to create action nodes that automate workflows. When creating action nodes, you MUST configure their trigger, conditions, and actions.

## Available Triggers (set as nodeData.trigger)
- manual: User clicks play button {type: "manual"}
- property-change: When node property changes {type: "property-change", property: string, toValue?: any, nodeFilter?: string}
- node-created: When new node added {type: "node-created", nodeTypeFilter?: string}
- connection-made: When edge created {type: "connection-made", direction?: "incoming"|"outgoing"|"any", nodeTypeFilter?: string}
- schedule: Cron-based {type: "schedule", cron: string} (e.g., "0 9 * * *" for 9am daily)
- children-complete: When child nodes reach status {type: "children-complete", property: string, targetValue: any, requireAll?: boolean}
- isolation: When node has 0 connections {type: "isolation"}

## Available Steps (set as nodeData.actions array)
- update-property: {type: "update-property", config: {target: "trigger-node"|nodeId, property: string, value: any}}
- create-node: {type: "create-node", config: {nodeType: string, title: string, position?: string, variableName?: string}}
- delete-node: {type: "delete-node", config: {target: "trigger-node"|nodeId}}
- move-node: {type: "move-node", config: {target: string, x: number, y: number}}
- link-nodes: {type: "link-nodes", config: {source: string, target: string}}
- unlink-nodes: {type: "unlink-nodes", config: {source: string, target: string}}
- llm-call: {type: "llm-call", config: {prompt: string, variableName?: string}}
- wait: {type: "wait", config: {duration: number}} (milliseconds)

## Action Node Data Structure
When creating an action node, set nodeData to:
{
  trigger: { type: "...", ...config },
  conditions: [], // optional array of conditions
  actions: [ { type: "...", config: {...} }, ... ],
  enabled: true
}

## Variable Syntax in Actions
- {{triggerNode.title}}, {{triggerNode.data.status}} - reference trigger node
- {{variables.myVar}} - reference variables from earlier steps

Think about: "What automated workflow would accomplish the user's goal without manual intervention?"`,

    ask: `
MODE: ASK
Your goal is to answer questions about the workspace:
- Analyze the current graph structure and relationships
- Provide insights about context flow and dependencies
- Suggest improvements without making changes
- Explain how different parts of the workflow interact
- Help the user understand their workspace better

Think about: "What information would help the user understand and improve their workspace?"`
  }

  return basePrompt + modeSpecificPrompt[mode]
}

function buildUserPrompt(context: AIEditorContext): string {
  const parts: string[] = []

  parts.push(`User's request: ${context.prompt}`)
  parts.push('')
  parts.push(`Scope: ${context.scope}`)
  parts.push(`Selected node IDs: ${context.selectedNodeIds.join(', ') || 'none'}`)
  parts.push('')

  if (context.selectedNodes.length > 0) {
    parts.push('Selected nodes (full detail):')
    for (const node of context.selectedNodes) {
      parts.push(`- ID: ${node.id}`)
      parts.push(`  Type: ${node.type}`)
      parts.push(`  Title: ${node.title}`)
      parts.push(`  Position: (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`)
      if (node.contentPreview) {
        parts.push(`  Content: ${node.contentPreview}`)
      }
      if (node.messageCount !== undefined) {
        parts.push(`  Messages: ${node.messageCount}`)
      }
      if (node.status) {
        parts.push(`  Status: ${node.status}`)
      }
    }
    parts.push('')
  }

  if (context.visibleNodes.length > 0) {
    parts.push('Other visible nodes:')
    for (const node of context.visibleNodes) {
      parts.push(`- ${node.id}: ${node.type} "${node.title}" at (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`)
    }
    parts.push('')
  }

  if (context.edges.length > 0) {
    parts.push('Connections:')
    for (const edge of context.edges) {
      const label = edge.label ? ` [${edge.label}]` : ''
      parts.push(`- ${edge.source} → ${edge.target}${label}`)
    }
    parts.push('')
  }

  parts.push('Viewport center: (' +
    Math.round((context.viewport.x + context.canvasBounds.maxX) / 2) + ', ' +
    Math.round((context.viewport.y + context.canvasBounds.maxY) / 2) + ')')

  parts.push('')
  parts.push('Respond with ONLY the JSON mutation plan. No markdown formatting, no explanations outside the JSON.')

  return parts.join('\n')
}

function parsePlanResponse(content: string): { operations: MutationOp[]; warnings: PlanWarning[]; reasoning?: string } {
  // Try to extract JSON from the response
  let jsonStr = content.trim()

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7)
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3)
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3)
  }
  jsonStr = jsonStr.trim()

  // Try to find JSON object in the response if not starting with {
  if (!jsonStr.startsWith('{')) {
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }
  }

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      operations: parsed.operations || [],
      warnings: parsed.warnings || [],
      reasoning: parsed.reasoning
    }
  } catch (error) {
    console.error('[AIEditor:parse] Failed to parse response:', error)
    console.error('[AIEditor:parse] Content:', content.substring(0, 500))

    // If parsing fails, return empty plan with the response as reasoning
    // This handles cases where the AI asks clarifying questions instead of returning JSON
    return {
      operations: [],
      warnings: [{
        level: 'error',
        message: 'AI response was not valid JSON. Please try rephrasing your request.'
      }],
      reasoning: content.substring(0, 300)
    }
  }
}

async function generatePlanWithAnthropic(context: AIEditorContext): Promise<IPCResponse<MutationPlan>> {
  const apiKey = getApiKey('anthropic')
  if (!apiKey) {
    return createIPCError(
      IPC_ERROR_CODES.LLM_API_ERROR,
      'Anthropic API key not set. Please add your API key in settings.'
    )
  }

  try {
    const client = new Anthropic({ apiKey })

    const systemPrompt = buildSystemPrompt(context.mode)
    const userPrompt = buildUserPrompt(context)

    console.log('[AIEditor] Generating plan...')
    console.log('[AIEditor] Mode:', context.mode)
    console.log('[AIEditor] Scope:', context.scope)
    console.log('[AIEditor] Prompt:', context.prompt.substring(0, 100))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return createIPCError(
        IPC_ERROR_CODES.LLM_INVALID_RESPONSE,
        'No text response from AI'
      )
    }

    console.log('[AIEditor] Response received, parsing...')

    const { operations, warnings, reasoning } = parsePlanResponse(textContent.text)

    // Calculate estimated changes
    const estimatedChanges = {
      nodesCreated: operations.filter(op => op.op === 'create-node').length,
      nodesDeleted: operations.filter(op => op.op === 'delete-node').length,
      nodesUpdated: operations.filter(op => op.op === 'update-node').length,
      nodesMoved: operations.filter(op => op.op === 'move-node').length,
      edgesCreated: operations.filter(op => op.op === 'create-edge').length,
      edgesDeleted: operations.filter(op => op.op === 'delete-edge').length
    }

    const plan: MutationPlan = {
      id: uuid(),
      mode: context.mode,
      prompt: context.prompt,
      scope: context.scope,
      operations,
      warnings,
      reasoning,
      estimatedChanges
    }

    console.log('[AIEditor] Plan generated:', {
      operations: operations.length,
      warnings: warnings.length,
      ...estimatedChanges
    })

    return createIPCSuccess(plan)
  } catch (error) {
    console.error('[AIEditor] Error generating plan:', error)
    return createIPCError(
      IPC_ERROR_CODES.AI_EDITOR_GENERATION_FAILED,
      error instanceof Error ? error.message : 'Unknown error occurred',
      error instanceof Error ? error.stack : undefined
    )
  }
}

// -----------------------------------------------------------------------------
// Agent Mode Plan Generation (with tool use)
// -----------------------------------------------------------------------------

function buildAgentSystemPrompt(mode: AIEditorContext['mode']): string {
  const basePrompt = `You are an AI assistant that helps users build and modify their AI workflow orchestration canvas.

WHAT THIS SYSTEM IS:
Cognograph is a visual programming environment for AI workflows. It is NOT a simple planning/note app.
- Nodes represent EXECUTABLE components: AI conversations (functions), context sources (data), tasks (work items)
- Edges represent DATA FLOW - connected nodes automatically inject context into AI conversations
- The graph structure is a PROGRAM that determines what information each AI conversation can access

HOW IT WORKS:
- "conversation" nodes are like functions - they process user input with injected context
- "note" and "artifact" nodes are like constants/data - they provide information to conversations
- "project" nodes are like namespaces - they scope conversations to a domain
- Edges are like imports - they wire context sources INTO conversations
- Edge strength (light/normal/strong) controls connection influence

CRITICAL: Your goal is to generate a mutation plan. You MUST call ready_to_generate_plan to submit your plan.

WORKFLOW:
1. Review the context provided - you already have positions, types, and edges
2. If needed, use AT MOST 1-2 query tool calls for specific details
3. Then IMMEDIATELY call ready_to_generate_plan with your mutation plan

RULES:
- DO NOT explore excessively - you have the graph structure already
- ALWAYS call ready_to_generate_plan after at most 1-2 exploration calls
- Think about DATA FLOW: context should flow INTO conversations, not out of them
- Consider what context each conversation needs to do its job

Available operation types for your plan:

1. create-node: Create a new node
{
  "op": "create-node",
  "tempId": "temp-1",
  "type": "conversation" | "note" | "task" | "project" | "artifact" | "workspace" | "text" | "action",
  "position": { "type": "relative-to", "anchor": "node-id", "direction": "below", "offset": 50 },
  "data": { "title": "Node title", ... }
}

2. delete-node: { "op": "delete-node", "nodeId": "existing-node-id" }
3. update-node: { "op": "update-node", "nodeId": "existing-node-id", "data": { ... } }
4. move-node: { "op": "move-node", "nodeId": "existing-node-id", "position": { ... } }
5. create-edge: { "op": "create-edge", "source": "node-id", "target": "node-id" }
6. delete-edge: { "op": "delete-edge", "edgeId": "existing-edge-id" }

Position types:
- "absolute": { "type": "absolute", "x": 100, "y": 200 }
- "relative-to": { "type": "relative-to", "anchor": "node-id", "direction": "below"|"above"|"left"|"right", "offset": 50 }
- "center-of-view": { "type": "center-of-view" }
- "grid": { "type": "grid", "row": 0, "col": 1, "baseAnchor": "node-id", "spacing": 250 }
`

  const modePrompts: Record<typeof mode, string> = {
    generate: `\nMODE: GENERATE - Create complete mini-workflows: context sources + conversations + proper wiring. Not isolated nodes.`,
    edit: `\nMODE: EDIT - Fix and improve workflow: broken context chains, missing edges, orphaned nodes, restructure for modularity.`,
    organize: `\nMODE: ORGANIZE - Arrange layout to show data flow: context sources above/left of conversations, clear visual flow direction.`,
    automate: `\nMODE: AUTOMATE - Create automation workflows: action nodes with triggers, conditions, and proper context wiring.`,
    ask: `\nMODE: ASK - Analyze and explain the workspace: structure, relationships, context flow, and improvement suggestions.`
  }

  return basePrompt + modePrompts[mode]
}

async function generatePlanWithAgentMode(context: AIEditorContext): Promise<IPCResponse<MutationPlan>> {
  const apiKey = getApiKey('anthropic')
  if (!apiKey) {
    return createIPCError(
      IPC_ERROR_CODES.LLM_API_ERROR,
      'Anthropic API key not set. Please add your API key in settings.'
    )
  }

  try {
    const client = new Anthropic({ apiKey })
    const systemPrompt = buildAgentSystemPrompt(context.mode)

    // Build initial user prompt with FULL context so agent doesn't need to explore much
    const selectedNodesInfo = context.selectedNodes.map(n =>
      `  - ${n.id}: ${n.type} "${n.title}" at (${Math.round(n.position.x)}, ${Math.round(n.position.y)})`
    ).join('\n')

    const visibleNodesInfo = context.visibleNodes.map(n =>
      `  - ${n.id}: ${n.type} "${n.title}" at (${Math.round(n.position.x)}, ${Math.round(n.position.y)})`
    ).join('\n')

    const edgesInfo = context.edges.map(e =>
      `  - ${e.source} → ${e.target}${e.label ? ` [${e.label}]` : ''}`
    ).join('\n')

    const userPrompt = `User's request: ${context.prompt}

Scope: ${context.scope}

SELECTED NODES (${context.selectedNodes.length}):
${selectedNodesInfo || '  (none)'}

OTHER VISIBLE NODES (${context.visibleNodes.length}):
${visibleNodesInfo || '  (none)'}

EDGES (${context.edges.length}):
${edgesInfo || '  (none)'}

You have all the node positions and relationships above. Generate your mutation plan now by calling ready_to_generate_plan.
Only use query tools if you need specific node content/details not shown here.`

    console.log('[AIEditor:Agent] Starting agent mode plan generation...')
    console.log('[AIEditor:Agent] Mode:', context.mode)
    console.log('[AIEditor:Agent] Prompt:', context.prompt.substring(0, 100))

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]
    let iterations = 0
    const maxIterations = 5 // Limit tool use iterations

    while (iterations < maxIterations) {
      iterations++
      console.log(`[AIEditor:Agent] Iteration ${iterations}`)

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        temperature: 0.3,
        system: systemPrompt,
        messages,
        tools: QUERY_TOOLS
      })

      // Check for tool use
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )

      if (toolUseBlocks.length === 0) {
        // No tool use - try to parse any text response as a plan
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        )
        if (textBlock) {
          const { operations, warnings, reasoning } = parsePlanResponse(textBlock.text)
          return createPlanResponse(context, operations, warnings, reasoning)
        }
        return createIPCError(
          IPC_ERROR_CODES.AI_EDITOR_GENERATION_FAILED,
          'AI did not generate a plan. Please try again.'
        )
      }

      // Process tool calls
      const toolResults: Anthropic.MessageParam['content'] = []

      for (const toolUse of toolUseBlocks) {
        console.log(`[AIEditor:Agent] Tool call: ${toolUse.name}`)

        // Check if this is the final plan submission
        if (toolUse.name === 'ready_to_generate_plan') {
          const input = toolUse.input as {
            operations: MutationOp[]
            warnings?: PlanWarning[]
            reasoning: string
          }
          console.log('[AIEditor:Agent] Plan submitted via tool')
          return createPlanResponse(
            context,
            input.operations || [],
            input.warnings || [],
            input.reasoning
          )
        }

        // Execute query tool
        const result = await executeQueryTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          context
        )

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result, null, 2)
        })
      }

      // Add assistant response and tool results to messages
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
    }

    return createIPCError(
      IPC_ERROR_CODES.AI_EDITOR_GENERATION_FAILED,
      'Agent reached maximum iterations without generating a plan.'
    )
  } catch (error) {
    console.error('[AIEditor:Agent] Error:', error)
    return createIPCError(
      IPC_ERROR_CODES.AI_EDITOR_GENERATION_FAILED,
      error instanceof Error ? error.message : 'Unknown error occurred',
      error instanceof Error ? error.stack : undefined
    )
  }
}

function createPlanResponse(
  context: AIEditorContext,
  operations: MutationOp[],
  warnings: PlanWarning[],
  reasoning?: string
): IPCResponse<MutationPlan> {
  const estimatedChanges = {
    nodesCreated: operations.filter(op => op.op === 'create-node').length,
    nodesDeleted: operations.filter(op => op.op === 'delete-node').length,
    nodesUpdated: operations.filter(op => op.op === 'update-node').length,
    nodesMoved: operations.filter(op => op.op === 'move-node').length,
    edgesCreated: operations.filter(op => op.op === 'create-edge').length,
    edgesDeleted: operations.filter(op => op.op === 'delete-edge').length
  }

  const plan: MutationPlan = {
    id: uuid(),
    mode: context.mode,
    prompt: context.prompt,
    scope: context.scope,
    operations,
    warnings,
    reasoning,
    estimatedChanges
  }

  console.log('[AIEditor] Plan generated:', {
    operations: operations.length,
    warnings: warnings.length,
    ...estimatedChanges
  })

  return createIPCSuccess(plan)
}

// -----------------------------------------------------------------------------
// Streaming Plan Generation
// -----------------------------------------------------------------------------

/**
 * Generate a plan with streaming updates
 */
async function generatePlanWithStreaming(context: AIEditorContext): Promise<void> {
  const mainWindow = getMainWindow()
  if (!mainWindow) {
    throw new Error('No main window available')
  }

  // Extract requestId from context for event correlation
  const requestId = context.requestId

  const apiKey = getApiKey('anthropic')
  if (!apiKey) {
    mainWindow.webContents.send('aiEditor:plan:error', {
      error: 'Anthropic API key not set. Please add your API key in settings.',
      requestId
    })
    return
  }

  // Create a new streaming session
  const sessionId = uuid()
  currentStreamingSessionId = sessionId
  const session = createStreamingSession(sessionId)

  try {
    const client = new Anthropic({ apiKey })
    const systemPrompt = buildSystemPrompt(context.mode)
    const userPrompt = buildUserPrompt(context)

    // Emit initial phase
    emitStreamPhase(mainWindow, 'aiEditor:plan', {
      phase: 'analyzing',
      message: 'Analyzing workspace context...',
      requestId
    })

    console.log('[AIEditor:Streaming] Starting plan generation...')
    console.log('[AIEditor:Streaming] Mode:', context.mode)
    console.log('[AIEditor:Streaming] Scope:', context.scope)

    let fullText = ''

    // Stream the response
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    // Check for cancellation before processing
    if (session.abortController.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    // Update phase to planning
    updateSessionPhase(sessionId, 'planning')
    emitStreamPhase(mainWindow, 'aiEditor:plan', {
      phase: 'planning',
      message: 'Generating mutation plan...',
      requestId
    })

    for await (const event of stream) {
      // Check for cancellation during streaming
      if (session.abortController.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text
        // Send chunk to renderer
        mainWindow.webContents.send('aiEditor:plan:chunk', {
          type: 'text',
          content: event.delta.text,
          requestId
        })
      }
    }

    // Finalize
    updateSessionPhase(sessionId, 'finalizing')
    emitStreamPhase(mainWindow, 'aiEditor:plan', {
      phase: 'finalizing',
      message: 'Parsing plan...',
      requestId
    })

    // Parse the response
    const { operations, warnings, reasoning } = parsePlanResponse(fullText)

    // Calculate estimated changes
    const estimatedChanges = {
      nodesCreated: operations.filter(op => op.op === 'create-node').length,
      nodesDeleted: operations.filter(op => op.op === 'delete-node').length,
      nodesUpdated: operations.filter(op => op.op === 'update-node').length,
      nodesMoved: operations.filter(op => op.op === 'move-node').length,
      edgesCreated: operations.filter(op => op.op === 'create-edge').length,
      edgesDeleted: operations.filter(op => op.op === 'delete-edge').length
    }

    const plan: MutationPlan = {
      id: uuid(),
      mode: context.mode,
      prompt: context.prompt,
      scope: context.scope,
      operations,
      warnings,
      reasoning,
      estimatedChanges
    }

    console.log('[AIEditor:Streaming] Plan generated:', {
      operations: operations.length,
      warnings: warnings.length,
      ...estimatedChanges
    })

    // Emit complete
    updateSessionPhase(sessionId, 'complete')
    emitStreamComplete(mainWindow, 'aiEditor:plan', {
      success: true,
      data: plan,
      duration: Date.now() - session.startTime,
      requestId
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[AIEditor:Streaming] Generation cancelled')
      emitStreamPhase(mainWindow, 'aiEditor:plan', {
        phase: 'cancelled',
        message: 'Generation cancelled',
        requestId
      })
    } else {
      console.error('[AIEditor:Streaming] Error:', error)
      updateSessionPhase(sessionId, 'error')
      // Include requestId in error payload so renderer can match it
      mainWindow.webContents.send('aiEditor:plan:error', {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        requestId
      })
    }
  } finally {
    cleanupSession(sessionId)
    if (currentStreamingSessionId === sessionId) {
      currentStreamingSessionId = null
    }
  }
}

/**
 * Cancel the current streaming generation
 */
function cancelCurrentGeneration(): boolean {
  if (currentStreamingSessionId) {
    const cancelled = cancelStreamingSession(currentStreamingSessionId)
    currentStreamingSessionId = null
    return cancelled
  }
  return false
}

// -----------------------------------------------------------------------------
// Plan Refinement
// Takes an existing plan and conversation history, refines based on new prompt
// -----------------------------------------------------------------------------

interface RefinePlanRequest {
  currentPlan: MutationPlan
  conversationHistory: ConversationMessage[]
  refinementPrompt: string
  context: AIEditorContext
}

async function refinePlan(request: RefinePlanRequest): Promise<IPCResponse<MutationPlan>> {
  const apiKey = getApiKey('anthropic')
  if (!apiKey) {
    return createIPCError(
      IPC_ERROR_CODES.LLM_API_ERROR,
      'Anthropic API key not set. Please add your API key in settings.'
    )
  }

  try {
    const client = new Anthropic({ apiKey })

    // Build a refinement-specific system prompt
    const systemPrompt = `You are an AI workspace editor that refines mutation plans based on user feedback.

Your current task is to modify an existing plan based on the user's refinement request.

The user has already seen the plan and wants changes. Their refinement request should be your primary guide.

Rules for refinement:
1. Keep operations that weren't mentioned for removal
2. Add new operations if the user asks for more content
3. Modify existing operations if the user wants changes
4. Remove operations if the user explicitly says to remove something
5. Preserve the overall structure unless asked to change it

Respond with a JSON object containing:
{
  "operations": [...],  // The refined list of mutation operations
  "warnings": [...],    // Any warnings about the changes
  "reasoning": "..."    // Brief explanation of what you changed
}

Available operation types:
- create-node: { op: "create-node", type: "conversation"|"note"|"task"|"project"|"artifact"|"workspace"|"text"|"action", tempId: string, position: { type: "relative-to"|"absolute", ... }, data: { title: string, ... } }
- update-node: { op: "update-node", nodeId: string, data: { title?, content?, tags?, etc } }
- delete-node: { op: "delete-node", nodeId: string }
- move-node: { op: "move-node", nodeId: string, position: { x: number, y: number } }
- create-edge: { op: "create-edge", source: string, target: string }
- delete-edge: { op: "delete-edge", edgeId: string }
`

    // Build conversation messages including history
    const messages: Anthropic.MessageParam[] = []

    // Add conversation history
    for (const msg of request.conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    }

    // Add current plan context and refinement request
    const userMessage = `Current plan (${request.currentPlan.operations.length} operations):
\`\`\`json
${JSON.stringify(request.currentPlan, null, 2)}
\`\`\`

Refinement request: ${request.refinementPrompt}

Please provide the refined plan as a JSON object.`

    messages.push({ role: 'user', content: userMessage })

    console.log('[AIEditor:Refine] Refining plan...')
    console.log('[AIEditor:Refine] Original ops:', request.currentPlan.operations.length)
    console.log('[AIEditor:Refine] Refinement:', request.refinementPrompt.substring(0, 100))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages
    })

    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return createIPCError(
        IPC_ERROR_CODES.LLM_API_ERROR,
        'No text response from API'
      )
    }

    const parsedPlan = parsePlanResponse(textContent.text)

    // Construct full MutationPlan by merging with original plan metadata
    const refinedPlan: MutationPlan = {
      ...request.currentPlan,
      operations: parsedPlan.operations,
      warnings: parsedPlan.warnings,
      reasoning: parsedPlan.reasoning || request.currentPlan.reasoning
    }

    console.log('[AIEditor:Refine] Refined plan:', refinedPlan.operations.length, 'operations')

    return createIPCSuccess(refinedPlan)
  } catch (error) {
    console.error('[AIEditor:Refine] Error:', error)
    return createIPCError(
      IPC_ERROR_CODES.LLM_API_ERROR,
      error instanceof Error ? error.message : 'Unknown error during refinement'
    )
  }
}

export function registerAIEditorHandlers(): void {
  // Standard plan generation (no tool use)
  ipcMain.handle('ai:generatePlan', async (_event, context: AIEditorContext) => {
    return generatePlanWithAnthropic(context)
  })

  // Agent mode plan generation (with tool use for smarter context gathering)
  ipcMain.handle('ai:generatePlanWithAgent', async (_event, context: AIEditorContext) => {
    return generatePlanWithAgentMode(context)
  })

  // Streaming plan generation
  ipcMain.handle('ai:generatePlanStreaming', async (_event, context: AIEditorContext) => {
    // Don't await - let it stream in the background
    generatePlanWithStreaming(context).catch(err => {
      console.error('[AIEditor:Streaming] Unhandled error:', err)
      // Notify renderer so UI doesn't hang indefinitely
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('aiEditor:plan:error', {
          error: err instanceof Error ? err.message : 'Streaming failed unexpectedly',
          requestId: context.requestId
        })
      }
    })
    return { success: true, message: 'Streaming started' }
  })

  // Cancel streaming generation
  ipcMain.handle('ai:cancelGeneration', async () => {
    const cancelled = cancelCurrentGeneration()
    return { success: true, cancelled }
  })

  // Refine existing plan based on conversation history
  ipcMain.handle('ai:refinePlan', async (_event, request: RefinePlanRequest) => {
    return refinePlan(request)
  })
}
