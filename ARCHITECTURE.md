# ARCHITECTURE.md - System Design Document

> **Expert-level system architecture documentation.** This document describes the complete system design, data flow, and component relationships.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COGNOGRAPH ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           USER INTERFACE                              │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │   │   Toolbar   │  │    Canvas    │  │    Panels    │               │   │
│  │   │             │  │              │  │              │               │   │
│  │   │ • Add Nodes │  │ • React Flow │  │ • Properties │               │   │
│  │   │ • Undo/Redo │  │ • Nodes      │  │ • Chat       │               │   │
│  │   │ • Save/Load │  │ • Edges      │  │ • Search     │               │   │
│  │   │ • Search    │  │ • Minimap    │  │              │               │   │
│  │   └─────────────┘  └──────────────┘  └──────────────┘               │   │
│  │                              │                                        │   │
│  │                              ▼                                        │   │
│  │   ┌──────────────────────────────────────────────────────────────┐   │   │
│  │   │                     ZUSTAND STORE                             │   │   │
│  │   │                                                               │   │   │
│  │   │  ┌────────┐  ┌────────┐  ┌─────────┐  ┌────────────────┐    │   │   │
│  │   │  │ Nodes  │  │ Edges  │  │ UI State│  │ History Stack  │    │   │   │
│  │   │  └────────┘  └────────┘  └─────────┘  └────────────────┘    │   │   │
│  │   └──────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                        │   │
│  └──────────────────────────────┼────────────────────────────────────────┘   │
│                                 │                                            │
│                     PRELOAD BRIDGE (window.api)                              │
│                                 │                                            │
│  ┌──────────────────────────────┼────────────────────────────────────────┐   │
│  │                      MAIN PROCESS                                      │   │
│  │                              │                                         │   │
│  │   ┌──────────────────────────┴──────────────────────────────────┐    │   │
│  │   │                     IPC HANDLERS                             │    │   │
│  │   └──────────────────────────┬──────────────────────────────────┘    │   │
│  │                              │                                        │   │
│  │   ┌────────────┐  ┌──────────┴───────┐  ┌────────────────┐          │   │
│  │   │  Workspace │  │    LLM Service   │  │    Settings    │          │   │
│  │   │  Manager   │  │                  │  │     Store      │          │   │
│  │   │            │  │  ┌────────────┐  │  │                │          │   │
│  │   │ • Save     │  │  │  Anthropic │  │  │ • API Keys     │          │   │
│  │   │ • Load     │  │  │   Client   │  │  │ • Preferences  │          │   │
│  │   │ • List     │  │  └────────────┘  │  │ • Recent Files │          │   │
│  │   │ • Delete   │  │  ┌────────────┐  │  │                │          │   │
│  │   │            │  │  │   Gemini   │  │  │                │          │   │
│  │   │            │  │  │   Client   │  │  │                │          │   │
│  │   └────────────┘  │  └────────────┘  │  └────────────────┘          │   │
│  │        │          └──────────────────┘          │                    │   │
│  │        │                                        │                    │   │
│  │        ▼                                        ▼                    │   │
│  │   ┌────────────┐                        ┌────────────────┐          │   │
│  │   │ File System│                        │ electron-store │          │   │
│  │   │   (JSON)   │                        │  (encrypted)   │          │   │
│  │   └────────────┘                        └────────────────┘          │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Node Creation Flow

```
User clicks "Add Conversation"
         │
         ▼
    Toolbar.tsx
         │ calls
         ▼
    addNode('conversation', position)
         │
         ▼
    workspaceStore
         │ 1. Generate UUID
         │ 2. Create default node data
         │ 3. Add to nodes array
         │ 4. Push to history stack
         │ 5. Set isDirty = true
         │
         ▼
    React Flow re-renders
         │
         ▼
    Node appears on canvas
         │
         ▼
    Auto-save triggers (debounced)
         │
         ▼
    window.api.workspace.save()
         │
         ▼
    IPC → Main Process
         │
         ▼
    workspace.ts writes JSON file
```

### 2. Chat Message Flow

```
User types message, presses Enter
         │
         ▼
    ChatPanel.tsx
         │ 1. Validate input
         │ 2. Check API key exists
         │
         ▼
    getContextForNode(nodeId)
         │ 1. Find connected nodes
         │ 2. Extract content from Notes
         │ 3. Extract descriptions from Projects
         │ 4. Extract recent messages from Conversations
         │
         ▼
    Build messages array with context
         │
         ▼
    addMessage(nodeId, 'user', content)
         │ Updates store immediately
         │
         ▼
    window.api.llm.stream(provider, messages, options)
         │
         ▼
    IPC → Main Process (llm.ts)
         │ 1. Get API key from settings
         │ 2. Initialize provider client
         │ 3. Start streaming request
         │
         ▼
    Stream events sent back via IPC
         │
         ├─── 'llm:chunk' ─── ChatPanel updates streamingContent
         │
         ├─── 'llm:done' ──── ChatPanel calls addMessage('assistant', content)
         │
         └─── 'llm:error' ─── ChatPanel shows error message
```

### 3. Project Grouping Flow

```
User drags node over Project
         │
         ▼
    React Flow onNodeDrag event
         │ Check if hovering over Project node
         │
         ▼
    onDrop: Check if position inside Project bounds
         │
         ▼
    If inside Project:
         │ 1. Add child node ID to Project's childNodeIds
         │ 2. Set child node's parentId field
         │ 3. Convert position to relative (inside Project)
         │
         ▼
    React Flow re-renders
         │ Project shows child inside its bounds
```

