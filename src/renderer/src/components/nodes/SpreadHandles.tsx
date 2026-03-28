// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * SpreadHandles — Multiple connection handles per side, spread along the edge.
 *
 * Instead of one handle per side (all edges converge at center), this creates
 * multiple handles per side so edges can attach at different points. This makes
 * it possible to select and reconnect individual edges when multiple edges
 * connect to the same side of a node.
 *
 * Handle IDs follow the pattern: "{side}-{type}" for center, "{side}-{type}-{index}" for spread.
 * Example: "bottom-source", "bottom-source-1", "bottom-source-2"
 *
 * The center handle (no index) is always present for backwards compatibility.
 * Spread handles are positioned at 15%, 35%, 65%, 85% along the side.
 */

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

const SPREAD_POSITIONS = [15, 35, 65, 85] // percentages along the side — pulls outer handles away from corner border-radius

interface SpreadHandlesProps {
  /** Hide all handles (e.g., at ultra-far zoom) */
  hidden?: boolean
}

function SpreadHandlesComponent({ hidden = false }: SpreadHandlesProps): JSX.Element | null {
  if (hidden) return null

  return (
    <>
      {/* ── Top side ── */}
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      {SPREAD_POSITIONS.map((pct, i) => (
        <Handle key={`top-t-${i}`} type="target" position={Position.Top} id={`top-target-${i + 1}`} className="spread-handle" data-spread="true" style={{ left: `${pct}%` }} />
      ))}
      {SPREAD_POSITIONS.map((pct, i) => (
        <Handle key={`top-s-${i}`} type="source" position={Position.Top} id={`top-source-${i + 1}`} className="spread-handle" data-spread="true" style={{ left: `${pct}%` }} />
      ))}

      {/* ── Bottom side ── */}
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      {SPREAD_POSITIONS.map((pct, i) => (
        <Handle key={`bot-t-${i}`} type="target" position={Position.Bottom} id={`bottom-target-${i + 1}`} className="spread-handle" data-spread="true" style={{ left: `${pct}%` }} />
      ))}
      {SPREAD_POSITIONS.map((pct, i) => (
        <Handle key={`bot-s-${i}`} type="source" position={Position.Bottom} id={`bottom-source-${i + 1}`} className="spread-handle" data-spread="true" style={{ left: `${pct}%` }} />
      ))}

      {/* ── Left side ── */}
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      {SPREAD_POSITIONS.map((pct, i) => (
        <Handle key={`left-t-${i}`} type="target" position={Position.Left} id={`left-target-${i + 1}`} className="spread-handle" data-spread="true" style={{ top: `${pct}%` }} />
      ))}
      {SPREAD_POSITIONS.map((pct, i) => (
        <Handle key={`left-s-${i}`} type="source" position={Position.Left} id={`left-source-${i + 1}`} className="spread-handle" data-spread="true" style={{ top: `${pct}%` }} />
      ))}

      {/* ── Right side ── */}
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
      {SPREAD_POSITIONS.map((pct, i) => (
        <Handle key={`right-t-${i}`} type="target" position={Position.Right} id={`right-target-${i + 1}`} className="spread-handle" data-spread="true" style={{ top: `${pct}%` }} />
      ))}
      {SPREAD_POSITIONS.map((pct, i) => (
        <Handle key={`right-s-${i}`} type="source" position={Position.Right} id={`right-source-${i + 1}`} className="spread-handle" data-spread="true" style={{ top: `${pct}%` }} />
      ))}
    </>
  )
}

export const SpreadHandles = memo(SpreadHandlesComponent)
