// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * loadWorkspace legacy artifact migration — regression test for commit 9738de0.
 *
 * Failure mode the original bug surfaced: loading a workspace JSON authored
 * before the ArtifactNodeData schema added `versionHistory` and `source` fields
 * crashed with "TypeError: Cannot read properties of undefined (reading 'type')"
 * (PropertiesPanel reading source.type) and "Cannot read properties of undefined
 * (reading 'length')" (VersionHistoryPanel reading versionHistory.length).
 *
 * Fix: migrateNodeProperties — invoked from loadWorkspace via migrateWorkspaceNodes
 * — backfills both fields with safe defaults when missing from a legacy node.
 *
 * Test path: load a WorkspaceData fixture containing a legacy artifact node
 * (missing versionHistory and/or source), then assert the post-migration node
 * has the defensive defaults.
 */

import type { ArtifactNodeData, WorkspaceData } from '@shared/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { getWorkspaceState, resetWorkspaceStore } from '../../../../test/storeUtils'
import { useWorkspaceStore } from '../workspaceStore'

function makeWorkspaceFixture(artifactData: Partial<ArtifactNodeData>): WorkspaceData {
  return {
    id: 'ws-legacy',
    name: 'Legacy workspace',
    nodes: [
      {
        id: 'art-legacy',
        type: 'artifact',
        position: { x: 0, y: 0 },
        data: {
          type: 'artifact',
          title: 'Legacy artifact',
          content: 'pre-schema content',
          contentType: 'text',
          ...artifactData,
        } as ArtifactNodeData,
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: 1,
    updatedAt: 2,
    version: 1,
  }
}

function getMigratedArtifactData(): ArtifactNodeData {
  const node = getWorkspaceState().nodes.find((n) => n.id === 'art-legacy')
  expect(node).toBeDefined()
  return node!.data as ArtifactNodeData
}

describe('loadWorkspace — legacy artifact migration (commit 9738de0)', () => {
  beforeEach(() => {
    resetWorkspaceStore()
  })

  it('backfills versionHistory: [] when the field is missing on a legacy artifact', () => {
    const fixture = makeWorkspaceFixture({})
    // Sanity: source IS present on the input here so we isolate versionHistory
    ;(fixture.nodes[0]!.data as ArtifactNodeData).source = { type: 'created', method: 'manual' }
    expect((fixture.nodes[0]!.data as ArtifactNodeData).versionHistory).toBeUndefined()

    useWorkspaceStore.getState().loadWorkspace(fixture)

    expect(getMigratedArtifactData().versionHistory).toEqual([])
  })

  it('backfills source = { type: created, method: manual } when source is missing', () => {
    const fixture = makeWorkspaceFixture({
      // versionHistory present so we isolate the source path
      versionHistory: [],
    })
    expect((fixture.nodes[0]!.data as ArtifactNodeData).source).toBeUndefined()

    useWorkspaceStore.getState().loadWorkspace(fixture)

    const migrated = getMigratedArtifactData()
    expect(migrated.source).toEqual({ type: 'created', method: 'manual' })
  })

  it('backfills source when source exists but source.type is missing', () => {
    const fixture = makeWorkspaceFixture({
      versionHistory: [],
      // Malformed source object — type field absent. Cast preserves the test scenario.
      source: { method: 'manual' } as ArtifactNodeData['source'],
    })

    useWorkspaceStore.getState().loadWorkspace(fixture)

    const migrated = getMigratedArtifactData()
    expect(migrated.source).toEqual({ type: 'created', method: 'manual' })
  })

  it('backfills BOTH versionHistory AND source on a fully-legacy artifact', () => {
    // The end-to-end scenario the original crash hit
    const fixture = makeWorkspaceFixture({})
    expect((fixture.nodes[0]!.data as ArtifactNodeData).versionHistory).toBeUndefined()
    expect((fixture.nodes[0]!.data as ArtifactNodeData).source).toBeUndefined()

    useWorkspaceStore.getState().loadWorkspace(fixture)

    const migrated = getMigratedArtifactData()
    expect(migrated.versionHistory).toEqual([])
    expect(migrated.source).toEqual({ type: 'created', method: 'manual' })
  })

  it('preserves source when present and well-formed (does not stomp existing data)', () => {
    const fixture = makeWorkspaceFixture({
      versionHistory: [],
      source: { type: 'file-drop', filename: 'notes.txt' },
    })

    useWorkspaceStore.getState().loadWorkspace(fixture)

    const migrated = getMigratedArtifactData()
    expect(migrated.source).toEqual({ type: 'file-drop', filename: 'notes.txt' })
  })

  it('preserves versionHistory when present and non-empty (does not stomp existing data)', () => {
    const existingVersion = {
      version: 1,
      content: 'old',
      timestamp: 100,
      label: 'initial',
    }
    const fixture = makeWorkspaceFixture({
      versionHistory: [existingVersion as ArtifactNodeData['versionHistory'][number]],
      source: { type: 'created', method: 'manual' },
    })

    useWorkspaceStore.getState().loadWorkspace(fixture)

    const migrated = getMigratedArtifactData()
    expect(migrated.versionHistory).toHaveLength(1)
    expect(migrated.versionHistory![0]!.content).toBe('old')
  })

  it('does not crash when reading post-migration source.type (the original crash signature)', () => {
    const fixture = makeWorkspaceFixture({})

    useWorkspaceStore.getState().loadWorkspace(fixture)

    // Reading source.type was the literal call site in the original crash
    // (PropertiesPanel ArtifactFields.getSourceDescription).
    const migrated = getMigratedArtifactData()
    expect(() => {
      const _typeRead: string = migrated.source!.type
      void _typeRead
    }).not.toThrow()
    expect(() => {
      const _lenRead: number = migrated.versionHistory!.length
      void _lenRead
    }).not.toThrow()
  })
})
