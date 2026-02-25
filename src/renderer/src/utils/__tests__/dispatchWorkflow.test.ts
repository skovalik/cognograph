// =============================================================================
// dispatchWorkflow.test.ts -- Tests for task-to-CLI dispatch pipeline
//
// Phase 6E: Rich Node Depth System - Dispatch Workflow Integration
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  createDispatchNodeData,
  createDispatchEdge,
  buildDispatchContext,
} from '../dispatchWorkflow'
import type { TaskNodeData } from '@shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTaskNode(overrides: Partial<TaskNodeData> = {}): TaskNodeData {
  return {
    type: 'task',
    title: 'Implement auth module',
    description: 'Add JWT-based authentication to the API layer.',
    status: 'todo',
    priority: 'high',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// createDispatchNodeData
// ---------------------------------------------------------------------------

describe('createDispatchNodeData', () => {
  it('positions the new node offset right (+350) and down (+50) from the task', () => {
    const task = makeTaskNode()
    const result = createDispatchNodeData(task, { x: 100, y: 200 })

    expect(result.position.x).toBe(450) // 100 + 350
    expect(result.position.y).toBe(250) // 200 + 50
  })

  it('sets the title with a CLI: prefix', () => {
    const task = makeTaskNode({ title: 'Deploy service' })
    const result = createDispatchNodeData(task, { x: 0, y: 0 })

    expect(result.data.title).toBe('CLI: Deploy service')
  })

  it('sets mode to cc-session', () => {
    const task = makeTaskNode()
    const result = createDispatchNodeData(task, { x: 0, y: 0 })

    expect(result.data.mode).toBe('cc-session')
  })

  it('sets the node type to conversation', () => {
    const task = makeTaskNode()
    const result = createDispatchNodeData(task, { x: 0, y: 0 })

    expect(result.data.type).toBe('conversation')
  })

  it('includes a dispatchedFrom field referencing the task', () => {
    const task = makeTaskNode({ title: 'My Task' })
    const result = createDispatchNodeData(task, { x: 0, y: 0 })

    expect(result.data.dispatchedFrom).toBeDefined()
    expect(typeof result.data.dispatchedFrom).toBe('string')
    expect(result.data.dispatchedFrom.length).toBeGreaterThan(0)
  })

  it('initialises with an empty messages array', () => {
    const task = makeTaskNode()
    const result = createDispatchNodeData(task, { x: 0, y: 0 })

    expect(result.data.messages).toEqual([])
  })

  it('sets createdAt and updatedAt timestamps', () => {
    const before = Date.now()
    const task = makeTaskNode()
    const result = createDispatchNodeData(task, { x: 0, y: 0 })
    const after = Date.now()

    expect(result.data.createdAt).toBeGreaterThanOrEqual(before)
    expect(result.data.createdAt).toBeLessThanOrEqual(after)
    expect(result.data.updatedAt).toBeGreaterThanOrEqual(before)
    expect(result.data.updatedAt).toBeLessThanOrEqual(after)
  })

  it('handles negative task positions correctly', () => {
    const task = makeTaskNode()
    const result = createDispatchNodeData(task, { x: -200, y: -100 })

    expect(result.position.x).toBe(150)  // -200 + 350
    expect(result.position.y).toBe(-50)  // -100 + 50
  })
})

// ---------------------------------------------------------------------------
// createDispatchEdge
// ---------------------------------------------------------------------------

describe('createDispatchEdge', () => {
  it('sets the correct source and target node IDs', () => {
    const edge = createDispatchEdge('task-1', 'conv-1')

    expect(edge.source).toBe('task-1')
    expect(edge.target).toBe('conv-1')
  })

  it('assigns a contextRole of dispatched-to', () => {
    const edge = createDispatchEdge('task-1', 'conv-1')

    expect(edge.data?.contextRole).toBe('dispatched-to')
  })

  it('uses solid line style with normal or stronger stroke', () => {
    const edge = createDispatchEdge('task-1', 'conv-1')

    expect(edge.data?.lineStyle).toBe('solid')
    // Stroke should be visible (normal or bold, not thin)
    expect(['normal', 'bold', 'heavy']).toContain(edge.data?.strokePreset)
  })

  it('marks the edge as active', () => {
    const edge = createDispatchEdge('task-1', 'conv-1')

    expect(edge.data?.active).toBe(true)
  })

  it('generates a deterministic edge ID from source and target', () => {
    const edge = createDispatchEdge('task-1', 'conv-1')

    expect(edge.id).toBe('task-1-conv-1')
  })

  it('sets a color on the edge', () => {
    const edge = createDispatchEdge('task-1', 'conv-1')

    expect(edge.data?.color).toBeDefined()
    expect(typeof edge.data?.color).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// buildDispatchContext
// ---------------------------------------------------------------------------

describe('buildDispatchContext', () => {
  it('includes the task title as a heading', () => {
    const task = makeTaskNode({ title: 'Fix login bug' })
    const result = buildDispatchContext(task, [])

    expect(result).toContain('# Task: Fix login bug')
  })

  it('includes the task description', () => {
    const task = makeTaskNode({ description: 'The login form throws a 500 error.' })
    const result = buildDispatchContext(task, [])

    expect(result).toContain('The login form throws a 500 error.')
  })

  it('includes the context chain separated by dividers', () => {
    const task = makeTaskNode()
    const chain = ['Context from node A', 'Context from node B']
    const result = buildDispatchContext(task, chain)

    expect(result).toContain('## Context')
    expect(result).toContain('Context from node A')
    expect(result).toContain('Context from node B')
    expect(result).toContain('---')
  })

  it('omits the Context section when context chain is empty', () => {
    const task = makeTaskNode()
    const result = buildDispatchContext(task, [])

    expect(result).not.toContain('## Context')
  })

  it('handles a task with empty description gracefully', () => {
    const task = makeTaskNode({ description: '' })
    const result = buildDispatchContext(task, ['Some context'])

    expect(result).toContain('# Task:')
    expect(result).toContain('## Context')
    expect(result).toContain('Some context')
  })
})
