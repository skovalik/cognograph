// Plugin Registry (Main Process)
// Loads plugins, manages lifecycle, dispatches IPC calls, and emits events

import { app, ipcMain, BrowserWindow } from 'electron'
import Store from 'electron-store'
import path from 'path'
import fs from 'fs'
import type { PluginManifest, PluginMain, PluginContext, PluginEvent, PluginEventMap } from './types'
import { validatePluginId } from './types'
import { pluginEntries } from './plugins.main'
// No @main alias exists — use relative path from src/plugins/registry.ts:
import { setCredential, getRealCredential, deleteCredential } from '../main/services/credentialStore'

// Local types for workspace cache — avoids importing 'reactflow' in main process.
// These match the subset of Node/Edge fields that plugins need.
interface CachedNode { id: string; type?: string; data: unknown }
interface CachedEdge { id: string; source: string; target: string; data?: unknown }

const store = new Store({ name: 'cognograph-settings' })

/** Plugin lifecycle states */
type PluginState = 'registered' | 'initializing' | 'ready' | 'error' | 'disabled' | 'destroyed'

interface LoadedPlugin {
  manifest: PluginManifest
  main: PluginMain
  ctx: PluginContext | undefined  // undefined when state is 'disabled'
  state: PluginState
  error?: Error
}

const plugins = new Map<string, LoadedPlugin>()

/** Event bus for plugin events */
const eventListeners = new Map<string, Array<{
  pluginId: string
  handler: (data: unknown) => void | Promise<void>
}>>()

/** Reference to main window for sendToRenderer */
let mainWindowRef: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow): void {
  mainWindowRef = win
}

/** Read plugin enabled state from settings. Built-in plugins default to true. */
function getPluginEnabled(pluginId: string): boolean {
  return store.get(`plugin.${pluginId}.enabled`, true) as boolean
}

/** Init timeout per plugin (15 seconds) */
const INIT_TIMEOUT_MS = 15_000

export async function loadPlugins(): Promise<void> {
  for (const { manifest, create } of pluginEntries) {
    // Validate API version compatibility
    if (manifest.apiVersion !== 1) {
      console.warn(`[plugin:${manifest.id}] Unsupported API version ${manifest.apiVersion}, skipping`)
      continue
    }
    const id = validatePluginId(manifest.id)
    const enabled = getPluginEnabled(id)

    if (!enabled) {
      plugins.set(id, { manifest, main: create(), ctx: undefined, state: 'disabled' })
      continue
    }

    const ctx = createPluginContext(manifest)
    const main = create()

    plugins.set(id, { manifest, main, ctx, state: 'registered' })

    try {
      plugins.get(id)!.state = 'initializing'
      await Promise.race([
        main.init(ctx),
        new Promise((_, reject) => setTimeout(() => reject(new Error('init timeout')), INIT_TIMEOUT_MS))
      ])
      registerPluginEvents(manifest, main)
      plugins.get(id)!.state = 'ready'
      ctx.log.info(`Plugin '${manifest.name}' initialized`)
    } catch (err) {
      plugins.get(id)!.state = 'error'
      plugins.get(id)!.error = err instanceof Error ? err : new Error(String(err))
      console.error(`[plugin:${id}] Failed to initialize:`, err)
    }
  }

  // Register the generic plugin:call dispatcher
  ipcMain.handle('plugin:call', async (_event, pluginId: string, method: string, ...args: unknown[]) => {
    // Validate pluginId format
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(pluginId)) {
      throw new Error(`Invalid plugin ID: ${pluginId}`)
    }

    const plugin = plugins.get(pluginId)
    if (!plugin || plugin.state !== 'ready') {
      throw new Error(`Plugin '${pluginId}' not found or not ready (state: ${plugin?.state ?? 'missing'})`)
    }

    // Validate method name (prevent prototype chain access)
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(method)) {
      throw new Error(`Invalid method name: ${method}`)
    }

    const handler = plugin.main.ipcHandlers?.[method]
    if (!handler || !Object.prototype.hasOwnProperty.call(plugin.main.ipcHandlers, method)) {
      throw new Error(`Plugin '${pluginId}' has no method '${method}'`)
    }

    // Wrap in try-catch so plugin errors don't become unhandled rejections
    try {
      return await handler(...args)
    } catch (err) {
      console.error(`[plugin:${pluginId}:${method}] Error:`, err)
      throw err // Re-throw so renderer gets the error
    }
  })

  // Dedicated channel for renderer to query enabled plugin IDs.
  // Separate from plugin:call — this is a registry meta-operation, not a plugin method.
  ipcMain.handle('plugins:getEnabledIds', () => {
    return getEnabledPluginIds()
  })
}

/** Typed emit function — enforces PluginEventMap at call sites */
export function emitPluginEvent<E extends PluginEvent>(
  event: E,
  data: PluginEventMap[E]
): void {
  const listeners = eventListeners.get(event)
  if (!listeners) return

  for (const { pluginId, handler } of listeners) {
    // Fire-and-forget — plugin errors don't crash core
    Promise.resolve(handler(data)).catch(err => {
      console.error(`[plugin:${pluginId}] Error handling ${event}:`, err)
    })
  }
}

/**
 * Destroy all plugins. Called from the will-quit guard (see main/index.ts).
 * Runs sequentially — plugin destroy order is reverse of init order.
 * Each plugin gets 5 seconds before timeout.
 */
