# Domain 4: Consistency

**Why Fourth:** Consistency breeds intuition. Same patterns everywhere = learn once, apply everywhere. Reduces cognitive load through predictability.

**Jake's Philosophy:**
- "Consistency breeds intuition"
- "Same patterns everywhere, users learn once"
- Inconsistency creates confusion tax on every interaction

---

## Iter 91 — Node Structure Consistency

Do all nodes follow the same structure?

**Expected structure:**
- Header (icon, title)
- Body (content)
- Footer (metadata, actions)

**From styleguide:**
```css
.cognograph-node__header { ... }
.cognograph-node__body { ... }
.cognograph-node__footer { ... }
```

**Check across types:**
- Conversation: Header ✅, Body ✅, Footer ✅
- Project: Header ✅, Body (children) ✅, Footer ✅
- Task: Header ✅, Body (status/description) ✅, Footer ✅
- Note: Header ✅, Body (content) ✅, Footer ✅
- Action: Header ✅, Body (config) ✅, Footer (stats) ✅

**Verdict:** ✅ Consistent structure across types.

---

## Iter 92 — Color Application Consistency

Are node colors applied consistently?

**Pattern:**
- Border: node type color
- Icon: node type color
- Title: node type color (per styleguide)
- Selection ring: node type color

**Verdict:** ✅ Color is consistently the type identifier.

---

## Iter 93 — Selection Behavior Consistency

Is selection behavior the same for all nodes?

**Expected:**
- Click: Select
- Shift+Click: Add to selection
- Cmd+Click: Toggle selection
- Drag rectangle: Box select

**ND Check:**
- Standard multi-select patterns ✅
- No surprises

**Verdict:** ✅ Standard React Flow behavior.

---

## Iter 94 — Double-Click Consistency

What does double-click do on each node type?

**Expected consistency:**
- Conversation: Open chat panel
- Project: Expand/collapse? Or open detail?
- Task: Open properties? Edit inline?
- Note: Edit content inline
- Action: Open config panel

**ND Check:**
- If double-click does different things, confusion
- Should have ONE meaning: "Open/Edit this"

**Recommendation (P1):** Define consistent double-click behavior: "Open primary interface for this node"
- Conversation → Chat panel
- Note → Inline edit mode
- Task → Properties panel
- Project → Properties panel (or toggle expand)
- Action → Properties panel (action config)

---

## Iter 95 — Right-Click Consistency

Is context menu consistent across node types?

**Expected common items:**
- Edit (or Properties)
- Delete
- Duplicate
- Copy/Cut

**Plus type-specific:**
- Conversation: Open chat, Extract
- Project: Add to project
- etc.

**ND Check:**
- Common items should be in same position across all menus
- Type-specific below a divider

**Recommendation (P2):** Audit context menus for consistent ordering.

---

## Iter 96 — Panel Header Consistency

Do all panels follow the same header pattern?

**From styleguide:**
```css
.gui-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}
```

**Panels to check:**
- Properties panel
- Chat panel
- Left sidebar
- Settings modal
- Extractions panel

**ND Check:**
- Same header structure = instant recognition
- "This is a panel" should feel consistent

**Verdict:** ✅ Pattern defined. Need to verify implementation.

---

## Iter 97 — Close Button Consistency

How do you close panels/modals?

**Expected:**
- X button in top-right
- Escape key
- Click outside (for modals)

**ND Check:**
- Consistent close pattern across all closable things
- X should always be in same position

**Recommendation (P1):** All panels/modals must have X in top-right. Escape must always work.

---

## Iter 98 — Input Styling Consistency

Are all inputs styled the same?

**From styleguide:**
```css
.gui-input {
  background-color: var(--surface-panel-secondary);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
}
```

**ND Check:**
- Every text input should look like this
- No one-off input styles

**Recommendation (P2):** Audit all inputs for consistent styling.

---

## Iter 99 — Button Styling Consistency

Are button variants used consistently?

**From styleguide:**
- `.gui-btn-ghost` — Subtle, secondary actions
- `.gui-btn-secondary` — Default actions
- `.gui-btn-primary` — Primary actions (purple)
- `.gui-btn-accent` — Key CTA (blue)

**ND Check:**
- Primary action should always be same style
- Delete should always be danger style

**Recommendation (P2):** Audit buttons for consistent variant usage.

---

## Iter 100 — Icon Consistency

Are similar actions represented by same icons?

**Expected:**
- Close: X
- Delete: Trash
- Edit: Pencil
- Settings: Gear
- Add: Plus

