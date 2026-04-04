// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { v4 as uuid } from 'uuid'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useConnectorStore } from '../stores/connectorStore'
import {
  initAgentService,
  registerExternalStreamHandler,
  unregisterExternalStreamHandler,
} from './agentService'
import { getChatToolDefinitions, executeTool } from './agentTools'
import { getWorkspaceToolDefinitions, executeWorkspaceTool } from './workspaceTools'
import { layoutEvents } from '../utils/layoutEvents'
import type { AgentStreamChunk } from '../../../preload/index'
import type { NodeData } from '@shared/types'

// ── Tier 1 Pattern Definitions ──────────────────────────────────────────────

interface Tier1Pattern {
  pattern: RegExp
  action: (match: RegExpMatchArray) => { narration: string; affectedNodeIds?: string[] }
}

function getViewportCenter(): { x: number; y: number } {
  // Get center of current viewport in flow coordinates.
  // window.__cognograph_viewport is set by the onViewportChange handler in App.tsx.
  const vp = (window as any).__cognograph_viewport as { x: number; y: number; zoom: number } | undefined
  if (vp) {
    return {
      x: (-vp.x + window.innerWidth / 2) / vp.zoom + (Math.random() - 0.5) * 50,
      y: (-vp.y + window.innerHeight / 2) / vp.zoom + (Math.random() - 0.5) * 50,
    }
  }
  // Fallback when viewport global is not yet populated (e.g. on first load)
  return { x: 400 + Math.random() * 200, y: 300 + Math.random() * 200 }
}

const TIER1_PATTERNS: Tier1Pattern[] = [
  // Save
  {
    pattern: /^save$/i,
    action: () => {
      window.dispatchEvent(new Event('save-workspace'))
      return { narration: 'Workspace saved.' }
    }
  },
  // Undo / Redo
  {
    pattern: /^undo$/i,
    action: () => {
      useWorkspaceStore.getState().undo()
      return { narration: 'Undone.' }
    }
  },
  {
    pattern: /^redo$/i,
    action: () => {
      useWorkspaceStore.getState().redo()
      return { narration: 'Redone.' }
    }
  },
  // New node by type
  {
    pattern: /^(?:new|create|add)\s+(note|task|conversation|chat|project|artifact|text|action|orchestrator|workspace)$/i,
    action: (match) => {
      const raw = (match[1] ?? 'note').toLowerCase()
      // 'chat' is a user alias for 'conversation' — remap it
      const type = (raw === 'chat' ? 'conversation' : raw) as NodeData['type']
      const pos = getViewportCenter()
      const id = useWorkspaceStore.getState().addNode(type, pos)
      return { narration: `Created new ${type}.`, affectedNodeIds: [id] }
    }
  },
  // New agent
  {
    pattern: /^(?:new|create|add)\s+agent$/i,
    action: () => {
      const pos = getViewportCenter()
      const id = useWorkspaceStore.getState().addAgentNode(pos)
      return { narration: 'Created new agent.', affectedNodeIds: [id] }
    }
  },
  // Select all
  {
    pattern: /^select\s+all$/i,
    action: () => {
      const nodes = useWorkspaceStore.getState().nodes
      const ids = nodes.map(n => n.id)
      useWorkspaceStore.getState().setSelectedNodes(ids)
      return { narration: `Selected ${ids.length} nodes.`, affectedNodeIds: ids }
    }
  },
  // Deselect
  {
    pattern: /^(?:deselect|clear\s+selection)$/i,
    action: () => {
      useWorkspaceStore.getState().setSelectedNodes([])
      return { narration: 'Selection cleared.' }
    }
  },
  // Delete selected
  {
    pattern: /^(?:delete|remove)\s+(?:selected|selection)$/i,
    action: () => {
      const selected = useWorkspaceStore.getState().selectedNodeIds
      if (selected.length === 0) return { narration: 'Nothing selected.' }
      useWorkspaceStore.getState().deleteNodes(selected)
      return {
        narration: `Deleted ${selected.length} node${selected.length > 1 ? 's' : ''}.`,
        affectedNodeIds: selected
      }
    }
  },
  // Fit view
  {
    pattern: /^(?:fit|fit\s+view|zoom\s+to\s+fit|zoom\s+fit)$/i,
    action: () => {
      window.dispatchEvent(new CustomEvent('fit-view'))
      return { narration: 'Fitted view.' }
    }
  },
  // Zoom to percentage
  {
    pattern: /^zoom\s+(\d+)%?$/i,
    action: (match) => {
      const pct = match[1] ?? '100'
      const zoom = parseInt(pct) / 100
      window.dispatchEvent(new CustomEvent('set-zoom', { detail: zoom }))
      return { narration: `Zoomed to ${pct}%.` }
    }
  },
  // Toggle theme
  {
    pattern: /^(?:toggle\s+)?(?:dark|light)\s*(?:mode)?$/i,
    action: (match) => {
      const mode = match[0].toLowerCase().includes('dark') ? 'dark' : 'light'
      useWorkspaceStore.getState().setThemeMode(mode, 'manual')
      return { narration: `Switched to ${mode} mode.` }
    }
  },
  // Open settings
  {
    pattern: /^(?:open\s+)?settings$/i,
    action: () => {
      window.dispatchEvent(new Event('open-settings'))
      return { narration: 'Settings opened.' }
    }
  },
  // Help
  {
    pattern: /^(?:help|shortcuts|keyboard\s+shortcuts|\?)$/i,
    action: () => {
      window.dispatchEvent(new Event('toggle-shortcuts-help'))
      return { narration: 'Keyboard shortcuts opened.' }
    }
  },
]

