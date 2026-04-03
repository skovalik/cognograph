// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Context Budget Manager — enforces a 200K aggregate token cap across all
 * concurrent agent conversations.
 *
 * When the cap is approached, older conversation results are frozen and
 * spilled to workspace-scoped temp files ({workspacePath}/.cognograph/temp/).
 * A 2KB preview is retained in memory for each spilled result.
 *
 * Integrates with:
 *  - tokenEstimation.ts for token counting
 *  - toolExecutor.ts for temp directory infrastructure
 *  - llmErrors.ts for 413 context-too-large error handling
 *  - claudeAgent.ts for per-request budget checks
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { estimateTokens } from './tokenEstimation'
import { logger } from '../utils/logger'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Aggregate token cap across all concurrent conversations. */
export const AGGREGATE_TOKEN_CAP = 200_000

/** Threshold percentage at which to start freezing old results. */
const FREEZE_THRESHOLD = 0.85

/** Maximum bytes for the in-memory preview of a spilled result. */
const PREVIEW_SIZE_BYTES = 2 * 1024 // 2KB

/** Maximum retries for context-too-large errors before surfacing to user. */
export const MAX_CONTEXT_RETRIES = 3

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tracked state for a single conversation's context. */
export interface ConversationBudgetEntry {
  conversationId: string
  /** Estimated token count for this conversation's context. */
  tokenCount: number
  /** Timestamp of last activity (ms since epoch). */
  lastActiveAt: number
  /** Whether this conversation has been frozen (no further tool execution). */
  frozen: boolean
  /** If spilled, the path to the temp file. */
  spillPath?: string
  /** If spilled, the in-memory preview (first 2KB of content). */
  spillPreview?: string
}

/** Result of a budget check. */
export interface BudgetCheckResult {
  /** Whether the operation is allowed within budget. */
  allowed: boolean
  /** Current aggregate token count. */
  aggregateTokens: number
  /** Number of conversations frozen to make room. */
  frozenCount: number
  /** If not allowed, the reason. */
  reason?: string
}

/** Result of a spill operation. */
export interface SpillResult {
  /** Path to the spilled file. */
  spillPath: string
  /** 2KB preview kept in memory. */
  preview: string
  /** Whether the spill file was verified to exist on disk. */
  verified: boolean
}

// ---------------------------------------------------------------------------
// Context Budget Manager
// ---------------------------------------------------------------------------

export class ContextBudgetManager {
  private _entries = new Map<string, ConversationBudgetEntry>()
  private _workspacePath: string | null = null

  /** Set the workspace path for temp file operations. */
  setWorkspacePath(workspacePath: string): void {
    this._workspacePath = workspacePath
  }

  /** Get the current workspace path. */
  get workspacePath(): string | null {
    return this._workspacePath
  }

  // -------------------------------------------------------------------------
  // Registration / tracking
  // -------------------------------------------------------------------------

  /**
   * Register or update a conversation's token count.
   * Call this after each LLM response to keep the aggregate accurate.
   */
  trackConversation(conversationId: string, tokenCount: number): void {
    const existing = this._entries.get(conversationId)
    if (existing) {
      existing.tokenCount = tokenCount
      existing.lastActiveAt = Date.now()
    } else {
      this._entries.set(conversationId, {
        conversationId,
        tokenCount,
        lastActiveAt: Date.now(),
        frozen: false,
      })
    }
  }

  /**
   * Unregister a conversation (e.g., on close).
   */
  untrackConversation(conversationId: string): void {
    this._entries.delete(conversationId)
  }

  // -------------------------------------------------------------------------
  // Budget queries
  // -------------------------------------------------------------------------

  /** Get the current aggregate token count across all conversations. */
  getAggregateTokens(): number {
    let total = 0
    for (const entry of this._entries.values()) {
      total += entry.tokenCount
    }
    return total
  }

  /** Check if a conversation is frozen. */
  isFrozen(conversationId: string): boolean {
    return this._entries.get(conversationId)?.frozen ?? false
  }

  /** Get all tracked entries (for diagnostics). */
  getEntries(): ReadonlyMap<string, ConversationBudgetEntry> {
    return this._entries
  }

  /** Get a specific entry. */
  getEntry(conversationId: string): ConversationBudgetEntry | undefined {
    return this._entries.get(conversationId)
  }

  // -------------------------------------------------------------------------
  // Budget enforcement
  // -------------------------------------------------------------------------