**ND Check:**
- Same icon = same meaning everywhere
- Different icons for same action = confusion

**Recommendation (P2):** Create icon vocabulary document. Enforce across codebase.

---

## Iter 101 — Spacing Consistency

Is spacing consistent?

**From tokens:**
- space-1: 4px
- space-2: 8px
- space-3: 12px
- space-4: 16px
- etc.

**ND Check:**
- Consistent spacing creates rhythm
- Inconsistent spacing feels "off" even if not consciously noticed

**Verdict:** ✅ Token system exists. Need to verify usage.

---

## Iter 102 — Typography Consistency

Are text styles consistent?

**From tokens:**
- text-xs: 12px
- text-sm: 13px
- text-base: 14px
- text-lg: 16px
- etc.

**Expected usage:**
- Node titles: text-sm, semibold
- Body text: text-sm, normal
- Labels: text-xs, medium
- Headings: text-lg or larger

**Verdict:** ✅ Token system exists. Need to verify usage.

---

## Iter 103 — Interaction Timing Consistency

Are animation durations consistent?

**From tokens:**
- duration-fast: 150ms
- duration-normal: 200ms
- duration-slow: 300ms

**ND Check:**
- Consistent timing = predictable feel
- Some fast, some slow = jarring

**Recommendation (P2):** Audit all animations for consistent timing token usage.

---

## Iter 104 — Hover State Consistency

Do all interactive elements have hover states?

**Expected:**
- Buttons: background change + slight lift ✅
- Nodes: shadow + brightness ✅
- Inputs: border color? (currently no change on hover)
- List items: background change

**ND Check:**
- Hover state = "this is interactive" signal
- Missing hover = is this clickable?

**Recommendation (P1):** Every interactive element needs hover state.

---

## Iter 105 — Disabled State Consistency

Are disabled states consistent?

**From styleguide:**
```css
.gui-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cognograph-node--disabled { opacity: 0.5; filter: grayscale(60%); }
```

**ND Check:**
- Disabled should always look disabled
- 0.4-0.5 opacity is recognizable

**Verdict:** ✅ Pattern defined.

---

## Iter 106 — Error State Consistency

Are error states consistent?

**Expected:**
- Red border on invalid inputs
- Red text for error messages
- Red icon for error badges

**From styleguide:** `.gui-badge--error` exists.

**ND Check:**
- Red = error, consistently
- No other meaning for red (except Workspace node color — potential conflict)

**Observation:** Workspace node is red. Error states are red. Could confuse.

**Recommendation (P3):** Consider if Workspace should be different color to avoid error association.

---

## Iter 107 — Success State Consistency

Are success states consistent?

**Expected:**
- Green for success
- Checkmark icon

**From tokens:** Task node is green (emerald). Success messages should also be green.

**Verdict:** ✅ Green = success/done.

---

## Iter 108 — Loading State Consistency

Are loading states consistent?

**From styleguide:**
- Streaming: shimmer + dots
- Extraction: shimmer + wand pulse

**Question:** Is there a generic loading pattern?

**Recommendation (P2):** Define generic loading pattern. Use consistently for all async operations.

---

## Iter 109 — Empty State Consistency

Are empty states consistent?

**Expected:**
- Consistent illustration/icon style
- Helpful message
- Action to remedy

**Question:** Do all lists/panels have empty states defined?

**Recommendation (P2):** Audit all list views for empty states (no nodes, no messages, no extractions, etc.)

---

## Iter 110 — Z-Index Consistency

Are z-index layers consistent?

**From tokens:**
- z-canvas-nodes: 0
- z-canvas-edges: 5
- z-panels: 50
- z-dropdowns: 60
- z-modals: 100
- z-toasts: 9999

**ND Check:**
- Clear layering hierarchy ✅
- Modals above panels above canvas ✅

**Verdict:** ✅ Well-defined z-index scale.

---

## Iter 111 — Scrollbar Consistency

Are scrollbars styled consistently?

**From styleguide:**
```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--surface-panel-secondary); }
::-webkit-scrollbar-thumb { background: var(--border-subtle); }
```

**Verdict:** ✅ Consistent scrollbar styling.

---

## Iter 112 — Border Radius Consistency

Are corners consistent?

**From tokens:**
- radius-sm: 4px
- radius-md: 6px
- radius-lg: 8px
- radius-xl: 12px

**Expected usage:**
- Buttons: radius-md
- Inputs: radius-md
- Panels: radius-lg
- Modals: radius-lg
- Nodes: 0.5rem (8px = radius-lg)

**Verdict:** ✅ Token system exists.

---

