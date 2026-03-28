// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Store Sync Bridge
 *
 * Keeps workspaceStore ↔ nodesStore/edgesStore in sync bidirectionally.
 *
 * Problem: nodesStore and edgesStore were extracted from workspaceStore
 * (Week 2 Stream B Track 2 Phase 2.2a) but never wired for synchronization.
 * Components reading from nodesStore get stale/empty data. Mutations to
 * nodesStore don't propagate to workspaceStore (which saves to disk).
 *
 * Solution: Subscribe to changes in each store and push updates to the other.
 * A `_syncing` guard prevents infinite recursion.
 *
 * Usage: Import this module once in the app entry point (App.tsx or main.tsx).
 *        import '@/stores/storeSyncBridge'
 */

import { useWorkspaceStore } from './workspaceStore'
import { useNodesStore } from './nodesStore'
import { useEdgesStore } from './edgesStore'

let _syncing = false

function withSyncGuard(fn: () => void): void {
  if (_syncing) return
  _syncing = true
  try {
    fn()
  } finally {
    _syncing = false
  }
}

// workspaceStore.nodes → nodesStore.nodes
useWorkspaceStore.subscribe(
  (state) => state.nodes,
  (nodes) => {
    withSyncGuard(() => {
      useNodesStore.getState().setNodes(nodes)
    })
  }
)

// workspaceStore.edges → edgesStore.edges
useWorkspaceStore.subscribe(
  (state) => state.edges,
  (edges) => {
    withSyncGuard(() => {
      useEdgesStore.getState().setEdges(edges)
    })
  }
)

// nodesStore.nodes → workspaceStore (only the nodes array, mark dirty)
useNodesStore.subscribe(
  (state) => state.nodes,
  (nodes) => {
    withSyncGuard(() => {
      const ws = useWorkspaceStore.getState()
      // Only sync if there's actually a difference (reference equality)
      if (ws.nodes !== nodes) {
        useWorkspaceStore.setState({ nodes, isDirty: true })
      }
    })
  }
)

// edgesStore.edges → workspaceStore (only the edges array, mark dirty)
useEdgesStore.subscribe(
  (state) => state.edges,
  (edges) => {
    withSyncGuard(() => {
      const ws = useWorkspaceStore.getState()
      if (ws.edges !== edges) {
        useWorkspaceStore.setState({ edges, isDirty: true })
      }
    })
  }
)

// Export a no-op to ensure this module gets imported
export const storeSyncBridgeInitialized = true
