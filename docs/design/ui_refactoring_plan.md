# UI Refactoring Plan: Standardize App Shell to Design Token System

> **Source of Truth:** `src/renderer/src/styles/styleguide-master.html` defines the design tokens.
> Components must output HTML that uses token-based CSS classes, not hardcoded Tailwind colors.

## Context & Objective

The Master Style Guide (`styleguide-master.html`) defines the finalized design tokens (surfaces, text, accents, borders, spacing, radius, shadows, z-index, typography, motion). However, existing React components (Toolbar, Sidebar, Panels, Modals) use hardcoded Tailwind classes (`bg-gray-800`, `text-gray-400`, etc.) with `isLightMode` conditionals instead of the token system. This created ~100 lines of light-mode override hacks in `index.css`.

**Goal:** Refactor components so they output HTML using token-based CSS classes exclusively, eliminating all hardcoded color classes and `isLightMode` conditional logic.

### Refactoring Scope

| Area | Components | Goal |
|------|-----------|------|
| **App Shell** | `App.tsx` / Canvas layout | Implement layout structure supporting Sidebar Mode vs Modal Mode with token-based z-index and panel widths |
| **Navigation Toolbar** | `Toolbar.tsx` | Match responsive behavior (Single Row / Two Row / Vertical), replace inline styles with `.gui-toolbar` class |
| **Panels** | `LeftSidebar.tsx`, `PropertiesPanel.tsx` | Support Docked vs Floating variants, standardize header/section patterns |
| **Overlays** | `SettingsModal.tsx`, `SciFiToast.tsx` | Use token z-index layering, eliminate `isLightMode` conditionals, two-column settings layout |
| **Shared Atoms** | New `Button.tsx`, `Input.tsx`, `Badge.tsx` | Create reusable components using `.gui-btn`, `.gui-input`, `.gui-badge` CSS classes |

### Per-Component Deliverables

For each component, the plan specifies:
1. **Source CSS classes** — the token-based classes to use (new `.gui-*` classes or existing ones)
2. **React Props** — props needed to support variants (e.g., `variant="floating" | "docked"`)
3. **File to Edit** — the specific file path in `src/renderer/src`

---

## Phase 1 — CSS Foundation (index.css only, no component changes)

**File:** `src/renderer/src/styles/index.css`

Add these new utility classes:

```css
/* Z-index utilities */
.gui-z-panels     { z-index: var(--z-panels); }
.gui-z-dropdowns  { z-index: var(--z-dropdowns); }
.gui-z-modals     { z-index: var(--z-modals); }
.gui-z-toasts     { z-index: var(--z-toasts); }

/* Backdrop */
.gui-backdrop { background-color: rgba(0, 0, 0, 0.5); position: fixed; inset: 0; }

/* Toolbar container */
.gui-toolbar {
  background-color: color-mix(in srgb, var(--gui-panel-bg-secondary) 90%, transparent);
  border: 1px solid var(--gui-border);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
}

/* Dividers */
.gui-divider-v { width: 1px; height: var(--space-6); margin: 0 var(--space-1); background-color: var(--gui-border-strong); }
.gui-divider-h { height: 1px; width: var(--space-6); margin: var(--space-1) 0; background-color: var(--gui-border-strong); }

/* Translucent panel */
.gui-panel-translucent {
  background-color: color-mix(in srgb, var(--gui-panel-bg) 92%, transparent);
  backdrop-filter: blur(8px);
}

/* Tabs */
.gui-tab { display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--gui-text-secondary); transition: all var(--duration-fast) var(--ease-default); }
.gui-tab:hover { background-color: var(--gui-panel-bg-secondary); }
.gui-tab-active { background-color: var(--gui-panel-bg-secondary); color: var(--gui-text-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

/* Panel header (shared by sidebar, properties, chat) */
.gui-panel-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--gui-border); flex-shrink: 0; }
.gui-panel-header-title { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--gui-text-primary); }

/* Collapsible section header */
.gui-section-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); cursor: pointer; color: var(--gui-text-secondary); font-size: var(--text-xs); font-weight: var(--weight-medium); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--gui-border); }
.gui-section-header:hover { color: var(--gui-text-primary); }

/* Modal */
.gui-modal { background-color: var(--gui-panel-bg); color: var(--gui-text-primary); border: 1px solid var(--gui-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-modal); }

/* Nav items (settings sidebar) */
.gui-nav-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--gui-text-primary); border-left: 2px solid transparent; transition: all var(--duration-fast) var(--ease-default); }
.gui-nav-item:hover { background-color: var(--gui-panel-bg-secondary); }
.gui-nav-item-active { background-color: color-mix(in srgb, var(--gui-accent-secondary) 10%, transparent); border-left-color: var(--gui-accent-secondary); }

/* Toggle switch */
.gui-toggle { position: relative; display: inline-flex; height: 24px; width: 44px; align-items: center; border-radius: var(--radius-full); background-color: var(--gui-panel-bg-secondary); border: 1px solid var(--gui-border); transition: background-color var(--duration-fast); cursor: pointer; }
.gui-toggle-active { background-color: var(--gui-accent-secondary); border-color: var(--gui-accent-secondary); }

/* Card */
.gui-card { background-color: var(--gui-panel-bg-secondary); border: 1px solid var(--gui-border); border-radius: var(--radius-md); padding: var(--space-3); }

/* Toast */
.gui-toast { background-color: color-mix(in srgb, var(--gui-panel-bg) 95%, transparent); backdrop-filter: blur(8px); border: 1px solid var(--gui-accent-primary); border-radius: var(--radius-lg); padding: var(--space-2) var(--space-5); box-shadow: var(--shadow-toast); font-family: var(--font-mono); font-size: var(--text-sm); }

/* Button system */
.gui-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--weight-medium); cursor: pointer; transition: all var(--duration-fast); border: 1px solid transparent; }
.gui-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.gui-btn-ghost { background: transparent; color: var(--gui-text-secondary); }
.gui-btn-ghost:hover:not(:disabled) { background: var(--gui-panel-bg-secondary); color: var(--gui-text-primary); }
.gui-btn-secondary { background: var(--gui-panel-bg-secondary); color: var(--gui-text-secondary); }
.gui-btn-primary { background: var(--gui-accent-primary); color: white; }
.gui-btn-primary:hover:not(:disabled) { background: var(--gui-accent-primary-hover); }
.gui-btn-accent { background: var(--gui-accent-secondary); color: white; }
.gui-btn-accent:hover:not(:disabled) { background: var(--gui-accent-secondary-hover); }
.gui-btn-sm { padding: var(--space-1) var(--space-2); font-size: var(--text-xs); }
.gui-btn-icon { padding: var(--space-2); }

/* Badge */
.gui-badge { display: inline-flex; align-items: center; gap: var(--space-1); padding: 2px var(--space-2); border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: var(--weight-medium); }
.gui-badge-default { background: var(--gui-panel-bg-secondary); color: var(--gui-text-secondary); }
.gui-badge-accent { background: color-mix(in srgb, var(--gui-accent-primary) 20%, transparent); color: var(--gui-accent-primary); }

/* Resize handle */
.gui-resize-handle { position: absolute; top: 0; bottom: 0; width: 8px; cursor: col-resize; }
.gui-resize-handle:hover, .gui-resize-handle.active { background: color-mix(in srgb, var(--gui-accent-secondary) 50%, transparent); }
```

