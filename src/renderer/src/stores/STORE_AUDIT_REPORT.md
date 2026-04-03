# STORE_AUDIT_REPORT.md

**Phase 4B — STORE-AUDIT**
**Generated:** 2026-03-31
**Scope:** `src/renderer/src/stores/` — 42 Zustand store files, 6,271+ LOC god store

---

## 1. Store Inventory

| Store File | Lines | Middleware | Purpose |
|---|---|---|---|
| **workspaceStore.ts** | **6,271** | immer + subscribeWithSelector | God store — nodes, edges, UI, selection, history, theme, extractions, clipboard, multiplayer |
| canvasStore.ts | 784 | immer + subscribeWithSelector | Split candidate — duplicates node/edge/selection/viewport from workspaceStore |
| nodesStore.ts | 633 | immer + subscribeWithSelector | Split candidate — duplicates nodes from workspaceStore |
| aiEditorStore.ts | 543 | — | AI editor modal state |
| uiStore.ts | 527 | immer + subscribeWithSelector | Split candidate — duplicates panels/sidebar/theme from workspaceStore |
| templateStore.ts | 514 | — | Template browser state |
| actionStore.ts | 502 | — | Action node execution |
| permissionStore.ts | 480 | — | Permission/entitlement checks |
| ccBridgeStore.ts | 433 | — | Claude Code bridge events |
| workflowStore.ts | 424 | — | Workflow execution state |
| bridgeStore.ts | 419 | — | IPC bridge state |
| auditStore.ts | 398 | — | Audit event logging |
| featuresStore.ts | 386 | immer + subscribeWithSelector | Split candidate — duplicates workspace metadata |
| edgesStore.ts | 376 | immer + subscribeWithSelector | Split candidate — duplicates edges from workspaceStore |
| programStore.ts | 373 | — | App-level program state (connectors, keyboard) |
| extractionStore.ts | 367 | — | Split candidate — duplicates extraction state |
| proposalStore.ts | 337 | — | AI proposal/ghost node state |
| historyStore.ts | 326 | — | Split candidate — duplicates undo/redo |
| graphIntelligenceStore.ts | 323 | — | Graph analysis insights |
| propertiesStore.ts | 322 | — | Split candidate — duplicates property schema |
| canvasViewportStore.ts | 317 | immer + subscribeWithSelector | Split candidate — duplicates viewport/bookmarks |
| persistenceStore.ts | 314 | — | Split candidate — duplicates save/load state |
| offlineStore.ts | 304 | — | Offline detection and queue |
| entitlementsStore.ts | 292 | — | License/entitlement management |
| analyticsStore.ts | 278 | — | Usage analytics tracking |
| selectionStore.ts | 253 | immer + subscribeWithSelector | Split candidate — duplicates selection |
| commandBarStore.ts | 249 | — | Command bar state |
| spatialRegionStore.ts | 234 | immer + subscribeWithSelector | Spatial regions (districts) |
| notificationStore.ts | 226 | — | Toast notifications |
| orchestratorStore.ts | 208 | — | Agent orchestration |
| contextVisualizationStore.ts | 203 | — | Context flow visualization |
| connectorStore.ts | 190 | persist | LLM/MCP connector config |
| savedViewsStore.ts | 178 | — | Saved canvas views |
| fileListingStore.ts | 114 | — | File listing for artifacts |
| sessionLinkStore.ts | 108 | — | Session link toasts |
| storeSyncBridge.ts | 102 | — | Bidirectional sync: workspaceStore <-> nodesStore/edgesStore |
| onboardingStore.ts | 101 | — | Onboarding/tutorial state |
| executionStatusStore.ts | 95 | — | Workflow execution badges |
| calmModeStore.ts | 82 | — | PFD calm mode toggle |
| contextMenuStore.ts | 79 | — | Right-click menu state |
| sessionStatsStore.ts | 66 | — | Session cost/token stats |
| contextSelectionStore.ts | 52 | — | Context node selection toggle |
| consoleLogStore.ts | 50 | — | Console log capture |

**Total store code:** ~16,000+ lines across 42 files.

---

## 2. Top 10 Most-Imported Stores

Imports counted across `src/renderer/src/` (excluding tests and the store file itself):

