// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Conversation Persistence Tests — Phase 4B UX-JSONL
 *
 * Covers:
 * - Send → save → reload → visible
 * - Kill mid-stream → user message survives
 * - >100 messages from 2 concurrent agents load in correct timestamp order
 * - Migration: old workspace with inline messages loads correctly
 * - Corrupt last line skipped on load
 */

import type { Message } from '@shared/types/nodes'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted runs before vi.mock hoisting — safe to reference in factories
const mockFiles = vi.hoisted(() => new Map<string, string>())

// Mock electron
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn(() => '/mock/user/data') },
}))

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Provide crypto.randomUUID for jsdom environment
vi.mock('crypto', () => {
  let counter = 0
  const mod = { randomUUID: () => `mock-uuid-${++counter}` }
  return { ...mod, default: mod }
})

// In-memory filesystem mock
vi.mock('fs', () => {
  const readFile = vi.fn(async (path: string) => {
    const content = mockFiles.get(path)
    if (content === undefined) {
      const err = new Error(
        `ENOENT: no such file or directory, open '${path}'`,
      ) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }
    return content
  })
  const writeFile = vi.fn(async (path: string, content: string) => {
    mockFiles.set(path, content)
  })
  const appendFile = vi.fn(async (path: string, content: string) => {
    const existing = mockFiles.get(path) || ''
    mockFiles.set(path, existing + content)
  })
  const access = vi.fn(async (path: string) => {
    if (!mockFiles.has(path)) {
      const err = new Error(
        `ENOENT: no such file or directory, access '${path}'`,
      ) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }
  })
  const rename = vi.fn(async (oldPath: string, newPath: string) => {
    const content = mockFiles.get(oldPath)
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, rename '${oldPath}'`)
    }
    mockFiles.set(newPath, content)
    mockFiles.delete(oldPath)
  })
  const copyFile = vi.fn(async (src: string, dest: string) => {
    const content = mockFiles.get(src)
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, copyFile '${src}'`)
    }
    mockFiles.set(dest, content)
  })
  const mkdir = vi.fn()
  const unlink = vi.fn()

  const promises = { readFile, writeFile, appendFile, access, rename, copyFile, mkdir, unlink }

  return {
    promises,
    default: { promises },
    watch: vi.fn(),
  }
})

// Import AFTER mocks are set up
import {
  appendMessage,
  enrichMessage,
  loadConversationMessages,
  loadMessages,
  migrateInlineMessages,
  type PersistedMessage,
} from '../conversationPersistence'

// Helper: create a test message
function makeMessage(
  overrides: Partial<PersistedMessage> & { conversationId: string },
): PersistedMessage {
  const now = Date.now()
  return {
    id: overrides.id || `msg-${Math.random().toString(36).slice(2)}`,
    role: overrides.role || 'user',
    content: overrides.content || 'Hello',
    timestamp: overrides.timestamp || now,
    uuid: overrides.uuid || `uuid-${Math.random().toString(36).slice(2)}`,
    isoTimestamp: overrides.isoTimestamp || new Date(overrides.timestamp || now).toISOString(),
    conversationId: overrides.conversationId,
  }
}

const WORKSPACE_ID = 'test-workspace-1'
const JSONL_PATH = join('/mock/user/data', 'workspaces', `${WORKSPACE_ID}.messages.jsonl`)
const WORKSPACE_JSON_PATH = join('/mock/user/data', 'workspaces', `${WORKSPACE_ID}.json`)
const BACKUP_JSON_PATH = join(
  '/mock/user/data',
  'workspaces',
  `${WORKSPACE_ID}.pre-jsonl-backup.json`,
)

