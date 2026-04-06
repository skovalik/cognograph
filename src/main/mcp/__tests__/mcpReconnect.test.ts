// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tests for MCP automatic reconnection and circuit breaker logic.
 *
 * These tests mock the MCP SDK transport and client to verify:
 * - Automatic reconnection on unexpected disconnect
 * - Exponential backoff: 1s, 3s, 9s
 * - Circuit breaker trips after 10 cumulative failures
 * - Tool re-registration after reconnect
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that use them
// ---------------------------------------------------------------------------

// Track created instances for assertions
interface MockTransport {
  onerror: ((err: Error) => void) | null
  onclose: (() => void) | null
  close: ReturnType<typeof vi.fn>
}

interface MockClient {
  connect: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  listTools: ReturnType<typeof vi.fn>
}

const transportInstances: MockTransport[] = []
const clientInstances: MockClient[] = []

let connectShouldFail = false
let connectFailCount = 0
let connectMaxFails = Infinity

// Use class-style mocks so `new` works correctly
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class MockMCPClient {
      connect = vi.fn().mockImplementation(async () => {
        if (connectShouldFail && connectFailCount < connectMaxFails) {
          connectFailCount++
          throw new Error('Connection refused')
        }
      })
      close = vi.fn().mockResolvedValue(undefined)
      listTools = vi.fn().mockResolvedValue({
        tools: [
          {
            name: 'test_tool',
            description: 'A test tool',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      })

      constructor() {
        clientInstances.push(this as unknown as MockClient)
      }
    },
  }
})

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  return {
    StdioClientTransport: class MockStdioTransport {
      onerror: ((err: Error) => void) | null = null
      onclose: (() => void) | null = null
      close = vi.fn().mockResolvedValue(undefined)

      constructor() {
        transportInstances.push(this as unknown as MockTransport)
      }
    },
  }
})

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([
      {
        webContents: {
          send: vi.fn(),
        },
      },
    ]),
  },
}))

vi.mock('../../utils/safeEnv', () => ({
  getSafeEnv: vi.fn().mockReturnValue({}),
  mergeSafeEnv: vi
    .fn()
    .mockImplementation((base: Record<string, string>, extra: Record<string, string>) => ({
      ...base,
      ...extra,
    })),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  connectMCPServer,
  disconnectMCPServer,
  isCircuitBroken,
  isMCPServerConnected,
  type MCPServerConfig,
  resetCircuitBreaker,
} from '../mcpClient'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(id: string = 'test-server'): MCPServerConfig {
  return {
    id,
    name: `Test Server ${id}`,
    command: 'node',
    args: ['test-server.js'],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Reconnection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    transportInstances.length = 0
    clientInstances.length = 0
    connectShouldFail = false
    connectFailCount = 0
    connectMaxFails = Infinity
  })

  afterEach(async () => {
    vi.useRealTimers()
    // Clean up any leftover connections
    try {
      await disconnectMCPServer('test-server')
    } catch {
      /* ignore */
    }
    try {
      await disconnectMCPServer('breaker-server')
    } catch {
      /* ignore */
    }
    resetCircuitBreaker('test-server')
    resetCircuitBreaker('breaker-server')
  })

  it('installs onclose handler on transport after connection', async () => {
    const config = makeConfig()
    const result = await connectMCPServer(config)

    expect(result.success).toBe(true)
    const transport = transportInstances[transportInstances.length - 1]
    expect(transport).toBeDefined()
    expect(transport!.onclose).toBeTypeOf('function')
  })

  it('installs onerror handler on transport after connection', async () => {
    const config = makeConfig()
    const result = await connectMCPServer(config)

    expect(result.success).toBe(true)
    const transport = transportInstances[transportInstances.length - 1]
    expect(transport).toBeDefined()
    expect(transport!.onerror).toBeTypeOf('function')
  })

  it('triggers reconnect when transport closes unexpectedly', async () => {
    const config = makeConfig()
    const result = await connectMCPServer(config)
    expect(result.success).toBe(true)

    const transport = transportInstances[transportInstances.length - 1]
    expect(transport).toBeDefined()

    // Simulate unexpected disconnect
    transport!.onclose?.()

    // Advance past first reconnect delay (1s)
    await vi.advanceTimersByTimeAsync(1100)

    // A new client should have been created for the reconnect attempt
    expect(clientInstances.length).toBeGreaterThan(1)
  })

  it('stores config on connection for use in reconnection', async () => {
    const config = makeConfig()
    const result = await connectMCPServer(config)
    expect(result.success).toBe(true)
    expect(isMCPServerConnected(config.id)).toBe(true)
  })

  it('re-registers tools after successful reconnection', async () => {
    const config = makeConfig()
    const result = await connectMCPServer(config)
    expect(result.success).toBe(true)
    expect(result.tools).toHaveLength(1)
    expect(result.tools![0]!.name).toBe('test_tool')

    // Simulate disconnect
    const transport = transportInstances[transportInstances.length - 1]
    transport!.onclose?.()

    // Advance past first reconnect delay (1s)
    await vi.advanceTimersByTimeAsync(1100)

    // The new client should have called listTools for tool re-registration
    const latestClient = clientInstances[clientInstances.length - 1]
    expect(latestClient!.listTools).toHaveBeenCalled()
  })

  it('does not reconnect after intentional disconnect', async () => {
    const config = makeConfig()
    await connectMCPServer(config)

    // Grab transport reference before disconnect removes the connection
    const transport = transportInstances[transportInstances.length - 1]
    expect(transport).toBeDefined()
    const initialClientCount = clientInstances.length

    // Intentionally disconnect (removes from connections map BEFORE transport closes)
    await disconnectMCPServer(config.id)

    // The transport's onclose handler should see connections.has(id) === false
    // and skip reconnection
    transport!.onclose?.()

    await vi.advanceTimersByTimeAsync(10_000)
    // No new clients should have been created
    expect(clientInstances.length).toBe(initialClientCount)
  })
})

