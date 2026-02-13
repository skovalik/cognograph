/**
 * Workflow Templates
 *
 * Built-in templates for common workspace patterns.
 * Templates define node/edge structures with variables for customization.
 */

import type { NodeData } from '@shared/types'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  icon: string // Lucide icon name
  /** Template variables that users can customize */
  variables: TemplateVariable[]
  /** Node definitions with variable references like {{variableName}} */
  nodes: TemplateNode[]
  /** Edge definitions referencing node IDs */
  edges: TemplateEdge[]
  /** Tags for filtering/search */
  tags: string[]
  /** Whether this is a built-in template */
  builtIn: boolean
  /** Preview image URL (optional) */
  previewUrl?: string
}

export interface TemplateVariable {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  required: boolean
  default?: string | number
  options?: string[] // For select type
  placeholder?: string
  description?: string
}

export interface TemplateNode {
  /** Temporary ID for edge references (e.g., 'project-1', 'note-1') */
  tempId: string
  type: NodeData['type']
  /** Position relative to template origin */
  relativePosition: { x: number; y: number }
  /** Data with variable interpolation support */
  data: {
    title?: string
    content?: string
    description?: string
    status?: string
    tags?: string[]
    [key: string]: unknown
  }
}

export interface TemplateEdge {
  sourceTempId: string
  targetTempId: string
  label?: string
}

export type TemplateCategory =
  | 'project-management'
  | 'development'
  | 'research'
  | 'creative'
  | 'business'
  | 'personal'
  | 'custom'

