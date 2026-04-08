// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * mcpBridge.ts — MCP Bridge HTTP Server
 *
 * Localhost-only HTTP server that MCP CLI connects to instead of
 * reading/writing the workspace JSON file directly. Routes requests
 * to the renderer's Zustand store via IPC (mcpBridgeIpc.ts).
 *
 * Security (mirrors ccBridgeService.ts):
 * - Binds exclusively to 127.0.0.1
 * - Bearer token via crypto.randomBytes(32)
 * - crypto.timingSafeEqual() for token comparison
 * - Rejects requests with Origin header
 * - Rate limited (100 req/s)
 * - Body size limit (1MB)
 * - Content-Type validation on POST/PATCH
 * - Port file with mode 0o600
 */

import crypto from 'crypto'
import { app } from 'electron'
import fs from 'fs'
import http from 'http'
import { join } from 'path'

import { validateCreateNodeData, validateNodeChanges } from '../mcp/validation'
import { buildContextForNode } from './contextWriter'
import type { QueryFn } from './mcpBridgeIpc'
import { bridgeQuery as defaultBridgeQuery } from './mcpBridgeIpc'

// ---------------------------------------------------------------------------
// Module State
// ---------------------------------------------------------------------------

let server: http.Server | null = null
let activePort: number | null = null
let activeToken: string | null = null
let activeWorkspaceId: string | null = null
let portFilePath: string | null = null
let query: QueryFn = defaultBridgeQuery

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

// Single-flight mutation queue (same pattern as workspace.ts saveQueues)
let mutationInFlight = false
let mutationPending: (() => Promise<void>) | null = null

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT_RANGE_START = 49152
const PORT_RANGE_END = 65535
const MAX_PORT_ATTEMPTS = 5
const MAX_BODY_BYTES = 1_048_576 // 1MB
const RATE_LIMIT_PER_SECOND = 100
const STALE_PROBE_TIMEOUT_MS = 1000

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function startBridge(
  workspaceId: string,
  queryFn?: QueryFn,
): Promise<{ port: number; token: string }> {
  if (server) {
    stopBridge()
  }

  if (queryFn) {
    query = queryFn
  } else {
    query = defaultBridgeQuery
  }

  activeWorkspaceId = workspaceId

  // Check for stale port file and clean up
  const discoveryPath = getPortFilePath(workspaceId)
  await cleanupStalePortFile(discoveryPath)

  const token = crypto.randomBytes(32).toString('hex')
  activeToken = token

  const port = await tryBind(0)
  activePort = port

  // Write port discovery file
  portFilePath = discoveryPath
  const discovery = JSON.stringify({
    port,
    token,
    pid: process.pid,
    workspaceId,
    started: Date.now(),
  })

  const dir = join(app.getPath('userData'), 'workspaces')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(portFilePath, discovery, { encoding: 'utf-8', mode: 0o600 })

  console.log(`[mcpBridge] Listening on 127.0.0.1:${port} for workspace ${workspaceId}`)
  return { port, token }
}

export function stopBridge(): void {
  if (server) {
    server.close()
    server = null
  }
  activePort = null
  activeToken = null
  activeWorkspaceId = null
  rateBuckets.clear()
  mutationInFlight = false
  mutationPending = null

  if (portFilePath) {
    try {
      fs.unlinkSync(portFilePath)
    } catch {
      // File may already be deleted
    }
    portFilePath = null
  }
  console.log('[mcpBridge] Stopped')
}

export function isBridgeRunning(): boolean {
  return server !== null && activePort !== null
}

export function getBridgeConfig(): { port: number; token: string } | null {
  if (!activePort || !activeToken) return null
  return { port: activePort, token: activeToken }
}

// ---------------------------------------------------------------------------
// Server Binding
// ---------------------------------------------------------------------------

function tryBind(attempt: number): Promise<number> {
  return new Promise((resolve, reject) => {
    if (attempt >= MAX_PORT_ATTEMPTS) {
      reject(new Error(`[mcpBridge] Failed to bind after ${MAX_PORT_ATTEMPTS} attempts`))
      return
    }

    const port =
      PORT_RANGE_START + Math.floor(Math.random() * (PORT_RANGE_END - PORT_RANGE_START + 1))

    const httpServer = http.createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        console.error('[mcpBridge] Unhandled request error:', err)
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })
    })

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(tryBind(attempt + 1))
      } else {
        reject(err)
      }
    })

    httpServer.listen(port, '127.0.0.1', () => {
      server = httpServer
      resolve(port)
    })
  })
}

// ---------------------------------------------------------------------------
// Port Discovery & Stale Cleanup
// ---------------------------------------------------------------------------

function getPortFilePath(workspaceId: string): string {
  return join(app.getPath('userData'), 'workspaces', `${workspaceId}.mcp-bridge.json`)
}

