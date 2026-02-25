// NodeSyncEngine — Orchestrates push/pull for individual Cognograph nodes
// Spec: COGNOGRAPH-NOTION-NODE-SYNC-SPEC.md Section 5, 7, 10
//
// Contains: DiffCalc, snapshot storage, push flow, queue drain,
// duplication detection, schema initialization.
// All Notion API calls go through UpsertService → NotionService.

import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import type { PluginContext } from '../../types'
import { nodeToNotionProperties, notionToNodeFields, getTargetDbId, noteToNotionPageProperties, artifactToNotionPageProperties, getPageIcon, getFieldAuthority } from './propertyMapper'
import type { MappedCognographFields } from './propertyMapper'
import { upsertService } from './upsertService'
import { htmlToNotionBlocks, hashContent } from './contentConverter'
import { SyncLogger } from './syncLogger'
import { NodeSyncQueue } from './nodeSyncQueue'
import { pullService } from './pullService'
import { notionService } from '../../../main/services/notionService'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface NodeSyncSnapshot {
  nodeId: string
  notionPageId: string
  workspaceId: string
  syncedAt: number                 // Unix ms
  syncedFields: {
    title: string
    status?: string
    priority?: string
    description?: string
    contentHash?: string           // SHA-256 of HTML content
    dueDate?: number
  }
  notionLastEditedTime: number     // Unix ms
  lossyConversion: boolean
}

interface SyncConfig {
  tasksDbId?: string
  projectsDbId?: string
  hubPageId?: string
  nodeSyncEnabled: boolean
  syncNodeTypes: string[]
}

// Error codes for Section 9f translation
const ERROR_MESSAGES: Record<string, string> = {
  'validation_error': 'Sync failed: property mismatch. Check Notion DB schema.',
  'unauthorized': 'Notion token expired. Re-authenticate in Settings > Connectors.',
  'object_not_found': 'Notion page not found. Click to re-link or remove sync.',
  'rate_limited': 'Sync delayed: Notion rate limit. Will retry automatically.',
  'internal_server_error': 'Notion server error. Will retry automatically.',
  'service_unavailable': 'Notion is temporarily unavailable. Will retry automatically.',
}

// -----------------------------------------------------------------------------
// NodeSyncEngine
// -----------------------------------------------------------------------------

export class NodeSyncEngine {
  private ctx!: PluginContext
  private logger!: SyncLogger
  private queue!: NodeSyncQueue
  private snapshots = new Map<string, NodeSyncSnapshot>()  // nodeId → snapshot
  private snapshotsLoaded = false
  private currentWorkspaceId: string | null = null
  private syncInProgress = false
  private pendingSave: any | null = null
  private schemaValidated = new Map<string, boolean>()  // dbId → validated

