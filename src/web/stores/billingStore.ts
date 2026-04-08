// Stub for desktop-only public repo. Full implementation in src/web/ (private repo).

import { create } from 'zustand'

interface BillingState {
  tier: 'free' | 'pro'
  status: 'active' | 'past_due' | 'canceled' | 'inactive'
  creditBalanceCents: number
  creditMonthlyCents: number
  currentPeriodEnd: string | null
  foundingMember: boolean
  storageUsedBytes: number
  storageLimitBytes: number
  loading: boolean
  transactions: Array<{
    id: string
    amount_cents: number
    type: string
    provider: string | null
    description: string | null
    created_at: string
  }>
  fetchBilling: () => Promise<void>
  fetchTransactions: () => Promise<void>
}

export const useBillingStore = create<BillingState>()(() => ({
  tier: 'free',
  status: 'inactive',
  creditBalanceCents: 0,
  creditMonthlyCents: 0,
  currentPeriodEnd: null,
  foundingMember: false,
  storageUsedBytes: 0,
  storageLimitBytes: 500 * 1024 * 1024,
  loading: false,
  transactions: [],
  fetchBilling: async () => {},
  fetchTransactions: async () => {},
}))
