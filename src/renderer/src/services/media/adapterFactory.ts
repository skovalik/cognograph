// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { getKey as getApiKeyFromStore } from '../apiKeyStore'
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
    adapter: new (credits: number | null) => ProviderAdapter
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

/**
 * The renderer no longer passes API keys to adapters — main resolves
 * them at fetch time. We still consult `apiKeyStore` here as a configuration
 * presence check (so 'auto' provider selection can prefer providers with a
 * configured key, and explicit-provider calls fail fast with a helpful error
 * before the IPC round-trip). The returned key is NOT passed to the adapter.
 */
function hasApiKey(provider: string): boolean {
  try {
    const { useApiKeyStore } = require('../../../../web/stores/apiKeyStore')
    const { keys } = useApiKeyStore.getState()
    if (keys.find((k: { provider: string }) => k.provider === provider)) return true
  } catch {
    // Electron mode falls through.
  }
  return getApiKeyFromStore(provider) != null
}

export function getAdapterForProvider(
  providerName: string,
  requiredCapabilities: ProviderCapability[],
): ProviderAdapter {
  if (providerName === 'auto') {
    // Find first provider with required capabilities and a configured key
    for (const [name, config] of Object.entries(PROVIDER_MAP)) {
      if (requiredCapabilities.every((c) => config.capabilities.includes(c))) {
        if (hasApiKey(name)) return new config.adapter(null)
      }
    }
    throw new Error(`No provider available with capabilities: ${requiredCapabilities.join(', ')}`)
  }

  const config = PROVIDER_MAP[providerName]
  if (!config) throw new Error(`Unknown provider: ${providerName}`)

  if (!hasApiKey(providerName)) throw new Error(`No API key configured for ${providerName}`)

  return new config.adapter(null)
}
