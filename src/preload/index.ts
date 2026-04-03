// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { contextBridge, ipcRenderer } from 'electron'

// Type definitions for the exposed API
export interface WorkspaceAPI {
  save: (data: unknown) => Promise<{ success: boolean; error?: string }>
  load: (id: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
  list: () => Promise<{ success: boolean; data?: unknown[]; error?: string }>
  delete: (id: string) => Promise<{ success: boolean; error?: string }>
  getLastWorkspaceId: () => Promise<string | null>
  saveAs: (
    data: unknown,
    filePath: string,
  ) => Promise<{ success: boolean; path?: string; error?: string }>
  loadFromPath: (
    filePath: string,
  ) => Promise<{ success: boolean; data?: unknown; path?: string; error?: string }>
  watch: (id: string) => Promise<{ success: boolean; error?: string }>
  unwatch: (id: string) => Promise<{ success: boolean; error?: string }>
  onExternalChange: (callback: (id: string) => void) => () => void
  onWorkspaceSaved: (
    callback: (data: { filePath: string; canvasId: string; version: number }) => void,
  ) => () => void
  resetForTest: () => Promise<{ success: boolean; error?: string }>
}

// Dialog API types
export interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface OpenDialogOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
}

export interface DialogAPI {
  showSaveDialog: (
    options?: SaveDialogOptions,
  ) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>
  showOpenDialog: (
    options?: OpenDialogOptions,
  ) => Promise<{ success: boolean; canceled?: boolean; filePaths?: string[]; error?: string }>
}

// Artifact download API
export interface ArtifactDownloadRequest {
  title: string
  content: string
  contentType: string
  language?: string
  files?: Array<{ filename: string; content: string; contentType: string }>
  isBase64?: boolean
}

export interface ArtifactAPI {
  download: (artifact: ArtifactDownloadRequest) => Promise<{
    success: boolean
    canceled?: boolean
    path?: string
    note?: string
    error?: string
  }>
}

export interface SettingsAPI {
  get: <T>(key: string) => Promise<T | undefined>
  set: (key: string, value: unknown) => Promise<void>
  getApiKey: (provider: string) => Promise<string | null>
  setApiKey: (provider: string, key: string) => Promise<{ success: boolean; error?: string } | void>
}

// Payload types for LLM streaming events
export interface LLMChunkPayload {
  conversationId: string
  chunk: string
}

export interface LLMCompletePayload {
  conversationId: string
  response: string
  cancelled?: boolean
  usage?: {
    inputTokens: number
    outputTokens: number
    model?: string
  }
}

export interface LLMErrorPayload {
  conversationId: string
  error: string
}

// Extraction request/response types
export interface ExtractionRequest {
  systemPrompt: string
  userPrompt: string
  model?: string
  maxTokens?: number
}

/** @deprecated Use IPCResponse<string> instead */
export interface ExtractionResponse {
  success: boolean
  content?: string
  error?: string
}

export interface LLMAPI {
  send: (options: {
    conversationId: string // Required: identifies which chat this belongs to
    provider: string
    messages: Array<{ role: string; content: string }>
    systemPrompt?: string
    model?: string
    maxTokens?: number
    temperature?: number
  }) => Promise<void>
  cancel: (conversationId?: string) => Promise<void>
  extract: (options: ExtractionRequest) => Promise<IPCResponse<string>>
  onChunk: (callback: (data: LLMChunkPayload) => void) => () => void
  onComplete: (callback: (data: LLMCompletePayload) => void) => () => void
  onError: (callback: (data: LLMErrorPayload) => void) => () => void
}

// Template library types (imported from shared for reference)
export interface TemplateLibraryResponse {
  success: boolean
  data?: unknown
  error?: string
}

export interface TemplateAPI {
  load: () => Promise<TemplateLibraryResponse>
  save: (library: unknown) => Promise<{ success: boolean; error?: string }>
  getPath: () => Promise<string>
}

// AI Editor types
export interface AIEditorContext {
  mode: 'generate' | 'edit' | 'organize' | 'automate' | 'ask'
  prompt: string
  scope: 'selection' | 'view' | 'canvas' | 'single'
  viewport: { x: number; y: number; zoom: number }
  canvasBounds: { minX: number; minY: number; maxX: number; maxY: number }
  selectedNodes: unknown[]
  selectedNodeIds: string[]
  visibleNodes: unknown[]
  allNodes?: unknown[]
  edges: unknown[]
  workspaceSettings?: {
    defaultProvider: string
    themeMode: 'dark' | 'light'
  }
  estimatedTokens: number
  maxTokens: number
  requestId?: string
}

// IPC Response types (mirror from ../shared/ipc-types.ts for preload isolation)
export interface IPCError {
  code: string
  message: string
  details?: string
}

export interface IPCMeta {
  timestamp: number
  duration?: number
}

export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: IPCError
  meta?: IPCMeta
}

/** @deprecated Use IPCResponse instead */
export interface GeneratePlanResponse {
  success: boolean
  plan?: unknown
  error?: string
}

// Streaming event payloads for AI Editor
export interface StreamChunkPayload {
  type: 'text' | 'tool_use' | 'tool_result'
  content: string
  toolName?: string
  toolId?: string
  requestId?: string
}

export interface StreamPhasePayload {
  phase:
    | 'initializing'
    | 'analyzing'
    | 'planning'
    | 'finalizing'
    | 'complete'
    | 'error'
    | 'cancelled'
  message?: string
  tokensUsed?: number
  requestId?: string
}

export interface StreamCompletePayload<T = unknown> {
  success: boolean
  data?: T
  error?: string
  duration?: number
  requestId?: string
}

export interface StreamErrorPayload {
  error: string
  requestId?: string
}

export interface RefinePlanRequest {
  currentPlan: unknown
  conversationHistory: unknown[]
  refinementPrompt: string
  context: AIEditorContext
}

