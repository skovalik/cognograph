# Extended Loop: Iterations 201-250

**Focus Areas:**
- Z-Axis & Layering (iron-clad)
- Project Grouping & Membership
- Custom Node Types
- Project View Tab
- Cross-Domain Synthesis
- Emergent Patterns

---

## Section A: Z-Axis & Layering (Iterations 201-215)

### Iter 201 — Z-Axis Problem Statement

**The Problem:**
Canvas is 2D but users need to:
1. Know which node is "on top" when overlapping
2. Control stacking order intentionally
3. Understand parent-child relationships visually

**Current state:** React Flow handles z-index automatically based on selection/interaction.

**ND Check:**
- Uncontrolled z-order = anxiety ("is this in front or behind?")
- Need explicit control AND visual feedback

**Question:** What z-axis controls do users actually need?

---

### Iter 202 — Z-Axis Use Cases

**When does z-order matter?**

1. **Overlapping nodes** — Which is on top?
2. **Project containers** — Children should render "inside" parent
3. **Grouping** — Selected group should lift together
4. **Focus** — Active node should be on top
5. **Edges** — Should edges render above or below nodes?

**Reference check:**
- Figma: Layers panel controls z-order explicitly
- Miro: Bring to front / send to back
- Notion: No z-axis (flat document)

**Recommendation (P1):** Need explicit z-order controls AND visual hierarchy.

---

### Iter 203 — Z-Order Control Mechanisms

**Options for controlling z-order:**

A) **Context menu:** "Bring to Front" / "Send to Back" / "Bring Forward" / "Send Backward"
B) **Keyboard shortcuts:** Cmd+] / Cmd+[ (Figma pattern)
C) **Outline panel:** Drag to reorder (layer order = z-order)
D) **Automatic:** Selected items always on top, deselected return to position

**ND Check:**
- Context menu = discoverable but slow
- Keyboard = fast but invisible
- Outline = explicit but requires panel
- Automatic = predictable but less control

**Recommendation (P1):** All of the above:
- Context menu for discovery
- Keyboard for power users
- Outline panel shows order (this is why Stefan kept it!)
- Automatic for common case

---

### Iter 204 — Outline Panel as Z-Order Truth

**Reframe:** The "Outline" panel isn't just navigation — it's the z-order truth.

**Design:**
- Top of list = front (highest z-index)
- Bottom of list = back (lowest z-index)
- Drag items to reorder z-index
- Indentation shows parent-child (project membership)

**This solves Stefan's concern:**
- "Is this node in this project?" → Check outline indentation
- "What's on top?" → Check outline order
- "Move this to front" → Drag to top of outline

**Verdict:** Outline panel is NOT redundant — it's the z-axis and hierarchy truth source.

---

### Iter 205 — Visual Z-Order Indicators on Canvas

Even with Outline panel, canvas needs z-order hints.

**Options:**
1. **Shadow depth** — Nodes "higher" have stronger shadows
2. **Slight scale** — Front items 1-2% larger
3. **Opacity** — Back items slightly dimmer
4. **Overlap indicator** — Show number when stacked

**ND Check:**
- Subtle cues work subconsciously
- Explicit indicators for verification

**Recommendation (P2):** Shadow depth varies with z-order. Stronger shadow = more "lifted."

---

### Iter 206 — Project Container Z-Behavior

**Question:** When a node is "in" a project, what's the z-relationship?

**Options:**
A) Project is always behind children (container)
B) Project is always in front (overlay)
C) Project and children are on same layer (grouped)

**Expected:** A — Project is container, children render on top.

**Edge case:** What if user drags child outside project bounds?
- Does it leave the project?
- Does it stay in project but float outside?

**Recommendation (P1):** Define explicit rules:
- Children render on top of project background
- Dragging outside bounds = prompt "Remove from project?"
- OR project auto-expands to contain children

---

### Iter 207 — Nested Projects Z-Behavior

**Scenario:** Project A contains Project B contains nodes.

**Z-order should be:**
1. Project A background (bottom)
2. Project B background
3. Project B's nodes
4. Project A's direct nodes (if any)

