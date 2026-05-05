// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { AgentToolDefinition } from '@shared/types'
import { getKey as getApiKeyFromStore } from '../apiKeyStore'
import { analyzeMediaTool } from './tools/analyzeMedia'
import { editImageTool } from './tools/editImage'
import { generate3DTool } from './tools/generate3D'
import { generateAudioTool } from './tools/generateAudio'
import { generateImageTool } from './tools/generateImage'
import { generateVideoTool } from './tools/generateVideo'

export interface MediaToolDefinition extends AgentToolDefinition {
  requiredProviders: string[]
}

const MEDIA_TOOLS: MediaToolDefinition[] = [
  generateImageTool,
  editImageTool,
  generateAudioTool,
  analyzeMediaTool,
  generateVideoTool,
  generate3DTool,
]

export function getAvailableMediaTools(): AgentToolDefinition[] {
  // Check which providers have keys configured
  // Try apiKeyStore (web/cloud mode) or localStorage fallback (Electron)
  let providers: Set<string>
  try {
    // Dynamic import to avoid hard dependency on web stores in Electron
    const { useApiKeyStore } = require('../../../../web/stores/apiKeyStore')
    const { keys } = useApiKeyStore.getState()
    providers = new Set(keys.map((k: { provider: string }) => k.provider))
  } catch {
    // Electron mode — read from in-memory apiKeyStore (hydrated from
    // main-process safeStorage at startup).
    providers = new Set<string>()
    const providerNames = ['stability', 'openai', 'google', 'replicate', 'runway', 'elevenlabs']
    for (const p of providerNames) {
      if (getApiKeyFromStore(p)) providers.add(p)
    }
  }

  return MEDIA_TOOLS.filter((tool) => tool.requiredProviders.some((p) => providers.has(p)))
}
