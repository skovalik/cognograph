// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// BridgeSyncProvider — HTTP-based workspace CRUD for MCP server
// Connects to mcpBridge.ts running in Electron main process.
// Pure Node.js, no Electron imports.

import { randomUUID } from 'crypto'
import http from 'http'
import type { MCPSyncProvider, WorkspaceEdge, WorkspaceNode } from './provider'
import { validateCreateNodeData, validateNodeChanges } from './validation'

const REQUEST_TIMEOUT_MS = 5000

export class BridgeSyncProvider implements MCPSyncProvider {
  private bridgeUrl: string
  private token: string
  private workspaceId = ''
  private workspaceName = ''

  // Read cache — populated on load()/reload(), used by getNodes()/getEdges()
  // BFS traversal in buildContextForNode calls getNodes()+getEdges() synchronously,
  // so we must cache the full state, not fetch per-call.
  private cachedNodes: WorkspaceNode[] = []
  private cachedEdges: WorkspaceEdge[] = []

  constructor(port: number, token: string) {
    this.bridgeUrl = `http://127.0.0.1:${port}`
    this.token = token
  }

  async load(): Promise<void> {
    const meta = await this.bridgeGet('/workspace')
    this.workspaceId = meta.id
    this.workspaceName = meta.name
    await this.reload()
  }

  async reload(): Promise<void> {
    // Parallel fetch of nodes + edges. Guard against null/error responses —
    // if bridge is down or query times out, keep stale cache rather than
    // replacing with null (which would crash getNodes() callers).
    try {
      const [nodes, edges] = await Promise.all([this.bridgeGet('/nodes'), this.bridgeGet('/edges')])
      if (Array.isArray(nodes)) this.cachedNodes = nodes
      if (Array.isArray(edges)) this.cachedEdges = edges
    } catch {
      // Bridge unavailable — keep existing cache. Log but don't throw.
      console.error('[BridgeSyncProvider] reload() failed, keeping stale cache')
    }
  }

  close(): void {
    // No file watchers or timers to clean up
  }

  getWorkspaceId(): string {
    return this.workspaceId
  }

  getWorkspaceName(): string {
    return this.workspaceName
  }

  getNodes(): WorkspaceNode[] {
    return this.cachedNodes
  }

  getNode(id: string): WorkspaceNode | null {
    return this.cachedNodes.find((n) => n.id === id) ?? null
  }

  getEdges(): WorkspaceEdge[] {
    return this.cachedEdges
  }

  getEdge(id: string): WorkspaceEdge | null {
    return this.cachedEdges.find((e) => e.id === id) ?? null
  }

  createNode(
    type: string,
    data: Record<string, unknown>,
    position?: { x: number; y: number },
  ): string {
    // Synchronous return — MCPSyncProvider interface requires the ID immediately.
    // Node is added to local cache AND posted to bridge asynchronously.
    const id = randomUUID()
    const node: WorkspaceNode = {
      id,
      type,
      position: {
        x: Number.isFinite(position?.x) ? position!.x : 0,
        y: Number.isFinite(position?.y) ? position!.y : 0,
      },
      data: validateCreateNodeData(type, data),
    }
    this.cachedNodes.push(node)

    // Async POST — bridge will forward to renderer store.
    // On failure: remove phantom node from cache to prevent divergence.
    this.bridgePost('/nodes', { id, type, data: node.data, position: node.position }).catch(
      (err) => {
        console.error('[BridgeSyncProvider] POST /nodes failed, removing phantom:', err)
        this.cachedNodes = this.cachedNodes.filter((n) => n.id !== id)
      },
    )
    return id
  }

  updateNode(id: string, changes: Record<string, unknown>): void {
    const node = this.cachedNodes.find((n) => n.id === id)
    if (!node) throw new Error(`Node not found: ${id}`)
    const nodeType = (node.data.type as string) || node.type || ''
    const validated = validateNodeChanges(nodeType, changes)
    node.data = { ...node.data, ...validated, updatedAt: Date.now() }
    this.bridgePatch(`/nodes/${id}`, validated).catch((err) =>
      console.error('[BridgeSyncProvider] PATCH failed:', err),
    )
  }

