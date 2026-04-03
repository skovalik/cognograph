// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { assembleToolPool } from '../assembleToolPool'
import { buildTool } from '../buildTool'
import {
  AbortTracker,
  cleanupTempDir,
  executeToolCall,
  executeToolCallsConcurrently,
  FILE_UNCHANGED_STUB,
  ReadWriteLock,
} from '../toolExecutor'
import type { ExecutionContext, NormalizedToolCall, Tool, ToolResult } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    workspaceId: 'ws-1',
    conversationId: 'conv-1',
    allowedPaths: ['/workspace'],
    messages: [],
    activeMcpServerIds: [],
    metadata: {},
    ...overrides,
  }
}

function makeCall(overrides: Partial<NormalizedToolCall> = {}): NormalizedToolCall {
  return {
    id: 'call-1',
    name: 'echo',
    input: { message: 'hello' },
    ...overrides,
  }
}

const echoTool = buildTool({
  name: 'echo',
  description: 'Echoes the message back',
  inputSchema: z.object({ message: z.string() }),
  isReadOnly: true,
  isConcurrencySafe: true,
  async call(input) {
    const { message } = input as { message: string }
    return { content: [{ type: 'text', text: `Echo: ${message}` }] }
  },
})

function makePool(tools: Tool[] = [echoTool]) {
  return assembleToolPool(tools, [])
}

// ---------------------------------------------------------------------------
// Tool not found
// ---------------------------------------------------------------------------

describe('executeToolCall — tool not found', () => {
  it('returns error result when tool is not in pool', async () => {
    const pool = makePool()
    const call = makeCall({ name: 'nonexistent' })
    const ctx = makeContext()

    const { result, updatedContext } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('not found'),
    })
    // Context should be unchanged
    expect(updatedContext).toBe(ctx)
  })
})

// ---------------------------------------------------------------------------
// Zod validation
// ---------------------------------------------------------------------------

describe('executeToolCall — Zod validation', () => {
  it('validates input against tool schema before calling', async () => {
    const pool = makePool()
    const call = makeCall({ input: { message: 42 } }) // message should be string
    const ctx = makeContext()

    const { result } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Invalid input'),
    })
  })

  it('passes validation with correct input', async () => {
    const pool = makePool()
    const call = makeCall({ input: { message: 'valid' } })
    const ctx = makeContext()

    const { result } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBeUndefined()
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: 'Echo: valid',
    })
  })

  it('includes field path in validation error message', async () => {
    const pool = makePool()
    const call = makeCall({ input: {} }) // missing required "message"
    const ctx = makeContext()

    const { result } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('message'),
    })
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('executeToolCall — error handling', () => {
  it('wraps thrown errors in error ToolResult (never throws)', async () => {
    const throwingTool = buildTool({
      name: 'thrower',
      description: 'Always throws',
      inputSchema: z.object({}),
      async call() {
        throw new Error('Boom!')
      },
    })

    const pool = makePool([throwingTool])
    const call = makeCall({ name: 'thrower', input: {} })
    const ctx = makeContext()

    // Should NOT throw
    const { result } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Boom!'),
    })
  })

  it('handles non-Error thrown values', async () => {
    const throwingTool = buildTool({
      name: 'string_thrower',
      description: 'Throws a string',
      inputSchema: z.object({}),
      async call() {
        throw 'string error' // eslint-disable-line no-throw-literal
      },
    })

    const pool = makePool([throwingTool])
    const call = makeCall({ name: 'string_thrower', input: {} })
    const ctx = makeContext()

    const { result } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('string error'),
    })
  })
})

// ---------------------------------------------------------------------------
// Permission check
// ---------------------------------------------------------------------------

