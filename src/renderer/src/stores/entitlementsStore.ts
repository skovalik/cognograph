/**
 * Entitlements Store — Client-side feature gate management.
 *
 * Caches user's entitlements and provides hooks for checking feature access.
 * Syncs with server every 5 minutes or on demand.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logger } from '../utils/logger'

export type Plan = 'free' | 'pro' | 'power' | 'team'

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

  // Actions
  fetchEntitlements: () => Promise<void>
  checkEntitlement: (feature: string) => boolean
  getEntitlementLimit: (feature: string) => number | null
  clearEntitlements: () => void
}

// Feature to required plan mapping (for upgrade prompts)
export const FEATURE_REQUIREMENTS: Record<string, Plan[]> = {
  cloud_sync: ['pro', 'power', 'team'],
  version_history: ['pro', 'power', 'team'],
  branching: ['power', 'team'],
  mcp_integrations: ['power', 'team'],
  api_access: ['power', 'team'],
  max_workspaces: ['pro', 'power', 'team'] // Free has limit of 3
}

// Plan upgrade order
const PLAN_ORDER: Plan[] = ['free', 'pro', 'power', 'team']

export const useEntitlementsStore = create<EntitlementsState>()(
  persist(
    (set, get) => ({
      // Initial state (free tier)
      plan: 'free',
      status: 'active',
      entitlements: {
        multiplayer: { enabled: true },
        cloud_sync: { enabled: false },
        version_history: { enabled: false },
        branching: { enabled: false },
        mcp_integrations: { enabled: false },
        api_access: { enabled: false },
        max_workspaces: { enabled: true, limit: 3 }
      },
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      lastFetched: null,

      /**
       * Fetch entitlements from server.
       */
      fetchEntitlements: async () => {
        try {
          // Get current workspace ID for auth
          const workspaceId = localStorage.getItem('lastWorkspaceId')
          if (!workspaceId) {
            logger.log('[Entitlements] No workspace ID, using defaults')
            return
          }

          // Get token
          const tokenResult = await window.api.multiplayer.getToken(workspaceId)
          if (!tokenResult.success || !tokenResult.token) {
            logger.log('[Entitlements] No token, using defaults')
            return
          }

          // Fetch from server
          // Note: This would need proper user auth in production
          // For now, we'll use the workspace token approach
          const response = await fetch('http://localhost:3002/api/billing/status', {
            headers: {
              'Authorization': `Bearer ${tokenResult.token}`
            }
          })

          if (!response.ok) {
            console.warn('[Entitlements] Failed to fetch:', response.status)
            return
          }

          const data = await response.json()

          set({
            plan: data.plan || 'free',
            status: data.status || 'active',
            entitlements: data.entitlements || get().entitlements,
            currentPeriodEnd: data.currentPeriodEnd || null,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
            lastFetched: Date.now()
          })

          logger.log('[Entitlements] Updated:', data.plan)

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
          plan: 'free',
          status: 'active',
          entitlements: {
            multiplayer: { enabled: true },
            cloud_sync: { enabled: false },
            version_history: { enabled: false },
            branching: { enabled: false },
            mcp_integrations: { enabled: false },
            api_access: { enabled: false },
            max_workspaces: { enabled: true, limit: 3 }
          },
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          lastFetched: null
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
        lastFetched: state.lastFetched
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
  const requiredPlans = FEATURE_REQUIREMENTS[feature]
  if (!requiredPlans) return true // No requirements = everyone has access
  return requiredPlans.includes(plan)
}

/**
 * Get the next plan upgrade from current plan.
 */
export function getUpgradePlan(currentPlan: Plan): Plan | null {
  const currentIndex = PLAN_ORDER.indexOf(currentPlan)
  if (currentIndex >= PLAN_ORDER.length - 1) return null
  return PLAN_ORDER[currentIndex + 1] as Plan
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
