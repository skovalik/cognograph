// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { MediaToolDefinition } from '../agentToolRegistry'

export const generateVideoTool: MediaToolDefinition = {
  name: 'generate_video',
  description: 'Generate a video from a text prompt or image. Uses Runway Gen-3. Creates an artifact node with the result. Generation takes 30s-5min.',
  input_schema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Description of the video to generate'
      },
      image_node_id: {
        type: 'string',
        description: 'Optional artifact node ID containing a source image for image-to-video'
      },
      duration: {
        type: 'number',
        description: 'Duration in seconds (5 or 10, default 5)'
      },
      provider: {
        type: 'string',
        enum: ['runway', 'replicate'],
        description: 'Which provider to use'
      }
    },
    required: ['prompt']
  },
  requiredProviders: ['runway']
}
