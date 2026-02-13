/**
 * Yjs ↔ Store conversion utilities.
 *
 * Handles converting between React Flow Node/Edge objects and Y.Map representations.
 * The Y.Doc structure:
 *   Y.Map('nodes')   → Y.Map<nodeId, Y.Map<field, value>>
 *   Y.Array('edges') → Y.Array<Y.Map<field, value>>
 *   Y.Map('meta')    → workspace settings (name, viewport, propertySchema, etc.)
 */

import * as Y from 'yjs'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData, EdgeData, WorkspaceData } from '@shared/types'

// -----------------------------------------------------------------------------
// Node Conversions
// -----------------------------------------------------------------------------

/**
 * Convert a React Flow Node to a Y.Map for storage in the Y.Doc.
 * Nested `data` and `position` objects are stored as nested Y.Maps for
 * granular conflict resolution.
 */
export function nodeToYMap(node: Node<NodeData>, doc: Y.Doc): Y.Map<unknown> {
  const yNode = new Y.Map<unknown>()

  yNode.set('id', node.id)
  yNode.set('type', node.type || 'default')

  // Position as nested Y.Map for independent x/y updates
  const yPosition = new Y.Map<number>()
  yPosition.set('x', node.position.x)
  yPosition.set('y', node.position.y)
  yNode.set('position', yPosition)

  // Measured dimensions (optional)
  if (node.measured) {
    const yMeasured = new Y.Map<number | undefined>()
    yMeasured.set('width', node.measured.width)
    yMeasured.set('height', node.measured.height)
    yNode.set('measured', yMeasured)
  }

  // Data as nested Y.Map for granular field updates
  if (node.data) {
    const yData = objectToYMap(node.data as Record<string, unknown>, doc)
    yNode.set('data', yData)
  }

  // Additional React Flow properties
  if (node.width !== undefined) yNode.set('width', node.width)
  if (node.height !== undefined) yNode.set('height', node.height)
  if (node.zIndex !== undefined) yNode.set('zIndex', node.zIndex)
  if (node.parentId !== undefined) yNode.set('parentId', node.parentId)
  if (node.draggable !== undefined) yNode.set('draggable', node.draggable)
  if (node.selectable !== undefined) yNode.set('selectable', node.selectable)

  return yNode
}

/**
 * Convert a Y.Map back to a React Flow Node.
 */
export function yMapToNode(yNode: Y.Map<unknown>): Node<NodeData> {
  const yPosition = yNode.get('position') as Y.Map<number>
  const yData = yNode.get('data') as Y.Map<unknown> | undefined
  const yMeasured = yNode.get('measured') as Y.Map<number | undefined> | undefined

  const node: Node<NodeData> = {
    id: yNode.get('id') as string,
    type: yNode.get('type') as string,
    position: {
      x: yPosition.get('x') || 0,
      y: yPosition.get('y') || 0
    },
    data: yData ? yMapToObject(yData) as NodeData : {} as NodeData
  }

  if (yMeasured) {
    node.measured = {
      width: yMeasured.get('width') as number | undefined,
      height: yMeasured.get('height') as number | undefined
    }
  }

  const width = yNode.get('width') as number | undefined
  const height = yNode.get('height') as number | undefined
  const zIndex = yNode.get('zIndex') as number | undefined
  const parentId = yNode.get('parentId') as string | undefined
  const draggable = yNode.get('draggable') as boolean | undefined
  const selectable = yNode.get('selectable') as boolean | undefined

  if (width !== undefined) node.width = width
  if (height !== undefined) node.height = height
  if (zIndex !== undefined) node.zIndex = zIndex
  if (parentId !== undefined) node.parentId = parentId
  if (draggable !== undefined) node.draggable = draggable
  if (selectable !== undefined) node.selectable = selectable

  return node
}

// -----------------------------------------------------------------------------
// Edge Conversions
// -----------------------------------------------------------------------------

/**
 * Convert a React Flow Edge to a Y.Map.
 */
export function edgeToYMap(edge: Edge<EdgeData>): Y.Map<unknown> {
  const yEdge = new Y.Map<unknown>()

  yEdge.set('id', edge.id)
  yEdge.set('source', edge.source)
  yEdge.set('target', edge.target)
  if (edge.sourceHandle) yEdge.set('sourceHandle', edge.sourceHandle)
  if (edge.targetHandle) yEdge.set('targetHandle', edge.targetHandle)
  if (edge.type) yEdge.set('type', edge.type)

  // Edge data as nested Y.Map
  if (edge.data) {
    const yData = new Y.Map<unknown>()
    for (const [key, value] of Object.entries(edge.data)) {
      yData.set(key, value)
    }
    yEdge.set('data', yData)
  }

  return yEdge
}

