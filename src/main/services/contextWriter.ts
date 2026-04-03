// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * contextWriter.ts -- Main-process BFS context builder for embedded CLI sessions.
 *
 * When a terminal is spawned for a node, this service:
 * 1. Performs BFS traversal on inbound edges (+ bidirectional) from the node
 * 2. Generates a markdown context file at `.cognograph-activity/context-{nodeId}.md`
 * 3. Returns the context string for MCP tool consumption
 */

import { join } from 'path'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { sanitizeForContext } from '@shared/utils/sanitizeContext'

// Safe Electron app import — falls back to homedir when running outside Electron (MCP CLI)
let electronApp: { getPath: (name: string) => string } | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
  if (!electronApp?.getPath) electronApp = null
} catch {
  // Not in Electron — use fallback paths
}

export function getAppPath(name: string): string {
  if (electronApp) return electronApp.getPath(name)
  // Fallback for standalone Node.js (MCP CLI)
  if (name === 'userData') return join(homedir(), '.cognograph')
  return homedir()
}

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
// Simple String Hash (FNV-1a 32-bit — non-crypto, fast)
// ---------------------------------------------------------------------------

/**
 * FNV-1a 32-bit hash. Returns a 32-bit unsigned integer.
 * Used for cache keys and content hashing — NOT for security.
 */
export function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) // FNV prime
  }
  return hash >>> 0 // ensure unsigned
}

// ---------------------------------------------------------------------------
// Adjacency Index — O(1) neighbor lookups
// ---------------------------------------------------------------------------

interface AdjacencyEntry {
  /** Edges where this node is the target (inbound) */
  inbound: WorkspaceEdge[]
  /** Edges where this node is the source (outbound) */
  outbound: WorkspaceEdge[]
}

/**
 * Cached adjacency index built from workspace edges.
 * Provides O(1) neighbor lookups instead of scanning all edges per BFS step.
 *
 * Invalidate by calling `invalidate()` when edges change (workspace save).
 */
export class AdjacencyIndex {
  private _map: Map<string, AdjacencyEntry> | null = null
  private _edges: WorkspaceEdge[] = []

  /** Build or rebuild the index from a set of edges. */
  build(edges: WorkspaceEdge[]): void {
    this._edges = edges
    this._map = new Map()

    for (const edge of edges) {
      // Source side (outbound)
      let sourceEntry = this._map.get(edge.source)
      if (!sourceEntry) {
        sourceEntry = { inbound: [], outbound: [] }
        this._map.set(edge.source, sourceEntry)
      }
      sourceEntry.outbound.push(edge)

      // Target side (inbound)
      let targetEntry = this._map.get(edge.target)
      if (!targetEntry) {
        targetEntry = { inbound: [], outbound: [] }
        this._map.set(edge.target, targetEntry)
      }
      targetEntry.inbound.push(edge)
    }
  }

  /** Invalidate the cached index. Next access will require a rebuild. */
  invalidate(): void {
    this._map = null
    this._edges = []
  }

  /** Whether the index has been built and is valid. */
  get isValid(): boolean {
    return this._map !== null
  }

  /** Get inbound edges for a node (edges where node is the target). O(1). */
  getInbound(nodeId: string): WorkspaceEdge[] {
    return this._map?.get(nodeId)?.inbound ?? []
  }

  /** Get outbound edges for a node (edges where node is the source). O(1). */
  getOutbound(nodeId: string): WorkspaceEdge[] {
    return this._map?.get(nodeId)?.outbound ?? []
  }

  /** Get all neighbors (both inbound sources and outbound targets). */
  getNeighborIds(nodeId: string): string[] {
    const entry = this._map?.get(nodeId)
    if (!entry) return []
    const ids = new Set<string>()
    for (const e of entry.inbound) ids.add(e.source)
    for (const e of entry.outbound) ids.add(e.target)
    return Array.from(ids)
  }
}

// ---------------------------------------------------------------------------
// Incremental XOR Hash — O(1) update on single node change
// ---------------------------------------------------------------------------

/**
 * Maintains an XOR-based hash across all node content hashes.
 *
 * XOR is self-inverse: to update when one node changes,
 * XOR out the old node hash and XOR in the new one. O(1) update.
 */
