// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// Sentry error tracking — init before anything else so crashes during startup are captured.
// Requires: npm install @sentry/electron (already in package.json)
import * as Sentry from '@sentry/electron/main'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
  })
}

import './earlyInit'

// ---------------------------------------------------------------------------
// Startup Profiler (Phase 6A — MONITORING)
// ---------------------------------------------------------------------------
// Tracks timing for startup phases: app-ready → window-created →
// workspace-loaded → plugins-loaded → ready.
// Production: Sentry startSpan if available. Development: performance.mark/measure.
// ---------------------------------------------------------------------------

const startupMarks = new Map<string, number>()

function markStartup(phase: string): void {
  const now = performance.now()
  startupMarks.set(phase, now)

  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // Sentry transaction-based spans for production telemetry.
    // Sentry.startSpan is available in @sentry/electron >=8 —
    // wrap in try/catch so missing API doesn't break startup.
    try {
      const sentryAny = Sentry as Record<string, unknown>
      if (typeof sentryAny.addBreadcrumb === 'function') {
        Sentry.addBreadcrumb({
          category: 'startup',
          message: `startup:${phase}`,
          level: 'info',
          data: { ms: Math.round(now) },
        })
      }
    } catch {
      // Sentry API mismatch — silently continue
    }
  } else {
    // Development: performance marks for DevTools timeline
    try {
      performance.mark(`startup:${phase}`)
    } catch {
      // performance.mark not available in all envs
    }
    console.log(`[Startup] ${phase}: ${Math.round(now)}ms`)
  }
}

function measureStartup(name: string, from: string, to: string): void {
  const fromMs = startupMarks.get(from)
  const toMs = startupMarks.get(to)
  if (fromMs == null || toMs == null) return

  const duration = toMs - fromMs

  if (process.env.NODE_ENV !== 'production') {
    try {
      performance.measure(`startup:${name}`, `startup:${from}`, `startup:${to}`)
    } catch {
      // marks may not exist if performance.mark failed earlier
    }
    console.log(`[Startup] ${name}: ${Math.round(duration)}ms (${from} → ${to})`)
  }
}

import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { destroyPlugins, emitPluginEvent, loadPlugins, setMainWindow } from '@plugins/registry'
import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { promises as fs } from 'fs'
import {
  join,
  isAbsolute as pathIsAbsolute,
  relative as pathRelative,
  resolve as pathResolve,
} from 'path'
import { abortAllRequests, registerAgentHandlers } from './agent/claudeAgent'
import { registerFilesystemHandlers } from './agent/filesystemTools'
import { registerAIEditorHandlers } from './aiEditor'
import { registerAttachmentHandlers } from './attachments'
import { registerBackupHandlers } from './backupManager'
import { registerConnectorHandlers } from './connectors'
import { registerConversationPersistenceHandlers } from './ipc/conversationPersistence'
import { registerFolderHandlers } from './ipc/folderHandler'
import {
  CredentialsDeleteSchema,
  CredentialsGetMaskedSchema,
  CredentialsGetRealSchema,
  CredentialsListSchema,
  CredentialsSetSchema,
} from './ipc/schemas'
import { registerLLMHandlers } from './llm'
import { createMCPServer, FileSyncProvider } from './mcp'
import { disconnectAllMCPServers, registerMCPClientHandlers } from './mcp/mcpClient'
import {
  registerDeepLinkProtocol,
  registerMultiplayerHandlers,
  setupDeepLinkListeners,
} from './multiplayer'
import { registerOrchestratorHandlers } from './orchestratorHandlers'
import {
  getEventHistory,
  startActivityWatcher,
  stopActivityWatcher,
} from './services/activityWatcher'
import { registerAuditHandlers } from './services/auditService'
import {
  cancelDispatch,
  getActivePort,
  getDispatchQueue,
  queueDispatch,
  startDispatchServer,
  stopDispatchServer,
} from './services/ccBridgeService'
import { getLogBuffer } from './services/consoleForwarder'
import {
  deleteCredential,
  getMaskedCredential,
  getRealCredential,
  listCredentials,
  setCredential,
} from './services/credentialStore'
import {
  registerGraphIntelligenceHandlers,
  registerSnapshotResponseHandler,
} from './services/graphIntelligence'
import { stopBridge as stopMcpBridge } from './services/mcpBridge'
import { workflowSync } from './services/notionSync'
import { registerNotionHandlers } from './services/registerNotionHandlers'
import { registerTerminalHandlers } from './services/registerTerminalHandlers'
import { killAll as killAllTerminals } from './services/terminalManager'
import { registerSettingsHandlers } from './settings'
import { registerTemplateHandlers } from './templates'
import { logger } from './utils/logger'
import { registerWorkspaceHandlers } from './workspace'

