# Tier 2 AI Vision Testing - UX Findings Report

**Date:** 2026-02-15
**Test Type:** Blind Cognitive Proxy (AI Vision)
**States Evaluated:** 10
**Total Cost:** $0.20
**Bead:** cognograph_02-bku

---

## Executive Summary

**Severity: CRITICAL**
**Average Clarity Score: 2.6/10** (Target: 7+/10)
**Dealbreakers: 10/10 states** (Users would quit)

AI vision testing reveals **catastrophic first-impression UX**. The interface is perceived as "broken," "chaotic," and "overwhelming" across all 10 tested states. Users would likely close the app within 15 seconds assuming it crashed or has serious bugs.

---

## Top 5 Critical Issues (Priority Order)

### 1. **"Looks Like a Rendering Bug" (9/10 states) — SEVERITY: P0**

**What AI sees:**
- Multiple identical "New Note" windows stacked/overlapping
- Panels and modals layered on top of each other
- Unclear which element is active or interactive

**Quotes:**
- *"Looks broken or mid-tutorial"*
- *"I'd assume the app crashed"*
- *"Unclear if this is the intended state or if something broke"*
- *"The overlapping windows make it look completely broken"*

**Root Cause:** Panels, sidebars, and modals all visible simultaneously with `pointer-events-auto`, creating visual stacking chaos.

**Impact:** Users immediately distrust the app and assume it's defective.

**Fix:**
- Hide inactive panels/modals completely (not just opacity)
- Single active panel at a time
- Clear z-index hierarchy
- Animations for panel transitions (make intentionality clear)

---

### 2. **No Visual Hierarchy (10/10 states) — SEVERITY: P0**

**What AI sees:**
- "Orange borders everywhere competing for attention"
- "Everything screams for attention equally"
- "Can't tell which window is active"

**Quotes:**
- *"No clear visual hierarchy"*
- *"The dual interface is disorienting"*
- *"Too many overlapping windows and unclear visual hierarchy"*

**Root Cause:** Glass effects, borders, and highlights applied uniformly without focus indication.

**Impact:** Users don't know where to look or what to interact with.

**Fix:**
- Dim/blur inactive panels
- Single strong focus indicator (not multiple orange borders)
- Reduce secondary element prominence
- Context-based visibility (hide when not needed)

---

### 3. **Jargon Without Context (10/10 states) — SEVERITY: P1**

**Confusing Terms (no explanation):**
- "Context Injection" - mentioned in 8 states as confusing
- "Role: Reference (default)" - unclear purpose
- "Live Physics" - incomprehensible
- "Context Depth" in "hops from conversation nodes"
- "Conditional Activation"

**Quotes:**
- *"What is 'Context Depth' and why would I care?"*
- *"'Context Injection' and 'Role' fields with no explanation"*
- *"Would make me feel stupid"*

**Root Cause:** Power-user features exposed immediately without progressive disclosure.

**Impact:** Cognitive overload in first 5 seconds.

**Fix:**
- Hide advanced features by default
- Tooltips with plain-English explanations
- "What's this?" links to contextual help
- Rename to user-friendly terms where possible

---

### 4. **Feature Discoverability Failures (3/10 stuck) — SEVERITY: P1**

**Stuck States:**

**chat-open (Pass B: FAILED):**
- AI cannot find any chat interface or message input
- Quote: *"No obvious way to communicate with an AI"*
- The chat IS open, but UI doesn't communicate this

**sidebar-open (Pass B: FAILED):**
- AI cannot find "recent conversations" feature
- No clear history/recents UI element visible

**multiple-nodes (Pass B: FAILED):**
- AI cannot find way to sort/search nodes by age
- Identified filter button but can't confirm it has date sorting

**Root Cause:** Features exist but lack visual affordances or labels.

**Impact:** Users can't complete core tasks even when features exist.

**Fix:**
- Clear labels for chat interface ("AI Assistant" / "Chat")
- Dedicated "Recent" or "History" panel
- Search/filter UI with visible capabilities
- Icon + text labels (not icon-only)

---

### 5. **Overwhelming Element Count (Avg 7 confusing elements/state) — SEVERITY: P1**

**Repeated Confusions:**
- Multiple "General" dropdowns visible (unclear which controls what)
- "0 words" counter appears 3-5 times (which one matters?)
- Sparkle icons in multiple contexts (no clear meaning)
- Orange connection dots (are they handles, buttons, or decorative?)
- "--" in Icon field (looks like a bug)

**Root Cause:** Information density without prioritization or grouping.

