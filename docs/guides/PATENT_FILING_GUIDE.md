# Provisional Patent Filing Guide — Cognograph

> **COMPLETE — All 4 provisionals filed 2026-02-10**
> **Applications:** 63/979,198 (P1), 63/979,201 (P2), 63/979,203 (P3), 63/979,205 (P4)
> **Total cost:** $260 ($65 x 4, micro entity). Priority date: Feb 10, 2026.
>
> **For Stefan Kovalik — First-Time Filer**
>
> This guide walks you through filing 4 provisional patent applications
> for Cognograph's core innovations. Written so any future Claude session
> can pick this up and help you.
>
> **Filing Cost:** $60 per application × 4 = **$240 total** (micro entity)
> **Time Required:** 4-8 hours for document prep, 30 min per filing
> **Deadline:** File BEFORE any public release (GitHub, blog post, demo)
>
> **Last Updated:** 2026-02-10

---

## Table of Contents

1. [Why Provisional Patents](#1-why-provisional-patents)
2. [Micro Entity Qualification](#2-micro-entity-qualification)
3. [What You Need Before Filing](#3-what-you-need-before-filing)
4. [The 4 Patent Claims](#4-the-4-patent-claims)
5. [Writing the Specification (The Hard Part)](#5-writing-the-specification)
6. [Required Forms & Documents](#6-required-forms--documents)
7. [Step-by-Step Filing on USPTO Patent Center](#7-step-by-step-filing)
8. [After Filing](#8-after-filing)
9. [Common Mistakes to Avoid](#9-common-mistakes)
10. [Timeline & Next Steps](#10-timeline--next-steps)
11. [Reference Links](#11-reference-links)

---

## 1. Why Provisional Patents

A provisional patent application (PPA) does three things:

1. **Establishes a priority date** — proves you invented this on THIS date
2. **Gives you 12 months** to file the full (nonprovisional) patent
3. **Lets you say "Patent Pending"** — legal protection for public release

**Critical:** The USPTO does NOT review provisionals for patentability. They just
file them and give you a receipt. The real examination happens when you file the
full patent later. This means:
- You can write them yourself (no lawyer required for provisionals)
- They need to be thorough but don't need to be perfect legal language
- The key requirement is **enough technical detail that someone in the field
  could build it from your description**

**The 12-Month Clock:** Once filed, you have exactly 12 months to file a
nonprovisional (full) patent application. If you miss this deadline, the
provisional expires and you lose your priority date. No extensions. No refunds.

---

## 2. Micro Entity Qualification

You likely qualify for **micro entity** status, which gives you an **80% discount**
on filing fees ($60 instead of $300 per provisional).

### Requirements (ALL must be true)

- [ ] **Small Entity:** You are an individual inventor (not employed by a large company)
- [ ] **Application Limit:** You have been named as inventor on 4 or fewer previously
  filed patent applications (if this is your first, you qualify ✅)
- [ ] **Gross Income Limit:** Your gross income in the previous calendar year (2025)
  did not exceed **$251,190**
- [ ] **No Assignment to Large Entity:** You have not assigned/licensed the invention
  to any person or entity that exceeds the gross income limit

### How to Certify

You'll fill out **Form PTO/SB/15A** (Certification of Micro Entity Status — Gross
Income Basis) for each application. It's a simple checkbox form.

**Download:** https://www.uspto.gov/sites/default/files/documents/sb0015a.pdf

---

## 3. What You Need Before Filing

### Account Setup (Do This First)

1. **Create a USPTO.gov account**
   - Go to: https://patentcenter.uspto.gov
   - Click "Create Account" or sign in with existing login.gov credentials
   - You need a login.gov account (free, takes 5 min)

2. **Customer Number** (optional but helpful)
   - Not required for provisionals
   - Gets assigned automatically when you file

### Documents Needed Per Application

Each of the 4 provisional applications needs:

| Document | Format | Required? |
|----------|--------|-----------|
| **Specification** (technical description) | PDF | YES |
| **Drawings/Diagrams** | PDF | Recommended |
| **Cover Sheet** (Form SB/16) | PDF | YES |
| **Micro Entity Certification** (Form SB/15A) | PDF | YES |
| **Application Data Sheet** (Form ADS) | PDF | YES |
| **Fee Payment** | Credit card | YES ($60) |

### Forms to Download Now

1. **SB/16** — Provisional Application Cover Sheet
   https://www.uspto.gov/sites/default/files/documents/sb0016.pdf

2. **SB/15A** — Micro Entity Certification (Gross Income Basis)
   https://www.uspto.gov/sites/default/files/documents/sb0015a.pdf

3. **ADS** — Application Data Sheet
   https://www.uspto.gov/sites/default/files/documents/aia0014.pdf

---

## 4. The 4 Patent Claims

### Patent 1: Graph-Based Context Injection for AI Conversations

**Title:** "System and Method for Automatic Context Construction via Graph
Traversal in AI-Assisted Spatial Workspaces"

**What's Novel:**
- User creates visual connections (edges) between nodes on a spatial canvas
- When AI is invoked in any node, the system automatically traverses the graph
  to build contextual prompt content
- BFS traversal on inbound edges (+ bidirectional) with configurable depth limits
- Different node types contribute different context categories (conversation
  history, reference material, task constraints, project scope)
- Edge properties (direction, weight/strength) determine traversal priority
- Token budget management dynamically allocates context space per category
- The user's act of organizing their workspace IS the act of configuring AI context

**Key Codebase References (for specification writing):**
- `src/renderer/src/stores/workspaceStore.ts` — `getContextForNode()` function
- `src/renderer/src/utils/contextBuilder.ts` — context building logic
- `src/shared/types.ts` — NodeData, EdgeData type definitions
- `ARCHITECTURE.md` — Context injection documentation

**Drawings to Include:**
- Diagram of nodes with edges showing context flow direction
- Flowchart of BFS traversal algorithm
- Before/after showing how connecting a Note to a Conversation changes the AI prompt
- Token budget allocation diagram

---

### Patent 2: Spatial Canvas as AI Orchestration Configuration

**Title:** "System and Method for Configuring AI Agent Orchestration via
Spatial Arrangement on a Visual Canvas"

**What's Novel:**
- AI agent nodes placed on a spatial canvas where their connections
  and spatial arrangement define the orchestration configuration
- Agent roles are determined by their edge connections to context nodes
- Work flows through typed edges between agent nodes
- Spatial proximity can determine coordination priority
- Real-time reconfiguration by dragging nodes and reconnecting edges
- No code, CLI, or configuration files needed — the visual layout IS the config
- The orchestration graph is simultaneously the visual representation AND
  the execution model

**Key Codebase References:**
- `docs/specs/steve-implementation-roadmap.md` — orchestration plans
- `docs/specs/ralph-loop-outputs/block4-whatif-autonomous.md` — autonomous agent specs
- `docs/specs/ralph-loop-outputs/block8-system-evolution-core.md` — platform evolution
- `src/shared/types.ts` — Node type system (extensible to agent types)

**Drawings to Include:**
- Canvas screenshot showing agent nodes connected to context nodes
- Diagram comparing CLI orchestration (Gas Town) vs visual orchestration (Cognograph)
- Sequence diagram showing how a user builds an orchestration by placing and connecting nodes
- Example: Research agent connected to 3 Notes → Writer agent connected to Style Guide → Reviewer

---

### Patent 3: Context-Aware Workspace Automation via Spatial Triggers

**Title:** "System and Method for Triggering Automated AI Workflows Based on
Spatial Events in a Visual Workspace"

**What's Novel:**
- Automation rules triggered by spatial events on a canvas:
  - Node enters a defined spatial region
  - Two nodes come within proximity threshold
  - Cluster of N nodes forms in a region
  - Node exits a region
- Combined with property-change triggers propagating through edges
- Spatial regions as first-class workspace objects with configurable behaviors
- The canvas position of a node is a trigger condition (not just metadata)

**Key Codebase References:**
- `src/shared/types.ts` — AutomationTrigger, SpatialRegion types
- `docs/specs/ralph-loop-outputs/block1-automation-part1.md` — automation specs
- `docs/specs/ralph-loop-outputs/block1-spatial-semantics-part1.md` — spatial semantics

**Drawings to Include:**
- Diagram showing spatial regions on canvas with trigger zones
- Flowchart: node dragged into region → trigger fires → AI action executes
- Example: "Research Zone" region that auto-summarizes any Note dragged into it
- Comparison to traditional automation (IFTTT/Zapier) showing spatial dimension

---

### Patent 4: Plan-Preview-Apply Workflow for AI Workspace Manipulation

**Title:** "System and Method for Streaming AI-Generated Workspace Modification Plans
with Interactive Preview and Conversational Refinement"

**What's Novel:**
- AI generates a plan of workspace modifications streamed in real-time
- Preview system renders "ghost nodes" and "movement paths" showing
  what the plan will do BEFORE execution
- User can conversationally refine the plan ("make them smaller",
  "connect those two", "add one more") with streaming re-preview
- Atomic application of the plan with per-operation undo capability
- Multi-modal plan operations: create nodes, move nodes, create edges,
  update properties, delete elements — all in a single streamed plan
- The plan itself is a data structure (array of operations) that can be
  saved, shared, and re-applied as a template

**Key Codebase References:**
- `src/renderer/src/stores/aiEditorStore.ts` — plan state management
- `src/renderer/src/utils/mutationExecutor.ts` — plan execution (two-pass: create then update)
- `src/renderer/src/utils/previewBuilder.ts` — preview rendering
- `docs/specs/ralph-loop-outputs/block7-component-spec-ui.md` — UI specs

**Drawings to Include:**
- Sequence diagram: User prompt → streaming plan → ghost preview → refinement → apply
- Canvas screenshot with ghost nodes (semi-transparent) showing planned changes
- Before/after showing plan application
- Undo stack diagram showing per-operation rollback

---

## 5. Writing the Specification (The Hard Part)

### Structure of Each Specification

```
TITLE OF THE INVENTION
[2-7 words, descriptive]

FIELD OF THE INVENTION
[1-2 sentences: what technical field this belongs to]

BACKGROUND OF THE INVENTION
[What problem exists? What's the current state of the art?
Do NOT describe your solution here — just the problem.]

SUMMARY OF THE INVENTION
[Brief overview of what your invention does differently.
This is the "elevator pitch" version.]

BRIEF DESCRIPTION OF THE DRAWINGS
[List each figure with a one-line description]

DETAILED DESCRIPTION OF THE INVENTION
[THE MAIN EVENT — This is where you describe everything.
Write this like a very detailed technical blog post.
Include:
- System architecture
- Data structures
- Algorithms / processes (step by step)
- Alternative implementations ("in another embodiment...")
- User interaction flow
- How each component connects to the others
Think: "Could a skilled developer build this from my description alone?"]

CLAIMS (Optional but Recommended for Provisionals)
[Numbered list of what you're claiming is novel.
Each claim starts broad, subsequent claims narrow.
Example:
1. A method for constructing AI prompt context comprising...
2. The method of claim 1, wherein the traversal uses BFS...
3. The method of claim 2, further comprising token budget management...]
```

### Tips for Software Patent Specifications

1. **Focus on the PROCESS, not the code** — Describe what the system does step by step,
   not the TypeScript implementation

2. **Use "in one embodiment" language** — This broadens your coverage:
   - "In one embodiment, the traversal uses breadth-first search..."
   - "In another embodiment, depth-first traversal may be employed..."

3. **Include alternatives** — Describe multiple ways each component could work:
   - "The spatial canvas may be implemented as a 2D surface or a 3D environment..."
   - "Edge properties may include weight, direction, type, or any combination thereof..."

4. **Be specific about the novel parts** — The graph traversal for context injection is
   novel. The fact that you're using React is not. Focus your detail on what's new.

5. **Reference your existing documentation** — Your Ralph Loop outputs, specs, and
   architecture docs contain extensive detail. Reorganize that content into patent
   specification format.

6. **Include flowcharts and diagrams** — These count as part of the specification and
   can convey complex processes more clearly than text.

### Leveraging Existing Docs

You have EXTENSIVE documentation that can be reorganized into specifications:

| Patent | Source Documents |
|--------|----------------|
| Patent 1 (Context) | `ARCHITECTURE.md`, `contextBuilder.ts`, Ralph Loop block1-context-injection-*.md |
| Patent 2 (Orchestration) | `VISION.md`, `NORTH_STAR.md`, Ralph Loop block4, block6, block8 |
| Patent 3 (Spatial Triggers) | Ralph Loop block1-automation-*.md, block1-spatial-semantics-*.md |
| Patent 4 (Plan-Preview) | `aiEditorStore.ts`, `mutationExecutor.ts`, Ralph Loop block7-component-spec-*.md |

**In a future Claude session:** Ask Claude to read these docs and draft the specification
sections. Provide this guide as context so it knows the format.

---

## 6. Required Forms & Documents

### Per Application Checklist

- [ ] **Specification PDF** — Your written description (see Section 5)
- [ ] **Drawings PDF** — Diagrams, flowcharts, screenshots
- [ ] **Cover Sheet (SB/16)** — Fill in:
  - Title of Invention
  - Inventor name: Stefan Kovalik
  - Address
  - Check "Provisional Application for Patent"
  - Correspondence address
- [ ] **Micro Entity Certification (SB/15A)** — Check all boxes, sign
- [ ] **Application Data Sheet (ADS)** — Fill in:
  - Application type: Provisional
  - Inventor info (name, address, citizenship)
  - Applicant info (same as inventor for solo filer)
  - Correspondence info

### Form Fill-In Quick Reference

**Your info for all forms:**
- Inventor: Stefan Kovalik
- Address: [Your SF address]
- Email: [inventor email]
- Citizenship: US
- Entity Status: Micro Entity
- Application Type: Provisional

---

## 7. Step-by-Step Filing on USPTO Patent Center

### Step 1: Go to Patent Center
- URL: https://patentcenter.uspto.gov
- Log in with your login.gov credentials

### Step 2: Start New Application
- Click **"New submission"**
- Select **"Patent"**
- Select **"Provisional"**

### Step 3: Upload Documents
Upload in this order:
1. Specification (PDF)
2. Drawings (PDF)
3. Cover Sheet SB/16 (PDF)
4. Micro Entity Certification SB/15A (PDF)
5. Application Data Sheet ADS (PDF)

### Step 4: Pay Fee
- Select **Micro Entity** when asked about entity status
- Fee: **$60** per application
- Pay by credit card, deposit account, or EFT

### Step 5: Submit
- Review all documents
- Click Submit
- **SAVE YOUR CONFIRMATION NUMBER AND RECEIPT**
- You'll receive an email confirmation with your application number

### Step 6: Repeat for Each Patent
- File all 4 as separate applications
- Each gets its own application number
- Total: 4 × $60 = $240

---

## 8. After Filing

### Immediately After

- [ ] Save all confirmation emails
- [ ] Save all receipts
- [ ] Record application numbers in a secure document
- [ ] Save copies of everything you filed

### Create a Tracking Document

```markdown
# Cognograph Patent Portfolio

## Applications Filed

### Patent 1: Graph-Based Context Injection
- Application #: [from receipt]
- Filed: 2026-02-10
- Title: "System and Method for Automatic Context Construction via Graph Traversal..."
- Nonprovisional deadline: 2027-02-10
- Status: Filed

### Patent 2: Spatial Canvas Orchestration
- Application #: [from receipt]
- Filed: 2026-02-10
- ...

### Patent 3: Spatial Trigger Automation
- Application #: [from receipt]
- Filed: 2026-02-10
- ...

### Patent 4: Plan-Preview-Apply
- Application #: [from receipt]
- Filed: 2026-02-10
- ...

## Key Dates
- Provisionals filed: 2026-02-10
- 12-month deadline for nonprovisionals: 2027-02-10
- 6-month check-in: 2026-08-09
```

### Within 12 Months

You need to either:
1. **File nonprovisional applications** ($800 micro entity each) — usually with a patent attorney
2. **Decide not to pursue** — provisionals expire, no further cost
3. **File PCT (international)** if you want protection outside the US

**Budget for nonprovisionals:** Plan for $5,000-$15,000 per patent if using an attorney.
Some patent attorneys offer flat-rate packages for software patents.

### You Can Now Legally Say

- "Patent Pending" on your website, app, and materials
- Reference in investor conversations
- Include in press releases

---

## 9. Common Mistakes to Avoid

### CRITICAL: File BEFORE Going Public

- **Do NOT** push to public GitHub before filing
- **Do NOT** publish blog posts describing the inventions before filing
- **Do NOT** demo publicly before filing
- US has a 1-year grace period for your own public disclosures, BUT:
  - Other countries do NOT — public disclosure before filing kills international rights
  - The grace period is a safety net, not a strategy
  - **File first, publish second. Always.**

### Specification Mistakes

- **Too vague:** "The system uses AI to help users" — not enough detail
- **Too narrow:** Only describing one exact implementation — include alternatives
- **Missing diagrams:** Flowcharts and architecture diagrams strengthen your filing
- **Not describing the problem:** The Background section must explain WHY this is needed
- **Forgetting embodiments:** Always include "in another embodiment..." alternatives

### Filing Mistakes

- **Wrong entity status:** If you select "Large Entity" by accident, you pay 5x more
- **Missing forms:** Each application needs the cover sheet, micro entity cert, AND ADS
- **Not saving receipts:** You need proof of filing date
- **Filing one big application:** File each invention SEPARATELY for broader protection

---

## 10. Timeline & Next Steps

### Today (2026-02-10)

| Time | Action |
|------|--------|
| **Now** | Create USPTO/login.gov account |
| **1 hour** | Download and fill out forms (SB/16, SB/15A, ADS) × 4 |
| **2-6 hours** | Write specifications (leverage existing docs) |
| **30 min** | Create diagrams for each patent |
| **30 min × 4** | File all 4 on Patent Center |
| **Done** | Save receipts, record application numbers |

### This Week

- [ ] Write the manifesto / positioning blog post (NOW you can reference "Patent Pending")
- [ ] Push to GitHub (AGPL-3.0)
- [ ] Start telling people

### This Month

- [ ] Consider hiring a patent attorney for a portfolio review ($500-$1000)
- [ ] They can advise on which provisionals are strongest
- [ ] Start planning nonprovisional strategy

### Month 6 (August 2026)

- [ ] Evaluate which patents to convert to nonprovisional
- [ ] Engage patent attorney if proceeding
- [ ] Begin nonprovisional drafting

### Month 12 (February 2027)

- [ ] **HARD DEADLINE** — File nonprovisionals or let provisionals expire
- [ ] No extensions possible

---

## 11. Reference Links

### USPTO Official

- [Provisional Application Overview](https://www.uspto.gov/patents/basics/apply/provisional-application)
- [Patent Center (File Here)](https://patentcenter.uspto.gov)
- [Fee Schedule (Current)](https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule)
- [Micro Entity Status](https://www.uspto.gov/patents/laws/micro-entity-status)
- [Save on Fees](https://www.uspto.gov/patents/apply/save-on-fees)

### Forms (Download These)

- [SB/16 — Provisional Cover Sheet](https://www.uspto.gov/sites/default/files/documents/sb0016.pdf)
- [SB/15A — Micro Entity Certification](https://www.uspto.gov/sites/default/files/documents/sb0015a.pdf)
- [ADS — Application Data Sheet](https://www.uspto.gov/sites/default/files/documents/aia0014.pdf)

### Guidance

- [USPTO: Filing a Provisional Application (PDF)](https://www.uspto.gov/sites/default/files/documents/Basics%20of%20a%20Provisional%20Application.pdf)
- [USPTO: Drafting a Provisional Application (PDF)](https://www.uspto.gov/sites/default/files/documents/provisional-applications-6-2023.pdf)
- [LegalZoom 2026 Provisional Guide](https://www.legalzoom.com/articles/provisional-patent-application-guide)
- [Provisional Patent Template (GitHub)](https://github.com/deftio/provisional-patent-template)
- [How to Patent Software (Step-by-Step)](https://arapackelaw.com/patents/how-to-patent-software/)

### Cognograph Source Docs (For Specification Writing)

| Patent | Primary Source |
|--------|---------------|
| All | `ARCHITECTURE.md`, `docs/strategy/VISION.md` |
| Patent 1 | `src/renderer/src/utils/contextBuilder.ts`, Ralph Loop block1-context-injection-*.md |
| Patent 2 | `docs/strategy/NORTH_STAR.md`, Ralph Loop block4-whatif-autonomous.md, block6-*.md |
| Patent 3 | Ralph Loop block1-automation-*.md, block1-spatial-semantics-*.md |
| Patent 4 | `src/renderer/src/stores/aiEditorStore.ts`, Ralph Loop block7-component-spec-*.md |

---

## Quick Reference Card

```
USPTO Patent Center:  https://patentcenter.uspto.gov
Entity Status:        Micro Entity ($60/filing)
Form SB/16:          Provisional Cover Sheet
Form SB/15A:         Micro Entity Certification
Form ADS:            Application Data Sheet

Total Cost:          4 × $60 = $240
Total Applications:  4 (file separately)
Clock:               12 months from filing to nonprovisional

ORDER OF OPERATIONS:
1. Write specs + diagrams
2. Fill out forms
3. File on Patent Center
4. Save receipts
5. THEN go public (GitHub, blog, demo)
```

---

*Document: Provisional Patent Filing Guide*
*Author: Claude (research + synthesis for Stefan Kovalik)*
*Created: 2026-02-10*
*Status: Ready to execute*

**IMPORTANT DISCLAIMER:** This guide is educational, not legal advice. For
complex patent strategy, consult a registered patent attorney. For provisional
filings of this nature, self-filing is common and reasonable, but a 30-minute
consultation ($100-$300) with a patent attorney can provide peace of mind.
