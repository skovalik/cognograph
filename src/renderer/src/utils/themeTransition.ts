/**
 * Theme Transition Utility
 *
 * Uses the View Transition API (stable in Chromium 111+, Electron 33 = Chromium 130)
 * to animate theme changes with either:
 *   - Dithered circular reveal (USE_DITHER_REVEAL = true) — stippled pixel mask
 *   - Clean circular reveal (USE_DITHER_REVEAL = false) — smooth clip-path circle
 * Keyboard shortcuts get a smooth crossfade instead.
 *
 * Accessibility: respects the app's 3-tier reduce-motion system
 * (programStore 'always'/'never'/'system' + OS media query).
 */

import { flushSync } from 'react-dom'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useProgramStore } from '../stores/programStore'
import { type GuiColors, type ThemeSettings } from '@shared/types'
import { DEFAULT_GUI_DARK, DEFAULT_GUI_LIGHT } from '../constants/themePresets'

// =============================================================================
// Configuration — flip USE_DITHER_REVEAL to false for instant rollback
// =============================================================================

const USE_DITHER_REVEAL = false
const DITHER_SCALE = 0.25       // Mask resolution: 1/4 viewport (visible pixel blocks)
const DITHER_BAND_PX = 220      // Dither band width in real pixels (wider = more visible stipple)
const TRANSITION_DURATION = 600  // ms (slightly slower to let dither register visually)

// =============================================================================
// Reduce-motion check (non-React, reads stores directly)
// =============================================================================

function shouldReduceMotion(): boolean {
  const preference = useProgramStore.getState().accessibility.reduceMotion
  if (preference === 'always') return true
  if (preference === 'never') return false
  // 'system' — defer to OS
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// =============================================================================
// Synchronous DOM application (mirrors App.tsx useEffects)
// =============================================================================

/**
 * Apply all theme-related DOM changes synchronously.
 * This mirrors the 3 useEffects in App.tsx (lines 266, 285, 308)
 * so that startViewTransition captures the correct "after" snapshot.
 */
function applyThemeToDom(themeSettings: ThemeSettings): void {
  // 1. data-theme attribute (App.tsx line 267)
  document.body.setAttribute('data-theme', themeSettings.mode)

  // 2. GUI CSS variables (App.tsx lines 285-305)
  const guiColors: GuiColors = themeSettings.guiColors ||
    (themeSettings.mode === 'light' ? DEFAULT_GUI_LIGHT : DEFAULT_GUI_DARK)

  const root = document.documentElement
  root.style.setProperty('--gui-panel-bg', guiColors.panelBackground)
  root.style.setProperty('--gui-panel-bg-secondary', guiColors.panelBackgroundSecondary)
  root.style.setProperty('--gui-text-primary', guiColors.textPrimary)
  root.style.setProperty('--gui-text-secondary', guiColors.textSecondary)
  root.style.setProperty('--gui-accent-primary', guiColors.accentPrimary)
  root.style.setProperty('--gui-accent-secondary', guiColors.accentSecondary)
  root.style.setProperty('--gui-toolbar-icon-default', guiColors.toolbarIconDefault)
  root.style.setProperty('--gui-toolbar-icon-1', guiColors.toolbarIconAccent[0] || '#a855f7')
  root.style.setProperty('--gui-toolbar-icon-2', guiColors.toolbarIconAccent[1] || '#22d3ee')
  root.style.setProperty('--gui-toolbar-icon-3', guiColors.toolbarIconAccent[2] || '#34d399')
  root.style.setProperty('--gui-toolbar-icon-4', guiColors.toolbarIconAccent[3] || '#a855f7')
  root.style.setProperty('--node-text-primary', guiColors.textPrimary)
  root.style.setProperty('--node-text-secondary', guiColors.textSecondary)

  // 3. Canvas CSS variables (App.tsx lines 308-312)
  root.style.setProperty('--canvas-background', themeSettings.canvasBackground)
  root.style.setProperty(
    '--canvas-grid-color',
    themeSettings.canvasGridColor === '#transparent' ? 'transparent' : themeSettings.canvasGridColor
  )
}

// =============================================================================
// Dithered circular reveal — canvas-generated per-frame mask
// =============================================================================

/**
 * Deterministic spatial noise via integer hashing.
 * Consistent across frames (no flicker), spatially random.
 * Seed parameter varies per transition for visual variety.
 */
function hashNoise(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) & 255
}