  /**
   * Check whether a conversation can proceed with additional tokens.
   * If the aggregate is approaching the cap, freeze the oldest inactive
   * conversations first.
   *
   * @param conversationId - The conversation requesting budget
   * @param additionalTokens - Estimated tokens for the next operation
   * @returns BudgetCheckResult indicating whether the operation is allowed
   */
  checkBudget(
    conversationId: string,
    additionalTokens: number,
  ): BudgetCheckResult {
    const currentAggregate = this.getAggregateTokens()
    const projectedAggregate = currentAggregate + additionalTokens

    // Well under budget — allow immediately
    if (projectedAggregate < AGGREGATE_TOKEN_CAP * FREEZE_THRESHOLD) {
      return {
        allowed: true,
        aggregateTokens: currentAggregate,
        frozenCount: 0,
      }
    }

    // Approaching or over cap — freeze oldest conversations (not the requesting one)
    const frozenCount = this._freezeOldest(conversationId)

    // Re-check after freezing
    const newAggregate = this.getAggregateTokens()
    const newProjected = newAggregate + additionalTokens

    if (newProjected <= AGGREGATE_TOKEN_CAP) {
      return {
        allowed: true,
        aggregateTokens: newAggregate,
        frozenCount,
      }
    }

    // Still over cap after freezing — reject
    return {
      allowed: false,
      aggregateTokens: newAggregate,
      frozenCount,
      reason:
        `Aggregate context budget exceeded: ${newProjected} tokens projected ` +
        `(cap: ${AGGREGATE_TOKEN_CAP}). ${frozenCount} conversation(s) frozen ` +
        `but insufficient to free enough budget.`,
    }
  }

  // -------------------------------------------------------------------------
  // Freeze & spill
  // -------------------------------------------------------------------------

  /**
   * Freeze the oldest inactive conversations to free budget.
   * Returns the number of conversations frozen.
   */
  private _freezeOldest(excludeConversationId: string): number {
    // Sort entries by lastActiveAt ascending (oldest first)
    const candidates = [...this._entries.values()]
      .filter(
        (e) => e.conversationId !== excludeConversationId && !e.frozen,
      )
      .sort((a, b) => a.lastActiveAt - b.lastActiveAt)

    let frozenCount = 0

    for (const entry of candidates) {
      // Freeze the conversation
      entry.frozen = true
      frozenCount++

      logger.debug(
        `[ContextBudget] Froze conversation ${entry.conversationId} ` +
        `(${entry.tokenCount} tokens, last active ${new Date(entry.lastActiveAt).toISOString()})`,
      )

      // Check if we're back under threshold
      const aggregate = this.getAggregateTokens()
      if (aggregate < AGGREGATE_TOKEN_CAP * FREEZE_THRESHOLD) {
        break
      }
    }

    return frozenCount
  }

  /**
   * Spill a conversation's result to a temp file on disk.
   * Retains a 2KB preview in memory.
   *
   * @param conversationId - The conversation to spill
   * @param content - The full content to spill
   * @returns SpillResult with the file path, preview, and verification status
   * @throws Error if no workspace path is configured
   */
  spillToDisk(conversationId: string, content: string): SpillResult {
    if (!this._workspacePath) {
      throw new Error(
        '[ContextBudget] Cannot spill: no workspace path configured.',
      )
    }

    const tempDir = path.join(this._workspacePath, '.cognograph', 'temp')
    fs.mkdirSync(tempDir, { recursive: true })

    const fileName = `context-spill-${conversationId}-${Date.now()}.txt`
    const spillPath = path.join(tempDir, fileName)

    fs.writeFileSync(spillPath, content, 'utf-8')

    // Generate 2KB preview
    const preview = content.slice(0, PREVIEW_SIZE_BYTES)

    // Verify the file exists before returning
    const verified = fs.existsSync(spillPath)

    if (!verified) {
      logger.warn(
        `[ContextBudget] Spill file verification FAILED for ${spillPath}`,
      )
    }

    // Update the entry
    const entry = this._entries.get(conversationId)
    if (entry) {
      entry.spillPath = spillPath
      entry.spillPreview = preview
      // Reduce the tracked token count to just the preview
      entry.tokenCount = estimateTokens(preview)
    }

    logger.debug(
      `[ContextBudget] Spilled conversation ${conversationId} to ${spillPath} ` +
      `(${content.length} chars, verified: ${verified})`,
    )

    return { spillPath, preview, verified }
  }

