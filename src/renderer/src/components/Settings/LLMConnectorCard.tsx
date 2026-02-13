import { memo, useState, useCallback } from 'react'
import { Trash2, TestTube, Star, Pencil, Loader2 } from 'lucide-react'
import type { LLMConnector, ConnectorProvider } from '@shared/types'
import { CONNECTOR_PROVIDER_INFO } from '@shared/types'

interface LLMConnectorCardProps {
  connector: LLMConnector
  onEdit: (connector: LLMConnector) => void
  onTest: (connector: LLMConnector) => void
  onRemove: (id: string) => void
  onSetDefault: (id: string) => void
  isTesting: boolean
}

function LLMConnectorCardComponent({
  connector,
  onEdit,
  onTest,
  onRemove,
  onSetDefault,
  isTesting,
}: LLMConnectorCardProps): JSX.Element {
  const [confirmRemove, setConfirmRemove] = useState(false)

  const providerInfo = CONNECTOR_PROVIDER_INFO[connector.provider as ConnectorProvider]

  const statusColor = connector.status === 'connected'
    ? 'bg-green-500'
    : connector.status === 'error'
      ? 'bg-red-500'
      : 'bg-[var(--text-muted)]'

  const statusLabel = connector.status === 'connected'
    ? 'Connected'
    : connector.status === 'error'
      ? 'Error'
      : 'Untested'

  const handleRemove = useCallback(() => {
    if (confirmRemove) {
      onRemove(connector.id)
      setConfirmRemove(false)
    } else {
      setConfirmRemove(true)
      setTimeout(() => setConfirmRemove(false), 3000)
    }
  }, [confirmRemove, connector.id, onRemove])

  return (
    <div className="gui-card rounded-lg p-3 space-y-2">
      {/* Top row: status + name + default star */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} title={statusLabel} />
          <span className="text-sm font-medium gui-text">{connector.name}</span>
          {connector.isDefault && (
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          )}
        </div>
        <span className="text-xs gui-text-secondary">
          {providerInfo?.label || connector.provider}
        </span>
      </div>

      {/* Model info */}
      <div className="text-xs gui-text-secondary">
        Model: {connector.model || 'default'}
        {connector.baseUrl && (
          <span className="ml-2">| URL: {connector.baseUrl}</span>
        )}
      </div>

      {/* Error message */}
      {connector.status === 'error' && connector.lastError && (
        <div className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
          {connector.lastError}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-1 pt-1">
        <button
          onClick={() => onEdit(connector)}
          className="gui-btn gui-btn-ghost gui-btn-sm"
          title="Edit"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
        <button
          onClick={() => onTest(connector)}
          disabled={isTesting}
          className="gui-btn gui-btn-ghost gui-btn-sm"
          title="Test connection"
        >
          {isTesting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <TestTube className="w-3 h-3" />
          )}
          Test
        </button>
        {!connector.isDefault && (
          <button
            onClick={() => onSetDefault(connector.id)}
            className="gui-btn gui-btn-ghost gui-btn-sm"
            title="Set as default"
          >
            <Star className="w-3 h-3" />
            Default
          </button>
        )}
        <button
          onClick={handleRemove}
          className={`gui-btn gui-btn-sm ml-auto ${
            confirmRemove
              ? 'bg-red-500/20 text-red-400'
              : 'gui-btn-ghost'
          }`}
          title={confirmRemove ? 'Click again to confirm' : 'Remove'}
        >
          <Trash2 className="w-3 h-3" />
          {confirmRemove ? 'Confirm?' : 'Remove'}
        </button>
      </div>
    </div>
  )
}

export const LLMConnectorCard = memo(LLMConnectorCardComponent)
