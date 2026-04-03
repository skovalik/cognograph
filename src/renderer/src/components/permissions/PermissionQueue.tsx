// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * PermissionQueue — manages the visible queue of pending permission requests.
 *
 * Viewport-anchored to bottom-right to avoid obscuring the user's work.
 * Shows up to MAX_CONCURRENT_REQUESTS cards plus a count badge for overflow.
 * Provides batch approve/deny controls when multiple requests are pending.
 */

import { memo, useCallback } from 'react'
import { ShieldCheck, ShieldX, Layers } from 'lucide-react'
import { PermissionCard } from './PermissionCard'
import {
  usePermissionStore,
  usePendingRequests,
  useTotalQueuedCount,
  type PermissionRequest,
  type PermissionDuration
} from '../../stores/permissionStore'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PermissionQueue = memo(function PermissionQueue() {
  const pendingRequests = usePendingRequests()
  const totalQueued = useTotalQueuedCount()
  const grantPermission = usePermissionStore((s) => s.grantPermission)
  const denyPermission = usePermissionStore((s) => s.denyPermission)
  const approveAll = usePermissionStore((s) => s.approveAll)
  const denyAll = usePermissionStore((s) => s.denyAll)

  const activePending = pendingRequests.filter((r) => r.status === 'pending')
  const overflowCount = totalQueued - pendingRequests.length

  const handleApprove = useCallback(
    (request: PermissionRequest, duration: PermissionDuration) => {
      grantPermission(request, duration)
    },
    [grantPermission]
  )

  const handleDeny = useCallback(
    (requestId: string) => {
      denyPermission(requestId)
    },
    [denyPermission]
  )

  const handleApproveAll = useCallback(() => {
    approveAll('session')
  }, [approveAll])

  const handleDenyAll = useCallback(() => {
    denyAll()
  }, [denyAll])

  // Don't render anything if no requests
  if (pendingRequests.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-72 max-h-[calc(100vh-8rem)] pointer-events-auto"
      role="region"
      aria-label="Permission requests"
    >
      {/* Batch controls — only when 2+ active requests */}
      {activePending.length >= 2 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-sm">
          <span className="text-[10px] text-white/50 font-medium flex-1">
            {activePending.length} pending
            {overflowCount > 0 && ` (+${overflowCount} queued)`}
          </span>
          <button
            onClick={handleApproveAll}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded
              bg-emerald-600/20 text-emerald-400 border border-emerald-500/30
              hover:bg-emerald-600/30 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            All
          </button>
          <button
            onClick={handleDenyAll}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded
              bg-red-600/20 text-red-400 border border-red-500/30
              hover:bg-red-600/30 transition-colors cursor-pointer"
          >
            <ShieldX className="w-2.5 h-2.5" />
            All
          </button>
        </div>
      )}

      {/* Scrollable card list */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        {pendingRequests.map((request) => (
          <PermissionCard
            key={request.id}
            request={request}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        ))}
      </div>

      {/* Overflow indicator */}
      {overflowCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
          <Layers className="w-3 h-3 text-white/30" />
          <span className="text-[10px] text-white/40">
            +{overflowCount} more request{overflowCount > 1 ? 's' : ''} queued
          </span>
        </div>
      )}
    </div>
  )
})
