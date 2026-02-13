// =============================================================================
// templates.ts -- Template system types
//
// Contains: NodeTemplate, PlaceholderType, SYSTEM_TEMPLATES,
// PLACEHOLDER_PATTERNS, TemplateLibrary
// =============================================================================

import type { NodeData } from './nodes'
import type { EdgeData } from './edges'

// =============================================================================
// TEMPLATE SYSTEM TYPES
// =============================================================================

export type PlaceholderType =
  | 'string' // Simple text replacement
  | 'node-instruction' // AI will generate content based on instruction
  | 'node-reference' // Reference to existing node
  | 'date' // Date value (today, tomorrow, etc.)
  | 'selection' // From current selection

export interface PlaceholderDefinition {
  key: string
  type: PlaceholderType
  label: string
  description?: string
  defaultValue?: string
  required: boolean
  instruction?: string // For 'node-instruction' type - what AI should generate
  targetField?: string // For 'node-instruction' type - which field to populate
  selectionIndex?: number // For 'selection' type - which selected node
  dependsOn?: string[] // Keys of placeholders this one depends on
}

export interface TemplateNode {
  templateNodeId: string
  type: NodeData['type']
  relativePosition: { x: number; y: number } // Relative to root (0,0)
  dimensions: { width: number; height: number }
  data: Partial<NodeData> // May contain {{placeholders}}
}

export interface TemplateEdge {
  templateEdgeId: string
  source: string // templateNodeId
  target: string // templateNodeId
  sourceHandle?: string
  targetHandle?: string
  data?: Partial<EdgeData>
}

export interface TemplateFolder {
  id: string
  name: string
  parentId?: string
  color?: string
  icon?: string
  sortOrder: number
  createdAt: number
}

export interface NodeTemplate {
  id: string
  name: string
  description?: string
  schemaVersion: 1
  folderId?: string
  tags?: string[]
  icon?: string
  color?: string
  thumbnail?: string | null // Base64 PNG or null if generation failed
  nodes: TemplateNode[]
  edges: TemplateEdge[]
  bounds: { width: number; height: number }
  rootNodeId: string // templateNodeId of anchor node for positioning
  placeholders: PlaceholderDefinition[]
  includesContent: boolean
  createdAt: number
  updatedAt: number
  usageCount: number
  source: 'user' | 'system' | 'community'
}

export interface TemplateLibrary {
  schemaVersion: 1
  templates: NodeTemplate[]
  folders: TemplateFolder[]
  lastUsedTemplateIds: string[]
  favoriteTemplateIds: string[]
}

export const DEFAULT_TEMPLATE_LIBRARY: TemplateLibrary = {
  schemaVersion: 1,
  templates: [],
  folders: [],
  lastUsedTemplateIds: [],
  favoriteTemplateIds: []
}

// Placeholder detection patterns (process in specificity order)
export const PLACEHOLDER_PATTERNS = {
  date: /\{\{date:(created|today|tomorrow|next_week)\}\}/gi,
  instruction: /\{\{describe:([a-z_][a-z0-9_]*)\}\}/gi,
  link: /\{\{link:([a-z_][a-z0-9_]*)\}\}/gi,
  selection: /\{\{selection:(\d+)\}\}/gi,
  simple: /\{\{([a-z_][a-z0-9_]*)\}\}/gi // Must be processed last
}

// -----------------------------------------------------------------------------
// System Templates (built-in templates that ship with the app)
// -----------------------------------------------------------------------------

