// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Ambient Canvas Effects — React Bits backgrounds
 *
 * Registry-driven background animation effects that add "life" to the canvas.
 * All effects respect reduced motion preferences and can be customized.
 */

export type { AmbientEffectLayerProps } from './AmbientEffectLayer'
export { AmbientEffectLayer } from './AmbientEffectLayer'

export { EffectControlsPanel } from './EffectControlsPanel'
export type { EffectRegistryEntry, PropSchema } from './effectRegistry'
export {
  ALL_EFFECT_IDS,
  EFFECT_CATEGORIES,
  EFFECT_REGISTRY,
  EFFECTS_BY_CATEGORY,
} from './effectRegistry'
