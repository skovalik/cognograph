# Cognograph Vision & Strategy

> This document captures the strategic context, design philosophy, and business goals for Cognograph. It should be read alongside ARCHITECTURE.md (technical) and FEATURES.md (capabilities). **Keep this document updated as decisions are made.**

---

## One-Liner

**Cognograph is a spatial canvas for AI workflow orchestration — "Google Wave meets Figma for AI conversations."**

---

## The Problem

Linear chat interfaces (ChatGPT, Claude.ai, Gemini) collapse under complexity:

- **No persistence of structure** — conversations are isolated silos
- **No visual relationships** — you can't see how ideas connect
- **No context sharing** — each conversation starts from zero
- **No branching** — you can't fork and explore alternatives
- **No orchestration** — managing multiple AI threads is manual

Power users who work with AI extensively end up with dozens of disconnected conversations, losing track of context, duplicating work, and unable to see the bigger picture.

---

## The Solution

A **spatial canvas** where AI conversations, notes, tasks, and projects exist as **nodes** that can be:

- **Positioned** — arrange spatially to show relationships
- **Connected** — edges link related nodes
- **Contextualized** — connected nodes automatically feed into AI prompts
- **Branched** — fork conversations at any point
- **Orchestrated** — see your entire AI workflow as a graph

### Core Insight

**The interface IS the organization.** By placing conversations on a canvas and connecting them, the user is simultaneously organizing their work AND building context for the AI.

---

## The Google Wave Connection

Google Wave (2009-2012) pioneered:
- Real-time collaborative threads
- Nested "blips" (messages within messages)
- Playback (see how a conversation evolved)
- Inline replies and branching

Wave failed because it was a solution without a clear problem. **AI workflow orchestration IS that problem.**

### Wave → Cognograph Mapping

| Wave Concept | Cognograph Equivalent |
|--------------|----------------------|
| Wave | Workspace |
| Blip | Node (Conversation, Note, Task) |
| Participants | Users + AI agents |
| Playback | Conversation history + node lineage |
| Inline replies | Context links between nodes |
| Real-time sync | Yjs CRDT (planned) |

### Why This Matters Strategically

Google has:
- **Gemini** — powerful AI, but linear chat interface
- **NotebookLM** — AI + documents, but not workflow-focused
- **Wave DNA** — the tech and concepts live on in Docs/Chat

They do NOT have a spatial AI orchestration layer. Neither does Anthropic or OpenAI.

---

## Target Users

### Primary: Spatial Thinkers
People who naturally organize ideas visually:
- Mind-mappers
- Whiteboard users
- People who prefer Miro/FigJam over linear docs

### Secondary: AI Power Users
People who use AI extensively and hit the limits of linear chat:
- Researchers managing multiple investigation threads
- Developers using AI for code across multiple features
- Writers working on complex projects with many angles
- Consultants juggling multiple client contexts

### Tertiary: Teams (Future)
Groups collaborating on AI-assisted work:
- Product teams doing research
- Design teams exploring concepts
- Engineering teams architecting systems

---

## Key Differentiators

### 1. Context Injection (Killer Feature)
When you chat in a Conversation node, content from **connected nodes** automatically feeds into the prompt:
- Connected Notes become system context
- Connected Projects provide scope
- Connected Conversations provide history

**This is the core innovation.** The spatial arrangement isn't just visual — it's functional.

### 2. Visual Workflow
See your AI work as a graph:
- Spot patterns and relationships
- Identify gaps in your thinking
- Navigate complex projects spatially

### 3. Provider Agnostic
Works with multiple AI providers:
- Claude (implemented)
- Gemini (planned)
- OpenAI (planned)
- Local models via Ollama (planned)

### 4. Local-First
Your data stays on your machine:
- No cloud dependency
- No subscription required for core features
- Privacy by default

---

## Design Philosophy

### 1. Solve Real Problems First
This is a tool built for daily use. Features are prioritized by real-world utility, not theoretical user value. If it doesn't solve actual workflow problems, it doesn't ship.

### 2. Working Software Over Plans
Prefer shipping something small that works over planning something big that doesn't exist. The spec phases (1-4) provided direction, but implementation reveals truth.

### 3. Spatial Thinking as First-Class
Every feature should respect the spatial metaphor. If something can't be represented as a node, edge, or canvas operation, question whether it belongs.

### 4. AI as Collaborator, Not Tool
The AI isn't just answering questions — it's participating in a workspace. Context injection means the AI "sees" the same structure the user sees.

### 5. Progressive Disclosure
Simple by default, powerful when needed:
- New users see a canvas with basic nodes
- Power users discover context injection, forking, orchestration
- No feature walls — everything is discoverable

---

## Business Model

### Philosophy: Generous Free Tier, Pay for Power Use

**Core principle:** Casual users should get a complete, unrestricted experience for free — including collaboration. Monetization comes from power users who use the tool heavily and need advanced capabilities.

**Why this approach:**
- Collaboration drives adoption (network effects)
- Restricting multi-user kills viral growth
- Power users have budget and willingness to pay
- Usage-based limits feel fair, feature gates feel arbitrary

### Licensing: Open Core (AGPL-3.0)
- Core functionality is open source
- Advanced integrations and hosted services are proprietary
- Allows community contribution while protecting commercial value

### Pricing Tiers

| Tier | Price | What You Get |
|------|-------|--------------|
| **Free** | $0 | Full app, unlimited workspaces, unlimited nodes, multiplayer/collaboration, local storage, all AI providers (BYOK) |
| **Pro** | $12/mo | Cloud sync across devices, version history (30 days), priority support, advanced export formats |
| **Power** | $29/mo | Unlimited version history, MCP integrations, automation/workflows, API access to your data, usage analytics |
| **Team** | $29/user/mo | Everything in Power + admin controls, shared workspace management, SSO, audit logs |