## Iter 113 — Shadow Consistency

Are shadows consistent?

**From tokens:**
- shadow-node: subtle
- shadow-node-hover: stronger
- shadow-panel: medium
- shadow-modal: strong
- shadow-toast: strong

**ND Check:**
- Shadow depth = visual hierarchy
- Modals should feel "above" panels

**Verdict:** ✅ Well-defined shadow scale.

---

## Iter 114 — Label Positioning Consistency

Where are labels positioned relative to inputs?

**Options:**
- Above input
- Beside input
- Floating label

**ND Check:**
- Consistent position = eyes know where to look

**Recommendation (P2):** Define label position pattern. Apply everywhere.

---

## Iter 115 — Action Button Positioning Consistency

Where are action buttons positioned?

**Expected:**
- Primary action: Right side or bottom-right
- Cancel/secondary: Left of primary
- Destructive: Separated or differently styled

**ND Check:**
- "Where is the main action?" should be predictable

**Recommendation (P2):** Define action button positioning standard.

---

## Iter 116 — Terminology Consistency

Is language consistent?

**Examples:**
- "Save" vs "Done" vs "Apply"
- "Delete" vs "Remove"
- "Cancel" vs "Close"

**ND Check:**
- Same action = same word
- Different words = different actions

**Recommendation (P2):** Create terminology guide. Enforce in UI copy.

---

## Iter 117 — Capitalization Consistency

Is text capitalization consistent?

**Expected:**
- Buttons: Sentence case ("Save changes")
- Labels: Sentence case ("Node title")
- Tabs: Title case or sentence case (pick one)

**ND Check:**
- Inconsistent capitalization = sloppy feel

**Recommendation (P3):** Define capitalization rules. Apply everywhere.

---

## Iter 118 — Date/Time Formatting Consistency

Are dates/times formatted consistently?

**Expected:** One format throughout.

**ND Check:**
- "1/21/2026" vs "Jan 21, 2026" vs "2026-01-21"
- Pick one, use everywhere

**Recommendation (P3):** Define date/time format. Apply everywhere.

---

## Iter 119 — Keyboard Navigation Consistency

Is tab order consistent?

**Expected:**
- Left to right, top to bottom
- Logical flow through interface

**ND Check:**
- Unpredictable tab order = frustration
- Should match visual order

**Recommendation (P1):** Audit tab order in panels and modals.

---

## Iter 120 — Consistency Summary

### What's Working (Validations)
- ✅ Node structure (header/body/footer)
- ✅ Color application (border, icon, title)
- ✅ Selection behavior (standard multi-select)
- ✅ Panel header pattern
- ✅ Disabled state pattern
- ✅ Z-index hierarchy
- ✅ Scrollbar styling
- ✅ Shadow scale
- ✅ Border radius tokens
- ✅ Spacing tokens
- ✅ Typography tokens

### Needs Verification
- [ ] Double-click behavior across node types
- [ ] Context menu ordering
- [ ] Input styling consistency
- [ ] Button variant usage
- [ ] Animation timing token usage

### Recommendations
| Priority | Issue | Recommendation |
|----------|-------|----------------|
| P1 | Double-click behavior | Define consistent meaning per node type |
| P1 | Close button position | X always top-right, Escape always works |
| P1 | Hover states | Every interactive element needs one |
| P1 | Tab order | Audit and fix in panels/modals |
| P2 | Context menu order | Common items in same position |
| P2 | Input audit | Verify all use .gui-input |
| P2 | Button audit | Verify variant usage is logical |
| P2 | Icon vocabulary | Document icon meanings |
| P2 | Animation timing | Use tokens consistently |
| P2 | Empty states | Define for all list views |
| P2 | Loading pattern | Generic pattern for async ops |
| P2 | Label positioning | Define standard |
| P2 | Action button positioning | Define standard |
| P2 | Terminology guide | Same words for same actions |
| P3 | Workspace color | Consider non-red to avoid error confusion |
| P3 | Capitalization rules | Define and apply |
| P3 | Date/time format | Define single format |

---

## Stefan's Notes
*Space for Stefan to add context, corrections, or redirects*

-

---

## Checkpoint: Consistency Complete

**Iterations:** 91-120
**Findings:** 11 validations, 5 verifications needed, 17 recommendations
**Critical (P0):** 0
**High (P1):** 4
**Medium (P2):** 10
**Low (P3):** 3

**Circuit Breaker Check:** Many P2/P3 items suggest polish territory. Core consistency is solid. Continue to next domain.

**Ready to proceed to Domain 5: Accessibility?**
