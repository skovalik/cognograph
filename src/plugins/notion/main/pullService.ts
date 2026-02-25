// PullService — Periodic poll of Notion for remote changes
// Spec: COGNOGRAPH-NOTION-NODE-SYNC-SPEC.md Section 5c (Pull), Section 8
//
// Lifecycle: START on workspace:loaded, STOP on workspace switch or app:quit.
// Polls pages.retrieve() for each synced node, detects Notion-side changes,
// auto-applies or auto-merges where possible, emits conflict events otherwise.
// Round-robin cursor for workspaces with >50 synced nodes.

import type { PluginContext } from '../../types'
import { notionService } from '../../../main/services/notionService'
import { notionToNodeFields, getFieldAuthority } from './propertyMapper'
import { notionBlocksToHtml, hashContent } from './contentConverter'
import { SyncLogger } from './syncLogger'
import type { NodeSyncSnapshot } from './nodeSyncEngine'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PullConfig {
  pullIntervalMs: number
  nodeSyncEnabled: boolean
}

interface PullResult {
  nodeId: string
  action: 'skip' | 'auto-apply' | 'auto-merge' | 'conflict' | '404' | 'error'
  fieldsUpdated?: string[]
  conflictFields?: string[]
  error?: string
}

// Field comparison result for conflict detection
interface FieldDiff {
  field: string
  localValue: unknown
  notionValue: unknown
  snapshotValue: unknown
  changedInNotion: boolean
  changedLocally: boolean
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_PULL_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes
const MIN_PULL_INTERVAL_MS = 60 * 1000           // 1 minute floor
const MAX_NODES_PER_CYCLE = 50                    // Cap API calls per cycle
const MAX_BACKOFF_MS = 60 * 60 * 1000            // 1 hour max backoff
const MAX_BLOCK_RECURSION_DEPTH = 3              // Cap nested block fetching

// -----------------------------------------------------------------------------
// PullService
// -----------------------------------------------------------------------------

export class PullService {
  private ctx!: PluginContext
  private logger!: SyncLogger
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private currentWorkspaceId: string | null = null
  private roundRobinCursor = 0
  private consecutiveFailures = 0
  private currentIntervalMs = DEFAULT_PULL_INTERVAL_MS

  // External dependencies injected by NodeSyncEngine
  private getSnapshots!: () => Map<string, NodeSyncSnapshot>
  private updateSnapshotFn!: (nodeId: string, snapshot: NodeSyncSnapshot) => void

