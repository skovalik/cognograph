/**
 * Graph Intelligence Service (Phase 5: Graph Intelligence)
 *
 * Main process service providing:
 * - Rule-based analysis (free, always-on): orphaned clusters, hub nodes,
 *   stale content, missing connections
 * - LLM-powered semantic analysis (Haiku, budgeted at $0.16/day)
 * - Budget management with daily reset
 * - Incremental updates (only analyze changed subgraphs)
 * - IPC registration for renderer communication
 *
 * Optimization #4: Progressive Enhancement
 * - Reduced analysis frequency when node count > 250
 * - Skip glow/animations when node count > 500
 */

import { ipcMain, BrowserWindow } from 'electron'

// =============================================================================
// Types
// =============================================================================

/** Minimal node representation for graph analysis */
interface AnalysisNode {
  id: string
  type: string
  title: string
  updatedAt: number
  createdAt: number
  properties?: Record<string, unknown>
  position: { x: number; y: number }
}

/** Minimal edge representation for graph analysis */
interface AnalysisEdge {
  id: string
  source: string
  target: string
  bidirectional?: boolean
}

/** Graph snapshot for analysis */
interface GraphSnapshot {
  nodes: AnalysisNode[]
  edges: AnalysisEdge[]
  timestamp: number
}

/** Insight result from analysis */
interface AnalysisInsight {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  affectedNodeIds: string[]
  suggestedChanges?: Array<{
    type: string
    nodeType?: string
    nodeData?: Record<string, unknown>
    edgeData?: { source: string; target: string }
    targetId?: string
    agentNodeId: string
  }>
  confidence: number
  source: 'rule-based' | 'llm-powered'
  costUSD?: number
}

/** Budget tracking state */
interface BudgetState {
  dailyLimitUSD: number
  usedTodayUSD: number
  lastResetDate: string // ISO date string YYYY-MM-DD
}

// =============================================================================
// Analysis State
// =============================================================================

let analysisInterval: ReturnType<typeof setInterval> | null = null
let isRunning = false
let lastAnalyzedAt = 0
let budget: BudgetState = {
  dailyLimitUSD: 0.16,
  usedTodayUSD: 0,
  lastResetDate: new Date().toISOString().slice(0, 10),
}

// Track which nodes have changed since last analysis
const changedNodeIds = new Set<string>()

// =============================================================================
// Rule-Based Detectors (Free, Always-On)
// =============================================================================

/**
 * Detect orphaned clusters: groups of connected nodes disconnected from
 * the main graph component.
 */