export class IncrementalXORHash {
  private _hash = 0
  private _nodeHashes = new Map<string, number>()

  /** Get the current combined hash value. */
  get value(): number {
    return this._hash >>> 0
  }

  /** Build from scratch given a map of nodeId -> content string. */
  buildFromNodes(nodes: Array<{ id: string; content: string }>): void {
    this._hash = 0
    this._nodeHashes.clear()

    for (const { id, content } of nodes) {
      const h = fnv1aHash(content)
      this._nodeHashes.set(id, h)
      this._hash ^= h
    }
  }

  /** Update a single node's content. O(1). */
  updateNode(nodeId: string, newContent: string): void {
    const oldHash = this._nodeHashes.get(nodeId)
    if (oldHash !== undefined) {
      this._hash ^= oldHash // XOR out old
    }
    const newHash = fnv1aHash(newContent)
    this._nodeHashes.set(nodeId, newHash)
    this._hash ^= newHash // XOR in new
  }

  /** Remove a node from the hash. */
  removeNode(nodeId: string): void {
    const oldHash = this._nodeHashes.get(nodeId)
    if (oldHash !== undefined) {
      this._hash ^= oldHash
      this._nodeHashes.delete(nodeId)
    }
  }

  /** Get the hash for a specific node, or undefined if not tracked. */
  getNodeHash(nodeId: string): number | undefined {
    return this._nodeHashes.get(nodeId)
  }

  /** Reset all state. */
  clear(): void {
    this._hash = 0
    this._nodeHashes.clear()
  }
}

// ---------------------------------------------------------------------------
// BFS Result Cache — topology + content-aware
// ---------------------------------------------------------------------------

interface BFSCacheEntry {
  cacheKey: string
  result: ContextEntry[]
  timestamp: number
}

/**
 * Cache for BFS traversal results.
 *
 * Cache key = `${startNodeId}:${topologyHash}:${contentXORHash}:${maxDepth}:${maxTokens}`
 *
 * - topologyHash: hash of sorted edge list (source+target pairs)
 * - contentXORHash: IncrementalXORHash.value for connected node content
 *
 * A cache hit means the graph topology AND all connected node content are unchanged.
 */
export class BFSCache {
  private _cache = new Map<string, BFSCacheEntry>()
  private _maxEntries: number

  constructor(maxEntries = 64) {
    this._maxEntries = maxEntries
  }

  /** Compute a topology hash from edges (sorted by id for determinism). */
  static computeTopologyHash(edges: WorkspaceEdge[]): number {
    const sorted = edges
      .map(e => `${e.id}:${e.source}->${e.target}:${e.data?.active !== false ? '1' : '0'}:${e.data?.bidirectional === true || e.data?.direction === 'bidirectional' ? 'b' : 'u'}`)
      .sort()
    return fnv1aHash(sorted.join('|'))
  }

  /** Build a cache key string. */
  static buildKey(
    startNodeId: string,
    topologyHash: number,
    contentHash: number,
    maxDepth: number,
    maxTokens: number | undefined
  ): string {
    return `${startNodeId}:${topologyHash}:${contentHash}:${maxDepth}:${maxTokens ?? 'none'}`
  }

  /** Look up a cached BFS result. Returns entries or null on miss. */
  get(key: string): ContextEntry[] | null {
    const entry = this._cache.get(key)
    if (!entry) return null
    return entry.result
  }

  /** Store a BFS result in the cache. */
  set(key: string, result: ContextEntry[]): void {
    // Evict oldest if at capacity
    if (this._cache.size >= this._maxEntries) {
      let oldestKey: string | null = null
      let oldestTime = Infinity
      for (const [k, v] of this._cache) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp
          oldestKey = k
        }
      }
      if (oldestKey) this._cache.delete(oldestKey)
    }

    this._cache.set(key, {
      cacheKey: key,
      result,
      timestamp: Date.now()
    })
  }

  /** Invalidate all cached entries. */
  invalidate(): void {
    this._cache.clear()
  }

  /** Number of cached entries. */
  get size(): number {
    return this._cache.size
  }
}

// ---------------------------------------------------------------------------
// Module-level cache instances (shared across calls)
// ---------------------------------------------------------------------------

