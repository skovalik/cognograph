# Features

> Complete feature documentation for Cognograph. For architecture details, see [ARCHITECTURE.md](./ARCHITECTURE.md). For the design philosophy behind these features, see [docs/strategy/VISION.md](./docs/strategy/VISION.md).

---

## Core: Context Injection

The foundational innovation. When you draw an edge between nodes, the system walks the graph via breadth-first traversal on inbound edges (+ bidirectional edges) and assembles the AI's context window automatically.

- **Graph-based context assembly** — Notes become reference material, Tasks become constraints, Projects define scope
- **Edge direction and weight** control priority — stronger connections contribute more context
- **Token budget tracking** — See how much context each connection contributes, stay under limits
- **Context depth control** — Configure how many hops of the graph to traverse per conversation
- **Landmark nodes** — Mark key reference nodes that always get priority regardless of graph distance

**The act of organizing your work IS the act of programming the AI.**

---

## Semantic Zoom (Rich Node Depth System)

The canvas adapts its visual detail level to your zoom automatically. No mode switching required.

### 5-Level LOD (Level of Detail)

| Level | Zoom Range | Behavior |
|-------|-----------|----------|
| **L0 — Far** | < 0.3x | Colored rectangles with icon + title. Cluster summary bubbles. Weak edges hidden. For scanning and orientation. |
| **L1 — Overview** | 0.3x - 0.5x | Property badges and metadata appear. Edge labels become readable. |
| **L2 — Mid** | 0.5x - 0.75x | Full node content progressively reveals. All connection types visible. |
| **L3 — Close** | 0.75x - 1.0x | Complete content, descriptions, property panels, all handles. |
| **L4 — Expanded** | > 1.0x or hotkey | In-place artboard mode — node expands on canvas for deep work. |

### How It Works

- Every node component reads the current zoom level via the `useNodeContentVisibility` hook
- CSS `data-lod` attributes on each node enable LOD-specific styling without re-renders
- Hysteresis (deadband of +/-0.02) prevents jitter at zoom thresholds
- All 9 node types implement the full LOD cascade

### Edge LOD

- **Weak/light edges** hide at far and mid zoom to reduce visual noise
- **Strong and bidirectional edges** remain visible at all zoom levels
- Edge labels and decorations progressively appear as you zoom in

---

## Canvas Intelligence

### Canvas Districts

Named spatial zones on the canvas. Promote any spatial region to a district to give it a name, tint color, and visual boundary.

- Visual district labels rendered as an overlay on the canvas
- Districts appear in the Canvas Table of Contents for quick navigation
- Configurable styles: tint color, hatching pattern, opacity

### Canvas Table of Contents

`Ctrl+Shift+T` — Searchable, sortable outline of your entire canvas.

- **Sort modes:** Recent, Alphabetical, By Type
- **Search:** Filter nodes by title in real-time
- **Click to navigate:** Clicking any entry zooms the viewport to that node
- Shows districts, landmarks, and all node types

### Context Visualization

Visual display of context injection paths.

- **Context Scope Badge** — Hover a conversation node to see which nodes feed it context
- **Visual highlighting** — Nodes included in context get `context-viz-included` class
- **BFS radius display** — See how far the graph traversal reaches from any node

### Cognitive Load Meter

Real-time indicator of canvas complexity. Visible at overview zoom (< 0.8x), hidden in Calm Mode.

- **Score calculation:** Weighted combination of visible node count + connection density
- **4 levels:** Clear (green), Active (amber), Dense (orange), Overloaded (red)
- **Actionable hints:** "Consider zooming in or filtering" / "Try Focus Mode or Calm Mode"

### Calm Mode

Strips away all secondary UI for distraction-free work.

- Hides: badges, meters, overlays, density bars, word counts, context labels, decorative elements
- Toggle via context menu or store API
- Respects `prefers-reduced-motion` for animation removal

### Session Re-Entry

When you return to Cognograph after being away:

- **Session Re-Entry Prompt** surfaces your most recently interacted nodes
- **Recency indicators** — recently-touched nodes get `recency-fresh` / `recency-warm` CSS classes
- `recordInteraction()` tracks which nodes you worked with and when

### Landmark Nodes

Nodes marked as landmarks:

- Always get priority in context injection regardless of graph distance
- Visually distinguished on the canvas
- Appear prominently in the Canvas Table of Contents

---

## Navigation

### Z-Key Zoom Overlay

Hold **Z** → full-screen bird's-eye minimap overlay appears.

- All nodes rendered as color-coded miniature rectangles by type
- Current viewport shown as a dashed rectangle
- Drag to select a target area → release Z → viewport animates to selection (300ms)
- Press Escape to cancel

### Keyboard Mode Indicator

Persistent HUD badge in the bottom-right showing current input mode:

| Mode | Color | When Active |
|------|-------|-------------|
| Navigate | Blue | Default — canvas panning and selection |
| Edit | Green | Text input or contenteditable focused |
| Terminal | Amber | Terminal widget focused |
| Artboard | Purple | In-place node expansion active |

### Cluster Overlay

At far zoom (L0), nodes that are spatially grouped show cluster summary bubbles:

- Display node count and primary types in each cluster
- Click a cluster bubble to zoom into that group
- 300ms debounce prevents flicker during rapid zoom

---

