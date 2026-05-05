// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { mediaFetchBinary, mediaFetchJson } from '../mediaFetchClient'
import {
  type ImageGenParams,
  type MediaResult,
  type Model3DGenParams,
  ProviderAdapter,
} from '../providerAdapter'

interface ReplicatePrediction {
  id: string
  status?: string
  output?: string | string[]
  error?: string
}

export class ReplicateAdapter extends ProviderAdapter {
  readonly name = 'replicate'
  readonly capabilities = ['image_gen', '3d_gen'] as const

  async generateImage(params: ImageGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const prediction = (await mediaFetchJson({
        provider: 'replicate',
        url: 'https://api.replicate.com/v1/predictions',
        method: 'POST',
        bodyKind: 'json',
        bodyJson: {
          model: 'black-forest-labs/flux-1.1-pro',
          input: { prompt: params.prompt, aspect_ratio: params.aspectRatio || '1:1' },
        },
      })) as ReplicatePrediction

      const output = await this.pollPrediction(prediction.id)
      const { blob } = await mediaFetchBinary({
        provider: 'replicate',
        url: output,
        method: 'GET',
        bodyKind: 'none',
        authStyleOverride: 'none',
      })

      return { buffer: blob, mimeType: 'image/png', metadata: { model: 'flux-1.1-pro' } }
    })
  }

  async generate3D(params: Model3DGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const input: Record<string, unknown> = { prompt: params.prompt }
      if (params.imageUrl) input.image = params.imageUrl

      const prediction = (await mediaFetchJson({
        provider: 'replicate',
        url: 'https://api.replicate.com/v1/predictions',
        method: 'POST',
        bodyKind: 'json',
        bodyJson: { model: 'aiuni-tech/hier-meshgen', input },
      })) as ReplicatePrediction

      const output = await this.pollPrediction(prediction.id)
      const { blob } = await mediaFetchBinary({
        provider: 'replicate',
        url: output,
        method: 'GET',
        bodyKind: 'none',
        authStyleOverride: 'none',
      })

      return { buffer: blob, mimeType: 'model/gltf-binary', metadata: { model: 'hier-meshgen' } }
    })
  }

  private async pollPrediction(id: string, maxWait = 120000): Promise<string> {
    const start = Date.now()
    while (Date.now() - start < maxWait) {
      const data = (await mediaFetchJson({
        provider: 'replicate',
        url: `https://api.replicate.com/v1/predictions/${id}`,
        method: 'GET',
        bodyKind: 'none',
      })) as ReplicatePrediction
      if (data.status === 'succeeded') {
        const output = Array.isArray(data.output) ? data.output[0] : data.output
        if (!output) throw new Error('Replicate prediction succeeded but returned no output')
        return output
      }
      if (data.status === 'failed') throw new Error(`Replicate prediction failed: ${data.error}`)
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error('Replicate prediction timed out')
  }
}
