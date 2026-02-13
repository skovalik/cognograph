/**
 * TutorialOverlay — Interactive "Research Assistant in 3 Minutes" tutorial.
 *
 * A 6-step guided walkthrough that teaches new users the core Cognograph workflow:
 * 1. Create a Note (paste some reference text)
 * 2. Create a Conversation
 * 3. Connect the Note → Conversation
 * 4. Send a message in the chat
 * 5. See the AI use context from the connected note
 * 6. Done! Summary of other features
 *
 * Accessible from Command Palette → "Start Tutorial" or Help menu.
 * Monitors workspace changes to auto-advance steps when user completes actions.
 */

import { memo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  StickyNote,
  MessageSquare,
  Link2,
  Send,
  Sparkles,
  PartyPopper,
  ArrowRight,
  X,
  ChevronRight
} from 'lucide-react'
import { useProgramStore, selectTutorialActive, selectTutorialStep } from '../../stores/programStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { TutorialStep } from '../../stores/programStore'

// ---------------------------------------------------------------------------
// Step Definitions
// ---------------------------------------------------------------------------

interface StepConfig {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  description: string
  hint: string
  color: string
}

const STEP_CONFIGS: Record<TutorialStep, StepConfig> = {
  'create-note': {
    icon: StickyNote,
    title: 'Step 1: Create a Note',
    description: 'Press Shift+N to create a note, or right-click the canvas and select "New Note".',
    hint: 'Paste some reference text into it — a paragraph about any topic you\'d like to ask the AI about.',
    color: '#f59e0b'
  },
  'create-conversation': {
    icon: MessageSquare,
    title: 'Step 2: Create a Conversation',
    description: 'Press Shift+C to create a conversation node near your note.',
    hint: 'This is where you\'ll chat with AI. Place it next to your note.',
    color: '#3b82f6'
  },
  'connect-them': {
    icon: Link2,
    title: 'Step 3: Connect Note → Conversation',
    description: 'Drag from the note\'s connection handle to the conversation node.',
    hint: 'Handles appear on hover at the edges of each node. This link tells the AI to use your note as context.',
    color: '#a855f7'
  },
  'send-message': {
    icon: Send,
    title: 'Step 4: Ask a Question',
    description: 'Click the conversation node, then type a question in the chat panel.',
    hint: 'Ask something related to your note — the AI will use it as context!',
    color: '#10b981'
  },
  'see-context': {
    icon: Sparkles,
    title: 'Step 5: See the Magic',
    description: 'Watch the AI respond using context from your connected note.',
    hint: 'Notice the context indicator in the chat — it shows which nodes are providing context.',
    color: '#6366f1'
  },
  'complete': {
    icon: PartyPopper,
    title: 'You\'re Ready!',
    description: 'You\'ve learned the core Cognograph workflow: Notes provide context to AI Conversations.',
    hint: '',
    color: '#ec4899'
  }
}