// ── Command Queue ───────────────────────────────────────────────────────────

let commandQueue: Array<() => Promise<void>> = []
let isExecuting = false

async function processQueue(): Promise<void> {
  if (isExecuting || commandQueue.length === 0) return
  isExecuting = true
  const next = commandQueue.shift()!
  try {
    await next()
  } finally {
    isExecuting = false
    processQueue()
  }
}

// ── Main Entry Point ────────────────────────────────────────────────────────

export async function executeCommand(
  input: string,
  options?: { fileContext?: { filename: string; content: string } }
): Promise<void> {
  const trimmed = input.trim()
  if (!trimmed) return

  // Tier 1: instant pattern match
  for (const { pattern, action } of TIER1_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const startTime = performance.now()
      const result = action(match)
      const duration = performance.now() - startTime

      useWorkspaceStore.getState().appendCommandLog({
        id: crypto.randomUUID(),
        input: trimmed,
        tier: 1,
        status: 'done',
        narration: result.narration,
        affectedNodeIds: result.affectedNodeIds || [],
        timestamp: Date.now(),
        duration,
      })
      return
    }
  }

  // Tier 2/3: queue for LLM execution
  return new Promise((resolve) => {
    commandQueue.push(async () => {
      await executeTier2(trimmed, options)
      resolve()
    })
    processQueue()
  })
}

// ── Tier 2: LLM Workspace Command Adapter ──────────────────────────────────
// Sends user input to the LLM with workspace context and canvas tools.
// Writes to workspaceConversation (NOT node data). Tool loop follows
// the same register→stream→execute→continue pattern as chatToolService.

const TIER2_TOOL_LIMIT = 25
const TIER2_GUARDRAIL = 20

const WORKSPACE_SYSTEM_PROMPT = `You are the Cognograph workspace command interface. You execute workspace operations ONLY via tool calls.

CRITICAL: Your FIRST response MUST contain tool calls. NEVER respond with only text. NEVER say "I'll do this in stages" or explain a plan — just start calling tools immediately.

Rules:
- ALWAYS start your response with tool calls. Text-only responses are forbidden.
- Do NOT create agent nodes. Execute everything directly.
- Use batch_create for multiple related nodes — it accepts an array of node specs and creates them all at once with edges.
- You can make up to 25 tool calls per request. Use as many as needed.
- For complex requests: put ALL the content directly in node content fields. Use contentType: "html" for HTML artifacts, "markdown" for rich text. Make the content substantial and complete.
- After all tool calls are done, narrate what you created in 1-2 sentences. Reference node titles, not IDs.
- When the user says "this", "these", or "selected", check the selection context.`

/**
 * Build a context string from the current workspace state.
 * Includes selected nodes and recent nodes for LLM awareness.
 */
