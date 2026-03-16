import type { MediaToolDefinition } from '../agentToolRegistry'

export const generateAudioTool: MediaToolDefinition = {
  name: 'generate_audio',
  description: 'Generate speech audio from text using ElevenLabs. Creates an artifact node with the audio file.',
  input_schema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to convert to speech'
      },
      voice: {
        type: 'string',
        description: 'Voice ID or name (defaults to "Adam")'
      }
    },
    required: ['text']
  },
  requiredProviders: ['elevenlabs']
}
