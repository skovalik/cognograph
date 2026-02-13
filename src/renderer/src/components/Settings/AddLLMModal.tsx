import { memo, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { useConnectorStore } from '../../stores/connectorStore'
import type { LLMConnector, ConnectorProvider } from '@shared/types'
import { CONNECTOR_PROVIDER_INFO } from '@shared/types'

interface AddLLMModalProps {
  connector: LLMConnector | null // null = add mode, non-null = edit mode
  onClose: () => void
}

const PROVIDERS: ConnectorProvider[] = ['anthropic', 'openai', 'gemini', 'ollama', 'custom']

function AddLLMModalComponent({ connector, onClose }: AddLLMModalProps): JSX.Element {
  const isEditing = connector !== null

  const [name, setName] = useState(connector?.name || '')
  const [provider, setProvider] = useState<ConnectorProvider>(connector?.provider || 'anthropic')
  const [model, setModel] = useState(connector?.model || CONNECTOR_PROVIDER_INFO['anthropic'].defaultModel)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(connector?.baseUrl || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addConnector = useConnectorStore((s) => s.addConnector)
  const updateConnector = useConnectorStore((s) => s.updateConnector)

  const providerInfo = CONNECTOR_PROVIDER_INFO[provider]
  const showBaseUrl = providerInfo?.requiresBaseUrl

  const handleProviderChange = useCallback((newProvider: ConnectorProvider) => {
    setProvider(newProvider)
    const info = CONNECTOR_PROVIDER_INFO[newProvider]
    if (info && !isEditing) {
      setModel(info.defaultModel)
      setName(info.label)
      if (!info.requiresBaseUrl) {
        setBaseUrl('')
      } else if (newProvider === 'ollama') {
        setBaseUrl('http://localhost:11434')
      }
    }
  }, [isEditing])

  const handleSave = useCallback(async () => {
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!apiKey.trim() && !isEditing) {
      setError('API key is required')
      return
    }
    if (showBaseUrl && !baseUrl.trim()) {
      setError('Base URL is required for this provider')
      return
    }

    setSaving(true)

    try {
      if (isEditing) {
        updateConnector(connector.id, {
          name: name.trim(),
          provider,
          model: model.trim() || providerInfo.defaultModel,
          baseUrl: showBaseUrl ? baseUrl.trim() : undefined,
          status: 'untested'
        })

        if (apiKey.trim()) {
          await window.api.settings.setApiKey(`connector_${connector.id}`, apiKey.trim())
          await window.api.settings.setApiKey(provider, apiKey.trim())
        }
      } else {
        const newId = addConnector({
          type: 'llm',
          name: name.trim(),
          provider,
          model: model.trim() || providerInfo.defaultModel,
          baseUrl: showBaseUrl ? baseUrl.trim() : undefined
        })

        if (apiKey.trim()) {
          await window.api.settings.setApiKey(`connector_${newId}`, apiKey.trim())
          await window.api.settings.setApiKey(provider, apiKey.trim())
        }
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }, [name, provider, model, apiKey, baseUrl, showBaseUrl, isEditing, connector, addConnector, updateConnector, providerInfo, onClose])

  return (
    <div className="gui-backdrop gui-z-dropdowns flex items-center justify-center">
      <div className="gui-modal glass-fluid w-[460px]">
        {/* Header */}
        <div className="gui-panel-header p-4">
          <h3 className="font-semibold gui-text">
            {isEditing ? 'Edit LLM Provider' : 'Add LLM Provider'}
          </h3>
          <button
            onClick={onClose}
            className="gui-btn gui-btn-ghost gui-btn-icon rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Provider */}
          <div>
            <label className="block text-xs font-medium gui-text-secondary mb-1.5">
              Provider
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PROVIDERS.map((p) => {
                const info = CONNECTOR_PROVIDER_INFO[p]
                return (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                      provider === p
                        ? 'gui-btn-accent'
                        : 'gui-card'
                    }`}
                  >
                    {info.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium gui-text-secondary mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="gui-input w-full px-3 py-2 text-sm rounded"
              placeholder="e.g. My Anthropic Key"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium gui-text-secondary mb-1.5">
              API Key {isEditing && <span className="font-normal">(leave blank to keep current)</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="gui-input w-full px-3 py-2 text-sm rounded font-mono"
              placeholder={isEditing ? '********' : 'sk-...'}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-medium gui-text-secondary mb-1.5">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="gui-input w-full px-3 py-2 text-sm rounded font-mono"
              placeholder={providerInfo?.defaultModel || 'model-name'}
            />
          </div>

          {/* Base URL (conditional) */}
          {showBaseUrl && (
            <div>
              <label className="block text-xs font-medium gui-text-secondary mb-1.5">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="gui-input w-full px-3 py-2 text-sm rounded font-mono"
                placeholder={provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t gui-border">
          <button
            onClick={onClose}
            className="gui-btn gui-btn-ghost"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="gui-btn gui-btn-accent"
          >
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Add Provider'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const AddLLMModal = memo(AddLLMModalComponent)
