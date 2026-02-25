import { describe, it, expect } from 'vitest'
import {
  getSessionLinkMenuItems,
  getSessionUnlinkMenuItems,
  getSessionMappingTier
} from '../sessionLinkActions'
import type { SessionLink } from '../../stores/sessionLinkStore'

describe('getSessionLinkMenuItems', () => {
  it('returns empty for non-conversation nodes', () => {
    expect(getSessionLinkMenuItems('node-1', 'task', [], [])).toEqual([])
    expect(getSessionLinkMenuItems('node-1', 'note', [], [])).toEqual([])
    expect(getSessionLinkMenuItems('node-1', 'project', [], [])).toEqual([])
  })

  it('returns link option for conversation node without existing link', () => {
    const items = getSessionLinkMenuItems('node-1', 'conversation', [], [])
    expect(items).toHaveLength(1)
    expect(items[0].action).toBe('link-session')
    expect(items[0].icon).toBe('Link')
  })

  it('shows pending count when sessions available', () => {
    const items = getSessionLinkMenuItems('node-1', 'conversation', [], ['s1', 's2'])
    expect(items[0].label).toContain('2 available')
  })

  it('returns unlink option when session already linked', () => {
    const links: SessionLink[] = [
      { sessionId: 's1', nodeId: 'node-1', method: 'manual', linkedAt: Date.now() }
    ]
    const items = getSessionLinkMenuItems('node-1', 'conversation', links, [])
    expect(items).toHaveLength(1)
    expect(items[0].action).toBe('unlink-session')
    expect(items[0].sessionId).toBe('s1')
  })
})

describe('getSessionUnlinkMenuItems', () => {
  it('returns empty for non-conversation nodes', () => {
    expect(getSessionUnlinkMenuItems('node-1', 'task', [])).toEqual([])
  })

  it('returns empty when no link exists', () => {
    expect(getSessionUnlinkMenuItems('node-1', 'conversation', [])).toEqual([])
  })

  it('returns unlink item when link exists', () => {
    const links: SessionLink[] = [
      { sessionId: 'session-abc12345', nodeId: 'node-1', method: 'manual', linkedAt: Date.now() }
    ]
    const items = getSessionUnlinkMenuItems('node-1', 'conversation', links)
    expect(items).toHaveLength(1)
    expect(items[0].action).toBe('unlink-session')
    expect(items[0].label).toContain('session-')
  })
})

describe('getSessionMappingTier', () => {
  it('returns tier1 when env var present', () => {
    expect(getSessionMappingTier('node-1', [], 's1')).toBe('tier1')
  })

  it('returns tier2 when session already linked', () => {
    const links: SessionLink[] = [
      { sessionId: 's1', nodeId: 'node-1', method: 'manual', linkedAt: Date.now() }
    ]
    expect(getSessionMappingTier(undefined, links, 's1')).toBe('tier2')
  })

  it('returns tier3 when unlinked and no env var', () => {
    expect(getSessionMappingTier(undefined, [], 's1')).toBe('tier3')
  })
})
