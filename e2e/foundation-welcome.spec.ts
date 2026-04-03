// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Foundation Welcome Screen E2E Tests
 *
 * Tests covering the always-on welcome overlay lifecycle:
 *   1. Welcome appears on empty workspace (nodeCount === 0)
 *   2. Welcome hidden when nodes exist
 *   5. Shift+Enter = newline (Enter submits)
 *   6. Reduced motion — animations instant
 *   7. First nodes after command (CI-skipped, needs API key)
 *   8. Backdrop blocks canvas interaction
 *   NEW. Welcome reappears on new workspace
 *
 * Removed tests (behavior no longer exists):
 *   W3  — Escape skip (no Escape handler)
 *   W3b — X button skip (no X button)
 *   W4  — Welcome doesn't reappear after skip (welcome SHOULD reappear on empty workspace)
 *
 * These tests run against the Electron app via fixtures/electronApp.ts.
 * They do NOT call waitForCanvas() — that helper auto-dismisses onboarding.
 */

import { test, expect } from './fixtures/electronApp'
import {
  waitForStores,
  setDesktopViewport,
  getNodeCount,
} from './helpers'
import {
  WELCOME_SELECTORS,
  seedNodeToDismissWelcome,
} from './helpers/welcome-helpers'

// ── Shared setup ─────────────────────────────────────────────────────────────
// Wait for app to be ready WITHOUT dismissing the welcome screen.
// We wait for .react-flow to exist (app mounted) but do NOT interact with welcome.

async function waitForAppWithoutDismissing(window: import('@playwright/test').Page): Promise<void> {
  await window.waitForSelector(WELCOME_SELECTORS.reactFlow, { timeout: 30000 })
}

// ---------------------------------------------------------------------------
// 1. Welcome appears on empty workspace
// ---------------------------------------------------------------------------

