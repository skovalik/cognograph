/**
 * ConnectionStatus — Shows multiplayer connection state indicator.
 *
 * Displays:
 * - Connection dot (green/yellow/red)
 * - Connected user count
 * - Offline/online toggle
 */

import { memo } from 'react'
import { Users, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useMultiplayer } from '../../hooks/useMultiplayer'

export const ConnectionStatus = memo(function ConnectionStatus() {
  const {
    isMultiplayer,
    connectionStatus,
    connectedUsers,
    goOffline,
    goOnline
  } = useMultiplayer()

  if (!isMultiplayer) return null

  const statusColor = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    syncing: 'bg-blue-500',
    disconnected: 'bg-[var(--text-muted)]',
    error: 'bg-red-500'
  }[connectionStatus]

  const statusLabel = {
    connected: 'Connected',
    connecting: 'Connecting...',
    syncing: 'Syncing...',
    disconnected: 'Offline',
    error: 'Connection error'
  }[connectionStatus]

  const isOnline = connectionStatus === 'connected' || connectionStatus === 'syncing'
  const showRetry = connectionStatus === 'error' || connectionStatus === 'disconnected'

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-[var(--text-secondary)]">
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full ${statusColor} ${connectionStatus === 'connecting' || connectionStatus === 'syncing' ? 'animate-pulse' : ''}`} />

      {/* Status text */}
      <span className="hidden sm:inline">{statusLabel}</span>

      {/* Error message hint */}
      {connectionStatus === 'error' && (
        <span className="text-red-400 text-[10px] hidden sm:inline">Tap retry to reconnect</span>
      )}

      {/* Offline indicator — edits saved locally */}
      {connectionStatus === 'disconnected' && (
        <span className="text-[var(--text-muted)] text-[10px] hidden sm:inline">Edits saved locally</span>
      )}

      {/* User count */}
      {connectedUsers.length > 0 && (
        <div className="flex items-center gap-1" title={connectedUsers.map(u => u.name).join(', ')}>
          <Users size={11} />
          <span>{connectedUsers.length + 1}</span>
        </div>
      )}

      {/* Retry button (shown when disconnected or error) */}
      {showRetry && (
        <button
          onClick={goOnline}
          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-blue-400"
          title="Retry connection"
        >
          <RefreshCw size={12} />
        </button>
      )}

      {/* Online/Offline toggle */}
      <button
        onClick={isOnline ? goOffline : goOnline}
        className="p-0.5 rounded hover:bg-[var(--bg-hover)]"
        title={isOnline ? 'Go offline' : 'Reconnect'}
      >
        {isOnline ? (
          <Cloud size={12} className="text-green-500" />
        ) : (
          <CloudOff size={12} className="text-[var(--text-muted)]" />
        )}
      </button>
    </div>
  )
})
