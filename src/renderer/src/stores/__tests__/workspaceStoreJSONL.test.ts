// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * WorkspaceStore JSONL Persistence Wiring Tests
 *
 * Verifies that:
 * 1. addMessage() calls window.api.conversation.appendMessage to persist
 *    messages to the JSONL sidecar file.
 * 2. newWorkspace() resets all conversation state (messages, commandLog,
 *    streaming) so no data leaks between workspaces.
 */

import type { ConversationNodeData, Message } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getWorkspaceState, resetWorkspaceStore, seedNode } from '../../../../test/storeUtils'
import { createConversationNode, resetTestCounters } from '../../../../test/utils'
import { useWorkspaceStore } from '../workspaceStore'

describe('workspaceStore — JSONL persistence wiring', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()

    // Install the conversation.appendMessage mock on window.api.
    // The global mock from electronApi.ts doesn't include `conversation`,
    // so we add it here to verify the IPC call is made.
    ;(window.api as Record<string, unknown>).conversation = {
      appendMessage: vi.fn().mockResolvedValue({ success: true }),
      loadMessages: vi.fn().mockResolvedValue({ success: true, data: [] }),
      loadAllMessages: vi.fn().mockResolvedValue({ success: true, data: [] }),
      migrate: vi.fn().mockResolvedValue({ success: true }),
    }
  })

  describe('addMessage calls appendMessage IPC', () => {
    it('should call conversation.appendMessage when workspaceId is set', () => {
      const convNode = createConversationNode([], { id: 'conv-test-1' })
      seedNode(convNode)

      // Set workspaceId — appendMessage only fires when this is non-null
      useWorkspaceStore.setState({ workspaceId: 'ws-test-001' })

      const { addMessage } = useWorkspaceStore.getState()
      addMessage('conv-test-1', 'user', 'hello world')

      // Verify the IPC was called
      const appendMock = (
        window.api as { conversation: { appendMessage: ReturnType<typeof vi.fn> } }
      ).conversation.appendMessage
      expect(appendMock).toHaveBeenCalledTimes(1)

      // Verify the arguments: (workspaceId, nodeId, message)
      const [wsId, nodeId, message] = appendMock.mock.calls[0] as [string, string, Message]
      expect(wsId).toBe('ws-test-001')
      expect(nodeId).toBe('conv-test-1')
      expect(message.role).toBe('user')
      expect(message.content).toBe('hello world')
      expect(message.id).toBeDefined()
      expect(message.timestamp).toBeGreaterThan(0)
    })

    it('should NOT call conversation.appendMessage when workspaceId is null', () => {
      const convNode = createConversationNode([], { id: 'conv-test-2' })
      seedNode(convNode)

      // workspaceId defaults to null from resetWorkspaceStore

      const { addMessage } = useWorkspaceStore.getState()
      addMessage('conv-test-2', 'user', 'hello')

      const appendMock = (
        window.api as { conversation: { appendMessage: ReturnType<typeof vi.fn> } }
      ).conversation.appendMessage
      expect(appendMock).not.toHaveBeenCalled()
    })

    it('should add the message to the node data in the store', () => {
      const convNode = createConversationNode([], { id: 'conv-test-3' })
      seedNode(convNode)
      useWorkspaceStore.setState({ workspaceId: 'ws-test-002' })

      const { addMessage } = useWorkspaceStore.getState()
      addMessage('conv-test-3', 'user', 'test message')

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'conv-test-3')
      expect(node).toBeDefined()
      const convData = node!.data as ConversationNodeData
      expect(convData.messages).toHaveLength(1)
      expect(convData.messages[0]!.content).toBe('test message')
      expect(convData.messages[0]!.role).toBe('user')
    })

    it('should persist assistant messages to JSONL too', () => {
      const convNode = createConversationNode([], { id: 'conv-test-4' })
      seedNode(convNode)
      useWorkspaceStore.setState({ workspaceId: 'ws-test-003' })

      const { addMessage } = useWorkspaceStore.getState()
      addMessage('conv-test-4', 'assistant', 'I can help with that')

      const appendMock = (
        window.api as { conversation: { appendMessage: ReturnType<typeof vi.fn> } }
      ).conversation.appendMessage
      expect(appendMock).toHaveBeenCalledTimes(1)

      const [, , message] = appendMock.mock.calls[0] as [string, string, Message]
      expect(message.role).toBe('assistant')
      expect(message.content).toBe('I can help with that')
    })
  })

  describe('workspace isolation — newWorkspace clears state', () => {
    it('should clear all nodes (including conversation messages) on newWorkspace', () => {
      // Set up a workspace with a conversation containing messages
      const convNode = createConversationNode(
        [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi there' },
        ],
        { id: 'conv-old' },
      )
      seedNode(convNode)
      useWorkspaceStore.setState({ workspaceId: 'ws-old' })

      // Verify messages exist
      let state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'conv-old')
      expect(node).toBeDefined()
      expect((node!.data as ConversationNodeData).messages).toHaveLength(2)

      // Create new workspace
      const { newWorkspace } = useWorkspaceStore.getState()
      newWorkspace()

      // All nodes should be gone — no message leakage
      state = getWorkspaceState()
      expect(state.nodes).toHaveLength(0)
    })

    it('should clear commandLog on newWorkspace', () => {
      // Populate commandLog
      useWorkspaceStore.setState({
        workspaceId: 'ws-old-2',
        commandLog: [
          { id: 'cmd-1', command: 'test', timestamp: Date.now(), status: 'completed' as const },
        ],
      })

      // Verify commandLog is non-empty
      expect(getWorkspaceState().commandLog).toHaveLength(1)

      // Create new workspace
      const { newWorkspace } = useWorkspaceStore.getState()
      newWorkspace()

      // commandLog should be empty
      expect(getWorkspaceState().commandLog).toHaveLength(0)
    })

    it('should clear streamingConversations on newWorkspace', () => {
      const convNode = createConversationNode([], { id: 'conv-streaming' })
      seedNode(convNode)

      // Mark as streaming
      const { setStreaming } = useWorkspaceStore.getState()
      setStreaming('conv-streaming', true)
      expect(getWorkspaceState().streamingConversations.has('conv-streaming')).toBe(true)

      // Create new workspace
      const { newWorkspace } = useWorkspaceStore.getState()
      newWorkspace()

      // Streaming set should be empty
      expect(getWorkspaceState().streamingConversations.size).toBe(0)
    })

    it('should generate a new workspaceId on newWorkspace', () => {
      useWorkspaceStore.setState({ workspaceId: 'ws-original' })

      const { newWorkspace } = useWorkspaceStore.getState()
      newWorkspace()

      const state = getWorkspaceState()
      expect(state.workspaceId).not.toBe('ws-original')
      expect(state.workspaceId).toBeTruthy()
    })

    it('should reset workspace name to Untitled Workspace', () => {
      useWorkspaceStore.setState({ workspaceName: 'My Custom Workspace' })

      const { newWorkspace } = useWorkspaceStore.getState()
      newWorkspace()

      expect(getWorkspaceState().workspaceName).toBe('Untitled Workspace')
    })
  })
})
