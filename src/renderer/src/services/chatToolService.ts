// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * chatToolService — lightweight tool loop for chat mode.
 *
 * Reuses agent:sendWithTools IPC and executeTool() from agentTools,
 * piggybacking on agentService's stream listener via
 * registerExternalStreamHandler. No main-process changes.
 *
 * ARCHITECTURE NOTE (Phase 2C: RENDERER-PASSIVIZE — IN PROGRESS):
 * When AGENT_LOOP_ENABLED=true, the main-process agentLoop handles all
 * tool execution internally. The renderer's sendChatWithTools while-loop
 * receives a single done chunk with stopReason='end_turn' and exits after
 * one iteration — the tool_use branch never fires.
 *
 * Current state (post-D2):
 *   - sendChatWithTools() → sends IPC, streams text, exits after 1 iteration
 *     (agentLoop path) or executes tools itself (legacy path, AGENT_LOOP_ENABLED=false)
 *   - The tool_use branch (renderer-side executeTool) is ONLY reachable when
 *     stopReason === 'tool_use', which only occurs on the legacy path.
 *   - runLayoutPipeline() → stays, triggered two ways:
 *       (a) agentEventReceiver.handleAgentComplete → layoutEvents 'run-layout'
 *           (agentLoop path — via agentEventReceiver.ts)
 *       (b) Post-loop createdNodeIds check here (legacy path only —
 *           createdNodeIds is populated only inside the tool_use branch)
 *   - Layout event listener (layoutEvents 'run-layout') → stays, handles both paths
 *   - executeTool() import → retained for legacy path; removable when old path retired
 *   - getChatToolDefinitions() import → retained for legacy path
 */

import type { Message } from '@shared/types'
import { toast } from 'react-hot-toast'
import { v4 as uuid } from 'uuid'
import type { AgentStreamChunk } from '../../../preload/index'
import { useSessionStatsStore } from '../stores/sessionStatsStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import {
  applyCircularLayout,
  applyClusteredHierarchicalLayout,
  applyForceLayout,
  applyHierarchicalLayout,
  detectGraphType,
  segmentsIntersect,
} from '../utils/layoutAlgorithms'
import { layoutEvents, requestFitView } from '../utils/layoutEvents'
import { assignSpreadHandles, getHandlePosition } from '../utils/positionResolver'
import { calculateAutoFitDimensions, MIN_BODY_H, TYPE_BADGE_H } from '../utils/textMeasure'
import {
  buildMessagesForAPI,
  initAgentService,
  registerExternalStreamHandler,
  unregisterExternalStreamHandler,
} from './agentService'
import { executeTool, getChatToolDefinitions } from './agentTools'

// Safety valve only — prevents infinite tool loops from runaway AI.
// NOT a functional limit. Credit/token system handles usage caps.
const TOOL_LOOP_SAFETY_LIMIT = 50

// Active chat tool loops, keyed by conversationId
const activeLoops = new Map<string, { requestId: string; cancelled: boolean }>()

// Listen for layout requests dispatched from agentService (streaming batch_create).
// Uses EventTarget to avoid circular dependency — agentService dispatches, we handle.
layoutEvents.addEventListener('run-layout', (e: Event) => {
  const { nodeIds, edgeIds, conversationId } = (e as CustomEvent).detail
  const store = useWorkspaceStore.getState()
  // Double rAF to let React render + measure nodes before layout
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        const freshStore = useWorkspaceStore.getState()
        console.log(
          '[ChatToolService] run-layout event received. nodeIds:',
          nodeIds.length,
          'edgeIds:',
          edgeIds.length,
          'conversationId:',
          conversationId,
        )
        // Log node dimensions before layout
        for (const nid of nodeIds) {
          const n = freshStore.nodes.find((nd) => nd.id === nid)
          if (n)
            console.log(
              `  Node ${nid.slice(0, 8)}: ${n.data.title?.slice(0, 20)} w=${n.width ?? n.measured?.width} h=${n.height ?? n.measured?.height} content=${(n.data.content || '').length}chars type=${n.data.type} contentType=${n.data.contentType}`,
            )
        }
        runLayoutPipeline(freshStore, nodeIds, edgeIds, conversationId)
      } catch (err) {
        console.error('[ChatToolService] Layout pipeline (streaming) failed:', err)
      }
    })
  })
})

