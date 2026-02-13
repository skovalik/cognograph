/**
 * HelpTooltip - Reusable (?) icon with hover tooltip
 *
 * Usage: Add next to any label to explain what it does
 *
 * @example
 * <div className="flex items-center gap-1">
 *   <label>Context Depth</label>
 *   <HelpTooltip content="How many connection hops to traverse when building context" />
 * </div>
 */

import { memo } from 'react'
import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui'
import { cn } from '../lib/utils'

interface HelpTooltipProps {
  /** Tooltip content - can be string or JSX */
  content: string | React.ReactNode
  /** Which side to show tooltip */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Additional CSS classes */
  className?: string
  /** Max width for tooltip content */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg'
}

function HelpTooltipComponent({
  content,
  side = 'top',
  className,
  maxWidth = 'sm'
}: HelpTooltipProps): JSX.Element {
  const maxWidthClass = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg'
  }[maxWidth]

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center w-4 h-4 rounded-full",
            "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            "transition-colors cursor-help",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gui-accent-primary)]",
            className
          )}
          aria-label="Help"
          onClick={(e) => e.stopPropagation()} // Prevent parent click handlers
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className={maxWidthClass}>
        {typeof content === 'string' ? (
          <p className="text-sm leading-relaxed">{content}</p>
        ) : (
          content
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export const HelpTooltip = memo(HelpTooltipComponent)
