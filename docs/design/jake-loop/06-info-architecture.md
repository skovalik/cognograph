# Domain 6: Information Architecture

**Why Sixth:** Right information at right time. Progressive disclosure. Hierarchy. Don't overwhelm, but don't hide essential info.

**Jake's Philosophy:**
- "Scan, Act, Dive" — Users scan for key info, act on common tasks, dive deeper only when needed
- "Reduce cognitive load — every extra click, scroll, or decision is friction"

---

## Iter 151 — Information Hierarchy in Nodes

What info is visible at a glance vs requires opening?

**Current node surface shows:**
- Type (color, icon)
- Title
- Brief body preview (truncated)
- Footer metadata

**Detailed info requires:**
- Opening properties panel
- Or double-clicking

**ND Check:**
- Glanceable: Type, title, status ✅
- Details on demand: Properties ✅

**Verdict:** ✅ Good hierarchy.

---

## Iter 152 — Properties Panel Density

Is the properties panel overwhelming?

**From styleguide_plan_02.md, Properties Panel shows:**
- Title input
- Color picker
- Icon picker
- Enabled toggle
- Content/description
- Status dropdown
- Priority dropdown
- Complexity dropdown
- Tags
- AI Response (for tasks)
- URL
- Add property link
- Collapsible sections (Attachments, Metadata, Edge Color)
- Timestamps
- Delete button

**Count:** ~15+ fields visible

**ND Check:**
- 15 fields = potential overwhelm
- Not all are relevant for all tasks

**Recommendation (P1):** Group properties into:
- Primary (title, content, status) — always visible
- Secondary (priority, tags, etc.) — collapsed by default
- Advanced (metadata, edge color) — collapsed

---

## Iter 153 — Progressive Disclosure in Properties

Are collapsible sections used effectively?

**From plan:** "Collapsible sections: Attachments, Metadata, Edge Color"

**ND Check:**
- Collapsible = progressive disclosure ✅
- But are the RIGHT things collapsed?

**Recommendation (P2):** Collapse:
- Attachments (unless has attachments)
- Metadata (rarely needed)
- Edge Color (advanced)
- AI Response (unless has content)

Keep visible:
- Title, Content, Status, Priority, Tags

---

## Iter 154 — Node Type-Specific Properties

Do different node types show different properties?

**Expected:**
- Conversation: Messages, model, context settings
- Task: Status, priority, complexity
- Note: Content (rich text)
- Action: Trigger type, conditions, steps

**ND Check:**
- Showing irrelevant properties = noise
- Type-specific = cleaner

**Verdict:** ✅ Already type-specific (per codebase structure).

---

## Iter 155 — Status Bar Information

What's in the status bar?

**From styleguide:** "🏠 Cognograph Wor..." | "119 nodes" | "6 edges" | "⏱ Unsaved"

**Information:**
- Workspace name
- Node count
- Edge count
- Save status

**ND Check:**
- Workspace context: good ✅
- Counts: useful for large workspaces ✅
- Save status: critical ✅

**Verdict:** ✅ Good status bar info.

---

## Iter 156 — Toolbar Information

Does toolbar convey state?

**From styleguide:**
- Undo/Redo greyed when unavailable
- Panel toggles show state
- Save shows dirty indicator

**ND Check:**
- Disabled states = system state visible ✅
- Toggle states = panel state visible ✅

**Verdict:** ✅ Toolbar conveys state.

---

## Iter 157 — Chat Panel Information

What info is visible in chat panel?

