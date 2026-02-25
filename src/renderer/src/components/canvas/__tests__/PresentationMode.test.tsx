import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PresentationMode } from '../PresentationMode'
import { useSpatialRegionStore } from '../../../stores/spatialRegionStore'
import type { SpatialRegion } from '@shared/actionTypes'

const mockFitBounds = vi.fn()

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    fitBounds: mockFitBounds,
    fitView: vi.fn(),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    setViewport: vi.fn()
  })
}))

function createTestRegion(overrides: Partial<SpatialRegion> & { id: string; name: string }): SpatialRegion {
  return {
    bounds: { x: 0, y: 0, width: 400, height: 300 },
    ...overrides
  }
}

function seedRegions(regions: SpatialRegion[]): void {
  useSpatialRegionStore.setState({ regions })
}

describe('PresentationMode', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useSpatialRegionStore.setState({ regions: [], nodeRegionMembership: {} })
  })

  afterEach(() => {
    useSpatialRegionStore.setState({ regions: [], nodeRegionMembership: {} })
  })

  it('renders nothing when inactive', () => {
    const { container } = render(
      <PresentationMode isActive={false} onClose={mockOnClose} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders with slide counter when active', () => {
    seedRegions([
      createTestRegion({ id: 'r1', name: 'Intro', bounds: { x: 0, y: 0, width: 400, height: 300 } }),
      createTestRegion({ id: 'r2', name: 'Methods', bounds: { x: 500, y: 0, width: 400, height: 300 } }),
      createTestRegion({ id: 'r3', name: 'Results', bounds: { x: 1000, y: 0, width: 400, height: 300 } })
    ])

    render(<PresentationMode isActive={true} onClose={mockOnClose} />)

    expect(screen.getByTestId('presentation-mode')).toBeInTheDocument()
    expect(screen.getByTestId('slide-counter')).toHaveTextContent('1 of 3')
    expect(screen.getByTestId('slide-name')).toHaveTextContent('Intro')
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Presentation mode')
  })

  it('fits viewport to first region on activation', () => {
    seedRegions([
      createTestRegion({ id: 'r1', name: 'Slide 1', bounds: { x: 100, y: 200, width: 500, height: 400 } })
    ])

    render(<PresentationMode isActive={true} onClose={mockOnClose} />)

    expect(mockFitBounds).toHaveBeenCalledWith(
      { x: 100, y: 200, width: 500, height: 400 },
      { duration: 300, padding: 0.1 }
    )
  })

  it('navigates forward with right arrow key', () => {
    seedRegions([
      createTestRegion({ id: 'r1', name: 'First', bounds: { x: 0, y: 0, width: 400, height: 300 } }),
      createTestRegion({ id: 'r2', name: 'Second', bounds: { x: 500, y: 0, width: 400, height: 300 } })
    ])

    render(<PresentationMode isActive={true} onClose={mockOnClose} />)

    expect(screen.getByTestId('slide-name')).toHaveTextContent('First')

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })

    expect(screen.getByTestId('slide-name')).toHaveTextContent('Second')
    expect(screen.getByTestId('slide-counter')).toHaveTextContent('2 of 2')
  })

  it('navigates backward with left arrow key', () => {
    seedRegions([
      createTestRegion({ id: 'r1', name: 'First', bounds: { x: 0, y: 0, width: 400, height: 300 } }),
      createTestRegion({ id: 'r2', name: 'Second', bounds: { x: 500, y: 0, width: 400, height: 300 } })
    ])

    render(<PresentationMode isActive={true} onClose={mockOnClose} />)

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(screen.getByTestId('slide-name')).toHaveTextContent('Second')

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
    })
    expect(screen.getByTestId('slide-name')).toHaveTextContent('First')
    expect(screen.getByTestId('slide-counter')).toHaveTextContent('1 of 2')
  })

  it('does not navigate past boundaries', () => {
    seedRegions([
      createTestRegion({ id: 'r1', name: 'Only', bounds: { x: 0, y: 0, width: 400, height: 300 } })
    ])

    render(<PresentationMode isActive={true} onClose={mockOnClose} />)

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
    })
    expect(screen.getByTestId('slide-counter')).toHaveTextContent('1 of 1')

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(screen.getByTestId('slide-counter')).toHaveTextContent('1 of 1')
  })

  it('closes on ESC key', () => {
    seedRegions([
      createTestRegion({ id: 'r1', name: 'Slide', bounds: { x: 0, y: 0, width: 400, height: 300 } })
    ])

    render(<PresentationMode isActive={true} onClose={mockOnClose} />)

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('closes via exit button click', () => {
    seedRegions([
      createTestRegion({ id: 'r1', name: 'Slide', bounds: { x: 0, y: 0, width: 400, height: 300 } })
    ])

    render(<PresentationMode isActive={true} onClose={mockOnClose} />)

    fireEvent.click(screen.getByTestId('presentation-exit'))
    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('excludes districts from presentation slides', () => {
    seedRegions([
      createTestRegion({ id: 'r1', name: 'Slide', bounds: { x: 0, y: 0, width: 400, height: 300 } }),
      createTestRegion({ id: 'd1', name: 'District', bounds: { x: 500, y: 0, width: 400, height: 300 }, isDistrict: true })
    ])

    render(<PresentationMode isActive={true} onClose={mockOnClose} />)

    expect(screen.getByTestId('slide-counter')).toHaveTextContent('1 of 1')
    expect(screen.getByTestId('slide-name')).toHaveTextContent('Slide')
  })

  it('shows no-regions message when there are no presentable regions', () => {
    render(<PresentationMode isActive={true} onClose={mockOnClose} />)
    expect(screen.getByText('No regions defined')).toBeInTheDocument()
  })

  it('respects presentationOrder for slide ordering', () => {
    seedRegions([
      createTestRegion({ id: 'r1', name: 'Third', bounds: { x: 0, y: 0, width: 400, height: 300 }, presentationOrder: 3 }),
      createTestRegion({ id: 'r2', name: 'First', bounds: { x: 500, y: 0, width: 400, height: 300 }, presentationOrder: 1 }),
      createTestRegion({ id: 'r3', name: 'Second', bounds: { x: 1000, y: 0, width: 400, height: 300 }, presentationOrder: 2 })
    ])

    render(<PresentationMode isActive={true} onClose={mockOnClose} />)

    expect(screen.getByTestId('slide-name')).toHaveTextContent('First')

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(screen.getByTestId('slide-name')).toHaveTextContent('Second')

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(screen.getByTestId('slide-name')).toHaveTextContent('Third')
  })
})
