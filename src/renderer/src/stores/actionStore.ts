import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ActionNodeData, ActionEvent, ExecutionContext } from '@shared/actionTypes'
import { executeActionSteps } from '../services/actionExecutor'
import { useWorkspaceStore } from './workspaceStore'
import { useSpatialRegionStore } from './spatialRegionStore'

// Debounce tracking per (actionNodeId, triggerNodeId) pair
const debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
const DEBOUNCE_MS = 300

// Maximum execution stack depth to prevent circular triggers
const MAX_STACK_DEPTH = 5

// Proximity state tracking: `${actionNodeId}:${movingNodeId}` -> was within threshold
const proximityState: Map<string, boolean> = new Map()

interface ActionStoreState {
  // Registered action nodes (enabled ones that are actively monitoring)
  activeActions: Map<string, ActionNodeData>

  // Execution stack (for circular prevention)
  executionStack: string[]

  // Currently executing action IDs
  executingActions: Set<string>

  // Log of recent events (for debugging)
  recentEvents: ActionEvent[]

  // Actions
  registerAction: (nodeId: string, data: ActionNodeData) => void
  unregisterAction: (nodeId: string) => void
  syncActions: () => void
  handleEvent: (event: ActionEvent) => void
  executeAction: (actionNodeId: string, event: ActionEvent) => Promise<void>
  triggerManual: (actionNodeId: string) => void
}

export const useActionStore = create<ActionStoreState>()(
  immer((set, get) => ({
    activeActions: new Map(),
    executionStack: [],
    executingActions: new Set(),
    recentEvents: [],

    registerAction: (nodeId, data) => {
      set((state) => {
        state.activeActions.set(nodeId, data)
      })
    },

    unregisterAction: (nodeId) => {
      // Clear any pending debounce timers for this action
      for (const [key, timer] of debounceTimers) {
        if (key.startsWith(`${nodeId}:`)) {
          clearTimeout(timer)
          debounceTimers.delete(key)
        }
      }

      set((state) => {
        state.activeActions.delete(nodeId)
      })
    },

    // Sync all action nodes from workspace store
    syncActions: () => {
      const nodes = useWorkspaceStore.getState().nodes
      set((state) => {
        state.activeActions.clear()
        for (const node of nodes) {
          if (node.data.type === 'action') {
            const actionData = node.data as ActionNodeData
            if (actionData.enabled) {
              state.activeActions.set(node.id, actionData)
            }
          }
        }
      })
    },

    handleEvent: (event) => {
      const state = get()

      // Log event (keep last 50)
      set((s) => {
        s.recentEvents.push(event)
        if (s.recentEvents.length > 50) {
          s.recentEvents = s.recentEvents.slice(-50)
        }
      })

      // Check all active actions for matching triggers
      for (const [actionNodeId, actionData] of state.activeActions.entries()) {
        if (matchesTrigger(actionData, event, actionNodeId)) {
          // Debounce per (actionNodeId, triggerNodeId) pair
          const debounceKey = `${actionNodeId}:${event.nodeId}`
          const existingTimer = debounceTimers.get(debounceKey)
          if (existingTimer) {
            clearTimeout(existingTimer)
          }

          debounceTimers.set(debounceKey, setTimeout(() => {
            debounceTimers.delete(debounceKey)
            // Verify action still exists before executing
            if (get().activeActions.has(actionNodeId)) {
              get().executeAction(actionNodeId, event)
            }
          }, DEBOUNCE_MS))
        }
      }
    },

    executeAction: async (actionNodeId, event) => {
      const state = get()

      // Circular prevention
      if (state.executionStack.includes(actionNodeId)) {
        console.warn(`[ActionStore] Circular trigger prevented for action ${actionNodeId}`)
        return
      }

      if (state.executionStack.length >= MAX_STACK_DEPTH) {
        console.warn(`[ActionStore] Max stack depth reached, skipping action ${actionNodeId}`)
        return
      }

      // Get fresh action data from workspace store
      const workspaceState = useWorkspaceStore.getState()
      const actionNode = workspaceState.nodes.find(n => n.id === actionNodeId)
      if (!actionNode || actionNode.data.type !== 'action') return

      const actionData = actionNode.data as ActionNodeData
      if (!actionData.enabled) return

      // Check conditions
      if (!evaluateConditions(actionData, event, workspaceState, actionNodeId)) {
        return
      }

      // Push to execution stack
      set((s) => {
        s.executionStack.push(actionNodeId)
        s.executingActions.add(actionNodeId)
      })

      try {
        const context: ExecutionContext = {
          triggerNodeId: event.nodeId,
          actionNodeId,
          event,
          variables: {},
          startedAt: Date.now()
        }

        const result = await executeActionSteps(actionData.actions, context, workspaceState)

        // Update action stats
        const updateNode = useWorkspaceStore.getState().updateNode
        if (result.success) {
          updateNode(actionNodeId, {
            runCount: actionData.runCount + 1,
            lastRun: Date.now(),
            lastError: undefined
          })
        } else {
          updateNode(actionNodeId, {
            runCount: actionData.runCount + 1,
            errorCount: actionData.errorCount + 1,
            lastRun: Date.now(),
            lastError: result.error
          })
        }
      } finally {
        // Pop from execution stack
        set((s) => {
          s.executionStack = s.executionStack.filter(id => id !== actionNodeId)
          s.executingActions.delete(actionNodeId)
        })
      }
    },

    triggerManual: (actionNodeId) => {
      const event: ActionEvent = {
        type: 'manual',
        nodeId: actionNodeId,
        timestamp: Date.now()
      }
      get().executeAction(actionNodeId, event)
    }
  }))
)

