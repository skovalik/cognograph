// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { beforeEach, describe, expect, it } from 'vitest'
import { useProgramStore } from '../programStore'

function resetStore(): void {
  useProgramStore.setState({
    hasPassedFirstRunGate: false,
  })
}

describe('programStore — first-run gate', () => {
  beforeEach(resetStore)

  it('starts with hasPassedFirstRunGate = false', () => {
    expect(useProgramStore.getState().hasPassedFirstRunGate).toBe(false)
  })

  it('setFirstRunGatePassed sets flag to true', () => {
    useProgramStore.getState().setFirstRunGatePassed()
    expect(useProgramStore.getState().hasPassedFirstRunGate).toBe(true)
  })

  it('setFirstRunGatePassed is idempotent', () => {
    useProgramStore.getState().setFirstRunGatePassed()
    useProgramStore.getState().setFirstRunGatePassed()
    expect(useProgramStore.getState().hasPassedFirstRunGate).toBe(true)
  })
})
