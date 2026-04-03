// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Notification Store — Phase 4A: UX-ERRORS
 *
 * Priority-aware notification queue with duplicate folding.
 *
 * Features:
 * - Three priority levels: error (10s), warning (5s), info (3s)
 * - Duplicate folding: same message within 5s increments a counter
 * - Max 5 visible notifications at once; overflow queued
 * - Optional nodeId for jump-to-error navigation
 * - Optional action callback for inline remediation
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// =============================================================================
// Types
// =============================================================================

export type NotificationPriority = 'error' | 'warning' | 'info'

export interface NotificationAction {
  label: string
  callback: () => void
}

export interface Notification {
  id: string
  message: string
  priority: NotificationPriority
  count: number
  timestamp: number
  /** Node ID for jump-to-error navigation */
  nodeId?: string
  /** Inline action button */
  action?: NotificationAction
}

interface NotificationStoreState {
  /** All notifications (visible + queued). Newest first. */
  notifications: Notification[]
}

interface NotificationStoreActions {
  /** Push a notification. Folds into existing if duplicate within 5s. */
  notify: (
    message: string,
    priority?: NotificationPriority,
    options?: { nodeId?: string; action?: NotificationAction }
  ) => string

  /** Dismiss a single notification by id */
  dismiss: (id: string) => void

  /** Dismiss all notifications */
  dismissAll: () => void

  /** Get only the visible notifications (top N by priority, max 5) */
  getVisible: () => Notification[]
}

export type NotificationStore = NotificationStoreState & NotificationStoreActions

// =============================================================================
// Constants
// =============================================================================

/** Maximum notifications shown at once */
export const MAX_VISIBLE = 5

/** Auto-dismiss timeout per priority (ms) */
export const TIMEOUT_MS: Record<NotificationPriority, number> = {
  error: 10_000,
  warning: 5_000,
  info: 3_000
}

/** Window for folding duplicate messages (ms) */
export const FOLD_WINDOW_MS = 5_000

/** Priority sort weight — lower value = higher priority */
const PRIORITY_WEIGHT: Record<NotificationPriority, number> = {
  error: 0,
  warning: 1,
  info: 2
}

// =============================================================================
// ID generator (avoids uuid dep for lightweight store)
// =============================================================================

let _idCounter = 0

export function _resetIdCounter(): void {
  _idCounter = 0
}

function nextId(): string {
  _idCounter += 1
  return `notif-${_idCounter}`
}

// =============================================================================
// Timer management
// =============================================================================

const _timers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleAutoDismiss(id: string, timeoutMs: number, dismiss: (id: string) => void): void {
  clearAutoDismiss(id)
  const timer = setTimeout(() => {
    _timers.delete(id)
    dismiss(id)
  }, timeoutMs)
  _timers.set(id, timer)
}

function clearAutoDismiss(id: string): void {
  const existing = _timers.get(id)
  if (existing) {
    clearTimeout(existing)
    _timers.delete(id)
  }
}

export function _clearAllTimers(): void {
  for (const timer of _timers.values()) {
    clearTimeout(timer)
  }
  _timers.clear()
}

// =============================================================================
// Store
// =============================================================================

export const useNotificationStore = create<NotificationStore>()(
  subscribeWithSelector((set, get) => ({
    notifications: [],

    notify: (message, priority = 'info', options) => {
      const now = Date.now()
      const state = get()

      // --- Fold duplicates: same message + priority within FOLD_WINDOW_MS ---
      const existing = state.notifications.find(
        (n) =>
          n.message === message &&
          n.priority === priority &&
          now - n.timestamp < FOLD_WINDOW_MS
      )

      if (existing) {
        // Increment counter and refresh timestamp
        set({
          notifications: state.notifications.map((n) =>
            n.id === existing.id
              ? { ...n, count: n.count + 1, timestamp: now }
              : n
          )
        })
        // Reset auto-dismiss timer for the folded notification
        scheduleAutoDismiss(existing.id, TIMEOUT_MS[priority], get().dismiss)
        return existing.id
      }

      // --- New notification ---
      const id = nextId()
      const notification: Notification = {
        id,
        message,
        priority,
        count: 1,
        timestamp: now,
        nodeId: options?.nodeId,
        action: options?.action
      }

      set({ notifications: [notification, ...state.notifications] })

      // Schedule auto-dismiss
      scheduleAutoDismiss(id, TIMEOUT_MS[priority], get().dismiss)

      return id
    },

    dismiss: (id) => {
      clearAutoDismiss(id)
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      }))
    },

    dismissAll: () => {
      _clearAllTimers()
      set({ notifications: [] })
    },

    getVisible: () => {
      const { notifications } = get()
      // Sort by priority (errors first), then by timestamp (newest first)
      const sorted = [...notifications].sort((a, b) => {
        const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
        if (pw !== 0) return pw
        return b.timestamp - a.timestamp
      })
      return sorted.slice(0, MAX_VISIBLE)
    }
  }))
)

// =============================================================================
// Convenience function (fire-and-forget from anywhere)
// =============================================================================

export function notify(
  message: string,
  priority?: NotificationPriority,
  options?: { nodeId?: string; action?: NotificationAction }
): string {
  return useNotificationStore.getState().notify(message, priority, options)
}
