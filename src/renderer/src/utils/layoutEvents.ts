// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Layout Events — lightweight event bridge for cross-component layout coordination.
 * Avoids coupling chatToolService → React Flow instance.
 */

export const layoutEvents = new EventTarget()

export function requestFitView(
  nodeIds: string[],
  padding = 0.3,
  duration = 300,
  minZoom?: number,
): void {
  layoutEvents.dispatchEvent(
    new CustomEvent('fitView', { detail: { nodeIds, padding, duration, minZoom } }),
  )
}