| Rank | Store | File Consumers | getState() Calls | Notes |
|---|---|---|---|---|
| 1 | **workspaceStore** | **136 files** | 182 | God store — everything depends on it |
| 2 | uiStore | 20 | moderate | Panels, sidebar, theme chrome |
| 3 | programStore | 16 | few | App config, keyboard overrides |
| 4 | aiEditorStore | 14 | few | AI editor modal |
| 5 | nodesStore | 13 | few | Split store (synced via bridge) |
| 6 | spatialRegionStore | 12 | few | Districts/regions |
| 7 | actionStore | 9 | few | Action node execution |
| 8 | connectorStore | 8 | few | LLM connector config |
| 9 | templateStore | 7 | few | Template browser |
| 10 | sessionStatsStore | 6 | few | Cost tracking |

---

## 3. Store Dependency Graph

### Inter-Store Dependencies (stores importing other stores)

```
workspaceStore ──> spatialRegionStore         (getState: 4 calls)
actionStore ────> workspaceStore              (getState: 8 calls)
actionStore ────> spatialRegionStore
proposalStore ──> workspaceStore              (getState: 1 call)
commandBarStore > proposalStore               (getState: 1 call)
bridgeStore ───> orchestratorStore
storeSyncBridge > workspaceStore + nodesStore + edgesStore  (bidirectional sync)
```

### Subscribe-Based Cross-Store Coupling

```
storeSyncBridge:
  workspaceStore.subscribe(nodes) --> nodesStore.setNodes()
  workspaceStore.subscribe(edges) --> edgesStore.setEdges()
  nodesStore.subscribe(nodes)     --> workspaceStore.setState({nodes, nodeIndex})
  edgesStore.subscribe(edges)     --> workspaceStore.setState({edges, edgesByTarget})

workspaceStore (self-subscribe):
  subscribe(nodes) --> rebuild nodeIndex (Map<string, number>)
  subscribe(edges) --> rebuild edgesByTarget (Map<string, string[]>)

hooks/useActionSubscription.ts:
  workspaceStore.subscribe(nodes) x1
  workspaceStore.subscribe(edges) x1
  workspaceStore.subscribe(positions) x1

hooks/useAnalyticsTracking.ts:
  workspaceStore.subscribe() x1
  programStore.subscribe() x1

hooks/usePresence.ts:
  workspaceStore.subscribe() x2

hooks/useSpatialNavigation.ts:
  workspaceStore.subscribe() x1

sync/YjsStoreBinding.ts:
  workspaceStore.subscribe() x1

sync/SyncContext.tsx:
  workspaceStore.subscribe() x1
```

---

## 4. Performance Concerns

### 4A. CRITICAL — God Store Problem (workspaceStore)

**workspaceStore is 6,271 lines with 100+ state properties and 100+ actions.** Every `set()` call on this store triggers selector evaluation across **136 consuming files**. Even though most consumers use selectors, each `set()` still requires Zustand to run every active selector function to check equality.

**Impact:** With ~60 nodes and ~40 edges on canvas, a single node title edit triggers:
- Selector evaluation in 136 files
- storeSyncBridge sync cycle (workspace -> nodesStore -> workspace guard)
- nodeIndex rebuild (O(n) Map construction)
- Re-renders in any component whose selector returns a new reference

### 4B. CRITICAL — Full `nodes[]` Array Subscriptions

**42 components** subscribe to `state.nodes` (the entire array). **18 components** subscribe to `state.edges` (the entire array). Because immer produces new array references on any mutation, every node/edge change causes all 42+18 subscribers to re-render.

Worst offenders subscribing to `state.nodes`:
- `App.tsx` — root component, cascades to everything
- `BottomCommandBar.tsx` — always visible
- `LayersPanel.tsx` — always visible when sidebar open
- `ChatPanel.tsx` — subscribes in TWO separate sub-components
- `CommandPalette.tsx` — opened via hotkey
- `FilterViewDropdown.tsx` — toolbar dropdown
- `CognitiveLoadMeter.tsx` — always visible badge
- `CanvasTableOfContents.tsx` — navigation panel
- All 6 node type components (ConversationNode, NoteNode, etc.)

### 4C. CRITICAL — CustomEdge `nodes.find()` in Selectors (Per-Edge Hot Path)

