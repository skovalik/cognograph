import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock node-pty before importing the module under test
// ---------------------------------------------------------------------------

// Store callbacks so tests can trigger onData / onExit from "outside"
let storedOnDataCb: ((data: string) => void) | null = null
let storedOnExitCb: ((e: { exitCode: number; signal?: number }) => void) | null = null

function createMockPtyInstance() {
  return {
    onData: vi.fn((cb: (data: string) => void) => {
      storedOnDataCb = cb
      return { dispose: vi.fn() }
    }),
    onExit: vi.fn((cb: (e: { exitCode: number; signal?: number }) => void) => {
      storedOnExitCb = cb
      return { dispose: vi.fn() }
    }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  }
}

const mockSpawn = vi.fn(() => createMockPtyInstance())

vi.mock('node-pty', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}))

// Mock contextWriter so terminalManager doesn't attempt real file I/O
vi.mock('../contextWriter', () => ({
  buildContextForNode: vi.fn().mockResolvedValue({
    entries: [],
    markdown: '',
    filePath: '/mock/context.md',
    totalTokens: 0,
  }),
  writeContextFile: vi.fn().mockResolvedValue('/mock/context.md'),
  getContextFilePath: vi.fn().mockReturnValue('/mock/context.md'),
}))

// Import AFTER mocking
import {
  spawnTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  killAll,
  getScrollback,
  getSession,
  getAllSessions,
} from '../terminalManager'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('terminalManager', () => {
  beforeEach(() => {
    // Clear all sessions between tests
    killAll()
    storedOnDataCb = null
    storedOnExitCb = null
    mockSpawn.mockClear()
    // Re-supply fresh instances for each spawn call
    mockSpawn.mockImplementation(() => createMockPtyInstance())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // 1. spawnTerminal creates a session with correct initial state
  // -------------------------------------------------------------------------
  it('spawnTerminal creates a session in the map with correct initial state', async () => {
    const session = await spawnTerminal({
      nodeId: 'node-1',
      sessionId: 'sess-1',
      cwd: '/tmp',
    })

    expect(session).toBeDefined()
    expect(session.nodeId).toBe('node-1')
    expect(session.sessionId).toBe('sess-1')
    expect(session.cwd).toBe('/tmp')
    expect(session.status).toBe('running')
    expect(session.pid).toBe(12345)
    expect(session.scrollbackBuffer).toEqual([])
    expect(session.cols).toBe(80) // default
    expect(session.rows).toBe(24) // default

    // Also accessible via getSession
    const retrieved = getSession('node-1')
    expect(retrieved).toBeDefined()
    expect(retrieved!.sessionId).toBe('sess-1')
  })

  // -------------------------------------------------------------------------
  // 2. Platform-conditional shell selection
  // -------------------------------------------------------------------------
  it('spawnTerminal uses cmd.exe on Windows', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    try {
      await spawnTerminal({ nodeId: 'node-win', sessionId: 'sess-win' })

      expect(mockSpawn).toHaveBeenCalledWith(
        'cmd.exe',
        ['/c', 'claude'],
        expect.objectContaining({
          cols: 80,
          rows: 24,
        }),
      )
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    }
  })

  it('spawnTerminal uses /bin/bash on Unix', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

    try {
      await spawnTerminal({ nodeId: 'node-mac', sessionId: 'sess-mac' })

      expect(mockSpawn).toHaveBeenCalledWith(
        '/bin/bash',
        ['-lc', 'claude'],
        expect.objectContaining({
          cols: 80,
          rows: 24,
        }),
      )
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    }
  })

  // -------------------------------------------------------------------------
  // 3. Environment variables
  // -------------------------------------------------------------------------
  it('spawnTerminal sets env vars (CLAUDE_SESSION_ID, COGNOGRAPH_NODE_ID, COGNOGRAPH_CONTEXT_FILE)', async () => {
    await spawnTerminal({
      nodeId: 'node-env',
      sessionId: 'sess-env',
      env: { CUSTOM_VAR: 'hello' },
    })

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({
          CLAUDE_SESSION_ID: 'sess-env',
          COGNOGRAPH_NODE_ID: 'node-env',
          COGNOGRAPH_CONTEXT_FILE: '/mock/context.md',
          CUSTOM_VAR: 'hello',
        }),
      }),
    )
  })

  // -------------------------------------------------------------------------
  // 4. writeTerminal
  // -------------------------------------------------------------------------
  it('writeTerminal calls pty.write with correct data', async () => {
    const session = await spawnTerminal({ nodeId: 'node-w', sessionId: 'sess-w' })

    writeTerminal('node-w', 'hello\n')

    expect(session.pty.write).toHaveBeenCalledWith('hello\n')
  })

  it('writeTerminal is a no-op for unknown nodeId', () => {
    // Should not throw
    expect(() => writeTerminal('nonexistent', 'data')).not.toThrow()
  })

  // -------------------------------------------------------------------------
  // 5. resizeTerminal
  // -------------------------------------------------------------------------
  it('resizeTerminal calls pty.resize with correct dimensions', async () => {
    const session = await spawnTerminal({ nodeId: 'node-r', sessionId: 'sess-r' })

    resizeTerminal('node-r', 120, 40)

    expect(session.pty.resize).toHaveBeenCalledWith(120, 40)
    // Also updates stored dimensions
    const updated = getSession('node-r')
    expect(updated!.cols).toBe(120)
    expect(updated!.rows).toBe(40)
  })

  // -------------------------------------------------------------------------
  // 6. killTerminal
  // -------------------------------------------------------------------------
  it('killTerminal calls pty.kill and removes from map', async () => {
    const session = await spawnTerminal({ nodeId: 'node-k', sessionId: 'sess-k' })

    killTerminal('node-k')

    expect(session.pty.kill).toHaveBeenCalled()
    expect(getSession('node-k')).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 7. killAll
  // -------------------------------------------------------------------------
  it('killAll kills all sessions and clears map', async () => {
    const s1 = await spawnTerminal({ nodeId: 'node-a', sessionId: 'sess-a' })
    const s2 = await spawnTerminal({ nodeId: 'node-b', sessionId: 'sess-b' })

    killAll()

    expect(s1.pty.kill).toHaveBeenCalled()
    expect(s2.pty.kill).toHaveBeenCalled()
    expect(getAllSessions().size).toBe(0)
  })

  // -------------------------------------------------------------------------
  // 8. Scrollback buffer: data events append lines, buffer caps at 5000
  // -------------------------------------------------------------------------
  it('scrollback buffer accumulates lines from onData events', async () => {
    await spawnTerminal({ nodeId: 'node-sb', sessionId: 'sess-sb' })

    // Simulate data arriving
    storedOnDataCb?.('line 1\nline 2\nline 3\n')

    const buf = getScrollback('node-sb')
    expect(buf).toContain('line 1')
    expect(buf).toContain('line 2')
    expect(buf).toContain('line 3')
  })

  it('scrollback buffer caps at 5000 lines', async () => {
    await spawnTerminal({ nodeId: 'node-cap', sessionId: 'sess-cap' })

    // Generate 5010 lines
    const bigChunk = Array.from({ length: 5010 }, (_, i) => `line-${i}`).join('\n')
    storedOnDataCb?.(bigChunk)

    const buf = getScrollback('node-cap')
    expect(buf.length).toBeLessThanOrEqual(5000)
    // First lines should have been trimmed; last line should be present
    expect(buf[buf.length - 1]).toBe('line-5009')
  })

  // -------------------------------------------------------------------------
  // 9. getScrollback returns the buffer
  // -------------------------------------------------------------------------
  it('getScrollback returns the buffer for a known nodeId', async () => {
    await spawnTerminal({ nodeId: 'node-gs', sessionId: 'sess-gs' })
    storedOnDataCb?.('hello world\n')

    const buf = getScrollback('node-gs')
    expect(buf).toContain('hello world')
  })

  it('getScrollback returns empty array for unknown nodeId', () => {
    expect(getScrollback('nonexistent')).toEqual([])
  })

  // -------------------------------------------------------------------------
  // 10. Status transitions: running -> idle (after timeout)
  // -------------------------------------------------------------------------
  it('status transitions to idle after 30s of no data', async () => {
    vi.useFakeTimers()

    await spawnTerminal({ nodeId: 'node-idle', sessionId: 'sess-idle' })

    expect(getSession('node-idle')!.status).toBe('running')

    // Advance past the idle timeout
    vi.advanceTimersByTime(31_000)

    expect(getSession('node-idle')!.status).toBe('idle')
  })

  it('idle timer resets on new data', async () => {
    vi.useFakeTimers()

    await spawnTerminal({ nodeId: 'node-reset', sessionId: 'sess-reset' })

    // Advance 20s (not enough to trigger idle)
    vi.advanceTimersByTime(20_000)
    expect(getSession('node-reset')!.status).toBe('running')

    // New data arrives -> resets the timer
    storedOnDataCb?.('some data\n')

    // Advance another 20s (still not 30s from last data)
    vi.advanceTimersByTime(20_000)
    expect(getSession('node-reset')!.status).toBe('running')

    // Advance past the full 30s from last data
    vi.advanceTimersByTime(11_000)
    expect(getSession('node-reset')!.status).toBe('idle')
  })

  // -------------------------------------------------------------------------
  // 11. Status transitions: running -> exited (on PTY exit)
  // -------------------------------------------------------------------------
  it('status transitions to exited on PTY exit, keeps entry in map', async () => {
    await spawnTerminal({ nodeId: 'node-exit', sessionId: 'sess-exit' })

    expect(getSession('node-exit')!.status).toBe('running')

    // Simulate PTY exit
    storedOnExitCb?.({ exitCode: 0 })

    const session = getSession('node-exit')
    expect(session).toBeDefined()
    expect(session!.status).toBe('exited')
  })

  // -------------------------------------------------------------------------
  // 12. Kill on already-exited session is a no-op
  // -------------------------------------------------------------------------
  it('killTerminal on already-exited session does not throw', async () => {
    await spawnTerminal({ nodeId: 'node-exited', sessionId: 'sess-exited' })

    // Exit the session
    storedOnExitCb?.({ exitCode: 0 })

    // Kill should be a no-op (doesn't throw)
    expect(() => killTerminal('node-exited')).not.toThrow()
  })

  // -------------------------------------------------------------------------
  // 13. getSession returns undefined for unknown nodeId
  // -------------------------------------------------------------------------
  it('getSession returns undefined for unknown nodeId', () => {
    expect(getSession('does-not-exist')).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 14. getAllSessions returns the full map
  // -------------------------------------------------------------------------
  it('getAllSessions returns all active sessions', async () => {
    await spawnTerminal({ nodeId: 'node-x', sessionId: 'sess-x' })
    await spawnTerminal({ nodeId: 'node-y', sessionId: 'sess-y' })

    const all = getAllSessions()
    expect(all.size).toBe(2)
    expect(all.has('node-x')).toBe(true)
    expect(all.has('node-y')).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 15. Custom cols/rows are passed through
  // -------------------------------------------------------------------------
  it('spawnTerminal passes custom cols and rows', async () => {
    const session = await spawnTerminal({
      nodeId: 'node-dim',
      sessionId: 'sess-dim',
      cols: 200,
      rows: 50,
    })

    expect(session.cols).toBe(200)
    expect(session.rows).toBe(50)
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ cols: 200, rows: 50 }),
    )
  })
})
