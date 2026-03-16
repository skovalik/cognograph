# Playwright E2E Test Plan - Automated Manual Testing

**Goal:** Actually run the app and test workflows with mouse/keyboard/screenshots
**Method:** Playwright browser automation → Simulate real user
**Outcome:** Find bugs that code analysis can't catch

---

## What I Can Do With Playwright

**Available Actions:**
- ✅ Launch Electron app (`npm run dev`)
- ✅ Click buttons, links, menus
- ✅ Type text in inputs
- ✅ Drag and drop
- ✅ Keyboard shortcuts (Ctrl+S, Shift+C, etc.)
- ✅ Take screenshots at each step
- ✅ Compare visual output
- ✅ Check for console errors
- ✅ Verify DOM state

**This will find:**
- Layout bugs (like the modal positioning)
- Visual regressions
- Broken workflows
- Missing UI elements
- Console errors
- Rendering issues

---

## Test Workflows (20 scenarios)

### Workflow 1: Create Note, Connect, Chat
1. Launch app
2. Click "+ Add Node" → Note
3. Type content in note
4. Create conversation node
5. Drag from note → conversation (connect)
6. Click conversation → Open chat
7. VERIFY: Context badge shows "📎 1 context"
8. Type message → Send
9. VERIFY: AI response streams
10. Screenshot: Context working

### Workflow 2: All 10 Node Types
1. For each type in menu:
   - Create node
   - Screenshot
   - Verify renders correctly
   - No console errors

### Workflow 3: Modal Properties
1. Create node
2. Right-click → Properties (floating)
3. VERIFY: Modal appears as overlay
4. VERIFY: Doesn't push viewport
5. Drag modal → Verify moves
6. Resize modal → Verify resizes
7. Screenshot: Modal working

### Workflow 4: Orchestrator Pipeline
1. Create orchestrator node
2. Create 2 agent conversations
3. Connect agents to orchestrator
4. Configure pipeline
5. Click "Run"
6. VERIFY: Badge shows "● Running"
7. VERIFY: Status bar appears bottom-right
8. Screenshot: Orchestrator active

### Workflow 5-20: (More workflows...)
- Artifacts drag-drop
- Save/load workspace
- Undo/redo
- Keyboard shortcuts
- Glass effects toggle
- Search functionality
- Layers panel
- Bookmarks
- Extraction
- Templates (if UI exists)
- Agent mode
- Multi-select operations
- Connection properties
- Theme switching
- Context settings

---

## Estimated Time

**Setup:** 30min (Playwright config)
**Execution:** 2-3 hours (20 workflows)
**Bug Fixes:** 2-4 hours (for issues found)
**Total:** 5-7 hours

**Outcome:** Real 98-99% confidence from actual usage testing

---

## Should I Do This?

**Pros:**
- Find real bugs (like modal positioning)
- Screenshot evidence
- Automated (can re-run anytime)
- Comprehensive coverage

**Cons:**
- Time intensive (5-7 hours)
- Requires app to be running
- Some workflows may need API keys

**Recommendation:** YES - This is how you get to true 98-99%.