`CustomEdge.tsx` has **15 useWorkspaceStore subscriptions** and **7 selectors that call `state.nodes.find()`**. This component renders once per edge on the canvas. With 40 edges:
- **280 `nodes.find()` calls** on every workspaceStore state change (7 selectors x 40 edges)
- Each `.find()` is O(n) where n = number of nodes
- The selectors return primitives (strings), so re-renders only happen when values change, but **selector evaluation cost is O(n*m)** where n=nodes, m=edges

Selectors doing `nodes.find()` in CustomEdge:
1. `sourceColor` — finds source node, reads color
2. `targetColor` — finds target node, reads color
3. `sourceNodeType` — finds source node, reads type
4. `sourceNodeTitle` — finds source node, reads title
5. `targetNodeType` — finds target node, reads type
6. `targetNodeTitle` — finds target node, reads title
7. `isContextProviderHighlighted` — finds selected node, checks type

**Fix:** Use `nodeIndex` (already exists in store) for O(1) lookup, or memoize per-node data in a derived store.

### 4D. HIGH — Per-Node Component Subscriptions

Each node component subscribes to **6-17 workspaceStore selectors**:

| Node Component | Selector Count |
|---|---|
| ConversationNode | 17 |
| NoteNode | 11 |
| ArtifactNode | 10 |
| ProjectNode | 9 |
| WorkspaceNode | 9 |
| TaskNode | 7 |
| TextNode | 6 |
| OrchestratorNode | 6 |
| ActionNode | 6 |

With 60 nodes on canvas, ConversationNode alone creates **~1,020 selector evaluations** per state change (17 selectors x 60 nodes). Most return stable primitives/functions, but the evaluation overhead is real.

### 4E. HIGH — Full `themeSettings` Object Subscriptions

**24 components** subscribe to the entire `state.themeSettings` object rather than specific sub-properties. Since immer produces a new object reference on any theme mutation, changing one theme property (e.g., `edgeStyle`) re-renders all 24 subscribers even if they only use `mode`.

Components subscribing to full `themeSettings`:
- App.tsx, ChatPanel.tsx, all AI editor components, all node components, PropertiesPanel, SettingsModal, ThemeMenu, etc.

### 4F. MEDIUM — Unselected Store Subscriptions

Only **3 instances** of `useStore()` without a selector (subscribing to entire store):
- `useAIEditorStore()` in AIEditorModal.tsx (destructures ~10 fields)
- `useAIEditorStore()` in InlinePrompt/index.tsx (destructures ~10 fields)
- `useWorkflowStore()` in WorkflowProgress.tsx (destructures ~5 fields)

These re-render on ANY state change in those stores, but both stores are relatively small and change infrequently.

### 4G. MEDIUM — Duplicate State / Zombie Split Stores

The store split (Week 2 Stream B Track 2 Phase 2.2a) created parallel stores but **never migrated consumers away from workspaceStore**:

| Split Store | Consumer Files (outside stores/) | workspaceStore Still Used For Same Data? |
|---|---|---|
| canvasStore | 2 (CollapsibleMinimap, ArtboardOverlay) | YES — 136 files still use workspaceStore |
| nodesStore | 10 | YES — 42 components still read nodes from workspaceStore |
| edgesStore | 3 | YES — 18 components still read edges from workspaceStore |
| selectionStore | 5 | YES — selection state still read from workspaceStore |
| historyStore | 1 | YES — undo/redo still from workspaceStore |
| uiStore | 20 | YES — panels/theme still from workspaceStore |
| featuresStore | 2 | YES — workspace metadata from workspaceStore |
| canvasViewportStore | 4 | YES — viewport/bookmarks from workspaceStore |
| persistenceStore | 3 | YES — save state from workspaceStore |
| extractionStore | 1 | YES — extractions from workspaceStore |
| propertiesStore | 2 | YES — property schema from workspaceStore |
| calmModeStore | 1 | YES — calm mode from workspaceStore |
| commandBarStore | 1 | YES — command bar from workspaceStore |

**Result:** `storeSyncBridge.ts` keeps workspaceStore and nodesStore/edgesStore in sync bidirectionally, doubling every node/edge mutation cost. The split stores are effectively dead weight that add sync overhead without reducing coupling.

**Duplicated hook exports:**
- `useNodes` — exported from both workspaceStore AND nodesStore
- `useIsSpawning` — exported from both workspaceStore AND nodesStore
- `useNodeWarmth` — exported from both workspaceStore AND nodesStore
- `useIsNodeBookmarked` — exported from both workspaceStore AND canvasViewportStore
- `useNumberedBookmarks` — exported from both workspaceStore AND canvasViewportStore

