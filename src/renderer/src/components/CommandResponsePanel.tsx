// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useCallback, useEffect, useRef } from 'react'
import { MessageCircle, Copy, Check, Square, Loader2, AlertCircle, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useUIStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { toast } from 'react-hot-toast'
import { requestFitView } from '../utils/layoutEvents'
import type { CommandLogEntry } from '@shared/types'
import '../styles/command-response-panel.css'

// ── Status icon for agent log entries ──

function StatusIcon({ status }: { status: CommandLogEntry['status'] }): JSX.Element {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-glow)' }} />
    case 'done':
      return <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent-glow)' }} />
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
    case 'cancelled':
      return <Square className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
  }
}


// ── Agent Log — collapsible navigation index at bottom of panel ──

function AgentLog(): JSX.Element {
  const agentLogExpanded = useUIStore(s => s.agentLogExpanded)
  const setAgentLogExpanded = useUIStore(s => s.setAgentLogExpanded)
  const setActiveCommandId = useUIStore(s => s.setActiveCommandId)
  const activeCommandId = useUIStore(s => s.activeCommandId)
  const commandLog = useWorkspaceStore(s => s.commandLog)

  if (commandLog.length === 0) return <></>

  return (
    <div className="cmd-response-panel__log">
      <button
        className="cmd-response-panel__log-toggle"
        onClick={() => setAgentLogExpanded(!agentLogExpanded)}
      >
        <Zap className="w-3.5 h-3.5" />
        Agent log
        {agentLogExpanded
          ? <ChevronUp className="w-3.5 h-3.5" style={{ marginLeft: 'auto' }} />
          : <ChevronDown className="w-3.5 h-3.5" style={{ marginLeft: 'auto' }} />
        }
      </button>
      {agentLogExpanded && (
        <div className="cmd-response-panel__log-list">
          {commandLog.slice().reverse().map(entry => (
            <button
              key={entry.id}
              className={`cmd-response-panel__log-entry ${entry.id === activeCommandId ? 'cmd-response-panel__log-entry--active' : ''}`}
              onClick={() => setActiveCommandId(entry.id)}
            >
              <StatusIcon status={entry.status} />
              <span>{entry.input}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ──

function CommandResponsePanelComponent(): JSX.Element {
  const responsePanelOpen = useUIStore(s => s.responsePanelOpen)
  const toggleResponsePanel = useUIStore(s => s.toggleResponsePanel)
  const commandLog = useWorkspaceStore(s => s.commandLog)
  const leftSidebarOpen = useWorkspaceStore(s => s.leftSidebarOpen)
  const leftSidebarWidth = useWorkspaceStore(s => s.leftSidebarWidth)
  const nodes = useWorkspaceStore(s => s.nodes)
  const setSelectedNodes = useWorkspaceStore(s => s.setSelectedNodes)
  const threadRef = useRef<HTMLDivElement>(null)
  const activeCommandId = useUIStore(s => s.activeCommandId)

  // Auto-scroll to bottom when NEW entries arrive (not on streaming updates)
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [commandLog.length])

  // Scroll to specific entry when activeCommandId changes (from Agent Log sidebar click)
  useEffect(() => {
    if (activeCommandId && threadRef.current) {
      const el = document.getElementById(`cmd-entry-${activeCommandId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeCommandId])

  // Cancel handler for the latest running command
  const runningEntry = commandLog.find(e => e.status === 'running')

  const handleCancel = useCallback(() => {
    if (!runningEntry) return
    useWorkspaceStore.getState().updateCommandLogEntry(runningEntry.id, { status: 'cancelled' })
  }, [runningEntry])

  // Collapsed: just the toggle button
  if (!responsePanelOpen) {
    return (
      <button
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
          className="cmd-response-panel__icon-btn"
          onClick={toggleResponsePanel}
          title="Close panel"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        {runningEntry && (
          <button className="cmd-response-panel__stop" onClick={handleCancel} title="Cancel">
            <Square className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Threaded conversation — all commands stacked */}
      {commandLog.length > 0 ? (
        <div className="cmd-response-panel__thread" ref={threadRef}>
          {commandLog.map(entry => (
            <div key={entry.id} className={`cmd-response-panel__entry ${entry.status === 'running' ? 'is-thinking' : ''}`}>
              {/* Prompt line with status icon + copy button */}
              <div className="cmd-response-panel__entry-prompt" id={`cmd-entry-${entry.id}`}>
                <StatusIcon status={entry.status} />
                <span className="flex-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {entry.input}
                </span>
                <button
                  className="cmd-response-panel__icon-btn"
                  onClick={() => { navigator.clipboard.writeText(entry.input); toast.success('Prompt copied') }}
                  title="Copy prompt"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              {/* Response body — only if narration exists */}
              {entry.narration && (
                <div className="cmd-response-panel__entry-response">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {entry.narration}
                    </ReactMarkdown>
                  </div>
                  {/* Affected node links */}
                  {entry.affectedNodeIds.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {entry.affectedNodeIds.map(nodeId => {
                        const node = nodes.find(n => n.id === nodeId)
                        if (!node) return null
                        return (
                          <button
                            key={nodeId}
                            className="cmd-response-panel__node-link"
                            onClick={() => { setSelectedNodes([nodeId]); requestFitView([nodeId], 0.3, 400) }}
                          >
                            {(node.data as any).title || 'Untitled'}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {/* Thinking indicator for running entries */}
              {entry.status === 'running' && !entry.narration && (
                <div className="cmd-response-panel__entry-thinking">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-glow)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Processing...</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="cmd-response-panel__empty">
          Run a command to see results here
        </div>
      )}

      {/* Agent log — compact navigation index at bottom */}
      <AgentLog />
    </div>
  )
}

export const CommandResponsePanel = memo(CommandResponsePanelComponent)
