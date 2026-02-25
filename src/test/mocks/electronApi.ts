import { vi } from 'vitest'
import type { ElectronAPI } from '../../preload/index'

/**
 * Creates a mock of the window.api object for testing.
 * All methods return resolved promises with success responses by default.
 * Individual tests can override specific methods as needed.
 */
export const mockElectronApi: ElectronAPI = {
  workspace: {
    save: vi.fn().mockResolvedValue({ success: true }),
    load: vi.fn().mockResolvedValue({ success: true, data: null }),
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    getLastWorkspaceId: vi.fn().mockResolvedValue(null),
    saveAs: vi.fn().mockResolvedValue({ success: true, path: '/mock/path.json' }),
    loadFromPath: vi.fn().mockResolvedValue({ success: true, data: null, path: '/mock/path.json' }),
    watch: vi.fn().mockResolvedValue({ success: true }),
    unwatch: vi.fn().mockResolvedValue({ success: true }),
    onExternalChange: vi.fn().mockReturnValue(() => {})
  },
  settings: {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    getApiKey: vi.fn().mockResolvedValue(null),
    setApiKey: vi.fn().mockResolvedValue({ success: true })
  },
  llm: {
    send: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    extract: vi.fn().mockResolvedValue({ success: true, data: '', meta: { timestamp: Date.now() } }),
    onChunk: vi.fn().mockReturnValue(() => {}),
    onComplete: vi.fn().mockReturnValue(() => {}),
    onError: vi.fn().mockReturnValue(() => {})
  },
  templates: {
    load: vi.fn().mockResolvedValue({ success: true, data: { version: 1, templates: [], categories: [] } }),
    save: vi.fn().mockResolvedValue({ success: true }),
    getPath: vi.fn().mockResolvedValue('/mock/templates.json')
  },
  dialog: {
    showSaveDialog: vi.fn().mockResolvedValue({ success: true, canceled: false, filePath: '/mock/save.json' }),
    showOpenDialog: vi.fn().mockResolvedValue({ success: true, canceled: false, filePaths: ['/mock/open.json'] })
  },
  artifact: {
    download: vi.fn().mockResolvedValue({ success: true, path: '/mock/artifact' })
  },
  aiEditor: {
    generatePlan: vi.fn().mockResolvedValue({ success: true, data: {}, meta: { timestamp: Date.now() } }),
    generatePlanWithAgent: vi.fn().mockResolvedValue({ success: true, data: {}, meta: { timestamp: Date.now() } }),
    generatePlanStreaming: vi.fn().mockResolvedValue({ success: true, message: 'Streaming started' }),
    cancelGeneration: vi.fn().mockResolvedValue({ success: true, cancelled: true }),
    onPlanChunk: vi.fn().mockReturnValue(() => {}),
    onPlanPhase: vi.fn().mockReturnValue(() => {}),
    onPlanComplete: vi.fn().mockReturnValue(() => {}),
    onPlanError: vi.fn().mockReturnValue(() => {})
  },
  agent: {
    sendWithTools: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    onStreamChunk: vi.fn().mockReturnValue(() => {})
  },
  attachment: {
    add: vi.fn().mockResolvedValue({ success: true, data: null }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    open: vi.fn().mockResolvedValue({ success: true }),
    readText: vi.fn().mockResolvedValue({ success: true, data: '' })
  },
  connector: {
    test: vi.fn().mockResolvedValue({ success: true })
  },
  multiplayer: {
    shareWorkspace: vi.fn().mockResolvedValue({ success: true }),
    createInvite: vi.fn().mockResolvedValue({ success: true }),
    listTokens: vi.fn().mockResolvedValue({ success: true, tokens: [] }),
    revokeToken: vi.fn().mockResolvedValue({ success: true }),
    parseInviteLink: vi.fn().mockResolvedValue({ success: true }),
    getServerStatus: vi.fn().mockResolvedValue({ success: true, status: 'idle' }),
    getServerUrl: vi.fn().mockResolvedValue({ success: true, wsUrl: 'ws://localhost:1234' }),
    onDeepLink: vi.fn().mockReturnValue(() => {}),
    createBranch: vi.fn().mockResolvedValue({ success: true }),
    listBranches: vi.fn().mockResolvedValue({ success: true, branches: [] }),
    mergeBranch: vi.fn().mockResolvedValue({ success: true })
  },
  backup: {
    list: vi.fn().mockResolvedValue([]),
    restore: vi.fn().mockResolvedValue({ success: true }),
    openFolder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ success: true, path: '/mock/backup' })
  },
  filesystem: {
    readFile: vi.fn().mockResolvedValue({ success: true, data: '' }),
    listDirectory: vi.fn().mockResolvedValue({ success: true, data: [] }),
    searchFiles: vi.fn().mockResolvedValue({ success: true, data: [] })
  },
  ccBridge: {
    onActivity: vi.fn().mockReturnValue(() => {}),
    getHistory: vi.fn().mockResolvedValue([]),
    dispatchTask: vi.fn().mockResolvedValue({ success: true }),
    getDispatchQueue: vi.fn().mockResolvedValue([]),
    cancelDispatch: vi.fn().mockResolvedValue({ success: true }),
    getDispatchPort: vi.fn().mockResolvedValue(null),
    startDispatchServer: vi.fn().mockResolvedValue({ success: true }),
    stopDispatchServer: vi.fn().mockResolvedValue({ success: true }),
    onDispatchCompleted: vi.fn().mockReturnValue(() => {})
  },
  orchestrator: {
    start: vi.fn().mockResolvedValue({ success: true }),
    pause: vi.fn().mockResolvedValue({ success: true }),
    resume: vi.fn().mockResolvedValue({ success: true }),
    abort: vi.fn().mockResolvedValue({ success: true }),
    resync: vi.fn().mockResolvedValue({ success: true }),
    onStatusUpdate: vi.fn().mockReturnValue(() => {})
  },
  mcpClient: {
    connect: vi.fn().mockResolvedValue({ success: true, tools: [] }),
    disconnect: vi.fn().mockResolvedValue({ success: true }),
    discoverTools: vi.fn().mockResolvedValue({ success: true, tools: [] }),
    callTool: vi.fn().mockResolvedValue({ success: true }),
    listConnections: vi.fn().mockResolvedValue({ success: true, connections: [] }),
    getToolsForServers: vi.fn().mockResolvedValue({ success: true, tools: [] })
  },
  credentials: {
    set: vi.fn().mockResolvedValue({ success: true }),
    getMasked: vi.fn().mockResolvedValue(null),
    getReal: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({ success: true }),
    list: vi.fn().mockResolvedValue([])
  },
  bridge: {
    getEvents: vi.fn().mockResolvedValue([]),
    onEvent: vi.fn().mockReturnValue(() => {}),
    getInsights: vi.fn().mockResolvedValue([]),
    onInsight: vi.fn().mockReturnValue(() => {}),
    applyInsight: vi.fn().mockResolvedValue({ success: true }),
    dismissInsight: vi.fn().mockResolvedValue({ success: true }),
    getCostSummary: vi.fn().mockResolvedValue({ totalCost: 0, breakdown: [] })
  } as ElectronAPI['bridge'],
  notion: {
    testConnection: vi.fn().mockResolvedValue({ success: true }),
    isConnected: vi.fn().mockResolvedValue({ connected: false }),
    health: vi.fn().mockResolvedValue({ circuitState: 'closed', syncEnabled: false, hasToken: false, hasConfig: false })
  },
  terminal: {
    spawn: vi.fn().mockResolvedValue({ sessionId: 'mock-session', nodeId: 'mock-node', pid: 1234 }),
    write: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn().mockResolvedValue(undefined),
    kill: vi.fn().mockResolvedValue(undefined),
    getScrollback: vi.fn().mockResolvedValue([]),
    onData: vi.fn().mockReturnValue(() => {}),
    onExit: vi.fn().mockReturnValue(() => {})
  },
  plugin: {
    call: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => {})
  },
  plugins: {
    getEnabledIds: vi.fn().mockResolvedValue([])
  }
}

/**
 * Helper to reset all mocks between tests
 */
export function resetElectronApiMocks(): void {
  const resetMocks = (obj: Record<string, unknown>): void => {
    for (const key of Object.keys(obj)) {
      const value = obj[key]
      if (typeof value === 'function' && 'mockReset' in value) {
        ;(value as ReturnType<typeof vi.fn>).mockReset()
      } else if (typeof value === 'object' && value !== null) {
        resetMocks(value as Record<string, unknown>)
      }
    }
  }
  resetMocks(mockElectronApi as unknown as Record<string, unknown>)
}