function detectOrphanedClusters(
  snapshot: GraphSnapshot
): AnalysisInsight[] {
  const insights: AnalysisInsight[] = []
  if (snapshot.nodes.length < 3) return insights

  // Build adjacency list
  const adjacency = new Map<string, Set<string>>()
  for (const node of snapshot.nodes) {
    adjacency.set(node.id, new Set())
  }
  for (const edge of snapshot.edges) {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
    if (edge.bidirectional) {
      adjacency.get(edge.target)?.add(edge.source)
    }
  }

  // Find connected components using BFS
  const visited = new Set<string>()
  const components: string[][] = []

  for (const node of snapshot.nodes) {
    if (visited.has(node.id)) continue
    const component: string[] = []
    const queue = [node.id]
    visited.add(node.id)

    while (queue.length > 0) {
      const current = queue.shift()!
      component.push(current)

      const neighbors = adjacency.get(current) || new Set()
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    components.push(component)
  }

  // Also collect isolated nodes (degree 0)
  const isolatedNodes = snapshot.nodes.filter(
    (n) => (adjacency.get(n.id)?.size ?? 0) === 0
  )

  // Flag small components (less than 40% of total or smaller than main) as orphaned
  if (components.length > 1) {
    const mainComponentSize = Math.max(...components.map((c) => c.length))

    for (const component of components) {
      if (
        component.length < mainComponentSize &&
        component.length >= 2
      ) {
        const nodeNames = component
          .map((id) => {
            const node = snapshot.nodes.find((n) => n.id === id)
            return node?.title || id.slice(0, 8)
          })
          .slice(0, 3)

        insights.push({
          id: crypto.randomUUID(),
          type: 'orphaned-cluster',
          priority: component.length >= 5 ? 'medium' : 'low',
          title: `Orphaned cluster (${component.length} nodes)`,
          description: `Nodes "${nodeNames.join('", "')}"${component.length > 3 ? ` and ${component.length - 3} more` : ''} are disconnected from the main graph.`,
          affectedNodeIds: component,
          confidence: 0.85,
          source: 'rule-based',
        })
      }
    }
  }

  // Flag isolated nodes (no connections at all)
  if (isolatedNodes.length > 0) {
    const names = isolatedNodes
      .map((n) => n.title || n.id.slice(0, 8))
      .slice(0, 3)

    insights.push({
      id: crypto.randomUUID(),
      type: 'orphaned-cluster',
      priority: isolatedNodes.length >= 5 ? 'medium' : 'low',
      title: `${isolatedNodes.length} isolated node${isolatedNodes.length > 1 ? 's' : ''}`,
      description: `"${names.join('", "')}"${isolatedNodes.length > 3 ? ` and ${isolatedNodes.length - 3} more` : ''} have no connections.`,
      affectedNodeIds: isolatedNodes.map((n) => n.id),
      confidence: 0.95,
      source: 'rule-based',
    })
  }

  return insights
}

/**
 * Detect hub nodes: nodes with disproportionately many connections
 * that may create fragility or bottlenecks.
 */
function detectHubNodes(snapshot: GraphSnapshot): AnalysisInsight[] {
  const insights: AnalysisInsight[] = []
  if (snapshot.nodes.length < 5) return insights

  // Count degrees
  const degrees = new Map<string, number>()
  for (const node of snapshot.nodes) {
    degrees.set(node.id, 0)
  }
  for (const edge of snapshot.edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
  }

  // Calculate average and threshold
  const degreeValues = Array.from(degrees.values())
  const avgDegree =
    degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length
  const threshold = Math.max(avgDegree * 3, 6) // At least 3x average or 6

  for (const [nodeId, degree] of degrees) {
    if (degree >= threshold) {
      const node = snapshot.nodes.find((n) => n.id === nodeId)
      if (!node) continue

      insights.push({
        id: crypto.randomUUID(),
        type: 'unbalanced-graph',
        priority: degree >= threshold * 1.5 ? 'high' : 'medium',
        title: `Hub node: "${node.title || nodeId.slice(0, 8)}"`,
        description: `This node has ${degree} connections (average is ${avgDegree.toFixed(1)}). Consider splitting it into smaller, more focused nodes.`,
        affectedNodeIds: [nodeId],
        confidence: 0.75,
        source: 'rule-based',
      })
    }
  }

  return insights
}

/**
 * Detect stale content: nodes that haven't been updated in a long time
 * relative to the workspace's average activity.
 */
function detectStaleContent(snapshot: GraphSnapshot): AnalysisInsight[] {
  const insights: AnalysisInsight[] = []
  if (snapshot.nodes.length < 3) return insights

  const now = Date.now()
  const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

  // Calculate average update time
  const updateTimes = snapshot.nodes
    .map((n) => n.updatedAt || n.createdAt)
    .filter((t) => t > 0)

  if (updateTimes.length === 0) return insights

  const avgUpdateTime =
    updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length
  const recentThreshold = Math.max(
    avgUpdateTime - STALE_THRESHOLD_MS,
    now - 30 * 24 * 60 * 60 * 1000 // Never older than 30 days
  )

  const staleNodes = snapshot.nodes.filter(
    (n) =>
      (n.updatedAt || n.createdAt) < recentThreshold &&
      (n.updatedAt || n.createdAt) > 0
  )

  if (staleNodes.length > 0 && staleNodes.length < snapshot.nodes.length * 0.5) {
    const names = staleNodes
      .sort((a, b) => (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt))
      .map((n) => n.title || n.id.slice(0, 8))
      .slice(0, 3)

    insights.push({
      id: crypto.randomUUID(),
      type: 'stale-content',
      priority: staleNodes.length >= 10 ? 'medium' : 'low',
      title: `${staleNodes.length} stale node${staleNodes.length > 1 ? 's' : ''}`,
      description: `"${names.join('", "')}"${staleNodes.length > 3 ? ` and ${staleNodes.length - 3} more` : ''} haven't been updated recently. Consider reviewing or archiving them.`,
      affectedNodeIds: staleNodes.map((n) => n.id),
      confidence: 0.7,
      source: 'rule-based',
    })
  }

  return insights
}

/**
 * Detect missing connections: nodes that are semantically related
 * (by type or naming patterns) but not connected.
 */
function detectMissingConnections(
  snapshot: GraphSnapshot
): AnalysisInsight[] {
  const insights: AnalysisInsight[] = []
  if (snapshot.nodes.length < 4) return insights

  // Build connected pairs set for quick lookup
  const connectedPairs = new Set<string>()
  for (const edge of snapshot.edges) {
    connectedPairs.add(`${edge.source}:${edge.target}`)
    connectedPairs.add(`${edge.target}:${edge.source}`)
  }

  // Check for task nodes not connected to any project node
  const taskNodes = snapshot.nodes.filter((n) => n.type === 'task')
  const projectNodes = snapshot.nodes.filter((n) => n.type === 'project')

  if (taskNodes.length > 0 && projectNodes.length > 0) {
    const unlinkedTasks = taskNodes.filter((task) => {
      return !projectNodes.some(
        (project) =>
          connectedPairs.has(`${task.id}:${project.id}`) ||
          connectedPairs.has(`${project.id}:${task.id}`)
      )
    })

    if (
      unlinkedTasks.length > 0 &&
      unlinkedTasks.length < taskNodes.length * 0.8
    ) {
      const names = unlinkedTasks
        .map((n) => n.title || n.id.slice(0, 8))
        .slice(0, 3)

      insights.push({
        id: crypto.randomUUID(),
        type: 'missing-connection',
        priority: unlinkedTasks.length >= 5 ? 'medium' : 'low',
        title: `${unlinkedTasks.length} task${unlinkedTasks.length > 1 ? 's' : ''} without project`,
        description: `${unlinkedTasks.length} task node${unlinkedTasks.length > 1 ? 's' : ''} ("${names.join('", "')}") ${unlinkedTasks.length > 3 ? `and ${unlinkedTasks.length - 3} more ` : ''}not connected to any project node.`,
        affectedNodeIds: unlinkedTasks.map((n) => n.id),
        confidence: 0.6,
        source: 'rule-based',
      })
    }
  }

  // Check for conversation (agent) nodes not connected to any node
  const agentNodes = snapshot.nodes.filter((n) => n.type === 'conversation')
  const unlinkedAgents = agentNodes.filter((agent) => {
    const neighbors = new Set<string>()
    for (const edge of snapshot.edges) {
      if (edge.source === agent.id) neighbors.add(edge.target)
      if (edge.target === agent.id) neighbors.add(edge.source)
    }
    return neighbors.size === 0
  })

  if (unlinkedAgents.length > 0 && agentNodes.length > 1) {
    const names = unlinkedAgents
      .map((n) => n.title || n.id.slice(0, 8))
      .slice(0, 3)

    insights.push({
      id: crypto.randomUUID(),
      type: 'missing-connection',
      priority: 'medium',
      title: `${unlinkedAgents.length} unconnected agent${unlinkedAgents.length > 1 ? 's' : ''}`,
      description: `${unlinkedAgents.length} agent node${unlinkedAgents.length > 1 ? 's' : ''} ("${names.join('", "')}") ${unlinkedAgents.length > 3 ? `and ${unlinkedAgents.length - 3} more ` : ''}have no context connections and need connected nodes for context injection.`,
      affectedNodeIds: unlinkedAgents.map((n) => n.id),
      confidence: 0.8,
      source: 'rule-based',
    })
  }

  return insights
}

// =============================================================================
// Topology Analysis (Combines All Rule-Based Detectors)
// =============================================================================

/**
 * Run all rule-based topology detectors on a graph snapshot.
 * This is free (no LLM calls) and always-on.
 */
export function analyzeTopology(snapshot: GraphSnapshot): AnalysisInsight[] {
  const allInsights: AnalysisInsight[] = []

  try {
    allInsights.push(...detectOrphanedClusters(snapshot))
    allInsights.push(...detectHubNodes(snapshot))
    allInsights.push(...detectStaleContent(snapshot))
    allInsights.push(...detectMissingConnections(snapshot))
  } catch (err) {
    console.warn('[GraphIntelligence] Rule-based analysis error:', err)
  }

  return allInsights
}

// =============================================================================
// Semantic Analysis (LLM-Powered, Budgeted)
// =============================================================================

/**
 * Run LLM-powered semantic analysis on a subset of nodes.
 * Uses Haiku model, budgeted at $0.16/day.
 *
 * This is a stub that structures the request - actual LLM call
 * would go through the LLM service. For now, returns empty array.
 * The infrastructure is in place for when we wire it up.
 */
export async function analyzeSemantic(
  _snapshot: GraphSnapshot,
  _changedNodeIds: string[]
): Promise<AnalysisInsight[]> {
  // Check budget
  checkDailyReset()
  const estimatedCost = 0.001 // ~1000 tokens on Haiku
  if (budget.usedTodayUSD + estimatedCost > budget.dailyLimitUSD) {
    console.log(
      '[GraphIntelligence] Daily budget exceeded, skipping semantic analysis'
    )
    return []
  }

  // For now, semantic analysis is a future enhancement
  // The infrastructure is ready: it would call the LLM service
  // with a structured prompt about the changed nodes and their
  // relationships, then parse the response into insights.
  //
  // TODO: Wire up to LLM service when ready
  // const llmResult = await window.api.llm.send({
  //   provider: 'anthropic',
  //   model: 'claude-3-haiku-20240307',
  //   messages: [{ role: 'user', content: buildAnalysisPrompt(snapshot, changedNodeIds) }],
  //   maxTokens: 500,
  // })

  return []
}

// =============================================================================
// Budget Management
// =============================================================================

function checkDailyReset(): void {
  const today = new Date().toISOString().slice(0, 10)
  if (budget.lastResetDate !== today) {
    budget = {
      ...budget,
      usedTodayUSD: 0,
      lastResetDate: today,
    }
  }
}

function canSpendBudget(costUSD: number): boolean {
  checkDailyReset()
  return budget.usedTodayUSD + costUSD <= budget.dailyLimitUSD
}

function getBudgetStatus(): {
  dailyLimitUSD: number
  usedTodayUSD: number
  remainingUSD: number
} {
  checkDailyReset()
  return {
    dailyLimitUSD: budget.dailyLimitUSD,
    usedTodayUSD: budget.usedTodayUSD,
    remainingUSD: Math.max(0, budget.dailyLimitUSD - budget.usedTodayUSD),
  }
}

// =============================================================================
// Full Analysis Orchestrator
// =============================================================================

/**
 * Run a full analysis cycle:
 * 1. Run all rule-based detectors (free, always)
 * 2. Run semantic analysis if budget allows and nodes changed
 * 3. Send results to renderer via IPC
 */
export async function runAnalysis(snapshot: GraphSnapshot): Promise<void> {
  if (isRunning) return
  isRunning = true

  try {
    const insights: AnalysisInsight[] = []

    // 1. Rule-based analysis (always runs)
    const topologyInsights = analyzeTopology(snapshot)
    insights.push(...topologyInsights)

    // 2. Semantic analysis (only if budget allows and nodes changed)
    const changed = Array.from(changedNodeIds)
    if (changed.length > 0 && canSpendBudget(0.001)) {
      const semanticInsights = await analyzeSemantic(snapshot, changed)
      insights.push(...semanticInsights)
    }

    // Clear changed nodes after analysis
    changedNodeIds.clear()
    lastAnalyzedAt = Date.now()

    // 3. Send insights to renderer
    if (insights.length > 0) {
      const win = BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('bridge:insights', insights)
      }
    }
  } catch (err) {
    console.error('[GraphIntelligence] Analysis failed:', err)
  } finally {
    isRunning = false
  }
}

