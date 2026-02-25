/**
 * Context Selection Store Tests
 *
 * Tests for the transient Ctrl+Click context selection store.
 * PFD Phase 5B: Canvas Interaction Patterns
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useContextSelectionStore } from '../contextSelectionStore'

describe('contextSelectionStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useContextSelectionStore.getState().clear()
  })

  it('toggle adds a nodeId when not present', () => {
    const { toggle, selectedNodeIds } = useContextSelectionStore.getState()
    expect(selectedNodeIds.size).toBe(0)

    toggle('node-1')

    expect(useContextSelectionStore.getState().selectedNodeIds.has('node-1')).toBe(true)
    expect(useContextSelectionStore.getState().selectedNodeIds.size).toBe(1)
  })

  it('toggle removes a nodeId when already present', () => {
    const store = useContextSelectionStore.getState()
    store.toggle('node-1')
    expect(useContextSelectionStore.getState().selectedNodeIds.has('node-1')).toBe(true)

    store.toggle('node-1')
    expect(useContextSelectionStore.getState().selectedNodeIds.has('node-1')).toBe(false)
    expect(useContextSelectionStore.getState().selectedNodeIds.size).toBe(0)
  })

  it('clear empties the selection set', () => {
    const store = useContextSelectionStore.getState()
    store.toggle('node-1')
    store.toggle('node-2')
    store.toggle('node-3')
    expect(useContextSelectionStore.getState().selectedNodeIds.size).toBe(3)

    store.clear()
    expect(useContextSelectionStore.getState().selectedNodeIds.size).toBe(0)
  })

  it('isSelected returns correct boolean', () => {
    const store = useContextSelectionStore.getState()
    expect(store.isSelected('node-1')).toBe(false)

    store.toggle('node-1')
    expect(useContextSelectionStore.getState().isSelected('node-1')).toBe(true)
    expect(useContextSelectionStore.getState().isSelected('node-2')).toBe(false)
  })

  it('multiple nodes can be selected simultaneously', () => {
    const store = useContextSelectionStore.getState()
    store.toggle('node-a')
    store.toggle('node-b')
    store.toggle('node-c')

    const state = useContextSelectionStore.getState()
    expect(state.selectedNodeIds.size).toBe(3)
    expect(state.isSelected('node-a')).toBe(true)
    expect(state.isSelected('node-b')).toBe(true)
    expect(state.isSelected('node-c')).toBe(true)
  })

  it('toggle is idempotent — toggling twice returns to original state', () => {
    const store = useContextSelectionStore.getState()
    store.toggle('node-x')
    store.toggle('node-x')
    expect(useContextSelectionStore.getState().selectedNodeIds.size).toBe(0)
  })
})
