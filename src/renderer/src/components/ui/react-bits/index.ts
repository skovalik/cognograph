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

// Animated borders
export { ElectricBorder, type ElectricBorderProps } from './ElectricBorder'
export { StarBorder, type StarBorderProps } from './StarBorder'

// Content transitions
export { AnimatedContent, type AnimatedContentProps, type AnimationDirection } from './AnimatedContent'

// Interaction feedback
export { ClickSpark, type ClickSparkProps } from './ClickSpark'

// Text effects
export { CountUp, type CountUpProps } from './CountUp'
export { DecryptedText, type DecryptedTextProps, type DecryptedTextAnimateOn, type RevealDirection } from './DecryptedText'

// GPU utilities
export { getGPUTier, supportsWebGL, resetGPUTierCache } from '../../../utils/gpuDetection'

// Error boundary
export { ReactBitsErrorBoundary } from './ReactBitsErrorBoundary'
