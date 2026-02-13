import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCommandBarStore } from '../commandBarStore'

// =============================================================================
// TEST SETUP
// =============================================================================

// Mock the proposalStore
vi.mock('../proposalStore', () => ({
  useProposalStore: {
    getState: () => ({
      addProposal: vi.fn(),
    }),
  },
}))

beforeEach(() => {
  useCommandBarStore.setState({
    isVisible: false,
    currentCommand: null,
    currentStatus: 'composing',
    optimisticIntent: null,
    history: [],
    maxHistory: 100,
    suggestions: [],
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// =============================================================================
// TESTS
// =============================================================================

describe('commandBarStore', () => {
  describe('toggleVisibility', () => {
    it('toggles command bar visibility', () => {
      expect(useCommandBarStore.getState().isVisible).toBe(false)

      useCommandBarStore.getState().toggleVisibility()
      expect(useCommandBarStore.getState().isVisible).toBe(true)

      useCommandBarStore.getState().toggleVisibility()
      expect(useCommandBarStore.getState().isVisible).toBe(false)
    })
  })

  describe('setVisibility', () => {
    it('sets specific visibility', () => {
      useCommandBarStore.getState().setVisibility(true)
      expect(useCommandBarStore.getState().isVisible).toBe(true)

      useCommandBarStore.getState().setVisibility(false)
      expect(useCommandBarStore.getState().isVisible).toBe(false)
    })
  })

  describe('submitCommand', () => {
    it('submits a simple create-node command', async () => {
      // window.api.bridge is not available in test env, so it'll use fallback
      await useCommandBarStore.getState().submitCommand('Create a note about testing')

      const state = useCommandBarStore.getState()
      expect(state.currentCommand).toBeDefined()
      expect(state.currentCommand!.raw).toBe('Create a note about testing')
      // Without bridge API, it falls back to local classification
      expect(state.currentCommand!.parsed?.intent).toBe('create-node')
      expect(state.currentStatus).not.toBe('parsing')
      expect(state.history).toHaveLength(1)
    })

    it('submits unknown command and gets failure', async () => {
      await useCommandBarStore.getState().submitCommand('xyzzy magic nonsense')

      const state = useCommandBarStore.getState()
      expect(state.currentCommand?.parsed?.intent).toBe('unknown')
      expect(state.currentStatus).toBe('failed')
    })

    it('adds commands to history', async () => {
      await useCommandBarStore.getState().submitCommand('Create a note about A')
      await useCommandBarStore.getState().submitCommand('Create a task about B')

      const state = useCommandBarStore.getState()
      expect(state.history).toHaveLength(2)
      // Most recent first
      expect(state.history[0].raw).toBe('Create a task about B')
      expect(state.history[1].raw).toBe('Create a note about A')
    })

    it('respects maxHistory limit', async () => {
      useCommandBarStore.setState({ maxHistory: 3 })

      await useCommandBarStore.getState().submitCommand('Command 1')
      await useCommandBarStore.getState().submitCommand('Command 2')
      await useCommandBarStore.getState().submitCommand('Command 3')
      await useCommandBarStore.getState().submitCommand('Command 4')

      expect(useCommandBarStore.getState().history).toHaveLength(3)
    })

    it('sets optimistic intent during parsing', async () => {
      // We can't easily test the intermediate state since submitCommand is async
      // But we can verify it doesn't remain set after completion
      await useCommandBarStore.getState().submitCommand('Create a note about test')

      expect(useCommandBarStore.getState().optimisticIntent).toBeNull()
    })
  })

  describe('cancelCommand', () => {
    it('clears current command state', async () => {
      await useCommandBarStore.getState().submitCommand('Create a note')

      useCommandBarStore.getState().cancelCommand()

      const state = useCommandBarStore.getState()
      expect(state.currentCommand).toBeNull()
      expect(state.currentStatus).toBe('composing')
      expect(state.optimisticIntent).toBeNull()
    })
  })

  describe('loadSuggestions', () => {
    it('returns template suggestions matching input', () => {
      useCommandBarStore.getState().loadSuggestions('Create')

      const suggestions = useCommandBarStore.getState().suggestions
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.text.toLowerCase().includes('create'))).toBe(true)
    })

    it('returns recent commands matching input', async () => {
      await useCommandBarStore.getState().submitCommand('Create a note about widgets')

      useCommandBarStore.getState().loadSuggestions('widget')

      const suggestions = useCommandBarStore.getState().suggestions
      expect(suggestions.some(s => s.source === 'recent')).toBe(true)
    })

    it('clears suggestions for empty input', () => {
      // 'Create' matches template suggestions
      useCommandBarStore.getState().loadSuggestions('Create')
      expect(useCommandBarStore.getState().suggestions.length).toBeGreaterThan(0)

      useCommandBarStore.getState().loadSuggestions('')
      expect(useCommandBarStore.getState().suggestions).toEqual([])
    })

    it('caps suggestions at 8', () => {
      useCommandBarStore.getState().loadSuggestions('a')

      expect(useCommandBarStore.getState().suggestions.length).toBeLessThanOrEqual(8)
    })
  })

  describe('clearHistory', () => {
    it('clears all command history', async () => {
      await useCommandBarStore.getState().submitCommand('Create a note')
      await useCommandBarStore.getState().submitCommand('Create a task')

      useCommandBarStore.getState().clearHistory()

      expect(useCommandBarStore.getState().history).toEqual([])
    })
  })
})
