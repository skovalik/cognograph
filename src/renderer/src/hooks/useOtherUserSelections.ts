/**
 * useOtherUserSelections — Track which nodes other users have selected.
 *
 * Returns a map of nodeId → list of users selecting that node,
 * used by nodes to render selection indicators.
 */

import { useState, useEffect, useMemo } from 'react'
import { useCollaborativeProvider } from '../sync'

interface UserSelection {
  userId: string
  userName: string
  color: string
}

/**
 * Returns a Map<nodeId, UserSelection[]> of nodes selected by remote users.
 */
export function useOtherUserSelections(): Map<string, UserSelection[]> {
  const collaborativeProvider = useCollaborativeProvider()
  const [selections, setSelections] = useState<Map<string, UserSelection[]>>(new Map())

  useEffect(() => {
    if (!collaborativeProvider) {
      setSelections(new Map())
      return
    }

    const awareness = collaborativeProvider.getAwareness()

    const updateSelections = (): void => {
      const nodeMap = new Map<string, UserSelection[]>()

      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return // Skip self
        if (!state.user || !state.selectedNodeIds) return

        const user: UserSelection = {
          userId: state.user.id || String(clientId),
          userName: state.user.name || 'Anonymous',
          color: state.user.color || '#888888'
        }

        for (const nodeId of state.selectedNodeIds as string[]) {
          const existing = nodeMap.get(nodeId) || []
          existing.push(user)
          nodeMap.set(nodeId, existing)
        }
      })

      setSelections(nodeMap)
    }

    awareness.on('change', updateSelections)
    updateSelections()

    return () => {
      awareness.off('change', updateSelections)
    }
  }, [collaborativeProvider])

  return selections
}

/**
 * Hook for a single node — returns the users selecting this specific node.
 */
export function useNodeRemoteSelectors(nodeId: string): UserSelection[] {
  const allSelections = useOtherUserSelections()
  return useMemo(() => allSelections.get(nodeId) || [], [allSelections, nodeId])
}
