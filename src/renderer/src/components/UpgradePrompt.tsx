// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * UpgradePrompt — Modal/tooltip shown when user tries to access a gated feature.
 *
 * Displays feature name, benefit description, and upgrade CTA.
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { Lock, X, ArrowRight, Sparkles } from 'lucide-react'
import { escapeManager, EscapePriority } from '../utils/EscapeManager'
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
  cloud_terminal_unlimited: {
    name: 'Unlimited Cloud Terminals',
    description: 'Run unlimited cloud terminal sessions without daily limits.',
    benefit: 'Full-power cloud development environment, always available.'
  },
  orchestrator_node: {
    name: 'Orchestrator Nodes',
    description: 'Multi-step AI pipelines with branching and error handling.',
    benefit: 'Chain AI agents together for complex automated workflows.'
  },
  full_context_injection: {
    name: 'Full Context Injection',
    description: 'Inject full workspace context into AI conversations.',
    benefit: 'Give AI complete project awareness for better responses.'
  },
}

// Plan display information (null plan = unauthenticated, treated same as free for display)
const PLAN_INFO: Record<NonNullable<Plan>, { name: string; price: string }> = {
  free: { name: 'Free', price: '$0' },
  pro: { name: 'Pro', price: '$9/mo' },
}

function getPlanInfo(plan: Plan): { name: string; price: string } {
  return PLAN_INFO[plan ?? 'free']
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
  const planInfo = getPlanInfo(requiredPlan)

  const [isLoading, setIsLoading] = useState(false)
  const upgradeBtnRef = useRef<HTMLButtonElement>(null)

  // Escape key handler for modal variant
  useEffect(() => {
    if (variant !== 'modal' || !onClose) return
    escapeManager.register('modal-upgrade-prompt', EscapePriority.MODAL, onClose)
    return () => escapeManager.unregister('modal-upgrade-prompt')
  }, [variant, onClose])

  // Auto-focus upgrade button on mount for modal variant
  useEffect(() => {
    if (variant === 'modal') {
      upgradeBtnRef.current?.focus()
    }
  }, [variant])

  const handleUpgrade = useCallback(async () => {
    setIsLoading(true)
    try {
      // Cloud billing not available in open-source build
      window.open('https://cognograph.app/#pricing', '_blank')
    } finally {
      setIsLoading(false)
    }
  }, [])

  if (variant === 'tooltip') {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg p-3 max-w-xs">
        <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--gold)' }}>
          <Lock size={14} />
          <span className="text-sm font-medium">{planInfo.name} Feature</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-2">{featureInfo.description}</p>
        <button
          onClick={handleUpgrade}
          className="w-full text-xs py-1.5 px-3 rounded flex items-center justify-center gap-1"
          style={{ background: 'var(--gold)', color: 'var(--bg-primary)' }}
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
        <div className="p-2 rounded-full" style={{ background: 'color-mix(in srgb, var(--gold) 10%, transparent)' }}>
          <Lock size={16} style={{ color: 'var(--gold)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">{featureInfo.name}</p>
          <p className="text-xs text-[var(--text-secondary)] truncate">{featureInfo.description}</p>
        </div>
        <button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="shrink-0 text-xs py-1.5 px-3 rounded flex items-center gap-1 disabled:opacity-50"
          style={{ background: 'var(--gold)', color: 'var(--bg-primary)' }}
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
          <div className="inline-flex p-3 rounded-full mb-4" style={{ background: 'color-mix(in srgb, var(--gold) 15%, transparent)' }}>
            <Sparkles size={24} style={{ color: 'var(--gold)' }} />
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

          <div className="p-3 rounded-lg mb-6" style={{ background: 'color-mix(in srgb, var(--gold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)' }}>
            <p className="text-sm flex items-start gap-2" style={{ color: 'var(--gui-accent-secondary)' }}>
              <Sparkles size={14} className="shrink-0 mt-0.5" />
              {featureInfo.benefit}
            </p>
          </div>

          {/* Plan comparison mini */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1 p-3 rounded-lg border border-[var(--border-default)] opacity-50">
              <p className="text-xs text-[var(--text-secondary)] mb-1">Current</p>
              <p className="font-medium text-[var(--text-primary)]">{getPlanInfo(currentPlan).name}</p>
            </div>
            <div className="flex items-center">
              <ArrowRight size={16} className="text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1 p-3 rounded-lg" style={{ border: '2px solid var(--gold)', background: 'color-mix(in srgb, var(--gold) 5%, transparent)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--gold)' }}>Upgrade to</p>
              <p className="font-medium text-[var(--text-primary)]">{planInfo.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{planInfo.price}</p>
            </div>
          </div>

          {/* CTA */}
          <button
            ref={upgradeBtnRef}
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full py-3 px-4 font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: 'var(--gold)', color: 'var(--bg-primary)' }}
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
            Cancel anytime — no questions asked
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
  const planOrder = ['free', 'pro']
  const isEnabled = planOrder.indexOf(plan) >= planOrder.indexOf(requiredPlan)

  const PromptComponent = memo(function PromptComponent({ onClose }: { onClose?: () => void }) {
    if (isEnabled) return null
    return <UpgradePrompt feature={feature} onClose={onClose} />
  })

  return { isEnabled, UpgradePrompt: PromptComponent }
}
