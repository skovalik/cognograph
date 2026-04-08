// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * EscapeManager — Singleton that coordinates Escape key handlers with priority levels.
 *
 * Problem: 50+ components register independent Escape handlers, causing conflicts
 * (e.g., pressing Escape in a modal closes the canvas instead of the modal).
 *
 * Solution: A priority-based registry. When Escape is pressed, only the highest-priority
 * active handler fires. Lower-priority handlers are suppressed.
 *
 * Priority order (highest to lowest):
 *   modal > dialog > popover > presentation > canvas
 *
 * Usage:
 *   import { escapeManager, EscapePriority } from '../utils/EscapeManager'
 *
 *   // Register (e.g., in useEffect):
 *   escapeManager.register('my-modal', EscapePriority.MODAL, () => closeModal())
 *
 *   // Unregister on cleanup:
 *   escapeManager.unregister('my-modal')
 *
 * The manager attaches a single global keydown listener. Components should NOT
 * add their own Escape listeners for layered UI — use this manager instead.
 * Existing handlers can be migrated incrementally; the manager does not interfere
 * with handlers it doesn't know about.
 */

// =============================================================================
// Priority Levels
// =============================================================================

export enum EscapePriority {
  CANVAS = 0,
  PRESENTATION = 20,
  POPOVER = 30,
  DIALOG = 40,
  MODAL = 50,
}

// =============================================================================
// Types
// =============================================================================

interface EscapeHandler {
  id: string
  priority: EscapePriority
  handler: () => void
}

// =============================================================================
// isInputFocused utility
// =============================================================================

/**
 * Check if document.activeElement is an input, textarea, or contenteditable element.
 * Components should check this before handling keyboard events to avoid intercepting
 * keypresses meant for text editing.
 */
export function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false

  const tagName = el.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  if (el.getAttribute('contenteditable') === 'true') {
    return true
  }

  // Check if inside a contenteditable parent (e.g., TipTap editor)
  if (el.closest('[contenteditable="true"]')) {
    return true
  }

  return false
}

// =============================================================================
// EscapeManager Singleton
// =============================================================================

class EscapeManagerImpl {
  private handlers: Map<string, EscapeHandler> = new Map()
  private listening = false

  /**
   * Register an Escape handler with a given priority.
   * If a handler with the same ID already exists, it is replaced.
   */
  register(id: string, priority: EscapePriority, handler: () => void): void {
    this.handlers.set(id, { id, priority, handler })
    this.ensureListener()
  }

  /**
   * Unregister an Escape handler by ID.
   */
  unregister(id: string): void {
    this.handlers.delete(id)
    if (this.handlers.size === 0) {
      this.removeListener()
    }
  }

  /**
   * Get all registered handler IDs (useful for debugging).
   */
  getRegisteredIds(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Get the count of registered handlers.
   */
  get size(): number {
    return this.handlers.size
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    if (this.handlers.size === 0) return

    // Find the highest-priority handler
    let topHandler: EscapeHandler | null = null
    for (const handler of this.handlers.values()) {
      if (!topHandler || handler.priority > topHandler.priority) {
        topHandler = handler
      }
    }

    if (topHandler) {
      e.preventDefault()
      e.stopPropagation()
      topHandler.handler()
    }
  }

  private ensureListener(): void {
    if (this.listening) return
    document.addEventListener('keydown', this.handleKeyDown, { capture: true })
    this.listening = true
  }

  private removeListener(): void {
    if (!this.listening) return
    document.removeEventListener('keydown', this.handleKeyDown, { capture: true })
    this.listening = false
  }
}

// Export singleton instance
export const escapeManager = new EscapeManagerImpl()