**Impact:** Analysis paralysis - too many elements compete for attention.

**Fix:**
- Reduce visible UI elements by 40%
- Group related controls
- Hide secondary features until needed
- Use white space to create breathing room

---

## Positive Findings

**What WORKED (higher clarity states):**

1. **Settings modal (3/10):** AI correctly identified "AI & Connectors" menu
2. **Context menu (3/10):** AI found Delete button with trash icon
3. **Toolbar (4/10 best score):** Multiple nodes state had clearest purpose

**Why these worked:**
- Clear labels ("AI & Connectors" is self-explanatory)
- Standard patterns (red Delete with trash icon)
- Less visual overlap in these specific views

---

## Hallucination Analysis

**Finding:** Almost EVERY Pass B step was a hallucination.

**Examples:**
- "Click on the 'New Note' card" — Card doesn't exist in DOM
- "The Title field in the right sidebar" — Field not found in DOM
- "Orange connection points" — Elements not clickable in DOM

**What this means:**
- AI is describing what SHOULD exist based on visual cues
- But actual interactive elements don't match visual design
- Users would click where AI suggests and nothing would happen

**Impact:** Severe usability failure - visual design doesn't match interaction model.

---

## Dealbreakers (User Churn Risk)

**All 10 states had dealbreakers. Most common:**

1. *"Looks broken/crashed"* (6 states)
2. *"Makes me feel stupid"* (2 states - jargon overload)
3. *"Can't tell what to do first"* (2 states)

**Time to quit:** 15 seconds average (would close tab/app)

---

## Recommended Immediate Actions

### Phase 1: Visual Clarity (Fix "Looks Broken" Perception)
**Priority: P0** — Blocking v0.1 release

1. **Single Active Panel Rule**
   - Only one modal/panel visible at a time
   - Hide (not fade) inactive panels
   - Clear entry/exit animations

2. **Focus Hierarchy**
   - Dim inactive nodes to 40% opacity
   - Single active node with prominent border
   - Blur background when modal open

3. **Remove Overlaps**
   - Properties panel slides over (not alongside)
   - Modals have backdrop blur
   - Tooltips auto-dismiss on interaction

**Estimated Impact:** Clarity 2.6 → 5.5/10

---

### Phase 2: Simplify & Label (Fix Jargon)
**Priority: P1** — Post-v0.1

1. **Rename Technical Terms**
   - "Context Injection" → "Share with AI"
   - "Role: Reference" → "How to use this note"
   - "Context Depth" → "How many connections to follow"

2. **Progressive Disclosure**
   - Hide "Context Injection" section until node is connected
   - Collapse "Conditional Activation" by default
   - "Advanced" accordion for power features

3. **Inline Help**
   - Tooltips on every jargon term
   - "?" icons with plain-English explanations
   - Example values ("e.g., API key starts with sk-")

**Estimated Impact:** Clarity 5.5 → 7/10

---

### Phase 3: Feature Discoverability (Fix Stuck Tasks)
**Priority: P1** — Post-v0.1

1. **Chat Interface Clarity**
   - Add visible "AI Chat" label when conversation node open
   - Message input with placeholder "Ask Claude..."
   - Clear "Send" button (not just Enter)

2. **Recent Conversations**
   - Left sidebar: dedicated "Recent" tab
   - Show last 10 conversations with timestamps
   - Search/filter for older items

3. **Node Management**
   - Search bar with placeholder "Find nodes..."
   - Sort dropdown (by date, name, type)
   - Mini-map with node labels

**Estimated Impact:** Task completion 70% → 95%

---

## Cost Efficiency Analysis

**Total Spend:** $0.203
**Per-State:** $0.02
**Per-Insight:** ~$0.01 (20+ actionable findings)

**ROI:** Exceptional. For $0.20, we identified 5 critical UX blockers that would cause user churn. Fixing these before launch could save thousands in support costs and reputation damage.

**Comparison to Human Testing:**
- User testing session: $100-500
- Would need 10+ users to get same breadth
- Total cost: $1,000-5,000
- Time: Weeks to schedule/conduct/analyze

**AI Vision Testing:**
- Cost: $0.20
- Time: 4 minutes
- Unbiased (no politeness filter)
- Reproducible (run on every build)

---

## Next Steps

