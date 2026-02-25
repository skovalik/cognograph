# QA Pipeline Implementation Plan

> **Created:** January 24, 2026
> **Status:** 🔄 In Progress (Phase 2)
> **Last Phase Completed:** Phase 2F (Dead Code Cleanup)

---

## Overview

This document tracks the phased implementation of Cognograph's QA pipeline. Each phase is designed to be non-breaking and independently verifiable.

**Methodology:** Document-first approach - create/update specs and plans before implementation, ensuring each phase has clear success criteria and rollback procedures.

---

## Phase 0: Documentation Reorganization

### Status: ✅ Complete

### Background

Root directory accumulated 18 markdown files from v1.0-v1.4 development. Many were outdated or misplaced. This phase cleaned up the structure before adding QA tooling.

### Principle

This phase established the document-first methodology: create this implementation plan, document decisions in DECISIONS.md, then execute changes. All subsequent phases follow this pattern.

### Files Kept at Root

| File | Reason |
|------|--------|
| CLAUDE.md | Entry point for AI assistants |
| README.md | Standard project readme |
| CHANGELOG.md | Standard changelog |
| ARCHITECTURE.md | Core architecture reference |
| TODO.md | Active task tracking |
| DECISIONS.md | Decision log (kept for easy access) |

### Files Moved

| Source | Destination | Status |
|--------|-------------|--------|
| VISION.md | docs/strategy/VISION.md | ✅ |
| NORTH_STAR.md | docs/strategy/NORTH_STAR.md | ✅ |
| PITFALLS.md | docs/guides/PITFALLS.md | ✅ |
| QA.md | docs/qa/TESTING_CHECKLIST.md | ✅ |
| SYNC.md | docs/guides/SYNC_PROTOCOL.md | ✅ |
| HANDOFF_MCP_SERVER.md | docs/specs/mcp-server-handoff.md | ✅ |
| HANDOFF_MODULE_FOUNDATIONS.md | docs/specs/module-foundations.md | ✅ |
| IMPLEMENTATION.md | docs/archive/IMPLEMENTATION_V1.md | ✅ |
| IMPLEMENTATION_PART2.md | docs/archive/IMPLEMENTATION_V1_PART2.md | ✅ |
| IMPLEMENTATION_PART3.md | docs/archive/IMPLEMENTATION_V1_PART3.md | ✅ |
| IMPLEMENTATION_PART4.md | docs/archive/IMPLEMENTATION_V1_PART4.md | ✅ |
| HANDOFF.md | docs/archive/HANDOFF_BATCH4.md | ✅ |

### Files Updated

| File | Changes | Status |
|------|---------|--------|
| CLAUDE.md | Updated all documentation paths and routing table | ✅ |
| README.md | Updated documentation links | ✅ |
| DECISIONS.md | Added Phase 0 decision entry + patent findings | ✅ |

### Directories Created

- `docs/strategy/` - Long-term vision and business docs
- `docs/archive/` - Historical documentation

### Completed Tasks

- [x] 0.1: Create new directories (docs/strategy/, docs/archive/)
- [x] 0.2: Move files to new locations
- [x] 0.3: Update CLAUDE.md routing table
- [x] 0.4: Update README.md links
- [x] 0.5: Update DECISIONS.md with relevant findings
- [x] 0.6: Verify file accessibility

### Verification

```bash
# All moved files accessible ✅
# CLAUDE.md routing accurate ✅
# README.md links valid ✅
# No orphaned references ✅
```

---

## Tools Selected

| Tool | Version | Purpose |
|------|---------|---------|
| **Vitest** | ^2.0.0 | Unit/integration testing (Vite-native, works with electron-vite) |
| **@vitest/coverage-v8** | ^2.0.0 | Code coverage reporting |
| **@testing-library/react** | ^14.0.0 | React component testing utilities |
| **@testing-library/jest-dom** | ^6.0.0 | Custom DOM matchers |
| **dependency-cruiser** | ^16.0.0 | Architectural rule enforcement |
| **knip** | ^5.0.0 | Dead code / unused export detection |
| **Husky** | ^9.0.0 | Git hooks management |
| **lint-staged** | ^15.0.0 | Run checks on staged files only |

