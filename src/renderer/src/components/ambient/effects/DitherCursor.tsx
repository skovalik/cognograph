// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/* eslint-disable react/no-unknown-property */
/**
 * DitherCursor — Bayer-dithered cursor trail effect.
 *
 * Ported from aurochs.agency vanilla WebGL2 implementation.
 * Two-pass pipeline: simulation (curl noise + diffusion) → Bayer 8x8 dither display.
 * Renders as a full-viewport overlay that follows the cursor.
 */

import { useRef, useEffect, useCallback, forwardRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const SIM_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const SIM_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uMouse;
uniform sampler2D uPreviousState;
uniform vec2 uResolution;
uniform float uRadius;
uniform float uDecay;
uniform float uIntensity;
uniform float uSpeed;
varying vec2 vUv;

vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289v3(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec2 curl(vec2 p) {
  float eps = 0.1;
  float n1 = snoise(p + vec2(0.0, eps));
  float n2 = snoise(p - vec2(0.0, eps));
  float n3 = snoise(p + vec2(eps, 0.0));
  float n4 = snoise(p - vec2(eps, 0.0));
  return vec2((n1 - n2) / (2.0 * eps), (n3 - n4) / (2.0 * eps));
}

void main() {
  vec2 uv = vUv;
  vec2 texel = 1.0 / uResolution;
  vec2 noiseUV = uv * 0.5;
  vec2 velocity = curl(noiseUV + uTime * 0.1);
  float advectionStrength = 0.001;
  vec2 advectedUV = uv - velocity * advectionStrength;

  float prev = texture2D(uPreviousState, advectedUV).r;
  float top = texture2D(uPreviousState, advectedUV + vec2(0.0, texel.y)).r;
  float bottom = texture2D(uPreviousState, advectedUV - vec2(0.0, texel.y)).r;
  float left = texture2D(uPreviousState, advectedUV - vec2(texel.x, 0.0)).r;
  float right = texture2D(uPreviousState, advectedUV + vec2(texel.x, 0.0)).r;
  float diffused = (prev + top + bottom + left + right) / 5.0;

  float aspect = uResolution.x / uResolution.y;
  vec2 aspectCorrection = vec2(aspect, 1.0);
  float dist = length((uv - uMouse) * aspectCorrection);
  float brush = exp(-pow(dist / uRadius, 2.0));
  float speedFactor = smoothstep(0.0, 0.01, uSpeed);
  brush *= uIntensity * speedFactor * 0.5;

  float value = min(0.95, diffused + brush);
  value -= uDecay;
  gl_FragColor = vec4(vec3(max(0.0, value)), 1.0);
}
`

const DITHER_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const DITHER_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uSimulationState;
uniform float uDitherSize;
uniform float uExponent;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;

float bayer8(vec2 uv) {
  int x = int(mod(uv.x, 8.0));
  int y = int(mod(uv.y, 8.0));
  // Bayer 8x8 matrix (inlined for WebGL1 compat)
  int idx = y * 8 + x;
  float val = 0.0;
  // Row 0
  if (idx == 0) val = 0.0; else if (idx == 1) val = 32.0;
  else if (idx == 2) val = 8.0; else if (idx == 3) val = 40.0;
  else if (idx == 4) val = 2.0; else if (idx == 5) val = 34.0;
  else if (idx == 6) val = 10.0; else if (idx == 7) val = 42.0;
  // Row 1
  else if (idx == 8) val = 48.0; else if (idx == 9) val = 16.0;
  else if (idx == 10) val = 56.0; else if (idx == 11) val = 24.0;
  else if (idx == 12) val = 50.0; else if (idx == 13) val = 18.0;
  else if (idx == 14) val = 58.0; else if (idx == 15) val = 26.0;
  // Row 2
  else if (idx == 16) val = 12.0; else if (idx == 17) val = 44.0;
  else if (idx == 18) val = 4.0; else if (idx == 19) val = 36.0;
  else if (idx == 20) val = 14.0; else if (idx == 21) val = 46.0;
  else if (idx == 22) val = 6.0; else if (idx == 23) val = 38.0;
  // Row 3
  else if (idx == 24) val = 60.0; else if (idx == 25) val = 28.0;
  else if (idx == 26) val = 52.0; else if (idx == 27) val = 20.0;
  else if (idx == 28) val = 62.0; else if (idx == 29) val = 30.0;
  else if (idx == 30) val = 54.0; else if (idx == 31) val = 22.0;
  // Row 4
  else if (idx == 32) val = 3.0; else if (idx == 33) val = 35.0;
  else if (idx == 34) val = 11.0; else if (idx == 35) val = 43.0;
  else if (idx == 36) val = 1.0; else if (idx == 37) val = 33.0;
  else if (idx == 38) val = 9.0; else if (idx == 39) val = 41.0;
  // Row 5
  else if (idx == 40) val = 51.0; else if (idx == 41) val = 19.0;
  else if (idx == 42) val = 59.0; else if (idx == 43) val = 27.0;
  else if (idx == 44) val = 49.0; else if (idx == 45) val = 17.0;
  else if (idx == 46) val = 57.0; else if (idx == 47) val = 25.0;
  // Row 6
  else if (idx == 48) val = 15.0; else if (idx == 49) val = 47.0;
  else if (idx == 50) val = 7.0; else if (idx == 51) val = 39.0;
  else if (idx == 52) val = 13.0; else if (idx == 53) val = 45.0;
  else if (idx == 54) val = 5.0; else if (idx == 55) val = 37.0;
  // Row 7
  else if (idx == 56) val = 63.0; else if (idx == 57) val = 31.0;
  else if (idx == 58) val = 55.0; else if (idx == 59) val = 23.0;
  else if (idx == 60) val = 61.0; else if (idx == 61) val = 29.0;
  else if (idx == 62) val = 53.0; else val = 21.0;

  return val / 64.0;
}

void main() {
  float signal = texture2D(uSimulationState, vUv).r;
  signal = pow(signal, uExponent);
  float threshold = bayer8(gl_FragCoord.xy / uDitherSize);
  float mask = step(threshold, signal);
  if (signal < 0.01) mask = 0.0;
  gl_FragColor = vec4(uColor, mask * uOpacity);
}
`

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DitherCursorProps {
  color?: number[]      // RGB 0-1 float array [r, g, b]
  radius?: number       // Brush radius (0.01-0.5)
  decay?: number        // Fade speed (0.001-0.05)
  intensity?: number    // Brush strength (0.05-1.0)
  ditherSize?: number   // Dither pattern scale (1-8)
  exponent?: number     // Contrast curve (1-4)
  opacity?: number      // Overall opacity (0-1)
}

// ---------------------------------------------------------------------------
// Inner scene (runs inside Canvas)
// ---------------------------------------------------------------------------

function DitherCursorScene({
  color = [0.78, 0.59, 0.24],
  radius = 0.08,
  decay = 0.015,
  intensity = 0.2,
  ditherSize = 3.0,
  exponent = 2.5,
  opacity = 1,
}: DitherCursorProps) {
  const { size, gl } = useThree()
  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const prevMouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const speedRef = useRef(0)
  const frameRef = useRef(0)

  // Double-buffered render targets
  const rtA = useRef<THREE.WebGLRenderTarget | null>(null)
  const rtB = useRef<THREE.WebGLRenderTarget | null>(null)

  // Materials
  const simMatRef = useRef<THREE.ShaderMaterial | null>(null)
  const ditherMatRef = useRef<THREE.ShaderMaterial | null>(null)

  // Scene + camera for offscreen rendering
  const simScene = useRef(new THREE.Scene())
  const simCamera = useRef(new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1))
  const ditherScene = useRef(new THREE.Scene())

  // Create render targets on mount and resize
  useEffect(() => {
    const w = Math.max(1, size.width)
    const h = Math.max(1, size.height)
    const opts: THREE.WebGLRenderTargetOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    }

    rtA.current?.dispose()
    rtB.current?.dispose()
    rtA.current = new THREE.WebGLRenderTarget(w, h, opts)
    rtB.current = new THREE.WebGLRenderTarget(w, h, opts)

    return () => {
      rtA.current?.dispose()
      rtB.current?.dispose()
    }
  }, [size.width, size.height])

  // Build simulation quad
  useEffect(() => {
    const geo = new THREE.PlaneGeometry(2, 2)
    const simMat = new THREE.ShaderMaterial({
      vertexShader: SIM_VERTEX,
      fragmentShader: SIM_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uPreviousState: { value: null },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uRadius: { value: radius },
        uDecay: { value: decay },
        uIntensity: { value: intensity },
        uSpeed: { value: 0 },
      },
    })
    simMatRef.current = simMat
    const simMesh = new THREE.Mesh(geo, simMat)
    simScene.current.add(simMesh)

    const ditherMat = new THREE.ShaderMaterial({
      vertexShader: DITHER_VERTEX,
      fragmentShader: DITHER_FRAGMENT,
      transparent: true,
      uniforms: {
        uSimulationState: { value: null },
        uDitherSize: { value: ditherSize },
        uExponent: { value: exponent },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uColor: { value: new THREE.Vector3(color[0], color[1], color[2]) },
        uOpacity: { value: opacity },
      },
    })
    ditherMatRef.current = ditherMat
    const ditherMesh = new THREE.Mesh(geo.clone(), ditherMat)
    ditherScene.current.add(ditherMesh)

    return () => {
      geo.dispose()
      simMat.dispose()
      ditherMat.dispose()
    }
    // Only rebuild on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.set(
        e.clientX / window.innerWidth,
        1.0 - e.clientY / window.innerHeight
      )
    }
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) {
        mouseRef.current.set(
          t.clientX / window.innerWidth,
          1.0 - t.clientY / window.innerHeight
        )
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('touchmove', onTouch, { passive: true })
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('touchmove', onTouch)
    }
  }, [])

  // Update uniforms when props change
  useEffect(() => {
    if (simMatRef.current) {
      simMatRef.current.uniforms.uRadius.value = radius
      simMatRef.current.uniforms.uDecay.value = decay
      simMatRef.current.uniforms.uIntensity.value = intensity
    }
  }, [radius, decay, intensity])

  useEffect(() => {
    if (ditherMatRef.current) {
      ditherMatRef.current.uniforms.uDitherSize.value = ditherSize
      ditherMatRef.current.uniforms.uExponent.value = exponent
      ditherMatRef.current.uniforms.uColor.value.set(color[0], color[1], color[2])
      ditherMatRef.current.uniforms.uOpacity.value = opacity
    }
  }, [color, ditherSize, exponent, opacity])

  useEffect(() => {
    if (simMatRef.current) {
      simMatRef.current.uniforms.uResolution.value.set(size.width, size.height)
    }
    if (ditherMatRef.current) {
      ditherMatRef.current.uniforms.uResolution.value.set(size.width, size.height)
    }
  }, [size.width, size.height])

  // Render loop
  useFrame(({ clock }) => {
    if (!rtA.current || !rtB.current || !simMatRef.current || !ditherMatRef.current) return

    const readRT = frameRef.current % 2 === 0 ? rtB.current : rtA.current
    const writeRT = frameRef.current % 2 === 0 ? rtA.current : rtB.current

    // Speed calculation
    const dx = mouseRef.current.x - prevMouseRef.current.x
    const dy = mouseRef.current.y - prevMouseRef.current.y
    speedRef.current += (Math.sqrt(dx * dx + dy * dy) - speedRef.current) * 0.1
    prevMouseRef.current.copy(mouseRef.current)

    // Simulation pass
    simMatRef.current.uniforms.uTime.value = clock.elapsedTime
    simMatRef.current.uniforms.uMouse.value.copy(mouseRef.current)
    simMatRef.current.uniforms.uPreviousState.value = readRT.texture
    simMatRef.current.uniforms.uSpeed.value = speedRef.current

    const prevRT = gl.getRenderTarget()
    gl.setRenderTarget(writeRT)
    gl.render(simScene.current, simCamera.current)

    // Dither display pass — render to screen
    ditherMatRef.current.uniforms.uSimulationState.value = writeRT.texture
    gl.setRenderTarget(prevRT)
    gl.render(ditherScene.current, simCamera.current)

    frameRef.current++
  })

  return null
}

// ---------------------------------------------------------------------------
// Wrapper (provides Canvas context)
// ---------------------------------------------------------------------------

const DitherCursor = forwardRef<HTMLDivElement, DitherCursorProps>(function DitherCursor(props, ref) {
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <Canvas
        gl={{ alpha: true, antialias: false, premultipliedAlpha: false }}
        style={{ background: 'transparent' }}
        resize={{ scroll: false }}
      >
        <DitherCursorScene {...props} />
      </Canvas>
    </div>
  )
})

export default DitherCursor