// -----------------------------------------------------------------------------
// Active Workspace Tracking (SEC-0.1i)
// -----------------------------------------------------------------------------

/**
 * The currently active workspace ID. Set when a workspace is loaded or saved.
 * Used to validate that credential IPC requests target the active workspace only.
 */
let activeWorkspaceId: string | null = null

/**
 * Set the active workspace ID. Called from workspace load/save handlers.
 * @internal Exported for testing only.
 */
export function setActiveWorkspaceId(workspaceId: string | null): void {
  activeWorkspaceId = workspaceId
}

/**
 * Get the active workspace ID.
 * @internal Exported for testing only.
 */
export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId
}

// Catch unhandled promise rejections to prevent silent crashes
process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled promise rejection:', reason)
})

// Check for MCP mode flags
const isMCPStandalone = process.argv.includes('--mcp-standalone')
const isMCPEmbedded = process.argv.includes('--mcp-server')
const isTestMode = process.env.NODE_ENV === 'test'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d0d14',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  // Content Security Policy (relaxed for development, strict in production)
  // Development needs 'unsafe-inline' and 'unsafe-eval' for Vite HMR
  const isDev = !app.isPackaged
  const cspPolicy = isDev
    ? "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: https: blob:; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "connect-src 'self' http://localhost:* ws://localhost:* https:; " +
      "frame-src 'self' http://localhost:*; " +
      "media-src 'self' blob:"
    : "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "connect-src 'self' https:; " +
      "frame-src 'self'; " +
      "media-src 'self' blob:"

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy],
      },
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Resolve the workspace file path for MCP modes.
 * Checks --workspace-path flag, then falls back to last opened workspace.
 */
async function resolveWorkspacePath(): Promise<string | null> {
  const workspacesDir = join(app.getPath('userData'), 'workspaces')

  /**
   * Validate that a resolved path stays within the workspaces directory.
   * Prevents path traversal via malicious --workspace-path or --workspace-id arguments.
   */
  function isWithinWorkspacesDir(resolvedPath: string): boolean {
    const normalizedPath = pathResolve(resolvedPath)
    const normalizedDir = pathResolve(workspacesDir)
    const rel = pathRelative(normalizedDir, normalizedPath)
    // If relative path starts with ".." or is absolute, it escapes the dir
    return !rel.startsWith('..') && !pathIsAbsolute(rel)
  }

  // Check for explicit workspace path flag
  const pathIdx = process.argv.indexOf('--workspace-path')
  const pathArg = pathIdx !== -1 ? process.argv[pathIdx + 1] : undefined
  if (pathArg) {
    const resolved = pathResolve(pathArg)
    // Explicit path: must be within workspaces dir
    if (!isWithinWorkspacesDir(resolved)) {
      console.error(`[MCP] Workspace path rejected — outside workspaces directory: ${resolved}`)
      return null
    }
    return resolved
  }

  // Check for workspace ID flag
  const idIdx = process.argv.indexOf('--workspace-id')
  const idArg = idIdx !== -1 ? process.argv[idIdx + 1] : undefined
  if (idArg) {
    // Sanitize ID: only allow alphanumeric, hyphens, underscores
    if (!/^[\w-]+$/.test(idArg)) {
      console.error(`[MCP] Invalid workspace ID: ${idArg}`)
      return null
    }
    const resolved = join(workspacesDir, `${idArg}.json`)
    if (!isWithinWorkspacesDir(resolved)) {
      console.error(`[MCP] Workspace ID resolves outside workspaces directory: ${resolved}`)
      return null
    }
    return resolved
  }

  // Fall back to last opened workspace from settings
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    const settingsContent = await fs.readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(settingsContent)
    if (settings.lastWorkspaceId) {
      return join(workspacesDir, `${settings.lastWorkspaceId}.json`)
    }
  } catch {
    // No settings file or no last workspace
  }

  return null
}