**Visual clarity:**
- Each nesting level = slightly different background shade?
- OR clear border distinction?

**Recommendation (P2):** Nested projects have progressively lighter/darker backgrounds to show depth.

---

### Iter 208 — Z-Order and Selection

**Question:** When I select a node, does it come to front?

**Options:**
A) Yes, always — selected = front
B) Only visually lifted (shadow) but z-order unchanged
C) User preference

**ND Check:**
- Auto-front on select = disruptive if accidental
- No lift = hard to see selection in overlap

**Recommendation (P1):** Selected nodes get stronger shadow (visual lift) but DON'T change z-order unless explicitly moved. This preserves intentional ordering.

---

### Iter 209 — Z-Order Persistence

**Critical:** Z-order must persist across sessions.

**What to persist:**
- Explicit z-index per node
- OR relative order in node array

**Verification needed:** Does current save/load preserve node order?

**Recommendation (P0):** Verify z-order persists. Add to critical verification list.

---

### Iter 210 — Edge Z-Order

**Question:** Where do edges render relative to nodes?

**Options:**
A) Always below nodes (edges are "connections on the canvas")
B) Always above nodes (edges are "overlays")
C) Mixed (edge renders above source, below target?)

**Reference:**
- React Flow default: edges below nodes
- Figma: connectors above shapes

**Recommendation (P2):** Edges below nodes by default. But selected edge renders on top for visibility.

---

### Iter 211 — Z-Order in Minimap

**Question:** Does minimap reflect z-order?

**Answer:** Probably not needed — minimap is for spatial navigation, not layer inspection.

**But:** If nodes overlap significantly, minimap should show front node's color.

**Verdict:** Low priority. Minimap shows top node when overlapping.

---

### Iter 212 — Grouping vs Project Membership

**Clarification needed:**

**Group:** Temporary selection group (Cmd+G in Figma)
- Moves together
- Can be ungrouped
- No persistent hierarchy

**Project:** Persistent container
- Has its own properties
- Children are "members"
- Persists across sessions

**Question:** Do we need both?

**Recommendation (P2):** Projects are primary. If grouping needed, implement as "quick project" — creates project node containing selection.

---

### Iter 213 — Visual Membership Indicators

**How does user know a node is "in" a project?**

**Options:**
1. **Spatial containment** — Visually inside project bounds
2. **Color tint** — Nodes inherit subtle project tint
3. **Connection line** — Dotted line to project
4. **Badge** — Small project icon on member nodes
5. **Outline panel** — Indentation shows membership

**ND Check:**
- Multiple indicators = redundancy (good)
- Spatial alone is ambiguous if dragged outside

**Recommendation (P1):**
- Primary: Outline panel indentation (source of truth)
- Secondary: Spatial containment (visual)
- Tertiary: Subtle tint or badge for "in project but positioned outside"

---

### Iter 214 — Membership Verification UI

**Stefan's concern:** Must be iron-clad to verify what's in a project.

**Proposal: "Show Members" mode**

When project is selected:
- Dim all non-member nodes
- Highlight all member nodes (even if outside bounds)
- Show count badge: "12 nodes"

**Activation:**
- Click project → automatic
- OR explicit button "Show members"

**ND Check:**
- Reduces anxiety about membership
- Clear visual answer to "what's in here?"

**Recommendation (P1):** Implement "Show Members" highlight when project selected.

---

### Iter 215 — Z-Axis & Grouping Summary

**Iron-Clad Z-Axis UI:**

1. **Outline Panel** = z-order AND hierarchy truth
   - Top = front, bottom = back
   - Indentation = project membership
   - Drag to reorder z-index
   - Drag to change membership