describe('executeToolCall — permission check', () => {
  it('denies execution when checkPermissions returns deny', async () => {
    const guardedTool = buildTool({
      name: 'guarded',
      description: 'Has permission check',
      inputSchema: z.object({ action: z.string() }),
      async checkPermissions() {
        return 'deny'
      },
      async call() {
        return { content: [{ type: 'text', text: 'should not reach' }] }
      },
    })

    const pool = makePool([guardedTool])
    const call = makeCall({ name: 'guarded', input: { action: 'delete' } })
    const ctx = makeContext()

    const { result } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Permission denied'),
    })
  })

  it('allows execution when checkPermissions returns allow', async () => {
    const guardedTool = buildTool({
      name: 'guarded_allow',
      description: 'Always allows',
      inputSchema: z.object({ action: z.string() }),
      async checkPermissions() {
        return 'allow'
      },
      async call(input) {
        const { action } = input as { action: string }
        return { content: [{ type: 'text', text: `Did: ${action}` }] }
      },
    })

    const pool = makePool([guardedTool])
    const call = makeCall({ name: 'guarded_allow', input: { action: 'read' } })
    const ctx = makeContext()

    const { result } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBeUndefined()
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: 'Did: read',
    })
  })

  it('handles checkPermissions throwing an error', async () => {
    const guardedTool = buildTool({
      name: 'guarded_error',
      description: 'Permission check throws',
      inputSchema: z.object({}),
      async checkPermissions() {
        throw new Error('Permission service down')
      },
      async call() {
        return { content: [{ type: 'text', text: 'should not reach' }] }
      },
    })

    const pool = makePool([guardedTool])
    const call = makeCall({ name: 'guarded_error', input: {} })
    const ctx = makeContext()

    const { result } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Permission check failed'),
    })
  })

  it('treats ask verdict as allow (permission UI is out of scope)', async () => {
    const askTool = buildTool({
      name: 'ask_tool',
      description: 'Returns ask verdict',
      inputSchema: z.object({}),
      async checkPermissions() {
        return 'ask'
      },
      async call() {
        return { content: [{ type: 'text', text: 'executed' }] }
      },
    })

    const pool = makePool([askTool])
    const call = makeCall({ name: 'ask_tool', input: {} })
    const ctx = makeContext()

    const { result } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBeUndefined()
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: 'executed',
    })
  })
})

// ---------------------------------------------------------------------------
// Context modifier
// ---------------------------------------------------------------------------

describe('executeToolCall — context modifier', () => {
  it('applies contextModifier from result to produce updated context', async () => {
    const modifierTool = buildTool({
      name: 'modifier',
      description: 'Returns a context modifier',
      inputSchema: z.object({}),
      async call(): Promise<ToolResult> {
        return {
          content: [{ type: 'text', text: 'modified' }],
          contextModifier: (ctx) => ({
            ...ctx,
            metadata: { ...ctx.metadata, modified: true },
          }),
        }
      },
    })

    const pool = makePool([modifierTool])
    const call = makeCall({ name: 'modifier', input: {} })
    const ctx = makeContext()

    const { result, updatedContext } = await executeToolCall(call, pool, ctx)

    expect(result.isError).toBeUndefined()
    expect(updatedContext).not.toBe(ctx) // New object
    expect(updatedContext.metadata).toEqual({ modified: true })
  })

  it('preserves original context when no contextModifier', async () => {
    const pool = makePool()
    const call = makeCall()
    const ctx = makeContext()

    const { updatedContext } = await executeToolCall(call, pool, ctx)

    expect(updatedContext).toBe(ctx) // Same reference
  })

  it('handles contextModifier throwing (non-fatal)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const badModTool = buildTool({
      name: 'bad_mod',
      description: 'Modifier throws',
      inputSchema: z.object({}),
      async call(): Promise<ToolResult> {
        return {
          content: [{ type: 'text', text: 'ok' }],
          contextModifier: () => {
            throw new Error('Modifier crash')
          },
        }
      },
    })

    const pool = makePool([badModTool])
    const call = makeCall({ name: 'bad_mod', input: {} })
    const ctx = makeContext()

    const { result, updatedContext } = await executeToolCall(call, pool, ctx)

    // Result still returned successfully
    expect(result.isError).toBeUndefined()
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'ok' })
    // Context unchanged due to modifier failure
    expect(updatedContext).toBe(ctx)
    // Warning logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Context modifier'),
      expect.stringContaining('Modifier crash'),
    )

    consoleSpy.mockRestore()
  })
})

// ===========================================================================
// Concurrent Execution
// ===========================================================================