Also move toast glow keyframe from SciFiToast.tsx JS to `src/renderer/src/styles/animations.css`.

---

## Phase 2 — Shared Atoms (new files)

### `src/renderer/src/components/ui/Button.tsx`

**Source CSS classes:** `.gui-btn`, `.gui-btn-ghost`, `.gui-btn-secondary`, `.gui-btn-primary`, `.gui-btn-accent`, `.gui-btn-sm`, `.gui-btn-icon`

**React Props:**
```ts
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'secondary' | 'primary' | 'accent'
  size?: 'sm' | 'md' | 'icon'
}
```
Maps variant/size to `gui-btn gui-btn-{variant} gui-btn-{size}` classes.

### `src/renderer/src/components/ui/Input.tsx`

**Source CSS classes:** `.gui-input` (existing in index.css)

**React Props:**
```ts
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}
```
Wraps `<input className="gui-input" />` with label/hint/error.

### `src/renderer/src/components/ui/Badge.tsx`

**Source CSS classes:** `.gui-badge`, `.gui-badge-default`, `.gui-badge-accent`

**React Props:**
```ts
interface BadgeProps {
  variant?: 'default' | 'accent' | 'success' | 'warning'
  children: React.ReactNode
}
```

### `src/renderer/src/components/ui/index.ts`
Barrel export for Button, Input, Badge, SciFiToast.

---

## Phase 3 — SettingsModal (highest impact)

**File to Edit:** `src/renderer/src/components/SettingsModal.tsx`

**Source CSS classes:** `.gui-backdrop`, `.gui-z-modals`, `.gui-modal`, `.gui-nav-item`, `.gui-nav-item-active`, `.gui-toggle`, `.gui-toggle-active`, `.gui-card`, `.gui-input`, `gui-text`, `gui-text-secondary`, `gui-panel`, `gui-panel-secondary`

**React Props:** No new props needed — removing `isLightMode` simplifies the interface.

- [ ] Remove all `isLightMode` conditional class logic (~25 class variables)
- [ ] Remove `isLightMode` prop from sub-components: `ProgramSettings`, `WorkspaceSettings`, `ConnectorsTab`, `DefaultPropertySettings`
- [ ] Replace overlay with `.gui-backdrop.gui-z-modals`
- [ ] Replace modal card with `.gui-modal` + fixed width
- [ ] Replace nav items with `.gui-nav-item` / `.gui-nav-item-active`
- [ ] Replace toggle switches with `.gui-toggle` / `.gui-toggle-active`
- [ ] Replace card sections with `.gui-card`
- [ ] Replace all `text-gray-*` with `gui-text` / `gui-text-secondary`
- [ ] Replace all `bg-gray-*` with `gui-panel` / `gui-panel-secondary`
- [ ] Replace inputs with `gui-input` class (or `<Input>` atom)

