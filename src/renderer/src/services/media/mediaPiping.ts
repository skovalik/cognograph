// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { ArtifactNodeData, ArtifactMediaMetadata } from '@shared/types/nodes'

const MEDIA_CONTENT_TYPES = ['image', 'video', 'audio', '3d-model'] as const
type MediaContentType = typeof MEDIA_CONTENT_TYPES[number]

export function isMediaArtifact(artifact: ArtifactNodeData): boolean {
  return MEDIA_CONTENT_TYPES.includes(artifact.contentType as MediaContentType)
}

export interface SerializedMediaContext {
  type: string
  url: string
  prompt?: string
  dimensions?: { width: number; height: number }
  mimeType: string
  duration?: number
  provider?: string
}

export function serializeMediaForContext(artifact: ArtifactNodeData): SerializedMediaContext | null {
  if (!isMediaArtifact(artifact)) return null

  const meta = artifact.metadata as ArtifactMediaMetadata | undefined
  if (!meta?.storageUrl) return null

  return {
    type: artifact.contentType,
    url: meta.storageUrl,
    prompt: meta.prompt,
    dimensions: meta.dimensions,
    mimeType: meta.mimeType,
    duration: meta.duration,
    provider: meta.provider,
  }
}

/**
 * Build context string for agent consumption.
 * Media artifacts: JSON with URL + metadata.
 * Text artifacts: raw content.
 */
export function serializeArtifactForContext(artifact: ArtifactNodeData): string {
  const media = serializeMediaForContext(artifact)
  if (media) {
    return JSON.stringify(media)
  }
  return artifact.content ?? ''
}