export interface AIEditorAPI {
  // Non-streaming generation
  generatePlan: (context: AIEditorContext) => Promise<IPCResponse<unknown>>
  generatePlanWithAgent: (context: AIEditorContext) => Promise<IPCResponse<unknown>>

  // Streaming generation
  generatePlanStreaming: (
    context: AIEditorContext,
  ) => Promise<{ success: boolean; message?: string }>
  cancelGeneration: () => Promise<{ success: boolean; cancelled: boolean }>

  // Plan refinement
  refinePlan: (request: RefinePlanRequest) => Promise<IPCResponse<unknown>>

  // Streaming event listeners
  onPlanChunk: (callback: (chunk: StreamChunkPayload) => void) => () => void
  onPlanPhase: (callback: (phase: StreamPhasePayload) => void) => () => void
  onPlanComplete: (callback: (result: StreamCompletePayload) => void) => () => void
  onPlanError: (callback: (error: StreamErrorPayload) => void) => () => void
}

// Agent API types for embedded Claude agent
export interface AgentRequestPayload {
  requestId: string
  conversationId: string
  messages: Array<{ role: string; content: unknown }>
  context: string
  tools: unknown[]
  model?: string
  maxTokens?: number
  memory?: {
    entries: Array<{
      key: string
      value: string
      createdAt: string
      updatedAt?: string
      source: 'agent' | 'user'
    }>
    maxEntries: number
    maxKeyLength: number
    maxValueLength: number
  }
  systemPromptPrefix?: string
  /** When true, the client owns the tool loop and the orchestrator should return after the first turn. */
  clientManagesToolLoop?: boolean
}

export type AgentStreamChunk =
  | {
      requestId: string
      conversationId: string
      type: 'text_delta'
      content: string
    }
  | {
      requestId: string
      conversationId: string
      type: 'tool_use_start'
      toolUseId: string
      toolName: string
    }
  | {
      requestId: string
      conversationId: string
      type: 'tool_use_delta'
      toolUseId: string
      toolInput: string // Partial JSON
    }
  | {
      requestId: string
      conversationId: string
      type: 'tool_use_end'
      toolUseId: string
    }
  | {
      requestId: string
      conversationId: string
      type: 'done'
      stopReason: string
      usage?: {
        input_tokens: number
        output_tokens: number
        cache_creation_input_tokens?: number
        cache_read_input_tokens?: number
      }
    }
  | {
      requestId: string
      conversationId: string
      type: 'error'
      error: string
    }
  | {
      requestId: string
      conversationId: string
      /** Signals the start of a new LLM turn within a multi-turn agentLoop run.
       * Renderer should create a new assistant message placeholder and reset
       * the accumulated text buffer. Not emitted for turn 1 (which uses the
       * initial placeholder added before the first sendWithTools call). */
      type: 'turn_start'
      turnIndex: number
    }

// ---------------------------------------------------------------------------
// Transport event payload types (mirrored from agentEventReceiver.ts — preload
// is isolated from renderer so we define these here and keep them in sync)
// ---------------------------------------------------------------------------

/** Fired when the main process begins executing a tool. */
export interface ToolStartPayload {
  conversationId: string
  toolName: string
  toolId: string
  toolInput?: Record<string, unknown>
}

/** Fired when the main process finishes executing a tool. */
export interface ToolResultPayload {
  conversationId: string
  toolId: string
  toolName: string
  result: {
    success: boolean
    output?: unknown
    error?: string
  }
}

/** Fired when the main process creates a canvas node during tool execution. */
export interface NodeCreatedPayload {
  conversationId: string
  nodeId: string
  type: string
  position: { x: number; y: number }
  title?: string
  tempId?: string
}

/** Fired when the agent run finishes (success, error, or cancel). */
export interface AgentCompletePayload {
  conversationId: string
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  stopReason: string
}

export interface AgentAPI {
  sendWithTools: (payload: AgentRequestPayload) => Promise<void>
  cancel: (requestId: string) => Promise<void>
  onStreamChunk: (callback: (data: AgentStreamChunk) => void) => () => void
  /** Fired when the main process begins executing a tool. */
  onToolStart: (callback: (data: ToolStartPayload) => void) => () => void
  /** Fired when the main process finishes executing a tool. */
  onToolResult: (callback: (data: ToolResultPayload) => void) => () => void
  /** Fired when the main process creates a canvas node during tool execution. */
  onNodeCreated: (callback: (data: NodeCreatedPayload) => void) => () => void
  /** Fired when the agent run finishes (success, error, or cancel). */
  onComplete: (callback: (data: AgentCompletePayload) => void) => () => void
}

export interface ConversationAPI {
  appendMessage: (
    workspaceId: string,
    conversationId: string,
    message: unknown,
  ) => Promise<{ success: boolean; error?: string }>
  loadMessages: (
    workspaceId: string,
    conversationId: string,
  ) => Promise<{ success: boolean; data?: unknown[]; error?: string }>
  loadAllMessages: (
    workspaceId: string,
  ) => Promise<{ success: boolean; data?: unknown[]; error?: string }>
  migrate: (workspaceId: string) => Promise<{ success: boolean; error?: string }>
}

// Filesystem API types (agent filesystem tools — Path B)
export interface FilesystemToolResult {
  success: boolean
  result?: unknown
  error?: string
}

export interface FilesystemAPI {
  readFile: (
    filePath: string,
    allowedPaths: string[],
    startLine?: number,
    endLine?: number,
  ) => Promise<FilesystemToolResult>
  writeFile: (
    filePath: string,
    content: string,
    allowedPaths: string[],
  ) => Promise<FilesystemToolResult>
  editFile: (
    filePath: string,
    oldString: string,
    newString: string,
    allowedPaths: string[],
  ) => Promise<FilesystemToolResult>
  listDirectory: (dirPath: string, allowedPaths: string[]) => Promise<FilesystemToolResult>
  searchFiles: (
    dirPath: string,
    pattern: string,
    allowedPaths: string[],
    fileGlob?: string,
  ) => Promise<FilesystemToolResult>
  executeCommand: (
    command: string,
    allowedPaths: string[],
    allowedCommands: string[],
    cwd?: string,
    timeoutMs?: number,
  ) => Promise<FilesystemToolResult>
}

