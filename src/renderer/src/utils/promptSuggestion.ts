// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { CommandLogEntry } from '@shared/types'
import type { Edge, Node } from '@xyflow/react'

/** Contextual prompt suggestions that showcase Cognograph's spatial AI capabilities */

// ── Static pools ──

const EMPTY_WORKSPACE = [
  'Build me a research cluster',
  'Scaffold a project on canvas',
  'Map out an idea for me',
]

const SPATIAL_DISCOVERY = [
  'Map my context web',
  "What's isolated on this canvas?",
  'Find my central hub nodes',
  'Show me unconnected clusters',
]

const CONTEXT_POWER = [
  'Summarize everything connected here',
  'What context am I giving the AI?',
  'Draft from my connected notes',
  'Connect my notes, then brief me',
]

const PLAN_PREVIEW = [
  'Propose a task breakdown',
  'Build me a research cluster',
  'Scaffold this project on canvas',
]

const ORCHESTRATION = [
  'Run my agents in parallel',
  'Chain these agents sequentially',
  'Set up an auto-trigger here',
]

function pick<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export function generateSuggestions(
  nodes: Node[],
  edges: Edge[],
  lastCommand?: CommandLogEntry,
): string[] {
  const suggestions: string[] = []

  // Empty workspace — entice with spatial capabilities
  if (nodes.length === 0) {
    return pick(EMPTY_WORKSPACE, 2)
  }

  // Node type counts
  const types = new Map<string, number>()
  for (const n of nodes) {
    const t = (n.data as any)?.type || 'unknown'
    types.set(t, (types.get(t) || 0) + 1)
  }

  const connectedIds = new Set(edges.flatMap((e) => [e.source, e.target]))
  const orphanCount = nodes.filter((n) => !connectedIds.has(n.id)).length

  // Conditional: orphan nodes
  if (orphanCount >= 3) {
    suggestions.push('Wire these orphans into context')
  }

  // Conditional: tasks that look done
  const doneTasks = nodes.filter(
    (n) => (n.data as any)?.type === 'task' && (n.data as any)?.status === 'done',
  )
  if (doneTasks.length >= 3) {
    suggestions.push('These tasks look done — archive?')
  }

  // Conditional: artifacts without conversation connections
  const artifactCount = types.get('artifact') || 0
  if (artifactCount > 0 && (types.get('conversation') || 0) > 0) {
    suggestions.push('Ask AI to review this artifact')
  }

  // Conditional: after a successful command — suggest bigger structural work
  if (lastCommand?.status === 'done' && lastCommand.affectedNodeIds.length > 0) {
    suggestions.push(...pick(PLAN_PREVIEW, 1))
  }

  // Conditional: orchestrators or agents exist
  if ((types.get('orchestrator') || 0) > 0 || (types.get('action') || 0) > 0) {
    suggestions.push(...pick(ORCHESTRATION, 1))
  }

  // Always include 1 spatial discovery suggestion for workspaces with 3+ nodes
  if (nodes.length >= 3) {
    suggestions.push(...pick(SPATIAL_DISCOVERY, 1))
  }

  // Fill remaining slots with context-power suggestions
  if (suggestions.length < 3 && edges.length > 0) {
    suggestions.push(...pick(CONTEXT_POWER, 3 - suggestions.length))
  }

  // Fallback if still empty
  if (suggestions.length === 0) {
    suggestions.push(...pick([...SPATIAL_DISCOVERY, ...CONTEXT_POWER], 2))
  }

  return suggestions.slice(0, 3)
}
