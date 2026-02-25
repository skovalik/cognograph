# ARCHITECTURE.md - System Design Document

> **Expert-level system architecture documentation.** This document describes the complete system design, data flow, and component relationships.

---

## System Overview

```
+-----------------------------------------------------------------------------+
|                          COGNOGRAPH ARCHITECTURE                            |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +--------------------------------------------------------------------+    |
|  |                        USER INTERFACE (Renderer)                    |    |
|  |                                                                     |    |
|  |  +-----------+  +---------------+  +-----------+  +-------------+  |    |
|  |  |  Toolbar  |  |    Canvas     |  |  Panels   |  |  Overlays   |  |    |
|  |  |           |  |               |  |           |  |             |  |    |
|  |  | Add Nodes |  | React Flow    |  | Properties|  | AI Editor   |  |    |
|  |  | Undo/Redo |  | 10 Node Types |  | Chat      |  | Command Bar |  |    |
|  |  | Save/Load |  | Custom Edges  |  | Layers    |  | Bridge HUD  |  |    |
|  |  | Templates |  | Ghost Nodes   |  | Activity  |  | Proposals   |  |    |
|  |  | Alignment |  | Minimap       |  | Dispatch  |  | Onboarding  |  |    |
|  |  +-----------+  +---------------+  +-----------+  +-------------+  |    |
|  |                            |                                        |    |
|  |                            v                                        |    |
|  |  +------------------------------------------------------------------+  |
|  |  |              ZUSTAND STORES (37 stores)                           |  |
|  |  |                                                                    |  |
|  |  | Core:   workspaceStore | canvasStore | nodesStore | edgesStore    |  |
|  |  | UI:     uiStore | selectionStore | contextMenuStore              |  |
|  |  | Data:   featuresStore | historyStore | propertiesStore            |  |
|  |  | AI:     aiEditorStore | orchestratorStore | actionStore           |  |
|  |  | Bridge: bridgeStore | ccBridgeStore | commandBarStore            |  |
|  |  | Infra:  persistenceStore | programStore | connectorStore | ...   |  |
|  |  +------------------------------------------------------------------+  |
|  |                            |                                        |    |
|  +----------------------------+----------------------------------------+    |
|                               |                                             |
|                   PRELOAD BRIDGE (window.api)                               |
|                   18 API groups, ~93 IPC channels                           |
|                               |                                             |
|  +----------------------------+----------------------------------------+    |
|  |                     MAIN PROCESS                                     |    |
|  |                            |                                         |    |
|  |  +-------------------------+-----------------------------------+    |    |
|  |  |                  IPC HANDLERS (16 files)                     |    |    |
|  |  +--------------------------+----------------------------------+    |    |
|  |                             |                                       |    |
|  |  +-----------+ +------------+------+ +-------------+ +-----------+ |    |
|  |  | Workspace | |   LLM Service     | |  Settings   | | AI Editor | |    |
|  |  | Manager   | |                   | |   Store     | |           | |    |
|  |  |           | | +---------------+ | |             | | Plan Gen  | |    |
|  |  | Save/Load | | | Anthropic     | | | API Keys    | | Streaming | |    |
|  |  | Watch     | | | Google        | | | Preferences | | Refine    | |    |
|  |  | Validate  | | | OpenAI/Compat | | | Credentials | |           | |    |
|  |  +-----------+ | +---------------+ | +-------------+ +-----------+ |    |
|  |       |        +-------------------+        |                       |    |
|  |       |                                     |                       |    |
|  |  +-----------+ +------------------+ +--------------+ +----------+  |    |
|  |  | Services  | | Agent System     | | MCP System   | | Backup   |  |    |
|  |  |           | |                  | |              | | Manager  |  |    |
|  |  | Streaming | | Claude Agent     | | Server       | |          |  |    |
|  |  | Activity  | | Filesystem Tools | | Client       | | Restore  |  |    |
|  |  | CC Bridge | | Orchestrator     | | Tools/Hdlrs  | | List     |  |    |
|  |  | Graph AI  | | Credential Store | | Validation   | |          |  |    |
|  |  +-----------+ +------------------+ +--------------+ +----------+  |    |
|  |       |                                     |                       |    |
|  |       v                                     v                       |    |
|  |  +------------+                     +----------------+              |    |
|  |  | File System|                     | electron-store |              |    |
|  |  |   (JSON)   |                     |  (encrypted)   |              |    |
|  |  +------------+                     +----------------+              |    |
|  +---------------------------------------------------------------------+    |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Data Flow Diagrams

### 1. Node Creation Flow

```
User clicks "Add Conversation" (or any of 10 node types)
         |
         v
    Toolbar.tsx / ContextMenu / CommandPalette / CommandBar
         | calls
         v
    canvasStore.addNode(type, position)
         |
         v
    nodesStore + canvasStore
         | 1. Generate UUID
         | 2. Create node data via nodeFactories.ts
         | 3. Add to nodes array
         | 4. Push to historyStore
         | 5. Set persistenceStore.isDirty = true
         |
         v
    React Flow re-renders
         |
         v
    Node appears on canvas (with spawn animation)
         |
         v
    Auto-save triggers (debounced)
         |
         v
    window.api.workspace.save()
         |
         v
    IPC --> Main Process
         |
         v
    workspace.ts writes JSON file
