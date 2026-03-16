import type { MediaToolDefinition } from '../agentToolRegistry'

export const generate3DTool: MediaToolDefinition = {
  name: 'generate_3d',
  description: 'Generate a 3D model from a text prompt or image. Uses Replicate. Creates an artifact node with a GLB file. Generation takes 1-5min.',
  input_schema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Description of the 3D model to generate'
      },
      image_node_id: {
        type: 'string',
        description: 'Optional artifact node ID containing a reference image'
      },
      provider: {
        type: 'string',
        enum: ['replicate'],
        description: 'Which provider to use (default: replicate)'
      }
    },
    required: ['prompt']
  },
  requiredProviders: ['replicate']
}
