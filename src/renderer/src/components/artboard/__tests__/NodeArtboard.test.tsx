/**
 * NodeArtboard Component Tests
 *
 * Tests for the shared artboard wrapper:
 * - Module exports and memoization
 * - Header rendering (title, icon, close button)
 * - Accessibility attributes (role, aria-label)
 * - Store integration (close exits artboard)
 * - CSS custom property for node accent color
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock @xyflow/react
vi.mock('@xyflow/react', () => ({
  useViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1.2 })),
  useReactFlow: vi.fn(() => ({
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1.2 }))
  }))
}))

// Mock workspace store
const mockCollapseInPlaceExpansion = vi.fn()
vi.mock('../../../stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      inPlaceExpandedNodeId: 'test-node-1',
      collapseInPlaceExpansion: mockCollapseInPlaceExpansion
    })
  )
}))

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

import { NodeArtboard } from '../NodeArtboard'

describe('NodeArtboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export a defined component', () => {
    expect(NodeArtboard).toBeDefined()
  })

  it('should be a memoized component', () => {
    // React.memo wraps the component — the result is an object with $$typeof
    expect(typeof NodeArtboard).toBe('object')
    expect((NodeArtboard as { $$typeof?: symbol }).$$typeof).toBeDefined()
  })

  it('should render header with title', () => {
    render(
      <NodeArtboard nodeId="test-1" nodeColor="#6366f1" title="Test Note">
        <div>Body content</div>
      </NodeArtboard>
    )
    expect(screen.getByText('Test Note')).toBeInTheDocument()
  })

  it('should render header with icon when provided', () => {
    render(
      <NodeArtboard
        nodeId="test-1"
        nodeColor="#6366f1"
        title="Test Note"
        icon={<span data-testid="test-icon">IC</span>}
      >
        <div>Body content</div>
      </NodeArtboard>
    )
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
  })

  it('should render children in body', () => {
    render(
      <NodeArtboard nodeId="test-1" nodeColor="#6366f1" title="Test Note">
        <div data-testid="body-content">Body content</div>
      </NodeArtboard>
    )
    expect(screen.getByTestId('body-content')).toBeInTheDocument()
  })

  it('should have role="dialog" and aria-label', () => {
    render(
      <NodeArtboard nodeId="test-1" nodeColor="#6366f1" title="Test Note">
        <div>Body</div>
      </NodeArtboard>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-label', 'Artboard: Test Note')
  })

  it('should call collapseInPlaceExpansion when close button is clicked', () => {
    render(
      <NodeArtboard nodeId="test-1" nodeColor="#6366f1" title="Test Note">
        <div>Body</div>
      </NodeArtboard>
    )
    const closeButton = screen.getByLabelText('Close artboard')
    fireEvent.click(closeButton)
    expect(mockCollapseInPlaceExpansion).toHaveBeenCalledTimes(1)
  })

  it('should apply node accent color as CSS variable', () => {
    render(
      <NodeArtboard nodeId="test-1" nodeColor="#ff5733" title="Colored Note">
        <div>Body</div>
      </NodeArtboard>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.getPropertyValue('--node-accent')).toBe('#ff5733')
  })

  it('should apply custom className when provided', () => {
    render(
      <NodeArtboard
        nodeId="test-1"
        nodeColor="#6366f1"
        title="Test"
        className="custom-class"
      >
        <div>Body</div>
      </NodeArtboard>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('custom-class')
    expect(dialog.className).toContain('node-artboard')
  })
})
