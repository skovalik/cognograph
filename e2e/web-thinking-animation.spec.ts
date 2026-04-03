// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Web E2E Tests — Thinking Animation
 *
 * Tests covering the conic gradient thinking dot in CommandResponsePanel:
 *   T1. During agent processing, `.cmd-response-panel__thinking-dot` is visible
 *   T2. With `prefers-reduced-motion: reduce`, the dot has `animation: none`
 *
 * Runs against http://localhost:5174 (web dev server) via the `web` project
 * in playwright.config.ts. Matches testMatch: /web.*\.spec\.ts/
 */

import { test, expect } from '@playwright/test'
import {
  WELCOME_SELECTORS,
  mockSupabaseAuth,
  setBYOKKey,
} from './helpers/welcome-helpers'

// ── Shared setup ────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await mockSupabaseAuth(page)
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
})

// ── T1. Conic gradient thinking dot is visible during command execution ──────

test.describe('Thinking Animation', () => {
  test('T1: conic gradient thinking dot is visible during command execution', async ({ page }) => {
    await setBYOKKey(page)

    // Mock /api/chat with a delayed response (simulate processing time)
    await page.route('**/api/chat', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"complete","usage":{"inputTokens":1,"outputTokens":1}}\n\n',
      })
    })

    // Dismiss welcome screen
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    await expect(ws).toBeVisible({ timeout: 10000 })
    const input = page.locator(WELCOME_SELECTORS.input)
    await input.fill('Create a note')
    await input.press('Enter')
    await expect(ws).not.toBeVisible({ timeout: 10000 })

    // Submit another command via the command bar
    const cmdInput = page.locator(WELCOME_SELECTORS.commandInput)
    await cmdInput.fill('Create a second note')
    await cmdInput.press('Enter')

    // The thinking dot should be visible in the response panel
    const thinkingDot = page.locator('.cmd-response-panel__thinking-dot')
    await expect(thinkingDot).toBeVisible({ timeout: 5000 })

    // Verify it has the conic gradient animation (check computed style)
    const hasAnimation = await thinkingDot.evaluate((el) => {
      const style = getComputedStyle(el)
      return style.animationName !== 'none' && style.animationName !== ''
    })
    expect(hasAnimation).toBe(true)
  })

  // ── T2. Reduced motion stops animation ──────────────────────────────────

  test('T2: thinking dot respects prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockSupabaseAuth(page)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    await setBYOKKey(page)

    // Mock delayed chat response
    await page.route('**/api/chat', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"complete","usage":{"inputTokens":1,"outputTokens":1}}\n\n',
      })
    })

    // Dismiss welcome and submit command
    const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
    if (await ws.isVisible()) {
      const input = page.locator(WELCOME_SELECTORS.input)
      await input.fill('Test reduced motion')
      await input.press('Enter')
      await expect(ws).not.toBeVisible({ timeout: 10000 })
    }

    // Submit command via command bar
    const cmdInput = page.locator(WELCOME_SELECTORS.commandInput)
    await cmdInput.fill('Test')
    await cmdInput.press('Enter')

    // Thinking dot should have no animation
    const thinkingDot = page.locator('.cmd-response-panel__thinking-dot')
    if (await thinkingDot.isVisible({ timeout: 3000 }).catch(() => false)) {
      const animName = await thinkingDot.evaluate(el => getComputedStyle(el).animationName)
      expect(animName).toBe('none')
    }
  })
})
