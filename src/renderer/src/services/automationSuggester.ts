import type { HistoryAction, NodeData } from '@shared/types'
import type { ActionTrigger, ActionStep } from '@shared/actionTypes'
import { useWorkspaceStore } from '../stores/workspaceStore'

export interface AutomationSuggestion {
  id: string
  title: string
  description: string
  trigger: ActionTrigger
  steps: ActionStep[]
  confidence: number // 0-1 how confident we are in this suggestion
  patternType: 'repetitive-update' | 'spatial-cluster' | 'workflow-chain' | 'bulk-operation'
}

interface DetectedPattern {
  type: AutomationSuggestion['patternType']
  frequency: number
  details: Record<string, unknown>
}

// Track history analysis state
let lastAnalyzedIndex = 0
const ANALYSIS_INTERVAL = 20 // Analyze every 20 operations
const MIN_PATTERN_FREQUENCY = 3 // Minimum repetitions to suggest

/**
 * Analyze recent history for repetitive patterns that could be automated.
 * Returns suggestions for action nodes the user might want to create.
 */
export function analyzeHistoryForPatterns(): AutomationSuggestion[] {
  const state = useWorkspaceStore.getState()
  const { history, historyIndex } = state

  // Only analyze if enough new actions since last analysis
  if (historyIndex - lastAnalyzedIndex < ANALYSIS_INTERVAL) {
    return []
  }

  lastAnalyzedIndex = historyIndex

  // Get the last 50 actions for analysis
  const recentActions = history.slice(Math.max(0, historyIndex - 50), historyIndex + 1)
  if (recentActions.length < MIN_PATTERN_FREQUENCY) return []

  const patterns: DetectedPattern[] = []

  // Detect repetitive property updates
  detectRepetitiveUpdates(recentActions, patterns)

  // Detect spatial clustering patterns
  detectSpatialClusters(recentActions, patterns)

  // Detect workflow chains (create node → update → link)
  detectWorkflowChains(recentActions, patterns)

  // Convert patterns to suggestions
  return patterns
    .filter(p => p.frequency >= MIN_PATTERN_FREQUENCY)
    .map(patternToSuggestion)
    .filter((s): s is AutomationSuggestion => s !== null)
    .slice(0, 3) // Max 3 suggestions at a time
}

/**
 * Generate an LLM prompt describing detected patterns for enhanced suggestions.
 * Can be sent to the LLM for more nuanced automation ideas.
 */
export function generatePatternPrompt(patterns: DetectedPattern[]): string {
  const patternDescriptions = patterns.map(p => {
    switch (p.type) {
      case 'repetitive-update':
        return `The user repeatedly updates the "${p.details.property}" property from "${p.details.fromValue}" to "${p.details.toValue}" on ${p.details.nodeType} nodes (${p.frequency} times).`
      case 'spatial-cluster':
        return `The user tends to group ${p.details.nodeType} nodes in the same area (${p.frequency} nodes within ${p.details.radius}px).`
      case 'workflow-chain':
        return `The user often creates a ${p.details.sequence} workflow chain (${p.frequency} times).`
      case 'bulk-operation':
        return `The user frequently performs bulk "${p.details.operation}" operations on ${p.details.count} nodes at a time (${p.frequency} times).`
    }
  })

  return `Based on the user's recent activity in a spatial canvas workflow tool, suggest automations:

${patternDescriptions.join('\n')}

Suggest 1-2 automations that could save the user time. For each, provide:
- A short title
- What triggers it (property change, node creation, spatial proximity, etc.)
- What actions it performs
Focus on spatial-aware automations (region-based triggers, proximity, clustering).`
}

// -----------------------------------------------------------------------------
// Pattern Detection
// -----------------------------------------------------------------------------

function detectRepetitiveUpdates(actions: HistoryAction[], patterns: DetectedPattern[]): void {
  // Count property update patterns
  const updatePatterns = new Map<string, { count: number; details: Record<string, unknown> }>()

  for (const action of actions) {
    if (action.type === 'UPDATE_NODE' && action.after) {
      const keys = Object.keys(action.after)
      for (const key of keys) {
        // Skip system properties that shouldn't trigger automations
        if (key === 'updatedAt' || key === 'lastAccessedAt' || key === 'accessCount' || key === 'createdAt' || key === 'id') continue

        const fromValue = action.before[key as keyof typeof action.before]
        const toValue = action.after[key as keyof typeof action.after]

        // Skip nonsensical patterns where fromValue === toValue
        if (fromValue === toValue) continue

        const patternKey = `${key}:${String(fromValue)}→${String(toValue)}`
        const existing = updatePatterns.get(patternKey)
        if (existing) {
          existing.count++
        } else {
          updatePatterns.set(patternKey, {
            count: 1,
            details: {
              property: key,
              fromValue,
              toValue
            }
          })
        }
      }
    }
  }

  for (const [, value] of updatePatterns) {
    if (value.count >= MIN_PATTERN_FREQUENCY) {
      patterns.push({
        type: 'repetitive-update',
        frequency: value.count,
        details: value.details
      })
    }
  }
}

