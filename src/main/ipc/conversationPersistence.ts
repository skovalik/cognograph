// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Conversation Persistence — JSONL Sidecar
 *
 * Stores conversation messages in a JSONL sidecar file alongside the workspace
 * JSON. Each line is one JSON-serialized message with UUID + ISO 8601 timestamp.
 *
 * Design goals:
 * - **Crash-safe**: user messages appended BEFORE the API call completes
 * - **Single-flight append queue**: at most one I/O op in flight per conversation
 * - **Corrupt-tolerant**: partial last line (crash mid-write) is silently skipped
 * - **Migration**: auto-extracts inline messages from workspace JSON on first load
 *
 * File format: `{workspacesDir}/{workspaceId}.messages.jsonl`
 * Each line: `JSON.stringify(message)` (newlines in content become \\n)
 *
 * Phase 4B — UX-JSONL
 */

import { ipcMain, app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import type { Message } from '@shared/types/nodes'
import { logger } from '../utils/logger'

// Re-export for external callers
export type { Message }

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** A persisted message with guaranteed UUID and ISO timestamp. */
export interface PersistedMessage extends Message {
  uuid: string
  isoTimestamp: string
  conversationId: string
}

// -----------------------------------------------------------------------------
// Paths
// -----------------------------------------------------------------------------

const WORKSPACES_DIR = (): string => join(app.getPath('userData'), 'workspaces')

export function jsonlPath(workspaceId: string): string {
  return join(WORKSPACES_DIR(), `${workspaceId}.messages.jsonl`)
}

function backupPath(workspaceId: string): string {
  return join(WORKSPACES_DIR(), `${workspaceId}.pre-jsonl-backup.json`)
}

// -----------------------------------------------------------------------------
// Single-Flight Append Queue (mirrors workspace.ts save queue)
// -----------------------------------------------------------------------------

interface AppendQueueEntry {
  inFlight: boolean
  pending: PersistedMessage[]
}

const appendQueues = new Map<string, AppendQueueEntry>()

/**
 * Append a message to the JSONL sidecar. At most one write is in flight per
 * workspace; additional messages are batched and flushed when the current
 * write completes.
 */
export async function appendMessage(
  workspaceId: string,
  message: PersistedMessage,
): Promise<void> {
  let entry = appendQueues.get(workspaceId)
  if (!entry) {
    entry = { inFlight: false, pending: [] }
    appendQueues.set(workspaceId, entry)
  }

  if (entry.inFlight) {
    entry.pending.push(message)
    return
  }

  entry.inFlight = true

  try {
    await writeMessages(workspaceId, [message])
    await drainAppendQueue(workspaceId)
  } finally {
    const e = appendQueues.get(workspaceId)
    if (e) e.inFlight = false
  }
}

async function drainAppendQueue(workspaceId: string): Promise<void> {
  const entry = appendQueues.get(workspaceId)
  if (!entry) return

  while (entry.pending.length > 0) {
    const batch = entry.pending.splice(0, entry.pending.length)
    await writeMessages(workspaceId, batch)
  }
}

async function writeMessages(
  workspaceId: string,
  messages: PersistedMessage[],
): Promise<void> {
  const filePath = jsonlPath(workspaceId)
  const lines = messages.map((m) => JSON.stringify(m)).join('\n') + '\n'
  await fs.appendFile(filePath, lines, 'utf-8')
}

// -----------------------------------------------------------------------------
// Load — parse JSONL with corrupt-line tolerance
// -----------------------------------------------------------------------------

/**
 * Load all messages from a JSONL sidecar file.
 * - Skips corrupt lines (partial writes from crashes).
 * - Returns messages sorted by timestamp (ascending).
 * - De-duplicates on UUID.
 */
export async function loadMessages(
  workspaceId: string,
): Promise<PersistedMessage[]> {
  const filePath = jsonlPath(workspaceId)

  let content: string
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch {
    return [] // file doesn't exist yet
  }

  if (!content.trim()) return []

  const lines = content.split('\n')
  const seen = new Set<string>()
  const messages: PersistedMessage[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line) continue

    try {
      const parsed = JSON.parse(line) as PersistedMessage
      if (parsed.uuid && !seen.has(parsed.uuid)) {
        seen.add(parsed.uuid)
        messages.push(parsed)
      }
    } catch {
      // Corrupt line — if it's the last non-empty line, this is expected
      // (partial write from a crash). Log and skip.
      const isLastNonEmpty = lines.slice(i + 1).every((l) => !l.trim())
      if (isLastNonEmpty) {
        logger.warn(
          `[ConversationPersistence] Skipping corrupt last line in ${workspaceId}.messages.jsonl`,
        )
      } else {
        logger.warn(
          `[ConversationPersistence] Skipping corrupt line ${i + 1} in ${workspaceId}.messages.jsonl`,
        )
      }
    }
  }

  // Sort by timestamp for correct ordering across concurrent agent writes
  messages.sort((a, b) => {
    // Primary: isoTimestamp (ISO 8601 strings sort lexicographically)
    if (a.isoTimestamp && b.isoTimestamp) {
      return a.isoTimestamp < b.isoTimestamp ? -1 : a.isoTimestamp > b.isoTimestamp ? 1 : 0
    }
    // Fallback: numeric timestamp
    return (a.timestamp ?? 0) - (b.timestamp ?? 0)
  })

  return messages
}

