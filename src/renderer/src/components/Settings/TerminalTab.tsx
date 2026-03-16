// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * TerminalTab — Terminal configuration in settings popover.
 *
 * Shows local agent status, cloud terminal preference, default shell,
 * and usage meter for free tier.
 */

import { memo, useState, useEffect } from 'react'
import { Terminal, Wifi, WifiOff, Cloud, HardDrive, Loader2 } from 'lucide-react'
import { hasTerminalAccess } from '../../utils/terminalAccess'
import { useEntitlementsStore } from '../../stores/entitlementsStore'

type TerminalPreference = 'local' | 'cloud' | 'ask'

function TerminalTabComponent(): JSX.Element {
  const plan = useEntitlementsStore((s) => s.plan)
  const [agentConnected, setAgentConnected] = useState(false)
  const [preference, setPreference] = useState<TerminalPreference>(() =>
    (localStorage.getItem('cognograph:terminalPreference') as TerminalPreference) || 'ask'
  )
  const [defaultShell, setDefaultShell] = useState(() =>
    localStorage.getItem('cognograph:defaultShell') || ''
  )
  const [probing, setProbing] = useState(false)

  // Probe for local agent on mount
  useEffect(() => {
    const stored = localStorage.getItem('cognograph:localAgentConnected') === 'true'
    setAgentConnected(stored)
  }, [])

  const handleProbe = async () => {
    setProbing(true)
    try {
      const res = await fetch('http://localhost:19836/health', { signal: AbortSignal.timeout(2000) })
      const data = await res.json()
      if (data.status === 'ok') {
        localStorage.setItem('cognograph:localAgentConnected', 'true')
        setAgentConnected(true)
      }
    } catch {
      localStorage.removeItem('cognograph:localAgentConnected')
      setAgentConnected(false)
    } finally {
      setProbing(false)
    }
  }

  const handlePreferenceChange = (value: TerminalPreference) => {
    setPreference(value)
    localStorage.setItem('cognograph:terminalPreference', value)
  }

  const handleShellChange = (value: string) => {
    setDefaultShell(value)
    if (value) {
      localStorage.setItem('cognograph:defaultShell', value)
    } else {
      localStorage.removeItem('cognograph:defaultShell')
    }
  }

  if (!hasTerminalAccess()) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium gui-text mb-1">Terminal</h3>
          <p className="text-xs gui-text-secondary">
            Terminal access requires a local agent or cloud subscription.
          </p>
        </div>
        <div className="gui-card rounded-lg p-6 text-center">
          <Terminal className="w-8 h-8 mx-auto mb-2 gui-text-secondary" />
          <p className="text-sm gui-text-secondary">No terminal access available</p>
          <p className="text-xs gui-text-secondary mt-1">
            Run <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-secondary)' }}>npx cognograph-agent</code> to start the local agent.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium gui-text mb-1">Terminal</h3>
        <p className="text-xs gui-text-secondary">
          Configure terminal behavior and connection preferences.
        </p>
      </div>

      {/* Local Agent Status */}
      <div className="gui-card rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {agentConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 gui-text-secondary" />
            )}
            <div>
              <span className="text-sm font-medium gui-text">Local Agent</span>
              <p className="text-[10px] gui-text-secondary">
                {agentConnected ? 'Connected on localhost:19836' : 'Not detected'}
              </p>
            </div>
          </div>
          <button
            onClick={handleProbe}
            disabled={probing}
            className="gui-btn gui-btn-ghost gui-btn-sm text-xs"
          >
            {probing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Detect'}
          </button>
        </div>
      </div>

      {/* Terminal Preference */}
      <div>
        <label className="block text-xs font-medium gui-text mb-2">Preferred Source</label>
        <div className="space-y-1.5">
          {([
            { value: 'local' as const, icon: HardDrive, label: 'Local Agent', desc: 'Use local agent when available' },
            { value: 'cloud' as const, icon: Cloud, label: 'Cloud Terminal', desc: plan === 'free' ? '30 min/day on free tier' : 'Unlimited on Pro' },
            { value: 'ask' as const, icon: Terminal, label: 'Ask Each Time', desc: 'Choose when creating a terminal' },
          ]).map(({ value, icon: Icon, label, desc }) => (
            <label key={value} className="flex items-center gap-3 gui-card rounded-lg p-2.5 cursor-pointer">
              <input
                type="radio"
                name="terminal-preference"
                value={value}
                checked={preference === value}
                onChange={() => handlePreferenceChange(value)}
                className="accent-[var(--gui-accent-primary)]"
              />
              <Icon className="w-4 h-4 flex-shrink-0 gui-text-secondary" />
              <div className="min-w-0">
                <div className="text-xs font-medium gui-text">{label}</div>
                <div className="text-[10px] gui-text-secondary">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Default Shell */}
      <div>
        <label className="block text-xs font-medium gui-text mb-1.5">Default Shell</label>
        <input
          type="text"
          value={defaultShell}
          onChange={(e) => handleShellChange(e.target.value)}
          placeholder="System default (bash, zsh, powershell)"
          className="gui-input w-full px-3 py-2 rounded text-xs font-mono"
        />
        <p className="text-[10px] gui-text-secondary mt-1">
          Leave empty for system default.
        </p>
      </div>
    </div>
  )
}

export const TerminalTab = memo(TerminalTabComponent)
