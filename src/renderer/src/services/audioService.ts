/**
 * Audio Feedback Service
 *
 * Provides optional audio feedback for common actions.
 * ND-friendly: Auditory confirmation without requiring visual attention.
 *
 * Uses Web Audio API for synthesized sounds (no external files needed).
 * All sounds are subtle and non-jarring.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Sound types available
export type SoundType =
  | 'click' // Button/interaction feedback
  | 'success' // Action completed successfully
  | 'error' // Action failed
  | 'notification' // Alert/notification
  | 'undo' // Undo action
  | 'redo' // Redo action
  | 'delete' // Item deleted
  | 'create' // Item created
  | 'connect' // Edge/connection created
  | 'navigate' // Navigation event

// Audio settings store
interface AudioSettingsState {
  enabled: boolean
  volume: number // 0-1
  setEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  toggle: () => void
}

export const useAudioSettings = create<AudioSettingsState>()(
  persist(
    (set) => ({
      enabled: false, // Disabled by default, opt-in
      volume: 0.3, // Subtle volume
      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      toggle: () => set((s) => ({ enabled: !s.enabled }))
    }),
    {
      name: 'cognograph-audio-settings'
    }
  )
)

// Audio context singleton (created lazily on first use)
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext

  try {
    audioContext = new AudioContext()
    return audioContext
  } catch (e) {
    console.warn('Audio feedback not available:', e)
    return null
  }
}

// Sound frequency/duration configurations
const SOUND_CONFIGS: Record<SoundType, { frequency: number; duration: number; type: OscillatorType; decay?: number }> = {
  click: { frequency: 800, duration: 0.05, type: 'sine' },
  success: { frequency: 880, duration: 0.15, type: 'sine', decay: 0.1 },
  error: { frequency: 220, duration: 0.2, type: 'sawtooth', decay: 0.15 },
  notification: { frequency: 660, duration: 0.1, type: 'sine' },
  undo: { frequency: 440, duration: 0.1, type: 'triangle' },
  redo: { frequency: 550, duration: 0.1, type: 'triangle' },
  delete: { frequency: 330, duration: 0.12, type: 'sine', decay: 0.08 },
  create: { frequency: 660, duration: 0.08, type: 'sine' },
  connect: { frequency: 740, duration: 0.1, type: 'sine', decay: 0.06 },
  navigate: { frequency: 500, duration: 0.06, type: 'sine' }
}

/**
 * Play a sound effect if audio is enabled
 */
export function playSound(type: SoundType): void {
  const settings = useAudioSettings.getState()
  if (!settings.enabled) return

  const ctx = getAudioContext()
  if (!ctx) return

  // Resume audio context if suspended (required after user interaction)
  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const config = SOUND_CONFIGS[type]
  const now = ctx.currentTime

  // Create oscillator
  const oscillator = ctx.createOscillator()
  oscillator.type = config.type
  oscillator.frequency.setValueAtTime(config.frequency, now)

  // Create gain node for volume control and decay
  const gainNode = ctx.createGain()
  const volume = settings.volume * 0.5 // Keep sounds subtle
  gainNode.gain.setValueAtTime(volume, now)

  // Apply decay if specified
  if (config.decay) {
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + config.duration)
  } else {
    gainNode.gain.setValueAtTime(volume, now + config.duration - 0.01)
    gainNode.gain.linearRampToValueAtTime(0, now + config.duration)
  }

  // Connect and play
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + config.duration)
}

/**
 * Play success sound (two-tone ascending)
 */
export function playSuccessSound(): void {
  const settings = useAudioSettings.getState()
  if (!settings.enabled) return

  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const now = ctx.currentTime
  const volume = settings.volume * 0.3

  // First tone
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.frequency.setValueAtTime(523, now) // C5
  gain1.gain.setValueAtTime(volume, now)
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.start(now)
  osc1.stop(now + 0.1)

  // Second tone (higher)
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.frequency.setValueAtTime(659, now + 0.08) // E5
  gain2.gain.setValueAtTime(0, now)
  gain2.gain.setValueAtTime(volume, now + 0.08)
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.18)
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.start(now + 0.08)
  osc2.stop(now + 0.18)
}

/**
 * Play error sound (descending tone)
 */
export function playErrorSound(): void {
  const settings = useAudioSettings.getState()
  if (!settings.enabled) return

  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const now = ctx.currentTime
  const volume = settings.volume * 0.25

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(300, now)
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.2)

  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.2)
}

export default {
  playSound,
  playSuccessSound,
  playErrorSound,
  useAudioSettings
}
