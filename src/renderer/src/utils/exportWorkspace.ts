/**
 * Workspace Export Utilities
 *
 * Formats workspace content for export as Markdown, HTML, or JSON.
 * Walks nodes depth-first by project hierarchy.
 */

import type { Node, Edge } from '@xyflow/react'
import type {
  NodeData,
  ConversationNodeData,
  NoteNodeData,
  TaskNodeData,
  ProjectNodeData,
  ArtifactNodeData,
  TextNodeData
} from '@shared/types'

export type ExportFormat = 'markdown' | 'html' | 'json'
export type ExportScope = 'all' | 'selected'

export interface ExportOptions {
  format: ExportFormat
  scope: ExportScope
  includeEdges: boolean
  workspaceName: string
}

// =============================================================================
// Markdown Export
// =============================================================================

function formatConversationMd(data: ConversationNodeData): string {
  const lines: string[] = []
  lines.push(`### ${data.title}`)
  lines.push(`*Conversation — ${data.provider}*\n`)

  if (data.messages.length === 0) {
    lines.push('*No messages yet*\n')
  } else {
    for (const msg of data.messages) {
      const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System'
      lines.push(`> **${role}:** ${(msg.content as string).replace(/\n/g, '\n> ')}\n`)
    }
  }

  return lines.join('\n')
}

function formatNoteMd(data: NoteNodeData): string {
  const lines: string[] = []
  lines.push(`### ${data.title}`)
  if (data.noteMode) lines.push(`*Note — ${data.noteMode} mode*\n`)
  else lines.push('')
  if (data.content) lines.push(data.content)
  lines.push('')
  return lines.join('\n')
}

function formatTaskMd(data: TaskNodeData): string {
  const checkbox = data.status === 'done' ? '[x]' : '[ ]'
  const priority = data.priority !== 'none' ? ` (${data.priority} priority)` : ''
  const lines: string[] = []
  lines.push(`- ${checkbox} **${data.title}**${priority}`)
  if (data.description) lines.push(`  ${data.description}`)
  lines.push('')
  return lines.join('\n')
}

function formatProjectMd(data: ProjectNodeData): string {
  const lines: string[] = []
  lines.push(`## ${data.title}`)
  if (data.description) lines.push(data.description)
  lines.push('')
  return lines.join('\n')
}

function formatArtifactMd(data: ArtifactNodeData): string {
  const lines: string[] = []
  lines.push(`### ${data.title}`)
  lines.push(`*Artifact — ${data.contentType}*\n`)

  if (data.content) {
    if (data.contentType === 'code' || data.contentType === 'html' || data.contentType === 'svg') {
      lines.push('```' + (data.contentType === 'code' ? '' : data.contentType))
      lines.push(data.content)
      lines.push('```')
    } else {
      lines.push(data.content)
    }
  }
  lines.push('')
  return lines.join('\n')
}

function formatTextMd(data: TextNodeData): string {
  return data.content ? `*${data.content}*\n` : ''
}

function formatNodeMd(data: NodeData): string {
  switch (data.type) {
    case 'conversation': return formatConversationMd(data as ConversationNodeData)
    case 'note': return formatNoteMd(data as NoteNodeData)
    case 'task': return formatTaskMd(data as TaskNodeData)
    case 'project': return formatProjectMd(data as ProjectNodeData)
    case 'artifact': return formatArtifactMd(data as ArtifactNodeData)
    case 'text': return formatTextMd(data as TextNodeData)
    case 'orchestrator': {
      const orchData = data as { title: string; strategy: string; connectedAgents: unknown[]; description?: string }
      return `### ${orchData.title}\n*Orchestrator — ${orchData.strategy} strategy, ${orchData.connectedAgents.length} agents*\n${orchData.description || ''}\n`
    }
    default: return `### ${data.title || 'Untitled'}\n*${data.type} node*\n`
  }
}

function formatEdgesMd(edges: Edge[], nodeMap: Map<string, Node<NodeData>>): string {
  if (edges.length === 0) return ''

  const lines: string[] = []
  lines.push('---\n')
  lines.push('## Connections\n')

  for (const edge of edges) {
    const source = nodeMap.get(edge.source)
    const target = nodeMap.get(edge.target)
    if (!source || !target) continue

    const sourceTitle = source.data.title || source.data.type
    const targetTitle = target.data.title || target.data.type
    const label = (edge.data as { label?: string })?.label

    lines.push(`- **${sourceTitle}** → **${targetTitle}**${label ? ` *(${label})*` : ''}`)
  }
  lines.push('')

  return lines.join('\n')
}