function buildWorkspaceContext(): string {
  const store = useWorkspaceStore.getState()
  const nodes = store.nodes
  const edges = store.edges
  const selected = store.selectedNodeIds

  let context = `# Workspace State\n\n`
  context += `Total nodes: ${nodes.length}\n`
  context += `Total edges: ${edges.length}\n`

  if (selected.length > 0) {
    context += `\n## Selected Nodes (${selected.length})\n`
    for (const id of selected) {
      const node = nodes.find(n => n.id === id)
      if (node) {
        const nd = node.data as any
        context += `\n### [${nd.type}] "${nd.title || 'Untitled'}" (id: ${id})\n`
        if (nd.description) context += `Description: ${nd.description}\n`
        if (nd.content) {
          // Include content (truncate to 2000 chars per node to keep context manageable)
          const content = nd.content.length > 2000 ? nd.content.slice(0, 2000) + '\n...(truncated)' : nd.content
          context += `Content:\n${content}\n`
        }
      }
    }
  }

  // Recent nodes (last 20) for broader context
  const sortedNodes = [...nodes]
    .sort((a, b) => ((b.data as any).updatedAt || 0) - ((a.data as any).updatedAt || 0))
    .slice(0, 20)

  context += `\n## Recent Nodes (${Math.min(nodes.length, 20)} of ${nodes.length})\n`
  for (const node of sortedNodes) {
    context += `- [${node.data.type}] "${node.data.title || 'Untitled'}" (id: ${node.id})\n`
  }

  return context
}

/**
 * Build Anthropic API-formatted messages from workspace conversation.
 *
 * Workspace messages store tool_use/tool_result metadata as JSON in content
 * (since addWorkspaceMessage only accepts role + content). This function
 * reconstructs proper Anthropic content blocks.
 */
function buildWorkspaceMessagesForAPI(): Array<{ role: string; content: unknown }> {
  const { messages } = useWorkspaceStore.getState().workspaceConversation
  const apiMessages: Array<{ role: string; content: unknown }> = []

  let i = 0
  while (i < messages.length) {
    const msg = messages[i]!

    // Skip empty assistant placeholders
    if (msg.role === 'assistant' && !msg.content.trim()) {
      i++
      continue
    }

    if (msg.role === 'user') {
      apiMessages.push({ role: 'user', content: msg.content })
      i++
    } else if (msg.role === 'assistant') {
      // Check if the next message is a tool_use — consolidate into single assistant message
      const nextMsg = messages[i + 1]
      if (nextMsg && nextMsg.role === 'tool_use') {
        const contentBlocks: unknown[] = []
        if (msg.content.trim()) {
          contentBlocks.push({ type: 'text', text: msg.content })
        }
        // Parse tool metadata from JSON content
        try {
          const parsed = JSON.parse(nextMsg.content)
          contentBlocks.push({
            type: 'tool_use',
            id: parsed.toolUseId,
            name: parsed.toolName,
            input: parsed.toolInput
          })
        } catch { /* skip malformed */ }
        apiMessages.push({ role: 'assistant', content: contentBlocks })
        i += 2
      } else {
        apiMessages.push({ role: 'assistant', content: msg.content })
        i++
      }
    } else if (msg.role === 'tool_use') {
      // Standalone tool_use (no preceding assistant text)
      try {
        const parsed = JSON.parse(msg.content)
        apiMessages.push({
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: parsed.toolUseId,
            name: parsed.toolName,
            input: parsed.toolInput
          }]
        })
      } catch { /* skip malformed */ }
      i++
    } else if (msg.role === 'tool_result') {
      // Find the corresponding tool_use to get the tool_use_id
      let toolUseId = 'unknown'
      for (let j = i - 1; j >= 0; j--) {
        const prev = messages[j]
        if (prev && prev.role === 'tool_use') {
          try {
            const parsed = JSON.parse(prev.content)
            toolUseId = parsed.toolUseId
          } catch { /* ignore */ }
          break
        }
      }
      apiMessages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content: msg.content }]
      })
      i++
    } else {
      i++
    }
  }

  return apiMessages
}

