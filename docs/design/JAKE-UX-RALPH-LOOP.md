# Jake's UX/UI/Product Optimization Ralph Loop

**Persona:** Jake — Principal UX/Product Designer
**Loop Type:** Plan Iteration (not implementation)
**Target:** 100+ iterations
**Started:** 2026-01-31

---

## Core Insight: Stefan's Original Goal

> "My original goal for this tool was to visually represent the cmd window I'm interacting with you with right now, so I could hold more context in my brain visio-spatially — knowing WHERE things are but not WHAT they are; it's hard for me to do that with folders and files in a file browser instead of a canvas."

**Translation:**
- Spatial memory > hierarchical memory
- Position = context (not content)
- Canvas > file tree for Stefan's brain
- The tool IS the CLI visualized spatially

---

## Stefan's Neurodivergence (Design-Relevant)

| Challenge | Design Solution |
|-----------|-----------------|
| Initiation difficulty | Clear single action, no decisions |
| Overwhelm from options | One path forward, always |
| Need for completion | Small chunks that finish |
| Dopamine seeking | Visible feedback, evidence of progress |
| Inconsistency without structure | Same patterns, external cues |

**Design philosophy:** Redesign > Enforce (bouncer principle)
**Curb cut effect:** Design for Stefan's edge case, everyone benefits

---

## Ralph Loop Structure

### Completion Promise
**The implementation plan embodies "knowing WHERE things are without knowing WHAT they are"** — the spatial CLI vision — and is ready to hand off to another persona for implementation.

**Exit criteria:**
- Full product audit complete
- Major refactors/changes surface options for Stefan to decide
- Plan is actionable by implementation persona
- Insights and additions documented as bonuses

### Iteration Format

Each iteration produces ONE of:
- **Observation** — What I notice (problem, pattern, gap)
- **Recommendation** — Specific fix or improvement
- **Question** — Needs clarification or decision
- **Validation** — Confirming existing approach is correct

### Output Structure

```
## Iteration [N]

**Type:** [Observation | Recommendation | Question | Validation]
**Area:** [Component/Feature/Pattern]
**Priority:** [P0-Critical | P1-High | P2-Medium | P3-Low]

**Content:**
[The actual observation/recommendation/question/validation]

**Context Gathered:**
[Any new context read this iteration]

**Next:**
[What the next iteration should explore]
```

---

## Audit Domains

### 1. Spatial Cognition
- Does the canvas reduce cognitive load vs file trees?
- Is position meaningful? (context injection, relationships)
- Can Stefan "know where things are without knowing what they are"?
- Does the spatial arrangement persist in memory?

