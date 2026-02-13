/**
 * Voice Control Service (Prep)
 *
 * Foundation for voice commands using Web Speech API.
 * ND-friendly: Hands-free operation for those who prefer verbal commands.
 *
 * Status: Preparation only - not yet integrated into UI.
 * To enable: Add settings toggle and integrate with command palette.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Voice command types that could be recognized
export type VoiceCommand =
  | 'create_note'
  | 'create_task'
  | 'create_conversation'
  | 'undo'
  | 'redo'
  | 'save'
  | 'zoom_in'
  | 'zoom_out'
  | 'focus_mode'
  | 'help'
  | 'delete'
  | 'unknown'

// Voice command patterns (expandable)
const COMMAND_PATTERNS: Array<{ pattern: RegExp; command: VoiceCommand }> = [
  { pattern: /create\s+(a\s+)?note/i, command: 'create_note' },
  { pattern: /new\s+note/i, command: 'create_note' },
  { pattern: /create\s+(a\s+)?task/i, command: 'create_task' },
  { pattern: /new\s+task/i, command: 'create_task' },
  { pattern: /create\s+(a\s+)?conversation/i, command: 'create_conversation' },
  { pattern: /new\s+conversation/i, command: 'create_conversation' },
  { pattern: /start\s+chat/i, command: 'create_conversation' },
  { pattern: /undo/i, command: 'undo' },
  { pattern: /redo/i, command: 'redo' },
  { pattern: /save/i, command: 'save' },
  { pattern: /zoom\s+in/i, command: 'zoom_in' },
  { pattern: /zoom\s+out/i, command: 'zoom_out' },
  { pattern: /focus(\s+mode)?/i, command: 'focus_mode' },
  { pattern: /help/i, command: 'help' },
  { pattern: /shortcuts/i, command: 'help' },
  { pattern: /delete/i, command: 'delete' },
  { pattern: /remove/i, command: 'delete' }
]

// Settings store
interface VoiceSettingsState {
  enabled: boolean
  language: string
  continuous: boolean
  setEnabled: (enabled: boolean) => void
  setLanguage: (language: string) => void
  setContinuous: (continuous: boolean) => void
}

export const useVoiceSettings = create<VoiceSettingsState>()(
  persist(
    (set) => ({
      enabled: false, // Disabled by default
      language: 'en-US',
      continuous: false, // Single command mode by default
      setEnabled: (enabled) => set({ enabled }),
      setLanguage: (language) => set({ language }),
      setContinuous: (continuous) => set({ continuous })
    }),
    {
      name: 'cognograph-voice-settings'
    }
  )
)

// Voice service state
interface VoiceServiceState {
  isListening: boolean
  isSupported: boolean
  lastTranscript: string
  lastCommand: VoiceCommand | null
  error: string | null
}

interface VoiceServiceStore extends VoiceServiceState {
  startListening: () => void
  stopListening: () => void
  setError: (error: string | null) => void
  onCommand: (callback: (command: VoiceCommand, transcript: string) => void) => () => void
}

// Check browser support
const isSpeechRecognitionSupported = (): boolean => {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
}

// Get SpeechRecognition constructor
const getSpeechRecognition = (): typeof SpeechRecognition | null => {
  if ('SpeechRecognition' in window) {
    return (window as unknown as { SpeechRecognition: typeof SpeechRecognition }).SpeechRecognition
  }
  if ('webkitSpeechRecognition' in window) {
    return (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition
  }
  return null
}

// Parse transcript to command
function parseCommand(transcript: string): VoiceCommand {
  const normalized = transcript.toLowerCase().trim()

  for (const { pattern, command } of COMMAND_PATTERNS) {
    if (pattern.test(normalized)) {
      return command
    }
  }

  return 'unknown'
}

// Command callbacks
type CommandCallback = (command: VoiceCommand, transcript: string) => void
const commandCallbacks = new Set<CommandCallback>()

// Singleton recognition instance
let recognition: SpeechRecognition | null = null

export const useVoiceService = create<VoiceServiceStore>((set, get) => ({
  isListening: false,
  isSupported: isSpeechRecognitionSupported(),
  lastTranscript: '',
  lastCommand: null,
  error: null,

  startListening: () => {
    const settings = useVoiceSettings.getState()
    if (!settings.enabled) {
      set({ error: 'Voice control is disabled in settings' })
      return
    }

    if (!isSpeechRecognitionSupported()) {
      set({ error: 'Speech recognition is not supported in this browser' })
      return
    }

    const SpeechRecognitionClass = getSpeechRecognition()
    if (!SpeechRecognitionClass) {
      set({ error: 'Could not initialize speech recognition' })
      return
    }

    // Create or reuse recognition instance
    if (!recognition) {
      recognition = new SpeechRecognitionClass()
      recognition.lang = settings.language
      recognition.interimResults = false
      recognition.continuous = settings.continuous
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        set({ isListening: true, error: null })
      }

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript
        const command = parseCommand(transcript)

        set({ lastTranscript: transcript, lastCommand: command })

        // Notify all callbacks
        commandCallbacks.forEach((callback) => callback(command, transcript))
      }

      recognition.onerror = (event) => {
        set({
          error: `Voice recognition error: ${event.error}`,
          isListening: false
        })
      }

      recognition.onend = () => {
        set({ isListening: false })
      }
    }

    try {
      recognition.start()
    } catch (e) {
      set({ error: 'Failed to start voice recognition' })
    }
  },

  stopListening: () => {
    if (recognition && get().isListening) {
      recognition.stop()
    }
  },

  setError: (error) => set({ error }),

  onCommand: (callback) => {
    commandCallbacks.add(callback)
    return () => {
      commandCallbacks.delete(callback)
    }
  }
}))

export default {
  useVoiceSettings,
  useVoiceService,
  parseCommand
}
