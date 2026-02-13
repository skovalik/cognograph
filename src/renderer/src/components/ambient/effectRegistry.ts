/**
 * Effect Registry — Central mapping for all 20 React Bits background effects.
 *
 * Each entry defines: component (lazy-loaded), default props, UI prop schema,
 * theme-linked color props, and category grouping.
 */

import React from 'react'
import type { AmbientEffectType } from '@shared/types'

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export type ControlType = 'slider' | 'toggle' | 'select' | 'color' | 'color-array'

export interface PropSchema {
  key: string
  label: string
  controlType: ControlType
  min?: number
  max?: number
  step?: number
  options?: { value: string; label: string }[]
  /** Prop auto-derives from theme color when not user-overridden */
  isThemeLinked?: boolean
  /** Expected color format for this prop */
  colorFormat?: 'hex' | 'rgb-float'
  /** Derive this color from another resolved prop instead of the raw theme color */
  deriveFrom?: {
    sourceKey: string
    darken?: number      // 0-1, how much to darken (0.8 = 80% darker)
    desaturate?: number  // 0-1, factor to multiply saturation by (0.5 = half saturation)
    hueShift?: number    // fractional hue shift (-0.05 = slight left/ccw shift)
    /** Override derivation for light mode (swaps darken→lighten, etc.) */
    lightMode?: {
      lighten?: number     // 0-1, how much to lighten (0.85 = push 85% toward white)
      desaturate?: number
      hueShift?: number
    }
  }
}

export interface EffectRegistryEntry {
  id: AmbientEffectType
  name: string
  category: string
  icon: string
  component: React.LazyExoticComponent<React.ComponentType<any>>
  defaultProps: Record<string, unknown>
  propSchema: PropSchema[]
  /** Props that auto-sync with theme base color */
  themeColorProps: string[]
}

// ---------------------------------------------------------------------------
// Lazy-loaded components
// ---------------------------------------------------------------------------

const LetterGlitch = React.lazy(() => import('./effects/LetterGlitch'))
const Iridescence  = React.lazy(() => import('./effects/Iridescence'))
const Threads      = React.lazy(() => import('./effects/Threads'))
const DotGrid      = React.lazy(() => import('./effects/DotGrid'))
const Dither       = React.lazy(() => import('./effects/Dither'))
const PrismaticBurst = React.lazy(() => import('./effects/PrismaticBurst'))
const PixelSnow    = React.lazy(() => import('./effects/PixelSnow'))
const Beams        = React.lazy(() => import('./effects/Beams'))
const Grainient    = React.lazy(() => import('./effects/Grainient'))
const Plasma       = React.lazy(() => import('./effects/Plasma'))
const Particles    = React.lazy(() => import('./effects/Particles'))
const Aurora       = React.lazy(() => import('./effects/Aurora'))
const ColorBends   = React.lazy(() => import('./effects/ColorBends'))
const PixelBlast   = React.lazy(() => import('./effects/PixelBlast'))
const FloatingLines = React.lazy(() => import('./effects/FloatingLines'))
const Silk         = React.lazy(() => import('./effects/Silk'))
const LightPillar  = React.lazy(() => import('./effects/LightPillar'))
const Prism        = React.lazy(() => import('./effects/Prism'))
const LiquidEther  = React.lazy(() => import('./effects/LiquidEther'))

// ---------------------------------------------------------------------------
// Registry entries
// ---------------------------------------------------------------------------

