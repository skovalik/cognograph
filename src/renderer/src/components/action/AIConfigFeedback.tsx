// =============================================================================
// AI CONFIG FEEDBACK COMPONENT
// =============================================================================
// Post-apply feedback widget

import { memo, useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, X, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { aiConfigLearning } from '../../services/aiConfigLearning'
import { aiConfigAnalytics } from '../../services/aiConfigAnalytics'
import type { AIGeneratedConfig } from '@shared/actionTypes'

interface AIConfigFeedbackProps {
  sessionId: string
  config: AIGeneratedConfig
  questionRounds: number
  onDismiss: () => void
}

const SHOW_DELAY_MS = 2000
const AUTO_DISMISS_MS = 30000

function AIConfigFeedbackComponent({
  sessionId,
  config,
  questionRounds,
  onDismiss
}: AIConfigFeedbackProps): JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Show after delay
  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    const dismissTimer = setTimeout(() => onDismiss(), SHOW_DELAY_MS + AUTO_DISMISS_MS)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
    }
  }, [onDismiss])

  const handleRating = (rating: 'positive' | 'negative') => {
    if (rating === 'negative') {
      setExpanded(true)
    } else {
      submitFeedback(rating, '')
    }
  }

  const submitFeedback = (rating: 'positive' | 'negative', feedbackText: string) => {
    // Record in analytics
    aiConfigAnalytics.trackFeedback(rating, false)

    // Record in learning system
    aiConfigLearning.recordFeedback({
      sessionId,
      rating,
      feedback: feedbackText || undefined,
      hadModifications: false,
      config,
      questionRounds,
      timestamp: Date.now()
    })

    setSubmitted(true)
    setTimeout(onDismiss, 1500)
  }

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        className="p-3 gui-panel-secondary rounded-lg border border-[var(--border-subtle)] shadow-lg"
      >
        {submitted ? (
          // Thank you message
          <div className="flex items-center gap-2 text-emerald-400">
            <Check className="w-4 h-4" />
            <span className="text-xs">Thanks for the feedback!</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Rating buttons */}
            <div className="flex items-center justify-between">
              <span className="text-xs gui-text-secondary">How was this configuration?</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRating('positive')}
                  className="p-1.5 hover:bg-emerald-900/30 rounded transition-colors group"
                  title="Good"
                >
                  <ThumbsUp className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-emerald-400 transition-colors" />
                </button>
                <button
                  onClick={() => handleRating('negative')}
                  className="p-1.5 hover:bg-red-900/30 rounded transition-colors group"
                  title="Could be better"
                >
                  <ThumbsDown className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-red-400 transition-colors" />
                </button>
                <button
                  onClick={onDismiss}
                  className="p-1.5 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>

            {/* Expanded feedback form */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="What would have been better?"
                    className="w-full px-2 py-1.5 text-xs gui-input rounded resize-none outline-none focus:ring-1 focus:ring-purple-500/50"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setExpanded(false)}
                      className="px-2 py-1 text-[10px] gui-text-secondary hover:gui-text transition-colors"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => submitFeedback('negative', feedback)}
                      className="px-3 py-1 text-[10px] bg-purple-600 hover:bg-purple-500 rounded transition-colors"
                    >
                      Submit
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export const AIConfigFeedback = memo(AIConfigFeedbackComponent)