2. **Canvas Controls:**
   - Context menu: Bring to Front / Send to Back
   - Keyboard: Cmd+] / Cmd+[
   - Selection shadow lift (visual only)

3. **Project Membership:**
   - Spatial containment (primary visual)
   - Outline indentation (source of truth)
   - "Show Members" highlight mode
   - Badge/tint for "in project but outside bounds"

4. **Persistence:**
   - Z-order persists (P0 verification)
   - Membership persists (P0 verification)

**This addresses Stefan's concern.** Outline panel isn't redundant — it's essential for z-axis and membership verification.

---

## Section B: Custom Node Types (Iterations 216-225)

### Iter 216 — Custom Node Type Use Cases

**Why would users want custom node types?**

1. **Domain-specific:** "Bug Report," "Feature Request," "Meeting Notes"
2. **Workflow-specific:** "Review Item," "Approval Gate," "Checkpoint"
3. **Personal organization:** "Idea," "Reference," "Archive"

**ND Check:**
- Custom types = ownership over system
- But too many types = decision paralysis

**Balance:** Easy to create, easy to manage, not overwhelming.

---

### Iter 217 — Custom Type Properties

**What can be customized?**

1. **Visual:**
   - Icon (from icon library)
   - Color (from palette or custom)
   - Default size?

2. **Data:**
   - Custom fields (text, number, date, select, etc.)
   - Required vs optional fields
   - Default values

3. **Behavior:**
   - Can it have conversations? (AI-enabled)
   - Can it have children? (container)
   - Can it trigger actions?

**Recommendation (P1):** Start simple:
- Icon + Color + Custom fields
- Behavior inherited from base type (Note-like)

---

### Iter 218 — Custom Type Creation Flow

**Where does user create custom types?**

**Options:**
A) Settings → Node Types → Create
B) Right-click canvas → "Create Custom Type..."
C) From existing node → "Save as Type..."
D) Type manager panel

**ND Check:**
- Settings = organized but hidden
- Right-click = discoverable
- "Save as Type" = intuitive for prototyping

**Recommendation (P1):**
- Primary: Settings → Node Types (management)
- Secondary: "Save as Type" from any node (quick creation)

---

### Iter 219 — Custom Type Manager

**Settings → Node Types should show:**

1. **Built-in types** (Conversation, Project, Task, Note, Action, etc.)
   - Can't delete
   - Can customize defaults?

2. **Custom types**
   - Full edit capability
   - Delete (with "X nodes use this type" warning)
   - Duplicate

**Layout:**
- Left: Type list
- Right: Type editor (icon, color, fields)

**Preview:** Show sample node card with current settings.

---

### Iter 220 — Custom Fields UI

**Field types to support:**

1. **Text** — Single line, multi-line
2. **Number** — Integer, decimal
3. **Date** — Date, datetime
4. **Select** — Single choice from options
5. **Multi-select** — Multiple choices (tags-like)
6. **Checkbox** — Boolean
7. **URL** — With link preview?
8. **Person** — If collaboration added later

**ND Check:**
- Too many field types = overwhelming
- Start with: Text, Number, Date, Select, Checkbox

**Recommendation (P2):** MVP field types: Text, Number, Date, Select, Checkbox. Add more later.

---

### Iter 221 — Custom Type in Toolbar

**Question:** How does user create a node of custom type?

**Current toolbar:** Fixed buttons for each built-in type.

**Options for custom types:**
A) Add to toolbar (becomes crowded)
B) Dropdown menu for "more types"
C) Command palette only
D) Right-click → Create → [type list]

**ND Check:**
- Toolbar crowding = overwhelm
- Hidden in menu = friction

**Recommendation (P1):**
- Toolbar shows "most used" types (built-in + pinned customs)
- "+" button opens type picker (all types)
- Command palette: "Create [type name]"

---

### Iter 222 — Custom Type and AI Context

**Question:** How do custom types interact with AI context injection?

**Options:**
A) Custom types excluded from context (simple)
B) Custom types included with all custom fields
C) User configures which fields inject

**ND Check:**
- Including everything = context bloat
- Excluding = loses value

**Recommendation (P2):** Custom fields have "Include in AI context" toggle. Default: on for text fields, off for others.

---

### Iter 223 — Custom Type Templates

**Idea:** Pre-built custom type templates for common use cases.