const STEP_ORDER: TutorialStep[] = [
  'create-note',
  'create-conversation',
  'connect-them',
  'send-message',
  'see-context',
  'complete'
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TutorialOverlayComponent(): JSX.Element | null {
  const isActive = useProgramStore(selectTutorialActive)
  const currentStep = useProgramStore(selectTutorialStep)
  const advanceTutorial = useProgramStore((s) => s.advanceTutorial)
  const cancelTutorial = useProgramStore((s) => s.cancelTutorial)
  const completeTutorial = useProgramStore((s) => s.completeTutorial)

  // Track workspace state for auto-advance detection
  const prevNodesRef = useRef<number>(0)
  const prevEdgesRef = useRef<number>(0)
  const prevMessagesRef = useRef<number>(0)
  const initializedRef = useRef(false)

  // Take a baseline snapshot when tutorial starts
  useEffect(() => {
    if (!isActive) {
      initializedRef.current = false
      return
    }

    // Capture baseline counts on tutorial start (small delay to let state settle)
    const timer = setTimeout(() => {
      const state = useWorkspaceStore.getState()
      prevNodesRef.current = state.nodes.length
      prevEdgesRef.current = state.edges.length

      // Count total messages across all conversation nodes
      const messageCount = state.nodes
        .filter(n => n.data.type === 'conversation')
        .reduce((sum, n) => sum + ((n.data as { messages?: unknown[] }).messages?.length || 0), 0)
      prevMessagesRef.current = messageCount

      initializedRef.current = true
    }, 100)

    return () => clearTimeout(timer)
  }, [isActive])

  // Subscribe to workspace changes for auto-advancing tutorial steps
  useEffect(() => {
    if (!isActive) return

    const unsubscribe = useWorkspaceStore.subscribe(
      (state) => ({ nodes: state.nodes, edges: state.edges }),
      (current) => {
        if (!initializedRef.current) return
        const step = useProgramStore.getState().tutorialStep

        // Step 1: Detect new note node
        if (step === 'create-note') {
          const noteCount = current.nodes.filter(n => n.data.type === 'note').length
          const prevNoteCount = prevNodesRef.current
            ? useWorkspaceStore.getState().nodes.filter(n => n.data.type === 'note').length
            : 0
          // A note was just created if note count increased
          if (noteCount > 0 && current.nodes.length > prevNodesRef.current) {
            const hasNewNote = current.nodes.some(
              n => n.data.type === 'note' && Date.now() - (n.data.createdAt || 0) < 5000
            )
            if (hasNewNote || noteCount > 0) {
              prevNodesRef.current = current.nodes.length
              advanceTutorial()
            }
          }
        }

        // Step 2: Detect new conversation node
        if (step === 'create-conversation') {
          const convCount = current.nodes.filter(n => n.data.type === 'conversation').length
          if (convCount > 0 && current.nodes.length > prevNodesRef.current) {
            prevNodesRef.current = current.nodes.length
            advanceTutorial()
          }
        }

        // Step 3: Detect new edge
        if (step === 'connect-them') {
          if (current.edges.length > prevEdgesRef.current) {
            prevEdgesRef.current = current.edges.length
            advanceTutorial()
          }
        }

        // Step 4: Detect new message in a conversation
        if (step === 'send-message') {
          const messageCount = current.nodes
            .filter(n => n.data.type === 'conversation')
            .reduce((sum, n) => sum + ((n.data as { messages?: unknown[] }).messages?.length || 0), 0)
          if (messageCount > prevMessagesRef.current) {
            prevMessagesRef.current = messageCount
            advanceTutorial()
          }
        }

        // Step 5: Auto-advance after a few seconds (user should notice the context)
        if (step === 'see-context') {
          const messageCount = current.nodes
            .filter(n => n.data.type === 'conversation')
            .reduce((sum, n) => sum + ((n.data as { messages?: unknown[] }).messages?.length || 0), 0)
          // Advance once the AI has responded (2+ messages means user sent + AI replied)
          if (messageCount > prevMessagesRef.current + 1) {
            prevMessagesRef.current = messageCount
            advanceTutorial()
          }
        }
      },
      { equalityFn: (a, b) => a.nodes === b.nodes && a.edges === b.edges }
    )

    return unsubscribe
  }, [isActive, advanceTutorial])

  // Auto-advance "see-context" step after a timeout if AI hasn't responded
  useEffect(() => {
    if (!isActive || currentStep !== 'see-context') return
    const timer = setTimeout(() => {
      if (useProgramStore.getState().tutorialStep === 'see-context') {
        advanceTutorial()
      }
    }, 15000) // 15s fallback
    return () => clearTimeout(timer)
  }, [isActive, currentStep, advanceTutorial])

  const handleSkipStep = useCallback(() => {
    advanceTutorial()
  }, [advanceTutorial])

  const handleFinish = useCallback(() => {
    completeTutorial()
  }, [completeTutorial])

  const handleCancel = useCallback(() => {
    cancelTutorial()
  }, [cancelTutorial])

  if (!isActive) return null

  const config = STEP_CONFIGS[currentStep]
  const stepIndex = STEP_ORDER.indexOf(currentStep)
  const isLastStep = currentStep === 'complete'
  const Icon = config.icon

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        className="fixed bottom-6 left-1/2 z-[9998] pointer-events-auto"
        style={{ transform: 'translateX(-50%)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="w-[440px] max-w-[90vw] rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: 'var(--gui-bg, #1a1a2e)',
            border: '1px solid var(--gui-border, #2a2a4a)',
            boxShadow: `0 20px 50px rgba(0, 0, 0, 0.4), 0 0 40px ${config.color}15`
          }}
        >
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-3 right-3 p-1 rounded-lg gui-text-secondary hover:gui-text transition-colors opacity-60 hover:opacity-100 z-10"
            title="Exit tutorial"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Progress bar */}
          <div className="h-1 w-full" style={{ background: 'var(--gui-border, #2a2a4a)' }}>
            <motion.div
              className="h-full"
              style={{ background: config.color }}
              initial={{ width: `${(stepIndex / STEP_ORDER.length) * 100}%` }}
              animate={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          {/* Content */}
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              {/* Step icon */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${config.color}20`, border: `1px solid ${config.color}30` }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color: config.color }} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold gui-text">{config.title}</h3>
                  <span className="text-[10px] gui-text-secondary">
                    {stepIndex + 1}/{STEP_ORDER.length}
                  </span>
                </div>
                <p className="text-xs gui-text-secondary mt-1 leading-relaxed">
                  {config.description}
                </p>
                {config.hint && (
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: `${config.color}cc` }}>
                    {config.hint}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-5 py-2.5 flex items-center justify-between"
            style={{
              background: 'var(--gui-bg-hover, #1e1e35)',
              borderTop: '1px solid var(--gui-border, #2a2a4a)'
            }}
          >
            <span className="text-[10px] gui-text-secondary">
              {isLastStep ? 'Explore more features in the Command Palette (Ctrl+K)' : 'Tutorial auto-advances when you complete each step'}
            </span>

            {isLastStep ? (
              <button
                onClick={handleFinish}
                className="gui-btn gui-btn-accent gui-btn-sm flex items-center gap-1 text-xs"
              >
                Done
                <PartyPopper className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={handleSkipStep}
                className="text-[10px] gui-text-secondary hover:gui-text transition-colors flex items-center gap-0.5"
              >
                Skip step
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export const TutorialOverlay = memo(TutorialOverlayComponent)
export default TutorialOverlay
