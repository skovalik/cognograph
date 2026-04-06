# Changelog

All notable changes to Cognograph are documented in this file.

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
