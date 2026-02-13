/**
 * GPU detection utility for React Bits visual effects.
 *
 * Detects WebGL availability and caches the result for the session lifetime.
 * Components that require GPU rendering (ElectricBorder, StarBorder, ClickSpark)
 * use this to decide whether to render their full animated version or a CSS fallback.
 */

interface GPUTier {
  /** Whether any WebGL context is available */
  webglAvailable: boolean
  /** Whether WebGL2 specifically is available */
  webgl2Available: boolean
  /** Maximum texture size supported (0 if no WebGL) */
  maxTextureSize: number
  /** 'high' = WebGL2 + large textures, 'medium' = WebGL1, 'low' = no WebGL */
  tier: 'high' | 'medium' | 'low'
}

let cachedTier: GPUTier | null = null

/**
 * Detect GPU capabilities and return a tier classification.
 * Result is cached after the first call.
 */
export function getGPUTier(): GPUTier {
  if (cachedTier !== null) return cachedTier

  try {
    const canvas = document.createElement('canvas')

    // Try WebGL2 first
    const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null
    if (gl2) {
      const maxTexture = gl2.getParameter(gl2.MAX_TEXTURE_SIZE) as number
      cachedTier = {
        webglAvailable: true,
        webgl2Available: true,
        maxTextureSize: maxTexture,
        tier: maxTexture >= 4096 ? 'high' : 'medium',
      }
      return cachedTier
    }

    // Fall back to WebGL1
    const gl1 =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (gl1) {
      const maxTexture = gl1.getParameter(gl1.MAX_TEXTURE_SIZE) as number
      cachedTier = {
        webglAvailable: true,
        webgl2Available: false,
        maxTextureSize: maxTexture,
        tier: 'medium',
      }
      return cachedTier
    }
  } catch {
    // WebGL context creation threw — treat as unavailable
  }

  cachedTier = {
    webglAvailable: false,
    webgl2Available: false,
    maxTextureSize: 0,
    tier: 'low',
  }
  return cachedTier
}

/**
 * Quick check: is any WebGL context available?
 * Delegates to getGPUTier() and caches the result.
 */
export function supportsWebGL(): boolean {
  return getGPUTier().webglAvailable
}

/**
 * Reset the cached GPU tier. Only used in tests.
 */
export function resetGPUTierCache(): void {
  cachedTier = null
}