// -----------------------------------------------------------------------------
// Trigger Matching
// -----------------------------------------------------------------------------

function matchesTrigger(actionData: ActionNodeData, event: ActionEvent, actionNodeId: string): boolean {
  const trigger = actionData.trigger

  switch (trigger.type) {
    case 'manual':
      // Manual triggers bypass matchesTrigger (triggerManual calls executeAction directly)
      return false

    case 'property-change':
      if (event.type !== 'property-change') return false
      // Check property matches
      if (trigger.property && event.data?.property !== trigger.property) return false
      // Check from/to values if specified
      if (trigger.fromValue !== undefined && event.data?.oldValue !== trigger.fromValue) return false
      if (trigger.toValue !== undefined && event.data?.newValue !== trigger.toValue) return false
      // Check node type filter
      if (trigger.nodeFilter && event.data?.nodeType !== trigger.nodeFilter) return false
      return true

    case 'node-created':
      if (event.type !== 'node-created') return false
      if (trigger.nodeTypeFilter && event.data?.nodeType !== trigger.nodeTypeFilter) return false
      return true

    case 'connection-made':
      if (event.type !== 'connection-made') return false
      if (trigger.direction && trigger.direction !== 'any') {
        if (trigger.direction === 'incoming' && event.data?.direction !== 'incoming') return false
        if (trigger.direction === 'outgoing' && event.data?.direction !== 'outgoing') return false
      }
      if (trigger.nodeTypeFilter && event.data?.connectedNodeType !== trigger.nodeTypeFilter) return false
      return true

    case 'connection-count': {
      if (event.type !== 'connection-made' && event.type !== 'connection-removed') return false
      // Compute directional count from current edges
      const edges = useWorkspaceStore.getState().edges
      let count: number
      if (trigger.direction === 'incoming') {
        count = edges.filter(e => e.target === event.nodeId).length
      } else if (trigger.direction === 'outgoing') {
        count = edges.filter(e => e.source === event.nodeId).length
      } else {
        // 'any' or undefined: all edges involving the node
        count = edges.filter(e => e.source === event.nodeId || e.target === event.nodeId).length
      }
      switch (trigger.comparison) {
        case 'gte': return count >= trigger.threshold
        case 'lte': return count <= trigger.threshold
        case 'eq': return count === trigger.threshold
      }
      return false
    }

    case 'isolation':
      return (event.type === 'connection-removed' && event.data?.connectionCount === 0)

    case 'children-complete': {
      if (event.type !== 'property-change') return false
      if (trigger.property && event.data?.property !== trigger.property) return false
      // Check if all children of the action node have the target value
      return checkChildrenComplete(actionNodeId, trigger.property, trigger.targetValue, trigger.requireAll)
    }

    case 'ancestor-change':
      if (event.type !== 'property-change') return false
      if (trigger.property && event.data?.property !== trigger.property) return false
      // Check if the changed node is an ancestor of any node connected to this action
      return isAncestorOfActionTarget(event.nodeId)

    case 'region-enter':
      return event.type === 'node-position-change' && event.data?.enteredRegion === trigger.regionId

    case 'region-exit':
      return event.type === 'node-position-change' && event.data?.exitedRegion === trigger.regionId

    case 'cluster-size': {
      if (event.type !== 'node-position-change') return false
      if (!event.data?.enteredRegion && !event.data?.exitedRegion) return false
      // Check if the relevant region matches and count meets threshold
      const relevantRegion = event.data?.enteredRegion || event.data?.exitedRegion
      if (relevantRegion !== trigger.regionId) return false
      const memberCount = getRegionNodeCount(trigger.regionId)
      switch (trigger.comparison) {
        case 'gte': return memberCount >= trigger.threshold
        case 'lte': return memberCount <= trigger.threshold
        case 'eq': return memberCount === trigger.threshold
      }
      return false
    }

    case 'proximity': {
      if (event.type !== 'node-position-change') return false
      if (!trigger.targetNodeId) return false
      const distance = getNodeDistance(event.nodeId, trigger.targetNodeId)
      if (distance === null) return false

      const proxKey = `${actionNodeId}:${event.nodeId}`
      const wasWithin = proximityState.get(proxKey) ?? false
      const isWithin = distance <= trigger.distance

      // Update state
      proximityState.set(proxKey, isWithin)

      // Only fire on threshold crossing
      if (trigger.direction === 'entering') {
        return !wasWithin && isWithin // outside→inside
      } else {
        return wasWithin && !isWithin // inside→outside
      }
    }

    case 'schedule':
      return event.type === 'schedule-tick'

    default: {
      const _exhaustive: never = trigger
      void _exhaustive
      return false
    }
  }
}

