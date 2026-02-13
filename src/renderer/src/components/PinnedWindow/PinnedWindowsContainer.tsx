/**
 * Pinned Windows Container
 *
 * Renders all currently pinned windows. This component sits in the top-level
 * layout above the canvas but below modals.
 */

import { memo } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { PinnedWindow } from './PinnedWindow'

function PinnedWindowsContainerComponent(): JSX.Element | null {
  const pinnedWindows = useWorkspaceStore((state) => state.pinnedWindows)
  const nodes = useWorkspaceStore((state) => state.nodes)

  if (pinnedWindows.length === 0) return null

  return (
    <>
      {pinnedWindows.map((win) => {
        const node = nodes.find(n => n.id === win.nodeId)
        if (!node) return null

        return (
          <PinnedWindow
            key={win.nodeId}
            window={win}
            node={node}
          />
        )
      })}
    </>
  )
}

export const PinnedWindowsContainer = memo(PinnedWindowsContainerComponent)
