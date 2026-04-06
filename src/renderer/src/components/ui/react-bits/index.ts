// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * React Bits — Interactive visual effect components for Cognograph.
 *
 * These are copy-paste components adapted from React Bits (reactbits.dev)
 * for use in the node UI layer. Each component is typed, supports reduced
 * motion, and falls back gracefully when GPU features are unavailable.
 *
 * For structural UI primitives (Dialog, Button, Select, etc.), see
 * the shadcn/ui components in `../index.ts`.
 */

// GPU utilities
export { getGPUTier, resetGPUTierCache, supportsWebGL } from '../../../utils/gpuDetection'
// Content transitions
export {
  AnimatedContent,
  type AnimatedContentProps,
  type AnimationDirection,
} from './AnimatedContent'
// Interaction feedback
export { ClickSpark, type ClickSparkProps } from './ClickSpark'
// Text effects
export { CountUp, type CountUpProps } from './CountUp'
export {
  DecryptedText,
  type DecryptedTextAnimateOn,
  type DecryptedTextProps,
  type RevealDirection,
} from './DecryptedText'
// Animated borders
export { ElectricBorder, type ElectricBorderProps } from './ElectricBorder'
// Error boundary
export { ReactBitsErrorBoundary } from './ReactBitsErrorBoundary'
export { StarBorder, type StarBorderProps } from './StarBorder'
