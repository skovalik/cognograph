// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * FirstRunSetup — First-run API key gate for desktop users.
 *
 * Shows when no connectors are configured and the user hasn't passed the gate.
 * Two paths:
 *   1. Add API Key → opens Settings → AI & Connectors tab (caller handles it)
 *   2. Use Claude Account → inline CLI auth flow
 * Skip → marks gate as passed without setup.
 *
 * Auto-dismisses when connectors.length > 0 (reactive).
 * Claude Pro success calls setFirstRunGatePassed() directly.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, Key, Loader2, X, Zap } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useConnectorStore } from '../../stores/connectorStore'
import { useProgramStore } from '../../stores/programStore'

// ── Types ────────────────────────────────────────────────────────────────────

interface FirstRunSetupProps {
  onOpenSettings: () => void
}

type View = 'choice' | 'claude-pro'
type ClaudeProStatus = 'idle' | 'checking' | 'logging-in' | 'success' | 'error'

// ── Component ────────────────────────────────────────────────────────────────

function FirstRunSetupComponent({ onOpenSettings }: FirstRunSetupProps): JSX.Element | null {
  const hasPassedGate = useProgramStore((s) => s.hasPassedFirstRunGate)
  const setFirstRunGatePassed = useProgramStore((s) => s.setFirstRunGatePassed)
  const connectors = useConnectorStore((s) => s.connectors)

  const [view, setView] = useState<View>('choice')
  const [claudeStatus, setClaudeStatus] = useState<ClaudeProStatus>('idle')
  const [claudeError, setClaudeError] = useState('')

  // Auto-dismiss when a connector is added (user completed setup via Settings)
  useEffect(() => {
    if (connectors.length > 0) {
      setFirstRunGatePassed()
    }
  }, [connectors, setFirstRunGatePassed])

  // All hooks must be declared before any early return
  const handleAddApiKey = useCallback(() => {
    onOpenSettings()
    // Gate stays open — auto-dismisses reactively when connectors.length > 0
  }, [onOpenSettings])

  const handleClaudeProPath = useCallback(async () => {
    setView('claude-pro')
    setClaudeError('')
    setClaudeStatus('checking')

    try {
      // biome-ignore lint/suspicious/noExplicitAny: window.api.agent is not typed in renderer types
      const cliCheck = await (window as any).api?.agent?.checkCli()

      if (!cliCheck?.installed) {
        setClaudeStatus('error')
        setClaudeError('Claude CLI not found. Install it from claude.ai/code, then try again.')
        return
      }

      if (cliCheck.loggedIn) {
        // Already authenticated — save setting and complete
        await window.api.settings.set('useClaudeProAccount', true)
        setClaudeStatus('success')
        setTimeout(setFirstRunGatePassed, 800)
        return
      }

      setClaudeStatus('logging-in')
      // biome-ignore lint/suspicious/noExplicitAny: window.api.agent is not typed in renderer types
      const loginResult = await (window as any).api?.agent?.login()

      if (loginResult?.success) {
        await window.api.settings.set('useClaudeProAccount', true)
        setClaudeStatus('success')
        setTimeout(setFirstRunGatePassed, 800)
      } else {
        setClaudeStatus('error')
        setClaudeError('Login was cancelled or failed. Try again or use an API key instead.')
      }
    } catch (err) {
      setClaudeStatus('error')
      setClaudeError(err instanceof Error ? err.message : 'An error occurred during login.')
    }
  }, [setFirstRunGatePassed])

  const handleSkip = useCallback(() => {
    setFirstRunGatePassed()
  }, [setFirstRunGatePassed])

  const handleBack = useCallback(() => {
    setView('choice')
    setClaudeStatus('idle')
    setClaudeError('')
  }, [])

  // Already passed — nothing to render (after all hooks)
  if (hasPassedGate) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Card */}
        <motion.div
          className="relative w-[460px] max-w-[90vw] rounded-2xl overflow-hidden"
          style={{
            background: 'var(--gui-bg, #1a1a2e)',
            border: '1px solid var(--gui-border, #2a2a4a)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(200, 150, 62, 0.08)',
          }}
          initial={{ scale: 0.92, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <AnimatePresence mode="wait">
            {view === 'choice' ? (
              <motion.div
                key="choice"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Header */}
                <div className="px-7 pt-7 pb-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--accent-glow, #C8963E)' }}
                    >
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold gui-text">Connect an AI provider</h2>
                      <p className="text-xs gui-text-secondary mt-0.5">
                        Cognograph needs an AI provider to work.
                      </p>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleAddApiKey}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-colors cursor-pointer"
                      style={{
                        background: 'var(--gui-bg-hover, #252540)',
                        border: '1px solid var(--gui-border, #2a2a4a)',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.borderColor =
                          'var(--accent-glow, #C8963E)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.borderColor =
                          'var(--gui-border, #2a2a4a)'
                      }}
                    >
                      <Key
                        className="w-4 h-4 shrink-0"
                        style={{ color: 'var(--accent-glow, #C8963E)' }}
                      />
                      <div>
                        <div className="text-sm font-medium gui-text">Add API key</div>
                        <div className="text-xs gui-text-secondary mt-0.5">
                          Anthropic, OpenAI, Gemini, Ollama, or custom
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleClaudeProPath}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-colors cursor-pointer"
                      style={{
                        background: 'var(--gui-bg-hover, #252540)',
                        border: '1px solid var(--gui-border, #2a2a4a)',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.borderColor =
                          'var(--gui-border-hover, #3a3a5a)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.borderColor =
                          'var(--gui-border, #2a2a4a)'
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ background: '#7b5ea7' }}
                      >
                        C
                      </div>
                      <div>
                        <div className="text-sm font-medium gui-text">Use Claude account</div>
                        <div className="text-xs gui-text-secondary mt-0.5">
                          Sign in with Claude CLI (claude.ai/code)
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div
                  className="px-7 py-3 flex items-center justify-between"
                  style={{
                    background: 'var(--gui-bg-hover, #1e1e35)',
                    borderTop: '1px solid var(--gui-border, #2a2a4a)',
                  }}
                >
                  <span className="text-[11px] gui-text-secondary">
                    Reconfigure anytime in Settings → AI &amp; Connectors
                  </span>
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="text-[11px] gui-text-secondary hover:gui-text transition-colors underline underline-offset-2 cursor-pointer"
                  >
                    Skip for now
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="claude-pro"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-7 pt-6 pb-7">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={claudeStatus === 'logging-in' || claudeStatus === 'checking'}
                    className="flex items-center gap-1.5 text-xs gui-text-secondary hover:gui-text transition-colors mb-5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    Back
                  </button>

                  <div className="flex flex-col items-center text-center gap-3 py-4">
                    {claudeStatus === 'success' ? (
                      <CheckCircle
                        className="w-8 h-8"
                        style={{ color: 'var(--gui-success, #10b981)' }}
                      />
                    ) : claudeStatus === 'error' ? (
                      <AlertTriangle className="w-8 h-8 text-red-400" />
                    ) : (
                      <Loader2
                        className="w-8 h-8 animate-spin"
                        style={{ color: 'var(--accent-glow, #C8963E)' }}
                      />
                    )}

                    <div>
                      <div className="text-sm font-medium gui-text">
                        {claudeStatus === 'checking' && 'Checking Claude CLI\u2026'}
                        {claudeStatus === 'logging-in' && 'Opening Claude login\u2026'}
                        {claudeStatus === 'success' && 'Connected!'}
                        {claudeStatus === 'error' && 'Something went wrong'}
                        {claudeStatus === 'idle' && 'Connecting\u2026'}
                      </div>
                      {claudeError && (
                        <p className="text-xs text-red-400 mt-2 max-w-[320px]">{claudeError}</p>
                      )}
                    </div>

                    {claudeStatus === 'error' && (
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={handleClaudeProPath}
                          className="gui-btn gui-btn-accent gui-btn-sm"
                        >
                          Try again
                        </button>
                        <button
                          type="button"
                          onClick={handleBack}
                          className="gui-btn gui-btn-ghost gui-btn-sm"
                        >
                          Use API key instead
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export const FirstRunSetup = memo(FirstRunSetupComponent)
