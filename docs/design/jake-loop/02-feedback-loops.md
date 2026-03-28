# Domain 2: Feedback Loops

**Why Second:** ADHD-critical. Progress visibility enables continuation. Without feedback, initiation dies.

**Stefan's ND Needs:**
- Dopamine from visible progress
- Evidence that actions worked
- System state always visible
- No "is it doing something?" anxiety

---

## Iter 31 — Streaming State Visibility

From visual-feedback-juiciness.md: Streaming conversations show:
- Pulsing glow on node border
- Shimmer sweep animation
- Bouncing dots in footer

**ND Check:**
- "Is Claude thinking?" is ANSWERED visually ✅
- No need to wonder if action registered ✅

**Verdict:** ✅ Validated (if implemented). Spec is excellent.

**Action:** Verify implementation status in ConversationNode.tsx.

---

## Iter 32 — Streaming Implementation Check

**Need to read:** ConversationNode.tsx

**From visual-feedback-juiciness.md spec:**
```css
.cognograph-node--conversation.streaming { ... }
```

**From styleguide-master_02.html:** CSS exists (lines 366-392).

**Question:** Does ConversationNode.tsx apply the `streaming` class?

**This is P1 — if streaming isn't visible, it's a major feedback gap.**

---

## Iter 33 — Warmth Indicators

From spec: Nodes show "warmth" based on recency:
- Hot (30 seconds): Strong orange glow
- Warm (2 minutes): Medium glow
- Cool (5 minutes): Subtle glow

**ND Check:**
- "What was I just working on?" ANSWERED at a glance ✅
- Recent activity = visual trail of work ✅
- Dopamine: seeing warmth = evidence of progress ✅

**Verdict:** ✅ Excellent concept for ADHD. High value.

**Question:** Is warmth implemented?

---

## Iter 34 — Context Flow on Edges

From spec: When a conversation streams, edges flowing INTO it animate.

**ND Check:**
- Shows WHICH nodes are providing context
- Visual confirmation that connections are working
- "The spatial arrangement is DOING something" ✅

**Reference check:**
- No competitor does this. Novel and valuable.

**Verdict:** ✅ Killer feature for spatial CLI. Must implement.

---

## Iter 35 — Typing Indicator

From spec: Bouncing dots while assistant response is empty.

**ND Check:**
- Standard pattern (Claude.ai, ChatGPT all have this)
- Removes "is it responding?" anxiety ✅

**Verdict:** ✅ Must have. Standard.

---

## Iter 36 — Context Injection Flash

From spec: When message is sent, context indicator bar flashes.

**ND Check:**
- Confirms "your message went AND context was included"
- Moment of feedback at the critical action point ✅

**Verdict:** ✅ Small but important. Confirms action.

---

## Iter 37 — Node Spawn Animation

From spec: New nodes scale up from 0.85 to 1.0.

**ND Check:**
- Visual feedback: "I created something" ✅
- Smooth appearance vs. jarring pop-in ✅

**Verdict:** ✅ Polish that matters.

**From styleguide CSS:** `.cognograph-node.spawning` exists.

---

## Iter 38 — Token Usage Meter

From spec: Visual meter showing context window usage.

**ND Check:**
- "Am I running out of space?" ANSWERED visually
- Green/yellow/red = intuitive (no reading required) ✅
- Prevents surprise truncation

**Reference check:**
- Claude.ai doesn't show this
- ChatGPT doesn't show this
- This is BETTER than competitors ✅

**Verdict:** ✅ High value. Implement.

---

## Iter 39 — Save State Indicator

**Question:** How do you know if workspace has unsaved changes?

From earlier exploration: "⏱ Unsaved" in status bar.

**ND Check:**
- Critical feedback: "Did my work save?"
- Unsaved = anxiety about losing work
- Auto-save would be better, but indicator is minimum

**Recommendation (P1):** Auto-save every 30 seconds. Indicator shows "Saved" with timestamp.

---

## Iter 40 — Toast Notifications

From styleguide: `.gui-toast` with glow animation.

**ND Check:**
- Confirms actions ("Node deleted", "Saved", etc.)
- Brief, non-blocking ✅
- Glow draws attention without alarm ✅

**Verdict:** ✅ Good pattern.

---

## Iter 41 — Error Feedback

What happens when something fails?
- API call fails
- File save fails
- Invalid action attempted

**ND Check:**
- Errors without explanation = panic
- Need clear "what went wrong" + "what to do"

**Question:** Are error states defined in styleguide?

**From styleguide:** `.gui-badge--error` exists (red variant).

