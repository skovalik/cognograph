// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * MANAGED_MODELS — the default Anthropic model presets seeded into the
 * connector store on first run. Surfaced in the BottomCommandBar model
 * dropdown so users can pick a tier without hand-typing model IDs.
 *
 * Shared between the web bootstrap (`src/web/canvas.tsx`) and the Electron
 * bootstrap (`src/renderer/src/App.tsx`) so both surfaces offer identical
 * out-of-the-box Anthropic coverage and stay in sync when the list changes.
 *
 * Naming convention: `name` is the short label shown in the dropdown;
 * `model` is the exact API model ID passed to the SDK. IDs match the
 * public Anthropic aliases as of 2026-04.
 */
export const MANAGED_MODELS: Array<{ name: string; model: string }> = [
  { name: 'Haiku (Fast)', model: 'claude-haiku-4-5-20251001' },
  { name: 'Sonnet', model: 'claude-sonnet-4-6' },
  { name: 'Opus', model: 'claude-opus-4-7' },
]
