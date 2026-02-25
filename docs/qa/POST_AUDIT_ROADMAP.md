# Post-Audit Roadmap & User Testing Plan

> After fixing all 26 audit issues, this document defines what comes next: the ideal workflows that should work flawlessly, a concrete user testing protocol, and the strategic roadmap to 10/10 vision alignment.

---

## Part 1: Target Workflows (What "Done" Looks Like)

These 7 workflows represent the ideal experience after all audit fixes + gap closures. Each one leverages Cognograph's unique advantage: **user-controlled, visible, auditable context graphs** that no competitor offers.

### Workflow 1: Contextual Research Branching

**Archetype:** Researcher | **Time to value:** 3-4 min

**User story:** "As a researcher, I want multiple AI conversations that each draw on the same reference notes, so I can explore different angles without re-explaining background."

**Steps:**
1. `Shift+N` to add a Note. Title: "Background: Quantum Computing." Paste research notes.
2. `Shift+N` again. Title: "Key Papers & Sources." Add references.
3. `Shift+C` to add a Conversation. Title: "QC: Hardware Approaches."
4. Drag edges from both Notes → Conversation. Context Indicator shows "Using context from 2 nodes."
5. Ask a question. AI responds with full awareness of your notes — referencing your specific papers.
6. `Shift+C` for a second Conversation. Connect same notes. Different angle, same knowledge base.

**Why impossible elsewhere:** In ChatGPT/Claude.ai, starting a new conversation = starting from zero. Here, reference material is a reusable asset. Update the source note → every connected conversation gets updated context.

---

### Workflow 2: Plan, Execute, Track in One View

**Archetype:** Project Manager | **Time to value:** 4-5 min

**User story:** "As a PM, I want to discuss a plan with AI, extract action items, and track them as tasks on the same canvas."

**Steps:**
1. `Shift+P` for a Project node. Title: "Website Redesign." Set description.
2. `Shift+C` for a Conversation inside the project. Edge auto-created — AI knows the scope.
3. Chat: "Break this redesign into phases with deliverables and timelines."
4. Use Extraction to pull AI's suggestions into Task nodes. They appear connected to the conversation.
5. Drag Tasks into the Project container. Set priority/status in Properties panel.
6. As work progresses, update statuses. Canvas shows project at a glance.

**Why impossible elsewhere:** Notion AI generates task lists in a linear document. ChatGPT's output is ephemeral text. Here, AI suggestions become first-class objects you can rearrange, connect, track, and feed into future conversations.

---

### Workflow 3: Living Style Guide

**Archetype:** Developer | **Time to value:** 2 min

**User story:** "As a developer, I want coding conventions in a note that every coding conversation automatically follows."

**Steps:**
1. `Shift+N` for a Note. Title: "Coding Standards." Write your rules (TypeScript strict, Zod validation, kebab-case, etc.)
2. Connect this Note to any Conversation about code.
3. AI follows your conventions automatically — every connected conversation.
4. Update the Note later → all future messages in every connected conversation respect the change.

**Why impossible elsewhere:** Competing products have a single global "custom instructions" blob. You can't have project-specific rules, can't selectively apply them, and updating doesn't propagate. Cognograph treats instructions as composable, connectable objects.

---

### Workflow 4: Idea Explosion with AI Editor

**Archetype:** Writer/Creative | **Time to value:** 2-3 min

**User story:** "As a writer, I want AI to generate a cluster of related ideas as connected nodes I can rearrange spatially."

**Steps:**
1. `Shift+N` for a Note. Write your thesis statement.
2. Select the Note. Press `/` for inline AI prompt.
3. Type: "Generate 6 sub-arguments and counterarguments as connected notes."
4. AI Editor streams a plan with ghost node previews on canvas.
5. Click "Apply." Six new Notes materialize, each with content, all connected.
6. Drag to rearrange. Supporting arguments left, counterarguments right.
7. Connect any note to a new Conversation to explore it deeper — AI knows the full context chain.

