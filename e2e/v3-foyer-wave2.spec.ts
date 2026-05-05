// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * V3 Foyer — Wave 2 E2E coverage.
 *
 * Wave 2 follows TWO-COMMIT TDD: each task ships a RED test commit FIRST,
 * then a fix commit, so the regression is provably guarded.
 *
 * Runs under the Electron project only (see playwright.config.ts testMatch).
 */

import { expect, test } from './fixtures/electronApp'

test.describe('V3 Foyer Wave 2 — E2.1 expand-btn CSS (R12)', () => {
  test('E2.1: .cognograph-node__expand-btn has reset styles', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed a conversation node — the expand-btn lives in ConversationNode header.
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
      return store.addNode('conversation', { x: 200, y: 200 })
    })

    // IMPORTANT: `.cognograph-node__expand-btn` lives inside `.node-chrome--hover`
    // which has `opacity: 0; pointer-events: none` at rest (nodes.css:113-124).
    // Hover the node first so the button becomes visible to Playwright.
    const node = window
      .locator(`.react-flow__node[data-id="${nodeId}"] .cognograph-node`)
      .first()
    await node.hover()

    const btn = node.locator('.cognograph-node__expand-btn').first()
    await expect(btn).toBeVisible({ timeout: 1000 })

    // Sanity: cursor:pointer + transparent bg + 0 border. These are set by
    // Tailwind preflight on `<button>`, so they pass either way — they exist
    // here as a low-cost belt for any preflight regression.
    const cursor = await btn.evaluate((el) => getComputedStyle(el as HTMLElement).cursor)
    expect(cursor).toBe('pointer')

    const bg = await btn.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor)
    expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(bg)

    const borderWidth = await btn.evaluate(
      (el) => getComputedStyle(el as HTMLElement).borderWidth,
    )
    expect(borderWidth).toBe('0px')

    // Real RED-vs-GREEN signal: the new BEM rule contributes flex-shrink:0 +
    // line-height:1, neither of which Tailwind preflight provides. PRE-FIX:
    // flex-shrink computes to "1" (initial), line-height to "normal"
    // (~21px for the 14px button font). POST-FIX: flex-shrink "0",
    // line-height "14px" (1 * font-size).
    const flexShrink = await btn.evaluate((el) => getComputedStyle(el as HTMLElement).flexShrink)
    expect(flexShrink).toBe('0')

    const lineHeight = await btn.evaluate((el) => getComputedStyle(el as HTMLElement).lineHeight)
    const fontSize = await btn.evaluate((el) => getComputedStyle(el as HTMLElement).fontSize)
    // line-height: 1 resolves to the same px value as font-size.
    expect(lineHeight).toBe(fontSize)
  })
})

test.describe('V3 Foyer Wave 2 — E2.2 syntax highlighting + MD wrap (F1+R1)', () => {
  test('E2.2: code artifact tokenizes; markdown artifact wraps long lines', async ({
    window,
  }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed TypeScript code artifact
    const codeId = await window.evaluate(() => {
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
      const id = store.addNode('artifact', { x: 100, y: 100 })
      store.updateNode(id, {
        contentType: 'code',
        language: 'typescript',
        content: 'const x: number = 42\nfunction greet(name: string) { return `hi ${name}` }\n',
      })
      return id
    })

    const codeNode = window
      .locator(`.react-flow__node[data-id="${codeId}"] .cognograph-node`)
      .first()
    await expect(codeNode).toBeVisible()

    // Wait for Prism to tokenize on first render
    await window.waitForTimeout(300)

    // Assertion 1: at least 3 token spans exist (Prism output).
    // PRE-FIX: zero — content rendered as plain <pre>.
    const tokenCount = await codeNode.locator('span[class*="token"]').count()
    expect(tokenCount).toBeGreaterThanOrEqual(3)

    // Seed MD artifact with very long line
    const mdId = await window.evaluate(() => {
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
      const id = store.addNode('artifact', { x: 600, y: 100 })
      store.updateNode(id, {
        contentType: 'markdown',
        content:
          'This is a very long line of text that should wrap when rendered ' +
          'x'.repeat(500) +
          ' end of long line.',
        width: 400,
      })
      return id
    })

    const mdNode = window
      .locator(`.react-flow__node[data-id="${mdId}"] .cognograph-node`)
      .first()
    await expect(mdNode).toBeVisible()
    await window.waitForTimeout(300)

    // Assertion 2: MD wraps — no horizontal overflow on the body container.
    // PRE-FIX: <pre> with whiteSpace:'pre' overflows horizontally for long lines.
    const mdBody = mdNode.locator('.cognograph-node__body').first()
    const dims = await mdBody.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }))
    expect(dims.scroll).toBeLessThanOrEqual(dims.client + 2)
  })
})

