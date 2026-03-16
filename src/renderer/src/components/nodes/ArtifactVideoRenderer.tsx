// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
import type { ArtifactMediaMetadata } from '@shared/types/nodes'

interface ArtifactVideoRendererProps {
  storageUrl: string
  thumbnailUrl?: string
  title: string
  metadata?: ArtifactMediaMetadata
}

export const ArtifactVideoRenderer = memo(function ArtifactVideoRenderer({
  storageUrl,
  thumbnailUrl,
  title,
  metadata,
}: ArtifactVideoRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Lazy loading via IntersectionObserver
  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !video.src) {
          video.src = storageUrl
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [storageUrl])

  return (
    <div ref={containerRef} className="flex flex-col gap-1">
      <video
        ref={videoRef}
        controls
        poster={thumbnailUrl}
        preload="none"
        className="w-full max-h-48 rounded object-contain"
        style={{ backgroundColor: 'var(--node-bg-secondary)' }}
        title={title}
      />
      {metadata?.duration && (
        <span className="text-[10px] text-[var(--node-text-muted)]">
          {Math.floor(metadata.duration)}s
          {metadata.dimensions && ` · ${metadata.dimensions.width}×${metadata.dimensions.height}`}
        </span>
      )}
    </div>
  )
})
