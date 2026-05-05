// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * V3 Foyer — Wave 3 E2E coverage.
 *
 * Wave 3 follows TWO-COMMIT TDD: each task ships a RED test commit FIRST,
 * then a fix commit, so the regression is provably guarded.
 *
 * Runs under the Electron project only (see playwright.config.ts testMatch).
 */

import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/electronApp'

/**
 * Dismiss the FirstRunSetup gate if present. The gate renders a fullscreen
 * z-9999 backdrop whenever `isElectron && connectors.length === 0 &&
 * !hasPassedFirstRunGate`, and Electron's per-user localStorage does NOT
 * carry a passing state across fresh test runs. Without this call, any
 * test that clicks a rendered node times out with "subtree intercepts
 * pointer events".
 *
 * programStore is exposed as `__programStore` under `__TEST_MODE__` in
 * main.tsx. Called from tests BEFORE the first `waitForFunction(__workspaceStore)`
 * so the gate closes before React Flow re-measures and the node is clickable.
 */
async function passFirstRunGate(window: Page): Promise<void> {
  // Wait for programStore to be exposed (main.tsx dynamic import).
  await window.waitForFunction(() => (window as { __programStore?: unknown }).__programStore)
  await window.evaluate(() => {
    const store = (
      window as {
        __programStore: {
          getState: () => { setFirstRunGatePassed: () => void }
        }
      }
    ).__programStore
    store.getState().setFirstRunGatePassed()
  })
  // Brief yield so the modal unmounts before we keep going.
  await window.waitForTimeout(50)
}

test.describe('V3 Foyer Wave 3 — E3.1 toolbar redirect + selection glow (F4)', () => {
  test('E3.1: Generate button redirects to chat bar + selection has glow', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await passFirstRunGate(window)
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Defensive: if a prior test left the AI Editor modal open, close it so
    // our `toHaveCount(0)` assertion on `#ai-editor-modal-title` is not
    // poisoned by leftover state (shared-electronApp fixture does not reset
    // workspace between tests).
    const openModal = window.locator('#ai-editor-modal-title')
    if ((await openModal.count()) > 0) {
      await window.keyboard.press('Escape')
      await window.waitForTimeout(100)
    }

    // Seed a conversation node
    const nodeId = await window.evaluate(() => {
      const store = (
        window as {
          __workspaceStore: {
            getState: () => {
              addNode: (type: string, position: { x: number; y: number }) => string
            }
          }
        }
      ).__workspaceStore.getState()
      return store.addNode('conversation', { x: 300, y: 300 })
    })

    // Click the react-flow node wrapper (React Flow's click handler sits here)
    // to ensure it becomes the sole selected node, not just a visual click on
    // the inner .cognograph-node div.
    const wrapper = window.locator(`.react-flow__node[data-id="${nodeId}"]`).first()
    await wrapper.click()
    await window.waitForTimeout(200)

    // Contextual bar should be visible (renders when exactly 1 node selected
    // and type is artifact/conversation/note).
    const bar = window.locator('.contextual-bar').first()
    await expect(bar).toBeVisible()

    // Click "Generate"
    await bar.locator('button:has-text("Generate")').click()
    await window.waitForTimeout(200)

    // POST-FIX expectations (these fail RED pre-fix):
    //   1. Contextual bar dismissed (becomes null after setDismissed(true))
    //   2. Bottom command bar input focused + prefilled with "Generate content..."
    //   3. No AI Editor modal visible (openModal was NOT called)
    //   4. Selected node has non-'none' box-shadow glow

    // 1. Contextual bar dismissed
    await expect(bar).not.toBeVisible()

    // 2. Bottom command bar input focused + prefilled
    const input = window.locator('.bottom-command-bar__input').first()
    await expect(input).toBeFocused()
    const value = await input.inputValue()
    expect(value).toMatch(/^Generate content for the selected node:/)

    // 3. No AI Editor modal visible
    //    AIEditorModal uses id="ai-editor-modal-title" on its heading.
    const modalHeading = window.locator('#ai-editor-modal-title')
    await expect(modalHeading).toHaveCount(0)

    // 4. Selection glow: box-shadow on .cognograph-node.selected is NOT 'none'
    const node = window
      .locator(`.react-flow__node[data-id="${nodeId}"] .cognograph-node`)
      .first()
    const shadow = await node.evaluate((el) => getComputedStyle(el as HTMLElement).boxShadow)
    expect(shadow).not.toBe('none')
    expect(shadow).toMatch(/rgba?\(/)
  })
})

