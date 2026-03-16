export async function createCheckoutSession(): Promise<void> {
  console.warn('[Cognograph] Billing not available in open-source build')
}

export async function getCustomerPortalUrl(): Promise<string> {
  return ''
}
