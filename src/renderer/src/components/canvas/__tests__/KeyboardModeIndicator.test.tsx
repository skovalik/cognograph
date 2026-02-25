/**
 * KeyboardModeIndicator Tests
 *
 * PFD Phase 5B: Canvas Interaction Patterns
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { KeyboardModeIndicator } from '../KeyboardModeIndicator'

describe('KeyboardModeIndicator', () => {
  it('exports and is memoized', () => {
    expect(KeyboardModeIndicator).toBeDefined()
    // React.memo wraps the component — check for the $$typeof or type property
    // memo components have a compare property or the type is the wrapped component
    expect(typeof KeyboardModeIndicator).toBe('object') // memo returns an object, not a function
    expect((KeyboardModeIndicator as { $$typeof?: symbol }).$$typeof).toBeDefined()
  })

  it('renders with role="status"', () => {
    render(<KeyboardModeIndicator />)
    const el = screen.getByRole('status')
    expect(el).toBeDefined()
  })

  it('has aria-live="polite"', () => {
    render(<KeyboardModeIndicator />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-live')).toBe('polite')
  })

  it('default mode is "Navigate"', () => {
    render(<KeyboardModeIndicator />)
    const el = screen.getByRole('status')
    expect(el.textContent).toContain('Navigate')
  })
})
