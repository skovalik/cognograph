/**
 * ExtractionService Tests
 *
 * Tests for note/task extraction from node content.
 *
 * Note: extractFromNode calls window.api.llm.extract, so full integration
 * tests require mocking. These tests focus on the extraction flow and
 * store integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { extractFromNode } from '../extractionService'
import { resetWorkspaceStore, getWorkspaceState, seedNode } from '../../../../test/storeUtils'
import { createNoteNode, createConversationNode, createTaskNode, resetTestCounters } from '../../../../test/utils'

// Mock window.api.llm.extract
const mockExtract = vi.fn()
vi.stubGlobal('window', {
  api: {
    llm: {
      extract: mockExtract
    }
  }
})

// Mock sciFiToast to avoid UI side effects
vi.mock('@renderer/utils/toast', () => ({
  sciFiToast: vi.fn()
}))

describe('extractionService', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
    mockExtract.mockReset()
  })

  describe('extractFromNode', () => {
    it('should not extract from empty content', async () => {
      const note = createNoteNode('', { id: 'note-1' })
      seedNode(note)

      await extractFromNode('note-1')

      // Should not call LLM for empty content
      expect(mockExtract).not.toHaveBeenCalled()
    })

    it('should not extract from non-existent node', async () => {
      await extractFromNode('non-existent')

      expect(mockExtract).not.toHaveBeenCalled()
    })

    it('should call LLM extract for note with content', async () => {
      const note = createNoteNode('Meeting notes: We need to implement feature X', { id: 'note-1' })
      seedNode(note)

      mockExtract.mockResolvedValue({
        success: true,
        data: JSON.stringify({
          extractions: [
            {
              type: 'task',
              title: 'Implement feature X',
              description: 'As discussed in meeting',
              confidence: 0.8,
              priority: 'medium',
              tags: ['feature']
            }
          ]
        })
      })

      await extractFromNode('note-1')

      expect(mockExtract).toHaveBeenCalledOnce()
      expect(mockExtract).toHaveBeenCalledWith(expect.objectContaining({
        userPrompt: expect.stringContaining('Meeting notes')
      }))
    })

    it('should add extracted items as pending extractions', async () => {
      const note = createNoteNode('Todo: Fix the bug in authentication', { id: 'note-1' })
      seedNode(note)

      mockExtract.mockResolvedValue({
        success: true,
        data: JSON.stringify({
          extractions: [
            {
              type: 'task',
              title: 'Fix authentication bug',
              description: 'Bug in authentication flow',
              confidence: 0.9,
              priority: 'high',
              tags: ['bug', 'auth']
            }
          ]
        })
      })

      await extractFromNode('note-1')

      const state = getWorkspaceState()
      expect(state.pendingExtractions).toHaveLength(1)
      expect(state.pendingExtractions[0]!.type).toBe('task')
      expect(state.pendingExtractions[0]!.sourceNodeId).toBe('note-1')
    })

    it('should filter out low confidence extractions', async () => {
      const note = createNoteNode('Some ambiguous content', { id: 'note-1' })
      seedNode(note)

      mockExtract.mockResolvedValue({
        success: true,
        data: JSON.stringify({
          extractions: [
            {
              type: 'task',
              title: 'Maybe a task',
              description: 'Very uncertain',
              confidence: 0.2, // Below 0.3 threshold
              priority: 'low',
              tags: []
            },
            {
              type: 'note',
              title: 'Definitely a note',
              description: 'High confidence',
              confidence: 0.8,
              priority: 'medium',
              tags: []
            }
          ]
        })
      })

      await extractFromNode('note-1')

      const state = getWorkspaceState()
      // Only high confidence extraction should be added
      expect(state.pendingExtractions).toHaveLength(1)
      expect(state.pendingExtractions[0]!.suggestedData.title).toBe('Definitely a note')
    })

    it('should handle extraction failure gracefully', async () => {
      const note = createNoteNode('Content to extract', { id: 'note-1' })
      seedNode(note)

      mockExtract.mockResolvedValue({
        success: false,
        error: 'API error'
      })

      // Should not throw
      await expect(extractFromNode('note-1')).resolves.not.toThrow()

      const state = getWorkspaceState()
      expect(state.pendingExtractions).toHaveLength(0)
    })

    it('should handle malformed JSON response', async () => {
      const note = createNoteNode('Content to extract', { id: 'note-1' })
      seedNode(note)

      mockExtract.mockResolvedValue({
        success: true,
        data: 'not valid json'
      })

      // Should not throw
      await expect(extractFromNode('note-1')).resolves.not.toThrow()

      const state = getWorkspaceState()
      expect(state.pendingExtractions).toHaveLength(0)
    })

    it('should handle response with no extractions', async () => {
      const note = createNoteNode('Content with nothing to extract', { id: 'note-1' })
      seedNode(note)

      mockExtract.mockResolvedValue({
        success: true,
        data: JSON.stringify({ extractions: [] })
      })

      await extractFromNode('note-1')

      const state = getWorkspaceState()
      expect(state.pendingExtractions).toHaveLength(0)
    })

    it('should set isExtracting state during extraction', async () => {
      const note = createNoteNode('Content to extract', { id: 'note-1' })
      seedNode(note)

      let isExtractingDuringCall: string | null = null

      mockExtract.mockImplementation(async () => {
        // Capture state during LLM call
        isExtractingDuringCall = getWorkspaceState().isExtracting
        return {
          success: true,
          data: JSON.stringify({ extractions: [] })
        }
      })

      await extractFromNode('note-1')

      expect(isExtractingDuringCall).toBe('note-1')

      // Should be cleared after
      const state = getWorkspaceState()
      expect(state.isExtracting).toBeNull()
    })

    it('should extract from conversation node messages', async () => {
      const conv = createConversationNode(
        [
          { role: 'user', content: 'Can you help me plan the project?' },
          { role: 'assistant', content: 'Sure! Here are the key tasks: 1. Setup, 2. Development, 3. Testing' }
        ],
        { id: 'conv-1' }
      )
      seedNode(conv)

      mockExtract.mockResolvedValue({
        success: true,
        data: JSON.stringify({
          extractions: [
            { type: 'task', title: 'Setup', description: '', confidence: 0.8, tags: [] },
            { type: 'task', title: 'Development', description: '', confidence: 0.8, tags: [] },
            { type: 'task', title: 'Testing', description: '', confidence: 0.8, tags: [] }
          ]
        })
      })

      await extractFromNode('conv-1')

      expect(mockExtract).toHaveBeenCalledWith(expect.objectContaining({
        userPrompt: expect.stringContaining('Can you help me plan')
      }))

      const state = getWorkspaceState()
      expect(state.pendingExtractions).toHaveLength(3)
    })

    it('should extract from task node description', async () => {
      const task = createTaskNode('todo', { id: 'task-1' })
      task.data.description = 'Main task with subtasks: A, B, C'
      seedNode(task)

      mockExtract.mockResolvedValue({
        success: true,
        data: JSON.stringify({
          extractions: [
            { type: 'task', title: 'Subtask A', description: '', confidence: 0.7, tags: [] }
          ]
        })
      })

      await extractFromNode('task-1')

      expect(mockExtract).toHaveBeenCalledWith(expect.objectContaining({
        userPrompt: expect.stringContaining('Main task with subtasks')
      }))
    })

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const note = createNoteNode('Content to extract', { id: 'note-1' })
      seedNode(note)

      mockExtract.mockResolvedValue({
        success: true,
        data: '```json\n{"extractions": [{"type": "note", "title": "Test", "description": "", "confidence": 0.8, "tags": []}]}\n```'
      })

      await extractFromNode('note-1')

      const state = getWorkspaceState()
      expect(state.pendingExtractions).toHaveLength(1)
      expect(state.pendingExtractions[0]!.suggestedData.title).toBe('Test')
    })

    it('should open extractions sidebar after successful extraction', async () => {
      const note = createNoteNode('Content to extract', { id: 'note-1' })
      seedNode(note)

      mockExtract.mockResolvedValue({
        success: true,
        data: JSON.stringify({
          extractions: [
            { type: 'note', title: 'Extracted', description: '', confidence: 0.8, tags: [] }
          ]
        })
      })

      await extractFromNode('note-1')

      const state = getWorkspaceState()
      expect(state.leftSidebarTab).toBe('extractions')
    })
  })
})
