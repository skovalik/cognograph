/**
 * ArtboardTabBar Component Tests
 *
 * Tests for the artboard tab navigation bar:
 * - Renders all provided tabs
 * - Active tab has correct class
 * - Tab click triggers onTabChange callback
 * - Accessibility: role="tablist", tabs have role="tab"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

import { ArtboardTabBar } from '../ArtboardTabBar'
import type { ArtboardTab } from '../ArtboardTabBar'

const mockTabs: ArtboardTab[] = [
  { id: 'content', label: 'Content' },
  { id: 'properties', label: 'Properties' },
  { id: 'history', label: 'History' }
]

describe('ArtboardTabBar', () => {
  const mockOnTabChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render all tabs', () => {
    render(
      <ArtboardTabBar
        tabs={mockTabs}
        activeTabId="content"
        onTabChange={mockOnTabChange}
        nodeColor="#6366f1"
      />
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByText('Properties')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
  })

  it('should mark active tab with active class', () => {
    render(
      <ArtboardTabBar
        tabs={mockTabs}
        activeTabId="properties"
        onTabChange={mockOnTabChange}
        nodeColor="#6366f1"
      />
    )
    const activeTab = screen.getByText('Properties').closest('button')
    expect(activeTab?.className).toContain('artboard-tab--active')

    const inactiveTab = screen.getByText('Content').closest('button')
    expect(inactiveTab?.className).not.toContain('artboard-tab--active')
  })

  it('should call onTabChange when a tab is clicked', () => {
    render(
      <ArtboardTabBar
        tabs={mockTabs}
        activeTabId="content"
        onTabChange={mockOnTabChange}
        nodeColor="#6366f1"
      />
    )
    fireEvent.click(screen.getByText('Properties'))
    expect(mockOnTabChange).toHaveBeenCalledWith('properties')
  })

  it('should have role="tablist" on container', () => {
    render(
      <ArtboardTabBar
        tabs={mockTabs}
        activeTabId="content"
        onTabChange={mockOnTabChange}
        nodeColor="#6366f1"
      />
    )
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('should have role="tab" on each tab button', () => {
    render(
      <ArtboardTabBar
        tabs={mockTabs}
        activeTabId="content"
        onTabChange={mockOnTabChange}
        nodeColor="#6366f1"
      />
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
  })

  it('should set aria-selected correctly on tabs', () => {
    render(
      <ArtboardTabBar
        tabs={mockTabs}
        activeTabId="history"
        onTabChange={mockOnTabChange}
        nodeColor="#6366f1"
      />
    )
    const tabs = screen.getAllByRole('tab')
    // Content tab
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
    // Properties tab
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
    // History tab (active)
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('should render tab icons when provided', () => {
    const tabsWithIcons: ArtboardTab[] = [
      { id: 'content', label: 'Content', icon: <span data-testid="icon-content">C</span> },
      { id: 'props', label: 'Props' }
    ]
    render(
      <ArtboardTabBar
        tabs={tabsWithIcons}
        activeTabId="content"
        onTabChange={mockOnTabChange}
        nodeColor="#6366f1"
      />
    )
    expect(screen.getByTestId('icon-content')).toBeInTheDocument()
  })
})
