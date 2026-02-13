/**
 * SessionExpiredModal — Shows when multiplayer session token expires.
 *
 * Offers options to:
 * - Rejoin the workspace (enter invite link)
 * - Work offline (continue with local changes)
 * - Disconnect (go back to local mode)
 */

import { memo, useState, useCallback } from 'react'
import { AlertTriangle, RefreshCw, WifiOff, LogOut, X } from 'lucide-react'
import { useMultiplayer } from '../../hooks/useMultiplayer'
import { useConnectionStatus } from '../../sync'

interface SessionExpiredModalProps {
  onClose: () => void
}

export const SessionExpiredModal = memo(function SessionExpiredModal({ onClose }: SessionExpiredModalProps) {
  const { joinWorkspace, disconnect, goOnline } = useMultiplayer()
  const connectionStatus = useConnectionStatus()

  const [inviteLink, setInviteLink] = useState('')
  const [isRejoining, setIsRejoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRejoinInput, setShowRejoinInput] = useState(false)

  // Only show when connection is in error state
  if (connectionStatus !== 'error') {
    return null
  }

  const handleRetry = useCallback(async () => {
    setError(null)
    setIsRejoining(true)
    try {
      await goOnline()
      // If successful, modal will auto-close due to connectionStatus change
    } catch (err) {
      setError('Failed to reconnect. Please try rejoining with an invite link.')
    } finally {
      setIsRejoining(false)
    }
  }, [goOnline])

  const handleRejoin = useCallback(async () => {
    if (!inviteLink.trim()) {
      setError('Please enter an invite link')
      return
    }

    setError(null)
    setIsRejoining(true)

    try {
      const result = await joinWorkspace(inviteLink.trim())
      if (result.success) {
        onClose()
      } else {
        setError(result.error || 'Failed to rejoin workspace')
      }
    } catch (err) {
      setError('An error occurred while rejoining')
    } finally {
      setIsRejoining(false)
    }
  }, [inviteLink, joinWorkspace, onClose])

  const handleWorkOffline = useCallback(() => {
    // Keep multiplayer mode but don't try to reconnect
    // Changes will be saved locally in IndexedDB
    onClose()
  }, [onClose])

  const handleDisconnect = useCallback(() => {
    disconnect()
    onClose()
  }, [disconnect, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-[var(--bg-primary)] glass-fluid rounded-lg shadow-xl border border-[var(--border-default)]">
        {/* Close button */}
        <button
          onClick={handleWorkOffline}
          className="absolute top-3 right-3 p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          title="Continue offline"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[var(--border-default)]">
          <div className="p-2 rounded-full bg-yellow-500/10">
            <AlertTriangle size={20} className="text-yellow-500" />
          </div>
          <div>
            <h2 className="font-medium text-[var(--text-primary)]">Session Expired</h2>
            <p className="text-sm text-[var(--text-secondary)]">Your multiplayer session has ended</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Your authentication token has expired. Your local changes are safe.
            Choose how to continue:
          </p>

          {/* Error message */}
          {error && (
            <div className="p-2 text-sm text-red-400 bg-red-500/10 rounded border border-red-500/20">
              {error}
            </div>
          )}

          {/* Rejoin with link input */}
          {showRejoinInput ? (
            <div className="space-y-2">
              <input
                type="text"
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
                placeholder="Paste invite link..."
                className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRejoin}
                  disabled={isRejoining}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
                >
                  {isRejoining ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Rejoin
                </button>
                <button
                  onClick={() => setShowRejoinInput(false)}
                  className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Action buttons */
            <div className="space-y-2">
              {/* Retry connection */}
              <button
                onClick={handleRetry}
                disabled={isRejoining}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-[var(--bg-hover)] rounded border border-[var(--border-default)]"
              >
                <RefreshCw size={16} className={`text-blue-400 ${isRejoining ? 'animate-spin' : ''}`} />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">Retry Connection</div>
                  <div className="text-xs text-[var(--text-secondary)]">Attempt to reconnect with current session</div>
                </div>
              </button>

              {/* Rejoin with link */}
              <button
                onClick={() => setShowRejoinInput(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-[var(--bg-hover)] rounded border border-[var(--border-default)]"
              >
                <RefreshCw size={16} className="text-green-400" />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">Rejoin with Invite Link</div>
                  <div className="text-xs text-[var(--text-secondary)]">Enter a new invite link to rejoin</div>
                </div>
              </button>

              {/* Work offline */}
              <button
                onClick={handleWorkOffline}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-[var(--bg-hover)] rounded border border-[var(--border-default)]"
              >
                <WifiOff size={16} className="text-yellow-400" />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">Continue Offline</div>
                  <div className="text-xs text-[var(--text-secondary)]">Keep working, changes saved locally</div>
                </div>
              </button>

              {/* Disconnect */}
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-[var(--bg-hover)] rounded border border-[var(--border-default)]"
              >
                <LogOut size={16} className="text-[var(--text-secondary)]" />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">Disconnect</div>
                  <div className="text-xs text-[var(--text-secondary)]">Leave multiplayer and work locally</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-b-lg border-t border-[var(--border-default)]">
          Your work is automatically saved to your device. No data has been lost.
        </div>
      </div>
    </div>
  )
})