export function exportAsMarkdown(
  nodes: Node<NodeData>[],
  edges: Edge[],
  options: ExportOptions
): string {
  const lines: string[] = []
  lines.push(`# ${options.workspaceName}\n`)
  lines.push(`*Exported from Cognograph on ${new Date().toLocaleDateString()}*\n`)

  // Build parent→children map for project hierarchy
  const childMap = new Map<string, Node<NodeData>[]>()
  const rootNodes: Node<NodeData>[] = []
  const nodeMap = new Map<string, Node<NodeData>>()

  for (const node of nodes) {
    nodeMap.set(node.id, node)
    const parentId = node.data.parentId
    if (parentId && nodeMap.has(parentId)) {
      const children = childMap.get(parentId) || []
      children.push(node)
      childMap.set(parentId, children)
    } else {
      rootNodes.push(node)
    }
  }

  // Also collect children that reference parents via childNodeIds
  for (const node of nodes) {
    if (node.data.type === 'project') {
      const project = node.data as ProjectNodeData
      for (const childId of project.childNodeIds || []) {
        const child = nodeMap.get(childId)
        if (child && !rootNodes.includes(child)) {
          const children = childMap.get(node.id) || []
          if (!children.includes(child)) {
            children.push(child)
            childMap.set(node.id, children)
          }
        }
      }
    }
  }

  // Group by type for root-level nodes
  const projects = rootNodes.filter(n => n.data.type === 'project')
  const conversations = rootNodes.filter(n => n.data.type === 'conversation')
  const notes = rootNodes.filter(n => n.data.type === 'note')
  const tasks = rootNodes.filter(n => n.data.type === 'task')
  const others = rootNodes.filter(n =>
    !['project', 'conversation', 'note', 'task'].includes(n.data.type)
  )

  // Render projects with children
  for (const project of projects) {
    lines.push(formatNodeMd(project.data))
    const children = childMap.get(project.id) || []
    for (const child of children) {
      lines.push(formatNodeMd(child.data))
    }
  }

  // Render standalone conversations
  if (conversations.length > 0) {
    lines.push('## Conversations\n')
    for (const node of conversations) lines.push(formatNodeMd(node.data))
  }

  // Render standalone notes
  if (notes.length > 0) {
    lines.push('## Notes\n')
    for (const node of notes) lines.push(formatNodeMd(node.data))
  }

  // Render tasks as a checklist
  if (tasks.length > 0) {
    lines.push('## Tasks\n')
    for (const node of tasks) lines.push(formatNodeMd(node.data))
  }

  // Render other node types
  if (others.length > 0) {
    lines.push('## Other\n')
    for (const node of others) lines.push(formatNodeMd(node.data))
  }

  // Edges
  if (options.includeEdges) {
    lines.push(formatEdgesMd(edges, nodeMap))
  }

  return lines.join('\n')
}

// =============================================================================
// HTML Export
// =============================================================================

export function exportAsHtml(
  nodes: Node<NodeData>[],
  edges: Edge[],
  options: ExportOptions
): string {
  const markdown = exportAsMarkdown(nodes, edges, options)

  // Simple markdown-to-HTML conversion (no external dependency needed)
  let html = markdown
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Checkboxes
    .replace(/- \[x\] /g, '<li class="done">\u2611 ')
    .replace(/- \[ \] /g, '<li class="todo">\u2610 ')
    // List items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${options.workspaceName} — Cognograph Export</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #1e293b; line-height: 1.6; }
  h1 { border-bottom: 2px solid #6366f1; padding-bottom: 0.5rem; }
  h2 { color: #4338ca; margin-top: 2rem; }
  h3 { color: #6366f1; }
  blockquote { border-left: 3px solid #c7d2fe; padding-left: 1rem; margin: 0.5rem 0; color: #4b5563; }
  pre { background: #f1f5f9; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  code { font-family: 'Fira Code', monospace; font-size: 0.9em; }
  li { margin: 0.25rem 0; }
  li.done { color: #059669; }
  li.todo { color: #6b7280; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
  em { color: #6b7280; }
  .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 0.85rem; }
</style>
</head>
<body>
<p>${html}</p>
<div class="footer">Exported from <a href="https://cognograph.app">Cognograph</a> on ${new Date().toLocaleDateString()}</div>
</body>
</html>`
}

// =============================================================================
// JSON Export
// =============================================================================

export function exportAsJson(
  nodes: Node<NodeData>[],
  edges: Edge[],
  options: ExportOptions
): string {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    workspaceName: options.workspaceName,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.data.type,
      position: n.position,
      data: n.data
    })),
    edges: options.includeEdges ? edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: e.data
    })) : []
  }, null, 2)
}

// =============================================================================
// Main Export Function
// =============================================================================

export function exportWorkspace(
  nodes: Node<NodeData>[],
  edges: Edge[],
  options: ExportOptions
): string {
  switch (options.format) {
    case 'markdown': return exportAsMarkdown(nodes, edges, options)
    case 'html': return exportAsHtml(nodes, edges, options)
    case 'json': return exportAsJson(nodes, edges, options)
  }
}

/**
 * Get file extension for export format
 */
export function getExportExtension(format: ExportFormat): string {
  switch (format) {
    case 'markdown': return 'md'
    case 'html': return 'html'
    case 'json': return 'json'
  }
}

/**
 * Get MIME type for export format
 */
export function getExportMimeType(format: ExportFormat): string {
  switch (format) {
    case 'markdown': return 'text/markdown'
    case 'html': return 'text/html'
    case 'json': return 'application/json'
  }
}
