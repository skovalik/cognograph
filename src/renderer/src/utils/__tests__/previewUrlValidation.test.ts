import { describe, it, expect } from 'vitest'
import {
  isAllowedPreviewUrl,
  normalizePreviewUrl,
  buildPreviewUrl,
  clampPreviewScale,
  clampRefreshInterval,
  PREVIEW_VIEWPORT_WIDTHS,
} from '../previewUrlValidation'

// =============================================================================
// LP-T11, LP-T12, LP-T13: URL validation
// =============================================================================

describe('isAllowedPreviewUrl', () => {
  // LP-T12: Accept localhost URLs
  it('accepts http://localhost:3000', () => {
    expect(isAllowedPreviewUrl('http://localhost:3000')).toBe(true)
  })

  it('accepts http://localhost:3000/about', () => {
    expect(isAllowedPreviewUrl('http://localhost:3000/about')).toBe(true)
  })

  it('accepts https://localhost:3000 (HTTPS loopback)', () => {
    expect(isAllowedPreviewUrl('https://localhost:3000')).toBe(true)
  })

  it('accepts http://127.0.0.1:5173', () => {
    expect(isAllowedPreviewUrl('http://127.0.0.1:5173')).toBe(true)
  })

  it('accepts http://[::1]:3000 (IPv6 loopback)', () => {
    expect(isAllowedPreviewUrl('http://[::1]:3000')).toBe(true)
  })

  // LP-T11: Reject external URLs
  it('rejects http://evil.com', () => {
    expect(isAllowedPreviewUrl('http://evil.com')).toBe(false)
  })

  it('rejects https://google.com', () => {
    expect(isAllowedPreviewUrl('https://google.com')).toBe(false)
  })

  it('rejects http://example.com:3000', () => {
    expect(isAllowedPreviewUrl('http://example.com:3000')).toBe(false)
  })

  // LP-T13: Reject 0.0.0.0
  it('rejects http://0.0.0.0:3000 (LAN exposure risk)', () => {
    expect(isAllowedPreviewUrl('http://0.0.0.0:3000')).toBe(false)
  })

  // Edge cases
  it('rejects empty string', () => {
    expect(isAllowedPreviewUrl('')).toBe(false)
  })

  it('rejects null/undefined-like values', () => {
    expect(isAllowedPreviewUrl(undefined as unknown as string)).toBe(false)
    expect(isAllowedPreviewUrl(null as unknown as string)).toBe(false)
  })

  it('rejects non-http protocols', () => {
    expect(isAllowedPreviewUrl('ftp://localhost:21')).toBe(false)
    expect(isAllowedPreviewUrl('file:///etc/passwd')).toBe(false)
  })

  // LP-E04: Auto-prepend http:// if missing
  it('accepts localhost:3000 (auto-prepends http://)', () => {
    expect(isAllowedPreviewUrl('localhost:3000')).toBe(true)
  })

  // User-configured allowlist
  it('accepts staging URL when in allowedHosts', () => {
    expect(isAllowedPreviewUrl('http://staging.myapp.com', ['staging.myapp.com'])).toBe(true)
  })

  it('rejects staging URL when NOT in allowedHosts', () => {
    expect(isAllowedPreviewUrl('http://staging.myapp.com')).toBe(false)
  })
})

// =============================================================================
// normalizePreviewUrl
// =============================================================================

describe('normalizePreviewUrl', () => {
  it('prepends http:// if missing', () => {
    expect(normalizePreviewUrl('localhost:3000')).toBe('http://localhost:3000')
  })

  it('preserves existing http://', () => {
    expect(normalizePreviewUrl('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('preserves existing https://', () => {
    expect(normalizePreviewUrl('https://localhost:3000')).toBe('https://localhost:3000')
  })

  it('returns null for empty string', () => {
    expect(normalizePreviewUrl('')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(normalizePreviewUrl(null as unknown as string)).toBeNull()
  })
})

// =============================================================================
// LP-T02: buildPreviewUrl
// =============================================================================

describe('buildPreviewUrl', () => {
  it('returns base URL when no path provided', () => {
    const result = buildPreviewUrl('http://localhost:3000')
    expect(result).toBe('http://localhost:3000')
  })

  it('appends path to base URL', () => {
    const result = buildPreviewUrl('http://localhost:3000', '/about')
    expect(result).toBe('http://localhost:3000/about')
  })

  it('handles path without leading slash', () => {
    const result = buildPreviewUrl('http://localhost:3000', 'about')
    expect(result).toBe('http://localhost:3000/about')
  })

  it('returns null for invalid base URL', () => {
    expect(buildPreviewUrl('')).toBeNull()
  })

  it('handles just "/" path', () => {
    const result = buildPreviewUrl('http://localhost:3000', '/')
    expect(result).toBe('http://localhost:3000')
  })
})

// =============================================================================
// LP-T06, LP-E05: clampPreviewScale
// =============================================================================

describe('clampPreviewScale', () => {
  it('clamps below-minimum value to 0.5', () => {
    expect(clampPreviewScale(0.3)).toBe(0.5)
  })

  it('clamps above-maximum value to 1.0', () => {
    expect(clampPreviewScale(1.5)).toBe(1.0)
  })

  it('returns 1.0 for NaN', () => {
    expect(clampPreviewScale(NaN)).toBe(1.0)
  })

  it('returns 1.0 for undefined', () => {
    expect(clampPreviewScale(undefined)).toBe(1.0)
  })

  it('passes through valid values', () => {
    expect(clampPreviewScale(0.75)).toBe(0.75)
  })

  it('accepts exact boundary values', () => {
    expect(clampPreviewScale(0.5)).toBe(0.5)
    expect(clampPreviewScale(1.0)).toBe(1.0)
  })
})

// =============================================================================
// LP-E06: clampRefreshInterval
// =============================================================================

describe('clampRefreshInterval', () => {
  it('returns 0 for 0 (disabled)', () => {
    expect(clampRefreshInterval(0)).toBe(0)
  })

  it('returns 0 for negative values', () => {
    expect(clampRefreshInterval(-100)).toBe(0)
  })

  it('clamps 10ms to 1000ms', () => {
    expect(clampRefreshInterval(10)).toBe(1000)
  })

  it('clamps 500ms to 1000ms', () => {
    expect(clampRefreshInterval(500)).toBe(1000)
  })

  it('passes through 2000ms', () => {
    expect(clampRefreshInterval(2000)).toBe(2000)
  })

  it('returns 0 for NaN', () => {
    expect(clampRefreshInterval(NaN)).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(clampRefreshInterval(undefined)).toBe(0)
  })
})

// =============================================================================
// PREVIEW_VIEWPORT_WIDTHS constant
// =============================================================================

describe('PREVIEW_VIEWPORT_WIDTHS', () => {
  it('has correct mobile width', () => {
    expect(PREVIEW_VIEWPORT_WIDTHS.mobile).toBe(375)
  })

  it('has correct tablet width', () => {
    expect(PREVIEW_VIEWPORT_WIDTHS.tablet).toBe(768)
  })

  it('has correct desktop width', () => {
    expect(PREVIEW_VIEWPORT_WIDTHS.desktop).toBe(1024)
  })
})
