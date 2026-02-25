// ContextScopeBadge — PFD Phase 4: AI Context Transparency
// Shows "AI sees N nodes" badge near chat panel when context visualization is active.
// Breakdown on hover: nodes by depth and role.

import { memo, useMemo, useState } from 'react'
import { useContextVisualizationStore } from '../stores/contextVisualizationStore'

function ContextScopeBadgeComponent(): JSX.Element | null {
  const active = useContextVisualizationStore((state) => state.active)
  const includedNodeIds = useContextVisualizationStore((state) => state.includedNodeIds)
  const nodeCount = useContextVisualizationStore((state) => state.nodeCount)
  const [hovered, setHovered] = useState(false)

  const breakdown = useMemo(() => {
    if (!active) return null

    const byDepth = new Map<number, number>()
    const byRole = new Map<string, number>()

    for (const [, info] of includedNodeIds) {
      byDepth.set(info.depth, (byDepth.get(info.depth) || 0) + 1)
      byRole.set(info.role, (byRole.get(info.role) || 0) + 1)
    }

    return {
      depths: Array.from(byDepth.entries()).sort((a, b) => a[0] - b[0]),
      roles: Array.from(byRole.entries()).sort((a, b) => b[1] - a[1])
    }
  }, [active, includedNodeIds])

  if (!active || nodeCount === 0) return null

  const roleLabels: Record<string, string> = {
    reference: 'Reference',
    instruction: 'Instruction',
    example: 'Example',
    background: 'Background',
    scope: 'Scope'
  }

  return (
    <div
      className="context-scope-badge"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="context-scope-badge__count">
        AI sees <strong>{nodeCount}</strong> node{nodeCount !== 1 ? 's' : ''}
      </div>

      {hovered && breakdown && (
        <div className="context-scope-badge__detail">
          <div className="context-scope-badge__section">
            <span className="context-scope-badge__label">By depth</span>
            {breakdown.depths.map(([depth, count]) => (
              <div key={depth} className="context-scope-badge__row">
                <span className="context-scope-badge__depth" style={{ opacity: 1 - (depth - 1) * 0.3 }}>
                  Depth {depth}
                </span>
                <span>{count}</span>
              </div>
            ))}
          </div>
          <div className="context-scope-badge__section">
            <span className="context-scope-badge__label">By role</span>
            {breakdown.roles.map(([role, count]) => (
              <div key={role} className="context-scope-badge__row">
                <span>{roleLabels[role] || role}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const ContextScopeBadge = memo(ContextScopeBadgeComponent)
