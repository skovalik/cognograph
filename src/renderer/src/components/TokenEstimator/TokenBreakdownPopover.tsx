import { memo } from 'react'
import { FileText, MessageSquare, Bot, Layers } from 'lucide-react'
import { formatTokenCount, formatCost, type TokenEstimate, type TokenBreakdownItem } from '../../utils/tokenEstimator'
import { getUsageLevel } from '../../utils/tokenEstimation'

interface TokenBreakdownPopoverProps {
  estimate: TokenEstimate
  isLightMode: boolean
  onClose: () => void
}

function getItemIcon(item: TokenBreakdownItem): JSX.Element {
  if (item.label === 'System prompt') return <Bot size={12} />
  if (item.label === 'Conversation history') return <MessageSquare size={12} />
  if (item.label === 'Current message') return <FileText size={12} />
  return <Layers size={12} />
}

/**
 * Expanded popover showing detailed token breakdown by source.
 */
function TokenBreakdownPopoverComponent({ estimate, isLightMode, onClose: _onClose }: TokenBreakdownPopoverProps): JSX.Element {
  const level = getUsageLevel(estimate.usagePercentage)

  const bgClass = isLightMode ? 'token-popover--light' : 'token-popover--dark'

  const levelLabels: Record<string, string> = {
    low: 'Low usage',
    medium: 'Moderate usage',
    high: 'High usage',
    critical: 'Near limit'
  }

  return (
    <div className={`token-popover ${bgClass}`} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="token-popover__header">
        <span className="token-popover__title">Token Breakdown</span>
        <span className={`token-popover__level token-popover__level--${level}`}>
          {levelLabels[level]}
        </span>
      </div>

      {/* Model info */}
      <div className="token-popover__model">
        Model: <strong>{estimate.model}</strong>
        <span className="token-popover__model-limit">
          ({formatTokenCount(estimate.contextLimit)} context)
        </span>
      </div>

      {/* Usage bar */}
      <div className="token-popover__bar-container">
        <div className="token-popover__bar">
          <div
            className={`token-popover__bar-fill token-popover__bar-fill--${level}`}
            style={{ width: `${Math.min(100, estimate.usagePercentage)}%` }}
          />
        </div>
        <span className="token-popover__bar-label">{estimate.usagePercentage.toFixed(1)}%</span>
      </div>

      {/* Breakdown items */}
      <div className="token-popover__breakdown">
        {estimate.breakdown.map((item, index) => (
          <div key={index} className="token-popover__item">
            <span className="token-popover__item-icon">{getItemIcon(item)}</span>
            <span className="token-popover__item-label" title={item.label}>
              {item.label}
            </span>
            <span className="token-popover__item-tokens">
              {formatTokenCount(item.tokens)}
            </span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="token-popover__totals">
        <div className="token-popover__total-row">
          <span>Input tokens</span>
          <span>{formatTokenCount(estimate.inputTokens)}</span>
        </div>
        <div className="token-popover__total-row">
          <span>Est. output tokens</span>
          <span>{formatTokenCount(estimate.estimatedOutputTokens)}</span>
        </div>
        <div className="token-popover__total-row token-popover__total-row--highlight">
          <span>Estimated cost</span>
          <span>{formatCost(estimate.cost.totalCost)}</span>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="token-popover__cost-detail">
        <span>Input: {formatCost(estimate.cost.inputCost)}</span>
        <span>Output: {formatCost(estimate.cost.outputCost)}</span>
      </div>
    </div>
  )
}

export const TokenBreakdownPopover = memo(TokenBreakdownPopoverComponent)
