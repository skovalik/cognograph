# Deep Loop: Iterations 251-350

**Focus Areas:**
- Edge cases and error states
- Interaction details
- ND-specific refinements
- Performance considerations
- Onboarding and learnability
- Advanced features depth
- Cross-feature interactions

---

## Section A: Edge Cases & Error States (Iterations 251-270)

### Iter 251 — Edge Case: Circular Project Membership

**Scenario:** User tries to drag Project A into Project B, but Project B is already inside Project A.

**Expected behavior:**
- Block the action
- Show clear error: "Can't create circular membership"
- No silent failure

**ND Check:**
- Circular logic is confusing
- Clear feedback prevents "why isn't this working?" anxiety

**Recommendation (P1):** Validate membership changes, block circular references with clear message.

---

### Iter 252 — Edge Case: Orphaned Nodes on Project Delete

**Scenario:** User deletes a project containing 20 nodes.

**Options:**
A) Delete all children (destructive)
B) Promote children to canvas root (safe)
C) Ask user what to do

**ND Check:**
- Mass deletion = anxiety
- Asking every time = friction
- Safe default with option to delete

**Recommendation (P1):**
- Default: Promote children to root ("Nodes moved to canvas")
- Option in confirmation: "Also delete X contained nodes"
- Undo restores everything

---

### Iter 253 — Edge Case: Moving Node Between Projects

**Scenario:** Node is in Project A. User drags it into Project B.

**Expected:**
- Node leaves Project A
- Node joins Project B
- Both projects update visually
- Outline reflects change immediately

**Edge case:** What if node is in View tab when moved on canvas?
- View should update in real-time

**Recommendation (P2):** Project membership changes sync across all views instantly.

---

### Iter 254 — Edge Case: Deleting Node While in View

**Scenario:** User is viewing Project in Table view. Deletes a row.

**Expected:**
- Row disappears from table
- Node deleted from canvas (if visible)
- Undo available

**Edge case:** What if that node had edges?
- Edges also deleted
- Toast mentions: "Node and 3 connections deleted"

**Recommendation (P2):** Deletion feedback includes edge count.

---

### Iter 255 — Edge Case: Custom Type Deletion

**Scenario:** User deletes custom type "Bug Report" but 15 nodes use it.

**Options:**
A) Block deletion until no nodes use it
B) Convert nodes to generic "Note" type
C) Ask user to choose replacement type

**ND Check:**
- Blocking = frustrating
- Silent conversion = data confusion
- Asking = clear but friction

**Recommendation (P1):**
- Warn: "15 nodes use this type"
- Require choosing replacement type
- Preserve all data, just change type

---

### Iter 256 — Edge Case: Conflicting Keyboard Shortcuts

**Scenario:** User on Mac vs Windows. Cmd vs Ctrl.

**Expected:**
- Cmd on Mac, Ctrl on Windows
- Consistent across all shortcuts
- Help/reference shows correct modifier

**Edge case:** What about custom keyboards/remapping?

**Recommendation (P2):** Detect OS, show appropriate modifier. Future: allow shortcut customization.

---

### Iter 257 — Edge Case: Very Long Node Titles

**Scenario:** User pastes 500-character title.

**Expected:**
- Title truncates in node card
- Full title in properties panel
- Tooltip shows full title on hover
- No layout breaking

**Recommendation (P2):** Max display length with ellipsis. Full text always accessible.

---

### Iter 258 — Edge Case: Very Many Nodes

**Scenario:** Canvas has 500+ nodes.

**Performance concerns:**
- Render performance
- Search performance
- Minimap clarity
- Outline panel scrolling

**Recommendations (P1):**
- Virtualize outline panel list
- Virtualize view tables
- Canvas: only render visible nodes (React Flow handles this)
- Search: debounce and index

---

### Iter 259 — Edge Case: Very Deep Nesting

**Scenario:** Project → Sub-project → Sub-sub-project → ... 10 levels deep.

**UI concerns:**
- Outline indentation goes off screen
- Breadcrumb gets very long
- Mental model breaks down

**Recommendation (P2):**
- Max nesting depth: 5 levels (warn at 4)
- Breadcrumb truncates middle: "Root > ... > Current"
- Outline: collapse deep branches by default

---

### Iter 260 — Edge Case: Offline/Connection Loss

**Scenario:** User is working, connection drops.

**For local-first:**
- Should continue working
- Save to local storage
- Sync when reconnected

**For cloud-first:**
- Show offline indicator
- Queue changes
- Warn before destructive actions

**Recommendation (P2):** Design offline indicator. Queue changes. Don't lose work.

---

### Iter 261 — Edge Case: Concurrent Edits (Future)

