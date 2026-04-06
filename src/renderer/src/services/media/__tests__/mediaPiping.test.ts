// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it } from 'vitest'
import {
  isMediaArtifact,
  serializeArtifactForContext,
  serializeMediaForContext,
} from '../mediaPiping'

describe('mediaPiping', () => {
  it('identifies media content types', () => {
    expect(isMediaArtifact({ contentType: 'image' } as any)).toBe(true)
    expect(isMediaArtifact({ contentType: 'video' } as any)).toBe(true)
    expect(isMediaArtifact({ contentType: 'audio' } as any)).toBe(true)
    expect(isMediaArtifact({ contentType: '3d-model' } as any)).toBe(true)
    expect(isMediaArtifact({ contentType: 'code' } as any)).toBe(false)
    expect(isMediaArtifact({ contentType: 'markdown' } as any)).toBe(false)
    expect(isMediaArtifact({ contentType: 'html' } as any)).toBe(false)
    expect(isMediaArtifact({ contentType: 'text' } as any)).toBe(false)
  })

  it('serializes image artifact with metadata', () => {
    const artifact = {
      contentType: 'image',
      metadata: {
        storageUrl: 'https://r2.cognograph.app/artifacts/abc/image.png',
        prompt: 'A sunset over mountains',
        dimensions: { width: 1024, height: 1024 },
        mimeType: 'image/png',
        provider: 'stability',
        generatedAt: Date.now(),
      },
    }
    const result = serializeMediaForContext(artifact as any)
    expect(result).toEqual({
      type: 'image',
      url: 'https://r2.cognograph.app/artifacts/abc/image.png',
      prompt: 'A sunset over mountains',
      dimensions: { width: 1024, height: 1024 },
      mimeType: 'image/png',
      duration: undefined,
      provider: 'stability',
    })
  })

  it('serializes video artifact with duration', () => {
    const artifact = {
      contentType: 'video',
      metadata: {
        storageUrl: 'https://r2.cognograph.app/artifacts/abc/clip.mp4',
        mimeType: 'video/mp4',
        provider: 'runway',
        duration: 10,
        generatedAt: Date.now(),
      },
    }
    const result = serializeMediaForContext(artifact as any)
    expect(result?.type).toBe('video')
    expect(result?.duration).toBe(10)
    expect(result?.url).toContain('clip.mp4')
  })

  it('returns null for non-media artifacts', () => {
    expect(serializeMediaForContext({ contentType: 'code', content: 'hello' } as any)).toBeNull()
    expect(serializeMediaForContext({ contentType: 'markdown', content: '# hi' } as any)).toBeNull()
  })

  it('returns null for media without storageUrl', () => {
    expect(serializeMediaForContext({ contentType: 'image', metadata: {} } as any)).toBeNull()
    expect(serializeMediaForContext({ contentType: 'video' } as any)).toBeNull()
  })

  it('serializeArtifactForContext returns JSON for media', () => {
    const artifact = {
      contentType: 'video',
      metadata: {
        storageUrl: 'https://r2.example.com/v.mp4',
        mimeType: 'video/mp4',
        provider: 'runway',
        generatedAt: Date.now(),
      },
    }
    const result = serializeArtifactForContext(artifact as any)
    const parsed = JSON.parse(result)
    expect(parsed.type).toBe('video')
    expect(parsed.url).toBe('https://r2.example.com/v.mp4')
  })

  it('serializeArtifactForContext returns raw content for text', () => {
    const artifact = { contentType: 'markdown', content: '# Hello' }
    expect(serializeArtifactForContext(artifact as any)).toBe('# Hello')
  })

  it('serializeArtifactForContext returns empty string for text with no content', () => {
    const artifact = { contentType: 'text' }
    expect(serializeArtifactForContext(artifact as any)).toBe('')
  })
})