test.describe('V3 Foyer Wave 2 — E2.3 terminal single-click focus (F7)', () => {
  test('E2.3: single click on drag overlay re-enters interact mode', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed terminal node with full terminal data. Just setting `mode: 'terminal'`
    // is not enough — the expanded body only renders when `isTerminal &&
    // nodeData.terminal` (ConversationNode.tsx:998), and the terminal object
    // is normally created by the mode-switcher callback. We skip the
    // dblclick→xterm-mount path entirely: the F7 fix lives in React state
    // that the drag overlay's onClick handler is supposed to flip, so we
    // don't need a real PTY.
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
      const id = store.addNode('conversation', { x: 400, y: 400 })
      store.updateNode(id, {
        mode: 'terminal',
        terminal: {
          sessionId: crypto.randomUUID(),
          origin: 'embedded',
          workingDirectory: '',
          shell: 'claude-code',
          source: 'local',
          terminalState: 'idle',
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
          accentColor: 'var(--accent-glow)',
        },
      })
      return id
    })

    const node = window.locator(`.react-flow__node[data-id="${nodeId}"]`).first()
    await expect(node).toBeVisible()

    // Double-click to expand + enter interact mode.
    await node.dblclick()

    // The "Exit Interact" button is conditionally rendered iff
    // `terminalInteractMode === true` (ConversationNode.tsx:1078). This is a
    // direct DOM proxy for the React state we care about — no xterm dependency.
    const exitBtn = node.locator('button:has-text("Exit Interact")').first()
    await expect(exitBtn).toBeVisible({ timeout: 3000 })

    // Exit interact mode by clicking the Exit Interact button. The node stays
    // selected + expanded, so the drag overlay re-renders (because
    // `!terminalInteractMode` is now true).
    await exitBtn.click()
    await expect(exitBtn).toHaveCount(0)

    // Single click on the drag overlay (`absolute inset-0 z-10`). Click the
    // overlay locator directly — `node.click()` would click the center of the
    // outer .react-flow__node element which can land on the header chrome
    // instead of the body overlay.
    // PRE-FIX: overlay has onDoubleClick only — single click is absorbed but
    // does not re-enter interact mode, so the Exit Interact button never
    // reappears.
    // POST-FIX: overlay onClick → setTerminalInteractMode(true) → button
    // re-renders within a frame.
    const overlay = node.locator('.absolute.inset-0.z-10').first()
    await overlay.click()
    await expect(exitBtn).toBeVisible({ timeout: 1500 })
  })
})

