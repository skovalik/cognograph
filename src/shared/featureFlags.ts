// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// =============================================================================
// Feature Flags — lightweight gradual rollout
// =============================================================================
//
// Flags are resolved in order:
//   1. Environment variable (COGNOGRAPH_FF_<FLAG_NAME>) — for CI / main process
//   2. localStorage (cognograph.ff.<flagName>) — for renderer overrides
//   3. Default value defined below
//
// All flags default to `true` (current/stable behavior). Set to `false` to
// disable a feature during migration or rollback.

// -----------------------------------------------------------------------------
// Flag definitions
// -----------------------------------------------------------------------------

export interface FeatureFlagDefinition {
  /** Human-readable description */
  description: string
  /** Default value when no override is present */
  defaultValue: boolean
}

/**
 * Registry of all feature flags.
 * Add new flags here as the refactor progresses.
 */
export const FLAG_DEFINITIONS = {
  /**
   * Phase 2 transition: route tool execution through the main process
   * IPC bridge instead of the renderer's in-process adapter.
   */
  USE_MAIN_PROCESS_TOOLS: {
    description: 'Route tool execution through main process IPC bridge',
    defaultValue: true,
  },

  /**
   * Phase 4: persist workspace data as append-only JSONL instead of
   * the legacy JSON-blob-per-save approach.
   */
  JSONL_PERSISTENCE: {
    description: 'Use append-only JSONL persistence layer',
    defaultValue: true,
  },

  /**
   * WS3: Enable responsive mobile layout (FAB, drawer, bottom sheets).
   * When false, mobile users see the pre-WS3 bare canvas (all chrome hidden).
   */
  MOBILE_RESPONSIVE: {
    description: 'Enable responsive mobile layout (FAB, drawer, bottom sheets)',
    defaultValue: true,
  },
} as const satisfies Record<string, FeatureFlagDefinition>

export type FeatureFlagName = keyof typeof FLAG_DEFINITIONS

// -----------------------------------------------------------------------------
// Resolution
// -----------------------------------------------------------------------------

/**
 * Read an environment variable override.
 * Works in Node (main process) and gracefully returns undefined in the renderer.
 */
function envOverride(flag: FeatureFlagName): boolean | undefined {
  try {
    // Environment variables use SCREAMING_SNAKE with a prefix
    const envKey = `COGNOGRAPH_FF_${flag}`
    const value =
      typeof process !== 'undefined' && process.env
        ? process.env[envKey]
        : undefined

    if (value === undefined) return undefined
    return value === '1' || value.toLowerCase() === 'true'
  } catch {
    return undefined
  }
}

/**
 * Read a localStorage override (renderer only).
 */
function storageOverride(flag: FeatureFlagName): boolean | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined
    const key = `cognograph.ff.${flag}`
    const value = localStorage.getItem(key)
    if (value === null) return undefined
    return value === '1' || value === 'true'
  } catch {
    return undefined
  }
}

/**
 * Resolve a feature flag value.
 *
 * Priority: env var > localStorage > default.
 *
 * @example
 *   if (getFlag('USE_MAIN_PROCESS_TOOLS')) {
 *     // use IPC bridge
 *   }
 */
export function getFlag(flag: FeatureFlagName): boolean {
  const env = envOverride(flag)
  if (env !== undefined) return env

  const storage = storageOverride(flag)
  if (storage !== undefined) return storage

  return FLAG_DEFINITIONS[flag].defaultValue
}

/**
 * Set a flag override in localStorage (renderer only).
 * Useful for dev tools / debugging panels.
 */
export function setFlagOverride(flag: FeatureFlagName, value: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(`cognograph.ff.${flag}`, value ? '1' : '0')
  } catch {
    // Silently fail in environments without localStorage
  }
}

/**
 * Clear a localStorage override so the flag falls back to env / default.
 */
export function clearFlagOverride(flag: FeatureFlagName): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(`cognograph.ff.${flag}`)
  } catch {
    // Silently fail in environments without localStorage
  }
}

/**
 * Return a snapshot of all flag values (useful for diagnostics / logging).
 */
export function getAllFlags(): Record<FeatureFlagName, boolean> {
  const flags = {} as Record<FeatureFlagName, boolean>
  for (const key of Object.keys(FLAG_DEFINITIONS) as FeatureFlagName[]) {
    flags[key] = getFlag(key)
  }
  return flags
}