async function executeTier2(input: string, options?: { fileContext?: { filename: string; content: string } }): Promise<void> {
  const store = useWorkspaceStore.getState()
  const entryId = uuid()
  const startTime = Date.now()

  // Ensure agentService stream listener is registered
  initAgentService()

  // 1. Log as running
  store.appendCommandLog({
    id: entryId,
    input,
    tier: 2,
    status: 'running',
    narration: '',
    affectedNodeIds: [],
    timestamp: startTime,
  })

  // 2. Build initial context
  let context = buildWorkspaceContext()

  if (options?.fileContext) {
    context += `\n\n## Attached File: ${options.fileContext.filename}\n\`\`\`\n${options.fileContext.content}\n\`\`\``
  }

  // 3. Add user message to workspace conversation
  store.addWorkspaceMessage('user', input)

  // 4. Get tool definitions — standard canvas tools + workspace tools
  const isWeb = !(window as any).__ELECTRON__
  const tools = isWeb
    ? getChatToolDefinitions()
    : [...getChatToolDefinitions(), ...getWorkspaceToolDefinitions()]

  // 5. Tool loop — mirrors chatToolService pattern
  let toolCallCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let accumulatedText = ''
  let requestId = uuid()
  const createdNodeIds: string[] = []
  const createdEdgeIds: string[] = []

  try {
    while (toolCallCount < TIER2_TOOL_LIMIT) {
      // Check if cancelled by user via response panel
      const currentEntry = useWorkspaceStore.getState().commandLog.find(e => e.id === entryId)
      if (currentEntry?.status === 'cancelled') break

      accumulatedText = ''
      // Collect ALL tool calls from this turn (LLM can send multiple)
      const pendingToolCalls: { id: string; name: string; inputJson: string }[] = []
      let activeToolCall: { id: string; name: string; inputJson: string } | null = null

      // Add empty assistant placeholder for this iteration
      store.addWorkspaceMessage('assistant', '')

      // Stream one LLM iteration
      const { stopReason, usage } = await new Promise<{
        stopReason: string
        usage?: { input_tokens: number; output_tokens: number }
      }>((resolve) => {
        registerExternalStreamHandler(requestId, {
          onChunk(chunk: AgentStreamChunk) {
            if (chunk.type === 'text_delta') {
              accumulatedText += chunk.content
              // Live-update the narration in the command log
              store.updateCommandLogEntry(entryId, { narration: accumulatedText })
            } else if (chunk.type === 'tool_use_start') {
              // Finalize previous tool call if any
              if (activeToolCall) pendingToolCalls.push(activeToolCall)
              activeToolCall = { id: chunk.toolUseId, name: chunk.toolName, inputJson: '' }
              // Show progress in command log so user knows it's working
              store.updateCommandLogEntry(entryId, { narration: `Creating ${chunk.toolName === 'batch_create' ? 'nodes' : chunk.toolName}...` })
            } else if (chunk.type === 'tool_use_delta' && activeToolCall) {
              activeToolCall.inputJson += chunk.toolInput
              // Update progress with content size hint
              if (activeToolCall.inputJson.length % 2000 < 100) {
                store.updateCommandLogEntry(entryId, { narration: `Generating content... (${Math.round(activeToolCall.inputJson.length / 1000)}k chars)` })
              }
            } else if (chunk.type === 'tool_use_end') {
              // Finalize current tool call
              if (activeToolCall) {
                pendingToolCalls.push(activeToolCall)
                activeToolCall = null
              }
            } else if (chunk.type === 'done') {
              // Catch any tool call not yet finalized (no tool_use_end before done)
              if (activeToolCall) {
                pendingToolCalls.push(activeToolCall)
                activeToolCall = null
              }
              resolve({ stopReason: chunk.stopReason, usage: chunk.usage })
            } else if (chunk.type === 'error') {
              accumulatedText = chunk.error || 'An error occurred processing the command.'
              store.updateCommandLogEntry(entryId, { narration: accumulatedText })
              resolve({ stopReason: 'error' })
            }
          }
        })

        // Build messages from workspace conversation
        const messages = buildWorkspaceMessagesForAPI()

        // Send via IPC
        window.api.agent.sendWithTools({
          requestId,
          conversationId: 'workspace-command-conversation',
          messages,
          context,
          tools,
          model: useConnectorStore.getState().getDefaultConnector()?.model || 'claude-sonnet-4-6',
          systemPromptPrefix: WORKSPACE_SYSTEM_PROMPT,
          clientManagesToolLoop: true,
          maxTokens: 16384,
        })
      })

      // Unregister this iteration's handler
      unregisterExternalStreamHandler(requestId)

      // Accumulate tokens
      if (usage) {
        totalInputTokens += usage.input_tokens
        totalOutputTokens += usage.output_tokens
      }

      // Error handling
      if (stopReason === 'error' || stopReason === 'timeout') {
        if (!accumulatedText) accumulatedText = 'An error occurred processing the command.'
        break
      }

      // Tool use handling — execute ALL tool calls from this turn
      if (stopReason === 'tool_use' && pendingToolCalls.length > 0) {
        for (const toolCall of pendingToolCalls) {
          toolCallCount++

          // Guardrail
          if (toolCallCount > TIER2_GUARDRAIL) {
            accumulatedText += '\n\n[Reached complexity limit. Consider creating an agent for this task.]'
            break
          }

          // Parse tool input
          let toolInput: Record<string, unknown>
          try { toolInput = JSON.parse(toolCall.inputJson) }
          catch { toolInput = {} }

          // Store tool_use as JSON in content (workspace conversation format)
          store.addWorkspaceMessage('tool_use', JSON.stringify({
            toolName: toolCall.name,
            toolInput,
            toolUseId: toolCall.id,
          }))

          // Execute tool — check workspace tools first, then standard canvas tools
          const WORKSPACE_TOOL_NAMES = ['create_agent', 'create_action', 'create_region', 'execute_plan']
          const isWorkspaceTool = WORKSPACE_TOOL_NAMES.includes(toolCall.name)
          const result = isWorkspaceTool
            ? await executeWorkspaceTool(toolCall.name, toolInput)
            : await executeTool(toolCall.name, toolInput, 'workspace-command-conversation')

          // Store tool_result
          store.addWorkspaceMessage('tool_result',
            result.success ? JSON.stringify(result.result, null, 2) : `Error: ${result.error}`
          )

          // Track created nodes/edges for layout pipeline
          if (result.success && toolCall.name === 'create_node' && result.result?.nodeId) {
            createdNodeIds.push(result.result.nodeId as string)
          }
          if (result.success && toolCall.name === 'link_nodes' && result.result?.edgeId) {
            createdEdgeIds.push(result.result.edgeId as string)
          }
          if (result.success && toolCall.name === 'batch_create' && result.result?.nodeMap) {
            createdNodeIds.push(...Object.values(result.result.nodeMap as Record<string, string>))
          }
        }

        // Check if guardrail was hit
        if (toolCallCount > TIER2_GUARDRAIL) break

        // Refresh context after mutating tool calls
        context = buildWorkspaceContext()

        // Prepare for continuation
        requestId = uuid()
        continue
      }

      // Auto-continue: if LLM narrated mid-task instead of calling tools,
      // inject a "Continue." message so it picks back up with tool calls.
      // Only do this if we've already made at least one tool call (work in progress)
      // and the text suggests more work is coming.
      if (stopReason === 'end_turn' && toolCallCount > 0 && toolCallCount < TIER2_GUARDRAIL) {
        const lowerText = accumulatedText.toLowerCase()
        const continuePatterns = ['let me', "i'll", 'now i', 'next', 'moving on', 'continue', 'creating', 'will create']
        const shouldContinue = continuePatterns.some(p => lowerText.includes(p))
        if (shouldContinue) {
          store.addWorkspaceMessage('user', 'Continue. Execute the remaining operations via tool calls immediately.')
          requestId = uuid()
          continue
        }
      }

      // end_turn, stop_sequence, max_tokens — we're done
      break
    }
  } catch (error) {
    accumulatedText = `Error: ${(error as Error).message}`
  }

  // 6. Update command log entry with final results
  store.updateCommandLogEntry(entryId, {
    status: 'done',
    narration: accumulatedText || 'Done.',
    affectedNodeIds: createdNodeIds,
    affectedEdgeIds: createdEdgeIds,
    duration: Date.now() - startTime,
    tokenUsage: totalInputTokens > 0
      ? { input: totalInputTokens, output: totalOutputTokens, cost: 0 }
      : undefined,
  })

  // 7. Layout pipeline for created nodes — dispatch via layoutEvents
  //    chatToolService already listens for 'run-layout' events and handles
  //    auto-fit, topology detection, collision avoidance, and camera focus.
  if (createdNodeIds.length > 0) {
    layoutEvents.dispatchEvent(new CustomEvent('run-layout', {
      detail: {
        nodeIds: createdNodeIds,
        edgeIds: createdEdgeIds,
        conversationId: undefined // No source conversation node
      }
    }))
  } else if (toolCallCount === 0) {
    // Pure narration, no tools called — just a text response.
    // No layout needed.
  }
}
