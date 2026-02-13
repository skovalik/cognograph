/**
 * Property AI Service
 *
 * Handles AI-powered property suggestions for nodes.
 * Follows patterns from actionAIService.ts.
 */

import type {
  NodeData,
  ConversationNodeData,
  NoteNodeData,
  TaskNodeData,
  ProjectNodeData,
  ArtifactNodeData,
  TextNodeData,
  ActionNodeData,
  OrchestratorNodeData,
  WorkspaceNodeData,
  PropertyDefinition,
  PropertySchema
} from '@shared/types'

// =============================================================================
// Types
// =============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low'

/**
 * Enhanced context for connected nodes with full edge information
 */
export interface ConnectedNodeContext {
  // Node info
  id: string
  type: NodeData['type']
  title: string

  // Node's current properties (for inheritance logic)
  properties?: {
    tags?: string[]
    priority?: string
    status?: string
    dueDate?: string
    [key: string]: unknown
  }

  // Edge info - CRITICAL for inference
  edgeLabel?: string           // "provides context", "depends on", etc.
  edgeWeight: number           // @deprecated - legacy 1-10 scale
  edgeStrength?: 'light' | 'normal' | 'strong' // Simplified strength
  edgeDirection: 'incoming' | 'outgoing'  // Relative to target node
  edgeActive: boolean          // Whether edge is enabled
}

/**
 * Pre-computed graph statistics for efficient prompt construction
 */
export interface GraphStats {
  incomingCount: number      // Nodes pointing TO this node
  outgoingCount: number      // Nodes this points TO
  highPriorityConnections: number  // Connected high-priority tasks
  sharedTags: string[]       // Tags appearing in 2+ connected nodes
}

export interface PropertyAIContext {
  // Target node info
  nodeId: string
  nodeType: NodeData['type']
  title: string
  content: string
  contentType: 'messages' | 'description' | 'code' | 'html' | 'unknown'

  // Current state
  currentProperties: Record<string, unknown>
  availableProperties: PropertyDefinition[]

  // Graph context - enhanced
  connectedNodes: ConnectedNodeContext[]

  // Aggregated graph stats (for quick reference)
  graphStats: GraphStats

  // User request
  userPrompt: string
}

export interface PropertySuggestion {
  action: 'set' | 'append' | 'add-property'
  propertyId: string
  propertyName?: string
  propertyType?: PropertyDefinition['type']
  currentValue?: unknown
  value: unknown
  confidence: ConfidenceLevel
  reasoning: string
  needsOptionCreation?: boolean
}

export interface AIPropertyResponse {
  suggestions: PropertySuggestion[]
  summary: string
}

// =============================================================================
// Constants
// =============================================================================

const MAX_CONTENT_LENGTH = 2000
const MAX_CONNECTED_NODES = 8  // Increased for better graph context

// =============================================================================
// Content Extraction
// =============================================================================

/**
 * Extract analyzable content from any node type
 */
