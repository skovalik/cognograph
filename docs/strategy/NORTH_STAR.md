# North Star: The 3D Agentic Desktop

> This document captures the long-term vision beyond Cognograph. It's aspirational — a direction to build toward, not a spec to implement tomorrow. Cognograph is the proving ground for these ideas.

---

## The Vision

**A 3D spatial operating environment where:**

- Your desktop is a **viewport into a persistent 3D world** (default: a void)
- Everything exists as **objects in space** — files, apps, conversations, notes, projects
- **Physical depth represents attention** — the active window is in sharp focus, background elements blur
- Navigation is **canvas-like** (pan, zoom, fly) not tree-like (folders, hierarchies)
- An **AI agent is the primary interface** — a persistent chat that controls and navigates everything
- **Spatial relationships have meaning** — things near each other share context

This is the desktop metaphor reimagined for spatial thinkers and AI-native interaction.

---

## The Inspiration

### Her (2013)
The film captured ambient AI interaction:
- The AI is always present, not "launched"
- Conversational navigation: "Show me the photos from last week"
- No chrome, no windows — just voice and presence
- The AI understands context from the environment

### What Her implied but didn't show
- The visual/spatial layer where information lives
- How you'd navigate without voice
- How context and relationships would be represented

This vision adds that missing layer.

---

## Core Concepts

### 1. Space as Organization

**Today's desktop:**
```
Documents/
├── Work/
│   ├── Projects/
│   │   ├── Q1/
│   │   │   └── report.docx
```

**3D desktop:**
```
[3D void]
    [Q1 Report] ← floating nearby, connected to...
          ↓
    [Q1 Project zone] ← a region containing related items
          ↓
    [Work area] ← larger region in the world
```

You navigate by moving through space, not clicking through trees.

### 2. Depth as Focus

- **Foreground (sharp):** Active window, current task
- **Midground (slightly blurred):** Related items, recent context
- **Background (blurred):** Everything else, ambient awareness

This mimics natural human vision and attention. Your peripheral vision sees that other things exist without demanding attention.

### 3. The AI as Navigator

The primary chat interface doesn't just answer questions — it controls the environment:

> "Show me everything related to the Henderson project"
> *Environment reorganizes, Henderson items float forward, others recede*

> "Put this conversation near my research notes"
> *Node moves spatially, creating implicit relationship*

> "What's in the distance behind me?"
> *Camera rotates, AI describes what's there*

### 4. Objects, Not Apps

Instead of:
- Open Chrome → navigate to site → find tab
- Open Finder → navigate folders → find file
- Open Notes → search → find note

Everything is an **object in space**:
- Websites are objects you can place
- Files are objects you can arrange
- Conversations are objects that persist
- Apps are objects that do things

The OS distinction between "files" and "apps" dissolves.

---

## How Cognograph Leads Here

Cognograph is a **2.5D prototype** of these ideas, scoped to AI workflows:

| Cognograph (Now) | 3D Desktop (Future) |
|------------------|---------------------|
| 2D canvas | 3D world |
| Nodes | Objects |
| Edges | Spatial proximity + explicit links |
| Chat panel | Ambient AI interface |
| Context injection | AI sees spatial context |
| Projects | Zones/regions |
| React Flow | Three.js / WebGPU |

If spatial organization works for AI conversations, it validates the broader vision.

---

## Technical Path

### Phase 1: Cognograph MVP (Current)
- 2D canvas with nodes and edges
- AI chat with context injection
- Local persistence
- Prove that spatial AI workflows resonate

### Phase 2: Cognograph 3D Experiment
- Add optional Three.js layer
- Same nodes, rendered in 3D space
- Depth-of-field blur based on z-position
- Camera navigation (orbit, pan, fly)
- Toggle between 2D and 3D views
- **Goal:** Feel the concept, learn what works

### Phase 3: Cognograph 3D Native
- 3D becomes the primary view
- Full spatial navigation
- AI can manipulate the 3D environment
- Performance optimization
- **Goal:** Daily-drivable 3D AI workspace

### Phase 4: Beyond Cognograph
- General-purpose spatial desktop
- File system integration
- App embedding
- OS-level hooks
- **Goal:** Replace the traditional desktop

---

## Why Previous 3D Desktops Failed

| Product | Why It Failed | How We're Different |
|---------|--------------|---------------------|
| Windows 3D Flip (Vista) | Gimmick, no utility | Spatial arrangement has functional meaning (context) |
| BumpTop | Fun but not productive | AI agent makes navigation effortless |
| VR Desktops | Isolation, fatigue, input friction | Screen-based, not VR. Keyboard/mouse still work |
| macOS Exposé/Spaces | 2D grid, not true spatial | True 3D with depth and persistence |

They added 3D as a visual effect. We add 3D as an **organizational paradigm**.

---

## Open Questions

1. **Input methods** — How do you navigate 3D efficiently with keyboard/mouse? (WASD? Click-drag? Gesture?)

2. **Spatial memory** — Can people remember where they put things in 3D? (Research suggests yes — "memory palace" effect)

3. **Density** — How do you handle hundreds of objects without clutter? (LOD? Semantic clustering? AI-managed organization?)

4. **Transitions** — How do you zoom from "world view" to "focused work"? (Smooth camera animation? Discrete modes?)

5. **Collaboration** — In multiplayer, do people share the same 3D space? (Same positions? Personal viewpoints?)

---

## Aesthetic Direction

### The Void
- Default environment is empty space — not a room, not a sky
- Objects float in this void
- Subtle ambient lighting, no harsh shadows
- Color comes from the objects themselves

### Objects
- Clean, minimal shapes
- Subtle glow or outline for interactive elements
- Visual distinction by type (conversations, files, apps)
- No skeuomorphism (no fake 3D folders that look like real folders)

### Atmosphere
- Calm, focused, not overwhelming
- Inspired by: Her, Minority Report (UI only), Monument Valley
- NOT inspired by: Tron, Ready Player One, corporate VR

---

## Success Metrics (Long-Term)

If this vision works, we'd see:

1. **People prefer spatial navigation** — they stop using traditional file trees
2. **Context is implicit** — users don't have to explain context to the AI, it sees it
3. **Spatial memory works** — "I remember it was near my research stuff" becomes reliable
4. **Reduced cognitive load** — managing many threads feels easier
5. **AI feels ambient** — not a tool you use, an environment you inhabit

---

## Effort Estimates for 3D Layer in Cognograph

| Level | Effort | What You Get |
|-------|--------|--------------|
| **Toy prototype** | 2-3 days | Three.js scene, nodes as shapes in 3D, orbit camera, basic depth blur |
| **Playable prototype** | 1-2 weeks | Navigate, click nodes, toggle 2D/3D, looks decent |
| **Polished feature** | 4-6 weeks | Smooth transitions, performant, daily-usable |

**Recommendation:** Finish persistence first, then add toy 3D prototype to feel the concept.

---

## Next Steps

1. ✅ Document the vision (this file)
2. 🔲 Ship Cognograph MVP with persistence
3. 🔲 Add 3D prototype layer (toy version, ~2-3 days)
4. 🔲 Use it, feel it, learn what works
5. 🔲 Iterate based on actual experience

---

*"The best interface is no interface. The second best is space itself."*

---

*Last updated: 2025-01-13*
