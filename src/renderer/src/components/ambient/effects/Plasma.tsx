// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { Mesh, Program, Renderer, Triangle } from 'ogl'
import type React from 'react'
import { useEffect, useRef } from 'react'
import type { AdaptiveQualityState } from '../../../hooks/useAdaptiveQuality'

interface PlasmaProps {
  color?: string
  speed?: number
  direction?: 'forward' | 'reverse' | 'pingpong'
  scale?: number
  opacity?: number
  mouseInteractive?: boolean
  isDark?: boolean
  bgColor?: string
  qualityRef?: React.RefObject<AdaptiveQualityState>
  reportFrame?: () => void
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [1, 0.5, 0.2]
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ]
}

const vertex = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uCustomColor;
uniform float uUseCustomColor;
uniform float uSpeed;
uniform float uDirection;
uniform float uScale;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uMouseInteractive;
uniform float uDarkMix;
uniform vec3 uBgColor;
out vec4 fragColor;

void mainImage(out vec4 o, vec2 C) {
  vec2 center = iResolution.xy * 0.5;
  C = (C - center) / uScale + center;

  vec2 mouseOffset = (uMouse - center) * 0.0002;
  C += mouseOffset * length(C - center) * step(0.5, uMouseInteractive);

  float i, d, z, T = iTime * uSpeed * uDirection;
  vec3 O, p, S;

  for (vec2 r = iResolution.xy, Q; ++i < 60.; O += o.w/d*o.xyz) {
    p = z*normalize(vec3(C-.5*r,r.y));
    p.z -= 4.;
    S = p;
    d = p.y-T;

    p.x += .4*(1.+p.y)*sin(d + p.x*0.1)*cos(.34*d + p.x*0.05);
    Q = p.xz *= mat2(cos(p.y+vec4(0,11,33,0)-T));
    z+= d = abs(sqrt(length(Q*Q)) - .25*(5.+S.y))/3.+8e-4;
    o = 1.+sin(S.y+p.z*.5+S.z-length(S-p)+vec4(2,1,0,8));
  }

  o.xyz = tanh(O/1e4);
}

bool finite1(float x){ return !(isnan(x) || isinf(x)); }
vec3 sanitize(vec3 c){
  return vec3(
    finite1(c.r) ? c.r : 0.0,
    finite1(c.g) ? c.g : 0.0,
    finite1(c.b) ? c.b : 0.0
  );
}