// -----------------------------------------------------------------------------
// Built-in Templates
// -----------------------------------------------------------------------------

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ---------------------------------------------------------------------------
  // Project Management Templates
  // ---------------------------------------------------------------------------
  {
    id: 'client-project',
    name: 'Client Project',
    description: 'Complete client project structure with phases, tasks, and AI conversations',
    category: 'project-management',
    icon: 'Briefcase',
    variables: [
      {
        name: 'clientName',
        label: 'Client Name',
        type: 'text',
        required: true,
        placeholder: 'Acme Corp'
      },
      {
        name: 'projectType',
        label: 'Project Type',
        type: 'select',
        required: true,
        default: 'Web Development',
        options: ['Web Development', 'Mobile App', 'Design', 'Consulting', 'Other']
      },
      {
        name: 'budget',
        label: 'Budget',
        type: 'text',
        required: false,
        placeholder: '$15,000'
      },
      {
        name: 'deadline',
        label: 'Deadline',
        type: 'date',
        required: false
      }
    ],
    nodes: [
      {
        tempId: 'project-main',
        type: 'project',
        relativePosition: { x: 0, y: 0 },
        data: {
          title: '{{clientName}} - {{projectType}}',
          description: 'Client project for {{clientName}}',
          tags: ['client', '{{clientName}}']
        }
      },
      {
        tempId: 'note-brief',
        type: 'note',
        relativePosition: { x: 50, y: 80 },
        data: {
          title: 'Client Brief',
          content: '# {{clientName}} Project Brief\n\n**Type:** {{projectType}}\n**Budget:** {{budget}}\n**Deadline:** {{deadline}}\n\n## Requirements\n\n- \n\n## Deliverables\n\n- '
        }
      },
      {
        tempId: 'note-contract',
        type: 'note',
        relativePosition: { x: 350, y: 80 },
        data: {
          title: 'Contract & SOW',
          content: '# Contract\n\n**Client:** {{clientName}}\n**Budget:** {{budget}}\n**Timeline:** TBD to {{deadline}}\n\n## Scope of Work\n\n- \n\n## Payment Terms\n\n- '
        }
      },
      {
        tempId: 'project-discovery',
        type: 'project',
        relativePosition: { x: 50, y: 250 },
        data: {
          title: 'Discovery Phase',
          description: 'Research and requirements gathering'
        }
      },
      {
        tempId: 'project-design',
        type: 'project',
        relativePosition: { x: 350, y: 250 },
        data: {
          title: 'Design Phase',
          description: 'Design and prototyping'
        }
      },
      {
        tempId: 'project-dev',
        type: 'project',
        relativePosition: { x: 650, y: 250 },
        data: {
          title: 'Development Phase',
          description: 'Implementation and testing'
        }
      },
      {
        tempId: 'conv-client',
        type: 'conversation',
        relativePosition: { x: 50, y: 420 },
        data: {
          title: 'Client Communications',
          systemPrompt: 'You are helping manage communications with {{clientName}} for a {{projectType}} project. Help draft professional emails, meeting notes, and status updates.'
        }
      },
      {
        tempId: 'task-kickoff',
        type: 'task',
        relativePosition: { x: 350, y: 420 },
        data: {
          title: 'Kickoff Meeting',
          status: 'pending',
          description: 'Initial meeting with {{clientName}} to discuss requirements'
        }
      },
      {
        tempId: 'task-discovery',
        type: 'task',
        relativePosition: { x: 550, y: 420 },
        data: {
          title: 'Complete Discovery',
          status: 'pending',
          description: 'Finish requirements gathering and documentation'
        }
      }
    ],
    edges: [
      { sourceTempId: 'note-brief', targetTempId: 'conv-client' },
      { sourceTempId: 'note-contract', targetTempId: 'conv-client' }
    ],
    tags: ['client', 'project', 'management'],
    builtIn: true
  },

  // ---------------------------------------------------------------------------
  // Development Templates
  // ---------------------------------------------------------------------------
  {
    id: 'feature-development',
    name: 'Feature Development',
    description: 'Structure for implementing a new feature with specs, tasks, and AI assistance',
    category: 'development',
    icon: 'Code2',
    variables: [
      {
        name: 'featureName',
        label: 'Feature Name',
        type: 'text',
        required: true,
        placeholder: 'User Authentication'
      },
      {
        name: 'techStack',
        label: 'Tech Stack',
        type: 'text',
        required: false,
        placeholder: 'React, Node.js, PostgreSQL'
      }
    ],
    nodes: [
      {
        tempId: 'project-feature',
        type: 'project',
        relativePosition: { x: 0, y: 0 },
        data: {
          title: '{{featureName}}',
          description: 'Feature implementation for {{featureName}}'
        }
      },
      {
        tempId: 'note-spec',
        type: 'note',
        relativePosition: { x: 50, y: 80 },
        data: {
          title: 'Feature Spec',
          content: '# {{featureName}} Specification\n\n## Overview\n\n\n\n## Requirements\n\n### Functional\n- \n\n### Non-functional\n- \n\n## Technical Approach\n\nTech Stack: {{techStack}}\n\n## Acceptance Criteria\n\n- '
        }
      },
      {
        tempId: 'note-tech',
        type: 'note',
        relativePosition: { x: 350, y: 80 },
        data: {
          title: 'Technical Notes',
          content: '# Technical Implementation Notes\n\n## Architecture\n\n\n\n## Dependencies\n\n\n\n## Edge Cases\n\n- '
        }
      },
      {
        tempId: 'conv-architect',
        type: 'conversation',
        relativePosition: { x: 50, y: 300 },
        data: {
          title: 'Architecture Discussion',
          systemPrompt: 'You are a senior software architect helping design {{featureName}}. The tech stack is {{techStack}}. Focus on scalability, maintainability, and best practices.'
        }
      },
      {
        tempId: 'conv-code',
        type: 'conversation',
        relativePosition: { x: 350, y: 300 },
        data: {
          title: 'Code Review',
          systemPrompt: 'You are a code reviewer for {{featureName}}. Review code for bugs, security issues, performance, and adherence to best practices. Tech stack: {{techStack}}.'
        }
      },
      {
        tempId: 'task-design',
        type: 'task',
        relativePosition: { x: 50, y: 480 },
        data: {
          title: 'Design architecture',
          status: 'pending',
          description: 'Design the technical architecture for {{featureName}}'
        }
      },
      {
        tempId: 'task-implement',
        type: 'task',
        relativePosition: { x: 250, y: 480 },
        data: {
          title: 'Implement core logic',
          status: 'pending',
          description: 'Implement the core functionality'
        }
      },
      {
        tempId: 'task-test',
        type: 'task',
        relativePosition: { x: 450, y: 480 },
        data: {
          title: 'Write tests',
          status: 'pending',
          description: 'Create unit and integration tests'
        }
      }
    ],
    edges: [
      { sourceTempId: 'note-spec', targetTempId: 'conv-architect' },
      { sourceTempId: 'note-tech', targetTempId: 'conv-architect' },
      { sourceTempId: 'note-spec', targetTempId: 'conv-code' }
    ],
    tags: ['development', 'feature', 'coding'],
    builtIn: true
  },

  // ---------------------------------------------------------------------------
  // Research Templates
  // ---------------------------------------------------------------------------
  {
    id: 'research-project',
    name: 'Research Project',
    description: 'Organize research with literature review, notes, and synthesis',
    category: 'research',
    icon: 'BookOpen',
    variables: [
      {
        name: 'topic',
        label: 'Research Topic',
        type: 'text',
        required: true,
        placeholder: 'Impact of AI on creative workflows'
      },
      {
        name: 'deadline',
        label: 'Deadline',
        type: 'date',
        required: false
      }
    ],
    nodes: [
      {
        tempId: 'project-research',
        type: 'project',
        relativePosition: { x: 0, y: 0 },
        data: {
          title: 'Research: {{topic}}',
          description: 'Research project on {{topic}}'
        }
      },
      {
        tempId: 'note-question',
        type: 'note',
        relativePosition: { x: 50, y: 80 },
        data: {
          title: 'Research Questions',
          content: '# Research Questions\n\n## Primary Question\n\n{{topic}}\n\n## Sub-questions\n\n1. \n2. \n3. \n\n## Methodology\n\n\n\n## Scope & Limitations\n\n- '
        }
      },
      {
        tempId: 'project-lit-review',
        type: 'project',
        relativePosition: { x: 350, y: 80 },
        data: {
          title: 'Literature Review',
          description: 'Sources and readings'
        }
      },
      {
        tempId: 'note-findings',
        type: 'note',
        relativePosition: { x: 50, y: 280 },
        data: {
          title: 'Key Findings',
          content: '# Key Findings\n\n## Theme 1\n\n\n\n## Theme 2\n\n\n\n## Patterns & Connections\n\n- '
        }
      },
      {
        tempId: 'conv-analysis',
        type: 'conversation',
        relativePosition: { x: 350, y: 280 },
        data: {
          title: 'Research Analysis',
          systemPrompt: 'You are a research assistant helping analyze findings on {{topic}}. Help synthesize information, identify patterns, and suggest further areas to explore.'
        }
      },
      {
        tempId: 'note-synthesis',
        type: 'note',
        relativePosition: { x: 650, y: 280 },
        data: {
          title: 'Synthesis & Conclusions',
          content: '# Synthesis\n\n## Summary\n\n\n\n## Conclusions\n\n\n\n## Future Research\n\n- '
        }
      }
    ],
    edges: [
      { sourceTempId: 'note-question', targetTempId: 'conv-analysis' },
      { sourceTempId: 'note-findings', targetTempId: 'conv-analysis' },
      { sourceTempId: 'conv-analysis', targetTempId: 'note-synthesis', label: 'synthesize' }
    ],
    tags: ['research', 'academic', 'analysis'],
    builtIn: true
  },

  // ---------------------------------------------------------------------------
  // Creative Templates
  // ---------------------------------------------------------------------------
  {
    id: 'content-campaign',
    name: 'Content Campaign',
    description: 'Plan and organize a content marketing campaign',
    category: 'creative',
    icon: 'Megaphone',
    variables: [
      {
        name: 'campaignName',
        label: 'Campaign Name',
        type: 'text',
        required: true,
        placeholder: 'Summer Product Launch'
      },
      {
        name: 'targetAudience',
        label: 'Target Audience',
        type: 'text',
        required: false,
        placeholder: 'Tech professionals aged 25-40'
      },
      {
        name: 'startDate',
        label: 'Start Date',
        type: 'date',
        required: false
      }
    ],
    nodes: [
      {
        tempId: 'project-campaign',
        type: 'project',
        relativePosition: { x: 0, y: 0 },
        data: {
          title: '{{campaignName}}',
          description: 'Content campaign: {{campaignName}}'
        }
      },
      {
        tempId: 'note-strategy',
        type: 'note',
        relativePosition: { x: 50, y: 80 },
        data: {
          title: 'Campaign Strategy',
          content: '# {{campaignName}} Strategy\n\n## Objective\n\n\n\n## Target Audience\n\n{{targetAudience}}\n\n## Key Messages\n\n1. \n2. \n3. \n\n## Channels\n\n- \n\n## Timeline\n\nStart: {{startDate}}'
        }
      },
      {
        tempId: 'project-content',
        type: 'project',
        relativePosition: { x: 350, y: 80 },
        data: {
          title: 'Content Assets',
          description: 'All content pieces for the campaign'
        }
      },
      {
        tempId: 'conv-writer',
        type: 'conversation',
        relativePosition: { x: 50, y: 300 },
        data: {
          title: 'Content Writer',
          systemPrompt: 'You are a content writer for {{campaignName}}. Target audience: {{targetAudience}}. Write engaging, on-brand content that resonates with the audience.'
        }
      },
      {
        tempId: 'note-calendar',
        type: 'note',
        relativePosition: { x: 350, y: 300 },
        data: {
          title: 'Content Calendar',
          content: '# Content Calendar\n\n## Week 1 ({{startDate}})\n\n| Day | Platform | Content | Status |\n|-----|----------|---------|--------|\n| Mon | | | Planned |\n| Wed | | | Planned |\n| Fri | | | Planned |\n\n## Week 2\n\n- '
        }
      },
      {
        tempId: 'task-brief',
        type: 'task',
        relativePosition: { x: 50, y: 480 },
        data: {
          title: 'Finalize creative brief',
          status: 'pending',
          description: 'Complete the campaign strategy and creative direction'
        }
      },
      {
        tempId: 'task-content',
        type: 'task',
        relativePosition: { x: 250, y: 480 },
        data: {
          title: 'Create content assets',
          status: 'pending',
          description: 'Produce all content pieces'
        }
      }
    ],
    edges: [
      { sourceTempId: 'note-strategy', targetTempId: 'conv-writer' }
    ],
    tags: ['marketing', 'content', 'campaign'],
    builtIn: true
  },

  // ---------------------------------------------------------------------------
  // Personal Templates
  // ---------------------------------------------------------------------------
  {
    id: 'goal-tracking',
    name: 'Goal Tracker',
    description: 'Track personal or professional goals with milestones and reflection',
    category: 'personal',
    icon: 'Target',
    variables: [
      {
        name: 'goalName',
        label: 'Goal',
        type: 'text',
        required: true,
        placeholder: 'Learn a new programming language'
      },
      {
        name: 'targetDate',
        label: 'Target Date',
        type: 'date',
        required: false
      }
    ],
    nodes: [
      {
        tempId: 'project-goal',
        type: 'project',
        relativePosition: { x: 0, y: 0 },
        data: {
          title: 'Goal: {{goalName}}',
          description: 'Tracking progress towards {{goalName}}'
        }
      },
      {
        tempId: 'note-plan',
        type: 'note',
        relativePosition: { x: 50, y: 80 },
        data: {
          title: 'Goal Plan',
          content: '# {{goalName}}\n\n## Why This Goal?\n\n\n\n## Success Criteria\n\n- \n\n## Target Date\n\n{{targetDate}}\n\n## Potential Obstacles\n\n- \n\n## Resources Needed\n\n- '
        }
      },
      {
        tempId: 'project-milestones',
        type: 'project',
        relativePosition: { x: 350, y: 80 },
        data: {
          title: 'Milestones',
          description: 'Key checkpoints'
        }
      },
      {
        tempId: 'task-m1',
        type: 'task',
        relativePosition: { x: 370, y: 160 },
        data: {
          title: 'Milestone 1',
          status: 'pending',
          description: 'First major checkpoint'
        }
      },
      {
        tempId: 'task-m2',
        type: 'task',
        relativePosition: { x: 520, y: 160 },
        data: {
          title: 'Milestone 2',
          status: 'pending',
          description: 'Second major checkpoint'
        }
      },
      {
        tempId: 'conv-coach',
        type: 'conversation',
        relativePosition: { x: 50, y: 300 },
        data: {
          title: 'Goal Coach',
          systemPrompt: 'You are a supportive coach helping track progress on {{goalName}}. Help break down the goal into actionable steps, provide encouragement, and suggest strategies for overcoming obstacles.'
        }
      },
      {
        tempId: 'note-progress',
        type: 'note',
        relativePosition: { x: 350, y: 300 },
        data: {
          title: 'Progress Log',
          content: '# Progress Log\n\n## Week 1\n\n**Date:** \n**Progress:** \n**Reflections:** \n\n---\n\n## Week 2\n\n- '
        }
      }
    ],
    edges: [
      { sourceTempId: 'note-plan', targetTempId: 'conv-coach' },
      { sourceTempId: 'note-progress', targetTempId: 'conv-coach' }
    ],
    tags: ['personal', 'goals', 'productivity'],
    builtIn: true
  },

  // ---------------------------------------------------------------------------
  // Quick Start Templates
  // ---------------------------------------------------------------------------
  {
    id: 'blank-project',
    name: 'Blank Project',
    description: 'Start with an empty project container',
    category: 'project-management',
    icon: 'FolderPlus',
    variables: [
      {
        name: 'projectName',
        label: 'Project Name',
        type: 'text',
        required: true,
        placeholder: 'My Project'
      }
    ],
    nodes: [
      {
        tempId: 'project-main',
        type: 'project',
        relativePosition: { x: 0, y: 0 },
        data: {
          title: '{{projectName}}',
          description: ''
        }
      }
    ],
    edges: [],
    tags: ['simple', 'blank', 'quick'],
    builtIn: true
  },

  {
    id: 'ai-conversation-hub',
    name: 'AI Conversation Hub',
    description: 'Multiple AI conversations with shared context',
    category: 'development',
    icon: 'MessageSquare',
    variables: [
      {
        name: 'topic',
        label: 'Topic',
        type: 'text',
        required: true,
        placeholder: 'API Design'
      }
    ],
    nodes: [
      {
        tempId: 'note-context',
        type: 'note',
        relativePosition: { x: 200, y: 0 },
        data: {
          title: 'Shared Context',
          content: '# Context for {{topic}}\n\n## Overview\n\n\n\n## Key Requirements\n\n- \n\n## Constraints\n\n- '
        }
      },
      {
        tempId: 'conv-expert',
        type: 'conversation',
        relativePosition: { x: 0, y: 150 },
        data: {
          title: 'Expert Advisor',
          systemPrompt: 'You are a senior expert on {{topic}}. Provide deep technical insights, best practices, and industry knowledge.'
        }
      },
      {
        tempId: 'conv-critic',
        type: 'conversation',
        relativePosition: { x: 250, y: 150 },
        data: {
          title: 'Critical Reviewer',
          systemPrompt: 'You are a critical reviewer for {{topic}}. Challenge assumptions, identify weaknesses, and suggest improvements.'
        }
      },
      {
        tempId: 'conv-brainstorm',
        type: 'conversation',
        relativePosition: { x: 500, y: 150 },
        data: {
          title: 'Brainstorm Partner',
          systemPrompt: 'You are a creative brainstorming partner for {{topic}}. Generate ideas, explore alternatives, and think outside the box.'
        }
      },
      {
        tempId: 'note-synthesis',
        type: 'note',
        relativePosition: { x: 200, y: 350 },
        data: {
          title: 'Synthesis',
          content: '# Synthesis\n\n## Key Insights\n\n- \n\n## Decisions Made\n\n- \n\n## Next Steps\n\n- '
        }
      }
    ],
    edges: [
      { sourceTempId: 'note-context', targetTempId: 'conv-expert' },
      { sourceTempId: 'note-context', targetTempId: 'conv-critic' },
      { sourceTempId: 'note-context', targetTempId: 'conv-brainstorm' }
    ],
    tags: ['ai', 'conversation', 'collaboration'],
    builtIn: true
  }
]

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter(t => t.category === category)
}