```

### 2. Chat Message Flow

```
User types message, presses Enter
         |
         v
    ChatPanel.tsx
         | 1. Validate input
         | 2. Check API key exists (via connectorStore)
         |
         v
    getContextForNode(nodeId)
         | 1. BFS traversal on INBOUND edges (+ bidirectional)
         | 2. Extract content from connected nodes
         | 3. Respect contextSettings depth/token limits
         |
         v
    Build messages array with context
         |
         v
    canvasStore.addMessage(nodeId, 'user', content)
         | Updates store immediately
         |
         v
    window.api.llm.send(provider, messages, options)
         |
         v
    IPC --> Main Process (llm.ts)
         | 1. Get API key from settings
         | 2. Initialize provider client (Anthropic/Google/OpenAI)
         | 3. Start streaming request
         |
         v
    Stream events sent back via IPC
         |
         +--- 'llm:chunk' --- ChatPanel updates streamingContent
         |
         +--- 'llm:complete' - ChatPanel calls addMessage('assistant', content)
         |                      sessionStatsStore.recordUsage()
         |
         +--- 'llm:error' --- ChatPanel shows error message
```

### 3. AI Editor / Workspace Mutation Flow

```
User invokes AI Editor (Cmd+K or toolbar)
         |
         v
    AIEditorModal / InlinePrompt
         | 1. User enters natural language prompt
         | 2. Scope: selection | view | canvas
         |
         v
    aiEditorStore.generatePlan()
         |
         v
    window.api.aiEditor.generatePlanStreaming(context)
         |
         v
    IPC --> Main Process (aiEditor.ts)
         | 1. Build context from nodes/edges
         | 2. Stream to LLM with tool definitions
         | 3. Parse mutation plan
         |
         v
    Stream events via IPC:
         | aiEditor:plan:chunk --> aiEditorStore updates
         | aiEditor:plan:phase --> Phase indicator
         | aiEditor:plan:complete --> Plan ready
         |
         v
    User reviews plan in AIEditorPreview
         | Accept / Reject / Refine
         |
         v
    workspaceStore.applyMutationPlan()
         | Batch node/edge create/update/delete
         | Single history entry for undo
