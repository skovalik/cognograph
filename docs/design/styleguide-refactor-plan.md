# Styleguide Refactor Plan — Emoji-to-SVG & Toolbar Overhaul

## Project Context & Goals

**Cognograph's living design system** (`styleguide-master.html`) is the single source of truth for all UI components. It currently uses emoji characters for icons throughout. The goal is to replace all emojis with color-linked SVG icons (`stroke="currentColor"`) so that:

1. Icons respond to CSS `color` and inherit from theme tokens automatically
2. Dark icons render correctly on colored backgrounds
3. Non-color atoms and molecules work identically across all themes (dark, light, future themes)
4. The styleguide visually matches the running application (reference: app screenshots + `styleguide_archive.html` v5.1)

**This is NOT a token/color change.** We are only changing icon rendering and toolbar layout/composition. All CSS custom properties, section IDs, class names, and theme logic remain untouched.

---

## Context Preservation

**Working copy** is `docs/design/styleguide-master_02.html` — never edit the original `styleguide-master.html` until final push.

**On session start:** Read this file first. Check the Progress Tracker below. Read the working copy to understand current state. Continue from where you left off.

---

## File Layout

### Working Copy (iterate here)
```
docs/design/styleguide-master_02.html    ← CLONE of styleguide-master.html (all edits go here)
```

### Source Files (read in place — no staging folder)
These files are read directly from their source locations when needed. No copies are made.

| Source File | Purpose |
|---|---|
| `src/renderer/src/styles/animations.css` | Animation definitions |
| `src/renderer/src/styles/index.css` | Main stylesheet |
| `src/renderer/src/styles/nodes.css` | Node-specific styles |
| `src/renderer/src/styles/presence.css` | Presence indicators |
| `src/renderer/src/styles/token-estimator.css` | Token estimator UI |
| `src/renderer/src/styles/tokens.css` | Design tokens |
| `src/renderer/src/constants/themePresets.ts` | Theme preset definitions |
| `tailwind.config.js` | Tailwind configuration |
| `postcss.config.js` | PostCSS configuration |

### Reference Files (read-only)
```
docs/design/styleguide-master.html       ← ORIGINAL (do not edit until final push)
docs/design/styleguide_archive.html      ← v5.1 archive with SVG sprite & toolbar demos
```

---

## Workflow — Iterative, One Item at a Time

1. **Discuss** — Review what the change involves, compare current vs target
2. **Implement in `styleguide-master_02.html`** — Make the edit
3. **Verify in browser** — Open `styleguide-master_02.html` locally, confirm visually
4. **Approve or adjust** — User reviews, requests tweaks if needed
5. **Update Progress Tracker** — Mark step complete in this plan file
6. **Move to next item** — Only after the current item is approved

Once ALL items are approved: copy `styleguide-master_02.html` over `styleguide-master.html` and push to codebase.

---

## Constraints

- SVG icons only — no emojis, no PNGs
- All SVGs use `stroke="currentColor"` for color-linking
- Dark stroke icons on colored backgrounds (not white-on-color)
- Theme-agnostic non-color atoms (must work for dark, light, any future theme)
- Preserve all existing section IDs (A-P), CSS class names, token mappings

---

## Progress Tracker

Update this section as each step completes. On resume, start here.

| # | Step | Status | Notes |
|---|------|--------|-------|
| 0 | Setup: clone working copy | DONE | |
| 1a | Inventory: grep all emojis in styleguide-master.html | DONE | 35 unique emoji/symbols found |
| 1b | SVG sprite: build from Lucide icon paths | DONE | 37 symbols in sprite |
| 1c | SVG sprite: add icon sizing CSS classes | DONE | icon-12/14/16/18 |
| 1d | SVG sprite: verify all symbols render | DONE | Temp block added at bottom — user to verify in browser |
| 2 | Section K: all toolbar layouts (K1/K2/K3) emoji→SVG | DONE | +workspace info in K1, +group/layers btn, +labels on node btns |
| 3a | Section F1-F2: toolbar container + button atoms emoji→SVG | DONE | HTML entities replaced with SVG use refs |
| 3b | Section F3-F4: divider + responsive mode atoms | DONE | No emojis present — only text/letter placeholders |
| 4 | Compact workspace info component CSS + demo | DONE | CSS classes + K4 demo section with 3 states |
| 5a | Section N: node card icons N1-N4 | DONE | HTML emoji→SVG in node headers |
| 5b | Section N: node card icons N5-N8 | DONE | HTML + JS buildRichNodeCards() emoji→SVG |
| 6a | Section B: node molecule demos emoji→SVG | DONE | JS buildNodeTypeGrid() + buildToolbarNodeButtons() updated |
| 6b | Section E: shared atom demos emoji→SVG | DONE | E1 buttons + E3 badges HTML entities replaced |
| 6c | Section L: sidebar demos emoji→SVG | DONE | Tabs, tree items, search placeholder |
| 6d | Section M: properties panel demos emoji→SVG | DONE | M1-M4 headers, sections, delete btns, dropdowns |
| 6e | Section O: settings modal demos emoji→SVG | DONE | Header + nav items |
| 6f | Section P: minimap/zoom demos emoji→SVG | DONE | Fit-to-view + lock buttons |
| 7 | Final: grep for remaining emojis, fix any | DONE | Clean — 0 emoji remaining, only text symbols (▶▼●→−≥) |
| 8 | Push: copy working file to source location | PENDING | |

