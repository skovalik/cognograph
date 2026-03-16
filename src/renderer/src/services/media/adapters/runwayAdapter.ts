import { ProviderAdapter, type ImageGenParams, type MediaResult, type VideoGenParams } from '../providerAdapter'

export class RunwayAdapter extends ProviderAdapter {
  readonly name = 'runway'
  readonly capabilities = ['video_gen'] as const

  async generateImage(_params: ImageGenParams): Promise<MediaResult> {
    throw new Error('Runway does not support image generation. Use generateVideo instead.')
  }

  async generateVideo(params: VideoGenParams): Promise<MediaResult> {
    return this.withRetry(async () => {
      const body: Record<string, unknown> = {
        promptText: params.prompt,
        model: 'gen3a_turbo',
        duration: params.duration || 5,
      }
      if (params.imageUrl) body.promptImage = params.imageUrl

      const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06'
        },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const err = new Error(`Runway API error: ${res.status}`) as any
        err.status = res.status
        throw err
      }

      const task = await res.json()
      const output = await this.pollTask(task.id)
      const videoRes = await fetch(output)
      const blob = await videoRes.blob()

      return { buffer: blob, mimeType: 'video/mp4', metadata: { model: 'gen3a_turbo' } }
    })
  }

  private async pollTask(id: string, maxWait = 300000): Promise<string> {
    const start = Date.now()
    while (Date.now() - start < maxWait) {
      const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Runway-Version': '2024-11-06'
        }
      })
      const data = await res.json()
      if (data.status === 'SUCCEEDED') return data.output?.[0]
      if (data.status === 'FAILED') throw new Error(`Runway task failed: ${data.failure}`)
      await new Promise(r => setTimeout(r, 5000))
    }
    throw new Error('Runway task timed out')
  }
}
