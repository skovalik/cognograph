// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// Conic gradient palettes per node type
export const CONIC_PALETTES: Record<string, [string, string, string, string]> = {
  conversation: ['#3b82f6', '#6366f1', '#a78bfa', '#e879f9'],
  note: ['#f59e0b', '#fbbf24', '#f97316', '#fb7185'],
  task: ['#6B9E84', '#34d399', '#2dd4bf', '#38bdf8'],
  artifact: ['#5A8EAB', '#38bdf8', '#818cf8', '#c084fc'],
  project: ['#7C7CAB', '#8b5cf6', '#a78bfa', '#c084fc'],
  action: ['#C4845A', '#f97316', '#fb923c', '#fbbf24'],
  orchestrator: ['#a855f7', '#c084fc', '#e879f9', '#f472b6'],
  default: ['#C8963E', '#E5B95C', '#d4a056', '#b8860b'],
}
