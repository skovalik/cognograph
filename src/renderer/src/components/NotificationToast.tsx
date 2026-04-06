// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * NotificationToast — Phase 4A: UX-ERRORS
 *
 * Renders the notification queue from notificationStore.
 * Fixed top-right position, animated enter/exit via framer-motion.
 * Supports:
 * - Priority-colored left border (error=red, warning=amber, info=blue)
 * - Duplicate fold counter badge
 * - Jump-to-error: clicking a notification with a nodeId pans the canvas
 * - Inline action buttons
 * - Click-to-dismiss or auto-dismiss via store timers
 */

import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, AlertTriangle, ExternalLink, Info, X } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useCanvasViewportStore } from '../stores/canvasViewportStore'
import {
  type Notification,
  type NotificationPriority,
  useNotificationStore,
} from '../stores/notificationStore'

// =============================================================================
// Priority Styles
// =============================================================================

const PRIORITY_BORDER: Record<NotificationPriority, string> = {
  error: 'border-l-red-500',
  warning: 'border-l-amber-400',
  info: 'border-l-blue-400',
}

const PRIORITY_BG: Record<NotificationPriority, string> = {
  error: 'bg-red-500/5',
  warning: 'bg-amber-400/5',
  info: 'bg-blue-400/5',
}

function PriorityIcon({ priority }: { priority: NotificationPriority }): JSX.Element {
  switch (priority) {
    case 'error':
      return <AlertCircle size={16} className="text-red-500 shrink-0" />
    case 'warning':
      return <AlertTriangle size={16} className="text-amber-400 shrink-0" />
    case 'info':
      return <Info size={16} className="text-blue-400 shrink-0" />
  }
}

// =============================================================================
// Single Toast Item
// =============================================================================

interface NotificationItemProps {
  notification: Notification
  onDismiss: (id: string) => void
  onJumpToNode?: (nodeId: string) => void
}

const NotificationItem = memo(function NotificationItem({
  notification,
  onDismiss,
  onJumpToNode,
}: NotificationItemProps) {
  const { id, message, priority, count, nodeId, action } = notification

  const handleClick = useCallback(() => {
    if (nodeId && onJumpToNode) {
      onJumpToNode(nodeId)
    }
  }, [nodeId, onJumpToNode])

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDismiss(id)
    },
    [id, onDismiss],
  )

  const handleAction = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      action?.callback()
    },
    [action],
  )

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={handleClick}
      className={[
        'relative flex items-start gap-2 px-3 py-2.5 rounded-lg border-l-[3px] shadow-lg',
        'bg-[var(--bg-secondary)] border border-[var(--border-default)]',
        PRIORITY_BORDER[priority],
        PRIORITY_BG[priority],
        nodeId ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : 'cursor-default',
        'max-w-sm w-80 select-none',
      ]
        .filter(Boolean)
        .join(' ')}
      role="alert"
      aria-live={priority === 'error' ? 'assertive' : 'polite'}
    >
      <PriorityIcon priority={priority} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] leading-snug break-words">
          {message}
          {count > 1 && (
            <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
              {count}x
            </span>
          )}
        </p>

        {/* Inline action button */}
        {action && (
          <button
            onClick={handleAction}
            className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            {action.label}
            <ExternalLink size={10} />
          </button>
        )}

        {/* Jump-to-node hint */}
        {nodeId && !action && (
          <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Click to jump to node</p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
})

// =============================================================================
// Container Component
// =============================================================================

export const NotificationToast = memo(function NotificationToast() {
  const notifications = useNotificationStore((s) => s.getVisible())
  const dismiss = useNotificationStore((s) => s.dismiss)
  const centerNode = useCanvasViewportStore((s) => s.centerNode)

  const handleJumpToNode = useCallback(
    (nodeId: string) => {
      centerNode(nodeId)
    },
    [centerNode],
  )

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <div key={n.id} className="pointer-events-auto">
            <NotificationItem
              notification={n}
              onDismiss={dismiss}
              onJumpToNode={n.nodeId ? handleJumpToNode : undefined}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
})

export default NotificationToast
