# Style Guide Update Plan: Add Composed Sections to styleguide-master.html

## Objective

Add full composed component demos to `docs/design/styleguide-master.html`. Sections A-D (tokens, nodes, animations, playground) and E-J (isolated GUI atoms, toolbar atoms, panel atoms, modal atoms, toast, layout diagrams) already exist. What's missing is **full-fidelity composed recreations** of the actual app components using realistic content.

## File to Edit

`F:\Work Work\Aurochs\cognograph_02\docs\design\styleguide-master.html`

## What Already Exists (DO NOT recreate)

- **E1-E5**: Buttons, Inputs, Badges, Toggles, Cards (isolated atoms) ✓
- **F1-F4**: Toolbar container, buttons, dividers, responsive mode sketches (atoms only) ✓
- **G1-G5**: Panel container, header, tabs, collapsible sections, resize handle (atoms only) ✓
- **H1-H3**: Modal shell, nav items, settings controls (atoms only) ✓
- **I1**: Toast variants ✓
- **J1-J2**: Z-index stacking, layout mode diagrams ✓

## What to Add — Full Composed Demos

New sections K through P, inserted after J2 and before `</main>`. Update sidebar nav accordingly.

---

### Section K — Full Toolbar (Composed)

**K1 — Full Toolbar Single Row**

Complete toolbar matching app screenshot. Inside `.gui-toolbar`, horizontal flex:

- Group 1: sidebar toggle (☰), orientation toggle (↔)
- `.gui-divider-v`
- Group 2: file ops — New (📄), Open (📂), Save (💾 with green dot overlay for dirty state), Save As (📋)
- Settings (⚙)
- `.gui-divider-v`
- Group 3: Undo (↩), Redo (↪) — both dimmed/disabled
- `.gui-divider-v`
- Group 4: Node creation buttons in brand colors — 💬 (blue), 📁 (purple), ✅ (amber), ✓ (green), <> (cyan), 🏠 (red), ⚡ (orange), T (slate), ⚡action (orange)
- `.gui-divider-v`
- Group 5: AI Editor (🪄, purple), divider, Properties toggle (layers, cyan), Chat toggle (maximize, green), divider, Theme (🎨, purple)

Below toolbar: Status bar — "🏠 Cognograph Wor..." | "119 nodes" | "6 edges" | "⏱ Unsaved"

**K2 — Full Toolbar Two Row** (same content, split at node creation group)

**K3 — Full Toolbar Vertical** (same content, vertical stack)

---

### Section L — Full Left Sidebar (Composed)

**L1 — Full Left Sidebar**

~500px tall container, `gui-panel-translucent` with border-right:

- Top: "⚙ Cognograph" title row (accent color)
- Header: `gui-tab-active` "📋 Layers" | `gui-tab` "✨ Extractions" | chevron close "‹"
- Search: `gui-input` "🔍 Search nodes..."
- Sort bar: "Sort by:" + 4 icon buttons (group, alpha-asc, clock, grid) + kebab menu
- Tree content:
  - "> 📁 Todos — 55"
  - "> 📁 Todos - Complete — 26"
  - "  📁 In progress"
  - "> 📁 Backburner — 3"
  - "> 📁 QA Todos — 29"
  - Highlighted row: "  📁 New Action" (selected state, accent bg)
- Footer: "119 nodes · 1 selected"

---

### Section M — Full Properties Panel (Composed)

**M1 — Properties Panel: Task Node**

~700px tall scrollable container, `gui-panel` with border-left:

- Header: ✅ "Task" dropdown ∨ | × close button
- Title: `gui-input` "Add text objects for the canvas"
- Color: "Color" label + 🟢 green circle
- Icon: "Icon" label + "—" button
- Node Enabled: toggle ON (green) + "⚡ Conditional Activation" collapsed chevron
- Content: textarea with text "Annotations the user can add to the canvas. Interacts with it like it's a node..."
- Status: "● To Do" dropdown
- Priority: "🔴 High" dropdown
- Complexity: "🟡 Moderate" dropdown + sparkle icon
- Tags: "Feature ×" badge in accent color
- AI Response: textarea "[2026-01-23] Starting Text Node implementation (Phase 7)\n[2026-01-23] Rolled back - not part of Phase 3"
- URL: `gui-input` "https://..."
- "+ Add property" link
- Collapsible sections: "> 📎 Attachments" | "> Node Metadata" | "> ↔ Outgoing Edge Color"
- Timestamps: "Created: 1/21/2026, 8:53:50 PM\nUpdated: 1/23/2026, 9:31:32 PM"
- Footer: red "🗑 Delete Node" button full-width

**M2 — Properties Panel: Action Node**

Same container style, different content:

