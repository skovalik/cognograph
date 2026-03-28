# Domain 3: Initiation & Action

**Why Third:** ADHD initiation difficulty. The hard part is STARTING. Once started, momentum carries. Reduce friction to first action.

**Stefan's ND Needs:**
- Next step always obvious
- Minimal decisions before doing
- No dead ends
- Clear affordances

---

## Iter 61 — App Launch Experience

What happens when you open Cognograph?

**Expected flow:**
1. App launches
2. Last workspace loads (or new workspace)
3. Canvas visible immediately

**ND Check:**
- Any modal/dialog before canvas = friction
- "Choose workspace" prompt = decision before doing

**Recommendation (P1):** Auto-load last workspace. Skip "choose" dialog. Menu exists if they want different workspace.

---

## Iter 62 — First Action Clarity

New user, empty canvas. What do I do?

**From styleguide:** No onboarding spec visible.

**ND Check:**
- Blank canvas = paralysis
- "I don't know where to start"

**Reference check:**
- Figma: Blank, but toolbar is obvious
- Miro: Templates offered
- Notion: Templates + "Press / to start"

**Recommendation (P1):** One of:
1. Pre-populate with starter node (Conversation ready to go)
2. Floating hint: "Double-click to add a node" (then fade)
3. Pulsing "+" button that's impossible to miss

---

## Iter 63 — Node Creation Methods

How do you create a node?

**Expected methods:**
1. Toolbar buttons (one per type)
2. Right-click context menu
3. Keyboard shortcut
4. Double-click canvas (maybe?)

**From styleguide toolbar:** Icons for each node type visible.

**ND Check:**
- Multiple paths = good (different contexts)
- But PRIMARY path should be obvious

**Question:** Which method is fastest for Stefan's workflow?

**Recommendation (P2):** Measure most-used method. Optimize THAT one.

---

## Iter 64 — Toolbar Discoverability

From styleguide section K: Toolbar with node creation buttons.

**ND Check:**
- Buttons visible at all times ✅
- Icons distinguish types (color-coded) ✅
- No hidden menus required ✅

**Verdict:** ✅ Good. Nodes are one click away.

---

## Iter 65 — Keyboard Shortcuts

Are there shortcuts for common actions?

**Expected:**
- Cmd+N: New node (but which type?)
- Cmd+S: Save
- Cmd+Z: Undo
- Delete: Delete selected

**ND Check:**
- Shortcuts reduce initiation friction (no mouse travel)
- But shortcuts are learned, not discovered

**Recommendation (P2):** Shortcuts should be shown in tooltips on toolbar buttons.

---

## Iter 66 — Command Palette

Does Cognograph have a command palette (Cmd+K)?

**Reference check:**
- Linear: Cmd+K for everything
- Raycast: Same philosophy
- Notion: Cmd+K for search + commands
- Figma: Cmd+/ or Cmd+K

**ND Check:**
- Command palette = type what you want, don't hunt for it
- Reduces "where is that option?" anxiety

**Recommendation (P1):** Add command palette. Type to search actions, nodes, settings.

---

## Iter 67 — Chat Initiation

How do you start chatting with a Conversation node?

**Expected:**
1. Double-click node → Opens chat panel
2. Chat panel has input at bottom
3. Type and send

**ND Check:**
- Double-click is standard for "open" ✅
- But is the input immediately focused?

**Recommendation (P1):** When chat panel opens, auto-focus input. Don't make user click input box.

---

## Iter 68 — Context Addition

How do you add context (connect a node)?

**From Iter 25:** Drag from handle to handle.

**ND Check:**
- Drag is intuitive for spatial thinkers ✅
- But handle must be visible/findable

**Question:** Are handles always visible, or only on hover?

**Recommendation (P2):** Handles should be subtly visible at all times, not just hover. "I can connect here" affordance.

---

## Iter 69 — Quick Actions

Are there quick actions on nodes?

**Reference check:**
- Figma: Right-click menu, or hover icons
- Notion: ••• menu on hover
- Miro: Toolbar appears on selection

**ND Check:**
- Quick actions = don't need to open panel for common things
- But too many = overwhelming

**Question:** What actions should be quick vs in properties panel?

**Recommendation (P2):** Node hover should show: Edit, Delete, Duplicate. Everything else in panel.

---

## Iter 70 — Property Editing

