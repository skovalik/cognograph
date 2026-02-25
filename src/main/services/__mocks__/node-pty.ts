/**
 * Stub for node-pty — used by vitest's resolve alias so that Vite can resolve
 * the import when node-pty is not yet installed. Tests mock this module via
 * vi.mock('node-pty', ...) which overrides these stubs entirely.
 *
 * This file will be UNUSED at runtime (where real node-pty is installed).
 */

export function spawn(): never {
  throw new Error('node-pty stub: real node-pty is not installed. This should be mocked in tests.')
}