**Scenario:** Two users edit same node.

**Not in current scope, but note:**
- Need conflict resolution strategy
- Last-write-wins vs merge
- Operational transforms?

**Note for future:** Flag this as architecture consideration.

---

### Iter 262 — Error State: API Failure

**Scenario:** Claude API call fails.

**Expected:**
- Clear error message in chat
- Node doesn't show "streaming" forever
- Retry option
- Error details available (for debugging)

**ND Check:**
- Stuck states = anxiety
- Clear recovery = confidence

**Recommendation (P1):** API errors show: what failed + retry button + details expandable.

---

### Iter 263 — Error State: Save Failure

**Scenario:** Auto-save fails.

**Expected:**
- Status bar shows error (not just "Unsaved")
- Toast with retry option
- Data not lost (still in memory)
- Manual save option

**Recommendation (P1):** Save errors are prominent. Never silent data loss.

---

### Iter 264 — Error State: Invalid Import

**Scenario:** User imports corrupted workspace file.

**Expected:**
- Validation before import
- Clear error: "File appears corrupted"
- Don't partially import
- Suggest: "Try opening in text editor to inspect"

**Recommendation (P2):** Import validation with clear failure messages.

---

### Iter 265 — Error State: Context Too Large

**Scenario:** User connects so many nodes that context exceeds Claude's limit.

**Expected:**
- Warning before sending
- Show token count
- Suggest: "Remove some context or use summarization"

**Reference:** Token meter in feedback specs.

**Recommendation (P1):** Pre-flight context size check with clear warning.

---

### Iter 266 — Error State: Custom Field Validation

**Scenario:** User enters text in a Number field.

**Expected:**
- Inline validation (red border)
- Error message below field
- Don't save invalid value
- Don't block other fields

**Recommendation (P2):** Standard form validation patterns for custom fields.

---

### Iter 267 — Error State: Duplicate Node Title

**Is this even an error?**

**Decision:** Probably not. Multiple nodes can have same title.

**But:** Search should handle duplicates gracefully (show all matches).

**Verdict:** Allow duplicates. Not an error state.

---

### Iter 268 — Warning State: Unsaved Changes on Close

**Scenario:** User closes app with unsaved changes.

**Expected:**
- Confirmation dialog
- "Save" / "Don't Save" / "Cancel"
- Keyboard: Enter = Save, Esc = Cancel

**ND Check:**
- This is standard and expected
- Don't auto-save on close (might be accidental)

**Recommendation (P2):** Standard unsaved changes dialog.

---

### Iter 269 — Warning State: Large Paste

**Scenario:** User pastes 50KB of text into a note.

**Options:**
A) Accept silently (might lag)
B) Warn and confirm
C) Truncate with warning

**Recommendation (P3):** Accept but warn if > 10KB. Don't silently truncate.

---

### Iter 270 — Edge Cases Summary

**Key patterns:**
- Always provide clear feedback on errors
- Never silent data loss
- Default to safe/reversible actions
- Warn before destructive actions but don't over-ask
- Handle scale (many nodes, deep nesting, long text)
- Validate inputs with inline feedback

---

## Section B: Interaction Micro-Details (Iterations 271-290)

### Iter 271 — Drag Initiation Threshold

**Problem:** Accidental drags when trying to click.

**Solution:** Drag only starts after 3-5px movement.

**Reference:** Standard UX pattern.

**Recommendation (P2):** 4px drag threshold before drag mode activates.

---

### Iter 272 — Drag Preview Opacity

**During drag, what does the dragged item look like?**

**Options:**
A) Full opacity (hard to see drop target)
B) 50% opacity (ghost)
C) Outline only

**Recommendation (P2):** 60% opacity ghost. Shows content but doesn't obscure target.

---

### Iter 273 — Drop Target Highlighting

**How does user know where they can drop?**

**Expected:**
- Valid drop targets highlight (border glow)
- Invalid targets show "no-drop" cursor
- Project nodes glow when draggable node hovers over

**Recommendation (P1):** Clear drop target feedback. Projects glow on valid hover.

---

### Iter 274 — Multi-Select Drag

**Scenario:** User selects 5 nodes, drags them.

**Expected:**
- All 5 move together
- Relative positions preserved
- Single drop action
- Undo restores all 5

**Edge case:** Dragging into project adds all 5.

**Recommendation (P2):** Multi-select drag maintains relative positions.

---

### Iter 275 — Resize Handle Behavior

**For project nodes that can resize:**

**Expected:**
- Handles on corners and edges
- Cursor changes to resize cursor
- Minimum size enforced
- Snap to grid? (Optional)

**Recommendation (P2):** Corner handles for resize. Minimum 100x100px.

---

