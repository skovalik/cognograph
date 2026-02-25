/**
 * Depth-of-Field (Phase 6A) -- BFS ring computation tests
 *
 * Tests the pure computeDepthOfField function and DoF store actions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeDepthOfField,
  useContextVisualizationStore,
  selectNodeDepthRing,
  DOF_MAX_RING,
  DOF_DISCONNECTED,
  type DofNode,
  type DofEdge
} from '../contextVisualizationStore'

// --- Helpers ---------------------------------------------------------------

function makeNodes(...ids: string[]): DofNode[] {
  return ids.map((id) => ({ id }))
}

function makeEdge(source: string, target: string): DofEdge {
  return { id: `${source}->${target}`, source, target }
}
// --- computeDepthOfField tests --------------------------------------------

describe('computeDepthOfField -- BFS ring computation', () => {
  it('assigns ring 0 to the focus node', () => {
    const nodes = makeNodes('A', 'B', 'C')
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('A')).toBe(0)
  })

  it('assigns ring 1 to direct neighbors (1-hop)', () => {
    const nodes = makeNodes('A', 'B', 'C')
    const edges = [makeEdge('A', 'B'), makeEdge('A', 'C')]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('B')).toBe(1)
    expect(rings.get('C')).toBe(1)
  })

  it('assigns ring 2 to 2-hop neighbors', () => {
    const nodes = makeNodes('A', 'B', 'C')
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('B')).toBe(1)
    expect(rings.get('C')).toBe(2)
  })

  it('assigns ring 3 to nodes exactly 3 hops away', () => {
    const nodes = makeNodes('A', 'B', 'C', 'D')
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C'), makeEdge('C', 'D')]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('D')).toBe(3)
  })

  it('caps at ring 3 for nodes 4+ hops away', () => {
    const nodes = makeNodes('A', 'B', 'C', 'D', 'E', 'F')
    const edges = [
      makeEdge('A', 'B'),
      makeEdge('B', 'C'),
      makeEdge('C', 'D'),
      makeEdge('D', 'E'),
      makeEdge('E', 'F')
    ]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('D')).toBe(DOF_MAX_RING)
    expect(rings.get('E')).toBe(DOF_MAX_RING)
    expect(rings.get('F')).toBe(DOF_MAX_RING)
  })

  it('marks disconnected nodes as -1', () => {
    const nodes = makeNodes('A', 'B', 'C', 'island')
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('island')).toBe(DOF_DISCONNECTED)
  })

  it('handles empty graph -- only focus node at ring 0', () => {
    const nodes = makeNodes('A')
    const edges: DofEdge[] = []
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('A')).toBe(0)
    expect(rings.size).toBe(1)
  })

  it('handles focus node not in node list', () => {
    const nodes = makeNodes('B', 'C')
    const edges = [makeEdge('A', 'B')]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('A')).toBe(0)
    expect(rings.get('B')).toBe(1)
    expect(rings.get('C')).toBe(DOF_DISCONNECTED)
  })
  it('treats edges as undirected (bidirectional traversal)', () => {
    const nodes = makeNodes('A', 'B', 'C')
    const edges = [makeEdge('B', 'A'), makeEdge('C', 'B')]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('B')).toBe(1)
    expect(rings.get('C')).toBe(2)
  })

  it('handles graph with cycles correctly', () => {
    const nodes = makeNodes('A', 'B', 'C')
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C'), makeEdge('C', 'A')]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('A')).toBe(0)
    expect(rings.get('B')).toBe(1)
    expect(rings.get('C')).toBe(1)
  })

  it('handles multiple disconnected components', () => {
    const nodes = makeNodes('A', 'B', 'X', 'Y')
    const edges = [makeEdge('A', 'B'), makeEdge('X', 'Y')]
    const rings = computeDepthOfField('A', nodes, edges)
    expect(rings.get('A')).toBe(0)
    expect(rings.get('B')).toBe(1)
    expect(rings.get('X')).toBe(DOF_DISCONNECTED)
    expect(rings.get('Y')).toBe(DOF_DISCONNECTED)
  })

  it('handles star topology -- all leaf nodes at ring 1', () => {
    const nodes = makeNodes('hub', 'a', 'b', 'c', 'd')
    const edges = [
      makeEdge('hub', 'a'),
      makeEdge('hub', 'b'),
      makeEdge('hub', 'c'),
      makeEdge('hub', 'd')
    ]
    const rings = computeDepthOfField('hub', nodes, edges)
    expect(rings.get('hub')).toBe(0)
    expect(rings.get('a')).toBe(1)
    expect(rings.get('b')).toBe(1)
    expect(rings.get('c')).toBe(1)
    expect(rings.get('d')).toBe(1)
  })
})
// --- Store integration tests ----------------------------------------------

describe('contextVisualizationStore -- DoF state', () => {
  beforeEach(() => {
    const store = useContextVisualizationStore.getState()
    store.setDofEnabled(false)
    store.setDofFocus(null)
  })

  it('setDofEnabled toggles dofEnabled', () => {
    const store = useContextVisualizationStore.getState()
    expect(store.dofEnabled).toBe(false)

    store.setDofEnabled(true)
    expect(useContextVisualizationStore.getState().dofEnabled).toBe(true)

    store.setDofEnabled(false)
    expect(useContextVisualizationStore.getState().dofEnabled).toBe(false)
  })

  it('setDofFocus updates dofFocusNodeId', () => {
    const store = useContextVisualizationStore.getState()
    expect(store.dofFocusNodeId).toBeNull()

    store.setDofFocus('node-1')
    expect(useContextVisualizationStore.getState().dofFocusNodeId).toBe('node-1')

    store.setDofFocus(null)
    expect(useContextVisualizationStore.getState().dofFocusNodeId).toBeNull()
  })

  it('updateDofRings computes and stores rings', () => {
    const store = useContextVisualizationStore.getState()
    const nodes = makeNodes('A', 'B', 'C')
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')]

    store.updateDofRings('A', nodes, edges)

    const state = useContextVisualizationStore.getState()
    expect(state.dofFocusNodeId).toBe('A')
    expect(state.dofRings.get('A')).toBe(0)
    expect(state.dofRings.get('B')).toBe(1)
    expect(state.dofRings.get('C')).toBe(2)
  })

  it('selectNodeDepthRing returns -1 when DoF is disabled', () => {
    const store = useContextVisualizationStore.getState()
    store.setDofEnabled(false)
    store.setDofFocus('A')
    expect(selectNodeDepthRing('A')).toBe(DOF_DISCONNECTED)
  })

  it('selectNodeDepthRing returns -1 when no focus node', () => {
    const store = useContextVisualizationStore.getState()
    store.setDofEnabled(true)
    store.setDofFocus(null)
    expect(selectNodeDepthRing('A')).toBe(DOF_DISCONNECTED)
  })

  it('selectNodeDepthRing returns correct ring when DoF is active', () => {
    const store = useContextVisualizationStore.getState()
    const nodes = makeNodes('A', 'B', 'C')
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')]

    store.setDofEnabled(true)
    store.updateDofRings('A', nodes, edges)

    expect(selectNodeDepthRing('A')).toBe(0)
    expect(selectNodeDepthRing('B')).toBe(1)
    expect(selectNodeDepthRing('C')).toBe(2)
  })

  it('selectNodeDepthRing returns -1 for unknown nodes', () => {
    const store = useContextVisualizationStore.getState()
    store.setDofEnabled(true)
    store.updateDofRings('A', makeNodes('A'), [])

    expect(selectNodeDepthRing('unknown-node')).toBe(DOF_DISCONNECTED)
  })
})
