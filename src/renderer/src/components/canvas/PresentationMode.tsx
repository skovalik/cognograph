// PresentationMode — PFD Phase 5C: Region-Based Presentation Mode
// Turns named spatial regions into "slides" and iterates through them,
// fitting each region to the viewport with animated transitions.
//
// Activation: Ctrl+Shift+P or store toggle
// Navigation: Left/Right arrow keys, click arrows
// Exit: ESC key
//
// Slide ordering:
//   1. If any region has presentationOrder set, sort by that (ascending)
//   2. Otherwise, sort by x-position (left to right)

import { memo, useCallback, useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useSpatialRegionStore } from '../../stores/spatialRegionStore'
import type { SpatialRegion } from '@shared/actionTypes'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationModeProps {
  /** Whether presentation mode is active */
  isActive: boolean
  /** Callback to close/deactivate presentation mode */
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PresentationModeComponent({ isActive, onClose }: PresentationModeProps): JSX.Element | null {
  const { fitBounds } = useReactFlow()
  const getRegionsForPresentation = useSpatialRegionStore((s) => s.getRegionsForPresentation)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [slides, setSlides] = useState<SpatialRegion[]>([])

  // Refresh slides when presentation mode activates
  useEffect(() => {
    if (isActive) {
      const presentableRegions = getRegionsForPresentation()
      setSlides(presentableRegions)
      setCurrentIndex(0)
    }
  }, [isActive, getRegionsForPresentation])

  // Fit viewport to the current slide region
  const fitToSlide = useCallback(
    (index: number) => {
      const slide = slides[index]
      if (!slide) return

      fitBounds(
        {
          x: slide.bounds.x,
          y: slide.bounds.y,
          width: slide.bounds.width,
          height: slide.bounds.height
        },
        { duration: 300, padding: 0.1 }
      )
    },
    [slides, fitBounds]
  )

  // Fit to first slide on activation
  useEffect(() => {
    if (isActive && slides.length > 0) {
      fitToSlide(0)
    }
  }, [isActive, slides, fitToSlide])

  // Navigate to previous slide
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.max(0, prev - 1)
      fitToSlide(next)
      return next
    })
  }, [fitToSlide])

  // Navigate to next slide
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(slides.length - 1, prev + 1)
      fitToSlide(next)
      return next
    })
  }, [slides.length, fitToSlide])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          onClose()
          break
        case 'ArrowLeft':
          e.preventDefault()
          goToPrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNext()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isActive, onClose, goToPrevious, goToNext])

  // Don't render when inactive
  if (!isActive) return null

  const currentSlide = slides[currentIndex]
  const hasSlides = slides.length > 0

  return (
    <div
      role="dialog"
      aria-label="Presentation mode"
      className="fixed inset-0 z-[9999] pointer-events-none"
      data-testid="presentation-mode"
    >
      {/* Semi-transparent vignette at edges for focus */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)'
        }}
      />

      {/* Bottom HUD bar */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-xl"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          minWidth: '240px',
          justifyContent: 'center'
        }}
        data-testid="presentation-hud"
      >
        {/* Previous arrow */}
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          aria-label="Previous slide"
          className="p-1 rounded hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Slide info */}
        <div className="flex flex-col items-center min-w-[140px]">
          {hasSlides ? (
            <>
              <span className="text-white/90 truncate max-w-[200px]" data-testid="slide-name">
                {currentSlide?.name ?? 'Untitled'}
              </span>
              <span className="text-white/50 text-xs" data-testid="slide-counter">
                {currentIndex + 1} of {slides.length}
              </span>
            </>
          ) : (
            <span className="text-white/50 text-sm">No regions defined</span>
          )}
        </div>

        {/* Next arrow */}
        <button
          onClick={goToNext}
          disabled={currentIndex >= slides.length - 1}
          aria-label="Next slide"
          className="p-1 rounded hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-white/20 mx-1" />

        {/* Exit button */}
        <button
          onClick={onClose}
          aria-label="Exit presentation mode"
          className="p-1 rounded hover:bg-white/20 transition-colors text-white/60 hover:text-white/90"
          data-testid="presentation-exit"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Keyboard hint (visible briefly) */}
      <div
        className="absolute top-4 right-4 text-white/40 text-xs pointer-events-none"
        style={{
          animation: 'fadeOut 3s ease-in forwards'
        }}
      >
        ESC to exit &middot; Arrow keys to navigate
      </div>

      <style>{`
        @keyframes fadeOut {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export const PresentationMode = memo(PresentationModeComponent)
