// SessionReEntryPrompt — PFD Phase 6C: Session Re-Entry
// Shows "Resume where you left off?" prompt on workspace load.
// Zooms to last-active node on click. Auto-dismisses after 8 seconds.

import { memo, useState, useEffect, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useWorkspaceStore } from '../stores/workspaceStore'

const DISMISS_DELAY_MS = 8000

function SessionReEntryPromptComponent(): JSX.Element | null {
  const lastSessionNodeId = useWorkspaceStore((state) => state.lastSessionNodeId)
  const nodes = useWorkspaceStore((state) => state.nodes)
  const { setCenter } = useReactFlow()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Show prompt after a brief delay (let workspace render first)
  useEffect(() => {
    if (!lastSessionNodeId || dismissed) return

    const timer = setTimeout(() => setVisible(true), 500)
    return () => clearTimeout(timer)
  }, [lastSessionNodeId, dismissed])

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible) return

    const timer = setTimeout(() => {
      setVisible(false)
      setDismissed(true)
    }, DISMISS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [visible])

  const handleResume = useCallback(() => {
    if (!lastSessionNodeId) return

    const node = nodes.find(n => n.id === lastSessionNodeId)
    if (node?.position) {
      const width = (node.data as { width?: number }).width || 280
      const height = (node.data as { height?: number }).height || 140
      setCenter(
        node.position.x + width / 2,
        node.position.y + height / 2,
        { zoom: 1, duration: 400 }
      )
    }
    setVisible(false)
    setDismissed(true)
  }, [lastSessionNodeId, nodes, setCenter])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    setDismissed(true)
  }, [])

  if (!visible || !lastSessionNodeId) return null

  const lastNode = nodes.find(n => n.id === lastSessionNodeId)
  if (!lastNode) return null

  const title = (lastNode.data as { title?: string }).title || 'Untitled'

  return (
    <div className="session-reentry-prompt">
      <span className="session-reentry-prompt__text">
        Resume where you left off?
      </span>
      <button
        className="session-reentry-prompt__action"
        onClick={handleResume}
      >
        Go to "{title.length > 30 ? title.slice(0, 30) + '...' : title}"
      </button>
      <button
        className="session-reentry-prompt__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  )
}

export const SessionReEntryPrompt = memo(SessionReEntryPromptComponent)
