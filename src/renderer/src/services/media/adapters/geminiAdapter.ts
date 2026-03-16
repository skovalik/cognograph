// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { ProviderAdapter, type ImageGenParams, type MediaResult, type AnalyzeParams } from '../providerAdapter'

export class GeminiAdapter extends ProviderAdapter {
  readonly name = 'gemini'
  readonly capabilities = ['image_gen', 'image_edit', 'media_analysis'] as const

  async generateImage(params: ImageGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: params.prompt }] }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
          })
        }
      )

      if (!res.ok) {
        const err = new Error(`Gemini API error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const data = await res.json()
      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData?.mimeType?.startsWith('image/')
      )
      if (!imagePart) throw new Error('No image in Gemini response')

      const binary = atob(imagePart.inlineData.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      return {
        buffer: new Blob([bytes], { type: imagePart.inlineData.mimeType }),
        mimeType: imagePart.inlineData.mimeType,
        metadata: { model: 'gemini-2.0-flash-exp' }
      }
    })
  }

  async analyzeMedia(params: AnalyzeParams): Promise<string> {
    return this.withRetry(async () => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: params.prompt },
                { fileData: { mimeType: 'image/jpeg', fileUri: params.mediaUrl } }
              ]
            }]
          })
        }
      )

      if (!res.ok) {
        const err = new Error(`Gemini API error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    })
  }
}
