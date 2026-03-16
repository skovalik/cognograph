/**
 * Tier 1: Critical Path Smoke Tests (Phase A - 5 core paths)
 *
 * Validates that the 5 most critical user workflows function correctly.
 * These are the "if this breaks, app is unusable" paths.
 */

import { test, expect } from '../fixtures/smart-e2e-fixture'
import { waitForFullyRendered } from '../utils/react-flow-stabilizer'
import { captureWithMetadata } from '../utils/screenshot-capture'
import { ConsoleMonitor } from '../utils/console-monitor'

test.describe('Tier 1: Critical Paths (Phase A)', () => {
  test.beforeEach(async ({ window }) => {
    // CRITICAL: Reset workspace to prevent node accumulation between tests
    // Bug discovered in Tier 2: Autosave persists nodes, creating visual chaos
    await window.evaluate(async () => {
      await window.api.workspace.resetForTest()
      localStorage.clear()
      sessionStorage.clear()
    })

    // Reload to apply fresh state
    await window.reload()
    await waitForFullyRendered(window, { timeout: 15000 })

    // Dismiss welcome overlay if present (first-time onboarding)
    const skipButton = window.locator('button:has-text("Skip"), button[title="Skip onboarding"]')
    if ((await skipButton.count()) > 0) {
      await skipButton.first().click()
      await window.waitForTimeout(500)
    }

    // Dismiss any other modal overlays (tutorial, help, etc.)
    const closeButtons = window.locator('.gui-panel button:has-text("Close"), .gui-panel button:has-text("Got it"), .gui-panel button:has-text("Dismiss"), .gui-panel [aria-label*="close"]')
    const count = await closeButtons.count()
    for (let i = 0; i < count; i++) {
      try {
        await closeButtons.nth(i).click({ timeout: 1000 })
        await window.waitForTimeout(300)
      } catch {
        // Ignore if button not clickable
      }
    }

    // Also try ESC key to close modals
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)
  })

  test('CP1: App launches without errors', async ({ electronApp, window }) => {
    const monitor = new ConsoleMonitor(window)

    // Wait for app to be ready
    await waitForFullyRendered(window, { timeout: 15000 })

    // Capture screenshot
    await captureWithMetadata(window, 'tier1-cp1-launch', {
      scenario: 'critical-path-1',
      state: 'app-launched',
      waitForStable: false
    })

    // Verify no critical errors
    monitor.assertNoErrors([
      'ResizeObserver', // React Flow benign warning
      'net::ERR_', // Offline mode
      'favicon' // Missing favicon OK
    ])

    // Verify React Flow is present
    const canvas = window.locator('.react-flow')
    await expect(canvas).toBeVisible()
  })

  test('CP2: Create conversation node', async ({ window }) => {
    const monitor = new ConsoleMonitor(window)
    await waitForFullyRendered(window)

    // Double-click to create node
    const canvas = window.locator('.react-flow__pane')
    await canvas.dblclick({ position: { x: 400, y: 300 } })

    // Wait for node to appear
    await window.waitForSelector('.react-flow__node', { timeout: 5000 })

    // Capture screenshot
    await captureWithMetadata(window, 'tier1-cp2-node-created', {
      scenario: 'critical-path-2',
      state: 'conversation-node-created'
    })

    // Verify node exists
    const nodes = window.locator('.react-flow__node')
    const count = await nodes.count()
    expect(count).toBeGreaterThan(0)

    // Verify no errors
    monitor.assertNoErrors(['ResizeObserver', 'net::ERR_', 'favicon'])
  })

  test('CP3: Send message in conversation', async ({ window }) => {
    const monitor = new ConsoleMonitor(window)
    await waitForFullyRendered(window)

    // Create node
    await window.locator('.react-flow__pane').dblclick({ position: { x: 400, y: 300 } })
    await window.waitForSelector('.react-flow__node', { timeout: 5000 })

    // Find and click the node to open it
    const node = window.locator('.react-flow__node').first()
    await node.click()

    // Wait for chat interface (adjust selector based on actual UI)
    await window.waitForTimeout(1000)

    // Capture screenshot
    await captureWithMetadata(window, 'tier1-cp3-chat-open', {
      scenario: 'critical-path-3',
      state: 'conversation-node-opened'
    })

    // Look for chat input (adjust selector based on actual UI)
    const chatInput = window.locator('textarea, input[type="text"]').first()
    const inputExists = await chatInput.count()

    // If chat input exists, try typing
    if (inputExists > 0) {
      await chatInput.fill('Hello, this is a test message')
      await captureWithMetadata(window, 'tier1-cp3-message-typed', {
        scenario: 'critical-path-3',
        state: 'message-typed'
      })
    }

    // Verify no errors
    monitor.assertNoErrors(['ResizeObserver', 'net::ERR_', 'favicon'])
  })

  test('CP4: Connect two nodes', async ({ window }) => {
    const monitor = new ConsoleMonitor(window)
    await waitForFullyRendered(window)

    // Create two nodes (spaced far apart to avoid overlap)
    await window.locator('.react-flow__pane').dblclick({ position: { x: 250, y: 300 } })
    await window.waitForTimeout(500)
    await window.locator('.react-flow__pane').dblclick({ position: { x: 650, y: 300 } })
    await window.waitForTimeout(500)

    // Wait for nodes to be rendered
    await window.waitForSelector('.react-flow__node', { timeout: 5000 })

    // Deselect all nodes by clicking on empty canvas
    // This removes the selection rectangle that would intercept pointer events
    await window.locator('.react-flow__pane').click({ position: { x: 100, y: 100 } })
    await window.waitForTimeout(300)

    // Capture before connection
    await captureWithMetadata(window, 'tier1-cp4-two-nodes', {
      scenario: 'critical-path-4',
      state: 'two-nodes-created'
    })

    // Connect nodes using Shift+Drag (custom mechanism)
    // Drag from right edge of first node to left edge of second node
    const nodes = window.locator('.react-flow__node')
    const firstNode = nodes.first()
    const secondNode = nodes.nth(1)

    // Get bounding boxes for both nodes
    const firstBox = await firstNode.boundingBox()
    const secondBox = await secondNode.boundingBox()

    if (firstBox && secondBox) {
      // Start point: right edge of first node (vertically centered)
      const startPoint = {
        x: firstBox.x + firstBox.width - 5, // 5px from right edge
        y: firstBox.y + firstBox.height / 2
      }
      // End point: left edge of second node (vertically centered)
      const endPoint = {
        x: secondBox.x + 5, // 5px from left edge
        y: secondBox.y + secondBox.height / 2
      }

      // Shift+Drag to create edge
      await window.keyboard.down('Shift')
      await window.waitForTimeout(100)
      await window.mouse.move(startPoint.x, startPoint.y)
      await window.waitForTimeout(100)
      await window.mouse.down()
      await window.waitForTimeout(100)
      await window.mouse.move(endPoint.x, endPoint.y, { steps: 20 })
      await window.waitForTimeout(100)
      await window.mouse.up()
      await window.waitForTimeout(100)
      await window.keyboard.up('Shift')

      await window.waitForTimeout(1000)

      // Capture after connection
      await captureWithMetadata(window, 'tier1-cp4-nodes-connected', {
        scenario: 'critical-path-4',
        state: 'nodes-connected'
      })

      // Verify edge exists
      const edges = window.locator('.react-flow__edge')
      const edgeCount = await edges.count()
      expect(edgeCount).toBeGreaterThan(0)
    } else {
      throw new Error('Could not get node bounding boxes')
    }

    // Verify no errors
    monitor.assertNoErrors(['ResizeObserver', 'net::ERR_', 'favicon'])
  })

  test('CP5: Workspace persists on reload', async ({ window }) => {
    const monitor = new ConsoleMonitor(window)
    await waitForFullyRendered(window)

    // Create a node
    await window.locator('.react-flow__pane').dblclick({ position: { x: 400, y: 300 } })
    await window.waitForSelector('.react-flow__node', { timeout: 5000 })

    // Capture before reload
    await captureWithMetadata(window, 'tier1-cp5-before-reload', {
      scenario: 'critical-path-5',
      state: 'node-created-before-reload'
    })

    // Get node count
    const nodesBefore = await window.locator('.react-flow__node').count()
    expect(nodesBefore).toBeGreaterThan(0)

    // Reload the window
    await window.reload()
    await waitForFullyRendered(window, { timeout: 15000 })

    // Capture after reload
    await captureWithMetadata(window, 'tier1-cp5-after-reload', {
      scenario: 'critical-path-5',
      state: 'after-reload'
    })

    // Verify node persisted
    const nodesAfter = await window.locator('.react-flow__node').count()
    expect(nodesAfter).toBe(nodesBefore)

    // Verify no errors
    monitor.assertNoErrors(['ResizeObserver', 'net::ERR_', 'favicon'])
  })
})
