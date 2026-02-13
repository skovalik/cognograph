/**
 * WelcomeOverlay - First-time user onboarding
 *
 * A clean, minimal overlay that guides new users through:
 * Step 1: Configure an AI provider (opens Settings → AI tab)
 * Step 2: Create their first conversation node
 *
 * Shown only once — completion is stored in programStore (localStorage).
 */

import { memo, useState, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, MessageSquare, ArrowRight, X, Zap, Link2, Brain, Check } from 'lucide-react'
import { useProgramStore, selectHasCompletedOnboarding } from '../../stores/programStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useConnectorStore } from '../../stores/connectorStore'

interface WelcomeOverlayProps {
  onOpenSettings: () => void
}

function WelcomeOverlayComponent({ onOpenSettings }: WelcomeOverlayProps): JSX.Element | null {
  const hasCompleted = useProgramStore(selectHasCompletedOnboarding)
  const completeOnboarding = useProgramStore((s) => s.completeOnboarding)
  const addNode = useWorkspaceStore((s) => s.addNode)
  const selectNode = useWorkspaceStore((s) => s.selectNode)
  const connectors = useConnectorStore((s) => s.connectors)
  const { screenToFlowPosition } = useReactFlow()

  const [step, setStep] = useState<1 | 2>(1)
  const [dismissed, setDismissed] = useState(false)

  const hasAnyConnector = connectors.length > 0

  const handleConfigureProvider = useCallback(() => {
    onOpenSettings()
    // Advance to step 2 — user can come back after configuring
    setStep(2)
  }, [onOpenSettings])

  const handleCreateConversation = useCallback(() => {
    // Create a conversation node at the center of the viewport
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    const flowPos = screenToFlowPosition({ x: centerX, y: centerY })

    const nodeId = addNode('conversation', {
      x: flowPos.x - 150, // Center the 300px-wide node
      y: flowPos.y - 70   // Center the ~140px-tall node
    })

    // Select it to open the properties/chat panel
    selectNode(nodeId)

    // Mark onboarding as complete
    completeOnboarding()
    setDismissed(true)
  }, [screenToFlowPosition, addNode, selectNode, completeOnboarding])

  const handleSkip = useCallback(() => {
    completeOnboarding()
    setDismissed(true)
  }, [completeOnboarding])

  // Don't show if already completed or dismissed
  if (hasCompleted || dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Card */}
        <motion.div
          className="relative w-[480px] max-w-[90vw] rounded-2xl overflow-hidden"
          style={{
            background: 'var(--gui-bg, #1a1a2e)',
            border: '1px solid var(--gui-border, #2a2a4a)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(99, 102, 241, 0.1)'
          }}
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Skip/Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1.5 rounded-lg gui-text-secondary hover:gui-text transition-colors opacity-60 hover:opacity-100"
            title="Skip onboarding"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="px-8 pt-8 pb-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--gui-accent-secondary, #6366f1)', opacity: 0.9 }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold gui-text">Welcome to Cognograph</h1>
              </div>
            </div>

            <p className="text-sm gui-text-secondary mb-6 leading-relaxed">
              Your spatial AI workspace. Connect ideas, conversations, and context on an infinite canvas.
            </p>

            {/* Feature highlights */}
            <div className="flex gap-4 mb-6">
              {[
                { icon: MessageSquare, label: 'AI Conversations', color: '#3b82f6' },
                { icon: Link2, label: 'Connected Context', color: '#a855f7' },
                { icon: Brain, label: 'Spatial Thinking', color: '#10b981' }
              ].map(({ icon: Icon, label, color }) => (
                <div
                  key={label}
                  className="flex-1 flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg"
                  style={{ background: `${color}10`, border: `1px solid ${color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-[10px] font-medium gui-text-secondary text-center">{label}</span>
                </div>
              ))}
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {/* Step 1: Configure AI Provider */}
              <div
                className="rounded-xl p-4 transition-all duration-200"
                style={{
                  background: step === 1 ? 'var(--gui-bg-hover, #252540)' : 'transparent',
                  border: `1px solid ${step === 1 ? 'var(--gui-accent-secondary, #6366f1)' : 'var(--gui-border, #2a2a4a)'}`,
                  opacity: step === 1 ? 1 : 0.6
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: hasAnyConnector
                          ? 'var(--gui-success, #10b981)'
                          : step === 1
                            ? 'var(--gui-accent-secondary, #6366f1)'
                            : 'var(--gui-border, #3a3a5a)',
                        color: 'white'
                      }}
                    >
                      {hasAnyConnector ? <Check className="w-4 h-4" /> : '1'}
                    </div>
                    <div>
                      <div className="text-sm font-medium gui-text">
                        Set up your AI provider
                      </div>
                      <div className="text-xs gui-text-secondary mt-0.5">
                        {hasAnyConnector
                          ? `${connectors[0].provider} configured`
                          : 'Add an API key for Anthropic, OpenAI, or others'
                        }
                      </div>
                    </div>
                  </div>

                  {step === 1 && (
                    <button
                      onClick={handleConfigureProvider}
                      className="gui-btn gui-btn-accent gui-btn-sm flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {hasAnyConnector ? 'Edit' : 'Configure'}
                    </button>
                  )}
                </div>
              </div>

              {/* Step 2: Create first conversation */}
              <div
                className="rounded-xl p-4 transition-all duration-200"
                style={{
                  background: step === 2 ? 'var(--gui-bg-hover, #252540)' : 'transparent',
                  border: `1px solid ${step === 2 ? 'var(--gui-accent-secondary, #6366f1)' : 'var(--gui-border, #2a2a4a)'}`,
                  opacity: step === 2 ? 1 : 0.5
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: step === 2
                          ? 'var(--gui-accent-secondary, #6366f1)'
                          : 'var(--gui-border, #3a3a5a)',
                        color: 'white'
                      }}
                    >
                      2
                    </div>
                    <div>
                      <div className="text-sm font-medium gui-text">
                        Create your first conversation
                      </div>
                      <div className="text-xs gui-text-secondary mt-0.5">
                        Start chatting with AI on the canvas
                      </div>
                    </div>
                  </div>

                  {step === 2 && (
                    <button
                      onClick={handleCreateConversation}
                      className="gui-btn gui-btn-accent gui-btn-sm flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Create
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-8 py-3 flex items-center justify-between"
            style={{
              background: 'var(--gui-bg-hover, #1e1e35)',
              borderTop: '1px solid var(--gui-border, #2a2a4a)'
            }}
          >
            <span className="text-[11px] gui-text-secondary">
              You can always reconfigure in Settings
            </span>
            <button
              onClick={handleSkip}
              className="text-[11px] gui-text-secondary hover:gui-text transition-colors underline underline-offset-2"
            >
              Skip — I'll explore on my own
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export const WelcomeOverlay = memo(WelcomeOverlayComponent)
export default WelcomeOverlay