test.describe('V3 Foyer Wave 3 — E3.3 Exit Interact button moved to header (R11)', () => {
  // Double-click → setTerminalInteractMode(true) → hover flag flip races with
  // click dispatch on some machines. Two retries cover the flake without
  // papering over the assertion.
  test.describe.configure({ retries: 2 })

  test('E3.3: Exit Interact button lives in cognograph-node__header, not as overlay', async ({
    window,
  }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await passFirstRunGate(window)
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed a terminal node
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
      const id = store.addNode('conversation', { x: 400, y: 300 })
      store.updateNode(id, { mode: 'terminal' })
      return id
    })

    // Scope every locator to THIS node's wrapper — the shared-electronApp
    // fixture leaks state across tests, so unscoped selectors collide with
    // terminal nodes left over from E3.2.
    const wrapper = window.locator(`.react-flow__node[data-id="${nodeId}"]`).first()
    await wrapper.waitFor({ state: 'visible' })

    // Click to select, then double-click to enter interact mode. Double-click
    // on the node body flips setTerminalInteractMode(true) via the drag
    // overlay's onDoubleClick handler.
    await wrapper.click()
    await window.waitForTimeout(100)
    const body = wrapper.locator('.cognograph-node__body').first()
    if ((await body.count()) > 0) {
      await body.dblclick()
    } else {
      await wrapper.dblclick()
    }
    await window.waitForTimeout(250)

    // POST-FIX expectations (RED pre-fix):
    //   1. Exit button has aria-label="Exit interaction mode"
    //   2. Exit button is inside .cognograph-node__header (NOT as an overlay
    //      positioned by `absolute top-2 right-2`)
    //   3. The old overlay button (matched by its classname pattern) is gone
    //   4. Clicking the new header button exits interact mode

    const headerExitBtn = wrapper
      .locator('.cognograph-node__header button[aria-label="Exit interaction mode"]')
      .first()
    await expect(headerExitBtn).toBeVisible()

    // Old overlay button — scoped to THIS wrapper so we don't catch
    // unrelated absolute-positioned buttons elsewhere in the workspace.
    // Pre-fix this matches the real button; post-fix count must be 0.
    const legacyOverlay = wrapper
      .locator('button.absolute.top-2.right-2:has-text("Exit Interact")')
      .first()
    await expect(legacyOverlay).toHaveCount(0)

    // Click the new button — interact mode should exit, header button hides.
    await headerExitBtn.click()
    await window.waitForTimeout(200)
    await expect(headerExitBtn).toHaveCount(0)
  })
})

test.describe('V3 Foyer Wave 3 — E3.2 CLI context edge animation (F5)', () => {
  test('E3.2: setContextFlowing animates incoming edges', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await passFirstRunGate(window)
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed 2 notes + 1 terminal with edges note->terminal.
    // addEdge accepts a Connection (source/target/sourceHandle/targetHandle).
    // Edges are internally stamped type:'custom' — no type field in Connection.
    const terminalId = await window.evaluate(() => {
      const store = (
        window as {
          __workspaceStore: {
            getState: () => {
              addNode: (type: string, position: { x: number; y: number }) => string
              updateNode: (id: string, patch: Record<string, unknown>) => void
              addEdge: (connection: {
                source: string
                target: string
                sourceHandle: string | null
                targetHandle: string | null
              }) => void
            }
          }
        }
      ).__workspaceStore.getState()
      const n1 = store.addNode('note', { x: 100, y: 100 })
      const n2 = store.addNode('note', { x: 100, y: 300 })
      const t = store.addNode('conversation', { x: 500, y: 200 })
      store.updateNode(t, { mode: 'terminal' })
      store.addEdge({ source: n1, target: t, sourceHandle: null, targetHandle: null })
      store.addEdge({ source: n2, target: t, sourceHandle: null, targetHandle: null })
      return t
    })

    // Trigger context-flowing via store directly. Pre-fix, setContextFlowing
    // does not exist → evaluate throws TypeError → test fails RED.
    await window.evaluate((id) => {
      ;(
        window as {
          __workspaceStore: {
            getState: () => { setContextFlowing: (id: string, flowing: boolean) => void }
          }
        }
      ).__workspaceStore
        .getState()
        .setContextFlowing(id, true)
    }, terminalId)
    // Wait for React to re-render the <path> with the new className
    await window.waitForTimeout(100)

    // Class lives on `.react-flow__edge-path`, NOT `.react-flow__edge`.
    // See CustomEdge.tsx + animations.css:91.
    await expect(window.locator('.react-flow__edge-path.context-flowing')).toHaveCount(2, {
      timeout: 2000,
    })

    // Clear
    await window.evaluate((id) => {
      ;(
        window as {
          __workspaceStore: {
            getState: () => { setContextFlowing: (id: string, flowing: boolean) => void }
          }
        }
      ).__workspaceStore
        .getState()
        .setContextFlowing(id, false)
    }, terminalId)

    await expect(window.locator('.react-flow__edge-path.context-flowing')).toHaveCount(0, {
      timeout: 2000,
    })
  })
})
