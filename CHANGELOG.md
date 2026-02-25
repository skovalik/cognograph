# Changelog

> Feature development history. Newest first.

---

## 2026-02-24: Rich Node Depth System — Full Implementation

### Summary
**Implemented the complete Rich Node Depth System via a 9-wave parallel agent pipeline. 119 files changed, 15,942 lines added, 76 new files. 1,305 tests passing (up from 888).**

### Phases Implemented

**Phase 1 — Foundation:**
- 5-level zoom LOD system (L0 far → L4 expanded) via `useSemanticZoom` hook
- CSS LOD framework with `data-lod` attributes on all node types
- Hysteresis (deadband +/-0.02) to prevent threshold jitter

**Phase 2 — Node LOD Rollout:**
- All 9 node types implement full LOD cascade (ConversationNode, TaskNode, ProjectNode, ArtifactNode, NoteNode, TextNode, WorkspaceNode, ActionNode, OrchestratorNode)
- Far zoom: colored rectangle + icon + title
- Mid zoom: progressive disclosure of properties and metadata
- Close zoom: full content with all handles

**Phase 3 — Canvas Intelligence:**
- Edge LOD: weak/light edges hidden at far/mid zoom
- Canvas Districts: spatial regions with `isDistrict`, visual overlay
- In-place expansion (artboard mode): `inPlaceExpandedNodeId` state

**Phase 4 — Embedded Terminal:**
- PTY lifecycle manager (`terminalManager.ts`) with async lazy-loaded `node-pty`
- IPC handlers for spawn/write/resize/kill/scrollback
- Scrollback buffer (5,000 lines), idle timeout (30s), session status tracking
- Context file injection via `contextWriter.ts`

**Phase 5 — Interaction Patterns:**
- Z-key zoom overlay (`ZoomOverlay.tsx`) — hold Z, drag to select, release to navigate
- Keyboard mode indicator HUD (`KeyboardModeIndicator.tsx`) — Navigate/Edit/Terminal/Artboard
- Context selection store for multi-node context building

**Phase 6 — Advanced Features:**
- Execution status overlay with depth-of-field blur
- Cluster overlay at L0 zoom (`ClusterOverlay.tsx`) with hybrid 3-pass clustering algorithm
- File touch edges — cross-node file conflict detection (`fileTouchUtils.ts`)
- 3-tier session link store — env-auto / manual / prompted (`sessionLinkStore.ts`)
- Dispatch workflow system (`dispatchWorkflow.ts`)
- Calm mode store + cognitive load visibility hooks

**Phase 7 — Polish:**
- Canvas Table of Contents (`CanvasTableOfContents.tsx`) — Ctrl+Shift+T
- Calm Mode toggle — strips secondary UI
- Cognitive Load Meter (`CognitiveLoadMeter.tsx`) — real-time complexity indicator

### Bug Fixes (same session)
- Fixed `node-pty` Rollup externalization (`external: ['node-pty']` in electron.vite.config.ts)
- Fixed `node-pty` runtime crash — changed from static import to async lazy `import()` pattern
- Fixed duplicate `useNodeContentVisibility` imports in ProjectNode.tsx and ArtifactNode.tsx (cherry-pick artifacts)
- Fixed duplicate `data-lod` JSX attributes in NoteNode.tsx and WorkspaceNode.tsx
- Fixed duplicate `zoomLevel` declaration in ProjectNode.tsx
- Repositioned Cognitive Load Meter to avoid overlapping React Flow zoom controls

### UI Improvements
- Added Canvas Effects submenu to Theme dropdown (19 effects by category)
- Added Edge Shape submenu to Theme dropdown (straight/smooth/sharp/rounded)
- Removed blur/darkening overlay from Theme Settings panel
- Fixed Properties panel resize handle (z-index stacking bug)
- Moved Keyboard Mode Indicator to bottom-center (was hidden under panel)

### Documentation
- Created `FEATURES.md` — comprehensive feature documentation
- Updated `README.md` — new feature sections, accurate test/store counts, plugin system

### Stats
- 1,305 tests passing (67 files)
- tsc --noEmit: 0 errors
- electron-vite build: clean (main + preload + renderer)

---

## 2026-02-23: PFD Phases 3A–7C + Notion Node Sync Engine

### Summary
**Committed two sessions of accumulated work: comprehensive PFD canvas intelligence features and a complete Notion node-level sync engine.**

### PFD Canvas Features (24 files, +2,835 lines)

**Phase 3A — Edge LOD:**
- `CustomEdge.tsx`: Hide light/weak edges at far/mid zoom (reduces visual noise at scale)
- `useSemanticZoom.ts`: Added hysteresis (±0.02) to prevent LOD threshold jitter

