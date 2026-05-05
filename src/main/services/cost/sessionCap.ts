// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * sessionCap.ts — Per-tenant Anthropic cost cap enforcement.
 *
 * Implements the per-tenant Anthropic cost cap plus a day-tier
 * extension.
 *
 * Default policy:
 *   - $1.00  / session soft cap (warn but don't abort)
 *   - $20.00 / day     soft cap (warn but don't abort)
 *   - $50.00 / day     hard cap (abort the call)
 *   - 80% alert threshold on each (warn at $0.80 / $16.00 / $40.00)
 *
 * The session-tier names AUROCHS_USD_PER_SESSION_SOFT and
 * AUROCHS_USD_PER_SESSION_HARD env vars; this module honors both plus the
 * day-tier extensions:
 *   - AUROCHS_USD_PER_DAY_SOFT, AUROCHS_USD_PER_DAY_HARD
 *   - AUROCHS_COST_ALERT_THRESHOLD (fraction in [0,1], default 0.80)
 *
 * Wire-in: see src/main/agent/agentLoop.ts where `assertUnderCap()` is
 * called via the optional `costGate` config field before each turn's
 * Anthropic stream call. The abort path emits CostCapExceeded; the agent
 * runner is responsible for surfacing this to the renderer (cost:cap-exceeded
 * IPC + ACU badge update).
 *
 * Storage: a pluggable CostStore interface. The default in-memory store is
 * intended for tests and dev; production code should call `setDefaultStore()`
 * with a Supabase-backed store (or pass an explicit store argument). This
 * module deliberately does NOT depend on @supabase/supabase-js so it can
 * be unit-tested without spinning up local Supabase.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WarnLevel = null | 'soft' | 'alert' | 'hard'

export type CapBreach = 'session-soft' | 'session-hard' | 'day-soft' | 'day-hard'

export interface CostState {
  /** Accumulated USD spend for the current session (does not roll over by day). */
  sessionUsd: number
  /** Accumulated USD spend for the current UTC day (rolls over at 00:00 UTC). */
  dayUsd: number
  /** UTC date key (YYYY-MM-DD) the dayUsd accumulator belongs to. */
  dayKey: string
}

export interface CostCaps {
  sessionSoftUsd: number
  sessionHardUsd: number | null
  daySoftUsd: number
  dayHardUsd: number
  /** Fraction in (0, 1) at which `warnLevel: 'alert'` is reported. */
  alertThreshold: number
}

export interface CostStore {
  read(tenantId: string): Promise<CostState | null>
  write(tenantId: string, state: CostState): Promise<void>
}

export class CostCapExceeded extends Error {
  readonly tenantId: string
  readonly current: CostState
  readonly projected: { sessionUsd: number; dayUsd: number }
  readonly caps: CostCaps
  readonly breach: CapBreach

  constructor(
    tenantId: string,
    current: CostState,
    projected: { sessionUsd: number; dayUsd: number },
    caps: CostCaps,
    breach: CapBreach,
  ) {
    super(
      `CostCapExceeded[${tenantId}]: ${breach} cap would be exceeded ` +
        `(current session=${current.sessionUsd.toFixed(4)}, day=${current.dayUsd.toFixed(4)}; ` +
        `projected session=${projected.sessionUsd.toFixed(4)}, day=${projected.dayUsd.toFixed(4)})`,
    )
    this.name = 'CostCapExceeded'
    this.tenantId = tenantId
    this.current = current
    this.projected = projected
    this.caps = caps
    this.breach = breach
  }
}

// ---------------------------------------------------------------------------
// Caps resolution (env-var overrides on locked defaults)
// ---------------------------------------------------------------------------

const LOCKED_DEFAULTS: CostCaps = {
  sessionSoftUsd: 1.0,
  sessionHardUsd: null,
  daySoftUsd: 20.0,
  dayHardUsd: 50.0,
  alertThreshold: 0.8,
}

function parseEnvUsd(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function parseEnvUsdOrNull(name: string, fallback: number | null): number | null {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  if (raw === 'none' || raw === 'null') return null
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function parseEnvFraction(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0 || n >= 1) return fallback
  return n
}

export function getCaps(): CostCaps {
  return {
    sessionSoftUsd: parseEnvUsd(
      'AUROCHS_USD_PER_SESSION_SOFT',
      LOCKED_DEFAULTS.sessionSoftUsd,
    ),
    sessionHardUsd: parseEnvUsdOrNull(
      'AUROCHS_USD_PER_SESSION_HARD',
      LOCKED_DEFAULTS.sessionHardUsd,
    ),
    daySoftUsd: parseEnvUsd('AUROCHS_USD_PER_DAY_SOFT', LOCKED_DEFAULTS.daySoftUsd),
    dayHardUsd: parseEnvUsd('AUROCHS_USD_PER_DAY_HARD', LOCKED_DEFAULTS.dayHardUsd),
    alertThreshold: parseEnvFraction(
      'AUROCHS_COST_ALERT_THRESHOLD',
      LOCKED_DEFAULTS.alertThreshold,
    ),
  }
}

// ---------------------------------------------------------------------------
// CostStore implementations
// ---------------------------------------------------------------------------

export function createInMemoryCostStore(): CostStore {
  const map = new Map<string, CostState>()
  return {
    async read(tenantId) {
      const state = map.get(tenantId)
      return state ? { ...state } : null
    },
    async write(tenantId, state) {
      map.set(tenantId, { ...state })
    },
  }
}

let defaultStore: CostStore = createInMemoryCostStore()

/**
 * Override the default cost store. Production code should call this once at
 * startup with a Supabase-backed store; tests can swap to in-memory.
 */
export function setDefaultCostStore(store: CostStore): void {
  defaultStore = store
}

/** @internal — for tests that need to reset between cases. */
export function _resetDefaultCostStoreForTesting(): void {
  defaultStore = createInMemoryCostStore()
}

// ---------------------------------------------------------------------------
// Day-key helpers (UTC roll-over)
// ---------------------------------------------------------------------------

function todayUtcKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function rolloverIfStale(state: CostState | null, now: Date = new Date()): CostState {
  const dayKey = todayUtcKey(now)
  if (!state) {
    return { sessionUsd: 0, dayUsd: 0, dayKey }
  }
  if (state.dayKey !== dayKey) {
    return { sessionUsd: state.sessionUsd, dayUsd: 0, dayKey }
  }
  return { ...state }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the current cost state for a tenant. Rolls over the day accumulator
 * if the persisted dayKey is stale.
 */
export async function getCostState(
  tenantId: string,
  store: CostStore = defaultStore,
): Promise<CostState> {
  return rolloverIfStale(await store.read(tenantId))
}

/**
 * Record an actual cost for a tenant after the call has billed.
 * Returns the new warn level + remaining day-hard budget so callers can
 * surface UI cues (ACU badge color, console warning, etc.).
 */
export async function recordCost(
  tenantId: string,
  costUsd: number,
  source: string,
  store: CostStore = defaultStore,
): Promise<{ remaining: number; warnLevel: WarnLevel; state: CostState }> {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    throw new TypeError(`recordCost: costUsd must be a non-negative finite number; got ${costUsd}`)
  }
  if (!tenantId) {
    throw new TypeError('recordCost: tenantId is required')
  }
  void source
  const caps = getCaps()
  const current = rolloverIfStale(await store.read(tenantId))
  const next: CostState = {
    sessionUsd: current.sessionUsd + costUsd,
    dayUsd: current.dayUsd + costUsd,
    dayKey: current.dayKey,
  }
  await store.write(tenantId, next)
  const warnLevel = computeWarnLevel(next, caps)
  const remaining = Math.max(0, caps.dayHardUsd - next.dayUsd)
  return { remaining, warnLevel, state: next }
}

/**
 * Assert that a projected cost will not breach the hard cap. Throws
 * CostCapExceeded if the projected cost would breach session-hard or
 * day-hard. Soft caps are permissive at this gate (the warn level is
 * surfaced via recordCost after the call completes).
 *
 * Wired into the Anthropic call site in agentLoop.ts to gate each turn
 * before billing tokens.
 */
export async function assertUnderCap(
  tenantId: string,
  projectedCostUsd: number,
  store: CostStore = defaultStore,
): Promise<void> {
  if (!Number.isFinite(projectedCostUsd) || projectedCostUsd < 0) {
    throw new TypeError(
      `assertUnderCap: projectedCostUsd must be a non-negative finite number; got ${projectedCostUsd}`,
    )
  }
  if (!tenantId) {
    throw new TypeError('assertUnderCap: tenantId is required')
  }
  const caps = getCaps()
  const current = rolloverIfStale(await store.read(tenantId))
  const projected = {
    sessionUsd: current.sessionUsd + projectedCostUsd,
    dayUsd: current.dayUsd + projectedCostUsd,
  }
  if (projected.dayUsd > caps.dayHardUsd) {
    throw new CostCapExceeded(tenantId, current, projected, caps, 'day-hard')
  }
  if (caps.sessionHardUsd != null && projected.sessionUsd > caps.sessionHardUsd) {
    throw new CostCapExceeded(tenantId, current, projected, caps, 'session-hard')
  }
}

// ---------------------------------------------------------------------------
// Internal: warn-level resolver
// ---------------------------------------------------------------------------

function computeWarnLevel(state: CostState, caps: CostCaps): WarnLevel {
  if (state.dayUsd >= caps.dayHardUsd) return 'hard'
  if (caps.sessionHardUsd != null && state.sessionUsd >= caps.sessionHardUsd) return 'hard'
  if (state.dayUsd >= caps.daySoftUsd) return 'soft'
  if (state.sessionUsd >= caps.sessionSoftUsd) return 'soft'
  if (state.dayUsd >= caps.daySoftUsd * caps.alertThreshold) return 'alert'
  if (state.sessionUsd >= caps.sessionSoftUsd * caps.alertThreshold) return 'alert'
  return null
}

/** @internal — exposed for testing. */
export const __test = {
  computeWarnLevel,
  rolloverIfStale,
  todayUtcKey,
  LOCKED_DEFAULTS,
}