**Templates:**
- "Bug Tracker" (Status, Priority, Assignee, Steps to Reproduce)
- "Meeting Notes" (Date, Attendees, Agenda, Action Items)
- "Research" (Source, Key Findings, Relevance)
- "Decision Log" (Decision, Rationale, Date, Owner)

**ND Check:**
- Templates reduce initiation friction
- "Don't start from blank"

**Recommendation (P2):** Include 3-5 templates. User can modify or use as starting point.

---

### Iter 224 — Custom Type Versioning

**Question:** What happens when user modifies a custom type that has existing nodes?

**Scenarios:**
- Add field: Existing nodes get field with default/empty value
- Remove field: Existing nodes lose data (warning!)
- Rename field: Data preserved, name updated
- Change field type: Data conversion or loss?

**Recommendation (P1):**
- Add: Safe, apply to existing
- Remove: Warn about data loss, require confirmation
- Rename: Safe
- Change type: Block or require explicit migration

---

### Iter 225 — Custom Type Summary

**Custom Node Types Design:**

1. **Creation:**
   - Settings → Node Types → Create
   - Or "Save as Type" from existing node

2. **Customization:**
   - Icon (from library)
   - Color (from palette)
   - Custom fields (Text, Number, Date, Select, Checkbox)

3. **Usage:**
   - Toolbar "+" picker
   - Command palette
   - Right-click menu

4. **AI Integration:**
   - "Include in context" toggle per field

5. **Templates:**
   - 3-5 pre-built templates
   - User can duplicate and modify

6. **Versioning:**
   - Add fields safe
   - Remove fields warns
   - Type change blocked

---

## Section C: Project View Tab (Iterations 226-240)

### Iter 226 — Project View Tab Concept

**Stefan's vision:**
- Project nodes have a "View" tab
- Child nodes can be hidden from canvas
- Displayed in configurable views instead

**Benefits:**
- Declutter canvas (hide implementation details)
- Structured data view (table, kanban)
- Different mental models (spatial vs structured)

**This is powerful.** Projects become "workspaces within workspaces."

---

### Iter 227 — View Tab Location

**Where is the View tab?**

**Options:**
A) Properties panel tab (alongside Properties, Context, etc.)
B) Inline in project node (expands node)
C) Separate panel (like chat panel)
D) Modal/overlay

**ND Check:**
- Properties panel tab = consistent with other tabs
- Inline would make project nodes huge
- Separate panel = more screen real estate but context switch

**Recommendation (P1):** Properties panel tab called "Members" or "View"
- When project selected, Properties panel shows: Properties | View | Context

---

### Iter 228 — View Types to Implement

**Stefan asked: What other views?**

**Core views:**
1. **Table** — Default. Rows = nodes, columns = properties
2. **Kanban** — Columns by status (or any select field)
3. **List** — Minimal, just titles with checkboxes
4. **Gallery** — Cards with preview/thumbnail

**Extended views (future):**
5. **Calendar** — Nodes with dates on calendar
6. **Timeline** — Gantt-style for tasks with dates
7. **Mind Map** — Radial layout from project center
8. **Board** — 2D grid (like Miro frames)

**Recommendation (P1):** MVP: Table, Kanban, List. Add Gallery, Calendar, Timeline later.

---

### Iter 229 — Table View Design

**Table view structure:**

| Icon | Title | Status | Priority | Tags | ... |
|------|-------|--------|----------|------|-----|
| 💬 | Chat 1 | Active | High | #api | |
| 📝 | Note 2 | Done | Low | | |

**Features:**
- First column: Icon + Title (always visible)
- Additional columns: User-selected properties
- Inline editing: Click cell to edit
- Row actions: Hover shows edit/delete
- Drag rows: Reorder (affects z-order?)
- Drag columns: Rearrange

**ND Check:**
- Familiar (spreadsheet-like)
- Inline editing reduces friction
- Column customization = control

---

### Iter 230 — Table Column Configuration

**How does user add/remove columns?**

**Options:**
A) Column header "+" button
B) Context menu on header
C) Sidebar column picker
D) Drag from property list

**Recommendation (P1):**
- Header "+" button at end → dropdown of available properties
- Header context menu → "Hide column"
- Drag column headers to reorder

