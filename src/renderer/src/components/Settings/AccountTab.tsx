// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * AccountTab — Account profile, billing, and credits in settings popover.
 *
 * Shows user profile, current plan badge, credit balance with purchase
 * buttons, storage usage bar, and manage subscription link.
 */

import { CreditCard, Database, ExternalLink, Loader2, Star, User } from 'lucide-react'
import { memo, useEffect } from 'react'
import { createCheckoutSession, getCustomerPortalUrl } from '../../../../web/lib/billingService'
import { CREDIT_BUNDLES, formatCreditBalance } from '../../../../web/lib/creditService'
import { isAuthEnabled } from '../../../../web/lib/supabase'
import { useBillingStore } from '../../../../web/stores/billingStore'

function AccountTabComponent(): JSX.Element {
  const {
    tier,
    status,
    creditBalanceCents,
    currentPeriodEnd,
    foundingMember,
    storageUsedBytes,
    storageLimitBytes,
    loading,
    fetchBilling,
  } = useBillingStore()

  useEffect(() => {
    if (isAuthEnabled()) fetchBilling()
  }, [fetchBilling])

  if (!isAuthEnabled()) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium gui-text mb-1">Account</h3>
          <p className="text-xs gui-text-secondary">
            Sign in to access billing and account settings.
          </p>
        </div>
        <div className="gui-card rounded-lg p-6 text-center">
          <User className="w-8 h-8 mx-auto mb-2 gui-text-secondary" />
          <p className="text-sm gui-text-secondary">Not signed in</p>
          <p className="text-xs gui-text-secondary mt-1">
            Visit the dashboard to create an account.
          </p>
          <a
            href="/dashboard"
            className="gui-btn gui-btn-accent gui-btn-sm text-xs mt-3 inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Go to Dashboard
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin gui-text-secondary" />
      </div>
    )
  }

  const storagePercent =
    storageLimitBytes > 0
      ? Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))
      : 0
  const storageMB = (storageUsedBytes / (1024 * 1024)).toFixed(1)
  const storageLimitMB = (storageLimitBytes / (1024 * 1024)).toFixed(0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium gui-text mb-1">Account & Billing</h3>
        <p className="text-xs gui-text-secondary">Manage your plan, credits, and storage.</p>
      </div>

      {/* Plan Badge */}
      <div className="gui-card rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {foundingMember && (
              <Star className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium gui-text capitalize">{tier} Plan</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor:
                      status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: status === 'active' ? '#22c55e' : '#ef4444',
                  }}
                >
                  {status}
                </span>
              </div>
              {currentPeriodEnd && (
                <p className="text-[10px] gui-text-secondary mt-0.5">
                  Renews {new Date(currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {tier === 'free' ? (
            <button
              onClick={() => createCheckoutSession('pro_monthly')}
              className="gui-btn gui-btn-accent gui-btn-sm text-xs"
            >
              Upgrade to Pro
            </button>
          ) : (
            <button
              onClick={async () => {
                const url = await getCustomerPortalUrl()
                window.open(url, '_blank')
              }}
              className="gui-btn gui-btn-ghost gui-btn-sm text-xs"
            >
              <ExternalLink className="w-3 h-3" /> Manage
            </button>
          )}
        </div>
      </div>

      {/* Credits */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-4 h-4" style={{ color: 'var(--gui-accent-secondary)' }} />
          <span className="text-xs font-medium gui-text">AI Credits</span>
        </div>
        <div className="gui-card rounded-lg p-3">
          <div className="text-lg font-medium gui-text mb-2">
            {formatCreditBalance(creditBalanceCents)}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CREDIT_BUNDLES.map((bundle) => (
              <button
                key={bundle.id}
                onClick={() => createCheckoutSession(bundle.id as any)}
                className="px-2.5 py-1 text-xs gui-card rounded hover:gui-surface-secondary transition-colors"
              >
                + {bundle.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Storage */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4" style={{ color: 'var(--gui-accent-secondary)' }} />
          <span className="text-xs font-medium gui-text">Storage</span>
        </div>
        <div className="gui-card rounded-lg p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs gui-text">{storageMB} MB used</span>
            <span className="text-[10px] gui-text-secondary">{storageLimitMB} MB limit</span>
          </div>
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--surface-secondary)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${storagePercent}%`,
                backgroundColor:
                  storagePercent > 90
                    ? '#ef4444'
                    : storagePercent > 70
                      ? '#f59e0b'
                      : 'var(--gui-accent-primary)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export const AccountTab = memo(AccountTabComponent)
