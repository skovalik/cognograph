// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * SpreadHandles — Multiple connection handles per side, spread along the edge.
 *
 * Handles scale with node size: small nodes show fewer handles, large nodes show more.
 * ALL 48 handles are always in the DOM (backward compat for existing edges).
 * Visibility is toggled via opacity/pointer-events so hidden handles still work
 * as edge targets for existing connections.
 *
 * Per-edge thresholds use the dimension parallel to that edge:
 *   Top/Bottom → node width    Left/Right → node height
 *   <200px: center only | 200-400: +2 | 400-600: +3 | 600+: all 4
 */

import { Handle, Position } from '@xyflow/react'
import { memo, useMemo } from 'react'

/** Always render handles at these fixed positions for backward compat */
const ALL_POSITIONS = [15, 35, 65, 85]

function getSpreadCount(dimension: number): number {
  if (dimension >= 600) return 4
  if (dimension >= 400) return 3
  if (dimension >= 200) return 2
  return 0
}

/**
 * INDEX-based visibility: which of the 4 spread handle indices (0-3) are visible.
 * Indices map to ALL_POSITIONS: 0→15%, 1→35%, 2→65%, 3→85%.
 * For 2 visible: show middle pair (35%, 65%) = indices 1,2
 * For 3 visible: show 15%, 65%, 85% = indices 0,2,3 (evenly spaced)
 */
const VISIBLE_INDICES: Record<number, Set<number>> = {
  0: new Set(), // <200px: center only, all spread hidden
  2: new Set([1, 2]), // 200-400px: middle pair (35%, 65%)
  3: new Set([0, 2, 3]), // 400-600px: three of four (15%, 65%, 85%)
  4: new Set([0, 1, 2, 3]), // 600px+: all visible
}

/** Get visible handle indices for a given edge dimension */
function getVisibleIndices(dimension: number): Set<number> {
  const count = getSpreadCount(dimension)
  return VISIBLE_INDICES[count] || new Set()
}

/** Get count of visible spread handles for a given edge dimension (exported for positionResolver) */
export function getVisibleSpreadCount(dimension: number): number {
  return getSpreadCount(dimension)
}

interface SpreadHandlesProps {
  /** Hide all handles (e.g., at ultra-far zoom) */
  hidden?: boolean
  /** Node width — used for top/bottom edge thresholds */
  width?: number
  /** Node height — used for left/right edge thresholds */
  height?: number
}

const HIDDEN_STYLE = { opacity: 0, pointerEvents: 'none' as const }

/** Class names for visible vs hidden spread handles */
const SPREAD_CLASS = 'spread-handle'
const SPREAD_VISIBLE_CLASS = 'spread-handle spread-visible'

function SpreadHandlesComponent({
  hidden = false,
  width = 280,
  height = 180,
}: SpreadHandlesProps): JSX.Element | null {
  // Hooks must be called unconditionally — before any early return
  const hVisible = useMemo(() => getVisibleIndices(width), [width])
  const vVisible = useMemo(() => getVisibleIndices(height), [height])

  if (hidden) return null

  return (
    <>
      {/* ── Top side (threshold = width) ── */}
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      {ALL_POSITIONS.map((pct, i) => {
        const vis = hVisible.has(i)
        return [
          <Handle
            key={`top-t-${pct}`}
            type="target"
            position={Position.Top}
            id={`top-target-${i + 1}`}
            className={vis ? SPREAD_VISIBLE_CLASS : SPREAD_CLASS}
            data-spread="true"
            style={vis ? { left: `${pct}%` } : { left: `${pct}%`, ...HIDDEN_STYLE }}
          />,
          <Handle
            key={`top-s-${pct}`}
            type="source"
            position={Position.Top}
            id={`top-source-${i + 1}`}
            className={vis ? SPREAD_VISIBLE_CLASS : SPREAD_CLASS}
            data-spread="true"
            style={vis ? { left: `${pct}%` } : { left: `${pct}%`, ...HIDDEN_STYLE }}
          />,
        ]
      })}

      {/* ── Bottom side (threshold = width) ── */}
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      {ALL_POSITIONS.map((pct, i) => {
        const vis = hVisible.has(i)
        return [
          <Handle
            key={`bot-t-${pct}`}
            type="target"
            position={Position.Bottom}
            id={`bottom-target-${i + 1}`}
            className={vis ? SPREAD_VISIBLE_CLASS : SPREAD_CLASS}
            data-spread="true"
            style={vis ? { left: `${pct}%` } : { left: `${pct}%`, ...HIDDEN_STYLE }}
          />,
          <Handle
            key={`bot-s-${pct}`}
            type="source"
            position={Position.Bottom}
            id={`bottom-source-${i + 1}`}
            className={vis ? SPREAD_VISIBLE_CLASS : SPREAD_CLASS}
            data-spread="true"
            style={vis ? { left: `${pct}%` } : { left: `${pct}%`, ...HIDDEN_STYLE }}
          />,
        ]
      })}

      {/* ── Left side (threshold = height) ── */}
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      {ALL_POSITIONS.map((pct, i) => {
        const vis = vVisible.has(i)
        return [
          <Handle
            key={`left-t-${pct}`}
            type="target"
            position={Position.Left}
            id={`left-target-${i + 1}`}
            className={vis ? SPREAD_VISIBLE_CLASS : SPREAD_CLASS}
            data-spread="true"
            style={vis ? { top: `${pct}%` } : { top: `${pct}%`, ...HIDDEN_STYLE }}
          />,
          <Handle
            key={`left-s-${pct}`}
            type="source"
            position={Position.Left}
            id={`left-source-${i + 1}`}
            className={vis ? SPREAD_VISIBLE_CLASS : SPREAD_CLASS}
            data-spread="true"
            style={vis ? { top: `${pct}%` } : { top: `${pct}%`, ...HIDDEN_STYLE }}
          />,
        ]
      })}

      {/* ── Right side (threshold = height) ── */}
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
      {ALL_POSITIONS.map((pct, i) => {
        const vis = vVisible.has(i)
        return [
          <Handle
            key={`right-t-${pct}`}
            type="target"
            position={Position.Right}
            id={`right-target-${i + 1}`}
            className={vis ? SPREAD_VISIBLE_CLASS : SPREAD_CLASS}
            data-spread="true"
            style={vis ? { top: `${pct}%` } : { top: `${pct}%`, ...HIDDEN_STYLE }}
          />,
          <Handle
            key={`right-s-${pct}`}
            type="source"
            position={Position.Right}
            id={`right-source-${i + 1}`}
            className={vis ? SPREAD_VISIBLE_CLASS : SPREAD_CLASS}
            data-spread="true"
            style={vis ? { top: `${pct}%` } : { top: `${pct}%`, ...HIDDEN_STYLE }}
          />,
        ]
      })}
    </>
  )
}

export const SpreadHandles = memo(SpreadHandlesComponent)