  deleteNode(id: string): void {
    const idx = this.cachedNodes.findIndex((n) => n.id === id)
    if (idx === -1) throw new Error(`Node not found: ${id}`)
    this.cachedNodes.splice(idx, 1)
    // Remove connected edges from cache
    this.cachedEdges = this.cachedEdges.filter((e) => e.source !== id && e.target !== id)
    this.bridgeDelete(`/nodes/${id}`).catch((err) =>
      console.error('[BridgeSyncProvider] DELETE failed:', err),
    )
  }

  createEdge(source: string, target: string, data?: Record<string, unknown>): string {
    if (!this.cachedNodes.find((n) => n.id === source))
      throw new Error(`Source node not found: ${source}`)
    if (!this.cachedNodes.find((n) => n.id === target))
      throw new Error(`Target node not found: ${target}`)

    // Edge ID format: Store generates `${source}-${target}`, NOT `e-${uuid}`.
    // Match upfront to avoid cache-miss window between POST and next reload().
    const id = `${source}-${target}`
    const edge: WorkspaceEdge = {
      id,
      source,
      target,
      data: { direction: 'unidirectional', weight: 5, active: true, ...data },
    }
    this.cachedEdges.push(edge)

    this.bridgePost('/edges', { source, target, data: edge.data })
      .then((res: Record<string, unknown> | null) => {
        // Update cached edge ID to match what the store actually assigned
        if (res?.id && res.id !== id) {
          const cached = this.cachedEdges.find((e) => e.id === id)
          if (cached) cached.id = res.id as string
        }
      })
      .catch((err) => console.error('[BridgeSyncProvider] POST /edges failed:', err))
    return id
  }

  deleteEdge(id: string): void {
    const idx = this.cachedEdges.findIndex((e) => e.id === id)
    if (idx === -1) throw new Error(`Edge not found: ${id}`)
    this.cachedEdges.splice(idx, 1)
    this.bridgeDelete(`/edges/${id}`).catch((err) =>
      console.error('[BridgeSyncProvider] DELETE failed:', err),
    )
  }

  async flush(): Promise<void> {
    // No-op — bridge writes are immediate (no debounce).
    // Renderer's save flow handles disk persistence.
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers — Node.js http.request (NOT global fetch)
  // ---------------------------------------------------------------------------

  private async bridgeGet(path: string): Promise<any> {
    return this.httpRequest('GET', path)
  }

  private async bridgePost(path: string, body: unknown): Promise<any> {
    return this.httpRequest('POST', path, body)
  }

  private async bridgePatch(path: string, body: unknown): Promise<any> {
    return this.httpRequest('PATCH', path, body)
  }

  private async bridgeDelete(path: string): Promise<any> {
    return this.httpRequest('DELETE', path)
  }

  private httpRequest(method: string, path: string, body?: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.bridgeUrl)
      const payload = body !== undefined ? JSON.stringify(body) : undefined

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method,
          timeout: REQUEST_TIMEOUT_MS,
          headers: {
            Authorization: `Bearer ${this.token}`,
            ...(payload !== undefined
              ? {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload),
                }
              : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8')
            if (res.statusCode && res.statusCode >= 400) {
              reject(
                new Error(
                  `Bridge ${method} ${path} returned ${res.statusCode}: ${raw.slice(0, 200)}`,
                ),
              )
              return
            }
            try {
              resolve(raw ? JSON.parse(raw) : null)
            } catch {
              reject(new Error(`Bridge ${method} ${path}: invalid JSON response`))
            }
          })
        },
      )

      req.on('error', (err) => {
        reject(new Error(`Bridge ${method} ${path} failed: ${err.message}`))
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Bridge ${method} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`))
      })

      if (payload !== undefined) {
        req.write(payload)
      }
      req.end()
    })
  }
}