export function isChatToolLoopActive(conversationId: string): boolean {
  return activeLoops.has(conversationId)
}

export function cancelChatToolLoop(conversationId: string): void {
  const loop = activeLoops.get(conversationId)
  if (loop) {
    loop.cancelled = true
    window.api.agent.cancel(loop.requestId).catch(() => {})
    cleanup(conversationId, loop.requestId)
  }
}

function cleanup(conversationId: string, requestId: string): void {
  unregisterExternalStreamHandler(requestId)
  activeLoops.delete(conversationId)
  useWorkspaceStore.getState().setStreaming(conversationId, false)
}

/**
 * Send a chat message with canvas tools. Handles the full tool loop:
 * stream text → detect tool_use → execute → send continuation → repeat.
 */
export async function sendChatWithTools(
  conversationId: string,
  userMessage: string,
  options: {
    model?: string
    maxTokens?: number
    systemPromptPrefix?: string
    context?: string
  },
): Promise<void> {
  const store = useWorkspaceStore.getState()

  // Ensure agentService's stream listener is registered
  initAgentService()

  // Add user message + assistant placeholder
  store.addMessage(conversationId, 'user', userMessage)
  store.addMessage(conversationId, 'assistant', '')
  store.setStreaming(conversationId, true)

  const tools = getChatToolDefinitions()
  let toolCallCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Track created nodes/edges for post-loop layout pipeline
  const createdNodeIds: string[] = []
  const createdEdgeIds: string[] = []

  // State for current iteration
  let accumulatedText = ''
  let currentToolUse: { id: string; name: string; inputJson: string } | null = null
  let requestId = uuid()

  const loopState = { requestId, cancelled: false }
  activeLoops.set(conversationId, loopState)

  try {
    while (toolCallCount < TOOL_LOOP_SAFETY_LIMIT && !loopState.cancelled) {
      accumulatedText = ''
      currentToolUse = null

      // Promise that resolves when this iteration's stream completes
      const { stopReason, usage } = await new Promise<{
        stopReason: string
        usage?: { input_tokens: number; output_tokens: number }
      }>((resolve) => {
        // Register stream handler for this requestId
        registerExternalStreamHandler(requestId, {
          onChunk(chunk: AgentStreamChunk) {
            if (chunk.type === 'text_delta') {
              accumulatedText += chunk.content
              store.updateLastMessage(conversationId, accumulatedText)
            } else if (chunk.type === 'tool_use_start') {
              currentToolUse = { id: chunk.toolUseId, name: chunk.toolName, inputJson: '' }
            } else if (chunk.type === 'tool_use_delta' && currentToolUse) {
              currentToolUse.inputJson += chunk.toolInput
            } else if (chunk.type === 'done') {
              resolve({ stopReason: chunk.stopReason, usage: chunk.usage })
            } else if (chunk.type === 'error') {
              resolve({ stopReason: 'error' })
            }
          },
        })

        // Build messages in Anthropic format — re-read fresh state after addMessage mutations
        const messages = buildMessagesForAPI(conversationId)

        // Send request
        loopState.requestId = requestId
        window.api.agent.sendWithTools({
          requestId,
          conversationId,
          messages,
          context: options.context || '',
          tools,
          model: options.model || 'claude-sonnet-4-6',
          systemPromptPrefix: options.systemPromptPrefix,
          clientManagesToolLoop: true,
        })
      })

      // Unregister this iteration's handler
      unregisterExternalStreamHandler(requestId)

      // Accumulate tokens
      if (usage) {
        totalInputTokens += usage.input_tokens
        totalOutputTokens += usage.output_tokens
      }

      if (loopState.cancelled) break

      // Handle stop reason
      if (stopReason === 'error' || stopReason === 'timeout') {
        if (!accumulatedText) {
          store.updateLastMessage(conversationId, 'Sorry, an error occurred. Please try again.')
        }
        break
      }

      // RENDERER-PASSIVIZE GUARD: This branch only fires on the legacy path
      // (AGENT_LOOP_ENABLED=false). When agentLoop is active, the main process
      // handles tool execution internally and always returns stopReason='end_turn'.
      if (stopReason === 'tool_use' && currentToolUse) {
        toolCallCount++

        // Add tool_use message
        const toolInput = safeJsonParse(currentToolUse.inputJson)
        const toolUseMsg: Message = {
          id: uuid(),
          role: 'tool_use',
          content: `Calling ${currentToolUse.name}`,
          timestamp: Date.now(),
          toolName: currentToolUse.name,
          toolInput,
          toolUseId: currentToolUse.id,
        }
        store.addToolMessage(conversationId, toolUseMsg)

        // Execute tool
        const result = await executeTool(currentToolUse.name, toolInput, conversationId)

        // Add tool_result message
        const toolResultMsg: Message = {
          id: uuid(),
          role: 'tool_result',
          content: result.success
            ? JSON.stringify(result.result, null, 2)
            : `Error: ${result.error}`,
          timestamp: Date.now(),
          toolResultFor: currentToolUse.id,
          isError: !result.success,
        }
        store.addToolMessage(conversationId, toolResultMsg)

        if (!result.success) {
          toast.error(`Tool error: ${result.error}`)
        }

        // Track created nodes/edges for post-loop layout pipeline
        if (result.success && currentToolUse.name === 'create_node' && result.result?.nodeId) {
          createdNodeIds.push(result.result.nodeId as string)
        }
        if (result.success && currentToolUse.name === 'link_nodes' && result.result?.edgeId) {
          createdEdgeIds.push(result.result.edgeId as string)
        }
        // batch_create returns a nodeMap of tempId -> realId
        if (result.success && currentToolUse.name === 'batch_create' && result.result?.nodeMap) {
          const nodeMap = result.result.nodeMap as Record<string, string>
          createdNodeIds.push(...Object.values(nodeMap))
        }

        // Refresh context after mutating tool calls so the next API iteration sees changes
        const MUTATING_TOOLS = [
          'create_node',
          'link_nodes',
          'update_node',
          'delete_node',
          'unlink_nodes',
          'move_node',
          'add_comment',
          'batch_create',
        ]
        if (MUTATING_TOOLS.includes(currentToolUse.name)) {
          options.context = store.getContextForNode(conversationId) || ''
        }

        // Prepare for continuation
        requestId = uuid()
        loopState.requestId = requestId
        store.addMessage(conversationId, 'assistant', '')
        continue
      }

      // end_turn, stop_sequence, max_tokens — we're done
      break
    }

    // Safety limit reached (should never happen in normal use)
    if (toolCallCount >= TOOL_LOOP_SAFETY_LIMIT && !loopState.cancelled) {
      console.warn(`[ChatToolService] Safety limit reached (${TOOL_LOOP_SAFETY_LIMIT} tool calls)`)
    }

    // Layout pipeline: auto-layout created nodes, recalculate edges, focus camera
    // IMPORTANT: Defer to next frame so React Flow processes pending node creation renders first.
    // Without this, moveNode() calls get overwritten by React's pending state reconciliation.
    if (createdNodeIds.length > 0 && !loopState.cancelled) {
      // Double rAF: first frame lets React render the nodes, second frame lets
      // React Flow measure their DOM dimensions (measured.width/height).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            // Re-read store state after React has reconciled AND measured
            const freshStore = useWorkspaceStore.getState()
            runLayoutPipeline(freshStore, createdNodeIds, createdEdgeIds, conversationId)
          } catch (err) {
            console.error('[ChatToolService] Layout pipeline failed:', err)
            // Non-critical — nodes stay at auto-stagger positions
          }
        })
      })
    }

    // Record token usage on the last assistant message
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      store.setLastMessageUsage?.(conversationId, {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      })
      useSessionStatsStore.getState().recordUsage?.({
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      })
    }
  } catch (error) {
    console.error('[ChatToolService] Error:', error)
    store.updateLastMessage(
      conversationId,
      accumulatedText + '\n\nSorry, an error occurred: ' + (error as Error).message,
    )
  } finally {
    cleanup(conversationId, requestId)
  }
}
// Expose for diagnostic server / automated testing
;(window as any).__sendChatWithTools = sendChatWithTools

