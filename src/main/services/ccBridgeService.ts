/**
 * CC Bridge Dispatch Service — Main Process
 *
 * Lightweight localhost-only HTTP server that Claude Code polls for instructions.
 * Cognograph queues dispatch messages (tasks, context, instructions) and CC
 * picks them up via GET /dispatch/pending, then reports back via POST endpoints.
 *
 * Security:
 * - Binds exclusively to 127.0.0.1 (SEC-F1)
 * - Shared secret required in Authorization header (SEC-F2)
 * - Rate limited per endpoint (SEC-F3)
 * - No CORS headers; rejects requests with Origin header (SEC-F7, SEC-F8)
 * - Dispatch messages are ephemeral (in-memory only, SEC-F6)
 *
 * @module ccBridgeService
 */

import http from 'http'
import { BrowserWindow } from 'electron'
import path from 'path'
import type {
  CCDispatchConfig,
  CCDispatchMessage,
  CCDispatchHealthCheck,
} from '@shared/bridge-types'
import { DEFAULT_CC_DISPATCH_CONFIG } from '@shared/bridge-types'

// -----------------------------------------------------------------------------
// Module State
// -----------------------------------------------------------------------------

let server: http.Server | null = null
let activePort: number | null = null
let startTime: number | null = null
let currentConfig: CCDispatchConfig = { ...DEFAULT_CC_DISPATCH_CONFIG }
let currentProjectDir: string | null = null

/**
 * In-memory dispatch queue. NEVER written to disk.
 * @internal
 */
const dispatchQueue: CCDispatchMessage[] = []

/** Simple in-memory rate limiter: endpoint -> { count, resetAt } */
const rateBuckets: Map<string, { count: number; resetAt: number }> = new Map()

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Start the dispatch HTTP server.
 *
 * @param projectDir - Project root directory for file path validation.
 * @param config - Optional dispatch configuration overrides.
 * @returns Promise resolving to the port the server is listening on, or null on failure.
 */
export function startDispatchServer(
  projectDir: string,
  config?: Partial<CCDispatchConfig>
): Promise<number | null> {
  currentConfig = { ...DEFAULT_CC_DISPATCH_CONFIG, ...config }
  currentProjectDir = projectDir

  if (!currentConfig.dispatchEnabled) {
    console.log('[CCBridgeService] Dispatch is disabled in configuration')
    return Promise.resolve(null)
  }

  if (!currentConfig.sharedSecret) {
    console.error('[CCBridgeService] Shared secret is required but not configured')
    return Promise.resolve(null)
  }

  return tryBindServer(currentConfig.dispatchPort, 0)
}

/**
 * Stop the dispatch server and clear the queue.
 */
export function stopDispatchServer(): void {
  if (server) {
    server.close()
    server = null
  }
  activePort = null
  startTime = null
  dispatchQueue.length = 0
  rateBuckets.clear()
  console.log('[CCBridgeService] Stopped')
}

/**
 * Queue a dispatch message for Claude Code to pick up.
 *
 * @param message - The dispatch message to queue.
 * @returns The queued message (with generated id and timestamps if missing).
 */
export function queueDispatch(message: CCDispatchMessage): CCDispatchMessage {
  // Validate file paths if present (ERR-F7: path traversal prevention)
  if (message.filePaths && currentProjectDir) {
    const resolvedProjectDir = path.resolve(currentProjectDir)
    const validPaths = message.filePaths.filter((fp) => {
      const resolved = path.resolve(fp)
      return resolved.startsWith(resolvedProjectDir)
    })
    if (validPaths.length !== message.filePaths.length) {
      console.warn(
        '[CCBridgeService] Rejected file paths outside project directory:',
        message.filePaths.filter(
          (fp) => !path.resolve(fp).startsWith(path.resolve(currentProjectDir!))
        )
      )
    }
    message.filePaths = validPaths
  }

  // Enforce payload size limit (ERR-F2)
  const contentSize = Buffer.byteLength(message.content, 'utf8')
  if (contentSize > currentConfig.maxPayloadBytes) {
    console.warn(
      `[CCBridgeService] Dispatch content exceeds max payload (${contentSize} > ${currentConfig.maxPayloadBytes}). Truncating.`
    )
    message.content = truncateToByteLimit(message.content, currentConfig.maxPayloadBytes)
  }

  if (message.contextText) {
    const contextSize = Buffer.byteLength(message.contextText, 'utf8')
    if (contextSize > currentConfig.maxContextBytes - contentSize) {
      const maxContextSize = Math.max(0, currentConfig.maxContextBytes - contentSize)
      message.contextText = truncateToByteLimit(message.contextText, maxContextSize)
    }
  }

  // Sanitize credentials from content (SEC-F5)
  message.content = sanitizeCredentials(message.content)
  if (message.contextText) {
    message.contextText = sanitizeCredentials(message.contextText)
  }

  dispatchQueue.push(message)
  notifyRenderer('cc-bridge:dispatch-queued', message)

  return message
}