  /**
   * Verify that a spill file still exists on disk.
   * If deleted, surfaces the loss explicitly.
   *
   * @param conversationId - The conversation whose spill to verify
   * @returns The spill path if valid, or null with a logged warning if lost
   */
  verifySpillFile(conversationId: string): {
    valid: boolean
    path: string | undefined
    preview: string | undefined
    lostMessage?: string
  } {
    const entry = this._entries.get(conversationId)

    if (!entry?.spillPath) {
      return { valid: false, path: undefined, preview: undefined }
    }

    const exists = fs.existsSync(entry.spillPath)

    if (!exists) {
      const lostMessage =
        `[ContextBudget] Spill file LOST for conversation ${conversationId}: ` +
        `${entry.spillPath} was deleted externally. ` +
        `Only the 2KB preview survives.`

      logger.warn(lostMessage)

      return {
        valid: false,
        path: entry.spillPath,
        preview: entry.spillPreview,
        lostMessage,
      }
    }

    return {
      valid: true,
      path: entry.spillPath,
      preview: entry.spillPreview,
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Prune all spill files in the workspace temp directory.
   * Call this on workspace close.
   */
  pruneSpillFiles(): void {
    if (!this._workspacePath) return

    const tempDir = path.join(this._workspacePath, '.cognograph', 'temp')

    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir)
        let pruned = 0

        for (const file of files) {
          if (file.startsWith('context-spill-')) {
            try {
              fs.unlinkSync(path.join(tempDir, file))
              pruned++
            } catch {
              // Best-effort cleanup — ignore individual file errors
            }
          }
        }

        logger.debug(
          `[ContextBudget] Pruned ${pruned} spill file(s) from ${tempDir}`,
        )
      }
    } catch {
      // Temp dir may not exist — that's fine
    }

    // Clear all entries — always runs, even if temp dir is missing
    this._entries.clear()
  }

  /**
   * Reset the manager state (for testing or workspace close).
   */
  reset(): void {
    this._entries.clear()
    this._workspacePath = null
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

/** Global context budget manager instance. */
export const contextBudget = new ContextBudgetManager()

// ---------------------------------------------------------------------------
// 413 / context_length error recovery
// ---------------------------------------------------------------------------

/**
 * State tracker for error withholding per conversation.
 * Transient errors are withheld from the user for up to MAX_CONTEXT_RETRIES.
 */
export interface ErrorRetryState {
  conversationId: string
  retryCount: number
  lastError: string
  /** Whether compaction was attempted on the last retry. */
  compactionAttempted: boolean
}

const _errorRetryStates = new Map<string, ErrorRetryState>()

/**
 * Record a context-too-large error for a conversation.
 * Returns the current retry state including whether the error should
 * be surfaced to the user.
 */
export function recordContextError(
  conversationId: string,
  errorMessage: string,
): {
  shouldSurface: boolean
  retryCount: number
  state: ErrorRetryState
} {
  let state = _errorRetryStates.get(conversationId)

  if (!state) {
    state = {
      conversationId,
      retryCount: 0,
      lastError: errorMessage,
      compactionAttempted: false,
    }
    _errorRetryStates.set(conversationId, state)
  }

  state.retryCount++
  state.lastError = errorMessage
  state.compactionAttempted = true

  const shouldSurface = state.retryCount >= MAX_CONTEXT_RETRIES

  if (shouldSurface) {
    logger.warn(
      `[ContextBudget] Context error surfaced after ${state.retryCount} retries ` +
      `for conversation ${conversationId}: ${errorMessage}`,
    )
  } else {
    logger.debug(
      `[ContextBudget] Context error withheld (retry ${state.retryCount}/${MAX_CONTEXT_RETRIES}) ` +
      `for conversation ${conversationId}: ${errorMessage}`,
    )
  }

  return { shouldSurface, retryCount: state.retryCount, state }
}

/**
 * Clear the error retry state for a conversation (e.g., on success).
 */
export function clearContextErrorState(conversationId: string): void {
  _errorRetryStates.delete(conversationId)
}

/**
 * Get the current error retry state for a conversation.
 */
export function getContextErrorState(
  conversationId: string,
): ErrorRetryState | undefined {
  return _errorRetryStates.get(conversationId)
}

/**
 * Reset all error retry states (for testing).
 * @internal
 */
export function _resetErrorRetryStates(): void {
  _errorRetryStates.clear()
}