const _adjacencyIndex = new AdjacencyIndex()
const _xorHash = new IncrementalXORHash()
const _bfsCache = new BFSCache()

/**
 * Invalidate all BFS caches. Call when workspace is saved or edges change.
 * Typically wired to the `workspace:saved` event.
 */
export function invalidateBFSCaches(): void {
  _adjacencyIndex.invalidate()
  _xorHash.clear()
  _bfsCache.invalidate()
}

/**
 * Get the module-level adjacency index (for testing / advanced usage).
 */
export function getAdjacencyIndex(): AdjacencyIndex {
  return _adjacencyIndex
}

/**
 * Get the module-level XOR hash (for testing / advanced usage).
 */
export function getXORHash(): IncrementalXORHash {
  return _xorHash
}

/**
 * Get the module-level BFS cache (for testing / advanced usage).
 */
export function getBFSCache(): BFSCache {
  return _bfsCache
}

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
    const userDataPath = getAppPath('userData')
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
 *
 * When an `adjacencyIdx` is provided, uses O(1) neighbor lookups instead
 * of scanning all edges. Falls back to full-scan when not provided.
 */
export function bfsTraverse(
  startNodeId: string,
  nodes: WorkspaceNode[],
  edges: WorkspaceEdge[],
  maxDepth: number = MAX_BFS_DEPTH,
  maxTokens?: number,
  adjacencyIdx?: AdjacencyIndex
): ContextEntry[] {
  const nodeMap = new Map<string, WorkspaceNode>()
  for (const n of nodes) {
    nodeMap.set(n.id, n)
  }

  // Helper: get inbound edges for a node
  const getInbound = adjacencyIdx?.isValid
    ? (nid: string) => adjacencyIdx.getInbound(nid)
    : (nid: string) => edges.filter(e => e.target === nid)

  // Helper: get outbound edges for a node
  const getOutbound = adjacencyIdx?.isValid
    ? (nid: string) => adjacencyIdx.getOutbound(nid)
    : (nid: string) => edges.filter(e => e.source === nid)

  const visited = new Set<string>([startNodeId])
  const result: ContextEntry[] = []
  let accumulatedTokens = 0

  let frontier: Array<{ nodeId: string; depth: number }> = [
    { nodeId: startNodeId, depth: 0 }
  ]

  while (frontier.length > 0) {
    const nextFrontier: Array<{ nodeId: string; depth: number }> = []

    for (const { nodeId, depth } of frontier) {
      if (depth >= maxDepth) continue

      // --- Inbound edges: edge.target === current node ---
      for (const edge of getInbound(nodeId)) {
        // Early termination: stop if token budget exceeded
        if (maxTokens !== undefined && accumulatedTokens >= maxTokens) break

        if (visited.has(edge.source)) continue
        if (edge.data?.active === false) continue

        visited.add(edge.source)
        const sourceNode = nodeMap.get(edge.source)
        if (!sourceNode) continue

        const content = extractContentSummary(sourceNode)
        const entryTokens = estimateTokens(content)

        // Check if adding this entry would exceed the budget
        if (maxTokens !== undefined && accumulatedTokens + entryTokens > maxTokens) {
          // Budget would be exceeded — stop traversal
          accumulatedTokens = maxTokens // signal exhaustion
          break
        }

        const edgeRole = (edge.data?.contextRole as string) || 'provides-context'

        result.push({
          nodeId: sourceNode.id,
          nodeType: (sourceNode.data.type as string) || sourceNode.type || 'unknown',
          title: extractTitle(sourceNode),
          content,
          edgeRole,
          depth: depth + 1,
          tokenEstimate: entryTokens
        })

        accumulatedTokens += entryTokens
        nextFrontier.push({ nodeId: edge.source, depth: depth + 1 })
      }

      // Early termination check between edge loops
      if (maxTokens !== undefined && accumulatedTokens >= maxTokens) continue

      // --- Bidirectional outbound edges: edge.source === current node ---
      for (const edge of getOutbound(nodeId)) {
        // Early termination: stop if token budget exceeded
        if (maxTokens !== undefined && accumulatedTokens >= maxTokens) break

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
        const entryTokens = estimateTokens(content)

        // Check if adding this entry would exceed the budget
        if (maxTokens !== undefined && accumulatedTokens + entryTokens > maxTokens) {
          accumulatedTokens = maxTokens
          break
        }

        const edgeRole = (edge.data?.contextRole as string) || 'provides-context'

        result.push({
          nodeId: targetNode.id,
          nodeType: (targetNode.data.type as string) || targetNode.type || 'unknown',
          title: extractTitle(targetNode),
          content,
          edgeRole,
          depth: depth + 1,
          tokenEstimate: entryTokens
        })

        accumulatedTokens += entryTokens
        nextFrontier.push({ nodeId: edge.target, depth: depth + 1 })
      }
    }

    // Early termination at frontier level
    if (maxTokens !== undefined && accumulatedTokens >= maxTokens) break

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
      lines.push(sanitizeForContext(entry.content))
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
 * Uses module-level caches (adjacency index, XOR hash, BFS cache) for
 * fast repeated lookups. Cache is invalidated by `invalidateBFSCaches()`.
 *
 * Can also accept a pre-loaded workspace snapshot for testability.
 * When `useCache: false` is passed, bypasses the BFS result cache.
 */
export async function buildContextForNode(
  nodeId: string,
  workspaceOverride?: WorkspaceSnapshot | null,
  options?: { maxTokens?: number; useCache?: boolean }
): Promise<GeneratedContext> {
  const workspace = workspaceOverride ?? (await loadCurrentWorkspaceSnapshot())
  const useCache = options?.useCache !== false

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

  // --- Build adjacency index if stale ---
  if (!_adjacencyIndex.isValid) {
    _adjacencyIndex.build(workspace.edges)
  }

  // --- Build/update XOR hash for content ---
  if (_xorHash.value === 0 && workspace.nodes.length > 0) {
    _xorHash.buildFromNodes(
      workspace.nodes.map(n => ({
        id: n.id,
        content: extractContentSummary(n)
      }))
    )
  }

  // --- Check BFS cache ---
  if (useCache) {
    const topologyHash = BFSCache.computeTopologyHash(workspace.edges)
    const cacheKey = BFSCache.buildKey(
      nodeId,
      topologyHash,
      _xorHash.value,
      MAX_BFS_DEPTH,
      options?.maxTokens
    )

    const cached = _bfsCache.get(cacheKey)
    if (cached) {
      const markdown = generateMarkdown(rootTitle, cached)
      const totalTokens = cached.reduce((sum, e) => sum + e.tokenEstimate, 0)
      return {
        entries: cached,
        markdown,
        filePath: getContextFilePath(nodeId),
        totalTokens
      }
    }

    // Cache miss — run BFS and store result
    const entries = bfsTraverse(
      nodeId,
      workspace.nodes,
      workspace.edges,
      MAX_BFS_DEPTH,
      options?.maxTokens,
      _adjacencyIndex
    )

    _bfsCache.set(cacheKey, entries)

    const markdown = generateMarkdown(rootTitle, entries)
    const totalTokens = entries.reduce((sum, e) => sum + e.tokenEstimate, 0)

    return {
      entries,
      markdown,
      filePath: getContextFilePath(nodeId),
      totalTokens
    }
  }

  // --- No cache path ---
  const entries = bfsTraverse(
    nodeId,
    workspace.nodes,
    workspace.edges,
    MAX_BFS_DEPTH,
    options?.maxTokens,
    _adjacencyIndex
  )
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
  return join(getAppPath('userData'), ACTIVITY_DIR_NAME)
}

export function getContextFilePath(nodeId: string): string {
  // Sanitize nodeId to prevent path traversal
  const safeId = nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(getActivityDir(), `context-${safeId}.md`)
}

/**
 * Resolve the absolute file path to the current workspace JSON.
 * Reads {userData}/settings.json for lastWorkspaceId, returns the full path.
 * Returns null if no workspace is active or settings can't be read.
 */
export async function getWorkspaceFilePath(): Promise<string | null> {
  try {
    const userDataPath = getAppPath('userData')
    const settingsPath = join(userDataPath, 'settings.json')
    const settingsContent = await fs.readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(settingsContent) as { lastWorkspaceId?: string }

    if (!settings.lastWorkspaceId) return null

    return join(userDataPath, 'workspaces', `${settings.lastWorkspaceId}.json`)
  } catch {
    return null
  }
}
