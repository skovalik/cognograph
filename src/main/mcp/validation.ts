// Schema validation for MCP write operations
// Filters and validates fields per node type

export type ValidNodeType = 'task' | 'note' | 'conversation' | 'text' | 'project' | 'artifact'

const VALID_NODE_TYPES: ValidNodeType[] = ['task', 'note', 'conversation', 'text', 'project', 'artifact']

const VALID_STATUSES = ['todo', 'in-progress', 'done'] as const
const VALID_PRIORITIES = ['none', 'low', 'medium', 'high'] as const
const VALID_COMPLEXITIES = ['trivial', 'simple', 'moderate', 'complex', 'very-complex'] as const
const VALID_NOTE_MODES = ['general', 'persona', 'reference', 'examples', 'background', 'design-tokens', 'page', 'component', 'content-model', 'wp-config'] as const
const VALID_PAGE_STATUSES = ['planned', 'wireframed', 'designed', 'built', 'live'] as const
const VALID_COMPONENT_STATUSES = ['planned', 'designed', 'built', 'tested'] as const

// Allowed mutable fields per node type
const ALLOWED_FIELDS: Record<ValidNodeType, string[]> = {
  task: ['title', 'description', 'status', 'priority', 'complexity', 'tags', 'color'],
  note: ['title', 'content', 'tags', 'color', 'noteMode', 'page', 'component', 'contentModel', 'wpConfig'],
  conversation: ['title', 'tags', 'color'],
  text: ['content', 'color'],
  project: ['title', 'description', 'color'],
  artifact: ['title', 'content', 'tags', 'color']
}

export function isValidNodeType(type: string): type is ValidNodeType {
  return VALID_NODE_TYPES.includes(type as ValidNodeType)
}

/**
 * Validate and filter changes to only allowed fields for the given node type.
 * Returns the filtered changes object (only valid fields).
 * Throws if enum values are invalid.
 */
export function validateNodeChanges(
  nodeType: string,
  changes: Record<string, unknown>
): Record<string, unknown> {
  if (!isValidNodeType(nodeType)) {
    throw new Error(`Cannot update node of type '${nodeType}'`)
  }

  const allowed = ALLOWED_FIELDS[nodeType]
  const filtered: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(changes)) {
    if (!allowed.includes(key)) continue

    // Validate enum fields
    if (key === 'status' && nodeType === 'task') {
      if (!VALID_STATUSES.includes(value as typeof VALID_STATUSES[number])) {
        throw new Error(`Invalid status '${value}'. Must be one of: ${VALID_STATUSES.join(', ')}`)
      }
    }
    if (key === 'priority' && nodeType === 'task') {
      if (!VALID_PRIORITIES.includes(value as typeof VALID_PRIORITIES[number])) {
        throw new Error(`Invalid priority '${value}'. Must be one of: ${VALID_PRIORITIES.join(', ')}`)
      }
    }
    if (key === 'complexity' && nodeType === 'task') {
      if (!VALID_COMPLEXITIES.includes(value as typeof VALID_COMPLEXITIES[number])) {
        throw new Error(
          `Invalid complexity '${value}'. Must be one of: ${VALID_COMPLEXITIES.join(', ')}`
        )
      }
    }
    if (key === 'noteMode' && nodeType === 'note') {
      if (!VALID_NOTE_MODES.includes(value as typeof VALID_NOTE_MODES[number])) {
        throw new Error(`Invalid noteMode '${value}'. Must be one of: ${VALID_NOTE_MODES.join(', ')}`)
      }
    }
    if (key === 'page' && nodeType === 'note') {
      if (typeof value !== 'object' || value === null) {
        throw new Error(`'page' must be an object`)
      }
      const page = value as Record<string, unknown>
      if (page.status !== undefined && !VALID_PAGE_STATUSES.includes(page.status as typeof VALID_PAGE_STATUSES[number])) {
        throw new Error(`Invalid page status '${page.status}'. Must be one of: ${VALID_PAGE_STATUSES.join(', ')}`)
      }
    }
    if (key === 'component' && nodeType === 'note') {
      if (typeof value !== 'object' || value === null) {
        throw new Error(`'component' must be an object`)
      }
      const comp = value as Record<string, unknown>
      if (comp.status !== undefined && !VALID_COMPONENT_STATUSES.includes(comp.status as typeof VALID_COMPONENT_STATUSES[number])) {
        throw new Error(`Invalid component status '${comp.status}'. Must be one of: ${VALID_COMPONENT_STATUSES.join(', ')}`)
      }
    }
    if (key === 'contentModel' && nodeType === 'note') {
      if (typeof value !== 'object' || value === null) {
        throw new Error(`'contentModel' must be an object`)
      }
    }
    if (key === 'wpConfig' && nodeType === 'note') {
      if (typeof value !== 'object' || value === null) {
        throw new Error(`'wpConfig' must be an object`)
      }
    }
    if (key === 'tags') {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        throw new Error(`'tags' must be an array of strings`)
      }
    }
    if (key === 'title' || key === 'description' || key === 'content' || key === 'color') {
      if (typeof value !== 'string') {
        throw new Error(`'${key}' must be a string`)
      }
    }

    filtered[key] = value
  }

  return filtered
}