**Why impossible elsewhere:** Linear chat brainstorming produces a list in a single message. You can't rearrange items, selectively connect ideas, or see spatial relationships. Cognograph turns brainstorming into spatial, persistent, interconnected thinking.

---

### Workflow 5: Automated Task Triage

**Archetype:** Team Lead | **Time to value:** 3-4 min setup, then automatic

**User story:** "As a team lead, I want new tasks auto-prioritized by AI so triage happens without manual overhead."

**Steps:**
1. Create an Action node. Title: "Auto-Triage New Tasks."
2. Configure trigger: `node-created` with `nodeTypeFilter: 'task'`
3. Configure action: `generate-content` that analyzes title/description, then `update-property` to set priority and complexity.
4. Action node goes live (green indicator).
5. Create any new Task → within seconds, AI sets priority and complexity automatically.

**Why impossible elsewhere:** No competitor has automation triggered by canvas events that can call an LLM. Cognograph's action nodes create an event-driven AI layer. The AI watches and acts without being asked.

---

### Workflow 6: Context Chain Deep Dive

**Archetype:** Analyst | **Time to value:** 5 min for 3-stage chain

**User story:** "As an analyst, I want to chain conversations so each builds on the conclusions of the previous one, creating depth impossible in a single thread."

**Steps:**
1. Conversation 1: "Market Analysis: Raw Data." Get detailed analysis.
2. Distill key findings into a Note. Connect Conversation 1 → Note.
3. Conversation 2: "Competitive Positioning." Connect the Note → Conversation 2. AI inherits the distilled knowledge.
4. Distill again into "Gap Analysis" Note.
5. Conversation 3: "GTM Strategy." Connect both Notes. AI has accumulated knowledge from the full chain.
6. Canvas shows a clear left-to-right chain: each stage focused, each building on predecessors.

**Why impossible elsewhere:** Linear chat is limited by context window — after 50 messages, AI forgets early content. Cognograph lets you distill each stage into concise notes and feed only distilled knowledge forward. Effectively unlimited analytical depth.

---

### Workflow 7: Template-Powered Repeatable Workflow

**Archetype:** Content Creator | **Time to value:** 30 seconds

**User story:** "As a content creator, I want to stamp down a pre-built research workflow with one click and immediately start working."

**Steps:**
1. Open Template Browser. Select "Research Flow" template.
2. Fill in placeholder: "The impact of sleep on engineering productivity."
3. Click "Create." Five pre-connected nodes materialize: Research Conversation, Background Note, Sources Note, Synthesis Note, Follow-up Conversation.
4. Fill in Background note. Start researching in the Conversation — context auto-injected.
5. Save your own variations as custom templates.

**Why impossible elsewhere:** ChatGPT has no workflow templates. Claude Projects offer flat file collections. Cognograph templates stamp down an entire interconnected AI reasoning system — nodes, edges, context roles, and spatial layout — in one action.

---

## Part 2: What Comes After the 26 Fixes

### Phase 1: Immediate Fixes (Week 1)
> All 26 audit issues. See `docs/qa/AUDIT_RESULTS.md` Part 5 for the detailed implementation plan.

**Result:** Vision score moves from 4/10 → 6/10. Core flows work reliably.

### Phase 2: Critical Gaps (Week 2)
> Gaps 1-3 from the audit: context visualization, onboarding, injection feedback.

| Gap | What to Build | Effort |
|-----|--------------|--------|
| Gap 1: Context flow indicators on edges | Subtle animation/icon on edges carrying context | 1-2 days |
| Gap 2: First-run onboarding | 4-step overlay: API key → Create conversation → Send message → Connect note | 3-5 days |
| Gap 3: Injection feedback | "Using context from: Note A, Note B" badge on AI responses | 1-2 days |

**Result:** Vision score → 7/10. Core experience is discoverable and guided.

