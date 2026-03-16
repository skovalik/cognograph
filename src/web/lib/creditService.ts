export function formatCreditBalance(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export const CREDIT_BUNDLES = [
  { id: 'credits_10', amount: 1000, label: '$10' },
  { id: 'credits_25', amount: 2500, label: '$25' },
  { id: 'credits_50', amount: 5000, label: '$50' },
  { id: 'credits_100', amount: 10000, label: '$100' },
] as const

export type CreditBundleId = typeof CREDIT_BUNDLES[number]['id']
