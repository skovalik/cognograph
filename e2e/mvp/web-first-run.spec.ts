/**
 * Web First-Run E2E Tests
 *
 * Tests the first-time user experience on cognograph.app/workspace (web build).
 * Verifies onboarding flow, API key setup, and initial canvas interaction.
 */

import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174'

async function goto(page: Page, path = '') {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
}

test.describe('Web First-Run Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Clear welcomed flag to simulate first visit
    await goto(page)
    await page.evaluate(() => localStorage.removeItem('cognograph:welcomed'))
    await page.reload({ waitUntil: 'networkidle' })
  })

  test('canvas loads with React Flow visible', async ({ page }) => {
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15000 })
  })

  test('WebWelcomeModal appears on first visit', async ({ page }) => {
    // Wait for the lazy-loaded modal
    await expect(page.getByText('Welcome to Cognograph')).toBeVisible({ timeout: 10000 })
  })

  test('"Explore First" dismisses modal and sets localStorage flag', async ({ page }) => {
    await expect(page.getByText('Welcome to Cognograph')).toBeVisible({ timeout: 10000 })
    await page.getByText('Explore First').click()

    // Modal should be gone
    await expect(page.getByText('Welcome to Cognograph')).not.toBeVisible()

    // Flag should be set
    const flag = await page.evaluate(() => localStorage.getItem('cognograph:welcomed'))
    expect(flag).toBe('true')
  })

  test('FirstRunHints appear after modal dismiss', async ({ page }) => {
    await expect(page.getByText('Welcome to Cognograph')).toBeVisible({ timeout: 10000 })
    await page.getByText('Explore First').click()

    // Hints should appear
    await expect(page.getByText('Double-click the canvas')).toBeVisible({ timeout: 5000 })
  })

  test('modal does NOT reappear after refresh', async ({ page }) => {
    // Dismiss the modal
    await expect(page.getByText('Welcome to Cognograph')).toBeVisible({ timeout: 10000 })
    await page.getByText('Explore First').click()
    await expect(page.getByText('Welcome to Cognograph')).not.toBeVisible()

    // Refresh
    await page.reload({ waitUntil: 'networkidle' })

    // Modal should NOT reappear
    await page.waitForTimeout(3000)
    await expect(page.getByText('Welcome to Cognograph')).not.toBeVisible()
  })

  test('double-click creates a conversation node', async ({ page }) => {
    // Dismiss modal first
    await expect(page.getByText('Welcome to Cognograph')).toBeVisible({ timeout: 10000 })
    await page.getByText('Explore First').click()

    // Double-click the canvas
    const canvas = page.locator('.react-flow__pane')
    await canvas.dblclick({ position: { x: 400, y: 300 } })

    // A node should appear
    await expect(page.locator('.react-flow__node')).toBeVisible({ timeout: 5000 })
  })

  test('no console errors on first load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await goto(page)
    await page.waitForTimeout(3000)
    // Filter out known benign errors (e.g., missing favicon, Sentry init without DSN)
    const realErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('Sentry') && !e.includes('404')
    )
    expect(realErrors).toHaveLength(0)
  })
})