/**
 * Get all dispatch messages (for renderer-side state sync).
 */
export function getDispatchQueue(): CCDispatchMessage[] {
  return [...dispatchQueue]
}

/**
 * Get the port the dispatch server is actively listening on.
 */
export function getActivePort(): number | null {
  return activePort
}

/**
 * Cancel a pending dispatch by ID.
 */
export function cancelDispatch(dispatchId: string): boolean {
  const idx = dispatchQueue.findIndex((d) => d.id === dispatchId)
  if (idx === -1) return false

  const dispatch = dispatchQueue[idx]!
  if (dispatch.status !== 'pending') return false

  dispatchQueue.splice(idx, 1)
  notifyRenderer('cc-bridge:dispatch-cancelled', { dispatchId })
  return true
}

// -----------------------------------------------------------------------------
// Server Binding
// -----------------------------------------------------------------------------

/**
 * Attempt to bind the HTTP server to a port, with fallback range.
 */
function tryBindServer(port: number, attempt: number): Promise<number | null> {
  return new Promise((resolve) => {
    if (attempt > currentConfig.dispatchPortRange) {
      console.error(
        `[CCBridgeService] Failed to bind to any port in range ${currentConfig.dispatchPort}-${currentConfig.dispatchPort + currentConfig.dispatchPortRange}`
      )
      resolve(null)
      return
    }

    const currentPort = port + attempt

    // Check if another Cognograph instance is already running on this port (ERR-F4)
    checkExistingServer(currentPort)
      .then((isRunning) => {
        if (isRunning) {
          console.warn(
            `[CCBridgeService] Another instance detected on port ${currentPort}, trying next port`
          )
          notifyRenderer('cc-bridge:dispatch-warning', {
            message: `Another Cognograph instance is running the bridge on port ${currentPort}`,
          })
          resolve(tryBindServer(port, attempt + 1))
          return
        }

        const httpServer = http.createServer(handleRequest)

        httpServer.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            console.warn(`[CCBridgeService] Port ${currentPort} in use, trying next`)
            resolve(tryBindServer(port, attempt + 1))
          } else {
            console.error('[CCBridgeService] Server error:', err)
            resolve(null)
          }
        })

        // SEC-F1: Bind exclusively to 127.0.0.1
        httpServer.listen(currentPort, '127.0.0.1', () => {
          server = httpServer
          activePort = currentPort
          startTime = Date.now()
          console.log(`[CCBridgeService] Listening on 127.0.0.1:${currentPort}`)
          resolve(currentPort)
        })
      })
      .catch(() => {
        resolve(tryBindServer(port, attempt + 1))
      })
  })
}

/**
 * Check if another Cognograph dispatch server is running on a given port.
 */
function checkExistingServer(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/status', method: 'GET', timeout: 2000 },
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
      }
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.end()
  })
}

// -----------------------------------------------------------------------------
// Request Handler
// -----------------------------------------------------------------------------

/**
 * Main HTTP request handler. All routes wrapped in try/catch (ERR-F1).
 */