### Iter 276 — Double-Click Timing

**How fast must clicks be to count as double-click?**

**Standard:** 300-500ms between clicks.

**Problem:** Too fast = hard to double-click. Too slow = delays single-click response.

**Recommendation (P3):** Use system default (typically 400ms).

---

### Iter 277 — Right-Click vs Long-Press

**On touch devices, right-click = long-press.**

**Expected:**
- 500ms hold = context menu
- Visual feedback during hold (ring animation?)
- Cancel if finger moves

**Recommendation (P3):** Long-press for context menu on touch. Visual feedback.

---

### Iter 278 — Scroll Behavior in Panels

**Expected:**
- Smooth scrolling
- Scroll position preserved when switching away and back
- Scroll to reveal when keyboard navigating

**ND Check:**
- Lost scroll position = disorientation

**Recommendation (P2):** Preserve scroll position per panel.

---

### Iter 279 — Auto-Scroll During Drag

**Scenario:** Dragging node toward canvas edge.

**Expected:**
- Canvas auto-scrolls in drag direction
- Speed proportional to how close to edge
- Smooth, not jerky

**Recommendation (P2):** Edge auto-scroll during drag. 50px trigger zone.

---

### Iter 280 — Zoom Gestures

**Expected:**
- Scroll wheel: zoom (with Ctrl/Cmd?) or pan?
- Pinch: zoom on trackpad/touch
- Double-click canvas: zoom in? Or create node?

**Decision needed:** Scroll wheel behavior.

**Recommendation (P1):**
- Scroll wheel = pan (natural)
- Ctrl+scroll = zoom
- Pinch = zoom
- Double-click canvas = create node (per Decision 4 hint behavior)

---

### Iter 281 — Pan Gestures

**Expected:**
- Click and drag canvas background = pan
- Two-finger drag on trackpad = pan
- Middle-mouse drag = pan

**Recommendation (P2):** All standard pan gestures supported.

---

### Iter 282 — Selection Rectangle

**Box select behavior:**

**Expected:**
- Click and drag on canvas background = selection rectangle
- Nodes touched by rectangle get selected
- Shift+drag = add to existing selection

**Edge case:** Rectangle behavior options:
A) Select if ANY overlap (generous)
B) Select if fully contained (strict)

**Recommendation (P2):** Default: any overlap. Strict mode if Alt held.

---

### Iter 283 — Keyboard Focus Ring

**Focus ring appearance:**

**From styleguide:** 2px solid accent, 2px offset.

**Additional detail:**
- High contrast against any background
- Follows element shape
- Animates smoothly when focus moves

**Recommendation (P2):** Focus ring should be visible on all backgrounds (consider dual-color ring).

---

### Iter 284 — Tab Order Logic

**For canvas with nodes:**

**Options:**
A) Tab in creation order
B) Tab in z-order (front to back)
C) Tab in spatial order (left-to-right, top-to-bottom)
D) Tab in outline order

**ND Check:**
- Spatial order matches visual scanning
- But might jump around unexpectedly

**Recommendation (P1):** Tab follows outline order (matches z-order, predictable).

---

### Iter 285 — Arrow Key Navigation on Canvas

**When node is focused:**

**Expected:**
- Arrow keys move focus to nearest node in that direction
- If no node in that direction, stay put
- Shift+arrows = select multiple

**Algorithm:** Find nearest node within 45-degree cone in arrow direction.

**Recommendation (P1):** Spatial arrow navigation between nodes.

---

### Iter 286 — Escape Key Cascade

**Escape should close/cancel in order:**

