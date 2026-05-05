// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * V3 Foyer — Wave 1 E2E coverage.
 *
 * One spec per Wave 1 regression that has a behavioral (not purely visual)
 * signature. Runs under the Electron project only (see playwright.config.ts
 * testMatch).
 *
 * Task 1.2 / E1.2 intentionally omitted — see commit c50ca2e for the R3 fix
 * and rationale. The "infinite loop" bug described in the megaplan is
 * unreachable in the current tree due to the htmlIframeAutoSizedRef gate at
 * ArtifactNode.tsx:346, so no behavioral E2E exists.
 */

import { expect, test } from './fixtures/electronApp'

test.describe('V3 Foyer Wave 1 — E1.3 light mode text color (R8)', () => {
  test('E1.3: light mode --node-text-primary is Cognograph warm charcoal #1A1816', async ({
    window,
  }) => {
    // Setup: wait for canvas + workspaceStore
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(
      () => typeof (window as { __workspaceStore?: unknown }).__workspaceStore !== 'undefined',
    )

    // Switch to light theme via workspaceStore.setThemeMode. The plan's spec
    // said uiStore.setThemeSettings, but App.tsx:497 reads themeSettings from
    // workspaceStore (line 5614 setThemeMode action), not uiStore. uiStore has
    // its own themeSettings but nothing subscribes to it for the data-theme
    // attribute.
    await window.evaluate(() => {
      const store = (
        window as {
          __workspaceStore: {
            getState: () => {
              setThemeMode: (mode: 'light' | 'dark', source?: 'system' | 'manual') => void
            }
          }
        }
      ).__workspaceStore
      const state = store.getState()
      if (typeof state.setThemeMode !== 'function') {
        throw new Error(
          'setThemeMode action missing — grep workspaceStore.ts for the current signature',
        )
      }
      state.setThemeMode('light', 'manual')
    })

    // Wait for App.tsx:643 effect to write data-theme to document.body.
    // CRITICAL: attribute lives on body, NOT documentElement.
    await window.waitForFunction(() => document.body.getAttribute('data-theme') === 'light')

    // Seed a note node with a visible title so we can read its rendered color.
    await window.evaluate(() => {
      const store = (
        window as {
          __workspaceStore: {
            getState: () => {
              addNode: (type: string, position: { x: number; y: number }) => string
              updateNode: (nodeId: string, data: Record<string, unknown>) => void
            }
          }
        }
      ).__workspaceStore.getState()
      const id = store.addNode('note', { x: 300, y: 300 })
      store.updateNode(id, { title: 'Test Title' })
    })

    // Assertion 1: the CSS custom property resolves to the brand warm charcoal.
    // CSS selectors match from any ancestor, but the data-theme attribute lives
    // on body, so we read computed style off body.
    const value = await window.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--node-text-primary').trim(),
    )
    expect(value.toLowerCase()).toBe('#1a1816')

    // Assertion 2: the rendered node title uses the brand color, not gray-900.
    const titleLocator = window.locator('.cognograph-node__title').first()
    await titleLocator.waitFor({ state: 'visible', timeout: 3000 })
    const titleColor = await titleLocator.evaluate(
      (el) => getComputedStyle(el as HTMLElement).color,
    )
    expect(titleColor).toBe('rgb(26, 24, 22)') // #1A1816
  })
})