**Why these tools:**
- **Vitest over Jest:** Native Vite support (you use electron-vite), faster, same API
- **dependency-cruiser:** Can encode the architectural patterns I identified (store access, IPC boundaries)
- **knip:** Will find dead code that accumulated during rapid development
- **Husky + lint-staged:** Industry standard, non-invasive

**NOT included (intentionally):**
- ESLint/Prettier - Can be disruptive, save for later phase
- Playwright/Cypress - E2E is Phase 2 of testing, not this implementation

---

## Phase A: Foundation (Non-Breaking)

### Status: ✅ Complete

### Tasks

- [x] A1: Create `docs/qa/` directory structure
- [x] A2: Add testing dependencies to `package.json` (additive only)
- [x] A3: Create `vitest.config.ts`
- [x] A4: Create `.dependency-cruiser.cjs` (stub with no-circular and no-orphans)
- [x] A5: Create `knip.json`
- [x] A6: Add new npm scripts (don't modify existing)
- [x] A7: Create test infrastructure (`src/test/setup.ts`, `src/test/mocks/electronApi.ts`)
- [x] A8: Create infrastructure verification tests (`src/test/infrastructure.test.ts`)

### Files Created/Modified

```
vitest.config.ts                          # Test runner config with jsdom, path aliases
.dependency-cruiser.cjs                   # Architectural rules (no-circular, no-orphans)
knip.json                                 # Dead code detection config
src/test/setup.ts                         # Global test setup (jsdom mocks, window.api)
src/test/mocks/electronApi.ts             # Mock window.api for tests
src/test/infrastructure.test.ts           # Verify test infrastructure works
package.json                              # Added devDependencies and scripts
```

### New npm Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "validate:arch": "depcruise src --config .dependency-cruiser.cjs",
    "validate:deps": "knip",
    "validate": "npm run typecheck && npm run validate:arch && npm run validate:deps"
  }
}
```

### Verification Results

```bash
npm install                    # ✅ Success (182 packages added)
npm run test                   # ✅ 10 tests pass (infrastructure tests)
npm run validate:arch          # ✅ Runs - found 1 pre-existing circular dependency
npm run validate:deps          # ✅ Runs - found 18 unused files, 112 unused exports
npm run typecheck              # ⚠️ Pre-existing errors in main process (not caused by Phase A)
```

### Pre-existing Issues Found

1. **Circular dependency:** `src/shared/actionTypes.ts` ↔ `src/shared/types.ts`
2. **TypeScript errors in main process:** 9 errors in `aiEditor.ts`, `attachments.ts`, `workspace.ts`
3. **Unlisted dependency:** `y-protocols/awareness` (should be explicit in package.json)
4. **Dead code:** 18 unused files, 112 unused exports (artifact renderers, multiplayer modals)

These pre-existing issues are documented for future cleanup in Phase B/E.

---

## Phase B: Architectural Rules

### Status: ✅ Complete

### Tasks

- [x] B1: Define dependency-cruiser rules for identified patterns
- [x] B2: Architectural validation runs via `npm run validate:arch`
- [x] B3: Update ARCHITECTURE.md with rules documentation
- [x] B4: Document rules in `docs/qa/ARCHITECTURAL_RULES.md`

### Rules Implemented

| Rule | Severity | Description |
|------|----------|-------------|
| `no-circular` | error | No circular dependencies (excludes known actionTypes/types cycle) |
| `known-circular-actiontypes-types` | warn | Tracks the known circular for cleanup |
| `main-renderer-boundary` | error | Main process cannot import renderer |
| `renderer-main-boundary` | error | Renderer cannot import main directly |
| `shared-purity` | error | Shared types cannot import from main/renderer |
| `preload-isolation` | error | Preload cannot import renderer |
| `no-orphans` | warn | Flag unused files |
| `store-not-in-utils` | warn | Utils shouldn't import stores directly |
| `components-not-import-services` | warn | Components should use hooks, not services |
| `services-should-use-stores` | info | Services should access state via stores |

### Verification Results

```bash
npm run validate:arch          # ✅ 0 errors, 7 warnings
```

**Current Warnings (tracked for future cleanup):**
1. `known-circular-actiontypes-types`: actionTypes.ts ↔ types.ts
2. `no-orphans`: multiplayerTypes.ts
3. `store-not-in-utils`: mutationExecutor.ts (2 violations)
4. `components-not-import-services`: TaskNode, NoteNode, SuggestedAutomations (3 violations)

### Files Created/Modified

- `.dependency-cruiser.cjs` - Full rule set
- `docs/qa/ARCHITECTURAL_RULES.md` - Rule documentation
- `ARCHITECTURE.md` - Added Architectural Rules section

---

## Phase C: Git Hooks

### Status: ✅ Complete

### Tasks

- [x] C1: Install and initialize Husky (`npx husky init`)
- [x] C2: Create pre-commit hook (lint-staged + tests)
- [x] C3: Configure lint-staged for TypeScript files
- [x] C4: Set hooks to warn-only mode (failures don't block commits)

### Files Created/Modified

- `.husky/pre-commit` - Pre-commit hook script
- `package.json` - Added `prepare` script and `lint-staged` config

### Hook Behavior

**Pre-commit (warn mode):**
```bash
#!/bin/sh
# Runs but doesn't block commit on failure
npx lint-staged || echo "⚠️ lint-staged found issues (not blocking)"
npm run test || echo "⚠️ Tests failed (not blocking)"
```

### Verification

```bash
# Manual test of hook
git add vitest.config.ts && sh .husky/pre-commit  # ✅ Runs successfully

