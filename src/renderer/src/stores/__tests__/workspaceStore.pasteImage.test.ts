// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * WorkspaceStore Paste Image Tests
 *
 * Tests the createArtifactFromFile store action with image data, validating
 * the data transformation pipeline that the paste handler relies on.
 * The paste event listener itself is in App.tsx and is tested manually (Task 3).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getWorkspaceState, resetWorkspaceStore } from '../../../../test/storeUtils'
import { resetTestCounters } from '../../../../test/utils'
import { useWorkspaceStore } from '../workspaceStore'

describe('Paste Image → Artifact Node', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
  })

  describe('createArtifactFromFile (image path)', () => {
    it('should create an artifact node from a base64 image', () => {
      const { createArtifactFromFile } = useWorkspaceStore.getState()

      // Simulate what the paste handler produces: a base64 data URI
      const fakeBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
      const nodeId = createArtifactFromFile(
        { name: 'pasted-image-1234.png', content: fakeBase64, isBase64: true },
        { x: 100, y: 200 },
      )

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(1)

      const node = state.nodes[0]!
      expect(node.id).toBe(nodeId)
      expect(node.type).toBe('artifact')
      expect(node.position).toEqual({ x: 100, y: 200 })
      expect(node.data.type).toBe('artifact')
      expect(node.data.content).toBe(fakeBase64)
      expect(node.data.title).toBe('pasted-image-1234.png')
      expect(node.data.contentType).toBe('image')
    })

    it('should create artifact nodes from multiple images with cascading positions', () => {
      const { createArtifactFromFile } = useWorkspaceStore.getState()

      const fakeBase64 = 'data:image/jpeg;base64,/9j/4AAQ=='

      const nodeId1 = createArtifactFromFile(
        { name: 'image1.jpg', content: fakeBase64, isBase64: true },
        { x: 0, y: 0 },
      )
      const nodeId2 = createArtifactFromFile(
        { name: 'image2.jpg', content: fakeBase64, isBase64: true },
        { x: 340, y: 20 },
      )

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(2)
      expect(state.nodes[0]!.position).toEqual({ x: 0, y: 0 })
      expect(state.nodes[1]!.position).toEqual({ x: 340, y: 20 })
      expect(nodeId1).not.toBe(nodeId2)
    })

    it('should handle webp images', () => {
      const { createArtifactFromFile } = useWorkspaceStore.getState()

      const nodeId = createArtifactFromFile(
        { name: 'screenshot.webp', content: 'data:image/webp;base64,UklGR', isBase64: true },
        { x: 50, y: 50 },
      )

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === nodeId)!
      expect(node.data.contentType).toBe('image')
      expect(node.data.title).toBe('screenshot.webp')
    })

    it('should record history for undo support', () => {
      const { createArtifactFromFile } = useWorkspaceStore.getState()

      createArtifactFromFile(
        { name: 'test.png', content: 'data:image/png;base64,abc', isBase64: true },
        { x: 0, y: 0 },
      )

      const state = getWorkspaceState()
      expect(state.isDirty).toBe(true)
      expect(state.history.length).toBeGreaterThan(0)
      const lastAction = state.history[state.history.length - 1]
      expect(lastAction).toBeDefined()
      expect(lastAction!.type).toBe('ADD_NODE')
    })
  })
})
