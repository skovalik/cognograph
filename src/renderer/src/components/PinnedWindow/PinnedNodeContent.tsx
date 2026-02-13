/**
 * Pinned Node Content
 *
 * Renders appropriate content for a pinned node based on its type.
 * Reuses existing content components (RichTextEditor, EditableText).
 */

import { memo } from 'react'
import type { Node } from '@xyflow/react'
import type { NodeData, NoteNodeData, TaskNodeData, TextNodeData, ConversationNodeData, ProjectNodeData, ArtifactNodeData } from '@shared/types'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { RichTextEditor } from '../RichTextEditor'
import { EditableText } from '../EditableText'

interface PinnedNodeContentProps {
  node: Node<NodeData>
}

function PinnedNodeContentComponent({ node }: PinnedNodeContentProps): JSX.Element {
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  switch (node.data.type) {
    case 'note': {
      const noteData = node.data as NoteNodeData
      return (
        <div className="flex flex-col gap-2 h-full">
          <RichTextEditor
            value={noteData.content || ''}
            onChange={(html) => updateNode(node.id, { content: html })}
            placeholder="Add note content..."
            enableLists={true}
            enableFormatting={true}
            enableHeadings={false}
            showToolbar="on-focus"
            minHeight={80}
          />
        </div>
      )
    }

    case 'task': {
      const taskData = node.data as TaskNodeData
      return (
        <div className="flex flex-col gap-2 h-full">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="px-1.5 py-0.5 rounded bg-[var(--surface-panel)]/50 capitalize">{taskData.status || 'todo'}</span>
            {taskData.priority && taskData.priority !== 'none' && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--surface-panel)]/50 capitalize">{taskData.priority}</span>
            )}
          </div>
          <RichTextEditor
            value={taskData.description || ''}
            onChange={(html) => updateNode(node.id, { description: html })}
            placeholder="Add description..."
            enableLists={true}
            enableFormatting={true}
            enableHeadings={false}
            showToolbar="on-focus"
            minHeight={60}
          />
        </div>
      )
    }

    case 'conversation': {
      const convData = node.data as ConversationNodeData
      const messages = convData.messages || []
      const lastFew = messages.slice(-5)
      return (
        <div className="flex flex-col gap-2 h-full overflow-auto text-sm">
          {lastFew.length === 0 ? (
            <p className="italic text-[var(--text-muted)]">No messages yet</p>
          ) : (
            lastFew.map((msg, i) => (
              <div key={i} className={`px-2 py-1.5 rounded ${msg.role === 'user' ? 'bg-blue-500/10 ml-4' : 'bg-[var(--surface-panel)]/30 mr-4'}`}>
                <span className="text-[10px] text-[var(--text-muted)] uppercase">{msg.role}</span>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-4 whitespace-pre-wrap">
                  {typeof msg.content === 'string' ? msg.content.slice(0, 500) : ''}
                </p>
              </div>
            ))
          )}
        </div>
      )
    }

    case 'project': {
      const projectData = node.data as ProjectNodeData
      return (
        <div className="flex flex-col gap-2 h-full">
          <EditableText
            value={projectData.description || ''}
            onChange={(newDescription) => updateNode(node.id, { description: newDescription })}
            placeholder="Add description..."
            className="text-sm"
          />
          {projectData.childNodeIds && projectData.childNodeIds.length > 0 && (
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {projectData.childNodeIds.length} child node{projectData.childNodeIds.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )
    }

    case 'artifact': {
      const artifactData = node.data as ArtifactNodeData
      const content = artifactData.content || ''
      return (
        <div className="flex flex-col gap-1 h-full overflow-auto">
          {artifactData.contentType === 'image' && content ? (
            <img
              src={content}
              alt={artifactData.title}
              className="max-w-full rounded object-contain"
            />
          ) : (
            <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono bg-[var(--surface-panel)]/50 p-2 rounded overflow-auto flex-1">
              {content.slice(0, 2000)}
              {content.length > 2000 && '\n...'}
            </pre>
          )}
        </div>
      )
    }

    case 'text': {
      const textData = node.data as TextNodeData
      return (
        <div className="flex flex-col gap-2 h-full">
          <RichTextEditor
            value={textData.content || ''}
            onChange={(html) => updateNode(node.id, { content: html })}
            placeholder="Type here..."
            enableLists={true}
            enableFormatting={true}
            enableHeadings={true}
            showToolbar="on-focus"
            minHeight={60}
          />
        </div>
      )
    }

    case 'orchestrator': {
      const orchData = node.data as { title: string; strategy: string; connectedAgents: unknown[]; description?: string }
      return (
        <div className="flex flex-col gap-2 h-full">
          <div className="text-xs text-[var(--text-secondary)]">
            Strategy: {orchData.strategy} | Agents: {orchData.connectedAgents.length}
          </div>
          {orchData.description && (
            <div className="text-sm text-[var(--text-primary)]">{orchData.description}</div>
          )}
        </div>
      )
    }

    default:
      return (
        <div className="text-sm text-[var(--text-muted)] italic">
          Content preview not available for this node type
        </div>
      )
  }
}

export const PinnedNodeContent = memo(PinnedNodeContentComponent)
