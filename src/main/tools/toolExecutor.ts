// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tool Executor — shared execution layer for both API and SDK paths.
 *
 * Validates input against the tool's Zod schema, checks permissions if
 * defined, executes the tool, and applies context modifiers from the result.
 * Errors are returned as error ToolResults — never thrown.
 *
 * Extended with:
 *  - Concurrent execution (read-write lock pattern)
 *  - Three-level abort system
 *  - Tool output management (dedup, size caps, temp spill)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ExecutionContext, NormalizedToolCall, Tool, ToolPool, ToolResult } from './types'

// ---------------------------------------------------------------------------
// Constants — Output Management
// ---------------------------------------------------------------------------

/** Sentinel returned when a read_file result is identical to a prior read. */
export const FILE_UNCHANGED_STUB =
  '[FILE_UNCHANGED] Content identical to previous read — omitted to save tokens.'

/** Maximum bytes per tool result kept in memory (8 MB). */
const MAX_RESULT_MEMORY_BYTES = 8 * 1024 * 1024

/** Maximum characters for text results kept inline in conversation history. */
const MAX_INLINE_TEXT_CHARS = 30_000

/** Maximum characters for spilled text result files. */
const MAX_SPILL_TEXT_CHARS = 100_000

/** Maximum concurrent read-only tool executions. */
const MAX_CONCURRENT_READS = 10

/** Maximum milliseconds a single tool call may run before being timed out. */
const TOOL_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an error ToolResult with a descriptive message. */
function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}

/** Calculate approximate byte size of a ToolResult's text content. */
function resultByteSize(result: ToolResult): number {
  let bytes = 0
  for (const block of result.content) {
    if (block.type === 'text') {
      // UTF-8 approximation: use Buffer if available, else assume 2 bytes/char
      bytes +=
        typeof Buffer !== 'undefined'
          ? Buffer.byteLength(block.text, 'utf-8')
          : block.text.length * 2
    } else if (block.type === 'image') {
      // Base64 data size ≈ original * 4/3
      bytes += block.source.data.length
    }
  }
  return bytes
}

/** Concatenate all text blocks from a ToolResult. */
function resultTextContent(result: ToolResult): string {
  return result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Temp directory management
// ---------------------------------------------------------------------------

/** Ensure the workspace temp directory exists and return its path. */
function ensureTempDir(workspacePath: string): string {
  const tempDir = path.join(workspacePath, '.cognograph', 'temp')
  fs.mkdirSync(tempDir, { recursive: true })
  return tempDir
}

/** Spill a large result to a temp file, return a stub ToolResult with the path. */
function spillToTemp(result: ToolResult, workspacePath: string, callId: string): ToolResult {
  const tempDir = ensureTempDir(workspacePath)
  const fileName = `tool-result-${callId}-${Date.now()}.txt`
  const filePath = path.join(tempDir, fileName)

  let text = resultTextContent(result)

  // Truncate to max spill size
  if (text.length > MAX_SPILL_TEXT_CHARS) {
    text = text.slice(0, MAX_SPILL_TEXT_CHARS) + '\n\n[TRUNCATED — exceeded 100K char limit]'
  }

  fs.writeFileSync(filePath, text, 'utf-8')

  return {
    content: [
      {
        type: 'text',
        text: `[SPILLED TO DISK] Result exceeded memory cap. Full output at: ${filePath}`,
      },
    ],
    isError: result.isError,
  }
}

/**
 * Clean up all temp files in the workspace temp directory.
 * Call this on workspace close.
 */
export function cleanupTempDir(workspacePath: string): void {
  const tempDir = path.join(workspacePath, '.cognograph', 'temp')
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir)
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(tempDir, file))
        } catch {
          // Best-effort cleanup — ignore individual file errors
        }
      }
    }
  } catch {
    // Temp dir may not exist — that's fine
  }
}

// ---------------------------------------------------------------------------
// Output Management
// ---------------------------------------------------------------------------

/**
 * Apply output management to a tool result:
 *  - FILE_UNCHANGED_STUB for duplicate reads
 *  - 8MB memory cap with spill to temp
 *  - 30K char inline cap for conversation history
 */