void main() {
  vec4 o = vec4(0.0);
  mainImage(o, gl_FragCoord.xy);
  vec3 rgb = sanitize(o.rgb);

  float intensity = (rgb.r + rgb.g + rgb.b) / 3.0;
  vec3 cd = intensity * uCustomColor;
  float ad = length(rgb) * uOpacity;
  vec3 cl = mix(uBgColor, uCustomColor, intensity);
  float al = uOpacity;
  vec3 customColor = mix(cl, cd, uDarkMix);
  float alpha = mix(al, ad, uDarkMix);
  vec3 finalColor = mix(rgb, customColor, step(0.5, uUseCustomColor));

  fragColor = vec4(finalColor * alpha, alpha);
}`

export const Plasma: React.FC<PlasmaProps> = ({
  color = '#ffffff',
  speed = 1,
  direction = 'forward',
  scale = 1,
  opacity = 1,
  mouseInteractive = true,
  isDark = true,
  bgColor,
  qualityRef,
  reportFrame: reportFrameFn,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mousePos = useRef({ x: 0, y: 0 })
  const programRef = useRef<Program | null>(null)
  const darkTargetRef = useRef(isDark ? 1.0 : 0.0)
  const bgTargetRef = useRef<[number, number, number]>(
    bgColor ? hexToRgb(bgColor) : ((isDark ? [0, 0, 0] : [1, 1, 1]) as [number, number, number]),
  )

  // Hot-update uniforms without tearing down the OGL renderer
  useEffect(() => {
    const p = programRef.current
    if (!p) return
    const rgb = color ? hexToRgb(color) : ([1, 1, 1] as [number, number, number])
    const colorArr = p.uniforms.uCustomColor.value as Float32Array
    colorArr[0] = rgb[0]
    colorArr[1] = rgb[1]
    colorArr[2] = rgb[2]
    darkTargetRef.current = isDark ? 1.0 : 0.0
    ;(p.uniforms.uOpacity as any).value = opacity
    ;(p.uniforms.uSpeed as any).value = speed * 0.4
    ;(p.uniforms.uScale as any).value = scale
    bgTargetRef.current = bgColor
      ? hexToRgb(bgColor)
      : ((isDark ? [0, 0, 0] : [1, 1, 1]) as [number, number, number])
  }, [color, isDark, opacity, speed, scale, bgColor])

  // Setup — only rebuilds on direction or mouseInteractive change
  useEffect(() => {
    if (!containerRef.current) return

    const useCustomColor = color ? 1.0 : 0.0
    const customColorRgb = color ? hexToRgb(color) : [1, 1, 1]

    const directionMultiplier = direction === 'reverse' ? -1.0 : 1.0

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      antialias: false,
      dpr: 1.0,
    })
    const gl = renderer.gl
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    containerRef.current.appendChild(canvas)

    const geometry = new Triangle(gl)

    const program = new Program(gl, {
      vertex: vertex,
      fragment: fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uCustomColor: { value: new Float32Array(customColorRgb) },
        uUseCustomColor: { value: useCustomColor },
        uSpeed: { value: speed * 0.4 },
        uDirection: { value: directionMultiplier },
        uScale: { value: scale },
        uOpacity: { value: opacity },
        uMouse: { value: new Float32Array([0, 0]) },
        uMouseInteractive: { value: mouseInteractive ? 1.0 : 0.0 },
        uDarkMix: { value: isDark ? 1.0 : 0.0 },
        uBgColor: {
          value: new Float32Array(bgColor ? hexToRgb(bgColor) : isDark ? [0, 0, 0] : [1, 1, 1]),
        },
      },
    })
    programRef.current = program

    const mesh = new Mesh(gl, { geometry, program })

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseInteractive) return
      const rect = containerRef.current!.getBoundingClientRect()
      mousePos.current.x = e.clientX - rect.left
      mousePos.current.y = e.clientY - rect.top
      const mouseUniform = program.uniforms.uMouse.value as Float32Array
      mouseUniform[0] = mousePos.current.x
      mouseUniform[1] = mousePos.current.y
    }

    if (mouseInteractive) {
      containerRef.current.addEventListener('mousemove', handleMouseMove)
    }

    const setSize = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      renderer.setSize(width, height)
      const res = program.uniforms.iResolution.value as Float32Array
      res[0] = gl.drawingBufferWidth
      res[1] = gl.drawingBufferHeight
    }

    const ro = new ResizeObserver(setSize)
    ro.observe(containerRef.current)
    setSize()

    let raf = 0
    let frameCount = 0
    let currentScale = -1
    const t0 = performance.now()
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (qualityRef?.current && !qualityRef.current.shouldRender) return
      if (reportFrameFn) reportFrameFn()
      if (qualityRef?.current?.frameSkip && ++frameCount % 2 === 0) return
      if (gl.drawingBufferWidth === 0 || gl.drawingBufferHeight === 0) return
      if (qualityRef?.current) {
        const scale = qualityRef.current.resolutionScale * qualityRef.current.dprCap
        if (scale !== currentScale) {
          currentScale = scale
          const rect = containerRef.current!.getBoundingClientRect()
          const w = Math.max(1, Math.floor(rect.width * scale))
          const h = Math.max(1, Math.floor(rect.height * scale))
          renderer.setSize(w, h)
          const c = renderer.gl.canvas as HTMLCanvasElement
          c.style.width = '100%'
          c.style.height = '100%'
          const res = program.uniforms.iResolution.value as Float32Array
          res[0] = gl.drawingBufferWidth
          res[1] = gl.drawingBufferHeight
        }
      }
      const timeValue = (t - t0) * 0.001
      if (direction === 'pingpong') {
        const pingpongDuration = 10
        const segmentTime = timeValue % pingpongDuration
        const isForward = Math.floor(timeValue / pingpongDuration) % 2 === 0
        const u = segmentTime / pingpongDuration
        const smooth = u * u * (3 - 2 * u)
        const pingpongTime = isForward ? smooth * pingpongDuration : (1 - smooth) * pingpongDuration
        ;(program.uniforms.uDirection as any).value = 1.0
        ;(program.uniforms.iTime as any).value = pingpongTime
      } else {
        ;(program.uniforms.iTime as any).value = timeValue
      }
      // Smooth dark/light + bgColor transitions (0.15/frame ≈ 333ms to 95%)
      const dm = (program.uniforms.uDarkMix as any).value as number
      const dmt = darkTargetRef.current
      if (Math.abs(dm - dmt) > 0.001) {
        ;(program.uniforms.uDarkMix as any).value = dm + (dmt - dm) * 0.15
      }
      const bgArr = program.uniforms.uBgColor.value as Float32Array
      const bgt = bgTargetRef.current
      for (let i = 0; i < 3; i++) {
        if (Math.abs(bgArr[i] - bgt[i]) > 0.001) bgArr[i] += (bgt[i] - bgArr[i]) * 0.15
      }

      renderer.render({ scene: mesh })
    }
    raf = requestAnimationFrame(loop)

    return () => {
      programRef.current = null
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (mouseInteractive && containerRef.current) {
        containerRef.current.removeEventListener('mousemove', handleMouseMove)
      }
      try {
        containerRef.current?.removeChild(canvas)
      } catch {}
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [direction, mouseInteractive])

  return <div ref={containerRef} className="w-full h-full relative overflow-hidden" />
}

export default Plasma
