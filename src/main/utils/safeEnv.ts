// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * safeEnv.ts — Platform-conditional environment variable allowlist.
 *
 * Prevents leaking secrets (API keys, database URLs, tokens) to child processes
 * by replacing `...process.env` with a curated set of known-safe variables.
 * Also blocks dangerous variables (LD_PRELOAD, NODE_OPTIONS, etc.) that could
 * be used for code injection even if explicitly passed via config.env.
 */

// ---------------------------------------------------------------------------
// Allowlists — only these vars are forwarded from the parent process
// ---------------------------------------------------------------------------

const UNIX_ALLOWED = [
  'PATH',
  'HOME',
  'SHELL',
  'TERM',
  'LANG',
  'COLORTERM',
  'TMPDIR',
  'USER',
  'LOGNAME',
  'EDITOR',
  'VISUAL',
  'SSH_AUTH_SOCK',
  'XDG_RUNTIME_DIR',
  'XDG_CONFIG_HOME',
  'DISPLAY',
  'WAYLAND_DISPLAY',
] as const

const WINDOWS_ALLOWED = [
  'PATH',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'COMSPEC',
  'SYSTEMROOT',
  'APPDATA',
  'LOCALAPPDATA',
  'TEMP',
  'TMP',
  'PATHEXT',
  'USERNAME',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'PROCESSOR_ARCHITECTURE',
] as const

// ---------------------------------------------------------------------------
// Blocklist — these are NEVER forwarded, even if config.env tries to set them
// ---------------------------------------------------------------------------

const ALWAYS_BLOCKED = [
  'NODE_OPTIONS',
  'ELECTRON_RUN_AS_NODE',
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'NODE_PATH',
  'PYTHONPATH',
  'PERL5LIB',
] as const

// Pre-compute uppercase set for O(1) lookup
const BLOCKED_SET = new Set(ALWAYS_BLOCKED.map((k) => k.toUpperCase()))

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a safe environment from process.env using the platform-appropriate allowlist.
 * Only variables in the allowlist are included; everything else is dropped.
 */
export function getSafeEnv(): Record<string, string> {
  const allowed = process.platform === 'win32' ? WINDOWS_ALLOWED : UNIX_ALLOWED
  const env: Record<string, string> = {}

  for (const key of allowed) {
    const value = process.env[key]
    if (value !== undefined) {
      env[key] = value
    }
  }

  return env
}

/**
 * Check whether an environment variable key is on the block list.
 * Comparison is case-insensitive.
 */
export function isBlockedEnvVar(key: string): boolean {
  return BLOCKED_SET.has(key.toUpperCase())
}

/**
 * Merge user-provided env vars onto a safe base, enforcing the blocklist.
 * Blocked keys are silently dropped (logged to console.warn).
 */
export function mergeSafeEnv(
  base: Record<string, string>,
  extra: Record<string, string>,
): Record<string, string> {
  const merged = { ...base }

  for (const [key, value] of Object.entries(extra)) {
    if (isBlockedEnvVar(key)) {
      console.warn(`[safeEnv] Blocked dangerous env var: ${key}`)
      continue
    }
    merged[key] = value
  }

  return merged
}

// Re-export constants for testing
export { ALWAYS_BLOCKED, UNIX_ALLOWED, WINDOWS_ALLOWED }