- Header: ⚡ "Action" dropdown ∨ (orange icon) | × close button
- Title: `gui-input` "New Action"
- Color: "Color" label + 🟠 orange circle
- Icon: "Icon" label + "—" button
- Node Enabled: toggle ON
- Status: "⚡ Enabled" badge (green dot + text, right-aligned)
- "> ✦ Conditional Activation" collapsed
- Description: textarea "What does this action do?"
- Trigger Type: "Manual" dropdown + hint "Triggered by clicking the play button"
- Conditions: "Conditions" + "+ Add" right-aligned, "No conditions (always execute)" hint
- Action Steps: "Action Steps (0)" + "+ Add Step" right-aligned, "No steps configured" hint
- Execution Stats: 3-column card — "0 Runs" | "0 Errors" (red) | "— Last Run"
- Tags: `gui-input` "Add tags..."
- URL: `gui-input` "https://..."
- "+ Add property" link
- Collapsible sections: "> 📎 Attachments" | "> Node Metadata" | "> ↔ Outgoing Edge Color"
- Timestamps: "Created: 1/27/2026, 5:19:12 PM\nUpdated: 1/27/2026, 5:19:12 PM"
- Footer: red "🗑 Delete Node" button full-width

**M3 — Properties Panel: Floating Modal**

One of the above wrapped in `.gui-modal` (no left border, drop shadow).

---

### Section N — Rich Node Cards (Composed)

Extends B1 which only has minimal placeholder text. These show node cards with full realistic content.

**N1 — Conversation Node Card**
Blue border, header (💬 "Chat with Claude"), body (message preview "Let me analyze the architecture..." + property badges row: "Feature" default badge, "High" accent badge), footer (token meter at 45% + "2m ago").

**N2 — Task Node Card**
Green border, header (✅ "Add text objects for the canvas"), body (description text + status "● To Do" + "Feature" tag), footer (created date).

**N3 — Project Node Card**
Purple border, larger min-width, header (📁 "Cognograph v1.4"), body (description + "12 children" count), footer (node count).

**N4 — Note Node Card**
Amber border, header (📝 "Architecture Notes"), body (rich text preview with bold heading), footer (timestamp).

**N5 — Action Node Card**
Orange border, header (⚡ "New Action" + ▶ play button right-aligned), body ("WHEN: Manual" label + "● Enabled" green status), footer (stats row).

**N6 — Artifact Node Card**
Cyan border, header (📄 "schema.json"), body (file type info + size), footer (timestamp).

**N7 — Workspace Node Card**
Red border, header (🏠 "Cognograph Workspace"), body (node/edge counts), footer (last saved).

**N8 — All Types Grid**
Grid of all 8 types with realistic content (JS-built like `buildNodeTypeGrid` but with richer data).

---

### Section O — Full Settings Modal (Composed)

**O1 — Full Settings Modal**

Simulated backdrop + `.gui-modal` (680px wide, max-height ~500px):

- Header: `gui-panel-header` — ⚙ "Settings" + × close
- Two-column layout:
  - Left nav (w-48, border-right): 4 `gui-nav-item`s — 🖥 "Program" (active), 📁 "Workspace", ⚙ "Defaults", 🔌 "Connectors"
  - Right content (flex-1, scrollable) showing Program tab:
    - "Theme Mode" — "Dark" (accent selected) / "Light" option buttons
    - "AI Color Palette" — toggle ON
    - "Show Token Estimates" — toggle ON
    - "Properties Display" — "Sidebar" (accent) / "Modal" buttons
    - "Chat Display" — "Column" / "Modal" (accent) buttons
- Footer: border-top + "Done" `gui-btn-accent` right-aligned

---

### Section P — Minimap & Zoom Controls (Composed)

**P1 — Minimap**

Collapsible widget: header "⊞ 📖 Map ∨" (clickable), content area with colored rectangles representing nodes on canvas (purple, green, cyan blocks on dark bg).

**P2 — Zoom Controls**

Vertical button group: "+" / "−" / fit-to-view (⛶) / lock (🔒). Dark panel bg, rounded, border.

---

## Implementation Steps

1. Update sidebar nav: add K-P section links under new nav group "K — Compositions"
2. Add composed demo helper CSS: `.sg-composed-frame { border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden; background: var(--surface-canvas); }` and `.sg-properties-panel { width: 360px; max-height: 700px; overflow-y: auto; }` etc.
3. Add sections K1-K3 (Full Toolbar)
4. Add section L1 (Full Left Sidebar)
5. Add sections M1-M3 (Full Properties Panels — Task, Action, Floating)
6. Add sections N1-N8 (Rich Node Cards)
7. Add section O1 (Full Settings Modal)
8. Add section P1-P2 (Minimap + Zoom)
9. Add JS builders for dynamic composed demos (e.g. `buildFullToolbar()`, `buildRichNodeCards()`)

## Verification

1. Open `docs/design/styleguide-master.html` in browser
2. Sidebar nav links scroll to all new K-P sections
3. **Composed demos visually match the app screenshots** — especially toolbar, sidebar, both properties panel variants (Task + Action), settings modal, action node card
4. Toggle dark/light — all composed demos adapt via tokens
5. Switch theme presets — composed demos pick up new colors
6. Interactive: toggles click, tabs switch, sections collapse, nav items highlight
