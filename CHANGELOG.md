# Changelog

All notable changes to Cognograph are documented in this file.

## [0.3.0] - 2026-05-04

### Added

- **Unified perf-tier system** — Quality / Auto / Battery dropdown is now the single master switch for shader, edge LOD, particles, ambient effects, and bridge badges. Auto mode resolves from zoom level, FPS, and node count; Quality wins overrides; Battery clamps everything down.
- **PerfTierBadge** — surfaces the active tier + reason (zoom / FPS / node-count threshold) + override hint when not at full quality.
- **Per-node LLM context window default raised 4096 → 16384** — 4× larger conversations per node.
- **Opus 4.7 support** — managed-models list, token pricing, and SDK default updated for the latest Claude model.
- **Auto-seeded model connectors** — Haiku, Sonnet, and Opus connectors automatically configured on first run, no manual setup.
- **Docker-based sandbox surface** — `dockerSandbox` service with an allowlist contract for terminal-node command execution.
- **AutoUpdater signature verification** — `cosign verify-blob` runs against any candidate update before it's applied; verification failure aborts the update path.
- **SLSA-grade build provenance** — cosign keyless workflow + Ed25519 signer + per-platform manifest verifier in the release pipeline.
- **End-to-end observability** — Sentry integration wired across all 4 processes (main, preload, renderer, agent) with privacy-aware helper routing (PII redaction, fetch-URL scrubbing, replay text/media masking, production-only enable).
- **OpenTelemetry instrumentation** — distributed tracing on agent + MCP calls.
- **Session cost cap** — per-session budget limit wired into the agent loop to prevent runaway spending.
- **Diagnostic server with session boot ID** — boot-ID rewire for crash session correlation and multi-process trace linking.
- **Animated thinking-dot loader** — conic-gradient progress indicator replaces the inline spinner.
- **CLI thinking animation** — terminal spinner detection + animated thinking ring in CLI output (3-gap conic spinner).
- **Global theme broadcast to artifacts** — HTML artifact iframes receive theme changes dynamically (matching preset colors, not just dark/light mode).
- **Conic spinner palette** — spinner colors driven by global theme for visual consistency.
- **Cohesive ANSI color palette** — preset theme with custom yellow/magenta combination + CSS-var cursor guard.
- **Syntax highlighting for artifacts** — code/markdown artifacts render with language-specific syntax coloring.
- **Chat toolbar redirection** — toolbars redirect to chat bar with selection glow on F4 activation.
- **Terminal node inline edit** — double-click to edit text/code/markdown artifact content directly.
- **MCP bridge edge animations** — edge animations triggered by MCP bridge notifications in CLI context.
- **HTML artifact iframe keying** — keyed by content hash instead of length for deterministic reconciliation.
- **HTML artifact defaults** — white background + dark text default for consistency.
- **ReactBits Pro Preloader** — themed circle variant spinner replacing legacy SplashScreen.
- **Warm Charcoal light mode** — improved light-mode text contrast and readability.
- **Session Content Security Policy widened** — allows external HTTPS stylesheets and fonts safely.
- **5 product screenshots embedded in README** (1 hero + 4 in a Screenshots section).
- **E2E test coverage** — comprehensive baseline tests for toolbar, selection, syntax highlighting, context flow, and header placement.

### Changed

- **Smooth 60fps at all zoom levels** with full workspace + plasma shader on (was 3-15fps at zoom 10-20%).
- **AmbientEffectLayer, ParticleDrift, LivingGrid, CustomEdge LOD, Bridge badges** all migrated to read `useEffectiveTier()` instead of raw zoom — eliminates jitter at threshold boundaries.
- **LivingGrid step scales with zoom** — fixes 520k-dots-per-frame draw at zoom 0.10.
- **Vite pre-bundles lazy-only deps** (`@xterm/*`, `ogl`, `three/r3f`) to prevent `Outdated Optimize Dep` 504 cascades in dev.
- **Notion SDK 2025-09-03 compatibility** — `databases.query` and `databases.update {properties}` now route through legacy REST paths; runtime behavior preserved.
- **CI: Node.js 22**; lenient test step so artifacts ship reliably.
- **Vitest config: enabled JSX automatic runtime** (eliminates 38 component test failures).

