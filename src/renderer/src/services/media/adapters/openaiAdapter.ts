// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { type ImageGenParams, type MediaResult, ProviderAdapter } from '../providerAdapter'

export class OpenAIAdapter extends ProviderAdapter {
  readonly name = 'openai'
  readonly capabilities = ['image_gen', 'image_edit'] as const

  async generateImage(params: ImageGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const body: Record<string, unknown> = {
        model: 'gpt-image-1',
        prompt: params.prompt,
        quality: 'high',
        output_format: 'png',
      }
      if (params.aspectRatio) {
        const sizeMap: Record<string, string> = {
          '1:1': '1024x1024',
          '16:9': '1536x1024',
          '9:16': '1024x1536',
        }
        body.size = sizeMap[params.aspectRatio] || '1024x1024'
      }

      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = new Error(`OpenAI API error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const data = await res.json()
      const b64 = data.data?.[0]?.b64_json
      if (!b64) throw new Error('No image in OpenAI response')

      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      return {
        buffer: new Blob([bytes], { type: 'image/png' }),
        mimeType: 'image/png',
        metadata: { model: 'gpt-image-1' },
      }
    })
  }
}