// -----------------------------------------------------------------------------
// Condition Evaluation
// -----------------------------------------------------------------------------

function evaluateConditions(
  actionData: ActionNodeData,
  event: ActionEvent,
  workspaceState: ReturnType<typeof useWorkspaceStore.getState>,
  actionNodeId?: string
): boolean {
  if (actionData.conditions.length === 0) return true

  for (const condition of actionData.conditions) {
    let targetNode
    switch (condition.target) {
      case 'trigger-node':
        targetNode = workspaceState.nodes.find(n => n.id === event.nodeId)
        break
      case 'action-node':
        targetNode = workspaceState.nodes.find(n => n.id === actionNodeId)
        break
      case 'specific-node':
        targetNode = workspaceState.nodes.find(n => n.id === condition.targetNodeId)
        break
    }

    if (!targetNode) return false

    // Get the field value from node data
    const fieldValue = getNestedValue(targetNode.data, condition.field)

    if (!evaluateOperator(fieldValue, condition.operator, condition.value)) {
      return false
    }
  }

  return true
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function evaluateOperator(fieldValue: unknown, operator: string, conditionValue: unknown): boolean {
  switch (operator) {
    case 'equals':
      return String(fieldValue) === String(conditionValue)
    case 'not-equals':
      return String(fieldValue) !== String(conditionValue)
    case 'contains':
      return String(fieldValue).includes(String(conditionValue))
    case 'not-contains':
      return !String(fieldValue).includes(String(conditionValue))
    case 'greater-than':
      return Number(fieldValue) > Number(conditionValue)
    case 'less-than':
      return Number(fieldValue) < Number(conditionValue)
    case 'is-empty':
      return fieldValue === undefined || fieldValue === null || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)
    case 'is-not-empty':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0)
    case 'matches-regex':
      try {
        return new RegExp(String(conditionValue)).test(String(fieldValue))
      } catch {
        return false
      }
    default:
      return false
  }
}

// -----------------------------------------------------------------------------
// Spatial & Graph-Aware Helpers
// -----------------------------------------------------------------------------

/**
 * Check if all (or any) children of the action node have the target property value.
 * Children are nodes connected via outgoing edges from the action node.
 */
function checkChildrenComplete(
  actionNodeId: string,
  property: string,
  targetValue: unknown,
  requireAll: boolean
): boolean {
  const { nodes, edges } = useWorkspaceStore.getState()

  // Find children: nodes where the action node is the source of an edge
  const childIds = edges
    .filter(e => e.source === actionNodeId)
    .map(e => e.target)

  if (childIds.length === 0) return false

  const childNodes = nodes.filter(n => childIds.includes(n.id))
  if (childNodes.length === 0) return false

  const matches = childNodes.filter(n => {
    const value = getNestedValue(n.data, property)
    return String(value) === String(targetValue)
  })

  return requireAll
    ? matches.length === childNodes.length
    : matches.length > 0
}

/**
 * Check if a node is an ancestor (connected upstream) of any node.
 * Traverses edges upward to find parent nodes.
 */
function isAncestorOfActionTarget(nodeId: string): boolean {
  const { edges } = useWorkspaceStore.getState()
  // Find all nodes that have this nodeId as an ancestor (source → target direction)
  const visited = new Set<string>()
  const queue = [nodeId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    // Find edges where current node is the source (downstream children)
    const childEdges = edges.filter(e => e.source === currentId)
    for (const edge of childEdges) {
      if (!visited.has(edge.target)) {
        queue.push(edge.target)
      }
    }
  }

  // Return true if any descendant exists (besides the node itself)
  return visited.size > 1
}

/**
 * Count the number of nodes currently inside a spatial region.
 */
function getRegionNodeCount(regionId: string): number {
  const { nodeRegionMembership } = useSpatialRegionStore.getState()
  let count = 0
  for (const nodeId of Object.keys(nodeRegionMembership)) {
    if (nodeRegionMembership[nodeId]!.includes(regionId)) count++
  }
  return count
}

/**
 * Calculate the distance between two nodes (center-to-center).
 * Returns null if either node is not found.
 */
function getNodeDistance(nodeIdA: string, nodeIdB: string): number | null {
  const { nodes } = useWorkspaceStore.getState()
  const nodeA = nodes.find(n => n.id === nodeIdA)
  const nodeB = nodes.find(n => n.id === nodeIdB)
  if (!nodeA || !nodeB) return null

  const widthA = (nodeA.width as number) || nodeA.measured?.width || 280
  const heightA = (nodeA.height as number) || nodeA.measured?.height || 140
  const widthB = (nodeB.width as number) || nodeB.measured?.width || 280
  const heightB = (nodeB.height as number) || nodeB.measured?.height || 140

  const centerAx = nodeA.position.x + widthA / 2
  const centerAy = nodeA.position.y + heightA / 2
  const centerBx = nodeB.position.x + widthB / 2
  const centerBy = nodeB.position.y + heightB / 2

  const dx = centerAx - centerBx
  const dy = centerAy - centerBy
  return Math.sqrt(dx * dx + dy * dy)
}
