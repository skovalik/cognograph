import React, { memo, useState, useCallback, useRef, useEffect } from 'react'

interface ArtboardSplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
  initialRatio?: number // 0.0-1.0, default 0.5
  onRatioChange?: (ratio: number) => void
  minRatio?: number // default 0.2
  maxRatio?: number // default 0.8
  className?: string
}

/**
 * ArtboardSplitPane - Resizable horizontal split pane for artboard layouts.
 *
 * Provides a draggable divider between left and right content areas.
 * Uses requestAnimationFrame for smooth drag performance.
 * Divider is keyboard-accessible: focus with Tab, adjust with arrow keys.
 */
export const ArtboardSplitPane = memo(function ArtboardSplitPane({
  left,
  right,
  initialRatio = 0.5,
  onRatioChange,
  minRatio = 0.2,
  maxRatio = 0.8,
  className
}: ArtboardSplitPaneProps): React.JSX.Element {
  const [ratio, setRatio] = useState(initialRatio)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  const clampRatio = useCallback(
    (value: number): number => {
      return Math.min(maxRatio, Math.max(minRatio, value))
    },
    [minRatio, maxRatio]
  )

  const updateRatio = useCallback(
    (newRatio: number) => {
      const clamped = clampRatio(newRatio)
      setRatio(clamped)
      onRatioChange?.(clamped)
    },
    [clampRatio, onRatioChange]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDraggingRef.current = true

      const container = containerRef.current
      if (!container) return

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        if (!isDraggingRef.current) return

        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
        }

        rafRef.current = requestAnimationFrame(() => {
          const rect = container.getBoundingClientRect()
          const x = moveEvent.clientX - rect.left
          const newRatio = x / rect.width
          updateRatio(newRatio)
        })
      }

      const handleMouseUp = (): void => {
        isDraggingRef.current = false
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [updateRatio]
  )

  // Keyboard accessibility: arrow keys adjust ratio by 5%
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = 0.05
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        updateRatio(ratio - step)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        updateRatio(ratio + step)
      }
    },
    [ratio, updateRatio]
  )

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const leftPercent = `${ratio * 100}%`
  const rightPercent = `${(1 - ratio) * 100}%`

  return (
    <div
      ref={containerRef}
      className={`artboard-split-pane ${className ?? ''}`}
    >
      <div
        className="artboard-split-pane__left"
        style={{ flexBasis: leftPercent, flexGrow: 0, flexShrink: 0 }}
      >
        {left}
      </div>
      <div
        className="artboard-split-pane__divider"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        aria-label="Resize split pane"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
      />
      <div
        className="artboard-split-pane__right"
        style={{ flexBasis: rightPercent, flexGrow: 0, flexShrink: 0 }}
      >
        {right}
      </div>
    </div>
  )
})

export type { ArtboardSplitPaneProps }
