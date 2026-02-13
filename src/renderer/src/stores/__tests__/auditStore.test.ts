/**
 * Audit Store Tests
 *
 * Tests for the Bridge Log audit event store:
 * - Event addition (direct and batched)
 * - Filtering (actions, actors, search, date range)
 * - Export (CSV and JSON)
 * - Ring buffer overflow behavior
 * - Undo support
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuditStore } from '../auditStore'
import type { CanvasAuditEvent, AuditEventFilter } from '@shared/types/bridge'

// Mock Dexie (IndexedDB)
// Dexie subclasses declare `events!: Table<...>` which TypeScript compiles to
// a property set in the constructor. In the mock, version().stores() must
// assign the table back onto `this` after the child constructor wipes it.
vi.mock('dexie', () => {
  class MockTable {
    add = vi.fn().mockResolvedValue(undefined)
    bulkAdd = vi.fn().mockResolvedValue(undefined)
    orderBy = vi.fn().mockReturnThis()
    reverse = vi.fn().mockReturnThis()
    where = vi.fn().mockReturnThis()
    aboveOrEqual = vi.fn().mockReturnThis()
    limit = vi.fn().mockReturnThis()
    toArray = vi.fn().mockResolvedValue([])
  }

  const mockTable = new MockTable()

  return {
    default: class MockDexie {
      constructor() {
        // Initial set (may be overridden by child class property declarations)
        ;(this as Record<string, unknown>).events = mockTable
      }
      version() {
        const self = this as Record<string, unknown>
        return {
          stores() {
            // Re-assign after child constructor has run
            // This simulates Dexie.stores() setting up table properties
            self.events = mockTable
            return self
          },
        }
      }
    },
  }
})

// Mock window.api
Object.defineProperty(globalThis, 'window', {
  value: {
    api: {
      bridge: {
        undoAuditEvent: vi.fn().mockResolvedValue({ success: true }),
      },
    },
  },
  writable: true,
})

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
})

// =============================================================================
// Helpers
// =============================================================================

function createMockEvent(
  overrides: Partial<CanvasAuditEvent> = {}
): CanvasAuditEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    actor: { type: 'user' },
    action: 'node-created',
    targetId: 'test-node-1',
    targetType: 'note',
    targetTitle: 'Test Note',
    context: {},
    undoable: false,
    ...overrides,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('AuditStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuditStore.setState({
      events: [],
      filteredEvents: [],
      filter: {},
      totalCost: 0,
      eventCount: 0,
      isSearching: false,
    })
  })

  // ---------------------------------------------------------------------------
  // Event Addition
  // ---------------------------------------------------------------------------

  describe('addEvent', () => {
    it('should add an event to the store', () => {
      const event = createMockEvent()
      useAuditStore.getState().addEvent(event)

      const state = useAuditStore.getState()
      expect(state.events).toHaveLength(1)
      expect(state.events[0].id).toBe(event.id)
      expect(state.eventCount).toBe(1)
    })

    it('should prepend events (newest first)', () => {
      const event1 = createMockEvent({ timestamp: 1000 })
      const event2 = createMockEvent({ timestamp: 2000 })

      useAuditStore.getState().addEvent(event1)
      useAuditStore.getState().addEvent(event2)

      const state = useAuditStore.getState()
      expect(state.events[0].timestamp).toBe(2000)
      expect(state.events[1].timestamp).toBe(1000)
    })

    it('should track total cost', () => {
      const event1 = createMockEvent({ context: { costUSD: 0.001 } })
      const event2 = createMockEvent({ context: { costUSD: 0.002 } })

      useAuditStore.getState().addEvent(event1)
      useAuditStore.getState().addEvent(event2)

      const state = useAuditStore.getState()
      expect(state.totalCost).toBeCloseTo(0.003, 6)
    })

    it('should enforce maxEvents ring buffer', () => {
      // Set a small max for testing
      useAuditStore.setState({ maxEvents: 5 })

      for (let i = 0; i < 10; i++) {
        useAuditStore.getState().addEvent(
          createMockEvent({ id: `event-${i}`, timestamp: i * 1000 })
        )
      }

      const state = useAuditStore.getState()
      expect(state.events).toHaveLength(5)
      // Newest events should be kept
      expect(state.events[0].id).toBe('event-9')
    })

    it('should update filteredEvents when filter is active', () => {
      useAuditStore.getState().setFilter({ actions: ['node-updated'] })

      useAuditStore.getState().addEvent(
        createMockEvent({ action: 'node-created' })
      )
      useAuditStore.getState().addEvent(
        createMockEvent({ action: 'node-updated' })
      )

      const state = useAuditStore.getState()
      expect(state.events).toHaveLength(2)
      expect(state.filteredEvents).toHaveLength(1)
      expect(state.filteredEvents[0].action).toBe('node-updated')
    })
  })

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  describe('setFilter', () => {
    beforeEach(() => {
      // Add diverse events
      const events: CanvasAuditEvent[] = [
        createMockEvent({
          id: 'e1',
          action: 'node-created',
          actor: { type: 'user' },
          targetType: 'note',
          targetTitle: 'My Note',
          timestamp: 1000,
        }),
        createMockEvent({
          id: 'e2',
          action: 'node-updated',
          actor: {
            type: 'agent',
            agentNodeId: 'a1',
            agentName: 'Writer',
          },
          targetType: 'conversation',
          targetTitle: 'Chat Session',
          timestamp: 2000,
          context: { costUSD: 0.01, orchestrationId: 'orch-1' },
        }),
        createMockEvent({
          id: 'e3',
          action: 'orchestration-completed',
          actor: { type: 'system', service: 'orchestrator' },
          targetType: 'orchestrator',
          timestamp: 3000,
          context: { costUSD: 0.05 },
        }),
      ]

      for (const e of events) {
        useAuditStore.getState().addEvent(e)
      }
    })

    it('should filter by action type', () => {
      useAuditStore.getState().setFilter({ actions: ['node-created'] })
      expect(useAuditStore.getState().filteredEvents).toHaveLength(1)
      expect(useAuditStore.getState().filteredEvents[0].id).toBe('e1')
    })

    it('should filter by actor type', () => {
      useAuditStore.getState().setFilter({ actorTypes: ['agent'] })
      expect(useAuditStore.getState().filteredEvents).toHaveLength(1)
      expect(useAuditStore.getState().filteredEvents[0].id).toBe('e2')
    })

    it('should filter by target type', () => {
      useAuditStore.getState().setFilter({ targetTypes: ['note'] })
      expect(useAuditStore.getState().filteredEvents).toHaveLength(1)
    })

    it('should filter by search text (title)', () => {
      useAuditStore.getState().setFilter({ searchText: 'chat' })
      expect(useAuditStore.getState().filteredEvents).toHaveLength(1)
      expect(useAuditStore.getState().filteredEvents[0].id).toBe('e2')
    })

    it('should filter by search text (agent name)', () => {
      useAuditStore.getState().setFilter({ searchText: 'writer' })
      expect(useAuditStore.getState().filteredEvents).toHaveLength(1)
      expect(useAuditStore.getState().filteredEvents[0].id).toBe('e2')
    })

    it('should filter by orchestration ID', () => {
      useAuditStore.getState().setFilter({ orchestrationId: 'orch-1' })
      expect(useAuditStore.getState().filteredEvents).toHaveLength(1)
      expect(useAuditStore.getState().filteredEvents[0].id).toBe('e2')
    })

    it('should filter by date range', () => {
      useAuditStore.getState().setFilter({
        dateRange: { start: 1500, end: 2500 },
      })
      expect(useAuditStore.getState().filteredEvents).toHaveLength(1)
      expect(useAuditStore.getState().filteredEvents[0].id).toBe('e2')
    })

    it('should combine multiple filters', () => {
      useAuditStore.getState().setFilter({
        actorTypes: ['agent'],
        searchText: 'Writer',
      })
      expect(useAuditStore.getState().filteredEvents).toHaveLength(1)
    })

    it('should clear filter', () => {
      useAuditStore.getState().setFilter({ actions: ['node-created'] })
      expect(useAuditStore.getState().filteredEvents).toHaveLength(1)

      useAuditStore.getState().clearFilter()
      expect(useAuditStore.getState().filteredEvents).toHaveLength(3)
    })
  })

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  describe('exportEvents', () => {
    beforeEach(() => {
      useAuditStore.getState().addEvent(
        createMockEvent({
          id: 'export-1',
          action: 'node-created',
          targetTitle: 'Test Node',
          context: { costUSD: 0.001, tokensUsed: 100 },
        })
      )
    })

    it('should export as JSON', () => {
      const json = useAuditStore.getState().exportEvents('json')
      const parsed = JSON.parse(json)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].id).toBe('export-1')
    })

    it('should export as CSV with headers', () => {
      const csv = useAuditStore.getState().exportEvents('csv')
      const lines = csv.split('\n')
      expect(lines[0]).toContain('ID')
      expect(lines[0]).toContain('Action')
      expect(lines[0]).toContain('Cost USD')
      expect(lines).toHaveLength(2) // Header + 1 row
    })

    it('should export filtered events only', () => {
      useAuditStore.getState().addEvent(
        createMockEvent({ id: 'export-2', action: 'node-updated' })
      )

      useAuditStore.getState().setFilter({ actions: ['node-created'] })
      const json = useAuditStore.getState().exportEvents('json')
      const parsed = JSON.parse(json)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].action).toBe('node-created')
    })
  })

  // ---------------------------------------------------------------------------
  // Clear Events
  // ---------------------------------------------------------------------------

  describe('clearEvents', () => {
    it('should clear all events and reset counts', () => {
      useAuditStore.getState().addEvent(createMockEvent())
      useAuditStore.getState().addEvent(createMockEvent())

      useAuditStore.getState().clearEvents()

      const state = useAuditStore.getState()
      expect(state.events).toHaveLength(0)
      expect(state.filteredEvents).toHaveLength(0)
      expect(state.totalCost).toBe(0)
      expect(state.eventCount).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Undo
  // ---------------------------------------------------------------------------

  describe('undoEvent', () => {
    it('should return false for non-undoable events', async () => {
      const event = createMockEvent({ undoable: false })
      useAuditStore.getState().addEvent(event)

      const result = await useAuditStore.getState().undoEvent(event.id)
      expect(result).toBe(false)
    })

    it('should return false for events without undo data', async () => {
      const event = createMockEvent({ undoable: true, undoData: undefined })
      useAuditStore.getState().addEvent(event)

      const result = await useAuditStore.getState().undoEvent(event.id)
      expect(result).toBe(false)
    })

    it('should return false for non-existent events', async () => {
      const result = await useAuditStore.getState().undoEvent('nonexistent')
      expect(result).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Batched Events
  // ---------------------------------------------------------------------------

  describe('addEventBatched', () => {
    it('should accept batched events without error', () => {
      // RAF is not truly testable in unit tests, but we can verify
      // the function doesn't throw
      expect(() => {
        useAuditStore.getState().addEventBatched(createMockEvent())
      }).not.toThrow()
    })
  })
})