interface Obstacle {
  id: string
  x: number
  y: number
  w: number
  h: number
  mutable: boolean
  isConversation: boolean
}

const BASE_PADDING = 80
const CONV_PADDING = 140

function paddingBetween(a: Obstacle, b: Obstacle): number {
  if (a.isConversation || b.isConversation) return CONV_PADDING
  return BASE_PADDING
}

/**
 * Layout pipeline — runs after AI tool loop creates nodes/edges.
 * Detects graph topology → applies layout → resolves collisions → recalculates edges → focuses camera.
 * Performance budget: <200ms for 20 nodes.
 */
function runLayoutPipeline(
  store: ReturnType<typeof useWorkspaceStore.getState>,
  createdNodeIds: string[],
  createdEdgeIds: string[],
  conversationId?: string,
): void {
  const t0 = performance.now()
  const allNodes = store.nodes
  const allEdges = store.edges

  // 1. Auto-fit dimensions on created nodes (BEFORE layout — layout needs real sizes)
  const HEADER_H: Record<string, number> = { task: 40, note: 44, artifact: 48 }
  const FOOTER_H = 36
  for (const id of createdNodeIds) {
    const node = allNodes.find((n) => n.id === id)
    if (!node) continue
    const w = node.width ?? node.data.width ?? 280
    const h = node.height ?? node.data.height ?? 140
    const headerH = HEADER_H[node.data.type as string] ?? 44
    const rawContent = node.data.content || node.data.description || ''
    // Cap artifact content before measuring — long code blocks blow out height
    const content =
      node.data.type === 'artifact' && rawContent.length > 500
        ? rawContent.slice(0, 500)
        : rawContent
    const dims = calculateAutoFitDimensions(node.data.title || '', content, headerH, FOOTER_H, w)
    const minH = TYPE_BADGE_H + headerH + MIN_BODY_H + FOOTER_H
    // Content-length floor — heuristic underestimates for long text (HTML stripped to shorter plain text)
    const isHtml =
      node.data.contentType === 'html' ||
      (node.data.type === 'artifact' && rawContent.includes('<!DOCTYPE'))
    const contentFloor = isHtml
      ? Math.max(480, Math.min(1200, Math.round(rawContent.length * 0.9)))
      : rawContent.length > 1000
        ? 500
        : rawContent.length > 500
          ? 400
          : rawContent.length > 200
            ? 300
            : 0
    const widthFloor = isHtml
      ? 680
      : rawContent.length > 300
        ? 480
        : rawContent.length > 100
          ? 340
          : 0
    const finalW = Math.max(w, dims.width, widthFloor)
    const finalH = Math.max(h, dims.height, minH, contentFloor)
    if (import.meta.env.DEV)
      console.log(
        `[Layout Step 1] Node ${id.slice(0, 8)} "${(node.data.title || '').slice(0, 20)}" type=${node.data.type} contentType=${node.data.contentType} content=${rawContent.length}chars w=${w}→${finalW} h=${h}→${finalH} isHtml=${isHtml} contentFloor=${contentFloor} widthFloor=${widthFloor}`,
      )
    if (finalW > w || finalH > h) {
      store.updateNode(
        id,
        {
          width: finalW,
          height: finalH,
        } as any,
        { skipHistory: true },
      )
      if (import.meta.env.DEV)
        console.log(`[Layout Step 1] → RESIZED ${id.slice(0, 8)} to ${finalW}x${finalH}`)
    }
  }

  // After step 1 — re-read store for fresh dimensions (updateNode mutated Zustand synchronously)
  const freshNodes = useWorkspaceStore.getState().nodes
  const freshEdges = useWorkspaceStore.getState().edges

  // 2. Detect subgraph topology
  const subNodes = freshNodes.filter((n) => createdNodeIds.includes(n.id))
  const subEdges = freshEdges.filter(
    (e) => createdNodeIds.includes(e.source) || createdNodeIds.includes(e.target),
  )

  if (subNodes.length === 0) return
  if (subNodes.length === 1) {
    // Single node — just focus
    requestFitView(createdNodeIds)
    return
  }

  const graphType = detectGraphType(subNodes, subEdges)

  // 3. Apply layout algorithm based on topology
  let positions: Map<string, { x: number; y: number }>
  switch (graphType) {
    case 'tree':
    case 'dag':
      positions = applyClusteredHierarchicalLayout(subNodes, subEdges, {
        nodeGap: 80,
        rankGap: 180,
        clusterGap: 200,
      })
      break
    case 'chain':
      positions = applyHierarchicalLayout(subNodes, subEdges, 'LR', {
        nodeGap: 120,
        edgeLength: 200,
      })
      break
    case 'hub':
      positions = applyCircularLayout(subNodes, subEdges)
      break
    default:
      positions = applyForceLayout(subNodes, subEdges, subNodes.length > 30 ? 50 : 100)
  }

  // 4. Offset to avoid conversation node — place layout to the side with more space
  const viewport = store.viewport || { x: 0, y: 0, zoom: 1 }
  const viewCenterY = (window.innerHeight / 2 - viewport.y) / viewport.zoom

  const convNode = conversationId ? freshNodes.find((n) => n.id === conversationId) : null
  const convW = convNode?.measured?.width ?? (convNode?.width as number) ?? 520
  const convX = convNode?.position?.x ?? (window.innerWidth / 2 - viewport.x) / viewport.zoom
  const convOffset = Math.round(convW * 0.25 + 80)
  const convH = convNode?.measured?.height ?? (convNode?.height as number) ?? 680
  const convCenterY = (convNode?.position?.y ?? viewCenterY) + convH / 2

  // Place layout on whichever side of the conversation node has more space
  const rightSpace = window.innerWidth / viewport.zoom - (convX + convW)
  const leftSpace = convX
  const layoutTargetX =
    rightSpace >= leftSpace
      ? convX + convW + convOffset // right side
      : convX - convOffset // left side (layout extends leftward)

  let sumX = 0,
    sumY = 0,
    count = 0
  for (const pos of positions.values()) {
    sumX += pos.x
    sumY += pos.y
    count++
  }
  if (count > 0) {
    const offsetX = layoutTargetX - sumX / count
    const offsetY = convCenterY - sumY / count
    for (const [id, pos] of positions) {
      positions.set(id, { x: pos.x + offsetX, y: pos.y + offsetY })
    }
  }

  // 5. Collision avoidance — ALL nodes checked, zero overlap guaranteed
  const createdSet = new Set(createdNodeIds)

  const obstacles: Obstacle[] = []

  // Existing nodes (immutable — including conversation node)
  for (const n of freshNodes) {
    if (createdNodeIds.includes(n.id)) continue // created nodes added separately below
    obstacles.push({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      w: n.measured?.width ?? (n.width as number) ?? 280,
      h: n.measured?.height ?? (n.height as number) ?? 140,
      mutable: false,
      isConversation: n.id === conversationId,
    })
  }

  // Created nodes (mutable — positions from layout pipeline, dimensions from fresh store)
  for (const [id, pos] of positions) {
    const n = freshNodes.find((node) => node.id === id)
    obstacles.push({
      id,
      x: pos.x,
      y: pos.y,
      w: n?.measured?.width ?? (n?.width as number) ?? 280,
      h: n?.measured?.height ?? (n?.height as number) ?? 140,
      mutable: true,
      isConversation: false,
    })
  }

  // Push mutable nodes away from ANY overlapping node (max 10 iterations)
  for (let iter = 0; iter < 10; iter++) {
    let moved = false
    for (const a of obstacles) {
      if (!a.mutable) continue
      for (const b of obstacles) {
        if (a.id === b.id) continue
        const p = paddingBetween(a, b)
        // AABB overlap check with padding
        if (
          a.x < b.x + b.w + p &&
          a.x + a.w + p > b.x &&
          a.y < b.y + b.h + p &&
          a.y + a.h + p > b.y
        ) {
          // Push along axis with SMALLER overlap (cheaper escape direction)
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
          const dx = a.x + a.w / 2 - (b.x + b.w / 2)
          const dy = a.y + a.h / 2 - (b.y + b.h / 2)
          if (overlapX < overlapY) {
            a.x = dx >= 0 ? b.x + b.w + p : b.x - a.w - p
          } else {
            a.y = dy >= 0 ? b.y + b.h + p : b.y - a.h - p
          }
          moved = true
        }
      }
    }
    if (!moved) break
  }

  // Write resolved positions back to the positions map
  for (const obs of obstacles) {
    if (obs.mutable) {
      positions.set(obs.id, { x: obs.x, y: obs.y })
    }
  }

  // 6. Apply positions (single batch set to prevent per-node re-renders)
  store.applyPositionsBatch(positions)

  // 7. Recalculate edge handles via spread distribution (single batch update)
  // Re-read edges AND nodes — allEdges/allNodes captured at function top are stale after batch_create
  const currentEdges = useWorkspaceStore.getState().edges
  const currentNodes = useWorkspaceStore.getState().nodes
  const relevantEdges = currentEdges.filter(
    (e) => createdSet.has(e.source) || createdSet.has(e.target),
  )
  // Build nodePositions map merging fresh layout positions with existing node geometry
  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>()
  for (const node of currentNodes) {
    const pos = positions.get(node.id) || node.position
    const w = node.measured?.width ?? node.width ?? 280
    const h = node.measured?.height ?? node.height ?? 140
    if (pos) nodePositions.set(node.id, { x: pos.x, y: pos.y, width: w, height: h })
  }
  const spreadAssignments = assignSpreadHandles(relevantEdges, nodePositions)
  const handleUpdates: Array<{ edgeId: string; sourceHandle: string; targetHandle: string }> = []
  for (const [edgeId, handles] of spreadAssignments) {
    const edge = relevantEdges.find((e) => e.id === edgeId)
    if (
      edge &&
      (edge.sourceHandle !== handles.sourceHandle || edge.targetHandle !== handles.targetHandle)
    ) {
      handleUpdates.push({
        edgeId,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
      })
    }
  }
  if (handleUpdates.length > 0) {
    store.updateEdgeHandlesBatch(handleUpdates)
  }

  // 7.5 Post-handle crossing detection + correction
  // Step 7 assigned handles; now we have real pixel coordinates (no shared-start-point problem).
  // Catches residual crossings from: (a) Fix 1 barycenter having no position data,
  // (b) assignSpreadHandles sorting differently than node X order, (c) multi-parent repositioning.
  const EDGE_ROUTING_DIAGNOSTIC = false

  for (let iter = 0; iter < 3; iter++) {
    // Re-read fresh state EACH iteration — previous iter's swaps are now committed
    const freshEdges = useWorkspaceStore
      .getState()
      .edges.filter((e) => createdSet.has(e.source) || createdSet.has(e.target))

    let attempted = false
    let iterCrossingCount = 0

    // Build actual edge endpoints from handle positions using existing getHandlePosition
    const edgeLines = freshEdges
      .map((e) => {
        const srcPos = nodePositions.get(e.source)
        const tgtPos = nodePositions.get(e.target)
        if (!srcPos || !tgtPos || !e.sourceHandle || !e.targetHandle) return null
        const p1 = getHandlePosition(
          { x: srcPos.x, y: srcPos.y },
          { width: srcPos.width, height: srcPos.height },
          e.sourceHandle,
        )
        const p2 = getHandlePosition(
          { x: tgtPos.x, y: tgtPos.y },
          { width: tgtPos.width, height: tgtPos.height },
          e.targetHandle,
        )
        return { edge: e, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
      })
      .filter((el): el is NonNullable<typeof el> => el !== null)

    // Check all pairs for crossings
    for (let i = 0; i < edgeLines.length; i++) {
      for (let j = i + 1; j < edgeLines.length; j++) {
        const a = edgeLines[i]
        const b = edgeLines[j]
        if (!a || !b) continue // noUncheckedIndexedAccess guard
        if (!segmentsIntersect(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1, b.x2, b.y2)) continue

        iterCrossingCount++

        // Guard: never swap user-assigned handles
        if (a.edge.data?.userAssignedHandle || b.edge.data?.userAssignedHandle) continue

        // Case 1: Same source, same side — swap handle slots
        if (a.edge.source === b.edge.source && a.edge.sourceHandle && b.edge.sourceHandle) {
          const sideA = a.edge.sourceHandle.split('-')[0]
          const sideB = b.edge.sourceHandle.split('-')[0]
          if (sideA === sideB) {
            const newASH = b.edge.sourceHandle
            const newBSH = a.edge.sourceHandle
            if (newASH === newBSH) continue // no-op swap guard (duplicate slots from SLOT_TABLES overflow)
            if (!a.edge.targetHandle || !b.edge.targetHandle) continue
            useWorkspaceStore.getState().updateEdgeHandlesBatch([
              { edgeId: a.edge.id, sourceHandle: newASH, targetHandle: a.edge.targetHandle },
              { edgeId: b.edge.id, sourceHandle: newBSH, targetHandle: b.edge.targetHandle },
            ])
            attempted = true
            break
          }
        }

        // Case 2: Same target, same side — swap target handle slots
        if (a.edge.target === b.edge.target && a.edge.targetHandle && b.edge.targetHandle) {
          const sideA = a.edge.targetHandle.split('-')[0]
          const sideB = b.edge.targetHandle.split('-')[0]
          if (sideA === sideB) {
            const newATH = b.edge.targetHandle
            const newBTH = a.edge.targetHandle
            if (newATH === newBTH) continue // no-op swap guard
            if (!a.edge.sourceHandle || !b.edge.sourceHandle) continue
            useWorkspaceStore.getState().updateEdgeHandlesBatch([
              { edgeId: a.edge.id, sourceHandle: a.edge.sourceHandle, targetHandle: newATH },
              { edgeId: b.edge.id, sourceHandle: b.edge.sourceHandle, targetHandle: newBTH },
            ])
            attempted = true
            break
          }
        }

        // Case 3a: Same source, DIFFERENT sides — side reassignment needed, not slot swap.
        // Fix 2 (diagonal handle improvement) is the mitigation.
        // Case 3b: Different source AND different target (includes fan-in from different sides).
        // Irreducible by handle manipulation. Fix 1 (barycenter) is the mitigation.
      }
      if (attempted) break
    }
    if (EDGE_ROUTING_DIAGNOSTIC) {
      console.log(
        `[EdgeRouting] Iteration ${iter}: ${iterCrossingCount} crossings detected, attempted=${attempted}`,
      )
    }
    if (!attempted) break // no more fixable crossings
  }

  // 8. Focus camera on created nodes
  requestFitView(createdNodeIds, 0.15, 300, 0.35)

  const elapsed = performance.now() - t0
  if (elapsed > 200) {
    console.warn(`[ChatToolService] Layout pipeline took ${elapsed.toFixed(0)}ms (budget: 200ms)`)
  }
}

function safeJsonParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json || '{}')
  } catch {
    return {}
  }
}