describe('Conversation Persistence (JSONL)', () => {
  beforeEach(() => {
    mockFiles.clear()
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // Send → save → reload → visible
  // -----------------------------------------------------------------------
  describe('send → save → reload → visible', () => {
    it('should persist a message and reload it', async () => {
      const msg = makeMessage({
        conversationId: 'conv-1',
        content: 'Test message',
        role: 'user',
      })

      await appendMessage(WORKSPACE_ID, msg)

      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(1)
      expect(loaded[0]!.content).toBe('Test message')
      expect(loaded[0]!.uuid).toBe(msg.uuid)
      expect(loaded[0]!.conversationId).toBe('conv-1')
    })

    it('should persist multiple messages and reload all', async () => {
      const msg1 = makeMessage({
        conversationId: 'conv-1',
        content: 'First',
        timestamp: 1000,
      })
      const msg2 = makeMessage({
        conversationId: 'conv-1',
        content: 'Second',
        timestamp: 2000,
      })
      const msg3 = makeMessage({
        conversationId: 'conv-1',
        content: 'Third',
        timestamp: 3000,
      })

      await appendMessage(WORKSPACE_ID, msg1)
      await appendMessage(WORKSPACE_ID, msg2)
      await appendMessage(WORKSPACE_ID, msg3)

      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(3)
      expect(loaded[0]!.content).toBe('First')
      expect(loaded[1]!.content).toBe('Second')
      expect(loaded[2]!.content).toBe('Third')
    })

    it('should filter messages by conversation ID', async () => {
      const msg1 = makeMessage({ conversationId: 'conv-1', content: 'Conv 1 msg', timestamp: 1000 })
      const msg2 = makeMessage({ conversationId: 'conv-2', content: 'Conv 2 msg', timestamp: 2000 })

      await appendMessage(WORKSPACE_ID, msg1)
      await appendMessage(WORKSPACE_ID, msg2)

      const conv1Messages = await loadConversationMessages(WORKSPACE_ID, 'conv-1')
      expect(conv1Messages).toHaveLength(1)
      expect(conv1Messages[0]!.content).toBe('Conv 1 msg')

      const conv2Messages = await loadConversationMessages(WORKSPACE_ID, 'conv-2')
      expect(conv2Messages).toHaveLength(1)
      expect(conv2Messages[0]!.content).toBe('Conv 2 msg')
    })
  })

  // -----------------------------------------------------------------------
  // Kill mid-stream → user message survives
  // -----------------------------------------------------------------------
  describe('crash safety', () => {
    it('should survive user message being written before API call', async () => {
      // Simulate: user message appended, then "crash" (no assistant message)
      const userMsg = makeMessage({
        conversationId: 'conv-1',
        content: 'User question before crash',
        role: 'user',
      })

      await appendMessage(WORKSPACE_ID, userMsg)

      // "Crash" — no assistant message follows
      // On reload, user message should be there
      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(1)
      expect(loaded[0]!.role).toBe('user')
      expect(loaded[0]!.content).toBe('User question before crash')
    })

    it('should handle partial write on last line (corrupt last line)', async () => {
      // Write valid messages + a corrupt last line
      const msg1 = makeMessage({
        conversationId: 'conv-1',
        content: 'Valid message',
        timestamp: 1000,
      })

      const validLine = JSON.stringify(msg1)
      const corruptLine = '{"uuid":"broken","role":"assistant","content":"incompl'

      mockFiles.set(JSONL_PATH, validLine + '\n' + corruptLine + '\n')

      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(1)
      expect(loaded[0]!.content).toBe('Valid message')
    })
  })

  // -----------------------------------------------------------------------
  // >100 messages from 2 concurrent agents load in correct timestamp order
  // -----------------------------------------------------------------------
  describe('concurrent ordering', () => {
    it('should load >100 messages from 2 agents in correct timestamp order', async () => {
      const messages: PersistedMessage[] = []

      // Generate 120 messages alternating between two agents/conversations
      for (let i = 0; i < 120; i++) {
        const convId = i % 2 === 0 ? 'agent-a' : 'agent-b'
        const msg = makeMessage({
          conversationId: convId,
          content: `Message ${i}`,
          timestamp: 1000 + i * 10, // 10ms apart
          uuid: `uuid-${i.toString().padStart(3, '0')}`,
          isoTimestamp: new Date(1000 + i * 10).toISOString(),
        })
        messages.push(msg)
      }

      // Write them in shuffled order to simulate concurrent writes
      const shuffled = [...messages].sort(() => Math.random() - 0.5)
      const lines = shuffled.map((m) => JSON.stringify(m)).join('\n') + '\n'
      mockFiles.set(JSONL_PATH, lines)

      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(120)

      // Verify sorted by timestamp
      for (let i = 1; i < loaded.length; i++) {
        const prev = loaded[i - 1]!
        const curr = loaded[i]!
        expect(prev.isoTimestamp <= curr.isoTimestamp).toBe(true)
      }

      // Verify all messages present
      const uuids = loaded.map((m) => m.uuid)
      for (let i = 0; i < 120; i++) {
        expect(uuids).toContain(`uuid-${i.toString().padStart(3, '0')}`)
      }
    })

    it('should deduplicate messages by UUID', async () => {
      const msg = makeMessage({
        conversationId: 'conv-1',
        content: 'Duplicate',
        uuid: 'same-uuid',
      })

      // Write same message twice
      const lines = JSON.stringify(msg) + '\n' + JSON.stringify(msg) + '\n'
      mockFiles.set(JSONL_PATH, lines)

      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(1)
    })
  })

  // -----------------------------------------------------------------------
  // Migration: old workspace with inline messages loads correctly
  // -----------------------------------------------------------------------
  describe('migration', () => {
    it('should migrate inline messages from workspace JSON to JSONL', async () => {
      const workspaceData = {
        id: WORKSPACE_ID,
        name: 'Test',
        version: 1,
        nodes: [
          {
            id: 'conv-node-1',
            position: { x: 0, y: 0 },
            data: {
              type: 'conversation',
              title: 'Test Conversation',
              messages: [
                {
                  id: 'msg-1',
                  role: 'user',
                  content: 'Hello from workspace JSON',
                  timestamp: 1000,
                },
                {
                  id: 'msg-2',
                  role: 'assistant',
                  content: 'Hi back',
                  timestamp: 2000,
                },
              ],
              provider: 'anthropic',
              createdAt: 1000,
              updatedAt: 2000,
            },
          },
          {
            id: 'note-node-1',
            position: { x: 100, y: 0 },
            data: {
              type: 'note',
              title: 'A note',
              content: 'Not a conversation',
            },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: 1000,
        updatedAt: 2000,
      }

      mockFiles.set(WORKSPACE_JSON_PATH, JSON.stringify(workspaceData))

      const migrated = await migrateInlineMessages(WORKSPACE_ID, WORKSPACE_JSON_PATH)
      expect(migrated).toBe(true)

      // Verify backup was created
      expect(mockFiles.has(BACKUP_JSON_PATH)).toBe(true)

      // Verify JSONL was created with messages
      const jsonlContent = mockFiles.get(JSONL_PATH)
      expect(jsonlContent).toBeDefined()
      const lines = jsonlContent!.trim().split('\n')
      expect(lines).toHaveLength(2)

      const parsed0 = JSON.parse(lines[0]!)
      expect(parsed0.content).toBe('Hello from workspace JSON')
      expect(parsed0.conversationId).toBe('conv-node-1')
      expect(parsed0.uuid).toBeDefined()
      expect(parsed0.isoTimestamp).toBeDefined()

      const parsed1 = JSON.parse(lines[1]!)
      expect(parsed1.content).toBe('Hi back')

      // Verify workspace JSON was stripped of messages
      const strippedJson = JSON.parse(mockFiles.get(WORKSPACE_JSON_PATH)!)
      const convNode = strippedJson.nodes.find(
        (n: Record<string, unknown>) => n.id === 'conv-node-1',
      )
      expect(convNode.data.messages).toEqual([])

      // Note node should be untouched
      const noteNode = strippedJson.nodes.find(
        (n: Record<string, unknown>) => n.id === 'note-node-1',
      )
      expect(noteNode.data.content).toBe('Not a conversation')
    })

    it('should be idempotent — no-op if JSONL exists and JSON has no messages', async () => {
      const workspaceData = {
        id: WORKSPACE_ID,
        name: 'Test',
        version: 1,
        nodes: [
          {
            id: 'conv-node-1',
            position: { x: 0, y: 0 },
            data: {
              type: 'conversation',
              title: 'Test',
              messages: [],
              provider: 'anthropic',
              createdAt: 1000,
              updatedAt: 2000,
            },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: 1000,
        updatedAt: 2000,
      }

      mockFiles.set(WORKSPACE_JSON_PATH, JSON.stringify(workspaceData))
      mockFiles.set(JSONL_PATH, '')

      const migrated = await migrateInlineMessages(WORKSPACE_ID, WORKSPACE_JSON_PATH)
      expect(migrated).toBe(false) // no messages to migrate
    })

    it('should dedup on UUID when JSONL exists and JSON still has messages', async () => {
      // Simulate: JSONL was created but JSON wasn't stripped (interrupted migration)
      const existingMsg: PersistedMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Already in JSONL',
        timestamp: 1000,
        uuid: 'fixed-uuid-1',
        isoTimestamp: new Date(1000).toISOString(),
        conversationId: 'conv-node-1',
      }

      mockFiles.set(JSONL_PATH, JSON.stringify(existingMsg) + '\n')

      const workspaceData = {
        id: WORKSPACE_ID,
        name: 'Test',
        version: 1,
        nodes: [
          {
            id: 'conv-node-1',
            position: { x: 0, y: 0 },
            data: {
              type: 'conversation',
              title: 'Test',
              messages: [
                {
                  id: 'msg-1',
                  role: 'user',
                  content: 'Already in JSONL',
                  timestamp: 1000,
                  uuid: 'fixed-uuid-1', // same UUID
                },
                {
                  id: 'msg-2',
                  role: 'assistant',
                  content: 'New message',
                  timestamp: 2000,
                  // no UUID — will get a new one
                },
              ],
              provider: 'anthropic',
              createdAt: 1000,
              updatedAt: 2000,
            },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: 1000,
        updatedAt: 2000,
      }

      mockFiles.set(WORKSPACE_JSON_PATH, JSON.stringify(workspaceData))

      await migrateInlineMessages(WORKSPACE_ID, WORKSPACE_JSON_PATH)

      // Load all messages — should have 2 (1 existing + 1 new, deduped)
      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(2)
    })
  })

  // -----------------------------------------------------------------------
  // Corrupt last line skipped on load
  // -----------------------------------------------------------------------
  describe('corrupt line handling', () => {
    it('should skip corrupt last line and load valid messages', async () => {
      const msg1 = makeMessage({
        conversationId: 'conv-1',
        content: 'Valid 1',
        timestamp: 1000,
      })
      const msg2 = makeMessage({
        conversationId: 'conv-1',
        content: 'Valid 2',
        timestamp: 2000,
      })

      const lines = [
        JSON.stringify(msg1),
        JSON.stringify(msg2),
        '{"broken": true, "no_uuid": ', // corrupt
      ].join('\n')

      mockFiles.set(JSONL_PATH, lines + '\n')

      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(2)
      expect(loaded[0]!.content).toBe('Valid 1')
      expect(loaded[1]!.content).toBe('Valid 2')
    })

    it('should handle completely empty file', async () => {
      mockFiles.set(JSONL_PATH, '')
      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(0)
    })

    it('should handle file with only whitespace', async () => {
      mockFiles.set(JSONL_PATH, '  \n\n  \n')
      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(0)
    })

    it('should handle missing file gracefully', async () => {
      // No file set in mockFiles → readFile throws ENOENT
      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------------
  // enrichMessage
  // -----------------------------------------------------------------------
  describe('enrichMessage', () => {
    it('should add uuid and isoTimestamp to a plain message', () => {
      const msg: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: 1700000000000,
      }

      const enriched = enrichMessage(msg, 'conv-1')
      expect(enriched.uuid).toBeDefined()
      expect(enriched.uuid.length).toBeGreaterThan(0)
      expect(enriched.isoTimestamp).toBeDefined()
      expect(enriched.conversationId).toBe('conv-1')
    })

    it('should preserve existing uuid and isoTimestamp', () => {
      const msg = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello',
        timestamp: 1700000000000,
        uuid: 'existing-uuid',
        isoTimestamp: '2024-01-01T00:00:00.000Z',
      }

      const enriched = enrichMessage(msg, 'conv-1')
      expect(enriched.uuid).toBe('existing-uuid')
      expect(enriched.isoTimestamp).toBe('2024-01-01T00:00:00.000Z')
    })
  })

  // -----------------------------------------------------------------------
  // Content with special characters
  // -----------------------------------------------------------------------
  describe('content encoding', () => {
    it('should handle messages with newlines in content', async () => {
      const msg = makeMessage({
        conversationId: 'conv-1',
        content: 'Line 1\nLine 2\nLine 3',
      })

      await appendMessage(WORKSPACE_ID, msg)

      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(1)
      expect(loaded[0]!.content).toBe('Line 1\nLine 2\nLine 3')
    })

    it('should handle messages with unicode content', async () => {
      const msg = makeMessage({
        conversationId: 'conv-1',
        content: 'Hello 世界 🌍 Привет',
      })

      await appendMessage(WORKSPACE_ID, msg)

      const loaded = await loadMessages(WORKSPACE_ID)
      expect(loaded).toHaveLength(1)
      expect(loaded[0]!.content).toBe('Hello 世界 🌍 Привет')
    })
  })
})
