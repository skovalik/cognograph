/**
 * UpgradePrompt — Modal/tooltip shown when user tries to access a gated feature.
 *
 * Displays feature name, benefit description, and upgrade CTA.
 */

import { memo, useState, useCallback } from 'react'
import { Lock, X, ArrowRight, Sparkles } from 'lucide-react'
import {
  usePlan,
  getRequiredPlan,
  type Plan
} from '../stores/entitlementsStore'

// Feature display information
const FEATURE_INFO: Record<string, { name: string; description: string; benefit: string }> = {
  cloud_sync: {
    name: 'Cloud Sync',
    description: 'Sync your workspaces across devices and access them from anywhere.',
    benefit: 'Never lose your work - automatic backup and cross-device access.'
  },
  version_history: {
    name: 'Version History',
    description: 'View and restore previous versions of your workspace.',
    benefit: 'Time travel through your work and recover deleted content.'
  },
  branching: {
    name: 'Workspace Branching',
    description: 'Create experimental copies of your workspace to try ideas safely.',
    benefit: 'Experiment freely without affecting your main workspace.'
  },
  mcp_integrations: {
    name: 'MCP Integrations',
    description: 'Connect Claude to external tools and services via MCP.',
    benefit: 'Automate workflows and extend Claude\'s capabilities.'
  },
  api_access: {
    name: 'API Access',
    description: 'Programmatically interact with your workspaces.',
    benefit: 'Build custom integrations and automations.'
  }
}

// Plan display information
const PLAN_INFO: Record<Plan, { name: string; price: string }> = {
  free: { name: 'Free', price: '$0' },
  pro: { name: 'Pro', price: '$12/mo' },
  power: { name: 'Power', price: '$29/mo' },
  team: { name: 'Team', price: '$49/seat/mo' }
}

interface UpgradePromptProps {
  feature: string
  onClose?: () => void
  variant?: 'modal' | 'inline' | 'tooltip'
}

export const UpgradePrompt = memo(function UpgradePrompt({
  feature,
  onClose,
  variant = 'modal'
}: UpgradePromptProps) {
  const currentPlan = usePlan()
  const requiredPlan = getRequiredPlan(feature)
  const featureInfo = FEATURE_INFO[feature] || {
    name: feature,
    description: 'This feature requires an upgraded plan.',
    benefit: 'Unlock more capabilities with an upgrade.'
  }
  const planInfo = PLAN_INFO[requiredPlan]

  const [isLoading, setIsLoading] = useState(false)

  const handleUpgrade = useCallback(async () => {
    setIsLoading(true)
    try {
      // Open upgrade page in browser
      // In production, this would go to the Stripe checkout
      const upgradeUrl = `https://cognograph.app/upgrade?plan=${requiredPlan}&feature=${feature}`
      window.open(upgradeUrl, '_blank')
    } finally {
      setIsLoading(false)
    }
  }, [requiredPlan, feature])

  if (variant === 'tooltip') {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg p-3 max-w-xs">
        <div className="flex items-center gap-2 text-yellow-500 mb-2">
          <Lock size={14} />
          <span className="text-sm font-medium">{planInfo.name} Feature</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-2">{featureInfo.description}</p>
        <button
          onClick={handleUpgrade}
          className="w-full text-xs py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center gap-1"
        >
          Upgrade to {planInfo.name}
          <ArrowRight size={12} />
        </button>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 p-3 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg">
        <div className="p-2 rounded-full bg-yellow-500/10">
          <Lock size={16} className="text-yellow-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">{featureInfo.name}</p>
          <p className="text-xs text-[var(--text-secondary)] truncate">{featureInfo.description}</p>
        </div>
        <button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="shrink-0 text-xs py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-1 disabled:opacity-50"
        >
          Upgrade
          <ArrowRight size={12} />
        </button>
      </div>
    )
  }

  // Modal variant
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-[var(--bg-primary)] rounded-lg shadow-xl border border-[var(--border-default)]">
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          >
            <X size={16} />
          </button>
        )}

        {/* Header */}
        <div className="p-6 text-center border-b border-[var(--border-default)]">
          <div className="inline-flex p-3 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-4">
            <Sparkles size={24} className="text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            Unlock {featureInfo.name}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Available on {planInfo.name} and above
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {featureInfo.description}
          </p>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-6">
            <p className="text-sm text-blue-300 flex items-start gap-2">
              <Sparkles size={14} className="shrink-0 mt-0.5" />
              {featureInfo.benefit}
            </p>
          </div>

          {/* Plan comparison mini */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1 p-3 rounded-lg border border-[var(--border-default)] opacity-50">
              <p className="text-xs text-[var(--text-secondary)] mb-1">Current</p>
              <p className="font-medium text-[var(--text-primary)]">{PLAN_INFO[currentPlan].name}</p>
            </div>
            <div className="flex items-center">
              <ArrowRight size={16} className="text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1 p-3 rounded-lg border-2 border-blue-500 bg-blue-500/5">
              <p className="text-xs text-blue-400 mb-1">Upgrade to</p>
              <p className="font-medium text-[var(--text-primary)]">{planInfo.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{planInfo.price}</p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              'Loading...'
            ) : (
              <>
                Upgrade to {planInfo.name}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[var(--bg-secondary)] rounded-b-lg border-t border-[var(--border-default)]">
          <p className="text-xs text-center text-[var(--text-secondary)]">
            14-day money-back guarantee · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
})

// -----------------------------------------------------------------------------
// Helper hook for conditional rendering
// -----------------------------------------------------------------------------

/**
 * Hook that returns a wrapped component with upgrade prompt if feature is gated.
 */
export function useFeatureGate(feature: string): {
  isEnabled: boolean
  UpgradePrompt: React.FC<{ onClose?: () => void }>
} {
  const plan = usePlan()
  const requiredPlan = getRequiredPlan(feature)
  const planOrder = ['free', 'pro', 'power', 'team']
  const isEnabled = planOrder.indexOf(plan) >= planOrder.indexOf(requiredPlan)

  const PromptComponent = memo(function PromptComponent({ onClose }: { onClose?: () => void }) {
    if (isEnabled) return null
    return <UpgradePrompt feature={feature} onClose={onClose} />
  })

  return { isEnabled, UpgradePrompt: PromptComponent }
}
