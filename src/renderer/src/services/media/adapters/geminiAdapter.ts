// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { mediaFetchJson } from '../mediaFetchClient'
import {
  type AnalyzeParams,
  type ImageGenParams,
  type MediaResult,
  ProviderAdapter,
} from '../providerAdapter'

interface GeminiPart {
  inlineData?: { mimeType?: string; data?: string }
  text?: string
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>
}

export class GeminiAdapter extends ProviderAdapter {
  readonly name = 'gemini'
  readonly capabilities = ['image_gen', 'image_edit', 'media_analysis'] as const

  async generateImage(params: ImageGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const data = (await mediaFetchJson({
        provider: 'gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
        method: 'POST',
        bodyKind: 'json',
        bodyJson: {
          contents: [{ parts: [{ text: params.prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        },
      })) as GeminiResponse

      const imagePart = data.candidates?.[0]?.content?.parts?.find((p) =>
        p.inlineData?.mimeType?.startsWith('image/'),
      )
      if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
        throw new Error('No image in Gemini response')
      }

      const binary = atob(imagePart.inlineData.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      return {
        buffer: new Blob([bytes], { type: imagePart.inlineData.mimeType }),
        mimeType: imagePart.inlineData.mimeType,
        metadata: { model: 'gemini-2.0-flash-exp' },
      }
    })
  }

  async analyzeMedia(params: AnalyzeParams): Promise<string> {
    return this.withRetry(async () => {
      const data = (await mediaFetchJson({
        provider: 'gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        method: 'POST',
        bodyKind: 'json',
        bodyJson: {
          contents: [
            {
              parts: [
                { text: params.prompt },
                { fileData: { mimeType: 'image/jpeg', fileUri: params.mediaUrl } },
              ],
            },
          ],
        },
      })) as GeminiResponse

      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    })
  }
}
