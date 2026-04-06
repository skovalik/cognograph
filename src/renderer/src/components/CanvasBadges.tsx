// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * CanvasBadges — Floating glass pill indicators at the canvas bottom edge.
 *
 * Left group:  AgentLogBadge, FilterBadge
 * Right group: SyncBadge
 *
 * Zoom display moved to CollapsibleMinimap panel header.
 * Navigate/ModeBadge removed.
 */

import { RefreshCw, Zap } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { useOrchestratorStore } from '../stores/orchestratorStore'
import { useUIStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { FilterViewDropdown } from './FilterViewDropdown'
import '../styles/canvas-badges.css'

// -----------------------------------------------------------------------------
// AgentLogBadge — floating popover with command history
// -----------------------------------------------------------------------------

function AgentLogBadge(): JSX.Element {
  const activeRuns = useOrchestratorStore((s) => s.activeRuns)
  const commandLog = useWorkspaceStore((s) => s.commandLog)
  const activeCommandId = useUIStore((s) => s.activeCommandId)
  const leftSidebarOpen = useWorkspaceStore((s) => s.leftSidebarOpen)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const count = Array.from(activeRuns.values()).filter(
    (run) => run.status === 'running' || run.status === 'paused',
  ).length

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popoverOpen])

  const handleEntryClick = useCallback(
    (entryId: string) => {
      if (leftSidebarOpen) {
        useWorkspaceStore.getState().toggleLeftSidebar()
      }
      useUIStore.getState().setResponsePanelOpen(true)
      useUIStore.getState().setActiveCommandId(entryId)
      setPopoverOpen(false)
    },
    [leftSidebarOpen],
  )

  return (
    <div ref={popoverRef} style={{ position: 'relative' }}>
      <button
        className="canvas-badge glass-soft"
        onClick={() => setPopoverOpen(!popoverOpen)}
        title="Agent log"
      >
        <Zap className="w-3.5 h-3.5" />
        Agent log
        {count > 0 && <span style={{ color: 'var(--accent-glow)' }}>({count})</span>}
      </button>

      {/* Popover — command log entries */}
      {popoverOpen && commandLog.length > 0 && (
        <div className="agent-log-popover glass-soft">
          {commandLog
            .slice()
            .reverse()
            .map((entry) => (
              <button
                key={entry.id}
                className={`agent-log-popover__entry ${entry.id === activeCommandId ? 'agent-log-popover__entry--active' : ''}`}
                onClick={() => handleEntryClick(entry.id)}
              >
                <span
                  className="agent-log-popover__status"
                  style={{
                    color:
                      entry.status === 'done'
                        ? 'var(--accent-glow)'
                        : entry.status === 'running'
                          ? 'var(--text-secondary)'
                          : entry.status === 'error'
                            ? '#ef4444'
                            : 'var(--text-muted)',
                  }}
                >
                  {entry.status === 'running'
                    ? '●'
                    : entry.status === 'done'
                      ? '✓'
                      : entry.status === 'error'
                        ? '!'
                        : '—'}
                </span>
                <span className="agent-log-popover__text">{entry.input}</span>
              </button>
            ))}
        </div>
      )}

      {popoverOpen && commandLog.length === 0 && (
        <div
          className="agent-log-popover glass-soft"
          style={{
            padding: '12px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          No commands yet
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// FilterBadge
// -----------------------------------------------------------------------------

function FilterBadge(): JSX.Element {
  return <FilterViewDropdown />
}

// -----------------------------------------------------------------------------
// SyncBadge
// -----------------------------------------------------------------------------

function SyncBadge(): JSX.Element | null {
  const { isMultiplayer, connectionStatus } = useMultiplayer()

  if (!isMultiplayer) return null

  const label =
    {
      connected: 'Synced',
      connecting: 'Connecting…',
      syncing: 'Syncing…',
      disconnected: 'Offline',
      error: 'Sync error',
    }[connectionStatus] ?? connectionStatus

  return (
    <button
      className="canvas-badge glass-soft"
      onClick={() => window.dispatchEvent(new CustomEvent('toggle-multiplayer-panel'))}
      title={`Multiplayer: ${label}`}
    >
      <RefreshCw
        className={`w-3.5 h-3.5${connectionStatus === 'syncing' || connectionStatus === 'connecting' ? ' animate-spin' : ''}`}
      />
      {label}
    </button>
  )
}

// -----------------------------------------------------------------------------
// CanvasBadges — composite export
// -----------------------------------------------------------------------------

export const CanvasBadges = memo(function CanvasBadges() {
  return (
    <>
      {/* Left group */}
      <div className="absolute bottom-3 left-3 z-[50] flex items-center gap-2 pointer-events-auto">
        <AgentLogBadge />
        <FilterBadge />
      </div>
      {/* Right group */}
      <div className="absolute bottom-3 right-3 z-[50] flex items-center gap-2 pointer-events-auto">
        <SyncBadge />
      </div>
    </>
  )
})
