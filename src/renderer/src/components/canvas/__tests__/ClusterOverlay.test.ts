import { describe, it, expect } from 'vitest'
import {
  buildStatusText,
  computeBubbleSize,
  TYPE_ICONS,
  TYPE_COLORS,
  TYPE_BORDER_COLORS,
  ClusterOverlay
} from '../ClusterOverlay'
import type { Cluster } from '../../../utils/clusterEngine'

// Helper: create a minimal Cluster object for testing pure functions
function makeCluster(overrides: Partial<Cluster> = {}): Cluster {
  return {
    id: 'cluster-0-0',
    nodeIds: ['n1', 'n2'],
    centroid: { x: 100, y: 100 },
    bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 },
    dominantType: 'note',
    summary: {
      nodeCount: 2,
      typeCounts: { note: 2 },
      statusCounts: {}
    },
    ...overrides
  }
}

describe('ClusterOverlay', () => {
  // 1. Module imports without errors
  it('should export ClusterOverlay component', () => {
    expect(ClusterOverlay).toBeDefined()
    expect(typeof ClusterOverlay).toBe('object') // memo wraps in object
  })

  // 2. ClusterOverlay is memoized (React.memo wraps component)
  it('should be a memoized component', () => {
    // React.memo components have a $$typeof of Symbol(react.memo) or a .type property
    // In the test environment, memo components are objects with a `type` function
    expect(ClusterOverlay).toHaveProperty('type')
    expect(typeof (ClusterOverlay as unknown as { type: unknown }).type).toBe('function')
  })

  // 3. buildStatusText: task cluster with 3/5 done
  it('should return "3/5 done" for task cluster with 3 done out of 5', () => {
    const cluster = makeCluster({
      summary: {
        nodeCount: 7,
        typeCounts: { task: 5, note: 2 },
        statusCounts: { done: 3, 'in-progress': 2 }
      }
    })
    expect(buildStatusText(cluster)).toBe('3/5 done')
  })

  // 4. buildStatusText: non-task cluster with statuses
  it('should return "N status" for non-task cluster with statuses', () => {
    const cluster = makeCluster({
      summary: {
        nodeCount: 4,
        typeCounts: { note: 3, conversation: 1 },
        statusCounts: { active: 2, blocked: 1 }
      }
    })
    expect(buildStatusText(cluster)).toBe('2 active')
  })

  // 5. buildStatusText: cluster with no statuses
  it('should return null for cluster with no statuses', () => {
    const cluster = makeCluster({
      summary: {
        nodeCount: 3,
        typeCounts: { note: 3 },
        statusCounts: {}
      }
    })
    expect(buildStatusText(cluster)).toBeNull()
  })

  // 6. Type icon mapping covers all 9 types
  it('should have icon mappings for all 9 node types', () => {
    const expectedTypes = [
      'conversation',
      'task',
      'note',
      'project',
      'artifact',
      'workspace',
      'orchestrator',
      'action',
      'text'
    ]
    for (const type of expectedTypes) {
      expect(TYPE_ICONS[type]).toBeDefined()
      // Lucide icons are forwardRef components — typeof is 'object' or 'function'
      expect(['function', 'object']).toContain(typeof TYPE_ICONS[type])
    }
    expect(Object.keys(TYPE_ICONS)).toHaveLength(9)
  })

  // 7. Type color mapping covers all 9 types
  it('should have color and border-color mappings for all 9 node types', () => {
    const expectedTypes = [
      'conversation',
      'task',
      'note',
      'project',
      'artifact',
      'workspace',
      'orchestrator',
      'action',
      'text'
    ]
    for (const type of expectedTypes) {
      expect(TYPE_COLORS[type]).toBeDefined()
      expect(TYPE_COLORS[type]).toMatch(/^rgba\(/)
      expect(TYPE_BORDER_COLORS[type]).toBeDefined()
      expect(TYPE_BORDER_COLORS[type]).toMatch(/^rgba\(/)
    }
    expect(Object.keys(TYPE_COLORS)).toHaveLength(9)
    expect(Object.keys(TYPE_BORDER_COLORS)).toHaveLength(9)
  })

  // 8. Bubble size calculation
  it('should compute bubble size: base 56 + min(count * 2, 24)', () => {
    expect(computeBubbleSize(0)).toBe(56)       // 56 + 0
    expect(computeBubbleSize(5)).toBe(66)       // 56 + 10
    expect(computeBubbleSize(10)).toBe(76)      // 56 + 20
    expect(computeBubbleSize(12)).toBe(80)      // 56 + 24 (cap)
    expect(computeBubbleSize(100)).toBe(80)     // 56 + 24 (cap)
  })

  // 9. buildStatusText edge case: task cluster with 0 done
  it('should return "0/N done" for task cluster with zero done', () => {
    const cluster = makeCluster({
      summary: {
        nodeCount: 3,
        typeCounts: { task: 3 },
        statusCounts: { 'in-progress': 2, blocked: 1 }
      }
    })
    expect(buildStatusText(cluster)).toBe('0/3 done')
  })

  // 10. buildStatusText edge case: mixed cluster with tasks takes task path
  it('should use task status format when cluster has any task nodes', () => {
    const cluster = makeCluster({
      summary: {
        nodeCount: 5,
        typeCounts: { note: 3, task: 2 },
        statusCounts: { done: 1, active: 3 }
      }
    })
    // Has tasks -> "done/taskCount done" format
    expect(buildStatusText(cluster)).toBe('1/2 done')
  })
})
