/**
 * Accessibility Utilities
 *
 * Reusable accessibility utilities for ARIA support,
 * screen reader announcements, and focus management.
 */

// =============================================================================
// ARIA ID Generation
// =============================================================================

let idCounter = 0

/**
 * Generate a unique ID for ARIA attributes.
 */
export function generateAriaId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

/**
 * Reset the ID counter (useful for testing).
 */
export function resetAriaIdCounter(): void {
  idCounter = 0
}

// =============================================================================
// Screen Reader Announcements
// =============================================================================

let liveRegion: HTMLDivElement | null = null

/**
 * Initialize the live region for screen reader announcements.
 * Called automatically on first announcement.
 */
function ensureLiveRegion(): HTMLDivElement {
  if (liveRegion) return liveRegion

  liveRegion = document.createElement('div')
  liveRegion.id = 'a11y-live-region'
  liveRegion.setAttribute('aria-live', 'polite')
  liveRegion.setAttribute('aria-atomic', 'true')
  liveRegion.setAttribute('role', 'status')
  liveRegion.className = 'sr-only'

  // Visually hidden but accessible to screen readers
  Object.assign(liveRegion.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0'
  })

  document.body.appendChild(liveRegion)
  return liveRegion
}

/**
 * Announce a message to screen readers.
 *
 * @param message - The message to announce
 * @param priority - 'polite' (waits for user to finish) or 'assertive' (interrupts)
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const region = ensureLiveRegion()
  region.setAttribute('aria-live', priority)

  // Clear and re-add to trigger announcement
  region.textContent = ''

  // Use setTimeout to ensure the DOM update triggers the announcement
  setTimeout(() => {
    region.textContent = message
  }, 100)
}

/**
 * Clear any pending announcements.
 */
export function clearAnnouncements(): void {
  if (liveRegion) {
    liveRegion.textContent = ''
  }
}

// =============================================================================
// Focus Management
// =============================================================================

/**
 * Trap focus within a container element.
 * Returns activate/deactivate functions.
 */
export function createFocusTrap(container: HTMLElement): {
  activate: () => void
  deactivate: () => void
} {
  let previouslyFocused: HTMLElement | null = null

  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ')

  const getFocusableElements = (): HTMLElement[] => {
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
  }

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return

    const focusable = getFocusableElements()
    if (focusable.length === 0) return

    const firstFocusable = focusable[0]
    const lastFocusable = focusable[focusable.length - 1]

    if (e.shiftKey) {
      // Shift+Tab: if on first element, go to last
      if (document.activeElement === firstFocusable) {
        e.preventDefault()
        lastFocusable?.focus()
      }
    } else {
      // Tab: if on last element, go to first
      if (document.activeElement === lastFocusable) {
        e.preventDefault()
        firstFocusable?.focus()
      }
    }
  }

  return {
    activate: () => {
      previouslyFocused = document.activeElement as HTMLElement

      // Focus first focusable element
      const focusable = getFocusableElements()
      if (focusable.length > 0) {
        focusable[0]?.focus()
      }

      container.addEventListener('keydown', handleKeyDown)
    },
    deactivate: () => {
      container.removeEventListener('keydown', handleKeyDown)

      // Restore focus to previous element
      if (previouslyFocused) {
        previouslyFocused.focus()
      }
    }
  }
}

// =============================================================================
// Keyboard Navigation
// =============================================================================

/**
 * Handle arrow key navigation in a list of items.
 *
 * @param e - The keyboard event
 * @param items - Array of focusable elements
 * @param currentIndex - Currently focused index
 * @returns New index after navigation
 */
export function handleArrowNavigation(
  e: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number
): number {
  if (items.length === 0) return currentIndex

  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      e.preventDefault()
      return (currentIndex + 1) % items.length

    case 'ArrowUp':
    case 'ArrowLeft':
      e.preventDefault()
      return (currentIndex - 1 + items.length) % items.length

    case 'Home':
      e.preventDefault()
      return 0

    case 'End':
      e.preventDefault()
      return items.length - 1

    default:
      return currentIndex
  }
}

// =============================================================================
// Reduced Motion Detection
// =============================================================================

/**
 * Check if user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Subscribe to reduced motion preference changes.
 * Returns unsubscribe function.
 */
export function subscribeToReducedMotion(
  callback: (prefersReduced: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  const handler = (e: MediaQueryListEvent): void => {
    callback(e.matches)
  }

  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}
