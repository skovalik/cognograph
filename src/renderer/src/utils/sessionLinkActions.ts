import type { SessionLink } from '../stores/sessionLinkStore'

/** Context menu item configuration for session linking */
export interface SessionLinkMenuItem {
  label: string
  icon: string // Lucide icon name
  action: 'link-session' | 'unlink-session'
  sessionId?: string
  nodeId: string
}

/**
 * Get context menu items for linking sessions to a ConversationNode.
 * Only applicable to conversation-type nodes.
 */
export function getSessionLinkMenuItems(
  nodeId: string,
  nodeType: string,
  existingLinks: SessionLink[],
  pendingSessionIds: string[]
): SessionLinkMenuItem[] {
  if (nodeType !== 'conversation') return []

  const items: SessionLinkMenuItem[] = []

  // Check if this node already has a linked session
  const existingLink = existingLinks.find((l) => l.nodeId === nodeId)

  if (existingLink) {
    items.push({
      label: 'Unlink CC session',
      icon: 'Unlink',
      action: 'unlink-session',
      sessionId: existingLink.sessionId,
      nodeId
    })
  } else if (pendingSessionIds.length > 0) {
    // Offer to link to any pending session
    items.push({
      label: `Link to CC session... (${pendingSessionIds.length} available)`,
      icon: 'Link',
      action: 'link-session',
      nodeId
    })
  } else {
    items.push({
      label: 'Link to CC session...',
      icon: 'Link',
      action: 'link-session',
      nodeId
    })
  }

  return items
}

/**
 * Get context menu items for unlinking a session from a ConversationNode.
 */
export function getSessionUnlinkMenuItems(
  nodeId: string,
  nodeType: string,
  existingLinks: SessionLink[]
): SessionLinkMenuItem[] {
  if (nodeType !== 'conversation') return []

  const link = existingLinks.find((l) => l.nodeId === nodeId)
  if (!link) return []

  return [
    {
      label: `Unlink session ${link.sessionId.slice(0, 8)}...`,
      icon: 'Unlink',
      action: 'unlink-session',
      sessionId: link.sessionId,
      nodeId
    }
  ]
}

/**
 * Determine which mapping tier applies for a given session.
 * Tier 1: env var auto-match, Tier 2: manual, Tier 3: auto-create prompt
 */
export function getSessionMappingTier(
  envNodeId: string | undefined,
  existingLinks: SessionLink[],
  sessionId: string
): 'tier1' | 'tier2' | 'tier3' {
  // Tier 1: COGNOGRAPH_NODE_ID env var matches
  if (envNodeId) return 'tier1'

  // Tier 2: already manually linked
  if (existingLinks.some((l) => l.sessionId === sessionId)) return 'tier2'

  // Tier 3: unlinked, needs user decision
  return 'tier3'
}