export function extractNodeContent(nodeData: NodeData): {
  content: string
  contentType: 'messages' | 'description' | 'code' | 'html' | 'unknown'
} {
  switch (nodeData.type) {
    case 'conversation': {
      const convData = nodeData as ConversationNodeData
      const messages = convData.messages || []
      // Get last 5 messages, format as readable text
      const recentMessages = messages.slice(-5)
      const content = recentMessages
        .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
        .join('\n')
      return { content, contentType: 'messages' }
    }

    case 'note': {
      const noteData = nodeData as NoteNodeData
      let contextHint = ''

      // Add mode-specific context for better suggestions
      if (noteData.noteMode) {
        const modeDescriptions = {
          persona: '[Character/persona definition for roleplay scenarios]',
          reference: '[Reference material or documentation]',
          examples: '[Examples and code samples]',
          background: '[Background research and context]',
          'design-tokens': '[Design system tokens and variables]',
          page: '[Website page structure]',
          component: '[UI component specification]',
          'content-model': '[Content type definition]',
          'wp-config': '[WordPress configuration]',
          general: ''
        }
        contextHint = modeDescriptions[noteData.noteMode] || ''
        if (contextHint) contextHint += '\n'
      }

      return {
        content: contextHint + (noteData.content || ''),
        contentType: 'description'
      }
    }

    case 'task': {
      const taskData = nodeData as TaskNodeData
      return { content: taskData.description || '', contentType: 'description' }
    }

    case 'project': {
      const projectData = nodeData as ProjectNodeData
      return { content: projectData.description || '', contentType: 'description' }
    }

    case 'artifact': {
      const artifactData = nodeData as ArtifactNodeData
      const files = artifactData.files || []
      // Get first file's content
      const firstFile = files[0]
      return {
        content: firstFile?.content || '',
        contentType: 'code'
      }
    }

    case 'text': {
      const textData = nodeData as TextNodeData
      // Strip HTML tags for analysis
      const stripped = (textData.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      return { content: stripped, contentType: 'html' }
    }

    case 'action': {
      const actionData = nodeData as ActionNodeData
      return { content: actionData.description || '', contentType: 'description' }
    }

    case 'orchestrator': {
      const orchData = nodeData as OrchestratorNodeData
      // Note: Agent name lookup happens in buildPropertyPrompt where we have access to workspace store
      const agentInfo = orchData.connectedAgents
        ?.map(a => `Agent: ${a.nodeId} (${a.role || 'unnamed'})`)
        .join('\n') || ''

      const content = [
        orchData.description || '',
        orchData.strategy ? `Strategy: ${orchData.strategy}` : '',
        agentInfo ? `Connected agents:\n${agentInfo}` : '',
        orchData.budget ? `Budget: ${orchData.budget.maxCost} credits` : ''
      ].filter(Boolean).join('\n')

      return { content, contentType: 'description' }
    }

    case 'workspace': {
      const workspaceData = nodeData as WorkspaceNodeData
      const memberCount = workspaceData.includedNodeIds?.length || 0
      const llmModel = workspaceData.llmSettings?.model || 'not configured'

      const content = [
        workspaceData.description || '',
        `Members: ${memberCount} nodes`,
        `LLM: ${llmModel}`
      ].filter(Boolean).join('\n')

      return { content, contentType: 'description' }
    }

    default:
      return { content: '', contentType: 'unknown' }
  }
}

/**
 * Truncate content intelligently at sentence boundaries
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content

  // Try to cut at sentence boundary
  const truncated = content.slice(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')
  const cutPoint = Math.max(lastPeriod, lastNewline)

  if (cutPoint > maxLength * 0.5) {
    return truncated.slice(0, cutPoint + 1) + '...'
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...'
  }

  return truncated + '...'
}

// =============================================================================
// Prompt Building
// =============================================================================

const SYSTEM_PROMPT = `You are an AI assistant helping configure properties for nodes in Cognograph, a spatial canvas app where nodes represent ideas arranged on an infinite 2D canvas with semantic edges connecting them.

## Cognograph Graph Model

### Node Types & Their Properties
| Type | Key Properties | Notes |
|------|----------------|-------|
| conversation | messages, context | AI chat - properties affect prompt injection |
| note | content, tags | Freeform - tags help categorization |
| task | status, priority, due date | Actionable - priority propagates via edges |
| project | description, childNodeIds | Container - inherits properties from children |
| artifact | files, language | Code - tags should include tech stack |
| action | triggers, steps | Automation - priority affects execution order |
| text | content | Rich text blocks |

### Edge Labels & Their Implications for Properties

**CRITICAL: Edge labels define HOW properties should propagate!**

| Label | Direction | Property Implication |
|-------|-----------|---------------------|
| "provides context" | source→target | Source tags relevant to target |
| "depends on" | source→target | Source inherits target's priority (if higher) |
| "child of" | source→target | Source inherits parent project tags |
| "extracted" | source→target | Source should share tags with origin |
| "spawned" | source→target | AI-generated - lower confidence suggestions |
| "related to" | bidirectional | Share tags between both nodes |
| "continues from" | source→target | Inherit status workflow position |
| "references" | source→target | Consider referenced content for tags |
| "alternative to" | bidirectional | Similar tags, potentially conflicting status |

### Edge Strength Interpretation
- **strong**: Critical relationship - heavily prioritize connected node's properties
- **normal**: Standard relationship - consider but don't override
- **light**: Loose relationship - minor influence only

### Edge Direction in Context
- **incoming**: Other node points TO this node (this node receives context)
- **outgoing**: This node points TO other (this node provides context)

For property suggestions:
- Incoming edges with strong strength = ADOPT properties from source
- Outgoing edges = PROPAGATE properties to targets (less relevant for this node)

## Property Inference Rules

### Priority Propagation
IF connected via "depends on" (incoming) to high-priority task:
  → Suggest priority >= connected task's priority
  → Confidence: high (blocking relationship)

IF connected via "related to" to multiple high-priority nodes:
  → Suggest priority: high
  → Confidence: medium (correlation, not causation)

### Tag Inheritance
FOR each connected node with tags:
  IF edge label is "child of" OR "extracted":
    → Include ALL parent/source tags
    → Confidence: high
  ELIF edge label is "provides context" OR "related to":
    → Include OVERLAPPING tags (if content matches)
    → Confidence: medium
  ELIF edge strength is "strong":
    → Consider top 2 tags from connected node
    → Confidence: medium

### Status Inference
IF connected via "depends on" (outgoing) AND all dependencies complete:
  → Suggest status: "ready" or next logical status
  → Confidence: high

IF connected via "continues from":
  → Inherit workflow position hints
  → Confidence: medium

### Date Inference
IF this is a task connected via "depends on" (outgoing) to task with due date:
  → Suggest due date BEFORE dependency's due date
  → Confidence: medium (dependency logic)

IF connected via "child of" to project with deadline:
  → Suggest due date ON or BEFORE project deadline
  → Confidence: medium

### Edge Case Handling
IF edge has NO label:
  → Treat as "related to" with standard inference
  → Use edge strength to determine influence level

IF multiple incoming edges suggest CONFLICTING priorities:
  → Take HIGHEST priority among "strong" strength connections
  → Confidence: medium (conflict detected)
  → Include conflict in reasoning

IF bidirectional/circular connections detected:
  → Only consider INCOMING direction for property adoption
  → Ignore outgoing to prevent circular propagation

## Available Property Types
- text: Any string value
- number: Numeric value (respect min/max)
- select: MUST use exact option value from list
- multi-select: MUST use exact option values
- date: ISO format YYYY-MM-DD
- checkbox: true/false
- tags: Array of lowercase strings, no spaces, 2-5 items

## Response Format
Output valid JSON only:
{
  "suggestions": [
    {
      "action": "set",
      "propertyId": "priority",
      "currentValue": "normal",
      "value": "high",
      "confidence": "high",
      "reasoning": "Depends on 'API Migration' (high priority, strong connection)"
    },
    {
      "action": "set",
      "propertyId": "tags",
      "currentValue": ["backend"],
      "value": ["backend", "api", "migration"],
      "confidence": "medium",
      "reasoning": "Inherited 'api', 'migration' from parent project via 'child of' edge"
    }
  ],
  "summary": "Priority from dependency, tags from project context"
}

## Confidence Guidelines
- **high**: Direct edge relationship dictates property (depends on, child of, extracted)
- **medium**: Inferred from multiple connections or content analysis
- **low**: Weak correlation, user should verify`

/**
 * Format connected nodes grouped by relationship type for clarity
 */
function formatConnectedNodes(nodes: ConnectedNodeContext[]): string {
  if (nodes.length === 0) return '(no connections)'

  // Group by edge label for clearer structure
  const byLabel = new Map<string, ConnectedNodeContext[]>()
  for (const node of nodes) {
    const label = node.edgeLabel || 'connected'
    if (!byLabel.has(label)) byLabel.set(label, [])
    byLabel.get(label)!.push(node)
  }

  const sections: string[] = []

  for (const [label, group] of byLabel) {
    const items = group.map(n => {
      const parts = [
        `  - ${n.type}: "${n.title}"`,
        `[${n.edgeDirection}, strength: ${n.edgeStrength ?? 'normal'}]`
      ]

      // Include relevant properties
      if (n.properties?.priority) parts.push(`priority: ${n.properties.priority}`)
      if (n.properties?.status) parts.push(`status: ${n.properties.status}`)
      if (n.properties?.tags?.length) {
        parts.push(`tags: [${n.properties.tags.slice(0, 5).join(', ')}]`)
      }

      return parts.join(' ')
    })

    sections.push(`### ${label}\n${items.join('\n')}`)
  }

  return sections.join('\n\n')
}

/**
 * Build the user prompt with full graph context
 */
export function buildPropertyPrompt(context: PropertyAIContext): {
  systemPrompt: string
  userPrompt: string
} {
  const { content, contentType } = { content: context.content, contentType: context.contentType }
  const truncatedContent = truncateContent(content, MAX_CONTENT_LENGTH)

  // Format available properties with their current values
  const propertiesList = context.availableProperties
    .map((p) => {
      const currentVal = context.currentProperties[p.id]
      let desc = `- ${p.id} (${p.type}): ${p.name}`
      if (currentVal !== undefined) desc += ` = ${JSON.stringify(currentVal)}`
      if (p.type === 'select' || p.type === 'multi-select') {
        const options = p.options?.map((o) => o.value).join(', ') || 'none'
        desc += ` [options: ${options}]`
      }
      if (p.type === 'number') {
        const range = []
        if (p.validation?.min !== undefined) range.push(`min: ${p.validation.min}`)
        if (p.validation?.max !== undefined) range.push(`max: ${p.validation.max}`)
        if (range.length) desc += ` [${range.join(', ')}]`
      }
      return desc
    })
    .join('\n')

  // Format graph stats summary
  const statsLine = [
    `${context.graphStats.incomingCount} incoming`,
    `${context.graphStats.outgoingCount} outgoing`,
    context.graphStats.highPriorityConnections > 0
      ? `${context.graphStats.highPriorityConnections} high-priority`
      : null,
    context.graphStats.sharedTags.length > 0
      ? `shared tags: [${context.graphStats.sharedTags.join(', ')}]`
      : null
  ].filter(Boolean).join(', ')

  const userPrompt = `## Target Node
Type: ${context.nodeType}
Title: "${context.title}"
ID: ${context.nodeId}

## Content (${contentType})
${truncatedContent || '(empty)'}

## Graph Context (${statsLine})
${formatConnectedNodes(context.connectedNodes.slice(0, MAX_CONNECTED_NODES))}

## Available Properties
${propertiesList || '(no properties defined)'}

## User Request
${context.userPrompt}`

  return { systemPrompt: SYSTEM_PROMPT, userPrompt }
}

// =============================================================================
// Response Parsing
// =============================================================================

/**
 * Parse AI response text into structured suggestions
 */
export function parsePropertyResponse(text: string): AIPropertyResponse {
  // Try to extract JSON from response
  let jsonText = text.trim()

  // Handle markdown code blocks
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim()
  }

  // Try to find JSON object
  const objectMatch = jsonText.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    jsonText = objectMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonText)

    // Validate structure
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      return {
        suggestions: [],
        summary: 'Invalid response format'
      }
    }

    // Validate and normalize each suggestion
    const validSuggestions: PropertySuggestion[] = parsed.suggestions
      .filter((s: unknown): s is Record<string, unknown> => {
        if (!s || typeof s !== 'object') return false
        const suggestion = s as Record<string, unknown>
        return (
          typeof suggestion.propertyId === 'string' &&
          suggestion.value !== undefined &&
          ['set', 'append', 'add-property'].includes(suggestion.action as string)
        )
      })
      .map((s: Record<string, unknown>): PropertySuggestion => ({
        action: (s.action as 'set' | 'append' | 'add-property') || 'set',
        propertyId: s.propertyId as string,
        propertyName: s.propertyName as string | undefined,
        propertyType: s.propertyType as PropertyDefinition['type'] | undefined,
        currentValue: s.currentValue,
        value: s.value,
        confidence: validateConfidence(s.confidence as string),
        reasoning: (s.reasoning as string) || ''
      }))

    return {
      suggestions: validSuggestions,
      summary: (parsed.summary as string) || `${validSuggestions.length} suggestions`
    }
  } catch {
    console.error('Failed to parse AI response:', text)
    return {
      suggestions: [],
      summary: 'Failed to parse response'
    }
  }
}

