/**
 * Audit Store (Phase 2: Bridge Log)
 *
 * Manages the complete audit trail of canvas actions.
 * - In-memory ring buffer for recent events (capped at maxEvents)
 * - IndexedDB (via Dexie) for long-term storage and search
 * - RAF batching for event emission (Optimization #8)
 * - Filtering, search, export, and undo support
 */

import { create } from 'zustand'
import Dexie, { type Table } from 'dexie'
import type {
  CanvasAuditEvent,
  AuditEventFilter,
  AuditAction,
} from '@shared/types/bridge'

// =============================================================================
// IndexedDB Schema (Optimization #1: 50k+ events in IndexedDB)
// =============================================================================

class AuditDatabase extends Dexie {
  events!: Table<CanvasAuditEvent, string>

  constructor() {
    super('CognographBridgeAudit')
    this.version(1).stores({
      events: 'id, timestamp, action, [actor.type], targetType, [context.orchestrationId]',
    })
  }
}

let db: AuditDatabase | null = null

function getDB(): AuditDatabase {
  if (!db) {
    db = new AuditDatabase()
  }
  return db
}

// =============================================================================
// Filter Implementation
// =============================================================================

function applyFilter(
  events: CanvasAuditEvent[],
  filter: AuditEventFilter
): CanvasAuditEvent[] {
  let result = events

  if (filter.actions?.length) {
    result = result.filter((e) => filter.actions!.includes(e.action))
  }

  if (filter.actorTypes?.length) {
    result = result.filter((e) => filter.actorTypes!.includes(e.actor.type))
  }

  if (filter.targetTypes?.length) {
    result = result.filter((e) => filter.targetTypes!.includes(e.targetType))
  }

  if (filter.dateRange) {
    result = result.filter(
      (e) =>
        e.timestamp >= filter.dateRange!.start &&
        e.timestamp <= filter.dateRange!.end
    )
  }

  if (filter.searchText) {
    const search = filter.searchText.toLowerCase()
    result = result.filter(
      (e) =>
        e.targetTitle?.toLowerCase().includes(search) ||
        (e.actor.type === 'agent' &&
          e.actor.agentName.toLowerCase().includes(search)) ||
        e.context.parentCommand?.toLowerCase().includes(search) ||
        e.action.toLowerCase().includes(search)
    )
  }

  if (filter.orchestrationId) {
    result = result.filter(
      (e) => e.context.orchestrationId === filter.orchestrationId
    )
  }

  return result
}

// =============================================================================
// RAF Batching (Optimization #8)
// =============================================================================

let pendingEvents: CanvasAuditEvent[] = []
let rafId: number | null = null

function flushPendingEvents(): void {
  if (pendingEvents.length === 0) return

  const batch = [...pendingEvents]
  pendingEvents = []

  const store = useAuditStore.getState()

  // Add all batched events at once
  const currentEvents = store.events
  const newEvents = [...batch, ...currentEvents].slice(0, store.maxEvents)
  const overflow = currentEvents.length + batch.length - store.maxEvents

  // Fire-and-forget IndexedDB writes for overflow
  if (overflow > 0) {
    const eventsToArchive = currentEvents.slice(-overflow)
    const database = getDB()
    database.events.bulkAdd(eventsToArchive).catch((err) => {
      console.warn('[AuditStore] IndexedDB archive failed:', err)
    })
  }

  const filteredEvents = applyFilter(newEvents, store.filter)
  const totalCost = newEvents.reduce(
    (sum, e) => sum + (e.context.costUSD || 0),
    0
  )

  useAuditStore.setState({
    events: newEvents,
    filteredEvents,
    eventCount: newEvents.length,
    totalCost,
  })
}

// =============================================================================
// Store Interface
// =============================================================================

interface AuditStoreState {
  // Event storage (in-memory ring buffer)
  events: CanvasAuditEvent[]
  maxEvents: number

  // Filtering
  filter: AuditEventFilter
  filteredEvents: CanvasAuditEvent[]

  // Derived stats
  totalCost: number
  eventCount: number

  // Loading state for search
  isSearching: boolean

  // Actions
  addEvent: (event: CanvasAuditEvent) => void
  addEventBatched: (event: CanvasAuditEvent) => void
  setFilter: (filter: Partial<AuditEventFilter>) => void
  clearFilter: () => void
  undoEvent: (eventId: string) => Promise<boolean>
  clearEvents: () => void

  // IndexedDB search (for older events)
  searchAllEvents: (
    filter: AuditEventFilter,
    limit?: number
  ) => Promise<CanvasAuditEvent[]>

  // Export
  exportEvents: (format: 'csv' | 'json') => string
}

// =============================================================================
// Store Creation
// =============================================================================