export async function destroyPlugins(): Promise<void> {
  const entries = Array.from(plugins.entries()).reverse()
  for (const [id, plugin] of entries) {
    if (plugin.state === 'ready' && plugin.main.destroy) {
      try {
        await Promise.race([
          plugin.main.destroy(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ])
        plugin.state = 'destroyed'
      } catch (err) {
        console.error(`[plugin:${id}] Error during destroy:`, err)
      }
    }
  }
}

/** Get enabled plugin manifests (for renderer to know which tabs to show) */
export function getEnabledPluginIds(): string[] {
  return Array.from(plugins.entries())
    .filter(([_, p]) => p.state === 'ready')
    .map(([id]) => id)
}

/**
 * Cached workspace snapshot for plugin workspace-read access.
 * Updated whenever workspace:saved fires (workspace.ts calls updateWorkspaceCache).
 * The main process does NOT have direct access to the renderer's Zustand store,
 * so we cache the last-saved workspace JSON that was written to disk.
 */
let cachedWorkspace: { nodes: CachedNode[]; edges: CachedEdge[] } | null = null

/** Called from workspace.ts save handler to keep the cache fresh */
export function updateWorkspaceCache(data: { nodes: CachedNode[]; edges: CachedEdge[] }): void {
  cachedWorkspace = data
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Validate settings/credential key — prevent dot-path traversal */
const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/
function validateKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`Invalid key '${key}': must match ${KEY_PATTERN}`)
  }
}

function createPluginContext(manifest: PluginManifest): PluginContext {
  const id = manifest.id
  const caps = manifest.capabilities

  return {
    settings: caps.includes('settings')
      ? createScopedSettings(id)
      : proxyThatThrows('settings') as PluginContext['settings'],

    credentials: caps.includes('credentials')
      ? createScopedCredentials(id)
      : proxyThatThrows('credentials') as PluginContext['credentials'],

    dataDir: caps.includes('filesystem')
      ? ensurePluginDataDir(id)
      : '',

    log: createScopedLogger(id),

    workspace: caps.includes('workspace-read')
      ? createWorkspaceReader()
      : proxyThatThrows('workspace-read') as PluginContext['workspace'],

    sendToRenderer(event: string, ...args: unknown[]) {
      // Validate event name at the send boundary
      if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(event)) {
        throw new Error(`Invalid event name: ${event}`)
      }
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send(`plugin:${id}:${event}`, ...args)
      }
    }
  }
}

function createScopedSettings(pluginId: string) {
  return {
    get<T>(key: string): T | undefined {
      validateKey(key)
      return store.get(`plugin.${pluginId}.${key}`) as T | undefined
    },
    set<T>(key: string, value: T): void {
      validateKey(key)
      store.set(`plugin.${pluginId}.${key}`, value)
    }
  }
}

/**
 * Plugin credentials use the credentialStore with a synthetic workspaceId of `__plugin__`.
 * This keeps plugin credentials isolated from workspace credentials.
 * The actual credentialStore API is: setCredential(workspaceId, key, value, label, type)
 */
function createScopedCredentials(pluginId: string) {
  const workspaceId = `__plugin__`  // Synthetic workspace — isolates plugin credentials
  return {
    set(key: string, value: string, label?: string): void {
      validateKey(key)
      setCredential(workspaceId, `${pluginId}.${key}`, value, label ?? key, 'plugin')
    },
    get(key: string): string | null {
      validateKey(key)
      return getRealCredential(workspaceId, `${pluginId}.${key}`)
    },
    delete(key: string): void {
      validateKey(key)
      deleteCredential(workspaceId, `${pluginId}.${key}`)
    }
  }
}

function createScopedLogger(pluginId: string): PluginContext['log'] {
  const prefix = `[plugin:${pluginId}]`
  return {
    debug: (msg, ...args) => console.debug(prefix, msg, ...args),
    info: (msg, ...args) => console.info(prefix, msg, ...args),
    warn: (msg, ...args) => console.warn(prefix, msg, ...args),
    error: (msg, ...args) => console.error(prefix, msg, ...args),
  }
}

function createWorkspaceReader() {
  return {
    async getNodes(filter?: { type?: string }) {
      if (!cachedWorkspace) return []
      let nodes = cachedWorkspace.nodes
      if (filter?.type) nodes = nodes.filter(n => n.type === filter.type)
      return nodes.map(n => ({ id: n.id, type: n.type ?? 'unknown', data: n.data }))
    },
    async getNodeById(id: string) {
      if (!cachedWorkspace) return null
      const node = cachedWorkspace.nodes.find(n => n.id === id)
      return node ? { id: node.id, type: node.type ?? 'unknown', data: node.data } : null
    },
    async getEdges(nodeId?: string) {
      if (!cachedWorkspace) return []
      let edges = cachedWorkspace.edges
      if (nodeId) edges = edges.filter(e => e.source === nodeId || e.target === nodeId)
      return edges.map(e => ({ id: e.id, source: e.source, target: e.target, data: e.data }))
    }
  }
}

function ensurePluginDataDir(pluginId: string): string {
  const dir = path.join(app.getPath('userData'), 'plugins', pluginId)
  // Validate no path traversal — append path.sep to prevent sibling directory match
  const resolved = path.resolve(dir)
  const base = path.resolve(path.join(app.getPath('userData'), 'plugins'))
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Plugin data directory escape attempt: ${pluginId}`)
  }
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function registerPluginEvents(manifest: PluginManifest, main: PluginMain): void {
  if (!main.eventHandlers || !manifest.events) return

  for (const event of manifest.events) {
    const handler = main.eventHandlers[event]
    if (!handler) continue
    if (!eventListeners.has(event)) eventListeners.set(event, [])
    eventListeners.get(event)!.push({
      pluginId: manifest.id,
      handler: handler as (data: unknown) => void | Promise<void>
    })
  }
}

/** Returns a Proxy that throws on any property access — used for unclaimed capabilities */
function proxyThatThrows(capability: string): unknown {
  return new Proxy({}, {
    get() { throw new Error(`Plugin does not have '${capability}' capability`) }
  })
}
