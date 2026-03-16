// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { MediaToolDefinition } from '../agentToolRegistry'

export const editImageTool: MediaToolDefinition = {
  name: 'edit_image',
  description: 'Edit an existing image using AI. Supports inpainting (edit specific regions), outpainting (extend canvas), remove background, and upscale. Reference an artifact node containing the source image.',
  input_schema: {
    type: 'object',
    properties: {
      image_node_id: {
        type: 'string',
        description: 'Node ID of the artifact containing the source image'
      },
      prompt: {
        type: 'string',
        description: 'Description of the desired edit'
      },
      mask_prompt: {
        type: 'string',
        description: 'Description of the area to edit (for automatic masking)'
      },
      mode: {
        type: 'string',
        enum: ['inpaint', 'outpaint', 'remove-bg', 'upscale'],
        description: 'Edit mode. Defaults to inpaint.'
      },
      provider: {
        type: 'string',
        enum: ['stability', 'gemini'],
        description: 'Which provider to use for editing'
      }
    },
    required: ['image_node_id', 'prompt']
  },
  requiredProviders: ['stability', 'google']
}

export async function executeEditImage(params: {
  image_node_id: string
  prompt: string
  mask_prompt?: string
  mode?: 'inpaint' | 'outpaint' | 'remove-bg' | 'upscale'
  provider?: string
}): Promise<{ nodeId: string; mimeType: string; metadata: Record<string, unknown> }> {
  const { getAdapterForProvider } = await import('../adapterFactory')

  // Get source image from the artifact node
  const { useWorkspaceStore } = await import('../../../stores/workspaceStore')
  const store = useWorkspaceStore.getState()
  const sourceNode = store.nodes.find(n => n.id === params.image_node_id)
  if (!sourceNode) throw new Error(`Node not found: ${params.image_node_id}`)

  // Fetch the image blob from the artifact's URL
  const imageUrl = sourceNode.data?.artifactUrl || sourceNode.data?.content
  if (!imageUrl) throw new Error('Source node has no image URL')
  const imageRes = await fetch(imageUrl)
  const imageBlob = await imageRes.blob()

  const adapter = getAdapterForProvider(params.provider || 'stability', ['image_edit'])
  const mode = params.mode || 'inpaint'

  let result: { buffer: Blob; mimeType: string; metadata: Record<string, unknown> }

  if (mode === 'remove-bg' && adapter.removeBackground) {
    result = await adapter.removeBackground(imageBlob)
  } else if (mode === 'upscale' && adapter.upscaleImage) {
    result = await adapter.upscaleImage(imageBlob)
  } else if (adapter.editImage) {
    result = await adapter.editImage({
      image: imageBlob,
      prompt: params.prompt,
      mode: mode === 'remove-bg' || mode === 'upscale' ? 'inpaint' : mode,
    })
  } else {
    throw new Error(`Provider ${adapter.name} does not support image editing`)
  }

  const nodeId = store.addNode({
    type: 'artifact',
    title: `Edited: ${params.prompt.slice(0, 50)}`,
    content: '',
    artifactType: 'image',
    mimeType: result.mimeType,
  }, { x: 0, y: 0 })

  return { nodeId, mimeType: result.mimeType, metadata: result.metadata }
}
