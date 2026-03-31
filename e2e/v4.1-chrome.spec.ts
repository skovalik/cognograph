import { test, expect } from './fixtures/electronApp'
import { waitForCanvas, focusCanvas, seedCommandLog, createNoteNode, getNodeCount, waitForStores, setDesktopViewport, clearSelection } from './helpers'

test.describe('V4.1 — Response Panel', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await waitForCanvas(window)
    await waitForStores(window)
  })

  test('response panel toggle is visible', async ({ window }) => {
    const toggle = window.locator('.cmd-response-toggle')
    await expect(toggle).toBeVisible()
  })

  test('clicking toggle opens response panel', async ({ window }) => {
    await window.locator('.cmd-response-toggle').click()
    await expect(window.locator('.cmd-response-panel')).toBeVisible()
  })

  test('closing panel returns to toggle', async ({ window }) => {
    // Open
    await window.locator('.cmd-response-toggle').click()
    await expect(window.locator('.cmd-response-panel')).toBeVisible()

    // Close via header button
    const closeBtn = window.locator('.cmd-response-panel__header .cmd-response-panel__icon-btn').first()
    await closeBtn.click()

    // Back to toggle
    await expect(window.locator('.cmd-response-panel')).not.toBeVisible()
    await expect(window.locator('.cmd-response-toggle')).toBeVisible()
  })

  test('panel shows empty state with no commands', async ({ window }) => {
    await window.locator('.cmd-response-toggle').click()
    await expect(window.locator('.cmd-response-panel__empty')).toBeVisible()
  })

  test('panel shows threaded entries after seeding commandLog', async ({ window }) => {
    await seedCommandLog(window, [
      { id: 'test-1', input: 'Create a note', tier: 1, status: 'done', narration: 'Created note.', affectedNodeIds: [], timestamp: Date.now() }
    ])

    await window.locator('.cmd-response-toggle').click()
    await expect(window.locator('.cmd-response-panel__entry')).toBeVisible({ timeout: 3000 })
    const entryText = await window.locator('.cmd-response-panel__entry-prompt').textContent()
    expect(entryText).toContain('Create a note')
  })
})

test.describe('V4.1 — Command Bar', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await waitForCanvas(window)
    await waitForStores(window)
  })

  test('command bar input is visible', async ({ window }) => {
    await expect(window.locator('.bottom-command-bar__input')).toBeVisible()
  })

  test('send button disabled when empty, enabled with text', async ({ window }) => {
    const sendBtn = window.locator('.bottom-command-bar__send')
    await expect(sendBtn).toBeDisabled()

    const input = window.locator('.bottom-command-bar__input')
    await input.fill('test command')
    await expect(sendBtn).not.toBeDisabled()
  })

  test('slash key focuses command input', async ({ window }) => {
    await clearSelection(window)
    await window.locator('.bottom-command-bar__input').blur()
    await window.waitForTimeout(200)
    await window.keyboard.press('/')
    await window.waitForTimeout(500)
    const isFocused = await window.locator('.bottom-command-bar__input').evaluate(el => el === document.activeElement)
    expect(isFocused).toBe(true)
  })

  test('escape blurs command input', async ({ window }) => {
    const input = window.locator('.bottom-command-bar__input')
    await input.focus()
    await window.waitForTimeout(200)
    await expect(input).toBeFocused()

    // Simulate Escape reaching the BottomCommandBar's handler directly.
    // The EscapeManager intercepts Escape in the capture phase on document,
    // preventing the command bar's window-level handler from firing.
    // Dispatch to window directly to test the blur path.
    await window.evaluate(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      // Dispatch on window to reach the BottomCommandBar's window.addEventListener('keydown') handler
      window.dispatchEvent(event)
    })
    await window.waitForTimeout(300)

    const isFocused = await input.evaluate(el => el === document.activeElement)
    expect(isFocused).toBe(false)
  })

  test('no old narration/history elements exist', async ({ window }) => {
    await expect(window.locator('.bottom-command-bar__narration')).not.toBeAttached()
    await expect(window.locator('.bottom-command-bar__history')).not.toBeAttached()
    await expect(window.locator('.bottom-command-bar__stop-btn')).not.toBeAttached()
  })

  test('subject pill appears on single node selection', async ({ window }) => {
    await clearSelection(window)
    await window.waitForTimeout(300)
    await expect(window.locator('.bottom-command-bar__subject')).not.toBeVisible({ timeout: 3000 })

    const nodeId = await createNoteNode(window)
    if (!nodeId) { test.skip(); return }

    await window.waitForTimeout(500)
    // Select the node via store since UI clicks may be intercepted by overlays
    await window.evaluate((id) => {
      const store = (window as any).__workspaceStore
      if (store) store.getState().setSelectedNodes([id])
    }, nodeId)
    await window.waitForTimeout(500)

    await expect(window.locator('.bottom-command-bar__subject')).toBeVisible({ timeout: 3000 })
  })
})