## Node Types

### Conversation Node
Chat with AI. Context-aware via graph connections. Supports multiple LLM providers (Anthropic, OpenAI, Google Gemini). Per-node model selection.

### Note Node
Static content — research, guidelines, references. **10 visual modes** for different content types.

### Task Node
Actionable items with status tracking, priority, and due dates.

### Project Node
Group and scope related nodes. Collapsible member list.

### Artifact Node
Files dropped onto the canvas or generated by AI. URL preview with configurable viewport and refresh. Source code display.

### Text Node
Rich-text freeform blocks powered by TipTap editor.

### Action Node
Spatial trigger zones. Drag a node into an Action zone and it auto-summarizes, auto-categorizes, or runs custom logic. Suggested automations based on dropped content.

### Workspace Node
Top-level container with settings and defaults for child nodes.

---

## AI Features

### Plan-Preview-Apply

Ask the AI to reorganize your canvas:

1. AI generates a mutation plan (create, move, connect, edit nodes)
2. Ghost nodes preview what's about to change
3. Refine conversationally — adjust the plan before applying
4. Apply atomically with per-operation undo

### Agent Mode

Conversation nodes can act autonomously:

- Creating, editing, and connecting nodes on the canvas
- File system access (sandboxed)
- Orchestrator nodes coordinate multi-agent workflows

### AI Editor Modal

Full AI-powered editor with streaming responses, plan generation, and refinement loops.

---

## Claude Code Integration

### 3-Tier Session Mapping

| Tier | Method | How It Works |
|------|--------|-------------|
| **Tier 1** | Automatic | `COGNOGRAPH_NODE_ID` env var auto-links session to node |
| **Tier 2** | Manual | Right-click node → "Link to CC session" |
| **Tier 3** | Prompted | Toast notification when unlinked session detected |

### Execution Status

- Live status tracking: running / idle / exited per session
- Depth-of-field blur on non-active nodes during execution
- Visual execution overlay on the canvas

### Dispatch Workflows

Right-click context menu to trigger predefined workflows on nodes. Configurable dispatch actions with parameter passing.

### Embedded Terminal

PTY-backed terminal sessions (requires `node-pty` native module):

- Rolling scrollback buffer (5,000 lines) for replay when xterm.js remounts
- Session status tracking: running → idle (30s timeout) → exited
- Context file injection — builds a context file from connected nodes and passes it to the spawned process

### MCP Server

Expose your workspace to Claude Code and other MCP-compatible agents:

- Read/write nodes, edges, and workspace metadata
- Tool-based interface following the Model Context Protocol
- Diagnostic server for connection debugging

---

## Plugin System

Extensible architecture for third-party integrations.

- **IPC security sandboxing** — Plugin IDs validated (`[a-z][a-z0-9-]{0,63}`), `__` prefix blocks credential exposure
- **Plugin renderer registry** — Plugins can register UI components (settings tabs, node decorators)
- **Preload bridge** — `plugins.call()` / `plugins.on()` + `plugins.getEnabledIds()`

### Notion Integration (built-in plugin)

- **Workspace sync** — Sync workspace metadata to Notion databases
- **Node-level sync** — Per-node push/pull to Notion pages
- **Property mapping** — Cognograph properties ↔ Notion properties (title case: 'Name', 'Canvas ID', etc.)
- **Content conversion** — HTML ↔ Notion blocks with 2,000-char split and lossiness tracking
- **Sync queue** — Offline-resilient queue with 7-day expiry

---

## Visual & UX

### Glass Mode

Optional translucent UI theme with blur effects. Granular per-element opacity controls.

### 20+ Ambient Effects

Living Grid, Topography, Aurora, Starfield, Fireflies, Rain, Particles, Iridescence, Beams, Prism, Mesh, Dither, and more. GPU-friendly, togglable per-workspace.

### Design System

- **Token-based theming** — CSS custom properties for colors, spacing, typography
- **shadcn/ui components** — 26+ UI components in `components/ui/`
- **Z-index system** — Semantic layers: `gui-z-modals`, `gui-z-dropdowns`, `gui-z-toasts`

### Edge System

- Custom edge rendering with bidirectional support
- Connection properties panel for edge metadata editing
- Edge grammar: visual encoding of relationship type, strength, and direction
- Edge Grammar Legend (toggle) explains the visual encoding

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | Canvas Table of Contents |
| `Z` (hold) | Zoom navigation overlay |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+Shift+F` | FPS counter overlay |
| `Delete` / `Backspace` | Delete selected nodes |
| `Ctrl+A` | Select all |
| `Ctrl+C` / `Ctrl+V` | Copy / Paste nodes |
| `Space` (hold) | Pan mode |
| `Escape` | Deselect / Close overlays |

---

## Technical Details

| Metric | Value |
|--------|-------|
| Test suite | 1,305 tests across 67 files (Vitest) |
| TypeScript | Strict mode, no `any` types |
| Zustand stores | 37 stores |
| Node types | 8 (+ Orchestrator) |
| IPC channels | ~93 |
| Ambient effects | 20+ |
| LOD levels | 5 (L0-L4) |

---

*For architecture details, see [ARCHITECTURE.md](./ARCHITECTURE.md). For the design philosophy, see [docs/strategy/VISION.md](./docs/strategy/VISION.md).*
