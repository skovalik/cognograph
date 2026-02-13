/**
 * BridgeLogPanel Component (Phase 2: Bridge Log)
 *
 * A LeftSidebar tab that provides the complete audit trail of canvas actions.
 * Features:
 * - Virtualized list via react-window for 50k+ events
 * - Search with debounced filtering
 * - Actor type toggle filter (All/Agents/User/System)
 * - Time-grouped collapsible sections
 * - Export to CSV/JSON
 * - Undo support for reversible actions
 */

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { FixedSizeList as List } from 'react-window'
import { ScrollArea } from '../ui/scroll-area'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import {
  Download,
  Search,
  User,
  Bot,
  Cpu,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { useAuditStore } from '../../stores/auditStore'
import { EventCard } from './EventCard'
import { sciFiToast } from '../ui/SciFiToast'
import type { CanvasAuditEvent, AuditActor } from '@shared/types/bridge'

// =============================================================================
// Types
// =============================================================================

interface BridgeLogPanelProps {
  sidebarWidth: number
}

interface TimeGroup {
  label: string
  events: CanvasAuditEvent[]
  totalCost: number
}

// =============================================================================
// Helpers
// =============================================================================

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatDateLabel(date: Date, now: Date): string {
  if (isSameDay(date, now)) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(date, yesterday)) return 'Yesterday'

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupEventsByTime(events: CanvasAuditEvent[]): TimeGroup[] {
  const groups = new Map<string, CanvasAuditEvent[]>()
  const now = new Date()

  for (const event of events) {
    const date = new Date(event.timestamp)
    const label = formatDateLabel(date, now)

    const existing = groups.get(label) || []
    existing.push(event)
    groups.set(label, existing)
  }

  return Array.from(groups.entries()).map(([label, events]) => ({
    label,
    events: events.sort((a, b) => b.timestamp - a.timestamp),
    totalCost: events.reduce(
      (sum, e) => sum + (e.context.costUSD || 0),
      0
    ),
  }))
}

// =============================================================================
// Component
// =============================================================================

function BridgeLogPanelComponent({
  sidebarWidth,
}: BridgeLogPanelProps): JSX.Element {
  const events = useAuditStore((s) => s.filteredEvents)
  const eventCount = useAuditStore((s) => s.eventCount)
  const totalCost = useAuditStore((s) => s.totalCost)
  const setFilter = useAuditStore((s) => s.setFilter)
  const clearFilter = useAuditStore((s) => s.clearFilter)
  const undoEvent = useAuditStore((s) => s.undoEvent)
  const exportEvents = useAuditStore((s) => s.exportEvents)
  const clearEvents = useAuditStore((s) => s.clearEvents)

  const [searchText, setSearchText] = useState('')
  const [activeActorFilters, setActiveActorFilters] = useState<string[]>([
    'all',
  ])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['Today'])
  )
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const isCompact = sidebarWidth < 250

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)

    searchTimer.current = setTimeout(() => {
      setFilter({ searchText: searchText || undefined })
    }, 300)

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchText, setFilter])

  // Actor type filter
  const handleActorFilterChange = useCallback(
    (values: string[]) => {
      if (values.length === 0 || values.includes('all')) {
        setActiveActorFilters(['all'])
        setFilter({ actorTypes: undefined })
      } else {
        setActiveActorFilters(values)
        setFilter({
          actorTypes: values as AuditActor['type'][],
        })
      }
    },
    [setFilter]
  )

  // Time-grouped events
  const timeGroups = useMemo(() => groupEventsByTime(events), [events])

  // Toggle group expansion
  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }, [])

  // Undo handler
  const handleUndo = useCallback(
    async (eventId: string) => {
      const success = await undoEvent(eventId)
      if (success) {
        sciFiToast('Action undone', 'success', 2000)
      } else {
        sciFiToast('Failed to undo action', 'warning', 2000)
      }
    },
    [undoEvent]
  )

  // Export handler
  const handleExport = useCallback(
    (format: 'csv' | 'json') => {
      const content = exportEvents(format)
      const blob = new Blob([content], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bridge-log-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      sciFiToast(
        `Exported ${events.length} events as ${format.toUpperCase()}`,
        'success',
        2000
      )
    },
    [exportEvents, events.length]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-3 py-2 space-y-2"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3"
            style={{ color: 'var(--text-muted)' }}
          />
          <Input
            placeholder="Search events..."
            className="h-7 pl-7 text-xs"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        {/* Actor type filter */}
        <ToggleGroup
          type="multiple"
          value={activeActorFilters}
          onValueChange={handleActorFilterChange}
          className="gap-0.5 justify-start"
        >
          <ToggleGroupItem value="all" className="h-6 text-[10px] px-2">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="agent" className="h-6 text-[10px] px-2">
            <Bot className="w-3 h-3 mr-0.5" />
            {!isCompact && 'Agents'}
          </ToggleGroupItem>
          <ToggleGroupItem value="user" className="h-6 text-[10px] px-2">
            <User className="w-3 h-3 mr-0.5" />
            {!isCompact && 'You'}
          </ToggleGroupItem>
          <ToggleGroupItem value="system" className="h-6 text-[10px] px-2">
            <Cpu className="w-3 h-3 mr-0.5" />
            {!isCompact && 'System'}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Event list with time grouping */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          {timeGroups.length === 0 ? (
            <div
              className="text-xs text-center py-8"
              style={{ color: 'var(--text-muted)' }}
            >
              No events yet.
              <br />
              Actions will appear here as you work.
            </div>
          ) : (
            timeGroups.map((group) => (
              <Collapsible
                key={group.label}
                open={expandedGroups.has(group.label)}
                onOpenChange={() => toggleGroup(group.label)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 px-1 rounded transition-colors hover:bg-white/5">
                  <div className="flex items-center gap-1">
                    <ChevronRight
                      className={`w-3 h-3 transition-transform ${
                        expandedGroups.has(group.label) ? 'rotate-90' : ''
                      }`}
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {group.label}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 h-4"
                    >
                      {group.events.length}
                    </Badge>
                  </div>
                  {group.totalCost > 0 && (
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ${group.totalCost.toFixed(4)}
                    </span>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-1 space-y-0.5">
                    {group.events.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onUndo={handleUndo}
                        isCompact={isCompact}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer: Summary + Export */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderTop: '1px solid var(--border-default)' }}
      >
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {eventCount} events
          {totalCost > 0 && ` \u00b7 $${totalCost.toFixed(4)}`}
        </span>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]">
                <Download className="w-3 h-3 mr-0.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {eventCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px]"
              onClick={clearEvents}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export const BridgeLogPanel = memo(BridgeLogPanelComponent)