How do you edit node properties?

**From codebase:** PropertiesPanel opens for selected node.

**ND Check:**
- Selection → Panel auto-opens? Or click to open?
- Auto-open = less friction
- Manual open = cleaner canvas

**Question:** Current behavior?

**Recommendation:** Selection should auto-open properties panel (if sidebar mode). Reduces "how do I edit this?" question.

---

## Iter 71 — Inline Editing

Can you edit node title directly on canvas?

**From components:** EditableTitle.tsx exists.

**ND Check:**
- Inline editing = immediate action, no panel needed ✅
- Good for quick renames

**Verdict:** ✅ Good pattern.

---

## Iter 72 — Deletion Flow

How do you delete a node?

**Expected:**
1. Select node
2. Press Delete/Backspace
3. Node deleted

**Or:**
1. Right-click
2. Delete option
3. Confirm? → Node deleted

**ND Check:**
- Confirmation dialogs add friction
- But accidental deletion = anxiety

**Recommendation (P1):** No confirmation dialog. BUT: undo must work perfectly. Feedback toast: "Deleted 'X' — Undo"

---

## Iter 73 — Edge Deletion

How do you delete an edge?

**Expected:**
- Select edge
- Press Delete

**ND Check:**
- Same pattern as node deletion ✅
- Consistency reduces learning

**Verdict:** ✅ If consistent with node deletion.

---

## Iter 74 — Undo as Safety Net

Undo enables "just try it" mentality.

**ND Check:**
- Without undo: fear of making mistakes → hesitation → initiation failure
- With undo: "I can always revert" → freedom to act ✅

**Question:** How robust is undo? Single action or multiple?

**Recommendation (P0):** Undo must support multiple steps. At minimum 20 actions.

---

## Iter 75 — Message Editing

Can you edit a sent message?

**Reference check:**
- Slack: Edit own messages
- Discord: Same
- Claude.ai: No editing

**ND Check:**
- Typo anxiety: "I sent wrong thing" → can I fix it?
- For AI chat, editing changes context → complicates

**Verdict:** Not critical. Nice-to-have at best.

---

## Iter 76 — Message Regeneration

Can you regenerate AI response?

**Reference check:**
- Claude.ai: Retry button
- ChatGPT: Regenerate button

**ND Check:**
- "Response wasn't what I wanted" → try again
- Reduces "stuck" feeling

**Recommendation (P2):** Add regenerate button on assistant messages.

---

## Iter 77 — Branch Conversations

Can you fork a conversation at any point?

**From VISION.md:** "Branching — fork conversations at any point"

**ND Check:**
- "What if I tried a different approach?"
- Branching enables experimentation without losing original ✅

**Question:** Is branching implemented?

**Recommendation (P1):** Verify branching exists. If not, high priority.

---

## Iter 78 — Project Quick-Add

How do you add a node to a project?

**From Iter 12:** Drag node onto project? Or connect?

**ND Check:**
- "Move this into that group" should be obvious
- Drag-to-group is intuitive

**Recommendation (P2):** Drag node onto project = add to project. Visual feedback during drag-over.

---

## Iter 79 — Context Menu

Right-click on node shows what?

**Expected:**
- Edit
- Delete
- Duplicate
- Add to project...
- Disconnect all
- etc.

**ND Check:**
- Context menu = discoverable options
- But shouldn't be REQUIRED (toolbar/shortcuts exist)

**Recommendation:** Context menu should mirror toolbar/shortcuts. Redundant paths.

---

## Iter 80 — Panel Toggle Ease

How do you show/hide panels?

**From toolbar:** Toggle buttons for Properties (layers), Chat (maximize).

**ND Check:**
- One click to toggle ✅
- Visual state shows panel open/closed ✅

**Verdict:** ✅ Standard.

---

## Iter 81 — Settings Access

How do you get to settings?

**From toolbar:** ⚙ icon.

**ND Check:**
- Settings shouldn't be needed often
- But when needed, should be findable

**Verdict:** ✅ Standard location (toolbar icon).

---

## Iter 82 — Search Access

How do you search?

**Expected:** Cmd+F or search icon in sidebar.

**ND Check:**
- Search is escape hatch when spatial memory fails
- Should be fast to access

**Recommendation (P1):** Cmd+F or Cmd+K opens search. No hunting required.

