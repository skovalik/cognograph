// =============================================================================
// BUILT-IN PROPERTY DEFINITIONS
// =============================================================================

import type { PropertyDefinition, PropertySchema, NodeData } from '@shared/types'

// -----------------------------------------------------------------------------
// Built-in Property Definitions
// -----------------------------------------------------------------------------

export const BUILTIN_PROPERTIES: Record<string, PropertyDefinition> = {
  // Tags - available for all node types
  tags: {
    id: 'tags',
    name: 'Tags',
    type: 'multi-select',
    options: [], // User adds options as they use it
    icon: 'Tag',
    showInCard: true,
    showInList: true
  },

  // Priority - commonly used
  priority: {
    id: 'priority',
    name: 'Priority',
    type: 'priority',
    options: [
      { value: 'none', label: 'None', color: '#475569' },
      { value: 'low', label: 'Low', color: '#6b7280' },
      { value: 'medium', label: 'Medium', color: '#f59e0b' },
      { value: 'high', label: 'High', color: '#ef4444' }
    ],
    defaultValue: 'none',
    icon: 'Flag',
    showInCard: true,
    showInList: true
  },

  // Status - for tasks and workflows
  status: {
    id: 'status',
    name: 'Status',
    type: 'status',
    options: [
      { value: 'todo', label: 'To Do', color: '#6b7280' },
      { value: 'in-progress', label: 'In Progress', color: '#3b82f6' },
      { value: 'done', label: 'Done', color: '#22c55e' }
    ],
    defaultValue: 'todo',
    icon: 'Circle',
    showInCard: true,
    showInList: true
  },

  // Complexity - for tasks
  complexity: {
    id: 'complexity',
    name: 'Complexity',
    type: 'select',
    options: [
      { value: 'trivial', label: 'Trivial', color: '#22c55e' },
      { value: 'simple', label: 'Simple', color: '#84cc16' },
      { value: 'moderate', label: 'Moderate', color: '#f59e0b' },
      { value: 'complex', label: 'Complex', color: '#f97316' },
      { value: 'very-complex', label: 'Very Complex', color: '#ef4444' }
    ],
    defaultValue: 'moderate',
    icon: 'Gauge',
    showInCard: true,
    showInList: true
  },

  // Due date
  dueDate: {
    id: 'dueDate',
    name: 'Due Date',
    type: 'date',
    icon: 'Calendar',
    showInCard: true,
    showInList: false
  },

  // Assignee (future: actual user system)
  assignee: {
    id: 'assignee',
    name: 'Assignee',
    type: 'text',
    icon: 'User',
    showInCard: false,
    showInList: false
  },

  // URL reference
  url: {
    id: 'url',
    name: 'URL',
    type: 'url',
    icon: 'Link',
    showInCard: false,
    showInList: false
  },

  // Context injection settings (from ContextMetadata)
  contextRole: {
    id: 'contextRole',
    name: 'Context Role',
    type: 'select',
    options: [
      { value: 'reference', label: 'Reference' },
      { value: 'instruction', label: 'Instruction' },
      { value: 'example', label: 'Example' },
      { value: 'background', label: 'Background' },
      { value: 'scope', label: 'Scope' }
    ],
    defaultValue: 'reference',
    icon: 'MessageCircle',
    showInCard: false,
    showInList: false
  },

  contextPriority: {
    id: 'contextPriority',
    name: 'Context Priority',
    type: 'select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ],
    defaultValue: 'medium',
    icon: 'Zap',
    showInCard: false,
    showInList: false
  }
}

// -----------------------------------------------------------------------------
// Node Type → Default Properties Mapping
// -----------------------------------------------------------------------------

export const NODE_DEFAULT_PROPERTIES: Record<NodeData['type'], string[]> = {
  conversation: ['tags', 'contextPriority'],
  project: ['tags', 'status'],
  note: ['tags', 'contextRole', 'contextPriority'],
  task: ['status', 'priority', 'complexity', 'dueDate', 'tags'],
  artifact: ['tags', 'contextRole', 'contextPriority'],
  action: ['tags'],
  text: ['tags'],
  workspace: ['tags'],
  orchestrator: ['tags']
}

// -----------------------------------------------------------------------------
// Default Property Schema
// -----------------------------------------------------------------------------

export const DEFAULT_PROPERTY_SCHEMA: PropertySchema = {
  customProperties: [],
  builtinPropertyOptions: {},
  nodeTypeProperties: {
    conversation: ['tags', 'contextPriority'],
    project: ['tags', 'status'],
    note: ['tags', 'contextRole', 'contextPriority'],
    task: ['status', 'priority', 'complexity', 'dueDate', 'tags']
  }
}

// -----------------------------------------------------------------------------
// Property Type Metadata
// -----------------------------------------------------------------------------

export const PROPERTY_TYPE_ICONS: Record<string, string> = {
  text: 'Type',
  textarea: 'AlignLeft',
  number: 'Hash',
  select: 'ChevronDown',
  'multi-select': 'Tags',
  checkbox: 'CheckSquare',
  date: 'Calendar',
  datetime: 'Clock',
  url: 'Link',
  email: 'Mail',
  status: 'Circle',
  priority: 'Flag',
  relation: 'Link2'
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  textarea: 'Long Text',
  number: 'Number',
  select: 'Select',
  'multi-select': 'Multi-select',
  checkbox: 'Checkbox',
  date: 'Date',
  datetime: 'Date & Time',
  url: 'URL',
  email: 'Email',
  status: 'Status',
  priority: 'Priority',
  relation: 'Relation'
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get a property definition by ID (built-in or custom)
 */
export function getPropertyDefinition(
  propertyId: string,
  customProperties: PropertyDefinition[] = []
): PropertyDefinition | undefined {
  // Check built-in first
  if (propertyId in BUILTIN_PROPERTIES) {
    return BUILTIN_PROPERTIES[propertyId]
  }
  // Then check custom
  return customProperties.find((p) => p.id === propertyId)
}

/**
 * Get all properties for a node type
 */
export function getPropertiesForNodeType(
  nodeType: NodeData['type'],
  schema: PropertySchema
): PropertyDefinition[] {
  const propertyIds = schema.nodeTypeProperties[nodeType] || NODE_DEFAULT_PROPERTIES[nodeType] || []

  return propertyIds
    .map((id) => getPropertyDefinition(id, schema.customProperties))
    .filter((p): p is PropertyDefinition => p !== undefined)
}

/**
 * Merge built-in options with user-added options
 * User customizations take precedence over built-in defaults
 */
export function getMergedPropertyOptions(
  propertyId: string,
  schema: PropertySchema
): PropertyDefinition['options'] {
  const builtinDef = BUILTIN_PROPERTIES[propertyId]
  const builtinOptions = builtinDef?.options || []
  const userOptions = schema.builtinPropertyOptions[propertyId] || []

  // Build a map of user customizations by value for quick lookup
  const userOptionMap = new Map(userOptions.map((o) => [o.value, o]))

  // Start with built-in options, but prefer user customizations if they exist
  const allOptions: PropertyDefinition['options'] = builtinOptions.map((builtinOpt) => {
    const userOpt = userOptionMap.get(builtinOpt.value)
    return userOpt || builtinOpt
  })

  // Add any user options that don't exist in built-ins (newly created options)
  for (const userOpt of userOptions) {
    if (!builtinOptions.some((o) => o.value === userOpt.value)) {
      allOptions.push(userOpt)
    }
  }

  return allOptions
}