**Recommendation (P1):** Audit all error paths. Each needs:
1. Visual indicator (red state)
2. Clear message
3. Recovery action if possible

---

## Iter 42 — Loading States

What about loading/pending states?
- Workspace loading
- AI response pending
- Extraction running

**From styleguide:** Streaming animation exists. Extraction shimmer exists.

**Question:** Is there a generic loading pattern for other operations?

**ND Check:**
- Unknown duration = anxiety
- Need visible "working on it" for ANY async operation

**Recommendation (P2):** Define generic loading pattern. Skeleton? Spinner? Apply consistently.

---

## Iter 43 — Extraction Feedback

From spec: When extraction runs:
- Shimmer effect on node
- Wand icon pulses
- Particles emit on completion

**ND Check:**
- "Is extraction working?" ANSWERED ✅
- Completion celebration (particles) = dopamine hit ✅
- This is excellent feedback design

**Verdict:** ✅ Well-designed. Implement fully.

---

## Iter 44 — Selection Feedback

When you select a node, what feedback?

**From styleguide:**
- Outline ring (2px, node color)
- Brightness increase (1.08)

**ND Check:**
- Clear selection state ✅
- Immediate response ✅

**Verdict:** ✅ Validated.

---

## Iter 45 — Drag Feedback

When dragging a node, what feedback?

**Expected:** Node follows cursor smoothly.

**Question:** Is there any visual change during drag? Shadow increase? Slight scale?

**Reference check:**
- Figma: Slight lift/shadow on drag
- Miro: Same

**ND Check:**
- Visual lift = "I'm holding this" confirmation ✅

**Recommendation (P3):** Add shadow-node-hover on drag start.

---

## Iter 46 — Hover Feedback

**From styleguide:**
```css
.cognograph-node:hover {
  box-shadow: var(--shadow-node-hover);
  filter: brightness(1.05);
}
```

**ND Check:**
- "This is interactive" signal ✅
- Consistent across all nodes ✅

**Verdict:** ✅ Validated.

---

## Iter 47 — Button Feedback

From styleguide:
```css
.gui-btn-ghost:hover:not(:disabled) {
  background: var(--surface-panel-secondary);
  transform: translateY(-1px);
}
.gui-btn-ghost:active:not(:disabled) {
  transform: translateY(0);
}
```

**ND Check:**
- Hover: visual change ✅
- Active: press response ✅
- Disabled: different appearance (.opacity: 0.4) ✅

**Verdict:** ✅ Good button states.

---

## Iter 48 — Focus Feedback

