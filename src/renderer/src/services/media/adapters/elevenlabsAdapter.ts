// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import {
  type AudioGenParams,
  type ImageGenParams,
  type MediaResult,
  ProviderAdapter,
} from '../providerAdapter'

export class ElevenLabsAdapter extends ProviderAdapter {
  readonly name = 'elevenlabs'
  readonly capabilities = ['audio_gen'] as const

  async generateImage(_params: ImageGenParams): Promise<MediaResult> {
    throw new Error('ElevenLabs does not support image generation. Use generateAudio instead.')
  }

  async generateAudio(params: AudioGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const voiceId = params.voice || 'pNInz6obpgDQGcFmaJgB' // Default: Adam

      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: params.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      })

      if (!res.ok) {
        const err = new Error(`ElevenLabs API error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const blob = await res.blob()
      return {
        buffer: blob,
        mimeType: 'audio/mpeg',
        metadata: { model: 'eleven_multilingual_v2', voiceId },
      }
    })
  }
}
