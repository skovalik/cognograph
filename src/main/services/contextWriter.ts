/**
 * contextWriter.ts -- Main-process BFS context builder for embedded CLI sessions.
 *
 * When a terminal is spawned for a node, this service:
 * 1. Performs BFS traversal on inbound edges (+ bidirectional) from the node
 * 2. Generates a markdown context file at `.cognograph-activity/context-{nodeId}.md`
 * 3. Returns the context string for MCP tool consumption
 */

import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextEntry {
  nodeId: string
  nodeType: string
  title: string
  content: string
  edgeRole: string
  depth: number
  tokenEstimate: number
}

export interface GeneratedContext {
  entries: ContextEntry[]
  markdown: string
  filePath: string
  totalTokens: number
}

/** Minimal node shape for BFS traversal (matches workspace JSON / MCP provider shapes) */
interface WorkspaceNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

/** Minimal edge shape for BFS traversal */
interface WorkspaceEdge {
  id: string
  source: string
  target: string
  data?: Record<string, unknown>
}

/** Workspace data shape (subset of WorkspaceData) */
interface WorkspaceSnapshot {
  nodes: WorkspaceNode[]
  edges: WorkspaceEdge[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BFS_DEPTH = 3
const CONTENT_SUMMARY_LENGTH = 500
const ACTIVITY_DIR_NAME = '.cognograph-activity'

// ---------------------------------------------------------------------------
// Workspace Data Access
// ---------------------------------------------------------------------------

/**
 * Resolve workspace data from the most recently saved workspace file.
 *
 * The main process does not have a Zustand store -- workspace data lives in
 * JSON files under `{userData}/workspaces/`. We read the last active workspace
 * by checking `settings.json -> lastWorkspaceId` and then loading the
 * corresponding file.
 *
 * This is the same data the MCP FileSyncProvider would read, but we avoid
 * importing it directly so contextWriter stays independent and testable.
 */
async function loadCurrentWorkspaceSnapshot(): Promise<WorkspaceSnapshot | null> {
  try {
    const userDataPath = app.getPath('userData')
    const settingsPath = join(userDataPath, 'settings.json')
    const settingsContent = await fs.readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(settingsContent) as { lastWorkspaceId?: string }

    if (!settings.lastWorkspaceId) return null

    const workspacePath = join(userDataPath, 'workspaces', `${settings.lastWorkspaceId}.json`)
    const workspaceContent = await fs.readFile(workspacePath, 'utf-8')
    const workspace = JSON.parse(workspaceContent) as WorkspaceSnapshot

    return {
      nodes: workspace.nodes ?? [],
      edges: workspace.edges ?? []
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Content Extraction
// ---------------------------------------------------------------------------

/**
 * Extract a content summary from a node based on its type.
 * Returns the first CONTENT_SUMMARY_LENGTH characters of the most relevant text field.
 */
function extractContentSummary(node: WorkspaceNode): string {
  const data = node.data
  const nodeType = (data.type as string) || node.type || 'unknown'

  let raw = ''

  switch (nodeType) {
    case 'conversation': {
      const messages = data.messages as Array<{ role?: string; content?: string }> | undefined
      if (messages && messages.length > 0) {
        // Take last few messages as context summary
        const recent = messages.slice(-3)
        raw = recent.map(m => `[${m.role ?? 'unknown'}]: ${m.content ?? ''}`).join('\n')
      }
      break
    }
    case 'note':
    case 'text':
    case 'artifact':
      raw = (data.content as string) ?? ''
      break
    case 'task':
      raw = (data.description as string) ?? ''
      break
    case 'project':
      raw = (data.description as string) ?? ''
      break
    case 'orchestrator':
      raw = (data.description as string) ?? ''
      break
    default:
      raw = (data.content as string) ?? (data.description as string) ?? ''
  }

  if (raw.length > CONTENT_SUMMARY_LENGTH) {
    return raw.slice(0, CONTENT_SUMMARY_LENGTH) + '...'
  }

  return raw
}

/**
 * Extract the title from a node. Checks data.title, data.label, then falls
 * back to a type-based default.
 */
function extractTitle(node: WorkspaceNode): string {
  return (
    (node.data.title as string) ||
    (node.data.label as string) ||
    `Untitled ${(node.data.type as string) || node.type || 'node'}`
  )
}

/**
 * Estimate tokens for a string. Rough heuristic: 4 characters = 1 token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ---------------------------------------------------------------------------
// BFS Traversal
// ---------------------------------------------------------------------------

/**
 * BFS-traverse inbound edges (+ bidirectional) from a starting node.
 *
 * - Follows edges where `edge.target === currentNodeId` (inbound).
 * - Also follows edges where `edge.source === currentNodeId` AND edge is
 *   bidirectional (`edge.data?.bidirectional === true` or
 *   `edge.data?.direction === 'bidirectional'`).
 * - Stops at MAX_BFS_DEPTH (3).
 * - Skips inactive edges (`edge.data?.active === false`).
 */
export function bfsTraverse(
  startNodeId: string,
  nodes: WorkspaceNode[],
  edges: WorkspaceEdge[],
  maxDepth: number = MAX_BFS_DEPTH
): ContextEntry[] {
  const nodeMap = new Map<string, WorkspaceNode>()
  for (const n of nodes) {
    nodeMap.set(n.id, n)
  }

  const visited = new Set<string>([startNodeId])
  const result: ContextEntry[] = []

  let frontier: Array<{ nodeId: string; depth: number }> = [
    { nodeId: startNodeId, depth: 0 }
  ]

  while (frontier.length > 0) {
    const nextFrontier: Array<{ nodeId: string; depth: number }> = []

    for (const { nodeId, depth } of frontier) {
      if (depth >= maxDepth) continue

      // --- Inbound edges: edge.target === current node ---
      for (const edge of edges) {
        if (edge.target !== nodeId) continue
        if (visited.has(edge.source)) continue
        if (edge.data?.active === false) continue

        visited.add(edge.source)
        const sourceNode = nodeMap.get(edge.source)
        if (!sourceNode) continue

        const content = extractContentSummary(sourceNode)
        const edgeRole = (edge.data?.contextRole as string) || 'provides-context'

        result.push({
          nodeId: sourceNode.id,
          nodeType: (sourceNode.data.type as string) || sourceNode.type || 'unknown',
          title: extractTitle(sourceNode),
          content,
          edgeRole,
          depth: depth + 1,
          tokenEstimate: estimateTokens(content)
        })

        nextFrontier.push({ nodeId: edge.source, depth: depth + 1 })
      }

      // --- Bidirectional outbound edges: edge.source === current node ---
      for (const edge of edges) {
        if (edge.source !== nodeId) continue
        if (visited.has(edge.target)) continue
        if (edge.data?.active === false) continue

        // Only follow if bidirectional
        const isBidi =
          edge.data?.bidirectional === true ||
          edge.data?.direction === 'bidirectional'
        if (!isBidi) continue

        visited.add(edge.target)
        const targetNode = nodeMap.get(edge.target)
        if (!targetNode) continue

        const content = extractContentSummary(targetNode)
        const edgeRole = (edge.data?.contextRole as string) || 'provides-context'

        result.push({
          nodeId: targetNode.id,
          nodeType: (targetNode.data.type as string) || targetNode.type || 'unknown',
          title: extractTitle(targetNode),
          content,
          edgeRole,
          depth: depth + 1,
          tokenEstimate: estimateTokens(content)
        })

        nextFrontier.push({ nodeId: edge.target, depth: depth + 1 })
      }
    }

    frontier = nextFrontier
  }

  return result
}

// ---------------------------------------------------------------------------
// Markdown Generation
// ---------------------------------------------------------------------------

/**
 * Generate markdown from context entries and a root node title.
 */
export function generateMarkdown(rootTitle: string, entries: ContextEntry[]): string {
  const lines: string[] = []

  lines.push(`# Canvas Context for: ${rootTitle}`)
  lines.push('')
  lines.push(`## Connected Nodes (${entries.length})`)
  lines.push('')

  for (const entry of entries) {
    lines.push(`### [${entry.nodeType}] ${entry.title} (depth: ${entry.depth}, role: ${entry.edgeRole})`)
    if (entry.content) {
      lines.push(entry.content)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  if (entries.length === 0) {
    lines.push('_No connected nodes found._')
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build context for a node by BFS-traversing its inbound edges.
 * Reads workspace data from the last-saved workspace file.
 *
 * Can also accept a pre-loaded workspace snapshot for testability.
 */
export async function buildContextForNode(
  nodeId: string,
  workspaceOverride?: WorkspaceSnapshot | null
): Promise<GeneratedContext> {
  const workspace = workspaceOverride ?? (await loadCurrentWorkspaceSnapshot())

  const emptyResult: GeneratedContext = {
    entries: [],
    markdown: '',
    filePath: getContextFilePath(nodeId),
    totalTokens: 0
  }

  if (!workspace) {
    emptyResult.markdown = generateMarkdown('Unknown Node', [])
    return emptyResult
  }

  const rootNode = workspace.nodes.find(n => n.id === nodeId)
  const rootTitle = rootNode ? extractTitle(rootNode) : 'Unknown Node'

  const entries = bfsTraverse(nodeId, workspace.nodes, workspace.edges)
  const markdown = generateMarkdown(rootTitle, entries)
  const totalTokens = entries.reduce((sum, e) => sum + e.tokenEstimate, 0)

  return {
    entries,
    markdown,
    filePath: getContextFilePath(nodeId),
    totalTokens
  }
}

/**
 * Write context to `.cognograph-activity/context-{nodeId}.md` file.
 * Creates the directory if it doesn't exist.
 * Returns the absolute file path.
 */
export async function writeContextFile(context: GeneratedContext): Promise<string> {
  const dir = getActivityDir()

  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(context.filePath, context.markdown, 'utf-8')

  return context.filePath
}

// ---------------------------------------------------------------------------
// Path Helpers
// ---------------------------------------------------------------------------

function getActivityDir(): string {
  return join(app.getPath('userData'), ACTIVITY_DIR_NAME)
}

export function getContextFilePath(nodeId: string): string {
  // Sanitize nodeId to prevent path traversal
  const safeId = nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(getActivityDir(), `context-${safeId}.md`)
}