function detectSpatialClusters(
  actions: HistoryAction[],
  patterns: DetectedPattern[]
): void {
  // Look for nodes created in proximity to each other
  const createdNodePositions: Array<{ x: number; y: number; type: string }> = []

  for (const action of actions) {
    if (action.type === 'ADD_NODE') {
      createdNodePositions.push({
        x: action.node.position.x,
        y: action.node.position.y,
        type: action.node.data.type
      })
    }
  }

  if (createdNodePositions.length < MIN_PATTERN_FREQUENCY) return

  // Group by type and check spatial proximity
  const typeGroups = new Map<string, typeof createdNodePositions>()
  for (const pos of createdNodePositions) {
    const group = typeGroups.get(pos.type) || []
    group.push(pos)
    typeGroups.set(pos.type, group)
  }

  for (const [type, positions] of typeGroups) {
    if (positions.length < MIN_PATTERN_FREQUENCY) continue

    // Check if they're clustered (within 500px of each other)
    const centroidX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
    const centroidY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length
    const avgRadius = positions.reduce((sum, p) => {
      const dx = p.x - centroidX
      const dy = p.y - centroidY
      return sum + Math.sqrt(dx * dx + dy * dy)
    }, 0) / positions.length

    if (avgRadius < 500) {
      patterns.push({
        type: 'spatial-cluster',
        frequency: positions.length,
        details: { nodeType: type, radius: Math.round(avgRadius) }
      })
    }
  }
}

function detectWorkflowChains(actions: HistoryAction[], patterns: DetectedPattern[]): void {
  // Look for sequences: ADD_NODE → UPDATE_NODE → ADD_EDGE
  let chainCount = 0
  const sequence: string[] = []

  for (let i = 0; i < actions.length - 2; i++) {
    const a = actions[i]!
    const b = actions[i + 1]!
    const c = actions[i + 2]!

    if (a.type === 'ADD_NODE' && b.type === 'UPDATE_NODE' && c.type === 'ADD_EDGE') {
      chainCount++
      if (sequence.length === 0) {
        const nodeType = (a as { type: 'ADD_NODE'; node: { data: NodeData } }).node.data.type
        sequence.push(`create ${nodeType}`, 'update properties', 'link')
      }
    }
  }

  if (chainCount >= MIN_PATTERN_FREQUENCY) {
    patterns.push({
      type: 'workflow-chain',
      frequency: chainCount,
      details: { sequence: sequence.join(' → ') }
    })
  }
}

// -----------------------------------------------------------------------------
// Pattern → Suggestion Conversion
// -----------------------------------------------------------------------------

let suggestionCounter = 0

function patternToSuggestion(pattern: DetectedPattern): AutomationSuggestion | null {
  suggestionCounter++
  const id = `suggestion-${suggestionCounter}-${Date.now()}`

  switch (pattern.type) {
    case 'repetitive-update': {
      const { property, fromValue, toValue } = pattern.details
      return {
        id,
        title: `Auto-update ${String(property)}`,
        description: `When ${String(property)} changes to "${String(fromValue)}", automatically set it to "${String(toValue)}"`,
        trigger: {
          type: 'property-change',
          property: String(property),
          toValue: String(fromValue)
        },
        steps: [{
          id: 'step-1',
          type: 'update-property',
          label: `Set ${String(property)} to ${String(toValue)}`,
          onError: 'stop' as const,
          config: {
            target: 'trigger-node',
            property: String(property),
            value: toValue
          }
        }],
        confidence: Math.min(0.9, pattern.frequency / 10),
        patternType: pattern.type
      }
    }

    case 'spatial-cluster': {
      const { nodeType, radius } = pattern.details
      return {
        id,
        title: `Auto-organize ${String(nodeType)} cluster`,
        description: `Detected ${pattern.frequency} ${String(nodeType)} nodes clustered within ${String(radius)}px. Create a region to track this group.`,
        trigger: {
          type: 'node-created',
          nodeTypeFilter: String(nodeType)
        },
        steps: [{
          id: 'step-1',
          type: 'move-node',
          label: `Move to cluster area`,
          onError: 'continue' as const,
          config: {
            target: 'trigger-node',
            position: 'relative',
            x: 0,
            y: 0
          }
        }],
        confidence: Math.min(0.7, pattern.frequency / 15),
        patternType: pattern.type
      }
    }

    case 'workflow-chain': {
      return {
        id,
        title: 'Automate workflow chain',
        description: `Detected repeated pattern: ${String(pattern.details.sequence)}. Create an action to automate this.`,
        trigger: { type: 'manual' },
        steps: [{
          id: 'step-1',
          type: 'create-node',
          label: 'Create node',
          onError: 'stop' as const,
          config: {
            nodeType: 'note',
            title: 'Auto-created',
            position: 'near-trigger'
          }
        }],
        confidence: Math.min(0.6, pattern.frequency / 10),
        patternType: pattern.type
      }
    }

    default:
      return null
  }
}

/**
 * Reset the analysis state (e.g., when workspace is loaded).
 */
export function resetAnalysisState(): void {
  lastAnalyzedIndex = 0
  suggestionCounter = 0
}
