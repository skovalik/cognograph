/**
 * AIEditorStore Tests
 *
 * Tests for AI editor modal state management.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useAIEditorStore } from '../aiEditorStore'
import { resetAIEditorStore, getAIEditorState } from '../../../../test/storeUtils'

describe('aiEditorStore', () => {
  beforeEach(() => {
    resetAIEditorStore()
  })

  describe('initial state (after reset)', () => {
    it('should have modal closed by default', () => {
      expect(getAIEditorState().isOpen).toBe(false)
    })

    it('should have mode as organize after reset', () => {
      // Note: The store's default is 'generate', but resetAIEditorStore sets it to 'organize'
      expect(getAIEditorState().mode).toBe('organize')
    })

    it('should have default scope as selection', () => {
      expect(getAIEditorState().scope).toBe('selection')
    })

    it('should have empty prompt', () => {
      expect(getAIEditorState().prompt).toBe('')
    })

    it('should not be generating or executing', () => {
      const state = getAIEditorState()
      expect(state.isGeneratingPlan).toBe(false)
      expect(state.isExecutingPlan).toBe(false)
    })

    it('should have no plan', () => {
      expect(getAIEditorState().currentPlan).toBeNull()
    })

    it('should have preview visible by default', () => {
      expect(getAIEditorState().isPreviewVisible).toBe(true)
    })
  })

  describe('openModal / closeModal', () => {
    it('should open the modal', () => {
      const { openModal } = useAIEditorStore.getState()

      openModal()

      expect(getAIEditorState().isOpen).toBe(true)
    })

    it('should close the modal', () => {
      useAIEditorStore.setState({ isOpen: true })

      const { closeModal } = useAIEditorStore.getState()
      closeModal()

      expect(getAIEditorState().isOpen).toBe(false)
    })

    it('should clear prompt on close', () => {
      useAIEditorStore.setState({ isOpen: true, prompt: 'Some prompt' })

      const { closeModal } = useAIEditorStore.getState()
      closeModal()

      expect(getAIEditorState().prompt).toBe('')
    })

    it('should clear plan on close', () => {
      useAIEditorStore.setState({
        isOpen: true,
        currentPlan: {
          id: 'test-plan',
          mode: 'organize',
          prompt: 'test',
          scope: 'selection',
          operations: [],
          warnings: []
        }
      })

      const { closeModal } = useAIEditorStore.getState()
      closeModal()

      expect(getAIEditorState().currentPlan).toBeNull()
    })

    it('should clear errors on close', () => {
      useAIEditorStore.setState({
        isOpen: true,
        generationError: 'Some error',
        executionError: 'Another error'
      })

      const { closeModal } = useAIEditorStore.getState()
      closeModal()

      const state = getAIEditorState()
      expect(state.generationError).toBeNull()
      expect(state.executionError).toBeNull()
    })
  })

  describe('setMode', () => {
    it('should set mode to organize', () => {
      const { setMode } = useAIEditorStore.getState()

      setMode('organize')

      expect(getAIEditorState().mode).toBe('organize')
    })

    it('should set mode to generate', () => {
      const { setMode } = useAIEditorStore.getState()

      setMode('generate')

      expect(getAIEditorState().mode).toBe('generate')
    })

    it('should set mode to fix', () => {
      const { setMode } = useAIEditorStore.getState()

      setMode('fix')

      expect(getAIEditorState().mode).toBe('fix')
    })
  })

  describe('setScope', () => {
    it('should set scope to selection', () => {
      const { setScope } = useAIEditorStore.getState()

      setScope('selection')

      expect(getAIEditorState().scope).toBe('selection')
    })

    it('should set scope to view', () => {
      const { setScope } = useAIEditorStore.getState()

      setScope('view')

      expect(getAIEditorState().scope).toBe('view')
    })

    it('should set scope to canvas', () => {
      const { setScope } = useAIEditorStore.getState()

      setScope('canvas')

      expect(getAIEditorState().scope).toBe('canvas')
    })

    it('should set scope to single', () => {
      const { setScope } = useAIEditorStore.getState()

      setScope('single')

      expect(getAIEditorState().scope).toBe('single')
    })
  })

  describe('setPrompt', () => {
    it('should update the prompt', () => {
      const { setPrompt } = useAIEditorStore.getState()

      setPrompt('Organize these nodes by topic')

      expect(getAIEditorState().prompt).toBe('Organize these nodes by topic')
    })

    it('should allow empty prompt', () => {
      useAIEditorStore.setState({ prompt: 'Some prompt' })

      const { setPrompt } = useAIEditorStore.getState()
      setPrompt('')

      expect(getAIEditorState().prompt).toBe('')
    })
  })

  describe('setUseAgentMode', () => {
    it('should enable agent mode', () => {
      const { setUseAgentMode } = useAIEditorStore.getState()

      setUseAgentMode(true)

      expect(getAIEditorState().useAgentMode).toBe(true)
    })

    it('should disable agent mode', () => {
      useAIEditorStore.setState({ useAgentMode: true })

      const { setUseAgentMode } = useAIEditorStore.getState()
      setUseAgentMode(false)

      expect(getAIEditorState().useAgentMode).toBe(false)
    })
  })

  describe('togglePreviewVisibility', () => {
    it('should toggle preview from visible to hidden', () => {
      expect(getAIEditorState().isPreviewVisible).toBe(true)

      const { togglePreviewVisibility } = useAIEditorStore.getState()
      togglePreviewVisibility()

      expect(getAIEditorState().isPreviewVisible).toBe(false)
    })

    it('should toggle preview from hidden to visible', () => {
      useAIEditorStore.setState({ isPreviewVisible: false })

      const { togglePreviewVisibility } = useAIEditorStore.getState()
      togglePreviewVisibility()

      expect(getAIEditorState().isPreviewVisible).toBe(true)
    })
  })

  describe('setPreviewState', () => {
    it('should set preview state', () => {
      const previewState = {
        planId: 'test-plan',
        ghostNodes: [],
        deletionOverlays: [],
        movementPaths: [],
        edgePreviews: [],
        nodeUpdates: []
      }

      const { setPreviewState } = useAIEditorStore.getState()
      setPreviewState(previewState)

      expect(getAIEditorState().previewState).toEqual(previewState)
    })

    it('should clear preview state with null', () => {
      useAIEditorStore.setState({
        previewState: {
          planId: 'test-plan',
          ghostNodes: [],
          deletionOverlays: [],
          movementPaths: [],
          edgePreviews: [],
          nodeUpdates: []
        }
      })

      const { setPreviewState } = useAIEditorStore.getState()
      setPreviewState(null)

      expect(getAIEditorState().previewState).toBeNull()
    })
  })

  describe('clearPlan', () => {
    it('should clear the current plan', () => {
      useAIEditorStore.setState({
        currentPlan: {
          id: 'test-plan',
          mode: 'organize',
          prompt: 'test',
          scope: 'selection',
          operations: [],
          warnings: []
        }
      })

      const { clearPlan } = useAIEditorStore.getState()
      clearPlan()

      expect(getAIEditorState().currentPlan).toBeNull()
    })

    it('should clear preview state', () => {
      useAIEditorStore.setState({
        currentPlan: {
          id: 'test-plan',
          mode: 'organize',
          prompt: 'test',
          scope: 'selection',
          operations: [],
          warnings: []
        },
        previewState: {
          planId: 'test-plan',
          ghostNodes: [],
          deletionOverlays: [],
          movementPaths: [],
          edgePreviews: [],
          nodeUpdates: []
        }
      })

      const { clearPlan } = useAIEditorStore.getState()
      clearPlan()

      expect(getAIEditorState().previewState).toBeNull()
    })

    it('should clear generation error (not execution error)', () => {
      useAIEditorStore.setState({
        generationError: 'Some error',
        executionError: 'Another error'
      })

      const { clearPlan } = useAIEditorStore.getState()
      clearPlan()

      const state = getAIEditorState()
      // clearPlan only clears generationError, not executionError
      expect(state.generationError).toBeNull()
      // executionError is NOT cleared by clearPlan
      expect(state.executionError).toBe('Another error')
    })
  })

  describe('startExecution / completeExecution / failExecution', () => {
    it('should set isExecutingPlan to true on start', () => {
      const { startExecution } = useAIEditorStore.getState()

      startExecution()

      expect(getAIEditorState().isExecutingPlan).toBe(true)
    })

    it('should set isExecutingPlan to false on complete', () => {
      useAIEditorStore.setState({ isExecutingPlan: true })

      const { completeExecution } = useAIEditorStore.getState()
      completeExecution()

      expect(getAIEditorState().isExecutingPlan).toBe(false)
    })

    it('should clear plan on complete', () => {
      useAIEditorStore.setState({
        isExecutingPlan: true,
        currentPlan: {
          id: 'test-plan',
          mode: 'organize',
          prompt: 'test',
          scope: 'selection',
          operations: [],
          warnings: []
        }
      })

      const { completeExecution } = useAIEditorStore.getState()
      completeExecution()

      expect(getAIEditorState().currentPlan).toBeNull()
    })

    it('should set error on fail', () => {
      useAIEditorStore.setState({ isExecutingPlan: true })

      const { failExecution } = useAIEditorStore.getState()
      failExecution('Something went wrong')

      const state = getAIEditorState()
      expect(state.isExecutingPlan).toBe(false)
      expect(state.executionError).toBe('Something went wrong')
    })
  })

  describe('registerTempIdMapping / resolveId', () => {
    it('should register temp to real ID mapping', () => {
      const { registerTempIdMapping } = useAIEditorStore.getState()

      registerTempIdMapping('temp-1', 'real-uuid-123')

      expect(getAIEditorState().tempIdToRealId.get('temp-1')).toBe('real-uuid-123')
    })

    it('should resolve temp ID to real ID', () => {
      const mapping = new Map<string, string>()
      mapping.set('temp-1', 'real-uuid-123')
      useAIEditorStore.setState({ tempIdToRealId: mapping })

      const { resolveId } = useAIEditorStore.getState()

      expect(resolveId('temp-1')).toBe('real-uuid-123')
    })

    it('should return original ID if no mapping exists', () => {
      const { resolveId } = useAIEditorStore.getState()

      expect(resolveId('unknown-id')).toBe('unknown-id')
    })
  })

  describe('resetState', () => {
    it('should reset all state to initial values', () => {
      // Set various non-default values
      const mapping = new Map<string, string>()
      mapping.set('temp-1', 'real-1')
      useAIEditorStore.setState({
        isOpen: true,
        mode: 'fix',
        scope: 'canvas',
        prompt: 'Some prompt',
        isGeneratingPlan: true,
        isExecutingPlan: true,
        currentPlan: {
          id: 'test-plan',
          mode: 'organize',
          prompt: 'test',
          scope: 'selection',
          operations: [],
          warnings: []
        },
        generationError: 'Error',
        executionError: 'Error',
        tempIdToRealId: mapping
      })

      const { resetState } = useAIEditorStore.getState()
      resetState()

      const state = getAIEditorState()
      expect(state.isOpen).toBe(false)
      // resetState uses store's initial state which has mode: 'generate'
      expect(state.mode).toBe('generate')
      expect(state.scope).toBe('selection')
      expect(state.prompt).toBe('')
      expect(state.isGeneratingPlan).toBe(false)
      expect(state.isExecutingPlan).toBe(false)
      expect(state.currentPlan).toBeNull()
      expect(state.generationError).toBeNull()
      expect(state.executionError).toBeNull()
      expect(state.tempIdToRealId.size).toBe(0)
    })
  })
})