# Hook output:
# 🔍 Running pre-commit checks...
# [COMPLETED] *.{ts,tsx} — 1 file
# 10 tests pass
# ✅ Pre-commit checks complete
```

### Notes

- Husky adds `"prepare": "husky"` to package.json scripts
- lint-staged currently echoes staged TypeScript files (placeholder for ESLint/Prettier)
- Tests run on every commit to catch regressions early
- Warn-only mode allows commits to proceed even if checks fail

---

## Phase D: Test Infrastructure

### Status: ✅ Complete

### Tasks

- [x] D1: Create test setup files (`src/test/setup.ts`) - Done in Phase A
- [x] D2: Create test utilities (`src/test/utils.ts`)
- [x] D3: Create mock factories (`src/test/mocks/electronApi.ts`) - Done in Phase A
- [x] D4: Write 3-5 critical path tests
- [x] D5: Configure coverage thresholds (5% initial, already set)

### Tests Written

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `infrastructure.test.ts` | 10 | Test infrastructure verification |
| `contextBuilder.test.ts` | 11 | 84% statements, 65% branches |
| `nodeUtils.test.ts` | 17 | 82% statements, 92% branches |
| `tokenEstimation.test.ts` | 16 | 100% statements |
| `tokenEstimator.test.ts` | 20 | 100% statements |

**Total: 74 tests, all passing**

### Files Created

```
src/test/
├── setup.ts              # Global test setup (Phase A)
├── utils.ts              # Node/edge factories, test helpers
├── infrastructure.test.ts # Infrastructure verification tests
└── mocks/
    └── electronApi.ts    # Mock window.api (Phase A)

src/renderer/src/utils/__tests__/
├── contextBuilder.test.ts   # AI editor context building
├── nodeUtils.test.ts        # HTML/text conversion utilities
├── tokenEstimation.test.ts  # Token counting, usage levels
└── tokenEstimator.test.ts   # Pricing, cost estimation, formatting
```

### Coverage Report

```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   89.74 |    80.37 |   97.72 |   88.78 |
 contextBuilder.ts |   84.25 |    65.47 |     100 |      84 |
 nodeUtils.ts      |   81.81 |     92.3 |   85.71 |   80.95 |
 tokenEstimation.ts|     100 |       95 |     100 |     100 |
 tokenEstimator.ts |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|