### Phase 3: User Testing Round 1 (Week 3)
> See Part 3 below. Test Workflows 1, 3, 6 (the context injection workflows).

**Result:** Discover UX friction that code audits can't find.

### Phase 4: Feature Gaps (Weeks 4-5)
> Based on user testing results + remaining audit gaps.

| Priority | Feature | Effort |
|----------|---------|--------|
| High | Message deletion (Gap 4) | 1 day |
| High | Node search in Command Palette (Gap 9 + Issue 20) | 2 days |
| Medium | Conversation forking (Gap 5) | 3-5 days |
| Medium | Cross-conversation search (Gap 6) | 3-5 days |
| Medium | In-chat provider switching (Gap 7) | 1 day |
| Medium | Context chain visualization (Gap 8) | 2-3 days |
| Low | Bulk operations (Gap 10) | 2-3 days |
| Low | Edge editing discoverability (Gap 11) | 1 day |

### Phase 5: Architecture Hardening (Week 6)
| Task | Rationale |
|------|-----------|
| Split workspaceStore.ts (5,108 lines) into domain slices | Prevent the monolith from becoming unmaintainable |
| Unify streaming architecture | Agent pattern (per-request controllers) everywhere |
| Add E2E test suite (Playwright) | Prevent regression of all 26 fixed issues |
| Unify provider implementations | Anthropic, OpenAI, Gemini should share patterns |

### Phase 6: User Testing Round 2 (Week 7)
> Test Workflows 2, 4, 5, 7 (project management, AI Editor, automation, templates).

### Phase 7: Polish & Ship (Week 8+)
- Performance optimization (large canvases, many nodes)
- Keyboard shortcut rationalization (3-tier system from audit)
- Toolbar simplification
- Toast notification reduction
- Documentation / help system

---

## Part 3: User Testing Plan (You + Claude)

### The Challenge
Traditional user testing requires recruiting testers, scheduling sessions, and recording observations. But **you can do highly effective testing right now** with a structured protocol that leverages Claude as your testing partner.

### Protocol: Guided Walkthrough Testing

**How it works:** You perform each workflow while describing what you see and experience to Claude. Claude acts as a usability researcher — asking probing questions, noting friction points, and documenting issues.

#### Test Session Template

```
Session: [Workflow Name]
Date: [Date]
Build: [After which fixes were applied]

Pre-test:
- Fresh workspace (no existing nodes)
- API key configured for [provider]
- Screen recording ON (optional but recommended)

During test (narrate to Claude):
1. "I'm going to try to [workflow goal]"
2. Do the workflow step by step
3. After each step, tell Claude:
   - What you expected to happen
   - What actually happened
   - How it felt (easy/confusing/slow/broken)
   - What you'd change

Post-test:
- Rate the workflow 1-10 for intuitiveness
- Identify the single biggest friction point
- Suggest one change that would help most
```

#### Session 1: Core Context Injection (After Phase 1 fixes)

**Goal:** Validate that Workflow 1 (Contextual Research Branching) works end-to-end.

**Script:**
1. Start with empty canvas
2. Create a Note with some content (3-4 paragraphs about a topic you actually care about)
3. Create a Conversation node
4. Connect the Note to the Conversation
5. Open the chat and ask a question that requires the note's content
6. **Critical checkpoint:** Did the AI reference your note content? Did you know it would?
7. Create a second Conversation, connect the same Note
8. Ask a different question. Does the context carry over?

**What to report to Claude:**
- Could you tell context was injected? How?
- Did the connection direction matter? Was that clear?
- Was anything confusing about the edge creation?
- Rate: How long from "I want to do this" to "it worked"?

#### Session 2: AI Editor Pipeline (After Phase 1 fixes)

**Goal:** Validate that Workflow 4 (Idea Explosion) works via all 3 entry points.