1. If typing in input: blur input (don't close panel)
2. If dropdown open: close dropdown
3. If modal open: close modal
4. If node selected: deselect
5. If panel open: close panel

**ND Check:**
- Predictable escape cascade reduces anxiety
- "Escape gets me out" should always work

**Recommendation (P1):** Define escape cascade. Test all contexts.

---

### Iter 287 — Enter Key Context

**Enter should do the "obvious" action:**

- Input field: submit (if single line) or newline (if multi-line)
- Button focused: activate
- List item focused: select/open
- Node focused: open (same as double-click)
- Dropdown item: select

**Recommendation (P2):** Document enter behavior per context. Be consistent.

---

### Iter 288 — Tooltip Timing

**When do tooltips appear?**

**Expected:**
- Delay: 500ms hover before show
- Duration: stay while hovering
- Disappear: immediately on mouse leave
- Position: above element (or smart positioning if near edge)

**Recommendation (P2):** 500ms delay, smart positioning, immediate dismiss.

---

### Iter 289 — Context Menu Positioning

**Where does context menu appear?**

**Expected:**
- At cursor position
- Adjust if would overflow viewport
- Keyboard trigger (Shift+F10): appears at element position

**Recommendation (P2):** Smart positioning, keyboard trigger support.

---

### Iter 290 — Interaction Details Summary

**Key patterns:**
- Drag threshold to prevent accidents
- Clear drop target feedback
- Preserve state (scroll, selection)
- Auto-scroll during drag
- Consistent keyboard navigation model
- Escape cascade defined
- Tooltips with appropriate delay

---

## Section C: ND-Specific Refinements (Iterations 291-305)

### Iter 291 — ND: Reducing Decision Points

**Every decision = friction for ADHD.**

**Audit decisions currently required:**
- Node type when creating ✓ (has default)
- Save location ✗ (auto-save handles)
- Color ✓ (has default per type)
- What to do next...

**The "what to do next" problem:**
- After creating node, user might freeze
- After AI response, what now?

**Recommendation (P1):** After AI response, suggest next actions: "Extract" | "Continue" | "New conversation"

---

### Iter 292 — ND: Completion Signals

**ADHD needs clear "done" signals.**

**Opportunities:**
- AI response: Clear "finished" state (no more loading)
- Task completion: Celebratory micro-animation
- Session end: "All changes saved" confirmation

**Recommendation (P1):** Task completion gets satisfying checkmark animation + sound (optional).

---

### Iter 293 — ND: Progress Indicators

**For longer operations:**

**Expected:**
- AI response: Streaming text IS the progress
- Export: Progress bar
- Import: Progress bar
- Search: Instant or show searching indicator

**ND Check:**
- Unknown duration = anxiety
- Visual progress = patience

**Recommendation (P2):** Any operation > 1s needs progress indicator.

---

### Iter 294 — ND: Reducing Visual Noise

**Too much on screen = overwhelm.**

**Strategies:**
- Hide members in canvas (view tab handles them)
- Collapse properties panel sections
- Minimap can be hidden
- Outline panel can be collapsed
- "Focus mode"?

**Idea: Focus Mode**
- Hides all panels
- Centers on selected node
- Dims other nodes
- Hotkey: F or Cmd+\

**Recommendation (P2):** Implement focus mode for deep work.

---

### Iter 295 — ND: Consistent Visual Weight

**Elements should have consistent importance signals.**

**Visual weight hierarchy:**
1. Active/selected node (brightest, ring)
2. Streaming node (animated)
3. Normal nodes
4. Disabled/muted nodes
5. UI chrome (panels, toolbar) = lowest weight

**ND Check:**
- Clear hierarchy guides attention
- Everything same weight = can't focus

**Recommendation (P2):** Audit visual weight. Canvas content > UI chrome.

---

### Iter 296 — ND: Reducing Context Switches

**Context switching is expensive for ADHD.**

**Current context switches:**
- Canvas ↔ Properties panel
- Canvas ↔ Chat panel
- Canvas ↔ Settings modal

**Mitigation:**
- Panels slide in (don't replace canvas)
- Keep canvas visible while editing properties
- Preview changes live

**Recommendation (P2):** Never fully obscure canvas for routine operations.

---

### Iter 297 — ND: Time Boxing Support

**ADHD users benefit from time limits.**

**Feature idea: Session Timer**
- Optional countdown timer in status bar
- "Focus for 25 minutes"
- Gentle notification when done
- Not mandatory

**Recommendation (P3):** Optional pomodoro-style timer in status bar.

---

### Iter 298 — ND: Undo as Anxiety Reducer

**Robust undo = confidence to act.**

**Undo requirements:**
- Support 50+ steps (not just 20)
- Undo across all actions (not just some)
- Undo indicator shows "X undoable actions"
- Keyboard: Cmd+Z
- Redo: Cmd+Shift+Z or Cmd+Y

**ND Check:**
- "I can always undo" = freedom to try things

**Recommendation (P0):** Undo is comprehensive. 50+ steps. All actions.

---

### Iter 299 — ND: Default Actions

**Reduce choices by having good defaults.**

**Current defaults audit:**
- New node type: What's default? Should be Conversation
- New node position: Near last action or center of view
- New project: Empty or with starter node?
- Properties: Primary visible, secondary collapsed

**Recommendation (P1):** Review all defaults. Optimize for "just start working."

---

### Iter 300 — ND: Quick Capture

**Idea: Rapid capture mode**

**Problem:** ADHD brains have fleeting thoughts. Friction = lost thought.

**Solution: Quick Capture**
- Global hotkey (even when app not focused)
- Opens minimal input
- Creates Note node with typed text
- Closes immediately
- Sort later

**Recommendation (P2):** Quick capture hotkey. Minimal friction note creation.

---

### Iter 301 — ND: Visual Bookmarks

**Problem:** "Where was I working?"

**Solution: Visual bookmark/flag**
- Mark a node as "current focus"
- Distinct visual indicator (flag icon? star?)
- Hotkey to jump to flagged node
- Only one flag at a time (or few)

**Recommendation (P2):** "Flag as focus" feature. Jump-to-flag hotkey.

---

### Iter 302 — ND: Session Continuity

**On app open, restore state:**

- Same zoom level
- Same scroll position
- Same selected node
- Same open panels
- Same view configuration

**ND Check:**
- "Where was I?" answered instantly
- Zero re-orientation needed

**Recommendation (P1):** Full session state restoration on open.

---

### Iter 303 — ND: Reducing Notification Fatigue

**Too many notifications = ignored.**

**Principles:**
- Toast only for actionable info
- Errors: always toast
- Success: brief toast (2s) or none
- Progress: inline, not toast
- Batch notifications when possible

**Recommendation (P2):** Audit notification frequency. Less is more.

---

### Iter 304 — ND: Predictable Animations

**Animations should be predictable.**

**Rules:**
- Same action = same animation
- Consistent duration per action type
- No surprise animations
- Reduced motion respected

**ND Check:**
- Unpredictable motion = startling
- Predictable = comfortable

**Verdict:** ✅ Animation system is already principled.

---

### Iter 305 — ND Refinements Summary

**Key additions:**
- Suggested next actions after AI response
- Task completion celebration
- Focus mode for deep work
- Quick capture hotkey
- Visual bookmark/flag
- Full session state restoration
- Comprehensive undo (50+ steps)

---

## Section D: Performance & Scale (Iterations 306-315)

### Iter 306 — Canvas Rendering Performance

**Target:** 60fps with 500 nodes visible.

**Strategies:**
- React Flow handles virtualization
- Only render nodes in viewport + buffer
- Simplify off-screen nodes (no animations)
- GPU acceleration for transforms

**Recommendation (P1):** Verify React Flow virtualization. Test with 500+ nodes.

---

### Iter 307 — Search Performance

**Target:** < 100ms for searches in 1000-node workspace.

**Strategies:**
- Index node titles and content
- Debounce search input (150ms)
- Highlight matches without re-render
- Consider fuzzy search library (Fuse.js)

**Recommendation (P2):** Implement search indexing. Test with large workspaces.

---

### Iter 308 — Save Performance

**Target:** Auto-save doesn't cause UI jank.

**Strategies:**
- Save in background (web worker or async)
- Debounce saves (500ms after last change)
- Incremental save (only changed nodes)?
- Show save status but don't block UI

**Recommendation (P2):** Background save. Never block UI.

---

### Iter 309 — Load Performance

**Target:** Open 500-node workspace in < 2s.

**Strategies:**
- Lazy load node content (titles first, content on demand)
- Progressive rendering (show canvas, then populate)
- Skeleton loading states
- Consider workspace chunking for very large

**Recommendation (P2):** Progressive load with skeleton states.

---

### Iter 310 — Memory Management

**Concern:** Large workspaces with rich content.

**Strategies:**
- Unload off-screen node details
- Limit undo history size (50 actions, not unlimited)
- Compress saved data
- Monitor memory usage

**Recommendation (P2):** Set reasonable limits. Monitor in dev tools.

---

### Iter 311 — View Tab Performance

**Table with 500 rows:**

**Strategies:**
- Virtual scrolling (only render visible rows)
- Pagination as fallback option
- Column virtualization (if many columns)

**Recommendation (P2):** Virtual scrolling for table view.

---

### Iter 312 — Animation Performance

**Ensure animations don't cause jank:**

**Strategies:**
- Use CSS transforms (GPU accelerated)
- Avoid animating layout properties (width, height)
- Use will-change sparingly
- Disable animations if frame drops detected

**Verdict:** ✅ Animation specs already use transforms.

---

### Iter 313 — AI Response Performance

**Streaming performance:**

**Already handled by:**
- Streaming API (no wait for full response)
- Incremental text append
- Virtualize chat history if very long

**Recommendation (P3):** Virtualize chat history for conversations > 100 messages.

---

### Iter 314 — Outline Panel Performance

**With 500 nodes in hierarchy:**

**Strategies:**
- Virtual list (react-window or similar)
- Collapse branches by default
- Lazy expand (only load children when expanded)

**Recommendation (P2):** Virtual list for outline panel.

---

### Iter 315 — Performance Summary

**Key performance targets:**
- 60fps canvas with 500 nodes
- <100ms search in 1000 nodes
- <2s load for 500-node workspace
- No UI jank during save
- Virtual scrolling for all large lists

---

## Section E: Onboarding & Learnability (Iterations 316-330)

### Iter 316 — First Launch Experience

**What happens on very first launch?**

**Options:**
A) Blank canvas (current: Decision 4 = hint)
B) Interactive tutorial
C) Sample workspace
D) Video tour

