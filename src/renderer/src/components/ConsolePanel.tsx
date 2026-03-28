// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import React, { useRef, useEffect, useState, useCallback, memo } from 'react'
import { useConsoleLogStore, ConsoleLogEntry } from '../stores/consoleLogStore'
import { Trash2, ArrowDownToLine, Copy } from 'lucide-react'

const LEVEL_COLORS: Record<string, string> = {
  log: 'var(--gui-text-secondary)',
  info: '#60a5fa',    // blue
  warn: '#fbbf24',    // yellow
  error: '#ef4444',   // red
}

const SOURCE_COLORS: Record<string, string> = {
  Agent: '#8b5cf6',       // purple
  NotionSync: '#06b6d4',  // cyan
  'plugin:notion': '#06b6d4',
  main: '#6b7280',        // gray
}

// memo() prevents re-renders from parent sidebar tab switches that don't affect this panel
export const ConsolePanel = memo(function ConsolePanel() {
  const entries = useConsoleLogStore(s => s.entries)
  const filter = useConsoleLogStore(s => s.filter)
  const setFilter = useConsoleLogStore(s => s.setFilter)
  const clear = useConsoleLogStore(s => s.clear)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll on new entries
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length, autoScroll])

  // Detect manual scroll-up to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }, [])

  // Get unique sources for filter dropdown
  const sources = [...new Set(entries.map(e => e.source))]

  // Filter entries
  const filtered = filter ? entries.filter(e => e.source === filter) : entries

  return (
    <div className="flex flex-col h-full text-xs font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'var(--node-border-secondary)', color: 'var(--gui-text-secondary)' }}>
        <span className="text-[10px] opacity-60">{filtered.length} entries</span>

        {/* Source filter */}
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="text-[10px] bg-transparent border rounded px-1 py-0.5"
          style={{ borderColor: 'var(--node-border-secondary)', color: 'var(--gui-text-secondary)' }}
        >
          <option value="">All sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex-1" />

        <button onClick={() => {
          const text = entries.map(e => `[${new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false })}] [${e.source}] ${e.message}`).join('\n')
          navigator.clipboard.writeText(text)
        }} className="p-1 rounded hover:bg-white/10" title="Copy all to clipboard">
          <Copy className="w-3 h-3" />
        </button>
        <button onClick={() => setAutoScroll(!autoScroll)}
          className={`p-1 rounded ${autoScroll ? 'bg-white/10' : ''}`}
          title="Auto-scroll">
          <ArrowDownToLine className="w-3 h-3" />
        </button>
        <button onClick={clear} className="p-1 rounded hover:bg-white/10" title="Clear">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Log entries — user-select-text overrides canvas's user-select-none */}
      <div ref={scrollRef} onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5"
        style={{ userSelect: 'text' }}>
        {filtered.map((entry) => (
          <div key={entry.id || entry.timestamp} className="flex gap-2 leading-tight py-0.5 hover:bg-white/5 rounded px-1">
            <span className="text-[9px] opacity-40 shrink-0 tabular-nums">
              {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
            </span>
            <span className="shrink-0 text-[9px] font-semibold px-1 rounded"
              style={{ color: SOURCE_COLORS[entry.source] || '#6b7280' }}>
              [{entry.source}]
            </span>
            <span style={{ color: LEVEL_COLORS[entry.level] || 'var(--gui-text-secondary)' }}
              className="break-all whitespace-pre-wrap">
              {entry.message.replace(/^\[[^\]]+\]\s*/, '')}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 opacity-40">
            {filter ? `No ${filter} events` : 'No console output yet'}
          </div>
        )}
      </div>
    </div>
  )
})