// -----------------------------------------------------------------------------
// Load messages filtered by conversation ID
// -----------------------------------------------------------------------------

/**
 * Load messages for a specific conversation from the JSONL sidecar.
 */
export async function loadConversationMessages(
  workspaceId: string,
  conversationId: string,
): Promise<PersistedMessage[]> {
  const all = await loadMessages(workspaceId)
  return all.filter((m) => m.conversationId === conversationId)
}

// -----------------------------------------------------------------------------
// Migration — JSON inline messages → JSONL sidecar
// -----------------------------------------------------------------------------

/**
 * Enrich a Message with UUID and ISO timestamp for JSONL persistence.
 */
export function enrichMessage(
  message: Message,
  conversationId: string,
): PersistedMessage {
  return {
    ...message,
    uuid: (message as PersistedMessage).uuid || randomUUID(),
    isoTimestamp:
      (message as PersistedMessage).isoTimestamp ||
      new Date(message.timestamp || Date.now()).toISOString(),
    conversationId,
  }
}

/**
 * Migrate inline messages from workspace JSON to JSONL sidecar.
 *
 * Idempotent:
 * - If JSONL exists AND JSON still has messages → trust JSONL, dedup on UUID.
 * - If JSONL doesn't exist AND JSON has messages → create JSONL, backup JSON.
 * - If JSONL exists AND JSON has no messages → no-op.
 *
 * Returns true if migration was performed, false if no-op.
 */
