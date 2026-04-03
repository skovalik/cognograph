// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Web E2E Tests — Mobile Viewport
 *
 * Tests covering mobile PFD responsive behavior:
 *   M1. WelcomeScreen IS visible on mobile
 *   M2. FAB button (`.mobile-command-fab`) is visible after welcome
 *   M3. Tapping FAB opens bottom sheet (`.mobile-command-sheet`)
 *   M4. Hamburger menu opens sidebar drawer
 *   M5. Viewport allows zoom (`user-scalable` is NOT `no`)
 *   M6. `viewport-fit=cover` is set
 *
 * Runs against http://localhost:5174 (web dev server) via the `web` project
 * in playwright.config.ts. Matches testMatch: /web.*\.spec\.ts/
 */

import { test, expect } from '@playwright/test'
import { mockSupabaseAuth, WELCOME_SELECTORS } from './helpers/welcome-helpers'

const MOBILE_VIEWPORT = { width: 375, height: 812 } // iPhone 13

// ── Shared setup ────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await mockSupabaseAuth(page)
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
})

// ── Mobile viewport tests ───────────────────────────────────────────────────

test.describe('Mobile Viewport', () => {
  test('M1: welcome screen is visible on mobile', async ({ page }) => {
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    // Submit button should be at least 44px (touch target)
    const submit = page.locator(WELCOME_SELECTORS.submit)
    const box = await submit.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  test('M2: command FAB is visible after welcome dismissal', async ({ page }) => {
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })

    const input = page.locator(WELCOME_SELECTORS.input)
    await input.fill('Test mobile')
    await input.press('Enter')
    await expect(ws).not.toBeVisible({ timeout: 10000 })

    // FAB should be visible
    const fab = page.locator('.mobile-command-fab')
    await expect(fab).toBeVisible({ timeout: 5000 })

    // FAB should be at least 56px (touch-friendly)
    const box = await fab.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(56)
    expect(box!.height).toBeGreaterThanOrEqual(56)
  })

  test('M3: tapping FAB opens bottom sheet', async ({ page }) => {
    // Dismiss welcome
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })
    const input = page.locator(WELCOME_SELECTORS.input)
    await input.fill('Test')
    await input.press('Enter')
    await expect(ws).not.toBeVisible({ timeout: 10000 })

    // Tap FAB
    const fab = page.locator('.mobile-command-fab')
    await fab.click()

    // Bottom sheet should appear
    const sheet = page.locator('.mobile-command-sheet')
    await expect(sheet).toBeVisible({ timeout: 3000 })
  })

  test('M4: sidebar opens as drawer on mobile', async ({ page }) => {
    // Dismiss welcome first
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })
    const input = page.locator(WELCOME_SELECTORS.input)
    await input.fill('Test')
    await input.press('Enter')
    await expect(ws).not.toBeVisible({ timeout: 10000 })

    // Find and tap hamburger menu (Open sidebar button in TopBar)
    const hamburger = page.locator('[aria-label="Open sidebar"]')
    if (await hamburger.isVisible()) {
      await hamburger.click()

      // Drawer should appear
      const drawer = page.locator('.mobile-drawer')
      await expect(drawer).toBeVisible({ timeout: 3000 })

      // Backdrop should be visible
      const backdrop = page.locator('.mobile-drawer-backdrop')
      await expect(backdrop).toBeVisible()

      // Tap backdrop to close
      await backdrop.click()
      await expect(drawer).not.toBeVisible({ timeout: 3000 })
    }
  })

  test('M5: page allows user scaling (WCAG)', async ({ page }) => {
    // After Workstream 6, viewport should NOT have user-scalable=no
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).not.toContain('user-scalable=no')
    expect(viewport).not.toContain('maximum-scale=1')
  })

  test('M6: viewport-fit=cover is set', async ({ page }) => {
    // viewport-fit=cover is required for env(safe-area-inset-*) on iOS
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('viewport-fit=cover')
  })
})
