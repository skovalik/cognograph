// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// FileSyncProvider - file-based workspace CRUD for MCP server
// Pure Node.js, no Electron imports

import { randomUUID } from 'crypto'
import { type FSWatcher, promises as fs, watch as fsWatch } from 'fs'
import { dirname } from 'path'
import { validateCreateNodeData, validateNodeChanges } from './validation'

// Simplified node/edge types matching React Flow shapes stored in workspace JSON
export interface WorkspaceNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  width?: number
  height?: number
  measured?: { width: number; height: number }
  [key: string]: unknown
}

export interface WorkspaceEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  data?: Record<string, unknown>
  [key: string]: unknown
}

export interface WorkspaceFileData {
  id: string
  name: string
  nodes: WorkspaceNode[]
  edges: WorkspaceEdge[]
  viewport: { x: number; y: number; zoom: number }
  createdAt: number
  updatedAt: number
  version: number
  [key: string]: unknown
}

export interface MCPSyncProvider {
  load(): Promise<void>
  close(): void
  getWorkspaceId(): string
  getWorkspaceName(): string
  getNodes(): WorkspaceNode[]
  getNode(id: string): WorkspaceNode | null
  getEdges(): WorkspaceEdge[]
  getEdge(id: string): WorkspaceEdge | null
  createNode(
    type: string,
    data: Record<string, unknown>,
    position?: { x: number; y: number },
  ): string
  updateNode(id: string, changes: Record<string, unknown>): void
  deleteNode(id: string): void
  createEdge(source: string, target: string, data?: Record<string, unknown>): string
  deleteEdge(id: string): void
  flush(): Promise<void>
}

const DEBOUNCE_MS = 500
const SELF_WRITE_GRACE_MS = 1500

export class FileSyncProvider implements MCPSyncProvider {
  private filePath: string
  private nodes: Map<string, WorkspaceNode> = new Map()
  private edges: Map<string, WorkspaceEdge> = new Map()
  private workspaceData: WorkspaceFileData | null = null
  private watcher: FSWatcher | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private lastWriteTime = 0
  private dirty = false
  private persisting: Promise<void> | null = null

  // Merge tracking: IDs present at last reload (disk baseline)
  private lastReloadNodeIds: Set<string> = new Set()
  private lastReloadEdgeIds: Set<string> = new Set()
  // IDs that MCP explicitly mutated (created/updated/deleted)
  private mcpMutatedNodeIds: Set<string> = new Set()
  private mcpMutatedEdgeIds: Set<string> = new Set()

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async load(): Promise<void> {
    const content = await fs.readFile(this.filePath, 'utf-8')
    const data = JSON.parse(content) as WorkspaceFileData
    this.workspaceData = data
    this.populateMaps(data)
    this.startWatcher()
  }

