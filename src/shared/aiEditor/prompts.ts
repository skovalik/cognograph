// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * AI Editor Prompt Construction & Plan Parsing
 *
 * Platform-agnostic module containing all prompt building and response parsing
 * logic for the AI Workspace Editor. Zero Electron dependencies — safe to import
 * from both the Electron main process and the web browser build.
 *
 * Extracted from src/main/aiEditor.ts (lines 231-544, 628-732).
 */

import type {
  AIEditorContext,
  MutationOp,
  PlanWarning,
} from '../types'

// =============================================================================
// buildSystemPrompt — Non-agent system prompt for plan generation
// Source: src/main/aiEditor.ts lines 231-441
// =============================================================================

export function buildSystemPrompt(mode: AIEditorContext['mode']): string {
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

// =============================================================================
// buildUserPrompt — Non-agent user message construction
// Source: src/main/aiEditor.ts lines 443-497
// =============================================================================

export function buildUserPrompt(context: AIEditorContext): string {
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

// =============================================================================
// parsePlanResponse — Parse LLM response into operations/warnings/reasoning
// Source: src/main/aiEditor.ts lines 499-544
// =============================================================================

export function parsePlanResponse(content: string): { operations: MutationOp[]; warnings: PlanWarning[]; reasoning?: string } {
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

// =============================================================================
// buildAgentSystemPrompt — Agent-mode system prompt (with query tool instructions)
// Source: src/main/aiEditor.ts lines 628-690
// =============================================================================

export function buildAgentSystemPrompt(mode: AIEditorContext['mode']): string {
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

// =============================================================================
// buildAgentUserPrompt — Agent-mode user message with full context dump
// Source: src/main/aiEditor.ts lines 706-732 (extracted from generatePlanWithAgentMode)
// =============================================================================

export function buildAgentUserPrompt(context: AIEditorContext): string {
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

  return userPrompt
}
