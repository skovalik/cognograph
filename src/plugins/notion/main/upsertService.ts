// UpsertService — Query-by-CognographNodeId + create-or-patch logic
// Spec: COGNOGRAPH-NOTION-NODE-SYNC-SPEC.md Section 5
// All Notion API calls go through NotionService.request()

import { notionService } from '../../../main/services/notionService'
import type { MappedNotionProperties } from './propertyMapper'
import { getPageIcon } from './propertyMapper'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UpsertResult {
  success: boolean
  pageId?: string
  lastEditedTime?: number  // Unix ms from Notion API response
  error?: string
  errorCode?: string       // Notion error code for translation (Section 9f)
  shouldSuspend?: boolean  // true on 401 — stop all sync
  is404?: boolean          // true when PATCH target was deleted
}

interface PageCreateOptions {
  parent: { database_id: string } | { page_id: string }
  properties: Record<string, unknown>
  icon?: { emoji: string }
  children?: unknown[]  // Notion block objects (for note/artifact content)
}

interface PageUpdateOptions {
  page_id: string
  properties: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// UpsertService
// -----------------------------------------------------------------------------

export class UpsertService {
  /**
   * Upsert a database row (task/project).
   * 1. Query the DB for existing page by Cognograph Node ID
   * 2. If found → PATCH
   * 3. If not found → CREATE
   */
  async upsertDatabaseRow(
    dbId: string,
    nodeId: string,
    mapped: MappedNotionProperties,
    nodeType: string,
    nodeData: { noteMode?: string; contentType?: string }
  ): Promise<UpsertResult> {
    // Step 1: Query for existing page
    const existingPageId = await this.findPageByNodeId(dbId, nodeId)

    if (existingPageId) {
      // Step 2: PATCH existing page
      return this.updatePage(existingPageId, mapped.properties)
    }

    // Step 3: CREATE new page
    const icon = getPageIcon(nodeType as 'note' | 'artifact', nodeData)
    return this.createPage({
      parent: { database_id: dbId },
      properties: mapped.properties,
      ...(icon && { icon })
    })
  }

  /**
   * Upsert a standalone page (note/artifact).
   * Notes/artifacts are pages, not database rows.
   * Parent can be a project page, workflow page, or the hub page.
   */
  async upsertPage(
    parentPageId: string,
    nodeId: string,
    pageProperties: Record<string, unknown>,
    nodeType: 'note' | 'artifact',
    nodeData: { noteMode?: string; contentType?: string },
    existingPageId?: string,
    contentBlocks?: unknown[]
  ): Promise<UpsertResult> {
    if (existingPageId) {
      // Update existing page properties (content blocks handled separately)
      return this.updatePage(existingPageId, pageProperties)
    }

    // Create new page under parent
    const icon = getPageIcon(nodeType, nodeData)
    return this.createPage({
      parent: { page_id: parentPageId },
      properties: pageProperties,
      ...(icon && { icon }),
      ...(contentBlocks && contentBlocks.length > 0 && {
        children: contentBlocks.slice(0, 100) // Notion limit: 100 blocks per create
      })
    })
  }

  /**
   * Replace all content blocks on an existing page.
   * 1. List existing blocks
   * 2. Delete each block
   * 3. Append new blocks (chunked at 100)
   *
   * Returns the final last_edited_time after all operations.
   * Section 6f: If crash between delete and append, snapshot has old contentHash
   * → next push re-sends full content.
   */
  async replacePageContent(
    pageId: string,
    newBlocks: unknown[]
  ): Promise<UpsertResult> {
    // Step 1: List existing child blocks
    const listResult = await this.listChildBlocks(pageId)
    if (!listResult.success) {
      return listResult
    }

    // Step 2: Delete each existing block (sequential, rate-limited)
    for (const blockId of listResult.blockIds!) {
      const deleteResult = await notionService.request(
        async (client) => client.blocks.delete({ block_id: blockId }),
        'deleteBlock'
      )
      if (!deleteResult.success) {
        return {
          success: false,
          error: deleteResult.error,
          errorCode: (deleteResult as any).code,
          shouldSuspend: deleteResult.shouldSuspend
        }
      }
    }

    // Step 3: Append new blocks in chunks of 100
    let lastEditedTime: number | undefined
    const chunks = chunkArray(newBlocks, 100)

    for (const chunk of chunks) {
      const appendResult = await notionService.request(
        async (client) => client.blocks.children.append({
          block_id: pageId,
          children: chunk as any
        }),
        'appendBlocks'
      )
      if (!appendResult.success) {
        return {
          success: false,
          error: appendResult.error,
          errorCode: (appendResult as any).code,
          shouldSuspend: appendResult.shouldSuspend
        }
      }
    }

    // Step 4: Retrieve page to get final last_edited_time (R5 QA note)
    const retrieveResult = await notionService.request(
      async (client) => client.pages.retrieve({ page_id: pageId }),
      'retrievePageAfterContentUpdate'
    )
    if (retrieveResult.success) {
      const page = retrieveResult.data as any
      lastEditedTime = new Date(page.last_edited_time).getTime()
    }

    return { success: true, pageId, lastEditedTime }
  }