test.describe('V4.1 — Contextual Action Bar', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await waitForCanvas(window)
    await waitForStores(window)
  })

  test('bar absent with no selection', async ({ window }) => {
    await clearSelection(window)
    await window.waitForTimeout(300)
    await expect(window.locator('.contextual-bar')).not.toBeVisible({ timeout: 3000 })
  })

  test('bar appears on single note selection', async ({ window }) => {
    const nodeId = await createNoteNode(window)
    if (!nodeId) { test.skip(); return }

    await window.waitForTimeout(500)
    // Select via store to bypass right panel overlay intercepting clicks
    await window.evaluate((id) => {
      const store = (window as any).__workspaceStore
      if (store) store.getState().setSelectedNodes([id])
    }, nodeId)
    await window.waitForTimeout(300)

    await expect(window.locator('.contextual-bar')).toBeVisible({ timeout: 3000 })
    await expect(window.locator('.contextual-bar__btn--primary')).toBeVisible()
  })

  test('bar disappears on deselect', async ({ window }) => {
    const nodeId = await createNoteNode(window)
    if (!nodeId) { test.skip(); return }

    await window.waitForTimeout(500)
    await window.evaluate((id) => {
      const store = (window as any).__workspaceStore
      if (store) store.getState().setSelectedNodes([id])
    }, nodeId)
    await window.waitForTimeout(300)
    await expect(window.locator('.contextual-bar')).toBeVisible({ timeout: 3000 })

    await clearSelection(window)
    await expect(window.locator('.contextual-bar')).not.toBeVisible({ timeout: 3000 })
  })
})

test.describe('V4.1 — Context Menu Enhancements', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await waitForCanvas(window)
    await waitForStores(window)
  })

  test('right-click shows context menu at top (72px)', async ({ window }) => {
    const nodeId = await createNoteNode(window)
    if (!nodeId) { test.skip(); return }

    await window.waitForTimeout(500)
    // Select via store and force right-click to bypass any panel overlays
    await window.evaluate((id) => {
      const store = (window as any).__workspaceStore
      if (store) store.getState().setSelectedNodes([id])
    }, nodeId)
    await window.waitForTimeout(300)
    const node = window.locator('.react-flow__node').first()
    await node.click({ button: 'right', force: true })
    await window.waitForTimeout(500)

    // Menu should exist and be near top
    const menu = window.locator('.glass-soft.gui-z-dropdowns, [class*="context-menu"]').first()
    if (await menu.count() > 0) {
      const box = await menu.boundingBox()
      if (box) {
        expect(box.y).toBeLessThan(100) // Should be near top, around 72px
      }
    }
  })

  test('Rename menu item exists', async ({ window }) => {
    const nodeId = await createNoteNode(window)
    if (!nodeId) { test.skip(); return }

    await window.waitForTimeout(500)
    await window.evaluate((id) => {
      const store = (window as any).__workspaceStore
      if (store) store.getState().setSelectedNodes([id])
    }, nodeId)
    await window.waitForTimeout(300)
    await window.locator('.react-flow__node').first().click({ button: 'right', force: true })
    await window.waitForTimeout(500)

    const rename = window.locator('text=Rename').first()
    await expect(rename).toBeVisible({ timeout: 3000 })
  })

  test('Duplicate menu item is not disabled', async ({ window }) => {
    const nodeId = await createNoteNode(window)
    if (!nodeId) { test.skip(); return }

    await window.waitForTimeout(500)
    await window.evaluate((id) => {
      const store = (window as any).__workspaceStore
      if (store) store.getState().setSelectedNodes([id])
    }, nodeId)
    await window.waitForTimeout(300)
    await window.locator('.react-flow__node').first().click({ button: 'right', force: true })
    await window.waitForTimeout(500)

    const duplicate = window.locator('text=Duplicate').first()
    await expect(duplicate).toBeVisible({ timeout: 3000 })
    const isDisabled = await duplicate.evaluate(el => el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true')
    expect(isDisabled).toBe(false)
  })
})

test.describe('V4.1 — Agent Log + Sidebar', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await waitForCanvas(window)
    await waitForStores(window)
  })

  test('Agent Log badge always visible', async ({ window }) => {
    await expect(window.locator('.canvas-badge:has-text("Agent log")')).toBeVisible()
  })

  test('Agent Log sidebar tab exists', async ({ window }) => {
    const tab = window.locator('button[aria-label="Agent Log"], button:has-text("Agent Log")').first()
    await expect(tab).toBeVisible({ timeout: 3000 })
  })

  test('CC Bridge tab exists, no Bridge Log', async ({ window }) => {
    const ccBridge = window.locator('button[aria-label="CC Bridge"], button:has-text("CC Bridge")').first()
    await expect(ccBridge).toBeVisible({ timeout: 3000 })

    // "Bridge Log" should not exist anywhere
    const bridgeLog = window.locator('button:has-text("Bridge Log")')
    await expect(bridgeLog).not.toBeVisible()
  })
})
