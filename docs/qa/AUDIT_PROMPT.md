# Claude Opus 4.6 Audit Prompt

> Copy this entire file as your prompt to Claude Opus 4.6

---

## Your Role

You are a senior software engineer conducting a deep audit of **Cognograph**, a spatial AI workflow orchestration canvas. Your goal is to identify why the app doesn't work as intended and feels unintuitive.

### Adopt Whatever Perspective Helps

Before diving in, consider what perspective would give you the best insights:

- **Should you become a persona?** Perhaps a UX designer who's shipped products like Figma, Miro, or Notion? A power user who lives in AI tools? A first-time user who's never seen a node-based interface?
- **Should you roleplay multiple users?** Walk through the app as different archetypes?
- **Should you adopt a specific critical lens?** Accessibility expert? Performance engineer? Product strategist?

**Do whatever you need to do** to give the most valuable audit. If adopting a persona or framework would sharpen your insights, do it. Explain your approach at the start of your output.

### You Have Authority to Recommend UI Changes

This isn't just a code audit. If the UI itself is the problem — layouts, flows, visual hierarchy, interaction patterns, information architecture — **recommend changes or complete remakes**.

Don't be shy about saying "this entire component should be redesigned" or "this flow needs to be rethought from scratch." The goal is a working, intuitive app, not preserving existing code.

## The Problem

The app has been built with significant code (10,000+ lines of stores, hundreds of components), but:
1. Things the user expects to work don't seem to work
2. The app doesn't feel user-friendly or intuitive
3. Features are unclear about how to use them
4. Something is broken but we don't know what

## Your Task

1. **Systematically test core user flows** by reading the code
2. **Identify broken, incomplete, or poorly wired functionality**
3. **Find usability gaps** — features that exist but are hard to discover/use
4. **Identify missing features** — things users would expect that don't exist
5. **Surface insights** — patterns, opportunities, and architectural improvements
6. **Produce a prioritized issue list** with specific fixes AND a feature gap analysis

---

## Project Context

**Read this section completely before starting.**

### What Cognograph Is

A spatial canvas where AI conversations, notes, tasks, and projects exist as **nodes** that can be:
- Positioned and arranged spatially
- Connected with edges
- Contextualized — connected nodes automatically feed into AI prompts

**The core insight:** The spatial arrangement IS the organization. By connecting nodes, users build both visual structure AND AI context.

### Product Vision (What It SHOULD Feel Like)

From `docs/strategy/VISION.md`:

**The Problem Being Solved:**
Linear chat interfaces (ChatGPT, Claude.ai) collapse under complexity:
- No persistence of structure — conversations are isolated silos
- No visual relationships — you can't see how ideas connect
- No context sharing — each conversation starts from zero
- No branching — you can't fork and explore alternatives

**Key Differentiators:**
1. **Context Injection** — Connected nodes automatically feed into AI prompts (killer feature)
2. **Visual Workflow** — See your AI work as a graph, spot patterns
3. **Provider Agnostic** — Works with Claude, Gemini, OpenAI, local models
4. **Local-First** — Data stays on machine, no subscription required

**Design Philosophy:**
1. Solve Real Problems — Prioritize actual usage over theoretical value
2. Working Software Over Plans — Ship small, iterate
3. Spatial Thinking as First-Class — Everything is nodes, edges, canvas
4. AI as Collaborator — AI sees same structure as user
5. Progressive Disclosure — Simple by default, powerful when needed

**Target "Aha Moments":**
- User connects a Note to a Conversation → AI automatically knows about the note
- User arranges nodes spatially → The arrangement becomes the organization
- User sees context indicator → Understands what AI "sees"

### Tech Stack
- Electron 36 + React 19 + React Flow 12 + Zustand 5 + Tailwind 4 + TipTap

### Project Location
`./` (repository root)

---

## Architecture Summary

