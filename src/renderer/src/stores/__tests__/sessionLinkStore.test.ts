import { describe, it, expect, beforeEach } from 'vitest'
import {
  useSessionLinkStore,
  getLinkedNodeId,
  getLinkedSessionId,
  getPendingUnlinkedSessions
} from '../sessionLinkStore'

describe('sessionLinkStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useSessionLinkStore.setState({
      links: [],
      autoCreateEnabled: false,
      pendingUnlinked: []
    })
  })

  describe('initial state', () => {
    it('has empty links', () => {
      expect(useSessionLinkStore.getState().links).toEqual([])
    })

    it('has autoCreateEnabled OFF by default', () => {
      expect(useSessionLinkStore.getState().autoCreateEnabled).toBe(false)
    })

    it('has empty pending unlinked sessions', () => {
      expect(useSessionLinkStore.getState().pendingUnlinked).toEqual([])
    })
  })

  describe('linkSession', () => {
    it('adds a new session link', () => {
      useSessionLinkStore.getState().linkSession('s1', 'node-1', 'manual')
      const { links } = useSessionLinkStore.getState()
      expect(links).toHaveLength(1)
      expect(links[0].sessionId).toBe('s1')
      expect(links[0].nodeId).toBe('node-1')
      expect(links[0].method).toBe('manual')
    })

    it('sets method to env-auto for tier 1', () => {
      useSessionLinkStore.getState().linkSession('s1', 'node-1', 'env-auto')
      expect(useSessionLinkStore.getState().links[0].method).toBe('env-auto')
    })

    it('sets method to auto-create for tier 3', () => {
      useSessionLinkStore.getState().linkSession('s1', 'node-1', 'auto-create')
      expect(useSessionLinkStore.getState().links[0].method).toBe('auto-create')
    })

    it('prevents duplicate links by updating existing', () => {
      useSessionLinkStore.getState().linkSession('s1', 'node-1', 'manual')
      useSessionLinkStore.getState().linkSession('s1', 'node-2', 'manual')
      expect(useSessionLinkStore.getState().links).toHaveLength(1)
      expect(useSessionLinkStore.getState().links[0].nodeId).toBe('node-2')
    })

    it('removes session from pending when linked', () => {
      useSessionLinkStore.getState().addUnlinkedSession('s1', '/home/user/project')
      expect(useSessionLinkStore.getState().pendingUnlinked).toHaveLength(1)
      useSessionLinkStore.getState().linkSession('s1', 'node-1', 'manual')
      expect(useSessionLinkStore.getState().pendingUnlinked).toHaveLength(0)
    })
  })

  describe('unlinkSession', () => {
    it('removes an existing link', () => {
      useSessionLinkStore.getState().linkSession('s1', 'node-1', 'manual')
      useSessionLinkStore.getState().unlinkSession('s1')
      expect(useSessionLinkStore.getState().links).toHaveLength(0)
    })

    it('is a no-op for nonexistent session', () => {
      useSessionLinkStore.getState().unlinkSession('nonexistent')
      expect(useSessionLinkStore.getState().links).toHaveLength(0)
    })
  })

  describe('addUnlinkedSession', () => {
    it('adds to pending list', () => {
      useSessionLinkStore.getState().addUnlinkedSession('s1', '/home/user/project')
      expect(useSessionLinkStore.getState().pendingUnlinked).toHaveLength(1)
      expect(useSessionLinkStore.getState().pendingUnlinked[0].sessionId).toBe('s1')
    })

    it('prevents duplicate pending entries', () => {
      useSessionLinkStore.getState().addUnlinkedSession('s1', '/home/user/project')
      useSessionLinkStore.getState().addUnlinkedSession('s1', '/home/user/project')
      expect(useSessionLinkStore.getState().pendingUnlinked).toHaveLength(1)
    })

    it('skips if session is already linked', () => {
      useSessionLinkStore.getState().linkSession('s1', 'node-1', 'manual')
      useSessionLinkStore.getState().addUnlinkedSession('s1', '/home/user/project')
      expect(useSessionLinkStore.getState().pendingUnlinked).toHaveLength(0)
    })
  })

  describe('dismissUnlinkedSession', () => {
    it('removes from pending list', () => {
      useSessionLinkStore.getState().addUnlinkedSession('s1', '/home/user/project')
      useSessionLinkStore.getState().dismissUnlinkedSession('s1')
      expect(useSessionLinkStore.getState().pendingUnlinked).toHaveLength(0)
    })
  })

  describe('setAutoCreateEnabled', () => {
    it('enables auto-create', () => {
      useSessionLinkStore.getState().setAutoCreateEnabled(true)
      expect(useSessionLinkStore.getState().autoCreateEnabled).toBe(true)
    })

    it('disables auto-create', () => {
      useSessionLinkStore.getState().setAutoCreateEnabled(true)
      useSessionLinkStore.getState().setAutoCreateEnabled(false)
      expect(useSessionLinkStore.getState().autoCreateEnabled).toBe(false)
    })
  })

  describe('selectors', () => {
    it('getLinkedNodeId returns nodeId for linked session', () => {
      useSessionLinkStore.getState().linkSession('s1', 'node-1', 'manual')
      expect(getLinkedNodeId('s1')).toBe('node-1')
    })

    it('getLinkedNodeId returns null for unlinked session', () => {
      expect(getLinkedNodeId('nonexistent')).toBeNull()
    })

    it('getLinkedSessionId returns sessionId for linked node', () => {
      useSessionLinkStore.getState().linkSession('s1', 'node-1', 'manual')
      expect(getLinkedSessionId('node-1')).toBe('s1')
    })

    it('getLinkedSessionId returns null for unlinked node', () => {
      expect(getLinkedSessionId('nonexistent')).toBeNull()
    })

    it('getPendingUnlinkedSessions returns pending list', () => {
      useSessionLinkStore.getState().addUnlinkedSession('s1', '/home')
      useSessionLinkStore.getState().addUnlinkedSession('s2', '/work')
      const pending = getPendingUnlinkedSessions()
      expect(pending).toHaveLength(2)
    })
  })
})