const ENTRIES: EffectRegistryEntry[] = [
  // ── Patterns ──────────────────────────────────────────────────────────
  {
    id: 'letter-glitch',
    name: 'Letter Glitch',
    category: 'Patterns',
    icon: '>_<',
    component: LetterGlitch,
    defaultProps: {
      glitchColors: ['#2b4539', '#61dca3', '#61b3dc'],
      glitchSpeed: 80,
      letterOpacity: 0.5,
      centerVignette: false,
      outerVignette: true,
      smooth: true,
    },
    propSchema: [
      { key: 'glitchColors', label: 'Colors', controlType: 'color-array', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'glitchSpeed', label: 'Speed', controlType: 'slider', min: 10, max: 200, step: 10 },
      { key: 'letterOpacity', label: 'Opacity', controlType: 'slider', min: 0, max: 1, step: 0.05 },
      { key: 'centerVignette', label: 'Center Vignette', controlType: 'toggle' },
      { key: 'outerVignette', label: 'Outer Vignette', controlType: 'toggle' },
      { key: 'smooth', label: 'Smooth', controlType: 'toggle' },
    ],
    themeColorProps: ['glitchColors'],
  },
  {
    id: 'dot-grid',
    name: 'Dot Grid',
    category: 'Patterns',
    icon: '·∙·',
    component: DotGrid,
    defaultProps: {
      dotSize: 5,
      gap: 15,
      baseColor: '#1a0a4d',
      activeColor: '#5227FF',
      proximity: 80,
      speedTrigger: 300,
      shockRadius: 250,
      shockStrength: 5,
      resistance: 750,
      returnDuration: 1.5,
    },
    propSchema: [
      { key: 'dotSize', label: 'Dot Size', controlType: 'slider', min: 2, max: 50, step: 1 },
      { key: 'gap', label: 'Gap', controlType: 'slider', min: 4, max: 64, step: 1 },
      { key: 'baseColor', label: 'Base Color', controlType: 'color', isThemeLinked: true, colorFormat: 'hex',
        deriveFrom: {
          sourceKey: 'activeColor', darken: 0.8, desaturate: 0.5, hueShift: -0.05,
          lightMode: { lighten: 0.75, desaturate: 0.6, hueShift: -0.02 },
        } },
      { key: 'activeColor', label: 'Active Color', controlType: 'color', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'proximity', label: 'Proximity', controlType: 'slider', min: 50, max: 400, step: 10 },
      { key: 'speedTrigger', label: 'Speed Trigger', controlType: 'slider', min: 50, max: 800, step: 25 },
      { key: 'shockRadius', label: 'Shock Radius', controlType: 'slider', min: 50, max: 500, step: 25 },
      { key: 'shockStrength', label: 'Shock Strength', controlType: 'slider', min: 1, max: 20, step: 1 },
      { key: 'resistance', label: 'Resistance', controlType: 'slider', min: 100, max: 2000, step: 50 },
      { key: 'returnDuration', label: 'Return Duration', controlType: 'slider', min: 0.01, max: 4, step: 0.01 },
    ],
    themeColorProps: ['activeColor'],
  },
  {
    id: 'dither',
    name: 'Dither',
    category: 'Patterns',
    icon: '▓░▓',
    component: Dither,
    defaultProps: {
      waveSpeed: 0.01,
      waveFrequency: 6,
      waveAmplitude: 0.3,
      waveColor: [0.5, 0.5, 0.5],
      effectOpacity: 1,
      colorNum: 4,
      pixelSize: 2,
      enableMouseInteraction: false,
      mouseRadius: 1,
    },
    propSchema: [
      { key: 'effectOpacity', label: 'Opacity', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
      { key: 'waveSpeed', label: 'Wave Speed', controlType: 'slider', min: 0.001, max: 0.2, step: 0.001 },
      { key: 'waveFrequency', label: 'Wave Frequency', controlType: 'slider', min: 1, max: 10, step: 0.5 },
      { key: 'waveAmplitude', label: 'Wave Amplitude', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
      { key: 'waveColor', label: 'Wave Color', controlType: 'color', isThemeLinked: true, colorFormat: 'rgb-float' },
      { key: 'colorNum', label: 'Color Levels', controlType: 'slider', min: 2, max: 16, step: 1 },
      { key: 'pixelSize', label: 'Pixel Size', controlType: 'slider', min: 1, max: 8, step: 1 },
      { key: 'enableMouseInteraction', label: 'Mouse Interaction', controlType: 'toggle' },
      { key: 'mouseRadius', label: 'Mouse Radius', controlType: 'slider', min: 0.1, max: 1, step: 0.05 },
    ],
    themeColorProps: ['waveColor'],
  },
  {
    id: 'pixel-blast',
    name: 'Pixel Blast',
    category: 'Patterns',
    icon: '▪▫▪',
    component: PixelBlast,
    defaultProps: {
      color: '#B19EEF',
      variant: 'square',
      pixelSize: 2,
      patternScale: 2,
      patternDensity: 1,
      enableRipples: true,
      speed: 0.15,
      edgeFade: 0.5,
    },
    propSchema: [
      { key: 'color', label: 'Color', controlType: 'color', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'variant', label: 'Variant', controlType: 'select', options: [
        { value: 'square', label: 'Square' },
        { value: 'circle', label: 'Circle' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'diamond', label: 'Diamond' },
      ]},
      { key: 'pixelSize', label: 'Pixel Size', controlType: 'slider', min: 1, max: 10, step: 1 },
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.05, max: 2, step: 0.05 },
      { key: 'edgeFade', label: 'Edge Fade', controlType: 'slider', min: 0, max: 1, step: 0.05 },
      { key: 'enableRipples', label: 'Ripples', controlType: 'toggle' },
    ],
    themeColorProps: ['color'],
  },
  {
    id: 'pixel-snow',
    name: 'Pixel Snow',
    category: 'Patterns',
    icon: '❆ ❆',
    component: PixelSnow,
    defaultProps: {
      color: '#ffffff',
      flakeSize: 0.01,
      minFlakeSize: 1.25,
      pixelResolution: 200,
      speed: 1.25,
      depthFade: 8,
      brightness: 1,
      gamma: 0.4545,
      density: 0.3,
      variant: 'square',
      direction: 125,
    },
    propSchema: [
      { key: 'color', label: 'Color', controlType: 'color', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'flakeSize', label: 'Flake Size', controlType: 'slider', min: 0.001, max: 0.1, step: 0.001 },
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'density', label: 'Density', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
      { key: 'brightness', label: 'Brightness', controlType: 'slider', min: 0.5, max: 3, step: 0.1 },
      { key: 'depthFade', label: 'Depth Fade', controlType: 'slider', min: 0, max: 20, step: 1 },
      { key: 'variant', label: 'Variant', controlType: 'select', options: [
        { value: 'square', label: 'Square' },
        { value: 'round', label: 'Round' },
        { value: 'snowflake', label: 'Snowflake' },
      ]},
      { key: 'direction', label: 'Direction', controlType: 'slider', min: 0, max: 360, step: 5 },
    ],
    themeColorProps: ['color'],
  },

  // ── Atmosphere ────────────────────────────────────────────────────────
  {
    id: 'aurora',
    name: 'Aurora',
    category: 'Atmosphere',
    icon: '≈≈≈',
    component: Aurora,
    defaultProps: {
      colorStops: ['#5227FF', '#7cff67', '#5227FF'],
      amplitude: 0.6,
      blend: 1,
      speed: 0.2,
      opacity: 1,
    },
    propSchema: [
      { key: 'colorStops', label: 'Color Stops', controlType: 'color-array', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'amplitude', label: 'Amplitude', controlType: 'slider', min: 0.1, max: 3, step: 0.1 },
      { key: 'blend', label: 'Blend', controlType: 'slider', min: 0, max: 1, step: 0.05 },
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'opacity', label: 'Opacity', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
    ],
    themeColorProps: ['colorStops'],
  },
  {
    id: 'grainient',
    name: 'Grainient',
    category: 'Atmosphere',
    icon: '░▒░',
    component: Grainient,
    defaultProps: {
      color1: '#FF9FFC',
      color2: '#5227FF',
      color3: '#B19EEF',
      timeSpeed: 0.25,
      grainAmount: 0.1,
      noiseScale: 2.0,
      contrast: 1.5,
      saturation: 0.35,
      opacity: 1,
    },
    propSchema: [
      { key: 'color1', label: 'Color 1', controlType: 'color', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'color2', label: 'Color 2', controlType: 'color', isThemeLinked: true, colorFormat: 'hex',
        deriveFrom: {
          sourceKey: 'color1', darken: 0.5, desaturate: 0.2, hueShift: 0.15,
          lightMode: { lighten: 0.3, desaturate: 0.3, hueShift: 0.15 },
        } },
      { key: 'color3', label: 'Color 3', controlType: 'color', isThemeLinked: true, colorFormat: 'hex',
        deriveFrom: {
          sourceKey: 'color1', darken: 0.2, desaturate: 0.4, hueShift: -0.05,
          lightMode: { lighten: 0.5, desaturate: 0.5, hueShift: -0.05 },
        } },
      { key: 'timeSpeed', label: 'Speed', controlType: 'slider', min: 0.05, max: 2, step: 0.05 },
      { key: 'grainAmount', label: 'Grain', controlType: 'slider', min: 0, max: 0.5, step: 0.01 },
      { key: 'noiseScale', label: 'Noise Scale', controlType: 'slider', min: 1, max: 16, step: 0.5 },
      { key: 'contrast', label: 'Contrast', controlType: 'slider', min: 0.5, max: 2, step: 0.05 },
      { key: 'saturation', label: 'Saturation', controlType: 'slider', min: 0, max: 2, step: 0.05 },
      { key: 'opacity', label: 'Opacity', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
    ],
    themeColorProps: ['color1'],
  },
  {
    id: 'plasma',
    name: 'Plasma',
    category: 'Atmosphere',
    icon: '◎◎◎',
    component: Plasma,
    defaultProps: {
      color: '#ffffff',
      speed: 1,
      direction: 'forward',
      scale: 1,
      opacity: 1,
      mouseInteractive: false,
    },
    propSchema: [
      { key: 'color', label: 'Color', controlType: 'color', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.1, max: 10, step: 0.1 },
      { key: 'direction', label: 'Direction', controlType: 'select', options: [
        { value: 'forward', label: 'Forward' },
        { value: 'reverse', label: 'Reverse' },
        { value: 'pingpong', label: 'Ping-Pong' },
      ]},
      { key: 'scale', label: 'Scale', controlType: 'slider', min: 0.1, max: 10, step: 0.1 },
      { key: 'opacity', label: 'Opacity', controlType: 'slider', min: 0.1, max: 1, step: 0.05 },
      { key: 'mouseInteractive', label: 'Mouse Interaction', controlType: 'toggle' },
    ],
    themeColorProps: ['color'],
  },
  {
    id: 'silk',
    name: 'Silk',
    category: 'Atmosphere',
    icon: '∿∿∿',
    component: Silk,
    defaultProps: {
      speed: 5,
      scale: 1,
      color: '#7B7481',
      noiseIntensity: 1.5,
      rotation: 0,
      opacity: 1,
    },
    propSchema: [
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.5, max: 20, step: 0.5 },
      { key: 'scale', label: 'Scale', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'color', label: 'Color', controlType: 'color', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'noiseIntensity', label: 'Noise Intensity', controlType: 'slider', min: 0, max: 5, step: 0.1 },
      { key: 'rotation', label: 'Rotation', controlType: 'slider', min: 0, max: 360, step: 5 },
      { key: 'opacity', label: 'Opacity', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
    ],
    themeColorProps: ['color'],
  },

  // ── Particles ─────────────────────────────────────────────────────────
  {
    id: 'particles',
    name: 'Particles',
    category: 'Particles',
    icon: '· · ·',
    component: Particles,
    defaultProps: {
      particleCount: 200,
      particleSpread: 10,
      speed: 0.1,
      particleColors: ['#ffffff', '#ffffff'],
      moveParticlesOnHover: false,
      particleHoverFactor: 1,
      alphaParticles: true,
      particleBaseSize: 100,
      sizeRandomness: 1,
      cameraDistance: 20,
      disableRotation: false,
    },
    propSchema: [
      { key: 'particleCount', label: 'Count', controlType: 'slider', min: 50, max: 1000, step: 50 },
      { key: 'particleSpread', label: 'Spread', controlType: 'slider', min: 2, max: 30, step: 1 },
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.01, max: 1, step: 0.01 },
      { key: 'particleColors', label: 'Colors', controlType: 'color-array', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'moveParticlesOnHover', label: 'Hover Interaction', controlType: 'toggle' },
      { key: 'alphaParticles', label: 'Alpha Particles', controlType: 'toggle' },
      { key: 'particleBaseSize', label: 'Base Size', controlType: 'slider', min: 10, max: 500, step: 10 },
      { key: 'disableRotation', label: 'Disable Rotation', controlType: 'toggle' },
    ],
    themeColorProps: ['particleColors'],
  },
  {
    id: 'threads',
    name: 'Threads',
    category: 'Particles',
    icon: '╱╲╱',
    component: Threads,
    defaultProps: {
      color: [1, 1, 1],
      amplitude: 1,
      distance: 0,
      enableMouseInteraction: false,
      opacity: 1,
    },
    propSchema: [
      { key: 'color', label: 'Color', controlType: 'color', isThemeLinked: true, colorFormat: 'rgb-float' },
      { key: 'amplitude', label: 'Amplitude', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'distance', label: 'Distance', controlType: 'slider', min: 0, max: 5, step: 0.1 },
      { key: 'enableMouseInteraction', label: 'Mouse Interaction', controlType: 'toggle' },
      { key: 'opacity', label: 'Opacity', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
    ],
    themeColorProps: ['color'],
  },
  {
    id: 'floating-lines',
    name: 'Floating Lines',
    category: 'Particles',
    icon: '───',
    component: FloatingLines,
    defaultProps: {
      linesGradient: ['#ffffff', '#4a90d9'],
      lineCount: [6],
      lineDistance: [5],
      animationSpeed: 1,
      interactive: true,
      bendRadius: 5.0,
      bendStrength: -0.5,
      parallax: true,
      opacity: 1,
    },
    propSchema: [
      { key: 'linesGradient', label: 'Colors', controlType: 'color-array', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'lineCount', label: 'Line Count', controlType: 'slider', min: 2, max: 30, step: 1 },
      { key: 'lineDistance', label: 'Line Distance', controlType: 'slider', min: 1, max: 20, step: 1 },
      { key: 'animationSpeed', label: 'Speed', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'interactive', label: 'Interactive', controlType: 'toggle' },
      { key: 'bendRadius', label: 'Bend Radius', controlType: 'slider', min: 0.5, max: 15, step: 0.5 },
      { key: 'bendStrength', label: 'Bend Strength', controlType: 'slider', min: -2, max: 2, step: 0.1 },
      { key: 'parallax', label: 'Parallax', controlType: 'toggle' },
      { key: 'opacity', label: 'Opacity', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
    ],
    themeColorProps: ['linesGradient'],
  },
  {
    id: 'beams',
    name: 'Beams',
    category: 'Particles',
    icon: '│║│',
    component: Beams,
    defaultProps: {
      beamWidth: 2,
      beamHeight: 15,
      beamNumber: 12,
      lightColor: '#ffffff',
      speed: 2,
      noiseIntensity: 1.75,
      scale: 0.2,
      rotation: 45,
    },
    propSchema: [
      { key: 'beamWidth', label: 'Width', controlType: 'slider', min: 0.5, max: 10, step: 0.5 },
      { key: 'beamHeight', label: 'Height', controlType: 'slider', min: 5, max: 30, step: 1 },
      { key: 'beamNumber', label: 'Count', controlType: 'slider', min: 2, max: 30, step: 1 },
      { key: 'lightColor', label: 'Color', controlType: 'color', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.1, max: 10, step: 0.1 },
      { key: 'noiseIntensity', label: 'Noise', controlType: 'slider', min: 0, max: 5, step: 0.25 },
      { key: 'scale', label: 'Scale', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
      { key: 'rotation', label: 'Rotation', controlType: 'slider', min: 0, max: 360, step: 5 },
    ],
    themeColorProps: ['lightColor'],
  },

  // ── Fluid ─────────────────────────────────────────────────────────────
  {
    id: 'liquid-ether',
    name: 'Liquid Ether',
    category: 'Fluid',
    icon: '≋≋≋',
    component: LiquidEther,
    defaultProps: {
      colors: ['#5227FF', '#FF9FFC', '#B19EEF'],
      mouseForce: 20,
      cursorSize: 100,
      isViscous: false,
      resolution: 0.5,
      autoDemo: true,
      autoSpeed: 0.5,
      autoIntensity: 2.2,
      isBounce: false,
    },
    propSchema: [
      { key: 'colors', label: 'Colors', controlType: 'color-array', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'mouseForce', label: 'Mouse Force', controlType: 'slider', min: 1, max: 100, step: 1 },
      { key: 'cursorSize', label: 'Cursor Size', controlType: 'slider', min: 10, max: 500, step: 10 },
      { key: 'isViscous', label: 'Viscous', controlType: 'toggle' },
      { key: 'resolution', label: 'Resolution', controlType: 'slider', min: 0.1, max: 1, step: 0.1 },
      { key: 'autoDemo', label: 'Auto Demo', controlType: 'toggle' },
      { key: 'autoSpeed', label: 'Auto Speed', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'isBounce', label: 'Bounce', controlType: 'toggle' },
    ],
    themeColorProps: ['colors'],
  },
  {
    id: 'color-bends',
    name: 'Color Bends',
    category: 'Fluid',
    icon: '◠◡◠',
    component: ColorBends,
    defaultProps: {
      colors: ['#0066ff', '#ff6600', '#66ff00'],
      rotation: 45,
      speed: 0.2,
      autoRotate: 0,
      scale: 1,
      frequency: 1,
      warpStrength: 1,
      mouseInfluence: 0,
      noise: 0.1,
      opacity: 1,
    },
    propSchema: [
      { key: 'colors', label: 'Colors', controlType: 'color-array', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.01, max: 2, step: 0.01 },
      { key: 'rotation', label: 'Rotation', controlType: 'slider', min: 0, max: 360, step: 5 },
      { key: 'autoRotate', label: 'Auto Rotate', controlType: 'slider', min: 0, max: 5, step: 0.1 },
      { key: 'scale', label: 'Scale', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'frequency', label: 'Frequency', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'warpStrength', label: 'Warp', controlType: 'slider', min: 0, max: 5, step: 0.1 },
      { key: 'noise', label: 'Noise', controlType: 'slider', min: 0, max: 2, step: 0.05 },
      { key: 'opacity', label: 'Opacity', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
    ],
    themeColorProps: ['colors'],
  },

  // ── Light ─────────────────────────────────────────────────────────────
  {
    id: 'iridescence',
    name: 'Iridescence',
    category: 'Light',
    icon: '✦✧✦',
    component: Iridescence,
    defaultProps: {
      color: [1, 1, 1],
      speed: 1.0,
      amplitude: 0.1,
      mouseReact: false,
      opacity: 1,
    },
    propSchema: [
      { key: 'color', label: 'Color', controlType: 'color', isThemeLinked: true, colorFormat: 'rgb-float' },
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'amplitude', label: 'Amplitude', controlType: 'slider', min: 0.01, max: 0.5, step: 0.01 },
      { key: 'mouseReact', label: 'Mouse Interaction', controlType: 'toggle' },
      { key: 'opacity', label: 'Opacity', controlType: 'slider', min: 0.05, max: 1, step: 0.05 },
    ],
    themeColorProps: ['color'],
  },
  {
    id: 'prismatic-burst',
    name: 'Prismatic Burst',
    category: 'Light',
    icon: '✺ ✺',
    component: PrismaticBurst,
    defaultProps: {
      intensity: 2,
      speed: 0.5,
      animationType: 'rotate3d',
      colors: ['#ff0000', '#00ff00', '#0000ff'],
    },
    propSchema: [
      { key: 'intensity', label: 'Intensity', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'speed', label: 'Speed', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
      { key: 'animationType', label: 'Animation', controlType: 'select', options: [
        { value: 'rotate', label: 'Rotate' },
        { value: 'rotate3d', label: 'Rotate 3D' },
        { value: 'hover', label: 'Hover' },
      ]},
      { key: 'colors', label: 'Colors', controlType: 'color-array', isThemeLinked: true, colorFormat: 'hex' },
    ],
    themeColorProps: ['colors'],
  },
  {
    id: 'light-pillar',
    name: 'Light Pillar',
    category: 'Light',
    icon: '║ ║',
    component: LightPillar,
    defaultProps: {
      topColor: '#5227FF',
      bottomColor: '#FF9FFC',
      intensity: 1.0,
      rotationSpeed: 0.3,
      interactive: false,
      glowAmount: 0.005,
      pillarWidth: 3.0,
      pillarHeight: 0.4,
      noiseIntensity: 0.5,
      quality: 'high',
    },
    propSchema: [
      { key: 'topColor', label: 'Top Color', controlType: 'color', isThemeLinked: true, colorFormat: 'hex' },
      { key: 'bottomColor', label: 'Bottom Color', controlType: 'color', isThemeLinked: true, colorFormat: 'hex',
        deriveFrom: {
          sourceKey: 'topColor', darken: 0.2, desaturate: 0.1, hueShift: 0.1,
          lightMode: { lighten: 0.3, desaturate: 0.2, hueShift: 0.1 },
        } },
      { key: 'intensity', label: 'Intensity', controlType: 'slider', min: 0.1, max: 3, step: 0.1 },
      { key: 'rotationSpeed', label: 'Rotation Speed', controlType: 'slider', min: 0, max: 3, step: 0.1 },
      { key: 'interactive', label: 'Interactive', controlType: 'toggle' },
      { key: 'glowAmount', label: 'Glow', controlType: 'slider', min: 0, max: 0.05, step: 0.001 },
      { key: 'pillarWidth', label: 'Width', controlType: 'slider', min: 0.5, max: 10, step: 0.5 },
      { key: 'pillarHeight', label: 'Height', controlType: 'slider', min: 0.1, max: 2, step: 0.1 },
      { key: 'noiseIntensity', label: 'Noise', controlType: 'slider', min: 0, max: 2, step: 0.05 },
      { key: 'pillarRotation', label: 'Rotation', controlType: 'slider', min: 0, max: 360, step: 5 },
      { key: 'quality', label: 'Quality', controlType: 'select', options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
      ]},
    ],
    themeColorProps: ['topColor'],
  },
  {
    id: 'prism',
    name: 'Prism',
    category: 'Light',
    icon: '△▲△',
    component: Prism,
    defaultProps: {
      height: 3.5,
      baseWidth: 5.5,
      animationType: 'rotate',
      glow: 1,
      noise: 0.05,
      scale: 3.6,
      hueShift: 0,
      bloom: 1,
      timeScale: 0.5,
    },
    propSchema: [
      { key: 'height', label: 'Height', controlType: 'slider', min: 1, max: 10, step: 0.5 },
      { key: 'baseWidth', label: 'Base Width', controlType: 'slider', min: 1, max: 15, step: 0.5 },
      { key: 'animationType', label: 'Animation', controlType: 'select', options: [
        { value: 'rotate', label: 'Rotate' },
        { value: 'hover', label: 'Hover' },
        { value: '3drotate', label: '3D Rotate' },
      ]},
      { key: 'glow', label: 'Glow', controlType: 'slider', min: 0, max: 3, step: 0.1 },
      { key: 'noise', label: 'Noise', controlType: 'slider', min: 0, max: 2, step: 0.05 },
      { key: 'scale', label: 'Scale', controlType: 'slider', min: 0.5, max: 10, step: 0.1 },
      { key: 'hueShift', label: 'Hue Shift', controlType: 'slider', min: 0, max: 360, step: 5 },
      { key: 'bloom', label: 'Bloom', controlType: 'slider', min: 0, max: 3, step: 0.1 },
      { key: 'timeScale', label: 'Time Scale', controlType: 'slider', min: 0.1, max: 5, step: 0.1 },
    ],
    themeColorProps: [],
  },
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Map from effect type ID → registry entry */
export const EFFECT_REGISTRY: Record<string, EffectRegistryEntry> = Object.fromEntries(
  ENTRIES.map((entry) => [entry.id, entry])
)

/** All effect IDs (excluding 'none') */
export const ALL_EFFECT_IDS: AmbientEffectType[] = ENTRIES.map((e) => e.id)

/** Unique categories in display order */
export const EFFECT_CATEGORIES = ['Patterns', 'Atmosphere', 'Particles', 'Fluid', 'Light'] as const

/** Effects grouped by category */
export const EFFECTS_BY_CATEGORY = EFFECT_CATEGORIES.map((cat) => ({
  category: cat,
  effects: ENTRIES.filter((e) => e.category === cat),
}))
