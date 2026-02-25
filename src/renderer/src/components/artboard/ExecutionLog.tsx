/**
 * ExecutionLog — Timestamped, filterable log panel for OrchestratorNode.
 *
 * Color-coded by level (info=muted, warn=amber, error=red).  Filterable by
 * level via toggle buttons.  Simple windowing for large lists: only renders
 * entries within a visible window (visible +/- 20 buffer).
 *
 * Phase 3B artboard panel.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
  agentId?: string
}

export interface ExecutionLogProps {
  entries: LogEntry[]
  className?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVEL_STYLES: Record<string, { color: string; label: string }> = {
  info: { color: 'var(--text-muted, #888)', label: 'Info' },
  warn: { color: '#f59e0b', label: 'Warn' },
  error: { color: '#ef4444', label: 'Error' },
}

const ROW_HEIGHT = 24
const BUFFER = 20

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ExecutionLogComponent({ entries, className }: ExecutionLogProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [visibleHeight, setVisibleHeight] = useState(400)

  // Level filter state — all enabled by default
  const [enabledLevels, setEnabledLevels] = useState<Record<string, boolean>>({
    info: true,
    warn: true,
    error: true,
  })

  const toggleLevel = useCallback((level: string) => {
    setEnabledLevels((prev) => ({ ...prev, [level]: !prev[level] }))
  }, [])

  // Filtered entries
  const filtered = useMemo(
    () => entries.filter((e) => enabledLevels[e.level]),
    [entries, enabledLevels],
  )

  // Simple windowed rendering for performance
  const useVirtualization = filtered.length > 100
  const totalHeight = filtered.length * ROW_HEIGHT

  const { startIdx, endIdx } = useMemo(() => {
    if (!useVirtualization) return { startIdx: 0, endIdx: filtered.length }
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER)
    const end = Math.min(
      filtered.length,
      Math.ceil((scrollTop + visibleHeight) / ROW_HEIGHT) + BUFFER,
    )
    return { startIdx: start, endIdx: end }
  }, [scrollTop, visibleHeight, filtered.length, useVirtualization])

  const visibleEntries = useMemo(
    () => filtered.slice(startIdx, endIdx),
    [filtered, startIdx, endIdx],
  )

  // Scroll handler
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  // Measure visible height on mount and resize
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setVisibleHeight(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Auto-scroll to bottom when new entries arrive (if already near bottom)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < ROW_HEIGHT * 3
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [entries.length])

  const formatTime = useCallback((ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, [])

  return (
    <div
      className={`execution-log flex flex-col h-full overflow-hidden ${className ?? ''}`}
      aria-label="Execution log"
    >
      {/* Filter bar */}
      <div className="execution-log__filters flex items-center gap-1 px-2 py-1 border-b" style={{ borderColor: 'var(--border-subtle, #333)' }}>
        {Object.entries(LEVEL_STYLES).map(([level, style]) => (
          <button
            key={level}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-opacity ${
              enabledLevels[level] ? 'opacity-100' : 'opacity-40'
            }`}
            style={{
              backgroundColor: enabledLevels[level] ? `${style.color}20` : 'transparent',
              color: style.color,
              border: `1px solid ${enabledLevels[level] ? `${style.color}40` : 'transparent'}`,
            }}
            onClick={() => toggleLevel(level)}
            aria-pressed={enabledLevels[level]}
            aria-label={`Toggle ${style.label} messages`}
          >
            {style.label}
          </button>
        ))}
        <span className="ml-auto text-[9px]" style={{ color: 'var(--text-muted, #888)' }}>
          {filtered.length} / {entries.length}
        </span>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="execution-log__entries flex-1 overflow-y-auto font-mono text-[11px]"
        onScroll={handleScroll}
      >
        {useVirtualization ? (
          <div style={{ height: totalHeight, position: 'relative' }}>
            {visibleEntries.map((entry, i) => {
              const idx = startIdx + i
              const style = LEVEL_STYLES[entry.level]
              return (
                <div
                  key={idx}
                  className="execution-log__row flex items-center gap-2 px-2 hover:bg-white/5"
                  style={{
                    height: ROW_HEIGHT,
                    position: 'absolute',
                    top: idx * ROW_HEIGHT,
                    left: 0,
                    right: 0,
                  }}
                >
                  <span className="flex-shrink-0 text-[9px]" style={{ color: 'var(--text-muted, #666)' }}>
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className="flex-shrink-0 w-8 text-center text-[9px] font-semibold uppercase" style={{ color: style.color }}>
                    {entry.level}
                  </span>
                  {entry.agentId && (
                    <span className="flex-shrink-0 text-[9px] opacity-60" style={{ color: 'var(--text-secondary, #aaa)' }}>
                      [{entry.agentId.slice(0, 8)}]
                    </span>
                  )}
                  <span className="truncate" style={{ color: style.color === 'var(--text-muted, #888)' ? 'var(--text-secondary, #bbb)' : style.color }}>
                    {entry.message}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          filtered.map((entry, idx) => {
            const style = LEVEL_STYLES[entry.level]
            return (
              <div
                key={idx}
                className="execution-log__row flex items-center gap-2 px-2 hover:bg-white/5"
                style={{ height: ROW_HEIGHT }}
              >
                <span className="flex-shrink-0 text-[9px]" style={{ color: 'var(--text-muted, #666)' }}>
                  {formatTime(entry.timestamp)}
                </span>
                <span className="flex-shrink-0 w-8 text-center text-[9px] font-semibold uppercase" style={{ color: style.color }}>
                  {entry.level}
                </span>
                {entry.agentId && (
                  <span className="flex-shrink-0 text-[9px] opacity-60" style={{ color: 'var(--text-secondary, #aaa)' }}>
                    [{entry.agentId.slice(0, 8)}]
                  </span>
                )}
                <span className="truncate" style={{ color: style.color === 'var(--text-muted, #888)' ? 'var(--text-secondary, #bbb)' : style.color }}>
                  {entry.message}
                </span>
              </div>
            )
          })
        )}
        {filtered.length === 0 && (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: 'var(--text-muted, #888)' }}
          >
            No log entries{entries.length > 0 ? ' (all filtered)' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

export const ExecutionLog = memo(ExecutionLogComponent)
