/**
 * DispatchPanel — Claude Code Dispatch Queue UI
 *
 * Displays the dispatch queue with pending, acknowledged, and completed items.
 * Provides a "Compose dispatch" form for freeform instructions.
 * Shown alongside or within the ActivityFeedPanel.
 *
 * @module DispatchPanel
 */

import { memo, useState, useCallback, useMemo } from 'react'
import {
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Zap,
  Server,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  useCCBridgeStore,
  selectCCBridgeDispatches,
  selectCCBridgeDispatchServerPort,
} from '../stores/ccBridgeStore'
import type { CCDispatchMessage, CCDispatchPriority, CCDispatchType } from '@shared/bridge-types'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface DispatchPanelProps {
  sidebarWidth?: number
}

// -----------------------------------------------------------------------------
// Dispatch Item
// -----------------------------------------------------------------------------

interface DispatchItemProps {
  dispatch: CCDispatchMessage
  onCancel: (id: string) => void
}

const DispatchItem = memo(function DispatchItem({
  dispatch,
  onCancel,
}: DispatchItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = getStatusIcon(dispatch.status)
  const statusColor = getStatusColor(dispatch.status)
  const timeStr = formatTime(dispatch.createdAt)
  const updatedStr = dispatch.updatedAt !== dispatch.createdAt ? formatTime(dispatch.updatedAt) : null

  return (
    <div
      className="px-3 py-2 text-xs border-b border-[var(--border-subtle)] hover:bg-[var(--surface-panel-secondary)] transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className={statusColor}>{statusIcon}</span>
        <span className="flex-1 truncate font-medium gui-text" title={dispatch.content}>
          {dispatch.content.slice(0, 80)}
          {dispatch.content.length > 80 ? '...' : ''}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 rounded hover:bg-[var(--surface-hover)] gui-text-muted"
        >
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 mt-1 gui-text-muted">
        <span className="uppercase text-[10px] font-medium">{dispatch.type}</span>
        <span className="text-[10px]">{dispatch.priority}</span>
        <span className="flex-1" />
        <span className="tabular-nums text-[10px]">{timeStr}</span>
        {dispatch.status === 'pending' && (
          <button
            onClick={() => onCancel(dispatch.id)}
            className="p-0.5 rounded hover:bg-[var(--surface-hover)] text-red-400"
            title="Cancel dispatch"
          >
            <XCircle className="w-3 h-3" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] gui-text-secondary whitespace-pre-wrap break-words max-h-32 overflow-y-auto bg-[var(--surface-canvas)] rounded p-2">
            {dispatch.content}
          </div>
          {dispatch.filePaths && dispatch.filePaths.length > 0 && (
            <div className="text-[10px] gui-text-muted">
              <span className="font-medium">Files:</span>{' '}
              {dispatch.filePaths.join(', ')}
            </div>
          )}
          {dispatch.completionMessage && (
            <div className="text-[10px] text-green-400">
              <span className="font-medium">Result:</span> {dispatch.completionMessage}
            </div>
          )}
          {updatedStr && (
            <div className="text-[10px] gui-text-muted">
              Updated: {updatedStr}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// -----------------------------------------------------------------------------
// Compose Form
// -----------------------------------------------------------------------------

interface ComposeFormProps {
  onSubmit: (content: string, type: CCDispatchType, priority: CCDispatchPriority) => void
}

const ComposeForm = memo(function ComposeForm({ onSubmit }: ComposeFormProps): JSX.Element {
  const [content, setContent] = useState('')
  const [type, setType] = useState<CCDispatchType>('instruction')
  const [priority, setPriority] = useState<CCDispatchPriority>('normal')
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed) return
    onSubmit(trimmed, type, priority)
    setContent('')
    setIsOpen(false)
  }, [content, type, priority, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs gui-text-secondary hover:gui-text w-full hover:bg-[var(--surface-panel-secondary)] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Compose dispatch</span>
      </button>
    )
  }

  return (
    <div className="px-3 py-2 space-y-2 border-b border-[var(--border-subtle)]">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter instruction for Claude Code..."
        className="w-full h-20 text-xs bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded p-2 gui-text resize-none focus:outline-none focus:border-[var(--accent-primary)]"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CCDispatchType)}
          className="text-[10px] bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 gui-text"
        >
          <option value="instruction">Instruction</option>
          <option value="task">Task</option>
          <option value="context">Context</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as CCDispatchPriority)}
          className="text-[10px] bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 gui-text"
        >
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <span className="flex-1" />
        <button
          onClick={() => {
            setIsOpen(false)
            setContent('')
          }}
          className="text-[10px] px-2 py-0.5 rounded gui-text-muted hover:gui-text hover:bg-[var(--surface-hover)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent-primary)] text-white disabled:opacity-40 hover:opacity-90 flex items-center gap-1"
        >
          <Send className="w-3 h-3" />
          Send
        </button>
      </div>
      <div className="text-[10px] gui-text-muted">
        Ctrl+Enter to send
      </div>
    </div>
  )
})