**Also update sub-component files:**
- `src/renderer/src/components/settings/ConnectorsTab.tsx`
- `src/renderer/src/components/settings/DefaultPropertySettings.tsx`
- `src/renderer/src/components/settings/AddLLMModal.tsx`
- `src/renderer/src/components/settings/LLMConnectorCard.tsx`

---

## Phase 4 — SciFiToast

**File to Edit:** `src/renderer/src/components/ui/SciFiToast.tsx`

**Source CSS classes:** `.gui-toast`, `.gui-z-toasts`

**React Props:** No changes (uses Zustand store, not props).

- [ ] Replace all inline styles with `.gui-toast` class
- [ ] Replace `z-[9999]` with `gui-z-toasts`
- [ ] Remove `document.createElement('style')` JS keyframe injection
- [ ] Keep framer-motion for enter/exit animations

---

## Phase 5 — App.tsx Overlays

**File to Edit:** `src/renderer/src/App.tsx`

**Source CSS classes:** `gui-panel`, `gui-border`, `gui-text`, `gui-text-secondary`, `.gui-z-panels`, `.gui-z-modals`

- [ ] Quick-connect popup: `bg-gray-800 border-gray-700` → `gui-panel gui-border`
- [ ] File drop overlay: `bg-gray-900/90 text-white text-gray-400` → `gui-panel gui-text gui-text-secondary`
- [ ] Toaster: `!bg-gray-800 !text-gray-100 !border-gray-700` → `!bg-[var(--gui-panel-bg)] !text-[var(--gui-text-primary)] !border-[var(--gui-border)]`
- [ ] Hardcoded `z-50`, `z-[1000]` → `gui-z-panels`, `gui-z-modals`

---

## Phase 6 — Toolbar (minor)

**File to Edit:** `src/renderer/src/components/Toolbar.tsx`

**Source CSS classes:** `.gui-toolbar`, `.gui-divider-v`, `.gui-divider-h`

**React Props:** No changes needed. Already supports responsive modes.

- [ ] Replace inline `containerStyle` object with `.gui-toolbar` class
- [ ] Replace inline `dividerStyle` with `.gui-divider-v` / `.gui-divider-h`
- [ ] Keep responsive layout logic as-is (already works)
- [ ] Keep `gui-button` usage (already tokenized)

---

## Phase 7 — Panels

### LeftSidebar

**File to Edit:** `src/renderer/src/components/LeftSidebar.tsx`

**Source CSS classes:** `.gui-panel-translucent`, `.gui-tab`, `.gui-tab-active`, `.gui-panel-header`, `.gui-resize-handle`

**React Props:** Consider adding `variant?: 'docked' | 'floating'` for future floating support.

- [ ] Replace inline `backgroundColor: 'color-mix(...)'` with `.gui-panel-translucent`
- [ ] Replace tab styling with `.gui-tab` / `.gui-tab-active`
- [ ] Replace header with `.gui-panel-header` pattern
- [ ] Replace resize handle colors (`bg-blue-500`) with `.gui-resize-handle`

### PropertiesPanel

**File to Edit:** `src/renderer/src/components/PropertiesPanel.tsx`

**Source CSS classes:** `.gui-panel-header`, `.gui-panel-header-title`, `.gui-section-header`, `gui-panel`, `gui-border`, `gui-text`, `gui-text-secondary`

**React Props:** Existing `compact`, `hideHeader`, `nodeId` props are sufficient. The `hideHeader` prop already supports the floating modal use case.

- [ ] Replace `text-gray-500`, `bg-gray-800`, `border-gray-600` with gui-* classes
- [ ] Apply `.gui-panel-header` pattern to header
- [ ] Apply `.gui-section-header` to collapsible section headers
- [ ] HelpTooltip: `bg-gray-800 border-gray-600 text-gray-100` → `gui-panel gui-border gui-text`

---

## Phase 8 — Cleanup

**File to Edit:** `src/renderer/src/styles/index.css`

- [ ] Delete light mode override hacks (the `[data-theme="light"] .bg-gray-800` etc. block, ~lines 299-401)
- [ ] Run project-wide grep for remaining `bg-gray-`, `text-gray-`, `border-gray-` in components
- [ ] Verify light/dark mode toggle works without the override hacks
- [ ] Run `npm run build` to verify no regressions

---

## Verification

1. **Build check:** `npm run build` — no compilation errors
2. **Visual check (dark mode):** Open app, verify toolbar, sidebar, properties panel, settings modal, toasts all render correctly
3. **Visual check (light mode):** Toggle to light mode, verify all components adapt without hardcoded override hacks
4. **Responsive toolbar:** Resize window through all 3 breakpoints (>1180, 900-1180, <900)
5. **Panel interactions:** Open/close sidebar, resize it, open properties panel, toggle floating mode
6. **Settings modal:** Open settings, click through all 4 categories, toggle switches, verify inputs
7. **Toast:** Trigger a toast notification, verify styling and animation
