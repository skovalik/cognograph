/**
 * Action Templates Library
 *
 * Built-in automation templates for common workflows.
 */

import type { ActionTemplate } from '@shared/types'

export const BUILT_IN_TEMPLATES: ActionTemplate[] = [
  {
    id: 'template-task-completed-summary',
    name: 'Task Completion Summary',
    description: 'When a task is marked complete, create a summary note in the parent project',
    category: 'automation',
    icon: 'CheckSquare',
    triggers: [
      {
        type: 'node-completed',
        nodeType: 'task',
        condition: 'node.parentProjectId != null'
      }
    ],
    steps: [
      {
        type: 'ai-summarize',
        params: {
          sourceNodeId: '{{triggeredNode.id}}',
          prompt: 'Summarize what was accomplished in this task'
        }
      },
      {
        type: 'create-node',
        params: {
          type: 'note',
          title: 'Completed: {{triggeredNode.title}}',
          content: '{{previousStep.result}}',
          parentId: '{{triggeredNode.parentProjectId}}'
        }
      }
    ],
    variables: [
      {
        name: 'includeTimestamp',
        type: 'boolean',
        label: 'Include Timestamp',
        description: 'Add completion timestamp to the summary',
        defaultValue: true
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isBuiltIn: true
  },
  {
    id: 'template-note-extract-tasks',
    name: 'Extract Tasks from Note',
    description: 'When a note is created, automatically extract action items as task nodes',
    category: 'automation',
    icon: 'FileText',
    triggers: [
      {
        type: 'node-created',
        nodeType: 'note'
      }
    ],
    steps: [
      {
        type: 'ai-generate',
        params: {
          prompt: 'Extract action items from this note and create task nodes for each',
          mode: 'generate',
          sourceNodeId: '{{triggeredNode.id}}'
        },
        condition: 'triggeredNode.content.length > 50'
      }
    ],
    variables: [
      {
        name: 'minContentLength',
        type: 'number',
        label: 'Minimum Content Length',
        description: 'Only extract from notes with at least this many characters',
        defaultValue: 50
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isBuiltIn: true
  },
  {
    id: 'template-conversation-summary',
    name: 'Conversation Summary',
    description: 'When a conversation ends, create a summary note with key insights',
    category: 'workflow',
    icon: 'MessageSquare',
    triggers: [
      {
        type: 'node-updated',
        nodeType: 'conversation',
        condition: 'node.messages.length > 5'
      }
    ],
    steps: [
      {
        type: 'ai-summarize',
        params: {
          sourceNodeId: '{{triggeredNode.id}}',
          prompt: 'Summarize this conversation, highlighting key decisions, action items, and insights'
        }
      },
      {
        type: 'create-node',
        params: {
          type: 'note',
          title: 'Summary: {{triggeredNode.title}}',
          content: '{{previousStep.result}}',
          position: {
            x: '{{triggeredNode.position.x + 300}}',
            y: '{{triggeredNode.position.y}}'
          }
        }
      },
      {
        type: 'create-edge',
        params: {
          source: '{{triggeredNode.id}}',
          target: '{{previousStep.nodeId}}',
          label: 'summarized'
        }
      }
    ],
    variables: [
      {
        name: 'minMessages',
        type: 'number',
        label: 'Minimum Messages',
        description: 'Only summarize conversations with at least this many messages',
        defaultValue: 5
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isBuiltIn: true
  },
  {
    id: 'template-daily-digest',
    name: 'Daily Workspace Digest',
    description: 'Every day, create a summary of all changes and activity in the workspace',
    category: 'workflow',
    icon: 'Calendar',
    triggers: [
      {
        type: 'schedule',
        schedule: {
          frequency: 'daily',
          time: '09:00'
        }
      }
    ],
    steps: [
      {
        type: 'ai-generate',
        params: {
          mode: 'ask',
          scope: 'workspace',
          prompt: 'Create a daily digest summarizing: 1) New nodes created yesterday, 2) Tasks completed, 3) Active conversations, 4) Suggested priorities for today'
        }
      },
      {
        type: 'create-node',
        params: {
          type: 'note',
          title: 'Daily Digest - {{date}}',
          content: '{{previousStep.result}}',
          tags: ['digest', 'daily']
        }
      }
    ],
    variables: [
      {
        name: 'digestTime',
        type: 'string',
        label: 'Digest Time',
        description: 'Time to generate the daily digest (HH:MM format)',
        defaultValue: '09:00'
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isBuiltIn: true
  },
  {
    id: 'template-project-progress',
    name: 'Project Progress Report',
    description: 'Analyze a project and generate a progress report with completion status',
    category: 'workflow',
    icon: 'Folder',
    triggers: [
      {
        type: 'manual'
      }
    ],
    steps: [
      {
        type: 'ai-generate',
        params: {
          mode: 'ask',
          scope: 'selection',
          prompt: 'Analyze this project and create a progress report including: 1) Overall completion percentage, 2) Completed vs pending tasks, 3) Key milestones achieved, 4) Potential blockers, 5) Recommended next steps'
        }
      },
      {
        type: 'create-node',
        params: {
          type: 'note',
          title: 'Progress Report: {{selectedNode.title}}',
          content: '{{previousStep.result}}',
          parentId: '{{selectedNode.id}}'
        }
      }
    ],
    variables: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isBuiltIn: true
  },
  {
    id: 'template-brainstorm-expand',
    name: 'Brainstorm Expansion',
    description: 'Take a note with ideas and expand each into detailed sub-notes',
    category: 'automation',
    icon: 'Sparkles',
    triggers: [
      {
        type: 'manual'
      }
    ],
    steps: [
      {
        type: 'ai-generate',
        params: {
          mode: 'generate',
          scope: 'selection',
          prompt: 'Expand on each idea in this note. Create a separate detailed note for each idea, exploring it further with examples, implications, and potential next steps.'
        }
      }
    ],
    variables: [
      {
        name: 'detailLevel',
        type: 'string',
        label: 'Detail Level',
        description: 'How detailed should each expansion be',
        defaultValue: 'medium',
        options: [
          { label: 'Brief', value: 'brief' },
          { label: 'Medium', value: 'medium' },
          { label: 'Detailed', value: 'detailed' }
        ]
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
    isBuiltIn: true
  }
]

/**
 * Get all templates, including user-created ones
 */
export function getAllTemplates(userTemplates: ActionTemplate[] = []): ActionTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...userTemplates]
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: ActionTemplate['category'],
  userTemplates: ActionTemplate[] = []
): ActionTemplate[] {
  return getAllTemplates(userTemplates).filter(t => t.category === category)
}

/**
 * Search templates by name or description
 */
export function searchTemplates(
  query: string,
  userTemplates: ActionTemplate[] = []
): ActionTemplate[] {
  const lowerQuery = query.toLowerCase()
  return getAllTemplates(userTemplates).filter(
    t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery)
  )
}