describe('executeToolCallsConcurrently — parallel reads', () => {
  it('executes read-only tools concurrently', async () => {
    const executionOrder: string[] = []

    const slowRead = buildTool({
      name: 'slow_read',
      description: 'Slow read',
      inputSchema: z.object({ id: z.string() }),
      isReadOnly: true,
      isConcurrencySafe: true,
      async call(input) {
        const { id } = input as { id: string }
        executionOrder.push(`start:${id}`)
        await new Promise((r) => setTimeout(r, 50))
        executionOrder.push(`end:${id}`)
        return { content: [{ type: 'text', text: `read:${id}` }] }
      },
    })

    const pool = makePool([slowRead])
    const ctx = makeContext()

    const calls: NormalizedToolCall[] = [
      { id: 'c1', name: 'slow_read', input: { id: 'A' } },
      { id: 'c2', name: 'slow_read', input: { id: 'B' } },
      { id: 'c3', name: 'slow_read', input: { id: 'C' } },
    ]

    const { results } = await executeToolCallsConcurrently(calls, pool, ctx)

    // All three should complete successfully
    expect(results).toHaveLength(3)
    expect(results[0]!.content[0]).toMatchObject({ type: 'text', text: 'read:A' })
    expect(results[1]!.content[0]).toMatchObject({ type: 'text', text: 'read:B' })
    expect(results[2]!.content[0]).toMatchObject({ type: 'text', text: 'read:C' })

    // Verify concurrent execution: all starts should happen before all ends
    // (if they were sequential, we'd see start:A, end:A, start:B, end:B, ...)
    const starts = executionOrder.filter((e) => e.startsWith('start:'))
    const firstEnd = executionOrder.findIndex((e) => e.startsWith('end:'))
    // At least 2 starts should happen before the first end
    expect(starts.length).toBeGreaterThanOrEqual(2)
    const startsBeforeFirstEnd = executionOrder
      .slice(0, firstEnd)
      .filter((e) => e.startsWith('start:'))
    expect(startsBeforeFirstEnd.length).toBeGreaterThanOrEqual(2)
  })
})

describe('executeToolCallsConcurrently — write exclusivity', () => {
  it('writes execute exclusively (no overlap)', async () => {
    let concurrentWrites = 0
    let maxConcurrentWrites = 0

    const writeTool = buildTool({
      name: 'write_file',
      description: 'Writes a file',
      inputSchema: z.object({ path: z.string() }),
      isReadOnly: false,
      isConcurrencySafe: false,
      async call(input) {
        concurrentWrites++
        maxConcurrentWrites = Math.max(maxConcurrentWrites, concurrentWrites)
        await new Promise((r) => setTimeout(r, 30))
        concurrentWrites--
        const { path: p } = input as { path: string }
        return { content: [{ type: 'text', text: `wrote:${p}` }] }
      },
    })

    const pool = makePool([writeTool])
    const ctx = makeContext()

    const calls: NormalizedToolCall[] = [
      { id: 'w1', name: 'write_file', input: { path: '/a' } },
      { id: 'w2', name: 'write_file', input: { path: '/b' } },
      { id: 'w3', name: 'write_file', input: { path: '/c' } },
    ]

    const { results } = await executeToolCallsConcurrently(calls, pool, ctx)

    // All should complete
    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(r!.isError).toBeUndefined()
    }

    // Should never have more than 1 write running at a time
    expect(maxConcurrentWrites).toBe(1)
  })
})

// ===========================================================================
// ReadWriteLock
// ===========================================================================