---

### Iter 231 — Table Sorting and Filtering

**Sorting:**
- Click column header to sort (asc/desc)
- Visual indicator (arrow)
- Multi-column sort? (Shift+click)

**Filtering:**
- Filter bar at top
- Per-column filters (click filter icon in header)
- Quick filters: "Show only [status]"

**ND Check:**
- Sorting = essential for finding things
- Filtering = reduces overwhelm

**Recommendation (P1):** Single-column sort MVP. Filtering by any property.

---

### Iter 232 — Kanban View Design

**Kanban structure:**
- Columns = values of a select field (default: Status)
- Cards = nodes
- Drag cards between columns to change status

**Column options:**
- Status: To Do | In Progress | Done
- Priority: Low | Medium | High | Critical
- Any custom select field

**Card display:**
- Icon + Title
- Optional: Tags, priority badge
- Compact mode: Title only

**ND Check:**
- Visual progress tracking
- Satisfying to drag to "Done"

---

### Iter 233 — Kanban Column Configuration

**How to choose which field = columns?**

**Options:**
A) Dropdown at top: "Group by: [field]"
B) Pre-set views: "Status Board," "Priority Board"
C) Kanban settings panel

**Recommendation (P1):** "Group by" dropdown at top. Simple and clear.

**Empty columns:** Show with "No items" and drop target. Don't hide.

---

### Iter 234 — List View Design

**List view = minimal:**

```
☐ Chat with Claude about API design
☐ Research competitor approaches
☑ Write initial spec
☐ Review with team
```

**Features:**
- Checkbox (for tasks, or all nodes?)
- Icon + Title
- Click to select/open
- Drag to reorder
- Optional: Single property column (e.g., Status tag)

**ND Check:**
- Clean, focused
- Checkbox completion = dopamine

**Recommendation (P2):** List view for quick task scanning. Checkbox marks "done."

---

### Iter 235 — Gallery View Design

**Gallery = visual cards:**

```
┌─────────┐ ┌─────────┐ ┌─────────┐
│ [img]   │ │ [img]   │ │ [icon]  │
│ Title 1 │ │ Title 2 │ │ Title 3 │
│ tags    │ │ tags    │ │ tags    │
└─────────┘ └─────────┘ └─────────┘
```

**Card content:**
- Image/thumbnail if available
- Or large icon if no image
- Title
- Optional metadata line

**Use case:** Visual projects, mood boards, reference collections.

**Recommendation (P3):** Gallery view for visual-heavy projects. Lower priority.

---

### Iter 236 — View Persistence

**What persists per project?**

1. **Selected view type** (Table, Kanban, List)
2. **View configuration:**
   - Table: Column selection, order, widths
   - Kanban: Group-by field, column order
   - List: Sort order
3. **Filter state?** (Maybe not — filters are temporary)

**Recommendation (P1):** View type and configuration persist per project.

---

### Iter 237 — Sub-Project Display in Views

**Stefan's question:** How do sub-projects display?

**Options:**
A) Flat — Sub-project nodes appear as rows alongside other nodes
B) Nested — Sub-project is expandable row with children indented
C) Filtered — "Show sub-project contents" toggle
D) Separate — Click sub-project to see its view

**ND Check:**
- Flat = simple but loses hierarchy
- Nested = familiar (file tree) but gets deep
- Separate = clean but requires navigation

**Recommendation (P1):**
- Default: Flat (sub-project is a row)
- Double-click sub-project row → enters that project's view
- Breadcrumb shows path: "Project A > Sub-Project B"

---

### Iter 238 — Saved Views

**Can users save named views?**

**Example:**
- "Active Tasks" — Table filtered to Status != Done
- "This Week" — Calendar view filtered to this week
- "High Priority" — Kanban filtered to Priority = High

**Benefits:**
- Quick access to common filters
- Share configurations

**ND Check:**
- Saved views = reduced decision fatigue
- "Click this to see what I care about"

**Recommendation (P2):** Saved views feature. User can name and save current view configuration.

---

### Iter 239 — View and Canvas Sync

