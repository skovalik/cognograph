# IMPLEMENTATION.md - Complete Build Guide

> **This document contains the exact implementation steps.** Follow each phase in order. Do not skip ahead. Verify each checkpoint before proceeding.

---

## Phase 1: Project Scaffold

### Step 1.1: Initialize Project

```bash
# Create project directory (if not exists)
mkdir cognograph
cd cognograph

# Initialize electron-vite with React TypeScript template
npm create electron-vite@latest . -- --template react-ts

# Install all dependencies at once
npm install @xyflow/react zustand immer @anthropic-ai/sdk electron-store uuid react-markdown remark-gfm react-syntax-highlighter @types/react-syntax-highlighter
```

### Step 1.2: Configure TypeScript

**File: `tsconfig.json`** (replace entirely)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/renderer/src/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Step 1.3: Configure Tailwind

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**File: `tailwind.config.js`**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: '#1a1a2e',
          grid: '#252542',
        },
        node: {
          conversation: '#3b82f6',
          project: '#8b5cf6',
          note: '#f59e0b',
          task: '#10b981',
        }
      }
    },
  },
  plugins: [],
}
```

### Step 1.4: Create Shared Types

**File: `src/shared/types.ts`**
```typescript
// =============================================================================
// CORE TYPES - Used by both main and renderer processes
// =============================================================================

import type { Node, Edge } from '@xyflow/react';

// -----------------------------------------------------------------------------
// Node Data Types (Discriminated Union)
// -----------------------------------------------------------------------------

export interface ConversationNodeData {
  type: 'conversation';
  title: string;
  messages: Message[];
  provider: 'anthropic' | 'gemini' | 'openai';
  createdAt: number;
  updatedAt: number;
}

export interface ProjectNodeData {
  type: 'project';
  title: string;
  description: string;
  collapsed: boolean;
  childNodeIds: string[];
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface NoteNodeData {
  type: 'note';
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskNodeData {
  type: 'task';
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
}

export type NodeData = 
  | ConversationNodeData 
  | ProjectNodeData 
  | NoteNodeData 
  | TaskNodeData;

// -----------------------------------------------------------------------------
// Message Types
// -----------------------------------------------------------------------------

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  contextSources?: ContextSource[];
}

export interface ContextSource {
  nodeId: string;
  nodeType: NodeData['type'];
  title: string;
  excerpt: string;
}

// -----------------------------------------------------------------------------
// Workspace Types
// -----------------------------------------------------------------------------

export interface WorkspaceData {
  id: string;
  name: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  updatedAt: number;
  nodeCount: number;
}

// -----------------------------------------------------------------------------
// Settings Types
// -----------------------------------------------------------------------------

export interface AppSettings {
  theme: 'dark' | 'light';
  autoSave: boolean;
  autoSaveInterval: number;
  defaultProvider: 'anthropic' | 'gemini' | 'openai';
  apiKeys: {
    anthropic?: string;
    gemini?: string;
    openai?: string;
  };
  recentWorkspaces: string[];
}

// -----------------------------------------------------------------------------
// IPC Types
// -----------------------------------------------------------------------------

export interface LLMStreamOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// -----------------------------------------------------------------------------
// History Types (for Undo/Redo)
// -----------------------------------------------------------------------------

export type HistoryAction = 
  | { type: 'ADD_NODE'; node: Node<NodeData> }
  | { type: 'DELETE_NODE'; node: Node<NodeData> }
  | { type: 'UPDATE_NODE'; nodeId: string; before: Partial<NodeData>; after: Partial<NodeData> }
  | { type: 'MOVE_NODE'; nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }
  | { type: 'RESIZE_NODE'; nodeId: string; before: { width: number; height: number }; after: { width: number; height: number } }
  | { type: 'ADD_EDGE'; edge: Edge }
  | { type: 'DELETE_EDGE'; edge: Edge }
  | { type: 'BATCH'; actions: HistoryAction[] };

// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function isConversationNode(data: NodeData): data is ConversationNodeData {
  return data.type === 'conversation';
}

export function isProjectNode(data: NodeData): data is ProjectNodeData {
  return data.type === 'project';
}

export function isNoteNode(data: NodeData): data is NoteNodeData {
  return data.type === 'note';
}

