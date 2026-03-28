// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Autonomy Guard — Circuit breaker for autonomous action chains.
 *
 * Prevents runaway action loops by enforcing:
 * 1. Depth limit: actions triggered by other actions cap at depth 3
 * 2. Rate limit: max 10 autonomous actions in any 30-second window
 * 3. Causal chain logging: every action records what triggered it
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_DEPTH = 3
const MAX_ACTIONS_PER_WINDOW = 10
const WINDOW_MS = 30_000

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface CausalEntry {
  actionId: string
  triggerSource: string
  parentActionId?: string
  depth: number
  timestamp: number
}

/** Rolling window of recent autonomous actions */
const recentActions: CausalEntry[] = []

/** Depth tracker: actionId -> current depth */
const depthMap = new Map<string, number>()

/** Full causal log (capped to last 200 entries to avoid unbounded growth) */
const causalLog: CausalEntry[] = []
const MAX_LOG_SIZE = 200

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AutonomyGuardResult {
  allowed: boolean
  reason?: string
}

/**
 * Check whether an autonomous action is allowed to proceed.
 *
 * @param triggerSource - Human-readable description of what triggered this action
 *   (e.g. "proximity:nodeA->nodeB", "region-enter:zone1", "action:abc123")
 * @param parentActionId - If this action was triggered by another action, its ID.
 *   Used for depth tracking. Omit for user-initiated or event-initiated actions.
 * @returns { allowed, reason } — if not allowed, reason explains why.
 */
export function checkAutonomyGuard(
  triggerSource: string,
  parentActionId?: string
): AutonomyGuardResult {
  const now = Date.now()

  // --- Depth check ---
  let depth = 0
  if (parentActionId) {
    const parentDepth = depthMap.get(parentActionId) ?? 0
    depth = parentDepth + 1
    if (depth > MAX_DEPTH) {
      console.warn(
        `[AutonomyGuard] Depth limit exceeded (${depth}/${MAX_DEPTH}). ` +
        `Trigger: ${triggerSource}, parent: ${parentActionId}`
      )
      return {
        allowed: false,
        reason: `Action chain depth ${depth} exceeds maximum of ${MAX_DEPTH}. ` +
          `Triggered by: ${triggerSource}`
      }
    }
  }

  // --- Rate limit check ---
  // Prune entries outside the window
  const windowStart = now - WINDOW_MS
  while (recentActions.length > 0 && recentActions[0]!.timestamp < windowStart) {
    recentActions.shift()
  }

  if (recentActions.length >= MAX_ACTIONS_PER_WINDOW) {
    console.warn(
      `[AutonomyGuard] Rate limit exceeded (${recentActions.length}/${MAX_ACTIONS_PER_WINDOW} in ${WINDOW_MS / 1000}s). ` +
      `Trigger: ${triggerSource}. All autonomous actions paused.`
    )
    return {
      allowed: false,
      reason: `Rate limit: ${recentActions.length} autonomous actions in ${WINDOW_MS / 1000}s. ` +
        `Pausing all autonomous execution. Triggered by: ${triggerSource}`
    }
  }

  // --- Allowed: record the action ---
  const actionId = `auto-${now}-${Math.random().toString(36).slice(2, 7)}`
  const entry: CausalEntry = {
    actionId,
    triggerSource,
    parentActionId,
    depth,
    timestamp: now
  }

  recentActions.push(entry)
  depthMap.set(actionId, depth)

  // Causal chain log (bounded)
  causalLog.push(entry)
  if (causalLog.length > MAX_LOG_SIZE) {
    causalLog.splice(0, causalLog.length - MAX_LOG_SIZE)
  }

  return { allowed: true }
}

/**
 * Get the causal chain log for debugging / UI display.
 * Returns a copy so consumers cannot mutate internal state.
 */
export function getCausalLog(): readonly CausalEntry[] {
  return [...causalLog]
}

/**
 * Reset all autonomy guard state. Useful for tests or user-initiated reset.
 */
export function resetAutonomyGuard(): void {
  recentActions.length = 0
  depthMap.clear()
  causalLog.length = 0
}
