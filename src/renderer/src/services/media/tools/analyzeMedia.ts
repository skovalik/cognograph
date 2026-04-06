// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { MediaToolDefinition } from '../agentToolRegistry'

export const analyzeMediaTool: MediaToolDefinition = {
  name: 'analyze_media',
  description:
    'Analyze an image or video using AI vision. Returns a text description — does not create an artifact node.',
  input_schema: {
    type: 'object',
    properties: {
      media_node_id: {
        type: 'string',
        description: 'Node ID of the artifact containing the media to analyze',
      },
      prompt: {
        type: 'string',
        description: 'What to analyze or describe about the media',
      },
      provider: {
        type: 'string',
        enum: ['gemini', 'openai'],
        description: 'Which vision provider to use',
      },
    },
    required: ['media_node_id', 'prompt'],
  },
  requiredProviders: ['google', 'openai'],
}
