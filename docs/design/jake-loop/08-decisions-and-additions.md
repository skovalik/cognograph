# Stefan's Decisions + New Additions

**Date:** 2026-01-31
**Iteration:** 201+

---

## Decisions Made

### Decision 1: Properties Panel Density
**Choice:** B — Collapse to Primary/Secondary/Advanced groups
- Primary (always visible): Title, Content, Status
- Secondary (collapsed by default): Priority, Tags, Complexity
- Advanced (collapsed): Metadata, Edge Color, Attachments

### Decision 2: Layers Panel Philosophy
**Choice:** C — Rename to "Outline" and de-emphasize

**Stefan's Concern:** Z-axis ordering and project grouping must be iron-clad. The left menu existed in previous versions specifically because:
- Users need to verify what's IN a project
- Users need to control what floats on top of what
- Spatial canvas alone isn't enough for hierarchy verification

**Action Required:** Design z-axis and grouping UI that's bulletproof.

### Decision 3: Command Palette
**Choice:** A (Jake's recommendation) — Full command palette (Cmd+K)

### Decision 4: Empty Canvas Experience
**Choice:** B — Floating hint that fades after first action

---

## New Additions

### Addition 1: Custom Node Type
User-definable node type where user can configure:
- Icon
- Color
- Properties/fields
- Behavior?

**Questions to explore:**
- How does user create a custom type?
- Where are custom types stored/managed?
- Can custom types have custom behaviors (actions)?
- Templates vs true custom types?

### Addition 2: Project Node View Tab

**Concept:** Project nodes have a "View" tab that:
1. Hides child nodes from canvas (declutter)
2. Shows them in a configurable view instead

**Default View: Table**
- Left column: Node icons + titles (inline editable)
- Additional columns: User-configurable properties (status, priority, complexity, tags, etc.)
- Drag to rearrange columns
- Drag to rearrange rows
- Same inline editing as node cards

**Other Views to Explore:**
- Kanban (by status)
- Calendar (by date)
- Gallery (visual cards)
- List (minimal)
- Timeline (Gantt-style)

**Questions:**
- How do filters work?
- How do sub-projects display?
- Can views be saved/named?
- Can views be shared across projects?

---

## Focus for Iterations 201-250

1. **Z-Axis & Layering** — Iron-clad UI for ordering
2. **Project Grouping** — Verify membership, hierarchy
3. **Custom Node Types** — Creation, management, behavior
4. **Project Views** — Table, Kanban, Calendar, etc.
5. **Cross-Domain Synthesis** — Emergent patterns
6. **Polish** — Remaining recommendations

---
