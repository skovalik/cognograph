import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { Coins, ChevronUp, ChevronDown } from 'lucide-react'
import { useTokenEstimate } from '../../hooks/useTokenEstimate'
import { formatTokenCount, formatCost } from '../../utils/tokenEstimator'
import { getUsageLevel } from '../../utils/tokenEstimation'
import { TokenBreakdownPopover } from './TokenBreakdownPopover'

interface TokenIndicatorProps {
  nodeId: string
  currentInput?: string
  isLightMode: boolean
}

/**
 * Compact token/cost indicator badge.
 * Shows estimated input tokens and USD cost.
 * Click to expand the full breakdown popover.
 */
function TokenIndicatorComponent({ nodeId, currentInput, isLightMode }: TokenIndicatorProps): JSX.Element | null {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const estimate = useTokenEstimate(nodeId, currentInput)

  const toggleBreakdown = useCallback(() => {
    setShowBreakdown(prev => !prev)
  }, [])

  useEffect(() => {
    if (!showBreakdown) return

    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowBreakdown(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowBreakdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showBreakdown])

  if (!estimate) return null

  const level = getUsageLevel(estimate.usagePercentage)

  const levelColors: Record<string, string> = {
    low: isLightMode ? '#10b981' : '#34d399',
    medium: isLightMode ? '#f59e0b' : '#fbbf24',
    high: isLightMode ? '#f97316' : '#fb923c',
    critical: isLightMode ? '#ef4444' : '#f87171'
  }

  const color = levelColors[level] || levelColors.low

  return (
    <div className="token-indicator-wrapper" ref={wrapperRef}>
      <button
        onClick={toggleBreakdown}
        className={`token-indicator ${isLightMode ? 'token-indicator--light' : 'token-indicator--dark'}`}
        title="Token estimate and cost. Click for breakdown."
      >
        <Coins className="token-indicator__icon" style={{ color }} size={14} />
        <span className="token-indicator__tokens" style={{ color }}>
          ~{formatTokenCount(estimate.inputTokens)}
        </span>
        <span className="token-indicator__separator">|</span>
        <span className="token-indicator__cost">
          {formatCost(estimate.cost.totalCost)}
        </span>
        {showBreakdown ? (
          <ChevronUp size={12} className="token-indicator__chevron" />
        ) : (
          <ChevronDown size={12} className="token-indicator__chevron" />
        )}
      </button>

      {showBreakdown && (
        <TokenBreakdownPopover
          estimate={estimate}
          isLightMode={isLightMode}
          onClose={() => setShowBreakdown(false)}
        />
      )}
    </div>
  )
}

export const TokenIndicator = memo(TokenIndicatorComponent)