test.describe('V3 Foyer Wave 1 — E1.4 parallel spawn race guard (F8)', () => {
  // Retry budget: keep permissive so slow cold-start doesn't mask a real fix.
  test.describe.configure({ retries: 2 })

  test('E1.4: two parallel terminal.spawn calls for the same nodeId yield exactly one pty.spawn', async ({
    window,
    electronApp,
  }) => {
    // Setup: wait for canvas + workspaceStore (ensures the preload API surface
    // is attached to window.api before we invoke terminal.spawn).
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(
      () => typeof (window as { __workspaceStore?: unknown }).__workspaceStore !== 'undefined',
    )
    await window.waitForFunction(
      () =>
        typeof (window as { api?: { terminal?: { spawn?: unknown } } }).api?.terminal?.spawn ===
        'function',
    )

    // The plan's spec used `getSessionCount`, which is tautological — the
    // `sessions` Map is keyed by nodeId, so set() overwrites and has() is
    // 0-or-1 regardless of race outcome. We instead track `pty.spawn()`
    // INVOCATIONS via a per-node counter incremented immediately before the
    // node-pty call. A guard failure produces spawnCount >= 2.
    //
    // Rationale for not relying on ConversationNode StrictMode double-mount:
    //   - LazyTerminalPanel only loads when the node is isExpanded=true, which
    //     is local React state that's hard to reach from Playwright evaluate.
    //   - Expand is gated by zoom level via showInteractiveControls.
    //   - StrictMode double-mount timing is non-deterministic under load.
    //
    // The guard's job is "if two async spawn() calls race for the same nodeId,
    // only one PTY gets created". Whether the race is caused by StrictMode,
    // rapid user clicks, or two parallel IPC calls is irrelevant — the spin-
    // wait serializes them all. We test the guard DIRECTLY by firing two
    // IPC calls in parallel.
    const tmApiShape = await electronApp.evaluate(({ app: _app }) => {
      const tm = (globalThis as { __terminalManagerTestApi?: Record<string, unknown> })
        .__terminalManagerTestApi
      if (!tm) {
        throw new Error(
          '__terminalManagerTestApi missing — terminalManager.ts must expose it under NODE_ENV=test',
        )
      }
      return {
        hasGetPtySpawnCount: typeof tm.getPtySpawnCount === 'function',
        hasResetSpawnCounts: typeof tm.resetSpawnCounts === 'function',
        keys: Object.keys(tm),
      }
    })
    expect(
      tmApiShape.hasGetPtySpawnCount,
      `__terminalManagerTestApi.getPtySpawnCount missing. Found keys: ${tmApiShape.keys.join(', ')}`,
    ).toBe(true)

    // Reset counters to isolate this test from any prior terminal activity.
    await electronApp.evaluate(() => {
      const tm = (
        globalThis as { __terminalManagerTestApi: { resetSpawnCounts: () => void } }
      ).__terminalManagerTestApi
      tm.resetSpawnCounts()
    })

    // Fire two parallel terminal.spawn calls for the same nodeId from the
    // renderer. Without the race guard, both racers pass the initial
    // `sessions.get(nodeId)` check (because neither has set() yet) and both
    // invoke `pty.spawn()`. With the guard, the second call sees
    // `spawningNodeIds.has(id) === true` and spin-waits until the first
    // finishes, then returns the existing session.
    const nodeId = `e1-4-race-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await window.evaluate(async (id) => {
      const api = (
        window as {
          api: {
            terminal: {
              spawn: (cfg: {
                nodeId: string
                sessionId: string
                cols?: number
                rows?: number
                shell?: string
                nodeTitle?: string
                cwd?: string
              }) => Promise<unknown>
              kill: (nodeId: string) => Promise<void>
            }
          }
        }
      ).api
      const mk = (): Promise<unknown> =>
        api.terminal.spawn({
          nodeId: id,
          sessionId: `sess-${id}`,
          cols: 80,
          rows: 24,
          shell: 'pwsh',
          nodeTitle: 'E1.4',
          cwd: undefined,
        })
      // Settle both so a guarded failure doesn't leave the test hanging.
      await Promise.allSettled([mk(), mk()])
      // Best-effort cleanup so the PTY doesn't linger across tests.
      try {
        await api.terminal.kill(id)
      } catch {
        // ignore
      }
    }, nodeId)

    // Assertion: exactly ONE pty.spawn invocation for this nodeId.
    // Pre-fix expectation: 2 (both racers pass the guard).
    // Post-fix expectation: 1 (spin-wait serializes the second caller).
    const spawnCount = await electronApp.evaluate(
      async ({ app: _app }, id) => {
        const tm = (
          globalThis as {
            __terminalManagerTestApi: { getPtySpawnCount: (nodeId: string) => number }
          }
        ).__terminalManagerTestApi
        return tm.getPtySpawnCount(id)
      },
      nodeId,
    )

    expect(spawnCount, `Expected exactly 1 pty.spawn for nodeId, got ${spawnCount}`).toBe(1)
  })
})

test.describe('V3 Foyer Wave 1 — E1.6 conic thinking animation (F3)', () => {
  test('E1.6a: conic gradient + transparent border when streaming', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed a conversation node in terminal mode
    const nodeId = await window.evaluate(() => {
      const store = (
        window as {
          __workspaceStore: {
            getState: () => {
              addNode: (type: string, position: { x: number; y: number }) => string
              updateNode: (id: string, patch: Record<string, unknown>) => void
            }
          }
        }
      ).__workspaceStore.getState()
      const id = store.addNode('conversation', { x: 300, y: 300 })
      store.updateNode(id, { mode: 'terminal' })
      return id
    })

    // Force streaming on (avoid needing a real PTY)
    await window.evaluate((id) => {
      ;(
        window as {
          __workspaceStore: {
            getState: () => { setStreaming: (nodeId: string, streaming: boolean) => void }
          }
        }
      ).__workspaceStore.getState().setStreaming(id, true)
    }, nodeId)
    await window.waitForTimeout(100)

    const node = window
      .locator(`.react-flow__node[data-id="${nodeId}"] .cognograph-node`)
      .first()
    await expect(node).toHaveClass(/is-thinking/, { timeout: 1000 })

    const bg = await node.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundImage)
    expect(bg).toContain('conic-gradient')

    const border = await node.evaluate((el) => getComputedStyle(el as HTMLElement).borderColor)
    expect(border).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)/)
  })

  test('E1.6b: hover and select do not mask conic gradient', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed terminal node + force streaming
    const nodeId = await window.evaluate(() => {
      const store = (
        window as {
          __workspaceStore: {
            getState: () => {
              addNode: (type: string, position: { x: number; y: number }) => string
              updateNode: (id: string, patch: Record<string, unknown>) => void
              setStreaming: (nodeId: string, streaming: boolean) => void
            }
          }
        }
      ).__workspaceStore.getState()
      const id = store.addNode('conversation', { x: 500, y: 500 })
      store.updateNode(id, { mode: 'terminal' })
      store.setStreaming(id, true)
      return id
    })

    const node = window
      .locator(`.react-flow__node[data-id="${nodeId}"] .cognograph-node`)
      .first()
    await expect(node).toHaveClass(/is-thinking/, { timeout: 1000 })

    await node.hover()
    let bg = await node.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundImage)
    let border = await node.evaluate((el) => getComputedStyle(el as HTMLElement).borderColor)
    expect(bg).toContain('conic-gradient')
    expect(border).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)/)

    await node.click()
    await expect(node).toHaveClass(/selected/, { timeout: 500 })
    await expect(node).toHaveClass(/is-thinking/)
    bg = await node.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundImage)
    border = await node.evaluate((el) => getComputedStyle(el as HTMLElement).borderColor)
    expect(bg).toContain('conic-gradient')
    expect(border).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)/)
  })

  test('E1.6c: expanded streaming terminal does not override background to #1a1a2e', async ({
    window,
  }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed terminal node + force streaming
    const nodeId = await window.evaluate(() => {
      const store = (
        window as {
          __workspaceStore: {
            getState: () => {
              addNode: (type: string, position: { x: number; y: number }) => string
              updateNode: (id: string, patch: Record<string, unknown>) => void
              setStreaming: (nodeId: string, streaming: boolean) => void
            }
          }
        }
      ).__workspaceStore.getState()
      const id = store.addNode('conversation', { x: 800, y: 500 })
      store.updateNode(id, { mode: 'terminal' })
      store.setStreaming(id, true)
      return id
    })

    const node = window
      .locator(`.react-flow__node[data-id="${nodeId}"] .cognograph-node`)
      .first()
    await expect(node).toHaveClass(/is-thinking/, { timeout: 1000 })

    // Double-click to expand — for terminal: expand → interact mode
    await node.dblclick()
    await window.waitForTimeout(250)

    // PRE-FIX: inline style has `background: '#1a1a2e'` unconditionally when expanded
    // POST-FIX: inline style has no background prop when streaming
    const inlineBg = await node.evaluate((el) => (el as HTMLElement).style.background || '')
    expect(inlineBg.toLowerCase()).not.toContain('#1a1a2e')

    // Conic gradient still renders (from CSS class, not inline)
    const computedBg = await node.evaluate(
      (el) => getComputedStyle(el as HTMLElement).backgroundImage,
    )
    expect(computedBg).toContain('conic-gradient')

    // Toggle streaming off → is-thinking removed, inline bg reverts to #1a1a2e
    await window.evaluate((id) => {
      ;(
        window as {
          __workspaceStore: {
            getState: () => { setStreaming: (nodeId: string, streaming: boolean) => void }
          }
        }
      ).__workspaceStore.getState().setStreaming(id, false)
    }, nodeId)

    await expect(node).not.toHaveClass(/is-thinking/, { timeout: 500 })
    // When expanded AND not streaming, inline bg is #1a1a2e (may be serialized
    // as `rgb(26, 26, 46)` — Chrome normalizes hex to rgb at style read time).
    const finalBg = await node.evaluate((el) => (el as HTMLElement).style.background || '')
    const matchesHex = finalBg.toLowerCase().includes('#1a1a2e')
    const matchesRgb = /rgb\(\s*26\s*,\s*26\s*,\s*46\s*\)/.test(finalBg)
    expect(matchesHex || matchesRgb, `expected #1a1a2e or rgb(26,26,46), got: ${finalBg}`).toBe(
      true,
    )
  })
})

