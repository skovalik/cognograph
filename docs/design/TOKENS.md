# Design Tokens Reference

> **Source of truth:** `src/renderer/src/styles/tokens.css`
>
> This document describes the token values defined there. If there's a conflict, `tokens.css` wins.
> To keep `styleguide.html` in sync, run: `node scripts/sync-styleguide-tokens.mjs`

---

## Colors

### Surface Colors

Background colors for different UI layers.

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--surface-canvas` | `#1a1a2e` | `#ffffff` | Main canvas background |
| `--surface-grid` | `#2e2e52` | `#e5e7eb` | Canvas grid dots/lines |
| `--surface-panel` | `#111827` | `#ffffff` | Panel/sidebar backgrounds |
| `--surface-panel-secondary` | `#1f2937` | `#f9fafb` | Nested containers, inputs |
| `--surface-node` | `rgba(17,24,39,0.95)` | `rgba(255,255,255,0.95)` | Node card backgrounds |
| `--surface-node-secondary` | `rgba(31,41,55,0.5)` | `rgba(243,244,246,0.8)` | Node sub-sections |
| `--surface-node-header` | `transparent` | `rgba(249,250,251,0.5)` | Node header area |
| `--surface-input` | `#1f2937` | `#ffffff` | Form inputs |

### Text Colors

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--text-primary` | `#f3f4f6` | `#111827` | Headings, titles, body text |
| `--text-secondary` | `#9ca3af` | `#4b5563` | Labels, descriptions, metadata |
| `--text-muted` | `#6b7280` | `#6b7280` | Timestamps, footnotes, disabled |

### Accent Colors

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--accent-primary` | `#9333ea` | `#7c3aed` | Primary buttons, focus rings, active states |
| `--accent-secondary` | `#2563eb` | `#2563eb` | Links, secondary actions |
| `--accent-primary-hover` | derived (85% mix white) | derived | Hover state for primary accent |
| `--accent-secondary-hover` | derived (85% mix white) | derived | Hover state for secondary accent |

### Node Type Colors

Each node type has a distinct brand color used for borders, handles, and glow effects.

| Token | Hex | Node Type |
|-------|-----|-----------|
| `--node-conversation` | `#3b82f6` | Conversation (blue) |
| `--node-project` | `#8b5cf6` | Project (purple) |
| `--node-note` | `#f59e0b` | Note (amber) |
| `--node-task` | `#10b981` | Task (emerald) |
| `--node-artifact` | `#06b6d4` | Artifact (cyan) |
| `--node-workspace` | `#ef4444` | Workspace (red) |
| `--node-text` | `#94a3b8` | Text (slate) |
| `--node-action` | `#f97316` | Action (orange) |

### Border Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--border-subtle` | 30% of `--text-secondary` | Dividers, section separators |
| `--border-default` | 50% of `--text-secondary` | Input borders, stronger dividers |
| `--border-node` | `rgb(55,65,81)` / `rgb(209,213,219)` | Node internal borders (header/footer) |

### Toolbar Icons

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--toolbar-icon-default` | `#9ca3af` | `#6b7280` | Default toolbar icon color |
| `--toolbar-icon-1` | `#a855f7` | `#7c3aed` | Accent icon slot 1 |
| `--toolbar-icon-2` | `#22d3ee` | `#0891b2` | Accent icon slot 2 |
| `--toolbar-icon-3` | `#34d399` | `#059669` | Accent icon slot 3 |
| `--toolbar-icon-4` | `#a855f7` | `#7c3aed` | Accent icon slot 4 |

---

## Spacing & Sizing

### Spacing Scale

Base unit: 4px. All spacing uses this scale.

| Token | Value | Common Usage |
|-------|-------|--------------|
| `--space-1` | 4px | Tight gaps (icon-to-text) |
| `--space-2` | 8px | Standard small gap (between badges) |
| `--space-3` | 12px | Medium gap (between form fields) |
| `--space-4` | 16px | Standard padding (card body px) |
| `--space-5` | 20px | Section spacing |
| `--space-6` | 24px | Panel padding |
| `--space-8` | 32px | Large section gaps |
| `--space-10` | 40px | Handle hit areas |
| `--space-12` | 48px | Major spacing |
| `--space-16` | 64px | Page-level spacing |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Badges, tags, small pills |
| `--radius-md` | 6px | Inputs, buttons |
| `--radius-lg` | 8px | Cards (nodes), dropdowns |
| `--radius-xl` | 12px | Panels, modals, large containers |
| `--radius-full` | 9999px | Circular elements (handles, avatars) |

### Component Sizing

| Token | Value | Usage |
|-------|-------|-------|
| `--handle-size` | 16px | Connection handle diameter |
| `--handle-hit-area` | 40px | Invisible click target around handle |
| `--handle-offset` | -8px | Handle position offset from edge |
| `--scrollbar-width` | 8px | Custom scrollbar width |
| `--node-min-width` | 150px | Minimum node card width |
| `--node-min-height` | 80px | Minimum node card height |
| `--panel-width-properties` | 360px | Properties panel width |
| `--panel-width-sidebar` | 320px | Left sidebar width |
| `--panel-width-chat` | 400px | Chat panel width |

