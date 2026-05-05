// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo } from 'react'
import { usePerfStore } from '../stores/perfStore'

function PerfTierBadgeImpl(): JSX.Element | null {
  const tier = usePerfStore((s) => s.effectiveTier)
  const mode = usePerfStore((s) => s.perfMode)
  const zoomTier = usePerfStore((s) => s.zoomTier)
  const nodeTier = usePerfStore((s) => s.nodeCountTier)
  const fpsTier = usePerfStore((s) => s.fpsTier)

  if (tier === 'full') return null

  const reason =
    mode === 'battery'
      ? 'battery mode'
      : nodeTier === tier
        ? 'node count'
        : zoomTier === tier
          ? 'zoom level'
          : fpsTier === tier
            ? 'low fps'
            : 'auto'

  const label = tier === 'minimal' ? 'EFFECTS OFF' : 'PERF: REDUCED'

  return (
    <div
      title={`Throttled by ${reason}. Pick "Quality" in Effect Controls to override.`}
      className="absolute bottom-2 right-2 text-[9px] uppercase tracking-wider text-white/60 bg-black/40 px-1.5 py-0.5 rounded pointer-events-auto"
    >
      {label}
    </div>
  )
}

export const PerfTierBadge = memo(PerfTierBadgeImpl)