---

## State Management Architecture

### Zustand Store Structure

```typescript
interface WorkspaceState {
  // ═══════════════════════════════════════════════════════════════════════
  // PERSISTENT STATE (saved to workspace file)
  // ═══════════════════════════════════════════════════════════════════════
  
  workspaceId: string | null;      // UUID of current workspace
  workspaceName: string;            // Display name
  nodes: Node<NodeData>[];          // All nodes on canvas
  edges: Edge[];                    // All connections
  viewport: ViewportState;          // Camera position/zoom
  
  // ═══════════════════════════════════════════════════════════════════════
  // TRANSIENT STATE (not saved)
  // ═══════════════════════════════════════════════════════════════════════
  
  selectedNodeIds: string[];        // Currently selected nodes
  selectedEdgeIds: string[];        // Currently selected edges
  activePanel: PanelType;           // Which panel is open
  activeChatNodeId: string | null;  // Which conversation is open
  
  // ═══════════════════════════════════════════════════════════════════════
  // HISTORY STATE (for undo/redo)
  // ═══════════════════════════════════════════════════════════════════════
  
  history: HistoryAction[];         // Stack of actions
  historyIndex: number;             // Current position (-1 = beginning)
  
  // ═══════════════════════════════════════════════════════════════════════
  // STATUS FLAGS
  // ═══════════════════════════════════════════════════════════════════════
  
  isDirty: boolean;                 // Has unsaved changes
  isLoading: boolean;               // Is loading workspace
  lastSaved: number | null;         // Timestamp of last save
}
```

### State Update Patterns

**Pattern 1: Immer for Immutable Updates**
```typescript
// ✅ CORRECT: Using Immer
set((state) => {
  state.nodes.push(newNode);
  state.isDirty = true;
});

// ❌ WRONG: Direct mutation outside Immer
const nodes = get().nodes;
nodes.push(newNode); // This won't trigger re-render!
```

**Pattern 2: Selector Hooks for Performance**
```typescript
// ✅ CORRECT: Specific selector
const nodes = useWorkspaceStore(state => state.nodes);

// ❌ WRONG: Selecting entire state
const state = useWorkspaceStore(); // Re-renders on ANY state change
```

**Pattern 3: Actions in Store, Not Components**
```typescript
// ✅ CORRECT: Action in store
const addNode = useWorkspaceStore(state => state.addNode);
addNode('conversation', position);

// ❌ WRONG: Business logic in component
const [nodes, setNodes] = useState([]);
setNodes(prev => [...prev, createNode()]); // Bypasses store!
```

---

## Component Hierarchy

```
App.tsx
├── Toolbar
│   ├── FileButtons (New, Open, Save)
│   ├── NodeButtons (Conversation, Project, Note, Task)
│   └── HistoryButtons (Undo, Redo)
│
├── ReactFlowProvider
│   └── Canvas
│       ├── Background
│       ├── MiniMap
│       ├── Controls
│       └── Nodes (mapped)
│           ├── ConversationNode
│           ├── ProjectNode
│           ├── NoteNode
│           └── TaskNode
│
├── PropertiesPanel (conditional)
│   ├── ConversationEditor
│   ├── ProjectEditor
│   ├── NoteEditor
│   └── TaskEditor
│
├── ChatPanel (conditional)
│   ├── ContextIndicator
│   ├── MessageList
│   │   └── MessageBubble (mapped)
│   └── MessageInput
│
└── Modals (conditional)
    ├── ApiKeyModal
    ├── SearchModal
    └── WorkspacePicker
```

---

## IPC Communication Protocol

### Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `workspace:save` | Renderer → Main | Save workspace to disk |
| `workspace:load` | Renderer → Main | Load workspace from disk |
| `workspace:list` | Renderer → Main | List available workspaces |
| `workspace:delete` | Renderer → Main | Delete workspace file |
| `settings:setApiKey` | Renderer → Main | Store encrypted API key |
| `settings:getApiKey` | Renderer → Main | Retrieve decrypted API key |
| `settings:hasApiKey` | Renderer → Main | Check if API key exists |
| `llm:stream` | Renderer → Main | Start LLM streaming |
| `llm:cancel` | Renderer → Main | Cancel ongoing stream |
| `llm:chunk` | Main → Renderer | Stream chunk received |
| `llm:done` | Main → Renderer | Stream completed |
| `llm:error` | Main → Renderer | Stream error occurred |

### Error Handling Protocol

All IPC responses follow this structure:
```typescript
interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Error handling in renderer:
```typescript
const result = await window.api.workspace.save(data);
if (!result.success) {
  showToast({ type: 'error', message: result.error });
  return;
}
// Success path...
```

---

## File System Structure

### User Data Directory

```
%APPDATA%/cognograph/
├── workspaces/
│   ├── {uuid}.json          # Workspace files
│   ├── {uuid}.json
│   └── ...
├── config.json              # electron-store data
└── logs/                    # Future: error logs
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
      "targetHandle": "top"
    }
  ]
}
```

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

### File Access

1. Workspace files are stored in user's app data directory
2. No network access except for LLM API calls
3. No telemetry or analytics

### IPC Security

1. All IPC uses `contextBridge` - no direct `ipcRenderer` exposure
2. Input validation on all IPC handlers
3. Error messages sanitized before sending to renderer

---

*Document version: 1.0 | Last updated: 2025-01-14*