test.describe('V3 Foyer Wave 1 — E1.8 dead .is-active::after removal (R9)', () => {
  test('E1.8: dead .cognograph-node.is-active::after CSS rules are absent', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Walk all stylesheets and assert no rule matches .is-active::after for cognograph-node
    const hasDeadRule = await window.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (
              rule instanceof CSSStyleRule &&
              rule.selectorText &&
              rule.selectorText.includes('.cognograph-node.is-active::after')
            ) {
              return true
            }
          }
        } catch {
          // cross-origin sheets — skip
        }
      }
      return false
    })
    expect(hasDeadRule).toBe(false)

    // Positive check: bookmarked-node rule still exists under the new selector
    const hasBookmarkRule = await window.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (
              rule instanceof CSSStyleRule &&
              rule.selectorText &&
              rule.selectorText.includes('cognograph-node--bookmarked:not(.is-thinking)::after')
            ) {
              return true
            }
          }
        } catch {
          // ignore
        }
      }
      return false
    })
    expect(hasBookmarkRule).toBe(true)
  })
})

test.describe('V3 Foyer Wave 1 — E1.7 CLI spawn repositioning scope (F6)', () => {
  test('E1.7: onExternalChange run-layout scopes nodeIds to additions', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)
    // Test-only: SyncContext exposes its LocalSyncProvider subscribers via
    // __localSyncProviderTestApi.emit(data) (added in Task 1.7 Step 1).
    await window.waitForFunction(
      () =>
        (window as { __localSyncProviderTestApi?: unknown }).__localSyncProviderTestApi !==
        undefined,
    )
    await window.waitForFunction(
      () => (window as { __layoutEventsTestApi?: unknown }).__layoutEventsTestApi !== undefined,
    )
    // Wait for SyncContext's useEffect to mount and subscribe. The test APIs
    // are exposed on every render (no useEffect), but the onExternalChange
    // subscription lives inside useEffect — it can lag the API exposure.
    // Wait for a workspace to be loaded AND give the effect a frame to run.
    await window.waitForFunction(
      () =>
        (
          window as {
            __workspaceStore: { getState: () => { workspaceId: string | null } }
          }
        ).__workspaceStore.getState().workspaceId !== null,
    )
    await window.waitForTimeout(500)

    // Unique per-run node ID so the merge path always sees this as a new
    // addition (COGNOGRAPH_TEST_WORKSPACE env var isn't respected by main, so
    // the workspace file persists across test runs and a hardcoded ID would
    // be filtered as already-existing on the second run onward).
    const newNodeId = `e1-7-added-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Seed 3 note nodes at explicit positions
    await window.evaluate(() => {
      const store = (
        window as {
          __workspaceStore: {
            getState: () => {
              addNode: (type: string, position: { x: number; y: number }) => string
            }
          }
        }
      ).__workspaceStore.getState()
      store.addNode('note', { x: 100, y: 100 })
      store.addNode('note', { x: 400, y: 100 })
      store.addNode('note', { x: 700, y: 100 })
    })

    // Capture run-layout dispatches
    await window.evaluate(() => {
      ;(window as { __capturedLayoutDispatches?: unknown[] }).__capturedLayoutDispatches = []
      const layoutEvents = (window as { __layoutEventsTestApi: EventTarget }).__layoutEventsTestApi
      layoutEvents.addEventListener('run-layout', ((e: CustomEvent) => {
        ;(window as { __capturedLayoutDispatches: unknown[] }).__capturedLayoutDispatches.push(
          e.detail,
        )
      }) as EventListener)
    })

    const beforePositions = await window.evaluate(() =>
      (
        window as {
          __workspaceStore: {
            getState: () => {
              nodes: Array<{ id: string; position: { x: number; y: number } }>
            }
          }
        }
      ).__workspaceStore
        .getState()
        .nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
    )

    // Drive the SyncContext onExternalChange path via test API.
    // The autoFit timer fires 600ms after this emit.
    await window.evaluate((id) => {
      const state = (
        window as {
          __workspaceStore: {
            getState: () => {
              getWorkspaceData: () => {
                id: string
                nodes: Array<unknown>
                [k: string]: unknown
              }
            }
          }
        }
      ).__workspaceStore.getState()
      const currentData = state.getWorkspaceData()
      const merged = {
        ...currentData,
        nodes: [
          ...currentData.nodes,
          {
            id,
            type: 'note',
            position: { x: 0, y: 0 },
            data: { type: 'note', title: 'Added by MCP' },
          },
        ],
      }
      ;(
        window as {
          __localSyncProviderTestApi: { emit: (data: unknown) => void }
        }
      ).__localSyncProviderTestApi.emit(merged)
    }, newNodeId)

    // Wait 800ms — autoFit timer fires at 600ms, dispatches run-layout synchronously.
    await window.waitForTimeout(800)

    // ASSERTION 1: run-layout fired with ONLY the new node id, not the existing ones.
    const dispatches = await window.evaluate(
      () =>
        (
          window as {
            __capturedLayoutDispatches: Array<{ nodeIds: string[] }>
          }
        ).__capturedLayoutDispatches,
    )
    expect(dispatches.length).toBeGreaterThanOrEqual(1)
    const lastDispatch = dispatches[dispatches.length - 1]
    expect(lastDispatch.nodeIds).toContain(newNodeId)
    expect(lastDispatch.nodeIds).toHaveLength(1)

    // ASSERTION 2: existing node positions unchanged (defense-in-depth).
    const afterPositions = await window.evaluate(() =>
      (
        window as {
          __workspaceStore: {
            getState: () => {
              nodes: Array<{ id: string; position: { x: number; y: number } }>
            }
          }
        }
      ).__workspaceStore
        .getState()
        .nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
    )
    for (const before of beforePositions) {
      const after = afterPositions.find((n) => n.id === before.id)
      expect(after).toBeDefined()
      expect(Math.abs(after!.x - before.x)).toBeLessThan(0.5)
      expect(Math.abs(after!.y - before.y)).toBeLessThan(0.5)
    }
  })
})