**ND Check:**
- Tutorials feel like homework
- Sample workspace is explorable
- Hint + sample might be best

**Recommendation (P1):**
- First launch: Offer "Start blank" or "Open sample workspace"
- Sample shows key concepts (conversations, connections, project)
- Hint appears if blank chosen

---

### Iter 317 — Sample Workspace Design

**What's in the sample?**

**Contents:**
1. A Conversation node with sample chat
2. A Note node connected to it
3. A Project node containing a Task
4. An Action node showing automation
5. Edges demonstrating context flow

**Annotations:** Floating labels explaining each element?

**Recommendation (P2):** Sample workspace demonstrates all node types + core mechanics.

---

### Iter 318 — Progressive Feature Discovery

**Don't show everything at once.**

**Levels:**
1. **Basic:** Conversations, Notes, Connections
2. **Intermediate:** Projects, Tasks, Properties
3. **Advanced:** Actions, Custom types, Views

**How to reveal:**
- Features available but not promoted
- "Did you know?" hints occasionally
- Help content organized by level

**Recommendation (P2):** Organize help/docs by complexity level.

---

### Iter 319 — Contextual Help

**Help where you need it:**

**Examples:**
- Empty project: "Projects contain nodes. Drag nodes here."
- First connection: "Connections share context with AI."
- Properties panel: "?" icons next to complex fields

