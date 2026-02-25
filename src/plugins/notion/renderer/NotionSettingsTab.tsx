import { useState, useEffect, useCallback } from 'react'
import { Database, CheckCircle, Loader2, Play, X, Link } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { TypedPluginBridge } from '../../types'
import type { NotionMethods } from '../contract'

export function NotionSettingsTab({ plugin }: { plugin: TypedPluginBridge<NotionMethods> }) {
  const [token, setToken] = useState('')
  const [workflowsDbId, setWorkflowsDbId] = useState('')
  const [execLogDbId, setExecLogDbId] = useState('')
  const [testing, setTesting] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [workspaceName, setWorkspaceName] = useState<string>('')

  // Load existing settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const key = await plugin.call('getApiKey')
        const config = await plugin.call('getConfig')

        if (key) {
          // Show masked token (last 4 chars only)
          const masked = '•'.repeat(Math.max(0, key.length - 4)) + key.slice(-4)
          setToken(masked)
          setConnectionStatus('connected')
        }
        setWorkflowsDbId(config.workflowsDbId)
        setExecLogDbId(config.execLogDbId)
        setSyncEnabled(config.syncEnabled)
      } catch (err) {
        console.error('[NotionSettingsTab] Failed to load settings:', err)
      }
    }
    loadSettings()
  }, [plugin])

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
      await plugin.call('setApiKey', token)

      // Test connection via Notion API
      const result = await plugin.call('testConnection')

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
  }, [token, plugin])

  const handleSaveConfig = useCallback(async () => {
    try {
      await plugin.call('setConfig', {
        workflowsDbId,
        execLogDbId,
        syncEnabled
      })
    } catch (err) {
      console.error('[NotionSettingsTab] Failed to save config:', err)
    }
  }, [workflowsDbId, execLogDbId, syncEnabled, plugin])

  const handleDisconnect = useCallback(async () => {
    await plugin.call('setApiKey', '')
    setToken('')
    setConnectionStatus('idle')
    setWorkspaceName('')
    setErrorMessage('')
  }, [plugin])

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
            See{' '}
            <span className="font-mono">docs/NOTION-SETUP-GUIDE.md</span>
            {' '}for setup instructions
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
                onBlur={handleSaveConfig}
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
                onBlur={handleSaveConfig}
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
                  onChange={async (e) => {
                    const newValue = e.target.checked
                    setSyncEnabled(newValue)
                    // Save immediately with the new value (not stale state)
                    try {
                      await plugin.call('setConfig', {
                        workflowsDbId,
                        execLogDbId,
                        syncEnabled: newValue
                      })
                    } catch (err) {
                      console.error('[NotionSettingsTab] Failed to save sync toggle:', err)
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