/**
 * Search templates by name, description, or tags
 */
export function searchTemplates(query: string): WorkflowTemplate[] {
  const lowerQuery = query.toLowerCase()
  return WORKFLOW_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Interpolate variables in a string
 */
export function interpolateVariables(
  text: string,
  variables: Record<string, string | number | undefined>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = variables[varName]
    return value !== undefined ? String(value) : match
  })
}

/**
 * Apply template with variable values to create actual node/edge data
 */
export function applyTemplate(
  template: WorkflowTemplate,
  variables: Record<string, string | number | undefined>,
  originPosition: { x: number; y: number }
): {
  nodes: Array<{
    tempId: string
    type: NodeData['type']
    position: { x: number; y: number }
    data: Record<string, unknown>
  }>
  edges: Array<{
    sourceTempId: string
    targetTempId: string
    label?: string
  }>
} {
  // Interpolate variables in node data
  const nodes = template.nodes.map(node => {
    const interpolatedData: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(node.data)) {
      if (typeof value === 'string') {
        interpolatedData[key] = interpolateVariables(value, variables)
      } else if (Array.isArray(value)) {
        interpolatedData[key] = value.map(v =>
          typeof v === 'string' ? interpolateVariables(v, variables) : v
        )
      } else {
        interpolatedData[key] = value
      }
    }

    return {
      tempId: node.tempId,
      type: node.type,
      position: {
        x: originPosition.x + node.relativePosition.x,
        y: originPosition.y + node.relativePosition.y
      },
      data: interpolatedData
    }
  })

  // Copy edges (labels may also have variables)
  const edges = template.edges.map(edge => ({
    sourceTempId: edge.sourceTempId,
    targetTempId: edge.targetTempId,
    label: edge.label ? interpolateVariables(edge.label, variables) : undefined
  }))

  return { nodes, edges }
}

/**
 * Get all unique categories
 */
export function getCategories(): TemplateCategory[] {
  const categories = new Set(WORKFLOW_TEMPLATES.map(t => t.category))
  return Array.from(categories)
}

/**
 * Category display names
 */
export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  'project-management': 'Project Management',
  'development': 'Development',
  'research': 'Research',
  'creative': 'Creative',
  'business': 'Business',
  'personal': 'Personal',
  'custom': 'Custom'
}

export default WORKFLOW_TEMPLATES