---

## Iter 83 — Extraction Initiation

How do you start extracting from a conversation?

**From codebase:** Extraction buttons on conversation node.

**ND Check:**
- Extraction is a key feature
- Should be obvious, not hidden

**Recommendation (P2):** Extraction buttons should be visible in node footer, not just in panel.

---

## Iter 84 — New Workspace

How do you create a new workspace?

**Expected:** File menu or Cmd+Shift+N.

**ND Check:**
- New workspace = fresh start
- Should be quick but intentional (not accidental)

**Verdict:** Standard file pattern.

---

## Iter 85 — Open Workspace

How do you open a different workspace?

**Expected:** File > Open or Cmd+O → file picker.

**ND Check:**
- Standard pattern ✅
- Recent workspaces list would help

**Recommendation (P2):** Recent workspaces in File menu or on splash screen.

---

## Iter 86 — Action Affordances

Every interactive element should look interactive.

**From styleguide:**
- Buttons have distinct styling ✅
- Inputs have borders ✅
- Handles have size/glow ✅

**ND Check:**
- If it's clickable, it should LOOK clickable
- Flat design sometimes hides affordances

**Recommendation:** Audit for any interactive elements that look static.

---

## Iter 87 — Dead Ends

Are there any states where you're stuck with no action?

**Potential dead ends:**
- Error with no recovery path
- Empty state with no guidance
- Modal with no close button

**ND Check:**
- Dead ends = panic
- Every screen needs an exit or action

**Recommendation (P1):** Audit all screens for exit paths.

---

## Iter 88 — Progressive Disclosure

Complex features should be hidden until needed.

**Reference check:**
- Notion: Slash commands reveal features progressively
- Linear: Clean default, power features in menus

**ND Check:**
- Too many options visible = overwhelm
- Options appear when relevant = manageable

**Question:** Is Properties Panel overwhelming? Too many fields visible?

**Recommendation (P2):** Consider collapsing advanced properties by default.

---

## Iter 89 — Default Values

Do new nodes have sensible defaults?

**Expected:**
- Conversation: Default model set
- Task: Status = "To Do", Priority = "Medium"
- etc.

**ND Check:**
- Good defaults = less to configure
- "It just works" out of the box

**Recommendation (P1):** Audit all node types for sensible defaults.

---

## Iter 90 — Initiation Summary

### What's Working (Validations)
- ✅ Toolbar with visible node creation buttons
- ✅ Inline title editing
- ✅ Toggle buttons for panels
- ✅ Settings in expected location

### Needs Verification
- [ ] Auto-load last workspace on launch
- [ ] Chat input auto-focus on panel open
- [ ] Handles visible at all times (not just hover)
- [ ] Branching conversations implemented
- [ ] Undo supports multiple steps

### Recommendations
| Priority | Issue | Recommendation |
|----------|-------|----------------|
| P0 | Undo robustness | Support 20+ undo steps |
| P1 | First action clarity | Starter node or hint for empty canvas |
| P1 | Command palette | Cmd+K for search + actions |
| P1 | Chat input focus | Auto-focus when chat panel opens |
| P1 | Delete without confirm | No dialog, but toast with Undo |
| P1 | Branching verification | Confirm feature exists |
| P1 | Dead end audit | Every screen needs exit/action |
| P1 | Sensible defaults | Audit all node type defaults |
| P1 | Search shortcut | Cmd+F or Cmd+K |
| P2 | Shortcuts in tooltips | Show keyboard shortcut on hover |
| P2 | Handles always visible | Subtle but present |
| P2 | Quick actions on hover | Edit, Delete, Duplicate |
| P2 | Regenerate response | Button on assistant messages |
| P2 | Recent workspaces | In File menu or splash |
| P2 | Collapse advanced properties | Reduce initial overwhelm |

---

## Stefan's Notes
*Space for Stefan to add context, corrections, or redirects*

-

---

## Checkpoint: Initiation & Action Complete

**Iterations:** 61-90
**Findings:** 4 validations, 5 verifications needed, 15 recommendations
**Critical (P0):** 1 (undo robustness)
**High (P1):** 9
**Medium (P2):** 6

**Circuit Breaker Check:** High recommendation count suggests this is a rich area. Findings varied and substantive. Continue.

**Ready to proceed to Domain 4: Consistency?**
