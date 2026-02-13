/**
 * Playwright Configuration for Electron E2E Testing
 *
 * This config is designed for testing the Cognograph Electron app.
 * Uses Playwright's built-in Electron support.
 */

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests for Electron (single app instance)
  workers: 1,

  // Reporter to use
  reporter: process.env.CI ? 'github' : 'list',

  // Shared settings for all projects
  use: {
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry'
  },

  // Timeout for each test
  timeout: 60000,

  // Timeout for expect assertions
  expect: {
    timeout: 10000
  },

  // Output folder for test artifacts
  outputDir: 'e2e/test-results'
})
