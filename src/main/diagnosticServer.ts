// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Diagnostic Server - Dev-mode-only HTTP server for Claude Code integration
 *
 * Exposes debugging APIs on localhost:9223 that enable Claude Code to:
 * - Execute JavaScript in renderer
 * - Query Zustand store state
 * - Inspect DOM elements
 * - Stream console output
 * - Profile performance
 *
 * Security: Token + per-boot bootId auth + rate limiting + code validation + dev-only.
 *
 * BootId rotation:
 *   - Each app boot generates a fresh bootId (`crypto.randomBytes(16).toString('hex')`)
 *     and persists it to `app.getPath('userData')/diag-bootId`.
 *   - Auth header is `Authorization: Bearer <token>:<bootId>`. Stale bootIds
 *     (from a prior boot whose state Claude Code still has cached) get a 401
 *     with the directive "stale bootId, restart Claude Code".
 *   - The diag-bootId file is removed on `app.before-quit` so a clean
 *     restart starts fresh; the file existing across an unclean shutdown
 *     does NOT affect security since the in-process bootId is regenerated
 *     anyway, but the next boot's diag-bootId will mismatch any cached
 *     stale value.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'crypto'
import type { BrowserWindow } from 'electron'
import express, { type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'

// Generate ephemeral token (regenerated on every app restart)
const DIAGNOSTIC_TOKEN = process.env.DIAGNOSTIC_TOKEN || crypto.randomBytes(32).toString('hex')

// ---------------------------------------------------------------------------
// BootId persistence
// ---------------------------------------------------------------------------

const BOOT_ID_FILENAME = 'diag-bootId'
const BEARER_FILENAME = 'diag-bearer'

export function bootIdFilePath(userDataDir: string): string {
  return path.join(userDataDir, BOOT_ID_FILENAME)
}

export function bearerFilePath(userDataDir: string): string {
  return path.join(userDataDir, BEARER_FILENAME)
}

export function persistBearer(userDataDir: string, bearer: string): string {
  const filePath = bearerFilePath(userDataDir)
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(filePath, bearer, { encoding: 'utf8', mode: 0o600 })
  try {
    fs.chmodSync(filePath, 0o600)
  } catch {
    // chmod is a no-op on Windows for owner-only restriction; NTFS perms
    // already inherit user-only access from userDataDir.
  }
  return filePath
}

export function clearBearer(userDataDir: string): void {
  try {
    fs.unlinkSync(bearerFilePath(userDataDir))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

/**
 * Generate a fresh bootId and persist it. Overwrites any prior value —
 * bootId rotates per app boot. Returns the new bootId.
 */
export function generateAndPersistBootId(userDataDir: string): string {
  const bootId = crypto.randomBytes(16).toString('hex')
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(bootIdFilePath(userDataDir), bootId, 'utf8')
  return bootId
}

export function readPersistedBootId(userDataDir: string): string | null {
  try {
    const value = fs.readFileSync(bootIdFilePath(userDataDir), 'utf8').trim()
    return value || null
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/**
 * Remove the persisted bootId file. Idempotent — missing file is fine.
 * Wired to `app.before-quit` in index.ts so a clean restart starts fresh.
 */
export function clearBootId(userDataDir: string): void {
  try {
    fs.unlinkSync(bootIdFilePath(userDataDir))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

// ---------------------------------------------------------------------------
// Auth header validation (pure — exported for unit tests)
// ---------------------------------------------------------------------------

export type AuthValidationCode =
  | 'AUTH_OK'
  | 'AUTH_REQUIRED'
  | 'AUTH_BAD_FORMAT'
  | 'AUTH_TOKEN_MISMATCH'
  | 'AUTH_STALE_BOOT_ID'

export interface AuthValidation {
  valid: boolean
  code: AuthValidationCode
  reason?: string
}

/**
 * Validate the `Authorization: Bearer <token>:<bootId>` header against the
 * current process token + bootId. Returns a typed verdict; the express
 * middleware maps the verdict to a 401 response with the suggestion.
 *
 * Pure function — does not read environment, files, or network. Test-friendly.
 */
export function validateAuthHeader(
  header: string | undefined,
  expectedToken: string,
  expectedBootId: string,
): AuthValidation {
  if (!header) {
    return { valid: false, code: 'AUTH_REQUIRED', reason: 'missing Authorization header' }
  }
  const match = /^Bearer\s+([^:\s]+):([^:\s]+)\s*$/i.exec(header)
  if (!match) {
    return {
      valid: false,
      code: 'AUTH_BAD_FORMAT',
      reason: 'expected `Authorization: Bearer <token>:<bootId>`',
    }
  }
  const [, presentedToken, presentedBootId] = match
  if (presentedToken !== expectedToken) {
    return { valid: false, code: 'AUTH_TOKEN_MISMATCH', reason: 'token mismatch' }
  }
  if (presentedBootId !== expectedBootId) {
    return {
      valid: false,
      code: 'AUTH_STALE_BOOT_ID',
      reason: 'stale bootId, restart Claude Code',
    }
  }
  return { valid: true, code: 'AUTH_OK' }
}

// Sensitive field names to redact from responses
const SENSITIVE_KEYS = ['apiKey', 'password', 'token', 'secret', 'credential', 'apikey']

/**
 * Validate JavaScript code before execution
 * Blocks dangerous operations: require, import, function constructors
 */
function validateCode(code: string): { valid: boolean; error?: string } {
  if (code.length > 10000) {
    return { valid: false, error: 'Code too long (max 10KB)' }
  }

  if (code.includes('require(') || code.includes('import ')) {
    return { valid: false, error: 'Module imports not allowed' }
  }

  // Block dangerous dynamic code execution patterns
  if (code.match(/\beval\b|\bFunction\b/)) {
    return { valid: false, error: 'Dynamic code execution not allowed' }
  }

  return { valid: true }
}

/**
 * Redact sensitive data from objects
 * Hides API keys, passwords, tokens, etc.
 */
function redactSecrets(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') {
    // Value-based redaction: check if string looks like an API key
    if (typeof obj === 'string') {
      if (obj.match(/^sk-[a-zA-Z0-9]{32,}$/)) return '[REDACTED_API_KEY]'
      if (obj.match(/^Bearer [a-zA-Z0-9._-]+$/)) return '[REDACTED_TOKEN]'
      if (obj.length > 32 && !obj.includes(' ')) return '[REDACTED_LONG_STRING]'
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSecrets(item))
  }

  const redacted: any = {}
  for (const key of Object.keys(obj)) {
    // Key-based redaction: check if field name contains sensitive words
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      redacted[key] = '[REDACTED]'
    } else if (typeof obj[key] === 'object') {
      redacted[key] = redactSecrets(obj[key])
    } else {
      redacted[key] = redactSecrets(obj[key])
    }
  }
  return redacted
}

/**
 * Start diagnostic server (dev mode only).
 *
 * @param mainWindow Active BrowserWindow used for renderer probing.
 * @param userDataDir `app.getPath('userData')` from the caller. Required so
 *                    this module stays free of a runtime dependency on
 *                    Electron's `app` (the type-only `BrowserWindow` import
 *                    is fine; pulling in the full `electron` value would
 *                    break vitest unit tests of the helpers above).
 *                    The bootId is persisted to `<userDataDir>/diag-bootId`.
 */
export function startDiagnosticServer(mainWindow: BrowserWindow, userDataDir: string): void {
  // DEV MODE CHECK - refuse to start in production
  if (!import.meta.env.DEV && process.env.NODE_ENV !== 'development') {
    throw new Error('Diagnostic server only available in development')
  }

  // Allow disable via env var
  if (process.env.DISABLE_DIAGNOSTIC_SERVER === '1') {
    console.log('⚠️  Diagnostic server disabled (DISABLE_DIAGNOSTIC_SERVER=1)')
    return
  }

  // Generate bootId per-boot and persist for the cleanup hook to detect
  // unclean shutdowns (a leftover diag-bootId file from a prior boot is
  // overwritten here, so a stale Claude Code cache always misses).
  const currentBootId = generateAndPersistBootId(userDataDir)

  const app = express()
  app.use(express.json({ limit: '1mb' }))

  // SECURITY: Token + bootId authentication on every request.
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const result = validateAuthHeader(req.headers.authorization, DIAGNOSTIC_TOKEN, currentBootId)
    if (!result.valid) {
      res.status(401).json({
        error: 'Unauthorized',
        code: result.code,
        suggestion: result.reason,
      })
      return
    }
    next()
  })

  // SECURITY: Rate limiting (configurable, default 120/min for dev/test use)
  const maxRequests = parseInt(process.env.DIAGNOSTIC_RATE_LIMIT || '120', 10)
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: maxRequests,
    message: {
      error: `Too many requests. Max ${maxRequests}/minute.`,
      code: 'RATE_LIMIT',
      suggestion: 'Wait 60 seconds before retrying',
    },
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use(limiter)

  // Tool 1: Health check
  app.get('/ping', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      latency: 0,
      appVersion: '1.5.3', // TODO: Get from app
      electronVersion: process.versions.electron,
      timestamp: Date.now(),
    })
  })

  // Tool 2: Execute JavaScript
  app.post('/execute', async (req: Request, res: Response) => {
    const { code, timeout = 5000 } = req.body

    // Validate code
    const validation = validateCode(code)
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        code: 'VALIDATION_ERROR',
        suggestion: 'Check code for forbidden operations (require, import, Function constructor)',
      })
    }

    // Validate timeout
    if (timeout > 30000) {
      return res.status(400).json({
        error: 'Timeout too long (max 30000ms)',
        code: 'INVALID_TIMEOUT',
      })
    }

    const startTime = Date.now()
    try {
      // Execute with timeout
      const result = await Promise.race([
        mainWindow.webContents.executeJavaScript(code, true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
      ])

      const executionTime = Date.now() - startTime
      return res.json({ result, executionTime })
    } catch (error: any) {
      const executionTime = Date.now() - startTime
      return res.status(500).json({
        error: error.message,
        code: error.message.includes('Timeout') ? 'TIMEOUT' : 'EXECUTION_ERROR',
        executionTime,
        suggestion: error.message.includes('Timeout')
          ? 'Code may have infinite loop. Try simpler query or increase timeout.'
          : 'Check renderer console for error details',
      })
    }
  })

  // Tool 3: Get Zustand store state
  app.get('/store/:name', async (req: Request, res: Response) => {
    const { name } = req.params
    const { path, redact = 'true' } = req.query

    try {
      const code = path
        ? `window.${name}Store?.getState()?.${path}`
        : `window.${name}Store?.getState()`

      const state = await mainWindow.webContents.executeJavaScript(code, true)

      if (state === undefined || state === null) {
        return res.status(404).json({
          error: `Store '${name}' not found or path invalid`,
          code: 'STORE_NOT_FOUND',
          suggestion: `Available stores: workspace, theme, ai, extraction, orchestrator, ccBridge`,
        })
      }

      const result = redact === 'true' ? redactSecrets(state) : state
      return res.json({ result })
    } catch (error: any) {
      return res.status(500).json({
        error: error.message,
        code: 'STORE_ERROR',
        suggestion: 'Check if store name is correct and path is valid',
      })
    }
  })

  // Tool 4: Query DOM
  app.post('/dom', async (req: Request, res: Response) => {
    const { selector, method = 'querySelectorAll', properties: _properties = [] } = req.body

    try {
      // Build code safely (escape selector with JSON.stringify to prevent XSS)
      const code =
        method === 'querySelector'
          ? `(() => {
              const el = document.querySelector(${JSON.stringify(selector)})
              if (!el) return null
              return {
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                textContent: el.textContent?.slice(0, 100)
              }
            })()`
          : `JSON.stringify(Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map(el => ({
              tagName: el.tagName,
              className: el.className,
              id: el.id,
              textContent: el.textContent?.slice(0, 100)
            })))`

      const result = await mainWindow.webContents.executeJavaScript(code, true)
      return res.json({ result: method === 'querySelectorAll' ? JSON.parse(result) : result })
    } catch (error: any) {
      return res.status(500).json({
        error: error.message,
        code: 'DOM_ERROR',
        suggestion: 'Check if selector is valid CSS selector syntax',
      })
    }
  })

  // Tool 5: Get computed styles
  app.post('/styles', async (req: Request, res: Response) => {
    const { selector, properties = [] } = req.body

    try {
      // Build code safely (escape selector and properties with JSON.stringify)
      const code = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return null
        const styles = getComputedStyle(el)
        ${
          properties.length > 0
            ? `return { ${properties.map((p: string) => `${JSON.stringify(p)}: styles.getPropertyValue(${JSON.stringify(p)})`).join(', ')} }`
            : `return Object.fromEntries([...styles].map(k => [k, styles.getPropertyValue(k)]))`
        }
      })()`

      const result = await mainWindow.webContents.executeJavaScript(code, true)
      if (result === null) {
        return res.status(404).json({
          error: 'Element not found',
          code: 'ELEMENT_NOT_FOUND',
          suggestion: `Selector '${selector}' did not match any elements`,
        })
      }

      return res.json({ result })
    } catch (error: any) {
      return res.status(500).json({
        error: error.message,
        code: 'STYLES_ERROR',
        suggestion: 'Check if selector is valid and element exists',
      })
    }
  })

  // Tool 6: Performance tracing
  app.post('/trace', async (req: Request, res: Response) => {
    const { action, duration = 5000 } = req.body

    if (action === 'start') {
      try {
        await mainWindow.webContents.debugger.attach('1.3')
        await mainWindow.webContents.debugger.sendCommand('Profiler.enable')
        await mainWindow.webContents.debugger.sendCommand('Profiler.start')

        res.json({
          status: 'tracing',
          traceId: `trace_${Date.now()}`,
          duration,
        })

        // Auto-stop after duration
        if (duration) {
          setTimeout(async () => {
            try {
              await mainWindow.webContents.debugger.sendCommand('Profiler.stop')
              await mainWindow.webContents.debugger.detach()
            } catch (e) {
              console.error('Auto-stop trace failed:', e)
            }
          }, duration)
        }
        return
      } catch (error: any) {
        return res.status(500).json({
          error: error.message,
          code: 'TRACE_START_ERROR',
          suggestion: 'Debugger may already be attached. Try stopping existing trace first.',
        })
      }
    } else if (action === 'stop') {
      try {
        const profile = await mainWindow.webContents.debugger.sendCommand('Profiler.stop')
        await mainWindow.webContents.debugger.detach()

        // Simplified profile summary
        return res.json({
          traceId: `trace_${Date.now()}`,
          profile: profile.profile, // Full profile data
          summary: 'Profile captured successfully',
        })
      } catch (error: any) {
        return res.status(500).json({
          error: error.message,
          code: 'TRACE_STOP_ERROR',
          suggestion: 'No active trace. Call with action=start first.',
        })
      }
    } else {
      return res.status(400).json({
        error: 'Invalid action',
        code: 'INVALID_ACTION',
        suggestion: 'action must be "start" or "stop"',
      })
    }
  })

  // Tool 7: Screenshot — returns PNG as base64
  app.get('/screenshot', async (_req: Request, res: Response) => {
    try {
      const image = await mainWindow.webContents.capturePage()
      const pngBuffer = image.toPNG()
      res.json({
        screenshot: pngBuffer.toString('base64'),
        width: image.getSize().width,
        height: image.getSize().height,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message, code: 'SCREENSHOT_ERROR' })
    }
  })

  // Tool 8: Save screenshot to file
  app.post('/screenshot', async (req: Request, res: Response) => {
    const { path: filePath } = req.body
    if (!filePath) {
      res.status(400).json({ error: 'path required' })
      return
    }
    try {
      const image = await mainWindow.webContents.capturePage()
      const fs = await import('fs')
      fs.writeFileSync(filePath, image.toPNG())
      res.json({ saved: filePath, width: image.getSize().width, height: image.getSize().height })
    } catch (error: any) {
      res.status(500).json({ error: error.message, code: 'SCREENSHOT_SAVE_ERROR' })
    }
  })

  // Start server on localhost only (not 0.0.0.0!)
  const PORT = process.env.DIAGNOSTIC_PORT ? parseInt(process.env.DIAGNOSTIC_PORT, 10) : 9223
  app.listen(PORT, '127.0.0.1', () => {
    const bearer = `${DIAGNOSTIC_TOKEN}:${currentBootId}`
    let bearerPath: string | null = null
    try {
      bearerPath = persistBearer(userDataDir, bearer)
    } catch {
      // If we can't write the file we still need to surface the bearer somehow;
      // print a partial fingerprint instead of the full secret so terminal
      // recordings / shared screens don't capture the live auth value.
    }
    console.log('\n🔐 Diagnostic Server Started')
    console.log(`   URL: http://127.0.0.1:${PORT}`)
    if (bearerPath) {
      console.log(`   Auth: Bearer in ${bearerPath} (mode 0600, rotates per boot)`)
    } else {
      const fp = `${DIAGNOSTIC_TOKEN.slice(0, 4)}…${DIAGNOSTIC_TOKEN.slice(-4)}:${currentBootId.slice(0, 4)}…`
      console.log(
        `   Auth: Bearer fingerprint ${fp} (full value not printed; bearer-file write failed)`,
      )
    }
    console.log('   MCP server reads the file directly; do not paste the bearer into chat\n')
  })
}
