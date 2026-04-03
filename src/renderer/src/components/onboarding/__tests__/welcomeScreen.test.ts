// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * WelcomeScreen — visibility logic tests
 *
 * Verifies that welcome screen visibility is derived from
 * node count (shows when nodeCount === 0, hides when nodes exist).
 * welcomeStore has been removed — visibility is now purely runtime.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { resetWorkspaceStore } from '../../../../../test/storeUtils'

describe('WelcomeScreen visibility logic (node-count-based)', () => {
  beforeEach(() => {
    resetWorkspaceStore()
  })

  it('shows when canvas is empty (no nodes)', () => {
    const nodes = useWorkspaceStore.getState().nodes
    expect(nodes.length).toBe(0)
    // showWelcome = nodeCount === 0 && !sessionDismissed
    const showWelcome = nodes.length === 0
    expect(showWelcome).toBe(true)
  })

  it('hides when nodes exist', () => {
    useWorkspaceStore.getState().addNode('note', { x: 0, y: 0 })
    const nodes = useWorkspaceStore.getState().nodes
    expect(nodes.length).toBeGreaterThan(0)
    const showWelcome = nodes.length === 0
    expect(showWelcome).toBe(false)
  })

  it('re-shows when all nodes are removed', () => {
    // Add a node
    useWorkspaceStore.getState().addNode('note', { x: 0, y: 0 })
    expect(useWorkspaceStore.getState().nodes.length).toBe(1)

    // Delete all nodes
    const nodeId = useWorkspaceStore.getState().nodes[0].id
    useWorkspaceStore.getState().deleteNodes([nodeId])
    expect(useWorkspaceStore.getState().nodes.length).toBe(0)

    // Welcome should show again
    const showWelcome = useWorkspaceStore.getState().nodes.length === 0
    expect(showWelcome).toBe(true)
  })

  it('resets on newWorkspace (empty canvas)', () => {
    // Add nodes, then new workspace
    useWorkspaceStore.getState().addNode('note', { x: 0, y: 0 })
    useWorkspaceStore.getState().newWorkspace()

    const nodes = useWorkspaceStore.getState().nodes
    expect(nodes.length).toBe(0)
    const showWelcome = nodes.length === 0
    expect(showWelcome).toBe(true)
  })
})