```

---

## State Management Architecture

### Store Organization

Cognograph uses a **multi-store architecture** with 33 Zustand stores, organized by domain. The original monolithic `workspaceStore` (5,100+ lines) is the legacy central store; state is progressively being decomposed into focused domain stores.

All stores follow these conventions:
- Created with `zustand/create`
- Most use `immer` middleware for immutable updates
- Persistent stores use `zustand/middleware/persist`
- Each exports a `use[Name]Store` hook plus granular selector hooks
- Central barrel export from `src/renderer/src/stores/index.ts`

### Store Responsibilities

#### Core Data Stores

| Store | File | Responsibility |
|-------|------|----------------|
| `workspaceStore` | `workspaceStore.ts` | **Legacy monolith** (~5,100 lines). Node CRUD, edge CRUD, message management, context building, workspace load/save orchestration, history, clipboard, and most business logic. Being decomposed. |
| `canvasStore` | `canvasStore.ts` | Canvas-level state: nodes/edges arrays, viewport, clipboard, streaming indicators, spawn animations, drag/resize tracking. |
| `nodesStore` | `nodesStore.ts` | Focused node operations: add/update/remove nodes, node warmth (recency), spawn tracking, batch updates. |
| `edgesStore` | `edgesStore.ts` | Focused edge operations: add/update/remove edges, edge lookup by source/target. |

#### Selection and History

| Store | File | Responsibility |
|-------|------|----------------|
| `selectionStore` | `selectionStore.ts` | Node/edge selection state, box-select rectangle, multi-select, last-created node tracking. |
| `historyStore` | `historyStore.ts` | Undo/redo stack management. Records actions, manages history index, supports grouped undo. |

#### UI Chrome Stores

| Store | File | Responsibility |
|-------|------|----------------|
| `uiStore` | `uiStore.ts` | Panel visibility (properties/chat), sidebar state (tab, width, sort), theme settings, workspace preferences, pinned windows, focus mode, bookmarks, floating modals. |
| `contextMenuStore` | `contextMenuStore.ts` | Right-click context menu state: open/close, position, target type (canvas/node/edge/waypoint/project-body). |
| `commandBarStore` | `commandBarStore.ts` | Natural language command bar: visibility, input, history, suggestions, optimistic intent preview via regex classification. |

#### Persistence and Workspace Identity

| Store | File | Responsibility |
|-------|------|----------------|
| `persistenceStore` | `persistenceStore.ts` | Workspace identity (id, name, path), save status (saved/saving/unsaved/error), auto-save configuration, dirty flag. |
| `featuresStore` | `featuresStore.ts` | Workspace-level features: property schema, context settings, extraction state, multiplayer config, sync mode, trash. |
| `canvasViewportStore` | `canvasViewportStore.ts` | Viewport pan/zoom, focus mode node, bookmarks (quick + numbered 0-9), saved views, last canvas click position. |

#### AI and Agent Stores

| Store | File | Responsibility |
|-------|------|----------------|
| `aiEditorStore` | `aiEditorStore.ts` | AI Workspace Editor state: mode (generate/edit/organize/automate/ask), prompt, scope, generation status, streaming state, mutation plan preview, execution tracking. |
| `orchestratorStore` | `orchestratorStore.ts` | Multi-agent orchestration UI: status updates per orchestrator run, agent progress, IPC listener initialization. |
| `actionStore` | `actionStore.ts` | Action node automation: registered triggers, execution stack (circular prevention), event handling, debounce tracking, spatial proximity state. |
| `permissionStore` | `permissionStore.ts` | AI Editor permission system: granted/pending permissions by type (filesystem, execute, network), workspace sandbox paths. |
| `workflowStore` | `workflowStore.ts` | Multi-step workflow execution: step tracking, approval gates, trust levels (auto/prompt_once/always_approve), progress/failure states. |

#### Bridge and Intelligence Stores

| Store | File | Responsibility |
|-------|------|----------------|
| `bridgeStore` | `bridgeStore.ts` | Spatial Command Bridge overlay: real-time agent activity badges on nodes, orchestrator activity state, bridge settings, RAF-batched updates. |
| `ccBridgeStore` | `ccBridgeStore.ts` | Claude Code Bridge: activity events (FIFO ring buffer), session tracking, file touch conflicts, dispatch queue, IPC listener initialization. |
| `proposalStore` | `proposalStore.ts` | Ghost node proposal system: proposal lifecycle (propose -> preview -> approve/reject), ghost React Flow elements, proposal expiry timeout. |
| `auditStore` | `auditStore.ts` | Canvas action audit trail: in-memory ring buffer + IndexedDB (Dexie) for long-term storage, filtering, search, export, undo support, RAF-batched event emission. |
| `graphIntelligenceStore` | `graphIntelligenceStore.ts` | Ambient graph insights: insight deduplication, per-node insight index, cost snapshots, daily budget tracking, progressive analysis mode. |

#### Infrastructure Stores

| Store | File | Responsibility |
|-------|------|----------------|
| `connectorStore` | `connectorStore.ts` | LLM and MCP connector management: add/remove/test connectors, default LLM selection, connection status tracking. Persisted to localStorage. |
| `propertiesStore` | `propertiesStore.ts` | Notion-style property system: property schema (built-in + custom definitions), property CRUD per node type. |
| `extractionStore` | `extractionStore.ts` | AI extraction state: pending extractions per node, extraction panel visibility, drag-to-accept, sort/filter. |
| `templateStore` | `templateStore.ts` | Template library: save/load templates, folder organization, template picker modal state, paste preview. |
| `savedViewsStore` | `savedViewsStore.ts` | Named viewport/filter presets: save current view, recall saved views for consistent context switching. |
| `sessionStatsStore` | `sessionStatsStore.ts` | Per-session LLM usage: token counts, cost aggregation by provider/model, request counts. |
| `analyticsStore` | `analyticsStore.ts` | Onboarding analytics: time-to-first-node, time-to-first-connection, activation score, template usage tracking. Persisted. |
| `spatialRegionStore` | `spatialRegionStore.ts` | Named canvas regions for action triggers: region CRUD, node-in-region membership tracking, enter/exit detection. |
| `programStore` | `programStore.ts` | Program-level settings (cross-workspace): accessibility preferences, auto-save settings, reduce-motion, high-contrast mode. Persisted to localStorage. |
| `entitlementsStore` | `entitlementsStore.ts` | Feature gate management: plan tier (free/pro/power/team), entitlement checks, periodic sync. Persisted. |
| `offlineStore` | `offlineStore.ts` | Offline mode: network connectivity tracking, operation queue for offline changes, auto-sync on reconnect. Persisted. |

### State Update Patterns

**Pattern 1: Immer for Immutable Updates**
```typescript
// CORRECT: Using Immer
set((state) => {
  state.nodes.push(newNode);
  state.isDirty = true;
});

