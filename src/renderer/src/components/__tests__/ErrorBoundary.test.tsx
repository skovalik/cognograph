// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * ErrorBoundary Component Tests — Phase 4A: UX-ERRORS
 *
 * Tests:
 * - Module exports (ErrorBoundary, InlineErrorBoundary, withErrorBoundary)
 * - Class component structure (getDerivedStateFromError, componentDidCatch)
 * - HOC wrapper produces valid component
 * - Error recovery behavior (state management)
 */

import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// =============================================================================
// Mock Sentry before importing ErrorBoundary
// =============================================================================

vi.mock('../../services/sentry', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

// =============================================================================
// Tests
// =============================================================================

describe('ErrorBoundary', () => {
  it('should export ErrorBoundary as a named export', async () => {
    const mod = await import('../ErrorBoundary')
    expect(mod.ErrorBoundary).toBeDefined()
  })

  it('should export InlineErrorBoundary as a named export', async () => {
    const mod = await import('../ErrorBoundary')
    expect(mod.InlineErrorBoundary).toBeDefined()
  })

  it('should export withErrorBoundary HOC', async () => {
    const mod = await import('../ErrorBoundary')
    expect(mod.withErrorBoundary).toBeDefined()
    expect(typeof mod.withErrorBoundary).toBe('function')
  })

  it('should export ErrorBoundary as default export', async () => {
    const mod = await import('../ErrorBoundary')
    expect(mod.default).toBeDefined()
    expect(mod.default).toBe(mod.ErrorBoundary)
  })

  it('ErrorBoundary is a class component (has prototype.render)', async () => {
    const mod = await import('../ErrorBoundary')
    expect(typeof mod.ErrorBoundary.prototype.render).toBe('function')
  })

  it('ErrorBoundary has static getDerivedStateFromError', async () => {
    const mod = await import('../ErrorBoundary')
    expect(typeof mod.ErrorBoundary.getDerivedStateFromError).toBe('function')
  })

  it('getDerivedStateFromError returns hasError: true', async () => {
    const mod = await import('../ErrorBoundary')
    const result = mod.ErrorBoundary.getDerivedStateFromError(new Error('test'))
    expect(result).toEqual(expect.objectContaining({ hasError: true }))
  })

  it('ErrorBoundary has componentDidCatch method', async () => {
    const mod = await import('../ErrorBoundary')
    expect(typeof mod.ErrorBoundary.prototype.componentDidCatch).toBe('function')
  })

  it('InlineErrorBoundary is a class component (has prototype.render)', async () => {
    const mod = await import('../ErrorBoundary')
    expect(typeof mod.InlineErrorBoundary.prototype.render).toBe('function')
  })

  it('InlineErrorBoundary has static getDerivedStateFromError', async () => {
    const mod = await import('../ErrorBoundary')
    expect(typeof mod.InlineErrorBoundary.getDerivedStateFromError).toBe('function')
  })
})

describe('withErrorBoundary HOC', () => {
  it('wraps a component and returns a function component', async () => {
    const mod = await import('../ErrorBoundary')
    const Inner = () => React.createElement('div', null, 'test')
    Inner.displayName = 'Inner'
    const Wrapped = mod.withErrorBoundary(Inner, { componentName: 'TestInner' })
    expect(typeof Wrapped).toBe('function')
  })

  it('sets displayName on the wrapped component', async () => {
    const mod = await import('../ErrorBoundary')
    function MyComponent(): JSX.Element {
      return React.createElement('div')
    }
    const Wrapped = mod.withErrorBoundary(MyComponent)
    expect(Wrapped.displayName).toBe('withErrorBoundary(MyComponent)')
  })
})