function validateConfidence(value: unknown): ConfidenceLevel {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value
  }
  return 'medium'
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a suggestion against the property schema
 */
export function validateSuggestion(
  suggestion: PropertySuggestion,
  schema: PropertySchema,
  availableProperties: PropertyDefinition[]
): { valid: boolean; error?: string; needsOptionCreation?: boolean } {
  // For add-property action, we need name and type
  if (suggestion.action === 'add-property') {
    if (!suggestion.propertyName || !suggestion.propertyType) {
      return { valid: false, error: 'Missing property name or type for new property' }
    }
    return { valid: true }
  }

  // Find the property definition
  const propDef = availableProperties.find((p) => p.id === suggestion.propertyId)
  if (!propDef) {
    // Check if it's a custom property
    const customProp = schema.customProperties.find((p) => p.id === suggestion.propertyId)
    if (!customProp) {
      return { valid: false, error: `Unknown property: ${suggestion.propertyId}` }
    }
  }

  const def = propDef || schema.customProperties.find((p) => p.id === suggestion.propertyId)
  if (!def) {
    return { valid: false, error: 'Property definition not found' }
  }

  // Validate value type
  switch (def.type) {
    case 'text':
      if (typeof suggestion.value !== 'string') {
        return { valid: false, error: 'Text property requires string value' }
      }
      break

    case 'number':
      if (typeof suggestion.value !== 'number') {
        return { valid: false, error: 'Number property requires numeric value' }
      }
      if (def.validation?.min !== undefined && suggestion.value < def.validation.min) {
        return { valid: false, error: `Value below minimum (${def.validation.min})` }
      }
      if (def.validation?.max !== undefined && suggestion.value > def.validation.max) {
        return { valid: false, error: `Value above maximum (${def.validation.max})` }
      }
      break

    case 'checkbox':
      if (typeof suggestion.value !== 'boolean') {
        return { valid: false, error: 'Checkbox property requires boolean value' }
      }
      break

    case 'date':
      if (typeof suggestion.value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(suggestion.value)) {
        return { valid: false, error: 'Date property requires ISO date string' }
      }
      break

    case 'select': {
      const validOptions = def.options?.map((o) => o.value) || []
      if (!validOptions.includes(suggestion.value as string)) {
        return { valid: true, needsOptionCreation: true }
      }
      break
    }

    case 'multi-select': {
      const validOptions = def.options?.map((o) => o.value) || []
      const values = Array.isArray(suggestion.value) ? suggestion.value : [suggestion.value]
      const invalidValues = values.filter((v) => !validOptions.includes(v as string))
      if (invalidValues.length > 0) {
        return { valid: true, needsOptionCreation: true }
      }
      break
    }

    case 'tags':
      if (!Array.isArray(suggestion.value)) {
        return { valid: false, error: 'Tags property requires array value' }
      }
      // Normalize tags: lowercase, no spaces
      suggestion.value = (suggestion.value as string[]).map((t) =>
        String(t).toLowerCase().replace(/\s+/g, '-')
      )
      break
  }

  return { valid: true }
}

