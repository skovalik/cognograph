// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * AgentEventReceiver Tests
 *
 * Tests for the passive event handler that receives transport events
 * from the main process and updates renderer stores.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useSessionStatsStore } from '../../stores/sessionStatsStore'
import { resetWorkspaceStore, seedNode } from '../../../../test/storeUtils'
import { createConversationNode, resetTestCounters } from '../../../../test/utils'
import {
  __test__,
  trackCreatedNode,
  trackCreatedEdge,
} from '../agentEventReceiver'
import type {
  ToolStartPayload,
  ToolResultPayload,
  NodeCreatedPayload,
  AgentCompletePayload,
} from '../agentEventReceiver'

const {
  handleToolStart,
  handleToolResult,
  handleNodeCreated,
  handleAgentComplete,
  pendingLayoutNodes,
  pendingLayoutEdges,
} = __test__

describe('agentEventReceiver', () => {
  const CONV_ID = 'test-conversation-1'

  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
    pendingLayoutNodes.clear()
    pendingLayoutEdges.clear()

    // Seed a conversation node so addToolMessage can find it
    const conv = createConversationNode([], { id: CONV_ID })
    seedNode(conv)
  })

  describe('handleToolStart', () => {
    it('should add a tool_use message to the conversation', () => {
      const payload: ToolStartPayload = {
        conversationId: CONV_ID,
        toolName: 'create_node',
        toolId: 'tool-1',
        toolInput: { type: 'note', title: 'Test' },
      }

      handleToolStart(payload)

      const store = useWorkspaceStore.getState()
      const node = store.nodes.find(n => n.id === CONV_ID)
      const messages = (node?.data as any)?.messages ?? []
      const toolMsg = messages.find((m: any) => m.role === 'tool_use')

      expect(toolMsg).toBeDefined()
      expect(toolMsg?.toolName).toBe('create_node')
      expect(toolMsg?.toolUseId).toBe('tool-1')
    })
  })

  describe('handleToolResult', () => {
    it('should add a tool_result message for successful execution', () => {
      const payload: ToolResultPayload = {
        conversationId: CONV_ID,
        toolId: 'tool-1',
        toolName: 'create_node',
        result: {
          success: true,
          output: { nodeId: 'new-node-1', title: 'Test', type: 'note' },
        },
      }

      handleToolResult(payload)

      const store = useWorkspaceStore.getState()
      const node = store.nodes.find(n => n.id === CONV_ID)
      const messages = (node?.data as any)?.messages ?? []
      const resultMsg = messages.find((m: any) => m.role === 'tool_result')

      expect(resultMsg).toBeDefined()
      expect(resultMsg?.toolResultFor).toBe('tool-1')
      expect(resultMsg?.isError).toBe(false)
    })

    it('should add an error tool_result message on failure', () => {
      const payload: ToolResultPayload = {
        conversationId: CONV_ID,
        toolId: 'tool-2',
        toolName: 'delete_node',
        result: {
          success: false,
          error: 'Node not found',
        },
      }

      handleToolResult(payload)

      const store = useWorkspaceStore.getState()
      const node = store.nodes.find(n => n.id === CONV_ID)
      const messages = (node?.data as any)?.messages ?? []
      const resultMsg = messages.find((m: any) => m.role === 'tool_result')

      expect(resultMsg).toBeDefined()
      expect(resultMsg?.isError).toBe(true)
      expect(resultMsg?.content).toContain('Node not found')
    })

    it('should track created nodes from create_node result', () => {
      const payload: ToolResultPayload = {
        conversationId: CONV_ID,
        toolId: 'tool-3',
        toolName: 'create_node',
        result: {
          success: true,
          output: { nodeId: 'created-1' },
        },
      }

      handleToolResult(payload)

      const tracked = pendingLayoutNodes.get(CONV_ID)
      expect(tracked).toContain('created-1')
    })

    it('should track created nodes from batch_create result', () => {
      const payload: ToolResultPayload = {
        conversationId: CONV_ID,
        toolId: 'tool-4',
        toolName: 'batch_create',
        result: {
          success: true,
          output: {
            nodeMap: { temp1: 'real-1', temp2: 'real-2' },
          },
        },
      }

      handleToolResult(payload)

      const tracked = pendingLayoutNodes.get(CONV_ID)
      expect(tracked).toContain('real-1')
      expect(tracked).toContain('real-2')
    })

    it('should track created edges from link_nodes result', () => {
      const payload: ToolResultPayload = {
        conversationId: CONV_ID,
        toolId: 'tool-5',
        toolName: 'link_nodes',
        result: {
          success: true,
          output: { edgeId: 'edge-1' },
        },
      }

      handleToolResult(payload)

      const tracked = pendingLayoutEdges.get(CONV_ID)
      expect(tracked).toContain('edge-1')
    })
  })

  describe('handleNodeCreated', () => {
    it('should track the node for layout', () => {
      const payload: NodeCreatedPayload = {
        conversationId: CONV_ID,
        nodeId: 'streaming-node-1',
        type: 'note',
        position: { x: 100, y: 200 },
      }

      handleNodeCreated(payload)

      const tracked = pendingLayoutNodes.get(CONV_ID)
      expect(tracked).toContain('streaming-node-1')
    })
  })

  describe('handleAgentComplete', () => {
    it('should clear streaming state', () => {
      // Set streaming first
      useWorkspaceStore.getState().setStreaming(CONV_ID, true)

      const payload: AgentCompletePayload = {
        conversationId: CONV_ID,
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      }

      handleAgentComplete(payload)

      const store = useWorkspaceStore.getState()
      expect(store.streamingConversations.has(CONV_ID)).toBe(false)
    })

    it('should clean up layout tracking maps', () => {
      trackCreatedNode(CONV_ID, 'node-1')
      trackCreatedEdge(CONV_ID, 'edge-1')

      const payload: AgentCompletePayload = {
        conversationId: CONV_ID,
        stopReason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 },
      }

      handleAgentComplete(payload)

      expect(pendingLayoutNodes.has(CONV_ID)).toBe(false)
      expect(pendingLayoutEdges.has(CONV_ID)).toBe(false)
    })
  })

  describe('trackCreatedNode / trackCreatedEdge', () => {
    it('should accumulate nodes for a conversation', () => {
      trackCreatedNode(CONV_ID, 'n1')
      trackCreatedNode(CONV_ID, 'n2')
      trackCreatedNode(CONV_ID, 'n3')

      expect(pendingLayoutNodes.get(CONV_ID)).toEqual(['n1', 'n2', 'n3'])
    })

    it('should accumulate edges for a conversation', () => {
      trackCreatedEdge(CONV_ID, 'e1')
      trackCreatedEdge(CONV_ID, 'e2')

      expect(pendingLayoutEdges.get(CONV_ID)).toEqual(['e1', 'e2'])
    })

    it('should keep separate tracking per conversation', () => {
      const CONV_2 = 'test-conversation-2'
      trackCreatedNode(CONV_ID, 'n1')
      trackCreatedNode(CONV_2, 'n2')

      expect(pendingLayoutNodes.get(CONV_ID)).toEqual(['n1'])
      expect(pendingLayoutNodes.get(CONV_2)).toEqual(['n2'])
    })
  })
})
