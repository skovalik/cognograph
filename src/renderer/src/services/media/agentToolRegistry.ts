// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { AgentToolDefinition } from '@shared/types'
import { generateImageTool } from './tools/generateImage'
import { editImageTool } from './tools/editImage'
import { generateAudioTool } from './tools/generateAudio'
import { analyzeMediaTool } from './tools/analyzeMedia'
import { generateVideoTool } from './tools/generateVideo'
import { generate3DTool } from './tools/generate3D'

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
  {
    // Check localStorage for provider keys (open-source build)
    providers = new Set<string>()
    const providerNames = ['stability', 'openai', 'google', 'replicate', 'runway', 'elevenlabs']
    for (const p of providerNames) {
      if (localStorage.getItem(`cognograph:apikey:${p}`)) providers.add(p)
    }
  }

  return MEDIA_TOOLS.filter(tool =>
    tool.requiredProviders.some(p => providers.has(p))
  )
}