test.describe('V3 Foyer Wave 2 — E2.4 terminal lifecycle dropdown (F2)', () => {
  test('E2.4: terminal lifecycle dropdown pins via store', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed terminal node with full terminal data including userPinned: false.
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
      store.updateNode(id, {
        mode: 'terminal',
        terminal: {
          sessionId: crypto.randomUUID(),
          origin: 'embedded',
          workingDirectory: '',
          source: 'local',
          terminalState: 'idle',
          userPinned: false,
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
          accentColor: 'var(--accent-glow)',
        },
      })
      return id
    })

    // Locate the dropdown trigger by aria-label, scoped to the new node's
    // data-id. Electron tests share workspace state, so prior tests may have
    // left other terminal nodes around; unscoped `.first()` would match an
    // old dropdown whose state is unrelated to this test.
    const trigger = window
      .locator(`.react-flow__node[data-id="${nodeId}"] button[aria-label*="Terminal session status"]`)
      .first()
    await expect(trigger).toBeVisible()

    // Open dropdown via keyboard. The React Flow viewport may scale down the
    // node at test zoom, causing sibling spans (e.g. the provider badge) to
    // overlap the trigger in hit-test space. Keyboard activation sidesteps
    // hit-testing and accurately exercises the WCAG-compliant keyboard path
    // Radix DropdownMenu supports out of the box. Menu items live in a Radix
    // portal (document.body) so they're unaffected by the node's scaling and
    // can be clicked normally.
    await trigger.focus()
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)

    // Menu is visible (Radix portal)
    const menu = window.locator('[role="menu"]').first()
    await expect(menu).toBeVisible()

    // Click "Pin (keep alive)" in the portal — scope to Pin item specifically
    // (Unpin also contains "Pin" as substring, so use the full text).
    const pinItem = window.locator('[role="menuitem"]:has-text("Pin (keep alive)")').first()
    await expect(pinItem).toBeVisible()
    await pinItem.click()
    await window.waitForTimeout(300)

    // Store reflects userPinned = true
    const pinned = await window.evaluate((id) => {
      const n = (
        window as {
          __workspaceStore: {
            getState: () => {
              nodes: Array<{ id: string; data?: { terminal?: { userPinned?: boolean } } }>
            }
          }
        }
      ).__workspaceStore
        .getState()
        .nodes.find((x) => x.id === id)
      return n?.data?.terminal?.userPinned
    }, nodeId)
    expect(pinned).toBe(true)

    // Reopen dropdown — "Unpin" should be shown instead of "Pin"
    await trigger.focus()
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)
    await expect(
      window.locator('[role="menuitem"]:has-text("Unpin (allow idle)")').first(),
    ).toBeVisible()
    // Close menu to avoid leaking state into sibling tests.
    await window.keyboard.press('Escape')
  })
})

test.describe('V3 Foyer Wave 2 — E2.5 node-chrome--hover consistency (R13)', () => {
  test('E2.5: node-chrome--hover wraps button, not button itself', async ({ window }) => {
    await window.locator('.react-flow').waitFor({ state: 'visible' })
    await window.waitForFunction(() => (window as { __workspaceStore?: unknown }).__workspaceStore)

    // Seed one conversation and one workspace node
    const ids = await window.evaluate(() => {
      const store = (
        window as {
          __workspaceStore: {
            getState: () => {
              addNode: (type: string, position: { x: number; y: number }) => string
            }
          }
        }
      ).__workspaceStore.getState()
      return {
        conv: store.addNode('conversation', { x: 100, y: 100 }),
        ws: store.addNode('workspace', { x: 400, y: 100 }),
      }
    })

    // Conversation node: first .node-chrome--hover must be a DIV (not the inner button)
    const convWrapper = window
      .locator(
        `.react-flow__node[data-id="${ids.conv}"] .cognograph-node__expand-btn, .react-flow__node[data-id="${ids.conv}"] .node-chrome--hover`,
      )
      .first()
    await expect(convWrapper).toBeVisible()

    // Scope the hover class to THIS node to avoid matching sibling fixtures.
    const convHover = window
      .locator(`.react-flow__node[data-id="${ids.conv}"] .node-chrome--hover`)
      .first()
    await expect(convHover).toBeAttached()
    const convTag = await convHover.evaluate((el) => el.tagName)
    expect(convTag).toBe('DIV')

    // Inside that wrapper, the expand button must exist
    const convBtn = convHover.locator('button.cognograph-node__expand-btn').first()
    await expect(convBtn).toBeAttached()

    // Workspace node: first .node-chrome--hover must be a DIV (not the inner span)
    const wsHover = window
      .locator(`.react-flow__node[data-id="${ids.ws}"] .node-chrome--hover`)
      .first()
    await expect(wsHover).toBeAttached()
    const wsTag = await wsHover.evaluate((el) => el.tagName)
    expect(wsTag).toBe('DIV')
  })
})
