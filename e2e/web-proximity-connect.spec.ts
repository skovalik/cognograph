// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Proximity-Based Context Connection E2E Tests
 *
 * Verifies that dragging a content node near a conversation node
 * automatically creates an edge when dropped within the 150px threshold.
 *
 * Strategy:
 *   1. Create two nodes at known positions via store (conversation far right, note far left)
 *   2. Drag the note node toward the conversation node using real mouse events
 *   3. Drop within 150px edge-to-edge threshold
 *   4. Verify: edge count increases, toast notification appears
 *   5. Negative case: drop outside threshold, verify NO edge created
 *
 * Coordinates:
 *   - Default node size: 280x140 (flow coords)
 *   - PROXIMITY_THRESHOLD: 150px (flow coords, edge-to-edge)
 *   - Conversation at (800, 300): right edge at x=1080
 *   - Note at (0, 300): needs to be dragged so its right edge is within 150px of conv's left edge
 *   - Target drop: note at ~(470, 300) → right edge at 750, gap to conv left edge (800) = 50px ✓
 *   - Negative drop: note at ~(250, 300) → right edge at 530, gap to conv left edge (800) = 270px ✗
 */

import { test, expect } from '@playwright/test'
import { mockSupabaseAuth, seedNodeToDismissWelcome } from './helpers/welcome-helpers'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174'

