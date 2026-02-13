import { useMemo, memo } from 'react'
import { calculateTokenUsage, getUsageLevel } from '../utils/tokenEstimation'
import type { Message } from '@shared/types'

interface TokenMeterProps {
  /** Context text from connected nodes */
  contextText: string
  /** Conversation messages */
  messages: Message[]
  /** System prompt (optional) */
  systemPrompt?: string
  /** Model name for context limit lookup */
  model?: string
  /** Compact mode - shows just percentage and bar */
  compact?: boolean
}

/**
 * Token usage meter component
 *
 * Shows estimated context window usage with color-coded fill:
 * - Green (low): < 50%
 * - Yellow (medium): 50-75%
 * - Orange/Red (high): 75-90%
 * - Red (critical): > 90%
 */
function TokenMeterComponent({
  contextText,
  messages,
  systemPrompt = '',
  model,
  compact = false
}: TokenMeterProps): JSX.Element {
  const usage = useMemo(
    () => calculateTokenUsage(contextText, messages, systemPrompt, model),
    [contextText, messages, systemPrompt, model]
  )

  const level = getUsageLevel(usage.percentage)

  if (compact) {
    return (
      <div className="token-meter">
        <div className="token-meter__bar">
          <div
            className={`token-meter__fill usage-${level}`}
            style={{ width: `${usage.percentage}%` }}
          />
        </div>
        <span className="token-meter__label">{Math.round(usage.percentage)}%</span>
      </div>
    )
  }

  return (
    <div className="token-meter">
      <span className="token-meter__label">
        ~{(usage.totalTokens / 1000).toFixed(1)}k / {(usage.maxTokens / 1000).toFixed(0)}k
      </span>
      <div className="token-meter__bar">
        <div
          className={`token-meter__fill usage-${level}`}
          style={{ width: `${usage.percentage}%` }}
        />
      </div>
    </div>
  )
}

export const TokenMeter = memo(TokenMeterComponent)