/**
 * Filter and validate suggestions against schema
 */
export function validateAndFilterSuggestions(
  suggestions: PropertySuggestion[],
  schema: PropertySchema,
  availableProperties: PropertyDefinition[]
): PropertySuggestion[] {
  return suggestions.filter((s) => {
    const result = validateSuggestion(s, schema, availableProperties)
    if (!result.valid) {
      console.warn(`Invalid suggestion for ${s.propertyId}: ${result.error}`)
      return false
    }
    if (result.needsOptionCreation) {
      s.needsOptionCreation = true
    }
    return true
  })
}

// =============================================================================
// Caching
// =============================================================================

interface CacheEntry {
  response: AIPropertyResponse
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Generate cache key from context
 */
export function computeContextHash(context: PropertyAIContext): string {
  // Include graph stats in cache key to invalidate when connections change
  const key = [
    context.nodeId,
    context.nodeType,
    context.title,
    context.content.slice(0, 500),
    JSON.stringify(context.currentProperties),
    JSON.stringify(context.graphStats),
    context.connectedNodes.map(n => `${n.id}:${n.edgeLabel}:${n.edgeStrength ?? 'normal'}`).join(','),
    context.userPrompt
  ].join('|')

  // Simple hash
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(36)
}

/**
 * Get cached response if valid
 */
export function getCachedResponse(hash: string): AIPropertyResponse | null {
  const entry = cache.get(hash)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.response
  }
  cache.delete(hash)
  return null
}