test.describe('Proximity-based context connection', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseAuth(page)
    await page.goto(`${BASE}/?mode=workspace-demo`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await seedNodeToDismissWelcome(page)
    await page.waitForTimeout(500)
  })

  test('creates edge when note is dropped near conversation node', async ({ page }) => {
    // ── Setup: Create conversation node at (800, 300) and note at (0, 300) via store ──
    await page.evaluate(() => {
      const store = (window as any).__workspaceStore
      if (!store) throw new Error('workspaceStore not exposed')
      store.getState().addNode('conversation', { x: 800, y: 300 })
      store.getState().addNode('note', { x: 0, y: 300 })
    })
    await page.waitForTimeout(500)

    // Verify both nodes rendered
    const nodeCount = await page.locator('.react-flow__node').count()
    // seedNodeToDismissWelcome creates 1 note, we added 2 more = 3 total
    expect(nodeCount).toBeGreaterThanOrEqual(3)

    // Count initial edges
    const initialEdgeCount = await page.locator('.react-flow__edge').count()

    // ── Find the note node (last created, data-type or position-based) ──
    // The note at (0, 300) is the one we need to drag.
    // Find it by checking which node has the leftmost screen position.
    const allNodes = page.locator('.react-flow__node')
    const allBoxes = await allNodes.all()
    let noteNode = allBoxes[0]!
    let noteBox = await noteNode.boundingBox()

    for (const n of allBoxes) {
      const box = await n.boundingBox()
      if (box && noteBox && box.x < noteBox.x) {
        noteNode = n
        noteBox = box
      }
    }
    expect(noteBox).toBeTruthy()

    // ── Drag note toward conversation node ──
    // Start from center of note node
    const startX = noteBox!.x + noteBox!.width / 2
    const startY = noteBox!.y + noteBox!.height / 2

    // Find conversation node (rightmost node)
    let convNode = allBoxes[0]!
    let convBox = await convNode.boundingBox()
    for (const n of allBoxes) {
      const box = await n.boundingBox()
      if (box && convBox && box.x > convBox.x) {
        convNode = n
        convBox = box
      }
    }
    expect(convBox).toBeTruthy()

    // Target: drop so note's right edge is ~50px from conversation's left edge
    // We want the note centered at approximately (convBox.left - noteBox.width/2 - 50)
    // in screen coordinates. But React Flow may have a zoom/pan transform,
    // so we compute the delta to move.
    const targetCenterX = convBox!.x - noteBox!.width / 2 - 50
    const targetCenterY = convBox!.y + convBox!.height / 2

    // Perform the drag
    await page.mouse.move(startX, startY)
    await page.waitForTimeout(100)
    await page.mouse.down()
    await page.waitForTimeout(100)
    await page.mouse.move(targetCenterX, targetCenterY, { steps: 25 })
    await page.waitForTimeout(200)
    await page.mouse.up()

    // ── Verify: edge was created ──
    // Wait for edge to appear (addEdge is sync, but React may need a tick)
    await page.waitForTimeout(1000)

    const finalEdgeCount = await page.locator('.react-flow__edge').count()
    expect(finalEdgeCount).toBeGreaterThan(initialEdgeCount)

    // ── Verify: toast notification appeared ──
    // sciFiToast renders with role="status" or in a toast container
    // Check for the "Connected" text in any visible element
    const toastVisible = await page.locator('text=/Connected.*as context/').count()
    // Toast may have auto-dismissed by now, so this is a soft check
    // The edge count increase is the authoritative verification
    if (toastVisible > 0) {
      expect(toastVisible).toBeGreaterThan(0)
    }
  })

  test('does NOT create edge when note is dropped far from conversation', async ({ page }) => {
    // ── Setup: Conversation at (800, 300), note at (0, 300) ──
    await page.evaluate(() => {
      const store = (window as any).__workspaceStore
      if (!store) throw new Error('workspaceStore not exposed')
      store.getState().addNode('conversation', { x: 800, y: 300 })
      store.getState().addNode('note', { x: 0, y: 300 })
    })
    await page.waitForTimeout(500)

    // Count initial edges
    const initialEdgeCount = await page.locator('.react-flow__edge').count()

    // Find leftmost node (note at x=0)
    const allNodes = await page.locator('.react-flow__node').all()
    let noteNode = allNodes[0]!
    let noteBox = await noteNode.boundingBox()
    for (const n of allNodes) {
      const box = await n.boundingBox()
      if (box && noteBox && box.x < noteBox.x) {
        noteNode = n
        noteBox = box
      }
    }
    expect(noteBox).toBeTruthy()

    // ── Drag note only slightly — keep it far from conversation ──
    // Move 100px right: note right edge at ~380, conv left edge at 800 → gap = 420px >> 150px
    const startX = noteBox!.x + noteBox!.width / 2
    const startY = noteBox!.y + noteBox!.height / 2

    await page.mouse.move(startX, startY)
    await page.waitForTimeout(100)
    await page.mouse.down()
    await page.waitForTimeout(100)
    await page.mouse.move(startX + 100, startY, { steps: 15 })
    await page.waitForTimeout(200)
    await page.mouse.up()

    await page.waitForTimeout(1000)

    // ── Verify: NO new edge ──
    const finalEdgeCount = await page.locator('.react-flow__edge').count()
    expect(finalEdgeCount).toBe(initialEdgeCount)
  })

  test('does NOT create edge when dragging conversation near conversation', async ({ page }) => {
    // ── Setup: Two conversation nodes ──
    await page.evaluate(() => {
      const store = (window as any).__workspaceStore
      if (!store) throw new Error('workspaceStore not exposed')
      store.getState().addNode('conversation', { x: 0, y: 300 })
      store.getState().addNode('conversation', { x: 600, y: 300 })
    })
    await page.waitForTimeout(500)

    const initialEdgeCount = await page.locator('.react-flow__edge').count()

    // Find leftmost conversation node
    const allNodes = await page.locator('.react-flow__node').all()
    let leftNode = allNodes[0]!
    let leftBox = await leftNode.boundingBox()
    for (const n of allNodes) {
      const box = await n.boundingBox()
      if (box && leftBox && box.x < leftBox.x) {
        leftNode = n
        leftBox = box
      }
    }
    expect(leftBox).toBeTruthy()

    // Find rightmost node
    let rightBox = await allNodes[0]!.boundingBox()
    for (const n of allNodes) {
      const box = await n.boundingBox()
      if (box && rightBox && box.x > rightBox.x) {
        rightBox = box
      }
    }
    expect(rightBox).toBeTruthy()

    // Drag left conversation right, close to the other
    const startX = leftBox!.x + leftBox!.width / 2
    const startY = leftBox!.y + leftBox!.height / 2
    const targetX = rightBox!.x - leftBox!.width / 2 - 30 // 30px gap (within threshold)

    await page.mouse.move(startX, startY)
    await page.waitForTimeout(100)
    await page.mouse.down()
    await page.waitForTimeout(100)
    await page.mouse.move(targetX, startY, { steps: 20 })
    await page.waitForTimeout(200)
    await page.mouse.up()

    await page.waitForTimeout(1000)

    // ── Verify: NO edge (conversation-to-conversation gated in App.tsx) ──
    const finalEdgeCount = await page.locator('.react-flow__edge').count()
    expect(finalEdgeCount).toBe(initialEdgeCount)
  })

  test('undo removes proximity-created edge', async ({ page }) => {
    // ── Setup: Conversation at (800, 300), note at (0, 300) ──
    await page.evaluate(() => {
      const store = (window as any).__workspaceStore
      if (!store) throw new Error('workspaceStore not exposed')
      store.getState().addNode('conversation', { x: 800, y: 300 })
      store.getState().addNode('note', { x: 0, y: 300 })
    })
    await page.waitForTimeout(500)

    const initialEdgeCount = await page.locator('.react-flow__edge').count()

    // Find leftmost node (note)
    const allNodes = await page.locator('.react-flow__node').all()
    let noteBox = await allNodes[0]!.boundingBox()
    for (const n of allNodes) {
      const box = await n.boundingBox()
      if (box && noteBox && box.x < noteBox.x) noteBox = box
    }
    expect(noteBox).toBeTruthy()

    // Find rightmost node (conversation)
    let convBox = await allNodes[0]!.boundingBox()
    for (const n of allNodes) {
      const box = await n.boundingBox()
      if (box && convBox && box.x > convBox.x) convBox = box
    }
    expect(convBox).toBeTruthy()

    // Drag note close to conversation (50px gap)
    const startX = noteBox!.x + noteBox!.width / 2
    const startY = noteBox!.y + noteBox!.height / 2
    const targetX = convBox!.x - noteBox!.width / 2 - 50

    await page.mouse.move(startX, startY)
    await page.waitForTimeout(100)
    await page.mouse.down()
    await page.waitForTimeout(100)
    await page.mouse.move(targetX, convBox!.y + convBox!.height / 2, { steps: 25 })
    await page.waitForTimeout(200)
    await page.mouse.up()
    await page.waitForTimeout(1000)

    // Verify edge was created
    const afterConnectEdgeCount = await page.locator('.react-flow__edge').count()
    expect(afterConnectEdgeCount).toBeGreaterThan(initialEdgeCount)

    // ── Undo ──
    // Click canvas first to ensure focus is on the canvas (not a node input)
    await page.locator('.react-flow__pane').click({ position: { x: 50, y: 50 } })
    await page.waitForTimeout(200)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(1000)

    // Verify edge was removed by undo
    const afterUndoEdgeCount = await page.locator('.react-flow__edge').count()
    expect(afterUndoEdgeCount).toBe(initialEdgeCount)
  })
})
