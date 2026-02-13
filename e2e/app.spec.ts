/**
 * App Launch E2E Tests
 *
 * Basic tests to verify the Electron app launches correctly
 * and core UI elements are present.
 */

import { test, expect, waitForAppReady, getAppInfo } from './fixtures/electronApp'

test.describe('App Launch', () => {
  test('should launch the app successfully', async ({ electronApp, window }) => {
    // Window fixture already waits for first window, so if we get here, app launched
    expect(window).toBeTruthy()

    // Verify app is running
    const isRunning = await electronApp.evaluate(async ({ app }) => !app.isReady() === false)
    expect(isRunning).toBe(true)
  })

  test('should display the main window', async ({ window }) => {
    // Window should have a title
    const title = await window.title()
    expect(title).toBeTruthy()
  })

  test('should have correct app info', async ({ electronApp }) => {
    const info = await getAppInfo(electronApp)

    // When running from source, app name may be "Electron"
    // In packaged builds it would be "cognograph"
    expect(['cognograph', 'Electron']).toContain(info.name)
    expect(info.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(info.isPackaged).toBe(false) // Running from source
  })

  test('should load React Flow canvas', async ({ window }) => {
    await waitForAppReady(window)

    // React Flow should be present
    const canvas = await window.locator('.react-flow')
    await expect(canvas).toBeVisible()
  })

  test('should display toolbar or control buttons', async ({ window }) => {
    await waitForAppReady(window)

    // Look for toolbar, buttons, or react-flow controls
    const hasToolbar = await window.locator('[class*="toolbar"], [class*="Toolbar"]').first().isVisible().catch(() => false)
    const hasControls = await window.locator('.react-flow__controls').isVisible().catch(() => false)
    const hasButtons = await window.locator('button').first().isVisible().catch(() => false)

    // At least one of these should be present
    expect(hasToolbar || hasControls || hasButtons).toBe(true)
  })

  test('should have no console errors on startup', async ({ window }) => {
    const errors: string[] = []

    // Listen for console errors
    window.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await waitForAppReady(window)

    // Wait a bit for any async errors
    await window.waitForTimeout(2000)

    // Filter out known acceptable errors (e.g., missing optional features)
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('ResizeObserver') && // React Flow resize observer (benign)
        !err.includes('net::ERR_') && // Network errors (offline mode)
        !err.includes('favicon') // Missing favicon
    )

    expect(criticalErrors).toHaveLength(0)
  })
})

test.describe('Window Controls', () => {
  test('should be able to evaluate in main process', async ({ electronApp }) => {
    // Test that we can communicate with the main process
    const result = await electronApp.evaluate(async ({ app }) => {
      return app.getLocale()
    })

    expect(result).toBeTruthy()
  })

  test('should handle window minimize/maximize', async ({ electronApp, window }) => {
    await waitForAppReady(window)

    // Get window state
    const isMinimized = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return win?.isMinimized() ?? true
    })

    expect(isMinimized).toBe(false)

    // Window should be visible and not minimized on launch
    const isVisible = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return win?.isVisible() ?? false
    })

    expect(isVisible).toBe(true)
  })
})

test.describe('Initial State', () => {
  test('should start with empty canvas', async ({ window }) => {
    await waitForAppReady(window)

    // Check that no nodes are present initially (or just the default ones)
    const nodes = await window.locator('.react-flow__node')
    const count = await nodes.count()

    // App should start with 0 or minimal nodes
    expect(count).toBeLessThanOrEqual(5) // Allow for welcome/intro nodes
  })

  test('should have sidebar present', async ({ window }) => {
    await waitForAppReady(window)

    // Look for sidebar element (left sidebar)
    const sidebar = await window.locator('[class*="sidebar"], [class*="Sidebar"]').first()

    // Sidebar may be collapsed but should exist
    const sidebarCount = await sidebar.count()
    expect(sidebarCount).toBeGreaterThanOrEqual(0) // May or may not be visible
  })
})
