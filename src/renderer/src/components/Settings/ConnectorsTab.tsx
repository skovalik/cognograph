import { memo, useState, useCallback, useEffect } from 'react'
import { Plus, Plug, Server, Trash2, Edit2, Play, Circle, Loader2, CheckCircle, AlertTriangle, X, Database, Link } from 'lucide-react'
import { useConnectorStore } from '../../stores/connectorStore'
import { LLMConnectorCard } from './LLMConnectorCard'
import { AddLLMModal } from './AddLLMModal'
import type { LLMConnector, MCPConnector, ConnectorStatus } from '@shared/types'

function ConnectorsTabComponent(): JSX.Element {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingConnector, setEditingConnector] = useState<LLMConnector | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const connectors = useConnectorStore((s) => s.connectors)
  const removeConnector = useConnectorStore((s) => s.removeConnector)
  const setDefaultLLM = useConnectorStore((s) => s.setDefaultLLM)
  const setConnectorStatus = useConnectorStore((s) => s.setConnectorStatus)

  const handleEdit = useCallback((connector: LLMConnector) => {
    setEditingConnector(connector)
    setAddModalOpen(true)
  }, [])

  const handleTest = useCallback(async (connector: LLMConnector) => {
    setTestingId(connector.id)
    try {
      const apiKey = await window.api.settings.getApiKey(connector.provider)
      if (!apiKey) {
        setConnectorStatus(connector.id, 'error', 'No API key stored for this provider')
        return
      }

      const result = await window.api.connector.test({
        provider: connector.provider,
        apiKey,
        model: connector.model,
        baseUrl: connector.baseUrl
      })

      if (result.success) {
        setConnectorStatus(connector.id, 'connected')
      } else {
        setConnectorStatus(connector.id, 'error', result.error || 'Connection test failed')
      }
    } catch (err) {
      setConnectorStatus(
        connector.id,
        'error',
        err instanceof Error ? err.message : 'Unknown error'
      )
    } finally {
      setTestingId(null)
    }
  }, [setConnectorStatus])

  const handleModalClose = useCallback(() => {
    setAddModalOpen(false)
    setEditingConnector(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium gui-text mb-1">Connectors</h3>
        <p className="text-xs gui-text-secondary">
          Manage your LLM providers and API keys in one place.
        </p>
      </div>

      {/* LLM Providers Section */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b gui-border">
          <div className="flex items-center gap-2">
            <Plug className="w-4 h-4" style={{ color: 'var(--gui-accent-secondary)' }} />
            <span className="text-sm font-medium gui-text">LLM Providers</span>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            className="gui-btn gui-btn-accent gui-btn-sm"
          >
            <Plus className="w-3 h-3" />
            Add Provider
          </button>
        </div>

        {connectors.length === 0 ? (
          <div className="gui-card rounded-lg p-6 text-center">
            <Plug className="w-8 h-8 mx-auto mb-2 gui-text-secondary" />
            <p className="text-sm gui-text-secondary">No LLM providers configured</p>
            <p className="text-xs gui-text-secondary mt-1">
              Add a provider to enable AI features across the workspace.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {connectors.map((connector) => (
              <LLMConnectorCard
                key={connector.id}
                connector={connector}
                onEdit={handleEdit}
                onTest={handleTest}
                onRemove={removeConnector}
                onSetDefault={setDefaultLLM}
                isTesting={testingId === connector.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* MCP Servers Section */}
      <MCPServersSection />

      {/* Notion Integration Section */}
      <NotionSection />

      {/* Add/Edit LLM Modal */}
      {addModalOpen && (
        <AddLLMModal
          connector={editingConnector}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// MCP Servers Section
// -----------------------------------------------------------------------------

function MCPServersSection(): JSX.Element {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingConnector, setEditingConnector] = useState<MCPConnector | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const mcpConnectors = useConnectorStore((s) => s.mcpConnectors)
  const removeMCPConnector = useConnectorStore((s) => s.removeMCPConnector)
  const setMCPConnectorStatus = useConnectorStore((s) => s.setMCPConnectorStatus)
  const updateMCPConnector = useConnectorStore((s) => s.updateMCPConnector)

  const handleEdit = useCallback((connector: MCPConnector) => {
    setEditingConnector(connector)
    setAddModalOpen(true)
  }, [])

  const handleTest = useCallback(async (connector: MCPConnector) => {
    setTestingId(connector.id)
    try {
      const result = await window.api.connector.testMCP({
        command: connector.command,
        args: connector.args,
        env: connector.env
      })

      if (result.success) {
        setMCPConnectorStatus(connector.id, 'connected')
        updateMCPConnector(connector.id, {
          discoveredTools: result.toolCount,
          discoveredResources: result.resourceCount
        })
      } else {
        setMCPConnectorStatus(connector.id, 'error', result.error || 'Connection test failed')
      }
    } catch (err) {
      setMCPConnectorStatus(
        connector.id,
        'error',
        err instanceof Error ? err.message : 'Unknown error'
      )
    } finally {
      setTestingId(null)
    }
  }, [setMCPConnectorStatus, updateMCPConnector])

  const handleModalClose = useCallback(() => {
    setAddModalOpen(false)
    setEditingConnector(null)
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-3 pb-2 border-b gui-border">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
          <span className="text-sm font-medium gui-text">MCP Servers</span>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="gui-btn gui-btn-accent gui-btn-sm"
        >
          <Plus className="w-3 h-3" />
          Add Server
        </button>
      </div>

      {mcpConnectors.length === 0 ? (
        <div className="gui-card rounded-lg p-6 text-center">
          <Server className="w-8 h-8 mx-auto mb-2 gui-text-secondary" />
          <p className="text-sm gui-text-secondary">No MCP servers configured</p>
          <p className="text-xs gui-text-secondary mt-1">
            Add MCP servers to extend AI capabilities with external tools.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mcpConnectors.map((connector) => (
            <MCPServerCard
              key={connector.id}
              connector={connector}
              onEdit={handleEdit}
              onTest={handleTest}
              onRemove={removeMCPConnector}
              isTesting={testingId === connector.id}
            />
          ))}
        </div>
      )}

      {/* Add/Edit MCP Modal */}
      {addModalOpen && (
        <AddMCPModal
          connector={editingConnector}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// MCP Server Card
// -----------------------------------------------------------------------------

function StatusDot({ status }: { status: ConnectorStatus }): JSX.Element {
  const color = status === 'connected' ? '#22c55e' : status === 'error' ? '#ef4444' : '#6b7280'
  return <Circle className="w-2.5 h-2.5 fill-current" style={{ color }} />
}

function MCPServerCard({ connector, onEdit, onTest, onRemove, isTesting }: {
  connector: MCPConnector
  onEdit: (connector: MCPConnector) => void
  onTest: (connector: MCPConnector) => void
  onRemove: (id: string) => void
  isTesting: boolean
}): JSX.Element {
  return (
    <div className="gui-card rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {isTesting ? (
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--gui-accent-primary)' }} />
          ) : (
            <StatusDot status={connector.status} />
          )}
          <span className="text-sm font-medium gui-text truncate">{connector.name}</span>
          {connector.status === 'connected' && (connector.discoveredTools || connector.discoveredResources) && (
            <span className="text-[10px] gui-text-secondary">
              {connector.discoveredTools ? `${connector.discoveredTools} tools` : ''}
              {connector.discoveredTools && connector.discoveredResources ? ', ' : ''}
              {connector.discoveredResources ? `${connector.discoveredResources} resources` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTest(connector)}
            disabled={isTesting}
            className="p-1.5 rounded gui-btn-ghost transition-colors disabled:opacity-50"
            title="Test connection"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin gui-text-secondary" />
            ) : (
              <Play className="w-3.5 h-3.5 gui-text-secondary" />
            )}
          </button>
          <button
            onClick={() => onEdit(connector)}
            className="p-1.5 rounded gui-btn-ghost transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5 gui-text-secondary" />
          </button>
          <button
            onClick={() => onRemove(connector.id)}
            className="p-1.5 rounded gui-btn-ghost transition-colors hover:text-red-400"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-1.5 text-xs gui-text-secondary font-mono truncate">
        {connector.command}{connector.args?.length ? ` ${connector.args.join(' ')}` : ''}
      </div>
      {connector.status === 'connected' && connector.lastTestedAt && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-green-500">
          <CheckCircle className="w-3 h-3" />
          <span>Connected</span>
        </div>
      )}
      {connector.status === 'error' && connector.lastError && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-red-400">
          <AlertTriangle className="w-3 h-3" />
          <span className="truncate">{connector.lastError}</span>
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Add/Edit MCP Modal
// -----------------------------------------------------------------------------

const MCP_PRESETS: Array<{ name: string; command: string; args: string[]; envHint?: Record<string, string> }> = [
  { name: 'GitHub', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], envHint: { GITHUB_PERSONAL_ACCESS_TOKEN: '' } },
  { name: 'Filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] },
  { name: 'PostgreSQL', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'], envHint: { POSTGRES_CONNECTION_STRING: '' } },
  { name: 'Brave Search', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], envHint: { BRAVE_API_KEY: '' } },
]

function AddMCPModal({ connector, onClose }: {
  connector: MCPConnector | null
  onClose: () => void
}): JSX.Element {
  const addMCPConnector = useConnectorStore((s) => s.addMCPConnector)
  const updateMCPConnector = useConnectorStore((s) => s.updateMCPConnector)

  const [name, setName] = useState(connector?.name || '')
  const [command, setCommand] = useState(connector?.command || '')
  const [argsStr, setArgsStr] = useState(connector?.args?.join(' ') || '')
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>(
    connector?.env
      ? Object.entries(connector.env).map(([key, value]) => ({ key, value }))
      : []
  )

  const isEditing = Boolean(connector)

  const handleSave = useCallback(() => {
    if (!name.trim() || !command.trim()) return

    const args = argsStr.trim() ? argsStr.trim().split(/\s+/) : undefined
    const env = envPairs.filter(p => p.key.trim()).length > 0
      ? Object.fromEntries(envPairs.filter(p => p.key.trim()).map(p => [p.key.trim(), p.value]))
      : undefined

    if (isEditing && connector) {
      updateMCPConnector(connector.id, { name: name.trim(), command: command.trim(), args, env })
    } else {
      addMCPConnector({ type: 'mcp', name: name.trim(), command: command.trim(), args, env })
    }
    onClose()
  }, [name, command, argsStr, envPairs, isEditing, connector, addMCPConnector, updateMCPConnector, onClose])

  const applyPreset = useCallback((preset: typeof MCP_PRESETS[0]) => {
    setName(preset.name)
    setCommand(preset.command)
    setArgsStr(preset.args.join(' '))
    if (preset.envHint) {
      setEnvPairs(Object.entries(preset.envHint).map(([key, value]) => ({ key, value })))
    }
  }, [])

  const addEnvPair = useCallback(() => {
    setEnvPairs(prev => [...prev, { key: '', value: '' }])
  }, [])

  const removeEnvPair = useCallback((index: number) => {
    setEnvPairs(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateEnvPair = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setEnvPairs(prev => prev.map((p, i) => i === index ? { ...p, [field]: val } : p))
  }, [])

  return (
    <div className="gui-backdrop gui-z-modals flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-fluid gui-modal w-[480px] p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-sm font-medium gui-text">
          {isEditing ? 'Edit MCP Server' : 'Add MCP Server'}
        </h3>

        {/* Presets */}
        {!isEditing && (
          <div>
            <label className="block text-xs gui-text-secondary mb-1.5">Quick Presets</label>
            <div className="flex gap-1.5 flex-wrap">
              {MCP_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="px-2 py-1 text-xs gui-card rounded hover:gui-surface-secondary transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs gui-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="gui-input w-full px-3 py-2 rounded text-sm"
            placeholder="e.g., GitHub MCP Server"
            autoFocus
          />
        </div>

        {/* Command */}
        <div>
          <label className="block text-xs gui-text-secondary mb-1">Command</label>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="gui-input w-full px-3 py-2 rounded text-sm font-mono"
            placeholder="e.g., npx, node, python"
          />
        </div>

        {/* Args */}
        <div>
          <label className="block text-xs gui-text-secondary mb-1">Arguments (space-separated)</label>
          <input
            type="text"
            value={argsStr}
            onChange={(e) => setArgsStr(e.target.value)}
            className="gui-input w-full px-3 py-2 rounded text-sm font-mono"
            placeholder="e.g., -y @modelcontextprotocol/server-github"
          />
        </div>

        {/* Environment Variables */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs gui-text-secondary">Environment Variables</label>
            <button
              onClick={addEnvPair}
              className="text-xs gui-text-secondary hover:gui-text transition-colors flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          {envPairs.length === 0 ? (
            <p className="text-xs gui-text-secondary italic">
              No environment variables set. Some servers need API keys here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {envPairs.map((pair, index) => (
                <div key={index} className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={pair.key}
                    onChange={(e) => updateEnvPair(index, 'key', e.target.value)}
                    className="gui-input flex-1 px-2 py-1.5 rounded text-xs font-mono"
                    placeholder="KEY"
                  />
                  <input
                    type="password"
                    value={pair.value}
                    onChange={(e) => updateEnvPair(index, 'value', e.target.value)}
                    className="gui-input flex-[2] px-2 py-1.5 rounded text-xs font-mono"
                    placeholder="value"
                  />
                  <button
                    onClick={() => removeEnvPair(index)}
                    className="p-1 rounded gui-btn-ghost hover:text-red-400 flex-shrink-0"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Command preview */}
        {command.trim() && (
          <div>
            <label className="block text-xs gui-text-secondary mb-1">Preview</label>
            <div className="gui-card rounded p-2 text-xs font-mono gui-text-secondary break-all">
              {envPairs.filter(p => p.key.trim()).map(p => `${p.key}=*** `).join('')}
              {command.trim()}{argsStr.trim() ? ` ${argsStr.trim()}` : ''}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="gui-btn gui-btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !command.trim()}
            className="gui-btn gui-btn-accent disabled:opacity-50"
          >
            {isEditing ? 'Save' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Notion Integration Section
// -----------------------------------------------------------------------------

function NotionSection(): JSX.Element {
  const [token, setToken] = useState('')
  const [workflowsDbId, setWorkflowsDbId] = useState('')
  const [execLogDbId, setExecLogDbId] = useState('')
  const [testing, setTesting] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [workspaceName, setWorkspaceName] = useState<string>('')

  // Node-level sync settings (Section 11 of Node Sync Spec)
  const [nodeSyncEnabled, setNodeSyncEnabled] = useState(false)
  const [tasksDbId, setTasksDbId] = useState('')
  const [projectsDbId, setProjectsDbId] = useState('')
  const [hubPageId, setHubPageId] = useState('')

  // Load existing settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const storedToken = await window.api.settings.getApiKey('notion')
      const workflowsDb = await window.api.settings.get('notionWorkflowsDbId')
      const execLogDb = await window.api.settings.get('notionExecLogDbId')
      const enabled = await window.api.settings.get('notionSyncEnabled')

      // Node sync settings
      const nodeEnabled = await window.api.settings.get('nodeSyncEnabled')
      const tasks = await window.api.settings.get('tasksDbId')
      const projects = await window.api.settings.get('projectsDbId')
      const hub = await window.api.settings.get('hubPageId')

      if (storedToken) {
        // Show masked token (last 4 chars only)
        const masked = '•'.repeat(Math.max(0, storedToken.length - 4)) + storedToken.slice(-4)
        setToken(masked)
        setConnectionStatus('connected')
      }
      if (workflowsDb) setWorkflowsDbId(workflowsDb as string)
      if (execLogDb) setExecLogDbId(execLogDb as string)
      if (enabled !== undefined) setSyncEnabled(enabled as boolean)
      if (nodeEnabled !== undefined) setNodeSyncEnabled(nodeEnabled as boolean)
      if (tasks) setTasksDbId(tasks as string)
      if (projects) setProjectsDbId(projects as string)
      if (hub) setHubPageId(hub as string)
    }
    loadSettings()
  }, [])

  const handleTestConnection = useCallback(async () => {
    if (!token || token.startsWith('•')) {
      setErrorMessage('Please enter a valid Notion token')
      setConnectionStatus('error')
      return
    }

    setTesting(true)
    setErrorMessage('')

    try {
      // Save the token first
      await window.api.settings.setApiKey('notion', token)

      // Test connection via Notion API
      const result = await window.api.notion.testConnection()

      if (result.success) {
        setConnectionStatus('connected')
        setWorkspaceName(result.workspaceName || 'Notion Workspace')
        toast.success(`Connected to ${result.workspaceName}!`)
      } else {
        throw new Error(result.error || 'Connection test failed')
      }

    } catch (err) {
      setConnectionStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }, [token])

  const handleSaveSettings = useCallback(async () => {
    try {
      if (workflowsDbId) {
        await window.api.settings.set('notionWorkflowsDbId', workflowsDbId)
      }
      if (execLogDbId) {
        await window.api.settings.set('notionExecLogDbId', execLogDbId)
      }
      await window.api.settings.set('notionSyncEnabled', syncEnabled)

      // Node sync settings
      await window.api.settings.set('nodeSyncEnabled', nodeSyncEnabled)
      if (tasksDbId) await window.api.settings.set('tasksDbId', tasksDbId)
      if (projectsDbId) await window.api.settings.set('projectsDbId', projectsDbId)
      if (hubPageId) await window.api.settings.set('hubPageId', hubPageId)
    } catch (err) {
      console.error('[NotionSection] Failed to save settings:', err)
    }
  }, [workflowsDbId, execLogDbId, syncEnabled, nodeSyncEnabled, tasksDbId, projectsDbId, hubPageId])

  const handleDisconnect = useCallback(async () => {
    await window.api.settings.setApiKey('notion', '')
    setToken('')
    setConnectionStatus('idle')
    setWorkspaceName('')
    setErrorMessage('')
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-3 pb-2 border-b gui-border">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" style={{ color: 'var(--gui-accent-tertiary)' }} />
          <span className="text-sm font-medium gui-text">Notion Integration</span>
        </div>
        {connectionStatus === 'connected' && (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs gui-text-secondary">{workspaceName}</span>
          </div>
        )}
      </div>

      <div className="gui-card rounded-lg p-4 space-y-4">
        {/* Token Input */}
        <div>
          <label className="block text-xs font-medium gui-text mb-1.5">
            Integration Token
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ntn_secret_..."
              className="flex-1 gui-input text-xs font-mono"
            />
            <button
              onClick={handleTestConnection}
              disabled={testing || !token}
              className="gui-btn gui-btn-accent gui-btn-sm disabled:opacity-50"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Testing
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Test
                </>
              )}
            </button>
            {connectionStatus === 'connected' && (
              <button
                onClick={handleDisconnect}
                className="gui-btn gui-btn-ghost gui-btn-sm"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-xs gui-text-secondary mt-1">
            <Link className="w-3 h-3 inline mr-1" />
            <a
              href="#"
              className="underline"
              onClick={(e) => {
                e.preventDefault()
                // TODO: Open setup guide
              }}
            >
              How to get your Notion token
            </a>
          </p>
          {errorMessage && (
            <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
          )}
          {connectionStatus === 'connected' && !errorMessage && (
            <p className="text-xs text-green-500 mt-1">
              Connected to {workspaceName}
            </p>
          )}
        </div>

        {/* Database IDs */}
        {connectionStatus === 'connected' && (
          <>
            <div>
              <label className="block text-xs font-medium gui-text mb-1.5">
                Workflows Database ID
              </label>
              <input
                type="text"
                value={workflowsDbId}
                onChange={(e) => setWorkflowsDbId(e.target.value)}
                onBlur={handleSaveSettings}
                placeholder="e8baa51a-aa6b-43c4-a687-8b6860408c1d"
                className="w-full gui-input text-xs font-mono"
              />
              <p className="text-xs gui-text-secondary mt-1">
                Paste the database ID from your Notion Workflows database
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium gui-text mb-1.5">
                Execution Log Database ID
              </label>
              <input
                type="text"
                value={execLogDbId}
                onChange={(e) => setExecLogDbId(e.target.value)}
                onBlur={handleSaveSettings}
                placeholder="af568e1c-18dd-4acb-9ee5-0f6875e1de65"
                className="w-full gui-input text-xs font-mono"
              />
              <p className="text-xs gui-text-secondary mt-1">
                Paste the database ID from your Notion Execution Log database
              </p>
            </div>

            {/* Sync Toggle */}
            <div className="flex items-center justify-between pt-2 border-t gui-border">
              <div>
                <div className="text-xs font-medium gui-text">Enable Sync</div>
                <div className="text-xs gui-text-secondary">
                  Sync workspace data to Notion databases
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncEnabled}
                  onChange={(e) => {
                    setSyncEnabled(e.target.checked)
                    handleSaveSettings()
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Node-Level Sync Section */}
            <div className="pt-3 mt-3 border-t gui-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs font-medium gui-text">Node Sync</div>
                  <div className="text-xs gui-text-secondary">
                    Push individual nodes (tasks, projects, notes) to Notion
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nodeSyncEnabled}
                    onChange={(e) => {
                      setNodeSyncEnabled(e.target.checked)
                      handleSaveSettings()
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {nodeSyncEnabled && (
                <div className="space-y-3 pl-2 border-l-2 border-blue-600/30">
                  <div>
                    <label className="block text-xs font-medium gui-text mb-1.5">
                      Tasks Database ID
                    </label>
                    <input
                      type="text"
                      value={tasksDbId}
                      onChange={(e) => setTasksDbId(e.target.value)}
                      onBlur={handleSaveSettings}
                      placeholder="Database ID for task nodes"
                      className="w-full gui-input text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium gui-text mb-1.5">
                      Projects Database ID
                    </label>
                    <input
                      type="text"
                      value={projectsDbId}
                      onChange={(e) => setProjectsDbId(e.target.value)}
                      onBlur={handleSaveSettings}
                      placeholder="Database ID for project nodes"
                      className="w-full gui-input text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium gui-text mb-1.5">
                      Hub Page ID
                    </label>
                    <input
                      type="text"
                      value={hubPageId}
                      onChange={(e) => setHubPageId(e.target.value)}
                      onBlur={handleSaveSettings}
                      placeholder="Parent page for notes and artifacts"
                      className="w-full gui-input text-xs font-mono"
                    />
                    <p className="text-xs gui-text-secondary mt-1">
                      Notes and artifacts sync as child pages under this parent
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export const ConnectorsTab = memo(ConnectorsTabComponent)
