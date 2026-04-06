// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * BottomCommandBar Prefix Routing Tests
 *
 * Unit tests for the prefix detection and query extraction logic used
 * by the command bar's prefix routing system:
 *   /  → slash commands
 *   @  → node mention / search
 *   !  → terminal dispatch
 *   (none) → default chat/command
 */

import { describe, expect, it } from 'vitest'
import type { PrefixMode } from '../BottomCommandBar'
import { detectPrefixMode, getPrefixQuery } from '../BottomCommandBar'

// =============================================================================
// detectPrefixMode
// =============================================================================

describe('detectPrefixMode', () => {
  it('detects / prefix as slash mode', () => {
    expect(detectPrefixMode('/')).toBe('slash')
    expect(detectPrefixMode('/note')).toBe('slash')
    expect(detectPrefixMode('/ai:generate')).toBe('slash')
    expect(detectPrefixMode('/save')).toBe('slash')
  })

  it('detects @ prefix as mention mode', () => {
    expect(detectPrefixMode('@')).toBe('mention')
    expect(detectPrefixMode('@My Note')).toBe('mention')
    expect(detectPrefixMode('@project-plan')).toBe('mention')
  })

  it('detects ! prefix as terminal mode', () => {
    expect(detectPrefixMode('!')).toBe('terminal')
    expect(detectPrefixMode('!ls -la')).toBe('terminal')
    expect(detectPrefixMode('!npm install')).toBe('terminal')
  })

  it('returns none for unprefixed input', () => {
    expect(detectPrefixMode('')).toBe('none')
    expect(detectPrefixMode('create a note')).toBe('none')
    expect(detectPrefixMode('hello world')).toBe('none')
    expect(detectPrefixMode('  /not-a-prefix')).toBe('none') // space before /
  })

  it('only checks the very first character', () => {
    expect(detectPrefixMode('some /slash')).toBe('none')
    expect(detectPrefixMode('text @mention')).toBe('none')
    expect(detectPrefixMode('text !terminal')).toBe('none')
  })
})

// =============================================================================
// getPrefixQuery
// =============================================================================

describe('getPrefixQuery', () => {
  it('strips the prefix character for slash mode', () => {
    expect(getPrefixQuery('/note', 'slash')).toBe('note')
    expect(getPrefixQuery('/ai:generate', 'slash')).toBe('ai:generate')
    expect(getPrefixQuery('/', 'slash')).toBe('')
  })

  it('strips the prefix character for mention mode', () => {
    expect(getPrefixQuery('@My Note', 'mention')).toBe('My Note')
    expect(getPrefixQuery('@', 'mention')).toBe('')
  })

  it('strips the prefix character for terminal mode', () => {
    expect(getPrefixQuery('!ls -la', 'terminal')).toBe('ls -la')
    expect(getPrefixQuery('!', 'terminal')).toBe('')
  })

  it('returns full input for none mode', () => {
    expect(getPrefixQuery('hello world', 'none')).toBe('hello world')
    expect(getPrefixQuery('', 'none')).toBe('')
  })
})

// =============================================================================
// Slash command filtering (logic verification)
// =============================================================================

describe('slash command matching', () => {
  // Simulate the filtering logic from the component
  function filterCommands(
    query: string,
    commands: Array<{ label: string; alias?: string; description?: string; disabled?: boolean }>,
  ) {
    const q = query.toLowerCase()
    return commands.filter((cmd) => {
      if (cmd.disabled) return false
      if (!q) return true
      return (
        cmd.label.toLowerCase().includes(q) ||
        (cmd.alias && cmd.alias.toLowerCase().includes(q)) ||
        (cmd.description && cmd.description.toLowerCase().includes(q))
      )
    })
  }

  const mockCommands = [
    { label: 'New Note', alias: 'note', description: 'Create a new note node' },
    { label: 'New Task', alias: 'task', description: 'Create a new task node' },
    { label: 'Save Workspace', alias: 'save', description: 'Save current workspace' },
    { label: 'Undo', alias: 'undo', description: 'Nothing to undo', disabled: true },
  ]

  it('returns all non-disabled commands for empty query', () => {
    const results = filterCommands('', mockCommands)
    expect(results).toHaveLength(3) // undo is disabled
  })

  it('filters by alias', () => {
    const results = filterCommands('note', mockCommands)
    expect(results).toHaveLength(1)
    expect(results[0].alias).toBe('note')
  })

  it('filters by label', () => {
    const results = filterCommands('Task', mockCommands)
    expect(results).toHaveLength(1)
    expect(results[0].label).toBe('New Task')
  })

  it('filters by description', () => {
    const results = filterCommands('workspace', mockCommands)
    expect(results).toHaveLength(1)
    expect(results[0].alias).toBe('save')
  })

  it('excludes disabled commands', () => {
    const results = filterCommands('undo', mockCommands)
    expect(results).toHaveLength(0)
  })

  it('is case-insensitive', () => {
    const results = filterCommands('SAVE', mockCommands)
    expect(results).toHaveLength(1)
    expect(results[0].alias).toBe('save')
  })
})

// =============================================================================
// Node mention filtering (logic verification)
// =============================================================================

describe('node mention matching', () => {
  function filterNodes(
    query: string,
    nodes: Array<{ title: string; type: string; isArchived?: boolean }>,
  ) {
    const q = query.toLowerCase()
    return nodes.filter((node) => {
      if (node.isArchived) return false
      if (!q) return true
      return node.title.toLowerCase().includes(q) || node.type.toLowerCase().includes(q)
    })
  }

  const mockNodes = [
    { title: 'Project Plan', type: 'note' },
    { title: 'Bug Report', type: 'task' },
    { title: 'Agent Pipeline', type: 'conversation' },
    { title: 'Archived Item', type: 'note', isArchived: true },
  ]

  it('returns all non-archived nodes for empty query', () => {
    const results = filterNodes('', mockNodes)
    expect(results).toHaveLength(3)
  })

  it('filters by title', () => {
    const results = filterNodes('Plan', mockNodes)
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Project Plan')
  })

  it('filters by type', () => {
    const results = filterNodes('task', mockNodes)
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Bug Report')
  })

  it('excludes archived nodes', () => {
    const results = filterNodes('Archived', mockNodes)
    expect(results).toHaveLength(0)
  })

  it('is case-insensitive', () => {
    const results = filterNodes('BUG', mockNodes)
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Bug Report')
  })
})

// =============================================================================
// Terminal dispatch recognition
// =============================================================================

describe('terminal mode recognition', () => {
  it('recognizes ! prefix as terminal', () => {
    const mode = detectPrefixMode('!git status')
    const query = getPrefixQuery('!git status', mode)
    expect(mode).toBe('terminal')
    expect(query).toBe('git status')
  })

  it('extracts full command after !', () => {
    const mode = detectPrefixMode('!npm run build --watch')
    const query = getPrefixQuery('!npm run build --watch', mode)
    expect(mode).toBe('terminal')
    expect(query).toBe('npm run build --watch')
  })

  it('handles bare ! with no command', () => {
    const mode = detectPrefixMode('!')
    const query = getPrefixQuery('!', mode)
    expect(mode).toBe('terminal')
    expect(query).toBe('')
  })
})
