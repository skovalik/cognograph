/**
 * EmptyCanvasHint
 *
 * Floating hint that appears on empty canvas and fades after interaction.
 * ND-friendly: reduces initiation friction with clear next action.
 */

import { memo, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Sparkles, Command, Keyboard, FileText } from 'lucide-react'
import { useNodesStore } from '../stores'

interface EmptyCanvasHintProps {
  onDismiss?: () => void
}

function EmptyCanvasHintComponent({ onDismiss }: EmptyCanvasHintProps): JSX.Element | null {
  const nodes = useNodesStore((s) => s.nodes)
  const [dismissed, setDismissed] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  // Check if canvas is empty
  const isEmpty = nodes.length === 0

  // Dismiss after user interaction
  useEffect(() => {
    if (!isEmpty) {
      setDismissed(true)
      onDismiss?.()
    }
  }, [isEmpty, onDismiss])

  // Listen for any interaction to start fade-out timer
  useEffect(() => {
    if (dismissed || hasInteracted) return

    const handleInteraction = () => {
      setHasInteracted(true)
    }

    // Listen for keyboard or mouse events as interaction signals
    window.addEventListener('keydown', handleInteraction)
    window.addEventListener('mousedown', handleInteraction)

    return () => {
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('mousedown', handleInteraction)
    }
  }, [dismissed, hasInteracted])

  // Fade out after interaction delay
  useEffect(() => {
    if (!hasInteracted || dismissed) return

    const timer = setTimeout(() => {
      setDismissed(true)
      onDismiss?.()
    }, 3000) // Fade after 3 seconds of interaction

    return () => clearTimeout(timer)
  }, [hasInteracted, dismissed, onDismiss])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    onDismiss?.()
  }, [onDismiss])

  if (dismissed || !isEmpty) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: hasInteracted ? 0.6 : 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        style={{ zIndex: 5 }}
      >
        <motion.div
          className="gui-panel glass-soft border gui-border rounded-2xl p-8 max-w-md text-center pointer-events-auto shadow-xl"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          onClick={handleDismiss}
        >
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-cyan-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold gui-text mb-2">
            Your canvas is ready
          </h2>

          {/* Description */}
          <p className="gui-text-secondary text-sm mb-6">
            Start by creating a conversation to chat with Claude, or add notes to organize your thoughts.
          </p>

          {/* Quick actions */}
          <div className="flex flex-col gap-2 text-left text-sm">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span className="gui-text flex-1">Double-click to create a conversation</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
              <Command className="w-4 h-4 text-purple-400" />
              <span className="gui-text flex-1">Press <kbd className="px-1.5 py-0.5 text-xs bg-white/10 rounded">Ctrl+K</kbd> to open command palette</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
              <FileText className="w-4 h-4 text-green-400" />
              <span className="gui-text flex-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-white/10 rounded">Shift+N</kbd> note
                <span className="mx-1 opacity-40">·</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-white/10 rounded">Shift+C</kbd> conversation
                <span className="mx-1 opacity-40">·</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-white/10 rounded">Shift+T</kbd> task
              </span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
              <Keyboard className="w-4 h-4 text-amber-400" />
              <span className="gui-text flex-1">Press <kbd className="px-1.5 py-0.5 text-xs bg-white/10 rounded">?</kbd> for all keyboard shortcuts</span>
            </div>
          </div>

          {/* Dismiss hint */}
          <p className="gui-text-secondary text-xs mt-6 opacity-60">
            Click anywhere to dismiss
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export const EmptyCanvasHint = memo(EmptyCanvasHintComponent)