// WRONG: Direct mutation outside Immer
const nodes = get().nodes;
nodes.push(newNode); // This won't trigger re-render!
```

**Pattern 2: Selector Hooks for Performance**
```typescript
// CORRECT: Specific selector (exported from store file)
const nodes = useNodes(); // from nodesStore
const isDirty = useIsDirty(); // from persistenceStore

// CORRECT: Inline selector
const nodes = useCanvasStore(state => state.nodes);

// WRONG: Selecting entire state
const state = useCanvasStore(); // Re-renders on ANY state change
```

**Pattern 3: Cross-Store Communication**
```typescript
// Stores can read other stores via getState()
const nodes = useCanvasStore.getState().nodes;

// IPC listeners initialize in App.tsx and dispatch to stores
initCCBridgeListener();   // ccBridgeStore
initOrchestratorIPC();    // orchestratorStore
initBridgeIPC();          // bridgeStore
```

---

## Component Hierarchy

```
App.tsx
+-- ErrorBoundary
+-- SyncProviderWrapper
+-- ReactFlowProvider
|   +-- TooltipProvider
|       +-- ReactFlow (canvas)
|       |   +-- Background
|       |   +-- Controls
|       |   +-- Nodes (10 types + ghost)
|       |   |   +-- ConversationNode  (AI chat with context injection)
|       |   |   +-- ProjectNode       (grouping container with child nodes)
|       |   |   +-- NoteNode          (rich text, page mode, component mode)
|       |   |   +-- TaskNode          (status tracking, assignees)
|       |   |   +-- ArtifactNode      (file preview, download)
|       |   |   +-- WorkspaceNode     (sub-workspace reference)
|       |   |   +-- TextNode          (plain text annotation)
|       |   |   +-- ActionNode        (event-driven automation)
|       |   |   +-- OrchestratorNode  (multi-agent workflow runner)
|       |   |   +-- GhostNode         (proposal preview, translucent)
|       |   |
|       |   +-- Edges
|       |   |   +-- CustomEdge (with waypoints, connection properties)
|       |   |   +-- GhostEdge (proposal preview)
|       |   |
|       |   +-- CollapsibleMinimap
|       |
|       +-- Toolbar
|       |   +-- FileButtons (New, Open, Save, Export)
|       |   +-- NodeButtons (all 9 user-creatable types)
|       |   +-- HistoryButtons (Undo, Redo)
|       |   +-- AlignmentToolbar
|       |   +-- FilterViewDropdown
|       |   +-- TemplatePicker
|       |
|       +-- LeftSidebar (tabbed: layers | extractions | activity | dispatch | bridge-log)
|       |   +-- LayersPanel
|       |   +-- ExtractionsPanel
|       |   +-- ActivityFeedPanel
|       |   +-- DispatchPanel
|       |   +-- BridgeLogPanel
|       |
|       +-- PropertiesPanel (right side, conditional)
|       +-- ConnectionPropertiesPanel (edge properties)
|       +-- ChatPanel (conversation interface)
|       +-- FloatingPropertiesModal (detached property editor)
|       +-- PinnedWindowsContainer (floating node windows)
|       +-- ContextMenu (right-click actions)
|       +-- CommandPalette (Cmd+P fuzzy search)
|       +-- CommandBar (natural language commands)
|       +-- ProposalCard (ghost node approval UI)
|       +-- BridgeStatusBar (agent activity indicator)
|       |
|       +-- AI Editor
|       |   +-- AIEditorModal
|       |   +-- AIEditorPreview
|       |   +-- InlinePrompt
|       |   +-- SelectionActionBar
|       |   +-- AISidebar
|       |   +-- WorkflowProgress
|       |
|       +-- Indicators
|       |   +-- TokenIndicator
|       |   +-- ZoomIndicator
|       |   +-- ClipboardIndicator
|       |   +-- FocusModeIndicator
|       |   +-- ProgressIndicator
|       |   +-- OfflineIndicator
|       |   +-- WorkspaceInfo
|       |
|       +-- Panels (toggled)
|       |   +-- UndoHistoryPanel
|       |   +-- TrashPanel
|       |   +-- ArchivePanel
|       |   +-- SavedViewsPanel
|       |   +-- TimelineView
|       |
|       +-- Modals (conditional)
|       |   +-- SettingsModal
|       |   +-- ThemeSettingsModal
|       |   +-- ExportDialog
|       |   +-- SaveTemplateModal
|       |   +-- PasteTemplateModal
|       |   +-- TemplateBrowser
|       |   +-- KeyboardShortcutsHelp
|       |
|       +-- Onboarding
|       |   +-- SplashScreen
|       |   +-- WelcomeOverlay
|       |   +-- OnboardingTooltip
|       |   +-- TutorialOverlay
|       |   +-- EmptyCanvasHint
|       |
|       +-- Visual Effects
|           +-- AmbientEffectLayer (20 GPU effects)
|           +-- ClickSpark
|           +-- AnimatePresence (Framer Motion)
```

### Node Type Sub-Components

Each node type can contain mode-specific sub-components:

```
NoteNode
+-- NodeModeDropdown (mode selector)
+-- PageNoteBody (page/document mode)
+-- ComponentNoteBody (React component definition mode)
+-- DesignTokenEditor (design token editing mode)
+-- ContentModelBody (WordPress content model mode)
+-- WPConfigBody (WordPress config mode)
+-- PreviewToolbar (live preview controls)
+-- AttachmentBadge
+-- FoldBadge
+-- SocketBar (connection handles)
+-- AutoFitButton
+-- AgentActivityBadge (bridge overlay)
```

---

## IPC Communication Protocol

### Architecture

All IPC communication flows through the preload bridge (`src/preload/index.ts`). The renderer accesses main process functionality exclusively via `window.api`, which exposes 18 API groups covering 93 `ipcMain.handle` channels plus ~12 event-based channels (Main-to-Renderer).

IPC handlers are distributed across 16 source files in the main process:

| Source File | Handler Count | Domain |
|-------------|--------------|--------|
| `workspace.ts` | 12 | Workspace CRUD, file dialogs, artifact download, file watching |
| `multiplayer.ts` | 14 | Sharing, invites, tokens, branches, merge |
| `index.ts` | 12 | CC Bridge, credentials (registered at app startup) |
| `llm.ts` | 3 | LLM streaming, extraction, cancel |
| `aiEditor.ts` | 5 | Plan generation, streaming, refinement, cancel |
| `settings.ts` | 4 | Get/set settings, API key storage |
| `backupManager.ts` | 4 | Backup list, restore, create, open folder |
| `attachments.ts` | 4 | File attachment add, delete, open, read |
| `templates.ts` | 3 | Template library load, save, get path |
| `orchestratorHandlers.ts` | 5 | Orchestrator start, pause, resume, abort, resync |
| `agent/claudeAgent.ts` | 2 | Agent send-with-tools, cancel |
| `agent/filesystemTools.ts` | 6 | Sandboxed file read/write/edit/list/search/execute |
| `mcp/mcpClient.ts` | 6 | MCP connect, disconnect, discover, call, list, get-tools |
| `connectors.ts` | 2 | Connector test, MCP test |
| `services/graphIntelligence.ts` | 8 | Graph analysis, budget, insights |
| `services/auditService.ts` | 2 | Audit undo, export |

### IPC Channel Reference

#### Workspace Management

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `workspace:save` | Renderer --> Main | Save workspace data to JSON file |
| `workspace:load` | Renderer --> Main | Load workspace by UUID |
| `workspace:list` | Renderer --> Main | List available workspaces with metadata |
| `workspace:delete` | Renderer --> Main | Delete workspace file |
| `workspace:getLastId` | Renderer --> Main | Get last opened workspace ID |
| `workspace:saveAs` | Renderer --> Main | Save workspace to custom file path |
| `workspace:loadFromPath` | Renderer --> Main | Load workspace from arbitrary file path |
| `workspace:watch` | Renderer --> Main | Start watching workspace file for external changes |
| `workspace:unwatch` | Renderer --> Main | Stop watching workspace file |
| `workspace:external-change` | Main --> Renderer | Notify of external file modification |
| `dialog:showSaveDialog` | Renderer --> Main | Show native save dialog |
| `dialog:showOpenDialog` | Renderer --> Main | Show native open dialog |
| `artifact:download` | Renderer --> Main | Download artifact to filesystem |

#### LLM Streaming

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `llm:send` | Renderer --> Main | Start LLM streaming request |
| `llm:extract` | Renderer --> Main | One-shot LLM extraction (no streaming) |
| `llm:cancel` | Renderer --> Main | Cancel ongoing stream by conversation ID |
| `llm:chunk` | Main --> Renderer | Stream text chunk received |
| `llm:complete` | Main --> Renderer | Stream completed (includes usage stats) |
| `llm:error` | Main --> Renderer | Stream error occurred |

#### AI Editor

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `ai:generatePlan` | Renderer --> Main | Generate mutation plan (non-streaming) |
| `ai:generatePlanWithAgent` | Renderer --> Main | Generate plan using agent with tools |
| `ai:generatePlanStreaming` | Renderer --> Main | Generate plan with streaming events |
| `ai:cancelGeneration` | Renderer --> Main | Cancel ongoing plan generation |
| `ai:refinePlan` | Renderer --> Main | Refine existing plan with conversation |
| `aiEditor:plan:chunk` | Main --> Renderer | Streaming plan text/tool chunk |
| `aiEditor:plan:phase` | Main --> Renderer | Generation phase update |
| `aiEditor:plan:complete` | Main --> Renderer | Plan generation complete |
| `aiEditor:plan:error` | Main --> Renderer | Plan generation error |

#### Agent System

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `agent:sendWithTools` | Renderer --> Main | Send agent request with tool definitions |
| `agent:cancel` | Renderer --> Main | Cancel agent request by ID |
| `agent:stream` | Main --> Renderer | Agent streaming chunk (text/tool_use/done/error) |

#### Filesystem (Sandboxed)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `fs:readFile` | Renderer --> Main | Read file (path-validated) |
| `fs:writeFile` | Renderer --> Main | Write file (path-validated) |
| `fs:editFile` | Renderer --> Main | Edit file with old/new string replacement |
| `fs:listDirectory` | Renderer --> Main | List directory contents |
| `fs:searchFiles` | Renderer --> Main | Search files with pattern + glob |
| `fs:executeCommand` | Renderer --> Main | Execute command (allowlisted) |

#### Settings and Credentials

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `settings:get` | Renderer --> Main | Read setting by key |
| `settings:set` | Renderer --> Main | Write setting by key |
| `settings:getApiKey` | Renderer --> Main | Retrieve decrypted API key |
| `settings:setApiKey` | Renderer --> Main | Store encrypted API key |
| `credentials:set` | Renderer --> Main | Store workspace-scoped credential (safeStorage) |
| `credentials:getMasked` | Renderer --> Main | Get masked credential value |
| `credentials:getReal` | Renderer --> Main | Get real credential value |
| `credentials:delete` | Renderer --> Main | Delete credential |
| `credentials:list` | Renderer --> Main | List credentials for workspace |

#### Orchestrator

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `orchestrator:start` | Renderer --> Main | Start orchestrator execution |
| `orchestrator:pause` | Renderer --> Main | Pause running orchestrator |
| `orchestrator:resume` | Renderer --> Main | Resume paused orchestrator |
| `orchestrator:abort` | Renderer --> Main | Abort orchestrator execution |
| `orchestrator:resync` | Renderer --> Main | Resync all orchestrator states |
| `orchestrator:status` | Main --> Renderer | Real-time status update |

#### Claude Code Bridge

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `cc-bridge:getHistory` | Renderer --> Main | Get recent activity events |
| `cc-bridge:dispatchTask` | Renderer --> Main | Queue task for Claude Code |
| `cc-bridge:getDispatchQueue` | Renderer --> Main | Get all dispatched tasks |
| `cc-bridge:cancelDispatch` | Renderer --> Main | Cancel pending dispatch |
| `cc-bridge:getDispatchPort` | Renderer --> Main | Get dispatch server port |
| `cc-bridge:startDispatchServer` | Renderer --> Main | Start dispatch HTTP server |
| `cc-bridge:stopDispatchServer` | Renderer --> Main | Stop dispatch server |
| `cc-bridge:activity` | Main --> Renderer | Real-time CC activity event |
| `cc-bridge:dispatch-updated` | Main --> Renderer | Dispatch status changed |
| `cc-bridge:dispatch-completed` | Main --> Renderer | Dispatch completed with file list |

#### Spatial Command Bridge (Graph Intelligence)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `bridge:audit-undo` | Renderer --> Main | Undo an audit event |
| `bridge:audit-export` | Renderer --> Main | Export audit log to CSV/JSON file |
| `bridge:analyze-graph` | Renderer --> Main | Run graph intelligence analysis |
| `bridge:get-budget` | Renderer --> Main | Get daily AI budget status |
| `bridge:set-budget-limit` | Renderer --> Main | Set daily budget limit |
| `bridge:reset-budget` | Renderer --> Main | Reset daily budget counter |
| `bridge:start-analysis` | Renderer --> Main | Start periodic graph analysis |
| `bridge:stop-analysis` | Renderer --> Main | Stop periodic analysis |
| `bridge:mark-nodes-changed` | Renderer --> Main | Flag nodes for re-analysis |
| `bridge:insight-action` | Renderer --> Main | Apply or dismiss an insight |
| `bridge:insights` | Main --> Renderer | New insights from analysis |

#### MCP Client

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `mcp:connect` | Renderer --> Main | Connect to external MCP server |
| `mcp:disconnect` | Renderer --> Main | Disconnect from MCP server |
| `mcp:discoverTools` | Renderer --> Main | List tools from MCP server |
| `mcp:callTool` | Renderer --> Main | Call tool on MCP server |
| `mcp:listConnections` | Renderer --> Main | List active MCP connections |
| `mcp:getToolsForServers` | Renderer --> Main | Get tools for multiple servers |

#### Other Services

| Channel Group | Channels | Purpose |
|--------------|----------|---------|
| `templates:*` | load, save, getPath | Template library persistence |
| `backup:*` | list, restore, create, openFolder | Workspace backup management |
| `attachments:*` | add, delete, open, readText | File attachment management |
| `connector:*` | test, testMCP | LLM/MCP connector validation |
| `multiplayer:*` | 14 channels | Sharing, invites, tokens, branches, merge, server status |

### Error Handling Protocol

All IPC responses follow this structure:
```typescript
interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: IPCError;
  meta?: IPCMeta;
}

