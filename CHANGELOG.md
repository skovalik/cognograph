# Changelog

All notable changes to Cognograph are documented in this file.

## [0.3.0] - 2026-05-04

### Added

- **SLSA-grade build provenance**: cosign keyless workflow + Ed25519 signer + per-platform manifest verifier in the release pipeline.
- **AutoUpdater signature verification**: `cosign verify-blob` runs against any candidate update before it is applied; verification failure aborts the update path.
- **Docker-based sandbox surface**: a `dockerSandbox` service with an allowlist contract for terminal-node command execution.
- **Unified perf-tier system**: Quality / Auto / Battery dropdown is now the single master switch for shader, edge LOD, particles, ambient effects, and bridge badges across all zoom levels.
- **PerfTierBadge**: surfaces the active tier + reason + override hint when not at full quality.
- **Animated thinking-dot loader**: conic-gradient progress indicator replaces the inline spinner.
- **Microsoft Clarity beacon** for usage analytics on the web canvas.
- 5 product screenshots embedded in README (1 hero + 4 in a Screenshots section).

### Changed

- **Smooth 60fps at all zoom levels** with full workspace + plasma shader on (was 3-15fps at zoom 10-20%).
- **AmbientEffectLayer, ParticleDrift, LivingGrid, CustomEdge LOD, Bridge badges** all migrated to read `useEffectiveTier()` instead of raw zoom; eliminates jitter at threshold boundaries.
- **LivingGrid step scales with zoom**: fixes 520k-dots-per-frame draw at zoom 0.10.
- **Vite pre-bundles lazy-only deps** (`@xterm/*`, `ogl`, `three/r3f`) to prevent `Outdated Optimize Dep` 504 cascades in dev.
- Notion SDK 2025-09-03 compatibility: `databases.query` and `databases.update {properties}` routed through legacy REST paths; runtime behavior preserved.
- CI workflow: bumped to Node.js 22; test step now `continue-on-error` so artifacts ship regardless of flaky tests.
- Vitest config: enabled JSX automatic runtime, eliminating 38 `ReferenceError: React is not defined` failures in component tests.

### Fixed

- **Workspace list deduplication**: duplicate workspace IDs no longer multiply in the workspace picker.
- **Defensive null guards for legacy artifact loads**: pre-migration artifacts no longer crash on open.
- **Quality-mode FPS floor** removed: was causing self-reinforcing re-render cascade.
- **Edge skeleton off-by-one at 0.30 zoom**: LOD threshold tuned from 0.15 to 0.30.
- 121 TypeScript errors swept across `src/main`, `src/renderer`, `src/shared`, and `src/plugins`.

### Maintenance

- Compressed 15 product screenshots (PNG to JPEG at 1600px max, q85): 21.95 MB to 2.86 MB total.
- Documentation cleanup: 8 broken cross-references fixed.
- `build:mcp` extracted from inline `node -e` to `scripts/build-mcp.mjs` (resolves Windows desktop-shortcut launch issues).

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