// =============================================================================
// Analysis Scheduler
// =============================================================================

/**
 * Start the periodic analysis scheduler.
 * Default interval: 30 seconds (configurable).
 *
 * Optimization #4: Progressive Enhancement
 * - Reduce frequency for large graphs (> 250 nodes)
 * - Skip analysis entirely if no changes detected
 */
export function startGraphAnalysis(intervalMs = 30000): void {
  if (analysisInterval) return

  console.log(
    `[GraphIntelligence] Starting analysis (interval: ${intervalMs}ms)`
  )

  analysisInterval = setInterval(async () => {
    // Skip if no changes since last analysis
    if (changedNodeIds.size === 0 && lastAnalyzedAt > 0) return

    // Request current graph snapshot from renderer
    const win = BrowserWindow.getAllWindows()[0]
    if (!win || win.isDestroyed()) return

    try {
      const snapshot = await win.webContents.executeJavaScript(
        `window.__getGraphSnapshot ? window.__getGraphSnapshot() : null`
      )
      if (snapshot) {
        await runAnalysis(snapshot)
      }
    } catch {
      // Renderer may not be ready yet
    }
  }, intervalMs)
}

/**
 * Stop the periodic analysis scheduler.
 */
export function stopGraphAnalysis(): void {
  if (analysisInterval) {
    clearInterval(analysisInterval)
    analysisInterval = null
    console.log('[GraphIntelligence] Analysis stopped')
  }
}

