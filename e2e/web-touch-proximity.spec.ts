// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Touch Proximity E2E Tests
 *
 * Tests proximity-based context connection using simulated touch events
 * in a mobile viewport. Diagnostic test — identifies whether onNodeDrag
 * fires on touch devices and whether proximity detection activates.
 *
 * Uses Playwright's CDP touch emulation:
 *   - hasTouch: true → navigator.maxTouchPoints > 0 → useIsTouch() returns true
 *   - viewport: 390x844 (iPhone 14) → useIsMobile() returns true
 *   - Touch drag simulated via CDP Input.dispatchTouchEvent
 *
 * CDP touch point requirements:
 *   - All touchStart/touchMove points need: radiusX, radiusY, rotationAngle, force
 *   - touchEnd must include final coordinates (not empty array) with force: 0
 */

import { test, expect } from '@playwright/test'
import { mockSupabaseAuth, seedNodeToDismissWelcome } from './helpers/welcome-helpers'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174'

// iPhone 14 viewport with touch
const MOBILE_CONTEXT = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
}

/** Helper: create a properly-formed CDP touch point */
function tp(x: number, y: number, force = 1) {
  return { x: Math.round(x), y: Math.round(y), radiusX: 5, radiusY: 5, rotationAngle: 0, force }
}

test.describe('Touch proximity-based context connection', () => {
  test.use(MOBILE_CONTEXT)

  test.beforeEach(async ({ page }) => {
    await mockSupabaseAuth(page)
    await page.goto(`${BASE}/?mode=workspace-demo`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await seedNodeToDismissWelcome(page)
    await page.waitForTimeout(500)
  })

  test('creates edge when note is touch-dragged near conversation node', async ({ page }) => {
    // ── Setup: conversation at (500, 300), note at (0, 300) ──
    await page.evaluate(() => {
      const store = (window as any).__workspaceStore
      if (!store) throw new Error('workspaceStore not exposed')
      store.getState().addNode('conversation', { x: 500, y: 300 })
      store.getState().addNode('note', { x: 0, y: 300 })
    })
    await page.waitForTimeout(500)

    // Count initial edges
    const initialEdgeCount = await page.locator('.react-flow__edge').count()

    // Find leftmost node (note at x=0) and rightmost node (conversation)
    const allNodes = await page.locator('.react-flow__node').all()
    let noteBox = await allNodes[0]!.boundingBox()
    let convBox = await allNodes[0]!.boundingBox()

    for (const n of allNodes) {
      const box = await n.boundingBox()
      if (box && noteBox && box.x < noteBox.x) noteBox = box
      if (box && convBox && box.x > convBox.x) convBox = box
    }
    expect(noteBox).toBeTruthy()
    expect(convBox).toBeTruthy()

    // ── Simulate touch drag: note toward conversation ──
    const startX = noteBox!.x + noteBox!.width / 2
    const startY = noteBox!.y + noteBox!.height / 2
    const endX = convBox!.x - noteBox!.width / 2 - 50
    const endY = convBox!.y + convBox!.height / 2

    const client = await page.context().newCDPSession(page)
    const steps = 20
    const deltaX = (endX - startX) / steps
    const deltaY = (endY - startY) / steps

    // Touch start
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [tp(startX, startY)],
    })
    await page.waitForTimeout(50)

    // Touch move in steps (simulates drag)
    for (let i = 1; i <= steps; i++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [tp(startX + deltaX * i, startY + deltaY * i)],
      })
      await page.waitForTimeout(30)
    }

    // Touch end — include final position with force: 0
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [tp(endX, endY, 0)],
    })

    // ── Verify: edge was created ──
    await page.waitForTimeout(1500)

    const finalEdgeCount = await page.locator('.react-flow__edge').count()
    expect(finalEdgeCount).toBeGreaterThan(initialEdgeCount)
  })

  test('shows cyan glow highlight during touch drag near conversation', async ({ page }) => {
    // ── Setup: conversation at (500, 300), note at (0, 300) ──
    await page.evaluate(() => {
      const store = (window as any).__workspaceStore
      if (!store) throw new Error('workspaceStore not exposed')
      store.getState().addNode('conversation', { x: 500, y: 300 })
      store.getState().addNode('note', { x: 0, y: 300 })
    })
    await page.waitForTimeout(500)

    // Find note (leftmost) and conversation (rightmost)
    const allNodes = await page.locator('.react-flow__node').all()
    let noteBox = await allNodes[0]!.boundingBox()
    let convBox = await allNodes[0]!.boundingBox()

    for (const n of allNodes) {
      const box = await n.boundingBox()
      if (box && noteBox && box.x < noteBox.x) noteBox = box
      if (box && convBox && box.x > convBox.x) convBox = box
    }
    expect(noteBox).toBeTruthy()
    expect(convBox).toBeTruthy()

    const startX = noteBox!.x + noteBox!.width / 2
    const startY = noteBox!.y + noteBox!.height / 2
    const endX = convBox!.x - noteBox!.width / 2 - 50
    const endY = convBox!.y + convBox!.height / 2

    const client = await page.context().newCDPSession(page)
    const steps = 20
    const deltaX = (endX - startX) / steps
    const deltaY = (endY - startY) / steps

    // Touch start
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [tp(startX, startY)],
    })
    await page.waitForTimeout(50)

    // Drag toward conversation
    for (let i = 1; i <= steps; i++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [tp(startX + deltaX * i, startY + deltaY * i)],
      })
      await page.waitForTimeout(30)
    }

    // Wait for throttled proximity check to fire (100ms interval)
    await page.waitForTimeout(200)

    // ── Verify: conversation node has proximity-target class ──
    const highlightedCount = await page.locator('.react-flow__node.proximity-target').count()
    expect(highlightedCount).toBeGreaterThan(0)

    // Clean up: touch end
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [tp(endX, endY, 0)],
    })
  })

  test('does NOT create edge when note touch-dragged far from conversation', async ({ page }) => {
    // ── Setup: conversation at (500, 300), note at (0, 300) ──
    await page.evaluate(() => {
      const store = (window as any).__workspaceStore
      if (!store) throw new Error('workspaceStore not exposed')
      store.getState().addNode('conversation', { x: 500, y: 300 })
      store.getState().addNode('note', { x: 0, y: 300 })
    })
    await page.waitForTimeout(500)

    const initialEdgeCount = await page.locator('.react-flow__edge').count()

    // Find note (leftmost)
    const allNodes = await page.locator('.react-flow__node').all()
    let noteBox = await allNodes[0]!.boundingBox()
    for (const n of allNodes) {
      const box = await n.boundingBox()
      if (box && noteBox && box.x < noteBox.x) noteBox = box
    }
    expect(noteBox).toBeTruthy()

    const startX = noteBox!.x + noteBox!.width / 2
    const startY = noteBox!.y + noteBox!.height / 2

    // Drag only 50px right — still far from conversation
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [tp(startX, startY)],
    })
    await page.waitForTimeout(50)

    const dragEndX = startX + 50
    for (let i = 1; i <= 10; i++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [tp(startX + i * 5, startY)],
      })
      await page.waitForTimeout(30)
    }

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [tp(dragEndX, startY, 0)],
    })

    await page.waitForTimeout(1000)

    const finalEdgeCount = await page.locator('.react-flow__edge').count()
    expect(finalEdgeCount).toBe(initialEdgeCount)
  })
})