**From styleguide:**
```css
.gui-btn-ghost:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

**ND Check:**
- Keyboard navigation needs visible focus ✅
- Using :focus-visible (not :focus) = correct ✅

**Verdict:** ✅ Validated for buttons.

**Question:** Do ALL interactive elements have focus-visible styles?

**Action:** Audit all interactive elements for focus states.

---

## Iter 49 — Input Feedback

**From styleguide:**
```css
.gui-input:focus {
  border-color: var(--accent-primary);
  outline: none;
}
```

**ND Check:**
- Focus state visible ✅
- Placeholder text present ✅

**Observation:** Using :focus not :focus-visible. Should be :focus for inputs (always show focus).

**Verdict:** ✅ Correct pattern for inputs.

---

## Iter 50 — Toggle Feedback

**From styleguide:**
```css
.gui-toggle-active {
  background-color: var(--accent-secondary);
  border-color: var(--accent-secondary);
}
.gui-toggle-knob {
  transition: transform 150ms ease-out;
}
```

**ND Check:**
- On/off visually distinct (color change + knob position) ✅
- Animation smooths the change ✅

**Verdict:** ✅ Validated.

---

## Iter 51 — Tab Feedback

**From styleguide:**
```css
.gui-tab-active {
  background-color: var(--surface-panel-secondary);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
```

**ND Check:**
- Active tab distinct from inactive ✅
- Hover state exists ✅

**Verdict:** ✅ Validated.

---

## Iter 52 — Connection Handle Feedback

When hovering over a connection handle:

**From visual-feedback-juiciness.md:**
```css
.cognograph-node:hover .react-flow__handle:hover {
  transform: scale(1.3);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
}
```

**ND Check:**
- "This is where I connect from" signal ✅
- Scale + glow is noticeable ✅

**Verdict:** ✅ Good handle feedback.

---

## Iter 53 — Connection Drawing Feedback

While drawing an edge from handle to handle:

**From spec:** `.react-flow__handle.connecting` has pulse animation.

**ND Check:**
- "I'm in the middle of connecting" state ✅
- Visible line following cursor (React Flow standard) ✅

**Verdict:** ✅ Standard + enhanced.

---

## Iter 54 — Zoom Feedback

**From spec:** ZoomIndicator component shows zoom level.

**Behavior:**
- Appears when zooming
- Shows percentage + marker on bar
- Fades out after ~1 second

**ND Check:**
- "What zoom am I at?" ANSWERED
- Non-intrusive (fades out) ✅

**Verdict:** ✅ Good design.

---

## Iter 55 — Minimap as Feedback

Minimap shows overview of canvas state.

**From spec:** Streaming nodes pulse on minimap too.

**ND Check:**
- "Where is activity happening?" ANSWERED at a glance ✅
- Don't need to pan to see if something is streaming ✅

**Verdict:** ✅ Excellent. Minimap as activity monitor.

---

## Iter 56 — Chat Message Send Feedback

When you send a message:
1. Message appears in thread
2. Input clears
3. Streaming starts (typing indicator)
4. Response streams in

**ND Check:**
- Each step has visible change ✅
- No "did my message send?" ambiguity ✅

**Verdict:** ✅ Standard chat UX.

---

## Iter 57 — Undo/Redo Feedback

From toolbar: Undo (↩) and Redo (↪) buttons.

**Question:** After undo, is there feedback about WHAT was undone?

**Reference check:**
- Figma: Toast "Undid [action]"
- Notion: Toast with undo details
- Most apps: Just visual reversion

**ND Check:**
- Without message, user must LOOK to see what changed
- With message, user KNOWS what changed

**Recommendation (P2):** Toast message on undo: "Undid: Delete node 'X'"

---

## Iter 58 — Dirty State Feedback

From earlier: Status bar shows "⏱ Unsaved"

**ND Check:**
- Visual indicator of unsaved work ✅
- But is it prominent enough?

**Question:** Does save button also indicate dirty state?

**Recommendation (P2):** Save button should have accent/dot when dirty. Don't rely only on status bar.

---

## Iter 59 — Network/Sync Feedback

If future multiplayer exists, sync state needs visibility.

**From components:** Multiplayer/ConnectionStatus.tsx exists.

**ND Check:**
- "Am I connected?" must be visible
- Sync failures need clear indication

**Verdict:** Acknowledged for future. Not v1 critical.

---

## Iter 60 — Feedback Loop Summary

### What's Working (Validations)
- ✅ Streaming animation spec (glow, shimmer, dots)
- ✅ Warmth indicator concept
- ✅ Context flow on edges concept
- ✅ Typing indicator
- ✅ Context injection flash
- ✅ Node spawn animation
- ✅ Token meter design
- ✅ Toast notifications
- ✅ Selection feedback (ring + brightness)
- ✅ Hover feedback (shadow + brightness)
- ✅ Button states (hover, active, disabled, focus)
- ✅ Input focus states
- ✅ Toggle animation
- ✅ Tab states
- ✅ Connection handle feedback
- ✅ Zoom indicator

### Needs Verification
- [ ] Streaming animation IMPLEMENTED (not just spec'd)
- [ ] Warmth indicators IMPLEMENTED
- [ ] Context flow edges IMPLEMENTED
- [ ] Extraction particles IMPLEMENTED
- [ ] All interactive elements have focus-visible

### Recommendations
| Priority | Issue | Recommendation |
|----------|-------|----------------|
| P1 | Verify streaming implementation | Check ConversationNode.tsx |
| P1 | Auto-save | Save every 30 sec, show "Saved" timestamp |
| P1 | Error states | Audit all error paths for visual + message + recovery |
| P2 | Generic loading pattern | Define skeleton/spinner for all async ops |
| P2 | Undo feedback | Toast "Undid: [action]" |
| P2 | Dirty state prominence | Save button shows accent when dirty |
| P3 | Drag feedback | Add shadow increase on drag start |

### Implementation Status Critical

The visual-feedback-juiciness.md spec is EXCELLENT. But specs don't equal implementation.

**P0 Action:** Verify which feedback animations are actually in the codebase vs just planned.

---

## Stefan's Notes
*Space for Stefan to add context, corrections, or redirects*

-

---

## Checkpoint: Feedback Loops Complete

**Iterations:** 31-60
**Findings:** 16 validations, 5 verifications needed, 7 recommendations
**Critical (P0):** 1 (verify implementation status)
**High (P1):** 3
**Medium (P2):** 4

**Circuit Breaker Check:** Findings are substantive and varied. Not repetitive. Continue.

**Ready to proceed to Domain 3: Initiation & Action?**
