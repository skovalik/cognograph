/**
 * Playwright Configuration for Electron E2E Testing
 *
 * This config is designed for testing the Cognograph Electron app.
 * Uses Playwright's built-in Electron support.
 */

import { defineConfig } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') })

export default defineConfig({
  testDir: './e2e',

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: process.env.CI ? 'github' : 'list',

  // Shared settings for all projects
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry'
  },

  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: 'e2e/test-results',

  // Split Electron and Web into separate projects
  projects: [
    {
      name: 'electron',
      testMatch: /(?:app|conversation|gpu|electron|critical|foundation|v4).*\.spec\.ts/,
      // Electron tests must run sequentially (single app instance)
      fullyParallel: false,
    },
    {
      name: 'web',
      testMatch: /web.*\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5174',
      },
      fullyParallel: true,
    },
  ],

  // Auto-start web dev server for web tests
  webServer: {
    command: 'npm run dev:web',
    port: 5174,
    reuseExistingServer: true,
    timeout: 30000,
  },
})
