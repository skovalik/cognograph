// =============================================================================
// previewUrlValidation.ts -- URL validation for ArtifactNode live preview
//
// Enforces localhost-only policy for preview iframes. External URLs are blocked
// unless explicitly allowlisted in workspace preferences.
// Defense in depth: renderer-side validation + main process webRequest filter.
// =============================================================================

/** Allowed loopback hostnames for preview iframes */
const ALLOWED_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** Explicitly blocked hosts (bind-all interfaces = LAN exposure risk) */
const BLOCKED_HOSTS = new Set(['0.0.0.0'])

/**
 * Validates whether a URL is allowed for preview iframe rendering.
 *
 * Allowed: localhost, 127.0.0.1, [::1] (any port), plus user-configured staging URLs.
 * Blocked: 0.0.0.0, all external URLs unless allowlisted.
 *
 * @param url - The URL string to validate
 * @param allowedHosts - Optional additional hosts from workspace preferences
 * @returns true if the URL is safe for preview rendering
 */
export function isAllowedPreviewUrl(url: string, allowedHosts: string[] = []): boolean {
  if (!url || typeof url !== 'string') return false

  // Auto-prepend http:// if no protocol (LP-E04)
  let normalizedUrl = url.trim()
  if (!normalizedUrl.match(/^https?:\/\//i)) {
    normalizedUrl = `http://${normalizedUrl}`
  }

  try {
    const parsed = new URL(normalizedUrl)

    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    const hostname = parsed.hostname

    // Explicitly block dangerous hosts
    if (BLOCKED_HOSTS.has(hostname)) {
      return false
    }

    // Allow loopback addresses
    if (ALLOWED_LOOPBACK_HOSTS.has(hostname)) {
      return true
    }

    // Allow user-configured staging URLs
    if (allowedHosts.length > 0 && allowedHosts.includes(hostname)) {
      return true
    }

    return false
  } catch {
    // Invalid URL
    return false
  }
}

/**
 * Normalizes a preview URL by prepending http:// if missing.
 * Returns the normalized URL string, or null if the URL is fundamentally invalid.
 */
export function normalizePreviewUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null

  let normalized = url.trim()
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = `http://${normalized}`
  }

  try {
    new URL(normalized)
    return normalized
  } catch {
    return null
  }
}

/**
 * Builds the full preview URL from base URL and optional path.
 * Handles path concatenation safely.
 */
export function buildPreviewUrl(baseUrl: string, path?: string): string | null {
  const normalized = normalizePreviewUrl(baseUrl)
  if (!normalized) return null

  if (!path || path === '/') return normalized

  try {
    const url = new URL(normalized)
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    url.pathname = cleanPath
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Clamps scale value to valid range [0.5, 1.0].
 * NaN defaults to 1.0. (LP-E05)
 */
export function clampPreviewScale(scale: number | undefined): number {
  const value = Number(scale)
  if (isNaN(value)) return 1.0
  return Math.max(0.5, Math.min(1.0, value))
}

/**
 * Clamps refresh interval. Minimum 1000ms, 0 disables. (LP-E06)
 */
export function clampRefreshInterval(interval: number | undefined): number {
  const value = Number(interval)
  if (isNaN(value) || value <= 0) return 0
  return Math.max(1000, value)
}

/** Viewport width presets in pixels */
export const PREVIEW_VIEWPORT_WIDTHS = {
  mobile: 375,
  tablet: 768,
  desktop: 1024,
} as const
