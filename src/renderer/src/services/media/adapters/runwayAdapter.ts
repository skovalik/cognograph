// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { mediaFetchBinary, mediaFetchJson } from '../mediaFetchClient'
import {
  type ImageGenParams,
  type MediaResult,
  ProviderAdapter,
  type VideoGenParams,
} from '../providerAdapter'

interface RunwayTask {
  id: string
  status?: string
  output?: string[]
  failure?: string
}

const RUNWAY_HEADERS = { 'X-Runway-Version': '2024-11-06' }

export class RunwayAdapter extends ProviderAdapter {
  readonly name = 'runway'
  readonly capabilities = ['video_gen'] as const

  async generateImage(_params: ImageGenParams): Promise<MediaResult> {
    throw new Error('Runway does not support image generation. Use generateVideo instead.')
  }

  async generateVideo(params: VideoGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const body: Record<string, unknown> = {
        promptText: params.prompt,
        model: 'gen3a_turbo',
        duration: params.duration || 5,
      }
      if (params.imageUrl) body.promptImage = params.imageUrl

      const task = (await mediaFetchJson({
        provider: 'runway',
        url: 'https://api.dev.runwayml.com/v1/image_to_video',
        method: 'POST',
        headers: RUNWAY_HEADERS,
        bodyKind: 'json',
        bodyJson: body,
      })) as RunwayTask

      const output = await this.pollTask(task.id)
      const { blob } = await mediaFetchBinary({
        provider: 'runway',
        url: output,
        method: 'GET',
        bodyKind: 'none',
        authStyleOverride: 'none',
      })

      return { buffer: blob, mimeType: 'video/mp4', metadata: { model: 'gen3a_turbo' } }
    })
  }

  private async pollTask(id: string, maxWait = 300000): Promise<string> {
    const start = Date.now()
    while (Date.now() - start < maxWait) {
      const data = (await mediaFetchJson({
        provider: 'runway',
        url: `https://api.dev.runwayml.com/v1/tasks/${id}`,
        method: 'GET',
        headers: RUNWAY_HEADERS,
        bodyKind: 'none',
      })) as RunwayTask
      if (data.status === 'SUCCEEDED') {
        const out = data.output?.[0]
        if (!out) throw new Error('Runway task succeeded but returned no output URL')
        return out
      }
      if (data.status === 'FAILED') throw new Error(`Runway task failed: ${data.failure}`)
      await new Promise((r) => setTimeout(r, 5000))
    }
    throw new Error('Runway task timed out')
  }
}
