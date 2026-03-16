# Architectural Rules

> **Automated enforcement of codebase architectural patterns using dependency-cruiser.**

---

## Overview

Cognograph uses [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) to enforce architectural boundaries and detect anti-patterns automatically. These rules run on every `npm run validate:arch` command.

---

## Rule Severity Levels

| Level | Meaning | CI Behavior |
|-------|---------|-------------|
| **error** | Critical violation - must be fixed | Blocks build |
| **warn** | Should be fixed, but doesn't block | Reports issue |
| **info** | Tracking pattern, not a violation | Reports for visibility |

---

## Core Rules (Errors)

These rules enforce the Electron process model and must never be violated.

### `no-circular`
**Severity:** error

Circular dependencies cause initialization order issues and indicate tight coupling that should be refactored.

```
❌ FORBIDDEN:
moduleA.ts → moduleB.ts → moduleA.ts
```

**Fix:** Extract shared code to a third module that both can import.

---

### `main-renderer-boundary`
**Severity:** error

Main process code must never import from renderer. They run in separate process contexts.

```
❌ FORBIDDEN:
src/main/index.ts → src/renderer/src/components/Button.tsx
```

**Fix:** If main needs data from renderer, use IPC.

---

### `renderer-main-boundary`
**Severity:** error

Renderer must never import from main directly. All communication goes through `window.api` (preload bridge).

```
❌ FORBIDDEN:
src/renderer/src/App.tsx → src/main/workspace.ts
```

**Fix:** Use `window.api.workspace.*` methods instead.

---

### `shared-purity`
**Severity:** error

Code in `src/shared/` must be pure - no imports from main or renderer. This ensures shared types/utilities remain portable.

```
❌ FORBIDDEN:
src/shared/types.ts → src/main/settings.ts
src/shared/utils.ts → src/renderer/src/stores/workspaceStore.ts
```

**Fix:** Shared code should only depend on other shared code or external packages.

---

### `preload-isolation`
**Severity:** error

Preload scripts run in an isolated context and must not import renderer code.

```
❌ FORBIDDEN:
src/preload/index.ts → src/renderer/src/stores/workspaceStore.ts
```

**Fix:** Preload only bridges between main and renderer via contextBridge.

---

## Architectural Guidelines (Warnings)

These rules identify patterns that should generally be avoided but may have valid exceptions.

### `no-orphans`
**Severity:** warn

Files not imported from anywhere might be dead code.

**Exceptions:** Entry points, declaration files, and test files are excluded.

**Fix:** Either:
1. Import the file where needed
2. Delete if truly unused

---

### `store-not-in-utils`
**Severity:** warn

Utils in `src/renderer/src/utils/` should be pure functions without store dependencies.

```
⚠️ WARNING:
src/renderer/src/utils/helper.ts → src/renderer/src/stores/workspaceStore.ts
```

**Why:** Utils become hard to test and reuse when coupled to stores.

**Fix:** Move the function to a service, or pass state as parameters.

**Current violations:**
- `mutationExecutor.ts` → `workspaceStore.ts`, `aiEditorStore.ts`
  - Reason: Executes AI editor mutations directly on stores

---

### `components-not-import-services`
**Severity:** warn

Components should use hooks/stores, not import services directly.

```
⚠️ WARNING:
src/renderer/src/components/MyComponent.tsx → src/renderer/src/services/myService.ts
```

**Why:** Direct service imports bypass the reactive update system and make testing harder.

**Fix:** Create a hook that wraps the service, or use store actions.

**Current violations:**
- `TaskNode.tsx` → `extractionService.ts`
- `NoteNode.tsx` → `extractionService.ts`
- `SuggestedAutomations.tsx` → `automationSuggester.ts`

**Exceptions:** `Canvas.tsx`, `ChatPanel.tsx`, `PropertiesPanel.tsx` are excluded as container components.

---

## Informational Rules

These rules track patterns for visibility without flagging violations.

### `services-should-use-stores`
**Severity:** info

Reports when services access stores, which is the expected pattern for services that need to read/write application state.

---

## Known Issues

### Circular: `actionTypes.ts` ↔ `types.ts`
**Status:** Tracked as warning

These files have a circular dependency that should be resolved by:
1. Consolidating into a single types file, or
2. Extracting the shared types to a third file

---

## Running Validation

```bash
# Run architectural validation
npm run validate:arch

# Run full validation (typecheck + arch + deps)
npm run validate
```

---

## Adding New Rules

Edit `.dependency-cruiser.cjs` to add rules. Each rule needs:

```javascript
{
  name: 'rule-name',
  severity: 'error' | 'warn' | 'info',
  comment: 'Why this rule exists',
  from: {
    path: '^src/path/pattern/'  // Source pattern
  },
  to: {
    path: '^src/target/pattern/'  // Target pattern
  }
}
```

See [dependency-cruiser documentation](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) for full options.

---

*Last updated: 2026-01-24*