### Node Dimensions (by type)

| Node Type | Default Width | Min Width | Min Height |
|-----------|---------------|-----------|------------|
| Conversation | 300px | 150px | 80px |
| Project | 400px | 250px | 200px |
| Note | 250px | 150px | 80px |
| Task | 250px | 150px | 80px |
| Artifact | 350px | 150px | 80px |
| Workspace | 300px | 280px | 80px |
| Text | auto | 100px | 30px |
| Action | 280px | 220px | 80px |

---

## Typography

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `'Inter', 'Roboto', 'Open Sans', system-ui, sans-serif` | All UI text |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace` | Code blocks, toast messages |

### Size Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--text-xs` | 12px | Timestamps, footnotes, node metadata |
| `--text-sm` | 13px | Labels, badges, node body text |
| `--text-base` | 14px | Default body text, inputs, buttons |
| `--text-lg` | 16px | Section headers, panel titles |
| `--text-xl` | 18px | Modal titles |
| `--text-2xl` | 24px | Page-level headers |
| `--text-3xl` | 30px | Hero text (rarely used) |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--weight-normal` | 400 | Body text, descriptions |
| `--weight-medium` | 500 | Labels, buttons, navigation |
| `--weight-semibold` | 600 | Node titles, section headers |
| `--weight-bold` | 700 | Emphasis, important headings |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-tight` | 1.25 | Headings, titles (compact) |
| `--leading-normal` | 1.5 | Body text, descriptions |
| `--leading-relaxed` | 1.625 | Long-form content, prose |

---

## Elevation

### Shadow Scale

| Token | Dark Mode Value | Light Mode Value | Usage |
|-------|-----------------|------------------|-------|
| `--shadow-node` | `0 4px 12px rgba(0,0,0,0.15)` | `0 2px 8px rgba(0,0,0,0.08)` | Node cards at rest |
| `--shadow-node-hover` | `0 8px 24px rgba(0,0,0,0.25)` | `0 4px 16px rgba(0,0,0,0.12)` | Node cards on hover |
| `--shadow-node-selected` | `0 0 0 2px var(--accent-primary)` | same | Selected node ring |
| `--shadow-panel` | `0 4px 16px rgba(0,0,0,0.3)` | `0 2px 8px rgba(0,0,0,0.1)` | Floating panels |
| `--shadow-modal` | `0 8px 32px rgba(0,0,0,0.5)` | `0 4px 16px rgba(0,0,0,0.15)` | Modal overlays |
| `--shadow-toast` | `0 4px 20px rgba(0,0,0,0.4)` | same | Toast notifications |

### Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-canvas-nodes` | 0 | Base layer for nodes |
| `--z-canvas-edges` | 5 | Edges render above nodes |
| `--z-panels` | 50 | Side panels, sidebars |
| `--z-dropdowns` | 60 | Dropdown menus |
| `--z-modals` | 100 | Modal overlays |
| `--z-toasts` | 9999 | Toast notifications (always on top) |

### Node Glow Effects

When a node is selected or streaming, it shows a glow using its type color:
```css
box-shadow: 0 0 0 2px ${nodeColor}40, 0 0 12px ${nodeColor}20;
```

The glow color is derived from the node's `--node-{type}` color at reduced opacity.

### Glassmorphism Pattern

Used for toast notifications and can be applied to panels:
```css
background: rgba(17, 24, 39, 0.9);
backdrop-filter: blur(8px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

---

## Motion

### Duration Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-instant` | 0ms | No animation (for programmatic changes) |
| `--duration-fast` | 150ms | Hover states, focus rings, opacity changes |
| `--duration-normal` | 200ms | Standard transitions (show/hide, color changes) |
| `--duration-slow` | 300ms | Layout shifts, panel open/close |
| `--duration-emphasis` | 2000ms | Streaming glow loops, warmth indicators |

### Easing Functions

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `ease-out` | Most transitions (fast start, gentle stop) |
| `--ease-in-out` | `ease-in-out` | Looping animations (streaming, pulsing) |
| `--ease-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Bouncy interactions (Framer Motion style) |

### Animation Categories

#### Node Lifecycle
- **Spawn**: Scale 0->1 over 200ms with ease-spring
- **Delete**: Scale 1->0 + fade over 150ms

#### Streaming State
- **Glow pulse**: Box-shadow cycles over 2000ms ease-in-out
- **Shimmer sweep**: Linear gradient sweep over 2000ms

#### Context Flow
- **Dashed edge animation**: `stroke-dashoffset` animated continuously
- **Direction**: Flows toward the streaming/active node

#### Handle Interactions
- **Show on hover**: opacity 0->1, scale 0.8->1 over 200ms
- **Connection target**: scale 1.6 + green glow + pulse

#### Warmth Indicator
- **Hot**: glow at 60% opacity, 800ms cycle
- **Warm**: glow at 40% opacity, 1200ms cycle
- **Cool**: glow at 20% opacity, 2000ms cycle

### Reduced Motion

All animations respect `@media (prefers-reduced-motion: reduce)`:
- Looping animations: disabled entirely
- Transitions: reduced to 0ms or very fast (50ms)
- Opacity changes only (no transforms)
