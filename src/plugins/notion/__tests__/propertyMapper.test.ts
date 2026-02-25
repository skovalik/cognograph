// PropertyMapper Unit Tests
// Covers: all exported functions + status/priority mappings + truncation

import { describe, it, expect } from 'vitest'
import {
  taskToNotion,
  taskFromNotion,
  projectToNotion,
  projectFromNotion,
  noteToNotionPageProperties,
  artifactToNotionPageProperties,
  getPageIcon,
  getTargetDbId,
  nodeToNotionProperties,
  notionToNodeFields,
  getFieldAuthority,
  RICH_TEXT_MAX,
  TRUNCATION_SUFFIX
} from '../main/propertyMapper'

// ---------------------------------------------------------------------------
// taskToNotion
// ---------------------------------------------------------------------------

describe('taskToNotion', () => {
  it('maps all fields to Notion properties', () => {
    const result = taskToNotion('node-1', {
      title: 'Fix login bug',
      description: 'Users cannot login with SSO',
      status: 'in-progress',
      priority: 'high',
      dueDate: 1708300800000 // 2024-02-19
    })

    expect(result.properties['Name']).toEqual({
      title: [{ text: { content: 'Fix login bug' } }]
    })
    expect(result.properties['Notes']).toEqual({
      rich_text: [{ text: { content: 'Users cannot login with SSO' } }]
    })
    expect(result.properties['Status']).toEqual({
      select: { name: 'In Progress' }
    })
    expect(result.properties['Priority']).toEqual({
      select: { name: 'High' }
    })
    expect(result.properties['Due Date']).toEqual({
      date: { start: '2024-02-19' }
    })
    expect(result.properties['Cognograph Node ID']).toEqual({
      rich_text: [{ text: { content: 'node-1' } }]
    })
  })

  it('omits undefined fields', () => {
    const result = taskToNotion('node-2', { title: 'Simple task' })

    expect(result.properties['Name']).toBeDefined()
    expect(result.properties['Notes']).toBeUndefined()
    expect(result.properties['Status']).toBeUndefined()
    expect(result.properties['Priority']).toBeUndefined()
    expect(result.properties['Due Date']).toBeUndefined()
    // Node ID is always present
    expect(result.properties['Cognograph Node ID']).toBeDefined()
  })

  it('maps all status values correctly', () => {
    const statuses: Record<string, string> = {
      'todo': 'To Do',
      'in-progress': 'In Progress',
      'done': 'Done'
    }

    for (const [cg, notion] of Object.entries(statuses)) {
      const result = taskToNotion('n', { status: cg })
      expect(result.properties['Status']).toEqual({ select: { name: notion } })
    }
  })

  it('skips unknown status values', () => {
    const result = taskToNotion('n', { status: 'cancelled' })
    expect(result.properties['Status']).toBeUndefined()
  })

  it('maps all priority values correctly', () => {
    const priorities: Record<string, string> = {
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    }

    for (const [cg, notion] of Object.entries(priorities)) {
      const result = taskToNotion('n', { priority: cg })
      expect(result.properties['Priority']).toEqual({ select: { name: notion } })
    }
  })

  it('skips priority "none"', () => {
    const result = taskToNotion('n', { priority: 'none' })
    expect(result.properties['Priority']).toBeUndefined()
  })

  it('truncates descriptions exceeding 2000 chars', () => {
    const longDesc = 'x'.repeat(RICH_TEXT_MAX + 100)
    const result = taskToNotion('n', { description: longDesc })

    const sentText = (result.properties['Notes'] as any).rich_text[0].text.content
    expect(sentText.length).toBe(RICH_TEXT_MAX)
    expect(sentText.endsWith(TRUNCATION_SUFFIX)).toBe(true)
    expect(result.truncatedDescription).toBe(sentText)
  })

  it('does not truncate descriptions at exactly 2000 chars', () => {
    const exactDesc = 'y'.repeat(RICH_TEXT_MAX)
    const result = taskToNotion('n', { description: exactDesc })

    const sentText = (result.properties['Notes'] as any).rich_text[0].text.content
    expect(sentText.length).toBe(RICH_TEXT_MAX)
    expect(result.truncatedDescription).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// taskFromNotion
// ---------------------------------------------------------------------------

describe('taskFromNotion', () => {
  it('extracts all fields from Notion properties', () => {
    const result = taskFromNotion({
      'Name': { title: [{ plain_text: 'Deploy v2' }] },
      'Status': { select: { name: 'In Progress' } },
      'Priority': { select: { name: 'High' } },
      'Due Date': { date: { start: '2024-03-01' } },
      'Notes': { rich_text: [{ plain_text: 'Production deploy' }] }
    })

    expect(result.title).toBe('Deploy v2')
    expect(result.status).toBe('in-progress')
    expect(result.priority).toBe('high')
    expect(result.dueDate).toBe(new Date('2024-03-01').getTime())
    expect(result.description).toBe('Production deploy')
  })

  it('maps Blocked status to todo + notion_blocked extra', () => {
    const result = taskFromNotion({
      'Status': { select: { name: 'Blocked' } }
    })

    expect(result.status).toBe('todo')
    expect(result.notionExtras['notion_blocked']).toBe(true)
  })

  it('maps In Review status to in-progress', () => {
    const result = taskFromNotion({
      'Status': { select: { name: 'In Review' } }
    })

    expect(result.status).toBe('in-progress')
  })

  it('defaults unknown status to todo', () => {
    const result = taskFromNotion({
      'Status': { select: { name: 'Custom Status' } }
    })

    expect(result.status).toBe('todo')
  })

  it('extracts Category and Actual Hours as notionExtras', () => {
    const result = taskFromNotion({
      'Category': { select: { name: 'Engineering' } },
      'Actual Hours': { rollup: { number: 12.5 } }
    })

    expect(result.notionExtras['notion_category']).toBe('Engineering')
    expect(result.notionExtras['notion_actualHours']).toBe(12.5)
  })

  it('handles empty properties gracefully', () => {
    const result = taskFromNotion({})
    expect(result.title).toBeUndefined()
    expect(result.status).toBeUndefined()
    expect(result.priority).toBeUndefined()
    expect(result.dueDate).toBeUndefined()
    expect(result.notionExtras).toEqual({})
  })

  it('concatenates multi-segment rich_text', () => {
    const result = taskFromNotion({
      'Name': {
        title: [
          { plain_text: 'Part 1 ' },
          { plain_text: 'Part 2' }
        ]
      }
    })

    expect(result.title).toBe('Part 1 Part 2')
  })
})

// ---------------------------------------------------------------------------
// projectToNotion
// ---------------------------------------------------------------------------

describe('projectToNotion', () => {
  it('maps title and description', () => {
    const result = projectToNotion('proj-1', {
      title: 'Website Redesign',
      description: 'Complete overhaul'
    })

    expect(result.properties['Name']).toEqual({
      title: [{ text: { content: 'Website Redesign' } }]
    })
    expect(result.properties['Notes']).toEqual({
      rich_text: [{ text: { content: 'Complete overhaul' } }]
    })
    expect(result.properties['Cognograph Node ID']).toEqual({
      rich_text: [{ text: { content: 'proj-1' } }]
    })
  })

  it('truncates long descriptions', () => {
    const longDesc = 'z'.repeat(RICH_TEXT_MAX + 50)
    const result = projectToNotion('p', { description: longDesc })

    const sentText = (result.properties['Notes'] as any).rich_text[0].text.content
    expect(sentText.length).toBe(RICH_TEXT_MAX)
    expect(sentText.endsWith(TRUNCATION_SUFFIX)).toBe(true)
    expect(result.truncatedDescription).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// projectFromNotion
// ---------------------------------------------------------------------------

describe('projectFromNotion', () => {
  it('extracts title, description, and read-only extras', () => {
    const result = projectFromNotion({
      'Name': { title: [{ plain_text: 'API v3' }] },
      'Notes': { rich_text: [{ plain_text: 'REST to GraphQL migration' }] },
      'Status': { select: { name: 'Active' } },
      'Priority': { select: { name: 'High' } },
      'Type': { select: { name: 'Build' } },
      'Value': { number: 5000 }
    })

    expect(result.title).toBe('API v3')
    expect(result.description).toBe('REST to GraphQL migration')
    expect(result.notionExtras['notion_status']).toBe('Active')
    expect(result.notionExtras['notion_priority']).toBe('High')
    expect(result.notionExtras['notion_type']).toBe('Build')
    expect(result.notionExtras['notion_value']).toBe(5000)
  })

  it('handles missing optional fields', () => {
    const result = projectFromNotion({
      'Name': { title: [{ plain_text: 'Minimal' }] }
    })

    expect(result.title).toBe('Minimal')
    expect(result.description).toBeUndefined()
    expect(Object.keys(result.notionExtras)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// noteToNotionPageProperties
// ---------------------------------------------------------------------------

describe('noteToNotionPageProperties', () => {
  it('maps title and tags', () => {
    const result = noteToNotionPageProperties('note-1', {
      title: 'Research Notes',
      tags: ['design', 'ux', 'research']
    })

    expect(result['title']).toEqual({
      title: [{ text: { content: 'Research Notes' } }]
    })
    expect(result['Tags']).toEqual({
      multi_select: [
        { name: 'design' },
        { name: 'ux' },
        { name: 'research' }
      ]
    })
  })

  it('omits Tags when array is empty', () => {
    const result = noteToNotionPageProperties('note-2', {
      title: 'No tags',
      tags: []
    })

    expect(result['Tags']).toBeUndefined()
  })

  it('omits Tags when not provided', () => {
    const result = noteToNotionPageProperties('note-3', {
      title: 'Plain note'
    })

    expect(result['Tags']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// artifactToNotionPageProperties
// ---------------------------------------------------------------------------

describe('artifactToNotionPageProperties', () => {
  it('maps title only', () => {
    const result = artifactToNotionPageProperties('art-1', {
      title: 'login.tsx'
    })

    expect(result['title']).toEqual({
      title: [{ text: { content: 'login.tsx' } }]
    })
  })
})

// ---------------------------------------------------------------------------
// getPageIcon
// ---------------------------------------------------------------------------

describe('getPageIcon', () => {
  it('returns correct emoji for note modes', () => {
    expect(getPageIcon('note', { noteMode: 'general' })).toEqual({ emoji: '📝' })
    expect(getPageIcon('note', { noteMode: 'reference' })).toEqual({ emoji: '📖' })
    expect(getPageIcon('note', { noteMode: 'background' })).toEqual({ emoji: '🔍' })
    expect(getPageIcon('note', { noteMode: 'examples' })).toEqual({ emoji: '💡' })
    expect(getPageIcon('note', { noteMode: 'page' })).toEqual({ emoji: '📄' })
    expect(getPageIcon('note', { noteMode: 'component' })).toEqual({ emoji: '🧩' })
    expect(getPageIcon('note', { noteMode: 'content-model' })).toEqual({ emoji: '🗂️' })
    expect(getPageIcon('note', { noteMode: 'wp-config' })).toEqual({ emoji: '⚙️' })
  })

  it('returns correct emoji for artifact types', () => {
    expect(getPageIcon('artifact', { contentType: 'code' })).toEqual({ emoji: '💻' })
    expect(getPageIcon('artifact', { contentType: 'markdown' })).toEqual({ emoji: '📝' })
    expect(getPageIcon('artifact', { contentType: 'html' })).toEqual({ emoji: '🌐' })
    expect(getPageIcon('artifact', { contentType: 'svg' })).toEqual({ emoji: '🎨' })
  })

  it('returns undefined for unknown modes/types', () => {
    expect(getPageIcon('note', { noteMode: 'custom-mode' })).toBeUndefined()
    expect(getPageIcon('artifact', { contentType: 'pdf' })).toBeUndefined()
    expect(getPageIcon('note', {})).toBeUndefined()
    expect(getPageIcon('artifact', {})).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getTargetDbId
// ---------------------------------------------------------------------------

describe('getTargetDbId', () => {
  const config = { tasksDbId: 'tasks-db-123', projectsDbId: 'proj-db-456' }

  it('returns tasks DB for task nodes', () => {
    expect(getTargetDbId('task', config)).toBe('tasks-db-123')
  })

  it('returns projects DB for project nodes', () => {
    expect(getTargetDbId('project', config)).toBe('proj-db-456')
  })

  it('returns undefined for note/artifact/unknown types', () => {
    expect(getTargetDbId('note', config)).toBeUndefined()
    expect(getTargetDbId('artifact', config)).toBeUndefined()
    expect(getTargetDbId('conversation', config)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// nodeToNotionProperties (dispatch)
// ---------------------------------------------------------------------------

describe('nodeToNotionProperties', () => {
  it('dispatches to taskToNotion for task nodes', () => {
    const result = nodeToNotionProperties('task', 'n1', { title: 'T' })
    expect(result).not.toBeNull()
    expect(result!.properties['Name']).toBeDefined()
    expect(result!.properties['Cognograph Node ID']).toBeDefined()
  })

  it('dispatches to projectToNotion for project nodes', () => {
    const result = nodeToNotionProperties('project', 'n2', { title: 'P' })
    expect(result).not.toBeNull()
    expect(result!.properties['Name']).toBeDefined()
  })

  it('returns null for unsupported node types', () => {
    expect(nodeToNotionProperties('note', 'n3', { title: 'N' })).toBeNull()
    expect(nodeToNotionProperties('artifact', 'n4', { title: 'A' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// notionToNodeFields (dispatch)
// ---------------------------------------------------------------------------

describe('notionToNodeFields', () => {
  it('dispatches to taskFromNotion for task type', () => {
    const result = notionToNodeFields('task', {
      'Name': { title: [{ plain_text: 'Task' }] },
      'Status': { select: { name: 'Done' } }
    })

    expect(result).not.toBeNull()
    expect(result!.title).toBe('Task')
    expect(result!.status).toBe('done')
  })

  it('dispatches to projectFromNotion for project type', () => {
    const result = notionToNodeFields('project', {
      'Name': { title: [{ plain_text: 'Project' }] }
    })

    expect(result).not.toBeNull()
    expect(result!.title).toBe('Project')
  })

  it('returns null for unsupported types', () => {
    expect(notionToNodeFields('note', {})).toBeNull()
    expect(notionToNodeFields('artifact', {})).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getFieldAuthority
// ---------------------------------------------------------------------------

describe('getFieldAuthority', () => {
  it('returns notion for status/priority/dueDate', () => {
    expect(getFieldAuthority('status')).toBe('notion')
    expect(getFieldAuthority('priority')).toBe('notion')
    expect(getFieldAuthority('dueDate')).toBe('notion')
  })

  it('returns conflict for title', () => {
    expect(getFieldAuthority('title')).toBe('conflict')
  })

  it('returns cognograph for description/content/unknown', () => {
    expect(getFieldAuthority('description')).toBe('cognograph')
    expect(getFieldAuthority('content')).toBe('cognograph')
    expect(getFieldAuthority('unknownField')).toBe('cognograph')
  })
})