```
Main Process (src/main/)
├── index.ts          — App entry, window creation
├── workspace.ts      — File I/O (JSON workspaces)
├── llm.ts            — LLM API calls (Anthropic, Gemini)
├── aiEditor.ts       — AI Editor plan generation
└── multiplayer.ts    — Yjs CRDT sync

Preload Bridge (src/preload/index.ts)
└── Exposes window.api with typed IPC channels

Renderer Process (src/renderer/)
├── App.tsx           — Main canvas (~900 lines)
├── stores/           — 16 Zustand stores
│   └── workspaceStore.ts — Central store (5,108 lines)
├── components/
│   ├── nodes/        — 8 node types
│   ├── ai-editor/    — AI Editor UI
│   └── ...
├── services/         — Business logic
└── hooks/            — Custom hooks
```

### Node Types (8)
1. `conversation` — AI chat sessions with messages[]
2. `project` — Container for grouping nodes
3. `note` — Rich text (TipTap)
4. `task` — Trackable with status/priority
5. `artifact` — Files/code from AI
6. `action` — Automation workflows
7. `workspace` — Embedded workspace reference
8. `text` — Simple text

### Key Files to Read

**Start with these to understand the core:**
1. `src/renderer/src/App.tsx` (lines 1-300) — Canvas setup, keyboard handlers
2. `src/renderer/src/stores/workspaceStore.ts` (lines 1-300) — State structure
3. `src/preload/index.ts` — IPC API surface
4. `src/renderer/src/components/ChatPanel.tsx` — Chat implementation
5. `src/renderer/src/utils/contextBuilder.ts` — Context injection logic

**Then check specific features:**
- `src/renderer/src/components/nodes/ConversationNode.tsx` — Chat node
- `src/renderer/src/components/ai-editor/` — AI Editor components
- `src/renderer/src/components/PropertiesPanel.tsx` — Property editing

---

## Core User Flows to Audit

### Flow 1: First-Time User Experience
1. App opens for first time
2. User sees empty canvas
3. How do they know what to do?
4. How do they create their first node?
5. How do they start chatting?

**Audit questions:**
- Is there onboarding or hints?
- Are keyboard shortcuts discoverable?
- Is the toolbar clear about what buttons do?

### Flow 2: Creating and Connecting Nodes
1. User creates a Conversation node
2. User creates a Note node
3. User connects them with an edge
4. User types in the note

**Audit questions:**
- Does the node creation work?
- Is connecting nodes intuitive?
- Does the connection show any feedback?

### Flow 3: Chatting with Context Injection
1. User has connected nodes (Note → Conversation)
2. User opens chat in Conversation node
3. User sends a message
4. AI response should include context from Note

**Audit questions:**
- Does `getContextForNode()` actually get called?
- Is context actually injected into the prompt?
- Does the user see any indication context was included?

### Flow 4: AI Editor Usage
1. User presses `/` to open InlinePrompt
2. User types a command like "create 3 notes about marketing"
3. AI generates a plan
4. Plan is applied to canvas

**Audit questions:**
- Does `/` key trigger the prompt?
- Does the AI call actually happen?
- Do nodes actually get created?

### Flow 5: Properties Panel
1. User selects a node
2. Properties panel should open
3. User can edit title, content, etc.
4. Changes reflect on the node

**Audit questions:**
- Does selection trigger panel opening?
- Are edits saved to the store?
- Does the node visually update?

---

## Known Issues to Verify

### Already Documented
1. 146 TypeScript errors in deprecated AIConfig files (intentionally kept)
2. Handle issues when changing node type
3. Line breaks not showing in notes

### Suspected Issues (Need Investigation)
1. AI Editor might not actually apply changes
2. Context injection might not work
3. Keyboard shortcuts might not be wired up
4. First-run experience might be confusing
5. Chat streaming might have race conditions

---

## Audit Methodology

### Step 1: Trace Core Flows
For each flow above:
1. Start at the UI component
2. Trace through to store action
3. Trace through to IPC call (if applicable)
4. Verify the response is handled

