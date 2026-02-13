// FileSyncProvider - file-based workspace CRUD for MCP server
// Pure Node.js, no Electron imports

import { promises as fs } from 'fs'
import { watch as fsWatch, type FSWatcher } from 'fs'
import { dirname } from 'path'
import { randomUUID } from 'crypto'
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
    position?: { x: number; y: number }
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
    position?: { x: number; y: number }
  ): string {
    const id = randomUUID()
    const validatedData = validateCreateNodeData(type, data)

    const node: WorkspaceNode = {
      id,
      type,
      position: {
        x: Number.isFinite(position?.x) ? position!.x : 0,
        y: Number.isFinite(position?.y) ? position!.y : 0
      },
      data: validatedData
    }

    this.nodes.set(id, node)
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
      updatedAt: Date.now()
    }

    this.nodes.set(id, node)
    this.schedulePersist()
  }

  deleteNode(id: string): void {
    if (!this.nodes.has(id)) {
      throw new Error(`Node not found: ${id}`)
    }

    this.nodes.delete(id)

    // Remove connected edges
    for (const [edgeId, edge] of this.edges) {
      if (edge.source === id || edge.target === id) {
        this.edges.delete(edgeId)
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
        ...data
      }
    }

    this.edges.set(id, edge)
    this.schedulePersist()
    return id
  }

  deleteEdge(id: string): void {
    if (!this.edges.has(id)) {
      throw new Error(`Edge not found: ${id}`)
    }
    this.edges.delete(id)
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

    for (const node of data.nodes) {
      this.nodes.set(node.id, node)
    }
    for (const edge of data.edges) {
      this.edges.set(edge.id, edge)
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

    // Reconstruct workspace data from maps
    const data: WorkspaceFileData = {
      ...this.workspaceData,
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      updatedAt: Date.now(),
      version: (this.workspaceData.version || 0) + 1
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
      try { await fs.unlink(tmpPath) } catch { /* ignore cleanup failure */ }
    }

    this.lastWriteTime = Date.now()
    this.workspaceData = data
  }

  private startWatcher(): void {
    try {
      this.watcher = fsWatch(this.filePath, async (eventType) => {
        if (eventType !== 'change') return

        // Ignore changes we caused
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
