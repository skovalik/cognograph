// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Golden-File Workspace Round-Trip Test
 *
 * Verifies lossless round-trip through:
 * 1. JSON workspace save/load (nodes, edges, viewport, metadata)
 * 2. JSONL message sidecar save/load (conversation messages)
 * 3. Validation via workspaceValidation.ts Zod schema
 *
 * Uses fixture files as the golden reference:
 * - __fixtures__/golden-workspace.json
 * - __fixtures__/golden-messages.jsonl
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { validateWorkspaceData } from '../workspaceValidation'

// Mock electron for workspace validation (it doesn't need electron, but
// modules it sits near may reference it)
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  app: { getPath: vi.fn(() => '/mock') },
  dialog: {},
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}))

// ---------------------------------------------------------------------------
// Fixture paths
// ---------------------------------------------------------------------------

const FIXTURES_DIR = resolve(__dirname, '__fixtures__')
const GOLDEN_WORKSPACE_PATH = join(FIXTURES_DIR, 'golden-workspace.json')
const GOLDEN_MESSAGES_PATH = join(FIXTURES_DIR, 'golden-messages.jsonl')

// ---------------------------------------------------------------------------
// Helpers — mirror the production save/load logic without IPC
// ---------------------------------------------------------------------------

/** Save workspace to JSON (same format as workspace.ts atomicWriteFile) */
async function saveWorkspace(filePath: string, data: unknown): Promise<void> {
  const tmpPath = filePath + '.tmp'
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmpPath, filePath)
}