### Step 2: Check Event Wiring
Look for:
- Event handlers that are defined but not attached
- Callbacks that are passed but never called
- Store actions that exist but aren't imported
- IPC channels that exist in preload but not main

### Step 3: Check State Management
Look for:
- State updates that don't trigger re-renders
- Selectors that select too much or wrong thing
- Actions that don't push to history (undo won't work)
- Race conditions in async operations

### Step 4: Check User Feedback
Look for:
- Actions with no loading state
- Errors that are caught but not shown
- Success states with no confirmation
- Features with no discoverability

---

## Gap Analysis & Insights

Beyond fixing what's broken, identify what's **missing** or could be **better**.

### Feature Gaps to Consider

**Core Experience Gaps:**
- What would a first-time user expect that doesn't exist?
- What's the "aha moment" and is it reachable?
- Are there dead ends where users get stuck?

**Context Injection (Core Feature) Gaps:**
- Can users see what context is being injected?
- Can users control context (include/exclude)?
- Is the context chain visible (what connects to what)?

**Chat Experience Gaps:**
- Can users fork/branch conversations?
- Can users compare different AI responses?
- Is conversation history searchable?

**Canvas/Spatial Gaps:**
- Can users create templates from selections?
- Can users duplicate node groups?
- Is there a way to collapse/expand regions?

**Automation (Action Nodes) Gaps:**
- Are triggers discoverable?
- Can users see automation history/logs?
- Is there a way to test actions without running them?

### UI/Design Recommendations

Don't just note problems — propose solutions:

**Layout & Structure:**
- Should panels be repositioned?
- Is the toolbar in the right place with the right items?
- Does the visual hierarchy guide attention correctly?

**Interaction Patterns:**
- Are click targets appropriately sized?
- Do hover states provide useful feedback?
- Are drag operations discoverable?

**Information Architecture:**
- Is content organized logically?
- Can users find what they need?
- Are there too many options? Too few?

**Visual Design:**
- Does the aesthetic support the use case?
- Is there visual noise that should be removed?
- Are states (selected, hover, active, disabled) clear?

**Complete Redesigns:**
- Which components need minor tweaks?
- Which need significant rework?
- Which should be scrapped and rebuilt?

### Insight Categories to Surface

**Architectural Insights:**
- Are there patterns that should be abstracted?
- Is there duplicated logic that should be unified?
- Are there performance bottlenecks waiting to happen?

**UX Insights:**
- What's the learning curve like?
- Where do mental models break?
- What would power users want that novices don't need?

**Product Insights:**
- What's the unique value vs. competitors (ChatGPT, Notion AI)?
- What features would create lock-in/stickiness?
- What's the path from "trying it" to "can't live without it"?

**Technical Debt Insights:**
- What shortcuts were taken that need cleanup?
- What abstractions are missing?
- What would make the codebase easier to extend?

---

## Output Format

Produce a markdown document with this structure:

