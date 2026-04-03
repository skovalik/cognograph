// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Environment Variable Security Tests
 *
 * Validates the safeEnv allowlist/blocklist mechanism used by both
 * mcpClient.ts and terminalManager.ts to prevent secret leakage
 * to child processes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getSafeEnv,
  isBlockedEnvVar,
  mergeSafeEnv,
  UNIX_ALLOWED,
  WINDOWS_ALLOWED,
  ALWAYS_BLOCKED,
} from '../../main/utils/safeEnv'

// ---------------------------------------------------------------------------
// Helpers — swap process.platform for cross-platform tests
// ---------------------------------------------------------------------------

const originalPlatform = process.platform
const originalEnv = { ...process.env }

function setPlatform(platform: string): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true,
  })
}

function restorePlatform(): void {
  Object.defineProperty(process, 'platform', {
    value: originalPlatform,
    writable: true,
    configurable: true,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('safeEnv', () => {
  beforeEach(() => {
    // Seed process.env with known values for both platforms
    process.env.PATH = '/usr/bin'
    process.env.HOME = '/home/test'
    process.env.SHELL = '/bin/bash'
    process.env.SYSTEMROOT = 'C:\\Windows'
    process.env.COMSPEC = 'C:\\Windows\\system32\\cmd.exe'
    process.env.USERPROFILE = 'C:\\Users\\test'
    process.env.NODE_OPTIONS = '--inspect'
    process.env.LD_PRELOAD = '/tmp/evil.so'
    process.env.SECRET_API_KEY = 'sk-should-never-appear'
    process.env.DATABASE_URL = 'postgres://secret@localhost/db'
  })

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key]
      }
    }
    Object.assign(process.env, originalEnv)
    restorePlatform()
  })

  // -----------------------------------------------------------------------
  // Test 1: Windows — SYSTEMROOT and COMSPEC present in safe env
  // -----------------------------------------------------------------------
  it('Windows: SYSTEMROOT and COMSPEC present in safe env', () => {
    setPlatform('win32')
    const env = getSafeEnv()

    expect(env.SYSTEMROOT).toBe('C:\\Windows')
    expect(env.COMSPEC).toBe('C:\\Windows\\system32\\cmd.exe')
  })

  // -----------------------------------------------------------------------
  // Test 2: Unix — PATH and HOME present in safe env
  // -----------------------------------------------------------------------
  it('Unix: PATH and HOME present in safe env', () => {
    setPlatform('linux')
    const env = getSafeEnv()

    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/home/test')
  })

  // -----------------------------------------------------------------------
  // Test 3: NODE_OPTIONS blocked on both platforms
  // -----------------------------------------------------------------------
  it('NODE_OPTIONS blocked on both platforms', () => {
    // Windows
    setPlatform('win32')
    let env = getSafeEnv()
    expect(env.NODE_OPTIONS).toBeUndefined()
    expect(isBlockedEnvVar('NODE_OPTIONS')).toBe(true)

    // Linux
    setPlatform('linux')
    env = getSafeEnv()
    expect(env.NODE_OPTIONS).toBeUndefined()
    expect(isBlockedEnvVar('NODE_OPTIONS')).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Test 4: LD_PRELOAD blocked on Unix
  // -----------------------------------------------------------------------
  it('LD_PRELOAD blocked on Unix', () => {
    setPlatform('linux')
    const env = getSafeEnv()

    // Not in allowlist, so should not appear
    expect(env.LD_PRELOAD).toBeUndefined()

    // Also explicitly blocked via blocklist
    expect(isBlockedEnvVar('LD_PRELOAD')).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Test 5: config.env cannot re-inject NODE_OPTIONS (MCP path)
  // -----------------------------------------------------------------------
  it('config.env cannot re-inject NODE_OPTIONS (MCP path)', () => {
    setPlatform('linux')
    const safeBase = getSafeEnv()

    const configEnv = {
      NODE_OPTIONS: '--inspect=0.0.0.0:9229',
      MY_LEGIT_VAR: 'hello',
    }

    const merged = mergeSafeEnv(safeBase, configEnv)

    expect(merged.NODE_OPTIONS).toBeUndefined()
    expect(merged.MY_LEGIT_VAR).toBe('hello')
  })

  // -----------------------------------------------------------------------
  // Test 6: config.env CAN set custom vars like MY_API_KEY (MCP path)
  // -----------------------------------------------------------------------
  it('config.env CAN set custom vars like MY_API_KEY (MCP path)', () => {
    setPlatform('linux')
    const safeBase = getSafeEnv()

    const configEnv = {
      MY_API_KEY: 'abc123',
      OPENAI_API_KEY: 'sk-1234',
      CUSTOM_FLAG: 'true',
    }

    const merged = mergeSafeEnv(safeBase, configEnv)

    expect(merged.MY_API_KEY).toBe('abc123')
    expect(merged.OPENAI_API_KEY).toBe('sk-1234')
    expect(merged.CUSTOM_FLAG).toBe('true')
  })

  // -----------------------------------------------------------------------
  // Test 7: Terminal env includes COGNOGRAPH_NODE_ID (terminal path)
  // -----------------------------------------------------------------------
  it('Terminal env includes COGNOGRAPH_NODE_ID (terminal path)', () => {
    setPlatform('linux')
    const safeBase = getSafeEnv()

    // Simulate what terminalManager does: merge Cognograph-specific vars
    const cognographVars = {
      COGNOGRAPH_NODE_ID: 'node-abc-123',
      CLAUDE_SESSION_ID: 'session-xyz',
      COGNOGRAPH_CONTEXT_FILE: '/tmp/context.md',
      COGNOGRAPH_WORKSPACE_ID: 'ws-001',
      COLORTERM: 'truecolor',
    }

    const merged = mergeSafeEnv(safeBase, cognographVars)

    expect(merged.COGNOGRAPH_NODE_ID).toBe('node-abc-123')
    expect(merged.CLAUDE_SESSION_ID).toBe('session-xyz')
    expect(merged.COGNOGRAPH_CONTEXT_FILE).toBe('/tmp/context.md')
    expect(merged.COGNOGRAPH_WORKSPACE_ID).toBe('ws-001')
    expect(merged.COLORTERM).toBe('truecolor')
  })

  // -----------------------------------------------------------------------
  // Additional coverage
  // -----------------------------------------------------------------------

  it('secrets from process.env are never forwarded', () => {
    setPlatform('linux')
    const env = getSafeEnv()

    expect(env.SECRET_API_KEY).toBeUndefined()
    expect(env.DATABASE_URL).toBeUndefined()
  })

  it('blocklist check is case-insensitive', () => {
    expect(isBlockedEnvVar('node_options')).toBe(true)
    expect(isBlockedEnvVar('Node_Options')).toBe(true)
    expect(isBlockedEnvVar('ld_preload')).toBe(true)
    expect(isBlockedEnvVar('ELECTRON_RUN_AS_NODE')).toBe(true)
  })

  it('all ALWAYS_BLOCKED vars are rejected by mergeSafeEnv', () => {
    const base: Record<string, string> = {}

    const malicious: Record<string, string> = {}
    for (const key of ALWAYS_BLOCKED) {
      malicious[key] = 'injected'
    }

    const merged = mergeSafeEnv(base, malicious)

    for (const key of ALWAYS_BLOCKED) {
      expect(merged[key]).toBeUndefined()
    }
  })

  it('Windows allowlist does not include Unix-only vars', () => {
    setPlatform('win32')
    process.env.SHELL = '/bin/bash'
    process.env.DISPLAY = ':0'

    const env = getSafeEnv()

    // SHELL and DISPLAY are Unix-only
    expect(env.SHELL).toBeUndefined()
    expect(env.DISPLAY).toBeUndefined()
  })

  it('Unix allowlist does not include Windows-only vars', () => {
    setPlatform('linux')
    process.env.COMSPEC = 'cmd.exe'
    process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming'

    const env = getSafeEnv()

    // COMSPEC and APPDATA are Windows-only
    expect(env.COMSPEC).toBeUndefined()
    expect(env.APPDATA).toBeUndefined()
  })
})
