// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { ChevronDown, Wrench } from 'lucide-react'
import { useState } from 'react'
import { getAvailableMediaTools } from '../../services/media/agentToolRegistry'

const MEDIA_PROVIDERS = [
  'stability',
  'openai',
  'google',
  'replicate',
  'runway',
  'elevenlabs',
] as const

const PROVIDER_LABELS: Record<string, string> = {
  stability: 'Stability AI',
  openai: 'OpenAI',
  google: 'Gemini',
  replicate: 'Replicate',
  runway: 'Runway',
  elevenlabs: 'ElevenLabs',
}

type OutputBehavior = 'artifact' | 'inline' | 'both'

interface ToolPreference {
  enabled: boolean
  defaultProvider?: string
}

export function AgentToolsTab(): JSX.Element {
  const tools = getAvailableMediaTools()
  const [outputBehavior, setOutputBehavior] = useState<OutputBehavior>('artifact')
  const [maxConcurrent, setMaxConcurrent] = useState(2)
  const [toolPrefs, setToolPrefs] = useState<Record<string, ToolPreference>>(() => {
    const prefs: Record<string, ToolPreference> = {}
    for (const tool of tools) {
      prefs[tool.name] = { enabled: true }
    }
    return prefs
  })

  const toggleTool = (name: string) => {
    setToolPrefs((prev) => ({
      ...prev,
      [name]: { ...prev[name], enabled: !prev[name]?.enabled },
    }))
  }

  const setDefaultProvider = (toolName: string, provider: string) => {
    setToolPrefs((prev) => ({
      ...prev,
      [toolName]: { ...prev[toolName], defaultProvider: provider },
    }))
  }

  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Wrench size={24} className="text-[var(--text-secondary)] opacity-40" />
        <p className="text-sm text-[var(--text-secondary)]">
          No media tools available. Add API keys in the API Keys tab to enable media generation.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-[var(--text-primary)]">Agent Tools</h3>

      {/* Available tools */}
      <div className="flex flex-col gap-2">
        {tools.map((tool) => {
          const pref = toolPrefs[tool.name] || { enabled: true }
          return (
            <div
              key={tool.name}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]"
            >
              <input
                type="checkbox"
                checked={pref.enabled}
                onChange={() => toggleTool(tool.name)}
                className="accent-[var(--accent-primary)]"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[var(--text-primary)] font-medium">{tool.name}</span>
                <p className="text-xs text-[var(--text-secondary)] truncate">{tool.description}</p>
              </div>
              {/* Default provider dropdown */}
              <div className="relative">
                <select
                  value={pref.defaultProvider || 'auto'}
                  onChange={(e) => setDefaultProvider(tool.name, e.target.value)}
                  className="text-xs px-2 py-1 pr-6 rounded border border-[var(--border-subtle)] bg-[var(--surface-primary)] text-[var(--text-primary)] appearance-none cursor-pointer"
                >
                  <option value="auto">Auto</option>
                  {MEDIA_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={10}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Output behavior */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          Output Behavior
        </label>
        <div className="flex gap-2">
          {(['artifact', 'inline', 'both'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setOutputBehavior(mode)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                outputBehavior === mode
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {mode === 'artifact' ? 'Create Artifact' : mode === 'inline' ? 'Inline' : 'Both'}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {outputBehavior === 'artifact' &&
            'Generated media creates a new artifact node on the canvas.'}
          {outputBehavior === 'inline' && 'Generated media is shown inline in the conversation.'}
          {outputBehavior === 'both' &&
            'Generated media creates an artifact node and shows inline.'}
        </p>
      </div>

      {/* Max concurrent */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          Max Concurrent Generations
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={4}
            value={maxConcurrent}
            onChange={(e) => setMaxConcurrent(Number(e.target.value))}
            className="flex-1 accent-[var(--accent-primary)]"
          />
          <span className="text-sm text-[var(--text-primary)] tabular-nums w-4 text-center">
            {maxConcurrent}
          </span>
        </div>
      </div>
    </div>
  )
}