async function cleanupStalePortFile(filePath: string): Promise<void> {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return // No existing file
  }

  let existing: { port?: number }
  try {
    existing = JSON.parse(raw)
  } catch {
    fs.unlinkSync(filePath)
    return
  }

  if (typeof existing.port !== 'number') {
    fs.unlinkSync(filePath)
    return
  }

  // Probe the port with GET /status
  const alive = await probePort(existing.port)
  if (!alive) {
    try {
      fs.unlinkSync(filePath)
    } catch {
      // Already gone
    }
  }
}

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/status',
        method: 'GET',
        timeout: STALE_PROBE_TIMEOUT_MS,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        res.on('end', () => {
          try {
            const data = JSON.parse(body)
            resolve(data.status === 'ok')
          } catch {
            resolve(false)
          }
        })
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Request Handler
// ---------------------------------------------------------------------------

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    // Reject browser requests (no Origin header allowed)
    if (req.headers.origin) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Browser requests are not allowed' }))
      return
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${activePort}`)
    const pathname = url.pathname
    const method = req.method || 'GET'

    // Health check — no auth required
    if (pathname === '/status' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }

    // Auth check
    if (!authenticateRequest(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    // Rate limit
    const rateKey = `${method}:${pathname}`
    if (!checkRateLimit(rateKey)) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Too Many Requests' }))
      return
    }

    // Content-Type validation for mutation methods
    if (method === 'POST' || method === 'PATCH') {
      const ct = req.headers['content-type'] || ''
      if (!ct.includes('application/json')) {
        res.writeHead(415, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Content-Type must be application/json' }))
        return
      }
    }

    // Route dispatch
    await routeRequest(method, pathname, req, res)
  } catch (err) {
    console.error('[mcpBridge] Request handler error:', err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function routeRequest(
  method: string,
  pathname: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  // GET /workspace
  if (pathname === '/workspace' && method === 'GET') {
    return handleGetWorkspace(res)
  }

  // GET /nodes
  if (pathname === '/nodes' && method === 'GET') {
    return handleGetNodes(res)
  }

  // POST /nodes
  if (pathname === '/nodes' && method === 'POST') {
    return handleCreateNode(req, res)
  }

  // GET /nodes/:id
  const nodeMatch = pathname.match(/^\/nodes\/([^/]+)$/)
  if (nodeMatch && method === 'GET') {
    return handleGetNode(nodeMatch[1]!, res)
  }

  // PATCH /nodes/:id
  if (nodeMatch && method === 'PATCH') {
    return handleUpdateNode(nodeMatch[1]!, req, res)
  }

  // DELETE /nodes/:id
  if (nodeMatch && method === 'DELETE') {
    return handleDeleteNode(nodeMatch[1]!, res)
  }

  // GET /edges
  if (pathname === '/edges' && method === 'GET') {
    return handleGetEdges(res)
  }

  // POST /edges
  if (pathname === '/edges' && method === 'POST') {
    return handleCreateEdge(req, res)
  }

  // DELETE /edges/:id
  const edgeMatch = pathname.match(/^\/edges\/([^/]+)$/)
  if (edgeMatch && method === 'DELETE') {
    return handleDeleteEdge(edgeMatch[1]!, res)
  }

  // GET /context/:nodeId
  const contextMatch = pathname.match(/^\/context\/([^/]+)$/)
  if (contextMatch && method === 'GET') {
    return handleGetContext(contextMatch[1]!, res)
  }

  // POST /search
  if (pathname === '/search' && method === 'POST') {
    return handleSearch(req, res)
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

// ---------------------------------------------------------------------------
// Route Handlers — Reads
// ---------------------------------------------------------------------------

async function handleGetWorkspace(res: http.ServerResponse): Promise<void> {
  const result = await query('get-workspace-meta', {}, activeWorkspaceId ?? undefined)
  if (!result) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Renderer unavailable' }))
    return
  }
  json(res, 200, result)
}

async function handleGetNodes(res: http.ServerResponse): Promise<void> {
  const result = await query('get-nodes', {}, activeWorkspaceId ?? undefined)
  if (result === null) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Renderer unavailable' }))
    return
  }
  json(res, 200, result)
}

async function handleGetNode(nodeId: string, res: http.ServerResponse): Promise<void> {
  const result = await query('get-node', { id: nodeId }, activeWorkspaceId ?? undefined)
  if (result === null) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Node ${nodeId} not found` }))
    return
  }
  json(res, 200, result)
}

async function handleGetEdges(res: http.ServerResponse): Promise<void> {
  const result = await query('get-edges', {}, activeWorkspaceId ?? undefined)
  if (result === null) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Renderer unavailable' }))
    return
  }
  json(res, 200, result)
}

async function handleGetContext(nodeId: string, res: http.ServerResponse): Promise<void> {
  // Fetch nodes and edges from renderer to build workspace snapshot
  const [nodesResult, edgesResult] = await Promise.all([
    query('get-nodes', {}, activeWorkspaceId ?? undefined),
    query('get-edges', {}, activeWorkspaceId ?? undefined),
  ])

  if (nodesResult === null || edgesResult === null) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Renderer unavailable' }))
    return
  }

  const nodes = nodesResult as Array<{
    id: string
    type?: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }>
  const edges = edgesResult as Array<{
    id: string
    source: string
    target: string
    data?: Record<string, unknown>
  }>

  const context = await buildContextForNode(nodeId, { nodes, edges }, { useCache: false })
  json(res, 200, { markdown: context.markdown, connectedNodes: context.entries })
}