/**
 * Convert a Y.Map back to a React Flow Edge.
 */
export function yMapToEdge(yEdge: Y.Map<unknown>): Edge<EdgeData> {
  const yData = yEdge.get('data') as Y.Map<unknown> | undefined

  const edge: Edge<EdgeData> = {
    id: yEdge.get('id') as string,
    source: yEdge.get('source') as string,
    target: yEdge.get('target') as string,
    type: (yEdge.get('type') as string) || 'custom',
    data: yData ? yMapToObject(yData) as EdgeData : undefined
  }

  const sourceHandle = yEdge.get('sourceHandle') as string | undefined
  const targetHandle = yEdge.get('targetHandle') as string | undefined
  if (sourceHandle) edge.sourceHandle = sourceHandle
  if (targetHandle) edge.targetHandle = targetHandle

  return edge
}

// -----------------------------------------------------------------------------
// Workspace Meta Conversions
// -----------------------------------------------------------------------------

/**
 * Write workspace metadata (non-node/edge data) to Y.Map('meta').
 */
export function workspaceMetaToYMap(data: WorkspaceData, yMeta: Y.Map<unknown>): void {
  yMeta.set('id', data.id)
  yMeta.set('name', data.name)
  yMeta.set('version', data.version)
  yMeta.set('createdAt', data.createdAt)
  yMeta.set('updatedAt', data.updatedAt)

  // Viewport
  const yViewport = new Y.Map<number>()
  yViewport.set('x', data.viewport.x)
  yViewport.set('y', data.viewport.y)
  yViewport.set('zoom', data.viewport.zoom)
  yMeta.set('viewport', yViewport)

  // Complex settings stored as JSON strings for simplicity
  // (these change infrequently and don't need field-level CRDT resolution)
  if (data.propertySchema) {
    yMeta.set('propertySchema', JSON.stringify(data.propertySchema))
  }
  if (data.contextSettings) {
    yMeta.set('contextSettings', JSON.stringify(data.contextSettings))
  }
  if (data.themeSettings) {
    yMeta.set('themeSettings', JSON.stringify(data.themeSettings))
  }
  if (data.workspacePreferences) {
    yMeta.set('workspacePreferences', JSON.stringify(data.workspacePreferences))
  }
  if (data.layersSortMode) {
    yMeta.set('layersSortMode', data.layersSortMode)
  }
  if (data.manualLayerOrder) {
    yMeta.set('manualLayerOrder', JSON.stringify(data.manualLayerOrder))
  }
  if (data.spatialRegions) {
    yMeta.set('spatialRegions', JSON.stringify(data.spatialRegions))
  }
}

/**
 * Read workspace metadata from Y.Map('meta').
 */
export function yMapToWorkspaceMeta(yMeta: Y.Map<unknown>): Partial<WorkspaceData> {
  const yViewport = yMeta.get('viewport') as Y.Map<number> | undefined

  const meta: Partial<WorkspaceData> = {
    id: yMeta.get('id') as string,
    name: yMeta.get('name') as string,
    version: (yMeta.get('version') as number) || 1,
    createdAt: yMeta.get('createdAt') as number,
    updatedAt: yMeta.get('updatedAt') as number,
    viewport: yViewport ? {
      x: yViewport.get('x') || 0,
      y: yViewport.get('y') || 0,
      zoom: yViewport.get('zoom') || 1
    } : { x: 0, y: 0, zoom: 1 }
  }

  // Parse JSON-stored settings
  const propertySchemaStr = yMeta.get('propertySchema') as string | undefined
  if (propertySchemaStr) {
    try { meta.propertySchema = JSON.parse(propertySchemaStr) } catch { /* ignore */ }
  }

  const contextSettingsStr = yMeta.get('contextSettings') as string | undefined
  if (contextSettingsStr) {
    try { meta.contextSettings = JSON.parse(contextSettingsStr) } catch { /* ignore */ }
  }

  const themeSettingsStr = yMeta.get('themeSettings') as string | undefined
  if (themeSettingsStr) {
    try { meta.themeSettings = JSON.parse(themeSettingsStr) } catch { /* ignore */ }
  }

  const workspacePreferencesStr = yMeta.get('workspacePreferences') as string | undefined
  if (workspacePreferencesStr) {
    try { meta.workspacePreferences = JSON.parse(workspacePreferencesStr) } catch { /* ignore */ }
  }

  const layersSortMode = yMeta.get('layersSortMode') as string | undefined
  if (layersSortMode) {
    meta.layersSortMode = layersSortMode as WorkspaceData['layersSortMode']
  }

  const manualLayerOrderStr = yMeta.get('manualLayerOrder') as string | undefined
  if (manualLayerOrderStr) {
    try { meta.manualLayerOrder = JSON.parse(manualLayerOrderStr) } catch { /* ignore */ }
  }

  const spatialRegionsStr = yMeta.get('spatialRegions') as string | undefined
  if (spatialRegionsStr) {
    try { meta.spatialRegions = JSON.parse(spatialRegionsStr) } catch { /* ignore */ }
  }

  return meta
}