**Recommendation (P2):** Contextual hints at key learning moments.

---

### Iter 320 — Keyboard Shortcut Learning

**How do users learn shortcuts?**

**Strategies:**
- Show in tooltips: "Create Note (N)"
- Command palette shows shortcuts
- Help → Keyboard Shortcuts reference
- "Pro tip" occasional hints

**Recommendation (P1):** Shortcuts visible in tooltips and command palette.

---

### Iter 321 — What's New on Update

**After app updates:**

**Expected:**
- Brief "What's New" overlay
- Highlights 2-3 key changes
- Link to full changelog
- "Don't show again" option

**ND Check:**
- Keep it brief
- Make skippable

**Recommendation (P3):** Optional What's New on update. Brief and dismissable.

---

### Iter 322 — Error Recovery Guidance

**When things go wrong, help user recover:**

**Examples:**
- API error: "Try again" button + "Check API key in Settings"
- Import failed: "Common causes: corrupted file, wrong format"
- Save failed: "Check disk space. Try Save As to new location."

**Recommendation (P1):** All errors include recovery guidance.

---

### Iter 323 — Feature Hints Timing

**When to show hints?**

**Rules:**
- First time user encounters context
- Not every time (track "seen" state)
- Dismissable and don't return
- Limited per session (max 2?)

**ND Check:**
- Too many hints = nagging
- Right hints = helpful

**Recommendation (P2):** Hint system with "seen" tracking. Max 2 per session.

---

### Iter 324 — Documentation Structure

**For help docs / wiki:**

**Structure:**
1. Getting Started (5 min read)
2. Core Concepts (Nodes, Edges, Context)
3. Feature Guides (Projects, Views, Actions)
4. Reference (Shortcuts, Settings)
5. Troubleshooting
6. FAQ

**Recommendation (P3):** Documentation follows this structure.

---

### Iter 325 — In-App vs External Docs

**Where does help live?**

**Options:**
A) All in-app (built into settings/help panel)
B) All external (website/wiki)
C) Hybrid (basics in-app, deep dives external)

**Recommendation (P2):**
- Keyboard shortcuts: in-app
- Core concepts: in-app (brief)
- Deep guides: external link
- Troubleshooting: external

---

### Iter 326 — Search Help Content

**Can you search within help?**

**Expected:**
- Command palette searches help topics
- "How do I..." queries
- Links to relevant section

**Recommendation (P2):** Command palette includes help search.

---

### Iter 327 — Video vs Text Learning

**Some users prefer video.**

**Recommendation (P3):**
- Short videos (< 2 min) for key concepts
- Embedded in help or linked
- Text alternative always available

---

### Iter 328 — Feedback Mechanism

**How do users report issues or suggest features?**

**Expected:**
- Help → Send Feedback
- Bug report template
- Feature request template
- Status page link

**Recommendation (P3):** Feedback mechanism in Help menu.

---

### Iter 329 — Accessibility Onboarding

**For screen reader users (future):**

**Note:** Current scope excludes screen readers, but note:
- Need alternative onboarding path
- Audio descriptions
- Keyboard-only tutorial

