// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Web E2E Tests — Welcome Screen
 *
 * Tests covering the full welcome screen lifecycle in the web app:
 *   1.  Welcome appears on empty workspace
 *   2.  Hidden when nodes exist
 *   3.  Submit with mock LLM
 *   4.  Submit without API key
 *   4b. Managed key flow (mock)
 *   7.  Shift+Enter = newline
 *   8.  Reduced motion
 *   10. Command bar works after welcome
 *   11. Mobile viewport hides welcome
 *   12. Backdrop blocks canvas
 *   13. Network error
 *
 * Removed tests (behavior no longer exists):
 *   W5  — Escape skip (no Escape handler)
 *   W5b — X button skip (no X button)
 *
 * Runs against http://localhost:5174 (web dev server) via the `web` project
 * in playwright.config.ts. Matches testMatch: /web.*\.spec\.ts/
 */

import { test, expect } from '@playwright/test'
import {
  WELCOME_SELECTORS,
  seedNodeToDismissWelcome,
  submitWelcome,
  setBYOKKey,
  mockSupabaseAuth,
  mockChatAPI,
  mockChatAPIError,
} from './helpers/welcome-helpers'

// ── Shared setup ────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Mock Supabase auth BEFORE navigation so the route handler is installed
  await mockSupabaseAuth(page)

  // Navigate to the app
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
})

// ── 1. Welcome appears on empty workspace ──────────────────────────────────

test.describe('Welcome Screen: Empty Workspace', () => {
  test('W1: welcome screen is visible with heading, input, and submit', async ({ page }) => {
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Heading
    const heading = page.locator(WELCOME_SELECTORS.heading)
    await expect(heading).toBeVisible()
    await expect(heading).toContainText('Cognograph')

    // Input textarea
    const input = page.locator(WELCOME_SELECTORS.input)
    await expect(input).toBeVisible()

    // Submit button
    const submit = page.locator(WELCOME_SELECTORS.submit)
    await expect(submit).toBeVisible()
  })
})

// ── 2. Hidden when nodes exist ─────────────────────────────────────────────

test.describe('Welcome Screen: Workspace With Nodes', () => {
  test('W2: welcome screen is NOT shown when nodes exist', async ({ page }) => {
    // Wait for welcome to appear first (confirms app mounted)
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Seed a node via the workspace store — nodeCount > 0 hides welcome
    await seedNodeToDismissWelcome(page)

    // Welcome screen should not be visible
    await expect(ws).not.toBeVisible()
  })
})

// ── 3. Submit with mock LLM ─────────────────────────────────────────────────

test.describe('Welcome Screen: Submit with Mock LLM', () => {
  test('W3: submitting a command dismisses welcome and shows mocked response', async ({ page }) => {
    // Set up BYOK key and mock chat API
    await setBYOKKey(page)
    await mockChatAPI(page, 'Hello from the mock LLM!')

    // Reload so BYOK key is active
    await mockSupabaseAuth(page)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Wait for welcome screen
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Type a command and submit
    const input = page.locator(WELCOME_SELECTORS.input)
    await input.fill('Create a note about testing')
    await input.press('Enter')

    // Welcome screen should dismiss
    await expect(ws).not.toBeVisible({ timeout: 10000 })

    // Response panel should show the mocked text
    const response = page.locator(WELCOME_SELECTORS.responseNarration)
    await expect(response.first()).toBeVisible({ timeout: 10000 })
  })
})

// ── 4. Submit without API key ───────────────────────────────────────────────

test.describe('Welcome Screen: No API Key', () => {
  test('W4: submitting without API key shows error about no key configured', async ({ page }) => {
    // Clear any BYOK key — ensure there's none
    await page.evaluate(() => {
      localStorage.removeItem('cognograph:apikey:anthropic')
    })

    // Block Supabase auth so managed key path also fails
    await page.route('**/auth/v1/**', async (route) => {
      await route.fulfill({ status: 401, body: 'Unauthorized' })
    })

    // Reload to pick up state
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Wait for welcome screen
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Type and submit
    const input = page.locator(WELCOME_SELECTORS.input)
    await input.fill('Hello')
    await input.press('Enter')

    // Welcome should dismiss (onComplete fires regardless)
    await expect(ws).not.toBeVisible({ timeout: 10000 })

    // Response panel should show an error about no API key
    const response = page.locator(WELCOME_SELECTORS.responseNarration)
    await expect(response.first()).toBeVisible({ timeout: 10000 })
    await expect(response.first()).toContainText(/no api key/i, { timeout: 5000 })
  })
})

// ── 4b. Managed key flow (mock) ─────────────────────────────────────────────

test.describe('Welcome Screen: Managed Key Flow', () => {
  test('W4b: managed key sends correct auth headers', async ({ page }) => {
    // NO BYOK key — ensure none set
    await page.evaluate(() => {
      localStorage.removeItem('cognograph:apikey:anthropic')
    })

    // Intercept /api/chat to capture outgoing request headers
    let capturedHeaders: Record<string, string> = {}
    await page.route('**/api/chat', async (route) => {
      capturedHeaders = route.request().headers()
      // Fulfill with mock SSE response
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"complete","usage":{"inputTokens":1,"outputTokens":1}}\n\n',
      })
    })

    // Mock Supabase auth (provides JWT)
    await mockSupabaseAuth(page)

    // Reload to pick up state
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Wait for welcome screen
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Type and submit
    const input = page.locator(WELCOME_SELECTORS.input)
    await input.fill('Create a note')
    await input.press('Enter')

    // Wait for welcome to dismiss (indicates submission went through)
    await expect(ws).not.toBeVisible({ timeout: 10000 })

    // Give the fetch a moment to fire
    await page.waitForTimeout(2000)

    // Verify the correct auth headers were sent
    expect(capturedHeaders['authorization']).toBe('Bearer test-jwt-token')
    expect(capturedHeaders['x-use-managed-key']).toBe('true')
  })
})