export function isTaskNode(data: NodeData): data is TaskNodeData {
  return data.type === 'task';
}
```

### ✅ CHECKPOINT 1
Run `npm run dev`. You should see a blank Electron window. If you see errors, fix them before proceeding.

---

## Phase 2: Canvas & Nodes

### Step 2.1: Create Zustand Store

**File: `src/renderer/src/stores/workspaceStore.ts`**
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { v4 as uuid } from 'uuid';
import type { 
  NodeData, 
  WorkspaceData, 
  HistoryAction,
  ConversationNodeData,
  ProjectNodeData,
  NoteNodeData,
  TaskNodeData 
} from '@shared/types';

// -----------------------------------------------------------------------------
// Store Interface
// -----------------------------------------------------------------------------

interface WorkspaceState {
  // Workspace data
  workspaceId: string | null;
  workspaceName: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  
  // UI state
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  activePanel: 'none' | 'properties' | 'chat';
  activeChatNodeId: string | null;
  
  // History (undo/redo)
  history: HistoryAction[];
  historyIndex: number;
  
  // Status
  isDirty: boolean;
  isLoading: boolean;
  lastSaved: number | null;
  
  // Actions - Nodes
  addNode: (type: NodeData['type'], position: { x: number; y: number }) => string;
  updateNode: (nodeId: string, data: Partial<NodeData>) => void;
  deleteNodes: (nodeIds: string[]) => void;
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;
  resizeNode: (nodeId: string, dimensions: { width?: number; height?: number }) => void;
  
  // Actions - Edges
  addEdge: (connection: Connection) => void;
  deleteEdges: (edgeIds: string[]) => void;
  
  // Actions - React Flow callbacks
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  
  // Actions - Selection
  setSelectedNodes: (nodeIds: string[]) => void;
  setSelectedEdges: (edgeIds: string[]) => void;
  clearSelection: () => void;
  
  // Actions - Panels
  openChat: (nodeId: string) => void;
  closeChat: () => void;
  openProperties: () => void;
  closeProperties: () => void;
  
  // Actions - Messages
  addMessage: (nodeId: string, role: 'user' | 'assistant', content: string) => void;
  
  // Actions - Workspace
  newWorkspace: () => void;
  loadWorkspace: (data: WorkspaceData) => void;
  getWorkspaceData: () => WorkspaceData;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  markDirty: () => void;
  markClean: () => void;
  
  // Actions - History
  undo: () => void;
  redo: () => void;
  pushHistory: (action: HistoryAction) => void;
  
  // Actions - Context
  getConnectedNodes: (nodeId: string) => Node<NodeData>[];
  getContextForNode: (nodeId: string) => string;
}

// -----------------------------------------------------------------------------
// Default Node Data Factories
// -----------------------------------------------------------------------------

const createConversationData = (): ConversationNodeData => ({
  type: 'conversation',
  title: 'New Conversation',
  messages: [],
  provider: 'anthropic',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const createProjectData = (): ProjectNodeData => ({
  type: 'project',
  title: 'New Project',
  description: '',
  collapsed: false,
  childNodeIds: [],
  color: '#8b5cf6',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const createNoteData = (): NoteNodeData => ({
  type: 'note',
  title: 'New Note',
  content: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const createTaskData = (): TaskNodeData => ({
  type: 'task',
  title: 'New Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// -----------------------------------------------------------------------------
// Store Implementation
// -----------------------------------------------------------------------------

export const useWorkspaceStore = create<WorkspaceState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      workspaceId: null,
      workspaceName: 'Untitled Workspace',
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeIds: [],
      selectedEdgeIds: [],
      activePanel: 'none',
      activeChatNodeId: null,
      history: [],
      historyIndex: -1,
      isDirty: false,
      isLoading: false,
      lastSaved: null,

      // ---------------------------------------------------------------------
      // Node Actions
      // ---------------------------------------------------------------------
      
      addNode: (type, position) => {
        const id = uuid();
        let data: NodeData;
        let dimensions = { width: 280, height: 120 };
        
        switch (type) {
          case 'conversation':
            data = createConversationData();
            dimensions = { width: 300, height: 140 };
            break;
          case 'project':
            data = createProjectData();
            dimensions = { width: 400, height: 300 };
            break;
          case 'note':
            data = createNoteData();
            dimensions = { width: 280, height: 180 };
            break;
          case 'task':
            data = createTaskData();
            dimensions = { width: 260, height: 140 };
            break;
          default:
            throw new Error(`Unknown node type: ${type}`);
        }
        
        const node: Node<NodeData> = {
          id,
          type,
          position,
          data,
          width: dimensions.width,
          height: dimensions.height,
          selected: false,
        };
        
        set((state) => {
          state.nodes.push(node);
          state.isDirty = true;
          state.history = state.history.slice(0, state.historyIndex + 1);
          state.history.push({ type: 'ADD_NODE', node });
          state.historyIndex++;
        });
        
        return id;
      },
      
      updateNode: (nodeId, data) => {
        set((state) => {
          const node = state.nodes.find(n => n.id === nodeId);
          if (node) {
            const before = { ...node.data };
            Object.assign(node.data, data, { updatedAt: Date.now() });
            state.isDirty = true;
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push({ 
              type: 'UPDATE_NODE', 
              nodeId, 
              before, 
              after: { ...node.data } 
            });
            state.historyIndex++;
          }
        });
      },
      
      deleteNodes: (nodeIds) => {
        set((state) => {
          const deletedNodes = state.nodes.filter(n => nodeIds.includes(n.id));
          const deletedEdges = state.edges.filter(
            e => nodeIds.includes(e.source) || nodeIds.includes(e.target)
          );
          
          state.nodes = state.nodes.filter(n => !nodeIds.includes(n.id));
          state.edges = state.edges.filter(
            e => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
          );
          state.selectedNodeIds = state.selectedNodeIds.filter(id => !nodeIds.includes(id));
          state.isDirty = true;
          
          // Push batch history action
          const actions: HistoryAction[] = [
            ...deletedNodes.map(node => ({ type: 'DELETE_NODE' as const, node })),
            ...deletedEdges.map(edge => ({ type: 'DELETE_EDGE' as const, edge })),
          ];
          state.history = state.history.slice(0, state.historyIndex + 1);
          state.history.push({ type: 'BATCH', actions });
          state.historyIndex++;
        });
      },
      
      moveNode: (nodeId, position) => {
        set((state) => {
          const node = state.nodes.find(n => n.id === nodeId);
          if (node) {
            const before = { ...node.position };
            node.position = position;
            state.isDirty = true;
            // Note: Move history is handled by onNodesChange for batching
          }
        });
      },
      
      resizeNode: (nodeId, dimensions) => {
        set((state) => {
          const node = state.nodes.find(n => n.id === nodeId);
          if (node) {
            const before = { width: node.width || 280, height: node.height || 120 };
            if (dimensions.width) node.width = Math.max(150, dimensions.width);
            if (dimensions.height) node.height = Math.max(80, dimensions.height);
            state.isDirty = true;
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push({
              type: 'RESIZE_NODE',
              nodeId,
              before,
              after: { width: node.width!, height: node.height! }
            });
            state.historyIndex++;
          }
        });
      },

      // ---------------------------------------------------------------------
      // Edge Actions
      // ---------------------------------------------------------------------
      
      addEdge: (connection) => {
        const edge: Edge = {
          id: `${connection.source}-${connection.target}`,
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        };
        
        set((state) => {
          // Prevent duplicate edges
          const exists = state.edges.some(
            e => e.source === edge.source && e.target === edge.target
          );
          if (!exists) {
            state.edges.push(edge);
            state.isDirty = true;
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push({ type: 'ADD_EDGE', edge });
            state.historyIndex++;
          }
        });
      },
      
      deleteEdges: (edgeIds) => {
        set((state) => {
          const deleted = state.edges.filter(e => edgeIds.includes(e.id));
          state.edges = state.edges.filter(e => !edgeIds.includes(e.id));
          state.selectedEdgeIds = state.selectedEdgeIds.filter(id => !edgeIds.includes(id));
          state.isDirty = true;
          
          deleted.forEach(edge => {
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push({ type: 'DELETE_EDGE', edge });
            state.historyIndex++;
          });
        });
      },

      // ---------------------------------------------------------------------
      // React Flow Callbacks
      // ---------------------------------------------------------------------
      
      onNodesChange: (changes) => {
        set((state) => {
          state.nodes = applyNodeChanges(changes, state.nodes) as Node<NodeData>[];
          
          // Track selection changes
          const selectionChanges = changes.filter(c => c.type === 'select');
          if (selectionChanges.length > 0) {
            state.selectedNodeIds = state.nodes
              .filter(n => n.selected)
              .map(n => n.id);
          }
          
          // Mark dirty for position/dimension changes
          const dirtyChanges = changes.filter(
            c => c.type === 'position' || c.type === 'dimensions'
          );
          if (dirtyChanges.length > 0) {
            state.isDirty = true;
          }
        });
      },
      
      onEdgesChange: (changes) => {
        set((state) => {
          state.edges = applyEdgeChanges(changes, state.edges);
          
          // Track selection
          const selectionChanges = changes.filter(c => c.type === 'select');
          if (selectionChanges.length > 0) {
            state.selectedEdgeIds = state.edges
              .filter(e => e.selected)
              .map(e => e.id);
          }
        });
      },
      
      onConnect: (connection) => {
        get().addEdge(connection);
      },

      // ---------------------------------------------------------------------
      // Selection Actions
      // ---------------------------------------------------------------------
      
      setSelectedNodes: (nodeIds) => {
        set((state) => {
          state.selectedNodeIds = nodeIds;
          state.nodes.forEach(n => {
            n.selected = nodeIds.includes(n.id);
          });
          if (nodeIds.length > 0) {
            state.activePanel = 'properties';
          }
        });
      },
      
      setSelectedEdges: (edgeIds) => {
        set((state) => {
          state.selectedEdgeIds = edgeIds;
          state.edges.forEach(e => {
            e.selected = edgeIds.includes(e.id);
          });
        });
      },
      
      clearSelection: () => {
        set((state) => {
          state.selectedNodeIds = [];
          state.selectedEdgeIds = [];
          state.nodes.forEach(n => { n.selected = false; });
          state.edges.forEach(e => { e.selected = false; });
          state.activePanel = 'none';
        });
      },

      // ---------------------------------------------------------------------
      // Panel Actions
      // ---------------------------------------------------------------------
      
      openChat: (nodeId) => {
        const node = get().nodes.find(n => n.id === nodeId);
        if (node && node.data.type === 'conversation') {
          set((state) => {
            state.activeChatNodeId = nodeId;
            state.activePanel = 'chat';
          });
        }
      },
      
      closeChat: () => {
        set((state) => {
          state.activeChatNodeId = null;
          state.activePanel = 'none';
        });
      },
      
      openProperties: () => {
        set((state) => {
          state.activePanel = 'properties';
        });
      },
      
      closeProperties: () => {
        set((state) => {
          state.activePanel = 'none';
        });
      },

      // ---------------------------------------------------------------------
      // Message Actions
      // ---------------------------------------------------------------------
      
      addMessage: (nodeId, role, content) => {
        set((state) => {
          const node = state.nodes.find(n => n.id === nodeId);
          if (node && node.data.type === 'conversation') {
            const convData = node.data as ConversationNodeData;
            convData.messages.push({
              id: uuid(),
              role,
              content,
              timestamp: Date.now(),
            });
            convData.updatedAt = Date.now();
            
            // Auto-title from first user message
            if (convData.title === 'New Conversation' && role === 'user') {
              convData.title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
            }
            
            state.isDirty = true;
          }
        });
      },

      // ---------------------------------------------------------------------
      // Workspace Actions
      // ---------------------------------------------------------------------
      
      newWorkspace: () => {
        set((state) => {
          state.workspaceId = uuid();
          state.workspaceName = 'Untitled Workspace';
          state.nodes = [];
          state.edges = [];
          state.viewport = { x: 0, y: 0, zoom: 1 };
          state.selectedNodeIds = [];
          state.selectedEdgeIds = [];
          state.activePanel = 'none';
          state.activeChatNodeId = null;
          state.history = [];
          state.historyIndex = -1;
          state.isDirty = false;
          state.lastSaved = null;
        });
      },
      
      loadWorkspace: (data) => {
        set((state) => {
          state.workspaceId = data.id;
          state.workspaceName = data.name;
          state.nodes = data.nodes;
          state.edges = data.edges;
          state.viewport = data.viewport;
          state.selectedNodeIds = [];
          state.selectedEdgeIds = [];
          state.activePanel = 'none';
          state.activeChatNodeId = null;
          state.history = [];
          state.historyIndex = -1;
          state.isDirty = false;
          state.lastSaved = data.updatedAt;
          state.isLoading = false;
        });
      },
      
      getWorkspaceData: () => {
        const state = get();
        return {
          id: state.workspaceId || uuid(),
          name: state.workspaceName,
          nodes: state.nodes,
          edges: state.edges,
          viewport: state.viewport,
          createdAt: state.lastSaved || Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
      },
      
      setViewport: (viewport) => {
        set((state) => {
          state.viewport = viewport;
        });
      },
      
      markDirty: () => {
        set((state) => {
          state.isDirty = true;
        });
      },
      
      markClean: () => {
        set((state) => {
          state.isDirty = false;
          state.lastSaved = Date.now();
        });
      },

      // ---------------------------------------------------------------------
      // History Actions (Undo/Redo)
      // ---------------------------------------------------------------------
      
      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < 0) return;
        
        const action = history[historyIndex];
        
        set((state) => {
          switch (action.type) {
            case 'ADD_NODE':
              state.nodes = state.nodes.filter(n => n.id !== action.node.id);
              break;
            case 'DELETE_NODE':
              state.nodes.push(action.node);
              break;
            case 'UPDATE_NODE': {
              const node = state.nodes.find(n => n.id === action.nodeId);
              if (node) Object.assign(node.data, action.before);
              break;
            }
            case 'MOVE_NODE': {
              const node = state.nodes.find(n => n.id === action.nodeId);
              if (node) node.position = action.before;
              break;
            }
            case 'RESIZE_NODE': {
              const node = state.nodes.find(n => n.id === action.nodeId);
              if (node) {
                node.width = action.before.width;
                node.height = action.before.height;
              }
              break;
            }
            case 'ADD_EDGE':
              state.edges = state.edges.filter(e => e.id !== action.edge.id);
              break;
            case 'DELETE_EDGE':
              state.edges.push(action.edge);
              break;
            case 'BATCH':
              // Undo in reverse order
              action.actions.reverse().forEach(subAction => {
                // Recursively handle (simplified - would need proper implementation)
              });
              break;
          }
          state.historyIndex--;
          state.isDirty = true;
        });
      },
      
      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        
        const action = history[historyIndex + 1];
        
        set((state) => {
          switch (action.type) {
            case 'ADD_NODE':
              state.nodes.push(action.node);
              break;
            case 'DELETE_NODE':
              state.nodes = state.nodes.filter(n => n.id !== action.node.id);
              break;
            case 'UPDATE_NODE': {
              const node = state.nodes.find(n => n.id === action.nodeId);
              if (node) Object.assign(node.data, action.after);
              break;
            }
            case 'MOVE_NODE': {
              const node = state.nodes.find(n => n.id === action.nodeId);
              if (node) node.position = action.after;
              break;
            }
            case 'RESIZE_NODE': {
              const node = state.nodes.find(n => n.id === action.nodeId);
              if (node) {
                node.width = action.after.width;
                node.height = action.after.height;
              }
              break;
            }
            case 'ADD_EDGE':
              state.edges.push(action.edge);
              break;
            case 'DELETE_EDGE':
              state.edges = state.edges.filter(e => e.id !== action.edge.id);
              break;
          }
          state.historyIndex++;
          state.isDirty = true;
        });
      },
      
      pushHistory: (action) => {
        set((state) => {
          state.history = state.history.slice(0, state.historyIndex + 1);
          state.history.push(action);
          state.historyIndex++;
          
          // Limit history size
          if (state.history.length > 100) {
            state.history = state.history.slice(-100);
            state.historyIndex = state.history.length - 1;
          }
        });
      },

      // ---------------------------------------------------------------------
      // Context Actions
      // ---------------------------------------------------------------------
      
      getConnectedNodes: (nodeId) => {
        const { nodes, edges } = get();
        const connectedIds = new Set<string>();
        
        edges.forEach(edge => {
          if (edge.source === nodeId) connectedIds.add(edge.target);
          if (edge.target === nodeId) connectedIds.add(edge.source);
        });
        
        return nodes.filter(n => connectedIds.has(n.id));
      },
      
      getContextForNode: (nodeId) => {
        const connectedNodes = get().getConnectedNodes(nodeId);
        const contextParts: string[] = [];
        
        connectedNodes.forEach(node => {
          switch (node.data.type) {
            case 'note':
              contextParts.push(`[Note: ${node.data.title}]\n${node.data.content}`);
              break;
            case 'project':
              contextParts.push(`[Project: ${node.data.title}]\n${node.data.description}`);
              break;
            case 'conversation':
              const recentMessages = node.data.messages.slice(-5);
              if (recentMessages.length > 0) {
                const msgText = recentMessages
                  .map(m => `${m.role}: ${m.content}`)
                  .join('\n');
                contextParts.push(`[Related Conversation: ${node.data.title}]\n${msgText}`);
              }
              break;
          }
        });
        
        return contextParts.join('\n\n---\n\n');
      },
    }))
  )
);

// -----------------------------------------------------------------------------
// Selector Hooks (for performance)
// -----------------------------------------------------------------------------

export const useNodes = () => useWorkspaceStore(state => state.nodes);
export const useEdges = () => useWorkspaceStore(state => state.edges);
export const useSelectedNodeIds = () => useWorkspaceStore(state => state.selectedNodeIds);
export const useActivePanel = () => useWorkspaceStore(state => state.activePanel);
export const useActiveChatNodeId = () => useWorkspaceStore(state => state.activeChatNodeId);
export const useIsDirty = () => useWorkspaceStore(state => state.isDirty);
```