**Phase 3B — Canvas Districts:**
- `SpatialRegion`: `isDistrict`, `districtStyle` (tint/hatching), `districtOpacity` fields
- `spatialRegionStore`: `addDistrict()` / `getDistricts()` helpers
- `CanvasDistrictOverlay.tsx`: Visual district labels rendered on canvas

**Phase 4 — Context Visualization:**
- `contextVisualizationStore.ts`: BFS-derived context scope reactive store
- `useContextVisualization.ts`: `showContextScope()` / `hideContextScope()` hook
- `ContextScopeBadge.tsx`: Floating badge showing context tree on hover

**Phase 5A — In-Place Expansion:**
- `workspaceStore`: `inPlaceExpandedNodeId` + `collapseInPlaceExpansion` state

**Phase 6B — Landmark Nodes:**
- `common.ts`: `isLandmark` on `ContextMetadata` for spatial anchoring

**Phase 6C — Session Re-entry & Recency:**
- `SessionReEntryPrompt.tsx`: "Last session you were here" re-entry aid
- `workspaceStore`: `recordInteraction()`, `lastSessionNodeId`, session tracking

**Phase 7A — Canvas Table of Contents:**
- `CanvasTableOfContents.tsx`: Ctrl+Shift+T searchable flat node list, sort by recent/alpha/type

**Phase 7B — Calm Mode:**
- `workspaceStore`: `calmMode` / `toggleCalmMode` state

**Phase 7C — Cognitive Load Meter:**
- `CognitiveLoadMeter.tsx`: Real-time indicator (Clear/Active/Dense/Overloaded)

**Supporting:**
- `NodeHoverPreview.tsx`: Rich preview tooltip on node hover
- `EdgeGrammarLegend.tsx`: Edge type reference panel

### Notion Node-Level Sync Engine (11 files, +4,560 lines)

**Core engine:**
- `nodeSyncEngine.ts`: Orchestrates push/pull with DiffCalc, snapshots, duplication detection
- `nodeSyncQueue.ts`: Priority queue (task > project > note) with debounce + retry backoff
- `propertyMapper.ts`: Cognograph ↔ Notion field mapping for task/project/note types
- `upsertService.ts`: Create-or-update with idempotency keys
- `pullService.ts`: Pull with last-edit comparison and conflict detection
- `contentConverter.ts`: Bidirectional HTML ↔ Notion blocks
- `syncLogger.ts`: Structured sync log persisted to AppData

**Tests (87 new tests):**
- `contentConverter.test.ts`: 49 tests for all HTML elements, annotations, round-trips
- `propertyMapper.test.ts`: 38 tests for all node types, priorities, NoteMode mapping

### Stats
- 888 tests passing, tsc --noEmit: 0 errors

---

## Earlier Development History

### 2026-02-15: Smart E2E Testing System
- Implemented AI-powered visual regression testing with screenshot capture and DOM cross-checking
- Adversarial prompt detection for hallucination prevention

### 2026-02-14: Cognitive Science Foundations
- Literature review: spatial memory, working memory limits, Gestalt principles, cognitive load theory
- 40+ peer-reviewed citations informing design decisions

### 2026-02-13: React Flow Performance Research
- Profiled canvas performance with 100+ nodes
- Identified and resolved re-render bottlenecks in node selection and drag operations

### 2026-02-12: Theme System + Glass Mode
- Theme menu dropdown with preset selector
- Glassmorphism system: solid, soft-blur, fluid-glass modes
- NoteNode tint system with 10 visual modes
- AI property suggestions integration

### 2026-02-11: Major Feature Build-Out
- Plugin system architecture (IPC sandboxing, renderer registry)
- Spatial Command Bridge for agent orchestration
- 888 tests passing, tsc clean

### 2026-02-10: Ambient Effects V2
- 19 canvas effects across 5 categories (Patterns, Atmosphere, Particles, Fluid, Light)
- Theme-linked color derivation pipeline
- Per-effect prop customization with live preview

### 2026-02-06: Performance + Architecture
- OffscreenCanvas worker for GPU-intensive effects
- Security audit and remediation
- MCP server tools and handlers

### 2026-02-02 — 2026-02-05: Core Infrastructure
- Agent mode: autonomous canvas manipulation
- Plan-Preview-Apply: ghost node previews with atomic execution
- Token budget tracking and context depth controls
- 20+ ambient background effects (Three.js, R3F, OGL)

### 2026-01-24 — 2026-02-01: Foundation
- Electron + React + React Flow + Zustand architecture
- 8 node types with type-safe discriminated unions
- Graph-based context injection via BFS traversal
- Multi-provider LLM integration (Anthropic, OpenAI, Google Gemini)
- Properties system with custom fields
- Artifact nodes with file drop and AI generation
- Auto-extraction sidebar with AI-powered content extraction
- Undo/redo history stack with batch operations

### Initial Release: v0.1.0
- Core canvas with context injection
- 792 tests passing
- AGPL-3.0 license

---

*Patent pending. See README for details.*
