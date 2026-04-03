// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Entitlements Store — Client-side feature gate management.
 *
 * Caches user's entitlements and provides hooks for checking feature access.
 * Syncs with server every 5 minutes or on demand.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logger } from '../utils/logger'

const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ORCHESTRATOR_URL)
  || 'https://api.cognograph.app'

export type Plan = 'free' | 'pro' | null

export interface Entitlement {
  enabled: boolean
  limit?: number | null
}

export interface EntitlementsState {
  // Data
  plan: Plan
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | string
  entitlements: Record<string, Entitlement>
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  lastFetched: number | null
  gracePeriodStatus: 'none' | 'early' | 'urgent' | 'expired'
  usage: {
    workspaces: { current: number; limit: number }
    storage: { current: number; limit: number }
    apiCalls: { current: number; limit: number }
  } | null

  // Actions
  fetchEntitlements: () => Promise<void>
  checkEntitlement: (feature: string) => boolean
  getEntitlementLimit: (feature: string) => number | null
  clearEntitlements: () => void
}

// Feature to required plan mapping (for upgrade prompts).
// Only gate features that require server-side resources.
// Client-side features (spatial_triggers, unlimited_workspaces, plan_preview_apply,
// env_templates) are free — the product is open source and self-hostable.
export const FEATURE_REQUIREMENTS: Record<string, Plan[]> = {
  cloud_sync: ['pro'],
  cloud_terminal_unlimited: ['pro'],
  cloud_terminal_free: ['free', 'pro'],
  orchestrator_node: ['pro'],
  full_context_injection: ['pro'],
}

// Plan upgrade order
const PLAN_ORDER: Plan[] = ['free', 'pro']

export const useEntitlementsStore = create<EntitlementsState>()(
  persist(
    (set, get) => ({
      // Initial state (null = unauthenticated / unknown)
      plan: null,
      status: 'active',
      entitlements: {
        cloud_sync: { enabled: false },
        cloud_terminal_unlimited: { enabled: false },
        cloud_terminal_free: { enabled: true, limit: 30 },
        unlimited_workspaces: { enabled: true },
        spatial_triggers: { enabled: true },
        orchestrator_node: { enabled: false },
        plan_preview_apply: { enabled: true },
        env_templates: { enabled: true },
        full_context_injection: { enabled: false },
      },
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      lastFetched: null,
      gracePeriodStatus: 'none' as const,
      usage: null,

      /**
       * Fetch entitlements from orchestrator API via Supabase JWT.
       */
      fetchEntitlements: async () => {
        try {
          // Try Supabase auth first (web/cloud mode)
          let authHeader: string | null = null
          try {
            const { supabase } = await import('../../../web/lib/supabase')
            if (supabase) {
              const { data: { session } } = await supabase.auth.getSession()
              if (session?.access_token) {
                authHeader = `Bearer ${session.access_token}`
              }
            }
          } catch {
            // Supabase not available (Electron mode) — try workspace token
          }

          // Fallback: Electron workspace token
          if (!authHeader && (window as any).__ELECTRON__) {
            const workspaceId = localStorage.getItem('lastWorkspaceId')
            if (workspaceId) {
              try {
                const tokenResult = await window.api.multiplayer.getToken(workspaceId)
                if (tokenResult?.success && tokenResult.token) {
                  authHeader = `Bearer ${tokenResult.token}`
                }
              } catch {
                // multiplayer not available
              }
            }
          }

          if (!authHeader) {
            logger.log('[Entitlements] No auth available, using defaults')
            return
          }

          const response = await fetch(`${API_URL}/api/billing/status`, {
            headers: { 'Authorization': authHeader }
          })

          if (!response.ok) {
            console.warn('[Entitlements] Failed to fetch:', response.status)
            return
          }

          const data = await response.json()

          set({
            plan: data.tier || data.plan || 'free',
            status: data.status || 'active',
            entitlements: data.entitlements || get().entitlements,
            currentPeriodEnd: data.currentPeriodEnd || null,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
            lastFetched: Date.now(),
            gracePeriodStatus: data.gracePeriodStatus || 'none',
            usage: data.usage || null,
          })

          logger.log('[Entitlements] Updated:', data.tier || data.plan)

        } catch (err) {
          console.error('[Entitlements] Fetch error:', err)
        }
      },

      /**
       * Check if user has a specific entitlement.
       */
      checkEntitlement: (feature: string) => {
        const { entitlements } = get()
        const entitlement = entitlements[feature]
        return entitlement?.enabled ?? false
      },

      /**
       * Get the limit value for a feature.
       */
      getEntitlementLimit: (feature: string) => {
        const { entitlements } = get()
        const entitlement = entitlements[feature]
        return entitlement?.limit ?? null
      },

      /**
       * Clear entitlements (on logout).
       */
      clearEntitlements: () => {
        set({
          plan: null,
          status: 'active',
          entitlements: {
            cloud_sync: { enabled: false },
            cloud_terminal_unlimited: { enabled: false },
            cloud_terminal_free: { enabled: true, limit: 30 },
            unlimited_workspaces: { enabled: true },
            spatial_triggers: { enabled: true },
            orchestrator_node: { enabled: false },
            plan_preview_apply: { enabled: true },
            env_templates: { enabled: true },
            full_context_injection: { enabled: false },
          },
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          lastFetched: null,
          gracePeriodStatus: 'none' as const,
          usage: null,
        })
      }
    }),
    {
      name: 'cognograph-entitlements',
      partialize: (state) => ({
        plan: state.plan,
        status: state.status,
        entitlements: state.entitlements,
        currentPeriodEnd: state.currentPeriodEnd,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
        lastFetched: state.lastFetched,
        gracePeriodStatus: state.gracePeriodStatus,
        usage: state.usage,
      })
    }
  )
)