1. ✅ **Tier 1 COMPLETE:** All 5 critical paths passing
2. ✅ **Tier 2 COMPLETE:** 10 states evaluated, major UX issues identified
3. ⏳ **Create P0 UX Fix Plan:** Based on findings above
4. ⏳ **Implement Phase 1 fixes:** Single active panel, focus hierarchy, remove overlaps
5. ⏳ **Re-run Tier 2:** Validate clarity improved to 7+/10
6. ⏳ **Tier 3-7:** Multi-model agreement, personas, adversarial, sequences, real-user

---

## Appendix: Individual State Details

### State: empty-canvas
- **Clarity:** 2/10
- **First Impression:** "Chaotic mess of overlapping windows and popups that looks broken"
- **Dealbreaker:** "Looks like a rendering bug rather than intentional design"
- **Task:** Create first note
- **Completion:** Thinks possible, but all steps are hallucinations

### State: single-node
- **Clarity:** 2/10
- **First Impression:** "Overwhelming dark interface with confusing onboarding tutorial blocking everything"
- **Dealbreaker:** "Aggressive onboarding modal + visual clutter makes it impossible to understand"
- **Task:** Open node and change title
- **Completion:** Thinks possible, but Title field is hallucinated

### State: two-connected
- **Clarity:** 3/10
- **First Impression:** "Node-based note-taking with confusing overlapping cards"
- **Dealbreaker:** "Overlapping duplicate cards make it look broken"
- **Task:** Make AI use first node as context
- **Completion:** Thinks possible, but misunderstands that nodes are ALREADY connected

### State: chat-open
- **Clarity:** 3/10
- **First Impression:** "Chaotic mind-mapping app with too many overlapping cards"
- **Dealbreaker:** "Visual chaos makes it look broken"
- **Task:** Send message to AI
- **Completion:** **STUCK** - Cannot find any chat interface or message input

### State: toolbar-visible
- **Clarity:** 2/10
- **First Impression:** "Cluttered note-taking app with unclear visual hierarchy"
- **Dealbreaker:** "Overlapping windows bug/glitch makes it look broken and unusable"
- **Task:** Create conversation node
- **Completion:** Thinks possible (correctly identifies toolbar), but hallucinated the specific button

### State: settings-open
- **Clarity:** 3/10
- **First Impression:** "Dark-themed app with overwhelming settings panel"
- **Dealbreaker:** "Jargon-heavy settings would make me feel stupid"
- **Task:** Configure API key
- **Completion:** Thinks possible, correctly identified "AI & Connectors" menu (but second step hallucinated)

### State: sidebar-open
- **Clarity:** 2/10
- **First Impression:** "Chaotic mess of overlapping windows that looks broken or bugged"
- **Dealbreaker:** "Looks completely broken - wouldn't trust it with my notes"
- **Task:** View recent conversations
- **Completion:** **STUCK** - Cannot find any recent conversations UI element

### State: node-selected
- **Clarity:** 2/10
- **First Impression:** "Chaotic note-taking interface with way too many overlapping windows"
- **Dealbreaker:** "Looks broken rather than feature-rich"
- **Task:** Edit node title
- **Completion:** Thinks possible, but Title field is hallucinated

### State: multiple-nodes
- **Clarity:** 4/10 (BEST SCORE)
- **First Impression:** "Dark-themed mind mapping or node-based workflow tool"
- **Dealbreaker:** "Overwhelming darkness makes it hard to see hierarchy"
- **Task:** Find oldest node
- **Completion:** **STUCK** - Found filter button but can't confirm it has date sorting

### State: context-menu
- **Clarity:** 3/10
- **First Impression:** "Cluttered note-taking app with too much happening at once"
- **Dealbreaker:** "Overwhelming number of options - unclear primary action"
- **Task:** Delete node
- **Completion:** Thinks possible, correctly identified Delete option (but hallucinated the exact appearance)

---

## Key Metrics Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Avg Clarity | 2.6/10 | 7+/10 | ❌ FAIL |
| Task Completion | 70% | 90%+ | ❌ FAIL |
| States w/ Dealbreakers | 100% | <20% | ❌ FAIL |
| Avg Confusing Elements | 7/state | <3/state | ❌ FAIL |
| Hallucination Rate | ~90% | <20% | ❌ FAIL |

**Verdict:** App is NOT ready for users. Critical UX overhaul required before v0.1 release.

---

## Appendix: Full AI Responses

See individual JSON files in `e2e/smart-e2e/results/tier2/`:
- `{state}-pass-a.json` - Zero-context first impression
- `{state}-pass-b.json` - Task completion pathfinding
- `{state}-dom.json` - Actual clickable elements (truth baseline)
- `tier2-phase-a-summary.json` - Aggregate metrics
