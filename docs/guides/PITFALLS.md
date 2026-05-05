# PITFALLS.md - Common Issues & Solutions

> **Critical bugs and how to avoid them.** This document captures lessons learned from building similar applications. Read this BEFORE implementation to avoid wasting hours debugging.

---

## 🔒 License & Legal Integrity

The license is AGPL-3.0 + Defensive Patent Pledge, not MIT. Don't modify legal files (`LICENSE`, `PATENTS`, `package.json` `license` field, README License section) without maintainer review.

**Consistency checklist when touching license:**
- [ ] `LICENSE` and `PATENTS` reflect AGPL-3.0 + Defensive Patent Pledge
- [ ] `package.json` says `"AGPL-3.0-only"`
- [ ] `package-lock.json` root entry says `"AGPL-3.0-only"` (stale after `npm install`)
- [ ] README License section matches

---

## 🚨 Critical Pitfalls (Will Break the App)

### Pitfall 1: React Flow Node Data Mutation

**The Problem:**
React Flow uses referential equality to detect changes. If you mutate node data directly, React Flow won't re-render.

```typescript
// ❌ WRONG - Direct mutation
const node = nodes.find(n => n.id === nodeId);
node.data.title = 'New Title'; // Won't trigger re-render!
```

**The Solution:**
Always create new references when updating:

```typescript
// ✅ CORRECT - New reference
set((state) => {
  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.data = { ...node.data, title: 'New Title' };
  }
});

// ✅ CORRECT - With Immer (recommended)
set((state) => {
  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.data.title = 'New Title'; // Immer handles immutability
  }
});
```

---

### Pitfall 2: Node Type Mismatch

**The Problem:**
If `nodeTypes` object keys don't match node `type` field, React Flow throws a cryptic error.

```typescript
// ❌ WRONG - Mismatched types
const nodeTypes = {
  conversationNode: ConversationNode, // Key is 'conversationNode'
};

const node = {
  type: 'conversation', // But node type is 'conversation'
  // ...
};
// Error: "Unknown node type: conversation"
```

**The Solution:**
Ensure exact match between nodeTypes keys and node type values:

```typescript
// ✅ CORRECT
const nodeTypes = {
  conversation: ConversationNode,
  project: ProjectNode,
  note: NoteNode,
  task: TaskNode,
};

const node = {
  type: 'conversation', // Matches key exactly
  // ...
};
```

---

### Pitfall 3: IPC Handler Memory Leak

**The Problem:**
Adding event listeners without cleanup causes memory leaks and duplicate handlers.

```typescript
// ❌ WRONG - Listener never removed
useEffect(() => {
  window.api.llm.onChunk((chunk) => {
    setContent(prev => prev + chunk);
  });
}, []); // Listener accumulates on every re-mount!
```

**The Solution:**
Always return cleanup function:

```typescript
// ✅ CORRECT - Cleanup on unmount
useEffect(() => {
  const unsubscribe = window.api.llm.onChunk((chunk) => {
    setContent(prev => prev + chunk);
  });
  
  return () => unsubscribe(); // Clean up!
}, []);
```

---

### Pitfall 4: Zustand Selector Performance

**The Problem:**
Selecting the entire store causes unnecessary re-renders.

```typescript
// ❌ WRONG - Component re-renders on ANY store change
const Component = () => {
  const store = useWorkspaceStore(); // Bad!
  return <div>{store.nodes.length}</div>;
};
```

**The Solution:**
Use specific selectors:

```typescript
// ✅ CORRECT - Only re-renders when nodes change
const Component = () => {
  const nodes = useWorkspaceStore(state => state.nodes);
  return <div>{nodes.length}</div>;
};

// ✅ EVEN BETTER - Memoized selector for derived data
const Component = () => {
  const nodeCount = useWorkspaceStore(
    useCallback(state => state.nodes.length, [])
  );
  return <div>{nodeCount}</div>;
};
```

---

### Pitfall 5: electron-store Async Issues

**The Problem:**
electron-store is synchronous but IPC is async. Mixing them wrong causes race conditions.

```typescript
// ❌ WRONG - Race condition
ipcMain.handle('settings:get', async () => {
  // This is sync but handler is async
  return store.get('settings');
});
```

**The Solution:**
Be consistent with sync/async:

```typescript
// ✅ CORRECT - Sync handler
ipcMain.handle('settings:get', () => {
  return store.get('settings'); // No async needed
});

// ✅ ALSO CORRECT - Explicit async wrapper
ipcMain.handle('settings:get', async () => {
  return Promise.resolve(store.get('settings'));
});
```

---

## ⚠️ Significant Pitfalls (Will Cause Bugs)

### Pitfall 6: Missing memo() on Custom Nodes

**The Problem:**
React Flow re-renders all nodes on canvas interaction. Without `memo()`, performance degrades rapidly.

```typescript
// ❌ WRONG - No memoization
export const ConversationNode = ({ data }: NodeProps) => {
  return <div>{data.title}</div>; // Re-renders on every pan/zoom!
};
```

**The Solution:**
Always wrap custom nodes in `memo()`:

```typescript
// ✅ CORRECT - Memoized
export const ConversationNode = memo(({ data }: NodeProps) => {
  return <div>{data.title}</div>;
});

ConversationNode.displayName = 'ConversationNode';
```

