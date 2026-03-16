# Domain 1: Spatial Cognition

**Why First:** This is the core value prop. If spatial organization doesn't beat file trees for Stefan's brain, nothing else matters.

**Spatial CLI Criteria Being Tested:**
1. Position = Memory (find by WHERE, not WHAT)
2. Glanceable State (see status without reading)
3. Context is Visual (connections visible, not hidden)
4. No Lost Windows (everything on canvas)
5. Zoom = Scope (out = context, in = detail)
6. Persistence (arrangement survives sessions)

---

## Iter 1 — Canvas as Primary Interface

The canvas IS the primary interface. Not a feature, not a view — THE interface. This is correct.

**ND Check:**
- Initiation: No — canvas is always there, no decision to "open" it ✅
- Completion: N/A — canvas is persistent, not a task
- Overwhelm: Depends on node count — need to evaluate
- Feedback: Nodes visible = state visible ✅

**Verdict:** ✅ Validated. Canvas-first is right.

---

## Iter 2 — Node Position Persistence

From VISION.md: "Local-first with optional cloud sync" and workspace saves to JSON.

**Question:** Does node position persist EXACTLY? Or does it reflow/reset?

**Need to verify:** workspaceStore.ts — how is node position saved?

**ND Check:**
- If positions reset, spatial memory breaks completely
- This would be P0-Critical

**Action:** Queue workspaceStore.ts for reading.

---

## Iter 3 — Node Visual Distinction