describe('ReadWriteLock', () => {
  it('allows multiple concurrent readers', async () => {
    const lock = new ReadWriteLock()

    await lock.acquireRead()
    await lock.acquireRead()
    await lock.acquireRead()

    expect(lock.activeReaders).toBe(3)

    lock.releaseRead()
    lock.releaseRead()
    lock.releaseRead()

    expect(lock.activeReaders).toBe(0)
  })

  it('caps concurrent readers at MAX_CONCURRENT_READS (10)', async () => {
    const lock = new ReadWriteLock()

    // Acquire 10 readers — all should succeed immediately
    for (let i = 0; i < 10; i++) {
      await lock.acquireRead()
    }
    expect(lock.activeReaders).toBe(10)

    // 11th reader should be queued, not immediately granted
    let eleventhAcquired = false
    const eleventhPromise = lock.acquireRead().then(() => {
      eleventhAcquired = true
    })

    // Give microtask queue a tick — 11th should still be waiting
    await new Promise((r) => setTimeout(r, 10))
    expect(eleventhAcquired).toBe(false)
    expect(lock.activeReaders).toBe(10)

    // Release one reader — 11th should now acquire
    lock.releaseRead()
    // releaseRead doesn't drain read queue (only releaseWrite does),
    // so releasing a reader while at cap doesn't unblock queued readers
    // unless a writer cycle happens. The lock prevents exceeding the cap.
    // To verify: release all 9 remaining + trigger write cycle to flush
    for (let i = 0; i < 9; i++) {
      lock.releaseRead()
    }
    // With 0 active readers and no writer, the 11th is still queued
    // because the read queue only drains on releaseWrite.
    // Acquire and release a writer to flush the queue.
    await lock.acquireWrite()
    lock.releaseWrite()
    await eleventhPromise

    expect(eleventhAcquired).toBe(true)
    lock.releaseRead()
  })

  it('writer waits for ALL active readers to finish', async () => {
    const lock = new ReadWriteLock()
    const events: string[] = []

    // Acquire 3 readers
    await lock.acquireRead()
    await lock.acquireRead()
    await lock.acquireRead()
    events.push('3-readers-acquired')

    // Writer should queue — 3 readers still active
    const writerPromise = lock.acquireWrite().then(() => {
      events.push('write-acquired')
    })

    await new Promise((r) => setTimeout(r, 10))
    expect(events).toEqual(['3-readers-acquired'])
    expect(lock.writerActive).toBe(false)

    // Release 2 of 3 readers — writer should STILL be waiting
    lock.releaseRead()
    lock.releaseRead()
    await new Promise((r) => setTimeout(r, 10))
    expect(events).toEqual(['3-readers-acquired'])
    expect(lock.activeReaders).toBe(1)

    // Release the last reader — writer should now acquire
    lock.releaseRead()
    await writerPromise

    expect(events).toEqual(['3-readers-acquired', 'write-acquired'])
    expect(lock.writerActive).toBe(true)
    lock.releaseWrite()
  })

  it('writer waits for readers to finish', async () => {
    const lock = new ReadWriteLock()
    const events: string[] = []

    await lock.acquireRead()
    events.push('read-acquired')

    // Writer should queue
    const writerPromise = lock.acquireWrite().then(() => {
      events.push('write-acquired')
    })

    // Give microtask queue a tick
    await new Promise((r) => setTimeout(r, 10))

    // Writer should NOT have acquired yet
    expect(events).toEqual(['read-acquired'])

    // Release reader — writer should now acquire
    lock.releaseRead()
    await writerPromise

    expect(events).toEqual(['read-acquired', 'write-acquired'])
    lock.releaseWrite()
  })

  it('readers wait while writer is active', async () => {
    const lock = new ReadWriteLock()
    const events: string[] = []

    await lock.acquireWrite()
    events.push('write-acquired')

    // Reader should queue
    const readerPromise = lock.acquireRead().then(() => {
      events.push('read-acquired')
    })

    await new Promise((r) => setTimeout(r, 10))
    expect(events).toEqual(['write-acquired'])

    lock.releaseWrite()
    await readerPromise

    expect(events).toEqual(['write-acquired', 'read-acquired'])
    lock.releaseRead()
  })

  it('no new reads start while a writer is waiting', async () => {
    const lock = new ReadWriteLock()
    const events: string[] = []

    // Acquire a reader first
    await lock.acquireRead()
    events.push('first-read')

    // Writer queues behind the reader
    const writerPromise = lock.acquireWrite().then(() => {
      events.push('write-acquired')
    })

    await new Promise((r) => setTimeout(r, 10))

    // Now try to acquire another reader — it should queue behind the writer
    let secondReadAcquired = false
    const secondReaderPromise = lock.acquireRead().then(() => {
      secondReadAcquired = true
      events.push('second-read')
    })

    await new Promise((r) => setTimeout(r, 10))
    // Second reader should NOT have acquired — writer is waiting
    expect(secondReadAcquired).toBe(false)

    // Release first reader — writer should acquire, NOT the second reader
    lock.releaseRead()
    await writerPromise

    expect(events).toEqual(['first-read', 'write-acquired'])
    expect(secondReadAcquired).toBe(false)

    // Release writer — now the second reader should acquire
    lock.releaseWrite()
    await secondReaderPromise

    expect(events).toEqual(['first-read', 'write-acquired', 'second-read'])
    lock.releaseRead()
  })
})