  close(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  getWorkspaceId(): string {
    return this.workspaceData?.id ?? ''
  }

  getWorkspaceName(): string {
    return this.workspaceData?.name ?? ''
  }

  getNodes(): WorkspaceNode[] {
    return Array.from(this.nodes.values())
  }

  getNode(id: string): WorkspaceNode | null {
    return this.nodes.get(id) ?? null
  }

  getEdges(): WorkspaceEdge[] {
    return Array.from(this.edges.values())
  }

  getEdge(id: string): WorkspaceEdge | null {
    return this.edges.get(id) ?? null
  }

  createNode(
    type: string,
    data: Record<string, unknown>,
    position?: { x: number; y: number },
  ): string {
    const id = randomUUID()
    const validatedData = validateCreateNodeData(type, data)

    const node: WorkspaceNode = {
      id,
      type,
      position: {
        x: Number.isFinite(position?.x) ? position!.x : 0,
        y: Number.isFinite(position?.y) ? position!.y : 0,
      },
      data: validatedData,
    }

    this.nodes.set(id, node)
    this.mcpMutatedNodeIds.add(id)
    this.schedulePersist()
    return id
  }

  updateNode(id: string, changes: Record<string, unknown>): void {
    const node = this.nodes.get(id)
    if (!node) {
      throw new Error(`Node not found: ${id}`)
    }

    const nodeType = (node.data.type as string) || node.type || ''
    const validatedChanges = validateNodeChanges(nodeType, changes)

    // Apply changes to node data
    node.data = {
      ...node.data,
      ...validatedChanges,
      updatedAt: Date.now(),
    }

    this.nodes.set(id, node)
    this.mcpMutatedNodeIds.add(id)
    this.schedulePersist()
  }

  deleteNode(id: string): void {
    if (!this.nodes.has(id)) {
      throw new Error(`Node not found: ${id}`)
    }

    this.nodes.delete(id)
    this.mcpMutatedNodeIds.add(id)

    // Remove connected edges
    for (const [edgeId, edge] of this.edges) {
      if (edge.source === id || edge.target === id) {
        this.edges.delete(edgeId)
        this.mcpMutatedEdgeIds.add(edgeId)
      }
    }

    this.schedulePersist()
  }

  createEdge(source: string, target: string, data?: Record<string, unknown>): string {
    if (!this.nodes.has(source)) {
      throw new Error(`Source node not found: ${source}`)
    }
    if (!this.nodes.has(target)) {
      throw new Error(`Target node not found: ${target}`)
    }

    const id = `e-${randomUUID()}`
    const edge: WorkspaceEdge = {
      id,
      source,
      target,
      data: {
        direction: 'unidirectional',
        weight: 5,
        active: true,
        ...data,
      },
    }

    this.edges.set(id, edge)
    this.mcpMutatedEdgeIds.add(id)
    this.schedulePersist()
    return id
  }

  deleteEdge(id: string): void {
    if (!this.edges.has(id)) {
      throw new Error(`Edge not found: ${id}`)
    }
    this.edges.delete(id)
    this.mcpMutatedEdgeIds.add(id)
    this.schedulePersist()
  }

  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.persisting) await this.persisting
    if (this.dirty) {
      await this.persist()
    }
  }

  // --- Private methods ---

  private populateMaps(data: WorkspaceFileData): void {
    this.nodes.clear()
    this.edges.clear()
    this.lastReloadNodeIds.clear()
    this.lastReloadEdgeIds.clear()

    for (const node of data.nodes) {
      this.nodes.set(node.id, node)
      this.lastReloadNodeIds.add(node.id)
    }
    for (const edge of data.edges) {
      this.edges.set(edge.id, edge)
      this.lastReloadEdgeIds.add(edge.id)
    }
  }

  private schedulePersist(): void {
    this.dirty = true
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.persist().catch((err) => {
        console.error('[MCP Provider] Persist error:', err)
      })
    }, DEBOUNCE_MS)
  }

  private async persist(): Promise<void> {
    if (!this.workspaceData) return
    if (this.persisting) {
      this.dirty = true
      return
    }
    this.persisting = this.doPersist()
    await this.persisting
    this.persisting = null
    if (this.dirty) await this.persist()
  }

  private async doPersist(): Promise<void> {
    if (!this.workspaceData) return
    this.dirty = false

    // MERGE STRATEGY: Read latest file from disk, apply MCP's changes on top.
    // This prevents the MCP provider from overwriting nodes/edges that the
    // renderer created since our last reload. Without this, persisting our
    // in-memory snapshot (which may be stale) would destroy renderer changes.
    let baseData: WorkspaceFileData
    try {
      const diskContent = await fs.readFile(this.filePath, 'utf-8')
      baseData = JSON.parse(diskContent) as WorkspaceFileData
    } catch {
      // File unreadable — fall back to our in-memory snapshot
      baseData = this.workspaceData
    }

    // Build indexes of disk state for efficient merge
    const diskNodeMap = new Map<string, WorkspaceNode>()
    for (const node of baseData.nodes) diskNodeMap.set(node.id, node)
    const diskEdgeMap = new Map<string, WorkspaceEdge>()
    for (const edge of baseData.edges) diskEdgeMap.set(edge.id, edge)

    // Track which IDs were in our snapshot at last reload (before MCP mutations)
    // MCP-created nodes: in this.nodes but NOT in our lastReloadNodeIds
    // MCP-deleted nodes: in our lastReloadNodeIds but NOT in this.nodes
    // MCP-updated nodes: in this.mcpMutatedNodeIds

    // Apply MCP additions: nodes in our map but not from original reload
    for (const [id, node] of this.nodes) {
      if (!this.lastReloadNodeIds.has(id)) {
        // MCP created this node — add it to disk data
        diskNodeMap.set(id, node)
      } else if (this.mcpMutatedNodeIds.has(id)) {
        // MCP updated this node — overwrite disk version
        diskNodeMap.set(id, node)
      }
      // Otherwise: node existed at reload and MCP didn't touch it — keep disk version
    }

    // Apply MCP deletions: nodes that were in our reload set but MCP deleted
    for (const id of this.lastReloadNodeIds) {
      if (!this.nodes.has(id)) {
        diskNodeMap.delete(id)
      }
    }

    // Same for edges
    for (const [id, edge] of this.edges) {
      if (!this.lastReloadEdgeIds.has(id)) {
        diskEdgeMap.set(id, edge)
      } else if (this.mcpMutatedEdgeIds.has(id)) {
        diskEdgeMap.set(id, edge)
      }
    }
    for (const id of this.lastReloadEdgeIds) {
      if (!this.edges.has(id)) {
        diskEdgeMap.delete(id)
      }
    }

    const data: WorkspaceFileData = {
      ...baseData,
      nodes: Array.from(diskNodeMap.values()),
      edges: Array.from(diskEdgeMap.values()),
      updatedAt: Date.now(),
      version: (baseData.version || 0) + 1,
    }

    // Atomic write: write to tmp then rename
    const tmpPath = `${this.filePath}.tmp`
    const content = JSON.stringify(data, null, 2)

    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(tmpPath, content, 'utf-8')
    try {
      await fs.rename(tmpPath, this.filePath)
    } catch {
      // Rename failed (e.g., cross-device, file locked). Fall back to direct write.
      await fs.writeFile(this.filePath, content, 'utf-8')
      try {
        await fs.unlink(tmpPath)
      } catch {
        /* ignore cleanup failure */
      }
    }

    this.lastWriteTime = Date.now()
    this.workspaceData = data

    // Update our in-memory maps to match what we just wrote
    this.populateMaps(data)

    // Clear mutation tracking — current disk state is our new baseline
    this.mcpMutatedNodeIds.clear()
    this.mcpMutatedEdgeIds.clear()
  }

  private startWatcher(): void {
    try {
      this.watcher = fsWatch(this.filePath, async (eventType) => {
        if (eventType !== 'change') return

        // Never reload from disk when in-memory changes are pending or persisting.
        // Windows fsWatch fires late/multiple times, so time-based guards alone are insufficient.
        if (this.dirty || this.debounceTimer || this.persisting) return

        // Ignore changes we caused (backup guard for timing edge cases)
        if (Date.now() - this.lastWriteTime < SELF_WRITE_GRACE_MS) return

        try {
          const content = await fs.readFile(this.filePath, 'utf-8')
          const data = JSON.parse(content) as WorkspaceFileData
          this.workspaceData = data
          this.populateMaps(data)
          this.dirty = false
        } catch {
          // File might be mid-write; ignore and wait for next change
        }
      })
    } catch {
      // Watcher setup failed (e.g., file not accessible); non-fatal
      console.error('[MCP Provider] File watcher setup failed for:', this.filePath)
    }
  }
}
