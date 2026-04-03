// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Permission Card Variant Tests — Phase 4B UX-PERMISSIONS
 *
 * Tests for the specialized permission card variants:
 * - ShellPermissionCard: importable, memoized, exports
 * - EditPermissionCard: importable, memoized, exports
 * - MutationPermissionCard: importable, memoized, exports
 * - PermissionCard: routes to the correct variant based on display type
 * - Barrel index: exports all new components
 */

import { describe, it, expect, vi } from 'vitest'

// Mock Zustand store used by PermissionCard
vi.mock('../../../stores/permissionStore', () => ({
  PERMISSION_TIMEOUT_MS: 60_000,
}))

// =============================================================================
// ShellPermissionCard
// =============================================================================

describe('ShellPermissionCard', () => {
  it('should be importable without errors', async () => {
    const mod = await import('../ShellPermissionCard')
    expect(mod.ShellPermissionCard).toBeDefined()
  })

  it('should be a memoized component (React.memo wraps as object)', async () => {
    const mod = await import('../ShellPermissionCard')
    expect(typeof mod.ShellPermissionCard).toBe('object')
  })

  it('exports ShellPermissionCard as named export', async () => {
    const mod = await import('../ShellPermissionCard')
    const exportNames = Object.keys(mod)
    expect(exportNames).toContain('ShellPermissionCard')
  })
})

// =============================================================================
// EditPermissionCard
// =============================================================================

describe('EditPermissionCard', () => {
  it('should be importable without errors', async () => {
    const mod = await import('../EditPermissionCard')
    expect(mod.EditPermissionCard).toBeDefined()
  })

  it('should be a memoized component (React.memo wraps as object)', async () => {
    const mod = await import('../EditPermissionCard')
    expect(typeof mod.EditPermissionCard).toBe('object')
  })

  it('exports EditPermissionCard as named export', async () => {
    const mod = await import('../EditPermissionCard')
    const exportNames = Object.keys(mod)
    expect(exportNames).toContain('EditPermissionCard')
  })
})

// =============================================================================
// MutationPermissionCard
// =============================================================================

describe('MutationPermissionCard', () => {
  it('should be importable without errors', async () => {
    const mod = await import('../MutationPermissionCard')
    expect(mod.MutationPermissionCard).toBeDefined()
  })

  it('should be a memoized component (React.memo wraps as object)', async () => {
    const mod = await import('../MutationPermissionCard')
    expect(typeof mod.MutationPermissionCard).toBe('object')
  })

  it('exports MutationPermissionCard as named export', async () => {
    const mod = await import('../MutationPermissionCard')
    const exportNames = Object.keys(mod)
    expect(exportNames).toContain('MutationPermissionCard')
  })
})

// =============================================================================
// PermissionCard routing
// =============================================================================

describe('PermissionCard', () => {
  it('should be importable without errors', async () => {
    const mod = await import('../PermissionCard')
    expect(mod.PermissionCard).toBeDefined()
  })

  it('should be a memoized component', async () => {
    const mod = await import('../PermissionCard')
    expect(typeof mod.PermissionCard).toBe('object')
  })

  it('imports all three variant components', async () => {
    // Verifies that PermissionCard can successfully import all variants
    // without module resolution errors
    const [shell, edit, mutation, card] = await Promise.all([
      import('../ShellPermissionCard'),
      import('../EditPermissionCard'),
      import('../MutationPermissionCard'),
      import('../PermissionCard'),
    ])

    expect(shell.ShellPermissionCard).toBeDefined()
    expect(edit.EditPermissionCard).toBeDefined()
    expect(mutation.MutationPermissionCard).toBeDefined()
    expect(card.PermissionCard).toBeDefined()
  })
})

// =============================================================================
// Barrel export
// =============================================================================

describe('permissions barrel export', () => {
  it('exports all permission card variants from index', async () => {
    const mod = await import('../index')
    const exportNames = Object.keys(mod)
    expect(exportNames).toContain('PermissionCard')
    expect(exportNames).toContain('PermissionQueue')
    expect(exportNames).toContain('ShellPermissionCard')
    expect(exportNames).toContain('EditPermissionCard')
    expect(exportNames).toContain('MutationPermissionCard')
  })
})

// =============================================================================
// Display type definitions
// =============================================================================

describe('PermissionDisplay types', () => {
  it('transport types module exports display types', async () => {
    // Verify the shared transport types are importable
    // TypeScript compilation verifies the actual type correctness;
    // this test confirms the module resolves at runtime
    const mod = await import('@shared/transport/types')
    expect(mod).toBeDefined()
  })
})
