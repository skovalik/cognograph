import type { Page } from '@playwright/test'

/** Wait for app to be fully ready */
export async function waitForCanvas(window: Page): Promise<void> {
  await window.waitForSelector('.react-flow', { timeout: 30000 })
  // Dismiss any onboarding overlay
  const skip = window.locator('button:has-text("Skip"), button[title="Skip onboarding"]')
  if (await skip.count() > 0) {
    await skip.first().click()
    await window.waitForTimeout(300)
  }
}

/** Focus the canvas to clear any active input */
export async function focusCanvas(window: Page): Promise<void> {
  await window.locator('.react-flow__pane').click({ position: { x: 50, y: 50 } })
  await window.waitForTimeout(100)
}

/** Wait for stores to be exposed (async import in main.tsx) */
export async function waitForStores(window: Page, timeout = 5000): Promise<boolean> {
  try {
    await window.waitForFunction(
      () =>
        !!(window as any).__workspaceStore &&
        !!(window as any).__uiStore &&
        !!(window as any).__permissionStore &&
        !!(window as any).__orchestratorStore &&
        !!(window as any).__notificationStore,
      { timeout }
    )
    return true
  } catch {
    // Fallback: at minimum workspaceStore + uiStore must be present
    try {
      await window.waitForFunction(
        () => !!(window as any).__workspaceStore && !!(window as any).__uiStore,
        { timeout: 2000 }
      )
      return true
    } catch {
      return false
    }
  }
}

/** Set a safe desktop viewport to prevent isMobile from suppressing components */
export async function setDesktopViewport(window: Page): Promise<void> {
  await window.setViewportSize({ width: 1280, height: 800 })
}

/** Seed commandLog entries for testing */
export async function seedCommandLog(window: Page, entries: Array<{
  id: string; input: string; tier: number; status: string; narration: string; affectedNodeIds: string[]; timestamp: number
}>): Promise<void> {
  // Store uses immer middleware — must mutate via set() callback, not raw setState merge
  await window.evaluate((e) => {
    const store = (window as any).__workspaceStore
    if (store) {
      store.setState((state: any) => { state.commandLog = e })
    }
  }, entries)
}

/** Get the current node count */
export async function getNodeCount(window: Page): Promise<number> {
  return window.locator('.react-flow__node').count()
}

/** Clear all node selection via store */
export async function clearSelection(window: Page): Promise<void> {
  await window.evaluate(() => {
    const store = (window as any).__workspaceStore
    if (store) store.getState().setSelectedNodes([])
  })
  await window.waitForTimeout(100)
}

/** Create a note node via store */
export async function createNoteNode(window: Page): Promise<string | null> {
  return window.evaluate(() => {
    const store = (window as any).__workspaceStore
    if (!store) return null
    const id = store.getState().addNode('note', { x: 300 + Math.random() * 200, y: 300 + Math.random() * 200 })
    return id
  })
}