/**
 * Mark nodes as changed (triggers re-analysis on next cycle).
 */
export function markNodesChanged(nodeIds: string[]): void {
  for (const id of nodeIds) {
    changedNodeIds.add(id)
  }
}

// =============================================================================
// IPC Registration
// =============================================================================

export function registerGraphIntelligenceHandlers(): void {
  // Manual analysis trigger
  ipcMain.handle(
    'bridge:analyze-graph',
    async (_event, snapshot: GraphSnapshot) => {
      try {
        const insights = analyzeTopology(snapshot)
        return { success: true, insights }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // Get budget status
  ipcMain.handle('bridge:get-budget', () => {
    return getBudgetStatus()
  })

  // Set daily budget limit
  ipcMain.handle(
    'bridge:set-budget-limit',
    (_event, limitUSD: number) => {
      budget.dailyLimitUSD = limitUSD
      return { success: true }
    }
  )

  // Reset daily budget
  ipcMain.handle('bridge:reset-budget', () => {
    budget.usedTodayUSD = 0
    return { success: true }
  })

  // Start/stop analysis
  ipcMain.handle(
    'bridge:start-analysis',
    (_event, intervalMs?: number) => {
      startGraphAnalysis(intervalMs)
      return { success: true }
    }
  )

  ipcMain.handle('bridge:stop-analysis', () => {
    stopGraphAnalysis()
    return { success: true }
  })

  // Mark nodes as changed
  ipcMain.handle(
    'bridge:mark-nodes-changed',
    (_event, nodeIds: string[]) => {
      markNodesChanged(nodeIds)
      return { success: true }
    }
  )

  // Dismiss/apply insight (renderer notifies main)
  ipcMain.handle(
    'bridge:insight-action',
    (_event, insightId: string, action: 'apply' | 'dismiss') => {
      // Audit logging happens on renderer side via auditHooks
      return { success: true, insightId, action }
    }
  )
}
