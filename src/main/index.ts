import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerWorkspaceHandlers } from './workspace'
import { registerSettingsHandlers } from './settings'
import { registerLLMHandlers } from './llm'
import { registerTemplateHandlers } from './templates'
import { registerAIEditorHandlers } from './aiEditor'
import { registerAgentHandlers } from './agent/claudeAgent'
import { registerFilesystemHandlers } from './agent/filesystemTools'
import { registerAttachmentHandlers } from './attachments'
import { registerConnectorHandlers } from './connectors'
import { registerMultiplayerHandlers, registerDeepLinkProtocol, setupDeepLinkListeners } from './multiplayer'
import { registerBackupHandlers } from './backupManager'
import { registerOrchestratorHandlers } from './orchestratorHandlers'
import { registerMCPClientHandlers, disconnectAllMCPServers } from './mcp/mcpClient'
import { registerAuditHandlers } from './services/auditService'
import { registerGraphIntelligenceHandlers } from './services/graphIntelligence'
import { registerNotionHandlers } from './services/registerNotionHandlers'
import { registerTerminalHandlers } from './services/registerTerminalHandlers'
import { killAll as killAllTerminals } from './services/terminalManager'
import { workflowSync } from './services/notionSync'
import { createMCPServer, FileSyncProvider } from './mcp'
import { startActivityWatcher, stopActivityWatcher, getEventHistory } from './services/activityWatcher'
import {
  startDispatchServer,
  stopDispatchServer,
  queueDispatch,
  getDispatchQueue,
  cancelDispatch,
  getActivePort,
} from './services/ccBridgeService'
import {
  getRealCredential,
  getMaskedCredential,
  setCredential,
  deleteCredential,
  listCredentials,
} from './services/credentialStore'
import { logger } from './utils/logger'
import { loadPlugins, destroyPlugins, setMainWindow, emitPluginEvent } from '@plugins/registry'

// Catch unhandled promise rejections to prevent silent crashes
process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled promise rejection:', reason)
})

// Check for MCP mode flags
const isMCPStandalone = process.argv.includes('--mcp-standalone')
const isMCPEmbedded = process.argv.includes('--mcp-server')

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
      allowRunningInsecureContent: false
    }
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
        'Content-Security-Policy': [cspPolicy]
      }
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
  // Check for explicit workspace path flag
  const pathIdx = process.argv.indexOf('--workspace-path')
  const pathArg = pathIdx !== -1 ? process.argv[pathIdx + 1] : undefined
  if (pathArg) {
    return pathArg
  }

  // Check for workspace ID flag
  const idIdx = process.argv.indexOf('--workspace-id')
  const idArg = idIdx !== -1 ? process.argv[idIdx + 1] : undefined
  if (idArg) {
    const workspacesDir = join(app.getPath('userData'), 'workspaces')
    return join(workspacesDir, `${idArg}.json`)
  }

  // Fall back to last opened workspace from settings
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    const settingsContent = await fs.readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(settingsContent)
    if (settings.lastWorkspaceId) {
      const workspacesDir = join(app.getPath('userData'), 'workspaces')
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
if (!app.requestSingleInstanceLock()) {
  logger.log('[Main] Another instance is running. Quitting.')
  app.quit()
}

app.whenReady().then(async () => {
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
    registerAttachmentHandlers()
    registerConnectorHandlers()
    registerMultiplayerHandlers()
    registerBackupHandlers()
    registerOrchestratorHandlers()
    registerMCPClientHandlers()
    registerAuditHandlers()
    registerGraphIntelligenceHandlers()
    registerNotionHandlers()
    registerTerminalHandlers()
    setupDeepLinkListeners()

    // Initialize Notion sync (replay queue from previous session)
    workflowSync.initialize().catch(err => {
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

    // Credential Store IPC handlers
    // Block renderer access to plugin credentials (workspaceId starting with '__').
    // Plugin credentials are only accessible through plugin:call pathway.
    ipcMain.handle('credentials:set', (_event, workspaceId: string, credentialKey: string, value: string, label: string, credentialType: string) => {
      if (workspaceId.startsWith('__')) {
        return { success: false, error: 'Reserved namespace' }
      }
      try {
        setCredential(workspaceId, credentialKey, value, label, credentialType)
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to store credential' }
      }
    })

    ipcMain.handle('credentials:getMasked', (_event, workspaceId: string, credentialKey: string) => {
      if (workspaceId.startsWith('__')) return null  // Silent deny
      return getMaskedCredential(workspaceId, credentialKey)
    })

    ipcMain.handle('credentials:getReal', (_event, workspaceId: string, credentialKey: string) => {
      if (workspaceId.startsWith('__')) return null  // Silent deny
      return getRealCredential(workspaceId, credentialKey)
    })

    ipcMain.handle('credentials:delete', (_event, workspaceId: string, credentialKey: string) => {
      if (workspaceId.startsWith('__')) {
        return { success: false, error: 'Reserved namespace' }
      }
      try {
        deleteCredential(workspaceId, credentialKey)
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to delete credential' }
      }
    })

    ipcMain.handle('credentials:list', (_event, workspaceId: string) => {
      if (workspaceId.startsWith('__')) return []  // Silent deny
      return listCredentials(workspaceId)
    })
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

    // Start diagnostic server (dev mode only)
    if (is.dev && mainWindow) {
      import('./diagnosticServer').then(({ startDiagnosticServer }) => {
        startDiagnosticServer(mainWindow!)
      }).catch(err => {
        console.error('[DiagnosticServer] Failed to start:', err)
      })
    }

    // ------------------------------------------------------------------
    // Preview iframe security filter (defense-in-depth)
    // Block navigation from preview iframes to non-localhost URLs.
    // Renderer-side validation is first line; this is the second line
    // that catches redirects after initial load.
    // ------------------------------------------------------------------
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
      }
    )

    // Start embedded MCP server if flag present
    if (isMCPEmbedded) {
      try {
        await startMCPMode()
      } catch (err) {
        console.error('[MCP] Failed to start embedded MCP:', err)
      }
    }

    // Start Claude Code activity watcher (observes .cognograph-activity/events.jsonl)
    // Uses the project root (cwd) as the directory to watch
    try {
      startActivityWatcher(process.cwd())
    } catch (err) {
      console.error('[ActivityWatcher] Failed to start:', err)
    }

    // Load plugins and emit app:ready event
    if (mainWindow) {
      setMainWindow(mainWindow)
      await loadPlugins()
      emitPluginEvent('app:ready', {})
    }
  }

  app.on('activate', function () {
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

// Clean up activity watcher, dispatch server, terminals, and MCP client connections on quit
app.on('before-quit', () => {
  stopActivityWatcher()
  stopDispatchServer()
  killAllTerminals()
  disconnectAllMCPServers().catch((err) => {
    console.error('[MCPClient] Error during shutdown cleanup:', err)
  })
})

// Plugin destroy needs async cleanup, so we use 'will-quit' (fires after 'before-quit' and windows close).
// Lifecycle: before-quit → windows close → will-quit → quit
// The guard flag prevents will-quit from re-firing when we call app.quit().
let pluginsDestroyed = false
app.on('will-quit', (e) => {
  if (!pluginsDestroyed) {
    e.preventDefault()
    emitPluginEvent('app:quit', {})  // Fire before destroy — plugins can do last-second work
    destroyPlugins().finally(() => {
      pluginsDestroyed = true
      app.quit()  // This re-fires before-quit + will-quit, but guard prevents re-entry
    })
  }
})