**Question:** When viewing in Table, what happens on canvas?

**Options:**
A) Canvas unchanged — Table is just another way to see
B) Canvas hides project children — Declutter
C) Canvas shows selection from Table — Sync

**Stefan's original vision:** "Nodes get hidden and user can configure..."

**Recommendation (P1):**
- Toggle: "Hide members on canvas" (per project)
- When enabled: Children don't render on canvas, only in View
- Project node shows badge: "12 hidden"
- Double-click project → opens View panel

---

### Iter 240 — Project View Summary

**Project View Tab Design:**

1. **Location:** Properties panel tab (Properties | View | Context)

2. **View Types (MVP):**
   - Table: Columns = properties, inline editing
   - Kanban: Group by select field, drag to change
   - List: Checkbox + title, minimal

3. **Configuration:**
   - Add/remove columns
   - Sort and filter
   - Persists per project

4. **Sub-Projects:**
   - Appear as rows
   - Double-click to enter
   - Breadcrumb navigation

5. **Canvas Integration:**
   - "Hide members on canvas" toggle
   - Project badge shows hidden count
   - Double-click project opens View

6. **Future:**
   - Gallery view
   - Calendar view
   - Timeline view
   - Saved views

---

## Section D: Cross-Domain Synthesis (Iterations 241-250)

### Iter 241 — Synthesis: View Tab + Z-Axis

**Connection:** View tab can REPLACE z-axis concerns for project contents.

**Insight:**
- Z-axis matters when nodes overlap on canvas
- If project contents are hidden (in View), z-axis is simpler
- Canvas only shows project containers + non-project nodes
- View handles internal organization

**Emergent pattern:** Projects are "scopes" — canvas for spatial, View for structured.

---

### Iter 242 — Synthesis: Custom Types + Views

**Connection:** Custom types shine in structured views.

**Example:**
- Custom type "Bug Report" with fields: Severity, Component, Assignee
- Table view shows these as columns
- Kanban groups by Severity
- Powerful combination

**Insight:** Custom types are DATA. Views are LENSES.

**Recommendation (P1):** Ensure custom fields are automatically available as table columns and kanban groupings.

---

### Iter 243 — Synthesis: Command Palette + Everything

**Command palette becomes the power user hub:**

- Create any node type: "Create Conversation," "Create [Custom Type]"
- Switch views: "Table view," "Kanban view"
- Navigate: "Go to [node name]"
- Z-order: "Bring to front," "Send to back"
- Project: "Add to project [name]," "Remove from project"

**Insight:** Command palette is the keyboard-first interface to everything spatial.

**Recommendation (P1):** Command palette is high-leverage. Prioritize robust implementation.

---

### Iter 244 — Synthesis: Outline Panel Role

**Reframe Outline Panel:**

It's not just "backup for spatial thinking" — it's:
1. **Z-order truth** — Drag to reorder
2. **Membership truth** — Indentation shows hierarchy
3. **Quick navigation** — Click to select/pan
4. **Keyboard home** — Tab through outline, arrow keys navigate

**Insight:** Outline is for CONTROL. Canvas is for COGNITION.

**Recommendation:** Rename consideration:
- "Outline" emphasizes structure
- "Layers" implies z-order (Figma)
- "Navigator" implies movement
- "Structure" is neutral

**Keep as "Outline"** — it's accurate.

---

### Iter 245 — Synthesis: Spatial CLI Revisited

**Original vision:** "Knowing WHERE things are without knowing WHAT they are."

**How do new features support this?**

| Feature | Spatial Contribution |
|---------|---------------------|
| Z-axis UI | Position has DEPTH, not just X/Y |
| Outline panel | Hierarchy is visible structure |
| Custom types | Different SHAPES on the landscape |
| Project views | Zoom INTO projects (scope change) |
| Hidden members | Reduce noise, focus on containers |

**Insight:** The spatial CLI is becoming a spatial OPERATING SYSTEM.

---

### Iter 246 — Emergent: Modes of Interaction

**Three emerging modes:**

1. **Canvas Mode** — Spatial, visual, ADHD-friendly
   - Drag, pan, zoom
   - Position = memory
   - Glanceable state