/**
 * Validate create node data and apply defaults.
 * Returns the complete data object ready for node creation.
 */
export function validateCreateNodeData(
  type: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (!isValidNodeType(type)) {
    throw new Error(`Invalid node type '${type}'. Must be one of: ${VALID_NODE_TYPES.join(', ')}`)
  }

  const now = Date.now()
  const base: Record<string, unknown> = {
    type,
    createdAt: now,
    updatedAt: now
  }

  switch (type) {
    case 'task':
      return {
        ...base,
        title: validateString(data.title, 'title') || 'Untitled Task',
        description: typeof data.description === 'string' ? data.description : '',
        status: validateEnum(data.status, VALID_STATUSES, 'todo'),
        priority: validateEnum(data.priority, VALID_PRIORITIES, 'none'),
        complexity: data.complexity
          ? validateEnum(data.complexity, VALID_COMPLEXITIES, undefined)
          : undefined,
        tags: validateTags(data.tags),
        color: typeof data.color === 'string' ? data.color : undefined
      }

    case 'note':
      return {
        ...base,
        title: validateString(data.title, 'title') || 'Untitled Note',
        content: typeof data.content === 'string' ? data.content : '',
        noteMode: data.noteMode ? validateEnum(data.noteMode, VALID_NOTE_MODES, undefined) : undefined,
        tags: validateTags(data.tags),
        color: typeof data.color === 'string' ? data.color : undefined,
        // Structured data pass-through for web project note modes
        contentModel: typeof data.contentModel === 'object' && data.contentModel !== null ? data.contentModel : undefined,
        wpConfig: typeof data.wpConfig === 'object' && data.wpConfig !== null ? data.wpConfig : undefined,
        page: typeof data.page === 'object' && data.page !== null ? data.page : undefined,
        component: typeof data.component === 'object' && data.component !== null ? data.component : undefined,
      }

    case 'conversation':
      return {
        ...base,
        title: validateString(data.title, 'title') || 'New Conversation',
        messages: [],
        provider: 'anthropic',
        tags: validateTags(data.tags),
        color: typeof data.color === 'string' ? data.color : undefined
      }

    case 'text':
      return {
        ...base,
        content: typeof data.content === 'string' ? data.content : '',
        color: typeof data.color === 'string' ? data.color : undefined
      }

    case 'project':
      return {
        ...base,
        title: validateString(data.title, 'title') || 'Untitled Project',
        description: typeof data.description === 'string' ? data.description : '',
        collapsed: false,
        childNodeIds: [],
        color: typeof data.color === 'string' ? data.color : '#8b5cf6'
      }

    case 'artifact':
      return {
        ...base,
        title: validateString(data.title, 'title') || 'Untitled Artifact',
        content: typeof data.content === 'string' ? data.content : '',
        contentType: 'text',
        source: { type: 'created', method: 'manual' },
        version: 1,
        versionHistory: [],
        versioningMode: 'update',
        injectionFormat: 'full',
        collapsed: false,
        previewLines: 10,
        tags: validateTags(data.tags),
        color: typeof data.color === 'string' ? data.color : undefined
      }

    default:
      return base
  }
}

function validateString(value: unknown, _field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') return undefined
  return value
}

function validateEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  defaultValue: T | undefined
): T | undefined {
  if (value === undefined || value === null) return defaultValue
  if (typeof value !== 'string') return defaultValue
  if (allowed.includes(value as T)) return value as T
  return defaultValue
}

function validateTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v) => typeof v === 'string')
}
