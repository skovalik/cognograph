# QA.md - Quality Assurance & Testing

> **Comprehensive testing checklist.** Use this document to verify the application works correctly before considering implementation complete.

---

## Pre-Implementation Checklist

Before writing any code, verify:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm 9+ installed (`npm --version`)
- [ ] Git installed (`git --version`)
- [ ] Project directory created
- [ ] All documentation files read

---

## Phase-by-Phase Verification

### Phase 1: Project Scaffold ✓

Run these commands and verify success:

```bash
npm install          # No errors
npm run dev          # Window opens
npm run typecheck    # No TypeScript errors
npm run lint         # No linting errors (or only warnings)
```

Visual verification:
- [ ] Electron window opens
- [ ] No console errors in DevTools
- [ ] Window title shows app name

---

### Phase 2: Canvas & Nodes ✓

#### Canvas Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Pan canvas | Click and drag on empty area | Canvas moves |
| Zoom in | Scroll up or Ctrl++ | Canvas zooms in |
| Zoom out | Scroll down or Ctrl+- | Canvas zooms out |
| Fit view | Click fit button | All nodes visible |
| Minimap | Look at bottom-right | Shows node overview |

#### Node Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Add Conversation | Click toolbar button | Blue node appears |
| Add Project | Click toolbar button | Purple node appears |
| Add Note | Click toolbar button | Amber node appears |
| Add Task | Click toolbar button | Green node appears |
| Drag node | Click and drag node | Node moves smoothly |
| Select node | Click on node | Node shows selection ring |
| Multi-select | Shift+click nodes | Multiple nodes selected |
| Delete node | Select + press Delete | Node removed |
| Delete with Backspace | Select + press Backspace | Node removed |

#### Edge Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Create edge | Drag from handle to handle | Edge connects nodes |
| Select edge | Click on edge | Edge highlights |
| Delete edge | Select + Delete | Edge removed |
| Prevent duplicate | Connect same nodes twice | Only one edge exists |

---

### Phase 3: Properties Panel ✓

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Open panel | Select a node | Panel appears on right |
| Edit title | Change title in panel | Node title updates |
| Edit description | Change description | Value saved |
| Different fields | Select different node types | Correct fields shown |
| Delete from panel | Click delete button | Node removed, panel closes |
| Close panel | Click X or press Escape | Panel closes |
| Multi-select | Select multiple nodes | Panel shows count |

#### Type-Specific Tests

**Conversation:**
- [ ] Title field works
- [ ] Provider dropdown works
- [ ] Message count displays

**Project:**
- [ ] Title field works
- [ ] Description field works
- [ ] Color picker works
- [ ] Child count displays

**Note:**
- [ ] Title field works
- [ ] Content textarea works
- [ ] Word count displays

**Task:**
- [ ] Title field works
- [ ] Description field works
- [ ] Status dropdown works
- [ ] Priority dropdown works

---

### Phase 4: Persistence ✓

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Auto-save triggers | Add a node | Save indicator shows |
| Manual save | Press Ctrl+S | Save completes |
| Reload preserves | Close and reopen app | All nodes present |
| New workspace | Click New | Canvas clears |
| Open workspace | Click Open | Previous workspace loads |
| Position preserved | Move nodes, reload | Nodes in same positions |
| Edges preserved | Create edges, reload | Edges still connected |
| Messages preserved | Chat, reload | Messages still there |

#### File System Tests

- [ ] Workspace folder exists: `%APPDATA%/cognograph/workspaces/`
- [ ] JSON files are valid (open in editor)
- [ ] Multiple workspaces can exist
- [ ] Delete workspace removes file

---

### Phase 5: Chat Integration ✓

#### API Key Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| No key prompt | Double-click conversation | API key modal appears |
| Save key | Enter key and submit | Modal closes |
| Key persists | Restart app, open chat | No prompt (key saved) |
| Invalid key | Enter wrong key | Error message shows |

#### Chat Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Open chat | Double-click conversation | Chat panel opens |
| Send message | Type and press Enter | Message appears, AI responds |
| Streaming | Watch response | Text streams in progressively |
| Cancel stream | Click stop button | Streaming stops |
| Multi-line input | Shift+Enter | New line added |
| Auto-title | First message | Conversation title updates |
| Close chat | Click X or Escape | Panel closes |

#### Markdown Tests