  /**
   * Query a database for a page matching a Cognograph Node ID.
   * Returns the page ID if found, null otherwise.
   */
  async findPageByNodeId(dbId: string, nodeId: string): Promise<string | null> {
    const result = await notionService.request(
      async (client) => client.databases.query({
        database_id: dbId,
        filter: {
          property: 'Cognograph Node ID',
          rich_text: { equals: nodeId }
        }
      }),
      'queryByNodeId'
    )

    if (!result.success) return null

    const pages = (result.data as any).results
    if (!pages || pages.length === 0) return null

    if (pages.length > 1) {
      console.warn(
        `[UpsertService] Found ${pages.length} pages for nodeId=${nodeId} in DB ${dbId.slice(0, 8)}..., using first`
      )
    }

    return pages[0].id
  }

  /**
   * Retrieve a single page by its Notion page ID.
   * Used by PullService for polling.
   */
  async retrievePage(pageId: string): Promise<{
    success: boolean
    page?: any
    lastEditedTime?: number
    error?: string
    is404?: boolean
    shouldSuspend?: boolean
  }> {
    const result = await notionService.request(
      async (client) => client.pages.retrieve({ page_id: pageId }),
      'retrievePage'
    )

    if (!result.success) {
      const is404 = result.error?.includes('not found') || result.error?.includes('404')
      return {
        success: false,
        error: result.error,
        is404,
        shouldSuspend: result.shouldSuspend
      }
    }

    const page = result.data as any
    return {
      success: true,
      page,
      lastEditedTime: new Date(page.last_edited_time).getTime()
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async createPage(options: PageCreateOptions): Promise<UpsertResult> {
    const result = await notionService.request(
      async (client) => client.pages.create(options as any),
      'createPage'
    )

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        shouldSuspend: result.shouldSuspend
      }
    }

    const page = result.data as any
    return {
      success: true,
      pageId: page.id,
      lastEditedTime: new Date(page.last_edited_time).getTime()
    }
  }

  private async updatePage(pageId: string, properties: Record<string, unknown>): Promise<UpsertResult> {
    const result = await notionService.request(
      async (client) => client.pages.update({
        page_id: pageId,
        properties
      } as any),
      'updatePage'
    )

    if (!result.success) {
      const is404 = result.error?.includes('not found') || result.error?.includes('404')
      return {
        success: false,
        error: result.error,
        is404,
        shouldSuspend: result.shouldSuspend
      }
    }

    const page = result.data as any
    return {
      success: true,
      pageId: page.id,
      lastEditedTime: new Date(page.last_edited_time).getTime()
    }
  }

  private async listChildBlocks(pageId: string): Promise<{
    success: boolean
    blockIds?: string[]
    error?: string
    shouldSuspend?: boolean
  }> {
    const blockIds: string[] = []
    let cursor: string | undefined

    do {
      const result = await notionService.request(
        async (client) => client.blocks.children.list({
          block_id: pageId,
          ...(cursor && { start_cursor: cursor })
        }),
        'listChildBlocks'
      )

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          shouldSuspend: result.shouldSuspend
        }
      }

      const data = result.data as any
      for (const block of data.results) {
        blockIds.push(block.id)
      }

      cursor = data.has_more ? data.next_cursor : undefined
    } while (cursor)

    return { success: true, blockIds }
  }
}

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// Singleton
export const upsertService = new UpsertService()