**Flag for future:** Accessibility-specific onboarding.

---

### Iter 330 — Onboarding Summary

**Key onboarding elements:**
- First launch: blank + hint OR sample workspace
- Sample workspace demonstrates all concepts
- Shortcuts in tooltips and command palette
- Contextual hints (limited, dismissable)
- Errors include recovery guidance
- Documentation: in-app basics, external deep dives

---

## Section F: Advanced Feature Depth (Iterations 331-345)

### Iter 331 — Action Node Deep Dive

**What can Actions do?**

**From original design:**
- Trigger type (manual, scheduled, event-based)
- Conditions
- Steps

**Questions:**
- What events can trigger? (Node created, message received, etc.)
- What steps are available? (Create node, send message, API call?)
- How is this configured?

**Recommendation (P1):** Define action trigger types and available steps.

---

### Iter 332 — Action: Trigger Types

**Triggers:**
1. **Manual** — User clicks "Run"
2. **Schedule** — Cron-like (every hour, daily)
3. **Event: Node Created** — When specific type created
4. **Event: Message Received** — When conversation gets response
5. **Event: Status Change** — When task status changes
6. **Event: Edge Created** — When connection made

**Recommendation (P2):** MVP triggers: Manual, Node Created, Message Received.

---

### Iter 333 — Action: Steps

**What can action steps do?**

1. **Create Node** — Specified type, with template content
2. **Update Node** — Change properties of connected node
3. **Send Message** — Add message to conversation
4. **Create Edge** — Connect nodes
5. **Notify** — Toast or system notification
6. **Webhook** — Call external URL (advanced)

**Recommendation (P2):** MVP steps: Create Node, Update Node, Notify.

---

### Iter 334 — Action: Configuration UI

**How does user configure actions?**

**Properties panel for Action node:**
- Trigger section (type + config)
- Conditions section (optional filters)
- Steps section (ordered list of steps)
- Test button

**Recommendation (P1):** Action config in properties panel. Test button essential.

---

### Iter 335 — Action: Error Handling

**What if action fails?**

**Expected:**
- Log error to action node
- Toast notification
- Don't crash other actions
- Retry option?

**Recommendation (P2):** Actions have error log. Failures are visible.

---

### Iter 336 — Context Injection Deep Dive

**How exactly does context injection work?**

**Current understanding:**
- Edges point TO conversation node
- Connected nodes' content injected into context
- Order matters? Depth matters?

**Questions:**
- Can user control injection order?
- Can user exclude specific fields?
- How is context formatted?

**Recommendation (P1):** Document exact context injection format. Make it previewable.

---

### Iter 337 — Context: Injection Order

**Order of injected content:**

**Options:**
A) Edge creation order
B) Spatial order (left to right, top to bottom)
C) Manual priority
D) Type-based (conversations first, notes second, etc.)

**Recommendation (P2):** Default: edge creation order. Allow manual reorder in context settings.

---

### Iter 338 — Context: Depth/Recursion

**If A→B and B→C, does A see C's content?**

**Options:**
A) No recursion (only direct connections)
B) One level (A sees B's direct connections)
C) Configurable depth
D) Full transitive closure

**ND Check:**
- Full recursion = confusing what's included
- One level = predictable

**Recommendation (P1):** Default: direct only. Option for one-level recursion.

---

### Iter 339 — Context: Field Selection

**Can user choose which fields inject?**

**Example:** Inject title and content, not metadata.

**Recommendation (P2):** Context settings → field checkboxes per node type.

---

### Iter 340 — Context: Token Budget

**How to handle token limits?**

**Strategies:**
- Show total token estimate
- Warn when approaching limit
- Option: summarize old messages
- Option: truncate least relevant

**Recommendation (P1):** Token meter + warning at 80% capacity.

---

### Iter 341 — Conversation Branching

**Can conversations branch?**

**Concept:**
- At any message, start a "branch"
- Explores alternative direction
- Original conversation preserved
- Visual: tree structure or parallel nodes?

**Implementation options:**
A) Separate Conversation nodes linked by "branched from"
B) Internal branching within single node
C) Version history within node

**Recommendation (P1):** Branching creates new Conversation node with link to parent. Cleaner.

---

### Iter 342 — Conversation: Model Switching

**Can user switch models mid-conversation?**

**Expected:**
- Model selector in conversation
- Historical messages stay (were generated by old model)
- New messages use new model
- Clear indicator of which model used where

**Recommendation (P2):** Model switchable. Message metadata shows which model.

---

### Iter 343 — Templates System

**Beyond custom types, what about templates?**

**Template = pre-configured workspace or project:**
- "Research Project" template
- "Feature Development" template
- "Meeting Notes" template