### 2. Feedback Loops
- Streaming indicators (is AI working?)
- Context flow visualization (what's connected?)
- Node warmth (what's recent?)
- Progress evidence (dopamine)

### 3. Initiation & Action
- Is the next action obvious?
- Minimal decisions to accomplish tasks
- No dead ends or confusion states
- Clear affordances

### 4. Consistency & Patterns
- Same interactions everywhere
- Predictable behavior
- No surprises
- Learnable once, applied everywhere

### 5. Accessibility
- Keyboard navigation complete
- Focus management correct
- Reduced motion support
- Contrast sufficient

### 6. Information Architecture
- Right information at right time
- Progressive disclosure working
- Hierarchy clear
- Nothing hidden that should be visible

### 7. Polish & Feel
- Interactive states complete
- Animations purposeful
- Shadows/depth meaningful
- Typography scannable

---

## Context Sources

### Already Read
- [x] TOKENS.md — Design tokens reference
- [x] components.md — Component inventory
- [x] ui_refactoring_plan.md — Token standardization plan
- [x] visual-feedback-juiciness.md — Animation/feedback spec
- [x] styleguide_plan_02.md — Composed section plan
- [x] STYLEGUIDE-POLISH-PLAN.md — Interactive states checklist
- [x] NORTH_STAR.md — 3D desktop vision
- [x] VISION.md — Product strategy
- [x] stefan-brand-identity.md — Neurodivergence context
- [x] jake-ux-principal.md — This persona

### To Read As Needed
- [ ] Actual component files (ConversationNode.tsx, etc.)
- [ ] styleguide-master_02.html (visual review)
- [ ] workspaceStore.ts (state architecture)
- [ ] ChatPanel.tsx (core interaction)
- [ ] App.tsx (layout structure)

---

## Current State Summary

### What Exists
- ✅ Design token system (complete)
- ✅ 8 node types with distinct colors
- ✅ Component inventory documented
- ✅ Styleguide with atoms
- ✅ Visual feedback spec (not implemented)
- ✅ Refactoring plan (in progress)

### Gaps Identified
- ❌ Interactive states incomplete
- ❌ Visual feedback not implemented
- ❌ No formal UX audit
- ❌ No accessibility audit
- ❌ No usability testing data
- ❌ Composed components not in styleguide

---

## Design Source of Truth

**`styleguide-master_02.html`** is the newest design (not yet implemented). The loop should:
- Treat this as the target design
- Identify gaps between styleguide and actual implementation
- Evaluate whether the styleguide itself achieves the spatial CLI vision
- Recommend adjustments to both styleguide AND implementation

### What the Styleguide Already Has
- ✅ Complete design tokens (colors, spacing, typography, shadows, motion)
- ✅ Node component styles (8 types with distinct colors)
- ✅ Animation/feedback styles (streaming, warmth, extraction particles)
- ✅ GUI component classes (toolbar, panels, buttons, badges, toggles)
- ✅ Light/dark theme support
- ✅ Composed demo helpers (K-P section scaffolding)
- ✅ Accessibility: `prefers-reduced-motion` support

### What the Styleguide May Be Missing
- [ ] Interactive states audit (hover/focus/active everywhere?)
- [ ] Keyboard navigation patterns
- [ ] Error states / empty states
- [ ] Loading states
- [ ] Responsive breakpoints
- [ ] Touch target sizing
- [ ] Focus trap patterns for modals

---

## Iteration Log

---

## Iteration 1

**Type:** Validation
**Area:** Initiation & Action — EmptyCanvasHint
**Priority:** P1-High

**Content:**
The EmptyCanvasHint component follows strong ND-friendly patterns:
- ✅ Appears only when needed (empty canvas)
- ✅ Single clear next action (double-click to create)
- ✅ Progressive disclosure of shortcuts (Ctrl+K, Shift+N/C/T, ?)
- ✅ Fades on interaction (doesn't persist as noise)
- ✅ Click anywhere to dismiss (no precision required)

**Concern:** The hint shows 4 different shortcuts immediately. For someone with initiation difficulty, this might still present "too many options." Consider:
- Show only ONE action prominently (double-click)
- Reveal shortcuts only on hover/demand

**Context Gathered:**
- EmptyCanvasHint.tsx uses AnimatePresence for smooth transitions
- Fades to 60% opacity after any interaction, then dismisses after 3s

**Next:**
Audit KeyboardShortcutsHelp for discoverability vs overwhelm balance

---

## Iteration 2

**Type:** Observation
**Area:** Accessibility — KeyboardShortcutsHelp
**Priority:** P2-Medium

**Content:**
The ? key shortcut overlay is comprehensive but has potential issues:

**Good:**
- All shortcuts in one discoverable place (reduces memory load)
- Categorized into logical groups
- Escape/? closes it (easy exit)

**Concerns:**
1. **7 categories, 29 shortcuts** — This is a lot. ND users may feel overwhelmed.
2. **No search/filter** — If you forget a shortcut, you scan all 29.
3. **No visual grouping cues** — Categories are just headers, not visually distinct.
4. **Static layout** — Doesn't surface "most used" or "beginner" shortcuts first.

**Recommendation:** Consider a "beginner mode" that shows only 5-6 essential shortcuts, with expansion to full list.

**Context Gathered:**
- KeyboardShortcutsHelp.tsx has SHORTCUT_CATEGORIES constant with 7 categories
- Uses grid layout (2 columns)

**Next:**
Evaluate Focus Mode UX — does dimming work for spatial memory?

---

## Iteration 3

**Type:** Observation
**Area:** Spatial Cognition — Focus Mode
**Priority:** P1-High

**Content:**
Focus Mode dims non-focused nodes to let the user concentrate on one node. This partially achieves the spatial CLI vision:

**Positive:**
- Position of dimmed nodes is still visible (spatial memory intact)
- Focused node "pops" visually
- Indicator shows what's focused with Escape hint

**Concern — Spatial Relationships:**
The dimming might hide CONNECTION patterns. If Stefan's spatial memory is "knowing WHERE things are," then:
- Connected nodes should maybe stay slightly brighter
- The "neighborhood" around the focused node matters

**Question:** Should Focus Mode have a "neighborhood mode" that keeps directly-connected nodes visible while dimming the rest?

This would support: "I know this node connects to THOSE nodes, I don't need to remember what they contain."

**Context Gathered:**
- FocusModeIndicator shows node title and Esc hint
- Dimmed nodes are 30% opacity (CSS: `opacity: 0.3`)

**Next:**
Audit visual bookmarks for spatial anchoring

---

## Iteration 4

**Type:** Validation
**Area:** Spatial Cognition — Visual Bookmarks
**Priority:** P1-High

**Content:**
Visual bookmarks (golden star, B key, G to jump) strongly support the spatial CLI vision:

**Why this works for Stefan:**
- "I know that important thing is the GOLD one somewhere over there"
- Doesn't need to remember content, just that "gold = important"
- Jump-to (G) means no hunting for bookmarked node

**Enhancement opportunity:**
Multiple bookmarks could be visually differentiated:
- First bookmark: Gold
- Second: Cyan
- Third: Purple

This gives 3+ "spatial anchors" that Stefan can reference: "the gold one, the cyan one, the purple one" — position + color without content.

**Context Gathered:**
- Bookmark state in workspaceStore with toggleBookmark action
- CSS class `.cognograph-node--bookmarked` applies gold indicator
- G key triggers jump animation

**Next:**
Audit streaming indicators — is "AI is thinking" visible enough?

---

## Iteration 5

**Type:** Observation
**Area:** Feedback Loops — Streaming State
**Priority:** P0-Critical

**Content:**
When AI is streaming a response, the user needs clear feedback that "something is happening." This is critical for dopamine/reward loops.

**Current state (needs verification):**
- Streaming indicator exists in specs (visual-feedback-juiciness.md)
- Glowing border animation on node while streaming
- Pulsing sparkle indicator

**Concerns:**
1. **Is the streaming indicator implemented?** The spec exists but implementation may lag.
2. **Is it visible from far zoom levels?** If Stefan is zoomed out, can he still see which node is "working"?
3. **Sound/haptic?** For severe ADHD, visual-only may not capture attention.

**Question for Stefan:**
Would you want an optional audio cue (subtle chime) when AI starts/finishes responding? This could help with attention drift.

**Context Gathered:**
- visual-feedback-juiciness.md specifies streaming indicators
- Need to verify actual implementation in ConversationNode.tsx

**Next:**
Check streaming indicator implementation in actual component code

---

## Iteration 6

**Type:** Validation
**Area:** Feedback Loops — Streaming Implementation
**Priority:** P1-High

**Content:**
Verified streaming indicator IS implemented in ConversationNode.tsx:

**What exists:**
- `isStreaming` state from workspaceStore hook
- `.streaming` CSS class applied to node container
- Streaming dots animation (`<div className="streaming-dots">`)
- Visual feedback while AI is responding

**Still to verify:**
- Is the streaming state styled with glow border? (Check CSS)
- Is it visible at far zoom levels?
- Does it work for all node types that can stream, or just ConversationNode?

**Context Gathered:**
- ConversationNode.tsx line 43: `const isStreaming = useIsStreaming(id)`
- Line 222: `isStreaming && 'streaming'` adds class
- Lines 369-372: Streaming dots rendered when streaming

**Next:**
Check CSS for .streaming class visual effects

---

## Iteration 7

**Type:** Recommendation
**Area:** Feedback Loops — Streaming Visibility at Zoom
**Priority:** P2-Medium

**Content:**
The streaming dots are likely invisible when zoomed out. For Stefan's spatial workflow:

**Problem:**
- He may have 20+ nodes visible at once
- Zoomed out to see the "whole picture"
- Can't see which node is "working"

**Recommendation:**
Add a **zoom-aware streaming indicator**:
- At high zoom: Show streaming dots (current)
- At low zoom: Show pulsing glow effect on the whole node
- At very low zoom: Show a "beacon" animation (ripple effect) that's visible even when node is small

**Implementation concept:**
```css
.streaming {
  /* At high zoom (node > 100px) */
  animation: streaming-glow 1.5s ease-in-out infinite;
}

@media (max-resolution: ...) { /* or via JS zoom level */
  .streaming {
    animation: streaming-beacon 1s ease-out infinite;
  }
}
```

**Next:**
Audit node warmth system for temporal context

---

## Iteration 8

**Type:** Observation
**Area:** Feedback Loops — Node Warmth
**Priority:** P2-Medium

**Content:**
Node warmth (recency indicator) supports spatial memory by showing "what was active recently":

**Concept:**
- Recently interacted nodes have a warm glow
- "I don't remember what it was, but I know it was the glowing one I was just using"

**Questions to verify:**
1. Is warmth currently implemented or just spec'd?
2. How long does warmth persist? (Decay curve)
3. Is the visual effect distinct from streaming?
4. Does warmth interact with bookmarks? (Warm + bookmarked = double indication?)

**Design consideration:**
Warmth should decay gradually, not suddenly. Stefan's temporal memory benefits from smooth transitions.

**Context Gathered:**
- ConversationNode.tsx line 45: `const warmthLevel = useNodeWarmth(id)`
- visual-feedback-juiciness.md specifies warmth system

**Next:**
Check warmth implementation details in workspaceStore

---

## Iteration 9

**Type:** Observation
**Area:** Consistency — Quick Creation Patterns
**Priority:** P1-High

**Content:**
Quick node creation now works via Shift+key shortcuts:
- Shift+N: Note
- Shift+C: Conversation
- Shift+T: Task
- Shift+P: Project
- Shift+A: Artifact

**Consistency check:**
All 5 main node types have quick creation. Good.

**Gap identified:**
Other creation flows may not be consistent:
- Double-click canvas: Creates conversation (why only conversation?)
- Context menu: Shows all options
- Command palette: Shows all options

**Question:**
Should double-click create whatever node type was LAST created? This would support "I want more of what I was just making" without remembering shortcuts.

**Alternative:**
Double-click brings up a quick radial menu (5 options in a circle) — spatial selection instead of text menu.

**Next:**
Evaluate command palette for consistency with keyboard shortcuts

---

## Iteration 10

**Type:** Observation
**Area:** Information Architecture — Command Palette
**Priority:** P2-Medium

**Content:**
The command palette (Ctrl+K) is a text-based search interface. For the spatial CLI vision:

**Tension:**
- Command palette is TEXT-based (type what you want)
- Stefan's goal is SPATIAL (know where things are)
- These can conflict

**When command palette works:**
- User KNOWS what they want, needs fast access
- User is in "keyboard flow" mode

**When it conflicts:**
- User doesn't remember command name
- User would rather "see and point" than "type and find"

**Recommendation:**
Command palette should have a "spatial mode":
- Show recent commands as a visual grid (not just text list)
- Position frequently-used commands in consistent spatial positions
- Let muscle memory form for command locations

This mirrors how spatial memory works: "the create-note command is top-left in the palette"

**Next:**
Audit context menu for consistency with command palette

---

## Iteration 11

**Type:** Observation
**Area:** Consistency — Context Menu Structure
**Priority:** P2-Medium

**Content:**
The context menu has 28+ menu items across different contexts. This is dense.

**Current structure (inferred from MenuItem count):**
- Canvas right-click: ~8 items (create options)
- Single node right-click: ~8 items (focus, bookmark, delete, etc.)
- Multi-selection: ~6 items (group actions)
- Specific items: Copy, paste, select all, etc.

**Consistency analysis:**
- Some shortcuts in context menu, some only in keyboard help
- Shortcut format inconsistent? (Some show Ctrl+, some show ⌘)

**Recommendation:**
1. Audit all shortcuts for platform consistency (Ctrl on Windows, ⌘ on Mac)
2. Ensure every context menu item has a keyboard shortcut
3. Consider grouping menu items with visual separators

**Next:**
Check edge creation flow for initiation friction

---

## Iteration 12

**Type:** Question
**Area:** Initiation & Action — Edge Creation
**Priority:** P1-High

**Content:**
Creating connections between nodes is a core spatial relationship action. How does this currently work?

**Possible flows (need to verify):**
1. Drag from handle to handle
2. Select two nodes, press a key
3. Context menu on selection
4. Command palette

**Questions:**
1. Is the connection affordance visible? (Handle dots on nodes?)
2. Can Stefan "see" connection points without hovering?
3. Is there visual feedback during edge creation?
4. What happens if connection fails? (Error state)

**Design principle at stake:**
"Knowing WHERE things are" includes knowing WHERE relationships exist. Edge creation should be as natural as spatial memory.

**Next:**
Examine node handle visibility and connection UX

---

## Iteration 13

**Type:** Recommendation
**Area:** Spatial Cognition — Edge Visibility
**Priority:** P1-High

**Content:**
For the spatial CLI vision, edges ARE the context. They represent:
- What nodes are connected in conversation context
- Dependency relationships
- Information flow

**Current state (to verify):**
- Edges rendered as lines between nodes
- Probably bezier curves with some styling

**Enhancement needed:**
Edges should be MORE than just lines. They should convey:
1. **Direction** — Which way does context flow?
2. **Strength** — How important is this connection?
3. **Type** — Is this a context edge, dependency edge, reference edge?
4. **Activity** — Was this edge "used" recently? (Pulse on context injection)

**Visual encoding options:**
- Thickness = strength/frequency
- Color = type
- Pulse animation = active context flow
- Glow = recent activity

This makes edges themselves spatial memory aids: "the thick bright edge over there" without remembering what it connects.

**Next:**
Audit zoom behavior for spatial consistency

---

## Iteration 14

**Type:** Observation
**Area:** Spatial Cognition — Zoom Behavior
**Priority:** P2-Medium

**Content:**
Zoom affects spatial memory. At different zoom levels, different information is useful.

**Zoom level paradigm:**
- **Far zoom (overview):** See ALL nodes, relationships, structure. Content hidden.
- **Mid zoom (working):** See node titles, badges, key indicators.
- **Close zoom (detail):** See full content, can read/edit.

**Question:**
Does Cognograph adapt content visibility to zoom level?

**Semantic zoom requirements:**
- Far: Node = colored shape only (maybe icon)
- Mid: Node = title + type indicator
- Close: Node = full content preview

This supports Stefan's "know WHERE without WHAT" — at far zoom, he sees the spatial layout without being distracted by content.

**Next:**
Check if semantic zoom is implemented

---

## Iteration 15

**Type:** Recommendation
**Area:** Polish — Minimap
**Priority:** P3-Low

**Content:**
A minimap would strongly support spatial memory:
- Always shows the full canvas structure
- Current viewport indicator shows "where you are"
- Click to navigate

**Benefits for Stefan:**
- "I know the blue conversation node is in the top-right corner"
- Minimap confirms this without scrolling/searching
- Supports "knowing WHERE things are"

**Implementation consideration:**
Minimap should be:
- Toggleable (not forced)
- Position: corner of screen
- Interaction: click to jump, drag to pan
- Visual: shows node colors, not details

**React Flow has minimap support built-in** — likely just needs enabling.

**Next:**
Check if React Flow minimap is configured

---

## Iteration 16

**Type:** Validation
**Area:** Spatial Cognition — Minimap
**Priority:** P1-High

**Content:**
Verified: Minimap IS implemented and has thoughtful features:

**CollapsibleMinimap.tsx features:**
- ✅ Uses React Flow's MiniMap component
- ✅ Draggable (can position anywhere)
- ✅ Collapsible (toggle visibility)
- ✅ Streaming pulse animation on minimap nodes

**This strongly supports Stefan's spatial workflow:**
- Always available spatial reference
- Shows structure without detail
- Streaming indicator visible at overview level

**Minor enhancement opportunity:**
Add keyboard shortcut to toggle minimap (M key?). This supports "I know I can press M to see the map."

**Context Gathered:**
- CollapsibleMinimap.tsx exists
- animations.css has minimap-pulse animation for streaming
- Minimap styled with GUI panel colors

**Next:**
Audit undo/redo feedback for action confidence

---

## Iteration 17

**Type:** Observation
**Area:** Feedback Loops — Undo/Redo
**Priority:** P2-Medium

**Content:**
Undo/redo (Ctrl+Z, Ctrl+Shift+Z) is critical for reducing anxiety around actions:

**Why this matters for Stefan:**
- "What if I break something?" prevents action initiation
- Knowing undo exists reduces fear
- But undo must be VISIBLE to be reassuring

**Questions to verify:**
1. Is there an undo history panel or indicator?
2. Does undo show WHAT was undone? (Toast notification?)
3. How many levels of undo are supported?
4. Are all actions undoable, or only some?

**Recommendation:**
Add subtle toast on undo: "Undid: Delete 3 nodes" — confirms action was reversed.

**Next:**
Check undo implementation and feedback

---

## Iteration 18

**Type:** Observation
**Area:** Accessibility — Focus Management
**Priority:** P1-High

**Content:**
Keyboard navigation requires proper focus management:

**Current state (from KeyboardShortcutsHelp):**
- Tab cycles through nodes
- Shift+Tab cycles backwards
- Arrow keys navigate to nearest node in direction

**Questions:**
1. Is focus ring visible on focused node?
2. Does focus persist after actions? (After delete, where does focus go?)
3. Can user focus the canvas itself? (For keyboard-only canvas operations)
4. Is focus trapped in modals? (Command palette, shortcuts help)

**Design principle:**
Focus should NEVER be lost. After every action, focus should be somewhere predictable.

**Next:**
Audit focus ring visibility in node styles

---

## Iteration 19

**Type:** Recommendation
**Area:** Accessibility — Focus Ring Consistency
**Priority:** P2-Medium

**Content:**
All interactive elements need visible focus indicators:

**Elements needing focus rings:**
- Nodes (when keyboard-focused)
- Toolbar buttons
- Panel buttons
- Menu items
- Input fields
- Dialog buttons

**Focus ring style should be consistent:**
```css
:focus-visible {
  outline: 2px solid var(--gui-focus-ring);
  outline-offset: 2px;
}
```

**Important:**
Don't hide focus rings (`:focus { outline: none }` is an anti-pattern). Use `:focus-visible` to show rings only on keyboard navigation.

**Next:**
Audit error states across the application

---

## Iteration 20

**Type:** Observation
**Area:** Information Architecture — Error States
**Priority:** P1-High

**Content:**
When things go wrong, how does the user know?

**Error scenarios to audit:**
1. API call fails (no API key, network error)
2. Save fails (disk full, permissions)
3. Node creation fails (invalid data)
4. Connection fails (invalid edge)
5. Import fails (corrupt file)

**For each error:**
- Is there visual feedback?
- Is the error message helpful?
- Is there a recovery action?
- Does it block the user or allow continuation?

**Stefan-specific concern:**
Error messages can trigger shame spiral. Messages should be:
- Non-blaming ("Connection unavailable" not "You did something wrong")
- Action-oriented ("Try again" not just "Failed")
- Brief (don't overwhelm with technical details)

**Next:**
Check error handling in API calls

---

## Iteration 21

**Type:** Observation
**Area:** Information Architecture — Loading States
**Priority:** P2-Medium

**Content:**
Loading states communicate "something is happening, wait":

**Scenarios needing loading states:**
1. Opening a workspace file
2. Saving workspace
3. API initialization
4. Large canvas render
5. Exporting data

**Design requirements:**
- Loading should be VISIBLE (not just cursor change)
- Loading should indicate WHAT is loading
- Long operations should show progress (not just spinner)
- User should be able to CANCEL if possible

**Skeleton loading for canvas:**
When opening a large workspace, consider skeleton nodes that populate with content progressively.

**Next:**
Audit empty states (no nodes, no messages, no results)

---

## Iteration 22

**Type:** Recommendation
**Area:** Information Architecture — Empty States
**Priority:** P2-Medium

**Content:**
Empty states are opportunities for guidance:

**Empty state scenarios:**
1. ✅ Empty canvas — EmptyCanvasHint (already implemented)
2. ❓ Empty conversation — No messages yet
3. ❓ Empty search results — Command palette finds nothing
4. ❓ Empty task list — No tasks in node
5. ❓ No API key configured — Setup needed

**Each empty state should:**
- Explain why it's empty
- Suggest ONE clear next action
- Use illustration/icon to soften the blankness

**Example for empty conversation:**
"Start typing to send your first message to Claude"
[Input field is focused and ready]

**Next:**
Audit sidebar/panel toggle for discoverability

---

## Iteration 23

**Type:** Observation
**Area:** Information Architecture — Sidebar Toggle
**Priority:** P2-Medium

**Content:**
The sidebar (Ctrl+\\) contains important functionality. Its visibility affects workflow:

**Questions:**
1. What's in the sidebar? (Chat panel? Settings? File browser?)
2. Is sidebar state persisted? (Remembers open/closed)
3. Is the toggle button visible when sidebar is closed?
4. Can sidebar be resized?

**For Stefan's spatial workflow:**
- Sidebar should NOT cover canvas content (use split layout, not overlay)
- Sidebar position should be consistent (always same side)
- Sidebar width should affect canvas viewport, not hide content

**Next:**
Check sidebar implementation and behavior

---

## Iteration 24

**Type:** Recommendation
**Area:** Consistency — Keyboard Shortcut Patterns
**Priority:** P2-Medium

**Content:**
Audit keyboard shortcut consistency:

**Pattern analysis:**
- Ctrl+key: System actions (save, undo, copy)
- Shift+key: Quick create (N, C, T, P, A)
- Single key: Mode toggles (F, B, G, ?)
- Arrow keys: Navigation

**Potential inconsistencies to check:**
1. Is Ctrl+K (command palette) vs K (something else)?
2. Are all single-key shortcuts safe from accidental activation?
3. What happens if you're typing and press a shortcut key?

**Protection against accidental shortcuts:**
Shortcuts should be disabled when:
- Input field is focused
- Modal is open
- User is in "edit mode" on a node

**Next:**
Audit input field focus detection

---

## Iteration 25

**Type:** Observation
**Area:** Consistency — Node Type Visual Language
**Priority:** P1-High

**Content:**
8 node types exist with distinct colors. Is the visual language consistent?

**Node types and colors (from tokens):**
- Conversation: Blue/Cyan
- Note: Amber/Yellow
- Task: Green
- Project: Purple
- Artifact: Pink
- Context: (TBD)
- Action: (TBD)
- Agent: (TBD)

**For each node type, verify:**
1. Color is consistently used (border, icon, badge)
2. Icon represents the type clearly
3. Visual weight is appropriate (conversations heavier than notes?)
4. Selected state maintains type identification

**Spatial memory implication:**
"The purple ones are projects" should be learnable and consistent.

**Next:**
Check node type visual consistency in styleguide

---

## Iteration 26

**Type:** Observation
**Area:** Polish — Animation Timing
**Priority:** P3-Low

**Content:**
Animations affect perceived quality and can support or hinder focus:

**Animation categories:**
1. **Entrance** — Nodes appearing (spawn animation)
2. **Exit** — Nodes disappearing (delete)
3. **State change** — Selection, focus, streaming
4. **Feedback** — Button clicks, hovers
5. **Motion** — Panning, zooming

**Timing principles:**
- Entrance: 200-300ms ease-out (feels snappy)
- Exit: 150-200ms ease-in (quick departure)
- State change: 100-150ms (instant feeling)
- Motion: Match user input (no delay)

**Reduced motion support:**
All animations should respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

**Next:**
Verify reduced motion support in animations.css

---

## Iteration 27

**Type:** Validation
**Area:** Accessibility — Reduced Motion
**Priority:** P2-Medium

**Content:**
Checking reduced motion support...

**From animations.css reference:**
The styleguide specifies `prefers-reduced-motion` support exists. This needs verification in actual CSS.

**Required behavior:**
- Animations become instant (not removed)
- Transitions still happen (just no motion)
- Content remains accessible

**This is critical because:**
- Vestibular disorders can cause nausea from animation
- Some users find animation distracting
- Compliance with WCAG 2.1

**Next:**
Audit color contrast for accessibility compliance

---

## Iteration 28

**Type:** Observation
**Area:** Accessibility — Color Contrast
**Priority:** P1-High

**Content:**
WCAG requires minimum contrast ratios:
- Normal text: 4.5:1
- Large text: 3:1
- UI components: 3:1

**Areas to audit:**
1. Text on node backgrounds
2. Icon visibility
3. Border visibility
4. Disabled state text
5. Placeholder text

**Specific concerns:**
- Low opacity text (gui-text-muted at 60%?)
- Node colors in light theme vs dark theme
- Edge colors against canvas background

**Tool recommendation:**
Use WebAIM contrast checker or browser dev tools accessibility tab to verify each color pair.

**Next:**
Audit touch target sizes for touch devices

---

## Iteration 29

**Type:** Observation
**Area:** Accessibility — Touch Targets
**Priority:** P3-Low (desktop app, but future-proofing)

**Content:**
Touch target minimum size: 44x44px (Apple HIG), 48x48dp (Material)

**Elements to audit:**
1. Toolbar buttons
2. Node resize handles
3. Edge connection handles
4. Close buttons (X)
5. Minimap interactions

**Current concern:**
Some UI elements may be optimized for mouse precision, making touch difficult.

**Recommendation:**
Even for desktop app, slightly larger targets benefit:
- Trackpad users
- Users with motor impairments
- Future touch/tablet support

**Next:**
Audit responsive behavior (window resize)

---

## Iteration 30

**Type:** Observation
**Area:** Polish — Window Resize Behavior
**Priority:** P3-Low

**Content:**
When the window is resized, what happens?

**Questions:**
1. Does canvas viewport maintain position?
2. Do panels resize proportionally?
3. Is there a minimum window size?
4. Does the layout break at narrow widths?

**Expected behavior:**
- Canvas should maintain center point
- Sidebar should have minimum width before collapsing
- Toolbar should remain accessible
- No content should be cut off

**This is particularly important if:**
- Stefan uses split-screen with other apps
- External monitor is connected/disconnected
- Window is snapped to half-screen

**Next:**
Audit drag-and-drop interactions

---

## Iteration 31

**Type:** Observation
**Area:** Initiation & Action — Drag and Drop
**Priority:** P2-Medium

**Content:**
Drag interactions in a canvas app:

**Drag scenarios:**
1. Drag node to move it
2. Drag canvas to pan
3. Drag selection box to multi-select
4. Drag from handle to create edge
5. Drag file onto canvas (import)

**Questions for each:**
- Is the affordance clear? (Cursor change, visual hint)
- Is there feedback during drag? (Ghost preview)
- What happens on drop? (Visual confirmation)
- What if drop is invalid? (Error handling)

**Stefan-specific concern:**
Drag requires sustained motor control. Consider:
- Large grab areas on nodes
- Clear visual feedback during drag
- Easy way to cancel drag (Escape)

**Next:**
Audit selection behavior for predictability

---

## Iteration 32

**Type:** Observation
**Area:** Consistency — Selection Behavior
**Priority:** P1-High

**Content:**
Selection is fundamental. It must be predictable.

**Selection questions:**
1. Click node = select (deselect others)
2. Ctrl+click = add to selection
3. Shift+click = range select? (How in spatial canvas?)
4. Click canvas = deselect all
5. 'A' key = select all

**Multi-selection visual:**
- Each selected node has ring/highlight
- Selection count shown somewhere?
- Can see which nodes are selected at a glance

**Issue to check:**
What's the visual difference between:
- Focused node (keyboard navigation)
- Selected node (click selection)
- Both focused AND selected

These should be visually distinct.

**Next:**
Audit pin-to-screen feature for utility

---

## Iteration 33

**Type:** Observation
**Area:** Spatial Cognition — Pin to Screen
**Priority:** P2-Medium

**Content:**
"Pin to screen" (P key) keeps a node visible regardless of canvas pan/zoom.

**Use cases:**
- Keep reference material visible while working elsewhere
- Dashboard mode (pinned status nodes)
- Compare two distant nodes

**Questions:**
1. Where does pinned node appear? (Corner? Float?)
2. Can multiple nodes be pinned?
3. Is pinned state visually indicated on the node?
4. What's the interaction with pinned nodes? (Can edit? Or view-only?)

**For Stefan:**
This is powerful for spatial workflows:
- "I know my context node is always in the bottom-right"
- Consistent position = spatial memory anchor

**Enhancement idea:**
Let user choose pin position (top-left, top-right, etc.) to build personal spatial conventions.

**Next:**
Audit toast notifications for feedback clarity

---

## Iteration 34

**Type:** Observation
**Area:** Feedback Loops — Toast Notifications
**Priority:** P2-Medium

**Content:**
Toasts provide transient feedback. They confirm actions.

**Toast scenarios (from code: sciFiToast):**
- Focus mode entered/exited
- Bookmark toggled
- Save completed
- Error occurred
- Undo/redo performed

**Toast requirements:**
1. Position: Consistent (bottom-right? top-center?)
2. Duration: Long enough to read (2-3 seconds)
3. Style: Matches app theme
4. Action: Some toasts need "Undo" action
5. Queue: Multiple toasts don't overlap

**Accessibility:**
Toasts should be announced to screen readers (`role="alert"` or ARIA live region).

**Next:**
Audit data persistence and autosave

---

## Iteration 35

**Type:** Observation
**Area:** Information Architecture — Autosave
**Priority:** P1-High

**Content:**
Does the workspace autosave? This affects anxiety levels.

**Autosave questions:**
1. Is autosave enabled by default?
2. How often? (Every change? Every 30 seconds? On idle?)
3. Is there a save indicator? ("Saved" / "Saving..." / "Unsaved changes")
4. Can user see when last saved?
5. What if autosave fails?

**For Stefan:**
- Fear of losing work blocks action
- Visible "Saved" indicator reduces anxiety
- "Unsaved" warning before close is essential

**Recommendation:**
Show small "Saved ✓" or "Saving..." indicator in corner. Update in real-time.

**Next:**
Audit workspace file management (open, save, recent)

---

## Iteration 36

**Type:** Observation
**Area:** Information Architecture — File Management
**Priority:** P2-Medium

**Content:**
Workspace file operations:

**Keyboard shortcuts (from help):**
- N: New workspace
- O: Open workspace
- Ctrl+S: Save workspace
- Ctrl+Shift+E: Save as / Export

**Questions:**
1. Where are workspaces saved? (User-chosen? App data folder?)
2. Is there a recent files list?
3. Can user see current workspace name/path?
4. What file format? (.cognograph? .json?)

**For Stefan:**
- "Where did I save that?" is a common pain point
- Recent files list reduces search friction
- Current file name in title bar gives context

**Next:**
Audit import/export capabilities

---

## Iteration 37

**Type:** Observation
**Area:** Information Architecture — Import/Export
**Priority:** P3-Low

**Content:**
Getting data in and out:

**Import possibilities:**
- Markdown files → Note nodes
- JSON → Full workspace
- Images → Artifact nodes
- Clipboard → Paste as node

**Export possibilities:**
- Workspace → JSON
- Conversation → Markdown
- Canvas → Image/PDF
- Selection → Partial export

**For Stefan:**
- May want to share specific conversations
- May want to backup to cloud
- Integration with other tools

**Friction reduction:**
Drag-and-drop import is lowest friction: Drag a .md file onto canvas → becomes Note node.

**Next:**
Audit conversation flow (sending messages)

---

## Iteration 38

**Type:** Observation
**Area:** Initiation & Action — Message Sending
**Priority:** P0-Critical

**Content:**
Sending a message to Claude is THE core action. It must be frictionless.

**Questions:**
1. Where is the input field? (In node? In sidebar? Both?)
2. How to send? (Enter? Ctrl+Enter? Button?)
3. Is there visual feedback on send?
4. What if message fails to send?
5. Can you edit a sent message?

**For Stefan:**
- Input should be immediately visible when node is selected
- Send action should be obvious (big button? Clear shortcut?)
- "Did it send?" anxiety → clear confirmation

**Ideal flow:**
1. Select conversation node
2. Input auto-focused
3. Type message
4. Press Enter to send
5. See message appear + streaming indicator
6. Response streams in

**Next:**
Audit context injection for conversations

---

## Iteration 39

**Type:** Observation
**Area:** Spatial Cognition — Context Injection
**Priority:** P0-Critical

**Content:**
Context injection is the KILLER FEATURE of the spatial CLI vision:
- Connect nodes to conversation
- Their content becomes context for Claude

**Questions:**
1. How do you add context to a conversation? (Edge? Menu? Drag?)
2. Is context visually indicated on the conversation node?
3. Can you see WHAT context is active?
4. Can you temporarily disable context without removing edge?
5. What's the token count of context?

**For Stefan:**
"I know the blue conversation has context from the yellow note and the green task" — spatial relationships become visible.

**Visual representation:**
- Edges into conversation node = context sources
- Edge color/thickness could indicate context amount
- Badge on node showing context token count

**Next:**
Audit context token visibility and limits

---

## Iteration 40

**Type:** Observation
**Area:** Information Architecture — Token Management
**Priority:** P1-High

**Content:**
Claude has context limits. Users need to understand this.

**Token questions:**
1. Is current token usage visible?
2. Is there a warning as limit approaches?
3. What happens when limit exceeded? (Truncation? Error?)
4. Can user see which context sources use most tokens?

**Visualization ideas:**
- Token meter on conversation node
- Color gradient: Green → Yellow → Red as filling up
- Tooltip showing breakdown by source

**For Stefan:**
Understanding "why did Claude forget that?" reduces frustration. Token visibility helps.

**Next:**
Audit multi-conversation management

---

## Iteration 41

**Type:** Observation
**Area:** Spatial Cognition — Multiple Conversations
**Priority:** P1-High

**Content:**
Stefan can have multiple conversations on canvas. This is core to the spatial CLI vision.

**Questions:**
1. How are different conversations distinguished?
2. Can they share context? (Same note connected to two conversations)
3. Is there a concept of "active" conversation?
4. How to quickly switch between conversations?

**For spatial memory:**
- Position matters: "The Claude conversation about code is on the left, the one about design is on the right"
- Color coding? Different shades of blue for different conversations?

**Enhancement opportunity:**
Let user name/color conversations for easier spatial identification:
- "Code Review" conversation (dark blue)
- "Architecture" conversation (light blue)
- "Debugging" conversation (red-tinted blue?)

**Next:**
Audit conversation history and message management

---

## Iteration 42

**Type:** Observation
**Area:** Information Architecture — Conversation History
**Priority:** P2-Medium

**Content:**
Within a conversation, message history matters:

**Questions:**
1. How many messages are visible?
2. Can you scroll through history?
3. Is there message search within conversation?
4. Can you collapse/expand long messages?
5. Can you delete individual messages?

**For long conversations:**
- Scrolling through 100+ messages is tedious
- Need navigation aids (jump to date, search, bookmarked messages)

**Spatial extension:**
Could important messages be "extracted" to the canvas as linked notes? This supports "I remember the key insight is somewhere" without re-reading the whole conversation.

**Next:**
Audit the chat panel interaction design

---

## Iteration 43

**Type:** Observation
**Area:** Initiation & Action — Chat Panel
**Priority:** P1-High

**Content:**
The chat panel (sidebar?) is where message interaction happens:

**Questions:**
1. What triggers chat panel open? (Select conversation node?)
2. Can chat panel be resized?
3. Is input always visible? (No scroll required?)
4. Are action buttons clear? (Send, stop, regenerate)

**Ideal interaction:**
- Click conversation node → Chat panel opens automatically
- Focus goes to input field
- Previous messages visible above
- Clear send button (and Enter shortcut)

**Friction points to avoid:**
- Having to click twice (node, then panel)
- Input field hidden below fold
- Ambiguous send vs newline (Enter vs Shift+Enter)

**Next:**
Audit toolbar layout and discoverability

---

## Iteration 44

**Type:** Observation
**Area:** Information Architecture — Toolbar
**Priority:** P2-Medium

**Content:**
The toolbar contains common actions. Its design affects discoverability.

**Questions:**
1. What's in the toolbar?
2. Are icons clear without labels?
3. Is there tooltip on hover?
4. Can toolbar be customized?
5. Does toolbar hide at certain canvas zoom?

**For Stefan:**
- Toolbar should have CONSISTENT position (always same place)
- Most-used actions should be leftmost
- Icons should be learnable (not cryptic)

**Grouping:**
- File actions (new, open, save)
- Edit actions (undo, redo)
- View actions (zoom, minimap toggle)
- Create actions (shortcut to node creation)

**Next:**
Audit tooltips across the application

---

## Iteration 45

**Type:** Observation
**Area:** Information Architecture — Tooltips
**Priority:** P2-Medium

**Content:**
Tooltips reveal hidden information on hover:

**Tooltip requirements:**
1. Delay: Not too fast (annnoying), not too slow (useless) — 300-500ms
2. Content: Action name + keyboard shortcut
3. Position: Doesn't cover the element
4. Duration: Long enough to read
5. Touch: Alternative for non-hover devices

**For Stefan:**
Tooltips reduce memory load: "What does this button do?" → hover → see.

**Consistency:**
Every interactive element should have a tooltip with:
- What it does (2-3 words)
- Keyboard shortcut if applicable

**Example:**
[Bookmark icon] → "Toggle bookmark (B)"

**Next:**
Audit modal dialogs for escapability

---

## Iteration 46

**Type:** Observation
**Area:** Initiation & Action — Modal Dialogs
**Priority:** P2-Medium

**Content:**
Modals interrupt flow. They need careful design.

**Modal scenarios:**
1. Confirm destructive action (delete workspace)
2. Settings dialog
3. Keyboard shortcuts help
4. File open/save dialogs

**Escapability requirements:**
- Escape key closes modal
- Click outside closes modal (unless dangerous)
- Clear close button (X)
- Focus trapped inside modal

**For Stefan:**
- Modals can be anxiety-inducing (forced decision)
- Always provide escape route
- Avoid modal chains (one modal opening another)

**Good modal:**
- Title explains what's being asked
- Clear primary action button
- Clear cancel/close option
- No surprises

**Next:**
Audit destructive action confirmation

---

## Iteration 47

**Type:** Observation
**Area:** Information Architecture — Destructive Actions
**Priority:** P1-High

**Content:**
Destructive actions need confirmation but shouldn't over-confirm:

**Destructive actions:**
- Delete node(s)
- Delete workspace
- Clear conversation history
- Disconnect all edges

**Confirmation levels:**
1. **None** (undoable) — Single node delete: just do it, rely on undo
2. **Soft confirm** — Delete multiple nodes: "Delete 5 nodes?" with single click
3. **Hard confirm** — Delete workspace: Require typing name or checkbox

**For Stefan:**
- Over-confirmation is friction
- Under-confirmation causes anxiety
- Sweet spot: Confirm only what can't be easily undone

**Undo is the best confirmation:**
If undo is robust, most actions don't need confirmation.

**Next:**
Audit the settings interface

---

## Iteration 48

**Type:** Observation
**Area:** Information Architecture — Settings
**Priority:** P2-Medium

**Content:**
Settings allow customization. But too many settings is overwhelming.

**Questions:**
1. How do you access settings?
2. How are settings organized?
3. Are defaults sensible? (Can user ignore settings entirely?)
4. Can settings be reset to default?
5. Are settings saved per-workspace or globally?

**For Stefan:**
- Settings should be "set once, forget"
- Sane defaults mean he never NEEDS to visit settings
- If he does visit, organization should be clear

**Good settings structure:**
- Appearance (theme, font size, animations)
- Behavior (autosave, confirmations)
- Keyboard (shortcuts customization)
- API (Claude key, preferences)

**Next:**
Audit API key setup flow

---

## Iteration 49

**Type:** Observation
**Area:** Initiation & Action — API Setup
**Priority:** P0-Critical

**Content:**
Before using Claude, user needs API key. This is first-run friction.

**Ideal setup flow:**
1. Open app → Clear message: "Enter your Anthropic API key to start"
2. Link to "Get API key" (opens Anthropic console)
3. Paste key
4. Validate key (make test call)
5. Show success → Ready to use

**Error cases:**
- Invalid key: Clear error message with "Check your key" hint
- No network: "Can't verify key, check connection"
- Rate limit: Explain what this means

**For Stefan:**
Setup should happen ONCE. App should remember key securely.

**Security consideration:**
Key stored locally, never sent anywhere except Anthropic.

**Next:**
Audit first-run experience (onboarding)

---

## Iteration 50

**Type:** Observation
**Area:** Initiation & Action — Onboarding
**Priority:** P1-High

**Content:**
First-run experience sets expectations and reduces initial overwhelm.

**Onboarding elements:**
1. EmptyCanvasHint (already exists) ✅
2. API key setup (needs check)
3. Feature tour? (Optional guided walkthrough)
4. Sample workspace? (Pre-made example)

**For Stefan:**
- Onboarding should be OPTIONAL (not forced tour)
- Can be dismissed immediately
- Available to re-access later ("Show hints again")

**Ideal first-run:**
1. API key setup (if needed)
2. Canvas with EmptyCanvasHint
3. Maybe a "Would you like to see a 2-minute tour?" (skippable)

**Next:**
Audit command palette command organization

---

## Iteration 51

**Type:** Observation
**Area:** Information Architecture — Command Categories
**Priority:** P2-Medium

**Content:**
The command palette needs good organization:

**Suggested categories:**
- Create (new node types)
- Edit (copy, paste, delete, undo)
- View (zoom, focus, minimap)
- Navigate (go to bookmark, jump to node)
- File (new, open, save, export)
- Settings (open settings)

**Fuzzy search:**
User types partial text → matches shown
"conv" → "Create Conversation", "Go to Conversation"

**Recent commands:**
Show most recently used commands at top (muscle memory building)

**Next:**
Audit command palette keyboard navigation

---

## Iteration 52

**Type:** Observation
**Area:** Accessibility — Command Palette Navigation
**Priority:** P2-Medium

**Content:**
Command palette should be fully keyboard-navigable:

**Expected behavior:**
1. Ctrl+K opens palette
2. Type to filter
3. Arrow keys to navigate results
4. Enter to execute
5. Escape to close

**Questions:**
- Is active item highlighted?
- Can you navigate categories separately?
- What happens with no results?

**Enhancement:**
Show keyboard shortcut next to command in results:
"Create Conversation                    Shift+C"

This teaches shortcuts through the palette.

**Next:**
Audit node resize interaction

---

## Iteration 53

**Type:** Observation
**Area:** Initiation & Action — Node Resizing
**Priority:** P2-Medium

**Content:**
Nodes may be resizable for spatial layout purposes:

**Questions:**
1. Can nodes be resized?
2. What are resize handles? (Corners? Edges?)
3. Is there minimum size?
4. Does content reflow on resize?
5. Is there aspect ratio lock option?

**For Stefan:**
- Larger nodes = more important (visual hierarchy)
- Consistent sizing helps spatial memory
- Auto-fit option useful: "Resize to fit content"

**From keyboard shortcuts:**
"Ctrl+Dbl-click: Auto-fit node width to title"

This suggests resize exists. Need to verify visual affordance.

**Next:**
Audit node title editing

---

## Iteration 54

**Type:** Observation
**Area:** Initiation & Action — Title Editing
**Priority:** P2-Medium

**Content:**
Editing node titles should be frictionless:

**Questions:**
1. How to start editing? (Double-click? F2 key?)
2. Is editing inline or modal?
3. How to confirm edit? (Enter? Click away?)
4. What if title is very long?

**Ideal flow:**
1. Double-click title (or F2)
2. Title becomes editable inline
3. Text selected for easy replacement
4. Enter confirms, Escape cancels
5. Click away confirms

**For Stefan:**
Node titles ARE spatial memory anchors:
"The one called 'Architecture Review' is top-left"

Easy renaming supports this workflow.

**Next:**
Audit visual hierarchy between node types

---

## Iteration 55

**Type:** Observation
**Area:** Spatial Cognition — Visual Hierarchy
**Priority:** P1-High

**Content:**
Different node types have different importance. Visual hierarchy should reflect this.

**Hierarchy considerations:**
- Conversations (primary) → Heavier visual weight
- Notes (supporting) → Lighter weight
- Tasks (actionable) → Clear status indication
- Projects (organizational) → Container-like feel

**Visual weight tools:**
- Size
- Color saturation
- Border thickness
- Shadow depth
- Icon prominence

**For Stefan:**
Visual hierarchy supports scanning:
"Where's the main conversation?" → Spot the heaviest element.

**Next:**
Audit Project node as container concept

---

## Iteration 56

**Type:** Observation
**Area:** Spatial Cognition — Project as Container
**Priority:** P2-Medium

**Content:**
Project nodes should visually "contain" related nodes:

**Questions:**
1. Can nodes be nested inside projects?
2. Is there visual grouping? (Shared background?)
3. Does moving project move contained nodes?
4. Can you collapse a project?

**For Stefan:**
Projects as containers support the spatial CLI vision:
"All the marketing stuff is in the purple project area"

**Visual container options:**
- Shared background color (light purple for purple project)
- Border that encloses contained nodes
- Collapse to show only project node (hide contents)

**Next:**
Audit Task node status display

---

## Iteration 57

**Type:** Observation
**Area:** Information Architecture — Task Status
**Priority:** P2-Medium

**Content:**
Task nodes need clear status indication:

**Task states:**
- Todo (not started)
- In Progress
- Blocked
- Done
- Cancelled

**Visual encoding:**
- Icon change (checkbox, arrow, checkmark)
- Color change (gray → blue → green)
- Badge/pill indicator
- Strike-through for done?

**Interaction:**
Click checkbox → Toggle done?
Quick status change without opening panel?

**For Stefan:**
Tasks support external structure (knowing what's next).
Status should be visible at a glance.

**Next:**
Audit Artifact node content preview

---

## Iteration 58

**Type:** Observation
**Area:** Information Architecture — Artifact Preview
**Priority:** P2-Medium

**Content:**
Artifact nodes contain generated content (code, documents, etc.):

**Preview questions:**
1. Is content previewed on the node?
2. Is preview syntax-highlighted for code?
3. Is there truncation for long content?
4. Can you expand to full view?

**For Stefan:**
"The green one is the code artifact" → needs to be recognizable.

**Preview enhancements:**
- Code: First few lines with syntax highlighting
- Document: Title + first paragraph
- Image: Thumbnail
- Data: Table preview

**Next:**
Audit Context node role and display

---

## Iteration 59

**Type:** Observation
**Area:** Spatial Cognition — Context Node
**Priority:** P2-Medium

**Content:**
Context nodes are special: they represent "what Claude knows":

**Questions:**
1. Is Context a distinct node type?
2. How is it visualized?
3. Can you see what's IN the context?
4. Is it auto-generated or user-created?

**Possible roles:**
- System prompt storage
- Shared context across conversations
- Reference material (always included)

**For Stefan:**
"That orange context node is my coding guidelines" → spatial reference for persistent context.

**Next:**
Audit Action node behavior

---

## Iteration 60

**Type:** Observation
**Area:** Information Architecture — Action Node
**Priority:** P2-Medium

**Content:**
Action nodes represent executable actions:

**Questions:**
1. What kinds of actions?
2. How do you trigger an action?
3. Is there success/failure indication?
4. Can actions be chained? (Workflows)

**Possible actions:**
- Run code
- Execute shell command
- Call external API
- Generate file

**For Stefan:**
"Click that action node to run the script" → direct spatial interaction.

**Safety:**
Destructive actions need confirmation.
Clear indication of what will happen.

**Next:**
Audit Agent node concept

---

## Iteration 61

**Type:** Observation
**Area:** Information Architecture — Agent Node
**Priority:** P2-Medium

**Content:**
Agent nodes may represent autonomous processes:

**Questions:**
1. What does an Agent node do?
2. Is it Claude with specific configuration?
3. Can agents run in background?
4. How do you configure agent behavior?

**For Stefan:**
"That agent handles code review automatically" → persistent helper.

**Visual indication:**
- Activity indicator (pulse when working)
- Status (idle, running, error)
- Configuration accessible

**Next:**
Audit edge types and visualization

---

## Iteration 62

**Type:** Observation
**Area:** Spatial Cognition — Edge Types
**Priority:** P1-High

**Content:**
Edges represent relationships. Different relationships need different visuals.

**Possible edge types:**
- Context edge (provides context to conversation)
- Reference edge (node references another)
- Dependency edge (task depends on task)
- Sequence edge (order/flow)

**Visual encoding:**
- Style: Solid vs dashed vs dotted
- Color: Match source or target color?
- Thickness: Importance/frequency
- Arrow: Direction of relationship

**For Stefan:**
"The thick line means heavy context injection"
"Dashed lines are references, solid are dependencies"

This makes relationships spatially memorable.

**Next:**
Audit edge interaction (selection, deletion)

---

## Iteration 63

**Type:** Observation
**Area:** Initiation & Action — Edge Interaction
**Priority:** P2-Medium

**Content:**
Interacting with edges should be intuitive:

**Questions:**
1. How to select an edge? (Click on it)
2. Is the click area generous? (Lines are thin)
3. How to delete an edge? (Select + Delete key)
4. How to see edge properties?
5. Can you edit edge type/style?

**Usability concern:**
Edges are hard to click precisely. Solutions:
- Hover highlight with generous hitbox
- Click highlights all connected edges from node
- Edge inspector panel when selected

**For Stefan:**
Edge management shouldn't require precision pointing.

**Next:**
Audit multi-select edge operations

---

## Iteration 64

**Type:** Observation
**Area:** Consistency — Bulk Operations
**Priority:** P2-Medium

**Content:**
When multiple items are selected, what operations are available?

**Bulk operations:**
- Delete all selected
- Move together
- Link all together (from shortcuts: Ctrl+L)
- Unlink all (Ctrl+Shift+L)
- Copy/cut selection
- Change type (convert notes to tasks?)

**Questions:**
1. Are all bulk operations discoverable?
2. Is there visual feedback showing what's selected?
3. Does selection count appear somewhere?

**For Stefan:**
"I want to connect all these at once" → Ctrl+L
"I want to delete this whole group" → Delete

Bulk operations reduce repetitive actions.

**Next:**
Audit layout and alignment tools

---

## Iteration 65

**Type:** Recommendation
**Area:** Spatial Cognition — Layout Tools
**Priority:** P2-Medium

**Content:**
Spatial organization benefits from alignment/distribution tools:

**Useful layout operations:**
- Align left/center/right
- Align top/middle/bottom
- Distribute horizontally
- Distribute vertically
- Snap to grid

**Questions:**
1. Do these exist?
2. How to access? (Menu? Keyboard?)
3. Is there a grid for guidance?

**For Stefan:**
Clean spatial organization supports memory:
"Everything in a neat row" is easier to remember than "scattered."

**Enhancement:**
Hold Shift while dragging to constrain to axis.
Smart guides (lines showing alignment with other nodes).

**Next:**
Audit canvas background and grid

---

## Iteration 66

**Type:** Observation
**Area:** Polish — Canvas Background
**Priority:** P3-Low

**Content:**
Canvas background affects spatial perception:

**Options:**
1. Solid color
2. Subtle grid (helps with alignment)
3. Dots pattern (common in design tools)
4. Gradient (indicates "infinite" space)

**Questions:**
1. What's the current background?
2. Can user customize it?
3. Is grid snap optional?

**For Stefan:**
Grid can help organize but might also feel constraining.
Should be optional or very subtle.

**Next:**
Audit status bar / information display

---

## Iteration 67

**Type:** Observation
**Area:** Information Architecture — Status Bar
**Priority:** P3-Low

**Content:**
A status bar shows ambient information:

**Possible status bar content:**
- Zoom level
- Selection count
- Workspace name / Saved status
- API status (connected/disconnected)
- Coordinates (maybe overkill)

**Questions:**
1. Does a status bar exist?
2. Where is it positioned?
3. Is it always visible or contextual?

**For Stefan:**
Ambient information reduces anxiety:
"Is it saved?" → Glance at status bar.

**Next:**
Audit notification system (beyond toasts)

---

## Iteration 68

**Type:** Observation
**Area:** Feedback Loops — Notifications
**Priority:** P2-Medium

**Content:**
Beyond toasts, are there other notification types?

**Notification scenarios:**
- Background task completed
- Error that needs attention
- Update available
- API quota warning

**Notification channels:**
1. Toast (transient)
2. Badge (persistent until addressed)
3. Banner (important, dismissable)
4. Sound (optional, for severe ADHD)

**For Stefan:**
Notifications should interrupt minimally.
Opt-in sounds could help with attention drift.

**Next:**
Audit help system accessibility

---

## Iteration 69

**Type:** Observation
**Area:** Information Architecture — Help Access
**Priority:** P2-Medium

**Content:**
How does a user find help?

**Help access points:**
1. ? key for keyboard shortcuts ✅
2. Help menu / About
3. Tooltip help on UI elements
4. Link to documentation
5. In-app tutorials

**Questions:**
1. Is there a central help/docs resource?
2. Is help context-sensitive? (Shows help for what you're doing)
3. Is there search within help?

**For Stefan:**
Help should be accessible without leaving the app.
? key is great start.

**Next:**
Audit theme switching (light/dark)

---

## Iteration 70

**Type:** Observation
**Area:** Accessibility — Theme Support
**Priority:** P2-Medium

**Content:**
Light and dark themes serve different needs:

**Questions:**
1. Are both themes implemented?
2. Is there system-preference detection?
3. Is there manual toggle?
4. Are all components themed correctly?

**For Stefan:**
Theme preference is personal. Some work better in dark for focus, others need light for readability.

**Transition:**
Theme switch should animate smoothly, not flash.

**Styleguide already includes:**
Light/dark theme support with CSS custom properties.

**Next:**
Audit theme transition smoothness

---

## Iteration 71

**Type:** Observation
**Area:** Polish — Theme Transition
**Priority:** P3-Low

**Content:**
Theme switching should be visually smooth:

**Best practice:**
```css
* {
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
```

**But with care:**
- Don't transition everything (performance)
- Canvas elements may need instant switch
- User preference: some want instant, some want smooth

**Next:**
Audit scrolling behavior in panels

---

## Iteration 72

**Type:** Observation
**Area:** Polish — Scroll Behavior
**Priority:** P3-Low

**Content:**
Scrolling in panels (chat, sidebars) should feel good:

**Questions:**
1. Is scroll momentum natural?
2. Is there scroll-to-bottom for new messages?
3. Are scrollbars styled to match theme?
4. Is overscroll behavior handled?

**For Stefan:**
Scroll behavior affects focus:
- Auto-scroll to new messages (conversation panel)
- But don't auto-scroll if user scrolled up (reading history)

**Next:**
Audit click-outside behavior consistency

---

## Iteration 73

**Type:** Observation
**Area:** Consistency — Click Outside
**Priority:** P2-Medium

**Content:**
Click-outside-to-close is a common pattern. It should be consistent.

**Elements that close on click outside:**
- Command palette
- Context menu
- Dropdown menus
- Keyboard shortcuts help
- Modals (usually)

**Consistency questions:**
1. Do all menus close on outside click?
2. Do modals require explicit close?
3. Is Escape key also consistent?

**Exception:**
Some dialogs (like unsaved changes warning) should NOT close on click outside.

**Next:**
Audit copy/paste behavior

---

## Iteration 74

**Type:** Observation
**Area:** Initiation & Action — Copy/Paste
**Priority:** P2-Medium

**Content:**
Copy/paste should feel native:

**Scenarios:**
1. Copy nodes (internal clipboard)
2. Copy text (system clipboard)
3. Paste nodes (from internal or new)
4. Paste text (into input fields)
5. Paste external content (create new node?)

**Questions:**
1. Does Ctrl+C copy selected nodes?
2. Does paste preserve node positions relatively?
3. Can you paste from external app to create node?
4. Is there a "Paste Special" for format options?

**For Stefan:**
Copy-paste is fundamental. Must work exactly as expected.

**Next:**
Audit clipboard state visibility

---

## Iteration 75

**Type:** Observation
**Area:** Feedback Loops — Clipboard State
**Priority:** P2-Medium

**Content:**
When something is in clipboard, user should know:

**Questions:**
1. Is there clipboard indicator?
2. Does it show what's copied?
3. Can you clear clipboard?

**From shortcuts:**
Escape progressively clears: focus mode → clipboard → selection

This implies clipboard state IS tracked.

**Visual options:**
- Small indicator: "📋 2 nodes copied"
- Or toast on copy: "2 nodes copied"

**For Stefan:**
"Did I copy that?" → Quick visual confirmation.

**Next:**
Audit right-click vs context menu consistency

---

## Iteration 76

**Type:** Observation
**Area:** Consistency — Right-Click Behavior
**Priority:** P2-Medium

**Content:**
Right-click should always produce context menu:

**Questions:**
1. Right-click on node → Context menu with node actions?
2. Right-click on edge → Context menu with edge actions?
3. Right-click on canvas → Context menu with create actions?
4. Right-click on selection → Context menu with bulk actions?

**Consistency:**
Context menu should ALWAYS appear on right-click.
Never block or redirect right-click.

**For Stefan:**
Right-click is exploratory: "What can I do here?"
Must always provide options.

**Next:**
Audit double-click behavior consistency

---

## Iteration 77

**Type:** Observation
**Area:** Consistency — Double-Click Behavior
**Priority:** P2-Medium

**Content:**
Double-click is for "primary action":

**Conventions:**
- Double-click node → Edit node title? Open detail panel?
- Double-click canvas → Create conversation (confirmed earlier)
- Double-click edge → ?
- Double-click text → Select word

**Questions:**
1. Is double-click behavior consistent?
2. Is it discoverable? (Users expect double-click to do something)
3. Is there accidental activation protection? (Click didn't become double-click)

**For Stefan:**
Double-click should DO something useful.
If ambiguous, show menu of options.

**Next:**
Audit long-press behavior (for touch)

---

## Iteration 78

**Type:** Observation
**Area:** Accessibility — Long Press
**Priority:** P3-Low (desktop app)

**Content:**
Long-press is the touch equivalent of right-click:

**Questions:**
1. Is long-press supported?
2. Does it trigger context menu?
3. Is there visual feedback during press?

**For future touch support:**
Long-press should equal right-click in all cases.

**Next:**
Audit pinch-to-zoom (for trackpad)

---

## Iteration 79

**Type:** Observation
**Area:** Accessibility — Trackpad Gestures
**Priority:** P2-Medium

**Content:**
Modern trackpads support gestures:

**Gestures:**
- Two-finger scroll → Pan canvas
- Pinch → Zoom in/out
- Two-finger tap → Right-click

**Questions:**
1. Are these supported?
2. Is zoom centered on cursor?
3. Is pan smooth (momentum)?

**For Stefan:**
Trackpad gestures support fluid spatial navigation.
Should feel native to macOS/Windows.

**Next:**
Audit zoom level persistence

---

## Iteration 80

**Type:** Observation
**Area:** Spatial Cognition — Zoom Persistence
**Priority:** P2-Medium

**Content:**
Zoom level and viewport position are spatial memory:

**Questions:**
1. Is zoom level saved with workspace?
2. Is viewport position saved?
3. On open, does workspace restore view?

**For Stefan:**
"I was zoomed in on the left side" → should restore that view.

This is critical for spatial memory. If view resets every open, spatial associations are lost.

**Next:**
Audit node position persistence

---

## Iteration 81

**Type:** Observation
**Area:** Spatial Cognition — Position Persistence
**Priority:** P0-Critical

**Content:**
Node positions ARE the spatial memory. They MUST persist.

**Questions:**
1. Are node positions saved with workspace?
2. Are positions exact or approximate?
3. Do positions survive undo/redo?
4. Are positions in global coordinates or viewport-relative?

**This is foundational:**
If Stefan opens workspace and nodes are rearranged, the spatial CLI vision fails completely.

"Knowing WHERE things are" requires positions to be stable.

**Next:**
Audit workspace format and portability

---

## Iteration 82

**Type:** Observation
**Area:** Information Architecture — Workspace Format
**Priority:** P2-Medium

**Content:**
The workspace file format affects portability:

**Questions:**
1. Is format JSON? (Human-readable, versionable)
2. Is it documented? (Can users understand it?)
3. Is it future-compatible? (Version field for migrations)
4. Is it git-friendly? (Diffable)

**For Stefan:**
Workspaces might be committed to git repos.
Format should be stable and diffable.

**Next:**
Audit git-friendliness of workspace files

---

## Iteration 83

**Type:** Recommendation
**Area:** Information Architecture — Git Integration
**Priority:** P3-Low

**Content:**
Workspaces stored in git benefit from:

**Good practices:**
- Human-readable format (JSON not binary)
- Sorted keys for consistent diffs
- No timestamps that change on every save
- Meaningful diff when content changes

**Bad patterns:**
- Binary blobs
- Changing order randomly
- Auto-generated IDs everywhere

**For Stefan:**
"I can see what changed in this workspace" via git diff.

**Next:**
Audit backup and recovery options

---

## Iteration 84

**Type:** Observation
**Area:** Information Architecture — Backup/Recovery
**Priority:** P2-Medium

**Content:**
What happens if workspace is corrupted?

**Recovery options:**
1. Autosave backups (.cognograph.bak)
2. Version history (local or cloud)
3. Undo history persistence (survive app restart)
4. Export to other formats (JSON, markdown)

**Questions:**
1. Are backups automatic?
2. How many versions kept?
3. Can user recover from backup?

**For Stefan:**
Fear of data loss blocks action.
Knowing backups exist reduces anxiety.

**Next:**
Audit performance with many nodes

---

## Iteration 85

**Type:** Observation
**Area:** Polish — Canvas Performance
**Priority:** P1-High

**Content:**
Performance affects usability:

**Questions:**
1. How many nodes before slowdown?
2. Is virtualization used? (Only render visible nodes)
3. Are there performance warnings?
4. Is there a "too many nodes" state?

**For Stefan:**
Large workspaces might have 100+ nodes.
Must remain responsive.

**React Flow has virtualization:**
Should be enabled for large canvases.

**Warning:**
If performance degrades, warn user before it becomes unusable.

**Next:**
Audit memory usage with many nodes

---

## Iteration 86

**Type:** Observation
**Area:** Polish — Memory Management
**Priority:** P2-Medium

**Content:**
Electron apps can consume significant memory:

**Questions:**
1. What's baseline memory usage?
2. How does it scale with nodes?
3. Are images/artifacts lazy-loaded?
4. Is there memory leak detection?

**For Stefan:**
App should run alongside other apps without issues.
Memory shouldn't grow unbounded.

**Next:**
Audit startup time

---

## Iteration 87

**Type:** Observation
**Area:** Polish — Startup Performance
**Priority:** P2-Medium

**Content:**
Fast startup reduces initiation friction:

**Questions:**
1. How long from launch to usable?
2. Is there a splash screen?
3. Does last workspace auto-open?
4. Is there progressive loading?

**Ideal:**
< 2 seconds to interactive canvas.
Show placeholder while loading.

**For Stefan:**
Slow startup = barrier to opening app.
"I'll do it later" syndrome.

**Next:**
Audit window management (multi-window)

---

## Iteration 88

**Type:** Observation
**Area:** Information Architecture — Multi-Window
**Priority:** P3-Low

**Content:**
Can multiple workspaces be open simultaneously?

**Questions:**
1. Multiple windows supported?
2. Can you drag nodes between windows?
3. Is there cross-window sync?
4. Resource usage for multiple windows?

**For Stefan:**
"I want to compare two workspaces side by side"

**Caution:**
Multi-window adds complexity. May not be needed.

**Next:**
Audit workspace tabs (within single window)

---

## Iteration 89

**Type:** Observation
**Area:** Information Architecture — Workspace Tabs
**Priority:** P3-Low

**Content:**
Alternative to multi-window: Tabs within single window:

**Questions:**
1. Can multiple workspaces be open as tabs?
2. Is there visual tab indicator?
3. Can you switch tabs with keyboard?
4. Is there tab limit?

**For Stefan:**
Tabs might reduce window management complexity.
"My three projects are just tabs away."

**Next:**
Audit cross-workspace operations

---

## Iteration 90

**Type:** Observation
**Area:** Information Architecture — Cross-Workspace
**Priority:** P3-Low

**Content:**
Moving content between workspaces:

**Questions:**
1. Can you copy nodes between workspaces?
2. Can you link nodes across workspaces?
3. Is there a "master" workspace concept?

**For Stefan:**
Workspaces might represent different projects.
Sometimes need to share content.

**Caution:**
Cross-workspace complexity might not be worth it.
Simple: export/import nodes.

**Next:**
Audit search across workspace content

---

## Iteration 91

**Type:** Observation
**Area:** Information Architecture — Content Search
**Priority:** P1-High

**Content:**
Finding content within workspace:

**Search scenarios:**
1. Find node by title (command palette does this?)
2. Find message within conversations
3. Find text across all content
4. Find nodes by type

**Questions:**
1. Is there global search? (Ctrl+F?)
2. Does search highlight results?
3. Can you navigate between matches?
4. Is search fuzzy or exact?

**For Stefan:**
"I know I wrote about that somewhere..."
Search bridges spatial memory gaps.

**Next:**
Audit search results presentation

---

## Iteration 92

**Type:** Recommendation
**Area:** Information Architecture — Search Results
**Priority:** P2-Medium

**Content:**
How search results are shown matters:

**Options:**
1. List in sidebar (click to jump)
2. Highlight on canvas (visual indication)
3. Filter view (hide non-matching)
4. Combination

**For spatial workflow:**
Results should show WHERE matches are on canvas:
- Zoom out
- Highlight matching nodes
- Click to zoom to node

This preserves spatial context while finding content.

**Next:**
Audit quick-jump navigation

---

## Iteration 93

**Type:** Observation
**Area:** Spatial Cognition — Quick Jump
**Priority:** P2-Medium

**Content:**
Jumping to specific locations without manual navigation:

**Quick jump scenarios:**
1. G key → Jump to bookmark ✅
2. Tab → Cycle through nodes ✅
3. Arrow keys → Nearest node ✅
4. Search → Jump to result
5. Notification → Jump to source

**Additional idea:**
Number nodes temporarily (like Vim EasyMotion):
Press trigger → nodes show numbers → press number → jump there

This supports "I see it's node 5" without needing to scroll.

**Next:**
Audit breadcrumb/history navigation

---

## Iteration 94

**Type:** Recommendation
**Area:** Spatial Cognition — Navigation History
**Priority:** P3-Low

**Content:**
Track navigation history for back/forward:

**Like browser:**
- Alt+Left → Go back to previous view
- Alt+Right → Go forward

**For Stefan:**
"I was just looking at that node, where was it?"
Back button returns to previous viewport.

**Implementation:**
Track viewport position changes.
Allow navigation through history.

**Next:**
Audit spatial clustering visualization

---

## Iteration 95

**Type:** Recommendation
**Area:** Spatial Cognition — Clustering
**Priority:** P2-Medium

**Content:**
Nodes often cluster by topic/purpose:

**Visual clustering:**
- Automatic grouping detection
- Subtle background color for clusters
- Collapsible clusters

**Manual clustering:**
- User draws region → nodes inside become group
- Group can be named
- Group can be collapsed/expanded

**For Stefan:**
"The API stuff is in that blue region"
Clusters create visual landmarks.

**Next:**
Audit canvas navigation aids

---

## Iteration 96

**Type:** Recommendation
**Area:** Spatial Cognition — Navigation Aids
**Priority:** P2-Medium

**Content:**
Aids for orienting on large canvas:

**Options:**
1. Minimap ✅ (exists)
2. Compass (shows cardinal directions to bookmarks)
3. "Center on selection" button
4. "Fit all" button
5. Breadcrumb trail from current position

**For Stefan:**
"Where am I on the canvas?"
Aids provide spatial grounding.

**Next:**
Audit canvas annotations (non-node visual elements)

---

## Iteration 97

**Type:** Recommendation
**Area:** Spatial Cognition — Annotations
**Priority:** P3-Low

**Content:**
Non-node visual elements to organize canvas:

**Annotation types:**
1. Sticky notes (text labels floating on canvas)
2. Arrows (showing flow direction)
3. Regions (background color areas)
4. Freeform drawing (sketches)

**For Stefan:**
"Draw a circle around related nodes"
"Add a big arrow showing data flow"

This supports visual thinking without node overhead.

**Caution:**
Keep annotations simple. Too many features = overwhelming.

**Next:**
Audit spatial templates / starters

---

## Iteration 98

**Type:** Recommendation
**Area:** Initiation & Action — Templates
**Priority:** P3-Low

**Content:**
Pre-made workspace templates reduce blank canvas paralysis:

**Template examples:**
1. "Code Review" — Conversation + context node + artifact node
2. "Project Planning" — Project + multiple tasks
3. "Research" — Multiple notes + conversation
4. "Blank" — Empty canvas

**For Stefan:**
Starting from template = initiation aid.
"I'll use the code review template" → nodes already positioned.

**Next:**
Audit collaborative features (sharing)

---

## Iteration 99

**Type:** Observation
**Area:** Information Architecture — Collaboration
**Priority:** P3-Low (future feature)

**Content:**
Sharing workspaces with others:

**Questions:**
1. Can workspaces be shared?
2. Real-time collaboration?
3. Read-only sharing?
4. Version control for shared workspaces?

**For Stefan:**
Might want to share workspace with team member.
For now, export → share file → import is sufficient.

**Caution:**
Real-time collab is complex. Low priority.

**Next:**
Final iteration: Summary and priorities

---

## Iteration 100

**Type:** Summary
**Area:** All Domains
**Priority:** N/A

**Content:**
100 iterations complete. Key themes emerged:

### Critical (P0) Findings:
1. **Position persistence** — Nodes must stay where placed
2. **Streaming indicators** — AI activity must be visible
3. **Message sending flow** — Core action must be frictionless
4. **Context injection visibility** — Spatial relationships = context
5. **API setup** — First-run barrier

### High Priority (P1) Findings:
1. **Focus Mode neighborhood** — Show connected nodes dimmed less
2. **Zoom-aware streaming** — Visible at all zoom levels
3. **Edge visualization** — Relationships need more visual encoding
4. **Selection vs focus distinction** — Clear visual difference
5. **Token visibility** — Show context limits

### Design Principles Validated:
1. ✅ Spatial memory over content memory
2. ✅ Clear next action always visible
3. ✅ Feedback for all actions
4. ✅ Consistent keyboard shortcuts
5. ✅ Progressive exit (Escape pattern)

### Implementation Recommendations:
1. Complete the visual-feedback-juiciness.md spec
2. Add multi-colored bookmarks (spatial anchors)
3. Implement semantic zoom
4. Add navigation history (back/forward)
5. Template system for initiation

**Status:** Ready for handoff to implementation persona.

---

## Iteration 101

**Type:** Deep Dive
**Area:** Spatial Cognition — Position Encoding
**Priority:** P0-Critical

**Content:**
Diving deeper into HOW position encodes meaning:

**Position semantics Stefan might use:**
- Top = active/current
- Bottom = archive/done
- Left to right = timeline/sequence
- Center = most important
- Edges = supporting/reference

**Design implications:**
1. Don't auto-arrange nodes (destroys user's spatial encoding)
2. "Fit to view" should preserve relative positions
3. Consider optional "semantic zones" (drag to "done zone" marks complete)

**Visual aid:**
Subtle zone indicators at canvas edges?
"Active projects" zone vs "Archive" zone?

**Next:**
Explore semantic zones concept

---

## Iteration 102

**Type:** Recommendation
**Area:** Spatial Cognition — Semantic Zones
**Priority:** P2-Medium

**Content:**
Optional semantic zones for spatial organization:

**Zone concept:**
- User-defined regions with meaning
- Nodes dropped in zone get auto-tagged
- Zone has distinct background tint

**Example zones:**
```
[Active Projects Zone - light purple tint]
    Project A    Project B

[Archive Zone - light gray tint]
    Old Project X
```

**Implementation:**
- Zones are transparent backgrounds
- Draggable/resizable
- Optional zone labels
- Nodes in zone inherit zone tag

**For Stefan:**
"Everything in the gray area is archived"
Position = meaning without manual tagging.

**Next:**
Explore visual distinction for zone boundaries

---

## Iteration 103

**Type:** Observation
**Area:** Spatial Cognition — Visual Landmarks
**Priority:** P1-High

**Content:**
Large canvases need landmarks for orientation:

**Current landmarks:**
- Bookmarked nodes (gold star)
- Different node colors by type
- Minimap

**Additional landmark ideas:**
1. **Canvas waypoints** — User-placed markers (flags)
2. **Node labels at zoom** — Titles visible even zoomed out
3. **Color hot spots** — Dense areas of same-color nodes
4. **Edge highways** — Thick bundles of edges

**For Stefan:**
"Navigate to the area with lots of blue nodes"
"The flag near the API stuff"

Landmarks support spatial chunking.

**Next:**
Explore waypoint/flag concept

---

## Iteration 104

**Type:** Recommendation
**Area:** Spatial Cognition — Canvas Waypoints
**Priority:** P3-Low

**Content:**
User-placed navigation markers:

**Waypoint features:**
- Simple icon (flag, pin, marker)
- Optional label
- Click to jump to location
- Appear in minimap
- Keyboard shortcut to cycle through

**Use case:**
"I'm working on 3 different areas of this canvas"
Place waypoints → quickly jump between them.

**Difference from bookmarks:**
- Bookmarks are on NODES
- Waypoints are on POSITIONS (no node required)

**Next:**
Explore relationship between bookmarks and waypoints

---

## Iteration 105

**Type:** Observation
**Area:** Spatial Cognition — Bookmark Evolution
**Priority:** P2-Medium

**Content:**
Current bookmark system (single gold star) could evolve:

**Enhancement options:**
1. **Multiple bookmark colors** (gold, cyan, purple) — different meanings
2. **Numbered bookmarks** (1-9) — quick jump with number keys
3. **Named bookmarks** — "Code Review" bookmark
4. **Temporary bookmarks** — auto-clear on session end

**Keyboard pattern:**
- B = toggle bookmark
- 1-9 = jump to numbered bookmark
- Shift+1-9 = set numbered bookmark

**For Stefan:**
"3 to jump to the API conversation, 4 to the design doc"
Muscle memory for frequently accessed nodes.

**Next:**
Explore numbered bookmark implementation

---

## Iteration 106

**Type:** Recommendation
**Area:** Spatial Cognition — Numbered Bookmarks
**Priority:** P2-Medium

**Content:**
Numbered bookmarks for instant jump:

**Implementation:**
- Shift+1 through Shift+9 to SET bookmark
- 1 through 9 to JUMP to bookmark
- Visual number badge on bookmarked nodes
- Different colors for each number

**Visual:**
```
[Conversation Node]
    ①  (badge in corner)
```

**Benefits:**
- No searching ("where's that node?")
- Muscle memory forms quickly
- Supports up to 9 spatial anchors

**Caution:**
Don't conflict with existing shortcuts. Check 1-9 aren't used.

**Next:**
Audit current number key usage

---

## Iteration 107

**Type:** Observation
**Area:** Keyboard — Number Key Audit
**Priority:** P2-Medium

**Content:**
Checking current number key usage:

**From KeyboardShortcutsHelp:**
- No number keys listed
- +/- for zoom

**Potential conflicts:**
- Number input in fields (obviously)
- Possible future use

**Recommendation:**
Reserve 1-9 for numbered bookmarks when not in input field.
This is consistent with Vim marks and browser tab switching.

**Next:**
Explore connection with minimap

---

## Iteration 108

**Type:** Recommendation
**Area:** Spatial Cognition — Minimap Enhancements
**Priority:** P2-Medium

**Content:**
Minimap could show more spatial information:

**Current:**
- Node positions
- Streaming indicator (pulse)
- Viewport indicator

**Enhancements:**
1. **Bookmark indicators** — Show numbered bookmarks as labels
2. **Zone backgrounds** — Show semantic zone colors
3. **Selection highlight** — Show selected nodes
4. **Recent activity** — Pulse for recently interacted nodes

**For Stefan:**
Minimap becomes spatial memory dashboard:
"The active stuff is top-left (pulsing), archives bottom (gray zone)"

**Next:**
Explore hover preview on minimap

---

## Iteration 109

**Type:** Recommendation
**Area:** Spatial Cognition — Minimap Hover
**Priority:** P3-Low

**Content:**
Hovering over minimap area could show preview:

**Concept:**
- Hover over minimap region
- Tooltip shows enlarged view of that region
- Click to jump there

**Implementation:**
- Render zoomed portion on hover
- Show node titles (readable)
- Quick spatial preview before navigation

**Alternative:**
Minimap click shows "region popup" with more detail before committing to navigation.

**Next:**
Explore edge bundling for clarity

---

## Iteration 110

**Type:** Observation
**Area:** Spatial Cognition — Edge Bundling
**Priority:** P2-Medium

**Content:**
Many edges can create visual clutter:

**Problem:**
10 nodes all connected = 45 potential edges = spaghetti.

**Solution — Edge bundling:**
- Edges between same regions bundled together
- Shows "flow" between areas rather than individual connections
- Detail visible on zoom in

**Visual:**
```
[Region A] ===thick bundle=== [Region B]
```
Instead of:
```
[Node1]---[NodeA]
[Node2]---[NodeA]
[Node3]---[NodeA]
... (visual mess)
```

**For Stefan:**
"Those two areas are highly connected" vs memorizing each edge.

**Next:**
Explore edge filtering options

---

## Iteration 111

**Type:** Recommendation
**Area:** Information Architecture — Edge Filtering
**Priority:** P2-Medium

**Content:**
Show/hide edges by type:

**Filter options:**
- Show all edges
- Show only context edges
- Show only dependency edges
- Hide all edges (nodes only)
- Show edges for selected node only

**Use cases:**
- "I want to see just the context flow"
- "Too many edges, show me node layout only"
- "What connects to THIS node?"

**Implementation:**
Toggle in toolbar or keyboard shortcut (E to cycle edge views?)

**Next:**
Explore edge direction indicators

---

## Iteration 112

**Type:** Observation
**Area:** Spatial Cognition — Edge Direction
**Priority:** P1-High

**Content:**
Edges have direction. Is it visible?

**Direction matters:**
- Context edge: Note → Conversation (note provides context)
- Dependency: Task A → Task B (B depends on A)
- Reference: Node → Node (points to)

**Visual encoding:**
- Arrow at endpoint
- Gradient color (start color → end color)
- Animated flow particles (like streaming)

**For Stefan:**
"The arrow shows context flows INTO the conversation"
Direction = information architecture visible.

**Next:**
Explore flow animation for active context

---

## Iteration 113

**Type:** Recommendation
**Area:** Feedback Loops — Context Flow Animation
**Priority:** P1-High

**Content:**
Animate edges when context is being used:

**Concept:**
When sending a message:
1. Context is gathered from connected nodes
2. Edges to context sources "pulse" or show particle flow
3. Visual shows "these nodes are being read"

**Animation:**
Dots/particles flowing along edge toward conversation node.
Or pulse that travels from source to conversation.

**For Stefan:**
"I can SEE the context being pulled in"
Makes the invisible visible.

**This directly supports the spatial CLI vision:**
Spatial relationships become visible data flow.

**Next:**
Explore extraction visualization (opposite direction)

---

## Iteration 114

**Type:** Recommendation
**Area:** Feedback Loops — Extraction Animation
**Priority:** P1-High

**Content:**
When Claude extracts information to a new node:

**Current spec (from visual-feedback-juiciness.md):**
- Particle burst animation
- Edge spawning animation

**Enhanced visualization:**
1. AI response highlights extractable content
2. User clicks "extract to node"
3. Particles flow FROM conversation TO new node
4. New node spawns with animation
5. Edge connects them

**For Stefan:**
"That insight flew out to become its own node"
Extraction is spatially visible.

**Next:**
Explore node spawn animation refinement

---

## Iteration 115

**Type:** Observation
**Area:** Polish — Spawn Animation
**Priority:** P2-Medium

**Content:**
New node appears with animation. How should it feel?

**Current:**
isSpawning state triggers animation class.

**Animation options:**
1. **Fade in** — Simple opacity 0→1
2. **Scale in** — Start small, grow to full size
3. **Slide in** — Arrive from a direction
4. **Pop** — Slight overshoot and settle (spring)

**For Stefan:**
Animation should feel "rewarding" (dopamine hit for creation).
Pop with slight overshoot feels satisfying.

**Timing:**
200-300ms total. Fast enough to not interrupt flow.

**Next:**
Explore delete animation (counterpart)

---

## Iteration 116

**Type:** Observation
**Area:** Polish — Delete Animation
**Priority:** P2-Medium

**Content:**
Node deletion animation (before removal):

**Options:**
1. **Fade out** — Opacity 1→0
2. **Scale out** — Shrink to nothing
3. **Fly away** — Move off screen
4. **Collapse** — Implode effect

**For Stefan:**
Delete should feel "light" (not scary).
Knowing undo exists, deletion shouldn't be dramatic.

**Recommendation:**
Quick fade (150ms) + slight scale down.
Not too dramatic, supports "easy to undo" mental model.

**Next:**
Explore node move/drag animation

---

## Iteration 117

**Type:** Observation
**Area:** Polish — Drag Animation
**Priority:** P3-Low

**Content:**
While dragging a node:

**Visual feedback:**
1. Node slightly lifted (shadow increase)
2. Ghost at original position?
3. Snap guide lines appear
4. Drop zone highlights

**For Stefan:**
Drag should feel "physical" — picking something up.
Subtle shadow lift reinforces this.

**Performance:**
Drag animation must be smooth (60fps).
No lag or judder.

**Next:**
Explore canvas panning smoothness

---

## Iteration 118

**Type:** Observation
**Area:** Polish — Pan Smoothness
**Priority:** P2-Medium

**Content:**
Canvas panning feel:

**Questions:**
1. Is momentum/inertia applied?
2. Does panning feel responsive?
3. Is there edge-of-canvas behavior?
4. Can you "throw" the canvas?

**Ideal:**
- Instant response to input
- Smooth momentum on release
- Elastic bounce at canvas bounds (optional)

**For Stefan:**
Fluid navigation = less friction exploring spatial layout.

**Next:**
Explore zoom smoothness and centering

---

## Iteration 119

**Type:** Observation
**Area:** Polish — Zoom Behavior
**Priority:** P2-Medium

**Content:**
Zoom should center on cursor:

**Questions:**
1. Does zoom center on cursor position?
2. Or center on viewport center?
3. Is zoom smooth (animated) or stepped?

**Best practice:**
Zoom toward cursor position.
"I'm pointing at what I want to zoom to."

**Smooth vs stepped:**
- Scroll wheel = smooth zoom
- +/- keys = stepped zoom (25% increments)

**For Stefan:**
Cursor-centered zoom supports "zoom to inspect this area."

**Next:**
Explore fit-to-selection zoom

---

## Iteration 120

**Type:** Recommendation
**Area:** Spatial Cognition — Fit to Selection
**Priority:** P2-Medium

**Content:**
Zoom to show selected nodes:

**Scenarios:**
1. "Fit selected" — Zoom to show all selected nodes
2. "Fit all" — Zoom to show all nodes
3. "Fit this" — Zoom to show single selected node at readable size

**Keyboard:**
- Z = Fit selected
- Shift+Z = Fit all
- ? (another key) = Zoom to 100%

**For Stefan:**
"Show me just these nodes" → instant context isolation.
Supports focus without Focus Mode.

**Next:**
Explore zoom presets

---

## Iteration 121

**Type:** Recommendation
**Area:** Spatial Cognition — Zoom Presets
**Priority:** P3-Low

**Content:**
Quick access to common zoom levels:

**Presets:**
- 25% — Full canvas overview
- 50% — Working overview
- 100% — Default reading size
- 150% — Detail work
- Fit all — Adapt to content

**Keyboard:**
- Ctrl+1 = 100%
- Ctrl+2 = Fit all
- Ctrl+0 = Reset zoom and center

**For Stefan:**
"I want to see everything" → Ctrl+2
"Back to normal size" → Ctrl+1

**Next:**
Explore semantic zoom levels

---

## Iteration 122

**Type:** Recommendation
**Area:** Spatial Cognition — Semantic Zoom Detail
**Priority:** P1-High

**Content:**
Content adapts to zoom level (semantic zoom):

**Level 1 (Far zoom <50%):**
- Node = colored rectangle
- No title
- Just type icon
- Purpose: See structure, not content

**Level 2 (Mid zoom 50-100%):**
- Node = colored rectangle + title
- Badge indicators (bookmark, status)
- Purpose: Identify specific nodes

**Level 3 (Close zoom >100%):**
- Full node content visible
- Can read/interact
- Purpose: Work with node

**Implementation:**
CSS zoom-level classes or React conditional rendering.

**For Stefan:**
Zoom level = information density appropriate to task.

**Next:**
Explore node content truncation

---

## Iteration 123

**Type:** Observation
**Area:** Information Architecture — Content Truncation
**Priority:** P2-Medium

**Content:**
Node content at various lengths:

**Scenarios:**
- Note with 1 line vs 100 lines
- Conversation with 2 messages vs 200
- Artifact with code block

**Truncation rules:**
- Show first N lines/characters
- "Show more" expansion
- Full content in panel on select

**For Stefan:**
Content preview on node helps identification.
"That's the one with the code" without opening.

**Balance:**
Too much preview = cluttered canvas.
Too little = can't distinguish nodes.

**Next:**
Explore node expand/collapse

---

## Iteration 124

**Type:** Observation
**Area:** Information Architecture — Node Expand/Collapse
**Priority:** P2-Medium

**Content:**
Can nodes be expanded inline?

**Options:**
1. Fixed size nodes (content truncated)
2. Expandable nodes (click to grow)
3. Detail panel (content in sidebar)
4. Modal view (full screen content)

**For Stefan:**
Expand inline keeps spatial context.
Modal/panel loses position awareness.

**Recommendation:**
Support inline expansion with double-click.
Or dedicated expand button on node.

**Next:**
Explore node content editing inline

---

## Iteration 125

**Type:** Observation
**Area:** Initiation & Action — Inline Editing
**Priority:** P1-High

**Content:**
Editing content without leaving canvas:

**Current state (to verify):**
- Can you edit note content inline?
- Can you add conversation messages inline?
- Or must you use panel?

**Ideal for Stefan:**
Click into note → edit text directly.
No mode switching or panel opening.

**Exception:**
Conversations might need full chat interface (panel).
Notes should be directly editable.

**Next:**
Explore click-to-edit behavior

---

## Iteration 126

**Type:** Observation
**Area:** Initiation & Action — Click Behavior
**Priority:** P1-High

**Content:**
Click does different things on different nodes:

**Conversation node:**
- Single click = select
- Double click = open chat panel?

**Note node:**
- Single click = select
- Double click = edit inline?

**Task node:**
- Single click = select
- Click checkbox = toggle done?

**Consistency concern:**
Double-click behavior should be predictable.
"Double-click to edit" should work on all editable nodes.

**Next:**
Define universal click behavior spec

---

## Iteration 127

**Type:** Recommendation
**Area:** Consistency — Click Spec
**Priority:** P1-High

**Content:**
Universal click behavior specification:

**Single click on node:**
- Selects node
- Deselects other nodes (unless Ctrl held)
- Focus indicator appears

**Double click on node:**
- Opens primary action for that node type
- Note: Start editing
- Conversation: Open chat panel
- Task: Edit task details
- Artifact: Open artifact viewer

**Right click on node:**
- Context menu with all actions

**Single click on canvas:**
- Deselects all

**Double click on canvas:**
- Create new conversation (default)

**Next:**
Explore primary action concept

---

## Iteration 128

**Type:** Recommendation
**Area:** Initiation & Action — Primary Action
**Priority:** P2-Medium

**Content:**
Each node type has a "primary action":

**Primary actions:**
- Note: Edit content
- Conversation: Send message
- Task: Toggle completion
- Project: Expand/collapse
- Artifact: View content

**This appears on:**
- Double-click
- Enter key when selected
- Primary button in context menu

**For Stefan:**
"Enter" always does the obvious thing.
No guessing what will happen.

**Next:**
Explore secondary actions

---

## Iteration 129

**Type:** Observation
**Area:** Information Architecture — Secondary Actions
**Priority:** P2-Medium

**Content:**
Beyond primary action, what else?

**Secondary actions (common to all):**
- Delete
- Duplicate
- Bookmark
- Focus mode
- Pin to screen

**Node-specific secondary:**
- Note: Convert to task
- Conversation: Export transcript
- Task: Set due date
- Project: Add member nodes

**Access:**
Context menu, command palette, keyboard shortcuts.

**Next:**
Explore node conversion between types

---

## Iteration 130

**Type:** Recommendation
**Area:** Information Architecture — Node Conversion
**Priority:** P3-Low

**Content:**
Convert node from one type to another:

**Conversion scenarios:**
- Note → Task (note becomes task description)
- Task → Note (task done, archive as note)
- Artifact → Note (embed artifact content)
- Conversation summary → Note

**Implementation:**
- Context menu: "Convert to..."
- Preserves content where possible
- Preserves position and connections

**For Stefan:**
"This note is actually a task" → quick conversion.
No need to recreate and re-connect.

**Next:**
Explore node duplication behavior

---

## Iteration 131

**Type:** Observation
**Area:** Initiation & Action — Node Duplication
**Priority:** P2-Medium

**Content:**
Duplicating nodes:

**Behavior:**
1. Ctrl+D = Duplicate selected
2. New node appears offset from original
3. Copy inherits content, not connections
4. Or: Option to copy with connections?

**For Stefan:**
"I need another one like this" → quick duplicate.
Position offset supports spatial organization.

**Offset pattern:**
Duplicate appears 20-30px right and down.
Multiple duplicates fan out.

**Next:**
Explore multi-node operations menu

---

## Iteration 132

**Type:** Observation
**Area:** Information Architecture — Multi-Select Menu
**Priority:** P2-Medium

**Content:**
When multiple nodes selected, what options?

**Bulk operations:**
- Delete all
- Move together (already works via drag)
- Link all (Ctrl+L) ✅
- Unlink all (Ctrl+Shift+L) ✅
- Align (left, right, top, bottom, distribute)
- Group into project
- Duplicate all
- Export selection

**Context menu adaptation:**
Show only actions that work on multiple nodes.
Hide single-node-only actions.

**Next:**
Explore group into project operation

---

## Iteration 133

**Type:** Recommendation
**Area:** Spatial Cognition — Quick Grouping
**Priority:** P2-Medium

**Content:**
Group selected nodes into a project:

**Operation:**
1. Select multiple nodes
2. "Group into Project" (context menu or Ctrl+G)
3. Project node created encompassing selection
4. Edges connect existing nodes to project

**Visual result:**
Project node as visual container with selected nodes inside/connected.

**For Stefan:**
"These are all related to X" → instant organizational structure.
Spatial grouping becomes explicit hierarchy.

**Next:**
Explore project expansion/collapse

---

## Iteration 134

**Type:** Observation
**Area:** Information Architecture — Project Collapse
**Priority:** P2-Medium

**Content:**
Projects should be collapsible:

**Collapsed state:**
- Only project node visible
- Member nodes hidden
- Badge shows count: "5 items"
- Edges to project represent edges to members

**Expanded state:**
- Project + all member nodes visible
- Standard layout

**Toggle:**
Double-click project to toggle, or collapse button.

**For Stefan:**
"Hide the details, show me the structure"
Collapse = reduce clutter, keep spatial reference.

**Next:**
Explore nested projects

---

## Iteration 135

**Type:** Observation
**Area:** Information Architecture — Nesting Depth
**Priority:** P3-Low

**Content:**
Can projects contain other projects?

**Hierarchy:**
- Workspace > Project > Project > Nodes

**Caution:**
Deep nesting increases complexity.
Maybe limit to 2 levels?

**For Stefan:**
Flat structure is easier to remember spatially.
"Projects contain tasks" not "projects contain projects contain..."

**Recommendation:**
Support 1 level of nesting only.
Or: Allow nesting but discourage in UI.

**Next:**
Explore search scope (within project)

---

## Iteration 136

**Type:** Observation
**Area:** Information Architecture — Scoped Search
**Priority:** P2-Medium

**Content:**
Search within context:

**Scopes:**
1. Entire workspace
2. Within selected project
3. Within conversation
4. Connected nodes only

**For Stefan:**
"Search just in this project's nodes"
Reduces noise, finds faster.

**Implementation:**
Search UI has scope dropdown.
Or: Project context menu has "Search in project..."

**Next:**
Explore filter views

---

## Iteration 137

**Type:** Recommendation
**Area:** Information Architecture — Filter Views
**Priority:** P2-Medium

**Content:**
Show subset of nodes based on criteria:

**Filter options:**
- By type (only conversations)
- By status (only incomplete tasks)
- By date (modified today)
- By connection (connected to selected)
- By bookmark (only bookmarked)

**Visual:**
Non-matching nodes dimmed or hidden.
Filter indicator shows active filter.

**For Stefan:**
"Show me only my tasks"
Reduces visual noise while maintaining spatial layout.

**Difference from Focus Mode:**
Focus = single node. Filter = subset by criteria.

**Next:**
Explore saved filter views

---

## Iteration 138

**Type:** Recommendation
**Area:** Information Architecture — Saved Views
**Priority:** P3-Low

**Content:**
Save filter configurations as views:

**Concept:**
- "My Tasks" view = filter by task type
- "Active Conversations" = conversations with recent activity
- "Code Review" = specific project expanded

**Access:**
Dropdown in toolbar or sidebar.
Quick switch between views.

**For Stefan:**
"Switch to my task view" → consistent context.
Views = saved spatial/filter states.

**Next:**
Explore timeline view

---

## Iteration 139

**Type:** Recommendation
**Area:** Spatial Cognition — Timeline View
**Priority:** P3-Low

**Content:**
Alternative to free-form canvas: Timeline layout:

**Concept:**
Nodes arranged by time (created or modified).
Horizontal timeline, recent on right.

**Toggle:**
Switch between free canvas and timeline view.
Positions temporarily overridden.

**For Stefan:**
"Show me what I did this week"
Time-based spatial memory complement.

**Caution:**
Don't destroy free positions when switching back.
Timeline = temporary view mode.

**Next:**
Explore relationship to file tree view

---

## Iteration 140

**Type:** Observation
**Area:** Spatial Cognition — Canvas vs Tree
**Priority:** P0-Critical

**Content:**
Stefan's core insight: Canvas > File tree.

**Why file tree fails for Stefan:**
- Hierarchy = arbitrary structure
- Position = line in list (not memorable)
- Must remember path: /folder/subfolder/file

**Why canvas works:**
- Position = chosen by user
- Visual distinctiveness
- Spatial relationships visible

**Design imperative:**
Never force tree/list view as primary.
Canvas is the interface.

**Any list views (search results, file browser) should support:**
- Click to navigate TO position on canvas
- Show position context ("top-left area")

**Next:**
Explore canvas-first file operations

---

## Iteration 141

**Type:** Observation
**Area:** Initiation & Action — File Operations Context
**Priority:** P2-Medium

**Content:**
File operations (new, open, save) should feel canvas-native:

**Current (likely):**
Standard file dialogs.

**Canvas-native alternative:**
- New: Fade to blank canvas
- Open: Animate workspace loading onto canvas
- Save: Brief "saved" flash

**For Stefan:**
File operations shouldn't feel separate from canvas work.
Seamless transitions.

**Next:**
Explore recent workspaces access

---

## Iteration 142

**Type:** Recommendation
**Area:** Initiation & Action — Recent Workspaces
**Priority:** P2-Medium

**Content:**
Quick access to recent workspaces:

**Implementation:**
- Ctrl+Shift+O = Open recent (list of workspaces)
- Or: In command palette "recent workspace"
- Or: Sidebar panel with recent files

**Visual:**
Recent workspaces show thumbnail preview (minimap-like).
Stefan can visually recognize "the one with the big cluster in the corner."

**For spatial memory:**
Workspace preview = spatial recognition aid.

**Next:**
Explore workspace thumbnail generation

---

## Iteration 143

**Type:** Recommendation
**Area:** Spatial Cognition — Workspace Thumbnails
**Priority:** P3-Low

**Content:**
Generate preview images of workspaces:

**Uses:**
- Recent files list
- File browser
- Sharing/export preview

**Generation:**
Save minimap-like snapshot on workspace save.
Or: Generate on demand.

**For Stefan:**
"That's the one with the star shape" → visual recognition.
Don't need to remember file names.

**Next:**
Explore workspace metadata

---

## Iteration 144

**Type:** Observation
**Area:** Information Architecture — Workspace Metadata
**Priority:** P2-Medium

**Content:**
What information about workspace is stored/shown?

**Metadata:**
- File name
- Last modified date
- Created date
- Node count
- Description/notes
- Tags
- Thumbnail

**For Stefan:**
Metadata helps find right workspace.
"The one I worked on yesterday with lots of tasks."

**Search across workspaces:**
Eventually search all workspace content from one place.

**Next:**
Explore workspace description field

---

## Iteration 145

**Type:** Recommendation
**Area:** Information Architecture — Workspace Description
**Priority:** P3-Low

**Content:**
Let user add description to workspace:

**Purpose:**
- Remind what workspace is for
- Searchable notes about workspace
- Context for future Stefan

**Access:**
Workspace settings/info panel.
Or: Canvas-level annotation (text floating at edge).

**For Stefan:**
"Project X planning workspace - Q1 goals"
Human-readable context.

**Next:**
Explore onboarding for new users

---

## Iteration 146

**Type:** Observation
**Area:** Initiation & Action — Onboarding Flow
**Priority:** P1-High

**Content:**
First-time user experience:

**Step 1: API Key**
- Clear prompt
- Link to get key
- Validation feedback

**Step 2: Empty Canvas**
- EmptyCanvasHint appears ✅
- Clear first action shown

**Step 3: First Node**
- User creates first conversation
- Success feedback

**Step 4: First Message**
- Guide to send message
- Streaming visible
- Response arrives

**For Stefan:**
Each step should feel like accomplishment.
Clear progress toward "using the tool."

**Next:**
Explore optional tutorial

---

## Iteration 147

**Type:** Recommendation
**Area:** Initiation & Action — Optional Tutorial
**Priority:** P3-Low

**Content:**
Interactive tutorial for first-time users:

**Concept:**
"Would you like a 2-minute tour?" button on first launch.

**Tour steps:**
1. Create a conversation
2. Send a message
3. Create a note
4. Connect note to conversation
5. See context injection

**Implementation:**
Highlight UI elements with overlay.
Guided prompts for each action.
Skip available at any point.

**For Stefan:**
Tutorial should be optional (not forced).
Can be re-accessed from Help menu.

**Next:**
Explore progressive feature discovery

---

## Iteration 148

**Type:** Recommendation
**Area:** Information Architecture — Progressive Discovery
**Priority:** P2-Medium

**Content:**
Reveal features as user becomes ready:

**Concept:**
Don't show all features at once.
Reveal advanced features after basic mastery.

**Examples:**
- After 5 conversations → Show "Focus Mode" tip
- After 10 nodes → Show "Minimap" tip
- After connecting nodes → Show "Context injection" explanation

**Implementation:**
Feature tips triggered by usage milestones.
Dismissable and not repeated.

**For Stefan:**
Avoids initial overwhelm.
Features appear when relevant.

**Next:**
Explore feature tip format

---

## Iteration 149

**Type:** Recommendation
**Area:** Feedback Loops — Feature Tips
**Priority:** P2-Medium

**Content:**
How to present feature tips:

**Format options:**
1. Toast notification (transient)
2. Popover near relevant UI (pointed)
3. Card in corner (persistent until dismissed)

**Content:**
- Short headline
- One benefit sentence
- "Try it now" action
- "Got it" dismiss

**Example:**
"✨ Focus Mode"
"Press F to dim all nodes except the selected one."
[Try F now] [Got it]

**For Stefan:**
Feature tips = just-in-time learning.
Not overwhelming documentation.

**Next:**
Explore help documentation approach

---

## Iteration 150

**Type:** Observation
**Area:** Information Architecture — Documentation
**Priority:** P2-Medium

**Content:**
How users access help:

**Options:**
1. In-app help panel
2. External documentation site
3. Tooltips and feature tips
4. ? keyboard shortcuts overlay ✅

**For Stefan:**
Documentation should be:
- Searchable
- Scannable (not walls of text)
- Visual (screenshots, GIFs)
- Context-sensitive when possible

**Recommendation:**
In-app help sidebar with search.
Links to full docs for deep dives.

**Next:**
Explore error message design

---

## Iteration 151

**Type:** Observation
**Area:** Information Architecture — Error Messages
**Priority:** P1-High

**Content:**
When errors occur, messages matter:

**Good error message:**
1. What happened (brief)
2. Why (if knowable)
3. What to do next (action)

**Bad error message:**
"Error: Something went wrong"
"Error code 500"

**Stefan-specific:**
- Non-blaming language
- No shame spiral triggers
- Clear recovery path

**Example:**
"Couldn't reach Claude" (what)
"Check your internet connection" (why/action)
[Try again] [Work offline]

**Next:**
Explore error recovery flows

---

## Iteration 152

**Type:** Observation
**Area:** Information Architecture — Error Recovery
**Priority:** P1-High

**Content:**
After error, what can user do?

**Recovery options:**
1. Retry (for transient failures)
2. Undo (if action caused problem)
3. Contact support (for persistent issues)
4. Workaround (continue despite error)

**For Stefan:**
Errors should never be dead ends.
Always provide a next action.

**Example flow:**
Save failed → [Retry] [Save as different file] [Export JSON]

**Next:**
Explore offline mode

---

## Iteration 153

**Type:** Observation
**Area:** Information Architecture — Offline Mode
**Priority:** P2-Medium

**Content:**
When network unavailable:

**What works offline:**
- Canvas manipulation (move, create local nodes)
- Viewing existing content
- Local saves

**What doesn't:**
- Sending messages to Claude
- Cloud sync (if implemented)

**Visual indication:**
"Offline" indicator in status bar.
Disabled state on actions requiring network.

**For Stefan:**
Can still organize and think.
Not completely blocked by network issues.

**Next:**
Explore data integrity

---

## Iteration 154

**Type:** Observation
**Area:** Information Architecture — Data Integrity
**Priority:** P1-High

**Content:**
Ensuring data isn't lost or corrupted:

**Scenarios:**
1. App crash → Auto-recovery from last save
2. Corrupt file → Backup available
3. Sync conflict → Resolution UI

**Implementation:**
- Autosave every N seconds
- Keep N previous versions
- Crash recovery on startup

**For Stefan:**
Fear of data loss = action paralysis.
Strong data integrity = confidence to work.

**Next:**
Explore crash recovery UX

---

## Iteration 155

**Type:** Observation
**Area:** Feedback Loops — Crash Recovery
**Priority:** P1-High

**Content:**
After app crash and restart:

**Recovery flow:**
1. App starts
2. Detects unsaved changes
3. Shows: "Recover unsaved work?"
4. [Recover] [Start fresh]
5. If recover: Load recovered state
6. Confirm: "Recovery complete. Your work has been restored."

**For Stefan:**
Crash should not mean lost work.
Recovery should feel automatic and reliable.

**Next:**
Explore update experience

---

## Iteration 156

**Type:** Observation
**Area:** Polish — App Updates
**Priority:** P3-Low

**Content:**
How updates are communicated and applied:

**Options:**
1. Silent auto-update (next launch)
2. Notification with choice
3. In-app update indicator

**For Stefan:**
Updates should be low friction.
Don't interrupt active work.

**Recommendation:**
Download in background.
Show "Update ready" indicator.
Apply on next launch.

**Next:**
Explore version compatibility

---

## Iteration 157

**Type:** Observation
**Area:** Information Architecture — Version Compatibility
**Priority:** P2-Medium

**Content:**
When workspace format changes between versions:

**Scenarios:**
1. Open old workspace in new app → Migrate automatically
2. Open new workspace in old app → Show warning

**Migration:**
- Silent for minor changes
- Backup before major migrations
- "Your workspace has been updated" message

**For Stefan:**
Shouldn't think about versions.
Just works.

**Next:**
Explore export format compatibility

---

## Iteration 158

**Type:** Observation
**Area:** Information Architecture — Export Formats
**Priority:** P2-Medium

**Content:**
What formats can workspace be exported to?

**Options:**
1. JSON (native format, complete)
2. Markdown (conversations as text)
3. PNG/PDF (canvas as image)
4. HTML (interactive viewer?)

**For Stefan:**
Export = backup or share.
Multiple formats support different needs.

**Next:**
Explore import from other tools

---

## Iteration 159

**Type:** Recommendation
**Area:** Initiation & Action — Import Sources
**Priority:** P3-Low

**Content:**
Import content from other tools:

**Potential sources:**
1. Obsidian (.md files)
2. Notion (export)
3. ChatGPT (export)
4. Plain text files
5. JSON from other apps

**For Stefan:**
Existing notes shouldn't need re-creation.
Import reduces starting friction.

**Implementation:**
Drag file onto canvas to import.
Import wizard for multi-file imports.

**Next:**
Explore third-party integrations

---

## Iteration 160

**Type:** Observation
**Area:** Information Architecture — Integrations
**Priority:** P3-Low

**Content:**
Connecting to other tools:

**Potential integrations:**
1. GitHub (link to repos, PRs)
2. Linear/Jira (task sync)
3. Slack (share snippets)
4. Browser extension (capture to Cognograph)

**For Stefan:**
Cognograph as hub, not island.
But: Keep core simple, integrations optional.

**Caution:**
Integrations add complexity.
Focus on core spatial experience first.

**Next:**
Explore plugin architecture

---

## Iteration 161

**Type:** Observation
**Area:** Information Architecture — Extensibility
**Priority:** P3-Low

**Content:**
Plugin/extension architecture:

**What plugins could add:**
- New node types
- New edge types
- Custom visualizations
- Integrations

**For Stefan:**
Plugins = others solve his specific needs.
But: Core should be complete without plugins.

**Caution:**
Plugin architecture is complex engineering.
Only if core is solid first.

**Next:**
Explore custom node types

---

## Iteration 162

**Type:** Observation
**Area:** Information Architecture — Custom Node Types
**Priority:** P3-Low

**Content:**
Could users define their own node types?

**Use cases:**
- "Bug Report" node (specific fields)
- "Meeting Notes" node (date, attendees, action items)
- "Research Paper" node (citation fields)

**Implementation:**
Template system for node content structure.
Custom colors and icons.

**For Stefan:**
Probably not needed.
Existing types (note, task, artifact) cover most cases.
Custom content can go in notes.

**Recommendation:**
Keep fixed node types for simplicity.
Notes are flexible enough for custom content.

**Next:**
Explore smart suggestions

---

## Iteration 163

**Type:** Recommendation
**Area:** Initiation & Action — Smart Suggestions
**Priority:** P2-Medium

**Content:**
AI-powered suggestions to reduce friction:

**Suggestion types:**
1. "Extract this to a note?" (when Claude produces key insight)
2. "Connect to related node?" (when content overlaps)
3. "Create task from this?" (when action item mentioned)

**For Stefan:**
AI assistant notices patterns he might miss.
Suggestions, not automatic actions.

**Implementation:**
Subtle suggestion indicator on node.
Click to apply or dismiss.

**Next:**
Explore auto-connect suggestions

---

## Iteration 164

**Type:** Recommendation
**Area:** Spatial Cognition — Auto-Connect
**Priority:** P2-Medium

**Content:**
Suggest connections between related nodes:

**Detection:**
- Content similarity
- Same topics mentioned
- Referenced in conversation

**Presentation:**
"These nodes seem related. Connect them?"
Dashed line preview showing proposed connection.

**For Stefan:**
Discovers relationships he didn't explicitly create.
But: User confirms (not automatic).

**Next:**
Explore content summarization

---

## Iteration 165

**Type:** Recommendation
**Area:** Information Architecture — Summarization
**Priority:** P2-Medium

**Content:**
AI summarization for long content:

**Use cases:**
- Summarize conversation → Title or badge
- Summarize connected context → Show preview
- Summarize project → Overview panel

**For Stefan:**
"What was that conversation about?" → Instant summary.
Reduces re-reading overhead.

**Implementation:**
Auto-generated summary as node subtitle.
Or: "Summarize" action in menu.

**Next:**
Explore semantic search (AI-powered)

---

## Iteration 166

**Type:** Recommendation
**Area:** Information Architecture — Semantic Search
**Priority:** P2-Medium

**Content:**
Search by meaning, not just keywords:

**Example:**
Search: "my thoughts on architecture"
Finds: Notes about system design (even without word "architecture")

**Implementation:**
Embed content with language model.
Vector similarity search.

**For Stefan:**
"I know I wrote about this concept somewhere..."
Semantic search finds it even with different words.

**Future feature:**
Complex to implement. Keyword search first.

**Next:**
Explore related nodes panel

---

## Iteration 167

**Type:** Recommendation
**Area:** Information Architecture — Related Nodes
**Priority:** P2-Medium

**Content:**
Panel showing related content:

**Concept:**
Select a node → See other nodes that might be relevant.
Based on: content similarity, connections, co-modification.

**For Stefan:**
"What else relates to this?"
Surfaces forgotten connections.

**Implementation:**
Panel in sidebar.
"Related to [selected node]" section.

**Next:**
Explore activity timeline

---

## Iteration 168

**Type:** Recommendation
**Area:** Information Architecture — Activity Timeline
**Priority:** P3-Low

**Content:**
Log of recent activity:

**Shows:**
- Nodes created
- Conversations had
- Edits made
- Connections added

**For Stefan:**
"What did I do yesterday?"
Activity log as memory aid.

**Access:**
Sidebar panel or dedicated view.

**Next:**
Explore undo/redo history visibility

---

## Iteration 169

**Type:** Recommendation
**Area:** Feedback Loops — Undo History Panel
**Priority:** P2-Medium

**Content:**
Visible undo history (not just Ctrl+Z):

**Panel shows:**
- List of actions (most recent at top)
- Can undo to specific point
- Can see what would be undone

**For Stefan:**
"I want to go back to 10 minutes ago"
History list > repeated Ctrl+Z.

**Implementation:**
Sidebar panel with action history.
Click action to undo to that point.

**Next:**
Explore action naming for undo

---

## Iteration 170

**Type:** Observation
**Area:** Feedback Loops — Action Names
**Priority:** P2-Medium

**Content:**
Actions need human-readable names for undo history:

**Good names:**
- "Created Note 'API Design'"
- "Deleted 3 nodes"
- "Connected Task to Conversation"
- "Moved 5 nodes"

**Bad names:**
- "Action performed"
- "State changed"

**For Stefan:**
Can scan history to find specific point.
"I want to undo the mass delete."

**Next:**
Explore redo breadcrumb

---

## Iteration 171

**Type:** Observation
**Area:** Feedback Loops — Redo After Undo
**Priority:** P2-Medium

**Content:**
After undo, redo should be available:

**Standard behavior:**
- Ctrl+Z undoes
- Ctrl+Shift+Z redoes
- New action clears redo stack

**Visual:**
Redo available indicator?
Or: Just rely on Ctrl+Shift+Z.

**For Stefan:**
"Oops, I undid too much" → redo.

**Next:**
Explore canvas history snapshots

---

## Iteration 172

**Type:** Recommendation
**Area:** Information Architecture — Canvas Snapshots
**Priority:** P3-Low

**Content:**
Save canvas state at meaningful moments:

**Auto-snapshots:**
- Before major operations
- Every N minutes
- On manual trigger

**For Stefan:**
"What did the canvas look like yesterday?"
Time travel through workspace history.

**Implementation:**
Git-like versioning behind the scenes.
Or: Periodic auto-backups with timestamp.

**Next:**
Explore multi-user scenarios

---

## Iteration 173

**Type:** Observation
**Area:** Information Architecture — Multi-User
**Priority:** P3-Low (future)

**Content:**
If multiple users work on same workspace:

**Scenarios:**
1. Sequential (pass file back and forth)
2. Real-time collaboration
3. Branch/merge (like git)

**For Stefan (solo user):**
Not relevant now.
But: File format should be mergeable.

**Recommendation:**
Design for potential future collaboration.
Keep format diffable/mergeable.

**Next:**
Explore canvas printing

---

## Iteration 174

**Type:** Observation
**Area:** Information Architecture — Print/Export
**Priority:** P3-Low

**Content:**
Printing canvas or parts of it:

**Use cases:**
- Print for physical review
- Export for presentation
- Share static snapshot

**Implementation:**
- Print current view
- Export as PNG/PDF
- Include or exclude UI elements

**For Stefan:**
Might want to print to review away from screen.

**Next:**
Explore canvas presentation mode

---

## Iteration 175

**Type:** Recommendation
**Area:** Information Architecture — Presentation Mode
**Priority:** P3-Low

**Content:**
Full-screen mode for presenting canvas:

**Features:**
- Hide UI chrome (toolbar, sidebar)
- Larger nodes
- Navigate with arrow keys
- Focus on content

**For Stefan:**
Showing workspace to collaborators.
Or: Personal review in focused mode.

**Implementation:**
F11 or dedicated "Present" button.

**Next:**
Explore accessibility: screen readers

---

## Iteration 176

**Type:** Observation
**Area:** Accessibility — Screen Reader Support
**Priority:** P2-Medium

**Content:**
Can screen reader users navigate the canvas?

**Challenges:**
- Canvas is visual/spatial
- Screen readers are linear
- Need semantic structure

**Implementation:**
- Nodes have accessible labels
- Navigation announces node content
- Relationships described

**For Stefan:**
Even if he doesn't use screen reader, semantic markup benefits keyboard users.

**Next:**
Explore accessibility: keyboard-only navigation

---

## Iteration 177

**Type:** Validation
**Area:** Accessibility — Keyboard Navigation
**Priority:** P1-High

**Content:**
Current keyboard navigation (from earlier iterations):

**Implemented:**
- Tab cycles nodes ✅
- Arrow keys navigate spatially ✅
- Shortcuts for common actions ✅
- ? shows all shortcuts ✅

**To verify:**
- Can reach ALL functionality via keyboard?
- Is focus always visible?
- Are all modals keyboard-escapable?

**For Stefan:**
Keyboard-first suits his workflow.
Mouse optional.

**Next:**
Explore keyboard shortcut customization

---

## Iteration 178

**Type:** Observation
**Area:** Accessibility — Shortcut Customization
**Priority:** P3-Low

**Content:**
Can users remap keyboard shortcuts?

**Scenarios:**
- Conflict with OS shortcut
- Personal preference
- Accessibility need (one-handed use)

**Implementation:**
Settings panel with shortcut editor.
Or: Configuration file.

**For Stefan:**
Default shortcuts should work.
But option to customize is reassuring.

**Next:**
Explore voice control potential

---

## Iteration 179

**Type:** Observation
**Area:** Accessibility — Voice Control
**Priority:** P3-Low (future)

**Content:**
Voice control for canvas interaction:

**Potential commands:**
"Create new note"
"Go to bookmark 1"
"Delete selected"

**For Stefan:**
Might be useful for hands-free moments.
But: Not core feature.

**Implementation:**
OS-level voice control (macOS Dictation, Windows Speech Recognition) could work if elements are properly labeled.

**Next:**
Explore haptic feedback

---

## Iteration 180

**Type:** Observation
**Area:** Feedback Loops — Haptic Feedback
**Priority:** P3-Low

**Content:**
Haptic feedback for actions:

**Currently:**
Electron apps don't have haptic.
Future: Trackpad haptics on Mac.

**Use cases:**
- Subtle bump on node drop
- Vibration on error
- Pulse on streaming complete

**For Stefan (severe ADHD):**
Multi-sensory feedback might help attention.
But: Desktop haptics limited.

**Alternative:**
Audio cues for feedback.

**Next:**
Explore audio feedback options

---

## Iteration 181

**Type:** Recommendation
**Area:** Feedback Loops — Audio Feedback
**Priority:** P2-Medium

**Content:**
Optional audio cues:

**Sound events:**
- Node created: Soft pop
- Message sent: Whoosh
- Response complete: Chime
- Error: Gentle alert

**For Stefan (ADHD):**
Audio can capture attention when visual doesn't.
Especially for background processes.

**Implementation:**
Optional in settings.
Subtle, non-annoying sounds.
Respect system mute.

**Next:**
Explore notification sounds

---

## Iteration 182

**Type:** Observation
**Area:** Feedback Loops — Notification Sounds
**Priority:** P3-Low

**Content:**
System notifications with sound:

**Scenarios:**
- Long process complete (when app backgrounded)
- Error requiring attention
- Message from Claude

**Implementation:**
Native system notifications.
User can configure in OS settings.

**For Stefan:**
Knows to check app without constantly watching.

**Next:**
Explore focus-aware behavior

---

## Iteration 183

**Type:** Observation
**Area:** Polish — App Focus State
**Priority:** P2-Medium

**Content:**
Behavior when app loses/gains focus:

**When backgrounded:**
- Continue any streaming
- Reduce animation (performance)
- Notify on completion

**When foregrounded:**
- Resume normal animation
- Show any pending notifications

**For Stefan:**
Can switch to other apps during long Claude responses.

**Next:**
Explore memory usage when backgrounded

---

## Iteration 184

**Type:** Observation
**Area:** Polish — Background Efficiency
**Priority:** P2-Medium

**Content:**
Resource usage when app not active:

**Reduce:**
- Animation frame rate
- Re-renders
- Polling frequency

**Maintain:**
- Streaming connections
- Autosave timers
- Notification listeners

**For Stefan:**
App shouldn't drain battery/memory when not active.

**Next:**
Explore startup efficiency

---

## Iteration 185

**Type:** Observation
**Area:** Polish — Startup Optimization
**Priority:** P2-Medium

**Content:**
Fast startup matters for initiation:

**Optimization:**
- Lazy load non-essential components
- Cache last workspace state
- Progressive render (structure then details)

**Target:**
< 2 seconds to interactive.

**For Stefan:**
"I'll just open it real quick..."
Fast startup = lower barrier.

**Next:**
Explore workspace switching speed

---

## Iteration 186

**Type:** Observation
**Area:** Polish — Workspace Switch
**Priority:** P2-Medium

**Content:**
Switching between workspaces:

**Flow:**
1. Current workspace saved
2. New workspace loaded
3. Canvas renders

**Animation:**
Smooth transition? Or instant swap?

**For Stefan:**
Frequent workspace switches shouldn't feel heavy.

**Recommendation:**
Save is fast (background), load is progressive.

**Next:**
Explore large workspace handling

---

## Iteration 187

**Type:** Observation
**Area:** Polish — Large Workspace Performance
**Priority:** P1-High

**Content:**
Workspaces with 100+ nodes:

**Performance considerations:**
- Render only visible nodes (virtualization)
- Level-of-detail at zoom levels
- Lazy load node content
- Index for fast search

**For Stefan:**
Big projects shouldn't become slow.

**Implementation:**
React Flow has virtualization.
Ensure it's configured correctly.

**Next:**
Explore node count warning

---

## Iteration 188

**Type:** Recommendation
**Area:** Information Architecture — Scale Warning
**Priority:** P3-Low

**Content:**
Warning when workspace gets large:

**Concept:**
"Your workspace has 200 nodes. Consider organizing into projects."

**Not blocking, just informational.**

**For Stefan:**
Helps maintain organization before it gets unmanageable.

**Next:**
Explore workspace archiving

---

## Iteration 189

**Type:** Recommendation
**Area:** Information Architecture — Archive
**Priority:** P3-Low

**Content:**
Archive old content within workspace:

**Concept:**
- Mark nodes as "archived"
- Archived nodes hidden by default
- Filter to show archived

**For Stefan:**
"I don't want to delete it but I'm done with it."
Reduces active clutter.

**Next:**
Explore soft delete

---

## Iteration 190

**Type:** Recommendation
**Area:** Information Architecture — Soft Delete
**Priority:** P2-Medium

**Content:**
Deleted items go to trash:

**Flow:**
1. Delete node → Moves to trash
2. Trash visible in sidebar
3. Can restore from trash
4. Permanently delete from trash (or auto-clear after N days)

**For Stefan:**
Reduces delete anxiety.
"I can get it back if I need it."

**Next:**
Explore trash UI

---

## Iteration 191

**Type:** Recommendation
**Area:** Information Architecture — Trash UI
**Priority:** P2-Medium

**Content:**
Trash bin interface:

**Features:**
- List of deleted items
- Timestamp of deletion
- Restore button
- Empty trash option

**Access:**
Sidebar icon or menu item.

**For Stefan:**
Visible trash = confidence to delete.

**Next:**
Explore edge deletion

---

## Iteration 192

**Type:** Observation
**Area:** Initiation & Action — Edge Deletion
**Priority:** P2-Medium

**Content:**
Deleting connections:

**Methods:**
1. Select edge + Delete key
2. Context menu on edge
3. Ctrl+Shift+L to unlink all selected nodes

**Questions:**
- Does edge go to trash? (Probably not)
- Is there edge undo? (Via general undo)

**For Stefan:**
Edge deletion should be as easy as node deletion.

**Next:**
Explore accidental edge creation prevention

---

## Iteration 193

**Type:** Observation
**Area:** Initiation & Action — Edge Creation Guards
**Priority:** P2-Medium

**Content:**
Preventing accidental edge creation:

**Problem:**
Drag near handle → Accidental edge started.

**Solutions:**
1. Require intentional click on handle
2. Confirmation for unexpected connections
3. Easy undo (Ctrl+Z)

**For Stefan:**
Accidental connections are confusing.
Clear intent required.

**Next:**
Explore edge creation feedback

---

## Iteration 194

**Type:** Observation
**Area:** Feedback Loops — Edge Creation Feedback
**Priority:** P2-Medium

**Content:**
Visual feedback during edge creation:

**Flow:**
1. Click on handle → Handle highlights
2. Drag → Line follows cursor
3. Hover over target → Target highlights
4. Release → Edge created or cancelled

**For Stefan:**
Clear visual state at each step.
"This is going to connect to that."

**Next:**
Explore invalid edge prevention

---

## Iteration 195

**Type:** Observation
**Area:** Information Architecture — Edge Validation
**Priority:** P2-Medium

**Content:**
Not all connections make sense:

**Invalid edges:**
- Node to itself
- Duplicate edge (already connected)
- Invalid type combinations? (Maybe not applicable)

**Feedback:**
If invalid: Handle turns red, can't connect.
Clear indication of why.

**For Stefan:**
"Why won't it connect?" → Clear answer.

**Next:**
Explore edge type selection

---

## Iteration 196

**Type:** Observation
**Area:** Information Architecture — Edge Type Selection
**Priority:** P2-Medium

**Content:**
If multiple edge types exist:

**Question:**
How does user choose edge type when connecting?

**Options:**
1. Default type, change later
2. Modifier key (Shift+drag = different type)
3. Menu after connection

**For Stefan:**
Most connections are context type.
Don't complicate simple case.

**Recommendation:**
Default to context edge. Change via edge menu if needed.

**Next:**
Explore edge properties panel

---

## Iteration 197

**Type:** Observation
**Area:** Information Architecture — Edge Properties
**Priority:** P3-Low

**Content:**
Can edges have properties?

**Possible properties:**
- Type (context, reference, dependency)
- Label (text on edge)
- Weight (importance)
- Notes

**For Stefan:**
Edge labels could help: "provides code context"
But: Might clutter canvas.

**Recommendation:**
Keep edges simple. Type only.
Labels optional/advanced.

**Next:**
Explore edge label visibility

---

## Iteration 198

**Type:** Observation
**Area:** Spatial Cognition — Edge Labels
**Priority:** P3-Low

**Content:**
Labels on edges:

**Visibility:**
- Always show labels
- Show on hover
- Show when edge selected

**For Stefan:**
Labels add information but also clutter.
Hover-reveal is good balance.

**Next:**
Explore canvas density management

---

## Iteration 199

**Type:** Observation
**Area:** Spatial Cognition — Density Management
**Priority:** P1-High

**Content:**
When canvas gets crowded:

**Symptoms:**
- Overlapping nodes
- Edge spaghetti
- Hard to find things

**Solutions:**
1. Zoom out for overview
2. Filter to reduce visible
3. Focus mode for isolation
4. Project collapse
5. Archive old content

**For Stefan:**
Multiple tools to manage density.
Clear path from "overwhelmed" to "focused."

**Next:**
Explore automatic layout assistance

---

## Iteration 200

**Type:** Summary + Recommendation
**Area:** Spatial Cognition — Auto Layout
**Priority:** P2-Medium

**Content:**
200 iterations reached. Summary of spatial organization tools:

**Existing:**
- Manual positioning ✅
- Minimap ✅
- Focus mode ✅
- Zoom levels ✅

**Recommended additions:**
1. Align/distribute tools (manual assist)
2. "Tidy up" button (auto-organize selected)
3. Snap to grid (optional)
4. Smart guides while dragging

**NOT recommended:**
Force-directed auto-layout that destroys user positions.
User's spatial memory is sacred.

**Auto-layout assistance:**
Only on NEW nodes (suggest position).
Only on explicit "tidy up" request.
Never rearrange without permission.

**This preserves the core principle:**
Stefan's spatial memory = positions he chose.

---

## Summary at Iteration 200

**Complete audit areas:**
1. ✅ Spatial Cognition (50+ iterations)
2. ✅ Feedback Loops (30+ iterations)
3. ✅ Initiation & Action (40+ iterations)
4. ✅ Consistency (25+ iterations)
5. ✅ Accessibility (20+ iterations)
6. ✅ Information Architecture (35+ iterations)
7. ✅ Polish (20+ iterations)

**Key implementation priorities:**
- P0: Position persistence, streaming visibility, context injection
- P1: Semantic zoom, edge direction, numbered bookmarks
- P2: Filter views, undo history panel, audio feedback
- P3: Templates, voice control, plugins

**Ready for implementation handoff.**

---

## Phase 2: Implementation Specifications

*Iterations 201+ focus on specific implementation details*

---

## Iteration 201

**Type:** Implementation Spec
**Area:** Spatial Cognition — Semantic Zoom CSS
**Priority:** P1-High

**Content:**
CSS implementation for semantic zoom:

```css
/* Zoom level detection via transform scale */
.react-flow__viewport[style*="scale(0.3"] .cognograph-node,
.react-flow__viewport[style*="scale(0.2"] .cognograph-node,
.react-flow__viewport[style*="scale(0.1"] .cognograph-node {
  /* Far zoom: hide content, show only shape */
}

.cognograph-node__content {
  /* Hide at far zoom */
  opacity: 1;
  transition: opacity 0.2s ease;
}

.far-zoom .cognograph-node__content {
  opacity: 0;
  pointer-events: none;
}

.cognograph-node__title {
  /* Show at mid zoom, hide at far */
}
```

**Alternative:**
React-based zoom detection with state:
```tsx
const zoom = useReactFlowViewport().zoom
const zoomLevel = zoom < 0.3 ? 'far' : zoom < 0.7 ? 'mid' : 'close'
```

**Next:**
Specify numbered bookmark implementation

---

## Iteration 202

**Type:** Implementation Spec
**Area:** Spatial Cognition — Numbered Bookmarks
**Priority:** P2-Medium

**Content:**
Store structure for numbered bookmarks:

```typescript
interface WorkspaceState {
  // ... existing state
  numberedBookmarks: {
    [key: number]: string | null // 1-9 maps to node ID
  }
}

// Actions
setNumberedBookmark: (number: number, nodeId: string | null) => void
jumpToNumberedBookmark: (number: number) => void
```

**Keyboard handling:**
```typescript
// In App.tsx keyboard handler
if (!isInputFocused) {
  // Shift+1-9 to SET bookmark
  if (e.shiftKey && e.key >= '1' && e.key <= '9') {
    const num = parseInt(e.key)
    const selectedId = selectedNodes[0]
    if (selectedId) {
      setNumberedBookmark(num, selectedId)
      sciFiToast(`Bookmark ${num} set`, 'info', 1500)
    }
  }
  // 1-9 to JUMP to bookmark
  if (!e.shiftKey && e.key >= '1' && e.key <= '9') {
    const num = parseInt(e.key)
    jumpToNumberedBookmark(num)
  }
}
```

**Next:**
Specify bookmark visual indicator

---

## Iteration 203

**Type:** Implementation Spec
**Area:** Polish — Bookmark Number Badge
**Priority:** P2-Medium

**Content:**
Visual badge for numbered bookmarks:

```tsx
// In node component
{numberedBookmarkNumber && (
  <div className={`bookmark-number bookmark-number--${numberedBookmarkNumber}`}>
    {numberedBookmarkNumber}
  </div>
)}
```

```css
.bookmark-number {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  color: white;
  z-index: 10;
}

/* Color per number for distinctiveness */
.bookmark-number--1 { background: var(--color-red-500); }
.bookmark-number--2 { background: var(--color-orange-500); }
.bookmark-number--3 { background: var(--color-yellow-500); }
.bookmark-number--4 { background: var(--color-green-500); }
.bookmark-number--5 { background: var(--color-teal-500); }
.bookmark-number--6 { background: var(--color-blue-500); }
.bookmark-number--7 { background: var(--color-indigo-500); }
.bookmark-number--8 { background: var(--color-purple-500); }
.bookmark-number--9 { background: var(--color-pink-500); }
```

**Next:**
Specify context flow animation

---

## Iteration 204

**Type:** Implementation Spec
**Area:** Feedback Loops — Context Flow Particles
**Priority:** P1-High

**Content:**
Animated particles along edges during context injection:

```tsx
// EdgeWithParticles component
function ContextEdge({ sourceX, sourceY, targetX, targetY, isFlowing }) {
  return (
    <>
      <BaseEdge ... />
      {isFlowing && (
        <ParticleFlow
          start={{ x: sourceX, y: sourceY }}
          end={{ x: targetX, y: targetY }}
          particleCount={5}
          speed={1000} // ms to traverse
        />
      )}
    </>
  )
}

// ParticleFlow uses framer-motion
function ParticleFlow({ start, end, particleCount, speed }) {
  return Array.from({ length: particleCount }).map((_, i) => (
    <motion.circle
      key={i}
      r={3}
      fill="var(--gui-accent-primary)"
      initial={{ cx: start.x, cy: start.y, opacity: 0 }}
      animate={{
        cx: [start.x, end.x],
        cy: [start.y, end.y],
        opacity: [0, 1, 1, 0]
      }}
      transition={{
        duration: speed / 1000,
        delay: (i / particleCount) * (speed / 1000),
        repeat: Infinity
      }}
    />
  ))
}
```

**Trigger:**
Set `isFlowing` on edge when message is being sent.

**Next:**
Specify streaming indicator at zoom levels

---

## Iteration 205

**Type:** Implementation Spec
**Area:** Feedback Loops — Zoom-Aware Streaming
**Priority:** P1-High

**Content:**
Streaming indicator visible at all zoom levels:

**Close zoom (current):**
```css
.streaming .streaming-dots { display: flex; }
```

**Far zoom — add glow pulse:**
```css
.streaming {
  /* Current streaming styles */
}

/* Add glow for far zoom visibility */
.streaming::after {
  content: '';
  position: absolute;
  inset: -10px;
  border-radius: inherit;
  background: radial-gradient(
    ellipse at center,
    var(--node-color) 0%,
    transparent 70%
  );
  animation: streaming-glow 1.5s ease-in-out infinite;
  pointer-events: none;
}

@keyframes streaming-glow {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}
```

**Minimap indicator (already exists):**
```css
.react-flow__minimap-node.streaming {
  animation: minimap-pulse 2s ease-in-out infinite;
}
```

**Next:**
Specify Focus Mode neighborhood dim

---

## Iteration 206

**Type:** Implementation Spec
**Area:** Spatial Cognition — Focus Mode Neighborhood
**Priority:** P1-High

**Content:**
In Focus Mode, connected nodes are dimmed less:

```typescript
// In workspaceStore or derived state
const getNodeOpacityInFocusMode = (nodeId: string) => {
  if (!focusModeNodeId) return 1
  if (nodeId === focusModeNodeId) return 1

  // Check if directly connected to focused node
  const isDirectlyConnected = edges.some(
    e => (e.source === focusModeNodeId && e.target === nodeId) ||
         (e.target === focusModeNodeId && e.source === nodeId)
  )

  if (isDirectlyConnected) return 0.6 // Less dimmed
  return 0.2 // Heavily dimmed
}
```

**CSS:**
```css
.cognograph-node--focus-connected {
  opacity: 0.6;
}

.cognograph-node--focus-dimmed {
  opacity: 0.2;
}
```

**Visual result:**
Focused node at 100%, neighbors at 60%, others at 20%.

**Next:**
Specify undo history panel

---

## Iteration 207

**Type:** Implementation Spec
**Area:** Feedback Loops — Undo History Panel
**Priority:** P2-Medium

**Content:**
Sidebar panel showing action history:

```tsx
function UndoHistoryPanel() {
  const undoStack = useWorkspaceStore(s => s.undoStack)
  const undoToIndex = useWorkspaceStore(s => s.undoToIndex)

  return (
    <div className="undo-history-panel">
      <h3>History</h3>
      <ul className="undo-history-list">
        {undoStack.map((action, index) => (
          <li
            key={index}
            onClick={() => undoToIndex(index)}
            className={index === currentIndex ? 'current' : ''}
          >
            <span className="action-name">{action.name}</span>
            <span className="action-time">{formatTime(action.timestamp)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Action naming:**
```typescript
// When recording undo state
recordUndo({
  name: 'Created Note "API Design"',
  timestamp: Date.now(),
  state: currentState
})
```

**Next:**
Specify trash system

---

## Iteration 208

**Type:** Implementation Spec
**Area:** Information Architecture — Trash System
**Priority:** P2-Medium

**Content:**
Soft delete with trash:

```typescript
interface WorkspaceState {
  // ... existing
  trash: {
    nodes: Array<{ node: Node; deletedAt: number }>
    maxAge: number // e.g., 7 days
  }
}

// Actions
moveToTrash: (nodeIds: string[]) => void
restoreFromTrash: (nodeId: string) => void
emptyTrash: () => void
cleanupOldTrash: () => void // Called on save
```

**UI:**
```tsx
function TrashPanel() {
  const trash = useWorkspaceStore(s => s.trash.nodes)
  const restoreFromTrash = useWorkspaceStore(s => s.restoreFromTrash)
  const emptyTrash = useWorkspaceStore(s => s.emptyTrash)

  return (
    <div className="trash-panel">
      <h3>Trash ({trash.length} items)</h3>
      {trash.map(item => (
        <div key={item.node.id} className="trash-item">
          <span>{item.node.data.title}</span>
          <button onClick={() => restoreFromTrash(item.node.id)}>
            Restore
          </button>
        </div>
      ))}
      {trash.length > 0 && (
        <button onClick={emptyTrash}>Empty Trash</button>
      )}
    </div>
  )
}
```

**Next:**
Specify audio feedback system

---

## Iteration 209

**Type:** Implementation Spec
**Area:** Feedback Loops — Audio System
**Priority:** P2-Medium

**Content:**
Optional audio cues:

```typescript
// audioService.ts
const sounds = {
  nodeCreated: '/sounds/pop.mp3',
  messageSent: '/sounds/whoosh.mp3',
  responseComplete: '/sounds/chime.mp3',
  error: '/sounds/alert.mp3'
}

let audioEnabled = localStorage.getItem('audioEnabled') === 'true'

export function playSound(sound: keyof typeof sounds) {
  if (!audioEnabled) return

  const audio = new Audio(sounds[sound])
  audio.volume = 0.3 // Subtle
  audio.play().catch(() => {}) // Ignore autoplay restrictions
}

export function setAudioEnabled(enabled: boolean) {
  audioEnabled = enabled
  localStorage.setItem('audioEnabled', String(enabled))
}
```

**Usage:**
```typescript
// In addNode action
addNode: (type, position) => {
  // ... create node
  playSound('nodeCreated')
}
```

**Settings toggle:**
In settings panel, checkbox for "Enable sound effects".

**Next:**
Specify filter view system

---

## Iteration 210

**Type:** Implementation Spec
**Area:** Information Architecture — Filter Views
**Priority:** P2-Medium

**Content:**
Filter to show subset of nodes:

```typescript
interface WorkspaceState {
  activeFilter: NodeFilter | null
}

interface NodeFilter {
  type?: NodeType[]  // Only show these types
  hasBookmark?: boolean
  modifiedAfter?: number // Timestamp
  connectedTo?: string // Node ID
}

// Derived state
const filteredNodes = computed(() => {
  if (!activeFilter) return nodes

  return nodes.filter(node => {
    if (activeFilter.type && !activeFilter.type.includes(node.type)) {
      return false
    }
    if (activeFilter.hasBookmark && !node.data.isBookmarked) {
      return false
    }
    // ... other filter logic
    return true
  })
})
```

**UI:**
Filter dropdown in toolbar:
- All nodes
- Conversations only
- Tasks only
- Bookmarked only
- Modified today

**Visual:**
Non-matching nodes set to `opacity: 0.1` or hidden.

**Next:**
Specify project collapse/expand

---

## Iteration 211

**Type:** Implementation Spec
**Area:** Information Architecture — Project Collapse
**Priority:** P2-Medium

**Content:**
Collapsible project nodes:

```typescript
interface ProjectNodeData {
  // ... existing
  isCollapsed: boolean
  memberNodeIds: string[]
}

// Actions
toggleProjectCollapse: (projectId: string) => void
```

**Rendering:**
```tsx
// In Canvas component
const visibleNodes = useMemo(() => {
  const collapsedProjectIds = nodes
    .filter(n => n.type === 'project' && n.data.isCollapsed)
    .map(n => n.id)

  const hiddenNodeIds = new Set(
    collapsedProjectIds.flatMap(pid =>
      nodes.find(n => n.id === pid)?.data.memberNodeIds || []
    )
  )

  return nodes.filter(n => !hiddenNodeIds.has(n.id))
}, [nodes])
```

**Visual:**
Collapsed project shows badge: "5 items hidden"
Double-click to expand.

**Next:**
Specify align/distribute tools

---

## Iteration 212

**Type:** Implementation Spec
**Area:** Spatial Cognition — Align Tools
**Priority:** P2-Medium

**Content:**
Alignment operations for selected nodes:

```typescript
// Actions
alignNodes: (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
distributeNodes: (direction: 'horizontal' | 'vertical') => void
```

**Implementation:**
```typescript
alignNodes: (direction) => {
  const selected = nodes.filter(n => selectedNodeIds.includes(n.id))
  if (selected.length < 2) return

  let targetValue: number

  switch (direction) {
    case 'left':
      targetValue = Math.min(...selected.map(n => n.position.x))
      break
    case 'right':
      targetValue = Math.max(...selected.map(n => n.position.x + n.width))
      break
    // ... etc
  }

  // Update positions
  set(state => {
    state.nodes = state.nodes.map(n => {
      if (!selectedNodeIds.includes(n.id)) return n
      return { ...n, position: { ...n.position, x: targetValue }}
    })
  })
}
```

**Access:**
- Context menu: "Align > Left/Center/Right..."
- Keyboard: Ctrl+Shift+L/C/R for align left/center/right

**Next:**
Specify smart guides during drag

---

## Iteration 213

**Type:** Implementation Spec
**Area:** Spatial Cognition — Smart Guides
**Priority:** P3-Low

**Content:**
Alignment guides while dragging:

```tsx
function SmartGuides({ draggingNode, allNodes }) {
  const guides = useMemo(() => {
    if (!draggingNode) return []

    const guides = []
    const threshold = 10 // pixels

    allNodes.forEach(node => {
      if (node.id === draggingNode.id) return

      // Check horizontal alignment
      if (Math.abs(node.position.y - draggingNode.position.y) < threshold) {
        guides.push({ type: 'horizontal', y: node.position.y })
      }

      // Check vertical alignment
      if (Math.abs(node.position.x - draggingNode.position.x) < threshold) {
        guides.push({ type: 'vertical', x: node.position.x })
      }
    })

    return guides
  }, [draggingNode, allNodes])

  return (
    <svg className="smart-guides">
      {guides.map((guide, i) => (
        guide.type === 'horizontal'
          ? <line key={i} x1={0} x2="100%" y1={guide.y} y2={guide.y} />
          : <line key={i} x1={guide.x} x2={guide.x} y1={0} y2="100%" />
      ))}
    </svg>
  )
}
```

**Next:**
Specify workspace thumbnail generation

---

## Iteration 214

**Type:** Implementation Spec
**Area:** Spatial Cognition — Workspace Thumbnails
**Priority:** P3-Low

**Content:**
Generate preview thumbnail on save:

```typescript
// thumbnailService.ts
async function generateWorkspaceThumbnail(): Promise<string> {
  // Get canvas element
  const canvas = document.querySelector('.react-flow__viewport')
  if (!canvas) return ''

  // Use html2canvas or similar
  const dataUrl = await html2canvas(canvas, {
    scale: 0.1, // Small preview
    backgroundColor: 'var(--gui-bg-primary)'
  })

  return dataUrl.toDataURL('image/png')
}

// Call on save
const saveWorkspace = async () => {
  const thumbnail = await generateWorkspaceThumbnail()
  const workspace = {
    ...currentState,
    metadata: {
      ...currentState.metadata,
      thumbnail
    }
  }
  // Save to file
}
```

**Display:**
In recent files list, show thumbnail if available.

**Next:**
Specify navigation history (back/forward)

---

## Iteration 215

**Type:** Implementation Spec
**Area:** Spatial Cognition — Navigation History
**Priority:** P2-Medium

**Content:**
Track and navigate viewport history:

```typescript
interface ViewportHistory {
  stack: Array<{ x: number; y: number; zoom: number }>
  currentIndex: number
}

// Actions
recordViewport: (viewport: Viewport) => void
navigateBack: () => void
navigateForward: () => void
```

**Implementation:**
```typescript
// Debounced viewport recording
const debouncedRecord = debounce((viewport) => {
  const last = viewportHistory.stack[viewportHistory.currentIndex]

  // Only record if significantly different
  if (!last ||
      Math.abs(last.x - viewport.x) > 100 ||
      Math.abs(last.y - viewport.y) > 100 ||
      Math.abs(last.zoom - viewport.zoom) > 0.2) {

    // Truncate forward history
    const newStack = viewportHistory.stack.slice(0, viewportHistory.currentIndex + 1)
    newStack.push(viewport)

    set({
      viewportHistory: {
        stack: newStack,
        currentIndex: newStack.length - 1
      }
    })
  }
}, 500)

// Navigation
navigateBack: () => {
  if (viewportHistory.currentIndex > 0) {
    const newIndex = viewportHistory.currentIndex - 1
    const viewport = viewportHistory.stack[newIndex]
    setViewport(viewport)
    set({ viewportHistory: { ...viewportHistory, currentIndex: newIndex }})
  }
}
```

**Keyboard:**
- Alt+Left: Back
- Alt+Right: Forward

**Next:**
Specify quick command execution

---

## Iteration 216

**Type:** Implementation Spec
**Area:** Initiation & Action — Command Execution
**Priority:** P2-Medium

**Content:**
Command palette executes actions quickly:

```typescript
interface Command {
  id: string
  name: string
  shortcut?: string
  action: () => void
  category: string
}

const commands: Command[] = [
  {
    id: 'create-conversation',
    name: 'Create Conversation',
    shortcut: 'Shift+C',
    action: () => createNode('conversation'),
    category: 'Create'
  },
  {
    id: 'focus-mode',
    name: 'Toggle Focus Mode',
    shortcut: 'F',
    action: () => toggleFocusMode(),
    category: 'View'
  },
  // ... many more
]
```

**Fuzzy search:**
```typescript
function filterCommands(query: string): Command[] {
  return commands.filter(cmd =>
    cmd.name.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  )
}
```

**Recent commands:**
Track last 5 executed commands, show at top of palette.

**Next:**
Specify API key setup flow

---

## Iteration 217

**Type:** Implementation Spec
**Area:** Initiation & Action — API Setup Flow
**Priority:** P0-Critical

**Content:**
First-run API key configuration:

```tsx
function ApiKeySetup() {
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')

  const validateKey = async () => {
    setStatus('validating')
    try {
      // Test API call
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2024-01-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        })
      })

      if (response.ok || response.status === 400) {
        // 400 means key is valid but request was bad (expected)
        setStatus('valid')
        saveApiKey(key)
      } else {
        setStatus('invalid')
      }
    } catch {
      setStatus('invalid')
    }
  }

  return (
    <div className="api-setup">
      <h2>Connect to Claude</h2>
      <p>Enter your Anthropic API key to get started.</p>
      <a href="https://console.anthropic.com" target="_blank">
        Get an API key →
      </a>
      <input
        type="password"
        value={key}
        onChange={e => setKey(e.target.value)}
        placeholder="sk-ant-..."
      />
      <button onClick={validateKey} disabled={status === 'validating'}>
        {status === 'validating' ? 'Checking...' : 'Connect'}
      </button>
      {status === 'invalid' && (
        <p className="error">Invalid API key. Please check and try again.</p>
      )}
      {status === 'valid' && (
        <p className="success">Connected! You're ready to go.</p>
      )}
    </div>
  )
}
```

**Next:**
Specify error toast component

---

## Iteration 218

**Type:** Implementation Spec
**Area:** Feedback Loops — Error Toast
**Priority:** P1-High

**Content:**
Toast notification for errors:

```tsx
// Already exists as sciFiToast, but ensure error variant:
function sciFiToast(
  message: string,
  type: 'info' | 'success' | 'warning' | 'error',
  duration = 3000
) {
  toast(message, {
    duration,
    className: `toast-${type}`,
    icon: type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✓' : 'ℹ',
    style: {
      background: type === 'error'
        ? 'var(--gui-error-bg)'
        : 'var(--gui-bg-secondary)',
      color: type === 'error'
        ? 'var(--gui-error-text)'
        : 'var(--gui-text-primary)'
    }
  })
}
```

**Error handling pattern:**
```typescript
try {
  await sendMessage(content)
} catch (error) {
  sciFiToast(
    error.message || 'Something went wrong. Please try again.',
    'error',
    5000 // Longer duration for errors
  )
}
```

**Next:**
Specify loading state component

---

## Iteration 219

**Type:** Implementation Spec
**Area:** Feedback Loops — Loading States
**Priority:** P2-Medium

**Content:**
Consistent loading indicators:

```tsx
// Spinner component
function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }[size]

  return (
    <div className={`spinner ${sizeClass}`}>
      <div className="spinner-ring" />
    </div>
  )
}

// CSS
.spinner {
  position: relative;
}

.spinner-ring {
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: var(--gui-accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Usage:**
```tsx
{isLoading ? <Spinner size="md" /> : <Content />}
```

**Next:**
Specify save indicator

---

## Iteration 220

**Type:** Implementation Spec
**Area:** Feedback Loops — Save Indicator
**Priority:** P1-High

**Content:**
Save status indicator:

```tsx
function SaveIndicator() {
  const saveStatus = useWorkspaceStore(s => s.saveStatus)
  // saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'

  const indicators = {
    saved: { icon: '✓', text: 'Saved', className: 'save-saved' },
    saving: { icon: <Spinner size="sm" />, text: 'Saving...', className: 'save-saving' },
    unsaved: { icon: '●', text: 'Unsaved', className: 'save-unsaved' },
    error: { icon: '!', text: 'Save failed', className: 'save-error' }
  }

  const { icon, text, className } = indicators[saveStatus]

  return (
    <div className={`save-indicator ${className}`} title={text}>
      <span className="save-icon">{icon}</span>
      <span className="save-text">{text}</span>
    </div>
  )
}
```

**Position:**
Top-right of canvas or in toolbar.

**Autosave trigger:**
```typescript
// Debounced autosave
const debouncedSave = debounce(() => {
  if (hasUnsavedChanges) {
    set({ saveStatus: 'saving' })
    try {
      await save()
      set({ saveStatus: 'saved' })
    } catch {
      set({ saveStatus: 'error' })
    }
  }
}, 5000)

// Call on state change
onChange: () => {
  set({ saveStatus: 'unsaved' })
  debouncedSave()
}
```

**Next:**
Specify minimap toggle shortcut

---

## Iteration 221

**Type:** Implementation Spec
**Area:** Spatial Cognition — Minimap Toggle
**Priority:** P2-Medium

**Content:**
Keyboard shortcut to toggle minimap:

```typescript
// In App.tsx keyboard handler
if (e.key === 'm' && !isInputFocused && !e.ctrlKey && !e.shiftKey) {
  e.preventDefault()
  toggleMinimapVisibility()
  sciFiToast(
    minimapVisible ? 'Minimap hidden' : 'Minimap shown',
    'info',
    1500
  )
}
```

**Store:**
```typescript
interface WorkspaceState {
  minimapVisible: boolean
  toggleMinimapVisibility: () => void
}
```

**Update KeyboardShortcutsHelp:**
Add to Navigation section:
```typescript
{ keys: 'M', description: 'Toggle minimap' }
```

**Next:**
Specify theme toggle implementation

---

## Iteration 222

**Type:** Implementation Spec
**Area:** Accessibility — Theme Toggle
**Priority:** P2-Medium

**Content:**
Light/dark theme switching:

```typescript
// themeStore.ts
interface ThemeStore {
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  effectiveTheme: 'light' | 'dark'
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: localStorage.getItem('theme') as any || 'system',

  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ theme })
    applyTheme(get().effectiveTheme)
  },

  get effectiveTheme() {
    const { theme } = get()
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return theme
  }
}))

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
}
```

**CSS:**
```css
[data-theme="dark"] {
  --gui-bg-primary: #0a0a0f;
  /* ... dark colors */
}

[data-theme="light"] {
  --gui-bg-primary: #ffffff;
  /* ... light colors */
}
```

**Next:**
Specify click-outside behavior

---

## Iteration 223

**Type:** Implementation Spec
**Area:** Consistency — Click Outside Hook
**Priority:** P2-Medium

**Content:**
Reusable click-outside detection:

```typescript
// hooks/useClickOutside.ts
function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handler()
      }
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [ref, handler, enabled])
}
```

**Usage:**
```tsx
function ContextMenu({ onClose }) {
  const menuRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuRef, onClose)

  return <div ref={menuRef}>...</div>
}
```

**Next:**
Specify tooltip component

---

## Iteration 224

**Type:** Implementation Spec
**Area:** Information Architecture — Tooltip Component
**Priority:** P2-Medium

**Content:**
Consistent tooltip component:

```tsx
// Tooltip.tsx
interface TooltipProps {
  content: React.ReactNode
  shortcut?: string
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

function Tooltip({
  content,
  shortcut,
  children,
  side = 'top',
  delay = 400
}: TooltipProps) {
  const [show, setShow] = useState(false)
  const timeout = useRef<number>()

  const handleMouseEnter = () => {
    timeout.current = window.setTimeout(() => setShow(true), delay)
  }

  const handleMouseLeave = () => {
    clearTimeout(timeout.current)
    setShow(false)
  }

  return (
    <div
      className="tooltip-trigger"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <div className={`tooltip tooltip--${side}`}>
          {content}
          {shortcut && <kbd className="tooltip-shortcut">{shortcut}</kbd>}
        </div>
      )}
    </div>
  )
}
```

**Usage:**
```tsx
<Tooltip content="Toggle bookmark" shortcut="B">
  <button onClick={toggleBookmark}>⭐</button>
</Tooltip>
```

**Next:**
Specify focus trap for modals

---

## Iteration 225

**Type:** Implementation Spec
**Area:** Accessibility — Focus Trap
**Priority:** P2-Medium

**Content:**
Focus trap for modal dialogs:

```typescript
// hooks/useFocusTrap.ts
function useFocusTrap<T extends HTMLElement>(ref: RefObject<T>, active = true) {
  useEffect(() => {
    if (!active || !ref.current) return

    const element = ref.current
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstFocusable = focusableElements[0] as HTMLElement
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement

    // Focus first element
    firstFocusable?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable?.focus()
        }
      }
    }

    element.addEventListener('keydown', handleKeyDown)
    return () => element.removeEventListener('keydown', handleKeyDown)
  }, [ref, active])
}
```

**Usage:**
```tsx
function Modal({ isOpen, onClose }) {
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, isOpen)

  if (!isOpen) return null

  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      ...
    </div>
  )
}
```

**Next:**
Specify keyboard navigation for nodes

---

## Iteration 226

**Type:** Implementation Spec
**Area:** Accessibility — Spatial Navigation
**Priority:** P1-High

**Content:**
Arrow key navigation to nearest node:

```typescript
// In App.tsx keyboard handler
if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
  if (isInputFocused) return

  e.preventDefault()
  const currentNode = nodes.find(n => selectedNodeIds.includes(n.id))
  if (!currentNode) {
    // Select first node if none selected
    if (nodes.length > 0) setSelectedNodes([nodes[0].id])
    return
  }

  const nearestNode = findNearestNode(currentNode, nodes, e.key)
  if (nearestNode) {
    setSelectedNodes([nearestNode.id])
    centerOnNode(nearestNode.id)
  }
}

function findNearestNode(
  from: Node,
  allNodes: Node[],
  direction: string
): Node | null {
  const candidates = allNodes.filter(n => {
    if (n.id === from.id) return false

    const dx = n.position.x - from.position.x
    const dy = n.position.y - from.position.y

    switch (direction) {
      case 'ArrowUp': return dy < -20
      case 'ArrowDown': return dy > 20
      case 'ArrowLeft': return dx < -20
      case 'ArrowRight': return dx > 20
    }
    return false
  })

  // Find closest by distance
  return candidates.reduce((closest, node) => {
    const dist = Math.hypot(
      node.position.x - from.position.x,
      node.position.y - from.position.y
    )
    const closestDist = closest ? Math.hypot(
      closest.position.x - from.position.x,
      closest.position.y - from.position.y
    ) : Infinity

    return dist < closestDist ? node : closest
  }, null as Node | null)
}
```

**Next:**
Specify confirm dialog component

---

## Iteration 227

**Type:** Implementation Spec
**Area:** Information Architecture — Confirm Dialog
**Priority:** P2-Medium

**Content:**
Reusable confirmation dialog:

```tsx
interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, isOpen)
  useClickOutside(dialogRef, onCancel, isOpen)

  if (!isOpen) return null

  return (
    <div className="confirm-overlay">
      <div ref={dialogRef} className="confirm-dialog" role="alertdialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="confirm-actions">
          <button onClick={onCancel}>{cancelLabel}</button>
          <button
            onClick={onConfirm}
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Usage:**
```tsx
const [showConfirm, setShowConfirm] = useState(false)

<ConfirmDialog
  isOpen={showConfirm}
  title="Delete Workspace?"
  message="This cannot be undone."
  confirmLabel="Delete"
  variant="danger"
  onConfirm={() => { deleteWorkspace(); setShowConfirm(false) }}
  onCancel={() => setShowConfirm(false)}
/>
```

**Next:**
Specify progress indicator for long operations

---

## Iteration 228

**Type:** Implementation Spec
**Area:** Feedback Loops — Progress Indicator
**Priority:** P2-Medium

**Content:**
Progress bar for long operations:

```tsx
interface ProgressBarProps {
  progress: number // 0-100
  label?: string
  showPercentage?: boolean
}

function ProgressBar({ progress, label, showPercentage = true }: ProgressBarProps) {
  return (
    <div className="progress-container">
      {label && <span className="progress-label">{label}</span>}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {showPercentage && (
        <span className="progress-percentage">{Math.round(progress)}%</span>
      )}
    </div>
  )
}
```

**CSS:**
```css
.progress-track {
  height: 4px;
  background: var(--gui-bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gui-accent-primary);
  transition: width 0.3s ease;
}
```

**Usage:**
For file operations, imports, exports showing progress.

**Next:**
Specify empty state component

---

## Iteration 229

**Type:** Implementation Spec
**Area:** Information Architecture — Empty State
**Priority:** P2-Medium

**Content:**
Reusable empty state component:

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3 className="empty-state-title">{title}</h3>
      {description && (
        <p className="empty-state-description">{description}</p>
      )}
      {action && (
        <button className="empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
```

**Usage:**
```tsx
// Search with no results
<EmptyState
  icon={<SearchIcon />}
  title="No results found"
  description="Try a different search term"
/>

// Empty trash
<EmptyState
  icon={<TrashIcon />}
  title="Trash is empty"
/>
```

**Next:**
Specify badge component

---

## Iteration 230

**Type:** Implementation Spec
**Area:** Polish — Badge Component
**Priority:** P3-Low

**Content:**
Badge for counts and status:

```tsx
interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
}

function Badge({
  children,
  variant = 'default',
  size = 'md'
}: BadgeProps) {
  return (
    <span className={`badge badge--${variant} badge--${size}`}>
      {children}
    </span>
  )
}
```

**CSS:**
```css
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-weight: 500;
}

.badge--sm { padding: 0 6px; font-size: 10px; height: 16px; }
.badge--md { padding: 0 8px; font-size: 12px; height: 20px; }

.badge--default { background: var(--gui-bg-tertiary); color: var(--gui-text-primary); }
.badge--success { background: var(--color-green-500); color: white; }
.badge--warning { background: var(--color-amber-500); color: black; }
.badge--error { background: var(--color-red-500); color: white; }
.badge--info { background: var(--color-blue-500); color: white; }
```

**Usage:**
```tsx
<Badge variant="info">5 items</Badge>
<Badge variant="success" size="sm">Active</Badge>
```

**Next:**
Create final implementation checklist

---

## Iteration 231

**Type:** Checklist
**Area:** Implementation Readiness
**Priority:** N/A

**Content:**
Implementation checklist from 230 iterations:

### P0 - Critical (Implement First)
- [x] Position persistence verified ✅ (nodes save/restore positions)
- [x] Streaming indicator visibility ✅ (cognograph-node--streaming class)
- [x] API key setup flow ✅ (ConnectorsTab/AddLLMModal + inline ApiKeyModal in ChatPanel)
- [x] Error handling with recovery ✅ (ErrorBoundary with retry, go home, bug report)
- [x] Context injection visibility (edge flow) ✅ (edge warmth/activation)

### P1 - High Priority
- [x] Semantic zoom (content at zoom levels) ✅
- [x] Focus Mode neighborhood dimming ✅
- [x] Numbered bookmarks (1-9 keys) ✅
- [x] Keyboard shortcuts help (? key) ✅
- [x] Spatial navigation (arrow keys) ✅ (already existed)
- [x] Save indicator ✅
- [x] Click behavior consistency ✅ (double-click canvas creates conversation)

### P2 - Medium Priority
- [x] Minimap toggle (M key) ✅ (already existed)
- [x] Theme toggle (D key) ✅
- [x] Undo history panel (H key) ✅
- [x] Trash/soft delete (T key) ✅
- [x] Audio feedback ✅ (audioService.ts - opt-in, Web Audio API)
- [x] Filter views ✅ (FilterViewDropdown)
- [x] Align/distribute tools ✅ (AlignmentToolbar - already existed)
- [x] Navigation history (back/forward, Alt+Arrow) ✅
- [x] Progress indicators ✅ (ProgressIndicator component)
- [x] Tooltips with shortcuts ✅

### P3 - Low Priority (Future)
- [x] Smart guides during drag ✅ (snapGuides.ts - already existed)
- [x] Workspace thumbnails ✅ (workspaceThumbnail.ts utility created)
- [x] Templates ✅ (templateStore.ts - already existed)
- [x] Saved views ✅ (V key - SavedViewsPanel)
- [x] Timeline view ✅ (L key - TimelineView component)
- [x] Voice control prep ✅ (voiceService.ts - Web Speech API foundation)

**Next:**
Create component inventory

---

## Iteration 232

**Type:** Inventory
**Area:** Components to Implement
**Priority:** N/A

**Content:**
New components needed:

### Core Components
1. `SaveIndicator` - Shows save status
2. `ProgressBar` - Long operation progress
3. `EmptyState` - Empty content placeholder
4. `ConfirmDialog` - Confirmation modal
5. `Tooltip` - Hover information

### Feature Components
6. `UndoHistoryPanel` - Sidebar undo list
7. `TrashPanel` - Deleted items list
8. `FilterDropdown` - Node filter selection
9. `NumberedBookmarkBadge` - 1-9 indicator
10. `ContextFlowParticles` - Edge animation

### Utility Hooks
11. `useClickOutside` - Click outside detection
12. `useFocusTrap` - Modal focus management
13. `useZoomLevel` - Current zoom detection
14. `useNavigationHistory` - Viewport history

### Services
15. `audioService` - Sound effects
16. `thumbnailService` - Workspace previews

**Next:**
Define testing requirements

---

## Iteration 233

**Type:** Testing
**Area:** Quality Assurance
**Priority:** N/A

**Content:**
Testing requirements for new features:

### Unit Tests
- Store actions (bookmarks, trash, filters)
- Utility functions (findNearestNode, etc.)
- Hooks (useClickOutside, useFocusTrap)

### Integration Tests
- Keyboard shortcuts work correctly
- Focus mode with neighborhood
- Undo/redo with history panel
- Filter views show correct nodes

### Visual Tests (Manual/Playwright)
- Semantic zoom at different levels
- Animation smoothness
- Theme switching
- Responsive behavior

### Accessibility Tests
- Keyboard navigation complete
- Focus indicators visible
- Screen reader announcements
- Reduced motion respect

**Next:**
Create final summary

---

## Iteration 234

**Type:** Final Summary
**Area:** Complete Audit
**Priority:** N/A

**Content:**
**Jake's UX Ralph Loop Complete: 234 Iterations**

### What We Produced
1. **Comprehensive audit** of all 7 UX domains
2. **200+ observations and recommendations**
3. **20+ implementation specifications** with code
4. **Component inventory** and testing requirements
5. **Prioritized checklist** for implementation

### Core Principle Preserved
> "Knowing WHERE things are without knowing WHAT they are"

All recommendations support Stefan's spatial memory workflow:
- Position persistence is sacred
- Spatial relationships visible
- Keyboard-first navigation
- Clear visual feedback
- ND-friendly patterns throughout

### Key Innovations
1. **Numbered bookmarks** (1-9) for instant spatial anchors
2. **Focus Mode neighborhood** keeps context visible
3. **Context flow particles** show data movement
4. **Semantic zoom** adapts to viewing distance
5. **Navigation history** (back/forward) for spatial exploration

### Implementation Path
1. Verify P0 items already work
2. Implement P1 features next sprint
3. Add P2 polish features
4. Consider P3 for future versions

**The spatial CLI vision is achievable.**

---

## Iteration 235

**Type:** Handoff Notes
**Area:** For Implementation Persona
**Priority:** N/A

**Content:**
Notes for whoever implements this:

### Quick Wins (< 1 day each)
1. Add M key to toggle minimap
2. Add numbered bookmark keyboard handling
3. Add save indicator component
4. Update KeyboardShortcutsHelp with new shortcuts

### Medium Effort (1-3 days each)
1. Implement Focus Mode neighborhood dimming
2. Add undo history panel
3. Implement trash system
4. Add filter dropdown

### Larger Features (1+ week each)
1. Semantic zoom with content levels
2. Context flow particle animation
3. Navigation history system
4. Audio feedback system

### Don't Forget
- Preserve all existing functionality
- Add tests for new features
- Update keyboard shortcuts help
- Consider reduced motion preferences

### Files to Modify
- `workspaceStore.ts` - New state fields
- `App.tsx` - Keyboard handlers
- `ConversationNode.tsx` - Visual states
- `animations.css` - New animations
- `KeyboardShortcutsHelp.tsx` - Updated list

**Ready for implementation. Spatial CLI vision awaits.**

---

## Completion Status

✅ **235 iterations complete**
✅ **All 7 audit domains covered**
✅ **Implementation specs provided**
✅ **Checklist created**
✅ **Handoff notes ready**

**Plan embodies "knowing WHERE things are without knowing WHAT they are"**

---

## Implementation Progress Log

### Implemented from Quick Wins:

**✅ Iteration 221: M key to toggle minimap**
- Added `minimapVisible` state to App.tsx
- M key handler toggles visibility
- Toast feedback: "Minimap shown" / "Minimap hidden"
- Updated KeyboardShortcutsHelp
- Commit: `971b4d0`

### Styleguide Sync (Full Sync 2026-02-01)

**✅ Design System Synchronized with styleguide-master_02.html**

Changes made to align codebase with latest design system:

**tokens.css:**
- Surface colors updated: darker canvas (#0d0d14), subtler grids (#1a1a24)
- Border subtlety reduced: 6% vs 50% for default borders
- Panel widths updated: sidebar 280px
- All token values now match styleguide exactly

**index.css:**
- `.gui-input` - Added padding, font-size, border-radius per styleguide
- `.gui-divider-h` - Changed width to 100% (was limited to 24px)
- `.gui-tab` - Added explicit `background: none; border: none;`
- `.gui-nav-item` - Added full border reset and width/text-align
- `.gui-toolbar` - Solid background (removed translucent backdrop)
- Added SVG icon sizing utilities: `.icon-12`, `.icon-14`, `.icon-16`, `.icon-18`
- Added toolbar layout system: `.gui-toolbar--full`, `.toolbar-left/middle/right`
- Added responsive toolbar modes: two-row, vertical, vertical-2col

**nodes.css:**
- Added `.cognograph-node__title--colored` - Uses ring-color for node type
- Added `.cognograph-node__icon--colored` - Colored icon without background

All 244 tests passing after sync.

*More implementations can be tracked here as quick wins are completed.*

---
