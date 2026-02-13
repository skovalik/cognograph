/**
 * SelectionIndicators — Shows which users have a node selected.
 *
 * Renders colored rings around nodes that other users have selected.
 * Used inside individual node components.
 */

import { memo } from 'react'

interface SelectionIndicatorProps {
  /** Users who have this node selected */
  selectors: Array<{
    userId: string
    userName: string
    color: string
  }>
}

/**
 * Renders a colored border indicator showing remote users' selections.
 * Should be placed as the outermost wrapper inside a node component.
 */
export const SelectionIndicator = memo(function SelectionIndicator({
  selectors
}: SelectionIndicatorProps) {
  if (selectors.length === 0) return null

  // Use the first selector's color for the ring, show count if multiple
  const primaryColor = selectors[0]!.color
  const count = selectors.length

  return (
    <>
      {/* Glowing ring */}
      <div
        className="absolute -inset-1 rounded-lg pointer-events-none z-0"
        style={{
          border: `2px solid ${primaryColor}`,
          boxShadow: `0 0 8px ${primaryColor}40`,
          opacity: 0.8
        }}
      />

      {/* User badge(s) */}
      <div className="absolute -top-3 -right-1 flex gap-0.5 pointer-events-none z-10">
        {selectors.slice(0, 3).map((selector) => (
          <div
            key={selector.userId}
            className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shadow-sm"
            style={{ backgroundColor: selector.color }}
            title={selector.userName}
          >
            {(selector.userName[0] || '?').toUpperCase()}
          </div>
        ))}
        {count > 3 && (
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white bg-[var(--surface-panel-secondary)] shadow-sm">
            +{count - 3}
          </div>
        )}
      </div>
    </>
  )
})