// -----------------------------------------------------------------------------
// Helper Hooks
// -----------------------------------------------------------------------------

/**
 * Hook to check if a feature is enabled.
 */
export function useEntitlement(feature: string): boolean {
  return useEntitlementsStore((state) => state.checkEntitlement(feature))
}

/**
 * Hook to get the current plan.
 */
export function usePlan(): Plan {
  return useEntitlementsStore((state) => state.plan)
}

/**
 * Get the minimum plan required for a feature.
 */
export function getRequiredPlan(feature: string): Plan {
  const plans = FEATURE_REQUIREMENTS[feature]
  return plans?.[0] || 'pro'
}

/**
 * Check if a plan has access to a feature.
 */
export function planHasFeature(plan: Plan, feature: string): boolean {
  if (!plan) return false // Unauthenticated users have no plan-gated features
  const requiredPlans = FEATURE_REQUIREMENTS[feature]
  if (!requiredPlans) return true // No requirements = everyone has access
  return requiredPlans.includes(plan)
}

/**
 * Get the next plan upgrade from current plan.
 */
export function getUpgradePlan(currentPlan: Plan): Plan | null {
  if (!currentPlan) return 'free' // Unauthenticated -> suggest free plan first
  const currentIndex = PLAN_ORDER.indexOf(currentPlan)
  if (currentIndex >= PLAN_ORDER.length - 1) return null
  return PLAN_ORDER[currentIndex + 1] as Plan
}

/**
 * Hook to get the grace period status.
 */
export function useGracePeriodStatus(): 'none' | 'early' | 'urgent' | 'expired' {
  return useEntitlementsStore((state) => state.gracePeriodStatus)
}

/**
 * Hook to get usage data.
 */
export function useUsage(): EntitlementsState['usage'] {
  return useEntitlementsStore((state) => state.usage)
}

// -----------------------------------------------------------------------------
// Auto-refresh
// -----------------------------------------------------------------------------

// Refresh entitlements every 5 minutes when app is active
let refreshInterval: ReturnType<typeof setInterval> | null = null

export function startEntitlementsRefresh(): void {
  if (refreshInterval) return

  // Initial fetch
  useEntitlementsStore.getState().fetchEntitlements()

  // Periodic refresh
  refreshInterval = setInterval(() => {
    useEntitlementsStore.getState().fetchEntitlements()
  }, 5 * 60 * 1000) // 5 minutes
}

export function stopEntitlementsRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}