// -----------------------------------------------------------------------------
// Main Panel
// -----------------------------------------------------------------------------

function DispatchPanelComponent({ sidebarWidth = 260 }: DispatchPanelProps): JSX.Element {
  const dispatches = useCCBridgeStore(selectCCBridgeDispatches)
  const serverPort = useCCBridgeStore(selectCCBridgeDispatchServerPort)
  const { addDispatch, removeDispatch } = useCCBridgeStore((s) => ({
    addDispatch: s.addDispatch,
    removeDispatch: s.removeDispatch,
  }))

  const isCompact = sidebarWidth < 220

  const pendingCount = useMemo(
    () => dispatches.filter((d) => d.status === 'pending').length,
    [dispatches]
  )
  const activeCount = useMemo(
    () => dispatches.filter((d) => d.status === 'acknowledged').length,
    [dispatches]
  )

  const handleCompose = useCallback(
    async (content: string, type: CCDispatchType, priority: CCDispatchPriority) => {
      const dispatch: CCDispatchMessage = {
        id: crypto.randomUUID(),
        type,
        priority,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'pending',
      }

      try {
        const result = await window.api.ccBridge.dispatchTask(dispatch)
        if (result.success && result.dispatch) {
          addDispatch(result.dispatch)
          toast.success('Dispatch queued for Claude Code')
        } else {
          toast.error(result.error || 'Failed to queue dispatch')
        }
      } catch (err) {
        toast.error('Failed to queue dispatch')
        console.error('[DispatchPanel] Queue error:', err)
      }
    },
    [addDispatch]
  )

  const handleCancel = useCallback(
    async (dispatchId: string) => {
      try {
        const result = await window.api.ccBridge.cancelDispatch(dispatchId)
        if (result.success) {
          removeDispatch(dispatchId)
          toast.success('Dispatch cancelled')
        } else {
          toast.error(result.error || 'Failed to cancel dispatch')
        }
      } catch (err) {
        toast.error('Failed to cancel dispatch')
        console.error('[DispatchPanel] Cancel error:', err)
      }
    },
    [removeDispatch]
  )

  const handleClearCompleted = useCallback(() => {
    const completed = dispatches.filter(
      (d) => d.status === 'completed' || d.status === 'failed' || d.status === 'timeout'
    )
    for (const d of completed) {
      removeDispatch(d.id)
    }
  }, [dispatches, removeDispatch])

  const handleStartServer = useCallback(async () => {
    try {
      const result = await window.api.ccBridge.startDispatchServer()
      if (result.success && result.port) {
        useCCBridgeStore.getState().setDispatchServerPort(result.port)
        toast.success(`Dispatch server started on port ${result.port}`)
      } else {
        toast.error(result.error || 'Failed to start dispatch server')
      }
    } catch (err) {
      toast.error('Failed to start dispatch server')
      console.error('[DispatchPanel] Server start error:', err)
    }
  }, [])

  const handleStopServer = useCallback(async () => {
    try {
      await window.api.ccBridge.stopDispatchServer()
      useCCBridgeStore.getState().setDispatchServerPort(null)
      toast.success('Dispatch server stopped')
    } catch (err) {
      toast.error('Failed to stop dispatch server')
      console.error('[DispatchPanel] Server stop error:', err)
    }
  }, [])

  // Sort: pending first, then acknowledged, then completed/failed
  const sortedDispatches = useMemo(() => {
    const statusOrder: Record<string, number> = {
      pending: 0,
      acknowledged: 1,
      completed: 2,
      failed: 3,
      timeout: 4,
    }
    return [...dispatches].sort(
      (a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
    )
  }, [dispatches])

  const hasCompleted = dispatches.some(
    (d) => d.status === 'completed' || d.status === 'failed' || d.status === 'timeout'
  )

  return (
    <div className="h-full flex flex-col glass-soft gui-panel">
      {/* Header */}
      <div className="px-3 py-2 border-b gui-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs gui-text-secondary">
            <Zap className="w-3.5 h-3.5" />
            <span>
              {pendingCount > 0 && `${pendingCount} pending`}
              {pendingCount > 0 && activeCount > 0 && ', '}
              {activeCount > 0 && `${activeCount} active`}
              {pendingCount === 0 && activeCount === 0 && (isCompact ? 'Queue' : 'Dispatch Queue')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Server status indicator */}
            <button
              onClick={serverPort ? handleStopServer : handleStartServer}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                serverPort
                  ? 'text-green-400 hover:text-red-400'
                  : 'gui-text-muted hover:gui-text'
              } hover:bg-[var(--surface-hover)]`}
              title={
                serverPort
                  ? `Server running on port ${serverPort} (click to stop)`
                  : 'Start dispatch server'
              }
            >
              <Server className="w-3 h-3" />
              {serverPort && !isCompact && <span>:{serverPort}</span>}
            </button>
            {/* Clear completed */}
            {hasCompleted && (
              <button
                onClick={handleClearCompleted}
                className="text-xs gui-text-secondary hover:text-red-400 p-1 rounded hover:bg-[var(--surface-hover)]"
                title="Clear completed dispatches"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compose Form */}
      <ComposeForm onSubmit={handleCompose} />

      {/* Dispatch List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {sortedDispatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs gui-text-muted px-4 text-center gap-2">
            <Send className="w-6 h-6 opacity-40" />
            <span>No dispatches queued</span>
            <span className="text-[10px] opacity-60">
              Compose a dispatch above or right-click a node and select &quot;Send to Claude
              Code&quot;
            </span>
          </div>
        ) : (
          sortedDispatches.map((dispatch) => (
            <DispatchItem key={dispatch.id} dispatch={dispatch} onCancel={handleCancel} />
          ))
        )}
      </div>
    </div>
  )
}

export const DispatchPanel = memo(DispatchPanelComponent)

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getStatusIcon(status: CCDispatchMessage['status']): JSX.Element {
  const cls = 'w-3.5 h-3.5'
  switch (status) {
    case 'pending':
      return <Clock className={cls} />
    case 'acknowledged':
      return <Loader2 className={`${cls} animate-spin`} />
    case 'completed':
      return <CheckCircle2 className={cls} />
    case 'failed':
    case 'timeout':
      return <XCircle className={cls} />
    default:
      return <Clock className={cls} />
  }
}

function getStatusColor(status: CCDispatchMessage['status']): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-400'
    case 'acknowledged':
      return 'text-blue-400'
    case 'completed':
      return 'text-green-400'
    case 'failed':
    case 'timeout':
      return 'text-red-400'
    default:
      return 'gui-text-muted'
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
