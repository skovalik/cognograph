// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * MutationPermissionCard — specialized permission card for mutation operations.
 *
 * Renders the mutation description and target with an icon indicating
 * the mutation type (create, update, delete).
 */

import type { MutationDisplay } from '@shared/transport/types'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { memo } from 'react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMutationIcon(mutationType?: MutationDisplay['mutationType']) {
  switch (mutationType) {
    case 'create':
      return Plus
    case 'delete':
      return Trash2
    case 'update':
    default:
      return Pencil
  }
}

function getMutationLabel(mutationType?: MutationDisplay['mutationType']): string {
  switch (mutationType) {
    case 'create':
      return 'Create'
    case 'delete':
      return 'Delete'
    case 'update':
      return 'Update'
    default:
      return 'Mutate'
  }
}

function getMutationColor(mutationType?: MutationDisplay['mutationType']): {
  icon: string
  badge: string
  border: string
} {
  switch (mutationType) {
    case 'create':
      return {
        icon: 'text-emerald-400',
        badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        border: 'border-emerald-500/20',
      }
    case 'delete':
      return {
        icon: 'text-red-400',
        badge: 'bg-red-500/15 text-red-400 border-red-500/30',
        border: 'border-red-500/20',
      }
    case 'update':
    default:
      return {
        icon: 'text-amber-400',
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        border: 'border-amber-500/20',
      }
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MutationPermissionCardProps {
  display: MutationDisplay
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MutationPermissionCard = memo(function MutationPermissionCard({
  display,
}: MutationPermissionCardProps) {
  const { description, target, mutationType } = display
  const Icon = getMutationIcon(mutationType)
  const label = getMutationLabel(mutationType)
  const colors = getMutationColor(mutationType)

  return (
    <div className="mb-2">
      {/* Mutation type badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3 h-3 flex-shrink-0 ${colors.icon}`} />
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colors.badge}`}>
          {label}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-white/70 leading-snug mb-1">{description}</p>

      {/* Target */}
      <div
        className={`
          flex items-center gap-1.5 px-1.5 py-1 rounded
          bg-black/20 border ${colors.border}
        `}
      >
        <span className="text-[10px] text-white/40 flex-shrink-0">Target:</span>
        <span className="text-[10px] text-white/60 font-mono truncate" title={target}>
          {target}
        </span>
      </div>
    </div>
  )
})