### ✅ CHECKPOINT 2
File should have no TypeScript errors. Run `npm run typecheck` to verify.

---

## Phase 2 Continued: Node Components

### Step 2.2: Base Node Styles

**File: `src/renderer/src/styles/nodes.css`**
```css
/* =============================================================================
   NODE BASE STYLES
   ============================================================================= */

.cognograph-node {
  @apply rounded-lg shadow-lg border-2 transition-all duration-150;
  @apply bg-gray-900/95 backdrop-blur-sm;
  min-width: 150px;
  min-height: 80px;
}

.cognograph-node:hover {
  @apply shadow-xl;
}

.cognograph-node.selected {
  @apply ring-2 ring-offset-2 ring-offset-gray-900;
}

/* Node type colors */
.cognograph-node--conversation {
  @apply border-blue-500;
}
.cognograph-node--conversation.selected {
  @apply ring-blue-500;
}

.cognograph-node--project {
  @apply border-purple-500 bg-purple-950/50;
}
.cognograph-node--project.selected {
  @apply ring-purple-500;
}

.cognograph-node--note {
  @apply border-amber-500;
}
.cognograph-node--note.selected {
  @apply ring-amber-500;
}

.cognograph-node--task {
  @apply border-emerald-500;
}
.cognograph-node--task.selected {
  @apply ring-emerald-500;
}

/* Node header */
.cognograph-node__header {
  @apply flex items-center gap-2 px-3 py-2 border-b border-gray-700;
}

.cognograph-node__icon {
  @apply w-5 h-5 flex-shrink-0;
}

.cognograph-node__title {
  @apply text-sm font-medium text-gray-100 truncate flex-1;
}

/* Node body */
.cognograph-node__body {
  @apply px-3 py-2 text-xs text-gray-400;
}

/* Node footer */
.cognograph-node__footer {
  @apply flex items-center justify-between px-3 py-1.5 border-t border-gray-700 text-xs text-gray-500;
}

/* Resize handle */
.cognograph-node__resize {
  @apply absolute bottom-0 right-0 w-4 h-4 cursor-se-resize;
  @apply opacity-0 transition-opacity;
}

.cognograph-node:hover .cognograph-node__resize {
  @apply opacity-50;
}

.cognograph-node__resize:hover {
  @apply opacity-100;
}

/* =============================================================================
   HANDLE STYLES
   ============================================================================= */

.react-flow__handle {
  @apply w-3 h-3 bg-gray-600 border-2 border-gray-400;
  @apply transition-all duration-150;
}

.react-flow__handle:hover {
  @apply bg-blue-500 border-blue-300 scale-125;
}

.react-flow__handle-left {
  left: -6px;
}

.react-flow__handle-right {
  right: -6px;
}

.react-flow__handle-top {
  top: -6px;
}

.react-flow__handle-bottom {
  bottom: -6px;
}

/* =============================================================================
   EDGE STYLES
   ============================================================================= */

.react-flow__edge-path {
  @apply stroke-gray-500 stroke-2;
}

.react-flow__edge.selected .react-flow__edge-path {
  @apply stroke-blue-500 stroke-[3px];
}

.react-flow__edge:hover .react-flow__edge-path {
  @apply stroke-gray-300;
}
```

---

*[Document continues - this is getting long. I'll create the remaining files...]*