8 node types, each with distinct border color:
- Conversation: Blue (#3b82f6)
- Project: Purple (#8b5cf6)
- Note: Amber (#f59e0b)
- Task: Green (#10b981)
- Artifact: Cyan (#06b6d4)
- Workspace: Red (#ef4444)
- Text: Slate (#94a3b8)
- Action: Orange (#f97316)

**ND Check:**
- Glanceable: Yes — color = type without reading ✅
- Distinct enough: Yes — no two colors are close ✅
- Colorblind consideration: Some risk (blue/purple, red/orange could blur)

**Verdict:** ✅ Validated with caveat.
**Recommendation (P3):** Consider adding shape or icon differentiation for colorblind users in future.

---

## Iter 4 — Node Icons

From styleguide, nodes have icons in header:
- Conversation: 💬 (MessageSquare)
- Project: 📁 (Folder)
- Task: ✅ (CheckSquare)
- Note: 📝 (StickyNote)
- Artifact: 📄 (File)
- Workspace: 🏠 (Home)
- Action: ⚡ (Zap)
- Text: T (Type)

**ND Check:**
- Icons + colors = redundant encoding ✅
- Can identify type by icon alone (if colorblind) ✅
- Can identify type by color alone (at distance) ✅

**Verdict:** ✅ Validated. Good redundancy.

---

## Iter 5 — Node Size Variation

From styleguide:
- Default min: 150px × 80px
- Project: 250px × 200px (larger, container)
- Workspace: 280px min-width
- Action: 220px min-width

**Spatial implication:** Larger nodes = more important/container role. This is correct visual hierarchy.

**ND Check:**
- Size = importance is intuitive ✅
- Projects being larger helps identify "groups" at a glance ✅

**Verdict:** ✅ Validated.

---

## Iter 6 — Edge Visibility

Edges connect nodes. From styleguide:
- Default stroke: #6b7280 (gray)
- Selected: #3b82f6 (blue), thicker
- Context flowing: animated dash

**Spatial implication:** Edges make relationships VISIBLE. This is "Context is Visual" criterion.

**Observation:** Edge color is neutral gray — doesn't indicate relationship TYPE.

**Reference check:**
- Miro: Edges can be colored
- Figma: Connections are minimal (not a graph tool)
- Obsidian: Graph edges are all same color

**Question:** Should edge color indicate something? Or is neutral correct?

**Verdict:** 🟡 Needs discussion. Could be enhancement or unnecessary complexity.

---

## Iter 7 — Minimap

From styleguide section P1: Minimap exists, collapsible.

**Spatial CLI value:** Minimap provides "zoom out" view — shows WHERE things are without details of WHAT.

**Question:** Is minimap color-coded to match node types?

**From styleguide CSS:** `.react-flow__minimap-node.streaming` has pulse animation, but no color specification found.

**ND Check:**
- If minimap is monochrome, you lose type information at overview level
- This hurts "Glanceable State" criterion

**Recommendation (P2):** Minimap nodes should inherit border color from node type.

---

## Iter 8 — Zoom Behavior

From visual-feedback-juiciness.md: ZoomIndicator component shows zoom level.

**Spatial CLI criteria:**
- Zoom = Scope: Out shows more nodes (context), in shows more detail ✅
- But does zooming out actually REDUCE detail on nodes?

**Question:** At low zoom, do node titles truncate/hide? Or do nodes just get tiny?

**Reference check:**
- Figma: At low zoom, text becomes illegible, shapes remain
- Miro: Same
- Notion databases: Cards simplify at smaller sizes

**Recommendation (P2):** Consider LOD (level of detail) — at <50% zoom, hide body text, show only header.

---

## Iter 9 — Canvas Navigation

How do you move around the canvas?
- Pan: Click-drag on empty space (standard)
- Zoom: Scroll wheel (standard)
- Fit view: Should exist

**Question:** Is there a "fit all" or "zoom to selection" command?

**ND Check:**
- "I'm lost on the canvas" is an anxiety trigger
- Need a reliable "go home" action

**Recommendation (P1):** Ensure Cmd+0 or toolbar button for "fit all nodes in view."

---

## Iter 10 — Selection Visibility

From styleguide:
```css
.cognograph-node.selected {
  outline: 2px solid var(--ring-color, #6366f1);
  outline-offset: 2px;
  filter: brightness(1.08);
}
```

**Spatial check:** Selected nodes are visually distinct (outline + brightness).

**ND Check:**
- Clear selection state reduces "wait, what did I click?" anxiety ✅
- Ring color matches node type (--ring-color) — good consistency ✅

**Verdict:** ✅ Validated.

---

## Iter 11 — Multi-Selection

Can you select multiple nodes? How are they visualized?

**Need to verify:** Multi-select behavior in actual implementation.

**Spatial expectation:**
- All selected nodes should have selection ring
- Some indication of "3 nodes selected" count

**Reference check:**
- Figma: Selection count in toolbar, all items have selection ring
- Miro: Same

**Action:** Queue for implementation verification.

---

## Iter 12 — Grouping (Projects)

Projects are containers for other nodes. From styleguide:
- Larger size (250px × 200px)
- Can contain child nodes
- Has collapse/expand

**Spatial value:** Groups create spatial hierarchy — "this cluster belongs together."

**Question:** When collapsed, where do children go? Hidden? Stacked?

**ND Check:**
- Hidden children = "lost windows" violation
- Need visual indicator that children exist

**Recommendation (P1):** Collapsed projects should show child count badge.

---

## Iter 13 — Drag & Drop

Nodes can be dragged to reposition. Standard canvas behavior.

**Spatial check:**
- Position changes should persist ✅ (assuming Iter 2 is true)
- Drag feedback should be immediate

**From styleguide:** No specific drag animation defined.

**Reference check:**
- Figma: Smooth drag, guides appear for alignment
- Miro: Same, plus grid snap option

**Recommendation (P2):** Consider alignment guides when dragging near other nodes.

---

## Iter 14 — Grid/Snap

Does the canvas have a grid? Snap-to-grid?

**From styleguide tokens:**
```css
--surface-grid: #1a1a24;
```

Grid exists visually. But is there snap?

**ND Check:**
- Snap-to-grid reduces decision fatigue ("where exactly should I put this?")
- But forced snap can feel restrictive

**Recommendation (P2):** Optional snap-to-grid toggle. Off by default, available for those who want it.

---

## Iter 15 — Search vs. Spatial

If canvas has 100+ nodes, how do you find one?

**Options:**
1. Spatial memory ("it's in the top-left cluster")
2. Search (Cmd+F, type name)
3. Layers panel (tree view)

**Spatial CLI tension:** Search/layers are NON-spatial. They undermine "Position = Memory."

**But:** Sometimes you genuinely forget where something is. Need escape hatch.

**Reference check:**
- Figma: Search exists but spatial is primary
- Miro: Same
- Obsidian: Graph view + search coexist

**Verdict:** Search/layers should SUPPLEMENT spatial, not replace it. Search result should PAN TO the node, not open it in a panel.

**Recommendation (P1):** Search should navigate canvas to result location, highlight it, NOT open a separate view.

---

## Iter 16 — Layer Panel Critique

From VISION.md, LeftSidebar has "Layers" tab — tree view of nodes.

**Spatial CLI concern:** A tree view is EXACTLY what we're trying to escape. Files in folders.

**Counter-argument:** Tree can be organized by Project containment, which mirrors spatial grouping.

**ND Check:**
- Tree view might be useful for people who CAN'T think spatially
- But for Stefan, it's a cognitive mode-switch

**Recommendation (P2):** Layers panel should be secondary. Don't encourage using it as primary navigation. Maybe rename to "Outline" to de-emphasize.

---

## Iter 17 — Canvas Persistence Across Sessions

**Critical question:** When I close and reopen Cognograph, is EVERYTHING exactly where I left it?

- Node positions
- Zoom level
- Pan position (viewport)
- Selection state
- Sidebar open/closed

**ND Check:**
- If ANY of these reset, spatial memory is broken
- "Where was I?" anxiety on every session start

**Recommendation (P0):** Verify ALL canvas state persists. This is non-negotiable for spatial CLI.

---

## Iter 18 — Multiple Workspaces

Can you have multiple workspaces? How do you switch?

**From VISION.md:** Workspaces are saved as files. Can open different ones.

**Spatial implication:** Each workspace is a separate spatial universe. Context doesn't cross workspaces.

**ND Check:**
- Too many workspaces = which one has the thing I need?
- Cross-workspace linking would help (WorkspaceNode exists for this)

**Verdict:** ✅ WorkspaceNode addresses cross-workspace context. Good design.

---

## Iter 19 — Empty Canvas State

When you create a new workspace, what do you see?

**ND Check:**
- Blank canvas = initiation paralysis
- "Where do I start?" anxiety

**Reference check:**
- Figma: Blank canvas, but templates available
- Miro: Template gallery on new board
- Notion: Template options

**Recommendation (P1):** New workspace should either:
- Start with a default Conversation node (most common action)
- Or show subtle "Click to add your first node" prompt

---

## Iter 20 — Node Density/Crowding

What happens when nodes overlap or crowd together?

**Questions:**
- Is there z-order control?
- Can nodes overlap visually?
- Is there auto-layout or manual only?

**Reference check:**
- Figma: Manual layout, nodes can overlap, z-order via layers
- Miro: Same

**ND Check:**
- Overlapping nodes = visual confusion
- Need easy way to "spread out" a cluster

**Recommendation (P2):** Consider auto-arrange feature for selected nodes (horizontal, vertical, grid).

---

## Iter 21 — Viewport as Context

The visible viewport IS your working context. Nodes off-screen are "out of mind."

**Spatial CLI value:** This is intentional. You zoom/pan to change context.

**But:** What if you need to reference something off-screen?

**Options:**
1. Zoom out (lose detail)
2. Open a second window (desktop feature)
3. Pin node to sidebar (breaks spatial model?)

**Observation:** PinnedWindow component exists in codebase.

**Question:** How does pinning work? Does it violate "No Lost Windows"?

**Recommendation (P2):** Pinning should show a floating mini-view of the pinned node, not hide it from canvas.

---

## Iter 22 — Spatial Memory Test

**Hypothesis test:** After using Cognograph for a week, can Stefan say:
- "My project planning stuff is in the upper-left"
- "Research conversations are clustered in the center"
- "Tasks I need to do are along the right edge"

If YES → Spatial CLI is working.
If NO → Something is breaking spatial memory.

**Action:** This is a usability test to run after implementation, not a code change.

**Recommendation:** Add to verification checklist: "After 1 week of use, can user describe where things are without looking?"

---

## Iter 23 — Context Injection Visualization

From VISION.md: "Connected nodes automatically feed into AI prompts."

**Spatial implication:** Edges aren't just visual — they're FUNCTIONAL. Connection = context.

**Question:** When chatting, can you SEE which nodes are providing context?

**From visual-feedback-juiciness.md:** ContextIndicator component shows sources.

**ND Check:**
- Invisible context = confusion ("why does Claude know about X?")
- Visible context = understanding spatial arrangement's function ✅

**Recommendation (P1):** Context sources must be visible before sending message. Consider: edges glow when their content is being injected.

---

## Iter 24 — Bidirectional Edges

Do edges have direction? From visual-feedback-juiciness.md: `isBidirectional` property exists.

**Spatial implication:**
- A → B: A provides context to B
- A ↔ B: Both provide context to each other

**Question:** Is direction visually indicated?

**Reference check:**
- Graph tools typically use arrows
- Some use different line styles

**Recommendation (P2):** Direction should be visually clear. Arrows or flow animation direction.

---

## Iter 25 — Edge Creation UX

How do you create an edge?

**Expected:** Drag from one node's handle to another's.

**From styleguide:**
```css
--handle-size: 16px;
--handle-hit-area: 40px;
```

Handles exist with defined sizes.

**ND Check:**
- Handle must be easy to hit (40px hit area ✅)
- Connecting action should be obvious (not hidden in menu)

**Verdict:** ✅ Validated (assuming standard React Flow behavior).

---

## Iter 26 — Edge as First-Class Object

Edges have properties (active/inactive, direction, color from source node).

**Question:** Can you select an edge? Edit its properties?

**From codebase:** ConnectionPropertiesPanel.tsx exists.

**Spatial implication:** Edges aren't just decoration — they're meaningful relationships that can be configured.

**Verdict:** ✅ Validated. Good depth.

---

## Iter 27 — Spatial Hierarchy Summary

Current spatial hierarchy:
1. **Workspace** — top level container (file)
2. **Canvas** — the spatial surface
3. **Project nodes** — grouping containers
4. **Other nodes** — individual items
5. **Edges** — relationships between nodes

**ND Check:**
- 5 levels is manageable
- Clear nesting: Workspace > Canvas > Projects > Nodes > Edges ✅

**Verdict:** ✅ Validated. Hierarchy is appropriate.

---

## Iter 28 — Text Node Purpose

Text nodes are "canvas annotations" — not connected, just labels.

**Spatial value:** You can annotate regions of the canvas. "This area is for research."

**ND Check:**
- Reduces need to remember what a cluster is for
- External memory aid ✅

**Verdict:** ✅ Good feature for spatial organization.

---

## Iter 29 — Spatial Consistency

**Key question:** Do ALL nodes behave the same way spatially?

- Draggable: All ✅
- Resizable: Need to verify
- Connectable: All except Text (intentional)
- Selectable: All ✅

**Recommendation:** Verify resize behavior is consistent across node types.

---

## Iter 30 — Domain 1 Summary

### What's Working (Validations)
- ✅ Canvas-first interface
- ✅ 8 distinct node colors + icons (redundant encoding)
- ✅ Node size hierarchy (projects larger)
- ✅ Selection visibility (ring + brightness)
- ✅ Edge properties panel (edges are first-class)
- ✅ WorkspaceNode for cross-workspace links
- ✅ Text nodes for spatial annotation
- ✅ 40px handle hit area for edge creation

### Needs Verification
- [ ] Node position persistence (exact, not reflowed)
- [ ] Viewport state persistence (zoom, pan)
- [ ] Multi-select behavior
- [ ] Collapsed project child visibility
- [ ] Search navigates to location (not separate view)

### Recommendations
| Priority | Issue | Recommendation |
|----------|-------|----------------|
| P0 | Canvas state persistence | Verify ALL state persists across sessions |
| P1 | Empty canvas anxiety | Add default node or "add first node" prompt |
| P1 | Search behavior | Search should pan to node, not open panel |
| P1 | Context injection visibility | Show which nodes are providing context |
| P1 | Collapsed project children | Show child count badge |
| P2 | Minimap colors | Match node type colors |
| P2 | Zoom LOD | Hide body text at <50% zoom |
| P2 | Alignment guides | Show guides when dragging |
| P2 | Auto-arrange | Feature to spread out selected nodes |
| P2 | Edge direction | Visual indicator (arrows/animation direction) |
| P3 | Colorblind support | Shape differentiation in addition to color |

---

## Stefan's Notes
*Space for Stefan to add context, corrections, or redirects*

-

---

## Checkpoint: Spatial Cognition Complete

**Iterations:** 1-30
**Findings:** 10 validations, 5 verifications needed, 11 recommendations
**Critical (P0):** 1 (state persistence)
**High (P1):** 5
**Medium (P2):** 6

**Ready to proceed to Domain 2: Feedback Loops?**