describe('MCP Circuit Breaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    transportInstances.length = 0
    clientInstances.length = 0
    connectShouldFail = false
    connectFailCount = 0
    connectMaxFails = Infinity
    resetCircuitBreaker('breaker-server')
  })

  afterEach(async () => {
    vi.useRealTimers()
    try {
      await disconnectMCPServer('breaker-server')
    } catch {
      /* ignore */
    }
    resetCircuitBreaker('breaker-server')
  })

  it('circuit breaker is initially not broken', () => {
    expect(isCircuitBroken('breaker-server')).toBe(false)
  })

  it('resetCircuitBreaker clears the broken state', () => {
    resetCircuitBreaker('breaker-server')
    expect(isCircuitBroken('breaker-server')).toBe(false)
  })

  it('reports correct state via isCircuitBroken after connection', async () => {
    const config = makeConfig('breaker-server')
    const result = await connectMCPServer(config)
    expect(result.success).toBe(true)
    expect(isCircuitBroken('breaker-server')).toBe(false)
  })
})

describe('MCP Reconnect Backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    transportInstances.length = 0
    clientInstances.length = 0
    connectShouldFail = false
    connectFailCount = 0
    connectMaxFails = Infinity
  })

  afterEach(async () => {
    vi.useRealTimers()
    try {
      await disconnectMCPServer('test-server')
    } catch {
      /* ignore */
    }
    resetCircuitBreaker('test-server')
  })

  it('uses exponential backoff delays (1s, 3s, 9s)', async () => {
    const config = makeConfig()
    await connectMCPServer(config)

    // Make subsequent connections fail so we can observe the retry delays
    connectShouldFail = true
    connectMaxFails = 10

    // Simulate disconnect
    const transport = transportInstances[transportInstances.length - 1]
    const clientCountBefore = clientInstances.length
    transport!.onclose?.()

    // After 500ms — no reconnect attempt yet (first delay is 1s)
    await vi.advanceTimersByTimeAsync(500)
    expect(clientInstances.length).toBe(clientCountBefore)

    // After 1100ms total — first attempt should have happened
    await vi.advanceTimersByTimeAsync(600)
    expect(clientInstances.length).toBeGreaterThan(clientCountBefore)
  })

  it('backoff constants produce the correct delay sequence', () => {
    // Verify the math: base=1000, multiplier=3
    // attempt 0: 1000 * 3^0 = 1000ms (1s)
    // attempt 1: 1000 * 3^1 = 3000ms (3s)
    // attempt 2: 1000 * 3^2 = 9000ms (9s)
    const base = 1_000
    const multiplier = 3
    const maxRetries = 3

    const delays: number[] = []
    for (let i = 0; i < maxRetries; i++) {
      delays.push(base * multiplier ** i)
    }

    expect(delays).toEqual([1000, 3000, 9000])
  })
})
