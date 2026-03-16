// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { MediaToolDefinition } from '../agentToolRegistry'

export const generateImageTool: MediaToolDefinition = {
  name: 'generate_image',
  description: 'Generate an image from a text prompt. Creates an artifact node with the result. Supports style presets and aspect ratios.',
  input_schema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed description of the image to generate'
      },
      style: {
        type: 'string',
        description: 'Style preset (e.g. "photographic", "digital-art", "anime", "3d-model")'
      },
      aspect_ratio: {
        type: 'string',
        description: 'Aspect ratio (e.g. "1:1", "16:9", "9:16")'
      },
      provider: {
        type: 'string',
        enum: ['stability', 'openai', 'gemini', 'replicate'],
        description: 'Which provider to use. Defaults to first available.'
      }
    },
    required: ['prompt']
  },
  requiredProviders: ['stability', 'openai', 'google', 'replicate']
}

export async function executeGenerateImage(params: {
  prompt: string
  style?: string
  aspect_ratio?: string
  provider?: string
}): Promise<{ nodeId: string; mimeType: string; metadata: Record<string, unknown> }> {
  const { getAdapterForProvider } = await import('../adapterFactory')
  const adapter = getAdapterForProvider(params.provider || 'auto', ['image_gen'])

  const result = await adapter.generateImage({
    prompt: params.prompt,
    style: params.style,
    aspectRatio: params.aspect_ratio
  })

  // Create artifact node with the generated image
  const { useWorkspaceStore } = await import('../../../stores/workspaceStore')
  const store = useWorkspaceStore.getState()

  const nodeId = store.addNode({
    type: 'artifact',
    title: `Generated: ${params.prompt.slice(0, 50)}`,
    content: '',
    artifactType: 'image',
    mimeType: result.mimeType,
  }, { x: 0, y: 0 }) // Position will be adjusted by spatial layout

  return {
    nodeId,
    mimeType: result.mimeType,
    metadata: result.metadata
  }
}