2. **Outline Mode** — Structural, hierarchical, verification
   - Z-order control
   - Membership truth
   - Keyboard navigation

3. **View Mode** — Data-centric, structured, task-focused
   - Table/Kanban/List
   - Filtering/sorting
   - Bulk operations

**Insight:** Different modes for different cognitive tasks. Not replacing each other — complementing.

**Recommendation (P1):** Clearly communicate which mode user is in. Mode switching should be smooth.

---

### Iter 247 — Emergent: Progressive Complexity

**Cognograph can be used simply OR powerfully.**

**Simple usage:**
- Canvas + Conversations
- Drag connections for context
- That's it

**Intermediate usage:**
- Projects for organization
- Properties panel for metadata
- Basic views

**Power usage:**
- Custom types
- Multiple views
- Saved filters
- Keyboard everything

**ND Check:**
- Layers of complexity unlocked gradually
- Never forced into complexity
- But power available when needed

**This is good design.** Don't lose the simple path.

---

### Iter 248 — Emergent: Missing Piece — Collaboration?

**Not in current scope, but emerging question:**

If projects become rich workspaces with views...
- Can multiple users see the same workspace?
- Real-time collaboration?
- Sharing a view?

**ND Check:**
- Collaboration adds complexity
- But spatial CLI for teams could be powerful

**Note for future:** Collaboration would change many assumptions. Keep architecture flexible.

---

### Iter 249 — Emergent: Missing Piece — Search Everywhere

**With custom types, views, hidden nodes...**

**Search must be comprehensive:**
- Search node titles ✓
- Search node content ✓
- Search custom fields
- Search across all projects (even hidden)
- Search in current view vs everywhere

**Recommendation (P1):** Search covers ALL nodes regardless of visibility. Filter by type/project optional.

---

### Iter 250 — Extended Loop Summary

### Key Additions from Iterations 201-250:

**Z-Axis & Layering (P0/P1):**
- Outline panel = z-order AND hierarchy truth
- Context menu + keyboard for z-order control
- Selection lifts visually but doesn't change order
- "Show Members" highlight for project verification
- Z-order must persist (verification needed)

**Custom Node Types (P1/P2):**
- Icon + Color + Custom fields
- Creation via Settings or "Save as Type"
- Templates for common use cases
- Fields have "Include in AI context" toggle

**Project View Tab (P1):**
- Properties panel tab: Properties | View | Context
- MVP views: Table, Kanban, List
- Column configuration, sorting, filtering
- Sub-projects as rows, double-click to enter
- "Hide members on canvas" toggle
- View configuration persists per project

**Cross-Domain Synthesis:**
- Three modes: Canvas, Outline, View
- Custom types + Views = data + lenses
- Command palette = keyboard hub for everything
- Search must cover hidden nodes

**Emergent Insights:**
- Spatial CLI → Spatial Operating System
- Progressive complexity (simple to power)
- Collaboration is future question
- Comprehensive search is critical

---

## Updated Priority Items

### New P0 (Critical):
- Z-order persistence verification
- Project membership persistence verification

### New P1 (High):
- Outline panel as z-order/hierarchy UI
- "Show Members" highlight mode
- Project View Tab (Table view MVP)
- Custom node type creation
- Command palette robustness
- Search covers all nodes

### New P2 (Medium):
- Kanban view
- List view
- Custom type templates
- Saved views
- Shadow depth varies with z-order

### New P3 (Low):
- Gallery view
- Calendar view
- Timeline view
- Collaboration considerations

---

## Stefan's Notes

*Space for Stefan to add context, corrections, or redirects on iterations 201-250*

-

---

## Checkpoint: Extended Loop Complete

**Iterations:** 201-250
**New features designed:** Z-axis UI, Custom Types, Project Views
**Cross-domain insights:** 3 interaction modes, progressive complexity
**Emergent concerns:** Search comprehensiveness, future collaboration

**Circuit Breaker Check:** Substantive new territory covered. Not grinding.

**Ready for implementation handoff?**

