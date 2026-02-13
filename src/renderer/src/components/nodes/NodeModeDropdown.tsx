/**
 * NodeModeDropdown - Shared mode selector for node headers
 *
 * Used by: NoteNode (10 modes), ConversationNode (2 modes)
 * Design: Clickable badge → dropdown with radio group
 */

import { memo, useCallback, useRef, useEffect, useState } from 'react'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { useReactFlow } from '@xyflow/react'
import { cn } from '../../lib/utils'

export interface ModeOption {
  value: string
  label: string
  description?: string // Subtitle for non-obvious modes
  icon?: LucideIcon
  color?: string
  group?: string // For visual grouping (not implemented yet, for future)
}

interface NodeModeDropdownProps {
  options: ModeOption[]
  value: string
  onChange: (value: string) => void
  nodeColor: string
  compact?: boolean // Icon-only trigger (for narrow nodes < 200px)
  disabled?: boolean // Prevent changes during active runs
  'aria-label'?: string
}

function NodeModeDropdownComponent({
  options,
  value,
  onChange,
  nodeColor,
  compact = false,
  disabled = false,
  'aria-label': ariaLabel
}: NodeModeDropdownProps): JSX.Element {
  const { getViewport } = useReactFlow()

  // Track viewport change timer to prevent leak
  const viewportTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Close dropdown when viewport changes (panning/zooming)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Clear existing timer if dropdown closes
      if (!open) {
        if (viewportTimerRef.current) {
          clearInterval(viewportTimerRef.current)
          viewportTimerRef.current = null
        }
        return
      }

      const currentViewport = getViewport()
      const closeOnViewportChange = () => {
        const newViewport = getViewport()
        if (
          newViewport.x !== currentViewport.x ||
          newViewport.y !== currentViewport.y ||
          newViewport.zoom !== currentViewport.zoom
        ) {
          // Viewport changed, close dropdown
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        }
      }

      // Listen for viewport changes
      viewportTimerRef.current = setInterval(closeOnViewportChange, 100)
      // Clean up after 5 seconds or when dropdown closes
      setTimeout(() => {
        if (viewportTimerRef.current) {
          clearInterval(viewportTimerRef.current)
          viewportTimerRef.current = null
        }
      }, 5000)
    },
    [getViewport]
  )

  const currentOption = options.find(opt => opt.value === value)
  const CurrentIcon = currentOption?.icon
  const currentLabel = currentOption?.label || value

  // Use two-column layout for tall menus (> 6 items)
  const useTwoColumns = options.length > 6

  // Track previous value to only announce actual changes (RL fix: aria-live should not fire on mount)
  const prevValueRef = useRef(value)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setAnnouncement(`Mode changed to ${currentLabel}`)
      prevValueRef.current = value
      // Clear announcement after screen reader has time to read it
      const timer = setTimeout(() => setAnnouncement(''), 1000)
      return () => clearTimeout(timer)
    }
  }, [value, currentLabel])

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: nodeColor ? `${nodeColor}15` : 'var(--surface-subtle)',
            border: `1px solid ${nodeColor ? `${nodeColor}40` : 'var(--border-subtle)'}`,
            color: nodeColor || 'var(--text-primary)'
          }}
          aria-label={ariaLabel || `Select mode: ${currentLabel}`}
        >
          {CurrentIcon && <CurrentIcon className="w-3 h-3" />}
          {!compact && <span>{currentLabel}</span>}
          <ChevronDown className="w-2.5 h-2.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className={cn(
          useTwoColumns ? "w-[720px]" : "w-80"
        )}
        collisionPadding={8}
      >
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={onChange}
          className={cn(
            useTwoColumns && "grid grid-cols-2 gap-x-2"
          )}
        >
          {options.map(option => {
            const OptionIcon = option.icon
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="group cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  {OptionIcon && (
                    <OptionIcon
                      className="w-4 h-4"
                      style={{ color: option.color || nodeColor }}
                    />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                        {option.description}
                      </div>
                    )}
                  </div>
                  {value === option.value && (
                    <Check className="w-4 h-4" style={{ color: option.color || nodeColor }} />
                  )}
                </div>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>

      {/* Live region for screen readers - only announces actual changes */}
      {announcement && (
        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      )}
    </DropdownMenu>
  )
}

export const NodeModeDropdown = memo(NodeModeDropdownComponent)