interface IPCError {
  code: string;
  message: string;
  details?: string;
}
```

Error handling in renderer:
```typescript
const result = await window.api.workspace.save(data);
if (!result.success) {
  showToast({ type: 'error', message: result.error?.message });
  return;
}
// Success path...
```

---

## Main Process Architecture

### Source Files

```
src/main/
+-- index.ts                    Entry point, window creation, CC Bridge + Credential IPC
+-- workspace.ts                Workspace CRUD, file watching, dialog handlers
+-- llm.ts                      LLM streaming (Anthropic, Google, OpenAI-compatible)
+-- aiEditor.ts                 AI workspace editor: plan generation, streaming, refinement
+-- settings.ts                 Settings and API key management (electron-store + safeStorage)
+-- templates.ts                Template library persistence
+-- backupManager.ts            Workspace backup/restore
+-- attachments.ts              File attachment management
+-- connectors.ts               Connector testing (LLM + MCP)
+-- multiplayer.ts              Multiplayer sharing, invites, branching
+-- orchestratorHandlers.ts     Orchestrator IPC handlers
+-- workspaceValidation.ts      Workspace data validation/migration
+-- diagnosticServer.ts         Local diagnostic HTTP server
+-- sentry.ts                   Error reporting configuration
+--
+-- agent/
|   +-- claudeAgent.ts          Claude agent with tool use
|   +-- filesystemTools.ts      Sandboxed filesystem operations (path-validated)
+--
+-- services/
|   +-- streaming.ts            Generic streaming service (chunk/phase/complete/error)
|   +-- activityWatcher.ts      Watches Claude Code CLI activity via file system
|   +-- ccBridgeService.ts      CC Bridge: dispatch server, session management
|   +-- orchestratorService.ts  Multi-agent orchestration execution engine
|   +-- credentialStore.ts      Secure credential storage (Electron safeStorage)
|   +-- graphIntelligence.ts    Ambient graph analysis, budgets, insights
|   +-- auditService.ts         Audit event undo and export
|   +-- bridgeCommandParser.ts  Natural language command parsing
+--
+-- mcp/
    +-- server.ts               MCP server (Cognograph as MCP provider)
    +-- mcpClient.ts            MCP client (Cognograph consuming external servers)
    +-- tools.ts                MCP tool definitions (15 tools)
    +-- handlers.ts             MCP tool handlers
    +-- validation.ts           MCP input validation
    +-- resources.ts            MCP resource definitions
    +-- provider.ts             MCP provider abstraction
    +-- cli.ts                  MCP CLI entry point
    +-- formatters/
        +-- tokenFormatter.ts   Design token formatting for MCP