export const useAuditStore = create<AuditStoreState>((set, get) => ({
  events: [],
  maxEvents: 10000,
  filter: {},
  filteredEvents: [],
  totalCost: 0,
  eventCount: 0,
  isSearching: false,

  // Direct add (synchronous, no batching)
  addEvent: (event: CanvasAuditEvent): void => {
    set((state) => {
      const events = [event, ...state.events].slice(0, state.maxEvents)

      // Fire-and-forget: archive overflow to IndexedDB
      if (state.events.length >= state.maxEvents) {
        const oldest = state.events[state.events.length - 1]
        if (oldest) {
          const database = getDB()
          database.events.add(oldest).catch((err) => {
            console.warn('[AuditStore] IndexedDB archive failed:', err)
          })
        }
      }

      const filteredEvents = applyFilter(events, state.filter)
      return {
        events,
        filteredEvents,
        eventCount: events.length,
        totalCost: events.reduce(
          (sum, e) => sum + (e.context.costUSD || 0),
          0
        ),
      }
    })
  },

  // Batched add via RAF (Optimization #8: prevents re-render storm)
  addEventBatched: (event: CanvasAuditEvent): void => {
    pendingEvents.push(event)

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        flushPendingEvents()
        rafId = null
      })
    }
  },

  setFilter: (partial: Partial<AuditEventFilter>): void => {
    set((state) => {
      const filter = { ...state.filter, ...partial }
      return {
        filter,
        filteredEvents: applyFilter(state.events, filter),
      }
    })
  },

  clearFilter: (): void => {
    set((state) => ({
      filter: {},
      filteredEvents: state.events,
    }))
  },

  undoEvent: async (eventId: string): Promise<boolean> => {
    const event = get().events.find((e) => e.id === eventId)
    if (!event || !event.undoable || !event.undoData) return false

    try {
      // Delegate undo to main process via IPC
      if (window.api?.bridge?.undoAuditEvent) {
        const result = await window.api.bridge.undoAuditEvent(
          eventId,
          event.undoData
        )
        if (result.success) {
          // Log the undo action itself
          get().addEvent({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            actor: { type: 'user' },
            action: 'node-updated',
            targetId: event.targetId,
            targetType: event.targetType,
            targetTitle: `Undo: ${event.targetTitle || 'action'}`,
            context: {},
            undoable: false,
          })
          return true
        }
      }
      return false
    } catch {
      return false
    }
  },

  clearEvents: (): void => {
    set({ events: [], filteredEvents: [], totalCost: 0, eventCount: 0 })
  },

  // Search across both in-memory and IndexedDB
  searchAllEvents: async (
    filter: AuditEventFilter,
    limit = 100
  ): Promise<CanvasAuditEvent[]> => {
    set({ isSearching: true })

    try {
      // 1. Search recent (in-memory)
      const recentMatches = applyFilter(get().events, filter)

      // 2. Query IndexedDB for older events
      const database = getDB()
      let query = database.events.orderBy('timestamp').reverse()

      if (filter.dateRange?.start) {
        query = database.events
          .where('timestamp')
          .aboveOrEqual(filter.dateRange.start)
          .reverse()
      }

      const olderEvents = await query.limit(limit * 2).toArray()
      const olderMatches = applyFilter(olderEvents, filter)

      // 3. Merge and deduplicate
      const seen = new Set(recentMatches.map((e) => e.id))
      const merged = [...recentMatches]
      for (const event of olderMatches) {
        if (!seen.has(event.id)) {
          merged.push(event)
          seen.add(event.id)
        }
      }

      // Sort by timestamp descending and limit
      merged.sort((a, b) => b.timestamp - a.timestamp)
      return merged.slice(0, limit)
    } finally {
      set({ isSearching: false })
    }
  },

  // Export events as CSV or JSON
  exportEvents: (format: 'csv' | 'json'): string => {
    const events = get().filteredEvents

    if (format === 'json') {
      return JSON.stringify(events, null, 2)
    }

    // CSV export
    const headers = [
      'ID',
      'Timestamp',
      'Actor Type',
      'Actor Name',
      'Action',
      'Target ID',
      'Target Type',
      'Target Title',
      'Cost USD',
      'Tokens Used',
      'Orchestration ID',
    ]

    const rows = events.map((e) => [
      e.id,
      new Date(e.timestamp).toISOString(),
      e.actor.type,
      e.actor.type === 'agent'
        ? e.actor.agentName
        : e.actor.type === 'system'
          ? e.actor.service
          : 'User',
      e.action,
      e.targetId,
      e.targetType,
      e.targetTitle || '',
      e.context.costUSD?.toFixed(6) || '',
      e.context.tokensUsed?.toString() || '',
      e.context.orchestrationId || '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

    return csvContent
  },
}))

// =============================================================================
// Selectors
// =============================================================================

export const selectAuditEvents = (state: AuditStoreState): CanvasAuditEvent[] =>
  state.filteredEvents

export const selectAuditEventCount = (state: AuditStoreState): number =>
  state.eventCount

export const selectAuditTotalCost = (state: AuditStoreState): number =>
  state.totalCost

export const selectAuditFilter = (state: AuditStoreState): AuditEventFilter =>
  state.filter

export const selectIsSearching = (state: AuditStoreState): boolean =>
  state.isSearching
