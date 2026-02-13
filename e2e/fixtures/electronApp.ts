/**
 * Electron App Fixture for Playwright E2E Tests
 *
 * Provides a reusable fixture for launching and interacting with the Electron app.
 */

import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Extend the base test with Electron app fixture
export const test = base.extend<{
  electronApp: ElectronApplication
  window: Page
}>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    // Path to the built Electron app main entry
    const mainPath = path.join(__dirname, '../../out/main/index.js')

    // Launch Electron app
    const app = await electron.launch({
      args: [mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // Disable GPU acceleration for CI stability
        ELECTRON_DISABLE_GPU: '1'
      }
    })

    // Use the app in tests
    await use(app)

    // Close the app after tests
    await app.close()
  },

  window: async ({ electronApp }, use) => {
    // Wait for the first BrowserWindow to open
    const window = await electronApp.firstWindow()

    // Wait for the app to be ready (main content loaded)
    await window.waitForLoadState('domcontentloaded')

    // Use the window in tests
    await use(window)
  }
})

export { expect } from '@playwright/test'

/**
 * Helper to wait for the app to be fully ready
 * (React mounted, stores initialized)
 */
export async function waitForAppReady(window: Page): Promise<void> {
  // Wait for React Flow canvas to be present (indicates app is mounted)
  await window.waitForSelector('.react-flow', { timeout: 30000 })
}

/**
 * Helper to get the app info from Electron
 */
export async function getAppInfo(electronApp: ElectronApplication): Promise<{
  name: string
  version: string
  isPackaged: boolean
}> {
  return electronApp.evaluate(async ({ app }) => ({
    name: app.getName(),
    version: app.getVersion(),
    isPackaged: app.isPackaged
  }))
}

/**
 * Helper to take a screenshot with timestamp
 */
export async function takeScreenshot(window: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await window.screenshot({ path: `e2e/test-results/${name}-${timestamp}.png` })
}