// ===========================================================================
// Three-Level Abort
// ===========================================================================

describe('AbortTracker', () => {
  it('starts at level 0', () => {
    const tracker = new AbortTracker()
    expect(tracker.level).toBe(0)
  })

  it('escalates through levels 1, 2, 3', () => {
    const tracker = new AbortTracker()

    expect(tracker.escalate()).toBe(1)
    expect(tracker.level).toBe(1)
    expect(tracker.signal.aborted).toBe(true)

    expect(tracker.escalate()).toBe(2)
    expect(tracker.level).toBe(2)

    expect(tracker.escalate()).toBe(3)
    expect(tracker.level).toBe(3)
  })

  it('level 1 aborts cancel tools but not block tools', () => {
    const tracker = new AbortTracker()
    tracker.escalate() // Level 1

    const cancelTool = buildTool({
      name: 'cancel_tool',
      description: 'Cancellable',
      inputSchema: z.object({}),
      interruptBehavior: 'cancel',
      async call() {
        return { content: [{ type: 'text', text: 'done' }] }
      },
    })

    const blockTool = buildTool({
      name: 'block_tool',
      description: 'Must complete',
      inputSchema: z.object({}),
      interruptBehavior: 'block',
      async call() {
        return { content: [{ type: 'text', text: 'done' }] }
      },
    })

    expect(tracker.shouldAbort(cancelTool)).toBe(true)
    expect(tracker.shouldAbort(blockTool)).toBe(false)
  })

  it('level 2 aborts both cancel and block tools', () => {
    const tracker = new AbortTracker()
    tracker.escalate() // Level 1
    tracker.escalate() // Level 2

    const blockTool = buildTool({
      name: 'block_tool',
      description: 'Must complete',
      inputSchema: z.object({}),
      interruptBehavior: 'block',
      async call() {
        return { content: [{ type: 'text', text: 'done' }] }
      },
    })

    expect(tracker.shouldAbort(blockTool)).toBe(true)
  })

  it('double-cancel force-kills blocked tool (level 2 → 3)', async () => {
    const tracker = new AbortTracker()

    const blockTool = buildTool({
      name: 'slow_block',
      description: 'Slow blocking tool',
      inputSchema: z.object({}),
      interruptBehavior: 'block',
      isConcurrencySafe: false,
      async call() {
        await new Promise((r) => setTimeout(r, 200))
        return { content: [{ type: 'text', text: 'completed' }] }
      },
    })

    const pool = makePool([blockTool])
    const ctx = makeContext()

    // Level 1 — block tool should NOT be aborted
    tracker.escalate()
    expect(tracker.shouldAbort(blockTool)).toBe(false)

    // Level 2 — now it should be aborted
    tracker.escalate()
    expect(tracker.shouldAbort(blockTool)).toBe(true)

    // Level 3 — hard kill
    tracker.escalate()
    expect(tracker.level).toBe(3)

    // Execute with hard-kill active — tool should be aborted at level 3
    const { results } = await executeToolCallsConcurrently(
      [{ id: 'c1', name: 'slow_block', input: {} }],
      pool,
      ctx,
      { abortTracker: tracker },
    )

    expect(results[0]!.isError).toBe(true)
    expect(results[0]!.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('abort'),
    })
  })

  it('first cancel sets cooperative abort — signal fires, only cancel tools aborted', () => {
    const tracker = new AbortTracker()

    const cancelTool = buildTool({
      name: 'read_file',
      description: 'Cancellable read',
      inputSchema: z.object({}),
      interruptBehavior: 'cancel',
      isReadOnly: true,
      isConcurrencySafe: true,
      async call() {
        return { content: [{ type: 'text', text: 'read' }] }
      },
    })

    const blockTool = buildTool({
      name: 'save_file',
      description: 'Must complete',
      inputSchema: z.object({}),
      interruptBehavior: 'block',
      async call() {
        return { content: [{ type: 'text', text: 'saved' }] }
      },
    })

    // Before escalation — nothing aborted
    expect(tracker.signal.aborted).toBe(false)
    expect(tracker.shouldAbort(cancelTool)).toBe(false)
    expect(tracker.shouldAbort(blockTool)).toBe(false)

    // First cancel — cooperative
    tracker.escalate()
    expect(tracker.level).toBe(1)
    expect(tracker.signal.aborted).toBe(true) // AbortController signal fired
    expect(tracker.shouldAbort(cancelTool)).toBe(true) // 'cancel' tool aborted
    expect(tracker.shouldAbort(blockTool)).toBe(false) // 'block' tool survives
  })

  it('second cancel force-kills block tools via concurrent execution', async () => {
    const tracker = new AbortTracker()

    const blockTool = buildTool({
      name: 'important_write',
      description: 'A tool with block behavior',
      inputSchema: z.object({}),
      interruptBehavior: 'block',
      isConcurrencySafe: false,
      async call() {
        // Simulate a long-running write that cannot be cancelled
        await new Promise((r) => setTimeout(r, 200))
        return { content: [{ type: 'text', text: 'wrote data' }] }
      },
    })

    const pool = makePool([blockTool])
    const ctx = makeContext()

    // First cancel — block tool is NOT aborted
    tracker.escalate()
    expect(tracker.level).toBe(1)
    expect(tracker.shouldAbort(blockTool)).toBe(false)

    // Second cancel — block tool IS now aborted
    tracker.escalate()
    expect(tracker.level).toBe(2)
    expect(tracker.shouldAbort(blockTool)).toBe(true)

    // Verify via concurrent execution — the tool should get an abort error
    const { results } = await executeToolCallsConcurrently(
      [{ id: 'c1', name: 'important_write', input: {} }],
      pool,
      ctx,
      { abortTracker: tracker },
    )

    expect(results[0]!.isError).toBe(true)
    expect(results[0]!.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('aborted'),
    })
  })

  it('reset() returns to level 0', () => {
    const tracker = new AbortTracker()
    tracker.escalate()
    tracker.escalate()
    expect(tracker.level).toBe(2)

    tracker.reset()
    expect(tracker.level).toBe(0)
    expect(tracker.signal.aborted).toBe(false)
  })
})

