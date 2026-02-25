// PropertyMapper — Stateless utility for Cognograph ↔ Notion property conversion
// Spec: COGNOGRAPH-NOTION-NODE-SYNC-SPEC.md Section 4

// -----------------------------------------------------------------------------
// Status Mappings (Bidirectional)
// -----------------------------------------------------------------------------

const TASK_STATUS_TO_NOTION: Record<string, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done'
}

const TASK_STATUS_FROM_NOTION: Record<string, string> = {
  'To Do': 'todo',
  'In Progress': 'in-progress',
  'In Review': 'in-progress',
  'Blocked': 'todo',
  'Done': 'done'
}

const PRIORITY_TO_NOTION: Record<string, string> = {
  'high': 'High',
  'medium': 'Medium',
  'low': 'Low'
}

const PRIORITY_FROM_NOTION: Record<string, string> = {
  'High': 'high',
  'Medium': 'medium',
  'Low': 'low'
}

const NOTE_MODE_ICONS: Record<string, string> = {
  'general': '📝',
  'reference': '📖',
  'background': '🔍',
  'examples': '💡',
  'page': '📄',
  'component': '🧩',
  'content-model': '🗂️',
  'wp-config': '⚙️'
}

const ARTIFACT_TYPE_ICONS: Record<string, string> = {
  'code': '💻',
  'markdown': '📝',
  'html': '🌐',
  'svg': '🎨'
}

// Max length for rich_text property values (Notion limit)
const RICH_TEXT_MAX = 2000
const TRUNCATION_SUFFIX = '[truncated]'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NotionPropertyObject {
  [key: string]: unknown
}

interface CognographNodeData {
  title?: string
  description?: string
  status?: string
  priority?: string
  dueDate?: number
  complexity?: string
  content?: string
  contentFormat?: string
  noteMode?: string
  tags?: string[]
  summary?: string
  contentType?: string
  language?: string
  color?: string
  childNodeIds?: string[]
  properties?: Record<string, unknown>
}

export interface MappedNotionProperties {
  properties: NotionPropertyObject
  /** The truncated description that was actually sent (for snapshot storage) */
  truncatedDescription?: string
}

