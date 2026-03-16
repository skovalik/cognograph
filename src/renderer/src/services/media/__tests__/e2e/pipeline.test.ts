import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAvailableMediaTools } from '../../agentToolRegistry'
import { useJobManager } from '../../jobManager'
import { viewportPool } from '../../../../components/nodes/Artifact3DViewportPool'
import { isMediaArtifact, serializeArtifactForContext, serializeMediaForContext } from '../../mediaPiping'

describe('Creative pipeline (integration)', () => {
  beforeEach(() => {
    useJobManager.setState({ jobs: new Map() })
    // Reset localStorage
    const providerNames = ['stability', 'openai', 'google', 'replicate', 'runway', 'elevenlabs']
    for (const p of providerNames) {
      localStorage.removeItem(`cognograph:apikey:${p}`)
    }
  })

  it('no tools available when no keys configured', () => {
    const tools = getAvailableMediaTools()
    expect(tools).toHaveLength(0)
  })

  it('adding Stability key makes generate_image tool available', () => {
    localStorage.setItem('cognograph:apikey:stability', 'sk-test-123')
    const tools = getAvailableMediaTools()
    const imageTools = tools.filter(t => t.name === 'generate_image')
    expect(imageTools.length).toBeGreaterThanOrEqual(1)
  })

  it('adding ElevenLabs key makes generate_audio tool available', () => {
    localStorage.setItem('cognograph:apikey:elevenlabs', 'el-test-123')
    const tools = getAvailableMediaTools()
    const audioTools = tools.filter(t => t.name === 'generate_audio')
    expect(audioTools.length).toBeGreaterThanOrEqual(1)
  })

  it('adding Runway key makes generate_video tool available', () => {
    localStorage.setItem('cognograph:apikey:runway', 'rw-test-123')
    const tools = getAvailableMediaTools()
    const videoTools = tools.filter(t => t.name === 'generate_video')
    expect(videoTools.length).toBeGreaterThanOrEqual(1)
  })

  it('media artifact serializes to URL for downstream piping', () => {
    const artifact = {
      contentType: 'image' as const,
      content: '',
      metadata: {
        storageUrl: 'https://r2.cognograph.app/artifacts/u1/a1/image.png',
        prompt: 'A sunrise',
        dimensions: { width: 1024, height: 1024 },
        mimeType: 'image/png',
        provider: 'stability',
        generatedAt: Date.now(),
      },
    }

    expect(isMediaArtifact(artifact as any)).toBe(true)
    const serialized = serializeMediaForContext(artifact as any)
    expect(serialized).not.toBeNull()
    expect(serialized!.url).toBe('https://r2.cognograph.app/artifacts/u1/a1/image.png')
    expect(serialized!.mimeType).toBe('image/png')
    expect(serialized!.dimensions).toEqual({ width: 1024, height: 1024 })
  })

  it('text artifact falls back to raw content', () => {
    const artifact = { contentType: 'code' as const, content: 'const x = 1' }
    expect(isMediaArtifact(artifact as any)).toBe(false)
    expect(serializeArtifactForContext(artifact as any)).toBe('const x = 1')
  })

  it('video generation creates async job with progress tracking', () => {
    const job = {
      id: 'job-video-1',
      nodeId: 'node-v1',
      toolName: 'generate_video',
      provider: 'runway',
      status: 'queued' as const,
      createdAt: Date.now(),
    }

    useJobManager.getState().addJob(job)
    expect(useJobManager.getState().jobs.size).toBe(1)

    // Simulate processing
    useJobManager.getState().updateJob('job-video-1', { status: 'processing', progress: 30 })
    const updated = useJobManager.getState().jobs.get('job-video-1')
    expect(updated?.status).toBe('processing')
    expect(updated?.progress).toBe(30)

    // Simulate completion
    useJobManager.getState().updateJob('job-video-1', {
      status: 'complete',
      progress: 100,
      result: { artifactNodeId: 'art-v1', storageUrl: 'https://r2.example.com/v.mp4' },
    })
    const completed = useJobManager.getState().jobs.get('job-video-1')
    expect(completed?.status).toBe('complete')
    expect(completed?.result?.storageUrl).toContain('v.mp4')
  })

  it('ViewportPool limits concurrent 3D viewports to 4', () => {
    // Create 5 viewports
    for (let i = 0; i < 5; i++) {
      const canvas = document.createElement('canvas')
      viewportPool.acquire(`node-${i}`, canvas)
    }

    // Pool should have evicted the oldest
    expect(viewportPool.size).toBe(4)

    // Release all
    for (let i = 0; i < 5; i++) {
      viewportPool.release(`node-${i}`)
    }
    expect(viewportPool.size).toBe(0)
  })

  it('multiple concurrent jobs tracked per node', () => {
    useJobManager.getState().addJob({
      id: 'j1', nodeId: 'n1', toolName: 'generate_image', provider: 'stability',
      status: 'processing', createdAt: Date.now(),
    })
    useJobManager.getState().addJob({
      id: 'j2', nodeId: 'n1', toolName: 'generate_audio', provider: 'elevenlabs',
      status: 'queued', createdAt: Date.now(),
    })
    useJobManager.getState().addJob({
      id: 'j3', nodeId: 'n2', toolName: 'generate_video', provider: 'runway',
      status: 'processing', createdAt: Date.now(),
    })

    expect(useJobManager.getState().getJobsForNode('n1')).toHaveLength(2)
    expect(useJobManager.getState().getJobsForNode('n2')).toHaveLength(1)
  })
})
