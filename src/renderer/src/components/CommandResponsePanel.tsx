// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { CommandLogEntry } from '@shared/types'
import { AlertCircle, Check, Copy, Loader2, MessageCircle, Square } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useUIStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { requestFitView } from '../utils/layoutEvents'
import '../styles/command-response-panel.css'

// ── Elapsed timer for running commands ──

function ElapsedTimer({ startTime }: { startTime: number }): JSX.Element {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return (
    <span
      className="font-mono text-[10px] tabular-nums"
      style={{ color: 'var(--accent-glow)', opacity: 0.8 }}
    >
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  )
}

// ── Status icon for agent log entries ──

function StatusIcon({ status }: { status: CommandLogEntry['status'] }): JSX.Element {
  switch (status) {
    case 'running':
      return (
        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-glow)' }} />
      )
    case 'done':
      return <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent-glow)' }} />
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
    case 'cancelled':
      return <Square className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
  }
}

// ── Main Panel ──

function CommandResponsePanelComponent(): JSX.Element {
  const responsePanelOpen = useUIStore((s) => s.responsePanelOpen)
  const toggleResponsePanel = useUIStore((s) => s.toggleResponsePanel)
  const commandLog = useWorkspaceStore((s) => s.commandLog)
  const leftSidebarOpen = useWorkspaceStore((s) => s.leftSidebarOpen)
  const leftSidebarWidth = useWorkspaceStore((s) => s.leftSidebarWidth)
  const nodes = useWorkspaceStore((s) => s.nodes)
  const setSelectedNodes = useWorkspaceStore((s) => s.setSelectedNodes)
  const threadRef = useRef<HTMLDivElement>(null)
  const activeCommandId = useUIStore((s) => s.activeCommandId)

  // Derive a key that changes on both new entries AND streaming content updates.
  // This ensures we auto-scroll during agent narration streaming, not just on new entries.
  const latestRunning = commandLog.find((e) => e.status === 'running')
  const scrollKey = `${commandLog.length}:${latestRunning?.narration?.length ?? 0}`

  // Auto-scroll to bottom when new entries arrive OR when streaming narration updates.
  // scrollKey is the intentional trigger — suppress exhaustive-deps for this pattern.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollKey is the intentional trigger
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [scrollKey])

  // Scroll to specific entry when activeCommandId changes (from Agent Log sidebar click)
  useEffect(() => {
    if (activeCommandId && threadRef.current) {
      const el = document.getElementById(`cmd-entry-${activeCommandId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeCommandId])

  // Cancel handler for the latest running command
  const handleCancel = useCallback(() => {
    if (!latestRunning) return
    useWorkspaceStore.getState().updateCommandLogEntry(latestRunning.id, { status: 'cancelled' })
  }, [latestRunning])

  // Collapsed: just the toggle button
  if (!responsePanelOpen) {
    return (
      <button
        type="button"
        className="cmd-response-toggle glass-soft"
        style={leftSidebarOpen ? { left: `${leftSidebarWidth + 16}px` } : undefined}
        onClick={toggleResponsePanel}
        title="Open command response panel"
      >
        <MessageCircle className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div
      className="cmd-response-panel glass-soft"
      style={leftSidebarOpen ? { left: `${leftSidebarWidth + 16}px` } : undefined}
    >
      {/* Header: toggle + cancel */}
      <div className="cmd-response-panel__header">
        <button
          type="button"
          className="cmd-response-panel__icon-btn"
          onClick={toggleResponsePanel}
          title="Close panel"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        {latestRunning && (
          <button
            type="button"
            className="cmd-response-panel__stop"
            onClick={handleCancel}
            title="Cancel"
          >
            <Square className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Threaded conversation — all commands stacked */}
      {commandLog.length > 0 ? (
        <div className="cmd-response-panel__thread" ref={threadRef}>
          {commandLog.map((entry) => (
            <div
              key={entry.id}
              className={`cmd-response-panel__entry ${entry.status === 'running' ? 'is-thinking' : ''}`}
            >
              {/* Prompt line with status icon + copy button */}
              <div className="cmd-response-panel__entry-prompt" id={`cmd-entry-${entry.id}`}>
                <StatusIcon status={entry.status} />
                <span
                  className="flex-1 truncate text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {entry.input}
                </span>
                <button
                  type="button"
                  className="cmd-response-panel__icon-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(entry.input)
                    toast.success('Prompt copied')
                  }}
                  title="Copy prompt"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              {/* Response body — only if narration exists */}
              {entry.narration && (
                <div className="cmd-response-panel__entry-response">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.narration}</ReactMarkdown>
                  </div>
                  {/* Affected node links */}
                  {entry.affectedNodeIds.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {entry.affectedNodeIds.map((nodeId) => {
                        const node = nodes.find((n) => n.id === nodeId)
                        if (!node) return null
                        return (
                          <button
                            type="button"
                            key={nodeId}
                            className="cmd-response-panel__node-link"
                            onClick={() => {
                              setSelectedNodes([nodeId])
                              requestFitView([nodeId], 0.3, 400)
                            }}
                          >
                            {/* biome-ignore lint/suspicious/noExplicitAny: node.data is untyped at this layer */}
                            {(node.data as any).title || 'Untitled'}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {/* Thinking indicator with elapsed timer for running entries */}
              {entry.status === 'running' && (
                <div className="cmd-response-panel__entry-thinking">
                  <div className="cmd-response-panel__thinking-dot" />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {entry.narration ? 'Working' : 'Generating'}...
                  </span>
                  <ElapsedTimer startTime={entry.timestamp} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="cmd-response-panel__empty">Run a command to see results here</div>
      )}
    </div>
  )
}

export const CommandResponsePanel = memo(CommandResponsePanelComponent)
