// =============================================================================
// dispatchMenuItems.test.ts -- Tests for dispatch context menu items
//
// Phase 6E: Rich Node Depth System - Dispatch Workflow Integration
// =============================================================================

import { describe, it, expect } from 'vitest'
import { getDispatchMenuItems } from '../dispatchMenuItems'
import type { TaskNodeData, NoteNodeData, ConversationNodeData } from '@shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTaskData(): TaskNodeData {
  return {
    type: 'task',
    title: 'Test task',
    description: 'A test task description',
    status: 'todo',
    priority: 'medium',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function makeNoteData(): NoteNodeData {
  return {
    type: 'note',
    title: 'Test note',
    content: 'Some note content',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function makeConversationData(): ConversationNodeData {
  return {
    type: 'conversation',
    title: 'Test conversation',
    messages: [],
    provider: 'anthropic',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// getDispatchMenuItems
// ---------------------------------------------------------------------------

describe('getDispatchMenuItems', () => {
  it('returns menu items for a TaskNode', () => {
    const items = getDispatchMenuItems('node-1', 'task', makeTaskData())

    expect(items.length).toBeGreaterThan(0)
  })

  it('returns the Run in Embedded CLI item with correct label', () => {
    const items = getDispatchMenuItems('node-1', 'task', makeTaskData())

    expect(items[0].label).toBe('Run in Embedded CLI')
  })

  it('returns the Terminal icon for the dispatch item', () => {
    const items = getDispatchMenuItems('node-1', 'task', makeTaskData())

    expect(items[0].icon).toBe('Terminal')
  })

  it('marks the dispatch item as enabled', () => {
    const items = getDispatchMenuItems('node-1', 'task', makeTaskData())

    expect(items[0].enabled).toBe(true)
  })

  it('sets nodeType to task on the dispatch item', () => {
    const items = getDispatchMenuItems('node-1', 'task', makeTaskData())

    expect(items[0].nodeType).toBe('task')
  })

  it('returns empty array for NoteNode type', () => {
    const items = getDispatchMenuItems('node-2', 'note', makeNoteData())

    expect(items).toEqual([])
  })

  it('returns empty array for ConversationNode type', () => {
    const items = getDispatchMenuItems('node-3', 'conversation', makeConversationData())

    expect(items).toEqual([])
  })

  it('returns empty array for project node type', () => {
    // Use a task data with overridden type for simplicity -- nodeType param is what matters
    const items = getDispatchMenuItems('node-4', 'project', makeTaskData())

    expect(items).toEqual([])
  })
})