// ===========================================================================
// FILE_UNCHANGED_STUB — duplicate read detection
// ===========================================================================

describe('FILE_UNCHANGED_STUB', () => {
  it('returns stub on duplicate read with same input', async () => {
    const readTool = buildTool({
      name: 'read_file',
      description: 'Reads a file',
      inputSchema: z.object({ path: z.string() }),
      isReadOnly: true,
      isConcurrencySafe: true,
      async call() {
        return { content: [{ type: 'text', text: 'file content here' }] }
      },
    })

    const pool = makePool([readTool])
    const ctx = makeContext()
    const readCache = new Map<string, string>()

    const call1: NormalizedToolCall = {
      id: 'c1',
      name: 'read_file',
      input: { path: '/foo.txt' },
    }
    const call2: NormalizedToolCall = {
      id: 'c2',
      name: 'read_file',
      input: { path: '/foo.txt' },
    }

    // First call — returns real content
    const { results: r1 } = await executeToolCallsConcurrently([call1], pool, ctx, { readCache })
    expect(r1[0]!.content[0]).toMatchObject({
      type: 'text',
      text: 'file content here',
    })

    // Second call with same input — returns stub
    const { results: r2 } = await executeToolCallsConcurrently([call2], pool, ctx, { readCache })
    expect(r2[0]!.content[0]).toMatchObject({
      type: 'text',
      text: FILE_UNCHANGED_STUB,
    })
  })

  it('does NOT return stub when content changes', async () => {
    let callCount = 0

    const readTool = buildTool({
      name: 'read_file',
      description: 'Reads a file',
      inputSchema: z.object({ path: z.string() }),
      isReadOnly: true,
      isConcurrencySafe: true,
      async call() {
        callCount++
        return {
          content: [{ type: 'text', text: `content v${callCount}` }],
        }
      },
    })

    const pool = makePool([readTool])
    const ctx = makeContext()
    const readCache = new Map<string, string>()

    const call: NormalizedToolCall = {
      id: 'c1',
      name: 'read_file',
      input: { path: '/foo.txt' },
    }

    const { results: r1 } = await executeToolCallsConcurrently([call], pool, ctx, { readCache })
    expect(r1[0]!.content[0]).toMatchObject({ type: 'text', text: 'content v1' })

    const { results: r2 } = await executeToolCallsConcurrently([{ ...call, id: 'c2' }], pool, ctx, {
      readCache,
    })
    // Different content — should NOT be stubbed
    expect(r2[0]!.content[0]).toMatchObject({ type: 'text', text: 'content v2' })
  })
})