// Attachment API types
export interface AttachmentAPI {
  add: () => Promise<{ success: boolean; data?: unknown; error?: string }>
  delete: (storedPath: string) => Promise<{ success: boolean; error?: string }>
  open: (storedPath: string) => Promise<{ success: boolean; error?: string }>
  readText: (
    storedPath: string,
  ) => Promise<{ success: boolean; data?: string | null; reason?: string; error?: string }>
}

// Connector API types
export interface ConnectorTestRequest {
  provider: string
  apiKey: string
  model: string
  baseUrl?: string
}

export interface ConnectorTestResponse {
  success: boolean
  error?: string
}

export interface MCPTestRequest {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface MCPTestResponse {
  success: boolean
  error?: string
  toolCount?: number
  resourceCount?: number
  serverName?: string
  serverVersion?: string
}

export interface ConnectorAPI {
  test: (request: ConnectorTestRequest) => Promise<ConnectorTestResponse>
  testMCP: (request: MCPTestRequest) => Promise<MCPTestResponse>
}

export interface MultiplayerAPI {
  shareWorkspace: (
    workspaceId: string,
    workspaceName: string,
  ) => Promise<{
    success: boolean
    token?: string
    workspaceId?: string
    serverUrl?: string
    error?: string
  }>
  createInvite: (
    workspaceId: string,
    permissions: string,
    expiresAt?: string,
  ) => Promise<{
    success: boolean
    token?: string
    inviteUrl?: string
    permissions?: string
    expiresAt?: string
    error?: string
  }>
  listTokens: (
    workspaceId: string,
  ) => Promise<{ success: boolean; tokens?: unknown[]; error?: string }>
  revokeToken: (tokenId: string) => Promise<{ success: boolean; error?: string }>
  parseInviteLink: (link: string) => Promise<{
    success: boolean
    workspaceId?: string
    token?: string
    serverUrl?: string
    error?: string
  }>
  getServerStatus: () => Promise<{
    success: boolean
    status?: string
    connections?: number
    error?: string
  }>
  getServerUrl: () => Promise<{ success: boolean; wsUrl?: string }>
  onDeepLink: (callback: (data: { workspaceId: string; token: string }) => void) => () => void
  createBranch: (
    workspaceId: string,
    branchName: string,
  ) => Promise<{ success: boolean; branchWorkspaceId?: string; token?: string; error?: string }>
  listBranches: (
    workspaceId: string,
  ) => Promise<{ success: boolean; branches?: unknown[]; error?: string }>
  mergeBranch: (
    targetWorkspaceId: string,
    sourceWorkspaceId: string,
  ) => Promise<{ success: boolean; error?: string }>
  // Token management (matches ipcMain handlers in multiplayer.ts)
  storeToken: (workspaceId: string, token: string) => Promise<{ success: boolean; error?: string }>
  getToken: (
    workspaceId: string,
  ) => Promise<{ success: boolean; token?: string | null; error?: string }>
  removeToken: (workspaceId: string) => Promise<{ success: boolean; error?: string }>
  validateToken: (workspaceId: string) => Promise<{
    success: boolean
    valid?: boolean
    workspaceId?: string
    permissions?: string
    expiresAt?: string
    expiresIn?: number
    error?: string
    code?: string
  }>
  refreshToken: (workspaceId: string) => Promise<{
    success: boolean
    token?: string
    expiresAt?: string
    expiresIn?: number | null
    error?: string
    code?: string
  }>
}

export interface BackupAPI {
  list: () => Promise<Array<{ name: string; timestamp: number; size: number }>>
  restore: (backupName: string) => Promise<{ success: boolean; error?: string }>
  openFolder: () => Promise<void>
  create: () => Promise<{ success: boolean; path?: string | null }>
}

// Claude Code Bridge API types
export interface CCBridgeActivityEvent {
  type: 'tool_use' | 'message' | 'session_start' | 'session_end' | 'error'
  timestamp: number
  sessionId: string
  data: {
    toolName?: string
    toolInput?: Record<string, unknown>
    content?: string
    filePaths?: string[]
    workingDirectory?: string
  }
}

// CC Bridge Dispatch types (mirror from bridge-types.ts for preload isolation)
export interface CCBridgeDispatchMessage {
  id: string
  type: 'task' | 'context' | 'instruction'
  priority: 'high' | 'normal' | 'low'
  content: string
  contextNodeIds?: string[]
  contextText?: string
  filePaths?: string[]
  sourceNodeId?: string
  createdAt: number
  updatedAt: number
  status: 'pending' | 'acknowledged' | 'completed' | 'failed' | 'timeout'
  completionMessage?: string
}

export interface CCBridgeDispatchResult {
  success: boolean
  dispatch?: CCBridgeDispatchMessage
  error?: string
}

export interface CCBridgeAPI {
  /** Subscribe to real-time activity events from Claude Code. Returns cleanup function. */
  onActivity: (callback: (event: CCBridgeActivityEvent) => void) => () => void
  /** Request recent event history from the main process. */
  getHistory: (limit?: number) => Promise<CCBridgeActivityEvent[]>
  /** Queue a dispatch task for Claude Code. */
  dispatchTask: (message: CCBridgeDispatchMessage) => Promise<CCBridgeDispatchResult>
  /** Get all dispatches in the queue. */
  getDispatchQueue: () => Promise<CCBridgeDispatchMessage[]>
  /** Cancel a pending dispatch by ID. */
  cancelDispatch: (dispatchId: string) => Promise<{ success: boolean; error?: string }>
  /** Get the active dispatch server port (null if not running). */
  getDispatchPort: () => Promise<number | null>
  /** Start the dispatch server. */
  startDispatchServer: () => Promise<{ success: boolean; port?: number; error?: string }>
  /** Stop the dispatch server. */
  stopDispatchServer: () => Promise<{ success: boolean }>
  /** Subscribe to dispatch state updates. Returns cleanup function. */
  onDispatchUpdate: (callback: (dispatch: CCBridgeDispatchMessage) => void) => () => void
  /** Subscribe to dispatch completion events. Returns cleanup function. */
  onDispatchCompleted: (
    callback: (data: { dispatch: CCBridgeDispatchMessage; filesModified: string[] }) => void,
  ) => () => void
}

// Orchestrator API types
export interface OrchestratorStatusUpdatePayload {
  orchestratorId: string
  runId: string
  type: string
  agentNodeId?: string
  totalTokens?: number
  totalCostUSD?: number
  error?: string
}

export interface OrchestratorAPI {
  start: (
    orchestratorId: string,
    parentOrchestrationId?: string,
  ) => Promise<{ success: boolean; error?: string }>
  pause: (orchestratorId: string) => Promise<{ success: boolean; error?: string }>
  resume: (orchestratorId: string) => Promise<{ success: boolean; error?: string }>
  abort: (orchestratorId: string) => Promise<{ success: boolean; error?: string }>
  resync: () => Promise<Record<string, { runId: string; status: string }>>
  onStatusUpdate: (callback: (data: OrchestratorStatusUpdatePayload) => void) => () => void
}

// MCP Client API types (Cognograph consumes external MCP servers — Path C)
export interface MCPServerConfig {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  serverId: string
  serverName: string
}

export interface MCPToolCallResult {
  success: boolean
  result?: unknown
  error?: string
}

export interface MCPConnectionInfo {
  id: string
  name: string
  toolCount: number
  connectedAt: number
}

export interface MCPClientAPI {
  connect: (
    config: MCPServerConfig,
  ) => Promise<{ success: boolean; tools?: MCPToolDefinition[]; error?: string }>
  disconnect: (serverId: string) => Promise<{ success: boolean; error?: string }>
  discoverTools: (serverId: string) => Promise<{ success: boolean; tools: MCPToolDefinition[] }>
  callTool: (
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<MCPToolCallResult>
  listConnections: () => Promise<{ success: boolean; connections: MCPConnectionInfo[] }>
  getToolsForServers: (
    serverIds: string[],
  ) => Promise<{ success: boolean; tools: MCPToolDefinition[] }>
}

export interface CredentialAPI {
  set: (
    workspaceId: string,
    credentialKey: string,
    value: string,
    label: string,
    credentialType: string,
  ) => Promise<{ success: boolean; error?: string }>
  getMasked: (workspaceId: string, credentialKey: string) => Promise<string | null>
  getReal: (workspaceId: string, credentialKey: string) => Promise<string | null>
  delete: (
    workspaceId: string,
    credentialKey: string,
  ) => Promise<{ success: boolean; error?: string }>
  list: (
    workspaceId: string,
  ) => Promise<
    Array<{ key: string; label: string; credentialType: string; updatedAt: number; masked: string }>
  >
}

// Spatial Command Bridge API types
export interface BridgeAPI {
  undoAuditEvent: (
    eventId: string,
    undoData: unknown,
  ) => Promise<{ success: boolean; undoType?: string; error?: string }>
  exportAuditToFile: (
    content: string,
    format: 'csv' | 'json',
  ) => Promise<{ success: boolean; path?: string; error?: string }>
  analyzeGraph: (
    snapshot: unknown,
  ) => Promise<{ success: boolean; insights?: unknown[]; error?: string }>
  getBudget: () => Promise<{ dailyLimitUSD: number; usedTodayUSD: number; remainingUSD: number }>
  setBudgetLimit: (limitUSD: number) => Promise<{ success: boolean }>
  resetBudget: () => Promise<{ success: boolean }>
  startAnalysis: (intervalMs?: number) => Promise<{ success: boolean }>
  stopAnalysis: () => Promise<{ success: boolean }>
  markNodesChanged: (nodeIds: string[]) => Promise<{ success: boolean }>
  insightAction: (
    insightId: string,
    action: 'apply' | 'dismiss',
  ) => Promise<{ success: boolean; insightId: string; action: string }>
  submitCommand: (text: string) => Promise<{
    success: boolean
    data?: { parsed: unknown; proposalId: string; proposal?: unknown }
    message?: string
    error?: string
  }>
  onInsights: (callback: (insights: unknown[]) => void) => () => void
  onSnapshotRequest: (callback: (requestId: string) => void) => () => void
  respondSnapshot: (requestId: string, snapshot: unknown) => void
}

export interface NotionAPI {
  testConnection: () => Promise<{ success: boolean; workspaceName?: string; error?: string }>
  isConnected: () => Promise<{
    connected: boolean
    config?: { workflowsDbId: string; execLogDbId: string }
  }>
  health: () => Promise<{
    circuitState: string
    syncEnabled: boolean
    hasToken: boolean
    hasConfig: boolean
  }>
}

export interface TerminalAPI {
  spawn: (config: {
    nodeId: string
    sessionId: string
    cwd?: string
    cols?: number
    rows?: number
    shell?: string
    nodeTitle?: string
    workspaceId?: string
  }) => Promise<{ sessionId: string; nodeId: string; pid: number }>
  write: (nodeId: string, data: string) => Promise<void>
  resize: (nodeId: string, cols: number, rows: number) => Promise<void>
  kill: (nodeId: string) => Promise<void>
  getScrollback: (nodeId: string) => Promise<string[]>
  /** Subscribe to PTY data events for a specific node. Returns cleanup function. */
  onData: (nodeId: string, callback: (data: string) => void) => () => void
  /** Subscribe to PTY exit events for a specific node. Returns cleanup function. */
  onExit: (nodeId: string, callback: (exitCode: number) => void) => () => void
  /** Subscribe to PTY data events for ALL nodes. Used by App.tsx for persistent card preview tee. */
  onDataGlobal: (callback: (nodeId: string, data: string) => void) => () => void
}

export interface ElectronAPI {
  workspace: WorkspaceAPI
  settings: SettingsAPI
  llm: LLMAPI
  templates: TemplateAPI
  dialog: DialogAPI
  artifact: ArtifactAPI
  aiEditor: AIEditorAPI
  agent: AgentAPI & {
    checkCli: () => Promise<{ installed: boolean; loggedIn: boolean }>
    login: () => Promise<{ success: boolean }>
  }
  filesystem: FilesystemAPI
  attachment: AttachmentAPI
  connector: ConnectorAPI
  multiplayer: MultiplayerAPI
  backup: BackupAPI
  ccBridge: CCBridgeAPI
  orchestrator: OrchestratorAPI
  mcpClient: MCPClientAPI
  credentials: CredentialAPI
  bridge: BridgeAPI
  notion: NotionAPI
  terminal: TerminalAPI
  plugin: {
    call: (pluginId: string, method: string, ...args: unknown[]) => Promise<unknown>
    on: (pluginId: string, event: string, callback: (...args: unknown[]) => void) => () => void
  }
  plugins: {
    getEnabledIds: () => Promise<string[]>
  }
  folder: {
    list: (folderPath: string) => Promise<{
      success: boolean
      entries: Array<{ name: string; type: 'file' | 'directory' }>
      total: number
      truncated: boolean
      error?: string
    }>
  }
  mainLog?: {
    getBuffer: () => Promise<any[]>
    onEntry: (callback: (entry: any) => void) => () => void
  }
  sdkTool?: {
    onCall: (callback: (data: any) => void) => void
    sendResult: (id: string, result: unknown) => void
    sendError: (id: string, error: string) => void
  }
  context?: {
    /** Register a handler for context refresh requests from the main process */
    onRequest: (callback: (data: { requestId: string; conversationId: string }) => void) => void
    /** Send the context string back to the main process */
    sendResponse: (requestId: string, context: string) => void
  }
  conversation?: ConversationAPI
}

// Expose APIs to renderer
const api: ElectronAPI = {
  workspace: {
    save: (data) => ipcRenderer.invoke('workspace:save', data),
    load: (id) => ipcRenderer.invoke('workspace:load', id),
    list: () => ipcRenderer.invoke('workspace:list'),
    delete: (id) => ipcRenderer.invoke('workspace:delete', id),
    getLastWorkspaceId: () => ipcRenderer.invoke('workspace:getLastId'),
    saveAs: (data, filePath) => ipcRenderer.invoke('workspace:saveAs', data, filePath),
    loadFromPath: (filePath) => ipcRenderer.invoke('workspace:loadFromPath', filePath),
    watch: (id) => ipcRenderer.invoke('workspace:watch', id),
    unwatch: (id) => ipcRenderer.invoke('workspace:unwatch', id),
    onExternalChange: (callback) => {
      // Remove all existing listeners first to prevent duplicates from hot reload
      ipcRenderer.removeAllListeners('workspace:external-change')
      const handler = (_event: Electron.IpcRendererEvent, id: string): void => callback(id)
      ipcRenderer.on('workspace:external-change', handler)
      return () => ipcRenderer.removeListener('workspace:external-change', handler)
    },
    onWorkspaceSaved: (callback) => {
      // Remove all existing listeners first to prevent duplicates from hot reload
      ipcRenderer.removeAllListeners('workspace:saved')
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { filePath: string; canvasId: string; version: number },
      ): void => callback(data)
      ipcRenderer.on('workspace:saved', handler)
      return () => ipcRenderer.removeListener('workspace:saved', handler)
    },
    resetForTest: () => ipcRenderer.invoke('workspace:reset-for-test'),
  },
  dialog: {
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options || {}),
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options || {}),
  },
  artifact: {
    download: (artifact) => ipcRenderer.invoke('artifact:download', artifact),
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getApiKey: (provider) => ipcRenderer.invoke('settings:getApiKey', provider),
    setApiKey: (provider, key) => ipcRenderer.invoke('settings:setApiKey', provider, key),
  },
  llm: {
    send: (options) => ipcRenderer.invoke('llm:send', options),
    cancel: (conversationId?: string) => ipcRenderer.invoke('llm:cancel', conversationId),
    extract: (options) => ipcRenderer.invoke('llm:extract', options),
    onChunk: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: LLMChunkPayload): void =>
        callback(data)
      ipcRenderer.on('llm:chunk', handler)
      return () => ipcRenderer.removeListener('llm:chunk', handler)
    },
    onComplete: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: LLMCompletePayload): void =>
        callback(data)
      ipcRenderer.on('llm:complete', handler)
      return () => ipcRenderer.removeListener('llm:complete', handler)
    },
    onError: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: LLMErrorPayload): void =>
        callback(data)
      ipcRenderer.on('llm:error', handler)
      return () => ipcRenderer.removeListener('llm:error', handler)
    },
  },
  templates: {
    load: () => ipcRenderer.invoke('templates:load'),
    save: (library) => ipcRenderer.invoke('templates:save', library),
    getPath: () => ipcRenderer.invoke('templates:getPath'),
  },
  aiEditor: {
    // Non-streaming generation
    generatePlan: (context) => ipcRenderer.invoke('ai:generatePlan', context),
    generatePlanWithAgent: (context) => ipcRenderer.invoke('ai:generatePlanWithAgent', context),

    // Streaming generation
    generatePlanStreaming: (context) => ipcRenderer.invoke('ai:generatePlanStreaming', context),
    cancelGeneration: () => ipcRenderer.invoke('ai:cancelGeneration'),

    // Plan refinement
    refinePlan: (request) => ipcRenderer.invoke('ai:refinePlan', request),

    // Streaming event listeners
    onPlanChunk: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, chunk: StreamChunkPayload): void =>
        callback(chunk)
      ipcRenderer.on('aiEditor:plan:chunk', handler)
      return () => ipcRenderer.removeListener('aiEditor:plan:chunk', handler)
    },
    onPlanPhase: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, phase: StreamPhasePayload): void =>
        callback(phase)
      ipcRenderer.on('aiEditor:plan:phase', handler)
      return () => ipcRenderer.removeListener('aiEditor:plan:phase', handler)
    },
    onPlanComplete: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, result: StreamCompletePayload): void =>
        callback(result)
      ipcRenderer.on('aiEditor:plan:complete', handler)
      return () => ipcRenderer.removeListener('aiEditor:plan:complete', handler)
    },
    onPlanError: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, error: StreamErrorPayload): void =>
        callback(error)
      ipcRenderer.on('aiEditor:plan:error', handler)
      return () => ipcRenderer.removeListener('aiEditor:plan:error', handler)
    },
  },
  agent: {
    sendWithTools: (payload) => ipcRenderer.invoke('agent:sendWithTools', payload),
    cancel: (requestId) => ipcRenderer.invoke('agent:cancel', requestId),
    onStreamChunk: (callback) => {
      // Remove ALL existing listeners first to prevent duplicates from hot reload
      ipcRenderer.removeAllListeners('agent:stream')
      const handler = (_event: Electron.IpcRendererEvent, data: AgentStreamChunk): void =>
        callback(data)
      ipcRenderer.on('agent:stream', handler)
      return () => ipcRenderer.removeAllListeners('agent:stream')
    },
    onToolStart: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: ToolStartPayload): void =>
        callback(data)
      ipcRenderer.on('agent:tool-start', handler)
      return () => ipcRenderer.removeListener('agent:tool-start', handler)
    },
    onToolResult: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: ToolResultPayload): void =>
        callback(data)
      ipcRenderer.on('agent:tool-result', handler)
      return () => ipcRenderer.removeListener('agent:tool-result', handler)
    },
    onNodeCreated: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: NodeCreatedPayload): void =>
        callback(data)
      ipcRenderer.on('agent:node-created', handler)
      return () => ipcRenderer.removeListener('agent:node-created', handler)
    },
    onComplete: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: AgentCompletePayload): void =>
        callback(data)
      ipcRenderer.on('agent:complete', handler)
      return () => ipcRenderer.removeListener('agent:complete', handler)
    },
    checkCli: () => ipcRenderer.invoke('agent:checkCli'),
    login: () => ipcRenderer.invoke('agent:login'),
  },
  conversation: {
    appendMessage: (workspaceId: string, conversationId: string, message: unknown) =>
      ipcRenderer.invoke('conversation:appendMessage', workspaceId, conversationId, message),
    loadMessages: (workspaceId: string, conversationId: string) =>
      ipcRenderer.invoke('conversation:loadMessages', workspaceId, conversationId),
    loadAllMessages: (workspaceId: string) =>
      ipcRenderer.invoke('conversation:loadAllMessages', workspaceId),
    migrate: (workspaceId: string) => ipcRenderer.invoke('conversation:migrate', workspaceId),
  },
  filesystem: {
    readFile: (filePath, allowedPaths, startLine?, endLine?) =>
      ipcRenderer.invoke('fs:readFile', filePath, allowedPaths, startLine, endLine),
    writeFile: (filePath, content, allowedPaths) =>
      ipcRenderer.invoke('fs:writeFile', filePath, content, allowedPaths),
    editFile: (filePath, oldString, newString, allowedPaths) =>
      ipcRenderer.invoke('fs:editFile', filePath, oldString, newString, allowedPaths),
    listDirectory: (dirPath, allowedPaths) =>
      ipcRenderer.invoke('fs:listDirectory', dirPath, allowedPaths),
    searchFiles: (dirPath, pattern, allowedPaths, fileGlob?) =>
      ipcRenderer.invoke('fs:searchFiles', dirPath, pattern, allowedPaths, fileGlob),
    executeCommand: (command, allowedPaths, allowedCommands, cwd?, timeoutMs?) =>
      ipcRenderer.invoke(
        'fs:executeCommand',
        command,
        allowedPaths,
        allowedCommands,
        cwd,
        timeoutMs,
      ),
  },
  attachment: {
    add: () => ipcRenderer.invoke('attachments:add'),
    delete: (storedPath) => ipcRenderer.invoke('attachments:delete', storedPath),
    open: (storedPath) => ipcRenderer.invoke('attachments:open', storedPath),
    readText: (storedPath) => ipcRenderer.invoke('attachments:readText', storedPath),
  },
  connector: {
    test: (request) => ipcRenderer.invoke('connector:test', request),
    testMCP: (request) => ipcRenderer.invoke('connector:testMCP', request),
  },
  multiplayer: {
    shareWorkspace: (workspaceId, workspaceName) =>
      ipcRenderer.invoke('multiplayer:shareWorkspace', workspaceId, workspaceName),
    createInvite: (workspaceId, permissions, expiresAt) =>
      ipcRenderer.invoke('multiplayer:createInvite', workspaceId, permissions, expiresAt),
    listTokens: (workspaceId) => ipcRenderer.invoke('multiplayer:listTokens', workspaceId),
    revokeToken: (tokenId) => ipcRenderer.invoke('multiplayer:revokeToken', tokenId),
    parseInviteLink: (link) => ipcRenderer.invoke('multiplayer:parseInviteLink', link),
    getServerStatus: () => ipcRenderer.invoke('multiplayer:getServerStatus'),
    getServerUrl: () => ipcRenderer.invoke('multiplayer:getServerUrl'),
    onDeepLink: (callback) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { workspaceId: string; token: string },
      ): void => callback(data)
      ipcRenderer.on('multiplayer:deepLink', handler)
      return () => ipcRenderer.removeListener('multiplayer:deepLink', handler)
    },
    createBranch: (workspaceId, branchName) =>
      ipcRenderer.invoke('multiplayer:createBranch', workspaceId, branchName),
    listBranches: (workspaceId) => ipcRenderer.invoke('multiplayer:listBranches', workspaceId),
    mergeBranch: (targetWorkspaceId, sourceWorkspaceId) =>
      ipcRenderer.invoke('multiplayer:mergeBranch', targetWorkspaceId, sourceWorkspaceId),
    storeToken: (workspaceId, token) =>
      ipcRenderer.invoke('multiplayer:storeToken', workspaceId, token),
    getToken: (workspaceId) => ipcRenderer.invoke('multiplayer:getToken', workspaceId),
    removeToken: (workspaceId) => ipcRenderer.invoke('multiplayer:removeToken', workspaceId),
    validateToken: (workspaceId) => ipcRenderer.invoke('multiplayer:validateToken', workspaceId),
    refreshToken: (workspaceId) => ipcRenderer.invoke('multiplayer:refreshToken', workspaceId),
  },
  backup: {
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (backupName) => ipcRenderer.invoke('backup:restore', backupName),
    openFolder: () => ipcRenderer.invoke('backup:openFolder'),
    create: () => ipcRenderer.invoke('backup:create'),
  },
  ccBridge: {
    onActivity: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: CCBridgeActivityEvent): void =>
        callback(data)
      ipcRenderer.on('cc-bridge:activity', handler)
      return () => ipcRenderer.removeListener('cc-bridge:activity', handler)
    },
    getHistory: (limit) => ipcRenderer.invoke('cc-bridge:getHistory', limit),
    dispatchTask: (message) => ipcRenderer.invoke('cc-bridge:dispatchTask', message),
    getDispatchQueue: () => ipcRenderer.invoke('cc-bridge:getDispatchQueue'),
    cancelDispatch: (dispatchId) => ipcRenderer.invoke('cc-bridge:cancelDispatch', dispatchId),
    getDispatchPort: () => ipcRenderer.invoke('cc-bridge:getDispatchPort'),
    startDispatchServer: () => ipcRenderer.invoke('cc-bridge:startDispatchServer'),
    stopDispatchServer: () => ipcRenderer.invoke('cc-bridge:stopDispatchServer'),
    onDispatchUpdate: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: CCBridgeDispatchMessage): void =>
        callback(data)
      ipcRenderer.on('cc-bridge:dispatch-updated', handler)
      return () => ipcRenderer.removeListener('cc-bridge:dispatch-updated', handler)
    },
    onDispatchCompleted: (callback) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { dispatch: CCBridgeDispatchMessage; filesModified: string[] },
      ): void => callback(data)
      ipcRenderer.on('cc-bridge:dispatch-completed', handler)
      return () => ipcRenderer.removeListener('cc-bridge:dispatch-completed', handler)
    },
  },
  orchestrator: {
    start: (orchestratorId, parentOrchestrationId?) =>
      ipcRenderer.invoke('orchestrator:start', orchestratorId, parentOrchestrationId),
    pause: (orchestratorId) => ipcRenderer.invoke('orchestrator:pause', orchestratorId),
    resume: (orchestratorId) => ipcRenderer.invoke('orchestrator:resume', orchestratorId),
    abort: (orchestratorId) => ipcRenderer.invoke('orchestrator:abort', orchestratorId),
    resync: () => ipcRenderer.invoke('orchestrator:resync'),
    onStatusUpdate: (callback) => {
      ipcRenderer.removeAllListeners('orchestrator:status')
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: OrchestratorStatusUpdatePayload,
      ): void => callback(data)
      ipcRenderer.on('orchestrator:status', handler)
      return () => ipcRenderer.removeAllListeners('orchestrator:status')
    },
  },
  mcpClient: {
    connect: (config) => ipcRenderer.invoke('mcp:connect', config),
    disconnect: (serverId) => ipcRenderer.invoke('mcp:disconnect', serverId),
    discoverTools: (serverId) => ipcRenderer.invoke('mcp:discoverTools', serverId),
    callTool: (serverId, toolName, args) =>
      ipcRenderer.invoke('mcp:callTool', serverId, toolName, args),
    listConnections: () => ipcRenderer.invoke('mcp:listConnections'),
    getToolsForServers: (serverIds) => ipcRenderer.invoke('mcp:getToolsForServers', serverIds),
  },
  credentials: {
    set: (
      workspaceId: string,
      credentialKey: string,
      value: string,
      label: string,
      credentialType: string,
    ) =>
      ipcRenderer.invoke(
        'credentials:set',
        workspaceId,
        credentialKey,
        value,
        label,
        credentialType,
      ),
    getMasked: (workspaceId: string, credentialKey: string) =>
      ipcRenderer.invoke('credentials:getMasked', workspaceId, credentialKey),
    getReal: (workspaceId: string, credentialKey: string) =>
      ipcRenderer.invoke('credentials:getReal', workspaceId, credentialKey),
    delete: (workspaceId: string, credentialKey: string) =>
      ipcRenderer.invoke('credentials:delete', workspaceId, credentialKey),
    list: (workspaceId: string) => ipcRenderer.invoke('credentials:list', workspaceId),
  },
  bridge: {
    undoAuditEvent: (eventId: string, undoData: unknown) =>
      ipcRenderer.invoke('bridge:audit-undo', eventId, undoData),
    exportAuditToFile: (content: string, format: 'csv' | 'json') =>
      ipcRenderer.invoke('bridge:audit-export', content, format),
    analyzeGraph: (snapshot: unknown) => ipcRenderer.invoke('bridge:analyze-graph', snapshot),
    getBudget: () => ipcRenderer.invoke('bridge:get-budget'),
    setBudgetLimit: (limitUSD: number) => ipcRenderer.invoke('bridge:set-budget-limit', limitUSD),
    resetBudget: () => ipcRenderer.invoke('bridge:reset-budget'),
    startAnalysis: (intervalMs?: number) => ipcRenderer.invoke('bridge:start-analysis', intervalMs),
    stopAnalysis: () => ipcRenderer.invoke('bridge:stop-analysis'),
    markNodesChanged: (nodeIds: string[]) =>
      ipcRenderer.invoke('bridge:mark-nodes-changed', nodeIds),
    insightAction: (insightId: string, action: 'apply' | 'dismiss') =>
      ipcRenderer.invoke('bridge:insight-action', insightId, action),
    submitCommand: (text: string) => ipcRenderer.invoke('bridge:submitCommand', text),
    onInsights: (callback: (insights: unknown[]) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown[]): void => callback(data)
      ipcRenderer.on('bridge:insights', handler)
      return () => ipcRenderer.removeListener('bridge:insights', handler)
    },
    /** Listen for snapshot requests from main process (graph intelligence) */
    onSnapshotRequest: (callback: (requestId: string) => void) => {
      ipcRenderer.removeAllListeners('bridge:request-snapshot')
      const handler = (_event: Electron.IpcRendererEvent, requestId: string): void =>
        callback(requestId)
      ipcRenderer.on('bridge:request-snapshot', handler)
      return () => ipcRenderer.removeListener('bridge:request-snapshot', handler)
    },
    /** Respond to a snapshot request from main process */
    respondSnapshot: (requestId: string, snapshot: unknown) =>
      ipcRenderer.send('bridge:snapshot-response', requestId, snapshot),
  },
  notion: {
    testConnection: () => ipcRenderer.invoke('notion:testConnection'),
    isConnected: () => ipcRenderer.invoke('notion:isConnected'),
    health: () => ipcRenderer.invoke('notion:health'),
  },
  terminal: {
    spawn: (config) => ipcRenderer.invoke('terminal:spawn', config),
    write: (nodeId, data) => ipcRenderer.invoke('terminal:write', nodeId, data),
    resize: (nodeId, cols, rows) => ipcRenderer.invoke('terminal:resize', nodeId, cols, rows),
    kill: (nodeId) => ipcRenderer.invoke('terminal:kill', nodeId),
    getScrollback: (nodeId) => ipcRenderer.invoke('terminal:getScrollback', nodeId),
    onData: (nodeId, callback) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, data: string): void => {
        if (id === nodeId) callback(data)
      }
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (nodeId, callback) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, exitCode: number): void => {
        if (id === nodeId) callback(exitCode)
      }
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
    // Global listener for ALL terminal data — used by App.tsx to tee output to node
    // cards even when TerminalPanel is unmounted (user zoomed out from artboard)
    onDataGlobal: (callback: (nodeId: string, data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, data: string): void => {
        callback(id, data)
      }
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
  },
  plugin: {
    call: (pluginId: string, method: string, ...args: unknown[]) => {
      // Validate at the preload boundary — defense-in-depth (main validates too)
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(pluginId))
        throw new Error(`Invalid plugin ID: ${pluginId}`)
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(method)) throw new Error(`Invalid method: ${method}`)
      return ipcRenderer.invoke('plugin:call', pluginId, method, ...args)
    },

    on: (pluginId: string, event: string, callback: (...args: unknown[]) => void) => {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(pluginId))
        throw new Error(`Invalid plugin ID: ${pluginId}`)
      if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(event)) throw new Error(`Invalid event: ${event}`)
      const channel = `plugin:${pluginId}:${event}`
      // LIMITATION: removeAllListeners means only ONE listener per (pluginId, event) pair.
      // This is intentional — prevents StrictMode double-mount accumulation.
      // If multiple components need the same event, use a shared store or context.
      ipcRenderer.removeAllListeners(channel)
      const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
      ipcRenderer.on(channel, handler)
      return () => {
        ipcRenderer.removeListener(channel, handler)
      }
    },
  },
  // Separate namespace — not routed through plugin:call (avoids method regex validation)
  plugins: {
    getEnabledIds: () => ipcRenderer.invoke('plugins:getEnabledIds'),
  },
  folder: {
    list: (folderPath: string) => ipcRenderer.invoke('folder:list', folderPath),
  },
  mainLog: {
    getBuffer: () => ipcRenderer.invoke('main-process-log:getBuffer'),
    onEntry: (callback: (entry: any) => void) => {
      // Remove any stale listeners from previous mounts to prevent duplicates
      ipcRenderer.removeAllListeners('main-process-log')
      const handler = (_event: any, entry: any) => callback(entry)
      ipcRenderer.on('main-process-log', handler)
      return () => ipcRenderer.removeListener('main-process-log', handler)
    },
  },
  sdkTool: {
    onCall: (
      callback: (data: {
        id: string
        toolName: string
        args: Record<string, unknown>
        conversationId?: string
      }) => void,
    ) => {
      ipcRenderer.removeAllListeners('sdk-tool-call')
      ipcRenderer.on('sdk-tool-call', (_event, data) => callback(data))
    },
    sendResult: (id: string, result: unknown) => {
      ipcRenderer.send('sdk-tool-result', { id, result })
    },
    sendError: (id: string, error: string) => {
      ipcRenderer.send('sdk-tool-result', { id, error })
    },
  },
  context: {
    onRequest: (callback: (data: { requestId: string; conversationId: string }) => void) => {
      ipcRenderer.removeAllListeners('context:request')
      ipcRenderer.on('context:request', (_event, data) => callback(data))
    },
    sendResponse: (requestId: string, context: string) => {
      ipcRenderer.send('context:response', { requestId, context })
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

// Expose runtime flags for feature gating
contextBridge.exposeInMainWorld('__ELECTRON__', true)
contextBridge.exposeInMainWorld('__TEST_MODE__', process.env.NODE_ENV === 'test')
