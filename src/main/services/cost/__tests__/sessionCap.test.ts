// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * sessionCap.test.ts — abort-path runtime test.
 *
 * Verifies the locked policy:
 *   - $1.00  / session soft cap (warn but don't abort)
 *   - $20.00 / day     soft cap (warn but don't abort)
 *   - $50.00 / day     hard cap (abort the call)
 *   - 80% alert threshold on each (warn at $0.80 / $16.00 / $40.00)
 *
 * Test scenarios:
 *   1. Seed tenant cost-state at $49.99/day; project $0.50 -> CostCapExceeded
 *      thrown + the call is NOT made.
 *   2. Seed at $0.80/sess; recordCost yields warnLevel='alert' (no throw,
 *      under all soft caps but at 80% session-soft).
 *
 * Plus auxiliary scenarios that lock the warn-level ladder + UTC roll-over
 * semantics.
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  __test,
  assertUnderCap,
  CostCapExceeded,
  createInMemoryCostStore,
  getCaps,
  getCostState,
  recordCost,
} from '../sessionCap'

describe('sessionCap — locked policy', () => {
  afterEach(() => {
    delete process.env.AUROCHS_USD_PER_SESSION_SOFT
    delete process.env.AUROCHS_USD_PER_SESSION_HARD
    delete process.env.AUROCHS_USD_PER_DAY_SOFT
    delete process.env.AUROCHS_USD_PER_DAY_HARD
    delete process.env.AUROCHS_COST_ALERT_THRESHOLD
  })

  it('default caps match the locked policy', () => {
    const caps = getCaps()
    expect(caps.sessionSoftUsd).toBe(1.0)
    expect(caps.sessionHardUsd).toBeNull()
    expect(caps.daySoftUsd).toBe(20.0)
    expect(caps.dayHardUsd).toBe(50.0)
    expect(caps.alertThreshold).toBeCloseTo(0.8)
  })

  it('NEGATIVE: tenant at $49.99/day, projected $0.50 cost -> CostCapExceeded thrown + no recordCost', async () => {
    const store = createInMemoryCostStore()
    const tenantId = 'tenant-day-hard-breach'
    const dayKey = __test.todayUtcKey()
    await store.write(tenantId, { sessionUsd: 0.5, dayUsd: 49.99, dayKey })

    let thrown: unknown = null
    try {
      await assertUnderCap(tenantId, 0.5, store)
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(CostCapExceeded)
    if (thrown instanceof CostCapExceeded) {
      expect(thrown.breach).toBe('day-hard')
      expect(thrown.tenantId).toBe(tenantId)
      expect(thrown.current.dayUsd).toBeCloseTo(49.99)
      expect(thrown.projected.dayUsd).toBeCloseTo(50.49)
    }

    // Store state must NOT have advanced — assertUnderCap is a read-only gate.
    const stateAfter = await getCostState(tenantId, store)
    expect(stateAfter.dayUsd).toBeCloseTo(49.99)
    expect(stateAfter.sessionUsd).toBeCloseTo(0.5)
  })

  it('POSITIVE: $0.80 session spend -> warnLevel="alert" (80% of $1 session-soft)', async () => {
    const store = createInMemoryCostStore()
    const tenantId = 'tenant-soft-alert'
    const dayKey = __test.todayUtcKey()
    // Seed at $0 — recordCost crosses the alert threshold in one shot.
    await store.write(tenantId, { sessionUsd: 0, dayUsd: 0, dayKey })

    const result = await recordCost(tenantId, 0.8, 'unit-test', store)

    expect(result.warnLevel).toBe('alert')
    expect(result.state.sessionUsd).toBeCloseTo(0.8)
    expect(result.state.dayUsd).toBeCloseTo(0.8)
    expect(result.remaining).toBeCloseTo(50.0 - 0.8)
  })

  it('POSITIVE: $1.01 session spend (no day breach) -> warnLevel="soft" (above session-soft, below day-soft)', async () => {
    const store = createInMemoryCostStore()
    const tenantId = 'tenant-session-soft'
    const dayKey = __test.todayUtcKey()
    await store.write(tenantId, { sessionUsd: 0, dayUsd: 0, dayKey })

    const result = await recordCost(tenantId, 1.01, 'unit-test', store)

    expect(result.warnLevel).toBe('soft')
    expect(result.state.sessionUsd).toBeCloseTo(1.01)
  })

  it('POSITIVE: $0.50 spend on a fresh tenant -> warnLevel=null (under all thresholds)', async () => {
    const store = createInMemoryCostStore()
    const result = await recordCost('tenant-clean', 0.5, 'unit-test', store)
    expect(result.warnLevel).toBeNull()
  })

  it('hard warn-level reported when day spend reaches $50 cap exactly', async () => {
    const store = createInMemoryCostStore()
    const tenantId = 'tenant-hard-exact'
    const dayKey = __test.todayUtcKey()
    await store.write(tenantId, { sessionUsd: 0, dayUsd: 49.5, dayKey })

    const result = await recordCost(tenantId, 0.5, 'unit-test', store)
    expect(result.warnLevel).toBe('hard')
    expect(result.state.dayUsd).toBeCloseTo(50.0)
    expect(result.remaining).toBe(0)
  })

  it('UTC roll-over: stale dayKey resets dayUsd accumulator', () => {
    const stale = { sessionUsd: 5.0, dayUsd: 30.0, dayKey: '2020-01-01' }
    const rolled = __test.rolloverIfStale(stale, new Date())
    expect(rolled.dayUsd).toBe(0)
    expect(rolled.sessionUsd).toBe(5.0)
    expect(rolled.dayKey).toBe(__test.todayUtcKey())
  })

  it('env-var override: AUROCHS_USD_PER_DAY_HARD raises the day cap', async () => {
    process.env.AUROCHS_USD_PER_DAY_HARD = '100'
    const caps = getCaps()
    expect(caps.dayHardUsd).toBe(100)

    const store = createInMemoryCostStore()
    const tenantId = 'tenant-env-override'
    const dayKey = __test.todayUtcKey()
    await store.write(tenantId, { sessionUsd: 0, dayUsd: 49.99, dayKey })
    // Under the original $50 cap this projected $0.50 would throw; with the
    // override at $100 it must NOT throw.
    await expect(assertUnderCap(tenantId, 0.5, store)).resolves.toBeUndefined()
  })

  it('env-var override: AUROCHS_USD_PER_SESSION_HARD enables session-hard breach', async () => {
    process.env.AUROCHS_USD_PER_SESSION_HARD = '5'
    const store = createInMemoryCostStore()
    const tenantId = 'tenant-session-hard-on'
    const dayKey = __test.todayUtcKey()
    await store.write(tenantId, { sessionUsd: 4.5, dayUsd: 4.5, dayKey })

    let thrown: unknown = null
    try {
      await assertUnderCap(tenantId, 1.0, store)
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(CostCapExceeded)
    if (thrown instanceof CostCapExceeded) {
      expect(thrown.breach).toBe('session-hard')
    }
  })

  it('rejects negative or non-finite projectedCostUsd', async () => {
    const store = createInMemoryCostStore()
    await expect(assertUnderCap('t', -1, store)).rejects.toThrow(TypeError)
    await expect(assertUnderCap('t', Number.NaN, store)).rejects.toThrow(TypeError)
    await expect(assertUnderCap('t', Number.POSITIVE_INFINITY, store)).rejects.toThrow(TypeError)
  })

  it('rejects negative or non-finite costUsd in recordCost', async () => {
    const store = createInMemoryCostStore()
    await expect(recordCost('t', -1, 'src', store)).rejects.toThrow(TypeError)
    await expect(recordCost('t', Number.NaN, 'src', store)).rejects.toThrow(TypeError)
  })
})
