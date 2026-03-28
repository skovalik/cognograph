# Cognograph Web QA Report

**Date:** 2026-03-24
**Branch:** feature/v3-chrome
**Commit:** db3cfa1
**Tests:** 1508/1508 passing (93 files)
**Build:** `npm run build:web` clean, 6/6 pre-rendered pages

---

## Flows

| Flow | Result | Notes |
|------|--------|-------|
| **A (Anonymous)** | PASS | Canvas loads, node creation via Add button, typing, chat sends/responds, second node, drag — all work. Zero JS exceptions. |
| **B (BYOK)** | PASS | Settings popover accessible (gear icon). Connectors tab has LLM provider config with API key inputs. Provider selector shows Anthropic/OpenAI/Gemini/Ollama/Custom in chat nodes. |
| **C (Returning)** | PASS | 2 nodes created → page reload → 2 nodes persist via IndexedDB. Chat history preserved. |
| **D (Responsive)** | PASS | No horizontal scroll at 375/768/1024/1440px. Canvas visible and usable at all breakpoints. Landing page responsive at all breakpoints. |
| **E (Edge Cases)** | PASS | Rapid-create 5 nodes (no crash). Page refresh recovery. All 4 legal pages load (/terms, /privacy, /acceptable-use, /refunds). |

---

## Fixes Applied

### Critical (blocking)

1. **`d6d8841` — Web build fails: missing exports**
   `chatToolService.ts` imported `registerExternalStreamHandler`, `unregisterExternalStreamHandler`, `getChatToolDefinitions` that didn't exist. Added external stream handler registry to `agentService.ts` and `getChatToolDefinitions()` to `agentTools.ts`.

2. **`fe3d466` — Workspace never saved (web)**
   `SyncContext.tsx` had an `isFirstChange` guard that skipped the first `isDirty` subscriber fire. Zustand subscribe-with-selector only fires on value changes (not on subscription), so this guard swallowed the first real save trigger. Nodes disappeared on reload.

3. **`db3cfa1` — Stale data in debounced save**
   `LocalSyncProvider.save()` captured workspace data at queue time but debounced for 2s. Changes during the debounce window were lost. Now re-reads fresh state from `workspaceStore` at execution time.

### Medium

4. **`56122b7` — Settings adapter type mismatch**
   Web `settingsAdapter` returned `IPCResponse<string>` wrappers but preload interface returns raw `string|null`. `ConnectorsTab.tsx` called `.slice()` on the wrapper object → `storedToken.slice is not a function`. Fixed adapter to return raw values.

### Housekeeping

5. **`bda4176` — Gitignore for generated files** (.cognograph-context.md, .mcp.json, test screenshots, base64 temp files)
6. **`3003a85` — Project governance** (CODE_OF_CONDUCT.md, SECURITY.md, robots.txt, og-image.jpg)
7. **`f8ec2ba` — Plan documents** (12 implementation plans committed)
8. **`e98a916` — Design mockups + code** (3 design system HTML iterations, useLongPress hook, prerender script)

---

## Known Issues (non-blocking)

1. **404 console errors** — Supabase `app_events` endpoint returns 404 in dev (analytics not configured locally). Non-blocking.
2. **ERR_CONNECTION_REFUSED** — Localhost agent probe (`localhost:19836/health`) fails in headless testing. Expected — no local agent running.
3. **Double-click on empty canvas** doesn't create nodes — creation only via toolbar "Add node" button. This is by design for web (prevents accidental creates on touch devices).
4. **Chat requires API key** — Chat sends "Sorry, an error occurred" without a configured API key. This is correct BYOK behavior — user must provide their own key via Settings → Connectors.
5. **Text selection in canvas-view chat bubbles** — CSS `user-select: text` is applied, but drag-selection may be intercepted by React Flow panning. Works in expanded artboard view. Low priority.

---

## Ready for Stefan: YES

Canvas URL: `http://localhost:5174/app` (or whatever port Vite assigns)
Landing page: `http://localhost:5174/`
