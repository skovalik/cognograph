/**
 * LiveRegion Component
 *
 * Screen reader announcements for AI operations.
 * Uses aria-live to announce status changes.
 */

import { memo, useEffect, useRef } from 'react'

interface LiveRegionProps {
  /** The message to announce */
  message: string
  /** Priority level - 'polite' waits, 'assertive' interrupts */
  priority?: 'polite' | 'assertive'
  /** Whether to clear message after announcement */
  clearAfter?: number
}

/**
 * LiveRegion - Announces messages to screen readers.
 *
 * Usage:
 * ```tsx
 * <LiveRegion message="Generating plan..." priority="polite" />
 * ```
 */
function LiveRegionComponent({
  message,
  priority = 'polite',
  clearAfter
}: LiveRegionProps): JSX.Element {
  const regionRef = useRef<HTMLDivElement>(null)
  const previousMessage = useRef<string>('')

  useEffect(() => {
    // Only announce if message changed
    if (message !== previousMessage.current && regionRef.current) {
      // Clear and re-set to trigger announcement
      regionRef.current.textContent = ''

      // Small delay to ensure screen reader picks up the change
      const announceId = setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = message
        }
      }, 100)

      previousMessage.current = message

      return () => clearTimeout(announceId)
    }
    return undefined
  }, [message])

  useEffect(() => {
    if (clearAfter && message) {
      const clearId = setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = ''
          previousMessage.current = ''
        }
      }, clearAfter)

      return () => clearTimeout(clearId)
    }
    return undefined
  }, [message, clearAfter])

  return (
    <div
      ref={regionRef}
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0
      }}
    >
      {message}
    </div>
  )
}

const LiveRegion = memo(LiveRegionComponent)
export default LiveRegion
