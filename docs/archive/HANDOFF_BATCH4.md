# Claude Code: Continue In-Progress Work

**Read this file to continue where you left off.**

---

## Current Status

Run this to see in-progress items:
```bash
node scripts/list-todos.mjs --pending
```

---

## Priority Order

### 1. FIX: Inline Editing (30 min) - HIGH PRIORITY

**Problem:** Double-click to edit doesn't work on NoteNode or TaskNode.

**Root Cause:** `EditableTitle.tsx` and `EditableText.tsx` exist but aren't imported in NoteNode.tsx or TaskNode.tsx.

**Fix NoteNode.tsx:**

1. Add imports at top:
```tsx
import { EditableTitle } from '../EditableTitle'
import { EditableText } from '../EditableText'
```

2. In the header section (~line 115), replace:
```tsx
<span className="cognograph-node__title">{nodeData.title}</span>
```
With:
```tsx
<EditableTitle
  value={nodeData.title}
  onChange={(newTitle) => updateNode(id, { title: newTitle })}
  className="cognograph-node__title"
  placeholder="Untitled Note"
/>
```

3. In the body section (~line 120), replace the content paragraph with:
```tsx
<EditableText
  value={nodeData.content || ''}
  onChange={(newContent) => updateNode(id, { content: newContent })}
  placeholder="Add note content..."
  className="whitespace-pre-wrap"
/>
```

**Fix TaskNode.tsx:** Same pattern - add imports, replace span with EditableTitle, replace description p with EditableText.

**When done:**
```bash
node scripts/safe-update-todo.mjs inline-editing done "Files: NoteNode.tsx, TaskNode.tsx | Integrated EditableTitle and EditableText for inline double-click editing"
```

---

### 2. FIX: Align/Space Buttons (1 hr)

**Problem:** Current align/distribute works but needs grid options.

**Add to AlignmentToolbar.tsx:**
- Snap to Grid button
- Arrange in Grid button (rows/columns)
- Sort by Type button

**Add to workspaceStore.ts:**
- `snapToGrid(nodeIds, gridSize)` 
- `arrangeInGrid(nodeIds, columns)`
- `sortByType(nodeIds)`

**When done:**
```bash
node scripts/safe-update-todo.mjs align-space-nodes done "Files: AlignmentToolbar.tsx, workspaceStore.ts | Added grid snap, arrange in grid, sort by type"
```

---

### 3. IMPLEMENT: Copy/Paste/Cut (2 hr)

**Need:**
- Clipboard state in workspaceStore: `clipboardNodes`, `clipboardEdges`
- `copyNodes(nodeIds)` - serialize selected nodes + edges between them
- `cutNodes(nodeIds)` - copy then delete
- `pasteNodes(position)` - deserialize with new IDs, offset position

**Keybindings in Canvas.tsx or wherever keyboard events are handled:**
- Ctrl+C → copyNodes(selectedNodeIds)
- Ctrl+X → cutNodes(selectedNodeIds)  
- Ctrl+V → pasteNodes(cursor position or center of viewport)

**When done:**
```bash
node scripts/safe-update-todo.mjs copy-paste-cut done "Files: workspaceStore.ts, Canvas.tsx | Implemented clipboard with Ctrl+C/X/V, edge preservation, new IDs on paste"
```

---

### 4. ADD: Complexity LLM Auto-Pick (1 hr)

**Current state:** Complexity property exists with 5 levels.

**Add:** Button/icon next to complexity that calls LLM to suggest level.

**Implementation:**
1. Add sparkle/wand icon button in TaskNode footer next to complexity badge
2. On click, call Claude API with node title + description + connected context
3. Parse response for complexity level
4. Update node's complexity property

**When done:**
```bash
node scripts/safe-update-todo.mjs complexity-property done "Files: TaskNode.tsx | Added LLM auto-pick button for complexity estimation"
```

---

### 5. COMPLETE: Hide Property Toggle (45 min)

**Current state:** `hiddenProperties` array exists in node data.

**Need:** Toggle UI in PropertiesPanel for each property including built-ins (status, priority, complexity).

**When done:**
```bash
node scripts/safe-update-todo.mjs hide-property-toggle done "Files: PropertiesPanel.tsx | Added visibility toggle for all properties including built-ins"
```

---

## Reference

- Full debug plan: `docs/specs/in-progress-debug-plan.md`
- Task management guide: `docs/guides/claude-code-task-management.md`
- Code patterns: `IMPLEMENTATION.md`
- Pitfalls to avoid: `PITFALLS.md`

---

## Start Command

Begin with inline editing fix - it's the quickest win with highest user impact.
