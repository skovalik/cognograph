/**
 * CC Bridge Store — Claude Code Activity Bridge State
 *
 * Manages the renderer-side state for the Claude Code activity observation layer
 * AND the dispatch layer (Phases 2-4 of the CC Bridge Full spec).
 *
 * State groups:
 * 1. Observation: events[], isConnected, sessionIds (Phase 1 — Hybrid)
 * 2. File Touches: fileTouches map, conflict detection (Phase 2)
 * 3. Session Tracking: sessions map, heartbeat/timeout (Phase 2)
 * 4. Dispatch: dispatches[], dispatchServerPort (Phase 3)
 *
 * Store name is `ccBridgeStore` (canonical name per cross-spec analysis).
 *
 * @module ccBridgeStore
 */

import { create } from 'zustand'
import type {
  CCActivityEvent,
  CCDispatchMessage,
  CCSessionData,
  CCSessionStatus,
  FileTouch,
  FileTouchOperation,
} from '@shared/bridge-types'
import { CC_SESSION_TIMEOUTS } from '@shared/bridge-types'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CCBridgeState {
  // --- Observation (Phase 1) ---
  /** Recent activity events (FIFO, max 1000) */
  events: CCActivityEvent[]
  /** Whether the bridge is receiving events (true if events arrived recently) */
  isConnected: boolean
  /** Number of unique sessions observed */
  sessionCount: number
  /** Set of unique session IDs seen */
  sessionIds: Set<string>
  /** Timestamp of the last event received (for idle detection) */
  lastEventTime: number | null

  // --- Session Tracking (Phase 2) ---
  /** Active/recent CC session metadata, keyed by sessionId */
  sessions: Map<string, CCSessionData>

  // --- File Touches (Phase 2) ---
  /** Map of normalized file path -> array of FileTouch (one per session) */
  fileTouches: Map<string, FileTouch[]>

  // --- Dispatch (Phase 3) ---
  /** Dispatch messages in queue (ephemeral, not persisted) */
  dispatches: CCDispatchMessage[]
  /** Port the dispatch server is listening on (null if not running) */
  dispatchServerPort: number | null

  // --- Actions ---
  addEvent: (event: CCActivityEvent) => void
  clearEvents: () => void
  setConnected: (connected: boolean) => void

  // Session actions
  updateSessionStatus: (sessionId: string, status: CCSessionStatus) => void
  runHeartbeatCheck: () => void

  // File touch actions
  recordFileTouch: (filePath: string, fileRelative: string, sessionId: string, operation: FileTouchOperation) => void
  clearFileTouches: () => void

  // Dispatch actions
  addDispatch: (dispatch: CCDispatchMessage) => void
  updateDispatch: (dispatch: CCDispatchMessage) => void
  removeDispatch: (dispatchId: string) => void
  clearDispatches: () => void
  setDispatchServerPort: (port: number | null) => void
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MAX_EVENTS = 1000

/**
 * Accent colors for session differentiation.
 * Auto-assigned to sessions in order, cycling when exhausted.
 */
const SESSION_ACCENT_COLORS = [
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#f472b6', // pink
  '#34d399', // emerald
  '#fbbf24', // amber
  '#fb923c', // orange
  '#60a5fa', // blue
  '#e879f9', // fuchsia
]

/** Map a tool name to a file touch operation type */
function toolToOperation(toolName: string | undefined): FileTouchOperation | null {
  switch (toolName) {
    case 'Read':
      return 'read'
    case 'Edit':
      return 'edit'
    case 'Write':
      return 'write'
    case 'Grep':
    case 'Glob':
      return 'grep'
    default:
      return null
  }
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useCCBridgeStore = create<CCBridgeState>((set, get) => ({
  // --- Initial State ---
  events: [],
  isConnected: false,
  sessionCount: 0,
  sessionIds: new Set<string>(),
  lastEventTime: null,
  sessions: new Map<string, CCSessionData>(),
  fileTouches: new Map<string, FileTouch[]>(),
  dispatches: [],
  dispatchServerPort: null,

  // --- Observation Actions ---
  addEvent: (event: CCActivityEvent) =>
    set((state) => {
      // FIFO eviction: keep last MAX_EVENTS - 1, then add new event
      const events =
        state.events.length >= MAX_EVENTS
          ? [...state.events.slice(-(MAX_EVENTS - 1)), event]
          : [...state.events, event]

      // Track unique sessions
      const sessionIds = new Set(state.sessionIds)
      sessionIds.add(event.sessionId)

      // Determine connection status
      const isConnected = event.type !== 'session_end'

      // Update session tracking
      const sessions = new Map(state.sessions)
      const existingSession = sessions.get(event.sessionId)

      if (event.type === 'session_start' || !existingSession) {
        // Create or reset session
        const colorIndex = sessions.size % SESSION_ACCENT_COLORS.length
        sessions.set(event.sessionId, {
          sessionId: event.sessionId,
          startedAt: existingSession?.startedAt ?? event.timestamp,
          status: event.type === 'session_end' ? 'ended' : 'active',
          toolCallCount: existingSession?.toolCallCount ?? 0,
          filesModified: existingSession?.filesModified ?? [],
          lastActivity: event.timestamp,
          accentColor: existingSession?.accentColor ?? SESSION_ACCENT_COLORS[colorIndex],
        })
      } else {
        // Update existing session
        const updatedSession: CCSessionData = {
          ...existingSession,
          lastActivity: event.timestamp,
          status: event.type === 'session_end' ? 'ended' : 'active',
        }

        if (event.type === 'tool_use') {
          updatedSession.toolCallCount = existingSession.toolCallCount + 1
        }

        // Track modified files
        if (event.data.filePaths) {
          const modifiedSet = new Set(existingSession.filesModified)
          for (const fp of event.data.filePaths) {
            modifiedSet.add(fp)
          }
          updatedSession.filesModified = Array.from(modifiedSet)
        }

        sessions.set(event.sessionId, updatedSession)
      }

      // Track file touches from tool_use events
      const fileTouches = new Map(state.fileTouches)
      if (event.type === 'tool_use' && event.data.filePaths) {
        const operation = toolToOperation(event.data.toolName)
        if (operation) {
          for (const fp of event.data.filePaths) {
            const normalizedPath = fp.replace(/\\/g, '/')
            const existing = fileTouches.get(normalizedPath) ?? []

            // Find or create entry for this session
            const sessionTouch = existing.find((t) => t.sessionId === event.sessionId)
            if (sessionTouch) {
              sessionTouch.touchCount++
              sessionTouch.lastTouched = event.timestamp
              if (!sessionTouch.operations.includes(operation)) {
                sessionTouch.operations = [...sessionTouch.operations, operation]
              }
            } else {
              existing.push({
                filePath: fp,
                fileRelative: normalizedPath,
                sessionId: event.sessionId,
                lastTouched: event.timestamp,
                touchCount: 1,
                operations: [operation],
              })
            }

            fileTouches.set(normalizedPath, [...existing])
          }
        }
      }

      return {
        events,
        isConnected,
        sessionCount: sessionIds.size,
        sessionIds,
        lastEventTime: Date.now(),
        sessions,
        fileTouches,
      }
    }),

  clearEvents: () =>
    set({
      events: [],
      lastEventTime: null,
    }),

  setConnected: (connected: boolean) => set({ isConnected: connected }),

  // --- Session Actions ---
  updateSessionStatus: (sessionId: string, status: CCSessionStatus) =>
    set((state) => {
      const sessions = new Map(state.sessions)
      const session = sessions.get(sessionId)
      if (!session) return state

      sessions.set(sessionId, { ...session, status })
      return { sessions }
    }),

  runHeartbeatCheck: () => {
    const { sessions } = get()
    const now = Date.now()
    let changed = false
    const updated = new Map(sessions)

    for (const [id, session] of updated) {
      if (session.status === 'ended') continue

      const elapsed = now - session.lastActivity

      if (elapsed >= CC_SESSION_TIMEOUTS.ended && session.status !== 'ended') {
        updated.set(id, { ...session, status: 'ended' })
        changed = true
      } else if (elapsed >= CC_SESSION_TIMEOUTS.idle && session.status === 'active') {
        updated.set(id, { ...session, status: 'idle' })
        changed = true
      }
    }

    if (changed) {
      set({ sessions: updated })
    }
  },

  // --- File Touch Actions ---
  recordFileTouch: (
    filePath: string,
    fileRelative: string,
    sessionId: string,
    operation: FileTouchOperation
  ) =>
    set((state) => {
      const fileTouches = new Map(state.fileTouches)
      const normalizedPath = filePath.replace(/\\/g, '/')
      const existing = fileTouches.get(normalizedPath) ?? []

      const sessionTouch = existing.find((t) => t.sessionId === sessionId)
      if (sessionTouch) {
        sessionTouch.touchCount++
        sessionTouch.lastTouched = Date.now()
        if (!sessionTouch.operations.includes(operation)) {
          sessionTouch.operations = [...sessionTouch.operations, operation]
        }
      } else {
        existing.push({
          filePath,
          fileRelative,
          sessionId,
          lastTouched: Date.now(),
          touchCount: 1,
          operations: [operation],
        })
      }

      fileTouches.set(normalizedPath, [...existing])
      return { fileTouches }
    }),

  clearFileTouches: () => set({ fileTouches: new Map() }),

  // --- Dispatch Actions ---
  addDispatch: (dispatch: CCDispatchMessage) =>
    set((state) => ({
      dispatches: [...state.dispatches, dispatch],
    })),

  updateDispatch: (dispatch: CCDispatchMessage) =>
    set((state) => ({
      dispatches: state.dispatches.map((d) => (d.id === dispatch.id ? dispatch : d)),
    })),

  removeDispatch: (dispatchId: string) =>
    set((state) => ({
      dispatches: state.dispatches.filter((d) => d.id !== dispatchId),
    })),

  clearDispatches: () => set({ dispatches: [] }),

  setDispatchServerPort: (port: number | null) => set({ dispatchServerPort: port }),
}))

// -----------------------------------------------------------------------------
// IPC Listener Setup
// -----------------------------------------------------------------------------

let heartbeatInterval: ReturnType<typeof setInterval> | null = null

/**
 * Initialize the IPC listeners for Claude Code bridge events.
 * Call this once when the app mounts (e.g., in App.tsx useEffect).
 *
 * Sets up:
 * - Activity event listener (observation layer)
 * - Dispatch update listener (dispatch layer)
 * - Dispatch completion listener (dispatch layer)
 * - Session heartbeat timer (status timeout)
 *
 * @returns Cleanup function to remove all IPC listeners and stop heartbeat
 */
export function initCCBridgeListener(): () => void {
  const store = useCCBridgeStore.getState

  // Activity events (Phase 1)
  const cleanupActivity = window.api.ccBridge.onActivity((event: CCActivityEvent) => {
    store().addEvent(event)
  })

  // Dispatch updates (Phase 3)
  const cleanupDispatchUpdate = window.api.ccBridge.onDispatchUpdate(
    (dispatch) => {
      store().updateDispatch(dispatch)
    }
  )

  // Dispatch completions (Phase 3)
  const cleanupDispatchComplete = window.api.ccBridge.onDispatchCompleted(
    (data) => {
      store().updateDispatch(data.dispatch)
    }
  )

  // Session heartbeat check (Phase 2 — ERR-F3)
  heartbeatInterval = setInterval(() => {
    store().runHeartbeatCheck()
  }, CC_SESSION_TIMEOUTS.heartbeatInterval)

  return () => {
    cleanupActivity()
    cleanupDispatchUpdate()
    cleanupDispatchComplete()
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }
}

// -----------------------------------------------------------------------------
// Selectors (for use with useStore(selector) pattern)
// -----------------------------------------------------------------------------

export const selectCCBridgeEvents = (state: CCBridgeState): CCActivityEvent[] => state.events
export const selectCCBridgeConnected = (state: CCBridgeState): boolean => state.isConnected
export const selectCCBridgeSessionCount = (state: CCBridgeState): number => state.sessionCount
export const selectCCBridgeLastEventTime = (state: CCBridgeState): number | null =>
  state.lastEventTime

// Phase 2 selectors
export const selectCCBridgeSessions = (state: CCBridgeState): Map<string, CCSessionData> =>
  state.sessions
export const selectCCBridgeFileTouches = (state: CCBridgeState): Map<string, FileTouch[]> =>
  state.fileTouches

// Phase 3 selectors
export const selectCCBridgeDispatches = (state: CCBridgeState): CCDispatchMessage[] =>
  state.dispatches
export const selectCCBridgePendingDispatches = (state: CCBridgeState): CCDispatchMessage[] =>
  state.dispatches.filter((d) => d.status === 'pending')
export const selectCCBridgeActiveDispatches = (state: CCBridgeState): CCDispatchMessage[] =>
  state.dispatches.filter((d) => d.status === 'acknowledged')
export const selectCCBridgeCompletedDispatches = (state: CCBridgeState): CCDispatchMessage[] =>
  state.dispatches.filter((d) => d.status === 'completed' || d.status === 'failed')
export const selectCCBridgeDispatchServerPort = (state: CCBridgeState): number | null =>
  state.dispatchServerPort

/**
 * Check if a file path has touches from multiple sessions (conflict indicator).
 */
export function hasFileConflict(fileTouches: Map<string, FileTouch[]>, filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const touches = fileTouches.get(normalizedPath)
  if (!touches) return false

  const sessionIds = new Set(touches.map((t) => t.sessionId))
  return sessionIds.size > 1
}
