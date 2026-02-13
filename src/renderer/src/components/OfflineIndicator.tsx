/**
 * OfflineIndicator — Shows network connection status.
 *
 * Displays a non-intrusive indicator when the app is offline.
 * Includes pending sync count and auto-hides when back online.
 */

import { memo, useState, useEffect } from 'react'
import { WifiOff, RefreshCw, Cloud, CloudOff, Check } from 'lucide-react'
import { useOfflineStore, type OfflineState } from '../stores/offlineStore'

interface OfflineIndicatorProps {
  /** Position of the indicator */
  position?: 'top' | 'bottom'
  /** Whether to show pending operation count */
  showPendingCount?: boolean
  /** Custom class name */
  className?: string
}

export const OfflineIndicator = memo(function OfflineIndicator({
  position = 'bottom',
  showPendingCount = true,
  className = ''
}: OfflineIndicatorProps) {
  const isOnline = useOfflineStore((state: OfflineState) => state.isOnline)
  const isSyncing = useOfflineStore((state: OfflineState) => state.isSyncing)
  const pendingCount = useOfflineStore((state: OfflineState) => state.pendingOperations.length)
  const lastSyncTime = useOfflineStore((state: OfflineState) => state.lastSyncTime)

  const [showReconnected, setShowReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(!isOnline)

  // Track online/offline transitions
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
    } else if (wasOffline && isOnline) {
      // Just came back online
      setShowReconnected(true)
      const timer = setTimeout(() => {
        setShowReconnected(false)
        setWasOffline(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  // Don't render anything when online and nothing pending
  if (isOnline && !isSyncing && pendingCount === 0 && !showReconnected) {
    return null
  }

  const positionClasses = position === 'top'
    ? 'top-0 left-1/2 -translate-x-1/2 rounded-b-lg'
    : 'bottom-4 left-1/2 -translate-x-1/2 rounded-lg'

  return (
    <div
      className={`
        fixed z-50 px-4 py-2 flex items-center gap-3
        bg-[var(--bg-secondary)] border border-[var(--border-default)]
        shadow-lg transition-all duration-300
        ${positionClasses}
        ${className}
      `}
    >
      {/* Offline state */}
      {!isOnline && (
        <>
          <div className="flex items-center gap-2">
            <WifiOff size={16} className="text-yellow-500" />
            <span className="text-sm text-yellow-400 font-medium">Offline</span>
          </div>
          {showPendingCount && pendingCount > 0 && (
            <span className="text-xs text-[var(--text-secondary)]">
              {pendingCount} pending {pendingCount === 1 ? 'change' : 'changes'}
            </span>
          )}
        </>
      )}

      {/* Syncing state */}
      {isOnline && isSyncing && (
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-blue-400 animate-spin" />
          <span className="text-sm text-blue-400">Syncing...</span>
          {showPendingCount && pendingCount > 0 && (
            <span className="text-xs text-[var(--text-secondary)]">
              ({pendingCount} remaining)
            </span>
          )}
        </div>
      )}

      {/* Just reconnected state */}
      {isOnline && !isSyncing && showReconnected && (
        <div className="flex items-center gap-2">
          <Check size={16} className="text-green-400" />
          <span className="text-sm text-green-400">Back online</span>
        </div>
      )}

      {/* Pending changes while online (but not syncing) */}
      {isOnline && !isSyncing && !showReconnected && pendingCount > 0 && (
        <div className="flex items-center gap-2">
          <Cloud size={16} className="text-[var(--text-secondary)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            {pendingCount} pending
          </span>
        </div>
      )}
    </div>
  )
})

// -----------------------------------------------------------------------------
// Compact Variant (for status bar)
// -----------------------------------------------------------------------------

export const OfflineIndicatorCompact = memo(function OfflineIndicatorCompact() {
  const isOnline = useOfflineStore((state: OfflineState) => state.isOnline)
  const isSyncing = useOfflineStore((state: OfflineState) => state.isSyncing)
  const pendingCount = useOfflineStore((state: OfflineState) => state.pendingOperations.length)

  if (isOnline && !isSyncing && pendingCount === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-tertiary)]">
      {!isOnline && (
        <>
          <WifiOff size={12} className="text-yellow-500" />
          <span className="text-xs text-yellow-400">Offline</span>
        </>
      )}

      {isOnline && isSyncing && (
        <>
          <RefreshCw size={12} className="text-blue-400 animate-spin" />
          <span className="text-xs text-blue-400">Syncing</span>
        </>
      )}

      {isOnline && !isSyncing && pendingCount > 0 && (
        <>
          <CloudOff size={12} className="text-[var(--text-secondary)]" />
          <span className="text-xs text-[var(--text-secondary)]">{pendingCount}</span>
        </>
      )}
    </div>
  )
})

export default OfflineIndicator
