// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { ProviderAdapter, type ImageGenParams, type ImageEditParams, type MediaResult } from '../providerAdapter'

export class StabilityAdapter extends ProviderAdapter {
  readonly name = 'stability'
  readonly capabilities = ['image_gen', 'image_edit'] as const

  async generateImage(params: ImageGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const fd = new FormData()
      fd.append('prompt', params.prompt)
      if (params.style) fd.append('style_preset', params.style)
      if (params.aspectRatio) fd.append('aspect_ratio', params.aspectRatio)
      fd.append('output_format', 'png')

      const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'image/*'
        },
        body: fd
      })

      if (!res.ok) {
        const err = new Error(`Stability API error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const blob = await res.blob()
      return { buffer: blob, mimeType: 'image/png', metadata: { model: 'stable-image-core' } }
    })
  }

  async editImage(params: ImageEditParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const fd = new FormData()
      fd.append('image', params.image)
      fd.append('prompt', params.prompt)
      if (params.mask) fd.append('mask', params.mask)
      fd.append('output_format', params.outputFormat || 'png')

      const endpoint = params.mode === 'outpaint'
        ? 'https://api.stability.ai/v2beta/stable-image/edit/outpaint'
        : 'https://api.stability.ai/v2beta/stable-image/edit/inpaint'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'image/*'
        },
        body: fd
      })

      if (!res.ok) {
        const err = new Error(`Stability edit error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const blob = await res.blob()
      return { buffer: blob, mimeType: 'image/png', metadata: { model: 'stable-image-edit', mode: params.mode || 'inpaint' } }
    })
  }

  async removeBackground(imageBlob: Blob): Promise<MediaResult> {
    return this.withRetry(async () => {
      const fd = new FormData()
      fd.append('image', imageBlob)
      fd.append('output_format', 'png')

      const res = await fetch('https://api.stability.ai/v2beta/stable-image/edit/remove-background', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'image/*'
        },
        body: fd
      })

      if (!res.ok) {
        const err = new Error(`Stability remove-bg error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const blob = await res.blob()
      return { buffer: blob, mimeType: 'image/png', metadata: { model: 'stable-image-remove-bg' } }
    })
  }

  async upscaleImage(imageBlob: Blob, mode: 'creative' | 'conservative' = 'conservative'): Promise<MediaResult> {
    return this.withRetry(async () => {
      const fd = new FormData()
      fd.append('image', imageBlob)
      fd.append('output_format', 'png')

      const endpoint = mode === 'creative'
        ? 'https://api.stability.ai/v2beta/stable-image/upscale/creative'
        : 'https://api.stability.ai/v2beta/stable-image/upscale/conservative'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'image/*'
        },
        body: fd
      })

      if (!res.ok) {
        const err = new Error(`Stability upscale error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const blob = await res.blob()
      return { buffer: blob, mimeType: 'image/png', metadata: { model: `stable-image-upscale-${mode}` } }
    })
  }
}
