# Styleguide Visual Polish Plan
## Interactive States Focus

**Target File:** `styleguide-master_02.html`
**Objective:** Add missing hover/focus/active states for accessibility and visual polish

---

## Interactive States Checklist

### 1. Buttons (All Variants)
- [ ] Primary buttons: hover, focus, active states
- [ ] Secondary buttons: hover, focus, active states
- [ ] Ghost buttons: hover, focus, active states
- [ ] Icon buttons: hover, focus, active states
- [ ] Disabled states: ensure proper cursor and opacity

**Required States:**
```css
/* Hover: lighten/darken background, subtle transform */
:hover { transform: translateY(-1px); }

/* Focus: visible outline for keyboard nav */
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Active: pressed effect */
:active { transform: translateY(0); }
```

### 2. Links
- [ ] Inline text links: underline behavior on hover
- [ ] Navigation links: active/current state indicators
- [ ] Footer links: subtle hover states

### 3. Form Elements
- [ ] Input fields: focus ring, invalid state
- [ ] Checkboxes: checked animation, focus state
- [ ] Radio buttons: selected state, focus ring
- [ ] Select dropdowns: open state styling
- [ ] Textareas: focus and resize states

### 4. Cards
- [ ] Hover lift effect with shadow
- [ ] Clickable cards: cursor pointer, focus state
- [ ] Focus outline for keyboard navigation

### 5. Navigation
- [ ] Nav items: current page indicator
- [ ] Dropdown menus: hover/open states
- [ ] Mobile menu toggle: active state

### 6. Interactive Components
- [ ] Tabs: selected, hover, focus states
- [ ] Accordions: open/closed indicators, focus
- [ ] Modals: backdrop click, close button hover
- [ ] Tooltips: appear/disappear transitions

---

## Accessibility Requirements

### Focus Visibility
```css
/* Remove default outline, add custom focus */
:focus { outline: none; }
:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
```

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Touch Targets
- Minimum 44x44px touch targets for mobile
- Adequate spacing between interactive elements

---

## Workflow

### In Claude Desktop:
1. Open `styleguide-master_02.html` in browser
2. Take screenshot of current section
3. Identify missing interactive states
4. Request specific CSS additions
5. Review updated screenshot
6. Move to next section

### Sections to Review (in order):
1. Typography & Links
2. Buttons
3. Form Elements
4. Cards & Containers
5. Navigation
6. Modals & Overlays
7. Data Display Components

---

## CSS Variables to Use

Ensure interactive states use existing design tokens:
- `--accent-*` for primary interactions
- `--surface-*` for backgrounds
- `--border-*` for focus rings
- `--shadow-*` for hover elevations
- `--transition-*` for animation timing

---

## Notes

- Test in both light and dark themes
- Verify keyboard navigation works throughout
- Check color contrast in all states
- Ensure states don't conflict with existing styles
