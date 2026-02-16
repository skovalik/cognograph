/**
 * Test Workspace Factory
 *
 * Creates deterministic workspace states for testing.
 */

import type { Page } from '@playwright/test'

export interface WorkspaceState {
  nodes: Array<{
    type: string
    position: { x: number; y: number }
    data?: Record<string, any>
  }>
  edges: Array<{
    source: string
    target: string
  }>
}

/**
 * Create empty workspace
 */
export async function createEmptyWorkspace(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Clear localStorage
    localStorage.clear()

    // Reset Zustand stores if test hooks available
    if (window.__TEST_HOOKS__?.resetStore) {
      window.__TEST_HOOKS__.resetStore()
    }
  })

  // Reload to apply cleared state
  await page.reload()
  await page.waitForSelector('.react-flow', { timeout: 10000 })
}

/**
 * Create workspace with single conversation node
 */
export async function createSingleConversationWorkspace(page: Page): Promise<void> {
  await createEmptyWorkspace(page)

  // Create node via API (assumes API is exposed on window for testing)
  await page.evaluate(() => {
    // This will need to be adapted based on actual test API
    // For now, simulate via UI interaction
    const event = new MouseEvent('dblclick', {
      clientX: 400,
      clientY: 300,
      bubbles: true
    })
    document.querySelector('.react-flow')?.dispatchEvent(event)
  })

  // Wait for node to appear
  await page.waitForSelector('.react-flow__node', { timeout: 5000 })
}

/**
 * Create workspace with multiple connected nodes
 */
export async function createConnectedNodesWorkspace(
  page: Page,
  nodeCount: number
): Promise<void> {
  await createEmptyWorkspace(page)

  // Create nodes
  for (let i = 0; i < nodeCount; i++) {
    await page.evaluate((index) => {
      const event = new MouseEvent('dblclick', {
        clientX: 200 + index * 150,
        clientY: 300,
        bubbles: true
      })
      document.querySelector('.react-flow')?.dispatchEvent(event)
    }, i)

    await page.waitForTimeout(200) // Allow node creation to complete
  }

  // Connect nodes (source to target)
  // This will need UI automation or direct API calls
  // For now, leaving as placeholder
}

/**
 * Get current workspace state
 */
export async function getWorkspaceState(page: Page): Promise<WorkspaceState> {
  return page.evaluate(() => {
    const nodes: Array<{ type: string; position: { x: number; y: number } }> = []
    const edges: Array<{ source: string; target: string }> = []

    document.querySelectorAll('.react-flow__node').forEach((node) => {
      const id = node.getAttribute('data-id')
      const type = Array.from(node.classList)
        .find((c) => c.startsWith('react-flow__node-'))
        ?.replace('react-flow__node-', '') || 'unknown'

      const transform = window.getComputedStyle(node).transform
      const match = transform.match(/matrix\(1, 0, 0, 1, ([\d.-]+), ([\d.-]+)\)/)
      const x = match ? parseFloat(match[1]) : 0
      const y = match ? parseFloat(match[2]) : 0

      nodes.push({ type, position: { x, y } })
    })

    document.querySelectorAll('.react-flow__edge').forEach((edge) => {
      const source = edge.getAttribute('data-source') || ''
      const target = edge.getAttribute('data-target') || ''
      edges.push({ source, target })
    })

    return { nodes, edges }
  })
}