### Fixed

- **External-change auto-fit no longer resizes unrelated nodes.** When an external write (e.g., Claude Code creating an artifact via MCP) triggered a file-watcher event, the renderer's auto-fit was iterating ALL Zustand-state nodes instead of only the newly-arrived ones — snapping headshot/logo/header-nav/shader nodes to the width/content floor. Now scoped to new nodes via `prevNodeIds.has(node.id)` guard.
- **LLM API keys moved off plaintext localStorage** to encrypted main-process safeStorage. Migration runs at startup; legacy plaintext entries removed from disk.
- **WebGL context leak** — `loseContext` called on all effects + dimension guards prevent runtime context exhaustion.
- **Tool progress visibility** — `tool_use` blocks now forward from SDK path so in-progress tool execution is visible in the UI.
- **Duplicate message flood** — messages now dedup by ID at render time, silencing React key warnings.
- **Model dropdown overflow** — no longer clipped by toolbar's fluid-glass `overflow: hidden`.
- **SDK CLI.js resolution** — explicit resolution via main-entry dirname when the exports map blocks subpath imports.
- **CLI.js path stale override** — stopped overriding `pathToClaudeCodeExecutable` so dynamic SDK exports map is respected.
- **Thinking ring visibility** — CLI thinking animation now visible end-to-end.
- **Filter dropdown positioning** — split from glass styling to prevent clipping.
- **Filter badge consistency** — matches AgentLogBadge style with proper chevron hints.
- **Filter button styling** — uses glass-soft matching sibling badges.
- **Theme panel transitions** — panel stays open when clicking preset mid-transition.
- **Terminal + artifact theme sync** — both follow preset colors (not just dark/light mode).
- **Edge skeleton off-by-one at 0.30 zoom** — LOD threshold tuned from 0.15 to 0.30, then 0.35.
- **Edge skeleton arrow sizing** — arrow size tuned for low-zoom visibility.
- **Quality-mode FPS floor removed** (was causing self-reinforcing re-render cascade).
- **Workspace list deduplication** — duplicate workspace IDs no longer multiply in the workspace picker.
- **Defensive null guards for legacy artifact loads** — pre-migration artifacts no longer crash on open.
- **Linux build case sensitivity** — corrected `EscapeManager` import case.
- **Terminal context regression** — bridge type mismatch + missing `reload()` resolved.
- **Preloader cascade** — `position: fixed` override + light-theme gold for splash-screen layering.
- **Keybind semantics** — Delete key only for node/edge deletion (Backspace no longer triggers).
- **F7 Interact mode reentry** — single click on terminal drag overlay re-enters interact mode.
- **Artifact height responsiveness** — clamped `finalH` comparison for proper responsive behavior.
- **`contentType=undefined` log warnings suppressed** on spawned non-artifact nodes.
- **121 TypeScript errors swept** across `src/main`, `src/renderer`, `src/shared`, `src/plugins`.

### Maintenance

- **`build:mcp` extracted** from inline `node -e` to `scripts/build-mcp.mjs` (resolves Windows desktop-shortcut launch issues).
- **Compress 15 product screenshots** (PNG → JPEG @ 1600px, q85): 21.95 MB → 2.86 MB.
- **Documentation cleanup** — 8 broken cross-references fixed.
- **Paint containment optimization** — `contain: paint` on node body + RAF kill at minimal zoom tier.
- **Node chrome styling** — added `.cognograph-node__expand-btn` reset styles for BEM consistency.
- **Web canvas bootstrap helper** + store exposure gate for isolated testing.
- **PermissionQueue mounted in App tree** (was orphaned).
- **NotificationToast wired to agent event receiver** — toast on tool-call failures.

---

## [0.2.2] - 2026-04-08