/**
 * Start MCP server in embedded or standalone mode.
 */
async function startMCPMode(): Promise<void> {
  const workspacePath = await resolveWorkspacePath()
  if (!workspacePath) {
    console.error('[MCP] No workspace found. Use --workspace-path or --workspace-id.')
    if (isMCPStandalone) process.exit(1)
    return
  }

  try {
    await fs.access(workspacePath)
  } catch {
    console.error(`[MCP] Workspace file not found: ${workspacePath}`)
    if (isMCPStandalone) process.exit(1)
    return
  }

  console.error(`[MCP] Loading workspace: ${workspacePath}`)

  const provider = new FileSyncProvider(workspacePath)
  await provider.load()

  console.error(`[MCP] Workspace loaded: ${provider.getWorkspaceName()}`)

  const server = await createMCPServer(provider)

  // Graceful shutdown for standalone mode
  if (isMCPStandalone) {
    const shutdown = async (): Promise<void> => {
      console.error('[MCP] Shutting down...')
      await provider.flush()
      provider.close()
      await server.close()
      app.quit()
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  }
}

// Register deep link protocol before app is ready
registerDeepLinkProtocol()

// Ensure single instance for deep link handling on Windows/Linux
// Skip in test mode — E2E tests launch a separate instance while the dev app may be running
if (!isTestMode && !app.requestSingleInstanceLock()) {
  logger.log('[Main] Another instance is running. Quitting.')
  app.quit()
}

app.whenReady().then(async () => {
  markStartup('app-ready')
  electronApp.setAppUserModelId('com.cognograph')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers (skip in standalone mode - no window to talk to)
  if (!isMCPStandalone) {
    registerWorkspaceHandlers()
    registerSettingsHandlers()
    registerLLMHandlers()
    registerTemplateHandlers()
    registerAIEditorHandlers()
    registerAgentHandlers()
    registerFilesystemHandlers()
    registerFolderHandlers()
    registerAttachmentHandlers()
    registerConnectorHandlers()
    registerMultiplayerHandlers()
    registerBackupHandlers()
    registerOrchestratorHandlers()
    registerMCPClientHandlers()
    registerAuditHandlers()
    registerGraphIntelligenceHandlers()
    registerSnapshotResponseHandler()
    registerNotionHandlers()
    registerTerminalHandlers()
    registerConversationPersistenceHandlers()
    setupDeepLinkListeners()

    // Initialize Notion sync (replay queue from previous session)
    workflowSync.initialize().catch((err) => {
      console.error('[Main] Failed to initialize Notion sync:', err)
    })

    // Register CC Bridge IPC handlers
    ipcMain.handle('cc-bridge:getHistory', (_event, limit?: number) => {
      return getEventHistory(limit ?? 100)
    })

    ipcMain.handle('cc-bridge:dispatchTask', (_event, message) => {
      try {
        const result = queueDispatch(message)
        return { success: true, dispatch: result }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    })

    ipcMain.handle('cc-bridge:getDispatchQueue', () => {
      return getDispatchQueue()
    })

    ipcMain.handle('cc-bridge:cancelDispatch', (_event, dispatchId: string) => {
      const success = cancelDispatch(dispatchId)
      return { success, error: success ? undefined : 'Dispatch not found or not pending' }
    })

    ipcMain.handle('cc-bridge:getDispatchPort', () => {
      return getActivePort()
    })

    ipcMain.handle('cc-bridge:startDispatchServer', async () => {
      try {
        // Read config from settings
        const settingsPath = join(app.getPath('userData'), 'settings.json')
        let dispatchConfig = {}
        try {
          const settingsContent = await fs.readFile(settingsPath, 'utf-8')
          const settings = JSON.parse(settingsContent)
          if (settings.ccDispatch) {
            dispatchConfig = settings.ccDispatch
          }
        } catch {
          // Settings may not exist yet
        }

        const port = await startDispatchServer(process.cwd(), dispatchConfig)
        if (port) {
          return { success: true, port }
        }
        return { success: false, error: 'Failed to start dispatch server' }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    })

    ipcMain.handle('cc-bridge:stopDispatchServer', () => {
      stopDispatchServer()
      return { success: true }
    })

    // -------------------------------------------------------------------------
    // Credential Store IPC handlers (SEC-0.1i: workspace validation)
    // -------------------------------------------------------------------------
    // Block renderer access to plugin credentials (workspaceId starting with '__').
    // Plugin credentials are only accessible through plugin:call pathway.
    // SEC-0.1i: Validate that requested workspaceId matches the active workspace.

    // Initialize active workspace ID from persisted settings on startup
    try {
      const settingsPath = join(app.getPath('userData'), 'settings.json')
      const settingsContent = await fs.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(settingsContent)
      if (settings.lastWorkspaceId) {
        setActiveWorkspaceId(settings.lastWorkspaceId)
        console.log(`[Credentials] Active workspace initialized: ${settings.lastWorkspaceId}`)
      }
    } catch {
      // No settings yet — activeWorkspaceId stays null until workspace is loaded
    }

    // Allow renderer to notify main process of workspace changes
    ipcMain.handle('credentials:setActiveWorkspace', (_event, workspaceId: string) => {
      if (typeof workspaceId === 'string' && workspaceId.length > 0) {
        setActiveWorkspaceId(workspaceId)
        return { success: true }
      }
      return { success: false, error: 'Invalid workspace ID' }
    })

    ipcMain.handle(
      'credentials:set',
      (
        _event,
        workspaceId: string,
        credentialKey: string,
        value: string,
        label: string,
        credentialType: string,
      ) => {
        // Zod validation (SEC-0.1j)
        const parsed = CredentialsSetSchema.safeParse({
          workspaceId,
          credentialKey,
          value,
          label,
          credentialType,
        })
        if (!parsed.success) {
          return {
            success: false,
            error: `Validation failed: ${parsed.error.issues[0]?.message || 'Invalid input'}`,
          }
        }

        if (workspaceId.startsWith('__')) {
          return { success: false, error: 'Reserved namespace' }
        }

        // SEC-0.1i: Reject cross-workspace credential access
        if (activeWorkspaceId && workspaceId !== activeWorkspaceId) {
          return { success: false, error: 'Cross-workspace credential access denied' }
        }

        try {
          setCredential(workspaceId, credentialKey, value, label, credentialType)
          return { success: true }
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to store credential',
          }
        }
      },
    )

    ipcMain.handle(
      'credentials:getMasked',
      (_event, workspaceId: string, credentialKey: string) => {
        // Zod validation (SEC-0.1j)
        const parsed = CredentialsGetMaskedSchema.safeParse({ workspaceId, credentialKey })
        if (!parsed.success) return null

        if (workspaceId.startsWith('__')) return null // Silent deny
        // SEC-0.1i: Reject cross-workspace credential access
        if (activeWorkspaceId && workspaceId !== activeWorkspaceId) return null
        return getMaskedCredential(workspaceId, credentialKey)
      },
    )

    ipcMain.handle('credentials:getReal', (_event, workspaceId: string, credentialKey: string) => {
      // Zod validation (SEC-0.1j)
      const parsed = CredentialsGetRealSchema.safeParse({ workspaceId, credentialKey })
      if (!parsed.success) return null

      if (workspaceId.startsWith('__')) return null // Silent deny

      // SEC-0.1i: Reject cross-workspace credential access
      if (activeWorkspaceId && workspaceId !== activeWorkspaceId) return null

      return getRealCredential(workspaceId, credentialKey)
    })

    ipcMain.handle('credentials:delete', (_event, workspaceId: string, credentialKey: string) => {
      // Zod validation (SEC-0.1j)
      const parsed = CredentialsDeleteSchema.safeParse({ workspaceId, credentialKey })
      if (!parsed.success) {
        return {
          success: false,
          error: `Validation failed: ${parsed.error.issues[0]?.message || 'Invalid input'}`,
        }
      }

      if (workspaceId.startsWith('__')) {
        return { success: false, error: 'Reserved namespace' }
      }
      // SEC-0.1i: Reject cross-workspace credential access
      if (activeWorkspaceId && workspaceId !== activeWorkspaceId) {
        return { success: false, error: 'Cross-workspace credential access denied' }
      }
      try {
        deleteCredential(workspaceId, credentialKey)
        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to delete credential',
        }
      }
    })

    ipcMain.handle('credentials:list', (_event, workspaceId: string) => {
      // Zod validation (SEC-0.1j)
      const parsed = CredentialsListSchema.safeParse({ workspaceId })
      if (!parsed.success) return []

      if (workspaceId.startsWith('__')) return [] // Silent deny
      // SEC-0.1i: Reject cross-workspace credential access
      if (activeWorkspaceId && workspaceId !== activeWorkspaceId) return []
      return listCredentials(workspaceId)
    })

    // Main process console log buffer — renderer fetches on mount
    ipcMain.handle('main-process-log:getBuffer', () => getLogBuffer())

    markStartup('workspace-loaded')
  }

  if (isMCPStandalone) {
    // Standalone MCP mode: no window, just the server
    try {
      await startMCPMode()
    } catch (err) {
      console.error('[MCP] Failed to start:', err)
      process.exit(1)
    }
  } else {
    // Normal app mode
    createWindow()
    markStartup('window-created')

    // ------------------------------------------------------------------
    // Synchronous setup (must complete before async work)
    // ------------------------------------------------------------------

    // Preview iframe security filter (defense-in-depth)
    // Block navigation from preview iframes to non-localhost URLs.
    // Renderer-side validation is first line; this is the second line
    // that catches redirects after initial load.
    const ALLOWED_PREVIEW_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (details, callback) => {
        // Only filter sub-frame requests (iframes). Top-level navigation
        // (the app itself, dev server HMR) must not be blocked.
        if (details.resourceType === 'subFrame') {
          try {
            const url = new URL(details.url)
            if (ALLOWED_PREVIEW_HOSTS.has(url.hostname)) {
              callback({ cancel: false })
            } else {
              console.warn(`[Preview Security] Blocked iframe navigation to: ${details.url}`)
              callback({ cancel: true })
            }
          } catch {
            // Invalid URL — block it
            callback({ cancel: true })
          }
        } else {
          // Not an iframe request — allow it
          callback({ cancel: false })
        }
      },
    )

    // Start Claude Code activity watcher (observes .cognograph-activity/events.jsonl)
    // Skip in test mode — file watchers hang shutdown
    if (!isTestMode) {
      try {
        startActivityWatcher(process.cwd())
      } catch (err) {
        console.error('[ActivityWatcher] Failed to start:', err)
      }
    }

    // Start diagnostic server (dev mode only, not in test)
    // Fire-and-forget — no need to await
    if (is.dev && mainWindow && !isTestMode) {
      import('./diagnosticServer')
        .then(({ startDiagnosticServer }) => {
          startDiagnosticServer(mainWindow!)
        })
        .catch((err) => {
          console.error('[DiagnosticServer] Failed to start:', err)
        })
    }

    // ------------------------------------------------------------------
    // Parallel async startup (ARCH-FOUND 1.4a)
    // These operations are independent — run them concurrently with
    // Promise.allSettled so a failure in one doesn't block the others.
    // ------------------------------------------------------------------
    const startupTasks: Promise<unknown>[] = []

    // Auto-updater (production only)
    if (!is.dev && mainWindow) {
      startupTasks.push(
        import('electron-updater')
          .then(({ autoUpdater }) => {
            autoUpdater.logger = logger as any
            autoUpdater.autoDownload = false // Don't auto-download, just notify

            autoUpdater.on('update-available', (info) => {
              logger.log(`[AutoUpdate] Update available: ${info.version}`)
              mainWindow?.webContents.send('auto-update:available', { version: info.version })
            })
            autoUpdater.on('update-downloaded', (info) => {
              logger.log(`[AutoUpdate] Update downloaded: ${info.version}`)
              mainWindow?.webContents.send('auto-update:downloaded', { version: info.version })
            })
            autoUpdater.on('error', (err) => {
              // Don't crash on update errors — just log and continue
              logger.log(`[AutoUpdate] Error: ${err.message}`)
            })
            autoUpdater.on('update-not-available', () => {
              logger.log('[AutoUpdate] No updates available')
            })

            // Check for updates silently (won't throw if no publish config)
            return autoUpdater.checkForUpdatesAndNotify().catch((err) => {
              logger.log(
                `[AutoUpdate] Check failed (expected if no publish config): ${err.message}`,
              )
            })
          })
          .catch((err) => {
            // electron-updater may not be available in all builds
            logger.log(`[AutoUpdate] Init skipped: ${(err as Error).message}`)
          }),
      )
    }

    // Embedded MCP server
    if (isMCPEmbedded) {
      startupTasks.push(
        startMCPMode().catch((err) => {
          console.error('[MCP] Failed to start embedded MCP:', err)
        }),
      )
    }

    // Plugin loading
    if (mainWindow && !isTestMode) {
      setMainWindow(mainWindow)
      startupTasks.push(
        loadPlugins().then(() => {
          markStartup('plugins-loaded')
          emitPluginEvent('app:ready', {})
        }),
      )
    }

    // Wait for all independent startup tasks to settle
    if (startupTasks.length > 0) {
      await Promise.allSettled(startupTasks)
    }

    // Final startup mark — all phases complete
    markStartup('ready')
    measureStartup('total', 'app-ready', 'ready')
    measureStartup('window-creation', 'app-ready', 'window-created')
    measureStartup('ipc-registration', 'window-created', 'workspace-loaded')
    if (startupMarks.has('plugins-loaded')) {
      measureStartup('plugin-loading', 'workspace-loaded', 'plugins-loaded')
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && !isMCPStandalone) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!isMCPStandalone) {
      app.quit()
    }
  }
})

// Clean up activity watcher, dispatch server, terminals, bridge, and MCP client connections on quit
app.on('before-quit', () => {
  // Abort all active agent requests (Phase B1 — Final-8)
  abortAllRequests()
  stopActivityWatcher()
  stopDispatchServer()
  killAllTerminals()
  stopMcpBridge() // Closes bridge HTTP server, deletes port file
  disconnectAllMCPServers().catch((err) => {
    console.error('[MCPClient] Error during shutdown cleanup:', err)
  })
})

// Plugin destroy needs async cleanup, so we use 'will-quit' (fires after 'before-quit' and windows close).
// Lifecycle: before-quit → windows close → will-quit → quit
// The guard flag prevents will-quit from re-firing when we call app.quit().
// Skip in test mode — plugins weren't loaded, so nothing to destroy.
let pluginsDestroyed = false
app.on('will-quit', (e) => {
  if (isTestMode) return // No plugins to clean up
  if (!pluginsDestroyed) {
    e.preventDefault()
    emitPluginEvent('app:quit', {}) // Fire before destroy — plugins can do last-second work
    destroyPlugins().finally(() => {
      pluginsDestroyed = true
      app.quit() // This re-fires before-quit + will-quit, but guard prevents re-entry
    })
  }
})
