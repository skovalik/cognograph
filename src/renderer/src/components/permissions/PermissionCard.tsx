// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * PermissionCard — displays a single pending permission request.
 *
 * Shows structured display data: tool name, command preview, and
 * action buttons (approve once / approve session / deny).
 */

import { memo, useEffect, useState, useCallback } from 'react'
import { Shield, ShieldAlert, Terminal, X, Check, Clock } from 'lucide-react'
import type { PermissionRequest, PermissionDuration } from '../../stores/permissionStore'
import { PERMISSION_TIMEOUT_MS } from '../../stores/permissionStore'
import { ShellPermissionCard } from './ShellPermissionCard'
import { EditPermissionCard } from './EditPermissionCard'
import { MutationPermissionCard } from './MutationPermissionCard'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionCardProps {
  request: PermissionRequest
  onApprove: (request: PermissionRequest, duration: PermissionDuration) => void
  onDeny: (requestId: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatToolName(name?: string): string {
  if (!name) return 'Unknown tool'
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getTypeIcon(type: PermissionRequest['type']) {
  switch (type) {
    case 'shell_execute':
      return Terminal
    case 'filesystem_write':
    case 'filesystem_read':
      return Shield
    case 'network_fetch':
      return ShieldAlert
    default:
      return Shield
  }
}

function getTypeLabel(type: PermissionRequest['type']): string {
  switch (type) {
    case 'shell_execute':
      return 'Shell Command'
    case 'filesystem_write':
      return 'File Write'
    case 'filesystem_read':
      return 'File Read'
    case 'network_fetch':
      return 'Network Request'
    default:
      return 'Permission'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PermissionCard = memo(function PermissionCard({
  request,
  onApprove,
  onDeny
}: PermissionCardProps) {
  const [remainingMs, setRemainingMs] = useState(
    Math.max(0, PERMISSION_TIMEOUT_MS - (Date.now() - request.createdAt))
  )

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, PERMISSION_TIMEOUT_MS - (Date.now() - request.createdAt))
      setRemainingMs(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [request.createdAt])

  const handleApproveOnce = useCallback(() => {
    onApprove(request, 'once')
  }, [request, onApprove])

  const handleApproveSession = useCallback(() => {
    onApprove(request, 'session')
  }, [request, onApprove])

  const handleDeny = useCallback(() => {
    onDeny(request.id)
  }, [request.id, onDeny])

  const isDenied = request.status === 'denied'
  const isExpiring = remainingMs < 10_000 && remainingMs > 0
  const remainingSec = Math.ceil(remainingMs / 1000)

  const Icon = getTypeIcon(request.type)
  const typeLabel = getTypeLabel(request.type)
  const displayName = request.displayData?.toolName
    ? formatToolName(request.displayData.toolName)
    : typeLabel

  // Determine what to show as the command/resource preview
  const previewText =
    request.command ??
    request.path ??
    request.domain ??
    request.displayData?.description ??
    request.reason

  return (
    <div
      className={`
        rounded-lg border px-3 py-2.5 transition-all duration-200
        ${isDenied
          ? 'border-red-500/30 bg-red-500/5 opacity-60'
          : isExpiring
            ? 'border-amber-500/40 bg-amber-500/5 animate-pulse'
            : 'border-violet-500/30 bg-violet-500/5'
        }
      `}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${
          isDenied ? 'text-red-400' : 'text-violet-400'
        }`} />
        <span className={`text-xs font-medium ${
          isDenied ? 'text-red-400' : 'text-violet-400'
        }`}>
          {displayName}
        </span>
        <span className="flex-1" />
        <span className={`text-[10px] flex items-center gap-1 ${
          isExpiring ? 'text-amber-400' : 'text-white/30'
        }`}>
          <Clock className="w-2.5 h-2.5" />
          {remainingSec}s
        </span>
      </div>

      {/* Specialized display variant or generic preview */}
      {request.display?.type === 'shell' ? (
        <ShellPermissionCard display={request.display} />
      ) : request.display?.type === 'edit' ? (
        <EditPermissionCard display={request.display} />
      ) : request.display?.type === 'mutation' ? (
        <MutationPermissionCard display={request.display} />
      ) : (
        <div className="mb-2">
          <code className="text-xs text-white/70 bg-black/30 px-1.5 py-0.5 rounded font-mono break-all block max-h-16 overflow-y-auto">
            {previewText}
          </code>
        </div>
      )}

      {/* Reason (if different from preview) */}
      {request.reason && request.reason !== previewText && (
        <p className="text-[10px] text-white/40 mb-2 leading-tight">
          {request.reason}
        </p>
      )}

      {/* Action buttons */}
      {!isDenied && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleApproveOnce}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded
              bg-emerald-600/20 text-emerald-400 border border-emerald-500/30
              hover:bg-emerald-600/30 transition-colors cursor-pointer"
          >
            <Check className="w-2.5 h-2.5" />
            Once
          </button>
          <button
            onClick={handleApproveSession}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded
              bg-blue-600/20 text-blue-400 border border-blue-500/30
              hover:bg-blue-600/30 transition-colors cursor-pointer"
          >
            <Check className="w-2.5 h-2.5" />
            Session
          </button>
          <span className="flex-1" />
          <button
            onClick={handleDeny}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded
              bg-red-600/20 text-red-400 border border-red-500/30
              hover:bg-red-600/30 transition-colors cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
            Deny
          </button>
        </div>
      )}
    </div>
  )
})