export async function migrateInlineMessages(
  workspaceId: string,
  workspaceJsonPath: string,
): Promise<boolean> {
  const sidecarPath = jsonlPath(workspaceId)

  // Read the workspace JSON
  let workspaceContent: string
  try {
    workspaceContent = await fs.readFile(workspaceJsonPath, 'utf-8')
  } catch {
    return false // workspace file doesn't exist
  }

  let workspaceData: Record<string, unknown>
  try {
    workspaceData = JSON.parse(workspaceContent) as Record<string, unknown>
  } catch {
    return false // corrupt workspace file
  }

  // Find conversation nodes with inline messages
  const nodes = workspaceData.nodes as
    | Array<{ id: string; data: Record<string, unknown> }>
    | undefined
  if (!nodes || !Array.isArray(nodes)) return false

  const conversationNodes = nodes.filter(
    (n) =>
      n.data?.type === 'conversation' &&
      Array.isArray(n.data.messages) &&
      (n.data.messages as unknown[]).length > 0,
  )

  if (conversationNodes.length === 0) return false // nothing to migrate

  // Check if JSONL sidecar already exists
  let sidecarExists = false
  try {
    await fs.access(sidecarPath)
    sidecarExists = true
  } catch {
    // doesn't exist
  }

  if (sidecarExists) {
    // JSONL exists — trust it. Load existing UUIDs for dedup.
    const existingMessages = await loadMessages(workspaceId)
    const existingUuids = new Set(existingMessages.map((m) => m.uuid))

    // Enrich and append only new messages
    const newMessages: PersistedMessage[] = []
    for (const node of conversationNodes) {
      const messages = node.data.messages as Message[]
      for (const msg of messages) {
        const enriched = enrichMessage(msg, node.id)
        if (!existingUuids.has(enriched.uuid)) {
          newMessages.push(enriched)
        }
      }
    }

    if (newMessages.length > 0) {
      const lines =
        newMessages.map((m) => JSON.stringify(m)).join('\n') + '\n'
      await fs.appendFile(sidecarPath, lines, 'utf-8')
    }
  } else {
    // No JSONL — create backup and extract messages

    // 1. Backup workspace JSON
    const bkPath = backupPath(workspaceId)
    try {
      await fs.copyFile(workspaceJsonPath, bkPath)
      logger.log(
        `[ConversationPersistence] Backed up workspace JSON to ${bkPath}`,
      )
    } catch (err) {
      logger.error(
        `[ConversationPersistence] Failed to backup workspace JSON:`,
        err,
      )
      return false // don't migrate without backup
    }

    // 2. Extract messages to JSONL
    const allMessages: PersistedMessage[] = []
    for (const node of conversationNodes) {
      const messages = node.data.messages as Message[]
      for (const msg of messages) {
        allMessages.push(enrichMessage(msg, node.id))
      }
    }

    // Sort by timestamp before writing
    allMessages.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))

    const lines =
      allMessages.map((m) => JSON.stringify(m)).join('\n') + '\n'
    await fs.writeFile(sidecarPath, lines, 'utf-8')
    logger.log(
      `[ConversationPersistence] Migrated ${allMessages.length} messages to JSONL`,
    )
  }

  // 3. Strip messages from workspace JSON (keep empty arrays)
  let modified = false
  for (const node of conversationNodes) {
    if (
      Array.isArray(node.data.messages) &&
      (node.data.messages as unknown[]).length > 0
    ) {
      node.data.messages = []
      modified = true
    }
  }

  if (modified) {
    // Write stripped workspace JSON (atomic via tmp+rename)
    const tmpPath = workspaceJsonPath + '.tmp'
    await fs.writeFile(
      tmpPath,
      JSON.stringify(workspaceData, null, 2),
      'utf-8',
    )
    await fs.rename(tmpPath, workspaceJsonPath)
    logger.log(
      `[ConversationPersistence] Stripped inline messages from workspace JSON`,
    )
  }

  return true
}

// -----------------------------------------------------------------------------
// IPC Handlers
// -----------------------------------------------------------------------------

export function registerConversationPersistenceHandlers(): void {
  // Append a message to the JSONL sidecar (crash-safe: call BEFORE API call)
  ipcMain.handle(
    'conversation:appendMessage',
    async (
      _event,
      workspaceId: string,
      conversationId: string,
      message: Message,
    ) => {
      try {
        const persisted = enrichMessage(message, conversationId)
        await appendMessage(workspaceId, persisted)
        return { success: true, uuid: persisted.uuid }
      } catch (error) {
        logger.error(
          `[ConversationPersistence] Failed to append message:`,
          error,
        )
        return { success: false, error: String(error) }
      }
    },
  )

  // Load all messages for a conversation
  ipcMain.handle(
    'conversation:loadMessages',
    async (_event, workspaceId: string, conversationId: string) => {
      try {
        const messages = await loadConversationMessages(
          workspaceId,
          conversationId,
        )
        return { success: true, data: messages }
      } catch (error) {
        logger.error(
          `[ConversationPersistence] Failed to load messages:`,
          error,
        )
        return { success: false, error: String(error) }
      }
    },
  )

  // Load ALL messages across all conversations in a workspace
  ipcMain.handle(
    'conversation:loadAllMessages',
    async (_event, workspaceId: string) => {
      try {
        const messages = await loadMessages(workspaceId)
        return { success: true, data: messages }
      } catch (error) {
        logger.error(
          `[ConversationPersistence] Failed to load all messages:`,
          error,
        )
        return { success: false, error: String(error) }
      }
    },
  )

  // Run migration (called on workspace load)
  ipcMain.handle(
    'conversation:migrate',
    async (_event, workspaceId: string) => {
      try {
        const workspaceJsonPath = join(
          WORKSPACES_DIR(),
          `${workspaceId}.json`,
        )
        const migrated = await migrateInlineMessages(
          workspaceId,
          workspaceJsonPath,
        )
        return { success: true, migrated }
      } catch (error) {
        logger.error(
          `[ConversationPersistence] Migration failed:`,
          error,
        )
        return { success: false, error: String(error) }
      }
    },
  )
}