**Contains:**
- Pre-created nodes
- Suggested structure
- Placeholder content

**Recommendation (P2):** Workspace/Project templates. User can create and share.

---

### Iter 344 — Export Formats

**What can workspaces export to?**

**Formats:**
1. Native (.cognograph) — full fidelity
2. JSON — for backup/migration
3. Markdown — conversations and notes as .md files
4. PDF — snapshot of canvas (visual)

**Recommendation (P2):** MVP: Native + JSON. Later: Markdown export.

---

### Iter 345 — Import Sources

**What can import into Cognograph?**

**Sources:**
1. Native (.cognograph)
2. JSON backup
3. Markdown files → Notes
4. ChatGPT export → Conversations
5. Notion export? (future)

**Recommendation (P3):** MVP: Native + JSON. Later: Markdown, ChatGPT.

---

## Section G: Final Synthesis (Iterations 346-350)

### Iter 346 — Synthesis: The Three Pillars

**Cognograph rests on three pillars:**

1. **Spatial Memory** — Position = knowledge location
2. **Visual Context** — Connections show relationships
3. **Structured Data** — Views for task management

**Each pillar has its UI mode:**
- Canvas mode (spatial)
- Edge/connection mode (context)
- View mode (structured)

---

### Iter 347 — Synthesis: The ADHD Journey

**How does ADHD user experience Cognograph?**

**Pain points addressed:**
- "Where was I?" → Session restoration + visual bookmarks
- "What do I do?" → Suggested actions + command palette
- "Did I mess up?" → Robust undo + clear feedback
- "Too much!" → Focus mode + hide members + collapse sections
- "I'll forget!" → Quick capture + position memory

**The product IS the external brain structure.**

---

### Iter 348 — Synthesis: Competitive Position

**Cognograph vs alternatives:**

| Feature | Cognograph | Notion | Obsidian | Miro |
|---------|------------|--------|----------|------|
| Spatial canvas | ✅ Primary | ❌ | Partial | ✅ |
| AI-native | ✅ Built-in | Add-on | Plugin | Add-on |
| Context injection | ✅ Unique | ❌ | ❌ | ❌ |
| Structured views | ✅ | ✅ | ❌ | ❌ |
| Custom types | ✅ | ✅ | ❌ | ❌ |

**Unique value:** Spatial + AI + Context injection. No one else has this combo.

---

### Iter 349 — Synthesis: What's Still Missing?

**Gaps identified but not fully designed:**

1. **Collaboration** — Multi-user, real-time
2. **Mobile** — Touch-first interface
3. **Plugins/Extensions** — Third-party actions
4. **API** — Programmatic access
5. **Screen reader support** — Full accessibility

**These are future scope. Note for roadmap.**

---

### Iter 350 — Final Summary

**250 → 350 iterations covered:**

**Edge Cases & Errors (251-270):**
- Circular membership blocked
- Orphaned nodes promoted on delete
- Custom type deletion requires replacement
- Context size pre-flight check
- All errors include recovery guidance

**Interaction Details (271-290):**
- 4px drag threshold
- Drop target highlighting
- Tab follows outline order
- Spatial arrow navigation
- Escape cascade defined

**ND Refinements (291-305):**
- Suggested actions after AI response
- Task completion celebration
- Focus mode
- Quick capture hotkey
- Visual bookmarks
- Full session restoration
- 50+ step undo

**Performance (306-315):**
- 60fps target at 500 nodes
- Virtual scrolling everywhere
- Background save
- Progressive load

**Onboarding (316-330):**
- First launch: blank+hint or sample
- Shortcuts in tooltips
- Contextual hints (limited)
- Error recovery guidance

**Advanced Features (331-345):**
- Action triggers: Manual, Node Created, Message Received
- Action steps: Create Node, Update Node, Notify
- Context injection: direct only, optional one-level
- Conversation branching via linked nodes
- Templates for workspaces/projects

**The plan is comprehensive. Ready for implementation.**

---

## Updated Statistics

| Metric | Count |
|--------|-------|
| Total Iterations | 350 |
| Edge cases documented | 20 |
| Interaction details | 20 |
| ND-specific features | 15 |
| Performance targets | 10 |
| Onboarding elements | 15 |
| Advanced feature specs | 15 |

---

## Circuit Breaker Check

**Iteration 350:** Still producing substantive, non-repetitive content. Each section tackled distinct concerns.

**If more iterations:** Would go into implementation specs (component APIs, data models). That's probably handoff territory.

---

*Extended loop complete. 350 iterations. The plan embodies "knowing WHERE things are without knowing WHAT they are" — ready for handoff to implementation persona.*