---

### Pitfall 7: Auto-Save Race Condition

**The Problem:**
Multiple rapid saves can corrupt workspace if not properly debounced.

```typescript
// ❌ WRONG - No debounce
useEffect(() => {
  window.api.workspace.save(getWorkspaceData());
}, [nodes, edges]); // Saves on EVERY change!
```

**The Solution:**
Debounce auto-save:

```typescript
// ✅ CORRECT - Debounced save
const debouncedSave = useMemo(
  () => debounce(async () => {
    await window.api.workspace.save(getWorkspaceData());
    markClean();
  }, 2000),
  [getWorkspaceData, markClean]
);

useEffect(() => {
  if (isDirty) {
    debouncedSave();
  }
  return () => debouncedSave.cancel();
}, [isDirty, debouncedSave]);
```

---

### Pitfall 8: Context Injection Infinite Loop

**The Problem:**
If context injection includes the current conversation, it creates infinite growth.

```typescript
// ❌ WRONG - Includes self
getConnectedNodes(nodeId).forEach(node => {
  if (node.data.type === 'conversation') {
    // Oops, might include current conversation!
    contextParts.push(node.data.messages);
  }
});
```

**The Solution:**
Exclude the current node:

```typescript
// ✅ CORRECT - Excludes self
getConnectedNodes(nodeId)
  .filter(node => node.id !== nodeId) // Exclude self!
  .forEach(node => {
    // ...
  });
```

---

### Pitfall 9: Handle Position Collisions

**The Problem:**
React Flow handles with same ID on same side cause connection bugs.

```typescript
// ❌ WRONG - Duplicate handle IDs
<Handle type="source" position={Position.Right} id="right" />
<Handle type="source" position={Position.Right} id="right" /> // Same ID!
```

**The Solution:**
Unique IDs per handle:

```typescript
// ✅ CORRECT - Unique IDs
<Handle type="source" position={Position.Right} id="right-1" />
<Handle type="source" position={Position.Right} id="right-2" />

// ✅ BETTER - One handle per position
<Handle type="source" position={Position.Right} id="right" />
<Handle type="source" position={Position.Bottom} id="bottom" />
```

---

### Pitfall 10: TypeScript NodeData Type Narrowing

**The Problem:**
TypeScript can't narrow discriminated union types inside callbacks.

```typescript
// ❌ WRONG - Type not narrowed
nodes.forEach(node => {
  if (node.data.type === 'conversation') {
    console.log(node.data.messages); // Error: messages doesn't exist on type NodeData
  }
});
```

**The Solution:**
Use type guards or cast:

```typescript
// ✅ CORRECT - Type guard function
function isConversation(data: NodeData): data is ConversationNodeData {
  return data.type === 'conversation';
}

nodes.forEach(node => {
  if (isConversation(node.data)) {
    console.log(node.data.messages); // Works!
  }
});

// ✅ ALSO CORRECT - Explicit cast
nodes.forEach(node => {
  if (node.data.type === 'conversation') {
    const data = node.data as ConversationNodeData;
    console.log(data.messages);
  }
});
```

---

## 📝 Minor Pitfalls (Annoying But Not Breaking)

### Pitfall 11: CSS Import Order

**The Problem:**
Tailwind base styles can override component styles if imported wrong.

```typescript
// ❌ WRONG - Tailwind overrides component styles
import './components/ChatPanel.css';
import './styles/tailwind.css'; // This resets some styles!
```

**The Solution:**
Import Tailwind first:

```typescript
// ✅ CORRECT - Tailwind first, then components
import './styles/index.css'; // Contains @tailwind directives
import './components/ChatPanel.css';
```

---

### Pitfall 12: React Flow Viewport Sync

**The Problem:**
Viewport state gets out of sync if you update it from both React Flow and store.

```typescript
// ❌ WRONG - Two sources of truth
const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
const storeViewport = useWorkspaceStore(state => state.viewport);
```

**The Solution:**
Single source of truth:

```typescript
// ✅ CORRECT - Store is the source of truth
const viewport = useWorkspaceStore(state => state.viewport);
const setViewport = useWorkspaceStore(state => state.setViewport);

<ReactFlow
  defaultViewport={viewport}
  onMoveEnd={(_, viewport) => setViewport(viewport)}
>
```

---

### Pitfall 13: UUID Import Issues

**The Problem:**
Some UUID packages have ES module issues with Electron.

```typescript
// ❌ MIGHT FAIL - Default import
import uuid from 'uuid';
```

**The Solution:**
Use named import:

```typescript
// ✅ CORRECT - Named import
import { v4 as uuid } from 'uuid';
```

---

## 🔍 Debugging Checklist

When something doesn't work, check these in order:

1. **Console errors** - Check both browser console AND terminal
2. **TypeScript errors** - Run `npm run typecheck`
3. **Node version** - Ensure Node 18+ (`node --version`)
4. **Dependencies** - Delete node_modules and reinstall
5. **IPC registration** - Ensure handlers registered before app ready
6. **Store subscription** - Verify selector returns correct data
7. **React Flow nodeTypes** - Confirm type names match exactly

---

---

*Document version: 1.1 | Last updated: 2026-02-06*
