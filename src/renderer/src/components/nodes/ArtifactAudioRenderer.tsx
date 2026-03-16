import { memo, useRef, useEffect, useState, useCallback } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'
import type { ArtifactMediaMetadata } from '@shared/types/nodes'

interface ArtifactAudioRendererProps {
  storageUrl: string
  title: string
  metadata?: ArtifactMediaMetadata
}

export const ArtifactAudioRenderer = memo(function ArtifactAudioRenderer({
  storageUrl,
  title,
  metadata,
}: ArtifactAudioRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      audio.play()
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }, [])

  // Set up Web Audio analyser for waveform visualization
  useEffect(() => {
    const audio = audioRef.current
    const canvas = canvasRef.current
    if (!audio || !canvas) return

    let audioCtx: AudioContext | null = null

    const setupAnalyser = () => {
      if (analyserRef.current) return

      audioCtx = new AudioContext()
      const source = audioCtx.createMediaElementSource(audio)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyser.connect(audioCtx.destination)
      analyserRef.current = analyser
    }

    const draw = () => {
      const analyser = analyserRef.current
      if (!analyser) {
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteFrequencyData(dataArray)

      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      const barWidth = (width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height
        const hue = (i / bufferLength) * 60 + 200 // blue-purple gradient
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.8)`
        ctx.fillRect(x, height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    const handlePlay = () => {
      setupAnalyser()
      draw()
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      cancelAnimationFrame(animFrameRef.current)
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      cancelAnimationFrame(animFrameRef.current)
      audioCtx?.close()
    }
  }, [])

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative rounded overflow-hidden cursor-pointer"
        style={{ backgroundColor: 'var(--node-bg-secondary)' }}
        onClick={togglePlay}
      >
        <canvas
          ref={canvasRef}
          width={280}
          height={48}
          className="w-full"
          style={{ height: 48, display: 'block' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {isPlaying ? (
            <Pause size={20} className="text-[var(--node-text-primary)] opacity-60" />
          ) : (
            <Play size={20} className="text-[var(--node-text-primary)] opacity-60" />
          )}
        </div>
      </div>
      <audio ref={audioRef} src={storageUrl} preload="metadata" title={title} />
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--node-text-muted)]">
        <Volume2 size={10} />
        <span>{metadata?.provider}</span>
        {metadata?.duration && <span>· {Math.floor(metadata.duration)}s</span>}
      </div>
    </div>
  )
})