export interface MappedCognographFields {
  title?: string
  status?: string
  priority?: string
  description?: string
  dueDate?: number
  /** Extra fields stored in data.properties.notion_* */
  notionExtras: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function truncateRichText(text: string): { value: string; wasTruncated: boolean } {
  if (text.length <= RICH_TEXT_MAX) {
    return { value: text, wasTruncated: false }
  }
  const maxContent = RICH_TEXT_MAX - TRUNCATION_SUFFIX.length
  return { value: text.slice(0, maxContent) + TRUNCATION_SUFFIX, wasTruncated: true }
}

function titleProperty(text: string): unknown {
  return { title: [{ text: { content: text } }] }
}

function richTextProperty(text: string): unknown {
  return { rich_text: [{ text: { content: text } }] }
}

function selectProperty(value: string): unknown {
  return { select: { name: value } }
}

function dateProperty(unixMs: number): unknown {
  return { date: { start: new Date(unixMs).toISOString().split('T')[0] } }
}

function numberProperty(value: number): unknown {
  return { number: value }
}

// Extract plain text from Notion rich_text array
function extractRichText(richTextArray: Array<{ plain_text?: string }>): string {
  if (!Array.isArray(richTextArray)) return ''
  return richTextArray.map(rt => rt.plain_text ?? '').join('')
}

// Extract title from Notion title array
function extractTitle(titleArray: Array<{ plain_text?: string }>): string {
  return extractRichText(titleArray)
}

// Extract select value
function extractSelect(selectObj: { name?: string } | null): string | undefined {
  return selectObj?.name
}

// Extract date as Unix ms
function extractDate(dateObj: { start?: string } | null): number | undefined {
  if (!dateObj?.start) return undefined
  return new Date(dateObj.start).getTime()
}

// Extract number
function extractNumber(numValue: number | null): number | undefined {
  return numValue ?? undefined
}

// -----------------------------------------------------------------------------
// Task Node → Notion Tasks DB (Section 4a)
// -----------------------------------------------------------------------------

export function taskToNotion(
  nodeId: string,
  data: CognographNodeData
): MappedNotionProperties {
  const properties: NotionPropertyObject = {}

  // Title (bidirectional)
  if (data.title !== undefined) {
    properties['Name'] = titleProperty(data.title)
  }

  // Description → Notes (push only)
  let truncatedDescription: string | undefined
  if (data.description !== undefined) {
    const { value, wasTruncated } = truncateRichText(data.description)
    properties['Notes'] = richTextProperty(value)
    if (wasTruncated) {
      truncatedDescription = value
    }
  }

  // Status (bidirectional)
  if (data.status !== undefined) {
    const notionStatus = TASK_STATUS_TO_NOTION[data.status]
    if (notionStatus) {
      properties['Status'] = selectProperty(notionStatus)
    }
  }

  // Priority (bidirectional)
  if (data.priority !== undefined && data.priority !== 'none') {
    const notionPriority = PRIORITY_TO_NOTION[data.priority]
    if (notionPriority) {
      properties['Priority'] = selectProperty(notionPriority)
    }
  }

  // Due Date (bidirectional)
  if (data.dueDate !== undefined) {
    properties['Due Date'] = dateProperty(data.dueDate)
  }

  // Cognograph Node ID (push only, for upsert matching)
  properties['Cognograph Node ID'] = richTextProperty(nodeId)

  return { properties, truncatedDescription }
}

// -----------------------------------------------------------------------------
// Notion Tasks DB → Task Node (Section 4a pull)
// -----------------------------------------------------------------------------

export function taskFromNotion(
  notionProperties: Record<string, any>
): MappedCognographFields {
  const result: MappedCognographFields = { notionExtras: {} }

  // Title
  if (notionProperties['Name']) {
    result.title = extractTitle(notionProperties['Name'].title)
  }

  // Status
  if (notionProperties['Status']) {
    const notionStatus = extractSelect(notionProperties['Status'].select)
    if (notionStatus) {
      result.status = TASK_STATUS_FROM_NOTION[notionStatus] ?? 'todo'
      // Track Blocked status separately
      if (notionStatus === 'Blocked') {
        result.notionExtras['notion_blocked'] = true
      }
    }
  }

  // Priority
  if (notionProperties['Priority']) {
    const notionPriority = extractSelect(notionProperties['Priority'].select)
    if (notionPriority) {
      result.priority = PRIORITY_FROM_NOTION[notionPriority]
    }
  }

  // Due Date
  if (notionProperties['Due Date']) {
    result.dueDate = extractDate(notionProperties['Due Date'].date)
  }

  // Description (Notes — read for diff, but Cognograph is content authority)
  if (notionProperties['Notes']) {
    result.description = extractRichText(notionProperties['Notes'].rich_text)
  }

  // Category (Notion → Cognograph only)
  if (notionProperties['Category']) {
    const cat = extractSelect(notionProperties['Category'].select)
    if (cat) result.notionExtras['notion_category'] = cat
  }

  // Actual Hours (rollup, read-only)
  if (notionProperties['Actual Hours']) {
    const hours = extractNumber(notionProperties['Actual Hours'].rollup?.number ?? null)
    if (hours !== undefined) result.notionExtras['notion_actualHours'] = hours
  }

  return result
}

// -----------------------------------------------------------------------------
// Project Node → Notion Projects DB (Section 4b)
// -----------------------------------------------------------------------------

export function projectToNotion(
  nodeId: string,
  data: CognographNodeData
): MappedNotionProperties {
  const properties: NotionPropertyObject = {}

  // Title (bidirectional)
  if (data.title !== undefined) {
    properties['Name'] = titleProperty(data.title)
  }

  // Description → Notes (push only)
  let truncatedDescription: string | undefined
  if (data.description !== undefined) {
    const { value, wasTruncated } = truncateRichText(data.description)
    properties['Notes'] = richTextProperty(value)
    if (wasTruncated) {
      truncatedDescription = value
    }
  }

  // Cognograph Node ID
  properties['Cognograph Node ID'] = richTextProperty(nodeId)

  return { properties, truncatedDescription }
}

// -----------------------------------------------------------------------------
// Notion Projects DB → Project Node (Section 4b pull)
// -----------------------------------------------------------------------------

export function projectFromNotion(
  notionProperties: Record<string, any>
): MappedCognographFields {
  const result: MappedCognographFields = { notionExtras: {} }

  // Title
  if (notionProperties['Name']) {
    result.title = extractTitle(notionProperties['Name'].title)
  }

  // Description
  if (notionProperties['Notes']) {
    result.description = extractRichText(notionProperties['Notes'].rich_text)
  }

  // Status (Notion → Cognograph, read-only on project nodes)
  if (notionProperties['Status']) {
    const s = extractSelect(notionProperties['Status'].select)
    if (s) result.notionExtras['notion_status'] = s
  }

  // Priority (Notion → Cognograph, read-only)
  if (notionProperties['Priority']) {
    const p = extractSelect(notionProperties['Priority'].select)
    if (p) result.notionExtras['notion_priority'] = p
  }

  // Type (Notion → Cognograph, read-only)
  if (notionProperties['Type']) {
    const t = extractSelect(notionProperties['Type'].select)
    if (t) result.notionExtras['notion_type'] = t
  }

  // Value (Notion → Cognograph, read-only)
  if (notionProperties['Value']) {
    const v = extractNumber(notionProperties['Value'].number ?? null)
    if (v !== undefined) result.notionExtras['notion_value'] = v
  }

  return result
}

// -----------------------------------------------------------------------------
// Note Node → Notion Page Properties (Section 4c)
// Content is handled by ContentConverter, not PropertyMapper.
// -----------------------------------------------------------------------------

export function noteToNotionPageProperties(
  nodeId: string,
  data: CognographNodeData
): NotionPropertyObject {
  const properties: NotionPropertyObject = {}

  // Page title
  if (data.title !== undefined) {
    properties['title'] = titleProperty(data.title)
  }

  // Tags as multi_select (if target page has Tags property)
  if (data.tags && data.tags.length > 0) {
    properties['Tags'] = {
      multi_select: data.tags.map(tag => ({ name: tag }))
    }
  }

  return properties
}

// -----------------------------------------------------------------------------
// Artifact Node → Notion Page Properties (Section 4d)
// Content is handled by ContentConverter.
// -----------------------------------------------------------------------------

export function artifactToNotionPageProperties(
  nodeId: string,
  data: CognographNodeData
): NotionPropertyObject {
  const properties: NotionPropertyObject = {}

  if (data.title !== undefined) {
    properties['title'] = titleProperty(data.title)
  }

  return properties
}

// -----------------------------------------------------------------------------
// Utility: Get icon for note/artifact page
// -----------------------------------------------------------------------------

export function getPageIcon(
  nodeType: 'note' | 'artifact',
  data: CognographNodeData
): { emoji: string } | undefined {
  if (nodeType === 'note' && data.noteMode) {
    const icon = NOTE_MODE_ICONS[data.noteMode]
    if (icon) return { emoji: icon }
  }
  if (nodeType === 'artifact' && data.contentType) {
    const icon = ARTIFACT_TYPE_ICONS[data.contentType]
    if (icon) return { emoji: icon }
  }
  return undefined
}

// -----------------------------------------------------------------------------
// Utility: Get target DB ID for a node type
// -----------------------------------------------------------------------------

export function getTargetDbId(
  nodeType: string,
  config: { tasksDbId?: string; projectsDbId?: string }
): string | undefined {
  switch (nodeType) {
    case 'task': return config.tasksDbId
    case 'project': return config.projectsDbId
    default: return undefined
  }
}

// -----------------------------------------------------------------------------
// Utility: Map by node type (dispatch)
// -----------------------------------------------------------------------------

export function nodeToNotionProperties(
  nodeType: string,
  nodeId: string,
  data: CognographNodeData
): MappedNotionProperties | null {
  switch (nodeType) {
    case 'task': return taskToNotion(nodeId, data)
    case 'project': return projectToNotion(nodeId, data)
    default: return null
  }
}

export function notionToNodeFields(
  nodeType: string,
  notionProperties: Record<string, any>
): MappedCognographFields | null {
  switch (nodeType) {
    case 'task': return taskFromNotion(notionProperties)
    case 'project': return projectFromNotion(notionProperties)
    default: return null
  }
}

// -----------------------------------------------------------------------------
// Field authority mapping (Section 8e)
// Returns which side is authoritative for each field.
// -----------------------------------------------------------------------------

export type FieldAuthority = 'notion' | 'cognograph' | 'conflict'

export function getFieldAuthority(field: string): FieldAuthority {
  switch (field) {
    case 'status': return 'notion'
    case 'priority': return 'notion'
    case 'dueDate': return 'notion'
    case 'title': return 'conflict'  // Always show conflict modal
    case 'description': return 'cognograph'
    case 'content': return 'cognograph'
    default: return 'cognograph'
  }
}

// Re-export constants for tests
export { RICH_TEXT_MAX, TRUNCATION_SUFFIX }
