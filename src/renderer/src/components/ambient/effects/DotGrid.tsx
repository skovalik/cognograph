// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

'use client';
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';

const throttle = (func: (...args: any[]) => void, limit: number) => {
  let lastCall = 0;
  let rafId: number | null = null;
  const throttled = function (this: any, ...args: any[]) {
    const now = performance.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        func.apply(this, args);
        rafId = null;
      });
    }
  };
  throttled.cancel = () => {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };
  return throttled;
};

interface Dot {
  cx: number;
  cy: number;
  xOffset: number;
  yOffset: number;
  _inertiaApplied: boolean;
  _controls: AnimationPlaybackControls[];
}

export interface DotGridProps {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  speedTrigger?: number;
  shockRadius?: number;
  shockStrength?: number;
  maxSpeed?: number;
  resistance?: number;
  returnDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}

function hexToRgb(hex: string) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16)
  };
}

const DotGrid: React.FC<DotGridProps> = ({
  dotSize = 16,
  gap = 32,
  baseColor = '#5227FF',
  activeColor = '#5227FF',
  proximity = 150,
  speedTrigger = 300,
  shockRadius = 250,
  shockStrength = 5,
  maxSpeed = 5000,
  resistance = 750,
  returnDuration = 1.5,
  className = '',
  style
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pointerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    lastTime: 0,
    lastX: 0,
    lastY: 0
  });

  const baseRgb = useMemo(() => hexToRgb(baseColor), [baseColor]);
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor]);

  const circlePath = useMemo(() => {
    if (typeof window === 'undefined' || !window.Path2D) return null;

    const p = new Path2D();
    p.arc(0, 0, dotSize / 2, 0, Math.PI * 2);
    return p;
  }, [dotSize]);

  const buildGrid = useCallback(() => {
    const wrap = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const { width, height } = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    const cols = Math.floor((width + gap) / (dotSize + gap));
    const rows = Math.floor((height + gap) / (dotSize + gap));
    const cell = dotSize + gap;

    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;

    const extraX = width - gridW;
    const extraY = height - gridH;

    const startX = extraX / 2 + dotSize / 2;
    const startY = extraY / 2 + dotSize / 2;

    const dots: Dot[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cx = startX + x * cell;
        const cy = startY + y * cell;
        dots.push({ cx, cy, xOffset: 0, yOffset: 0, _inertiaApplied: false, _controls: [] });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap]);

  useEffect(() => {
    if (!circlePath) return;

    let rafId: number;
    const proxSq = proximity * proximity;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { x: px, y: py } = pointerRef.current;

      for (const dot of dotsRef.current) {
        const ox = dot.cx + dot.xOffset;
        const oy = dot.cy + dot.yOffset;
        const dx = dot.cx - px;
        const dy = dot.cy - py;
        const dsq = dx * dx + dy * dy;

        let style = baseColor;
        if (dsq <= proxSq) {
          const dist = Math.sqrt(dsq);
          const t = 1 - dist / proximity;
          const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t);
          const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t);
          const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t);
          style = `rgb(${r},${g},${b})`;
        }

        ctx.save();
        ctx.translate(ox, oy);
        ctx.fillStyle = style;
        ctx.fill(circlePath);
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [proximity, baseColor, activeRgb, baseRgb, circlePath]);

  useEffect(() => {
    buildGrid();
    let ro: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(buildGrid);
      wrapperRef.current && ro.observe(wrapperRef.current);
    } else {
      (window as Window).addEventListener('resize', buildGrid);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', buildGrid);
    };
  }, [buildGrid]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      const pr = pointerRef.current;
      const dt = pr.lastTime ? now - pr.lastTime : 16;
      const dx = e.clientX - pr.lastX;
      const dy = e.clientY - pr.lastY;
      let vx = (dx / dt) * 1000;
      let vy = (dy / dt) * 1000;
      let speed = Math.hypot(vx, vy);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        vx *= scale;
        vy *= scale;
        speed = maxSpeed;
      }
      pr.lastTime = now;
      pr.lastX = e.clientX;
      pr.lastY = e.clientY;
      pr.vx = vx;
      pr.vy = vy;
      pr.speed = speed;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pr.x = e.clientX - rect.left;
      pr.y = e.clientY - rect.top;

      for (const dot of dotsRef.current) {
        const dist = Math.hypot(dot.cx - pr.x, dot.cy - pr.y);
        if (speed > speedTrigger && dist < proximity && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          dot._controls.forEach(c => c.stop());
          dot._controls = [];
          let pushX = (dot.cx - pr.x) * 0.3 + vx * 0.001;
          let pushY = (dot.cy - pr.y) * 0.3 + vy * 0.001;
          // Cap displacement so dots never fly far from home
          const pushMag = Math.hypot(pushX, pushY);
          const maxPush = dotSize + gap * 0.5;
          if (pushMag > maxPush) {
            const clamp = maxPush / pushMag;
            pushX *= clamp;
            pushY *= clamp;
          }
          const driftDuration = Math.min(2, resistance / 1000);
          const cx = animate(dot.xOffset, pushX, {
            duration: driftDuration,
            ease: [0.33, 1, 0.68, 1],
            onUpdate: (v) => { dot.xOffset = v; },
          });
          const cy2 = animate(dot.yOffset, pushY, {
            duration: driftDuration,
            ease: [0.33, 1, 0.68, 1],
            onUpdate: (v) => { dot.yOffset = v; },
            onComplete: () => {
              dot._controls = [];
              const rx = animate(dot.xOffset, 0, {
                duration: returnDuration,
                ease: [0.22, 1, 0.36, 1],
                onUpdate: (v) => { dot.xOffset = v; },
              });
              const ry = animate(dot.yOffset, 0, {
                duration: returnDuration,
                ease: [0.22, 1, 0.36, 1],
                onUpdate: (v) => { dot.yOffset = v; },
                onComplete: () => { dot._inertiaApplied = false; },
              });
              dot._controls = [rx, ry];
            },
          });
          dot._controls = [cx, cy2];
        }
      }
    };

    const onClick = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      for (const dot of dotsRef.current) {
        const dist = Math.hypot(dot.cx - clickX, dot.cy - clickY);
        if (dist < shockRadius && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          dot._controls.forEach(c => c.stop());
          dot._controls = [];
          const falloff = Math.max(0, 1 - dist / shockRadius);
          let pushX = (dot.cx - clickX) * shockStrength * falloff;
          let pushY = (dot.cy - clickY) * shockStrength * falloff;
          // Cap shock displacement
          const pushMag = Math.hypot(pushX, pushY);
          const maxPush = (dotSize + gap) * 1.5;
          if (pushMag > maxPush) {
            const clamp = maxPush / pushMag;
            pushX *= clamp;
            pushY *= clamp;
          }
          const driftDuration = Math.min(2, resistance / 1000);
          const ax = animate(dot.xOffset, pushX, {
            duration: driftDuration,
            ease: [0.33, 1, 0.68, 1],
            onUpdate: (v) => { dot.xOffset = v; },
          });
          const ay = animate(dot.yOffset, pushY, {
            duration: driftDuration,
            ease: [0.33, 1, 0.68, 1],
            onUpdate: (v) => { dot.yOffset = v; },
            onComplete: () => {
              dot._controls = [];
              const rx = animate(dot.xOffset, 0, {
                duration: returnDuration,
                ease: [0.22, 1, 0.36, 1],
                onUpdate: (v) => { dot.xOffset = v; },
              });
              const ry = animate(dot.yOffset, 0, {
                duration: returnDuration,
                ease: [0.22, 1, 0.36, 1],
                onUpdate: (v) => { dot.yOffset = v; },
                onComplete: () => { dot._inertiaApplied = false; },
              });
              dot._controls = [rx, ry];
            },
          });
          dot._controls = [ax, ay];
        }
      }
    };

    const throttledMove = throttle(onMove, 16);
    window.addEventListener('mousemove', throttledMove, { passive: true });
    window.addEventListener('click', onClick);

    return () => {
      throttledMove.cancel();
      window.removeEventListener('mousemove', throttledMove);
      window.removeEventListener('click', onClick);
    };
  }, [dotSize, gap, maxSpeed, speedTrigger, proximity, resistance, returnDuration, shockRadius, shockStrength]);

  return (
    <section className={`p-4 flex items-center justify-center h-full w-full relative ${className}`} style={style}>
      <div ref={wrapperRef} className="w-full h-full relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>
    </section>
  );
};

export default DotGrid;