// -----------------------------------------------------------------------------
// Generic Object ↔ Y.Map Conversion
// -----------------------------------------------------------------------------

/**
 * Recursively convert a plain object to a Y.Map.
 * Arrays become Y.Arrays, nested objects become nested Y.Maps.
 */
export function objectToYMap(obj: Record<string, unknown>, doc: Y.Doc): Y.Map<unknown> {
  const yMap = new Y.Map<unknown>()

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yMap.set(key, value ?? null)
    } else if (Array.isArray(value)) {
      const yArr = new Y.Array<unknown>()
      for (const item of value) {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          yArr.push([objectToYMap(item as Record<string, unknown>, doc)])
        } else {
          yArr.push([item])
        }
      }
      yMap.set(key, yArr)
    } else if (typeof value === 'object') {
      yMap.set(key, objectToYMap(value as Record<string, unknown>, doc))
    } else {
      yMap.set(key, value)
    }
  }

  return yMap
}

/**
 * Recursively convert a Y.Map back to a plain object.
 */
export function yMapToObject(yMap: Y.Map<unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {}

  yMap.forEach((value, key) => {
    if (value instanceof Y.Map) {
      obj[key] = yMapToObject(value)
    } else if (value instanceof Y.Array) {
      obj[key] = yArrayToArray(value)
    } else {
      obj[key] = value
    }
  })

  return obj
}

/**
 * Convert a Y.Array to a plain array.
 */
export function yArrayToArray(yArr: Y.Array<unknown>): unknown[] {
  const arr: unknown[] = []

  yArr.forEach((item) => {
    if (item instanceof Y.Map) {
      arr.push(yMapToObject(item))
    } else if (item instanceof Y.Array) {
      arr.push(yArrayToArray(item))
    } else {
      arr.push(item)
    }
  })

  return arr
}

// -----------------------------------------------------------------------------
// Y.Doc Population
// -----------------------------------------------------------------------------

/**
 * Populate a Y.Doc from a full WorkspaceData snapshot.
 * Used for initial sync when sharing a workspace for the first time.
 */
export function populateDocFromWorkspaceData(doc: Y.Doc, data: WorkspaceData): void {
  doc.transact(() => {
    const yNodes = doc.getMap('nodes')
    const yEdges = doc.getArray('edges')
    const yMeta = doc.getMap('meta')

    // Clear existing data
    yNodes.forEach((_, key) => yNodes.delete(key))
    // Y.Array doesn't have clear(), delete all items
    if (yEdges.length > 0) {
      yEdges.delete(0, yEdges.length)
    }
    yMeta.forEach((_, key) => yMeta.delete(key))

    // Populate nodes
    for (const node of data.nodes) {
      yNodes.set(node.id, nodeToYMap(node, doc))
    }

    // Populate edges
    for (const edge of data.edges) {
      yEdges.push([edgeToYMap(edge)])
    }

    // Populate meta
    workspaceMetaToYMap(data, yMeta)
  })
}

/**
 * Extract full WorkspaceData from a Y.Doc.
 */
export function workspaceDataFromDoc(doc: Y.Doc): WorkspaceData {
  const yNodes = doc.getMap('nodes')
  const yEdges = doc.getArray('edges')
  const yMeta = doc.getMap('meta')

  const nodes: Node<NodeData>[] = []
  yNodes.forEach((yNode) => {
    if (yNode instanceof Y.Map) {
      nodes.push(yMapToNode(yNode))
    }
  })

  const edges: Edge<EdgeData>[] = []
  yEdges.forEach((yEdge) => {
    if (yEdge instanceof Y.Map) {
      edges.push(yMapToEdge(yEdge as Y.Map<unknown>))
    }
  })

  const meta = yMapToWorkspaceMeta(yMeta)

  return {
    id: meta.id || '',
    name: meta.name || 'Untitled',
    nodes,
    edges,
    viewport: meta.viewport || { x: 0, y: 0, zoom: 1 },
    createdAt: meta.createdAt || Date.now(),
    updatedAt: meta.updatedAt || Date.now(),
    version: meta.version || 1,
    propertySchema: meta.propertySchema,
    contextSettings: meta.contextSettings,
    themeSettings: meta.themeSettings,
    workspacePreferences: meta.workspacePreferences,
    layersSortMode: meta.layersSortMode,
    manualLayerOrder: meta.manualLayerOrder,
    spatialRegions: meta.spatialRegions
  }
}
