// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * W5H-S15 — main-process mirror of `getEffectiveAllowedPaths` derivation.
 *
 * Verifies `deriveAllowedPathsFromWorkspaceNodes` produces the expected
 * allowed-paths list from the on-disk workspace shape (project / artifact /
 * conversation node data). Architecturally separate from the renderer's
 * helper at `src/renderer/src/services/agentTools.ts:667` per security
 * invariant 0.1b ("allowedPaths computed in main process, never accepted
 * from renderer").
 */

import { describe, expect, it } from 'vitest'
import { deriveAllowedPathsFromWorkspaceNodes } from '../filesystemTools'

type Node = { id: string; data: Record<string, unknown> }

describe('deriveAllowedPathsFromWorkspaceNodes (W5H-S15)', () => {
  it('returns empty list for empty nodes array', () => {
    expect(deriveAllowedPathsFromWorkspaceNodes([])).toEqual([])
  })

  it('extracts folderPath from project nodes', () => {
    const nodes: Node[] = [
      { id: 'p1', data: { type: 'project', folderPath: '/home/stefan/work/project-a' } },
      { id: 'p2', data: { type: 'project', folderPath: '/home/stefan/work/project-b' } },
    ]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual([
      '/home/stefan/work/project-a',
      '/home/stefan/work/project-b',
    ])
  })

  it('skips project nodes with empty folderPath', () => {
    const nodes: Node[] = [
      { id: 'p1', data: { type: 'project', folderPath: '' } },
      { id: 'p2', data: { type: 'project' } },
    ]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual([])
  })

  it('extracts folderPath from artifact nodes', () => {
    const nodes: Node[] = [{ id: 'a1', data: { type: 'artifact', folderPath: '/var/data/output' } }]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual(['/var/data/output'])
  })

  it('extracts parent dir from artifact file-drop sources', () => {
    const nodes: Node[] = [
      {
        id: 'a1',
        data: {
          type: 'artifact',
          source: { type: 'file-drop', originalPath: '/Users/me/docs/spec.md' },
        },
      },
    ]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual(['/Users/me/docs'])
  })

  it('extracts parent dir from artifact custom filePath property', () => {
    const nodes: Node[] = [
      {
        id: 'a1',
        data: {
          type: 'artifact',
          properties: { filePath: 'C:\\Users\\stefan\\Documents\\notes.txt' },
        },
      },
    ]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual(['C:\\Users\\stefan\\Documents'])
  })

  it('prioritizes artifact folderPath over source.originalPath', () => {
    const nodes: Node[] = [
      {
        id: 'a1',
        data: {
          type: 'artifact',
          folderPath: '/explicit/folder',
          source: { type: 'file-drop', originalPath: '/some/other/file.md' },
        },
      },
    ]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual(['/explicit/folder'])
  })

  it('merges agentSettings.allowedPaths from conversation nodes', () => {
    const nodes: Node[] = [
      {
        id: 'c1',
        data: {
          type: 'conversation',
          agentSettings: { allowedPaths: ['/explicit/path-1', '/explicit/path-2'] },
        },
      },
    ]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual([
      '/explicit/path-1',
      '/explicit/path-2',
    ])
  })

  it('combines paths across project + artifact + conversation nodes', () => {
    const nodes: Node[] = [
      { id: 'p1', data: { type: 'project', folderPath: '/proj' } },
      { id: 'a1', data: { type: 'artifact', folderPath: '/artifact-folder' } },
      {
        id: 'c1',
        data: {
          type: 'conversation',
          agentSettings: { allowedPaths: ['/explicit'] },
        },
      },
    ]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual([
      '/proj',
      '/artifact-folder',
      '/explicit',
    ])
  })

  it('skips nodes with no data', () => {
    const nodes = [
      { id: 'broken', data: null as unknown as Record<string, unknown> },
      { id: 'ok', data: { type: 'project', folderPath: '/ok' } },
    ]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual(['/ok'])
  })

  it('does not deduplicate (caller is responsible for dedup via Set)', () => {
    const nodes: Node[] = [
      { id: 'p1', data: { type: 'project', folderPath: '/dup' } },
      { id: 'p2', data: { type: 'project', folderPath: '/dup' } },
    ]
    // Returns both — refreshWorkspaceSecurityContext wraps with Array.from(new Set(...))
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual(['/dup', '/dup'])
  })

  it('skips file-drop with no path separator (defensive)', () => {
    const nodes: Node[] = [
      {
        id: 'a1',
        data: {
          type: 'artifact',
          source: { type: 'file-drop', originalPath: 'no-separator-here.txt' },
        },
      },
    ]
    expect(deriveAllowedPathsFromWorkspaceNodes(nodes)).toEqual([])
  })
})