// ===========================================================================
// Large output spill to temp
// ===========================================================================

describe('Large output spill', () => {
  let tempWorkspace: string

  afterEach(() => {
    if (tempWorkspace) {
      cleanupTempDir(tempWorkspace)
      // Clean up the .cognograph directory too
      try {
        fs.rmSync(path.join(tempWorkspace, '.cognograph'), { recursive: true, force: true })
        fs.rmSync(tempWorkspace, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  it('spills results over 30K chars to truncated inline + temp file', async () => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cogno-test-'))

    // Generate content > 30K chars
    const largeContent = 'x'.repeat(40_000)

    const largeTool = buildTool({
      name: 'large_read',
      description: 'Returns large content',
      inputSchema: z.object({}),
      isReadOnly: true,
      isConcurrencySafe: true,
      async call() {
        return { content: [{ type: 'text', text: largeContent }] }
      },
    })

    const pool = makePool([largeTool])
    const ctx = makeContext()

    const { results } = await executeToolCallsConcurrently(
      [{ id: 'c1', name: 'large_read', input: {} }],
      pool,
      ctx,
      { workspacePath: tempWorkspace },
    )

    // Result should be truncated to ~30K chars + truncation message
    const text = results[0]!.content[0]
    expect(text).toMatchObject({ type: 'text' })
    if (text && text.type === 'text') {
      expect(text.text.length).toBeLessThan(40_000)
      expect(text.text).toContain('TRUNCATED')
    }

    // A temp file should have been created
    const tempDir = path.join(tempWorkspace, '.cognograph', 'temp')
    const files = fs.readdirSync(tempDir)
    expect(files.length).toBeGreaterThanOrEqual(1)
  })

  it('cleanupTempDir removes temp files', () => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cogno-test-'))
    const tempDir = path.join(tempWorkspace, '.cognograph', 'temp')
    fs.mkdirSync(tempDir, { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'data')

    cleanupTempDir(tempWorkspace)

    const files = fs.readdirSync(tempDir)
    expect(files).toHaveLength(0)
  })
})

// ===========================================================================
// Per-tool execution timeout
// ===========================================================================

describe('executeToolCall — per-tool timeout', () => {
  it('returns isError result when tool exceeds 30s timeout', async () => {
    vi.useFakeTimers()

    const slowTool = buildTool({
      name: 'slow_tool',
      description: 'Never resolves',
      inputSchema: z.object({}),
      async call() {
        // Never resolves — simulates a hung tool
        return new Promise<ToolResult>(() => {})
      },
    })

    const pool = makePool([slowTool])
    const call = makeCall({ name: 'slow_tool', input: {} })
    const ctx = makeContext()

    const resultPromise = executeToolCall(call, pool, ctx)

    // Advance past the 30s timeout
    await vi.advanceTimersByTimeAsync(30_001)

    const { result } = await resultPromise

    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('timed out'),
    })

    vi.useRealTimers()
  })

  it('clears timeout timer when tool completes quickly', async () => {
    vi.useFakeTimers()

    const fastTool = buildTool({
      name: 'fast_tool',
      description: 'Completes immediately',
      inputSchema: z.object({}),
      async call() {
        return { content: [{ type: 'text', text: 'done fast' }] }
      },
    })

    const pool = makePool([fastTool])
    const call = makeCall({ name: 'fast_tool', input: {} })
    const ctx = makeContext()

    const resultPromise = executeToolCall(call, pool, ctx)

    // Advance time — the tool resolved immediately, so timeout should NOT fire
    await vi.advanceTimersByTimeAsync(30_001)

    const { result } = await resultPromise

    // Result should be successful — the cleared timer never triggered
    expect(result.isError).toBeUndefined()
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: 'done fast',
    })

    vi.useRealTimers()
  })
})
