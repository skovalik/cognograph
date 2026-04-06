// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import {
  type ImageGenParams,
  type MediaResult,
  type Model3DGenParams,
  ProviderAdapter,
} from '../providerAdapter'

export class ReplicateAdapter extends ProviderAdapter {
  readonly name = 'replicate'
  readonly capabilities = ['image_gen', '3d_gen'] as const

  async generateImage(params: ImageGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const res = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'black-forest-labs/flux-1.1-pro',
          input: {
            prompt: params.prompt,
            aspect_ratio: params.aspectRatio || '1:1',
          },
        }),
      })

      if (!res.ok) {
        const err = new Error(`Replicate API error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const prediction = await res.json()
      // Poll for completion
      const output = await this.pollPrediction(prediction.id)
      const imageRes = await fetch(output)
      const blob = await imageRes.blob()

      return { buffer: blob, mimeType: 'image/png', metadata: { model: 'flux-1.1-pro' } }
    })
  }

  async generate3D(params: Model3DGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const input: Record<string, unknown> = { prompt: params.prompt }
      if (params.imageUrl) input.image = params.imageUrl

      const res = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'aiuni-tech/hier-meshgen',
          input,
        }),
      })

      if (!res.ok) {
        const err = new Error(`Replicate API error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const prediction = await res.json()
      const output = await this.pollPrediction(prediction.id)
      const meshRes = await fetch(output)
      const blob = await meshRes.blob()

      return { buffer: blob, mimeType: 'model/gltf-binary', metadata: { model: 'hier-meshgen' } }
    })
  }

  private async pollPrediction(id: string, maxWait = 120000): Promise<string> {
    const start = Date.now()
    while (Date.now() - start < maxWait) {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      const data = await res.json()
      if (data.status === 'succeeded') {
        const output = Array.isArray(data.output) ? data.output[0] : data.output
        return output
      }
      if (data.status === 'failed') throw new Error(`Replicate prediction failed: ${data.error}`)
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error('Replicate prediction timed out')
  }
}