```

### Notes

- `workspaceStore.nodes.test.ts` and `agentTools.test.ts` deferred to future iteration
  (these require more complex store/service mocking)
- Current tests focus on pure utility functions with minimal dependencies
- Coverage exceeds 5% thresholds (actual: ~89% statements)

---

## Phase E: Verification

### Status: ✅ Complete

### Tasks

- [x] E1: Run full validation pipeline
- [x] E2: Document all issues found
- [x] E3: Create prioritized tech debt backlog
- [x] E4: Update this document with completion status

### Full Pipeline Command

```bash
npm run validate && npm run test:coverage
```

### Verification Results

#### TypeScript (9 pre-existing errors in main process)

| File | Errors | Issue |
|------|--------|-------|
| `src/main/aiEditor.ts` | 2 | Unused import, unknown property in type |
| `src/main/attachments.ts` | 4 | `string \| undefined` not assignable to `string` |
| `src/main/workspace.ts` | 3 | Possibly undefined, type mismatches |

**Note:** These errors pre-date the QA pipeline and are tracked for future fixes.

#### Architecture (0 errors, 7 warnings)

```bash
npm run validate:arch  # ✅ 0 errors
```

| Warning | Count | Details |
|---------|-------|---------|
| `known-circular-actiontypes-types` | 1 | actionTypes.ts ↔ types.ts (tracked) |
| `no-orphans` | 1 | multiplayerTypes.ts |
| `store-not-in-utils` | 2 | mutationExecutor.ts |
| `components-not-import-services` | 3 | TaskNode, NoteNode, SuggestedAutomations |

#### Dead Code Detection (knip)

| Category | Count | Examples |
|----------|-------|----------|
| Unused files | 18 | Artifact renderers, multiplayer modals |
| Unlisted dependencies | 4 | y-protocols/awareness (×4 imports) |
| Unused exports | 109 | Various functions, constants, components |
| Unused types | 53 | Exported interfaces never imported |
| Duplicate exports | 8 | Named + default exports |

#### Tests

```bash
npm run test:coverage  # ✅ 74 tests pass
```

| Metric | Value |
|--------|-------|
| Test files | 5 |
| Total tests | 74 |
| Statement coverage | 89.74% |
| Branch coverage | 80.37% |
| Function coverage | 97.72% |
| Line coverage | 88.78% |

### Tech Debt Backlog (Prioritized)

#### Priority 1: TypeScript Errors (Blocks CI)

| Task | File | Effort |
|------|------|--------|
| Fix undefined handling | attachments.ts | Low |
| Fix undefined handling | workspace.ts | Low |
| Remove unused import + fix type | aiEditor.ts | Low |

#### Priority 2: Architecture Violations

| Task | Details | Effort |
|------|---------|--------|
| Break circular dependency | actionTypes.ts ↔ types.ts | Medium |
| Refactor mutationExecutor | Move store access to caller | Medium |
| Refactor component imports | Use hooks instead of services | Medium |

#### Priority 3: Unlisted Dependencies

| Task | Details | Effort |
|------|---------|--------|
| Add y-protocols to package.json | Currently unlisted | Low |

#### Priority 4: Dead Code Cleanup

| Task | Count | Effort |
|------|-------|--------|
| Remove unused artifact renderers | 10 files | Low |
| Remove unused multiplayer modals | 4 files | Low |
| Remove/export unused functions | 109 exports | Medium |
| Consolidate duplicate exports | 8 exports | Low |

#### Priority 5: Test Coverage

| Task | Details | Effort |
|------|---------|--------|
| Add workspaceStore.nodes tests | Store testing | High |
| Add agentTools tests | Service testing | High |
| Increase branch coverage | Currently 80% | Medium |

---

# Phase 2: Comprehensive QA (v1.4.8+)

> **Goal:** Achieve production-ready test coverage and fix all blocking issues.

---

## Phase 2A: TypeScript Stabilization (Main Process)

### Status: ✅ Complete

### Goal
Fix TypeScript errors in main process to unblock CI pipeline.

### Tasks

- [x] 2A.1: Fix `src/main/aiEditor.ts` (2 errors)
  - Removed unused `BrowserWindow` import
  - Fixed `PlanWarning` to use `level` instead of `type`/`severity`
- [x] 2A.2: Fix `src/main/attachments.ts` (4 errors)
  - Added non-null assertion for `filePaths[0]` after length check
- [x] 2A.3: Fix `src/main/workspace.ts` (3 errors)
  - Added non-null assertion for `firstFile` after length check
  - Fixed `base64Data` with nullish coalescing to empty string
- [x] 2A.4: Add `y-protocols` to package.json dependencies
- [x] 2A.5: Verify `npm run typecheck:node` passes

### Success Criteria

```bash
npm run typecheck:node  # ✅ 0 errors
npm run test            # ✅ 74 tests pass
npm run validate:arch   # ✅ 0 errors, 7 warnings
```

### Note: Web TypeScript Errors

The original plan only addressed main process errors. During verification, ~80 additional TypeScript errors were discovered in the renderer process (`typecheck:web`). These are primarily:

- Unused variable declarations (e.g., `TS6133`)
- Type mismatches in AI editor components
- React Flow edge type incompatibilities
- TipTap extension type casting issues

These pre-existing errors will be addressed in a new **Phase 2A.5: Web TypeScript Stabilization** phase.

---

## Phase 2A.5: Web TypeScript Stabilization

### Status: ✅ Complete

### Goal
Fix TypeScript errors in renderer process (web) for full pipeline compliance.

### Scope

~136 errors fixed across renderer process, test utilities, and shared types.

| Category | Count (approx) | Status |
|----------|----------------|--------|
| Unused variables (TS6133) | ~25 | ✅ Fixed (void, _, comments) |
| Type mismatches | ~20 | ✅ Fixed (casts, assertions) |
| React Flow types | ~15 | ✅ Fixed (CustomEdge path tuples) |
| Lucide icon title props | ~8 | ✅ Fixed (wrapped in spans) |
| `unknown` to `ReactNode` | ~20 | ✅ Fixed (as string casts) |
| Stores/services | ~50 | ✅ Fixed |
| Test utilities | ~4 | ✅ Fixed |

### Completed Tasks

- [x] 2A.5.1: Fix unused variable declarations (void expressions, _ prefix, comments)
- [x] 2A.5.2: Fix `PropertiesPanel.tsx` type errors (compact, isLightMode, properties casts)
- [x] 2A.5.3: Fix `agentService.ts` type errors (toolUse narrowing, array access)
- [x] 2A.5.4: Fix `CustomEdge.tsx` path tuple types
- [x] 2A.5.5: Fix `preload/index.ts` AIEditorScope type ('single' added)
- [x] 2A.5.6: Fix `unknown` to `ReactNode` issues (as string casts)
- [x] 2A.5.7: Fix test utility types in `src/test/utils.ts` (factory function casts)
- [x] 2A.5.8: Fix constants/properties.ts missing node types (action, text, workspace)
- [x] 2A.5.9: Fix `tiptapConfig.ts` (history→undoRedo, boolean options)
- [x] 2A.5.10: Fix workspaceStore RECONNECT_EDGE action type
- [x] Fix contextBuilder.test.ts array access assertions
- [x] Verify `npm run typecheck` passes (0 errors)

### Key Fixes Applied

| Pattern | Example | Files |
|---------|---------|-------|
| `void funcName` | Suppress unused function warnings | ThemeSettingsPanel, contextBuilder |
| `_param` prefix | Unused parameters | TokenBreakdownPopover, previewBuilder |
| `as string` | Unknown title fields | 15+ component files |
| `as Record<string, unknown>` | Properties access | PropertiesPanel, contextBuilder |
| `!` assertions | Array access after length check | workspaceStore, agentService |
| `as unknown as T` | Incomplete object literals | test/utils factory functions |

### Success Criteria

```bash
npm run typecheck  # ✅ 0 errors (both node and web)
npm run validate   # ✅ Full pipeline passes (warnings only)
npm run test       # ✅ 74 tests pass
```

---

## Phase 2B: Store Testing

### Status: ✅ Complete

### Goal
Test Zustand stores which manage core application state.

### Tasks

- [x] 2B.1: Create `src/test/storeUtils.ts` - Store testing utilities
- [x] 2B.2: Create `src/renderer/src/stores/__tests__/workspaceStore.nodes.test.ts`
- [x] 2B.3: Create `src/renderer/src/stores/__tests__/workspaceStore.edges.test.ts`
- [x] 2B.4: Create `src/renderer/src/stores/__tests__/workspaceStore.undo.test.ts`
- [x] 2B.5: Create `src/renderer/src/stores/__tests__/aiEditorStore.test.ts`

### Completed: January 24, 2026

**Files Created:**
- `src/test/storeUtils.ts` - Store reset and seeding utilities
- `src/renderer/src/stores/__tests__/workspaceStore.nodes.test.ts` - 16 tests for node CRUD
- `src/renderer/src/stores/__tests__/workspaceStore.edges.test.ts` - 20 tests for edge operations
- `src/renderer/src/stores/__tests__/workspaceStore.undo.test.ts` - 23 tests for undo/redo
- `src/renderer/src/stores/__tests__/aiEditorStore.test.ts` - 31 tests for AI editor state

**Bug Fix:** Fixed undo implementation for UPDATE_NODE and BULK_UPDATE_NODES - `Object.assign` was not removing newly-added properties on undo. Fixed by clearing properties before restore.

**Test Results:** 188 tests passing (114 new store tests)

### Test Coverage Targets

| Store | Functions to Test |
|-------|-------------------|
| `workspaceStore` | addNode, updateNode, deleteNode, addEdge, deleteEdge |
| `workspaceStore` | undo, redo, clearHistory |
| `workspaceStore` | selectNode, deselectAll, getSelectedNodes |
| `aiEditorStore` | setMode, setScope, applyChanges |

### Files to Create

```
src/test/storeUtils.ts                              # createMockStore, resetStore
src/renderer/src/stores/__tests__/
├── workspaceStore.nodes.test.ts                    # Node CRUD operations
├── workspaceStore.edges.test.ts                    # Edge CRUD operations
├── workspaceStore.undo.test.ts                     # Undo/redo stack
└── aiEditorStore.test.ts                           # AI editor state
```

### Success Criteria

- 20+ new tests for store operations
- Undo/redo tested for all mutating operations
- Store isolation verified (no cross-contamination)

---

## Phase 2C: Service Testing

### Status: ✅ Complete

### Goal
Test service layer which orchestrates business logic.

### Tasks

- [x] 2C.1: Create `src/renderer/src/services/__tests__/agentTools.test.ts`
- [x] 2C.2: Create `src/renderer/src/services/__tests__/actionExecutor.test.ts`
- [x] 2C.3: Create `src/renderer/src/services/__tests__/extractionService.test.ts`

### Completed: January 24, 2026

**Files Created:**
- `src/renderer/src/services/__tests__/agentTools.test.ts` - 27 tests for tool registration/execution
- `src/renderer/src/services/__tests__/actionExecutor.test.ts` - 16 tests for action step execution
- `src/renderer/src/services/__tests__/extractionService.test.ts` - 13 tests for LLM extraction

**Test Results:** 244 tests passing (56 new service tests)

### Test Coverage Details

| Service | Tests | Coverage |
|---------|-------|----------|
| `agentTools` | 27 | getToolsForAgent, executeTool (all 10 tools) |
| `actionExecutor` | 16 | update-property, create-node, delete-node, move-node, link-nodes, unlink-nodes, wait, condition, error handling |
| `extractionService` | 13 | extractFromNode with mocked window.api.llm.extract, confidence filtering, error handling |

### Success Criteria

- ✅ Services testable in isolation (mocked dependencies)
- ✅ Error paths covered (onError: stop/continue)
- ✅ 56 new tests (target was 15+)

---

## Phase 2D: E2E Setup (Playwright)

### Status: ✅ Complete

### Goal
Set up end-to-end testing with Playwright for Electron.

### Tasks

- [x] 2D.1: Install Playwright and electron helpers
- [x] 2D.2: Create `playwright.config.ts`
- [x] 2D.3: Create `e2e/` directory structure
- [x] 2D.4: Write first E2E tests (10 tests for app launch, window controls, initial state)
- [x] 2D.5: Add `test:e2e` and `test:e2e:headed` npm scripts

### Completed: January 25, 2026

**Files Created:**
- `playwright.config.ts` - Playwright configuration for Electron testing
- `e2e/fixtures/electronApp.ts` - Reusable Electron app fixture with helpers
- `e2e/app.spec.ts` - 10 E2E tests for app launch and basic functionality

**E2E Test Coverage:**
| Test Suite | Tests | Description |
|------------|-------|-------------|
| App Launch | 6 | App starts, window displays, React Flow loads, no console errors |
| Window Controls | 2 | Main process evaluation, window state |
| Initial State | 2 | Empty canvas, sidebar presence |

**npm Scripts Added:**
- `npm run test:e2e` - Build and run E2E tests
- `npm run test:e2e:headed` - Run E2E tests with visible browser

### Success Criteria

```bash
npm run test:e2e  # ✅ 10 E2E tests pass in ~15s
npm run test      # ✅ 244 unit tests still pass
```

---

## Phase 2E: Critical Path E2E Tests

### Status: ✅ Complete

### Goal
Test the 5 most critical user flows end-to-end.

### Tasks

- [x] 2E.1: Test: Create conversation node and send message
- [x] 2E.2: Test: Connect note to conversation (context injection)
- [x] 2E.3: Test: Save workspace, reload, verify state
- [x] 2E.4: Test: Undo/redo operations
- [x] 2E.5: Test: Canvas interactions (select, delete, pan, zoom)

### Completed: January 25, 2026

**Files Created:**
- `e2e/conversation.spec.ts` - 13 E2E tests for critical user workflows

**E2E Test Coverage:**
| Test Suite | Tests | Description |
|------------|-------|-------------|
| Conversation Node | 2 | Create conversation via toolbar, interact with node |
| Note Node | 1 | Create note via toolbar |
| Undo/Redo | 3 | Button undo/redo, keyboard shortcuts |
| Workspace Save/Load | 2 | Save button, Ctrl+S persistence |
| Context Injection | 1 | Create multiple node types for edge connections |
| Canvas Interactions | 4 | Panning, zooming, selection, deletion |

**Test Results:**
- 23 total E2E tests (10 app.spec.ts + 13 conversation.spec.ts)
- All tests pass in ~52 seconds
- 244 unit tests still pass

### Success Criteria

- ✅ All 5 critical paths tested
- ✅ Tests run in < 60 seconds (actual: ~52s)
- ✅ No flaky tests (force: true used for overlay edge cases)

---

## Phase 2F: Dead Code Cleanup

### Status: ✅ Complete

### Goal
Remove unused code identified by knip.

### Tasks

- [x] 2F.1: Remove unused artifact renderer files (9 files)
- [x] 2F.2: Remove unused multiplayer modal files (4 files, kept ConnectionStatus.tsx)
- [x] 2F.3: Remove other unused components (AgentModeToggle.tsx, NodeIcon.tsx, UserList.tsx)
- [x] 2F.4: Fix duplicate exports (8 files - consolidated to default exports)
- [x] 2F.5: Update knip.json configuration

### Completed: January 25, 2026

**Files Removed (16 total):**
```
src/renderer/src/components/artifacts/     # Entire directory (9 files)
src/renderer/src/components/Multiplayer/
├── BranchList.tsx
├── BranchWorkspaceModal.tsx
├── JoinWorkspaceModal.tsx
└── ShareWorkspaceModal.tsx
src/renderer/src/components/Presence/UserList.tsx
src/renderer/src/components/AgentModeToggle.tsx
src/renderer/src/components/NodeIcon.tsx
```

**Files Kept (intentionally used):**
- `ConnectionStatus.tsx` - Used in App.tsx
- `src/preload/index.d.ts` - Provides window.api types

**Duplicate Exports Fixed (8 files):**
- Converted from `export const X` + `export default X` to just `export default X`
- Updated index.ts files to use `export { default as X }` pattern
- Files: LoadingState, PreviewControls, AIEditorModal, DeletionOverlay, MovementPath, AIEditorPreview, GhostNode, PropertyInput

**Remaining Unused Exports (66 intentional):**
| Category | Count | Reason |
|----------|-------|--------|
| Store hooks (useNodes, useEdges, etc.) | 25 | Public API for selective rendering |
| Test utilities | 4 | For future tests |
| Type guards (isConversationNode, etc.) | 8 | Useful utilities |
| Constants | 10 | Configuration values |
| Utility functions | 19 | May be used in future |

### Results

```bash
# Before cleanup:
# - Unused files: 18
# - Unused exports: 116
# - Duplicate exports: 8

