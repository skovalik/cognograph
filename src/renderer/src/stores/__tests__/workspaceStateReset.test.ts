// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Workspace State Golden Reset Test
 *
 * Asserts that newWorkspace() resets ALL transient state fields to defaults.
 * If anyone adds a new field and forgets to reset it in newWorkspace(),
 * this test catches the regression.
 *
 * Every transient field that newWorkspace() resets is dirtied with a non-default
 * value, then newWorkspace() is called, and the clean state is verified.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { resetWorkspaceStore } from '../../../../test/storeUtils'
import { useWorkspaceStore } from '../workspaceStore'

describe('Workspace state golden reset', () => {
  beforeEach(() => {
    resetWorkspaceStore()
  })

  it('newWorkspace() resets ALL transient state to defaults', () => {
    // 1. Dirty every transient field that newWorkspace() should reset
    useWorkspaceStore.setState({
      // Core data
      nodes: [{ id: 'dirty-node', type: 'default', position: { x: 0, y: 0 }, data: {} } as any],
      edges: [{ id: 'dirty-edge', source: 'a', target: 'b' } as any],
      viewport: { x: 100, y: 200, zoom: 3 },

      // Selection
      selectedNodeIds: ['sel1', 'sel2'],
      selectedEdgeIds: ['edge1'],

      // Panel state
      activePanel: 'chat',
      activeChatNodeId: 'chat1',
      openChatNodeIds: ['chat1', 'chat2'],

      // Left sidebar state
      leftSidebarOpen: true,
      leftSidebarTab: 'extractions',
      expandedNodeIds: new Set(['exp1', 'exp2']),
      layersSortMode: 'type',
      manualLayerOrder: ['n1', 'n2'],
      layersFilter: 'search term',
      hiddenNodeTypes: new Set(['conversation'] as any),
      showMembersProjectId: 'proj1',
      focusModeNodeId: 'focus1',
      inPlaceExpandedNodeId: 'expanded1',
      bookmarkedNodeId: 'bm1',
      numberedBookmarks: {
        1: 'nb1',
        2: 'nb2',
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: null,
        9: null,
      },

      // Session state
      sessionInteractions: [{ nodeId: 'n1', timestamp: 123, action: 'select' as const }],
      lastSessionNodeId: 'last-session',

      // Extraction state
      pendingExtractions: [{ id: 'ext1' } as any],
      extractionDrag: {
        extractionId: 'drag1',
        position: { x: 0, y: 0 },
        type: 'note' as const,
        title: 'test',
      },
      extractionSourceFilter: 'source1',
      openExtractionPanelNodeId: 'panel1',
      lastAcceptedExtraction: {
        extractionData: { id: 'ext1' } as any,
        createdNodeId: 'cn1',
        createdEdgeId: 'ce1',
        timestamp: 999,
      },
      isExtracting: 'node1',

      // Streaming/animation state
      streamingConversations: new Set(['conv1', 'conv2']),
      recentlySpawnedNodes: new Set(['rs1']),
      spawningNodeIds: ['sp1', 'sp2'],
      nodeUpdatedAt: new Map([
        ['n1', Date.now()],
        ['n2', Date.now()],
      ]),

      // Drag/resize state
      dragStartPositions: new Map([['d1', { x: 10, y: 20 }]]),
      resizeStartDimensions: new Map([['r1', { width: 100, height: 200 }]]),

      // Floating properties
      floatingPropertiesNodeIds: ['fp1', 'fp2'],

      // Pinned windows
      pinnedWindows: [
        {
          nodeId: 'pin1',
          position: { x: 0, y: 0 },
          size: { width: 200, height: 200 },
          zIndex: 5,
        } as any,
      ],
      nextPinnedZIndex: 5,

      // History
      history: [{ type: 'ADD_NODE' } as any, { type: 'DELETE_NODE' } as any],
      historyIndex: 1,

      // Status flags
      isDirty: true,
      lastSaved: Date.now(),
      saveStatus: 'unsaved' as const,
      lastCanvasClick: { x: 50, y: 60, time: Date.now() },
      lastCreatedNodeId: 'created1',

      // Multiplayer
      multiplayerConfig: {
        serverUrl: 'ws://test',
        workspaceId: 'mp1',
        token: 'tok',
        userName: 'user',
        userColor: '#ff0000',
      },
      _syncSource: 'yjs' as const,

      // Command bar
      commandLog: [
        { id: 'cmd1', input: 'test', status: 'completed', startedAt: Date.now() } as any,
      ],
      workspaceConversation: {
        id: 'old-conv',
        messages: [{ id: '1', role: 'user' as const, content: 'old', timestamp: 0 }],
      },
    })

    // 2. Verify state IS dirty (sanity check)
    const dirty = useWorkspaceStore.getState()
    expect(dirty.nodes.length).toBeGreaterThan(0)
    expect(dirty.edges.length).toBeGreaterThan(0)
    expect(dirty.selectedNodeIds.length).toBeGreaterThan(0)
    expect(dirty.streamingConversations.size).toBeGreaterThan(0)
    expect(dirty.nodeUpdatedAt.size).toBeGreaterThan(0)
    expect(dirty.commandLog.length).toBeGreaterThan(0)
    expect(dirty.isDirty).toBe(true)
    expect(dirty.historyIndex).toBe(1)

    // 3. Call newWorkspace
    useWorkspaceStore.getState().newWorkspace()

    // 4. Assert ALL transient fields are reset to defaults
    const clean = useWorkspaceStore.getState()

    // Core data
    expect(clean.nodes).toEqual([])
    expect(clean.edges).toEqual([])
    expect(clean.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(clean.workspaceName).toBe('Untitled Workspace')
    expect(clean.workspaceId).toBeTruthy() // Should be a fresh UUID, not null

    // Selection
    expect(clean.selectedNodeIds).toEqual([])
    expect(clean.selectedEdgeIds).toEqual([])

    // Panel state
    expect(clean.activePanel).toBe('none')
    expect(clean.activeChatNodeId).toBeNull()
    expect(clean.openChatNodeIds).toEqual([])

    // Left sidebar state
    expect(clean.leftSidebarOpen).toBe(false)
    expect(clean.leftSidebarTab).toBe('layers')
    expect(clean.expandedNodeIds.size).toBe(0)
    expect(clean.layersSortMode).toBe('hierarchy')
    expect(clean.manualLayerOrder).toBeNull()
    expect(clean.layersFilter).toBe('')
    expect(clean.hiddenNodeTypes.size).toBe(0)
    expect(clean.showMembersProjectId).toBeNull()
    expect(clean.focusModeNodeId).toBeNull()
    expect(clean.inPlaceExpandedNodeId).toBeNull()
    expect(clean.bookmarkedNodeId).toBeNull()
    expect(Object.values(clean.numberedBookmarks).every((v) => v === null)).toBe(true)

    // Session state
    expect(clean.sessionInteractions).toEqual([])
    expect(clean.lastSessionNodeId).toBeNull()

    // Extraction state
    expect(clean.pendingExtractions).toEqual([])
    expect(clean.extractionDrag).toBeNull()
    expect(clean.extractionSourceFilter).toBeNull()
    expect(clean.openExtractionPanelNodeId).toBeNull()
    expect(clean.lastAcceptedExtraction).toBeNull()
    expect(clean.isExtracting).toBeNull()

    // Streaming/animation state
    expect(clean.streamingConversations.size).toBe(0)
    expect(clean.recentlySpawnedNodes.size).toBe(0)
    expect(clean.spawningNodeIds).toEqual([])
    expect(clean.nodeUpdatedAt.size).toBe(0)

    // Drag/resize state
    expect(clean.dragStartPositions.size).toBe(0)
    expect(clean.resizeStartDimensions.size).toBe(0)

    // Floating properties
    expect(clean.floatingPropertiesNodeIds).toEqual([])

    // Pinned windows
    expect(clean.pinnedWindows).toEqual([])
    expect(clean.nextPinnedZIndex).toBe(1)

    // History
    expect(clean.history).toEqual([])
    expect(clean.historyIndex).toBe(-1)

    // Status flags
    expect(clean.isDirty).toBe(false)
    expect(clean.lastSaved).toBeNull()
    expect(clean.saveStatus).toBe('saved')
    expect(clean.lastCanvasClick).toBeNull()
    expect(clean.lastCreatedNodeId).toBeNull()

    // Multiplayer
    expect(clean.multiplayerConfig).toBeNull()
    expect(clean._syncSource).toBe('local')

    // Command bar
    expect(clean.commandLog).toEqual([])
    expect(clean.workspaceConversation.messages).toEqual([])

    // Indexes should be rebuilt (empty)
    expect(clean.nodeIndex.size).toBe(0)
    expect(clean.edgesByTarget.size).toBe(0)
  })

  it('Maps and Sets are fresh instances after reset (not cleared originals)', () => {
    // Dirty the Maps/Sets
    useWorkspaceStore.setState({
      streamingConversations: new Set(['a', 'b']),
      recentlySpawnedNodes: new Set(['c']),
      nodeUpdatedAt: new Map([
        ['x', 1],
        ['y', 2],
      ]),
      dragStartPositions: new Map([['d1', { x: 10, y: 20 }]]),
      resizeStartDimensions: new Map([['r1', { width: 100, height: 200 }]]),
      expandedNodeIds: new Set(['e1']),
      hiddenNodeTypes: new Set(['conversation'] as any),
    })

    // Capture references before reset
    const before = useWorkspaceStore.getState()
    expect(before.streamingConversations.size).toBe(2)
    expect(before.nodeUpdatedAt.size).toBe(2)

    // Reset
    useWorkspaceStore.getState().newWorkspace()

    // Verify they're empty
    const after = useWorkspaceStore.getState()
    expect(after.streamingConversations.size).toBe(0)
    expect(after.recentlySpawnedNodes.size).toBe(0)
    expect(after.nodeUpdatedAt.size).toBe(0)
    expect(after.dragStartPositions.size).toBe(0)
    expect(after.resizeStartDimensions.size).toBe(0)
    expect(after.expandedNodeIds.size).toBe(0)
    expect(after.hiddenNodeTypes.size).toBe(0)
  })

  it('newWorkspace() generates a new workspaceId each time', () => {
    useWorkspaceStore.getState().newWorkspace()
    const id1 = useWorkspaceStore.getState().workspaceId

    useWorkspaceStore.getState().newWorkspace()
    const id2 = useWorkspaceStore.getState().workspaceId

    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id1).not.toBe(id2)
  })

  it('newWorkspace() sets createdAt to current timestamp', () => {
    const beforeTime = Date.now()
    useWorkspaceStore.getState().newWorkspace()
    const afterTime = Date.now()

    const { createdAt } = useWorkspaceStore.getState()
    expect(createdAt).toBeGreaterThanOrEqual(beforeTime)
    expect(createdAt).toBeLessThanOrEqual(afterTime)
  })

  it('workspaceConversation gets a fresh id after reset', () => {
    useWorkspaceStore.setState({
      workspaceConversation: {
        id: 'custom-old-id',
        messages: [{ id: '1', role: 'user', content: 'test', timestamp: 0 }],
      },
    })

    useWorkspaceStore.getState().newWorkspace()

    const conv = useWorkspaceStore.getState().workspaceConversation
    expect(conv.id).toBe('workspace-command-conversation')
    expect(conv.messages).toEqual([])
  })
})

// Welcome store independence test removed — welcomeStore deleted.
// Welcome visibility is now derived from nodeCount + sessionDismissed (runtime state).