  async init(ctx: PluginContext): Promise<void> {
    this.ctx = ctx
    this.logger = new SyncLogger(ctx.dataDir)
    this.queue = new NodeSyncQueue(ctx.dataDir)
    pullService.init(
      ctx,
      this.logger,
      () => this.snapshots,
      (nodeId, snapshot) => this.snapshots.set(nodeId, snapshot)
    )
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle workspace:loaded — load snapshots, reconcile state, drain queue.
   */
  async onWorkspaceLoaded(data: { filePath: string; canvasId: string }): Promise<void> {
    this.currentWorkspaceId = data.canvasId
    await this.loadSnapshots(data.canvasId)

    // Ensure schema is initialized (Section 10a)
    const config = this.getConfig()
    if (config.nodeSyncEnabled) {
      await this.ensureSchema(config)
    }

    // Check for snapshot recovery (Section 7d)
    const syncEnabledNodes = await this.getSyncEnabledNodes()
    if (syncEnabledNodes.length > 0 && this.snapshots.size === 0) {
      this.ctx.sendToRenderer('node:sync-snapshot-missing', {
        nodeCount: syncEnabledNodes.length
      })
    }

    // Reconcile status (Section 7e)
    await this.reconcileOnStartup(syncEnabledNodes)

    // Drain queue (trigger 1: workspace:loaded)
    await this.drainQueue(10)

    // Start PullService polling (Section 5c Pull lifecycle)
    if (config.nodeSyncEnabled) {
      pullService.start(data.canvasId)
    }
  }

  /**
   * Handle workspace:saved — push changed nodes to Notion.
   * Section 5c push flow with concurrency guard.
   */
  async onWorkspaceSaved(data: { filePath: string; canvasId: string; version: number }): Promise<void> {
    const config = this.getConfig()
    if (!config.nodeSyncEnabled) return

    // Concurrency guard (Section 5c step -1)
    if (this.syncInProgress) {
      this.pendingSave = data
      return
    }

    this.syncInProgress = true
    const startTime = Date.now()

    try {
      this.currentWorkspaceId = data.canvasId

      // Guard: load snapshots if not yet loaded
      if (!this.snapshotsLoaded) {
        await this.loadSnapshots(data.canvasId)
      }

      // Get sync-enabled nodes
      const syncNodes = await this.getSyncEnabledNodes()
      if (syncNodes.length === 0) {
        this.syncInProgress = false
        return
      }

      this.logger.syncStart(data.canvasId, syncNodes.length)

      // Check for workspace duplication (Section 5c step 1)
      const duplicated = this.detectDuplication(syncNodes, data.canvasId)
      if (duplicated.length > 0) {
        this.logger.duplication(data.canvasId, duplicated.length)
        this.ctx.sendToRenderer('node:sync-duplication-detected', {
          nodeIds: duplicated.map(n => n.id)
        })
        // Skip sync for duplicated nodes
        const duplicatedIds = new Set(duplicated.map(n => n.id))
        const cleanNodes = syncNodes.filter(n => !duplicatedIds.has(n.id))
        await this.pushNodes(cleanNodes, data.canvasId, config)
      } else {
        await this.pushNodes(syncNodes, data.canvasId, config)
      }

      // Flush snapshots after push batch (R5 QA: batch per-cycle)
      await this.flushSnapshots()

      // After push, drain queue (trigger 2: post-save)
      await this.drainQueue(10)

    } catch (err) {
      this.ctx.log.error('Sync error:', String(err))
    } finally {
      const duration = Date.now() - startTime
      this.syncInProgress = false

      // Check for pending save (collapse multiple saves into one)
      if (this.pendingSave) {
        const pending = this.pendingSave
        this.pendingSave = null
        // Use latest data, not the stale queued data
        await this.onWorkspaceSaved(pending)
      }
    }
  }

  /**
   * Handle app:quit — flush logger.
   */
  async onAppQuit(): Promise<void> {
    pullService.stop()
    await this.logger.destroy()
  }

  // ---------------------------------------------------------------------------
  // Push Flow (Section 5c step 3)
  // ---------------------------------------------------------------------------

  private async pushNodes(
    nodes: Array<{ id: string; type: string; data: any }>,
    workspaceId: string,
    config: SyncConfig
  ): Promise<void> {
    let pushed = 0, skipped = 0, failed = 0

    // Sequential processing (Section 5c: "Why sequential, not concurrent?")
    for (const node of nodes) {
      const nodeData = node.data as any

      // DiffCalc: compare against snapshot (Section 7c)
      const snapshot = this.snapshots.get(node.id)
      if (snapshot && !this.hasLocalChanges(node, snapshot)) {
        this.logger.pushSkip(workspaceId, node.id, 'no_changes')
        skipped++
        continue
      }

      // Check circuit breaker — if open, queue ALL remaining
      if (notionService.getCircuitBreakerState() === 'open') {
        const remaining = nodes.slice(nodes.indexOf(node))
        for (const r of remaining) {
          await this.queue.enqueue({
            nodeId: r.id,
            workspaceId,
            queuedAt: Date.now(),
            failureReason: 'circuit_breaker_open',
            retryCount: 0
          })
          this.logger.queueAdd(workspaceId, r.id, 'circuit_breaker_open')
        }
        failed += remaining.length
        break
      }

      const pushStart = Date.now()

      try {
        const result = await this.pushSingleNode(node, workspaceId, config)

        if (result.success) {
          // Update node properties with sync result
          const props = nodeData.properties || {}
          props.notion_pageId = result.pageId
          props.notion_syncStatus = 'synced'
          props.notion_sourceWorkspaceId = workspaceId
          if (result.parentPath) {
            props.notion_parentPath = result.parentPath
          }

          // Update snapshot
          await this.updateSnapshot(node, workspaceId, result.pageId!, result.lastEditedTime!, result.lossyConversion || false)

          this.logger.pushSuccess(workspaceId, node.id, result.pageId!, Date.now() - pushStart)
          pushed++
        } else {
          // Handle specific failures
          if (result.is404) {
            // Page deleted in Notion (Section 5c step 3i)
            const props = nodeData.properties || {}
            props.notion_pageId = undefined
            props.notion_syncStatus = 'error'
            this.ctx.sendToRenderer('node:notion-page-deleted', { nodeId: node.id })
            this.logger.pull404(workspaceId, node.id, snapshot?.notionPageId || 'unknown')
          } else if (result.shouldSuspend) {
            // 401 — stop all sync (Section 5c step 3j)
            const props = nodeData.properties || {}
            props.notion_syncStatus = 'error'
            this.logger.syncSuspended(workspaceId, result.error || 'unauthorized')
            failed += nodes.length - nodes.indexOf(node)
            break
          } else {
            // Queue for retry (Section 5c step 3h)
            const props = nodeData.properties || {}
            props.notion_syncStatus = 'error'
            await this.queue.enqueue({
              nodeId: node.id,
              workspaceId,
              queuedAt: Date.now(),
              failureReason: result.error || 'unknown',
              retryCount: 0
            })
            this.logger.pushFailed(workspaceId, node.id, result.error || 'unknown', true)
          }
          failed++
        }
      } catch (err) {
        const props = nodeData.properties || {}
        props.notion_syncStatus = 'error'
        await this.queue.enqueue({
          nodeId: node.id,
          workspaceId,
          queuedAt: Date.now(),
          failureReason: String(err),
          retryCount: 0
        })
        this.logger.pushFailed(workspaceId, node.id, String(err), true)
        failed++
      }
    }

    this.logger.syncComplete(workspaceId, pushed, skipped, failed, Date.now())
  }

  /**
   * Push a single node to Notion.
   * Routes to database upsert (task/project) or page upsert (note/artifact).
   */
  private async pushSingleNode(
    node: { id: string; type: string; data: any },
    workspaceId: string,
    config: SyncConfig
  ): Promise<{
    success: boolean
    pageId?: string
    lastEditedTime?: number
    parentPath?: string
    lossyConversion?: boolean
    error?: string
    is404?: boolean
    shouldSuspend?: boolean
  }> {
    const nodeData = node.data as any

    if (node.type === 'task' || node.type === 'project') {
      // Database row upsert (Section 4a/4b)
      const dbId = getTargetDbId(node.type, config)
      if (!dbId) {
        return { success: false, error: `No ${node.type} database configured` }
      }

      const mapped = nodeToNotionProperties(node.type, node.id, nodeData)
      if (!mapped) {
        return { success: false, error: `No property mapping for type ${node.type}` }
      }

      const result = await upsertService.upsertDatabaseRow(
        dbId, node.id, mapped, node.type, nodeData
      )

      return {
        success: result.success,
        pageId: result.pageId,
        lastEditedTime: result.lastEditedTime,
        error: result.error,
        is404: result.is404,
        shouldSuspend: result.shouldSuspend
      }

    } else if (node.type === 'note' || node.type === 'artifact') {
      // Page upsert (Section 4c/4d)
      const existingPageId = nodeData.properties?.notion_pageId
      const parentPageId = await this.resolveParentPage(node, config)

      if (!parentPageId) {
        return { success: false, error: 'No parent page resolved (no hub page configured)' }
      }

      // Build page properties
      const pageProps = node.type === 'note'
        ? noteToNotionPageProperties(node.id, nodeData)
        : artifactToNotionPageProperties(node.id, nodeData)

      // Convert content if present
      let contentBlocks: unknown[] | undefined
      let lossyConversion = false

      if (nodeData.content) {
        const conversion = htmlToNotionBlocks(nodeData.content)
        contentBlocks = conversion.blocks
        lossyConversion = conversion.lossyConversion
      }

      if (existingPageId) {
        // Update existing page properties
        const propResult = await upsertService.upsertPage(
          parentPageId, node.id, pageProps, node.type, nodeData, existingPageId
        )

        if (!propResult.success) {
          return propResult
        }

        // Replace content if changed
        if (contentBlocks && contentBlocks.length > 0) {
          const snapshot = this.snapshots.get(node.id)
          const currentHash = hashContent(nodeData.content || '')
          if (!snapshot || currentHash !== snapshot.syncedFields.contentHash) {
            const contentResult = await upsertService.replacePageContent(
              existingPageId, contentBlocks
            )
            if (!contentResult.success) {
              return contentResult
            }
            // Use the last_edited_time from content update (more recent)
            return {
              success: true,
              pageId: existingPageId,
              lastEditedTime: contentResult.lastEditedTime,
              lossyConversion
            }
          }
        }

        return {
          success: true,
          pageId: existingPageId,
          lastEditedTime: propResult.lastEditedTime,
          lossyConversion
        }
      } else {
        // Create new page (content blocks included in create call)
        const result = await upsertService.upsertPage(
          parentPageId, node.id, pageProps, node.type, nodeData, undefined, contentBlocks
        )

        return {
          success: result.success,
          pageId: result.pageId,
          lastEditedTime: result.lastEditedTime,
          parentPath: `Notion > ${parentPageId.slice(0, 8)}...`,
          lossyConversion,
          error: result.error,
          shouldSuspend: result.shouldSuspend
        }
      }
    }

    return { success: false, error: `Unsupported node type for sync: ${node.type}` }
  }

  // ---------------------------------------------------------------------------
  // DiffCalc (Section 7c)
  // ---------------------------------------------------------------------------

  private hasLocalChanges(
    node: { id: string; type: string; data: any },
    snapshot: NodeSyncSnapshot
  ): boolean {
    const data = node.data as any
    const s = snapshot.syncedFields

    if ((data.title || '') !== (s.title || '')) return true
    if (data.status !== s.status) return true
    if (data.priority !== s.priority) return true
    if ((data.description || '') !== (s.description || '')) return true
    if (data.dueDate !== s.dueDate) return true

    // Content hash check for notes/artifacts
    if (data.content !== undefined) {
      const currentHash = hashContent(data.content || '')
      if (currentHash !== s.contentHash) return true
    }

    return false
  }

  // ---------------------------------------------------------------------------
  // Snapshot Storage (Section 7b)
  // ---------------------------------------------------------------------------

  private getSnapshotPath(workspaceId: string): string {
    return join(this.ctx.dataDir, 'snapshots', `${workspaceId}.json`)
  }

  private async loadSnapshots(workspaceId: string): Promise<void> {
    this.snapshots.clear()
    const filePath = this.getSnapshotPath(workspaceId)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(content) as NodeSyncSnapshot[]
      for (const snap of parsed) {
        this.snapshots.set(snap.nodeId, snap)
      }
      this.snapshotsLoaded = true
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // No snapshot file — first sync or after migration
        this.snapshotsLoaded = true
        return
      }
      if (err instanceof SyntaxError) {
        this.ctx.log.warn('Snapshot file corrupted, starting fresh')
        this.snapshotsLoaded = true
        return
      }
      this.ctx.log.error('Failed to load snapshots:', String(err))
      this.snapshotsLoaded = true
    }
  }

  private async saveSnapshots(workspaceId: string): Promise<void> {
    const filePath = this.getSnapshotPath(workspaceId)
    const dir = join(this.ctx.dataDir, 'snapshots')

    try {
      await fs.mkdir(dir, { recursive: true })
      const data = JSON.stringify(Array.from(this.snapshots.values()), null, 2)
      const tmpPath = `${filePath}.tmp`
      await fs.writeFile(tmpPath, data, 'utf-8')
      await fs.rename(tmpPath, filePath)
    } catch (err) {
      this.ctx.log.error('Failed to save snapshots:', String(err))
    }
  }

  private async updateSnapshot(
    node: { id: string; type: string; data: any },
    workspaceId: string,
    notionPageId: string,
    lastEditedTime: number,
    lossyConversion: boolean
  ): Promise<void> {
    const data = node.data as any

    const snapshot: NodeSyncSnapshot = {
      nodeId: node.id,
      notionPageId,
      workspaceId,
      syncedAt: Date.now(),
      syncedFields: {
        title: data.title || '',
        status: data.status,
        priority: data.priority,
        description: data.description,
        contentHash: data.content ? hashContent(data.content) : undefined,
        dueDate: data.dueDate
      },
      notionLastEditedTime: lastEditedTime,
      lossyConversion
    }

    this.snapshots.set(node.id, snapshot)
    // Batch save: accumulate and write once after push batch completes
    // (R5 QA note: batch per-cycle)
  }

  /**
   * Flush all accumulated snapshot changes to disk.
   * Called once after each push batch completes.
   */
  async flushSnapshots(): Promise<void> {
    if (this.currentWorkspaceId) {
      await this.saveSnapshots(this.currentWorkspaceId)
    }
  }

  // ---------------------------------------------------------------------------
  // Queue Drain (Section 5c)
  // ---------------------------------------------------------------------------

  private async drainQueue(limit: number): Promise<void> {
    if (!this.currentWorkspaceId) return

    const config = this.getConfig()
    if (!config.nodeSyncEnabled) return

    // Don't drain if circuit breaker is open
    if (notionService.getCircuitBreakerState() === 'open') return

    const entries = await this.queue.getEntriesForWorkspace(this.currentWorkspaceId)
    const toDrain = entries.slice(0, limit)

    for (const entry of toDrain) {
      // Re-read current node state from workspace cache
      const node = await this.ctx.workspace.getNodeById(entry.nodeId)
      if (!node) {
        // Node no longer exists — discard
        await this.queue.deleteEntry(entry)
        continue
      }

      const nodeData = node.data as any
      if (!nodeData.properties?.notion_syncEnabled) {
        // Sync disabled since queuing — discard
        await this.queue.deleteEntry(entry)
        continue
      }

      // Attempt sync
      const result = await this.pushSingleNode(
        node, entry.workspaceId, config
      )

      if (result.success) {
        await this.queue.deleteEntry(entry)
        this.logger.queueDrain(entry.workspaceId, entry.nodeId, true)
      } else {
        const { dropped } = await this.queue.incrementRetry(entry)
        if (dropped) {
          this.logger.queueDrop(
            entry.workspaceId, entry.nodeId,
            entry.retryCount + 1, 'max retries exceeded'
          )
        } else {
          this.logger.queueDrain(entry.workspaceId, entry.nodeId, false)
        }
      }
    }

    // Flush snapshots after drain
    await this.flushSnapshots()
  }

  // ---------------------------------------------------------------------------
  // Duplication Detection (Section 5c step 1)
  // ---------------------------------------------------------------------------

  private detectDuplication(
    nodes: Array<{ id: string; data: any }>,
    currentWorkspaceId: string
  ): Array<{ id: string; data: any }> {
    return nodes.filter(node => {
      const props = node.data?.properties
      if (!props?.notion_pageId) return false
      if (!props.notion_sourceWorkspaceId) return false
      return props.notion_sourceWorkspaceId !== currentWorkspaceId
    })
  }

  // ---------------------------------------------------------------------------
  // Schema Initialization (Section 10a)
  // ---------------------------------------------------------------------------

  private async ensureSchema(config: SyncConfig): Promise<void> {
    const dbs = [
      { id: config.tasksDbId, name: 'Tasks' },
      { id: config.projectsDbId, name: 'Projects' }
    ]

    for (const db of dbs) {
      if (!db.id) continue
      if (this.schemaValidated.get(db.id)) continue

      try {
        const result = await notionService.request(
          async (client) => client.databases.retrieve({ database_id: db.id! }),
          'schemaCheck'
        )

        if (!result.success) {
          this.logger.schemaError(this.currentWorkspaceId || 'unknown', db.id, result.error)
          continue
        }

        const properties = (result.data as any).properties || {}
        const existingProp = properties['Cognograph Node ID']

        if (!existingProp) {
          // Add the property
          const addResult = await notionService.request(
            async (client) => client.databases.update({
              database_id: db.id!,
              properties: {
                'Cognograph Node ID': { rich_text: {} }
              }
            }),
            'schemaInit'
          )

          if (addResult.success) {
            this.logger.schemaInit(this.currentWorkspaceId || 'unknown', db.id, 'Cognograph Node ID')
          } else {
            this.logger.schemaError(this.currentWorkspaceId || 'unknown', db.id, addResult.error)
          }
        } else if (existingProp.type !== 'rich_text') {
          // Wrong type — warn but don't overwrite
          this.ctx.log.warn(
            `"Cognograph Node ID" in ${db.name} DB is type "${existingProp.type}", expected "rich_text". Please rename or delete it.`
          )
          this.ctx.sendToRenderer('node:sync-schema-warning', {
            dbName: db.name,
            propertyType: existingProp.type
          })
        }

        this.schemaValidated.set(db.id, true)
      } catch (err) {
        this.ctx.log.error(`Schema check failed for ${db.name}:`, String(err))
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Reconciliation (Section 7e)
  // ---------------------------------------------------------------------------

  private async reconcileOnStartup(
    nodes: Array<{ id: string; data: any }>
  ): Promise<void> {
    for (const node of nodes) {
      const snapshot = this.snapshots.get(node.id)
      if (!snapshot) continue

      const data = node.data as any
      const currentStatus = data.properties?.notion_syncStatus

      if (currentStatus === 'dirty' || currentStatus === 'error') {
        // Check if data actually matches snapshot
        if (!this.hasLocalChanges(node, snapshot)) {
          // Data matches — crash happened after sync but before workspace save
          data.properties = data.properties || {}
          data.properties.notion_syncStatus = 'synced'
        }
        // If data differs, leave as dirty — will push on next save
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Parent Resolution (Section 4c)
  // ---------------------------------------------------------------------------

  private async resolveParentPage(
    node: { id: string; type: string; data: any },
    config: SyncConfig
  ): Promise<string | undefined> {
    // 1. Check if node has edge to a project with notion_pageId
    try {
      const edges = await this.ctx.workspace.getEdges(node.id)
      for (const edge of edges) {
        const targetId = edge.source === node.id ? edge.target : edge.source
        const targetNode = await this.ctx.workspace.getNodeById(targetId)
        if (targetNode && targetNode.type === 'project') {
          const targetData = targetNode.data as any
          if (targetData.properties?.notion_pageId) {
            return targetData.properties.notion_pageId
          }
        }
      }
    } catch {
      // Edge/node lookup failed — fall through
    }

    // 2. Fall back to hub page
    return config.hubPageId
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getConfig(): SyncConfig {
    return {
      tasksDbId: this.ctx.settings.get<string>('tasksDbId'),
      projectsDbId: this.ctx.settings.get<string>('projectsDbId'),
      hubPageId: this.ctx.settings.get<string>('hubPageId'),
      nodeSyncEnabled: this.ctx.settings.get<boolean>('nodeSyncEnabled') ?? false,
      syncNodeTypes: this.ctx.settings.get<string[]>('syncNodeTypes') ?? ['task', 'project', 'note', 'artifact']
    }
  }

  private async getSyncEnabledNodes(): Promise<Array<{ id: string; type: string; data: any }>> {
    const allNodes = await this.ctx.workspace.getNodes()
    return allNodes.filter(node => {
      const data = node.data as any
      return data.properties?.notion_syncEnabled === true
    })
  }

  /**
   * Translate Notion error codes to user-facing messages (Section 9f).
   */
  translateError(errorCode: string): string {
    return ERROR_MESSAGES[errorCode] || `Sync error: ${errorCode}`
  }
}

// Singleton
export const nodeSyncEngine = new NodeSyncEngine()