**Script:**
1. Create a Note with a thesis
2. Try `/` (InlinePrompt) → "Generate 3 related notes"
3. Try `Ctrl+E` (AIEditorModal) → "Organize these nodes in a grid"
4. Try `Ctrl+Shift+A` (AISidebar) → "Add a task to review these"

**What to report to Claude:**
- Which entry point felt most natural?
- Did the plan preview make sense?
- Did "Apply" work? Did the result match your expectation?
- Were ghost nodes helpful or confusing?

#### Session 3: Action Node Automation (After Phase 2 fixes)

**Goal:** Validate that Workflow 5 (Automated Task Triage) works.

**Script:**
1. Create an Action node
2. Try to configure a `node-created` trigger for tasks
3. Create a test Task node
4. Watch if the Action fires

**What to report to Claude:**
- Was the trigger configuration UI clear?
- Could you tell the Action was "armed" and ready?
- When it fired, was there feedback? Did you see it happen?
- Could you debug if it didn't work?

#### Session 4: Full Workflow Chain (After Phase 4)

**Goal:** Attempt Workflow 6 (Context Chain Deep Dive) as a real task.

**Script:**
1. Pick a real analysis you need to do (not a toy example)
2. Build the chain: Conversation → Note → Conversation → Note → Conversation
3. Use it for 15-20 minutes of actual work

**What to report to Claude:**
- At what point did it feel powerful vs cumbersome?
- Did context depth work as expected?
- Would you use this again for real work?
- What's the single thing that would make you use this daily?

### How Claude Helps During Testing

During each session, tell Claude:
- **"Starting Session N"** — Claude loads the workflow expectations
- **"Step X: I see [description]"** — Claude compares to expected behavior
- **"This feels [adjective]"** — Claude probes for specifics
- **"Done with Session N"** — Claude produces a structured test report

After each session, Claude will:
1. Summarize findings as a structured report
2. Categorize issues: Bug / UX Friction / Missing Feature / Works Great
3. Prioritize next fixes based on what you experienced
4. Update this roadmap document with real-world findings

### Testing Cadence

| When | What to Test | Success Criteria |
|------|-------------|-----------------|
| After Phase 1 (26 fixes) | Sessions 1 + 2 | Context injection works, AI Editor applies plans |
| After Phase 2 (gaps 1-3) | Session 1 again | Onboarding guides you, context flow visible |
| After Phase 4 (feature gaps) | Sessions 3 + 4 | Action nodes fire, full chain works for real work |
| After Phase 5 (architecture) | Stress test | 50+ nodes, no lag, no crashes |

---

## Part 4: Success Metrics

### Vision Alignment Trajectory

| Phase | Score | Key Milestone |
|-------|-------|--------------|
| Current state | 4/10 | Looks complete, silently broken |
| After Phase 1 (26 fixes) | 6/10 | Everything works, hard to discover |
| After Phase 2 (critical gaps) | 7/10 | Discoverable, guided, visual feedback |
| After Phase 3 (user testing 1) | 7.5/10 | Real friction points identified and queued |
| After Phase 4 (feature gaps) | 8/10 | Full workflow support, search, forking |
| After Phase 5 (architecture) | 8.5/10 | Stable, tested, maintainable |
| After Phase 7 (polish) | 9/10 | Production-ready for daily use |

### "Can't Go Back" Indicators

The product is succeeding when:
- [ ] User creates 3+ conversations connected to the same note (Workflow 1)
- [ ] User builds a context chain 3+ levels deep (Workflow 6)
- [ ] User saves a custom template from their own workflow (Workflow 7)
- [ ] User says "I can't do this in ChatGPT" unprompted
- [ ] User's workspace has 20+ nodes after 1 week of use
- [ ] User updates a source note and sees AI reference the update in a connected conversation

---

*Created: 2026-02-06*
*Companion to: docs/qa/AUDIT_RESULTS.md (26 issues, 11 gaps)*
*Next action: Fix Phase 1 issues, then begin User Testing Session 1*