```markdown
# Cognograph Audit Results

## Executive Summary
[2-3 sentences on overall state]

---

# PART 1: ISSUES (What's Broken)

## Critical Issues (Blocking Core Functionality)
### Issue 1: [Title]
**Symptom:** What the user experiences
**Root Cause:** What's wrong in the code
**Location:** File:line
**Fix:** Specific change needed

## High Priority Issues (Significant UX Problems)
### Issue N: [Title]
...

## Medium Priority Issues (Polish/Completeness)
### Issue N: [Title]
...

## Low Priority Issues (Nice to Have)
### Issue N: [Title]
...

---

# PART 2: GAPS (What's Missing)

## Critical Gaps (Users Will Be Confused Without)
### Gap 1: [Title]
**User Expectation:** What they'd expect
**Current State:** What exists (or doesn't)
**Recommendation:** What to build
**Effort Estimate:** Small / Medium / Large

## Feature Gaps (Would Significantly Improve UX)
### Gap N: [Title]
...

## Enhancement Opportunities (Nice to Have)
### Gap N: [Title]
...

---

# PART 3: INSIGHTS (Strategic Observations)

## Architectural Insights
[Patterns to abstract, duplications to unify, performance concerns]

## UX Insights
[Learning curve issues, mental model breaks, power user needs]

## Product Insights
[Unique value, stickiness opportunities, competitive positioning]

## Technical Debt
[Shortcuts needing cleanup, missing abstractions, extensibility concerns]

---

# PART 4: UI REDESIGN RECOMMENDATIONS

## Components Needing Minor Tweaks
[Small CSS/layout fixes, polish items]

## Components Needing Significant Rework
[Interaction pattern changes, restructuring]

## Components Needing Complete Redesign
[Scrap and rebuild recommendations with rationale]

## New UI Elements to Add
[Missing affordances, feedback mechanisms, onboarding elements]

---

# PART 5: PRIORITIZED ACTION PLAN

## Immediate Fixes (Do This Week)
[Ordered list of critical/high issues — specific files and changes]

## Quick Wins (High Impact, Low Effort)
[Features or fixes that would significantly improve experience with minimal work]

## UI Overhaul Priority
[Which UI changes to tackle first, in what order]

## Strategic Roadmap (Next Month)
[Larger features or refactors that would elevate the product]

## Vision Alignment Score
[Rate 1-10: How well does current state align with "spatial AI workflow orchestration" vision?]
[What's the biggest gap between vision and reality?]
[What single change would most close that gap?]
```

---

## Important Notes

### For Issues (Part 1)
1. **Don't guess** — Only report issues you can verify by reading the code
2. **Be specific** — Include file paths and line numbers
3. **Focus on wiring** — Most issues are likely things not connected, not logic bugs
4. **Think like a user** — What would confuse a first-time user?
5. **Prioritize ruthlessly** — Core chat functionality > AI Editor > Polish

### For Gaps (Part 2)
1. **Compare to vision** — What's promised in VISION.md that doesn't exist?
2. **Think competitively** — What do ChatGPT/Notion/Miro have that this lacks?
3. **Consider learning curve** — What would help users "get it" faster?
4. **Estimate effort honestly** — Small = hours, Medium = days, Large = weeks

### For Insights (Part 3)
1. **Be constructive** — Observations should lead to actionable improvements
2. **Think long-term** — What patterns would cause problems at scale?
3. **Consider the market** — What would make this a must-have vs nice-to-have?
4. **Note bright spots** — What's working well that should be preserved/extended?

---

## Quick Reference: Key Keyboard Shortcuts (from code)

These SHOULD work — verify they do:
- `C` — Create conversation node
- `N` — Create note node
- `T` — Create task node
- `P` — Create project node
- `/` — Open AI prompt
- `Tab` — Open AI Editor (with selection)
- `Cmd+K` — Command palette
- `Cmd+Z` — Undo
- `Cmd+Shift+Z` — Redo
- `Delete` — Delete selected
- `Escape` — Deselect / close panel

---

## Start Your Audit

### Phase 1: Understand (30 min)
1. Read `docs/strategy/VISION.md` to internalize the vision
2. Skim `ARCHITECTURE.md` for system overview
3. Read `src/renderer/src/App.tsx` (first 300 lines) for canvas structure

### Phase 2: Trace Core Flows (1-2 hours)
1. Trace keyboard shortcuts from App.tsx
2. Trace node creation flow
3. Trace chat/streaming flow
4. Trace context injection flow
5. Trace AI Editor flow

### Phase 3: Identify Issues (1 hour)
Document everything broken, incomplete, or poorly wired

### Phase 4: Gap Analysis (30 min)
Compare current state to vision, identify what's missing

### Phase 5: Insights (30 min)
Surface patterns, opportunities, and strategic observations

### Phase 6: Synthesize (30 min)
Produce the final report with prioritized recommendations

---

Good luck. Be thorough. Find what's broken AND what's missing.
