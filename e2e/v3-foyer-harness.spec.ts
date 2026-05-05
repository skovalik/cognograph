// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { expect, test } from '@playwright/test'
import { bootCanvas } from './helpers/canvas-bootstrap'

test.describe('V3 Foyer harness smoke', () => {
  test('web canvas bootstraps and stores are exposed', async ({ page }) => {
    await bootCanvas(page, { mode: 'demo' })

    const count = await page.evaluate(() => {
      const store = (
        window as {
          __workspaceStore?: { getState: () => { nodes: Array<unknown> } }
        }
      ).__workspaceStore
      if (!store) throw new Error('__workspaceStore not exposed')
      return store.getState().nodes.length
    })

    expect(count).toBeGreaterThanOrEqual(0)
  })
})