test.describe('Welcome: Empty Workspace', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await window.reload()
    await waitForAppWithoutDismissing(window)
  })

  test('W1: welcome overlay is visible when workspace has no nodes', async ({ window }) => {
    // Welcome screen should be visible
    const welcome = window.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(welcome).toBeVisible({ timeout: 10000 })

    // Heading should be present
    const heading = window.locator(WELCOME_SELECTORS.heading)
    await expect(heading).toBeVisible()
    await expect(heading).toContainText('Welcome')

    // Input (textarea) should be present and focused
    const input = window.locator(WELCOME_SELECTORS.input)
    await expect(input).toBeVisible()
    // Auto-focus fires after a 300ms delay
    await window.waitForTimeout(400)
    await expect(input).toBeFocused()

    // Submit button should be disabled (no text entered)
    const submit = window.locator(WELCOME_SELECTORS.submit)
    await expect(submit).toBeVisible()
    await expect(submit).toBeDisabled()

    // BottomCommandBar should NOT be visible while welcome is showing
    const commandBar = window.locator(WELCOME_SELECTORS.bottomCommandBar)
    await expect(commandBar).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 2. Welcome hidden when nodes exist
// ---------------------------------------------------------------------------

test.describe('Welcome: Workspace With Nodes', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await window.reload()
    await waitForAppWithoutDismissing(window)
    // Wait for stores to be ready before seeding
    await waitForStores(window)
  })

  test('W2: welcome is NOT visible when workspace has nodes', async ({ window }) => {
    // Seed a node so nodeCount > 0 — this hides the welcome screen
    await seedNodeToDismissWelcome(window)

    // Welcome screen should NOT be visible
    const welcome = window.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(welcome).not.toBeVisible()

    // BottomCommandBar SHOULD be visible when welcome is hidden
    const commandBar = window.locator(WELCOME_SELECTORS.bottomCommandBar)
    await expect(commandBar).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 5. Shift+Enter = newline, Enter submits
// ---------------------------------------------------------------------------

test.describe('Welcome: Input Behavior', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await window.reload()
    await waitForAppWithoutDismissing(window)
  })

  test('W5: Shift+Enter inserts newline, Enter submits', async ({ window }) => {
    // Wait for welcome and input to be ready
    const welcome = window.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(welcome).toBeVisible({ timeout: 10000 })

    const input = window.locator(WELCOME_SELECTORS.input)
    await expect(input).toBeVisible()
    await window.waitForTimeout(400) // Wait for auto-focus

    // Type first line
    await input.fill('')
    await input.type('Line one')

    // Shift+Enter should insert a newline, NOT submit
    await window.keyboard.press('Shift+Enter')

    // Type second line
    await input.type('Line two')

    // Verify textarea contains both lines
    const value = await input.inputValue()
    const lines = value.split('\n')
    expect(lines.length).toBe(2)
    expect(lines[0]).toBe('Line one')
    expect(lines[1]).toBe('Line two')

    // Welcome should still be visible (not submitted)
    await expect(welcome).toBeVisible()

    // Now press Enter to submit
    await window.keyboard.press('Enter')

    // Welcome should begin dismissing (morphing phase starts)
    // The AnimatePresence exit removes it after morph animation
    await expect(welcome).not.toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 6. Reduced motion
// ---------------------------------------------------------------------------

test.describe('Welcome: Reduced Motion', () => {
  test('W6: welcome appears and completes instantly with prefers-reduced-motion', async ({ window }) => {
    await setDesktopViewport(window)

    // Emulate reduced motion BEFORE the page loads to affect the module-level
    // prefersReducedMotion check (computed once at import time)
    await window.emulateMedia({ reducedMotion: 'reduce' })

    await window.reload()
    await waitForAppWithoutDismissing(window)

    // Welcome should appear (instantly, no fade)
    const welcome = window.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(welcome).toBeVisible({ timeout: 10000 })

    // Type something and submit
    const input = window.locator(WELCOME_SELECTORS.input)
    await expect(input).toBeVisible()
    await window.waitForTimeout(100) // Minimal wait — reduced motion
    await input.fill('Test reduced motion')
    await window.keyboard.press('Enter')

    // With reduced motion, morph duration is 0 — should complete instantly
    // Give a small buffer for React state updates
    await expect(welcome).not.toBeVisible({ timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// 7. First nodes after command (CI-skipped — needs real API key)
// ---------------------------------------------------------------------------

test.describe('Welcome: First Nodes', () => {
  test.skip(process.env.CI === 'true', 'Requires real API key — skipped in CI')

  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await window.reload()
    await waitForAppWithoutDismissing(window)
  })

  test('W7: submitting a command creates a node on the canvas', async ({ window }) => {
    // Welcome should be visible
    const welcome = window.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(welcome).toBeVisible({ timeout: 10000 })

    // Type a command
    const input = window.locator(WELCOME_SELECTORS.input)
    await expect(input).toBeVisible()
    await window.waitForTimeout(400)
    await input.fill('Create a note about testing')

    // Submit
    await window.keyboard.press('Enter')

    // Welcome should dismiss
    await expect(welcome).not.toBeVisible({ timeout: 15000 })

    // Wait for a node to appear on the canvas (real API call)
    const node = window.locator(WELCOME_SELECTORS.reactFlowNode)
    await expect(node.first()).toBeVisible({ timeout: 30000 })

    const count = await getNodeCount(window)
    expect(count).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 8. Backdrop blocks canvas interaction
// ---------------------------------------------------------------------------

test.describe('Welcome: Backdrop Blocks Canvas', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await window.reload()
    await waitForAppWithoutDismissing(window)
  })

  test('W8: clicking on canvas area behind backdrop does NOT create nodes', async ({ window }) => {
    // Welcome should be visible
    const welcome = window.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(welcome).toBeVisible({ timeout: 10000 })

    // Get initial node count
    const countBefore = await getNodeCount(window)

    // Click on the backdrop area (which covers the canvas)
    // The backdrop prevents clicks from reaching the canvas underneath
    const backdrop = window.locator(WELCOME_SELECTORS.backdrop)
    await expect(backdrop).toBeVisible()
    await backdrop.click({ position: { x: 100, y: 100 }, force: true })
    await window.waitForTimeout(500)

    // No nodes should have been created
    const countAfter = await getNodeCount(window)
    expect(countAfter).toBe(countBefore)

    // Welcome should still be visible (not dismissed by backdrop click)
    await expect(welcome).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// NEW. Welcome reappears on new workspace
// ---------------------------------------------------------------------------

test.describe('Welcome: Reappears on New Workspace', () => {
  test.beforeEach(async ({ window }) => {
    await setDesktopViewport(window)
    await window.reload()
    await waitForAppWithoutDismissing(window)
  })

  test('W-NEW: welcome reappears after switching to a new empty workspace', async ({ window }) => {
    // Welcome should be visible on empty workspace
    const welcome = window.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(welcome).toBeVisible({ timeout: 10000 })

    // Dismiss welcome by submitting (sets sessionDismissed)
    const input = window.locator(WELCOME_SELECTORS.input)
    await input.fill('Test dismiss')
    await window.keyboard.press('Enter')
    await expect(welcome).not.toBeVisible({ timeout: 10000 })

    // Wait for stores to be ready
    await waitForStores(window)

    // Create a new workspace via the store
    // newWorkspace() resets nodes to [] and changes workspaceId,
    // which resets sessionDismissed via the useEffect in App.tsx
    await window.evaluate(() => {
      const store = (window as any).__workspaceStore
      if (store) store.getState().newWorkspace()
    })
    await window.waitForTimeout(1000)

    // Welcome SHOULD reappear — new workspace has nodeCount === 0
    // and sessionDismissed was reset by the workspaceId change
    await expect(welcome).toBeVisible({ timeout: 10000 })
  })
})