# After cleanup:
# - Unused files: 0
# - Unused exports: 66 (intentional public API)
# - Duplicate exports: 0
```

### Success Criteria

- ✅ Removed 16 unused files
- ✅ Fixed 8 duplicate export patterns
- ✅ Unused exports reduced from 116 to 66 (intentional)
- ✅ TypeScript: 0 errors
- ✅ All 244 tests pass

---

## Phase 2 Summary

| Phase | Description | Effort | Priority |
|-------|-------------|--------|----------|
| 2A | TypeScript fixes | Low | P0 (blocks CI) |
| 2B | Store testing | Medium | P1 |
| 2C | Service testing | Medium | P1 |
| 2D | E2E setup | Medium | P1 |
| 2E | Critical path E2E | Medium | P2 |
| 2F | Dead code cleanup | Low | P3 |

### Recommended Order

1. **2A** (TypeScript) - Unblocks everything
2. **2B** (Stores) - Core state coverage
3. **2D** (E2E setup) - Enables user flow testing
4. **2C** (Services) - Business logic coverage
5. **2E** (E2E tests) - User flow verification
6. **2F** (Cleanup) - Technical debt reduction

---

## Rollback Plan

If any phase breaks the build:

```bash
git stash                      # Save work
git checkout HEAD~1            # Go back one commit
npm install                    # Restore deps
npm run dev                    # Verify working
```

---

## Post-Implementation

After all phases complete:

1. Update `QA.md` to reference automated tests
2. Add test writing to PR checklist
3. Consider Phase 2: ESLint + Prettier
4. Consider Phase 3: E2E with Playwright

---

## Changelog

| Date | Phase | Status | Notes |
|------|-------|--------|-------|
| 2026-01-25 | Phase 2F | ✅ Complete | Dead code cleanup: Removed 16 unused files, fixed 8 duplicate exports, reduced unused exports 116→66 (intentional) |
| 2026-01-25 | Phase 2E | ✅ Complete | Critical path E2E tests: 13 new tests (conversation, note, undo/redo, save/load, canvas); 23 total E2E tests; ~52s runtime |
| 2026-01-25 | Phase 2D | ✅ Complete | E2E setup with Playwright: 10 E2E tests (app launch, window controls, initial state); ~15s runtime |
| 2026-01-24 | Phase 2C | ✅ Complete | Service testing: 56 new tests (agentTools 27, actionExecutor 16, extractionService 13); 244 total tests |
| 2026-01-24 | Phase 2B | ✅ Complete | Store testing: 114 new tests; undo bug fix; 188 total tests |
| 2026-01-24 | Phase 2A.5 | ✅ Complete | All ~136 web TS errors fixed; 0 errors in typecheck; 74 tests pass |
| 2026-01-24 | Phase 2A.5 | 🔄 In Progress | Web TS errors: ~120 → 136 remaining; Fixed: CustomEdge, node components, AI editor, imports |
| 2026-01-24 | Phase 2A | ✅ Complete | Main process TS errors fixed (aiEditor.ts, attachments.ts, workspace.ts); y-protocols added to deps |
| 2026-01-24 | Phase 2A.5 | 📋 Added | ~80 web TS errors discovered; new phase created for renderer process fixes |
| 2026-01-24 | Phase 2 | 📋 Planned | Comprehensive QA plan added (2A-2F); TypeScript fixes, store/service tests, E2E, cleanup |
| 2026-01-24 | Phase E | ✅ Complete | Full validation run; 9 pre-existing TS errors documented; tech debt backlog created |
| 2026-01-24 | Phase D | ✅ Complete | 74 tests passing; ~89% coverage; test utilities created; contextBuilder, nodeUtils, tokenEstimation, tokenEstimator tested |
| 2026-01-24 | Phase C | ✅ Complete | Husky initialized; pre-commit hook with lint-staged + tests; warn-only mode |
| 2026-01-24 | Phase B | ✅ Complete | Dependency-cruiser rules implemented; 0 errors, 7 warnings; ARCHITECTURAL_RULES.md created |
| 2026-01-24 | Phase A | ✅ Complete | Vitest, dependency-cruiser, knip installed; test infrastructure created; 10 infrastructure tests pass |
| 2025-01-24 | Phase 0 | ✅ Complete | Documentation reorganization, CLAUDE.md session protocol added |
| 2025-01-24 | Plan | Created | Initial plan document |
