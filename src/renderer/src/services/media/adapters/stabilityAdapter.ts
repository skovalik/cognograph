// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { blobToFormField, mediaFetchBinary, type SerializedFormField } from '../mediaFetchClient'
import {
  type ImageEditParams,
  type ImageGenParams,
  type MediaResult,
  ProviderAdapter,
} from '../providerAdapter'

export class StabilityAdapter extends ProviderAdapter {
  readonly name = 'stability'
  readonly capabilities = ['image_gen', 'image_edit'] as const

  async generateImage(params: ImageGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const fields: SerializedFormField[] = [
        { name: 'prompt', kind: 'string', value: params.prompt },
        { name: 'output_format', kind: 'string', value: 'png' },
      ]
      if (params.style) fields.push({ name: 'style_preset', kind: 'string', value: params.style })
      if (params.aspectRatio)
        fields.push({ name: 'aspect_ratio', kind: 'string', value: params.aspectRatio })

      const { blob } = await mediaFetchBinary({
        provider: 'stability',
        url: 'https://api.stability.ai/v2beta/stable-image/generate/core',
        method: 'POST',
        headers: { Accept: 'image/*' },
        bodyKind: 'form',
        bodyForm: fields,
      })

      return { buffer: blob, mimeType: 'image/png', metadata: { model: 'stable-image-core' } }
    })
  }

  async editImage(params: ImageEditParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const fields: SerializedFormField[] = [
        await blobToFormField('image', params.image, 'image'),
        { name: 'prompt', kind: 'string', value: params.prompt },
        { name: 'output_format', kind: 'string', value: params.outputFormat || 'png' },
      ]
      if (params.mask) fields.push(await blobToFormField('mask', params.mask, 'mask'))

      const endpoint =
        params.mode === 'outpaint'
          ? 'https://api.stability.ai/v2beta/stable-image/edit/outpaint'
          : 'https://api.stability.ai/v2beta/stable-image/edit/inpaint'

      const { blob } = await mediaFetchBinary({
        provider: 'stability',
        url: endpoint,
        method: 'POST',
        headers: { Accept: 'image/*' },
        bodyKind: 'form',
        bodyForm: fields,
      })

      return {
        buffer: blob,
        mimeType: 'image/png',
        metadata: { model: 'stable-image-edit', mode: params.mode || 'inpaint' },
      }
    })
  }

  async removeBackground(imageBlob: Blob): Promise<MediaResult> {
    return this.withRetry(async () => {
      const { blob } = await mediaFetchBinary({
        provider: 'stability',
        url: 'https://api.stability.ai/v2beta/stable-image/edit/remove-background',
        method: 'POST',
        headers: { Accept: 'image/*' },
        bodyKind: 'form',
        bodyForm: [
          await blobToFormField('image', imageBlob, 'image'),
          { name: 'output_format', kind: 'string', value: 'png' },
        ],
      })
      return { buffer: blob, mimeType: 'image/png', metadata: { model: 'stable-image-remove-bg' } }
    })
  }

  async upscaleImage(
    imageBlob: Blob,
    mode: 'creative' | 'conservative' = 'conservative',
  ): Promise<MediaResult> {
    return this.withRetry(async () => {
      const endpoint =
        mode === 'creative'
          ? 'https://api.stability.ai/v2beta/stable-image/upscale/creative'
          : 'https://api.stability.ai/v2beta/stable-image/upscale/conservative'

      const { blob } = await mediaFetchBinary({
        provider: 'stability',
        url: endpoint,
        method: 'POST',
        headers: { Accept: 'image/*' },
        bodyKind: 'form',
        bodyForm: [
          await blobToFormField('image', imageBlob, 'image'),
          { name: 'output_format', kind: 'string', value: 'png' },
        ],
      })

      return {
        buffer: blob,
        mimeType: 'image/png',
        metadata: { model: `stable-image-upscale-${mode}` },
      }
    })
  }
}
