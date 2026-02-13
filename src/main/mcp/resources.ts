// Resource handlers - Phase 14
// Provides read-only MCP resource access to workspace data via provider

import type { MCPSyncProvider, WorkspaceNode } from './provider'

export interface MCPResource {
  uri: string
  name: string
  description: string
  mimeType: string
}

/**
 * List available resources from the workspace.
 */
export function getResourceList(provider: MCPSyncProvider): MCPResource[] {
  const nodes = provider.getNodes()
  const edges = provider.getEdges()

  const resources: MCPResource[] = [
    {
      uri: 'cognograph://workspace',
      name: 'Workspace Overview',
      description: `Workspace: ${provider.getWorkspaceName()}`,
      mimeType: 'application/json'
    },
    {
      uri: 'cognograph://todos',
      name: 'All Tasks',
      description: `Task nodes in workspace`,
      mimeType: 'application/json'
    },
    {
      uri: 'cognograph://notes',
      name: 'All Notes',
      description: `Note nodes in workspace`,
      mimeType: 'application/json'
    },
    {
      uri: 'cognograph://projects',
      name: 'All Projects',
      description: `Project nodes in workspace`,
      mimeType: 'application/json'
    },
    {
      uri: 'cognograph://nodes',
      name: 'All Nodes',
      description: `${nodes.length} nodes in workspace`,
      mimeType: 'application/json'
    },
    {
      uri: 'cognograph://edges',
      name: 'All Edges',
      description: `${edges.length} connections`,
      mimeType: 'application/json'
    }
  ]

  return resources
}

/**
 * Read a resource by URI.
 */
export function handleResourceRead(provider: MCPSyncProvider, uri: string): string {
  const nodes = provider.getNodes()
  const edges = provider.getEdges()

  // Workspace overview
  if (uri === 'cognograph://workspace') {
    return JSON.stringify(
      {
        id: provider.getWorkspaceId(),
        name: provider.getWorkspaceName(),
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodeTypes: countNodeTypes(nodes)
      },
      null,
      2
    )
  }

  // Todos (task nodes)
  if (uri === 'cognograph://todos') {
    const tasks = nodes.filter((n) => n.data.type === 'task')
    return JSON.stringify(
      tasks.map(summarizeNode),
      null,
      2
    )
  }

  // Notes
  if (uri === 'cognograph://notes') {
    const notes = nodes.filter((n) => n.data.type === 'note')
    return JSON.stringify(
      notes.map(summarizeNode),
      null,
      2
    )
  }

  // Projects
  if (uri === 'cognograph://projects') {
    const projects = nodes.filter((n) => n.data.type === 'project')
    return JSON.stringify(
      projects.map(summarizeNode),
      null,
      2
    )
  }

  // All nodes
  if (uri === 'cognograph://nodes') {
    return JSON.stringify(
      nodes.map(summarizeNode),
      null,
      2
    )
  }

  // All edges
  if (uri === 'cognograph://edges') {
    return JSON.stringify(
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.data?.label,
        weight: e.data?.weight,
        direction: e.data?.direction,
        active: e.data?.active
      })),
      null,
      2
    )
  }

  // Individual node by ID
  const nodeMatch = uri.match(/^cognograph:\/\/node\/(.+)$/)
  if (nodeMatch && nodeMatch[1]) {
    const node = provider.getNode(nodeMatch[1])
    if (!node) throw new Error(`Node not found: ${nodeMatch[1]}`)

    return JSON.stringify(
      {
        id: node.id,
        type: node.data.type,
        position: node.position,
        data: node.data,
        connectedEdges: edges
          .filter((e) => e.source === node.id || e.target === node.id)
          .map((e) => ({ id: e.id, source: e.source, target: e.target }))
      },
      null,
      2
    )
  }

  throw new Error(`Unknown resource: ${uri}`)
}

// --- Helpers ---

function countNodeTypes(nodes: WorkspaceNode[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const n of nodes) {
    const t = (n.data.type as string) || 'unknown'
    counts[t] = (counts[t] || 0) + 1
  }
  return counts
}

function summarizeNode(node: WorkspaceNode): Record<string, unknown> {
  const data = node.data
  const summary: Record<string, unknown> = {
    id: node.id,
    type: data.type,
    title: data.title || undefined,
    position: node.position
  }

  if (data.type === 'task') {
    summary.status = data.status
    summary.priority = data.priority
  }
  if (data.type === 'note' && data.content) {
    summary.contentPreview = (data.content as string).slice(0, 100)
  }
  if (data.tags && (data.tags as string[]).length > 0) {
    summary.tags = data.tags
  }

  return summary
}