---

## Step Details

### Step 0 — Setup

**Action:**
1. Copy `docs/design/styleguide-master.html` → `docs/design/styleguide-master_02.html`

**Verify:** `styleguide-master_02.html` is byte-identical to original.

---

### Step 1a — Emoji Inventory

**Action:** Grep `styleguide-master.html` for all emoji codepoints (common ranges: `\u{1F4xx}`, `\u{1F3xx}`, `\u{2xxx}`, etc.). Produce a list of every emoji used, which section it appears in, and what icon it represents. This inventory drives all subsequent replacement steps.

**Output:** A table of emoji → intended SVG icon mapping, organized by section.

---

### Step 1b — SVG Sprite: Build from Lucide Paths

**Action:** Build the `<svg style="display:none">...</svg>` sprite block containing `<symbol>` definitions for every icon needed (per the inventory from 1a). Construct each symbol directly from Lucide icon path data. All symbols must use `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`.

Insert the sprite into `styleguide-master_02.html` immediately after the opening `<body>` tag.

Required icons include (but may expand based on inventory):
- `icon-menu`, `icon-file-text`, `icon-folder-open`, `icon-save`, `icon-save-as`
- `icon-settings`, `icon-undo`, `icon-redo`, `icon-message-square`, `icon-folder`
- `icon-check-square`, `icon-file-code`, `icon-layout`, `icon-type`, `icon-zap`
- `icon-wand`, `icon-palette`, `icon-layers`, `icon-check`

**Verify:** Count symbols in sprite. Every inventory entry has a corresponding symbol.

---

### Step 1c — SVG Sprite: Icon Sizing CSS Classes

**Action:** Add to the CSS (inside the existing style block, near other utility classes):
```css
svg.icon-12 { width: 12px; height: 12px; }
svg.icon-14 { width: 14px; height: 14px; }
svg.icon-16 { width: 16px; height: 16px; }
svg.icon-18 { width: 18px; height: 18px; }
```

**Verify:** Apply `class="icon-14"` to any `<svg>` — it should render at 14x14px in DevTools.

---

### Step 1d — SVG Sprite: Verification Pass

**Action:** Add a temporary test block at the bottom of the file (inside a commented section) that renders every symbol from the sprite at icon-16 size. Open in browser. Visually confirm all icons render. Remove test block after verification.

**Verify:** No blank/missing icons. Console has no errors.

---

### Step 2 — Section K: All Toolbar Layouts (K1, K2, K3)

**Action:** Replace every emoji button in K1, K2, and K3 with SVG equivalents in a single step. Apply the emoji→SVG mapping from the inventory (step 1a).

Key replacements:

