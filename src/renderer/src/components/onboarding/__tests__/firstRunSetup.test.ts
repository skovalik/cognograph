// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * FirstRunSetup — visibility logic tests
 *
 * Tests the derived gate condition:
 *   showFirstRunSetup = isElectron && connectors.length === 0 && !hasPassedFirstRunGate
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useConnectorStore } from '../../../stores/connectorStore'
import { useProgramStore } from '../../../stores/programStore'

function resetStores(): void {
  useProgramStore.setState({ hasPassedFirstRunGate: false })
  useConnectorStore.setState({ connectors: [], mcpConnectors: [], defaultLLMId: null })
}

// Mirror of the gate condition in App.tsx
function deriveShowFirstRunSetup(isElectron: boolean): boolean {
  const { hasPassedFirstRunGate } = useProgramStore.getState()
  const { connectors } = useConnectorStore.getState()
  return isElectron && connectors.length === 0 && !hasPassedFirstRunGate
}

describe('FirstRunSetup visibility logic', () => {
  beforeEach(resetStores)

  it('shows on desktop when no connectors and gate not passed', () => {
    expect(deriveShowFirstRunSetup(true)).toBe(true)
  })

  it('does not show on web (isElectron = false)', () => {
    expect(deriveShowFirstRunSetup(false)).toBe(false)
  })

  it('does not show when gate has been passed', () => {
    useProgramStore.getState().setFirstRunGatePassed()
    expect(deriveShowFirstRunSetup(true)).toBe(false)
  })

  it('does not show when a connector exists', () => {
    useConnectorStore.getState().addConnector({
      type: 'llm',
      name: 'Test',
      provider: 'anthropic',
      model: 'claude-opus-4-6',
    })
    expect(deriveShowFirstRunSetup(true)).toBe(false)
  })

  it('does not show when both gate passed and connectors exist', () => {
    useProgramStore.getState().setFirstRunGatePassed()
    useConnectorStore.getState().addConnector({
      type: 'llm',
      name: 'Test',
      provider: 'anthropic',
      model: 'claude-opus-4-6',
    })
    expect(deriveShowFirstRunSetup(true)).toBe(false)
  })
})
