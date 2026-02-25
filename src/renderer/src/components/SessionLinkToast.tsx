import { memo, useCallback, useEffect, useState } from 'react'
import type { PendingUnlinkedSession } from '../stores/sessionLinkStore'

export interface SessionLinkToastProps {
  session: PendingUnlinkedSession
  conversationNodeOptions: Array<{ id: string; title: string }>
  onLink: (sessionId: string, nodeId: string) => void
  onCreateNew: (sessionId: string) => void
  onDismiss: (sessionId: string) => void
}

/** Auto-dismiss timeout in ms */
const AUTO_DISMISS_MS = 15_000

export const SessionLinkToast = memo(function SessionLinkToast({
  session,
  conversationNodeOptions,
  onLink,
  onCreateNew,
  onDismiss
}: SessionLinkToastProps): JSX.Element {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss(session.sessionId)
    }, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [session.sessionId, onDismiss])

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value
      if (value === '__new__') {
        onCreateNew(session.sessionId)
      } else if (value) {
        onLink(session.sessionId, value)
      }
    },
    [session.sessionId, onLink, onCreateNew]
  )

  if (!visible) return <></>

  const accentColor = '#4ECDC4' // default session color

  return (
    <div
      className="session-link-toast"
      role="alert"
      aria-live="polite"
      style={{ borderLeftColor: accentColor }}
    >
      <div className="session-link-toast__header">Unlinked Claude Code session detected</div>
      <div className="session-link-toast__cwd">{session.workingDirectory}</div>
      <div className="session-link-toast__actions">
        <select onChange={handleSelect} defaultValue="" aria-label="Link session to node">
          <option value="" disabled>
            Link to node...
          </option>
          {conversationNodeOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.title}
            </option>
          ))}
          <option value="__new__">+ Create new node</option>
        </select>
        <button
          onClick={() => onDismiss(session.sessionId)}
          className="session-link-toast__dismiss"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
})
