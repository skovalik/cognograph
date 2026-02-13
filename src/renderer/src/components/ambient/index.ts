/**
 * Ambient Canvas Effects — React Bits backgrounds
 *
 * Registry-driven background animation effects that add "life" to the canvas.
 * All effects respect reduced motion preferences and can be customized.
 */

export { AmbientEffectLayer } from './AmbientEffectLayer'
export type { AmbientEffectLayerProps } from './AmbientEffectLayer'

export { EffectControlsPanel } from './EffectControlsPanel'

export { EFFECT_REGISTRY, EFFECTS_BY_CATEGORY, ALL_EFFECT_IDS, EFFECT_CATEGORIES } from './effectRegistry'
export type { EffectRegistryEntry, PropSchema } from './effectRegistry'
