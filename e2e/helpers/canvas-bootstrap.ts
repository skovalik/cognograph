// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Unified web canvas bootstrap for Playwright.
 *
 * Sets test mode BEFORE navigation, installs Supabase mocks, navigates to
 * the canvas (demo or workspace mode), and waits for react-flow + store
 * exposure. One helper = one bootstrap contract for every web spec.
 */

import type { Page } from '@playwright/test'
import { enableTestMode, mockSupabaseAuth } from './welcome-helpers'

export interface BootCanvasOptions {
  mode: 'demo' | 'workspace'
}

export async function bootCanvas(page: Page, opts: BootCanvasOptions): Promise<void> {
  await enableTestMode(page)
  await mockSupabaseAuth(page)

  const path = opts.mode === 'demo' ? '/?mode=workspace-demo' : '/workspace'
  await page.goto(path)

  await page.locator('.react-flow').waitFor({ state: 'visible', timeout: 15000 })

  // Wait for store exposure. In the web build, the store is exposed by
  // `web/canvas.tsx:116-118` after bootCanvas() completes (gated on
  // `import.meta.env.DEV`, which is true in the Vite dev server).
  await page.waitForFunction(
    () =>
      typeof (window as { __workspaceStore?: { getState: () => unknown } }).__workspaceStore
        ?.getState === 'function',
    undefined,
    { timeout: 5000 },
  )
}
