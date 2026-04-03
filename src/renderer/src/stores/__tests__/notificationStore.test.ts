// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Notification Store Tests — Phase 4A: UX-ERRORS
 *
 * Tests: queue management, duplicate folding, auto-dismiss timeouts,
 * priority ordering, max visible cap.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useNotificationStore,
  _resetIdCounter,
  _clearAllTimers,
  MAX_VISIBLE,
  TIMEOUT_MS,
  FOLD_WINDOW_MS
} from '../notificationStore'

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.useFakeTimers()
  _clearAllTimers()
  _resetIdCounter()
  useNotificationStore.setState({ notifications: [] })
})

afterEach(() => {
  _clearAllTimers()
  vi.useRealTimers()
})

// Shorthand
const store = () => useNotificationStore.getState()

// =============================================================================
// Tests
// =============================================================================

describe('notificationStore', () => {
  // ---------------------------------------------------------------------------
  // Basic queue
  // ---------------------------------------------------------------------------

  describe('notify', () => {
    it('adds a notification to the queue', () => {
      store().notify('Hello')
      expect(store().notifications).toHaveLength(1)
      expect(store().notifications[0].message).toBe('Hello')
    })

    it('defaults to info priority', () => {
      store().notify('Info msg')
      expect(store().notifications[0].priority).toBe('info')
    })

    it('accepts explicit priority', () => {
      store().notify('Err', 'error')
      expect(store().notifications[0].priority).toBe('error')
    })

    it('sets count to 1 for new notifications', () => {
      store().notify('One')
      expect(store().notifications[0].count).toBe(1)
    })

    it('returns the notification id', () => {
      const id = store().notify('Test')
      expect(id).toMatch(/^notif-/)
    })

    it('attaches nodeId when provided', () => {
      store().notify('Node err', 'error', { nodeId: 'node-42' })
      expect(store().notifications[0].nodeId).toBe('node-42')
    })

    it('attaches action when provided', () => {
      const cb = vi.fn()
      store().notify('With action', 'warning', { action: { label: 'Retry', callback: cb } })
      expect(store().notifications[0].action?.label).toBe('Retry')
    })

    it('newest notification is first in the array', () => {
      store().notify('First')
      store().notify('Second')
      expect(store().notifications[0].message).toBe('Second')
      expect(store().notifications[1].message).toBe('First')
    })
  })

  // ---------------------------------------------------------------------------
  // Duplicate folding
  // ---------------------------------------------------------------------------

  describe('duplicate folding', () => {
    it('folds same message + priority within fold window', () => {
      store().notify('Dup', 'warning')
      store().notify('Dup', 'warning')
      expect(store().notifications).toHaveLength(1)
      expect(store().notifications[0].count).toBe(2)
    })

    it('folds three times', () => {
      store().notify('Dup', 'error')
      store().notify('Dup', 'error')
      store().notify('Dup', 'error')
      expect(store().notifications).toHaveLength(1)
      expect(store().notifications[0].count).toBe(3)
    })

    it('does NOT fold different messages', () => {
      store().notify('A', 'info')
      store().notify('B', 'info')
      expect(store().notifications).toHaveLength(2)
    })

    it('does NOT fold same message with different priority', () => {
      store().notify('Same', 'info')
      store().notify('Same', 'error')
      expect(store().notifications).toHaveLength(2)
    })

    it('does NOT fold after fold window expires', () => {
      store().notify('Msg', 'info')
      // Advance time past the fold window
      vi.advanceTimersByTime(FOLD_WINDOW_MS + 1)
      // But dismiss the first one so the store is clean for a new one
      // Actually the old notification may have been auto-dismissed (info = 3s, fold = 5s)
      // Let's test with error (10s timeout > 5s fold window)
      _clearAllTimers()
      _resetIdCounter()
      useNotificationStore.setState({ notifications: [] })

      store().notify('Msg', 'error')
      vi.advanceTimersByTime(FOLD_WINDOW_MS + 1)
      store().notify('Msg', 'error')
      expect(store().notifications).toHaveLength(2)
    })

    it('returns the existing id when folding', () => {
      const id1 = store().notify('Dup', 'error')
      const id2 = store().notify('Dup', 'error')
      expect(id2).toBe(id1)
    })
  })

  // ---------------------------------------------------------------------------
  // Auto-dismiss timeouts
  // ---------------------------------------------------------------------------

  describe('auto-dismiss', () => {
    it('auto-dismisses info after 3s', () => {
      store().notify('Gone soon', 'info')
      expect(store().notifications).toHaveLength(1)
      vi.advanceTimersByTime(TIMEOUT_MS.info + 1)
      expect(store().notifications).toHaveLength(0)
    })

    it('auto-dismisses warning after 5s', () => {
      store().notify('Warning', 'warning')
      vi.advanceTimersByTime(TIMEOUT_MS.warning - 100)
      expect(store().notifications).toHaveLength(1)
      vi.advanceTimersByTime(200)
      expect(store().notifications).toHaveLength(0)
    })

    it('auto-dismisses error after 10s', () => {
      store().notify('Error', 'error')
      vi.advanceTimersByTime(TIMEOUT_MS.error - 100)
      expect(store().notifications).toHaveLength(1)
      vi.advanceTimersByTime(200)
      expect(store().notifications).toHaveLength(0)
    })

    it('resets timer when folding duplicates', () => {
      store().notify('Dup', 'error')
      vi.advanceTimersByTime(TIMEOUT_MS.error - 1000) // 9s in
      store().notify('Dup', 'error') // fold — should reset the 10s timer
      vi.advanceTimersByTime(5000) // 5s after fold — should still be alive
      expect(store().notifications).toHaveLength(1)
      vi.advanceTimersByTime(TIMEOUT_MS.error + 1) // now it should be gone
      expect(store().notifications).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Dismiss
  // ---------------------------------------------------------------------------

  describe('dismiss', () => {
    it('removes a specific notification by id', () => {
      const id = store().notify('A')
      store().notify('B')
      store().dismiss(id)
      expect(store().notifications).toHaveLength(1)
      expect(store().notifications[0].message).toBe('B')
    })

    it('is a no-op for unknown id', () => {
      store().notify('A')
      store().dismiss('nonexistent')
      expect(store().notifications).toHaveLength(1)
    })
  })

  describe('dismissAll', () => {
    it('clears all notifications', () => {
      store().notify('A')
      store().notify('B')
      store().notify('C')
      store().dismissAll()
      expect(store().notifications).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Priority ordering & max visible
  // ---------------------------------------------------------------------------

  describe('getVisible', () => {
    it('returns at most MAX_VISIBLE notifications', () => {
      for (let i = 0; i < MAX_VISIBLE + 3; i++) {
        store().notify(`Msg ${i}`, 'error')
      }
      expect(store().getVisible()).toHaveLength(MAX_VISIBLE)
    })

    it('prioritizes errors over warnings over info', () => {
      store().notify('Info', 'info')
      store().notify('Warning', 'warning')
      store().notify('Error', 'error')

      const visible = store().getVisible()
      expect(visible[0].priority).toBe('error')
      expect(visible[1].priority).toBe('warning')
      expect(visible[2].priority).toBe('info')
    })

    it('within same priority, newest first', () => {
      store().notify('Old', 'error')
      // Advance so timestamps differ
      vi.advanceTimersByTime(100)
      store().notify('New', 'error')

      const visible = store().getVisible()
      expect(visible[0].message).toBe('New')
      expect(visible[1].message).toBe('Old')
    })

    it('returns empty array when no notifications', () => {
      expect(store().getVisible()).toEqual([])
    })
  })
})