| Test | Input | Expected |
|------|-------|----------|
| Bold | `**bold**` | **bold** |
| Italic | `*italic*` | *italic* |
| Code inline | `` `code` `` | `code` |
| Code block | ``` ```js\ncode\n``` ``` | Syntax highlighted |
| Headers | `# Header` | Large text |
| Lists | `- item` | Bulleted list |
| Links | `[text](url)` | Clickable link |

---

### Phase 6: Context Injection ✓

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Indicator shows | Connect note to conversation | "Using context" badge appears |
| Note context | Write in note, ask AI about it | AI knows note content |
| Project context | Connect project | AI knows project description |
| Multiple sources | Connect 3 nodes | All 3 listed in indicator |
| No self-reference | Conversation alone | No infinite content |
| Disconnect removes | Remove edge | Context indicator updates |

#### Context Quality Tests

1. Create a Note with specific content (e.g., "The project deadline is March 15")
2. Connect Note to Conversation
3. Ask AI: "When is the deadline?"
4. **Expected:** AI correctly answers "March 15"

---

### Phase 7: Project Grouping ✓

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Drag into project | Drag note onto project | Note becomes child |
| Visual containment | After grouping | Node appears inside project |
| Move together | Drag project | Children move with it |
| Collapse project | Click collapse | Children hidden |
| Expand project | Click expand | Children visible |
| Drag out | Drag child outside | Child becomes independent |

---

### Phase 8: Undo/Redo ✓

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Undo add | Add node, Ctrl+Z | Node removed |
| Redo add | After undo, Ctrl+Shift+Z | Node returns |
| Undo delete | Delete node, Ctrl+Z | Node restored |
| Undo move | Move node, Ctrl+Z | Node returns to position |
| Undo edge | Add edge, Ctrl+Z | Edge removed |
| Button state | At start | Undo disabled |
| Button state | After action | Undo enabled |
| History limit | Do 150 actions | Only last 100 undoable |

---

### Phase 9: Polish & Edge Cases ✓

#### Keyboard Shortcuts

| Shortcut | Action | Verified |
|----------|--------|----------|
| Delete/Backspace | Delete selected | [ ] |
| Escape | Close panel / deselect | [ ] |
| Ctrl+Z | Undo | [ ] |
| Ctrl+Shift+Z | Redo | [ ] |
| Ctrl+S | Save | [ ] |
| Ctrl+N | New workspace | [ ] |
| Ctrl+O | Open workspace | [ ] |
| Ctrl+A | Select all | [ ] |

#### Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Network offline | Error message, no crash |
| Invalid API key | Clear error message |
| Corrupted workspace file | Error message, doesn't crash |
| Very large workspace (100+ nodes) | Still responsive |
| Rapid clicking | No duplicate actions |

#### Edge Cases

- [ ] Empty workspace saves/loads correctly
- [ ] Unicode characters in titles work
- [ ] Very long text in notes doesn't break layout
- [ ] Nodes at canvas edge work correctly
- [ ] Connecting node to itself is prevented
- [ ] Deleting connected node removes edges

---

## Performance Benchmarks

| Metric | Target | How to Test |
|--------|--------|-------------|
| App startup | < 3 seconds | Time from launch to canvas |
| Node add | < 100ms | Add node, measure delay |
| Canvas pan | 60 fps | Pan rapidly, check smoothness |
| Save workspace | < 1 second | Save 50-node workspace |
| Load workspace | < 2 seconds | Load 50-node workspace |
| Chat response start | < 2 seconds | Time to first token |

---

## Regression Testing

After ANY code change, verify these still work:

1. [ ] App starts without errors
2. [ ] Can add all 4 node types
3. [ ] Can connect nodes with edges
4. [ ] Chat works with streaming
5. [ ] Workspace saves and loads
6. [ ] Undo/redo works

---

## Bug Report Template

When you find a bug, document it like this:

```markdown
## Bug: [Short Description]

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Error Messages:**
Any console errors or error dialogs

**Environment:**
- OS: Windows 11
- Node: v20.x
- Electron: v34.x

**Screenshots:**
[If applicable]
```

---

## Final Sign-Off Checklist

Before declaring the build complete:

- [ ] All Phase checkpoints pass
- [ ] All keyboard shortcuts work
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No console errors in production build
- [ ] App doesn't crash under normal use
- [ ] Performance targets met
- [ ] All edge cases handled
- [ ] Documentation updated

---

*Document version: 1.0 | Last updated: 2025-01-14*