### What's Free vs Paid

| Feature | Free | Pro | Power |
|---------|------|-----|-------|
| Workspaces | ∞ | ∞ | ∞ |
| Nodes | ∞ | ∞ | ∞ |
| Collaboration/Multiplayer | ✅ | ✅ | ✅ |
| AI Providers (BYOK) | ✅ | ✅ | ✅ |
| Local storage | ✅ | ✅ | ✅ |
| Cloud sync | ❌ | ✅ | ✅ |
| Version history | ❌ | 30 days | ∞ |
| MCP integrations | ❌ | ❌ | ✅ |
| Automation/workflows | ❌ | ❌ | ✅ |
| API access | ❌ | ❌ | ✅ |
| Priority support | ❌ | ✅ | ✅ |

### Why This Works

1. **Free tier is genuinely useful** — no artificial limits that frustrate users
2. **Collaboration is free** — drives adoption, creates lock-in through shared workspaces
3. **Cloud sync is the natural upgrade** — once you love it locally, you want it everywhere
4. **Power features are for power users** — MCP, automation, API are advanced needs
5. **Teams pay for admin** — businesses need controls, audit logs, SSO

---

## Strategic Options

### Path A: Indie Product
Build → Launch → Get paying users → Sustainable business

**Pros:** Full control, recurring revenue, no pressure
**Cons:** Slower growth, limited resources

### Path B: Acquisition Target
Build → Get traction → Attract interest → Acqui-hire or acquisition

**Pros:** Potential big exit, resources to scale
**Cons:** Loss of control, low probability without significant traction

### Path C: Portfolio Project
Build → Document → Use as evidence of capability → Get hired

**Pros:** Near-certain outcome, salary + benefits
**Cons:** Not an exit, someone else owns the upside

### Current Strategy
**Start with Path A, keep Path B as an option.**

Build something genuinely useful. Ship it. Get users. If it gets traction, acquisition conversations become possible. If not, it's still a useful tool and impressive portfolio piece.

The Google Wave angle is good for marketing/narrative, but not a strategy for acquisition. Acqui-hires come from traction, not pitches.

---

## What Success Looks Like

### 3 Months (MVP)
- [ ] Persistence works — can close and reopen without losing work
- [ ] Context injection works — connected nodes feed into prompts
- [ ] Used daily for real work
- [ ] Markdown rendering makes Claude responses readable
- [ ] Can export conversations and workspaces

### 6 Months (Public Launch)
- [ ] Polished enough to share publicly
- [ ] Multiple AI providers (Claude + Gemini minimum)
- [ ] Search and navigation work well
- [ ] Documentation and onboarding exist
- [ ] Posted on Hacker News, Twitter, Reddit

### 12 Months (Traction)
- [ ] 1,000+ weekly active users
- [ ] Community forming (Discord, GitHub issues)
- [ ] Clear signal on whether this resonates
- [ ] Decision point: double down, pivot, or move on

---

## Open Questions

*Update this section as questions arise and get resolved.*

1. **Should Projects be visual containers or just connected nodes?**
   - Visual containers = more intuitive, but complex to implement
   - Connected nodes = simpler, but less obvious relationship
   - **Current lean:** Start with connections, add visual grouping later

2. **How should context injection be surfaced to users?**
   - Automatic (just works) vs explicit (user chooses what to include)
   - **Current lean:** Automatic with visibility ("Using context from: Note A, Project B")

3. **Should workspaces be single files or directories?**
   - Single JSON = simple, portable
   - Directory with assets = supports images, attachments
   - **Current lean:** Start with single JSON, migrate if needed

4. **What's the right level of AI provider abstraction?**
   - Thin wrapper (each provider has unique features)
   - Thick abstraction (uniform interface, lowest common denominator)
   - **Current lean:** Thin wrapper, expose provider-specific features

---

## Decision Log

*Record significant decisions here with date and rationale.*

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-01-13 | Free tier includes multiplayer/collaboration | Collaboration drives adoption. Monetize power users on cloud sync, version history, advanced integrations — not basic features. |
| 2025-01-13 | Build for personal use first, then share | Realistic path to traction. Dogfooding reveals real problems. |
| 2025-01-07 | Removed SQLite, using JSON for persistence | Native deps (better-sqlite3) require Visual Studio Build Tools. JSON is simpler for MVP. Can migrate later. |
| 2025-01-07 | Using React Flow's built-in state, not Zustand | React Flow's useNodesState/useEdgesState work well. Zustand adds complexity without clear benefit yet. |

---

## Spec Phase Summaries

The product was designed through 4 specification phases. Key points:

### Phase 1: Concept & Problem Definition
- Defined the problem space (linear chat limitations)
- Identified target users (spatial thinkers, AI power users)
- Established the "topographical HUD" metaphor

### Phase 2: User Experience
- Node types: Conversation, Project, Note, Task, Output, Action
- Interaction patterns: drag, connect, double-click to open
- Information architecture: Workspace → Canvas → Nodes

### Phase 3: Technical Architecture
- Electron + React + React Flow stack
- Local-first with optional cloud sync
- LLM abstraction layer for multi-provider support
- Yjs CRDT for future multiplayer

### Phase 4: Business Model
- Open Core licensing (AGPL-3.0)
- Freemium pricing (revised: generous free tier, pay for power features)
- Direct distribution first, app stores later

---

## Resources & References

- **Google Wave retrospectives:** Why it failed, what it got right
- **Figma architecture:** How they handle real-time canvas collaboration
- **Obsidian:** Local-first, plugin ecosystem, community building
- **Linear:** Opinionated product design, keyboard-first UX

---

*Last updated: 2025-01-13*
