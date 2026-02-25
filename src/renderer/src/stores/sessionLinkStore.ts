import { create } from 'zustand'

/** Represents a link between an external CC session and a ConversationNode */
export interface SessionLink {
  sessionId: string
  nodeId: string // ConversationNode ID
  method: 'env-auto' | 'manual' | 'auto-create' // Which tier created this link
  linkedAt: number
}

/** An unlinked session waiting for user decision */
export interface PendingUnlinkedSession {
  sessionId: string
  workingDirectory: string
  detectedAt: number
}

interface SessionLinkState {
  /** Active session-to-node links */
  links: SessionLink[]

  /** Whether auto-create (Tier 3) is enabled — OFF by default */
  autoCreateEnabled: boolean

  /** Sessions detected but not yet linked (for toast prompts) */
  pendingUnlinked: PendingUnlinkedSession[]

  // Actions
  linkSession: (sessionId: string, nodeId: string, method: SessionLink['method']) => void
  unlinkSession: (sessionId: string) => void
  addUnlinkedSession: (sessionId: string, workingDirectory: string) => void
  dismissUnlinkedSession: (sessionId: string) => void
  setAutoCreateEnabled: (enabled: boolean) => void
}

export const useSessionLinkStore = create<SessionLinkState>()((set, get) => ({
  links: [],
  autoCreateEnabled: false, // Decision #7: OFF by default
  pendingUnlinked: [],

  linkSession: (sessionId, nodeId, method) => {
    set((state) => {
      // Remove from pending if present
      const pendingUnlinked = state.pendingUnlinked.filter((p) => p.sessionId !== sessionId)
      // Prevent duplicate links
      const existingIdx = state.links.findIndex((l) => l.sessionId === sessionId)
      const links = [...state.links]
      if (existingIdx >= 0) {
        links[existingIdx] = { sessionId, nodeId, method, linkedAt: Date.now() }
      } else {
        links.push({ sessionId, nodeId, method, linkedAt: Date.now() })
      }
      return { links, pendingUnlinked }
    })
  },

  unlinkSession: (sessionId) => {
    set((state) => ({
      links: state.links.filter((l) => l.sessionId !== sessionId)
    }))
  },

  addUnlinkedSession: (sessionId, workingDirectory) => {
    const state = get()
    // Don't add if already linked or already pending
    if (state.links.some((l) => l.sessionId === sessionId)) return
    if (state.pendingUnlinked.some((p) => p.sessionId === sessionId)) return

    set((state) => ({
      pendingUnlinked: [
        ...state.pendingUnlinked,
        { sessionId, workingDirectory, detectedAt: Date.now() }
      ]
    }))
  },

  dismissUnlinkedSession: (sessionId) => {
    set((state) => ({
      pendingUnlinked: state.pendingUnlinked.filter((p) => p.sessionId !== sessionId)
    }))
  },

  setAutoCreateEnabled: (enabled) => {
    set({ autoCreateEnabled: enabled })
  }
}))

// --- Selectors ---

/** Get the ConversationNode linked to a session */
export function getLinkedNodeId(sessionId: string): string | null {
  const link = useSessionLinkStore.getState().links.find((l) => l.sessionId === sessionId)
  return link?.nodeId ?? null
}

/** Get the session linked to a ConversationNode */
export function getLinkedSessionId(nodeId: string): string | null {
  const link = useSessionLinkStore.getState().links.find((l) => l.nodeId === nodeId)
  return link?.sessionId ?? null
}

/** Get all pending unlinked sessions */
export function getPendingUnlinkedSessions(): PendingUnlinkedSession[] {
  return useSessionLinkStore.getState().pendingUnlinked
}
