/**
 * Smart E2E Test Fixture
 *
 * Extends the base Electron fixture with Smart E2E utilities.
 */

import { test as base, expect } from '../../fixtures/electronApp'

export { expect }

export const test = base.extend({
  // No additional fixtures needed for Phase A
  // Phase B/C may add calibration fixtures, multi-model fixtures, etc.
})
