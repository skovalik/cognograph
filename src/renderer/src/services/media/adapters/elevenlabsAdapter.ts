// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { mediaFetchBinary } from '../mediaFetchClient'
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

      const { blob } = await mediaFetchBinary({
        provider: 'elevenlabs',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        headers: { Accept: 'audio/mpeg' },
        bodyKind: 'json',
        bodyJson: {
          text: params.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        },
      })

      return {
        buffer: blob,
        mimeType: 'audio/mpeg',
        metadata: { model: 'eleven_multilingual_v2', voiceId },
      }
    })
  }
}
