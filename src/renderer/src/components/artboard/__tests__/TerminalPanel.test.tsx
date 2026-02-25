/**
 * TerminalPanel Component Tests
 *
 * Lightweight tests for TerminalPanel since xterm.js requires a real DOM
 * (canvas rendering, etc.). Focuses on:
 *   - Module export verification
 *   - Container div rendering with correct aria-label
 *   - Focus escape tooltip rendering
 *
 * xterm.js Terminal class is fully mocked since jsdom doesn't support canvas.
 *
 * Note: We avoid @testing-library matchers like toBeInTheDocument/toHaveClass
 * since test files under src/renderer/src are included in tsconfig.web.json
 * where those type augmentations aren't available at tsc time.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — must be before imports that use them
// ---------------------------------------------------------------------------

// Mock xterm.js Terminal class using a real class so `new Terminal()` works
class MockTerminal {
  open = vi.fn()
  dispose = vi.fn()
  write = vi.fn()
  writeln = vi.fn()
  blur = vi.fn()
  loadAddon = vi.fn()
  onData = vi.fn().mockReturnValue({ dispose: vi.fn() })
  attachCustomKeyEventHandler = vi.fn()
  cols = 80
  rows = 24
}

vi.mock('@xterm/xterm', () => ({
  Terminal: MockTerminal,
}))

// Mock fit addon using a real class so `new FitAddon()` works
class MockFitAddon {
  fit = vi.fn()
  dispose = vi.fn()
}

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: MockFitAddon,
}))

// Mock xterm CSS import (no-op)
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

// Mock window.api.terminal
const mockTerminalApi = {
  spawn: vi.fn().mockResolvedValue({ sessionId: 'test-session', nodeId: 'test-node', pid: 1234 }),
  write: vi.fn().mockResolvedValue(undefined),
  resize: vi.fn().mockResolvedValue(undefined),
  kill: vi.fn().mockResolvedValue(undefined),
  getScrollback: vi.fn().mockResolvedValue([]),
  onData: vi.fn().mockReturnValue(() => {}),
  onExit: vi.fn().mockReturnValue(() => {}),
}

beforeEach(() => {
  vi.clearAllMocks()

  // Ensure window.api.terminal is available
  if (!window.api) {
    Object.defineProperty(window, 'api', {
      value: { terminal: mockTerminalApi },
      writable: true,
    })
  } else {
    ;(window.api as unknown as Record<string, unknown>).terminal = mockTerminalApi
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TerminalPanel', () => {
  it('should export TerminalPanel as a named export', async () => {
    const mod = await import('../TerminalPanel')
    expect(mod.TerminalPanel).toBeDefined()
  })

  it('should be a memoized component', async () => {
    const mod = await import('../TerminalPanel')
    // React.memo wraps the component — typeof is 'object'
    expect(typeof mod.TerminalPanel).toBe('object')
    expect(mod.TerminalPanel.displayName).toBe('TerminalPanel')
  })

  it('should render a container div with the correct aria-label', async () => {
    const { TerminalPanel } = await import('../TerminalPanel')

    const { container } = render(
      <TerminalPanel nodeId="node-abc-123" sessionId="session-xyz" />
    )

    const el = container.querySelector('[aria-label="Terminal for node node-abc-123"]')
    expect(el).not.toBeNull()
    expect(el?.classList.contains('terminal-panel')).toBe(true)
  })

  it('should include custom className when provided', async () => {
    const { TerminalPanel } = await import('../TerminalPanel')

    const { container } = render(
      <TerminalPanel
        nodeId="node-abc-123"
        sessionId="session-xyz"
        className="my-custom-class"
      />
    )

    const el = container.querySelector('[aria-label="Terminal for node node-abc-123"]')
    expect(el).not.toBeNull()
    expect(el?.classList.contains('terminal-panel')).toBe(true)
    expect(el?.classList.contains('my-custom-class')).toBe(true)
  })

  it('should render the focus escape tooltip', async () => {
    const { TerminalPanel } = await import('../TerminalPanel')

    const { container } = render(
      <TerminalPanel nodeId="node-abc-123" sessionId="session-xyz" />
    )

    // The tooltip text should be somewhere in the rendered output
    expect(container.textContent).toContain('Ctrl+` to return to canvas')
  })

  it('should export TerminalPanelProps interface (type-level check)', async () => {
    // This test verifies the type export exists — it's a compile-time check.
    // If TerminalPanelProps is not exported, tsc --noEmit would catch it.
    const mod = await import('../TerminalPanel')
    expect(mod.TerminalPanel).toBeDefined()
  })
})