export const SYSTEM_TEMPLATES: NodeTemplate[] = [
  {
    id: 'system-basic-project',
    name: 'Basic Project',
    description:
      'A complete project structure with research, planning, and execution phases. Includes placeholders for customization.',
    schemaVersion: 1,
    source: 'system',
    includesContent: true,
    nodes: [
      {
        templateNodeId: 'bp-project',
        type: 'project',
        relativePosition: { x: 0, y: 0 },
        dimensions: { width: 400, height: 200 },
        data: {
          type: 'project',
          title: '{{project_name}}',
          description: '{{project_description}}',
          color: '#8b5cf6',
          collapsed: false,
          childNodeIds: [],
          createdAt: 0,
          updatedAt: 0
        }
      },
      {
        templateNodeId: 'bp-research',
        type: 'conversation',
        relativePosition: { x: 0, y: 250 },
        dimensions: { width: 300, height: 150 },
        data: {
          type: 'conversation',
          title: '{{project_name}} Research',
          messages: [],
          provider: 'anthropic',
          createdAt: 0,
          updatedAt: 0
        }
      },
      {
        templateNodeId: 'bp-notes',
        type: 'note',
        relativePosition: { x: 350, y: 250 },
        dimensions: { width: 280, height: 180 },
        data: {
          type: 'note',
          title: 'Key Findings',
          content: '# {{project_name}} Notes\n\n## Key Findings\n- \n\n## Open Questions\n- ',
          createdAt: 0,
          updatedAt: 0
        }
      },
      {
        templateNodeId: 'bp-task-plan',
        type: 'task',
        relativePosition: { x: 0, y: 450 },
        dimensions: { width: 260, height: 140 },
        data: {
          type: 'task',
          title: 'Create project plan',
          description: 'Define milestones and deliverables for {{project_name}}',
          status: 'todo',
          priority: 'high',
          createdAt: 0,
          updatedAt: 0
        }
      },
      {
        templateNodeId: 'bp-task-review',
        type: 'task',
        relativePosition: { x: 300, y: 450 },
        dimensions: { width: 260, height: 140 },
        data: {
          type: 'task',
          title: 'Review and iterate',
          description: 'Review findings and refine approach',
          status: 'todo',
          priority: 'medium',
          createdAt: 0,
          updatedAt: 0
        }
      }
    ],
    edges: [
      { templateEdgeId: 'bp-e1', source: 'bp-project', target: 'bp-research' },
      { templateEdgeId: 'bp-e2', source: 'bp-project', target: 'bp-notes' },
      { templateEdgeId: 'bp-e3', source: 'bp-research', target: 'bp-task-plan' },
      { templateEdgeId: 'bp-e4', source: 'bp-notes', target: 'bp-task-review' }
    ],
    bounds: { width: 660, height: 590 },
    rootNodeId: 'bp-project',
    placeholders: [
      { key: 'project_name', type: 'string', label: 'Project Name', required: true },
      {
        key: 'project_description',
        type: 'string',
        label: 'Project Description',
        required: false,
        defaultValue: ''
      }
    ],
    createdAt: 0,
    updatedAt: 0,
    usageCount: 0
  },
  {
    id: 'system-research-flow',
    name: 'Research Flow',
    description:
      'Structured research workflow with AI conversation, source notes, and synthesis. Perfect for deep-dive investigations.',
    schemaVersion: 1,
    source: 'system',
    includesContent: true,
    nodes: [
      {
        templateNodeId: 'rf-main-conv',
        type: 'conversation',
        relativePosition: { x: 150, y: 0 },
        dimensions: { width: 300, height: 150 },
        data: {
          type: 'conversation',
          title: '{{topic}} Research',
          messages: [],
          provider: 'anthropic',
          contextRole: 'instruction',
          createdAt: 0,
          updatedAt: 0
        }
      },
      {
        templateNodeId: 'rf-background',
        type: 'note',
        relativePosition: { x: 0, y: 200 },
        dimensions: { width: 280, height: 180 },
        data: {
          type: 'note',
          title: 'Background Context',
          content: '# Background\n\n## Overview\nProvide background context for the research topic here.\n\n## Key Terms\n- ',
          contextRole: 'background',
          createdAt: 0,
          updatedAt: 0
        }
      },
      {
        templateNodeId: 'rf-sources',
        type: 'note',
        relativePosition: { x: 320, y: 200 },
        dimensions: { width: 280, height: 180 },
        data: {
          type: 'note',
          title: 'Sources & References',
          content: '# Sources\n\n## Primary Sources\n- \n\n## Secondary Sources\n- ',
          contextRole: 'reference',
          createdAt: 0,
          updatedAt: 0
        }
      },
      {
        templateNodeId: 'rf-synthesis',
        type: 'note',
        relativePosition: { x: 150, y: 420 },
        dimensions: { width: 300, height: 200 },
        data: {
          type: 'note',
          title: 'Synthesis & Conclusions',
          content: '# Synthesis\n\n## Main Findings\n\n## Implications\n\n## Next Steps',
          contextPriority: 'high',
          createdAt: 0,
          updatedAt: 0
        }
      },
      {
        templateNodeId: 'rf-followup',
        type: 'conversation',
        relativePosition: { x: 500, y: 420 },
        dimensions: { width: 280, height: 150 },
        data: {
          type: 'conversation',
          title: 'Follow-up Questions',
          messages: [],
          provider: 'anthropic',
          createdAt: 0,
          updatedAt: 0
        }
      }
    ],
    edges: [
      { templateEdgeId: 'rf-e1', source: 'rf-background', target: 'rf-main-conv' },
      { templateEdgeId: 'rf-e2', source: 'rf-sources', target: 'rf-main-conv' },
      { templateEdgeId: 'rf-e3', source: 'rf-main-conv', target: 'rf-synthesis' },
      { templateEdgeId: 'rf-e4', source: 'rf-synthesis', target: 'rf-followup' }
    ],
    bounds: { width: 780, height: 620 },
    rootNodeId: 'rf-main-conv',
    placeholders: [{ key: 'topic', type: 'string', label: 'Research Topic', required: true }],
    createdAt: 0,
    updatedAt: 0,
    usageCount: 0
  }
]