/**
 * Cache a response
 */
export function cacheResponse(hash: string, response: AIPropertyResponse): void {
  cache.set(hash, { response, timestamp: Date.now() })
}

/**
 * Clear cache for a specific hash or all
 */
export function clearCache(hash?: string): void {
  if (hash) {
    cache.delete(hash)
  } else {
    cache.clear()
  }
}

// =============================================================================
// Quick Actions
// =============================================================================

export const QUICK_ACTIONS = [
  {
    id: 'analyze',
    label: 'Analyze',
    prompt: 'Analyze this node and suggest all relevant properties based on its content',
    icon: 'Sparkles'
  },
  {
    id: 'tags',
    label: 'Tags',
    prompt: 'Suggest relevant tags based on the content and context',
    icon: 'Tag'
  },
  {
    id: 'priority',
    label: 'Priority',
    prompt: 'Suggest an appropriate priority level based on content urgency and connected task priorities',
    icon: 'Flag'
  },
  {
    id: 'from-graph',
    label: 'From Graph',
    prompt: 'Inherit properties from connected nodes based on edge relationships. Focus on: 1) Tags from parent/related nodes, 2) Priority from dependencies, 3) Status from workflow position',
    icon: 'Network'
  },
  {
    id: 'sync-tags',
    label: 'Sync Tags',
    prompt: 'Synchronize tags with connected nodes. Add shared tags from strong connections and parent projects.',
    icon: 'Tags'
  },
  {
    id: 'check-status',
    label: 'Check Status',
    prompt: 'Evaluate if this task status should change based on dependency completion and workflow position',
    icon: 'CheckCircle'
  }
] as const

export type QuickActionId = (typeof QUICK_ACTIONS)[number]['id']
