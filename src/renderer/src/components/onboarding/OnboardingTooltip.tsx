import { memo, useEffect, useState } from 'react'
import { X, Lightbulb } from 'lucide-react'
import type { ActiveTooltip } from '../../hooks/useOnboardingTooltips'

interface OnboardingTooltipProps {
  tooltip: ActiveTooltip
  onDismiss: () => void
}

/**
 * A non-modal floating tooltip that shows contextual onboarding tips.
 * Positioned near the triggering element or centered at the bottom of the viewport.
 * Auto-fades in and supports manual dismissal.
 */
export const OnboardingTooltip = memo(function OnboardingTooltip({
  tooltip,
  onDismiss
}: OnboardingTooltipProps) {
  const [visible, setVisible] = useState(false)

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [tooltip.id])

  // Compute position: if tooltip has a screen position, show near it; otherwise bottom-center
  const style: React.CSSProperties = tooltip.position
    ? {
        position: 'fixed',
        left: Math.max(20, Math.min(tooltip.position.x - 160, window.innerWidth - 340)),
        top: Math.max(20, tooltip.position.y - 70),
        zIndex: 9999
      }
    : {
        position: 'fixed',
        left: '50%',
        bottom: 80,
        transform: 'translateX(-50%)',
        zIndex: 9999
      }

  return (
    <div
      style={style}
      className={`
        max-w-xs px-4 py-3 rounded-lg shadow-lg
        bg-[var(--surface-panel)] border border-[var(--border-subtle)]
        transition-all duration-300 ease-out pointer-events-auto
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Lightbulb
          size={16}
          className="flex-shrink-0 mt-0.5"
          style={{ color: 'var(--gui-accent-warning, #f59e0b)' }}
        />
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed flex-1">
          {tooltip.message}
        </p>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="Dismiss tip"
        >
          <X size={12} className="text-[var(--text-muted)]" />
        </button>
      </div>
    </div>
  )
})