/**
 * Run the dithered circular reveal animation.
 *
 * Generates a per-frame alpha mask at reduced resolution, where the expanding
 * circle's edge is a stippled dither band — pixels threshold a noise pattern
 * against their radial distance. The mask is injected as a CSS mask-image on
 * ::view-transition-new(root), revealing the new theme through the dither.
 */
function runDitherReveal(
  clickX: number,
  clickY: number,
  maxRadius: number,
  transition: ViewTransition
): void {
  const w = Math.ceil(window.innerWidth * DITHER_SCALE)
  const h = Math.ceil(window.innerHeight * DITHER_SCALE)
  const cx = clickX * DITHER_SCALE
  const cy = clickY * DITHER_SCALE
  const band = DITHER_BAND_PX * DITHER_SCALE
  const scaledMaxR = maxRadius * DITHER_SCALE

  // Pre-compute per-pixel distances and noise (reused across all frames)
  const pixelCount = w * h
  const distances = new Float32Array(pixelCount)
  const noise = new Uint8Array(pixelCount)
  const seed = (Date.now() * 7) | 0

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px
      const dx = px - cx
      const dy = py - cy
      distances[i] = Math.sqrt(dx * dx + dy * dy)
      noise[i] = hashNoise(px, py, seed)
    }
  }

  // Off-screen canvas for mask generation
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(w, h)
  const data = imageData.data

  // Dynamic style element — updated per frame with the mask data URL
  const styleEl = document.createElement('style')
  document.head.appendChild(styleEl)

  const startTime = performance.now()

  transition.ready
    .then(() => {
      // Keep pseudo-elements alive for the full animation duration.
      // Without these, `animation: none` from CSS causes immediate cleanup.
      document.documentElement.animate(
        { opacity: [1, 1] },
        { duration: TRANSITION_DURATION + 50, pseudoElement: '::view-transition-new(root)' }
      )
      document.documentElement.animate(
        { opacity: [1, 1] },
        { duration: TRANSITION_DURATION + 50, pseudoElement: '::view-transition-old(root)' }
      )

      function frame(): void {
        const elapsed = performance.now() - startTime
        const t = Math.min(elapsed / TRANSITION_DURATION, 1)
        // Ease-out-expo: fast start, smooth deceleration
        const easedT = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
        const currentR = easedT * (scaledMaxR + band)

        for (let i = 0; i < pixelCount; i++) {
          const dist = distances[i]
          // bandPos: -1 = fully inside circle, 0 = at edge, +1 = fully outside
          const bandPos = (dist - currentR) / band

          let alpha: number
          if (bandPos <= -1) {
            alpha = 255 // fully revealed
          } else if (bandPos >= 1) {
            alpha = 0   // fully hidden
          } else {
            // Dither band: threshold noise against radial position.
            // Maps bandPos from [-1, +1] to threshold [0, 255].
            // At bandPos=-1 (inner edge): threshold=255 → all noise passes → revealed
            // At bandPos=+1 (outer edge): threshold=0 → no noise passes → hidden
            const threshold = (1 - bandPos) * 127.5
            alpha = noise[i] < threshold ? 255 : 0
          }

          // Only write alpha channel — RGB stays at 0, mask-mode: alpha ignores it
          data[i * 4 + 3] = alpha
        }

        ctx.putImageData(imageData, 0, 0)

        // Inject mask as data URL. The low-res PNG + image-rendering: pixelated
        // gives the characteristic blocky dither aesthetic.
        styleEl.textContent =
          `.theme-transition-dither::view-transition-new(root){` +
          `mask-image:url(${canvas.toDataURL('image/png')});` +
          `mask-size:100% 100%;` +
          `mask-mode:alpha;` +
          `image-rendering:pixelated;` +
          `}`

        if (t < 1) {
          requestAnimationFrame(frame)
        }
      }

      requestAnimationFrame(frame)
    })
    .catch(() => {
      // Transition skipped (rapid toggle) — cleanup handled by finished handler
    })

  transition.finished
    .finally(() => {
      styleEl.remove()
    })
    .catch(() => {})
}

