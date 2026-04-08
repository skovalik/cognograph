// Stub for desktop-only public repo. Full implementation in src/web/ (private repo).

export async function createCheckoutSession(
  _priceType: 'pro_monthly' | 'credits_10' | 'credits_25' | 'credits_50' | 'credits_100',
  _returnPath = '/dashboard',
): Promise<void> {
  // No-op in desktop build
}

export async function getCustomerPortalUrl(): Promise<string> {
  return ''
}