| Current Emoji | Replace With |
|---|---|
| `☰` (hamburger) | `<svg class="icon-16"><use href="#icon-menu"/></svg>` |
| `📄` (new) | `<svg class="icon-14"><use href="#icon-file-text"/></svg>` |
| `📂` (open) | `<svg class="icon-14"><use href="#icon-folder-open"/></svg>` |
| `💾` (save) | `<svg class="icon-14"><use href="#icon-save"/></svg>` |
| `📋` (save as) | `<svg class="icon-14"><use href="#icon-save-as"/></svg>` |
| `⚙` (settings) | `<svg class="icon-14"><use href="#icon-settings"/></svg>` |
| `↩` (undo) | `<svg class="icon-14"><use href="#icon-undo"/></svg>` |
| `↪` (redo) | `<svg class="icon-14"><use href="#icon-redo"/></svg>` |
| `💬` (conversation) | `<svg class="icon-14"><use href="#icon-message-square"/></svg>` |
| `📁` (project) | `<svg class="icon-14"><use href="#icon-folder"/></svg>` |
| `📝` (note) | `<svg class="icon-14"><use href="#icon-file-text"/></svg>` |
| `✅` (task) | `<svg class="icon-14"><use href="#icon-check-square"/></svg>` |
| `📄` (artifact) | `<svg class="icon-14"><use href="#icon-file-code"/></svg>` |
| `🏠` (workspace) | `<svg class="icon-14"><use href="#icon-layout"/></svg>` |
| `T` (text) | `<svg class="icon-14"><use href="#icon-type"/></svg>` |
| `⚡` (action) | `<svg class="icon-14"><use href="#icon-zap"/></svg>` |
| `🪄` (AI editor) | `<svg class="icon-14"><use href="#icon-wand"/></svg>` |
| `🎨` (theme) | `<svg class="icon-14"><use href="#icon-palette"/></svg>` |
| `☰` (properties) | `<svg class="icon-14"><use href="#icon-settings"/></svg>` |
| `⬜` (chat) | `<svg class="icon-14"><use href="#icon-message-square"/></svg>` |

Also:
- Add node type labels next to icons: "Convo", "Project", "Note", "Task", "Text", "Action"
- Add workspace info inline (`.workspace-compact` element) in K1
- Add missing buttons (save-as, load, AI, theme, group) in correct button groups
- Apply same emoji→SVG to K2 (two-row) and K3 (vertical) layouts

**Verify:** Open browser. All three layouts show SVG icons, correct colors, no tofu/missing glyphs. Workspace info renders in K1. K2 row split and K3 vertical stacking are correct.

---

### Steps 3a-3b — Section F: Toolbar Atoms

Same pattern: find section F demos, replace emoji/unicode with SVG `<use>` references.

---

### Step 4 — Compact Workspace Info CSS

If not already added in step 2, ensure the `.workspace-compact*` CSS classes are in the style block. Add demo variants (saved, modified, syncing states).

---

### Steps 5a-5b — Section N: Node Cards

Replace emoji icons in N1-N8 node card demos with SVG icons using brand colors.

---

### Steps 6a-6f — Global Sweep

One section at a time (B, E, L, M, O, P). Each gets its own step so progress is trackable.

---

### Step 7 — Final Emoji Grep

Search the entire working copy for emoji codepoints. Common ranges: `\u{1F4xx}`, `\u{1F3xx}`, `\u{2xxx}`. Fix any remaining.

---

### Step 8 — Push to Source

1. Copy `styleguide-master_02.html` → `styleguide-master.html`
2. Verify app builds and renders correctly

---

## Mapping Verification Checklist

Run these checks before marking ANY step complete:

| Check | How |
|---|---|
| **Symbol IDs match `<use href>`** | Every `<use href="#icon-foo"/>` has a corresponding `<symbol id="icon-foo">` in the sprite |
| **Lucide path data accurate** | Compare `<path d="...">` against Lucide originals |
| **Node type → icon mapping** | Conversation=message-square, Project=folder, Note=file-text, Task=check-square, Artifact=file-code, Workspace=layout, Text=type, Action=zap |
| **Color inheritance** | `color: var(--node-conversation)` on parent → SVG stroke matches |
| **Sizing classes** | `.icon-14` → 14x14px in DevTools |
| **viewBox consistent** | All symbols: `viewBox="0 0 24 24"` |
| **Dark-on-color** | Icons on colored backgrounds use dark stroke |
| **Theme toggle** | Dark/light switch → all icons visible and correctly colored |
| **No broken refs** | Browser console clean |
| **Section IDs preserved** | Sidebar nav links still work |

---

## User Decisions (Recorded)

- **Workspace info position**: Inline floating right (compact, inside toolbar row)
- **Missing icon style**: Lucide-style approximations
- **Scope**: All sections — global emoji-to-SVG pass
- **Working copy**: `styleguide-master_02.html` (not the original)
- **Source files**: Read in place (no staging folder)
- **SVG sprite**: Built from Lucide paths directly (not copied from archive)

## What This Does NOT Change

- CSS custom property values (colors, spacing, radius, shadows)
- Section structure or IDs (A through P)
- CSS class names (`gui-toolbar`, `gui-btn`, `gui-btn-ghost`, etc.)
- Theme switching logic (dark/light toggle JS)
- Original `styleguide-master.html` (until step 8)
- Any `src/` files