// =============================================================================
// Main transition function
// =============================================================================

/**
 * Perform a theme mode change with a smooth visual transition.
 *
 * - Click with mouse event: dithered or clean circular reveal from click point
 * - Keyboard (no event): default crossfade from center
 * - Reduced motion: instant swap, no animation
 *
 * @param newMode - The target theme mode ('dark' or 'light')
 * @param clickEvent - Optional mouse event for click-origin transitions
 */
export function performThemeTransition(
  newMode: 'dark' | 'light',
  clickEvent?: React.MouseEvent | MouseEvent
): void {
  const store = useWorkspaceStore.getState()

  // Already in this mode — no-op
  if (store.themeSettings.mode === newMode) return

  // No View Transition API or reduce-motion → instant swap
  if (!document.startViewTransition || shouldReduceMotion()) {
    store.setThemeMode(newMode)
    return
  }

  // Determine click origin (center of viewport for keyboard)
  const x = clickEvent?.clientX ?? window.innerWidth / 2
  const y = clickEvent?.clientY ?? window.innerHeight / 2

  // Max radius = distance from click to farthest viewport corner
  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )

  // For click-based transitions, suppress default crossfade via CSS class
  const isCircular = !!clickEvent
  if (isCircular) {
    const cssClass = USE_DITHER_REVEAL ? 'theme-transition-dither' : 'theme-transition-circular'
    document.documentElement.classList.add(cssClass)
  }

  const transition = document.startViewTransition(() => {
    flushSync(() => {
      store.setThemeMode(newMode)
      // Read committed state and apply DOM synchronously for the snapshot
      const newState = useWorkspaceStore.getState().themeSettings
      applyThemeToDom(newState)
    })
  })

  if (isCircular) {
    if (USE_DITHER_REVEAL) {
      // Dithered circular reveal — canvas-generated per-frame mask
      runDitherReveal(x, y, maxRadius, transition)
    } else {
      // Clean circular reveal — clip-path animation
      transition.ready
        .then(() => {
          const clipStart = `circle(0px at ${x}px ${y}px)`
          const clipEnd = `circle(${maxRadius}px at ${x}px ${y}px)`

          document.documentElement.animate(
            { clipPath: [clipStart, clipEnd] },
            {
              duration: TRANSITION_DURATION,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          )
        })
        .catch(() => {})
    }
  }

  // Clean up regardless of success/skip
  transition.finished
    .finally(() => {
      document.documentElement.classList.remove('theme-transition-circular')
      document.documentElement.classList.remove('theme-transition-dither')
    })
    .catch(() => {
      // Swallow AbortError from rapid toggling
    })
}

// =============================================================================
// Preset transition — global crossfade (no circular reveal)
// =============================================================================

/**
 * Perform a theme preset change with a smooth crossfade transition.
 *
 * Uses the browser's default View Transition crossfade (~250ms) since presets
 * are selected from a grid — there's no single click origin for a circular reveal.
 *
 * @param presetId - The target preset identifier
 */
export function performPresetTransition(presetId: string): void {
  const store = useWorkspaceStore.getState()

  // Already on this preset — no-op
  if (store.themeSettings.currentPresetId === presetId) return

  // No View Transition API or reduce-motion → instant swap
  if (!document.startViewTransition || shouldReduceMotion()) {
    store.applyThemePreset(presetId)
    return
  }

  // Default crossfade (no circular reveal — presets are a grid, no click origin)
  const transition = document.startViewTransition(() => {
    flushSync(() => {
      store.applyThemePreset(presetId)
      const newState = useWorkspaceStore.getState().themeSettings
      applyThemeToDom(newState)
    })
  })

  transition.finished.catch(() => {})
}