**Expected:**
- Conversation history
- Context indicator (what's connected)
- Model being used
- Token usage?

**From visual-feedback-juiciness.md:** Token meter exists.

**ND Check:**
- Context indicator: crucial for understanding AI behavior ✅
- Token usage: helps manage context window ✅

**Verdict:** ✅ Good information exposure.

---

## Iter 158 — Layers Panel Information

What does layers panel show?

**From styleguide_plan_02.md:**
- Tree view of nodes
- Search
- Sort options
- Selection count in footer

**ND Check:**
- Alternative view to spatial canvas
- Useful for finding nodes by name
- But conflicts with spatial philosophy (see Iter 16)

**Verdict:** 🟡 Useful but should be secondary.

---

## Iter 159 — Extractions Panel Information

What does extractions panel show?

**From codebase:** ExtractionsPanel.tsx, PendingExtractionCard.tsx

**Expected:**
- Pending extractions
- Completed extractions
- Source conversation

**ND Check:**
- Extractions are async — need status visibility
- Panel is appropriate place for this

**Verdict:** ✅ Appropriate information grouping.

---

## Iter 160 — Settings Organization

How are settings organized?

**From styleguide_plan_02.md:**
- Left nav: Program, Workspace, Defaults, Connectors
- Two-column layout

**ND Check:**
- 4 categories: manageable ✅
- Clear labels: Program vs Workspace distinction clear?

**Recommendation (P3):** Consider renaming:
- "Program" → "Appearance" or "Application"
- "Defaults" → "Node Defaults" (clearer)

---

## Iter 161 — Context Settings Information

What's in context settings?

**From codebase:** ContextSettingsModal.tsx

**Expected:**
- What nodes provide context
- Context depth/recursion
- Exclusions

**ND Check:**
- Context injection is complex — settings must be clear
- User needs to understand what AI will see

**Recommendation (P1):** Context settings should show preview of "This is what Claude will see" — actual formatted context.

---

## Iter 162 — Node Metadata Visibility

What metadata is shown?

**From styleguide:**
- Created timestamp
- Updated timestamp

**ND Check:**
- Created: rarely needed
- Updated: useful for "when did I last touch this?"

**Recommendation (P3):** Updated is useful. Created could be hidden deeper.

---

## Iter 163 — Edge Information

What info do edges carry/show?

**From codebase:**
- Direction
- Active/inactive
- Color (from source)
- Label (optional?)

**ND Check:**
- Direction: important for context flow
- Active state: important for understanding what's connected

**Question:** Can you see edge info without selecting it?

**Recommendation (P2):** Consider edge labels or tooltips showing direction/type.

---

## Iter 164 — Error Message Information

When errors occur, what info is provided?

**Expected:**
- What went wrong (clear message)
- Why it happened (if known)
- What to do about it

**ND Check:**
- Vague errors = anxiety
- Actionable errors = recoverable

**Recommendation (P1):** Every error must include: What happened + What to do next.

---

## Iter 165 — Empty State Information

What do empty states show?

**Examples:**
- Empty canvas: ?
- Empty chat: ?
- Empty layers: ?
- No extractions: ?

**ND Check:**
- Empty states should guide, not confuse
- Tell user what goes here and how to add it

**Recommendation (P1):** Define informative empty states for all containers.

---

## Iter 166 — Onboarding Information

Is there onboarding for new users?

**From exploration:** No onboarding spec found.

**ND Check:**
- First-time users need guidance
- But not intrusive — should be dismissable

**Recommendation (P2):** Minimal onboarding:
1. Empty canvas hint ("Create your first node")
2. First conversation hint ("Try asking Claude something")
3. First connection hint ("Connect nodes to share context")

Dismiss after first action or explicitly.

---

## Iter 167 — Help/Documentation Access

How do users get help?

**Expected:**
- Help menu
- ? shortcut
- Tooltips on hover
- Link to documentation

**ND Check:**
- Stuck users need escape hatch
- In-app help > external docs

**Recommendation (P2):** Add Help menu with:
- Keyboard shortcuts
- What's New
- Documentation link
- Support/feedback link

---

## Iter 168 — Version/Update Information

How do users know about updates?

**Expected:**
- What's New on first launch after update
- Version number in settings/about

**ND Check:**
- Not critical but professional

**Recommendation (P3):** Show version in Settings. Optional "What's New" on update.

---

## Iter 169 — Model Information

How is AI model info shown?

**From nodes:** Model name in footer.

**ND Check:**
- User should know which model they're using
- Model affects behavior/capability

**Verdict:** ✅ Model visible in node footer.

---

## Iter 170 — Information Density Balance

Is there a good balance of info density?

**Too sparse:** User has to hunt for info
**Too dense:** User is overwhelmed

**Assessment:**
- Canvas: Sparse (good — spatial focus)
- Nodes: Medium density (good — glanceable)
- Properties panel: Dense (maybe too dense — see Iter 152)
- Chat: Medium (good)

**Verdict:** 🟡 Properties panel needs hierarchy improvement.

---

## Iter 171 — Search Results Information

What do search results show?

**Expected:**
- Matching nodes
- Which field matched (title, content, tags?)
- Quick navigation to result

**ND Check:**
- Search should pan canvas to result (per Iter 15)
- Preview helps confirm "is this the right one?"

**Recommendation (P2):** Search results should show:
- Node type icon
- Title
- Snippet of matching content
- Click to navigate to location

---

## Iter 172 — Filter/Sort Information

How are filter/sort options presented?

**From styleguide plan:** Sort bar with icons (group, alpha, clock, grid).

**ND Check:**
- Icon-only sorting = unclear without tooltips
- Active sort should be visually indicated

**Recommendation (P2):** Sort icons need tooltips. Active sort highlighted.

---

## Iter 173 — Breadcrumb/Location Information

How do you know where you are?

**For Cognograph:**
- Workspace name in status bar ✅
- Zoom level (indicator) ✅
- Minimap shows viewport position ✅

**ND Check:**
- Multiple location indicators = good

**Verdict:** ✅ Location awareness is adequate.

---

## Iter 174 — Notification Information

How are notifications/alerts shown?

**From styleguide:** Toast notifications.

**Toast shows:**
- Message
- Optional icon
- Auto-dismiss or manual close

**ND Check:**
- Non-blocking ✅
- Temporary ✅
- If important, should persist longer

**Recommendation (P2):** Error toasts should require manual dismiss or have longer duration.

---

## Iter 175 — Information Architecture Summary

### What's Working (Validations)
- ✅ Node information hierarchy (glanceable vs detailed)
- ✅ Type-specific properties
- ✅ Status bar information (workspace, counts, save status)
- ✅ Toolbar state visibility
- ✅ Chat panel context indicator
- ✅ Extractions panel grouping
- ✅ Model visibility in node footer
- ✅ Location awareness (status bar, zoom, minimap)

### Needs Verification
- [ ] Properties panel collapse states
- [ ] Context settings preview
- [ ] Search result presentation
- [ ] Empty state content

### Recommendations
| Priority | Issue | Recommendation |
|----------|-------|----------------|
| P1 | Properties panel density | Group into Primary/Secondary/Advanced |
| P1 | Context settings | Show preview of what Claude will see |
| P1 | Error messages | Must include what happened + what to do |
| P1 | Empty states | Define informative empty states for all |
| P2 | Properties collapse | Right things collapsed by default |
| P2 | Edge information | Labels or tooltips showing direction |
| P2 | Onboarding | Minimal hints for first-time users |
| P2 | Help access | Help menu with shortcuts, docs, support |
| P2 | Search results | Type icon, title, snippet, navigate |
| P2 | Sort indicators | Tooltips + active state |
| P2 | Error toast duration | Longer or manual dismiss |
| P3 | Settings naming | Clearer category names |
| P3 | Created timestamp | Could be hidden deeper |
| P3 | Version info | In Settings + What's New on update |

---

## Stefan's Notes
*Space for Stefan to add context, corrections, or redirects*

-

---

## Checkpoint: Information Architecture Complete

**Iterations:** 151-175
**Findings:** 8 validations, 4 verifications needed, 14 recommendations
**Critical (P0):** 0
**High (P1):** 4
**Medium (P2):** 7
**Low (P3):** 3

**Circuit Breaker Check:** Findings focus on density management and empty states. Substantive and actionable. Continue.

**Ready to proceed to Domain 7: Polish?**
