/**
 * ArtboardSplitPane Component Tests
 *
 * Tests for the resizable horizontal split pane:
 * - Renders left and right children
 * - Divider is present and focusable
 * - Initial ratio applied via flex-basis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

import { ArtboardSplitPane } from '../ArtboardSplitPane'

describe('ArtboardSplitPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render left and right children', () => {
    render(
      <ArtboardSplitPane
        left={<div data-testid="left-pane">Left content</div>}
        right={<div data-testid="right-pane">Right content</div>}
      />
    )
    expect(screen.getByTestId('left-pane')).toBeInTheDocument()
    expect(screen.getByTestId('right-pane')).toBeInTheDocument()
  })

  it('should render a focusable divider', () => {
    render(
      <ArtboardSplitPane
        left={<div>Left</div>}
        right={<div>Right</div>}
      />
    )
    const divider = screen.getByRole('separator')
    expect(divider).toBeInTheDocument()
    expect(divider).toHaveAttribute('tabindex', '0')
  })

  it('should apply default 50% ratio via flex-basis', () => {
    render(
      <ArtboardSplitPane
        left={<div>Left</div>}
        right={<div>Right</div>}
      />
    )
    const divider = screen.getByRole('separator')
    const leftPane = divider.previousElementSibling as HTMLElement
    const rightPane = divider.nextElementSibling as HTMLElement

    expect(leftPane.style.flexBasis).toBe('50%')
    expect(rightPane.style.flexBasis).toBe('50%')
  })

  it('should apply custom initial ratio via flex-basis', () => {
    render(
      <ArtboardSplitPane
        left={<div>Left</div>}
        right={<div>Right</div>}
        initialRatio={0.3}
      />
    )
    const divider = screen.getByRole('separator')
    const leftPane = divider.previousElementSibling as HTMLElement
    const rightPane = divider.nextElementSibling as HTMLElement

    expect(leftPane.style.flexBasis).toBe('30%')
    expect(rightPane.style.flexBasis).toBe('70%')
  })

  it('should have aria attributes on divider', () => {
    render(
      <ArtboardSplitPane
        left={<div>Left</div>}
        right={<div>Right</div>}
        initialRatio={0.6}
      />
    )
    const divider = screen.getByRole('separator')
    expect(divider).toHaveAttribute('aria-orientation', 'vertical')
    expect(divider).toHaveAttribute('aria-valuenow', '60')
    expect(divider).toHaveAttribute('aria-valuemin', '20')
    expect(divider).toHaveAttribute('aria-valuemax', '80')
    expect(divider).toHaveAttribute('aria-label', 'Resize split pane')
  })

  it('should apply custom className when provided', () => {
    const { container } = render(
      <ArtboardSplitPane
        left={<div>Left</div>}
        right={<div>Right</div>}
        className="my-split"
      />
    )
    const splitPane = container.firstChild as HTMLElement
    expect(splitPane.className).toContain('artboard-split-pane')
    expect(splitPane.className).toContain('my-split')
  })

  it('should have the artboard-split-pane__divider class on divider', () => {
    render(
      <ArtboardSplitPane
        left={<div>Left</div>}
        right={<div>Right</div>}
      />
    )
    const divider = screen.getByRole('separator')
    expect(divider.className).toContain('artboard-split-pane__divider')
  })
})
