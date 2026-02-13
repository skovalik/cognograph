import { X, Settings, Info } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { ContextSettings } from '@shared/types'

interface ContextSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContextSettingsModal({ isOpen, onClose }: ContextSettingsModalProps): JSX.Element | null {
  const contextSettings = useWorkspaceStore((state) => state.contextSettings)

  if (!isOpen) return null

  const handleDepthChange = (depth: number): void => {
    // Update context settings in store
    useWorkspaceStore.setState((state) => ({
      contextSettings: { ...state.contextSettings, globalDepth: depth },
      isDirty: true
    }))
  }

  const handleModeChange = (mode: ContextSettings['traversalMode']): void => {
    useWorkspaceStore.setState((state) => ({
      contextSettings: { ...state.contextSettings, traversalMode: mode },
      isDirty: true
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[480px] bg-[var(--surface-panel)] glass-fluid border border-[var(--border-subtle)] rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Context Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors text-[var(--text-secondary)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Global Depth */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Context Depth: {contextSettings.globalDepth}
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={contextSettings.globalDepth}
              onChange={(e) => handleDepthChange(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
              <span>1 (Direct only)</span>
              <span>5 (Deep)</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Controls how many "hops" away from a conversation node context is gathered.
                Depth 2 includes direct connections and their connections.
              </span>
            </p>
          </div>

          {/* Traversal Mode */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Traversal Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-[var(--surface-panel-secondary)] rounded border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--text-muted)] transition-colors">
                <input
                  type="radio"
                  name="traversalMode"
                  checked={contextSettings.traversalMode === 'all'}
                  onChange={() => handleModeChange('all')}
                  className="text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--surface-panel)]"
                />
                <div>
                  <div className="text-sm text-white">All Connections</div>
                  <div className="text-xs text-[var(--text-muted)]">Gather context from all connected nodes</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--surface-panel-secondary)] rounded border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--text-muted)] transition-colors">
                <input
                  type="radio"
                  name="traversalMode"
                  checked={contextSettings.traversalMode === 'ancestors-only'}
                  onChange={() => handleModeChange('ancestors-only')}
                  className="text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--surface-panel)]"
                />
                <div>
                  <div className="text-sm text-white">Ancestors Only</div>
                  <div className="text-xs text-[var(--text-muted)]">Only follow inbound edges (nodes pointing to this one)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Help text */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
            <h3 className="text-sm font-medium text-blue-400 mb-1">How context flows</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              When you chat with a conversation node, context is automatically gathered from
              connected nodes. The edge direction determines flow: nodes with arrows pointing
              <strong> toward</strong> your conversation provide context. Bidirectional edges
              share context both ways.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
