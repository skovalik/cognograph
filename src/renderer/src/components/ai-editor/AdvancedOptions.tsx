/**
 * Advanced Options Component
 *
 * Collapsible panel for advanced AI Editor settings.
 * Includes mode selection, scope selection, and additional options.
 * Following progressive disclosure pattern - hidden by default.
 */

import { memo, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Layout, Sparkles, Zap, HelpCircle } from 'lucide-react'
import type { AIEditorMode, AIEditorScope } from '@shared/types'

interface AdvancedOptionsProps {
  mode: AIEditorMode
  scope: AIEditorScope
  agentMode: boolean
  previewMode: boolean
  onModeChange: (mode: AIEditorMode) => void
  onScopeChange: (scope: AIEditorScope) => void
  onAgentModeChange: (enabled: boolean) => void
  onPreviewModeChange: (enabled: boolean) => void
  inferredMode?: AIEditorMode | null
  inferredConfidence?: number
}

interface ModeOption {
  id: AIEditorMode
  label: string
  description: string
  icon: React.ReactNode
}

interface ScopeOption {
  id: AIEditorScope
  label: string
  description: string
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'generate',
    label: 'Generate',
    description: 'Create new nodes, content, or structures',
    icon: <Sparkles className="w-4 h-4" />
  },
  {
    id: 'edit',
    label: 'Edit',
    description: 'Improve, expand, or correct existing content',
    icon: <Pencil className="w-4 h-4" />
  },
  {
    id: 'organize',
    label: 'Organize',
    description: 'Arrange, connect, or group nodes spatially',
    icon: <Layout className="w-4 h-4" />
  },
  {
    id: 'automate',
    label: 'Automate',
    description: 'Create automation workflows and triggers',
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: 'ask',
    label: 'Ask',
    description: 'Query the workspace with questions',
    icon: <HelpCircle className="w-4 h-4" />
  }
]

const SCOPE_OPTIONS: ScopeOption[] = [
  { id: 'selection', label: 'Selection', description: 'Selected nodes only' },
  { id: 'canvas', label: 'Canvas', description: 'All visible nodes' },
  { id: 'workspace', label: 'Workspace', description: 'Entire workspace' }
]

function AdvancedOptionsComponent({
  mode,
  scope,
  agentMode,
  previewMode,
  onModeChange,
  onScopeChange,
  onAgentModeChange,
  onPreviewModeChange,
  inferredMode,
  inferredConfidence = 0
}: AdvancedOptionsProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="advanced-options-container">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="
          flex items-center gap-1
          text-sm text-[var(--text-secondary)]
          hover:text-[var(--text-primary)]
          transition-colors
          py-1
        "
        aria-expanded={isExpanded}
        aria-controls="advanced-options-panel"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <span>Advanced options</span>
        {inferredMode && inferredConfidence > 0.5 && !isExpanded && (
          <span className="ml-2 text-xs text-blue-400">
            (detected: {inferredMode})
          </span>
        )}
      </button>

      {/* Collapsible panel */}
      <div
        id="advanced-options-panel"
        className={`
          overflow-hidden
          transition-all duration-200 ease-out
          ${isExpanded ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-4">
          {/* Mode selection */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onModeChange(option.id)}
                  className={`
                    flex items-center gap-2
                    p-2 rounded-md
                    text-left text-sm
                    border
                    transition-all
                    ${
                      mode === option.id
                        ? 'bg-blue-500/20 border-blue-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-[var(--text-secondary)] hover:bg-white/10'
                    }
                    ${
                      inferredMode === option.id && mode !== option.id
                        ? 'ring-1 ring-blue-400/30'
                        : ''
                    }
                  `}
                  aria-pressed={mode === option.id}
                  title={option.description}
                >
                  <span className={mode === option.id ? 'text-blue-400' : 'text-[var(--text-muted)]'}>
                    {option.icon}
                  </span>
                  <span>{option.label}</span>
                  {inferredMode === option.id && mode !== option.id && (
                    <span className="ml-auto text-xs text-blue-400">suggested</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Scope selection */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              Scope
            </label>
            <div className="flex flex-wrap gap-2">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onScopeChange(option.id)}
                  className={`
                    px-3 py-1.5 rounded-md
                    text-sm
                    border
                    transition-all
                    ${
                      scope === option.id
                        ? 'bg-blue-500/20 border-blue-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-[var(--text-secondary)] hover:bg-white/10'
                    }
                  `}
                  aria-pressed={scope === option.id}
                  title={option.description}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Additional options */}
          <div className="flex flex-wrap gap-4 pt-2 border-t border-white/10">
            {/* Agent mode toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agentMode}
                onChange={(e) => onAgentModeChange(e.target.checked)}
                className="
                  w-4 h-4 rounded
                  border-[var(--border-subtle)]
                  bg-[var(--surface-panel)]
                  text-blue-500
                  focus:ring-blue-500 focus:ring-offset-0
                "
              />
              <span className="text-sm text-[var(--text-secondary)]">Agent mode</span>
              <span className="text-xs text-[var(--text-muted)]">(multi-step)</span>
            </label>

            {/* Preview mode toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={previewMode}
                onChange={(e) => onPreviewModeChange(e.target.checked)}
                className="
                  w-4 h-4 rounded
                  border-[var(--border-subtle)]
                  bg-[var(--surface-panel)]
                  text-blue-500
                  focus:ring-blue-500 focus:ring-offset-0
                "
              />
              <span className="text-sm text-[var(--text-secondary)]">Preview first</span>
              <span className="text-xs text-[var(--text-muted)]">(review before apply)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

export const AdvancedOptions = memo(AdvancedOptionsComponent)
export default AdvancedOptions
