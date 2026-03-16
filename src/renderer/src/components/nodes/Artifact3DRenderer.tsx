// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useRef, useEffect, useState, useCallback } from 'react'
import { Box, RotateCcw } from 'lucide-react'
import { viewportPool } from './Artifact3DViewportPool'
import type { ArtifactMediaMetadata } from '@shared/types/nodes'

interface Artifact3DRendererProps {
  nodeId: string
  storageUrl: string
  thumbnailUrl?: string
  title: string
  metadata?: ArtifactMediaMetadata
}

export const Artifact3DRenderer = memo(function Artifact3DRenderer({
  nodeId,
  storageUrl,
  thumbnailUrl,
  title,
  metadata,
}: Artifact3DRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLive, setIsLive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activateViewport = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || isLive) return

    try {
      // Acquire a viewport slot (may evict LRU)
      viewportPool.acquire(nodeId, canvas)
      setIsLive(true)

      // Dynamic import Three.js only when needed
      const [THREE, { GLTFLoader }] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
      ])

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1a1a2e)

      const camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 100)
      camera.position.set(0, 1, 3)
      camera.lookAt(0, 0, 0)

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      renderer.setSize(canvas.width, canvas.height)

      // Lighting
      const ambient = new THREE.AmbientLight(0xffffff, 0.5)
      scene.add(ambient)
      const directional = new THREE.DirectionalLight(0xffffff, 1)
      directional.position.set(5, 5, 5)
      scene.add(directional)

      // Load GLTF
      const loader = new GLTFLoader()
      loader.load(
        storageUrl,
        (gltf) => {
          // Auto-center and scale model
          const box = new THREE.Box3().setFromObject(gltf.scene)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 2 / maxDim
          gltf.scene.scale.setScalar(scale)
          gltf.scene.position.sub(center.multiplyScalar(scale))
          scene.add(gltf.scene)

          // Simple auto-rotation
          let frameId: number
          const animate = () => {
            frameId = requestAnimationFrame(animate)
            gltf.scene.rotation.y += 0.005
            viewportPool.touch(nodeId)
            renderer.render(scene, camera)
          }
          animate()

          // Cleanup on unmount
          return () => {
            cancelAnimationFrame(frameId)
            renderer.dispose()
          }
        },
        undefined,
        () => {
          setError('Failed to load 3D model')
          setIsLive(false)
          viewportPool.release(nodeId)
        }
      )
    } catch {
      setError('3D rendering unavailable')
      setIsLive(false)
    }
  }, [nodeId, storageUrl, isLive])

  // Release viewport on unmount
  useEffect(() => {
    return () => {
      viewportPool.release(nodeId)
    }
  }, [nodeId])

  // Show thumbnail fallback if not live
  if (!isLive && !error) {
    return (
      <div
        className="relative flex items-center justify-center rounded overflow-hidden cursor-pointer"
        style={{
          backgroundColor: 'var(--node-bg-secondary)',
          height: 160,
        }}
        onClick={activateViewport}
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <Box size={32} className="text-[var(--node-text-muted)] opacity-40" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <RotateCcw size={24} className="text-white opacity-80" />
          <span className="ml-2 text-white text-xs opacity-80">Click to load 3D</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded p-4"
        style={{ backgroundColor: 'var(--node-bg-secondary)', color: 'var(--node-text-muted)' }}
      >
        <Box size={16} />
        <span className="text-xs">{error}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <canvas
        ref={canvasRef}
        width={280}
        height={160}
        className="w-full rounded"
        style={{ height: 160, display: 'block' }}
      />
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--node-text-muted)]">
        <Box size={10} />
        <span>3D Model</span>
        {metadata?.provider && <span>· {metadata.provider}</span>}
      </div>
    </div>
  )
})