### 4H. LOW — Components Subscribing to 3+ Stores

| File | Store Count | Stores |
|---|---|---|
| App.tsx | 13 | workspaceStore, uiStore, programStore, proposalStore, contextVisualizationStore, spatialRegionStore, contextSelectionStore, graphIntelligenceStore, bridgeStore, templateStore, contextMenuStore, aiEditorStore, shortcutHelpStore |
| ContextMenu.tsx | 7 | workspaceStore, templateStore, aiEditorStore, uiStore, ccBridgeStore, spatialRegionStore, contextMenuStore |
| useCommandRegistry.ts | 5 | workspaceStore, aiEditorStore, programStore, shortcutHelpStore, templateStore |
| OnboardingOverlay.tsx | 5 | analyticsStore, edgesStore, nodesStore, onboardingStore, persistenceStore |

App.tsx subscribing to 13 stores is concerning but tolerable since it's a singleton root component.

### 4I. LOW — Stores with No External Consumers

These stores are only imported by their own test files and/or the index.ts barrel:
- **consoleLogStore** — 2 consumers (App.tsx, ConsolePanel.tsx)
- **fileListingStore** — 2 consumers
- **contextSelectionStore** — 1 consumer (App.tsx)
- **commandBarStore** — 1 consumer (CommandBar.tsx)
- **calmModeStore** — 1 consumer (useCalmMode.ts)
- **sessionLinkStore** — 2 consumers

These are appropriately scoped and not a concern.

---

## 5. High-Frequency Update Patterns

### Viewport Updates
- `workspaceStore.setViewport()` fires on every pan/zoom frame
- `canvasViewportStore.setViewport()` fires independently (not synced)
- Both update the `viewport` property, potentially triggering selectors in all subscribers
- The `zoomPerfTier` property in workspaceStore is updated during zoom, causing additional selector evaluation

### Node Drag
- `startNodeDrag()` / `commitNodeDrag()` bracket drag operations
- During drag, React Flow's `onNodesChange` fires per-frame, calling `applyNodeChanges` which creates new `nodes` array references
- Every frame: 42 `state.nodes` subscribers re-evaluate, storeSyncBridge fires, nodeIndex rebuilds

### Edge Waypoint Drag
- Similar to node drag — `updateEdge()` fires per-frame during waypoint drag
- Creates new `edges` array reference each frame
- 18 `state.edges` subscribers re-evaluate per frame

### Streaming (LLM responses)
- `setStreaming(nodeId, true/false)` mutates `streamingConversations` Set
- `addMessage()` and `updateLastMessage()` fire rapidly during token streaming
- Each message update creates new `nodes` array reference (message stored in node data)

### Canvas Interaction Throttling
- `useUIStore.setCanvasInteracting(true/false)` is called during drag start/end
- Used to throttle shader quality — low frequency, not a concern

---

## 6. Recommendations

### P0 — Critical (estimated 3-5x render reduction)

1. **Complete the store split or abandon it.** The current half-migrated state is the worst of both worlds. Either:
   - **(Recommended) Finish migration:** Move ALL consumers from workspaceStore to split stores (canvasStore, nodesStore, edgesStore, selectionStore, uiStore). Then gut workspaceStore to be a thin persistence layer. Remove storeSyncBridge.
   - **OR Abandon split:** Delete canvasStore, nodesStore, edgesStore, selectionStore, uiStore, canvasViewportStore, persistenceStore, extractionStore, propertiesStore, historyStore, featuresStore, calmModeStore, commandBarStore. Remove storeSyncBridge. Accept workspaceStore as the single source of truth and focus on selector optimization.

2. **Fix CustomEdge `nodes.find()` selectors.** Replace `state.nodes.find(n => n.id === source)` with `state.nodes[state.nodeIndex.get(source)]` for O(1) lookup. Better yet, create a `useNodeData(nodeId)` selector hook that uses the index:
   ```ts
   export const useNodeData = (nodeId: string) =>
     useWorkspaceStore((state) => {
       const idx = state.nodeIndex.get(nodeId)
       return idx !== undefined ? state.nodes[idx]?.data : undefined
     })
   ```