// ── 7. Shift+Enter = newline ────────────────────────────────────────────────

test.describe('Welcome Screen: Shift+Enter', () => {
  test('W7: Shift+Enter inserts a newline, Enter submits', async ({ page }) => {
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    const input = page.locator(WELCOME_SELECTORS.input)
    await input.click()
    await input.fill('')

    // Type first line
    await input.type('Line 1')

    // Shift+Enter should add a newline (not submit)
    await page.keyboard.press('Shift+Enter')
    await input.type('Line 2')

    // Verify textarea value contains a newline
    const value = await input.inputValue()
    expect(value).toContain('Line 1')
    expect(value).toContain('Line 2')
    // The newline character should be present
    expect(value.split('\n').length).toBeGreaterThanOrEqual(2)

    // Welcome screen should still be visible (not submitted)
    await expect(ws).toBeVisible()

    // Now press Enter (without Shift) — should submit
    // Mock the chat API so the submit doesn't hang
    await setBYOKKey(page)
    await mockChatAPI(page)
    await page.keyboard.press('Enter')

    // Welcome should dismiss after submission
    await expect(ws).not.toBeVisible({ timeout: 10000 })
  })
})

// ── 8. Reduced motion ───────────────────────────────────────────────────────

test.describe('Welcome Screen: Reduced Motion', () => {
  test('W8: reduced motion preference causes instant transitions', async ({ page }) => {
    // Emulate prefers-reduced-motion: reduce
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // Need to reload so the media query is picked up at module scope
    await mockSupabaseAuth(page)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Dismiss via submit (no Escape handler exists)
    const input = page.locator(WELCOME_SELECTORS.input)
    await input.fill('Test reduced motion')
    await page.keyboard.press('Enter')

    // With zero-duration transitions, the welcome should disappear immediately
    // (within a single frame / minimal delay)
    await expect(ws).not.toBeVisible({ timeout: 1000 })
  })
})

// ── 10. Command bar works after welcome ─────────────────────────────────────

test.describe('Welcome Screen: Command Bar After Dismiss', () => {
  test('W10: command bar receives focus and shows completions after welcome is dismissed', async ({ page }) => {
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Dismiss welcome via submit (no Escape handler)
    await submitWelcome(page)

    // Command bar should be visible
    const cmdBar = page.locator(WELCOME_SELECTORS.bottomCommandBar)
    await expect(cmdBar).toBeVisible({ timeout: 5000 })

    // Click the command input and type "/"
    const cmdInput = page.locator(WELCOME_SELECTORS.commandInput)
    await cmdInput.click()
    await cmdInput.fill('/')

    // Completions dropdown should appear
    const completions = page.locator(WELCOME_SELECTORS.commandCompletions)
    await expect(completions).toBeVisible({ timeout: 5000 })
  })
})

// ── 11. Mobile viewport ─────────────────────────────────────────────────────

test.describe('Welcome Screen: Mobile Viewport', () => {
  test('W11: welcome screen IS shown on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    // Reload so viewport is picked up
    await mockSupabaseAuth(page)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Welcome screen SHOULD be visible on mobile (WS3: MOBILE_RESPONSIVE flag)
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Command FAB should be visible after welcome is dismissed (not the full bar)
    // The FAB only appears when welcome is dismissed, so we don't assert it here
  })
})

// ── 12. Backdrop blocks canvas ──────────────────────────────────────────────

test.describe('Welcome Screen: Backdrop Blocks Canvas', () => {
  test('W12: clicking the backdrop does not interact with the canvas', async ({ page }) => {
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Get initial node count (should be 0 or minimal)
    const initialNodes = await page.locator(WELCOME_SELECTORS.reactFlowNode).count()

    // Click on the backdrop area (which overlays the canvas)
    const backdrop = page.locator(WELCOME_SELECTORS.backdrop)
    await backdrop.click({ position: { x: 50, y: 50 }, force: true })

    // Welcome screen should still be visible (backdrop click doesn't dismiss)
    await expect(ws).toBeVisible()

    // No new nodes should have been created
    const afterNodes = await page.locator(WELCOME_SELECTORS.reactFlowNode).count()
    expect(afterNodes).toBe(initialNodes)
  })
})

// ── 13. Network error ───────────────────────────────────────────────────────

test.describe('Welcome Screen: Network Error', () => {
  test('W13: server error on /api/chat shows error in response panel', async ({ page }) => {
    // Set BYOK key so the request actually fires
    await setBYOKKey(page)

    // Mock /api/chat to return 500
    await mockChatAPIError(page, 500)

    // Reload to pick up state
    await mockSupabaseAuth(page)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Wait for welcome screen
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Type and submit
    const input = page.locator(WELCOME_SELECTORS.input)
    await input.fill('Create a note')
    await input.press('Enter')

    // Welcome should dismiss (onComplete fires)
    await expect(ws).not.toBeVisible({ timeout: 10000 })

    // Response panel should show an error
    const response = page.locator(WELCOME_SELECTORS.responseNarration)
    await expect(response.first()).toBeVisible({ timeout: 10000 })
    await expect(response.first()).toContainText(/error|internal server|failed/i, { timeout: 5000 })
  })
})
