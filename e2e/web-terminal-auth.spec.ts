// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Web E2E Tests — Terminal / Console / Dispatch Auth
 *
 * Tests covering ungated console and dispatch tabs, plus terminal auth:
 *   WT1. Console tab is visible without terminal access (ungated)
 *   WT2. Authenticated user (plan: 'free') has terminal features accessible
 *   WT3. Unauthenticated user (plan: null) — terminal tab gated, console/dispatch ungated
 *
 * Runs against http://localhost:5174 (web dev server) via the `web` project
 * in playwright.config.ts. Matches testMatch: /web.*\.spec\.ts/
 */

import { test, expect } from '@playwright/test'
import { mockSupabaseAuth, WELCOME_SELECTORS } from './helpers/welcome-helpers'

/**
 * Helper: set the entitlements store in localStorage with the Zustand persist format.
 * The store name is 'cognograph-entitlements' (no colon).
 */
async function setEntitlements(page: import('@playwright/test').Page, plan: 'free' | 'pro' | null): Promise<void> {
  await page.evaluate((p) => {
    localStorage.setItem('cognograph-entitlements', JSON.stringify({
      state: {
        plan: p,
        status: 'active',
        entitlements: {
          cloud_sync: { enabled: false },
          cloud_terminal_unlimited: { enabled: p === 'pro' },
          cloud_terminal_free: { enabled: true, limit: 30 },
          unlimited_workspaces: { enabled: true },
          spatial_triggers: { enabled: true },
          orchestrator_node: { enabled: false },
          plan_preview_apply: { enabled: true },
          env_templates: { enabled: true },
          full_context_injection: { enabled: false },
        },
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        lastFetched: Date.now(),
        gracePeriodStatus: 'none',
        usage: null,
      },
      version: 0,
    }))
  }, plan)
}

/**
 * Helper: dismiss the welcome screen so the canvas + sidebar tabs are accessible.
 */
async function dismissWelcome(page: import('@playwright/test').Page): Promise<void> {
  const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
  await expect(ws).toBeVisible({ timeout: 10000 })
  const input = page.locator(WELCOME_SELECTORS.input)
  await input.fill('Test')
  await input.press('Enter')
  await expect(ws).not.toBeVisible({ timeout: 10000 })
}

// ── Shared setup ────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await mockSupabaseAuth(page)
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
})

// ── Terminal / Console auth tests ───────────────────────────────────────────

test.describe('Web Terminal Auth', () => {
  test('WT1: console tab is visible without terminal access (ungated)', async ({ page }) => {
    // Ensure plan is null (no terminal access)
    await setEntitlements(page, null)
    await mockSupabaseAuth(page)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Dismiss welcome to reach the main canvas
    await dismissWelcome(page)

    // Console tab button should be visible in the top bar
    // Console tab has aria-label="Console" in TopBar
    const consoleTab = page.locator('[aria-label="Console"]')
    await expect(consoleTab).toBeVisible({ timeout: 5000 })
  })

  test('WT2: authenticated user has terminal features accessible', async ({ page }) => {
    // Set plan to 'free' — simulates authenticated user with fetched entitlements
    await setEntitlements(page, 'free')
    await mockSupabaseAuth(page)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Dismiss welcome
    await dismissWelcome(page)

    // CC Bridge tab should be visible (requires hasTerminalAccess() = true)
    // When plan is 'free', hasTerminalAccess() returns true
    const bridgeTab = page.locator('[aria-label="CC Bridge"]')
    await expect(bridgeTab).toBeVisible({ timeout: 5000 })

    // Dispatch tab should also be visible (ungated)
    const dispatchTab = page.locator('[aria-label="Dispatch"]')
    await expect(dispatchTab).toBeVisible({ timeout: 5000 })

    // Console tab should be visible (ungated)
    const consoleTab = page.locator('[aria-label="Console"]')
    await expect(consoleTab).toBeVisible({ timeout: 5000 })
  })

  test('WT3: unauthenticated user — CC Bridge tab hidden, console/dispatch visible', async ({ page }) => {
    // Set plan to null (unauthenticated, no terminal access)
    await setEntitlements(page, null)
    await mockSupabaseAuth(page)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Dismiss welcome
    await dismissWelcome(page)

    // CC Bridge tab should NOT be visible (gated by hasTerminalAccess())
    // When plan is null and not Electron and no local agent, hasTerminalAccess() = false
    const bridgeTab = page.locator('[aria-label="CC Bridge"]')
    await expect(bridgeTab).not.toBeVisible({ timeout: 3000 })

    // Dispatch tab should still be visible (ungated)
    const dispatchTab = page.locator('[aria-label="Dispatch"]')
    await expect(dispatchTab).toBeVisible({ timeout: 5000 })

    // Console tab should still be visible (ungated)
    const consoleTab = page.locator('[aria-label="Console"]')
    await expect(consoleTab).toBeVisible({ timeout: 5000 })
  })
})
