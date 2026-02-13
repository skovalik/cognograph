/**
 * BridgeLogPanel Component Tests
 *
 * Tests for the Bridge Log panel UI:
 * - Module exports verification
 * - ActorBadge component (only one without deep shadcn deps)
 *
 * Note: BridgeLogPanel, EventCard, InsightIndicator, and CostDashboard
 * import shadcn UI components that use @/lib/utils path alias, which
 * doesn't resolve in the vitest test environment. These components are
 * verified via tsc --noEmit type checking instead of import tests.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock all shadcn UI components and their deep dependencies
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('../../lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// =============================================================================
// Tests
// =============================================================================

describe('Bridge Component Exports', () => {
  describe('ActorBadge', () => {
    it('should be importable without errors', async () => {
      const mod = await import('../bridge/ActorBadge')
      expect(mod.ActorBadge).toBeDefined()
    })

    it('should be a memoized component', async () => {
      const mod = await import('../bridge/ActorBadge')
      // React.memo wraps the component
      expect(typeof mod.ActorBadge).toBe('object')
    })
  })

  describe('Bridge barrel export', () => {
    it('should export all bridge components from index', async () => {
      // Test the barrel export list by importing the index
      // and verifying the named exports exist
      const indexMod = await import('../bridge/index')
      const exportNames = Object.keys(indexMod)

      // Phase 1 components (pre-existing)
      expect(exportNames).toContain('BridgeStatusBar')
      expect(exportNames).toContain('AgentActivityBadge')
      expect(exportNames).toContain('OrchestratorBadge')

      // Phase 2 components (new - Bridge Log)
      expect(exportNames).toContain('ActorBadge')
      expect(exportNames).toContain('EventCard')
      expect(exportNames).toContain('BridgeLogPanel')

      // Phase 5 components (new - Graph Intelligence)
      expect(exportNames).toContain('InsightIndicator')
      expect(exportNames).toContain('CostDashboard')
    })
  })
})

describe('Audit Utility Exports', () => {
  it('should export all audit event helpers', async () => {
    const mod = await import('../../utils/auditHooks')

    // Core emit
    expect(mod.emitAuditEvent).toBeDefined()
    expect(typeof mod.emitAuditEvent).toBe('function')

    // Workspace helpers
    expect(mod.emitNodeCreated).toBeDefined()
    expect(mod.emitNodeDeleted).toBeDefined()
    expect(mod.emitNodeUpdated).toBeDefined()
    expect(mod.emitEdgeCreated).toBeDefined()
    expect(mod.emitEdgeDeleted).toBeDefined()

    // Orchestrator helpers
    expect(mod.emitOrchestrationStarted).toBeDefined()
    expect(mod.emitOrchestrationCompleted).toBeDefined()
    expect(mod.emitOrchestrationFailed).toBeDefined()
    expect(mod.emitAgentStarted).toBeDefined()
    expect(mod.emitAgentCompleted).toBeDefined()
    expect(mod.emitAgentFailed).toBeDefined()

    // Insight helpers
    expect(mod.emitInsightApplied).toBeDefined()
    expect(mod.emitInsightDismissed).toBeDefined()
  })
})