  init(
    ctx: PluginContext,
    logger: SyncLogger,
    getSnapshots: () => Map<string, NodeSyncSnapshot>,
    updateSnapshot: (nodeId: string, snapshot: NodeSyncSnapshot) => void
  ): void {
    this.ctx = ctx
    this.logger = logger
    this.getSnapshots = getSnapshots
    this.updateSnapshotFn = updateSnapshot
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start polling for a workspace. Stops any existing timer first.
   */
  start(workspaceId: string): void {
    this.stop()
    this.currentWorkspaceId = workspaceId
    this.roundRobinCursor = 0
    this.consecutiveFailures = 0

    const config = this.getConfig()
    if (!config.nodeSyncEnabled) return

    this.currentIntervalMs = Math.max(MIN_PULL_INTERVAL_MS, config.pullIntervalMs)

    this.pollTimer = setInterval(() => {
      this.poll().catch(err =>
        this.ctx.log.error('Pull poll error:', String(err))
      )
    }, this.currentIntervalMs)
  }

  /**
   * Stop polling. Safe to call multiple times.
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.currentWorkspaceId = null
  }

  // ---------------------------------------------------------------------------
  // Poll Cycle (Section 5c Pull steps 1-5)
  // ---------------------------------------------------------------------------

  async poll(): Promise<PullResult[]> {
    if (!this.currentWorkspaceId) return []

    const config = this.getConfig()
    if (!config.nodeSyncEnabled) return []

    // Don't poll if circuit breaker is open
    if (notionService.getCircuitBreakerState() === 'open') return []

    const results: PullResult[] = []

    try {
      // Step 1: Collect nodes with notion_pageId
      const allNodes = await this.ctx.workspace.getNodes()
      const syncedNodes = allNodes.filter(node => {
        const data = node.data as any
        return data.properties?.notion_pageId && data.properties?.notion_syncEnabled
      })

      if (syncedNodes.length === 0) return []

      // Round-robin: take MAX_NODES_PER_CYCLE starting at cursor
      const batch = this.getBatch(syncedNodes)

      // Step 2-4: Process each node
      for (const node of batch) {
        const result = await this.pullSingleNode(node)
        results.push(result)

        // Stop on auth failure
        if (result.action === 'error' && result.error?.includes('unauthorized')) {
          break
        }
      }

      // Success: reset backoff
      this.consecutiveFailures = 0
      this.resetInterval()

    } catch (err) {
      // Cycle-level failure: backoff
      this.consecutiveFailures++
      this.applyBackoff()
      this.ctx.log.error('Pull cycle failed:', String(err))
    }

    return results
  }

  // ---------------------------------------------------------------------------
  // Single Node Pull (Steps 2-4)
  // ---------------------------------------------------------------------------

  private async pullSingleNode(
    node: { id: string; type: string; data: any }
  ): Promise<PullResult> {
    const nodeData = node.data as any
    const pageId = nodeData.properties?.notion_pageId
    const workspaceId = this.currentWorkspaceId!
    const snapshots = this.getSnapshots()
    const snapshot = snapshots.get(node.id)

    if (!pageId) {
      return { nodeId: node.id, action: 'skip' }
    }

    // Step 2: Retrieve page from Notion
    const pageResult = await notionService.request(
      async (client) => client.pages.retrieve({ page_id: pageId }),
      'pullRetrievePage'
    )

    if (!pageResult.success) {
      // Check for 404
      const is404 = pageResult.error?.includes('not found') || pageResult.error?.includes('404')
      if (is404) {
        // Page deleted in Notion
        nodeData.properties = nodeData.properties || {}
        nodeData.properties.notion_pageId = undefined
        nodeData.properties.notion_syncStatus = 'error'
        this.ctx.sendToRenderer('node:notion-page-deleted', { nodeId: node.id })
        this.logger.pull404(workspaceId, node.id, pageId)
        return { nodeId: node.id, action: '404' }
      }

      if (pageResult.shouldSuspend) {
        this.logger.syncSuspended(workspaceId, 'unauthorized')
        return { nodeId: node.id, action: 'error', error: 'unauthorized' }
      }

      this.logger.pullFailed(workspaceId, node.id, pageResult.error || 'unknown')
      return { nodeId: node.id, action: 'error', error: pageResult.error }
    }

    const page = pageResult.data as any
    const notionEditedMs = new Date(page.last_edited_time).getTime()

    // Step 4b: Check if Notion has changes (value comparison against snapshot)
    if (snapshot && notionEditedMs === snapshot.notionLastEditedTime) {
      this.logger.pullSkip(workspaceId, node.id, 'no_notion_changes')
      return { nodeId: node.id, action: 'skip' }
    }

    // Step 4a: Convert Notion properties to Cognograph fields
    const notionFields = notionToNodeFields(node.type, page)
    if (!notionFields) {
      this.logger.pullSkip(workspaceId, node.id, 'unsupported_type')
      return { nodeId: node.id, action: 'skip' }
    }

    // Step 3: For notes/artifacts, fetch content blocks if Notion changed
    let notionContentHash: string | undefined
    let notionHtml: string | undefined

    if ((node.type === 'note' || node.type === 'artifact') && snapshot) {
      // Only fetch blocks if page properties changed (optimization from spec)
      const blocksResult = await this.fetchAllBlocks(pageId)
      if (blocksResult.success && blocksResult.blocks.length > 0) {
        const conversion = notionBlocksToHtml(blocksResult.blocks)
        notionHtml = conversion.html
        notionContentHash = conversion.contentHash
      }
    }

    // Step 4c-4h: Diff and resolve
    return this.resolveChanges(
      node, notionFields, notionEditedMs,
      notionContentHash, notionHtml, snapshot
    )
  }

  // ---------------------------------------------------------------------------
  // Conflict Resolution (Section 8)
  // ---------------------------------------------------------------------------

  private resolveChanges(
    node: { id: string; type: string; data: any },
    notionFields: Record<string, unknown>,
    notionEditedMs: number,
    notionContentHash: string | undefined,
    notionHtml: string | undefined,
    snapshot: NodeSyncSnapshot | undefined
  ): PullResult {
    const nodeData = node.data as any
    const workspaceId = this.currentWorkspaceId!

    // If no snapshot, treat as first pull — auto-apply everything
    if (!snapshot) {
      this.applyNotionFields(node, notionFields, notionHtml)
      this.updateSnapshot(node, notionEditedMs, notionFields, notionContentHash)
      this.logger.pullSuccess(workspaceId, node.id, Object.keys(notionFields).join(','))
      return {
        nodeId: node.id,
        action: 'auto-apply',
        fieldsUpdated: Object.keys(notionFields)
      }
    }

    // Build field-level diff
    const diffs = this.buildFieldDiffs(node, notionFields, snapshot, notionContentHash)

    const notionChangedFields = diffs.filter(d => d.changedInNotion)
    const localChangedFields = diffs.filter(d => d.changedLocally)

    // Step 4e: No Notion changes
    if (notionChangedFields.length === 0) {
      // Update snapshot's notionLastEditedTime even if no field changes
      // (Notion may have changed something we don't track)
      const updatedSnapshot: NodeSyncSnapshot = {
        ...snapshot,
        notionLastEditedTime: notionEditedMs
      }
      this.updateSnapshotFn(node.id, updatedSnapshot)
      this.logger.pullSkip(workspaceId, node.id, 'no_field_changes')
      return { nodeId: node.id, action: 'skip' }
    }

    // Step 4f: Only Notion changed, no local changes → auto-apply
    if (localChangedFields.length === 0) {
      const fieldsToApply: Record<string, unknown> = {}
      for (const diff of notionChangedFields) {
        fieldsToApply[diff.field] = diff.notionValue
      }
      this.applyNotionFields(node, fieldsToApply, notionHtml)
      this.updateSnapshot(node, notionEditedMs, notionFields, notionContentHash)
      this.logger.pullSuccess(workspaceId, node.id, notionChangedFields.map(d => d.field).join(','))
      return {
        nodeId: node.id,
        action: 'auto-apply',
        fieldsUpdated: notionChangedFields.map(d => d.field)
      }
    }

    // Both sides changed — check for overlap
    const notionFieldNames = new Set(notionChangedFields.map(d => d.field))
    const localFieldNames = new Set(localChangedFields.map(d => d.field))
    const conflictFieldNames = [...notionFieldNames].filter(f => localFieldNames.has(f))

    // Step 4g: Both changed, different fields → auto-merge
    if (conflictFieldNames.length === 0) {
      // Apply Notion-authority fields, keep local-authority fields
      const fieldsToApply: Record<string, unknown> = {}
      for (const diff of notionChangedFields) {
        const authority = getFieldAuthority(diff.field)
        if (authority === 'notion' || authority === 'both') {
          fieldsToApply[diff.field] = diff.notionValue
        }
      }
      if (Object.keys(fieldsToApply).length > 0) {
        this.applyNotionFields(node, fieldsToApply, undefined)
      }

      // Update snapshot with both sides
      this.updateSnapshot(node, notionEditedMs, notionFields, notionContentHash)

      // Mark dirty so local changes push on next save
      nodeData.properties = nodeData.properties || {}
      nodeData.properties.notion_syncStatus = 'dirty'

      this.logger.pullSuccess(workspaceId, node.id,
        `auto-merge: notion=${notionChangedFields.map(d => d.field).join(',')}, local=${localChangedFields.map(d => d.field).join(',')}`
      )
      return {
        nodeId: node.id,
        action: 'auto-merge',
        fieldsUpdated: notionChangedFields.map(d => d.field)
      }
    }

    // Step 4h: Both changed, same fields → conflict
    // Title conflicts ALWAYS show modal (Section 8e)
    nodeData.properties = nodeData.properties || {}
    nodeData.properties.notion_syncStatus = 'conflict'

    this.ctx.sendToRenderer('node:notion-conflict', {
      nodeId: node.id,
      conflicts: conflictFieldNames.map(field => {
        const diff = diffs.find(d => d.field === field)!
        return {
          field,
          localValue: diff.localValue,
          notionValue: diff.notionValue
        }
      })
    })

    this.logger.pullConflict(workspaceId, node.id, conflictFieldNames.join(','))
    return {
      nodeId: node.id,
      action: 'conflict',
      conflictFields: conflictFieldNames
    }
  }

  // ---------------------------------------------------------------------------
  // Field Diff Builder
  // ---------------------------------------------------------------------------

  private buildFieldDiffs(
    node: { id: string; data: any },
    notionFields: Record<string, unknown>,
    snapshot: NodeSyncSnapshot,
    notionContentHash: string | undefined
  ): FieldDiff[] {
    const nodeData = node.data as any
    const s = snapshot.syncedFields
    const diffs: FieldDiff[] = []

    // Compare each tracked field
    const fieldPairs: Array<{
      field: string
      local: unknown
      notion: unknown
      snapshot: unknown
    }> = [
      { field: 'title', local: nodeData.title || '', notion: notionFields.title, snapshot: s.title },
      { field: 'status', local: nodeData.status, notion: notionFields.status, snapshot: s.status },
      { field: 'priority', local: nodeData.priority, notion: notionFields.priority, snapshot: s.priority },
      { field: 'description', local: nodeData.description || '', notion: notionFields.description, snapshot: s.description },
      { field: 'dueDate', local: nodeData.dueDate, notion: notionFields.dueDate, snapshot: s.dueDate }
    ]

    // Content hash comparison for notes/artifacts
    if (notionContentHash !== undefined) {
      const localContentHash = nodeData.content ? hashContent(nodeData.content) : undefined
      fieldPairs.push({
        field: 'content',
        local: localContentHash,
        notion: notionContentHash,
        snapshot: s.contentHash
      })
    }

    for (const { field, local, notion, snapshot: snap } of fieldPairs) {
      if (notion === undefined) continue  // Field not in Notion response

      diffs.push({
        field,
        localValue: local,
        notionValue: notion,
        snapshotValue: snap,
        changedInNotion: notion !== snap,
        changedLocally: local !== snap
      })
    }

    return diffs
  }

  // ---------------------------------------------------------------------------
  // Apply Notion Changes to Local Node
  // ---------------------------------------------------------------------------

  private applyNotionFields(
    node: { id: string; data: any },
    fields: Record<string, unknown>,
    contentHtml: string | undefined
  ): void {
    const nodeData = node.data as any

    for (const [field, value] of Object.entries(fields)) {
      if (field === 'content' && contentHtml !== undefined) {
        // Content is applied as HTML, not the hash
        nodeData.content = contentHtml
      } else {
        nodeData[field] = value
      }
    }

    // Emit update event so renderer reflects changes
    this.ctx.sendToRenderer('node:notion-updated', {
      nodeId: node.id,
      fields: Object.keys(fields)
    })
  }

  // ---------------------------------------------------------------------------
  // Update Snapshot After Pull
  // ---------------------------------------------------------------------------

  private updateSnapshot(
    node: { id: string; data: any },
    notionEditedMs: number,
    notionFields: Record<string, unknown>,
    notionContentHash: string | undefined
  ): void {
    const nodeData = node.data as any
    const snapshot: NodeSyncSnapshot = {
      nodeId: node.id,
      notionPageId: nodeData.properties?.notion_pageId || '',
      workspaceId: this.currentWorkspaceId!,
      syncedAt: Date.now(),
      syncedFields: {
        title: (notionFields.title as string) || nodeData.title || '',
        status: (notionFields.status as string) || nodeData.status,
        priority: (notionFields.priority as string) || nodeData.priority,
        description: (notionFields.description as string) || nodeData.description,
        contentHash: notionContentHash || (nodeData.content ? hashContent(nodeData.content) : undefined),
        dueDate: (notionFields.dueDate as number) || nodeData.dueDate
      },
      notionLastEditedTime: notionEditedMs,
      lossyConversion: false
    }

    this.updateSnapshotFn(node.id, snapshot)
  }

  // ---------------------------------------------------------------------------
  // Block Fetching (Section 5c Step 3)
  // ---------------------------------------------------------------------------

  /**
   * Fetch all child blocks of a page, with pagination and limited recursion.
   */
  private async fetchAllBlocks(
    pageId: string,
    depth = 0
  ): Promise<{ success: boolean; blocks: any[] }> {
    if (depth >= MAX_BLOCK_RECURSION_DEPTH) {
      return { success: true, blocks: [] }
    }

    const allBlocks: any[] = []
    let cursor: string | undefined

    do {
      const result = await notionService.request(
        async (client) => client.blocks.children.list({
          block_id: pageId,
          ...(cursor && { start_cursor: cursor })
        }),
        'pullListBlocks'
      )

      if (!result.success) {
        return { success: false, blocks: [] }
      }

      const data = result.data as any
      for (const block of data.results) {
        allBlocks.push(block)

        // Recurse into blocks with children (capped at MAX_BLOCK_RECURSION_DEPTH)
        if (block.has_children && depth + 1 < MAX_BLOCK_RECURSION_DEPTH) {
          const childResult = await this.fetchAllBlocks(block.id, depth + 1)
          if (childResult.success) {
            block._children = childResult.blocks
          }
        }
      }

      cursor = data.has_more ? data.next_cursor : undefined
    } while (cursor)

    return { success: true, blocks: allBlocks }
  }

  // ---------------------------------------------------------------------------
  // Round-Robin Batching
  // ---------------------------------------------------------------------------

  private getBatch(
    nodes: Array<{ id: string; type: string; data: any }>
  ): Array<{ id: string; type: string; data: any }> {
    if (nodes.length <= MAX_NODES_PER_CYCLE) {
      this.roundRobinCursor = 0
      return nodes
    }

    // Wrap cursor if it exceeds node count
    if (this.roundRobinCursor >= nodes.length) {
      this.roundRobinCursor = 0
    }

    const start = this.roundRobinCursor
    const end = Math.min(start + MAX_NODES_PER_CYCLE, nodes.length)
    const batch = nodes.slice(start, end)

    // If we didn't get a full batch (end of array), wrap to beginning
    if (batch.length < MAX_NODES_PER_CYCLE && start > 0) {
      const remaining = MAX_NODES_PER_CYCLE - batch.length
      batch.push(...nodes.slice(0, remaining))
      this.roundRobinCursor = remaining
    } else {
      this.roundRobinCursor = end
    }

    return batch
  }

  // ---------------------------------------------------------------------------
  // Backoff (Section 5c Pull backoff)
  // ---------------------------------------------------------------------------

  private applyBackoff(): void {
    // Double interval on each failure (5m → 10m → 20m → max 60m)
    this.currentIntervalMs = Math.min(
      this.currentIntervalMs * 2,
      MAX_BACKOFF_MS
    )

    // Restart timer with new interval
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = setInterval(() => {
        this.poll().catch(err =>
          this.ctx.log.error('Pull poll error:', String(err))
        )
      }, this.currentIntervalMs)
    }

    this.logger.backoff(
      this.currentWorkspaceId || 'unknown',
      this.currentIntervalMs,
      this.consecutiveFailures
    )

    // Emit offline state to renderer
    this.ctx.sendToRenderer('node:notion-offline', {
      intervalMs: this.currentIntervalMs,
      consecutiveFailures: this.consecutiveFailures
    })
  }

  private resetInterval(): void {
    const config = this.getConfig()
    const targetInterval = Math.max(MIN_PULL_INTERVAL_MS, config.pullIntervalMs)

    if (this.currentIntervalMs !== targetInterval && this.pollTimer) {
      this.currentIntervalMs = targetInterval
      clearInterval(this.pollTimer)
      this.pollTimer = setInterval(() => {
        this.poll().catch(err =>
          this.ctx.log.error('Pull poll error:', String(err))
        )
      }, this.currentIntervalMs)
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getConfig(): PullConfig {
    return {
      pullIntervalMs: this.ctx.settings.get<number>('pullIntervalMs') ?? DEFAULT_PULL_INTERVAL_MS,
      nodeSyncEnabled: this.ctx.settings.get<boolean>('nodeSyncEnabled') ?? false
    }
  }
}

// Singleton
export const pullService = new PullService()
