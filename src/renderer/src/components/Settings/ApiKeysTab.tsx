/**
 * ApiKeysTab — Manage BYOK API keys + managed credit toggle.
 *
 * Each provider shows key status (your key / Cognograph API / not configured),
 * with test, add, and remove actions. Uses cloud apiKeyStore when auth is
 * available, falls back to Electron IPC for local desktop key storage.
 */

import { memo, useState, useCallback, useEffect } from 'react'
import { Key, Plus, Trash2, Play, Loader2, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useApiKeyStore, type ApiKeyEntry } from '../../../../web/stores/apiKeyStore'
import { isAuthEnabled } from '../../../../web/lib/supabase'

// ---------------------------------------------------------------------------
// Provider definitions
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-api03-...' },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'google', name: 'Google (Gemini)', placeholder: 'AIza...' },
  { id: 'stability', name: 'Stability AI', placeholder: 'sk-...' },
  { id: 'replicate', name: 'Replicate', placeholder: 'r8_...' },
  { id: 'elevenlabs', name: 'ElevenLabs', placeholder: 'sk_...' },
] as const

type ProviderId = (typeof PROVIDERS)[number]['id']

// ---------------------------------------------------------------------------
// Provider Card
// ---------------------------------------------------------------------------

function ProviderCard({ provider, existingKey, onAdd, onRemove, onTest }: {
  provider: typeof PROVIDERS[number]
  existingKey: ApiKeyEntry | undefined
  onAdd: (providerId: string, key: string) => Promise<boolean>
  onRemove: (keyId: string) => Promise<boolean>
  onTest: (providerId: string, key: string) => Promise<boolean>
}): JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [saving, setSaving] = useState(false)

  const handleAdd = useCallback(async () => {
    if (!inputValue.trim()) return
    setSaving(true)
    const ok = await onAdd(provider.id, inputValue.trim())
    setSaving(false)
    if (ok) {
      setInputValue('')
      setShowInput(false)
    }
  }, [inputValue, provider.id, onAdd])

  const handleTest = useCallback(async () => {
    const keyToTest = inputValue.trim() || ''
    if (!keyToTest && !existingKey) return
    setTesting(true)
    setTestResult(null)
    const valid = await onTest(provider.id, keyToTest)
    setTestResult(valid ? 'success' : 'error')
    setTesting(false)
  }, [inputValue, existingKey, provider.id, onTest])

  const handleRemove = useCallback(async () => {
    if (!existingKey) return
    await onRemove(existingKey.id)
    setTestResult(null)
  }, [existingKey, onRemove])

  return (
    <div className="gui-card rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Key className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--gui-accent-secondary)' }} />
          <span className="text-sm font-medium gui-text">{provider.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {existingKey ? (
            <>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                <ShieldCheck className="w-3 h-3" />
                ••••{existingKey.lastFour}
              </span>
              <button
                onClick={handleRemove}
                className="p-1 rounded gui-btn-ghost transition-colors hover:text-red-400"
                title="Remove key"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              className="gui-btn gui-btn-ghost gui-btn-sm text-xs"
            >
              <Plus className="w-3 h-3" /> Add Key
            </button>
          )}
        </div>
      </div>

      {/* Inline key input */}
      {showInput && !existingKey && (
        <div className="mt-2 flex gap-1.5">
          <input
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={provider.placeholder}
            className="gui-input flex-1 px-2 py-1.5 rounded text-xs font-mono"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowInput(false) }}
          />
          <button
            onClick={handleTest}
            disabled={!inputValue.trim() || testing}
            className="p-1.5 rounded gui-btn-ghost transition-colors disabled:opacity-50"
            title="Test key"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim() || saving}
            className="gui-btn gui-btn-accent gui-btn-sm text-xs disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
          </button>
        </div>
      )}

      {/* Test result */}
      {testResult === 'success' && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-green-500">
          <CheckCircle className="w-3 h-3" />
          <span>Key is valid</span>
        </div>
      )}
      {testResult === 'error' && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-400">
          <AlertTriangle className="w-3 h-3" />
          <span>Key validation failed</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Tab
// ---------------------------------------------------------------------------

function ApiKeysTabComponent(): JSX.Element {
  const keys = useApiKeyStore((s) => s.keys)
  const loading = useApiKeyStore((s) => s.loading)
  const fetchKeys = useApiKeyStore((s) => s.fetchKeys)
  const addKey = useApiKeyStore((s) => s.addKey)
  const removeKey = useApiKeyStore((s) => s.removeKey)
  const testKey = useApiKeyStore((s) => s.testKey)

  useEffect(() => {
    if (isAuthEnabled()) fetchKeys()
  }, [fetchKeys])

  const getKeyForProvider = (providerId: string): ApiKeyEntry | undefined =>
    keys.find(k => k.provider === providerId)

  if (!isAuthEnabled()) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium gui-text mb-1">API Keys</h3>
          <p className="text-xs gui-text-secondary">
            Sign in to manage API keys securely in the cloud. Keys are encrypted at rest.
          </p>
        </div>
        <div className="gui-card rounded-lg p-6 text-center">
          <Key className="w-8 h-8 mx-auto mb-2 gui-text-secondary" />
          <p className="text-sm gui-text-secondary">Cloud key management requires sign-in</p>
          <p className="text-xs gui-text-secondary mt-1">
            In desktop mode, keys are managed in the Connectors tab.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium gui-text mb-1">API Keys</h3>
        <p className="text-xs gui-text-secondary">
          Bring your own keys or use Cognograph credits. Keys are encrypted server-side with AES-256.
        </p>
      </div>

      {/* Provider list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin gui-text-secondary" />
        </div>
      ) : (
        <div className="space-y-2">
          {PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              existingKey={getKeyForProvider(provider.id)}
              onAdd={addKey}
              onRemove={removeKey}
              onTest={testKey}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const ApiKeysTab = memo(ApiKeysTabComponent)
