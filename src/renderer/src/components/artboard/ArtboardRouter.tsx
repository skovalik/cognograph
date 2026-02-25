/**
 * ArtboardRouter — Renders the correct artboard content for the expanded node.
 *
 * Reads `inPlaceExpandedNodeId` from workspaceStore. When a node is expanded
 * to ultra-close (L4) zoom, this component switches on the node type and
 * renders the appropriate artboard panels using NodeArtboard, ArtboardTabBar,
 * ArtboardSplitPane, and the type-specific panels.
 *
 * Sits OUTSIDE individual node components to avoid modifying all 10 node types.
 *
 * Phase 3B key integration file.
 *
 * NOTE: dangerouslySetInnerHTML is used intentionally to render app-generated
 * HTML content (from TipTap rich text editor). This matches the existing pattern
 * in TaskNode, NoteNode, etc. Content is user-authored within the app, not
 * from external/untrusted sources. Sanitization happens at the editor layer.
 */

import React, { memo, useState, useCallback, useMemo } from 'react'
import {
  MessageSquare,
  FolderKanban,
  StickyNote,
  CheckSquare,
  Code,
  Globe,
  FileText,
  Zap,
  Workflow,
  Play,
  Pause,
  Square,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type {
  NodeData,
  ConversationNodeData,
  ProjectNodeData,
  NoteNodeData,
  TaskNodeData,
  ArtifactNodeData,
  WorkspaceNodeData,
  TextNodeData,
  OrchestratorNodeData,
} from '@shared/types'
import type { ActionNodeData } from '@shared/actionTypes'
import type { Node } from '@xyflow/react'
import { NodeArtboard } from './NodeArtboard'
import { ArtboardTabBar } from './ArtboardTabBar'
import type { ArtboardTab } from './ArtboardTabBar'
import { ArtboardSplitPane } from './ArtboardSplitPane'
import { ContextTreePanel } from './ContextTreePanel'
import { MiniKanban } from './MiniKanban'
import { ExecutionLog } from './ExecutionLog'
import type { LogEntry } from './ExecutionLog'
import { PipelineDiagram } from './PipelineDiagram'
import type { PipelineAgent, AgentPipelineStatus } from './PipelineDiagram'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, React.ReactNode> = {
  conversation: <MessageSquare className="w-4 h-4" />,
  project: <FolderKanban className="w-4 h-4" />,
  note: <StickyNote className="w-4 h-4" />,
  task: <CheckSquare className="w-4 h-4" />,
  artifact: <Code className="w-4 h-4" />,
  workspace: <Globe className="w-4 h-4" />,
  text: <FileText className="w-4 h-4" />,
  action: <Zap className="w-4 h-4" />,
  orchestrator: <Workflow className="w-4 h-4" />,
}

// ---------------------------------------------------------------------------
// Placeholder: reusable "coming later" skeleton
// ---------------------------------------------------------------------------

function EditorPlaceholder({ label }: { label: string }): JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-2"
      role="status"
      aria-label={`${label} loading`}
    >
      <div
        className="w-3/4 h-4 rounded animate-pulse"
        style={{ backgroundColor: 'var(--surface-sunken, #0d0d1a)' }}
      />
      <div
        className="w-1/2 h-4 rounded animate-pulse"
        style={{ backgroundColor: 'var(--surface-sunken, #0d0d1a)' }}
      />
      <span className="text-[10px] mt-2" style={{ color: 'var(--text-muted, #666)' }}>
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Safe HTML renderer — wraps app-generated HTML for display.
// Content originates from TipTap editor (same pattern as TaskNode/NoteNode).
// ---------------------------------------------------------------------------

function SafeHtmlContent({ html, className }: { html: string; className?: string }): JSX.Element {
  // eslint-disable-next-line react/no-danger
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

// ---------------------------------------------------------------------------
// Per-type artboard renderers
// ---------------------------------------------------------------------------

// --- Conversation ---

const CONV_TABS: ArtboardTab[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'context', label: 'Context' },
  { id: 'settings', label: 'Settings' },
]

function ConversationArtboard({
  nodeId,
  nodeData,
  nodeColor,
}: {
  nodeId: string
  nodeData: ConversationNodeData
  nodeColor: string
}): JSX.Element {
  const [tab, setTab] = useState('chat')
  const messageCount = nodeData.messages.length
  const lastMessages = useMemo(
    () => nodeData.messages.slice(-20),
    [nodeData.messages],
  )

  return (
    <NodeArtboard
      nodeId={nodeId}
      nodeColor={nodeColor}
      title={nodeData.title || 'Untitled Conversation'}
      icon={TYPE_ICONS.conversation}
    >
      <ArtboardTabBar tabs={CONV_TABS} activeTabId={tab} onTabChange={setTab} accentColor={nodeColor} />
      <div className="flex-1 overflow-auto" role="tabpanel" aria-label={`${tab} tab`}>
        {tab === 'chat' && (
          <ArtboardSplitPane
            direction="horizontal"
            primaryRatio={65}
            accentColor={nodeColor}
            primary={
              <div className="p-3 space-y-2">
                {lastMessages.length === 0 && (
                  <div className="text-xs italic" style={{ color: 'var(--text-muted, #888)' }}>
                    No messages yet. Double-click the node to start chatting.
                  </div>
                )}
                {lastMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-xs p-2 rounded ${
                      msg.role === 'user' ? 'ml-4' : 'mr-4'
                    }`}
                    style={{
                      backgroundColor:
                        msg.role === 'user'
                          ? `${nodeColor}15`
                          : 'var(--surface-sunken, #0d0d1a)',
                    }}
                  >
                    <span className="font-semibold text-[10px] uppercase" style={{ color: 'var(--text-muted, #888)' }}>
                      {msg.role}
                    </span>
                    <p className="mt-0.5 line-clamp-4" style={{ color: 'var(--text-primary, #e0e0e0)' }}>
                      {msg.content.slice(0, 300)}
                      {msg.content.length > 300 ? '\u2026' : ''}
                    </p>
                  </div>
                ))}
                {messageCount > 20 && (
                  <div className="text-[10px] text-center" style={{ color: 'var(--text-muted, #888)' }}>
                    Showing last 20 of {messageCount} messages
                  </div>
                )}
              </div>
            }
            secondary={<ContextTreePanel nodeId={nodeId} />}
          />
        )}
        {tab === 'context' && <ContextTreePanel nodeId={nodeId} className="h-full" />}
        {tab === 'settings' && (
          <div className="p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Provider</span>
              <span className="capitalize">{nodeData.provider}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Mode</span>
              <span className="capitalize">{nodeData.mode || 'chat'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Messages</span>
              <span>{messageCount}</span>
            </div>
          </div>
        )}
      </div>
    </NodeArtboard>
  )
}

// --- Task ---

function TaskArtboard({
  nodeId,
  nodeData,
  nodeColor,
}: {
  nodeId: string
  nodeData: TaskNodeData
  nodeColor: string
}): JSX.Element {
  const progressPct = nodeData.status === 'done' ? 100 : nodeData.status === 'in-progress' ? 50 : 0

  return (
    <NodeArtboard
      nodeId={nodeId}
      nodeColor={nodeColor}
      title={nodeData.title || 'Untitled Task'}
      icon={TYPE_ICONS.task}
    >
      <div className="flex flex-col h-full">
        {/* Description area */}
        <div className="flex-1 overflow-auto p-3">
          {nodeData.description ? (
            <SafeHtmlContent
              html={nodeData.description}
              className="text-xs prose-sm"
            />
          ) : (
            <EditorPlaceholder label="Rich text editor loading..." />
          )}
        </div>

        {/* Metadata */}
        <div className="px-3 py-2 border-t text-xs space-y-1" style={{ borderColor: 'var(--border-subtle, #333)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary, #aaa)' }}>Status</span>
            <span className="capitalize">{nodeData.status}</span>
          </div>
          {nodeData.priority && nodeData.priority !== 'none' && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Priority</span>
              <span className="capitalize">{nodeData.priority}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1" style={{ backgroundColor: 'var(--surface-sunken, #0d0d1a)' }}>
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              backgroundColor: nodeColor,
            }}
          />
        </div>
      </div>
    </NodeArtboard>
  )
}

// --- Project ---

const PROJECT_TABS: ArtboardTab[] = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'list', label: 'List' },
  { id: 'timeline', label: 'Timeline' },
]

function ProjectArtboard({
  nodeId,
  nodeData,
  nodeColor,
}: {
  nodeId: string
  nodeData: ProjectNodeData
  nodeColor: string
}): JSX.Element {
  const [tab, setTab] = useState('kanban')
  const updateNode = useWorkspaceStore((s) => s.updateNode)

  const handleStatusChange = useCallback(
    (childId: string, newStatus: string) => {
      updateNode(childId, { status: newStatus })
    },
    [updateNode],
  )

  const childNodeIds = nodeData.childNodeIds ?? []
  const childSummaries = useWorkspaceStore(
    useCallback(
      (state: { nodes: Node<NodeData>[] }) =>
        childNodeIds.map((cid) => {
          const n = state.nodes.find((nd) => nd.id === cid)
          if (!n) return null
          const d = n.data as Record<string, unknown>
          return {
            id: cid,
            title: (d.title as string) || 'Untitled',
            type: d.type as string,
            status: (d.status as string) || '',
          }
        }).filter(Boolean) as Array<{ id: string; title: string; type: string; status: string }>,
      [childNodeIds],
    ),
  )

  return (
    <NodeArtboard
      nodeId={nodeId}
      nodeColor={nodeColor}
      title={nodeData.title || 'Untitled Project'}
      icon={TYPE_ICONS.project}
    >
      <ArtboardTabBar tabs={PROJECT_TABS} activeTabId={tab} onTabChange={setTab} accentColor={nodeColor} />
      <div className="flex-1 overflow-auto" role="tabpanel" aria-label={`${tab} tab`}>
        {tab === 'kanban' && (
          <MiniKanban
            childNodeIds={childNodeIds}
            onStatusChange={handleStatusChange}
            nodeColor={nodeColor}
            className="h-full"
          />
        )}
        {tab === 'list' && (
          <div className="p-2 space-y-0.5">
            {childSummaries.length === 0 && (
              <div className="text-xs text-center py-4" style={{ color: 'var(--text-muted, #888)' }}>
                No child nodes. Drag tasks into this project.
              </div>
            )}
            {childSummaries.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-white/5"
                style={{ borderLeft: `3px solid ${nodeColor}` }}
              >
                <span className="truncate flex-1" style={{ color: 'var(--text-primary, #e0e0e0)' }}>
                  {child.title}
                </span>
                <span className="text-[9px]" style={{ color: 'var(--text-muted, #888)' }}>
                  {child.type}
                </span>
                {child.status && (
                  <span className="text-[9px] capitalize" style={{ color: 'var(--text-secondary, #aaa)' }}>
                    {child.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {tab === 'timeline' && (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs" style={{ color: 'var(--text-muted, #888)' }}>
              Timeline view coming soon
            </span>
          </div>
        )}
      </div>
    </NodeArtboard>
  )
}

// --- Orchestrator ---

function OrchestratorArtboard({
  nodeId,
  nodeData,
  nodeColor,
}: {
  nodeId: string
  nodeData: OrchestratorNodeData
  nodeColor: string
}): JSX.Element {
  const agents: PipelineAgent[] = useMemo(
    () =>
      nodeData.connectedAgents.map((a) => {
        const statusMap: Record<string, AgentPipelineStatus> = {
          idle: 'pending',
          queued: 'pending',
          running: 'running',
          completed: 'complete',
          failed: 'error',
          skipped: 'pending',
          retrying: 'running',
        }
        return {
          id: a.nodeId,
          name: a.nodeId.slice(0, 8),
          status: statusMap[a.status] ?? 'pending',
        }
      }),
    [nodeData.connectedAgents],
  )

  const logEntries: LogEntry[] = useMemo(() => {
    const entries: LogEntry[] = []
    for (const run of nodeData.runHistory.slice(-5)) {
      entries.push({
        timestamp: run.startedAt,
        level: 'info',
        message: `Pipeline started (${run.agentResults.length} agents)`,
      })
      for (const result of run.agentResults) {
        entries.push({
          timestamp: result.startedAt,
          level: result.status === 'failed' ? 'error' : 'info',
          message: `Agent ${result.agentNodeId.slice(0, 8)} ${result.status}`,
          agentId: result.agentNodeId,
        })
      }
      entries.push({
        timestamp: run.completedAt ?? run.startedAt,
        level: run.status === 'failed' ? 'error' : run.status === 'completed' ? 'info' : 'warn',
        message: `Pipeline ${run.status} ($${run.totalCostUSD.toFixed(4)})`,
      })
    }
    return entries.sort((a, b) => a.timestamp - b.timestamp)
  }, [nodeData.runHistory])

  const headerRight = useMemo(
    () => (
      <div className="flex items-center gap-0.5">
        <button
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Start pipeline"
          onClick={() => {
            if (window.api?.orchestrator) {
              window.api.orchestrator.start(nodeId).catch(() => {})
            }
          }}
        >
          <Play className="w-3 h-3" style={{ color: '#22c55e' }} />
        </button>
        <button
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Pause pipeline"
          onClick={() => {
            if (window.api?.orchestrator) {
              window.api.orchestrator.pause(nodeId).catch(() => {})
            }
          }}
        >
          <Pause className="w-3 h-3" style={{ color: '#f59e0b' }} />
        </button>
        <button
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Stop pipeline"
          onClick={() => {
            if (window.api?.orchestrator) {
              window.api.orchestrator.abort(nodeId).catch(() => {})
            }
          }}
        >
          <Square className="w-3 h-3" style={{ color: '#ef4444' }} />
        </button>
      </div>
    ),
    [nodeId],
  )

  return (
    <NodeArtboard
      nodeId={nodeId}
      nodeColor={nodeColor}
      title={nodeData.title || 'Untitled Orchestrator'}
      icon={TYPE_ICONS.orchestrator}
      headerRight={headerRight}
    >
      <ArtboardSplitPane
        direction="vertical"
        primaryRatio={35}
        accentColor={nodeColor}
        primary={<PipelineDiagram agents={agents} className="h-full" />}
        secondary={<ExecutionLog entries={logEntries} className="h-full" />}
      />
    </NodeArtboard>
  )
}

// --- Note ---

function NoteArtboard({
  nodeId,
  nodeData,
  nodeColor,
}: {
  nodeId: string
  nodeData: NoteNodeData
  nodeColor: string
}): JSX.Element {
  const mode = nodeData.noteMode ?? 'general'

  if (mode === 'reference') {
    return (
      <NodeArtboard
        nodeId={nodeId}
        nodeColor={nodeColor}
        title={nodeData.title || 'Untitled Note'}
        icon={TYPE_ICONS.note}
      >
        <ArtboardSplitPane
          direction="horizontal"
          primaryRatio={55}
          accentColor={nodeColor}
          primary={
            <div className="p-3">
              <EditorPlaceholder label="Reference iframe loading..." />
            </div>
          }
          secondary={
            <div className="p-3">
              {nodeData.content ? (
                <SafeHtmlContent
                  html={nodeData.content}
                  className="text-xs"
                />
              ) : (
                <EditorPlaceholder label="Notes editor loading..." />
              )}
            </div>
          }
        />
      </NodeArtboard>
    )
  }

  if (mode === 'design-tokens') {
    return (
      <NodeArtboard
        nodeId={nodeId}
        nodeColor={nodeColor}
        title={nodeData.title || 'Design Tokens'}
        icon={TYPE_ICONS.note}
      >
        <div className="p-3 h-full">
          <EditorPlaceholder label="Token editor loading..." />
        </div>
      </NodeArtboard>
    )
  }

  return (
    <NodeArtboard
      nodeId={nodeId}
      nodeColor={nodeColor}
      title={nodeData.title || 'Untitled Note'}
      icon={TYPE_ICONS.note}
    >
      <div className="p-3 h-full overflow-auto">
        {nodeData.content ? (
          <SafeHtmlContent
            html={nodeData.content}
            className="text-xs prose-sm"
          />
        ) : (
          <EditorPlaceholder label="TipTap editor loading..." />
        )}
      </div>
    </NodeArtboard>
  )
}

// --- Artifact ---

const ARTIFACT_TABS: ArtboardTab[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'source', label: 'Source' },
  { id: 'diff', label: 'Diff' },
  { id: 'history', label: 'History' },
]

function ArtifactArtboard({
  nodeId,
  nodeData,
  nodeColor,
}: {
  nodeId: string
  nodeData: ArtifactNodeData
  nodeColor: string
}): JSX.Element {
  const [tab, setTab] = useState('preview')

  const previewContent = useMemo(() => {
    const ct = nodeData.contentType
    if (ct === 'code' || ct === 'json' || ct === 'csv') {
      return (
        <pre
          className="text-xs p-3 font-mono overflow-auto h-full"
          style={{
            backgroundColor: 'var(--surface-sunken, #0d0d1a)',
            color: 'var(--text-primary, #e0e0e0)',
          }}
        >
          {nodeData.content.slice(0, 2000)}
          {nodeData.content.length > 2000 ? '\n\n... (truncated)' : ''}
        </pre>
      )
    }
    if (ct === 'image') {
      return (
        <div className="flex items-center justify-center p-3 h-full">
          <img
            src={nodeData.content}
            alt={nodeData.title}
            className="max-w-full max-h-full object-contain rounded"
          />
        </div>
      )
    }
    if (ct === 'html' || ct === 'svg') {
      return (
        <div
          className="p-3 text-xs overflow-auto h-full"
          style={{
            backgroundColor: 'var(--surface-sunken, #0d0d1a)',
            color: 'var(--text-primary, #e0e0e0)',
          }}
        >
          <EditorPlaceholder label="Sandboxed HTML preview loading..." />
        </div>
      )
    }
    // markdown, text, mermaid, custom
    return (
      <div className="p-3 text-xs overflow-auto h-full whitespace-pre-wrap" style={{ color: 'var(--text-primary, #e0e0e0)' }}>
        {nodeData.content.slice(0, 2000)}
        {nodeData.content.length > 2000 ? '\n\n... (truncated)' : ''}
      </div>
    )
  }, [nodeData.content, nodeData.contentType, nodeData.title])

  return (
    <NodeArtboard
      nodeId={nodeId}
      nodeColor={nodeColor}
      title={nodeData.title || 'Untitled Artifact'}
      icon={TYPE_ICONS.artifact}
    >
      <ArtboardTabBar tabs={ARTIFACT_TABS} activeTabId={tab} onTabChange={setTab} accentColor={nodeColor} />
      <div className="flex-1 overflow-auto" role="tabpanel" aria-label={`${tab} tab`}>
        {tab === 'preview' && previewContent}
        {tab === 'source' && <EditorPlaceholder label="Monaco editor loading..." />}
        {tab === 'diff' && <EditorPlaceholder label="Diff view loading..." />}
        {tab === 'history' && (
          <div className="p-3 space-y-1 text-xs">
            <div className="text-[10px] uppercase font-medium" style={{ color: 'var(--text-muted, #888)' }}>
              Version {nodeData.version}
            </div>
            {nodeData.versionHistory?.slice(-10).reverse().map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1 rounded text-[10px]"
                style={{ backgroundColor: 'var(--surface-sunken, #0d0d1a)' }}
              >
                <span>v{v.version}</span>
                <span style={{ color: 'var(--text-muted, #888)' }}>
                  {new Date(v.timestamp).toLocaleString()}
                </span>
                <span className="capitalize" style={{ color: 'var(--text-secondary, #aaa)' }}>
                  {v.changeSource}
                </span>
              </div>
            ))}
            {!nodeData.versionHistory?.length && (
              <span style={{ color: 'var(--text-muted, #888)' }}>No version history</span>
            )}
          </div>
        )}
      </div>
    </NodeArtboard>
  )
}

// --- Action ---

function ActionArtboard({
  nodeId,
  nodeData,
  nodeColor,
}: {
  nodeId: string
  nodeData: ActionNodeData
  nodeColor: string
}): JSX.Element {
  return (
    <NodeArtboard
      nodeId={nodeId}
      nodeColor={nodeColor}
      title={nodeData.title || 'Untitled Action'}
      icon={TYPE_ICONS.action}
    >
      <div className="p-3 space-y-3 text-xs overflow-auto h-full">
        {/* Trigger config */}
        <section aria-label="Trigger configuration">
          <div className="text-[10px] uppercase font-semibold mb-1" style={{ color: 'var(--text-muted, #888)' }}>
            Trigger
          </div>
          <div
            className="px-2 py-1.5 rounded"
            style={{ backgroundColor: 'var(--surface-sunken, #0d0d1a)' }}
          >
            <span className="capitalize">{nodeData.trigger.type.replace(/-/g, ' ')}</span>
            {nodeData.trigger.config && Object.keys(nodeData.trigger.config).length > 0 && (
              <div className="mt-1 text-[9px]" style={{ color: 'var(--text-muted, #888)' }}>
                {JSON.stringify(nodeData.trigger.config, null, 0).slice(0, 100)}
              </div>
            )}
          </div>
        </section>

        {/* Action steps */}
        <section aria-label="Action steps">
          <div className="text-[10px] uppercase font-semibold mb-1" style={{ color: 'var(--text-muted, #888)' }}>
            Steps ({nodeData.steps.length})
          </div>
          <div className="space-y-1">
            {nodeData.steps.map((step, i) => (
              <div
                key={step.id}
                className="flex items-center gap-2 px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--surface-sunken, #0d0d1a)' }}
              >
                <span className="text-[9px] opacity-50">{i + 1}.</span>
                <span className="capitalize">{step.type.replace(/-/g, ' ')}</span>
              </div>
            ))}
            {nodeData.steps.length === 0 && (
              <span style={{ color: 'var(--text-muted, #888)' }}>No steps configured</span>
            )}
          </div>
        </section>

        {/* Execution history */}
        <section aria-label="Execution history">
          <div className="text-[10px] uppercase font-semibold mb-1" style={{ color: 'var(--text-muted, #888)' }}>
            Recent Executions
          </div>
          {nodeData.executionHistory.length > 0 ? (
            <div className="space-y-0.5">
              {nodeData.executionHistory.slice(-5).reverse().map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center gap-2 px-2 py-1 rounded text-[10px]"
                  style={{ backgroundColor: 'var(--surface-sunken, #0d0d1a)' }}
                >
                  <span style={{ color: 'var(--text-muted, #888)' }}>
                    {new Date(exec.timestamp).toLocaleString()}
                  </span>
                  <span
                    className="capitalize"
                    style={{
                      color:
                        exec.status === 'success'
                          ? '#10b981'
                          : exec.status === 'error'
                          ? '#ef4444'
                          : 'var(--text-secondary, #aaa)',
                    }}
                  >
                    {exec.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted, #888)' }}>No executions yet</span>
          )}
        </section>
      </div>
    </NodeArtboard>
  )
}

// --- Workspace ---

const WORKSPACE_TABS: ArtboardTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'llm', label: 'LLM Settings' },
  { id: 'context', label: 'Context Rules' },
  { id: 'members', label: 'Members' },
]

function WorkspaceArtboard({
  nodeId,
  nodeData,
  nodeColor,
}: {
  nodeId: string
  nodeData: WorkspaceNodeData
  nodeColor: string
}): JSX.Element {
  const [tab, setTab] = useState('overview')

  return (
    <NodeArtboard
      nodeId={nodeId}
      nodeColor={nodeColor}
      title={nodeData.title || 'Untitled Workspace'}
      icon={TYPE_ICONS.workspace}
    >
      <ArtboardTabBar tabs={WORKSPACE_TABS} activeTabId={tab} onTabChange={setTab} accentColor={nodeColor} />
      <div className="flex-1 overflow-auto p-3 text-xs space-y-2" role="tabpanel" aria-label={`${tab} tab`}>
        {tab === 'overview' && (
          <>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Description</span>
            </div>
            <p style={{ color: 'var(--text-primary, #e0e0e0)' }}>
              {nodeData.description || 'No description'}
            </p>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Members</span>
              <span>{nodeData.memberNodeIds?.length ?? 0}</span>
            </div>
          </>
        )}
        {tab === 'llm' && (
          <>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Provider</span>
              <span className="capitalize">{nodeData.llmSettings.provider}</span>
            </div>
            {nodeData.llmSettings.model && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary, #aaa)' }}>Model</span>
                <span>{nodeData.llmSettings.model}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Temperature</span>
              <span>{nodeData.llmSettings.temperature}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Max Tokens</span>
              <span>{nodeData.llmSettings.maxTokens}</span>
            </div>
          </>
        )}
        {tab === 'context' && (
          <>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Max Tokens</span>
              <span>{nodeData.contextRules.maxTokens}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Max Depth</span>
              <span>{nodeData.contextRules.maxDepth}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary, #aaa)' }}>Traversal</span>
              <span className="capitalize">{nodeData.contextRules.traversalMode}</span>
            </div>
          </>
        )}
        {tab === 'members' && (
          <div className="space-y-1">
            {(nodeData.memberNodeIds ?? []).length === 0 && (
              <span style={{ color: 'var(--text-muted, #888)' }}>No member nodes</span>
            )}
            {(nodeData.memberNodeIds ?? []).map((mid) => (
              <div
                key={mid}
                className="px-2 py-1 rounded text-[10px]"
                style={{ backgroundColor: 'var(--surface-sunken, #0d0d1a)' }}
              >
                {mid.slice(0, 12)}
              </div>
            ))}
          </div>
        )}
      </div>
    </NodeArtboard>
  )
}

// --- Text (chrome-free) ---

function TextArtboard({
  nodeId,
  nodeData,
  nodeColor,
}: {
  nodeId: string
  nodeData: TextNodeData
  nodeColor: string
}): JSX.Element {
  return (
    <div
      className="text-artboard h-full overflow-auto p-4"
      style={{
        background: 'var(--surface-panel, #1a1a2e)',
        color: 'var(--text-primary, #e0e0e0)',
      }}
      data-artboard-node={nodeId}
      role="region"
      aria-label={`Text editor for node ${nodeId}`}
    >
      {nodeData.content ? (
        <SafeHtmlContent
          html={nodeData.content}
          className="text-sm prose-sm"
        />
      ) : (
        <EditorPlaceholder label="Editor loading..." />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function ArtboardRouterComponent(): JSX.Element | null {
  const expandedNodeId = useWorkspaceStore((s) => s.inPlaceExpandedNodeId)

  const expandedNode = useWorkspaceStore(
    useCallback(
      (state: { nodes: Node<NodeData>[] }) => {
        if (!expandedNodeId) return null
        return state.nodes.find((n) => n.id === expandedNodeId) ?? null
      },
      [expandedNodeId],
    ),
  )

  const themeSettings = useWorkspaceStore((s) => s.themeSettings)

  if (!expandedNode || !expandedNodeId) return null

  const nodeData = expandedNode.data as NodeData
  const nodeType = nodeData.type

  const nodeColor =
    (nodeData as Record<string, unknown>).color as string | undefined ??
    (themeSettings.nodeColors as Record<string, string>)[nodeType] ??
    '#6366f1'

  switch (nodeType) {
    case 'conversation':
      return (
        <ConversationArtboard
          nodeId={expandedNodeId}
          nodeData={nodeData as ConversationNodeData}
          nodeColor={nodeColor}
        />
      )

    case 'task':
      return (
        <TaskArtboard
          nodeId={expandedNodeId}
          nodeData={nodeData as TaskNodeData}
          nodeColor={nodeColor}
        />
      )

    case 'project':
      return (
        <ProjectArtboard
          nodeId={expandedNodeId}
          nodeData={nodeData as ProjectNodeData}
          nodeColor={nodeColor}
        />
      )

    case 'orchestrator':
      return (
        <OrchestratorArtboard
          nodeId={expandedNodeId}
          nodeData={nodeData as OrchestratorNodeData}
          nodeColor={nodeColor}
        />
      )

    case 'note':
      return (
        <NoteArtboard
          nodeId={expandedNodeId}
          nodeData={nodeData as NoteNodeData}
          nodeColor={nodeColor}
        />
      )

    case 'artifact':
      return (
        <ArtifactArtboard
          nodeId={expandedNodeId}
          nodeData={nodeData as ArtifactNodeData}
          nodeColor={nodeColor}
        />
      )

    case 'action':
      return (
        <ActionArtboard
          nodeId={expandedNodeId}
          nodeData={nodeData as ActionNodeData}
          nodeColor={nodeColor}
        />
      )

    case 'workspace':
      return (
        <WorkspaceArtboard
          nodeId={expandedNodeId}
          nodeData={nodeData as WorkspaceNodeData}
          nodeColor={nodeColor}
        />
      )

    case 'text':
      return (
        <TextArtboard
          nodeId={expandedNodeId}
          nodeData={nodeData as TextNodeData}
          nodeColor={nodeColor}
        />
      )

    default:
      return (
        <NodeArtboard
          nodeId={expandedNodeId}
          nodeColor={nodeColor}
          title={(nodeData as Record<string, unknown>).title as string || 'Unknown'}
          icon={TYPE_ICONS[nodeType]}
        >
          <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text-muted, #888)' }}>
            No artboard view for type &ldquo;{nodeType}&rdquo;
          </div>
        </NodeArtboard>
      )
  }
}

export const ArtboardRouter = memo(ArtboardRouterComponent)