function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  try {
    // SEC-F7: Reject browser requests (no Origin header allowed)
    if (req.headers.origin) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Browser requests are not allowed' }))
      return
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${activePort}`)
    const pathname = url.pathname
    const method = req.method || 'GET'

    // Health check endpoint (no auth required)
    if (pathname === '/status' && method === 'GET') {
      handleStatus(res)
      return
    }

    // SEC-F2: Shared secret authentication required for all other endpoints
    if (!authenticateRequest(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing Bearer token' }))
      return
    }

    // SEC-F3: Rate limiting
    const isPost = method === 'POST'
    const rateKey = `${isPost ? 'POST' : 'GET'}:${pathname}`
    const limit = isPost ? currentConfig.rateLimitPost : currentConfig.rateLimitGet

    if (!checkRateLimit(rateKey, limit)) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Too Many Requests' }))
      return
    }

    // Route dispatch
    if (pathname === '/dispatch/pending' && method === 'GET') {
      handleGetPending(res)
    } else if (pathname.match(/^\/dispatch\/[^/]+\/ack$/) && method === 'POST') {
      const dispatchId = pathname.split('/')[2]!
      handleAcknowledge(dispatchId, req, res)
    } else if (pathname.match(/^\/dispatch\/[^/]+\/complete$/) && method === 'POST') {
      const dispatchId = pathname.split('/')[2]!
      handleComplete(dispatchId, req, res)
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  } catch (err) {
    console.error('[CCBridgeService] Request handler error:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
}

// -----------------------------------------------------------------------------
// Route Handlers
// -----------------------------------------------------------------------------

function handleStatus(res: http.ServerResponse): void {
  const pending = dispatchQueue.filter((d) => d.status === 'pending').length
  const acknowledged = dispatchQueue.filter((d) => d.status === 'acknowledged').length

  const response: CCDispatchHealthCheck = {
    status: 'ok',
    pendingCount: pending,
    acknowledgedCount: acknowledged,
    port: activePort || 0,
    uptime: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(response))
}

function handleGetPending(res: http.ServerResponse): void {
  const pending = dispatchQueue.filter((d) => d.status === 'pending')
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(pending))
}

function handleAcknowledge(
  dispatchId: string,
  _req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  const dispatch = dispatchQueue.find((d) => d.id === dispatchId)
  if (!dispatch) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Dispatch ${dispatchId} not found` }))
    return
  }

  if (dispatch.status !== 'pending') {
    res.writeHead(409, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({ error: `Dispatch ${dispatchId} is ${dispatch.status}, cannot acknowledge` })
    )
    return
  }

  dispatch.status = 'acknowledged'
  dispatch.updatedAt = Date.now()

  notifyRenderer('cc-bridge:dispatch-updated', dispatch)

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ success: true, dispatch }))
}

function handleComplete(
  dispatchId: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  const dispatch = dispatchQueue.find((d) => d.id === dispatchId)
  if (!dispatch) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Dispatch ${dispatchId} not found` }))
    return
  }

  if (dispatch.status !== 'acknowledged') {
    res.writeHead(409, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({ error: `Dispatch ${dispatchId} is ${dispatch.status}, cannot complete` })
    )
    return
  }

  // Read POST body for completion details
  readBody(req).then((body) => {
    try {
      const data = body ? JSON.parse(body) : {}
      dispatch.status = 'completed'
      dispatch.updatedAt = Date.now()
      dispatch.completionMessage = typeof data.message === 'string' ? data.message : undefined

      notifyRenderer('cc-bridge:dispatch-completed', {
        dispatch,
        filesModified: Array.isArray(data.filesModified) ? data.filesModified : [],
      })

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, dispatch }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    }
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to read request body' }))
  })
}

// -----------------------------------------------------------------------------
// Authentication & Rate Limiting
// -----------------------------------------------------------------------------

/**
 * Validate the Bearer token in the Authorization header.
 */
function authenticateRequest(req: http.IncomingMessage): boolean {
  const authHeader = req.headers.authorization
  if (!authHeader) return false

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false

  return parts[1] === currentConfig.sharedSecret
}

/**
 * Simple token-bucket rate limiter. Returns true if request is allowed.
 */
function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (bucket.count >= maxPerMinute) {
    return false
  }

  bucket.count++
  return true
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Read the full request body as a string.
 */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalSize = 0
    const maxSize = currentConfig.maxContextBytes

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length
      if (totalSize > maxSize) {
        req.destroy()
        reject(new Error('Payload too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * Truncate a string to fit within a byte limit, appending a truncation notice.
 */
function truncateToByteLimit(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text

  const suffix = '\n... [content truncated]'
  const suffixBytes = Buffer.byteLength(suffix, 'utf8')
  const availableBytes = maxBytes - suffixBytes

  if (availableBytes <= 0) return suffix.slice(0, maxBytes)

  // Binary search for the character position that fits within available bytes
  let low = 0
  let high = text.length
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2)
    if (Buffer.byteLength(text.slice(0, mid), 'utf8') <= availableBytes) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  return text.slice(0, low) + suffix
}

/**
 * Sanitize credential patterns from text (SEC-F5).
 * Redacts common API key and token formats.
 */
function sanitizeCredentials(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/AKIA[A-Z0-9]{16}/g, '[REDACTED_AWS_KEY]')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/gho_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/xox[bpras]-[a-zA-Z0-9-]{10,}/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g, '[REDACTED_JWT]')
}

/**
 * Send a message to the renderer process via IPC.
 */
function notifyRenderer(channel: string, data: unknown): void {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}
