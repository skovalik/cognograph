/**
 * CollapsibleSection Component
 *
 * Reusable collapsible section with consistent expand/collapse behavior.
 * Following the pattern from AdvancedOptions.tsx for consistency.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  defaultExpanded?: boolean
  badge?: string
  badgeColor?: 'default' | 'accent' | 'warning'
  rightContent?: React.ReactNode // For action buttons in header
  onExpandedChange?: (expanded: boolean) => void // Callback for external state sync
  children: React.ReactNode
}

function CollapsibleSectionComponent({
  title,
  icon,
  defaultExpanded = true,
  badge,
  badgeColor = 'default',
  rightContent,
  onExpandedChange,
  children
}: CollapsibleSectionProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto')

  // Update height when content changes
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [children])

  // Use ResizeObserver to handle dynamic content changes
  useEffect(() => {
    if (!contentRef.current) return
    const observer = new ResizeObserver(() => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.scrollHeight)
      }
    })
    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [])

  const toggle = useCallback(() => {
    setIsExpanded(prev => {
      const newValue = !prev
      onExpandedChange?.(newValue)
      return newValue
    })
  }, [onExpandedChange])

  const badgeClasses = {
    default: 'bg-white/10 text-[var(--text-secondary)]',
    accent: 'gui-badge-accent',
    warning: 'bg-amber-500/20 text-amber-400'
  }

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const transitionDuration = prefersReducedMotion ? '0ms' : '200ms'
  const sectionId = `section-content-${title.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="space-y-2">
      <button
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        aria-expanded={isExpanded}
        aria-controls={sectionId}
        className="flex items-center justify-between w-full px-2 py-1.5 -mx-2 rounded-md hover:bg-white/5 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="gui-text-secondary">{icon}</span>}
          <span className="text-xs font-medium gui-text-secondary uppercase tracking-wide">
            {title}
          </span>
          {badge && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${badgeClasses[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rightContent}
          <ChevronDown
            className={`w-4 h-4 gui-text-secondary transition-transform duration-200 ${
              isExpanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </div>
      </button>
      <div
        ref={contentRef}
        id={sectionId}
        className="overflow-hidden transition-all ease-out"
        style={{
          transitionDuration,
          maxHeight: isExpanded ? contentHeight : 0,
          opacity: isExpanded ? 1 : 0
        }}
      >
        {children}
      </div>
    </div>
  )
}

export const CollapsibleSection = memo(CollapsibleSectionComponent)
export default CollapsibleSection
