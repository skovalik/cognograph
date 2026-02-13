/**
 * Multiplayer IPC handlers — Token management and deep link parsing.
 *
 * All authenticated endpoints require Bearer token passed from renderer.
 * Token storage uses Electron's safeStorage for encryption at rest.
 */

import { ipcMain, app, BrowserWindow, safeStorage } from 'electron'
import Store from 'electron-store'

// Encrypted token storage
const tokenStore = new Store<{ tokens: Record<string, string> }>({
  name: 'multiplayer-tokens',
  encryptionKey: 'cognograph-multiplayer-v1', // Additional layer (safeStorage is primary)
  defaults: { tokens: {} }
})

// Default server URL (can be overridden in settings)
// REST API runs on PORT+1 from Hocuspocus (3001+1=3002)
const DEFAULT_SERVER_URL = 'http://localhost:3002'

function getServerUrl(): string {
  // Could be read from settings store in the future
  return process.env.COGNOGRAPH_SERVER_URL || DEFAULT_SERVER_URL
}

/**
 * Securely store a token for a workspace using Electron's safeStorage.
 */
function storeToken(workspaceId: string, token: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(token)
    const tokens = tokenStore.get('tokens', {})
    tokens[workspaceId] = encrypted.toString('base64')
    tokenStore.set('tokens', tokens)
  } else {
    // Fallback: store in electron-store with its own encryption
    const tokens = tokenStore.get('tokens', {})
    tokens[workspaceId] = token
    tokenStore.set('tokens', tokens)
  }
}

/**
 * Retrieve a stored token for a workspace.
 */
function getStoredToken(workspaceId: string): string | null {
  const tokens = tokenStore.get('tokens', {})
  const stored = tokens[workspaceId]
  if (!stored) return null

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(stored, 'base64')
      return safeStorage.decryptString(buffer)
    } catch {
      return null
    }
  }
  return stored
}

/**
 * Remove a stored token for a workspace.
 */
function removeToken(workspaceId: string): void {
  const tokens = tokenStore.get('tokens', {})
  delete tokens[workspaceId]
  tokenStore.set('tokens', tokens)
}

/**
 * Create headers with optional Bearer token authentication.
 */
function createHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }
  return headers
}

/**
 * Derive WebSocket URL from REST API URL.
 * REST API runs on PORT+1 (3002), WebSocket on PORT (3001).
 */
function getWsUrl(restUrl: string): string {
  try {
    const url = new URL(restUrl)
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const port = url.port ? String(parseInt(url.port) - 1) : '3000'
    return `${wsProtocol}//${url.hostname}:${port}`
  } catch {
    return 'ws://localhost:3001'
  }
}

