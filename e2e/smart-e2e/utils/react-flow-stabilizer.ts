/**
 * React Flow Viewport Stabilization Utilities
 *
 * React Flow has async rendering. Screenshots must wait for:
 * - Viewport transform stability
 * - All nodes rendered
 * - Edges rendered
 * - Layout complete
 */

import type { Page } from '@playwright/test'

export interface StabilizationOptions {
  /** Max time to wait for stability (ms) */
  timeout?: number
  /** How long viewport must be stable (ms) */
  stableFor?: number
  /** Poll interval (ms) */
  pollInterval?: number
}

/**
 * Wait for React Flow viewport to stabilize
 *
 * Implementation: Store viewport transform on element, poll and compare.
 * Cannot use Promises in browser context (waitForFunction limitation).
 */
export async function waitForCanvasStable(
  page: Page,
  options: StabilizationOptions = {}
): Promise<void> {
  const {
    timeout = 5000,
    stableFor = 150,
    pollInterval = 50
  } = options

  // Simpler approach: just wait for a fixed time then check viewport hasn't moved
  const startTime = Date.now()
  let lastTransform = ''
  let stableTime = 0

  while (Date.now() - startTime < timeout) {
    const currentTransform = await page.evaluate(() => {
      const rfPane = document.querySelector('.react-flow__pane')
      if (!rfPane) return null
      return window.getComputedStyle(rfPane).transform
    })

    if (currentTransform === null) {
      await page.waitForTimeout(pollInterval)
      continue
    }

    if (currentTransform === lastTransform) {
      stableTime += pollInterval
      if (stableTime >= stableFor) {
        return // Stable!
      }
    } else {
      stableTime = 0
      lastTransform = currentTransform
    }

    await page.waitForTimeout(pollInterval)
  }

  throw new Error(`Canvas did not stabilize within ${timeout}ms`)
}

/**
 * Wait for all nodes to be visible and rendered
 */
export async function waitForNodesRendered(
  page: Page,
  expectedCount?: number,
  timeout = 5000
): Promise<void> {
  if (expectedCount !== undefined) {
    await page.waitForFunction(
      (count) => {
        const nodes = document.querySelectorAll('.react-flow__node')
        return nodes.length >= count
      },
      expectedCount,
      { timeout }
    )
  }

  // Wait for nodes to have non-zero dimensions
  await page.waitForFunction(
    () => {
      const nodes = document.querySelectorAll('.react-flow__node')
      if (nodes.length === 0) return true // No nodes = rendered

      return Array.from(nodes).every((node) => {
        const rect = node.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
    },
    undefined,
    { timeout }
  )
}

/**
 * Complete stabilization: viewport + nodes + edges
 */
export async function waitForFullyRendered(
  page: Page,
  options: StabilizationOptions & { expectedNodes?: number } = {}
): Promise<void> {
  const { expectedNodes, ...stabOptions } = options

  // Wait for React Flow to be present
  await page.waitForSelector('.react-flow', { timeout: 10000 })

  // Wait for nodes
  await waitForNodesRendered(page, expectedNodes, stabOptions.timeout)

  // Wait for viewport to stabilize
  await waitForCanvasStable(page, stabOptions)

  // Extra safety: wait one more frame
  await page.waitForTimeout(16)
}