/** Load workspace from JSON */
async function loadWorkspace(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

/** Append messages as JSONL (same format as conversationPersistence.ts) */
async function saveMessagesJsonl(filePath: string, messages: unknown[]): Promise<void> {
  const lines = messages.map((m) => JSON.stringify(m)).join('\n') + '\n'
  await fs.writeFile(filePath, lines, 'utf-8')
}

/** Load messages from JSONL with corrupt-line tolerance */
async function loadMessagesJsonl(filePath: string): Promise<unknown[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  if (!content.trim()) return []

  const lines = content.split('\n')
  const seen = new Set<string>()
  const messages: unknown[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    try {
      const parsed = JSON.parse(trimmed) as { uuid?: string }
      if (parsed.uuid && !seen.has(parsed.uuid)) {
        seen.add(parsed.uuid)
        messages.push(parsed)
      }
    } catch {
      // Skip corrupt lines (matches production behavior)
    }
  }

  return messages
}

// =============================================================================
// Tests
// =============================================================================

describe('Golden-file workspace round-trip', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `cognograph-golden-${randomUUID()}`)
    await fs.mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch {
      // Cleanup best-effort
    }
  })

  // -------------------------------------------------------------------------
  // 1. Fixture integrity
  // -------------------------------------------------------------------------

  it('golden workspace fixture is valid JSON', async () => {
    const content = await fs.readFile(GOLDEN_WORKSPACE_PATH, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed.id).toBe('golden-workspace-001')
    expect(parsed.nodes).toHaveLength(4)
    expect(parsed.edges).toHaveLength(3)
  })

  it('golden workspace fixture passes Zod validation', async () => {
    const content = await fs.readFile(GOLDEN_WORKSPACE_PATH, 'utf-8')
    const parsed = JSON.parse(content)
    const validated = validateWorkspaceData(parsed)
    expect(validated.id).toBe('golden-workspace-001')
    expect(validated.name).toBe('Golden File Test Workspace')
    expect(validated.version).toBe(1)
  })

  it('golden messages fixture has 3 messages', async () => {
    const messages = await loadMessagesJsonl(GOLDEN_MESSAGES_PATH)
    expect(messages).toHaveLength(3)
  })

  // -------------------------------------------------------------------------
  // 2. JSON workspace round-trip
  // -------------------------------------------------------------------------

  it('workspace JSON round-trips losslessly', async () => {
    // Load golden fixture
    const original = await loadWorkspace(GOLDEN_WORKSPACE_PATH)

    // Save to temp
    const outPath = join(tmpDir, 'workspace.json')
    await saveWorkspace(outPath, original)

    // Load back
    const reloaded = await loadWorkspace(outPath)

    // Compare
    expect(reloaded).toEqual(original)
  })

  it('workspace JSON survives double round-trip', async () => {
    const original = await loadWorkspace(GOLDEN_WORKSPACE_PATH)

    // First round-trip
    const path1 = join(tmpDir, 'ws1.json')
    await saveWorkspace(path1, original)
    const loaded1 = await loadWorkspace(path1)

    // Second round-trip
    const path2 = join(tmpDir, 'ws2.json')
    await saveWorkspace(path2, loaded1)
    const loaded2 = await loadWorkspace(path2)

    expect(loaded2).toEqual(original)
  })

  it('workspace JSON preserves Unicode content', async () => {
    const original = await loadWorkspace(GOLDEN_WORKSPACE_PATH) as {
      nodes: Array<{ data: { content?: string } }>
    }

    const outPath = join(tmpDir, 'ws-unicode.json')
    await saveWorkspace(outPath, original)
    const reloaded = await loadWorkspace(outPath) as typeof original

    // The note node has Unicode
    const noteNode = reloaded.nodes.find(
      (n: { data: { content?: string } }) => n.data.content?.includes('\u4f60\u597d'),
    )
    expect(noteNode).toBeDefined()
    expect(noteNode!.data.content).toContain('\ud83c\udf0d')
  })

  it('workspace JSON preserves all node types', async () => {
    const original = await loadWorkspace(GOLDEN_WORKSPACE_PATH) as {
      nodes: Array<{ data: { type: string } }>
    }

    const outPath = join(tmpDir, 'ws-types.json')
    await saveWorkspace(outPath, original)
    const reloaded = await loadWorkspace(outPath) as typeof original

    const types = reloaded.nodes.map((n) => n.data.type).sort()
    expect(types).toEqual(['artifact', 'conversation', 'note', 'task'])
  })

  it('workspace JSON preserves edge data', async () => {
    const original = await loadWorkspace(GOLDEN_WORKSPACE_PATH) as {
      edges: Array<{ id: string; source: string; target: string; data: unknown }>
    }

    const outPath = join(tmpDir, 'ws-edges.json')
    await saveWorkspace(outPath, original)
    const reloaded = await loadWorkspace(outPath) as typeof original

    expect(reloaded.edges).toHaveLength(3)
    expect(reloaded.edges[0]!.source).toBe('note-001')
    expect(reloaded.edges[0]!.target).toBe('conv-001')
    expect(reloaded.edges[2]!.data).toEqual({
      direction: 'bidirectional',
      active: true,
    })
  })

  it('workspace JSON preserves viewport', async () => {
    const original = await loadWorkspace(GOLDEN_WORKSPACE_PATH) as {
      viewport: { x: number; y: number; zoom: number }
    }

    const outPath = join(tmpDir, 'ws-vp.json')
    await saveWorkspace(outPath, original)
    const reloaded = await loadWorkspace(outPath) as typeof original

    expect(reloaded.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('workspace JSON preserves contextSettings', async () => {
    const original = await loadWorkspace(GOLDEN_WORKSPACE_PATH) as {
      contextSettings?: { globalDepth: number; traversalMode: string }
    }

    const outPath = join(tmpDir, 'ws-ctx.json')
    await saveWorkspace(outPath, original)
    const reloaded = await loadWorkspace(outPath) as typeof original

    expect(reloaded.contextSettings).toEqual({
      globalDepth: 2,
      traversalMode: 'all',
    })
  })

  // -------------------------------------------------------------------------
  // 3. JSONL message round-trip
  // -------------------------------------------------------------------------

  it('JSONL messages round-trip losslessly', async () => {
    const originalMessages = await loadMessagesJsonl(GOLDEN_MESSAGES_PATH)

    const outPath = join(tmpDir, 'messages.jsonl')
    await saveMessagesJsonl(outPath, originalMessages)
    const reloaded = await loadMessagesJsonl(outPath)

    expect(reloaded).toEqual(originalMessages)
  })

  it('JSONL preserves message UUIDs', async () => {
    const messages = await loadMessagesJsonl(GOLDEN_MESSAGES_PATH) as Array<{
      uuid: string
    }>

    expect(messages[0]!.uuid).toBe('msg-001')
    expect(messages[1]!.uuid).toBe('msg-002')
    expect(messages[2]!.uuid).toBe('msg-003')
  })

  it('JSONL preserves ISO timestamps', async () => {
    const messages = await loadMessagesJsonl(GOLDEN_MESSAGES_PATH) as Array<{
      isoTimestamp: string
    }>

    expect(messages[0]!.isoTimestamp).toBe('2026-04-01T00:00:00.000Z')
    expect(messages[2]!.isoTimestamp).toBe('2026-04-01T00:00:05.000Z')
  })

  it('JSONL preserves conversation ID association', async () => {
    const messages = await loadMessagesJsonl(GOLDEN_MESSAGES_PATH) as Array<{
      conversationId: string
    }>

    for (const msg of messages) {
      expect(msg.conversationId).toBe('conv-001')
    }
  })

  it('JSONL preserves Unicode content in messages', async () => {
    const messages = await loadMessagesJsonl(GOLDEN_MESSAGES_PATH) as Array<{
      content: string
    }>

    const unicodeMsg = messages.find((m) => m.content.includes('\u4f60\u597d'))
    expect(unicodeMsg).toBeDefined()
    expect(unicodeMsg!.content).toContain('\ud83c\udf0d')
  })

  it('JSONL de-duplicates on UUID (crash recovery)', async () => {
    const messages = await loadMessagesJsonl(GOLDEN_MESSAGES_PATH) as Array<{
      uuid: string
    }>

    // Write messages twice (simulating crash + replay)
    const outPath = join(tmpDir, 'messages-dup.jsonl')
    await saveMessagesJsonl(outPath, [...messages, ...messages])

    const reloaded = await loadMessagesJsonl(outPath) as Array<{ uuid: string }>
    // Should de-duplicate — only 3 unique UUIDs
    expect(reloaded).toHaveLength(3)
  })

  it('JSONL tolerates corrupt last line', async () => {
    const messages = await loadMessagesJsonl(GOLDEN_MESSAGES_PATH)

    const outPath = join(tmpDir, 'messages-corrupt.jsonl')
    const lines = messages.map((m) => JSON.stringify(m)).join('\n')
    // Append a truncated line (simulating crash mid-write)
    await fs.writeFile(outPath, lines + '\n{"uuid":"msg-004","isoTimest', 'utf-8')

    const reloaded = await loadMessagesJsonl(outPath)
    // Should load the 3 valid messages, skip the corrupt one
    expect(reloaded).toHaveLength(3)
  })

  // -------------------------------------------------------------------------
  // 4. Combined workspace + messages round-trip
  // -------------------------------------------------------------------------

  it('full workspace + messages round-trips losslessly', async () => {
    // Load both
    const workspace = await loadWorkspace(GOLDEN_WORKSPACE_PATH)
    const messages = await loadMessagesJsonl(GOLDEN_MESSAGES_PATH)

    // Save both
    const wsPath = join(tmpDir, 'full-ws.json')
    const msgPath = join(tmpDir, 'full-ws.messages.jsonl')
    await saveWorkspace(wsPath, workspace)
    await saveMessagesJsonl(msgPath, messages)

    // Reload both
    const reloadedWs = await loadWorkspace(wsPath)
    const reloadedMsgs = await loadMessagesJsonl(msgPath)

    // Both should match
    expect(reloadedWs).toEqual(workspace)
    expect(reloadedMsgs).toEqual(messages)

    // Workspace should pass validation
    const validated = validateWorkspaceData(reloadedWs)
    expect(validated.id).toBe('golden-workspace-001')
  })

  it('validates that workspace has expected structure after round-trip', async () => {
    const workspace = await loadWorkspace(GOLDEN_WORKSPACE_PATH) as Record<
      string,
      unknown
    >

    const wsPath = join(tmpDir, 'structure-check.json')
    await saveWorkspace(wsPath, workspace)
    const reloaded = await loadWorkspace(wsPath) as Record<string, unknown>

    // Structural assertions
    expect(typeof reloaded.id).toBe('string')
    expect(typeof reloaded.name).toBe('string')
    expect(Array.isArray(reloaded.nodes)).toBe(true)
    expect(Array.isArray(reloaded.edges)).toBe(true)
    expect(typeof reloaded.viewport).toBe('object')
    expect(typeof reloaded.createdAt).toBe('number')
    expect(typeof reloaded.updatedAt).toBe('number')
    expect(typeof reloaded.version).toBe('number')
  })

  // -------------------------------------------------------------------------
  // 5. Edge cases
  // -------------------------------------------------------------------------

  it('handles empty workspace (no nodes, no edges)', async () => {
    const emptyWs = {
      id: 'empty-ws',
      name: 'Empty',
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    }

    const wsPath = join(tmpDir, 'empty.json')
    await saveWorkspace(wsPath, emptyWs)
    const reloaded = await loadWorkspace(wsPath)

    expect(reloaded).toEqual(emptyWs)
    const validated = validateWorkspaceData(reloaded)
    expect(validated.nodes).toHaveLength(0)
  })

  it('handles empty JSONL file (no messages)', async () => {
    const msgPath = join(tmpDir, 'empty.messages.jsonl')
    await fs.writeFile(msgPath, '', 'utf-8')

    const messages = await loadMessagesJsonl(msgPath)
    expect(messages).toHaveLength(0)
  })

  it('atomic write does not corrupt on rename', async () => {
    const workspace = await loadWorkspace(GOLDEN_WORKSPACE_PATH)

    const wsPath = join(tmpDir, 'atomic-test.json')
    // saveWorkspace writes to .tmp then renames
    await saveWorkspace(wsPath, workspace)

    // Verify the .tmp file was cleaned up (renamed to final)
    const tmpPath = wsPath + '.tmp'
    let tmpExists = true
    try {
      await fs.access(tmpPath)
    } catch {
      tmpExists = false
    }
    expect(tmpExists).toBe(false)

    // Verify the final file exists and is valid
    const reloaded = await loadWorkspace(wsPath)
    expect(reloaded).toEqual(workspace)
  })
})