```

---

## File System Structure

### User Data Directory

```
%APPDATA%/cognograph/
+-- workspaces/
|   +-- {uuid}.json            Workspace files
|   +-- ...
+-- templates/
|   +-- library.json           Template library
+-- backups/
|   +-- {workspace-name}_{timestamp}.json
+-- config.json                electron-store data (settings, encrypted keys)
+-- logs/                      Error logs (when Sentry is not configured)
```

### Workspace File Format

```json
{
  "id": "uuid-v4",
  "name": "My Workspace",
  "version": 1,
  "createdAt": 1705123456789,
  "updatedAt": 1705123456789,
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  },
  "nodes": [
    {
      "id": "node-uuid",
      "type": "conversation",
      "position": { "x": 100, "y": 200 },
      "width": 300,
      "height": 140,
      "data": {
        "type": "conversation",
        "title": "Chat Title",
        "messages": [],
        "provider": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "agentPreset": null,
        "createdAt": 1705123456789,
        "updatedAt": 1705123456789
      }
    }
  ],
  "edges": [
    {
      "id": "source-target",
      "source": "node-1",
      "target": "node-2",
      "sourceHandle": "bottom",
      "targetHandle": "top",
      "data": {
        "contextEnabled": true,
        "contextDepth": 1,
        "bidirectional": false,
        "label": ""
      }
    }
  ],
  "propertySchema": { ... },
  "contextSettings": { ... }
}
```

### Node Types Reference

| Type | Component | Purpose | Modes |
|------|-----------|---------|-------|
| `conversation` | `ConversationNode` | AI chat with context injection from connected nodes | default, agent |
| `project` | `ProjectNode` | Grouping container; child nodes live inside its bounds | default |
| `note` | `NoteNode` | Rich text notes | default, page, component, design-token, content-model, wp-config |
| `task` | `TaskNode` | Task tracking with status, priority, assignees | default |
| `artifact` | `ArtifactNode` | File content from LLM output or file drop | default |
| `workspace` | `WorkspaceNode` | Reference to another workspace | default |
| `text` | `TextNode` | Plain text canvas annotation | default |
| `action` | `ActionNode` | Event-driven automation trigger | default |
| `orchestrator` | `OrchestratorNode` | Multi-agent workflow (sequential/parallel/conditional) | sequential, parallel, conditional |
| `ghost` | `GhostNode` | Translucent proposal preview (not user-creatable) | N/A |

---

## Architectural Rules (Automated Enforcement)

Cognograph uses **dependency-cruiser** to automatically enforce architectural boundaries. Run `npm run validate:arch` to check for violations.

### Process Boundaries (Errors)

| Rule | Description |
|------|-------------|
| `main-renderer-boundary` | Main process cannot import from renderer |
| `renderer-main-boundary` | Renderer cannot import from main (use `window.api`) |
| `shared-purity` | Shared code cannot import from main or renderer |
| `preload-isolation` | Preload cannot import from renderer |
| `no-circular` | No circular dependencies (except known exceptions) |

### Code Organization (Warnings)

| Rule | Description |
|------|-------------|
| `no-orphans` | Flag files not imported from anywhere |
| `store-not-in-utils` | Utils should not import stores directly |
| `components-not-import-services` | Components should use hooks, not services directly |

For full documentation, see: `docs/qa/ARCHITECTURAL_RULES.md`

---

## Security Considerations

### API Key Storage

1. API keys are encrypted using Electron's `safeStorage` API
2. Keys are stored in `electron-store` as base64-encoded encrypted strings
3. Keys are decrypted only when needed for API calls
4. Keys never leave the main process
5. Workspace-scoped credentials use a separate `credentialStore` service with the same safeStorage encryption

### File Access

1. Workspace files are stored in user's app data directory
2. No network access except for LLM API calls, multiplayer sync, and MCP servers
3. Filesystem tools enforce path allowlists (sandbox)
4. Command execution requires explicit allowlisted commands

### IPC Security

1. All IPC uses `contextBridge` -- no direct `ipcRenderer` exposure
2. Input validation on all IPC handlers
3. Error messages sanitized before sending to renderer
4. MCP tool inputs validated via `mcp/validation.ts`

---

## Shared Types

Type definitions live in `src/shared/types/` organized into 10 domain modules with a barrel re-export:

```
src/shared/types/
+-- index.ts          Barrel re-export
+-- base.ts           NodeData, EdgeData, ViewportState, etc.
+-- ai.ts             LLM request/response types
+-- workspace.ts      WorkspaceData, WorkspacePreferences
+-- properties.ts     PropertySchema, PropertyDefinition
+-- templates.ts      NodeTemplate, TemplateLibrary
+-- connectors.ts     LLMConnector, MCPConnector
+-- actions.ts        ActionNodeData, ActionEvent, SpatialRegion
+-- orchestrator.ts   OrchestratorNodeData, AgentConfig
+-- bridge.ts         BridgeCommand, Proposal, GraphInsight, etc.
+-- multiplayer.ts    Multiplayer config types
```

Additional type files:
- `src/shared/bridge-types.ts` -- CC Bridge activity/dispatch types
- `src/shared/actionTypes.ts` -- Action node event/execution types
- `src/shared/ipc-types.ts` -- IPCResponse, IPCError, IPCMeta

---

*Document version: 2.0 | Last updated: 2026-02-13*
