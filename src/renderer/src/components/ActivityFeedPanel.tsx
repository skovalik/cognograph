/**
 * ActivityFeedPanel — Claude Code Activity Feed
 *
 * Displays recent Claude Code activity events in a scrollable list.
 * Shown in the left sidebar as a tab panel, following the pattern of
 * ExtractionsPanel and LayersPanel.
 *
 * Features:
 * - Scrolling list of tool call events (most recent at bottom)
 * - Icon per tool type (file icon for Edit/Write, terminal for Bash, etc.)
 * - Color-coded status (green success, red error)
 * - Auto-scroll to newest events (toggleable)
 * - "Clear" button to reset event history
 * - Connection status indicator (green dot when events arriving, gray when idle)
 * - "Waiting for Claude Code" placeholder when no events
 *
 * @module ActivityFeedPanel
 */

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react'
import {
  FileEdit,
  FileOutput,
  FileSearch,
  Terminal,
  Search,
  Regex,
  Bot,
  Globe,
  Trash2,
  ArrowDownToLine,
  Play,
  Square,
  AlertCircle,
  Zap,
} from 'lucide-react'
import { useCCBridgeStore, selectCCBridgeEvents, selectCCBridgeConnected } from '../stores/ccBridgeStore'
import type { CCActivityEvent } from '@shared/bridge-types'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ActivityFeedPanelProps {
  sidebarWidth?: number
}

// -----------------------------------------------------------------------------
// Tool Icon Mapping
// -----------------------------------------------------------------------------

function getToolIcon(toolName: string | undefined): JSX.Element {
  const className = 'w-3.5 h-3.5 shrink-0'
  switch (toolName) {
    case 'Edit':
      return <FileEdit className={className} />
    case 'Write':
      return <FileOutput className={className} />
    case 'Read':
      return <FileSearch className={className} />
    case 'Bash':
      return <Terminal className={className} />
    case 'Glob':
      return <Search className={className} />
    case 'Grep':
      return <Regex className={className} />
    case 'Task':
      return <Bot className={className} />
    case 'WebFetch':
    case 'WebSearch':
      return <Globe className={className} />
    default:
      return <Zap className={className} />
  }
}

// -----------------------------------------------------------------------------
// Event Item
// -----------------------------------------------------------------------------

interface EventItemProps {
  event: CCActivityEvent
}

const EventItem = memo(function EventItem({ event }: EventItemProps): JSX.Element {
  const time = new Date(event.timestamp)
  const timeStr = time.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const isError = event.type === 'error'
  const isSessionEnd = event.type === 'session_end'
  const isSessionStart = event.type === 'session_start'
  const toolName = event.data.toolName

  // Session boundary markers
  if (isSessionStart || isSessionEnd) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs gui-text-muted">
        {isSessionStart ? (
          <Play className="w-3 h-3 text-green-400" />
        ) : (
          <Square className="w-3 h-3 text-gray-400" />
        )}
        <span className="flex-1 truncate">
          {isSessionStart ? 'Session started' : 'Session ended'}
        </span>
        <span className="tabular-nums opacity-60">{timeStr}</span>
      </div>
    )
  }

  // Error events
  if (isError) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 truncate">{event.data.content || 'Error'}</span>
        <span className="tabular-nums opacity-60">{timeStr}</span>
      </div>
    )
  }

  // Normal tool_use events
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs gui-text hover:gui-surface-hover transition-colors rounded-sm group"
    >
      <span className={isError ? 'text-red-400' : 'gui-text-secondary'}>
        {getToolIcon(toolName)}
      </span>
      <span className="flex-1 truncate" title={event.data.content || undefined}>
        {event.data.content || `${toolName || 'Unknown'} call`}
      </span>
      <span className="tabular-nums gui-text-muted opacity-60 text-[10px]">{timeStr}</span>
    </div>
  )
})

// -----------------------------------------------------------------------------
// Main Panel
// -----------------------------------------------------------------------------

function ActivityFeedPanelComponent({ sidebarWidth = 260 }: ActivityFeedPanelProps): JSX.Element {
  const events = useCCBridgeStore(selectCCBridgeEvents)
  const isConnected = useCCBridgeStore(selectCCBridgeConnected)
  const clearEvents = useCCBridgeStore((state) => state.clearEvents)

  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isCompact = sidebarWidth < 220

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length, autoScroll])

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    // If user scrolled up more than 50px from bottom, disable auto-scroll
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  const handleClear = useCallback(() => {
    clearEvents()
  }, [clearEvents])

  const handleAutoScrollToggle = useCallback(() => {
    setAutoScroll((prev) => !prev)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  // Stats
  const toolUseCount = useMemo(
    () => events.filter((e) => e.type === 'tool_use').length,
    [events]
  )

  return (
    <div className="h-full flex flex-col glass-soft gui-panel">
      {/* Header */}
      <div className="px-3 py-2 border-b gui-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs gui-text-secondary">
            {/* Connection indicator */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.5)]' : 'bg-gray-500'
              }`}
              title={isConnected ? 'Receiving events' : 'No active session'}
            />
            <span>
              {toolUseCount} {isCompact ? 'evt' : 'events'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Auto-scroll toggle */}
            <button
              onClick={handleAutoScrollToggle}
              className={`p-1 rounded text-xs ${
                autoScroll ? 'gui-text' : 'gui-text-muted'
              } hover:gui-surface-hover`}
              title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
            >
              <ArrowDownToLine className="w-3 h-3" />
            </button>
            {/* Clear button */}
            {events.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs gui-text-secondary hover:text-red-400 flex items-center gap-1 p-1 rounded hover:gui-surface-hover"
                title="Clear all events"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Event List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs gui-text-muted px-4 text-center gap-2">
            <Terminal className="w-6 h-6 opacity-40" />
            <span>Waiting for Claude Code activity...</span>
            <span className="text-[10px] opacity-60">
              Run Claude Code with the PostToolUse hook to see events here
            </span>
          </div>
        ) : (
          <div className="py-1">
            {events.map((event, index) => (
              <EventItem key={`${event.timestamp}-${index}`} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const ActivityFeedPanel = memo(ActivityFeedPanelComponent)
