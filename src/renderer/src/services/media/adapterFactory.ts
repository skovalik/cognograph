// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { ElevenLabsAdapter } from './adapters/elevenlabsAdapter'
import { GeminiAdapter } from './adapters/geminiAdapter'
import { OpenAIAdapter } from './adapters/openaiAdapter'
import { ReplicateAdapter } from './adapters/replicateAdapter'
import { RunwayAdapter } from './adapters/runwayAdapter'
import { StabilityAdapter } from './adapters/stabilityAdapter'
import type { ProviderAdapter, ProviderCapability } from './providerAdapter'

const PROVIDER_MAP: Record<
  string,
  {
    adapter: new (key: string, credits: number | null) => ProviderAdapter
    capabilities: readonly ProviderCapability[]
  }
> = {
  stability: { adapter: StabilityAdapter, capabilities: ['image_gen', 'image_edit'] },
  openai: { adapter: OpenAIAdapter, capabilities: ['image_gen', 'image_edit'] },
  google: { adapter: GeminiAdapter, capabilities: ['image_gen', 'image_edit', 'media_analysis'] },
  replicate: { adapter: ReplicateAdapter, capabilities: ['image_gen', '3d_gen'] },
  runway: { adapter: RunwayAdapter, capabilities: ['video_gen'] },
  elevenlabs: { adapter: ElevenLabsAdapter, capabilities: ['audio_gen'] },
}

function getApiKey(provider: string): string | null {
  // Try web apiKeyStore first, then localStorage fallback
  try {
    // Cloud features disabled in open-source build
    throw new Error('No cloud key store in open-source build')
  } catch {
    // Electron / open-source — check localStorage
  }
  return localStorage.getItem(`cognograph:apikey:${provider}`)
}

export function getAdapterForProvider(
  providerName: string,
  requiredCapabilities: ProviderCapability[],
): ProviderAdapter {
  if (providerName === 'auto') {
    // Find first provider with required capabilities and an API key
    for (const [name, config] of Object.entries(PROVIDER_MAP)) {
      if (requiredCapabilities.every((c) => config.capabilities.includes(c))) {
        const key = getApiKey(name)
        if (key) return new config.adapter(key, null)
      }
    }
    throw new Error(`No provider available with capabilities: ${requiredCapabilities.join(', ')}`)
  }

  const config = PROVIDER_MAP[providerName]
  if (!config) throw new Error(`Unknown provider: ${providerName}`)

  const key = getApiKey(providerName)
  if (!key) throw new Error(`No API key configured for ${providerName}`)

  return new config.adapter(key, null)
}