function manageOutput(
  result: ToolResult,
  call: NormalizedToolCall,
  readCache: Map<string, string>,
  workspacePath: string | undefined,
): ToolResult {
  if (result.isError) return result

  // --- Duplicate read detection ---
  // Check for file read tools — if the text content matches a prior read, stub it
  const text = resultTextContent(result)
  const cacheKey = `${call.name}:${JSON.stringify(call.input)}`

  if (text.length > 0) {
    const previousContent = readCache.get(cacheKey)
    if (previousContent !== undefined && previousContent === text) {
      return {
        content: [{ type: 'text', text: FILE_UNCHANGED_STUB }],
      }
    }
    // Store for future comparison
    readCache.set(cacheKey, text)
  }

  // --- Memory cap: spill large results ---
  const byteSize = resultByteSize(result)
  if (byteSize > MAX_RESULT_MEMORY_BYTES && workspacePath) {
    return spillToTemp(result, workspacePath, call.id)
  }

  // --- Inline text cap: truncate for conversation history ---
  if (text.length > MAX_INLINE_TEXT_CHARS) {
    const truncated =
      text.slice(0, MAX_INLINE_TEXT_CHARS) +
      '\n\n[TRUNCATED — showing first 30K chars. Full result available via tool output.]'

    // If we can spill, save the full result
    if (workspacePath) {
      spillToTemp(result, workspacePath, call.id)
    }

    return {
      content: [{ type: 'text', text: truncated }],
      contextModifier: result.contextModifier,
      isError: result.isError,
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// ReadWriteLock — concurrent read, exclusive write
// ---------------------------------------------------------------------------

/**
 * Read-write lock for tool execution.
 *
 * - Multiple readers can run simultaneously (up to MAX_CONCURRENT_READS).
 * - A writer waits for all readers to finish, then runs exclusively.
 * - New readers wait while a writer is pending or running.
 */
export class ReadWriteLock {
  private _activeReaders = 0
  private _writerActive = false
  private _writerWaiting = false
  private _readQueue: Array<() => void> = []
  private _writeQueue: Array<() => void> = []

  get activeReaders(): number {
    return this._activeReaders
  }

  get writerActive(): boolean {
    return this._writerActive
  }

  async acquireRead(): Promise<void> {
    if (!this._writerActive && !this._writerWaiting && this._activeReaders < MAX_CONCURRENT_READS) {
      this._activeReaders++
      return
    }

    return new Promise<void>((resolve) => {
      this._readQueue.push(() => {
        this._activeReaders++
        resolve()
      })
    })
  }

  releaseRead(): void {
    this._activeReaders--

    // If no more readers and a writer is waiting, let it through
    if (this._activeReaders === 0 && this._writeQueue.length > 0) {
      this._writerWaiting = false
      this._writerActive = true
      const next = this._writeQueue.shift()
      next?.()
    }
  }

  async acquireWrite(): Promise<void> {
    if (!this._writerActive && this._activeReaders === 0 && !this._writerWaiting) {
      this._writerActive = true
      return
    }

    this._writerWaiting = true

    return new Promise<void>((resolve) => {
      this._writeQueue.push(() => {
        resolve()
      })
    })
  }

  releaseWrite(): void {
    this._writerActive = false
    this._writerWaiting = false

    // Drain as many readers as possible from the queue
    while (
      this._readQueue.length > 0 &&
      this._activeReaders < MAX_CONCURRENT_READS &&
      this._writeQueue.length === 0
    ) {
      const next = this._readQueue.shift()
      next?.()
    }

    // If no readers were queued but a writer is, let the writer through
    if (this._activeReaders === 0 && this._writeQueue.length > 0) {
      this._writerWaiting = false
      this._writerActive = true
      const next = this._writeQueue.shift()
      next?.()
    }
  }
}

// ---------------------------------------------------------------------------
// Three-Level Abort
// ---------------------------------------------------------------------------

/**
 * Abort level tracking for the three-level abort system.
 *
 *  - Level 0: No abort requested
 *  - Level 1: Cooperative cancel — tools with `interruptBehavior: 'cancel'` are aborted
 *  - Level 2: Force cancel — also cancels `interruptBehavior: 'block'` tools
 *  - Level 3: Hard kill — reject all pending promises immediately
 */
export type AbortLevel = 0 | 1 | 2 | 3

export class AbortTracker {
  private _level: AbortLevel = 0
  private _controller: AbortController

  constructor() {
    this._controller = new AbortController()
  }

  get level(): AbortLevel {
    return this._level
  }

  get signal(): AbortSignal {
    return this._controller.signal
  }

  /**
   * Escalate the abort level. Each call advances by one level.
   * Returns the new level.
   */
  escalate(): AbortLevel {
    if (this._level === 0) {
      this._level = 1
      this._controller.abort(new Error('AbortLevel1: cooperative cancel'))
    } else if (this._level === 1) {
      this._level = 2
      // Signal is already aborted — level is tracked separately
    } else if (this._level >= 2) {
      this._level = 3
    }
    return this._level
  }

  /** Check if a tool should be aborted at the current level. */
  shouldAbort(tool: Tool): boolean {
    if (this._level === 0) return false
    if (this._level >= 3) return true // Hard kill — everything dies
    if (this._level >= 2) return true // Force cancel — even 'block' tools
    // Level 1: only cancel tools with 'cancel' behavior
    return tool.interruptBehavior === 'cancel'
  }

  /** Reset abort state for a new execution batch. */
  reset(): void {
    this._level = 0
    this._controller = new AbortController()
  }
}

// ---------------------------------------------------------------------------
// Public API — Single Execution (original)
// ---------------------------------------------------------------------------

/**
 * Execute a single tool call against the pool.
 *
 * Flow:
 *  1. Look up tool in pool (error if not found)
 *  2. Validate input against tool's Zod schema (error if invalid)
 *  3. Check permissions if tool defines checkPermissions() (error on deny)
 *  4. Call tool.call() with validated input
 *  5. Apply contextModifier from result if present
 *  6. Return the ToolResult (never throws — errors wrapped in ToolResult)
 *
 * @param call - The normalized tool call to execute
 * @param pool - The assembled tool pool
 * @param ctx  - Current execution context (may be mutated via contextModifier)
 * @returns The tool result, with isError=true on failure
 */
export async function executeToolCall(
  call: NormalizedToolCall,
  pool: ToolPool,
  ctx: ExecutionContext,
): Promise<{ result: ToolResult; updatedContext: ExecutionContext }> {
  // 1. Tool lookup
  const tool = pool.get(call.name)
  if (!tool) {
    return {
      result: errorResult(
        `Tool "${call.name}" not found. Available tools: ${pool
          .list()
          .map((t) => t.name)
          .join(', ')}`,
      ),
      updatedContext: ctx,
    }
  }

  // 2. Zod schema validation
  const parseResult = tool.inputSchema.safeParse(call.input)
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return {
      result: errorResult(`Invalid input for tool "${call.name}": ${issues}`),
      updatedContext: ctx,
    }
  }

  // 3. Permission check
  if (tool.checkPermissions) {
    try {
      const verdict = await tool.checkPermissions(parseResult.data)
      if (verdict === 'deny') {
        return {
          result: errorResult(
            `Permission denied for tool "${call.name}". The operation was blocked by the permission policy.`,
          ),
          updatedContext: ctx,
        }
      }
      // 'ask' — for now, treat as allow (permission UI is RENDERER-PASSIVIZE scope)
      // 'allow' — proceed
    } catch (permError) {
      return {
        result: errorResult(
          `Permission check failed for tool "${call.name}": ${
            permError instanceof Error ? permError.message : String(permError)
          }`,
        ),
        updatedContext: ctx,
      }
    }
  }

  // 4. Execute tool (with per-tool timeout to prevent hanging)
  let result: ToolResult
  try {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Tool "${call.name}" timed out after ${TOOL_TIMEOUT_MS}ms`)),
        TOOL_TIMEOUT_MS,
      )
    })
    try {
      result = await Promise.race([tool.call(parseResult.data), timeoutPromise])
      clearTimeout(timeoutId)
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  } catch (callError) {
    return {
      result: errorResult(
        `Tool "${call.name}" threw an error: ${
          callError instanceof Error ? callError.message : String(callError)
        }`,
      ),
      updatedContext: ctx,
    }
  }

  // 5. Apply context modifier if present
  let updatedContext = ctx
  if (result.contextModifier) {
    try {
      updatedContext = result.contextModifier(ctx)
    } catch (modError) {
      // Context modifier failure is non-fatal — log but keep the result
      console.warn(
        `[ToolExecutor] Context modifier for "${call.name}" failed:`,
        modError instanceof Error ? modError.message : modError,
      )
    }
  }

  return { result, updatedContext }
}

// ---------------------------------------------------------------------------
// Public API — Concurrent Execution
// ---------------------------------------------------------------------------

/** Configuration for concurrent tool execution. */
export interface ConcurrentExecutionConfig {
  /** Workspace path for temp file spilling (required for output management). */
  workspacePath?: string
  /** AbortTracker for three-level abort (optional — no abort if omitted). */
  abortTracker?: AbortTracker
  /** Read cache for FILE_UNCHANGED_STUB dedup (shared across calls). */
  readCache?: Map<string, string>
}

/**
 * Execute multiple tool calls with concurrency control.
 *
 * Read-only tools (isReadOnly && isConcurrencySafe) run in parallel,
 * up to MAX_CONCURRENT_READS simultaneously. Write tools run exclusively
 * using a read-write lock pattern.
 *
 * @param calls - Tool calls to execute
 * @param pool  - The assembled tool pool
 * @param ctx   - Current execution context
 * @param config - Concurrent execution settings
 * @returns Array of results in the same order as calls, plus updated context
 */
export async function executeToolCallsConcurrently(
  calls: NormalizedToolCall[],
  pool: ToolPool,
  ctx: ExecutionContext,
  config: ConcurrentExecutionConfig = {},
): Promise<{ results: ToolResult[]; updatedContext: ExecutionContext }> {
  const { workspacePath, abortTracker, readCache = new Map<string, string>() } = config
  const lock = new ReadWriteLock()
  const results: ToolResult[] = new Array(calls.length)
  let currentCtx = ctx

  // Classify calls into read (concurrent) and write (exclusive)
  interface ClassifiedCall {
    index: number
    call: NormalizedToolCall
    tool: Tool | undefined
    isRead: boolean
  }

  const classified: ClassifiedCall[] = calls.map((call, index) => {
    const tool = pool.get(call.name)
    const isRead = tool ? tool.isReadOnly && tool.isConcurrencySafe : false
    return { index, call, tool, isRead }
  })

  // Execute a single call with lock acquisition and abort checking
  const executeSingle = async (c: ClassifiedCall): Promise<void> => {
    // Check abort before starting
    if (abortTracker && c.tool && abortTracker.shouldAbort(c.tool)) {
      results[c.index] = errorResult(
        `Tool "${c.call.name}" aborted (abort level ${abortTracker.level}).`,
      )
      return
    }

    // Hard kill check
    if (abortTracker && abortTracker.level >= 3) {
      results[c.index] = errorResult(`Tool "${c.call.name}" hard-killed (abort level 3).`)
      return
    }

    if (c.isRead) {
      await lock.acquireRead()
      try {
        // Re-check abort after acquiring lock
        if (abortTracker && c.tool && abortTracker.shouldAbort(c.tool)) {
          results[c.index] = errorResult(
            `Tool "${c.call.name}" aborted (abort level ${abortTracker.level}).`,
          )
          return
        }

        const { result, updatedContext } = await executeToolCall(c.call, pool, currentCtx)
        const managed = manageOutput(result, c.call, readCache, workspacePath)
        results[c.index] = managed
        currentCtx = updatedContext
      } finally {
        lock.releaseRead()
      }
    } else {
      await lock.acquireWrite()
      try {
        // Re-check abort after acquiring lock
        if (abortTracker && c.tool && abortTracker.shouldAbort(c.tool)) {
          results[c.index] = errorResult(
            `Tool "${c.call.name}" aborted (abort level ${abortTracker.level}).`,
          )
          return
        }

        const { result, updatedContext } = await executeToolCall(c.call, pool, currentCtx)
        const managed = manageOutput(result, c.call, readCache, workspacePath)
        results[c.index] = managed
        currentCtx = updatedContext
      } finally {
        lock.releaseWrite()
      }
    }
  }

  // Launch all executions — the lock controls actual concurrency
  const promises = classified.map((c) => executeSingle(c))
  await Promise.all(promises)

  return { results, updatedContext: currentCtx }
}