export function registerMultiplayerHandlers(): void {
  // --- Token Storage IPC Handlers ---

  // Store a token securely for a workspace
  ipcMain.handle('multiplayer:storeToken', async (_event, workspaceId: string, token: string) => {
    try {
      storeToken(workspaceId, token)
      return { success: true }
    } catch (err) {
      return { success: false, error: `Failed to store token: ${(err as Error).message}` }
    }
  })

  // Get a stored token for a workspace
  ipcMain.handle('multiplayer:getToken', async (_event, workspaceId: string) => {
    try {
      const token = getStoredToken(workspaceId)
      return { success: true, token }
    } catch (err) {
      return { success: false, error: `Failed to get token: ${(err as Error).message}` }
    }
  })

  // Remove a stored token (logout/leave workspace)
  ipcMain.handle('multiplayer:removeToken', async (_event, workspaceId: string) => {
    try {
      removeToken(workspaceId)
      return { success: true }
    } catch (err) {
      return { success: false, error: `Failed to remove token: ${(err as Error).message}` }
    }
  })

  // Refresh a token before it expires
  ipcMain.handle('multiplayer:refreshToken', async (_event, workspaceId: string) => {
    try {
      const currentToken = getStoredToken(workspaceId)
      if (!currentToken) {
        return { success: false, error: 'No token to refresh', code: 'NO_TOKEN' }
      }

      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: createHeaders(currentToken)
      })

      if (response.status === 401) {
        // Token is invalid or expired
        removeToken(workspaceId)
        return { success: false, error: 'Token expired. Please rejoin the workspace.', code: 'TOKEN_EXPIRED' }
      }

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error: `Refresh failed: ${error}` }
      }

      const data = await response.json()

      // Store the new token
      if (data.token) {
        storeToken(workspaceId, data.token)
      }

      return {
        success: true,
        token: data.token,
        expiresAt: data.expiresAt,
        expiresIn: data.expiresAt ? new Date(data.expiresAt).getTime() - Date.now() : null
      }
    } catch (err) {
      return { success: false, error: `Failed to refresh token: ${(err as Error).message}` }
    }
  })

  // Validate a token and get expiry info
  ipcMain.handle('multiplayer:validateToken', async (_event, workspaceId: string) => {
    try {
      const token = getStoredToken(workspaceId)
      if (!token) {
        return { success: false, error: 'No token stored', code: 'NO_TOKEN' }
      }

      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/auth/validate`, {
        headers: createHeaders(token)
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return { success: false, error: data.error || 'Validation failed', code: 'INVALID' }
      }

      const data = await response.json()
      return {
        success: true,
        valid: data.valid,
        workspaceId: data.workspaceId,
        permissions: data.permissions,
        expiresAt: data.expiresAt,
        expiresIn: data.expiresIn
      }
    } catch (err) {
      return { success: false, error: `Failed to validate token: ${(err as Error).message}` }
    }
  })

  // --- Workspace Handlers ---

  // Create a shared workspace on the server and get admin token
  ipcMain.handle('multiplayer:shareWorkspace', async (_event, workspaceId: string, workspaceName: string) => {
    try {
      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workspaceId, name: workspaceName })
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error: `Server error: ${error}` }
      }

      const data = await response.json()

      // Automatically store the admin token for this workspace
      if (data.token) {
        storeToken(workspaceId, data.token)
      }

      return {
        success: true,
        token: data.token,
        workspaceId: data.workspaceId,
        serverUrl: getWsUrl(serverUrl)
      }
    } catch (err) {
      return { success: false, error: `Failed to connect to server: ${(err as Error).message}` }
    }
  })

  // Generate an invite token for a workspace (requires admin auth)
  ipcMain.handle('multiplayer:createInvite', async (_event, workspaceId: string, permissions: string, authToken?: string, expiresAt?: string) => {
    try {
      // Use provided token or try to get stored token
      const token = authToken || getStoredToken(workspaceId)
      if (!token) {
        return { success: false, error: 'No auth token available. Please rejoin the workspace.' }
      }

      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/workspaces/${workspaceId}/tokens`, {
        method: 'POST',
        headers: createHeaders(token),
        body: JSON.stringify({ permissions, expiresAt })
      })

      if (response.status === 401) {
        return { success: false, error: 'Session expired. Please rejoin the workspace.', code: 'TOKEN_EXPIRED' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Admin permission required to create invites.', code: 'FORBIDDEN' }
      }
      if (!response.ok) {
        const error = await response.text()
        return { success: false, error: `Server error: ${error}` }
      }

      const data = await response.json()
      // Build invite link
      const inviteUrl = `cognograph://join/${workspaceId}?token=${data.token}`

      return {
        success: true,
        token: data.token,
        inviteUrl,
        permissions: data.permissions,
        expiresAt: data.expiresAt
      }
    } catch (err) {
      return { success: false, error: `Failed to create invite: ${(err as Error).message}` }
    }
  })

  // List tokens for a workspace (requires admin auth)
  ipcMain.handle('multiplayer:listTokens', async (_event, workspaceId: string, authToken?: string) => {
    try {
      const token = authToken || getStoredToken(workspaceId)
      if (!token) {
        return { success: false, error: 'No auth token available.', code: 'NO_TOKEN' }
      }

      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/workspaces/${workspaceId}/tokens`, {
        headers: createHeaders(token)
      })

      if (response.status === 401) {
        return { success: false, error: 'Session expired.', code: 'TOKEN_EXPIRED' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Admin permission required.', code: 'FORBIDDEN' }
      }
      if (!response.ok) {
        return { success: false, error: 'Failed to list tokens' }
      }

      const tokens = await response.json()
      return { success: true, tokens }
    } catch (err) {
      return { success: false, error: `Failed to list tokens: ${(err as Error).message}` }
    }
  })

  // Revoke a token (requires admin auth on the token's workspace)
  ipcMain.handle('multiplayer:revokeToken', async (_event, tokenId: string, workspaceId: string, authToken?: string) => {
    try {
      const token = authToken || getStoredToken(workspaceId)
      if (!token) {
        return { success: false, error: 'No auth token available.', code: 'NO_TOKEN' }
      }

      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: createHeaders(token)
      })

      if (response.status === 401) {
        return { success: false, error: 'Session expired.', code: 'TOKEN_EXPIRED' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Admin permission required.', code: 'FORBIDDEN' }
      }
      if (response.status === 404) {
        return { success: false, error: 'Token not found.', code: 'NOT_FOUND' }
      }
      if (!response.ok) {
        return { success: false, error: 'Failed to revoke token' }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: `Failed to revoke token: ${(err as Error).message}` }
    }
  })

  // Parse a join link
  ipcMain.handle('multiplayer:parseInviteLink', async (_event, link: string) => {
    try {
      // Parse cognograph://join/WORKSPACE_ID?token=TOKEN
      const url = new URL(link)
      if (url.protocol !== 'cognograph:') {
        return { success: false, error: 'Invalid protocol' }
      }

      const pathParts = url.pathname.replace(/^\/\//, '').split('/')
      if (pathParts[0] !== 'join' || !pathParts[1]) {
        return { success: false, error: 'Invalid invite link format' }
      }

      const workspaceId = pathParts[1]
      const token = url.searchParams.get('token')

      if (!token) {
        return { success: false, error: 'No token in invite link' }
      }

      const serverUrl = getServerUrl()
      return {
        success: true,
        workspaceId,
        token,
        serverUrl: getWsUrl(serverUrl)
      }
    } catch (err) {
      return { success: false, error: `Failed to parse invite link: ${(err as Error).message}` }
    }
  })

  // Get server health/status
  ipcMain.handle('multiplayer:getServerStatus', async () => {
    try {
      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/health`)

      if (!response.ok) {
        return { success: false, error: 'Server not responding' }
      }

      const data = await response.json()
      return { success: true, ...data }
    } catch (err) {
      return { success: false, error: `Server unreachable: ${(err as Error).message}` }
    }
  })

  // Get the WebSocket URL for connecting
  ipcMain.handle('multiplayer:getServerUrl', async () => {
    const serverUrl = getServerUrl()
    // WebSocket server runs on PORT (3001), REST API on PORT+1 (3002)
    return { success: true, wsUrl: getWsUrl(serverUrl) }
  })

  // --- Branch Operations ---

  // Create a branch from a workspace (requires write auth)
  ipcMain.handle('multiplayer:createBranch', async (_event, workspaceId: string, branchName: string, authToken?: string) => {
    try {
      const token = authToken || getStoredToken(workspaceId)
      if (!token) {
        return { success: false, error: 'No auth token available.', code: 'NO_TOKEN' }
      }

      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/workspaces/${workspaceId}/branches`, {
        method: 'POST',
        headers: createHeaders(token),
        body: JSON.stringify({ name: branchName })
      })

      if (response.status === 401) {
        return { success: false, error: 'Session expired.', code: 'TOKEN_EXPIRED' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Write permission required.', code: 'FORBIDDEN' }
      }
      if (!response.ok) {
        const error = await response.text()
        return { success: false, error }
      }

      const data = await response.json()
      // Store token for the new branch workspace
      if (data.token && data.branchWorkspaceId) {
        storeToken(data.branchWorkspaceId, data.token)
      }
      return { success: true, ...data }
    } catch (err) {
      return { success: false, error: `Failed to create branch: ${(err as Error).message}` }
    }
  })

  // List branches for a workspace (requires read auth)
  ipcMain.handle('multiplayer:listBranches', async (_event, workspaceId: string, authToken?: string) => {
    try {
      const token = authToken || getStoredToken(workspaceId)
      if (!token) {
        return { success: false, error: 'No auth token available.', code: 'NO_TOKEN' }
      }

      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/workspaces/${workspaceId}/branches`, {
        headers: createHeaders(token)
      })

      if (response.status === 401) {
        return { success: false, error: 'Session expired.', code: 'TOKEN_EXPIRED' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Permission denied.', code: 'FORBIDDEN' }
      }
      if (!response.ok) {
        return { success: false, error: 'Failed to list branches' }
      }

      const branches = await response.json()
      return { success: true, branches }
    } catch (err) {
      return { success: false, error: `Failed to list branches: ${(err as Error).message}` }
    }
  })

  // Merge a branch back into a workspace (requires write auth on target)
  ipcMain.handle('multiplayer:mergeBranch', async (_event, targetWorkspaceId: string, sourceWorkspaceId: string, authToken?: string) => {
    try {
      const token = authToken || getStoredToken(targetWorkspaceId)
      if (!token) {
        return { success: false, error: 'No auth token available.', code: 'NO_TOKEN' }
      }

      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/workspaces/${targetWorkspaceId}/merge`, {
        method: 'POST',
        headers: createHeaders(token),
        body: JSON.stringify({ sourceWorkspaceId })
      })

      if (response.status === 401) {
        return { success: false, error: 'Session expired.', code: 'TOKEN_EXPIRED' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Write permission required.', code: 'FORBIDDEN' }
      }
      if (!response.ok) {
        const error = await response.text()
        return { success: false, error }
      }

      const data = await response.json()
      return { success: true, ...data }
    } catch (err) {
      return { success: false, error: `Failed to merge branch: ${(err as Error).message}` }
    }
  })
}

/**
 * Register deep link protocol handler.
 * Must be called before app.ready.
 */
export function registerDeepLinkProtocol(): void {
  // Register the cognograph:// protocol
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('cognograph', process.execPath, [process.argv[1]!])
    }
  } else {
    app.setAsDefaultProtocolClient('cognograph')
  }
}

/**
 * Parse a cognograph:// deep link URL and forward to the renderer.
 */
export function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'cognograph:') return

    const pathParts = parsed.pathname.replace(/^\/\//, '').split('/')
    if (pathParts[0] !== 'join' || !pathParts[1]) return

    const workspaceId = pathParts[1]
    const token = parsed.searchParams.get('token')
    if (!token) return

    // Send to the focused/main window
    const windows = BrowserWindow.getAllWindows()
    const target = windows.find(w => w.isFocused()) || windows[0]
    if (target) {
      target.webContents.send('multiplayer:deepLink', { workspaceId, token })
      // Bring window to front
      if (target.isMinimized()) target.restore()
      target.focus()
    }
  } catch {
    console.error('[Multiplayer] Failed to handle deep link:', url)
  }
}

/**
 * Set up deep link event listeners. Call after app is ready.
 */
export function setupDeepLinkListeners(): void {
  // macOS: open-url event
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })

  // Windows/Linux: second-instance event (protocol handler reopens the app)
  app.on('second-instance', (_event, argv) => {
    const url = argv.find(arg => arg.startsWith('cognograph://'))
    if (url) {
      handleDeepLink(url)
    }
  })

  // Check if app was launched with a deep link URL (Windows/Linux cold start)
  const deepLinkArg = process.argv.find(arg => arg.startsWith('cognograph://'))
  if (deepLinkArg) {
    // Delay to allow window to be created
    setTimeout(() => handleDeepLink(deepLinkArg), 1000)
  }
}