async function handleSearch(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await readBody(req)
  if (body === null) {
    res.writeHead(413, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Payload too large' }))
    return
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(body)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  const result = await query('search-nodes', parsed, activeWorkspaceId ?? undefined)
  if (result === null) {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Renderer unavailable' }))
    return
  }
  json(res, 200, result)
}

// ---------------------------------------------------------------------------
// Route Handlers — Mutations (serialized via single-flight queue)
// ---------------------------------------------------------------------------

async function handleCreateNode(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = await readBody(req)
  if (body === null) {
    res.writeHead(413, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Payload too large' }))
    return
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(body)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  const nodeType = typeof parsed.type === 'string' ? parsed.type : ''
  let validatedData: Record<string, unknown>
  try {
    validatedData = validateCreateNodeData(nodeType, parsed)
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: (err as Error).message }))
    return
  }

  await enqueueMutation(async () => {
    const result = await query(
      'create-node',
      { id: crypto.randomUUID(), type: nodeType, data: validatedData, position: parsed.position },
      activeWorkspaceId ?? undefined,
    )
    if (result === null) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Renderer unavailable' }))
      return
    }
    json(res, 201, result)
  })
}

async function handleUpdateNode(
  nodeId: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = await readBody(req)
  if (body === null) {
    res.writeHead(413, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Payload too large' }))
    return
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(body)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  // Fetch the node to get its type for validation
  const existing = (await query('get-node', { id: nodeId }, activeWorkspaceId ?? undefined)) as {
    data?: { type?: string }
  } | null

  if (!existing) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Node ${nodeId} not found` }))
    return
  }

  const nodeType = existing.data?.type ?? ''
  let validatedChanges: Record<string, unknown>
  try {
    validatedChanges = validateNodeChanges(nodeType, parsed)
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: (err as Error).message }))
    return
  }

  await enqueueMutation(async () => {
    const result = await query(
      'update-node',
      { id: nodeId, changes: validatedChanges },
      activeWorkspaceId ?? undefined,
    )
    if (result === null) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Renderer unavailable' }))
      return
    }
    json(res, 200, { success: true })
  })
}

async function handleDeleteNode(nodeId: string, res: http.ServerResponse): Promise<void> {
  await enqueueMutation(async () => {
    const result = await query('delete-node', { id: nodeId }, activeWorkspaceId ?? undefined)
    if (result === null) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Renderer unavailable' }))
      return
    }
    json(res, 200, { success: true })
  })
}

async function handleCreateEdge(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = await readBody(req)
  if (body === null) {
    res.writeHead(413, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Payload too large' }))
    return
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(body)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  if (typeof parsed.source !== 'string' || typeof parsed.target !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: "'source' and 'target' must be strings" }))
    return
  }

  await enqueueMutation(async () => {
    const result = await query('create-edge', parsed, activeWorkspaceId ?? undefined)
    if (result === null) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Renderer unavailable' }))
      return
    }
    json(res, 201, result)
  })
}

async function handleDeleteEdge(edgeId: string, res: http.ServerResponse): Promise<void> {
  await enqueueMutation(async () => {
    const result = await query('delete-edge', { id: edgeId }, activeWorkspaceId ?? undefined)
    if (result === null) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Renderer unavailable' }))
      return
    }
    json(res, 200, { success: true })
  })
}

// ---------------------------------------------------------------------------
// Authentication & Rate Limiting
// ---------------------------------------------------------------------------

function authenticateRequest(req: http.IncomingMessage): boolean {
  const authHeader = req.headers.authorization
  if (!authHeader || !activeToken) return false

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false

  const provided = parts[1]!
  if (provided.length !== activeToken.length) return false

  return crypto.timingSafeEqual(Buffer.from(provided, 'utf-8'), Buffer.from(activeToken, 'utf-8'))
}

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + 1000 })
    return true
  }

  if (bucket.count >= RATE_LIMIT_PER_SECOND) {
    return false
  }

  bucket.count++
  return true
}

// ---------------------------------------------------------------------------
// Single-Flight Mutation Queue
// ---------------------------------------------------------------------------

async function enqueueMutation(fn: () => Promise<void>): Promise<void> {
  if (!mutationInFlight) {
    mutationInFlight = true
    try {
      await fn()
    } finally {
      await drainMutationQueue()
    }
    return
  }

  // Already in flight — queue this one and wait
  return new Promise<void>((resolve, reject) => {
    mutationPending = async () => {
      try {
        await fn()
        resolve()
      } catch (err) {
        reject(err)
      }
    }
  })
}

async function drainMutationQueue(): Promise<void> {
  while (mutationPending) {
    const next = mutationPending
    mutationPending = null
    await next()
  }
  mutationInFlight = false
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBody(req: http.IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let totalSize = 0

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length
      if (totalSize > MAX_BODY_BYTES) {
        req.destroy()
        resolve(null)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(null))
  })
}

function json(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}