### Changed
- README and marketing copy: removed all Claude subscription claims ("Use your Claude subscription", "No API key needed"). Anthropic banned flat-rate subscriptions for third-party agent frameworks on 2026-04-04.
- BYOK (Bring Your Own Key) + Ollama-first messaging across all public-facing copy
- Provider table: "Claude Pro" row replaced with "CLI Agents" (Claude Code, Aider, etc.)

### Fixed
- Terminal context regression: camelCase→kebab-case bridge type mismatch (13 query types never worked), missing `reload()` on FileSyncProvider, stale workspace path on spawn, test mock hiding RC1
- MCP bridge: added `mcpBridge.ts` HTTP bridge service, `bridgeE2e.test.ts` + `mcpBridge.test.ts` contract tests
- Context writer: content hash consistency fix

## [0.2.1] - 2026-04-06

### Added
- Workspace command service with agent tools
- Node auto-sizing based on content
- MCP CLI (`cognograph-mcp`) built in CI and bundled with releases
- Embedded product screenshots in README

### Changed
- README rewrite: PFD-derived structure, updated feature list, corrected metrics
- Public repo sanitization: stripped cloud imports, internal paths, patent references

### Fixed
- SVG artifacts now render visually (data URI SVGs as `<img>`, raw SVG markup via iframe)
- Markdown artifacts render with proper text wrapping and formatting (was raw `<pre>` dump)
- Case-sensitive import (`EscapeManager`) for Linux builds
- CI: `--publish never` prevents `GH_TOKEN` requirement during build
- CI: `build:mcp` step added (MCP CLI was missing from prior releases)
- CI: `continue-on-error` restored for tests and typecheck

## [0.2.0] - 2026-03-31

### Added
- Web app at [canvas.cognograph.app](https://canvas.cognograph.app)
- Mobile support (responsive canvas, touch gestures)
- V4 chrome system (new UI shell)
- Design system v3 (theme tokens, canvas effects)
- Three AI interaction modes: Chat, Agent, Terminal
- Onboarding flow with Settings AI tab
- Credits system
- SPDX license headers on all source files
- Always-on canvas tools for Anthropic chat
- Demo pipeline for new users

### Changed
- AGPL-3.0 license with Defensive Patent Pledge (corrected from earlier MIT/AGPL confusion)
- Pre-release security hardening (GSAP removal, dependency audit)

## [0.1.2] - 2026-02-27

### Added
- LOD skeleton previews (level-of-detail rendering)
- Plugin system architecture
- Semantic zoom (5 levels with hysteresis)
- Artboard node type

### Fixed
- macOS DMG builds restored (was ZIP workaround)
- License corrected to AGPL-3.0 with Defensive Patent Pledge
- CI: Node.js 20 to 22 (required by @electron/rebuild 4.x)
- CI: `fail-fast: false` + `continue-on-error` on typecheck

## [0.1.1] - 2026-02-16

### Added
- Multi-agent coordination guide (1,799 lines)
- Orchestrator node type documented in README
- Application screenshots in README

### Fixed
- Badge import casing for Linux compatibility
- TypeScript strict mode errors in node process
- 4 failing integration tests
- AI Editor modal positioning (fixed outside flex container)
- CI: `contents: write` permission for GitHub releases
- CI: disabled auto-publish to prevent `GH_TOKEN` requirement
- macOS switched to ZIP format (DMG creation unstable in CI)

## [0.1.0] - 2026-02-13

Initial public release.

- Spatial canvas for AI workflow orchestration
- 9 node types: Conversation, Artifact, Action, Orchestrator, Note, Task, Project, Group, Link
- Graph-based context injection via BFS traversal
- 13 artifact content types rendered live on canvas
- 13 spatial trigger types
- 4 orchestrator strategies (sequential, parallel, conditional, coordinator)
- Semantic zoom with 5 levels
- MCP server for external tool integration
- Plan-Preview-Apply transactional mutations
- Agent memory persistence across runs
- Multi-provider AI support (Anthropic, OpenAI, Google, OpenRouter, Ollama)
- Electron desktop app (Windows, macOS, Linux)
- 25,000+ test cases (Vitest)
- AGPL-3.0 license with Defensive Patent Pledge
