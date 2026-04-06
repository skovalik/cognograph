// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * WelcomeScreen — Full-screen welcome overlay with centered chat input.
 *
 * Three phases:
 *   1. welcome  — full-screen overlay, centered heading + textarea
 *   2. morphing — heading/intro fade out, input animates to BottomCommandBar position
 *   3. done     — onComplete fires, parent handles command dispatch
 *
 * The parent (App.tsx) controls visibility and receives the typed text via onComplete.
 * This component does NOT dispatch commands — the parent does, avoiding the
 * "dispatch runs in unmounting component" bug found in QA.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { EscapePriority, escapeManager } from '../../utils/EscapeManager'
import '../../styles/welcome-screen.css'

// ── Types ───────────────────────────────────────────────────────────────────

interface WelcomeScreenProps {
  visible: boolean
  onComplete: (savedInput: string) => void
  onDismiss: () => void
  /** True when an existing workspace is loaded (not a fresh/new workspace) */
  hasExistingWorkspace?: boolean
}

type Phase = 'welcome' | 'morphing' | 'done'

interface MorphTarget {
  x: number
  y: number
  width: number
}

// ── Reduced-motion check ────────────────────────────────────────────────────

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const DURATION_FADE = prefersReducedMotion ? 0 : 0.3
const DURATION_MORPH = prefersReducedMotion ? 0 : 0.5
const EASE_MORPH: [number, number, number, number] = [0.16, 1, 0.3, 1]

// ── Component ───────────────────────────────────────────────────────────────

function WelcomeScreenComponent({
  visible,
  onComplete,
  onDismiss,
  hasExistingWorkspace,
}: WelcomeScreenProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>('welcome')
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [morphTarget, setMorphTarget] = useState<MorphTarget>({ x: 0, y: 0, width: 560 })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)
  const savedInputRef = useRef<string>('')

  // ── Reset state when becoming visible again (always-on empty state) ───────

  useEffect(() => {
    if (visible) {
      setPhase('welcome')
      setInput('')
      setIsSubmitting(false)
      savedInputRef.current = ''
    }
  }, [visible])

  // ── Auto-focus textarea on mount ──────────────────────────────────────────

  useEffect(() => {
    if (!visible || phase !== 'welcome') return
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 300)
    return () => clearTimeout(timer)
  }, [visible, phase])

  // ── Compute morph target ──────────────────────────────────────────────────

  const computeMorphTarget = useCallback(() => {
    // The BottomCommandBar is positioned absolute within the canvas container.
    // We need viewport coordinates for framer-motion's fixed-position animation.
    const container = document.querySelector('.react-flow')?.parentElement

    if (container) {
      const rect = container.getBoundingClientRect()
      const inputHeight = inputContainerRef.current?.offsetHeight || 60
      setMorphTarget({
        x: rect.left + rect.width / 2,
        y: rect.bottom - 52 - inputHeight,
        width: Math.min(560, rect.width - 48),
      })
    }
  }, [])

  // ── Submit handler ────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isSubmitting) return

    // Save input BEFORE any state changes
    savedInputRef.current = trimmed

    setIsSubmitting(true)
    setPhase('morphing')

    // Compute where the input needs to animate to
    computeMorphTarget()
  }, [input, isSubmitting, computeMorphTarget])

  // ── Escape key — dismiss without submitting (via EscapeManager at MODAL priority) ──

  useEffect(() => {
    if (!visible || phase !== 'welcome') return
    escapeManager.register('welcome-screen-dismiss', EscapePriority.MODAL, onDismiss)
    return () => escapeManager.unregister('welcome-screen-dismiss')
  }, [visible, phase, onDismiss])

  // ── Textarea key handler ──────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  // ── Morph animation complete ──────────────────────────────────────────────

  const handleMorphComplete = useCallback(() => {
    if (phase === 'morphing') {
      setPhase('done')
      onComplete(savedInputRef.current)
    }
  }, [phase, onComplete])

  // ── Render ────────────────────────────────────────────────────────────────

  const isMorphing = phase === 'morphing' || phase === 'done'
  const canSubmit = input.trim().length > 0 && !isSubmitting

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="welcome-screen"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to [Cognograph]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={{ duration: DURATION_FADE }}
        >
          {/* ═══ Backdrop — click to dismiss ═══ */}
          <motion.div
            className="welcome-screen__backdrop"
            animate={{ opacity: isMorphing ? 0 : 1 }}
            transition={{ duration: DURATION_FADE }}
            onClick={isMorphing ? undefined : onDismiss}
          />

          {/* ═══ Dismiss button ═══ */}
          {!isMorphing && (
            <motion.button
              className="welcome-screen__dismiss"
              onClick={onDismiss}
              aria-label="Dismiss"
              type="button"
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION_FADE }}
            >
              <X size={18} />
            </motion.button>
          )}

          {/* ═══ Content wrapper ═══ */}
          <div className="welcome-screen__content">
            {/* ── Heading ── */}
            <motion.h1
              className="welcome-screen__heading"
              animate={{ opacity: isMorphing ? 0 : 1 }}
              transition={{ duration: DURATION_FADE }}
            >
              {hasExistingWorkspace ? (
                <>Your canvas is empty</>
              ) : (
                <>
                  Welcome to <span className="welcome-screen__bracket">[</span>Cognograph
                  <span className="welcome-screen__bracket">]</span>
                </>
              )}
            </motion.h1>

            {/* ── Intro ── */}
            <motion.p
              className="welcome-screen__intro"
              animate={{ opacity: isMorphing ? 0 : 1 }}
              transition={{ duration: DURATION_FADE }}
            >
              {hasExistingWorkspace
                ? 'Describe what you want to build, or drop a file onto the canvas to get started.'
                : 'Think with nodes and LLMs. Every conversation becomes a node on your canvas \u2014 connect them to build context, visualize your thinking, and orchestrate AI workflows.'}
            </motion.p>

            {/* ── Input container (morphs to BottomCommandBar position) ── */}
            <motion.div
              ref={inputContainerRef}
              className="welcome-screen__input-container"
              layout={false}
              animate={
                isMorphing
                  ? {
                      position: 'fixed' as const,
                      left: morphTarget.x,
                      top: morphTarget.y,
                      x: '-50%',
                      width: morphTarget.width,
                    }
                  : {}
              }
              transition={{
                duration: DURATION_MORPH,
                ease: EASE_MORPH,
              }}
              onAnimationComplete={handleMorphComplete}
            >
              <textarea
                ref={textareaRef}
                className="welcome-screen__input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Start by telling Cognograph what you want to do..."
                disabled={isSubmitting}
                rows={3}
                tabIndex={0}
                enterKeyHint="send"
              />

              <div className="welcome-screen__input-footer">
                <span className="welcome-screen__hint">
                  {isMorphing
                    ? ''
                    : window.matchMedia('(pointer: coarse)').matches
                      ? 'Tap Send to begin'
                      : 'Enter to send \u00B7 Esc to dismiss'}
                </span>
                <button
                  className="welcome-screen__submit"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  aria-label="Submit"
                  tabIndex={0}
                  type="button"
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </motion.div>

            {/* ── Hint (below input, fades with heading) ── */}
            {/* Hint is inside the input footer above */}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const WelcomeScreen = memo(WelcomeScreenComponent)
