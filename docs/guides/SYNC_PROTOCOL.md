# Sync Protocol - Claude Instance Continuity

> This document defines how to maintain context when switching between Claude Code and Claude Chat. **The essential rules are embedded in CLAUDE.md - this file provides detailed rationale and edge cases.**

---

## The Problem

Claude Code (terminal) and Claude Chat (web) are separate instances. They don't share memory. Without a sync protocol, context is lost when switching between them.

## The Solution

Use documents as the shared memory layer:

| Document | Location | Purpose |
|----------|----------|---------|
| VISION.md | `docs/strategy/VISION.md` | Strategic context, business model, design philosophy |
| NORTH_STAR.md | `docs/strategy/NORTH_STAR.md` | Long-term 3D desktop vision |
| CLAUDE.md | Root | Technical architecture, build instructions, **session protocol** |
| TODO.md | Root | Task list, implementation phases |
| DECISIONS.md | Root | Decision log with rationale |
| CHANGELOG.md | Root | Work session summaries |

---

## Protocol for Claude Code

### On Session Start
1. Read `CLAUDE.md` (technical orientation + session protocol)
2. Read `docs/strategy/VISION.md` (strategic context)
3. Check `DECISIONS.md` (recent choices)
4. Check `CHANGELOG.md` (what was done recently)
5. Review `TODO.md` (current priorities)

### During Session
When making significant decisions:
1. Add entry to `DECISIONS.md` with rationale
2. Update `TODO.md` (check off completed, add new)

### On Session End
1. Add entry to `CHANGELOG.md` summarizing work done
2. Ensure any decisions are in `DECISIONS.md`
3. Note blockers or unfinished work

---

## Protocol for Claude Chat

### When User Returns
1. Ask about recent work if unclear
2. Check `CHANGELOG.md` for context
3. Review `DECISIONS.md` for recent choices

### When Discussing Strategy
1. Reference `docs/strategy/VISION.md`
2. Update if decisions change strategy

### When Handing Off to Claude Code
1. Remind user to commit any pending decisions to docs
2. Summarize what needs to be done in `TODO.md`

---

## What Goes Where

| Content | Document |
|---------|----------|
| "Why are we building this?" | `docs/strategy/VISION.md` |
| "Where is this going long-term?" | `docs/strategy/NORTH_STAR.md` |
| "How does the code work?" | `CLAUDE.md`, `ARCHITECTURE.md` |
| "What should we do next?" | `TODO.md` |
| "Why did we choose X over Y?" | `DECISIONS.md` |
| "What did we do yesterday?" | `CHANGELOG.md` |

---

## Sync Triggers

**Update `DECISIONS.md` when:**
- Choosing between technical approaches
- Changing business model
- Adding/removing features from scope
- Changing priorities

**Update `TODO.md` when:**
- Completing a task
- Adding a new requirement
- Reprioritizing

**Update `CHANGELOG.md` when:**
- Ending a work session
- Completing a milestone
- Encountering a blocker

**Update `docs/strategy/VISION.md` when:**
- Strategy changes
- New insights about users/market
- Pivoting direction

---

*Last updated: 2025-01-24*
