export abstract class ProviderAdapter {
  abstract readonly name: string
  abstract readonly capabilities: readonly ProviderCapability[]

  constructor(
    protected apiKey: string,
    protected creditBalance: number | null
  ) {}

  abstract generateImage(params: ImageGenParams): Promise<MediaResult>
  editImage?(params: ImageEditParams): Promise<MediaResult>
  removeBackground?(imageBlob: Blob): Promise<MediaResult>
  upscaleImage?(imageBlob: Blob, mode?: 'creative' | 'conservative'): Promise<MediaResult>
  generateVideo?(params: VideoGenParams): Promise<MediaResult>
  generateAudio?(params: AudioGenParams): Promise<MediaResult>
  generate3D?(params: Model3DGenParams): Promise<MediaResult>
  analyzeMedia?(params: AnalyzeParams): Promise<string>

  protected async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (err: any) {
        if (attempt === maxRetries - 1) throw err
        if (err.status === 429) {
          const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 30000)
          await new Promise(r => setTimeout(r, delay))
        } else if (err.status >= 500) {
          await new Promise(r => setTimeout(r, 1000))
        } else {
          throw err
        }
      }
    }
    throw new Error('Unreachable')
  }
}

export type ProviderCapability = 'image_gen' | 'image_edit' | 'video_gen' | '3d_gen' | 'audio_gen' | 'media_analysis'

export interface MediaResult {
  buffer: Blob
  mimeType: string
  metadata: Record<string, unknown>
}

export interface ImageGenParams { prompt: string; style?: string; aspectRatio?: string }
export interface VideoGenParams { prompt: string; imageUrl?: string; duration?: number }
export interface AudioGenParams { text: string; voice?: string }
export interface Model3DGenParams { prompt: string; imageUrl?: string }
export interface AnalyzeParams { mediaUrl: string; prompt: string }

export interface ImageEditParams {
  image: Blob
  prompt: string
  mask?: Blob
  mode?: 'inpaint' | 'outpaint' | 'style-transfer'
  outputFormat?: 'png' | 'jpeg' | 'webp'
}