3. **Replace full `nodes[]` subscriptions with derived selectors.** Components that only need node count, node IDs, or filtered subsets should NOT subscribe to the full array. Examples:
   - `CognitiveLoadMeter` only needs `nodes.length` and `edges.length`
   - `FilterViewDropdown` only needs node type counts
   - `CommandPalette` only needs node IDs and titles for search

### P1 — High (estimated 1.5-2x render reduction)

4. **Split `themeSettings` subscriptions.** Replace `useWorkspaceStore(s => s.themeSettings)` with specific sub-property selectors:
   ```ts
   const themeMode = useWorkspaceStore(s => s.themeSettings.mode)
   const edgeStyle = useWorkspaceStore(s => s.themeSettings.edgeStyle)
   ```
   This prevents re-renders when unrelated theme properties change. 24 components would benefit.

5. **Reduce per-node selector count.** ConversationNode has 17 selectors. Group related selectors:
   ```ts
   // Instead of 5 separate calls:
   const { updateNode, startNodeResize, commitNodeResize, updateNodeDimensions, themeSettings } =
     useWorkspaceStore(useShallow(s => ({
       updateNode: s.updateNode,
       startNodeResize: s.startNodeResize,
       commitNodeResize: s.commitNodeResize,
       updateNodeDimensions: s.updateNodeDimensions,
       themeSettings: s.themeSettings
     })))
   ```
   Note: `useShallow` from `zustand/react/shallow` is needed for object selectors to avoid infinite re-renders.

6. **Remove duplicate hook exports.** `useNodes`, `useIsSpawning`, `useNodeWarmth` are exported from BOTH workspaceStore and nodesStore. Pick one source of truth and remove the other to prevent confusion and double subscriptions.

### P2 — Medium (architectural cleanup)

7. **Create a `useNodeLookup` hook.** Many components do `nodes.find(n => n.id === someId)`. A memoized lookup using nodeIndex would eliminate O(n) scans:
   ```ts
   export const useNodeById = (nodeId: string) =>
     useWorkspaceStore((state) => {
       const idx = state.nodeIndex.get(nodeId)
       return idx !== undefined ? state.nodes[idx] : undefined
     })
   ```

8. **Move service-layer code to `getState()`.** 12 service files import workspaceStore. Most use `getState()` which is correct (non-reactive), but verify no services accidentally use hook-style subscriptions in non-React contexts.

9. **Consider `temporal` middleware for history.** The undo/redo system (history array + historyIndex) currently lives inside workspaceStore, adding to its surface area. Zustand's `temporal` middleware or a dedicated history store could encapsulate this.

10. **Audit storeSyncBridge double-rebuild.** When nodesStore syncs back to workspaceStore, both the bridge AND the self-subscribe on workspaceStore rebuild nodeIndex. The bridge already builds it — the self-subscribe detects no change and skips, but the comparison cost (mapsEqual) runs unnecessarily.

### P3 — Low (nice-to-have)

11. **Batch `getState()` calls.** ContextMenu.tsx calls `useWorkspaceStore.getState()` ~30 times in JSX callbacks. Each call is cheap but could be batched into a single destructure at the top of the callback.

12. **Lazy-load low-usage stores.** consoleLogStore, fileListingStore, calmModeStore, contextSelectionStore each have 1-2 consumers. These could be dynamically imported to reduce initial bundle.

---

## 7. Summary

| Metric | Value |
|---|---|
| Total store files | 42 |
| God store (workspaceStore) LOC | 6,271 |
| Files importing workspaceStore | 136 |
| getState() calls on workspaceStore | 182 |
| Components subscribing to `state.nodes` | 42 |
| Components subscribing to `state.edges` | 18 |
| Components subscribing to full `themeSettings` | 24 |
| Unselected `useStore()` calls | 3 |
| Duplicate hook exports (workspace vs split) | 5 |
| Split stores with <5 external consumers | 10 of 13 |
| Per-node selectors (ConversationNode) | 17 |
| Per-edge selectors (CustomEdge) | 15 |
| CustomEdge `nodes.find()` selectors | 7 |
| storeSyncBridge subscriptions | 4 (bidirectional) |

**Biggest win:** Completing the store split (P0.1) eliminates the storeSyncBridge overhead and reduces workspaceStore subscriber count from 136 to ~20. Combined with CustomEdge index lookups (P0.2) and derived selectors for nodes/edges (P0.3), this should reduce unnecessary re-renders by 3-5x on a typical 60-node workspace.
