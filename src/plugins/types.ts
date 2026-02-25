// Plugin System Type Definitions
// Core interfaces and types for the Cognograph plugin architecture

import type { OrchestratorRun } from '@shared/types'

// ============================================================================
// Plugin Identification
// ============================================================================

/** Plugin ID must be lowercase alphanumeric + hyphens only, max 64 chars */
export type PluginId = string & { __brand: 'PluginId' }

/** Validate and brand a plugin ID (max 64 chars, matching DNS label conventions) */
export function validatePluginId(id: string): PluginId {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) {
    throw new Error(`Invalid plugin ID '${id}': must match /^[a-z][a-z0-9-]{0,63}$/`)
  }
  return id as PluginId
}

// ============================================================================
// Plugin Manifest
// ============================================================================

export interface PluginManifest {
  /** Unique plugin identifier (lowercase alphanumeric + hyphens, max 64 chars) */
  id: string

  /** Human-readable name */
  name: string

  /** SemVer version */
  version: `${number}.${number}.${number}`

  /** Plugin API version this plugin targets */
  apiVersion: 1

  /** What this plugin does (shown in settings) */
  description: string

  /** Capabilities this plugin needs — declared upfront, auditable */
  capabilities: PluginCapability[]

  /** Events this plugin subscribes to */
  events?: PluginEvent[]

  /** npm dependencies bundled with this plugin (for audit trail) */
  dependencies?: string[]
}

/** Explicit capability declarations */
export type PluginCapability =
  | 'ipc'              // Can register IPC handlers (plugin:<id>:*)
  | 'settings'         // Can read/write settings (scoped to plugin.<id>.*)
  | 'credentials'      // Can store encrypted credentials via safeStorage
  | 'network'          // Makes external HTTP requests
  | 'settings-tab'     // Adds a tab to Settings modal
  | 'filesystem'       // Reads/writes to plugin data directory
  | 'workspace-read'   // Can query workspace nodes and edges (read-only)

// ============================================================================
// Plugin Event System
// ============================================================================

/**
 * Event map: event name → payload type.
 * This is the single source of truth for all plugin events.
 * Both emitPluginEvent() and eventHandlers are typed against this map.
 */
export interface PluginEventMap {
  'workspace:saved': { filePath: string; canvasId: string; version: number }
  'workspace:loaded': { filePath: string; canvasId: string }
  'workspace:switched': { fromCanvasId: string | null; toCanvasId: string }
  'orchestrator:run-complete': OrchestratorRun
  'node:created': { nodeId: string; nodeType: string }
  'node:updated': { nodeId: string; nodeType: string; changedFields: string[] }
  'node:deleted': { nodeId: string; nodeType: string }
  'edge:created': { edgeId: string; source: string; target: string }
  'edge:deleted': { edgeId: string; source: string; target: string }
  'app:ready': Record<string, never>
  'app:quit': Record<string, never>
}

/** Valid plugin event name (derived from the event map) */
export type PluginEvent = keyof PluginEventMap

// ============================================================================
// Typed IPC Contract System
// ============================================================================

/**
 * A method map defines the typed contract between main and renderer.
 * Each key is a method name, each value defines args and return type.
 */
export type MethodMap = Record<string, { args: unknown[]; return: unknown }>

/**
 * Typed IPC handlers that enforce a contract.
 * Each handler's args and return type are checked at compile time.
 */
export type TypedIpcHandlers<M extends MethodMap> = {
  [K in keyof M & string]: (
    ...args: M[K]['args']
  ) => Promise<M[K]['return']>
}

/**
 * Typed IPC bridge for renderer-side plugin calls.
 * Provides full autocomplete and type checking.
 */
export interface TypedPluginBridge<M extends MethodMap> {
  call<K extends keyof M & string>(
    method: K,
    ...args: M[K]['args']
  ): Promise<M[K]['return']>
  on(event: string, callback: (...args: unknown[]) => void): () => void
}

// ============================================================================
// Plugin Context (Main Process)
// ============================================================================

export interface PluginContext {
  /** Plugin's scoped settings (reads/writes plugin.<id>.* keys) */
  settings: {
    get<T>(key: string): T | undefined
    set<T>(key: string, value: T): void
  }

  /** Encrypted credential storage (scoped to plugin via credentialStore) */
  credentials: {
    /** Store a credential. `label` defaults to `key` if omitted (used for display in settings). */
    set(key: string, value: string, label?: string): void
    get(key: string): string | null
    delete(key: string): void
  }

  /** Plugin's data directory (~/.cognograph/plugins/<id>/) */
  dataDir: string

  /** Logger scoped to plugin */
  log: {
    debug(msg: string, ...args: unknown[]): void
    info(msg: string, ...args: unknown[]): void
    warn(msg: string, ...args: unknown[]): void
    error(msg: string, ...args: unknown[]): void
  }

  /** Read-only workspace access (requires 'workspace-read' capability) */
  workspace: {
    getNodes(filter?: { type?: string }): Promise<Array<{ id: string; type: string; data: unknown }>>
    getNodeById(id: string): Promise<{ id: string; type: string; data: unknown } | null>
    getEdges(nodeId?: string): Promise<Array<{ id: string; source: string; target: string; data: unknown }>>
  }

  /** Send a message to this plugin's renderer component */
  sendToRenderer(event: string, ...args: unknown[]): void
}

/**
 * Per-event handler map. Each handler is independently typed — no casts needed.
 * Only events declared in manifest.events are delivered by the registry.
 */
export type PluginEventHandlers = {
  [E in PluginEvent]?: (data: PluginEventMap[E]) => void | Promise<void>
}

/**
 * PluginMain is generic over the method map M.
 * This makes contract enforcement structural (not voluntary via `satisfies`).
 * Example: PluginMain<NotionMethods> enforces all handlers match the contract.
 *
 * Default M is Record<never, never> (empty map) — plugins without IPC handlers
 * don't need to specify a method map. Using MethodMap as default would silently
 * accept any handler shape, defeating the purpose of the generic.
 */
export interface PluginMain<M extends MethodMap = Record<never, never>> {
  /** Called once when plugin is loaded. Set up services, replay queues, etc. */
  init(ctx: PluginContext): Promise<void>

  /**
   * IPC handler map. Keys become `plugin:<id>:<key>` channels.
   * When M is provided, each handler's args and return type are checked at compile time.
   */
  ipcHandlers?: TypedIpcHandlers<M>

  /**
   * Per-event handler map. Each handler is independently typed via PluginEventMap.
   * Only events declared in manifest.events are delivered.
   *
   * Example:
   *   eventHandlers: {
   *     'workspace:saved': (data) => { ... },
   *     'orchestrator:run-complete': (data) => { ... },
   *   }
   */
  eventHandlers?: PluginEventHandlers

  /** Called before app quits. Cleanup resources, flush queues. */
  destroy?(): Promise<void>
}

// ============================================================================
// Plugin Renderer Interface
// ============================================================================

export interface PluginSettingsTab<M extends MethodMap = Record<never, never>> {
  /** Tab label shown in settings sidebar */
  label: string

  /** Lucide icon component */
  icon: React.ComponentType<{ className?: string }>

  /** The settings panel component */
  component: React.ComponentType<{ plugin: TypedPluginBridge<M> }>
}

export interface PluginRenderer<M extends MethodMap = Record<never, never>> {
  /** Settings tab to add to the Settings modal */
  settingsTab?: PluginSettingsTab<M>
}
