// Tool call handlers - Phase 14
// Implements each MCP tool using the FileSyncProvider directly

import type { MCPSyncProvider, WorkspaceNode } from './provider'
import { formatTokens, type TokenFormat } from './formatters/tokenFormatter'
import type { DesignTokenSet, DesignToken } from '../../shared/types/common'

type ToolArgs = Record<string, unknown>

/**
 * Execute a tool call by name, delegating to the appropriate handler.
 */
export function handleToolCall(
  provider: MCPSyncProvider,
  toolName: string,
  args: ToolArgs
): unknown {
  switch (toolName) {
    case 'get_todos':
      return handleGetTodos(provider, args)
    case 'get_node':
      return handleGetNode(provider, args)
    case 'search_nodes':
      return handleSearchNodes(provider, args)
    case 'get_context_chain':
      return handleGetContextChain(provider, args)
    case 'update_node':
      return handleUpdateNode(provider, args)
    case 'create_node':
      return handleCreateNode(provider, args)
    case 'add_comment':
      return handleAddComment(provider, args)
    case 'link_nodes':
      return handleLinkNodes(provider, args)
    case 'unlink_nodes':
      return handleUnlinkNodes(provider, args)
    case 'cognograph_tokens_get':
      return handleTokensGet(provider, args)
    case 'cognograph_site_get_pages':
      return handleSiteGetPages(provider, args)
    case 'cognograph_site_get_components':
      return handleSiteGetComponents(provider, args)
    case 'cognograph_site_get_sitemap':
      return handleSiteUpdatePageStatus(provider, args)
    case 'cognograph_web_get_content_models':
      return handleWebGetContentModels(provider, args)
    case 'cognograph_web_get_wp_config':
      return handleWebGetWPConfig(provider)
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

// --- Tool Handlers ---

function handleGetTodos(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const status = args.status as string | undefined
  const priority = args.priority as string | undefined
  const tags = args.tags as string[] | undefined
  const projectId = args.projectId as string | undefined
  const limit = (args.limit as number) || 50

  let tasks = provider.getNodes().filter((n) => n.data.type === 'task')

  if (status) {
    tasks = tasks.filter((n) => n.data.status === status)
  }
  if (priority) {
    tasks = tasks.filter((n) => n.data.priority === priority)
  }
  if (tags && tags.length > 0) {
    tasks = tasks.filter((n) => {
      const nodeTags = n.data.tags as string[] | undefined
      if (!nodeTags) return false
      return tags.some((t) => nodeTags.includes(t))
    })
  }
  if (projectId) {
    tasks = tasks.filter((n) => n.data.parentId === projectId)
  }

  tasks = tasks.slice(0, limit)

  return {
    count: tasks.length,
    todos: tasks.map(formatNodeForOutput)
  }
}

function handleGetNode(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const id = args.id as string
  if (!id) throw new Error("'id' is required")

  const node = provider.getNode(id)
  if (!node) throw new Error(`Node not found: ${id}`)

  return formatNodeFull(node)
}

function handleSearchNodes(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const query = (args.query as string || '').toLowerCase()
  if (!query) throw new Error("'query' is required")

  const types = args.types as string[] | undefined
  const limit = (args.limit as number) || 20

  let nodes = provider.getNodes()

  if (types && types.length > 0) {
    nodes = nodes.filter((n) => types.includes(n.data.type as string))
  }

  const results = nodes.filter((n) => {
    const title = ((n.data.title as string) ?? '').toLowerCase()
    const content = ((n.data.content as string) ?? '').toLowerCase()
    const description = ((n.data.description as string) ?? '').toLowerCase()
    return title.includes(query) || content.includes(query) || description.includes(query)
  })

  return {
    count: results.length,
    nodes: results.slice(0, limit).map(formatNodeForOutput)
  }
}

function handleGetContextChain(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const nodeId = args.nodeId as string
  if (!nodeId) throw new Error("'nodeId' is required")

  const node = provider.getNode(nodeId)
  if (!node) throw new Error(`Node not found: ${nodeId}`)

  const depth = (args.depth as number) || 2
  const chain = buildContextChain(provider, nodeId, depth)

  return {
    rootNode: formatNodeForOutput(node),
    contextNodes: chain.map((entry) => ({
      ...formatNodeForOutput(entry.node),
      depth: entry.depth,
      edgeLabel: entry.edgeLabel
    }))
  }
}

function handleUpdateNode(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const id = args.id as string
  if (!id) throw new Error("'id' is required")

  const changes = args.changes as Record<string, unknown>
  if (!changes || typeof changes !== 'object') {
    throw new Error("'changes' must be an object")
  }

  provider.updateNode(id, changes)

  const updated = provider.getNode(id)
  return {
    success: true,
    node: updated ? formatNodeForOutput(updated) : null
  }
}

function handleCreateNode(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const type = args.type as string
  if (!type) throw new Error("'type' is required")

  const data = (args.data as Record<string, unknown>) || {}
  const position = args.position as { x: number; y: number } | undefined
  const linkFrom = args.linkFrom as string | undefined
  const parentId = args.parentId as string | undefined

  // Add parentId to data if specified
  if (parentId) {
    data.parentId = parentId
  }

  const nodeId = provider.createNode(type, data, position)

  // Create edge if linkFrom specified
  if (linkFrom) {
    try {
      provider.createEdge(linkFrom, nodeId)
    } catch {
      // Non-fatal: node created but edge failed
    }
  }

  const node = provider.getNode(nodeId)
  return {
    success: true,
    node: node ? formatNodeForOutput(node) : { id: nodeId }
  }
}

function handleAddComment(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const id = args.id as string
  if (!id) throw new Error("'id' is required")

  const text = args.text as string
  if (!text) throw new Error("'text' is required")

  const node = provider.getNode(id)
  if (!node) throw new Error(`Node not found: ${id}`)

  const nodeType = node.data.type as string
  const timestamp = new Date().toISOString()
  const commentBlock = `\n\n---\n[${timestamp}] ${text}`

  if (nodeType === 'task') {
    const existing = (node.data.description as string) || ''
    provider.updateNode(id, { description: existing + commentBlock })
  } else if (nodeType === 'note' || nodeType === 'text') {
    const existing = (node.data.content as string) || ''
    provider.updateNode(id, { content: existing + commentBlock })
  } else {
    throw new Error(`Cannot add comment to node type '${nodeType}'. Supported: task, note, text`)
  }

  return { success: true, nodeId: id }
}

function handleLinkNodes(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const source = args.source as string
  const target = args.target as string
  if (!source || !target) throw new Error("'source' and 'target' are required")

  const edgeData: Record<string, unknown> = {}
  if (args.label) edgeData.label = args.label
  if (args.weight) edgeData.weight = Math.max(1, Math.min(10, args.weight as number))

  const edgeId = provider.createEdge(source, target, edgeData)

  return { success: true, edgeId }
}

function handleUnlinkNodes(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const source = args.source as string
  const target = args.target as string
  if (!source || !target) throw new Error("'source' and 'target' are required")

  const edges = provider.getEdges()
  const edge = edges.find(
    (e) =>
      (e.source === source && e.target === target) ||
      (e.source === target && e.target === source)
  )

  if (!edge) {
    throw new Error(`No edge found between ${source} and ${target}`)
  }

  provider.deleteEdge(edge.id)

  return { success: true, deletedEdgeId: edge.id }
}

function handleTokensGet(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const requestedNodeId = args.nodeId as string | undefined
  const filterTag = args.tag as string | undefined
  const format = (args.format as TokenFormat) || 'raw'

  // Validate format
  const validFormats: TokenFormat[] = ['raw', 'css', 'tailwind']
  if (!validFormats.includes(format)) {
    return { error: 'UNSUPPORTED_FORMAT', message: `Format "${format}" is not supported. Use raw, css, or tailwind.` }
  }

  // Discover token nodes
  const tokenNodes = discoverTokenNodes(provider, requestedNodeId, filterTag)

  if (tokenNodes.length === 0) {
    return { error: 'NO_TOKEN_NODES', message: 'No design token nodes found in workspace. Create a Note node with noteMode "design-tokens" and add token JSON to its content.' }
  }

  // Parse and merge token data from all discovered nodes
  const mergedTokens: Record<string, DesignToken & { sourceNodeId: string }> = {}
  let mergedName = ''
  let mergedDescription: string | undefined
  const errors: Array<{ nodeId: string; error: string; message: string }> = []

  for (const node of tokenNodes) {
    const content = (node.data.content as string) || ''
    const nodeId = node.id

    if (!content.trim()) {
      errors.push({ nodeId, error: 'EMPTY_CONTENT', message: 'Token node exists but has no content' })
      continue
    }

    let parsed: DesignTokenSet
    try {
      parsed = JSON.parse(content) as DesignTokenSet
    } catch {
      errors.push({ nodeId, error: 'PARSE_ERROR', message: 'Token node content is not valid JSON' })
      continue
    }

    if (typeof parsed !== 'object' || parsed === null) {
      errors.push({ nodeId, error: 'PARSE_ERROR', message: 'Token node content is not a JSON object' })
      continue
    }

    if (typeof parsed.name !== 'string') {
      errors.push({ nodeId, error: 'SCHEMA_MISMATCH', message: 'Token data missing required field: name' })
      continue
    }

    // Merge name (last wins)
    mergedName = parsed.name
    if (parsed.description) mergedDescription = parsed.description

    // Merge tokens (last-found node wins on collisions)
    if (parsed.tokens && typeof parsed.tokens === 'object') {
      for (const [tokenName, token] of Object.entries(parsed.tokens)) {
        mergedTokens[tokenName] = { ...token, sourceNodeId: nodeId }
      }
    }
  }

  // If all nodes had errors, return the errors
  if (Object.keys(mergedTokens).length === 0 && errors.length > 0) {
    return errors.length === 1 ? errors[0] : { errors }
  }

  // Build merged DesignTokenSet
  const mergedSet: DesignTokenSet & { tokensWithSource?: Record<string, DesignToken & { sourceNodeId: string }> } = {
    name: mergedName || 'Untitled Token Set',
    description: mergedDescription,
    tokens: {}
  }

  // Strip sourceNodeId for the clean tokens, keep for raw format
  for (const [name, token] of Object.entries(mergedTokens)) {
    const { sourceNodeId: _sid, ...cleanToken } = token
    mergedSet.tokens[name] = cleanToken
  }

  // For raw format, include sourceNodeId on each token
  if (format === 'raw') {
    const result: Record<string, unknown> = {
      name: mergedSet.name,
      description: mergedSet.description,
      tokens: mergedTokens, // includes sourceNodeId
      nodeCount: tokenNodes.length
    }
    if (errors.length > 0) result.warnings = errors
    return result
  }

  // Format conversion
  try {
    const formatted = formatTokens(mergedSet, format)
    const result: Record<string, unknown> = {
      format,
      output: formatted,
      nodeCount: tokenNodes.length
    }
    if (errors.length > 0) result.warnings = errors
    return result
  } catch (e) {
    return { error: 'FORMAT_ERROR', message: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Discover design token nodes in the workspace.
 * Search strategy (per spec):
 * 1. Primary: nodes with noteMode === 'design-tokens'
 * 2. Secondary: nodes tagged 'design-system', 'tokens', or 'ds'
 * 3. Tertiary: nodes with title containing relevant keywords
 */
function discoverTokenNodes(
  provider: MCPSyncProvider,
  specificNodeId?: string,
  filterTag?: string
): WorkspaceNode[] {
  // If a specific node ID is requested, only return that node
  if (specificNodeId) {
    const node = provider.getNode(specificNodeId)
    if (!node) return []
    return [node]
  }

  const allNodes = provider.getNodes()
  const TOKEN_TAGS = ['design-system', 'tokens', 'ds']
  const TOKEN_TITLE_PATTERNS = ['design system', 'design tokens', 'style guide']

  // Primary: noteMode === 'design-tokens'
  let results = allNodes.filter((n) => n.data.noteMode === 'design-tokens')

  // Secondary: tagged with token-related tags (only if primary found nothing)
  if (results.length === 0) {
    results = allNodes.filter((n) => {
      const tags = n.data.tags as string[] | undefined
      if (!tags) return false
      return tags.some((t) => TOKEN_TAGS.includes(t.toLowerCase()))
    })
  }

  // Tertiary: title-based discovery (only if nothing found yet)
  if (results.length === 0) {
    results = allNodes.filter((n) => {
      const title = ((n.data.title as string) ?? '').toLowerCase()
      return TOKEN_TITLE_PATTERNS.some((pattern) => title.includes(pattern))
    })
  }

  // Apply tag filter if specified
  if (filterTag && results.length > 0) {
    results = results.filter((n) => {
      const tags = n.data.tags as string[] | undefined
      return tags?.includes(filterTag) ?? false
    })
  }

  return results
}

// --- Site Architecture Handlers ---

const VALID_PAGE_STATUSES = ['planned', 'wireframed', 'designed', 'built', 'live'] as const

interface PageOutput {
  nodeId: string
  route: string
  title: string
  template?: string
  status: string
  contentSource?: string
  components?: ComponentOutput[]
}

interface ComponentOutput {
  name: string
  order: number
  library?: string
  status?: string
  props?: PropOutput[]
  artifactNodeId?: string | null
  warning?: string
}

interface PropOutput {
  name: string
  type: string
  required: boolean
  default?: string
  enumValues?: string[]
  description?: string
}

/**
 * Normalize a route: collapse consecutive slashes, ensure leading slash,
 * strip trailing slash (except root "/").
 */
function normalizeRoute(route: string): string {
  let normalized = route.replace(/\/+/g, '/')
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

function handleSiteGetPages(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const includeComponents = args.includeComponents !== false
  const includeProps = args.includeProps === true
  const statusFilter = args.status as string | undefined
  const limit = args.limit as number | undefined
  const offset = (args.offset as number) || 0

  // Find all page-mode note nodes
  let pageNodes = provider.getNodes().filter(
    (n) => n.data.type === 'note' && n.data.noteMode === 'page'
  )

  // Filter by status if specified and not 'all'
  if (statusFilter && statusFilter !== 'all') {
    pageNodes = pageNodes.filter((n) => {
      const page = n.data.page as Record<string, unknown> | undefined
      return page?.status === statusFilter
    })
  }

  // Sort by createdAt ascending for deterministic order
  pageNodes.sort((a, b) => {
    const aCreated = (a.data.createdAt as number) || 0
    const bCreated = (b.data.createdAt as number) || 0
    return aCreated - bCreated
  })

  // Apply pagination
  const slicedNodes = limit !== undefined
    ? pageNodes.slice(offset, offset + limit)
    : pageNodes.slice(offset)

  // Find component-mode nodes for cross-referencing
  const componentNodes = provider.getNodes().filter(
    (n) => n.data.type === 'note' && n.data.noteMode === 'component'
  )

  const pages: PageOutput[] = slicedNodes.map((node) => {
    const page = node.data.page as Record<string, unknown> | undefined
    const output: PageOutput = {
      nodeId: node.id,
      route: normalizeRoute((page?.route as string) || '/'),
      title: (page?.title as string) || (node.data.title as string) || 'Untitled',
      status: (page?.status as string) || 'planned',
    }

    if (page?.template) output.template = page.template as string
    if (page?.contentSource) output.contentSource = page.contentSource as string

    if (includeComponents) {
      const components = (page?.components as Array<Record<string, unknown>>) || []
      output.components = components
        .sort((a, b) => ((a.order as number) || 0) - ((b.order as number) || 0))
        .map((comp) => {
          const compOutput: ComponentOutput = {
            name: (comp.name as string) || 'Unknown',
            order: (comp.order as number) || 0,
          }

          // Look up the matching component-mode node for library/status info
          const matchingComp = componentNodes.find(
            (cn) => (cn.data.component as Record<string, unknown> | undefined)?.name === comp.name
          )
          if (matchingComp) {
            const compData = matchingComp.data.component as Record<string, unknown>
            if (compData.library) compOutput.library = compData.library as string
            if (compData.status) compOutput.status = compData.status as string
          }

          // Validate artifactNodeId if present
          if (comp.artifactNodeId) {
            const artifactNode = provider.getNode(comp.artifactNodeId as string)
            if (artifactNode) {
              compOutput.artifactNodeId = comp.artifactNodeId as string
            } else {
              compOutput.artifactNodeId = null
              compOutput.warning = 'Linked artifact node not found'
            }
          }

          if (includeProps && matchingComp) {
            const compData = matchingComp.data.component as Record<string, unknown>
            const props = (compData.props as Array<Record<string, unknown>>) || []
            compOutput.props = props.map((p) => {
              const propOut: PropOutput = {
                name: (p.name as string) || '',
                type: (p.type as string) || 'string',
                required: (p.required as boolean) || false,
              }
              if (p.default !== undefined) propOut.default = p.default as string
              if (p.enumValues) propOut.enumValues = p.enumValues as string[]
              if (p.description) propOut.description = p.description as string
              return propOut
            })
          }

          return compOutput
        })

      // Warn if component count is very large
      if (components.length > 50) {
        output.components.push({
          name: '__warning__',
          order: -1,
          warning: `Large component list (${components.length}). Consider splitting into sub-pages.`,
        })
      }
    }

    return output
  })

  // Build navigation array from page titles and routes
  const navigation = pages.map((p, i) => ({
    label: p.title,
    route: p.route,
    order: i + 1,
  }))

  return {
    pages,
    navigation,
    total: pageNodes.length,
  }
}

function handleSiteGetComponents(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const route = args.route as string | undefined
  const nodeId = args.nodeId as string | undefined

  if (!route && !nodeId) {
    throw new Error("Either 'route' or 'nodeId' must be specified")
  }

  // Find the page node
  const allNodes = provider.getNodes()
  let pageNode: WorkspaceNode | null = null

  if (nodeId) {
    const found = provider.getNode(nodeId)
    if (!found) {
      return { error: 'NOT_FOUND', message: `Node not found: ${nodeId}` }
    }
    if (found.data.type !== 'note' || found.data.noteMode !== 'page') {
      return { error: 'NOT_A_PAGE', message: `Node ${nodeId} is not a page node (noteMode is not page)` }
    }
    pageNode = found
  } else if (route) {
    const normalizedRoute = normalizeRoute(route)
    const pageNodes = allNodes
      .filter(
        (n) =>
          n.data.type === 'note' &&
          n.data.noteMode === 'page' &&
          normalizeRoute((n.data.page as Record<string, unknown> | undefined)?.route as string || '/') === normalizedRoute
      )
      .sort((a, b) => ((a.data.createdAt as number) || 0) - ((b.data.createdAt as number) || 0))

    if (pageNodes.length === 0) {
      return { error: 'NOT_FOUND', message: `No page found for route ${route}` }
    }

    pageNode = pageNodes[0] ?? null

    // Warn if duplicates
    if (pageNodes.length > 1 && pageNode) {
      const duplicateIds = pageNodes.map((n) => n.id)
      return {
        ...buildPageSpec(provider, pageNode, allNodes),
        warning: `Multiple pages found for route ${route}. Returning first match. Found nodeIds: [${duplicateIds.join(', ')}]`,
      }
    }
  }

  if (!pageNode) {
    return { error: 'NOT_FOUND', message: 'Page node not found' }
  }

  return buildPageSpec(provider, pageNode, allNodes)
}

/**
 * Build the full page specification with component details, props, and linked artifacts.
 * Uses a visited-set to prevent infinite loops on circular component references.
 */
function buildPageSpec(
  provider: MCPSyncProvider,
  pageNode: WorkspaceNode,
  allNodes: WorkspaceNode[]
): Record<string, unknown> {
  const page = pageNode.data.page as Record<string, unknown> | undefined
  const components = (page?.components as Array<Record<string, unknown>>) || []
  const seo = page?.seo as Record<string, unknown> | undefined

  // Find component-mode nodes
  const componentNodes = allNodes.filter(
    (n) => n.data.type === 'note' && n.data.noteMode === 'component'
  )

  const visited = new Set<string>()

  const resolvedComponents = components
    .sort((a, b) => ((a.order as number) || 0) - ((b.order as number) || 0))
    .map((comp) => {
      const compName = (comp.name as string) || 'Unknown'
      const result: Record<string, unknown> = {
        name: compName,
        order: (comp.order as number) || 0,
        props: comp.props || {},
      }

      // Look up the component-mode node
      const matchingComp = componentNodes.find(
        (cn) => (cn.data.component as Record<string, unknown> | undefined)?.name === compName
      )

      if (matchingComp) {
        const compData = matchingComp.data.component as Record<string, unknown>
        result.componentNodeId = matchingComp.id
        result.type = compData.type
        result.library = compData.library
        result.status = compData.status
        result.propDefinitions = compData.props || []
        result.slots = compData.slots || []
        result.responsive = compData.responsive

        // Check for circular reference
        if (visited.has(matchingComp.id)) {
          result.warning = 'Circular reference detected, not expanding further'
        } else {
          visited.add(matchingComp.id)
        }

        // Validate linked artifact
        if (compData.artifactNodeId) {
          const artifactNode = provider.getNode(compData.artifactNodeId as string)
          if (artifactNode) {
            result.artifactNodeId = compData.artifactNodeId
          } else {
            result.artifactNodeId = null
            result.artifactWarning = 'Linked artifact node not found'
          }
        }

        // Link to design tokens if referenced
        if (comp.designTokenNodeId) {
          result.designTokenNodeId = comp.designTokenNodeId
        }

        if (compData.figmaUrl) {
          result.figmaUrl = compData.figmaUrl
        }
      }

      return result
    })

  const output: Record<string, unknown> = {
    nodeId: pageNode.id,
    route: normalizeRoute((page?.route as string) || '/'),
    title: (page?.title as string) || (pageNode.data.title as string) || 'Untitled',
    template: page?.template,
    status: page?.status || 'planned',
    contentSource: page?.contentSource,
    cmsType: page?.cmsType,
    dynamicSegments: page?.dynamicSegments,
    components: resolvedComponents,
  }

  if (seo) {
    output.seo = seo
  }

  // Include notes content if available
  if (pageNode.data.content) {
    output.notes = pageNode.data.content
  }

  return output
}

function handleSiteUpdatePageStatus(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const nodeId = args.nodeId as string
  const status = args.status as string

  if (!nodeId) throw new Error("'nodeId' is required")
  if (!status) throw new Error("'status' is required")

  // Validate status
  if (!VALID_PAGE_STATUSES.includes(status as typeof VALID_PAGE_STATUSES[number])) {
    return {
      error: 'INVALID_STATUS',
      message: `Invalid status. Must be one of: ${VALID_PAGE_STATUSES.join(', ')}`,
    }
  }

  const node = provider.getNode(nodeId)
  if (!node) {
    return { error: 'NOT_FOUND', message: `Node not found: ${nodeId}` }
  }

  if (node.data.type !== 'note' || node.data.noteMode !== 'page') {
    return {
      error: 'NOT_A_PAGE',
      message: `Node ${nodeId} is not a page node (noteMode is not page)`,
    }
  }

  // Update the page status
  const currentPage = (node.data.page as Record<string, unknown>) || {}
  const updatedPage = { ...currentPage, status }

  // We need to update the node data directly since the validation layer
  // now allows 'page' as a field for note nodes
  provider.updateNode(nodeId, { page: updatedPage })

  return {
    success: true,
    nodeId,
    previousStatus: currentPage.status || 'planned',
    newStatus: status,
  }
}

// --- Web Project Handlers ---

function handleWebGetContentModels(provider: MCPSyncProvider, args: ToolArgs): unknown {
  const postTypeFilter = args.postType as string | undefined

  // Find all content-model note nodes
  let contentModelNodes = provider.getNodes().filter(
    (n) => n.data.type === 'note' && n.data.noteMode === 'content-model',
  )

  // Filter by postType if specified
  if (postTypeFilter) {
    contentModelNodes = contentModelNodes.filter((n) => {
      const cm = n.data.contentModel as Record<string, unknown> | undefined
      return cm?.postType === postTypeFilter
    })
  }

  // Sort by createdAt ascending for deterministic order
  contentModelNodes.sort((a, b) => {
    const aCreated = (a.data.createdAt as number) || 0
    const bCreated = (b.data.createdAt as number) || 0
    return aCreated - bCreated
  })

  const models = contentModelNodes.map((node) => {
    const cm = node.data.contentModel as Record<string, unknown> | undefined
    return {
      nodeId: node.id,
      title: (node.data.title as string) || 'Untitled',
      postType: cm?.postType || 'unknown',
      singularLabel: cm?.singularLabel || '',
      pluralLabel: cm?.pluralLabel || '',
      slug: cm?.slug || '',
      supports: cm?.supports || [],
      fieldGroups: cm?.fieldGroups || [],
      taxonomies: cm?.taxonomies || [],
      graphqlSingleName: cm?.graphqlSingleName,
      graphqlPluralName: cm?.graphqlPluralName,
    }
  })

  return {
    count: models.length,
    contentModels: models,
  }
}

function handleWebGetWPConfig(provider: MCPSyncProvider): unknown {
  // Find wp-config note nodes
  const wpConfigNodes = provider.getNodes()
    .filter((n) => n.data.type === 'note' && n.data.noteMode === 'wp-config')
    .sort((a, b) => {
      const aCreated = (a.data.createdAt as number) || 0
      const bCreated = (b.data.createdAt as number) || 0
      return aCreated - bCreated
    })

  if (wpConfigNodes.length === 0) {
    return {
      error: 'NO_WP_CONFIG',
      message: 'No wp-config node found in workspace. Create a Note node with noteMode "wp-config".',
    }
  }

  const node = wpConfigNodes[0]!
  const wpc = node.data.wpConfig as Record<string, unknown> | undefined

  const result: Record<string, unknown> = {
    nodeId: node.id,
    siteUrl: wpc?.siteUrl || '',
    graphqlEndpoint: wpc?.graphqlEndpoint || '/graphql',
    restEndpoint: wpc?.restEndpoint || '/wp-json/wp/v2',
    authMethod: wpc?.authMethod || 'application-password',
    // IMPORTANT: Return credentialKey as-is (the key name, NOT the credential value)
    credentialKey: wpc?.credentialKey || '',
    frontendUrl: wpc?.frontendUrl,
    deployHookUrl: wpc?.deployHookUrl,
    environment: wpc?.environment || 'development',
  }

  if (wpConfigNodes.length > 1) {
    result.warning = `Multiple wp-config nodes found (${wpConfigNodes.length}). Using oldest.`
  }

  return result
}

// --- Helpers ---

interface ContextChainEntry {
  node: WorkspaceNode
  depth: number
  edgeLabel?: string
}

function buildContextChain(
  provider: MCPSyncProvider,
  startNodeId: string,
  maxDepth: number
): ContextChainEntry[] {
  const result: ContextChainEntry[] = []
  const visited = new Set<string>([startNodeId])
  const edges = provider.getEdges()

  // BFS traversal of incoming edges
  let frontier: Array<{ nodeId: string; depth: number }> = [{ nodeId: startNodeId, depth: 0 }]

  while (frontier.length > 0) {
    const nextFrontier: Array<{ nodeId: string; depth: number }> = []

    for (const { nodeId, depth } of frontier) {
      if (depth >= maxDepth) continue

      // Find incoming edges (edges where target === current node)
      const incoming = edges.filter((e) => e.target === nodeId)

      for (const edge of incoming) {
        if (visited.has(edge.source)) continue
        visited.add(edge.source)

        const sourceNode = provider.getNode(edge.source)
        if (!sourceNode) continue

        // Check if edge is active
        if (edge.data && edge.data.active === false) continue

        result.push({
          node: sourceNode,
          depth: depth + 1,
          edgeLabel: edge.data?.label as string | undefined
        })

        nextFrontier.push({ nodeId: edge.source, depth: depth + 1 })
      }

      // For bidirectional edges, also check where source === current node
      const outgoingBidi = edges.filter(
        (e) => e.source === nodeId && e.data?.direction === 'bidirectional'
      )
      for (const edge of outgoingBidi) {
        if (visited.has(edge.target)) continue
        visited.add(edge.target)

        const targetNode = provider.getNode(edge.target)
        if (!targetNode) continue
        if (edge.data && edge.data.active === false) continue

        result.push({
          node: targetNode,
          depth: depth + 1,
          edgeLabel: edge.data?.label as string | undefined
        })

        nextFrontier.push({ nodeId: edge.target, depth: depth + 1 })
      }
    }

    frontier = nextFrontier
  }

  return result
}

function formatNodeForOutput(node: WorkspaceNode): Record<string, unknown> {
  const data = node.data
  const output: Record<string, unknown> = {
    id: node.id,
    type: data.type,
    title: data.title || undefined,
    position: node.position
  }

  // Type-specific fields
  switch (data.type) {
    case 'task':
      output.status = data.status
      output.priority = data.priority
      if (data.complexity) output.complexity = data.complexity
      if (data.description) {
        output.description = truncate(data.description as string, 200)
      }
      break
    case 'note':
      if (data.noteMode) output.noteMode = data.noteMode
      if (data.content) {
        output.contentPreview = truncate(data.content as string, 200)
      }
      break
    case 'conversation':
      output.messageCount = Array.isArray(data.messages) ? data.messages.length : 0
      break
    case 'text':
      if (data.content) {
        output.contentPreview = truncate(data.content as string, 200)
      }
      break
    case 'project':
      if (data.description) {
        output.description = truncate(data.description as string, 200)
      }
      break
    case 'artifact':
      output.contentType = data.contentType
      if (data.content) {
        output.contentPreview = truncate(data.content as string, 200)
      }
      break
    case 'orchestrator':
      output.strategy = data.strategy
      output.agentCount = Array.isArray(data.connectedAgents) ? data.connectedAgents.length : 0
      if (data.description) {
        output.description = truncate(data.description as string, 200)
      }
      break
  }

  if (data.tags && (data.tags as string[]).length > 0) {
    output.tags = data.tags
  }
  if (data.parentId) {
    output.parentId = data.parentId
  }

  return output
}

function formatNodeFull(node: WorkspaceNode): Record<string, unknown> {
  return {
    id: node.id,
    type: node.data.type,
    position: node.position,
    data: node.data
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}
