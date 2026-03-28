# Domain 5: Accessibility

**Why Fifth:** Keyboard navigation = power user efficiency. Focus management = not losing your place. Contrast = readability. These help EVERYONE, not just disabled users.

**Scoped to (per M42):**
- Keyboard navigation
- Focus visibility
- Color contrast
- Reduced motion
- No flashing/strobing

**Out of scope:** Screen reader compatibility (separate audit needed)

---

## Iter 121 — Keyboard Navigation Coverage

Can you complete all tasks without a mouse?

**Critical paths:**
- [ ] Create a node
- [ ] Navigate between nodes
- [ ] Open/close panels
- [ ] Edit node properties
- [ ] Send a chat message
- [ ] Save workspace

**ND Check:**
- Keyboard users include power users who prefer shortcuts
- Mouse-required actions = friction for RSI, injury, preference

**Recommendation (P0):** Every action must be keyboard-accessible. Audit all critical paths.

---

## Iter 122 — Focus Visibility

Can you always see what's focused?

**From styleguide:**
```css
.gui-btn-ghost:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

**ND Check:**
- Without visible focus, keyboard navigation is blind
- Must ALWAYS know where you are

**Question:** Do ALL interactive elements have :focus-visible styles?

**Recommendation (P1):** Audit every interactive element for focus styles.

---

## Iter 123 — Focus Order

Does focus order match visual order?

**Expected:** Tab moves left-to-right, top-to-bottom (in general).

**Problem areas:**
- Sidebars (should focus skip or include?)
- Modals (should trap focus)
- Toolbar (horizontal focus order)

**Recommendation (P1):** Define and test focus order for each major view.

---

## Iter 124 — Focus Trapping in Modals

When a modal is open, does Tab stay within the modal?

**Expected:**
- Tab cycles through modal elements only
- Escape closes modal
- Focus returns to trigger element on close

**ND Check:**
- Tab escaping modal = disorienting
- Standard accessibility pattern

**Recommendation (P1):** Implement focus trap in all modals (Settings, etc.)

---

## Iter 125 — Escape Key Behavior

Does Escape do sensible things?

**Expected:**
- Modal open: Close modal
- Panel open: Close panel
- Dropdown open: Close dropdown
- Node selected: Deselect
- Text editing: Cancel edit

**ND Check:**
- Escape = "get out of this" should be universal

**Recommendation (P1):** Audit Escape behavior across all contexts.

---

## Iter 126 — Arrow Key Navigation

Where do arrow keys apply?

**Expected:**
- Dropdowns: Up/Down to navigate options
- Lists: Up/Down to navigate items
- Canvas: Arrow keys to nudge selected node?

**Reference check:**
- Figma: Arrow keys nudge selected objects
- Miro: Same

**Recommendation (P2):** Arrow keys should nudge selected nodes by 1px (or 10px with Shift).

---

## Iter 127 — Enter Key Behavior

What does Enter do?

**Expected:**
- Button focused: Activate button
- Input focused: Submit form? Or just newline?
- List item focused: Select/open item

**ND Check:**
- Enter = "do the thing" should be consistent

**Recommendation (P2):** Define Enter behavior for each context.

---

## Iter 128 — Shortcut Discoverability

How do users discover keyboard shortcuts?

**Options:**
- Tooltips on hover (show shortcut)
- Help menu with shortcut list
- ? or Cmd+/ to show shortcuts

**ND Check:**
- Undiscoverable shortcuts = unused shortcuts
- Power users will learn if they can find them

**Recommendation (P1):** Show shortcuts in tooltips. Add keyboard shortcut reference (Help menu or ?)

---

## Iter 129 — Color Contrast — Text

Is text readable?

**From tokens:**
- text-primary: #f3f4f6 (light on dark)
- text-secondary: #9ca3af
- text-muted: #6b7280

**Against dark backgrounds:**
- #f3f4f6 on #0d0d14: High contrast ✅
- #9ca3af on #0d0d14: ~6:1 ratio ✅
- #6b7280 on #0d0d14: ~4:1 ratio (borderline AA)

**ND Check:**
- text-muted might be too low contrast

**Recommendation (P2):** Verify text-muted meets WCAG AA (4.5:1 for normal text).

---

## Iter 130 — Color Contrast — Interactive Elements

Do buttons have sufficient contrast?

**Ghost buttons:**
- text-secondary (#9ca3af) on panel background

**Primary buttons:**
- white on accent-primary (#9333ea): Need to verify

**ND Check:**
- Low contrast buttons = invisible affordances

**Recommendation (P2):** Run contrast checker on all button variants.

---

## Iter 131 — Color Contrast — Node Borders

Are node borders visible enough?

**Border colors:** Defined per type (blue, purple, amber, etc.)

**Against canvas (#0d0d14):**
- #3b82f6 (blue): High contrast ✅
- #8b5cf6 (purple): Good contrast ✅
- #f59e0b (amber): High contrast ✅
- etc.

**Verdict:** ✅ Node borders are sufficiently visible.

---

## Iter 132 — Color Independence

Can you distinguish elements without relying on color alone?

**Examples:**
- Node types: Color + icon ✅
- Status badges: Color + text ✅
- Error messages: Color + icon/text ✅

**ND Check:**
- Colorblind users need secondary indicators
- Text + icon + color = triple encoding

**Verdict:** ✅ Good redundancy exists.

---

## Iter 133 — Reduced Motion

Is reduced motion supported?

**From styleguide:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Verdict:** ✅ Reduced motion is supported.

---

## Iter 134 — Flash/Strobe Content

Is there any flashing content that could trigger seizures?

**Check:**
- Animations don't flash rapidly
- No strobe effects
- Pulsing is slow (2s cycle for streaming glow)

**From animations:**
- stream-glow: 2s cycle ✅
- warmth-pulse: 2s cycle ✅
- No rapid flashing ✅

**Verdict:** ✅ No seizure risk identified.

---

## Iter 135 — Touch Target Size

Are touch targets large enough?

**WCAG minimum:** 44×44px for touch targets

**From tokens:**
- Handle hit area: 40px (close but under)
- Buttons: Need to measure

**ND Check:**
- Small targets = frustration, especially on touch devices

**Recommendation (P2):** Ensure all interactive elements are at least 44×44px hit area.

---

## Iter 136 — Clickable Area vs Visual Size

Is the clickable area larger than the visual element?

**Example:** Connection handles are 16px visual, 40px hit area.

**ND Check:**
- Good pattern: visual is small, hit area is generous
- Easier to click without looking precisely

**Verdict:** ✅ Good pattern for handles. Apply elsewhere.

---

## Iter 137 — Skip Links

For keyboard users, is there a way to skip navigation?

**Standard pattern:** "Skip to main content" link at top of page.

**For Cognograph:**
- Canvas is main content
- Sidebar/toolbar are navigation

**Recommendation (P3):** Add skip link to jump focus to canvas on Tab.

---

## Iter 138 — Landmark Regions

Are major regions marked for assistive tech?

**Expected landmarks:**
- Navigation (toolbar)
- Main content (canvas)
- Complementary (sidebar)

**ND Check:**
- Landmarks help screen readers but also help programmatic access

**Recommendation (P3):** Add ARIA landmarks to major regions.

---

## Iter 139 — Button Labeling

Do icon-only buttons have accessible labels?

**Example:** Toolbar buttons are icons only.

**Expected:**
- `aria-label="Create conversation node"`
- Or `title="Create conversation node (C)"`

**ND Check:**
- Screen readers need text equivalent
- Tooltips help sighted users too

**Recommendation (P1):** All icon buttons need aria-label AND tooltip.

---

## Iter 140 — Input Labeling

Are inputs properly labeled?

**Expected:**
- `<label for="input-id">Label text</label>`
- Or `aria-label` if visual label is elsewhere

**ND Check:**
- Unlabeled inputs are confusing for everyone

**Recommendation (P2):** Audit all inputs for proper labeling.

---

## Iter 141 — Form Error Announcements

When validation fails, is the error announced?

**Expected:**
- Error message appears near input
- `aria-invalid="true"` on input
- Error linked via `aria-describedby`

**ND Check:**
- Silent errors = user doesn't know something is wrong

**Recommendation (P2):** Implement proper form error patterns.

---

## Iter 142 — Live Region Updates

Are dynamic updates announced?

**Examples:**
- Toast appears: Should be announced
- New chat message: Should be announced
- Node created: Should be announced?

**Expected:** Use `aria-live="polite"` for non-critical updates.

**Recommendation (P3):** Add aria-live regions for toast and status updates.

---

## Iter 143 — Canvas Keyboard Navigation

How do you navigate the canvas with keyboard?

**Challenge:** Canvas is spatial, keyboard is linear.

**Options:**
1. Tab cycles through nodes in creation order
2. Arrow keys move focus between nodes spatially
3. Search/command palette to jump to node

**Reference check:**
- Figma: Tab cycles layers, arrows nudge selection
- Miro: Similar

**Recommendation (P1):** Define canvas keyboard navigation model. Tab + arrow keys.

---

## Iter 144 — Selection via Keyboard

How do you select nodes via keyboard?

**Expected:**
- Tab to node → Enter to select
- Shift+Tab to select multiple?

**ND Check:**
- Without keyboard selection, can't operate canvas

**Recommendation (P1):** Tab to focus node, Enter to select, Shift+Enter to multi-select.

---

## Iter 145 — Panel Keyboard Navigation

How do you navigate within a panel?

**Expected:**
- Tab through inputs/buttons
- Arrow keys in dropdowns/lists
- Escape to close

**ND Check:**
- Panel should be self-contained keyboard experience

**Recommendation (P2):** Test and document panel keyboard nav.

---

## Iter 146 — Modal Keyboard Access

Can you operate modals via keyboard?

**Expected:**
- Tab through controls
- Enter on buttons
- Escape to close

**ND Check:**
- Modal must be fully operable

**Recommendation (P1):** Test Settings modal keyboard operation.

---

## Iter 147 — Dropdown Keyboard Access

Can you operate dropdowns via keyboard?

**Expected:**
- Enter/Space to open
- Arrow keys to navigate
- Enter to select
- Escape to close

**ND Check:**
- Standard dropdown pattern

**Recommendation (P2):** Verify dropdown keyboard patterns.

---

## Iter 148 — Text Selection and Copy

Can you select and copy text?

**Expected:**
- Chat messages: Selectable, copyable
- Node content: Selectable where text (not buttons)
- Properties: Input text selectable

**ND Check:**
- Text that can't be selected = frustrating

**Recommendation (P2):** Ensure all text content is selectable.

---

## Iter 149 — Zoom Accessibility

Can you zoom the canvas via keyboard?

**Expected:**
- Cmd++ to zoom in
- Cmd+- to zoom out
- Cmd+0 to fit/reset

**ND Check:**
- Standard zoom shortcuts

**Recommendation (P1):** Verify zoom keyboard shortcuts work.

---

## Iter 150 — Accessibility Summary

### What's Working (Validations)
- ✅ Focus-visible on buttons defined
- ✅ Node border contrast sufficient
- ✅ Color independence (icon + text + color)
- ✅ Reduced motion supported
- ✅ No flash/strobe content
- ✅ Handle hit area larger than visual

### Needs Verification
- [ ] All interactive elements have focus-visible
- [ ] Focus trap in modals
- [ ] Escape behavior across contexts
- [ ] All buttons have aria-labels
- [ ] All inputs properly labeled
- [ ] Zoom keyboard shortcuts

### Recommendations
| Priority | Issue | Recommendation |
|----------|-------|----------------|
| P0 | Keyboard coverage | Every action must be keyboard-accessible |
| P1 | Focus visibility audit | All interactive elements need focus styles |
| P1 | Focus order | Define and test for each view |
| P1 | Focus trap in modals | Implement for all modals |
| P1 | Escape behavior | Audit and document |
| P1 | Shortcut discoverability | Tooltips + help reference |
| P1 | Icon button labels | aria-label AND tooltip on all |
| P1 | Canvas keyboard nav | Define Tab + arrow key model |
| P1 | Keyboard selection | Tab to focus, Enter to select |
| P1 | Zoom shortcuts | Verify Cmd+/- work |
| P2 | Text contrast check | Verify text-muted meets AA |
| P2 | Button contrast | Run checker on all variants |
| P2 | Touch targets | Minimum 44×44px |
| P2 | Arrow key nudge | Nudge selected nodes |
| P2 | Enter behavior | Document per context |
| P2 | Input labeling | Audit all inputs |
| P2 | Form errors | Proper error patterns |
| P2 | Panel keyboard nav | Test and document |
| P2 | Dropdown keyboard | Verify standard pattern |
| P2 | Text selection | All text content selectable |
| P3 | Skip link | Add for keyboard users |
| P3 | ARIA landmarks | Add to major regions |
| P3 | Live regions | For toast/status updates |

---

## Stefan's Notes
*Space for Stefan to add context, corrections, or redirects*

-

---

## Checkpoint: Accessibility Complete

**Iterations:** 121-150
**Findings:** 6 validations, 6 verifications needed, 23 recommendations
**Critical (P0):** 1 (keyboard coverage)
**High (P1):** 10
**Medium (P2):** 9
**Low (P3):** 3

**Circuit Breaker Check:** High P1 count reflects that keyboard navigation is foundational and needs work. This is expected for a canvas app. Not repetitive — each item is distinct. Continue.

**Ready to proceed to Domain 6: Information Architecture?**
