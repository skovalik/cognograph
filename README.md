# Cognograph

**The gap between how you think and how AI tools expect you to think is the bottleneck. Not the models.**

You're managing context across dozens of tabs, re-explaining what the AI should already know, losing threads between conversations that should be connected. Every AI tool treats context as invisible plumbing. System prompts. Config files. Conversation history you can't see or organize.

Cognograph makes it spatial. Put your thinking on a canvas. Connect two nodes and the AI reads both. Your layout becomes your prompt engineering.

No system prompts. No config files. Drag, connect, talk.

<p align="center">
  <a href="https://cognograph.app/screenshots/03-workspace-overview.png"><img src="https://cognograph.app/screenshots/03-workspace-overview.png" alt="Cognograph workspace showing connected nodes with AI context flow" width="90%"></a>
</p>

**[Try it now](https://canvas.cognograph.app)** (browser) | Clone and run locally (Electron) | Patent pending

---

I'm a full-stack designer and developer with 15 years of experience and a BA in Cognitive Psychology. I have ASD and severe combined-type ADHD. Files in folders don't work for me. Linear chat doesn't work for me. I built the tool that does.

It's been my daily driver for months. Turns out spatial thinking isn't a neurodivergent workaround. It's how most people process complex information when given the option.

<p align="center">
  <a href="https://cognograph.app/screenshots/01-welcome.png"><img src="https://cognograph.app/screenshots/01-welcome.png" alt="Welcome screen" width="19%"></a>
  <a href="https://cognograph.app/screenshots/02-brand-guide-generation.png"><img src="https://cognograph.app/screenshots/02-brand-guide-generation.png" alt="Brand guide generation" width="19%"></a>
  <a href="https://cognograph.app/screenshots/04-canvas-desktop.png"><img src="https://cognograph.app/screenshots/04-canvas-desktop.png" alt="Desktop canvas" width="19%"></a>
  <a href="https://cognograph.app/screenshots/07-connected-notes.png"><img src="https://cognograph.app/screenshots/07-connected-notes.png" alt="Connected notes" width="19%"></a>
  <a href="https://cognograph.app/screenshots/08-fog-bean-brand.png"><img src="https://cognograph.app/screenshots/08-fog-bean-brand.png" alt="Multi-artifact brand" width="19%"></a>
</p>

---

## Context Injection Cuts Compute Cost Up to 80% in My Testing

When you connect nodes on the canvas, Cognograph walks the graph via breadth-first traversal and assembles only the relevant context for each AI call. Connected nodes become the AI's working memory. Notes become reference material, tasks become constraints, projects define scope. You send what matters, not everything.

By explicitly linking what's relevant instead of dumping entire conversation histories, you avoid hallucination-inducing bloat and dramatically reduce token usage. The spatial layout isn't decoration. It's a token optimization layer.

### Use Your Claude Account, Not an API Key

Terminal nodes spawn an embedded CLI where Claude Code runs with full MCP tool access to your canvas. Use your existing Claude Pro subscription. No separate API billing. Chat and Agent modes support API keys from Anthropic, OpenAI, Google, OpenRouter, and Ollama for direct calls. Three interaction modes, one canvas.

### Your Data Stays on Your Machine

No account required. No telemetry. Workspaces save as local JSON files. API keys are encrypted via your OS keychain, never sent to Cognograph servers. Run Ollama or any local LLM and keep everything fully air-gapped. The Electron app runs offline with zero server dependency.

---

## Quick Start

### Browser (no install)

Go to **[canvas.cognograph.app](https://canvas.cognograph.app)**. Your data stays in IndexedDB.

### Local (Electron)

```bash
git clone https://github.com/skovalik/cognograph.git
cd cognograph
npm install
npm run dev
```

Requires Node.js 20+. Bring your own API key, connect Ollama for local inference, or use Terminal mode with your Claude Pro account.

---

## How It Works

**9 node types, each unlocking something different:**

| Node | What It Enables |
|------|----------------|
| **Conversation** | Chat, Agent, or Terminal mode with context from every connected node |
| **Artifact** | 13 content types rendered live on canvas: HTML pages, 3D models, SVG, Mermaid diagrams, audio, video, code, markdown, JSON, CSV, images. Not raw code. The rendered output. |
| **Action** | Visual programming. 13 trigger types: proximity, region-enter, region-exit, cron schedules, property changes, connection events, cluster size. Position on the canvas IS the programming language. |
| **Orchestrator** | Multi-agent pipelines. 4 strategies: sequential, parallel, conditional, coordinator. Budget caps per agent. Canvas topology IS the execution graph. |
| **Note** | Persistent context. Modes: general, persona, page, component, content model, config. Connected notes become the AI's long-term memory. |
| **Task** | Status, priority, complexity, due dates. Connected tasks become agent constraints automatically. |
| **Project** | Scope boundaries with linked folders. File trees, extension filters. Everything inside inherits context. |

**Three ways to talk to AI:**

| Mode | What It Does | Best For |
|------|-------------|----------|
| **Chat** | Direct API call with canvas tools. Real-time token cost tracking. | Quick tasks, structured output |
| **Agent** | Autonomous multi-step execution with persistent memory across runs. | Complex workflows, batch operations |
| **Terminal** | Embedded CLI (Claude Code, Git Bash, PowerShell). MCP tools read the canvas. | Code, files, anything terminal |

All three read context from connected nodes. Switch between them mid-project.

---

## What Else It Does

- **Spatial Triggers.** 13 trigger types: proximity detection, region enter/exit, cron schedules, property changes, connection events, cluster size thresholds, child completion, ancestor changes, isolation detection. Drag a node into a zone, automation fires. No scripting required.
- **Plan-Preview-Apply.** AI proposes canvas mutations as ghost nodes you can see before committing. Accept or reject atomically. Undo 20 node operations with one Ctrl+Z.
- **Agent Memory.** Agents persist key-value memory across runs. An agent that researches your codebase today remembers what it found tomorrow.
- **Live Artifact Rendering.** 13 content types rendered directly on canvas: HTML with full CSS, SVG, Mermaid diagrams, 3D models (GLB/GLTF with Three.js), audio, video, code with syntax highlighting, markdown, JSON, CSV, images. Artifacts version-track up to 10 revisions.
- **Semantic Zoom.** Five levels that adapt automatically. Ultra-far: cluster shapes. Far: titles and badges. Mid: lede text. Close: full content. Ultra-close: expanded toolbar and property panels.
- **MCP Server.** Run `--mcp-server` and your entire knowledge graph becomes a tool that Claude Code and other agents can query, search, create nodes, and modify edges.

---

## What's Next

**Multiplayer.** Real-time collaboration via Hocuspocus (Y.js CRDT). The canvas becomes a shared workspace for teams. The infrastructure is built. UI polish is in progress.

---

## Architecture

| Layer | Technology |
|-------|------------|
| Desktop | Electron 35 |
| UI | React 18, TypeScript 5, Tailwind CSS 3 |
| Canvas | React Flow (@xyflow/react) v12 |
| State | Zustand + Immer (46+ stores) |
| Rich Text | TipTap with collaboration |
| AI | Anthropic SDK, OpenAI SDK, Google AI SDK, Claude Agent SDK |
| Terminal | xterm.js |
| 3D/Effects | Three.js, React Three Fiber |
| Sync | Yjs, Hocuspocus, Dexie (IndexedDB) |
| Build | electron-vite, Vite |
| Testing | Vitest (25,000+ test cases), Playwright (e2e) |

937 source files across 6 process layers. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

---

## Supported Providers

| Provider | Connection |
|----------|-----------|
| Anthropic | API key (Claude Sonnet, Opus, Haiku) |
| OpenAI | API key (GPT-4o, o1, o3) |
| Google Gemini | API key (Gemini Pro, Flash) |
| OpenRouter | API key (access to 100+ models) |
| Ollama | Local (llama, mistral, phi, any GGUF model) |
| Claude Pro | Via Terminal mode (your existing subscription) |

Each conversation can use a different provider. Set per-node or use workspace defaults.

---

## Patent Status

Patent pending (4 provisional applications, February 2026). Defensive Patent Pledge: Cognograph will not assert patents against any party unless that party first asserts patent claims against Cognograph, its users, or contributors.

The four families cover graph-based context assembly, spatial agent orchestration, position-based trigger activation, and transactional plan-preview-apply. These protect the community, not restrict it.

---

## Contributing

Contributions welcome. TypeScript throughout, strict types, Zustand state, React Flow canvas layer.

Start with [ARCHITECTURE.md](./ARCHITECTURE.md) for how the system works. [docs/guides/PITFALLS.md](./docs/guides/PITFALLS.md) covers the gotchas. Open an issue if you're not sure where to start.

---

## License

[AGPL-3.0](./LICENSE) with Defensive Patent Pledge.

Free for personal use. Commercial use requires a commercial license. [Contact me](mailto:stefan@aurochs.agency) for details.

If you distribute modified versions or run them as a network service, AGPL-3.0 requires you to release your source code under the same license.

---

**[aurochs.agency](https://aurochs.agency)** · stefan@aurochs.agency
