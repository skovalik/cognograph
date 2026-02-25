import { memo, useMemo, useCallback, useState } from 'react'
import {
  Search,
  MessageSquare,
  Folder,
  FileText,
  CheckSquare,
  Code,
  Boxes,
  ChevronDown,
  ChevronRight,
  ArrowDownAZ,
  Clock,
  Network,
  Type,
  GripVertical,
  Eye,
  EyeOff,
  Workflow
} from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useContextMenuStore } from '../stores/contextMenuStore'
import { ScrollArea } from './ui'
import { cn } from '../lib/utils'
import type { NodeData } from '@shared/types'

interface LayerNode {
  id: string
  title: string
  type: NodeData['type']
  parentId: string | null
  children: LayerNode[]
  depth: number
  createdAt: number
}

interface LayersPanelProps {
  sidebarWidth?: number
}

function LayersPanelComponent({ sidebarWidth = 260 }: LayersPanelProps): JSX.Element {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const isLightMode = themeSettings.mode === 'light'

  // Responsive thresholds based on sidebar width
  const isCompact = sidebarWidth < 220
  // isVeryCompact reserved for extra-compact mode
  void (sidebarWidth < 180)
  const selectedNodeIds = useWorkspaceStore((state) => state.selectedNodeIds)
  const expandedNodeIds = useWorkspaceStore((state) => state.expandedNodeIds)
  const layersSortMode = useWorkspaceStore((state) => state.layersSortMode)
  const layersFilter = useWorkspaceStore((state) => state.layersFilter)
  const setSelectedNodes = useWorkspaceStore((state) => state.setSelectedNodes)
  const toggleNodeExpanded = useWorkspaceStore((state) => state.toggleNodeExpanded)
  const setLayersSortMode = useWorkspaceStore((state) => state.setLayersSortMode)
  const setLayersFilter = useWorkspaceStore((state) => state.setLayersFilter)
  const openProperties = useWorkspaceStore((state) => state.openProperties)
  const addNodeToProject = useWorkspaceStore((state) => state.addNodeToProject)
  const reorderLayers = useWorkspaceStore((state) => state.reorderLayers)
  const manualLayerOrder = useWorkspaceStore((state) => state.manualLayerOrder)
  const showMembersProjectId = useWorkspaceStore((state) => state.showMembersProjectId)
  const setShowMembersProject = useWorkspaceStore((state) => state.setShowMembersProject)

  // Drag-and-drop state
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'inside' | 'after' | null>(null)

  // Build layer hierarchy
  const layerHierarchy = useMemo(() => {
    const nodeMap = new Map<string, LayerNode>()
    const rootNodes: LayerNode[] = []

    // Create layer nodes
    nodes.forEach((node) => {
      const parentId = (node.data.parentId as string | undefined) || null
      // Text nodes derive title from content (first 40 chars of plain text)
      let title = node.data.title as string
      if (node.data.type === 'text') {
        const content = (node.data.content as string) || ''
        const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        title = plainText.slice(0, 40) || 'Text'
      }
      const layerNode: LayerNode = {
        id: node.id,
        title,
        type: node.data.type,
        parentId,
        children: [],
        depth: 0,
        createdAt: node.data.createdAt
      }
      nodeMap.set(node.id, layerNode)
    })

    // Build parent-child relationships
    nodeMap.forEach((layerNode) => {
      if (layerNode.parentId) {
        const parent = nodeMap.get(layerNode.parentId)
        if (parent) {
          parent.children.push(layerNode)
          layerNode.depth = parent.depth + 1
        } else {
          // Parent not found, treat as root
          rootNodes.push(layerNode)
        }
      } else {
        rootNodes.push(layerNode)
      }
    })

    // Calculate depths recursively
    const setDepths = (node: LayerNode, depth: number): void => {
      node.depth = depth
      node.children.forEach((child) => setDepths(child, depth + 1))
    }
    rootNodes.forEach((node) => setDepths(node, 0))

    return rootNodes
  }, [nodes])

  // Sort nodes based on mode
  const sortedNodes = useMemo(() => {
    if (layersSortMode === 'manual' && manualLayerOrder) {
      // Manual mode: sort by the user-defined order
      const orderMap = new Map(manualLayerOrder.map((id, i) => [id, i]))
      const sortByOrder = (nodes: LayerNode[]): LayerNode[] => {
        const sorted = [...nodes].sort((a, b) => {
          const aIdx = orderMap.get(a.id) ?? Infinity
          const bIdx = orderMap.get(b.id) ?? Infinity
          return aIdx - bIdx
        })
        sorted.forEach((node) => {
          if (node.children.length > 0) {
            node.children = sortByOrder(node.children)
          }
        })
        return sorted
      }
      return sortByOrder(layerHierarchy)
    }

    const sortFn = (a: LayerNode, b: LayerNode): number => {
      switch (layersSortMode) {
        case 'type':
          // Group by type, then by title
          if (a.type !== b.type) {
            const typeOrder = ['project', 'workspace', 'conversation', 'note', 'task', 'artifact', 'text']
            return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
          }
          return a.title.localeCompare(b.title)
        case 'recent':
          return b.createdAt - a.createdAt
        case 'hierarchy':
        default:
          // Hierarchy mode: projects first, then others
          if (a.type === 'project' && b.type !== 'project') return -1
          if (b.type === 'project' && a.type !== 'project') return 1
          return a.title.localeCompare(b.title)
      }
    }

    const sortRecursive = (nodes: LayerNode[]): LayerNode[] => {
      const sorted = [...nodes].sort(sortFn)
      sorted.forEach((node) => {
        if (node.children.length > 0) {
          node.children = sortRecursive(node.children)
        }
      })
      return sorted
    }

    return sortRecursive(layerHierarchy)
  }, [layerHierarchy, layersSortMode, manualLayerOrder])

  // Filter nodes
  const filteredNodes = useMemo(() => {
    if (!layersFilter.trim()) return sortedNodes

    const filterLower = layersFilter.toLowerCase()

    const filterRecursive = (nodes: LayerNode[]): LayerNode[] => {
      return nodes.filter((node) => {
        const titleMatches = node.title.toLowerCase().includes(filterLower)
        const typeMatches = node.type.toLowerCase().includes(filterLower)

        // If this node matches, include it with all children
        if (titleMatches || typeMatches) {
          return true
        }

        // If any child matches, include this node
        const filteredChildren = filterRecursive(node.children)
        if (filteredChildren.length > 0) {
          node.children = filteredChildren
          return true
        }

        return false
      })
    }

    return filterRecursive(sortedNodes.map((n) => ({ ...n, children: [...n.children] })))
  }, [sortedNodes, layersFilter])

  // Helper to get all descendant node IDs for a given node
  const getDescendantIds = useCallback((nodeId: string): string[] => {
    const descendants: string[] = []
    const findDescendants = (id: string): void => {
      nodes.forEach((n) => {
        if ((n.data as { parentId?: string }).parentId === id) {
          descendants.push(n.id)
          findDescendants(n.id)
        }
      })
    }
    findDescendants(nodeId)
    return descendants
  }, [nodes])

  const handleNodeClick = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      const clickedNode = nodes.find((n) => n.id === nodeId)
      const isProject = clickedNode?.data.type === 'project'

      if (event.shiftKey && isProject) {
        // Shift+Click on project: select project and all its children
        const childIds = getDescendantIds(nodeId)
        const newSelection = [nodeId, ...childIds]
        if (event.metaKey || event.ctrlKey) {
          // Add to existing selection
          const combined = new Set([...selectedNodeIds, ...newSelection])
          setSelectedNodes(Array.from(combined))
        } else {
          // Replace selection
          setSelectedNodes(newSelection)
        }
      } else if (event.metaKey || event.ctrlKey) {
        // Ctrl/Cmd+Click: toggle multi-select
        if (selectedNodeIds.includes(nodeId)) {
          setSelectedNodes(selectedNodeIds.filter((id) => id !== nodeId))
        } else {
          setSelectedNodes([...selectedNodeIds, nodeId])
        }
      } else {
        // Single select
        setSelectedNodes([nodeId])
      }
      openProperties()
    },
    [selectedNodeIds, setSelectedNodes, openProperties, nodes, getDescendantIds]
  )

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      // Pan to node (would need viewport control)
      // For now, just select and open properties
      setSelectedNodes([nodeId])
      openProperties()
    },
    [setSelectedNodes, openProperties]
  )

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    // If dragging a selected node, drag all selected nodes
    // Otherwise just drag this one node
    const nodesToDrag = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId]
    e.dataTransfer.setData('application/json', JSON.stringify(nodesToDrag))
    e.dataTransfer.effectAllowed = 'move'
    setDraggedNodeId(nodeId)
  }, [selectedNodeIds])

  // Helper to flatten layer hierarchy for index-based reorder
  const flatNodeIds = useMemo(() => {
    const ids: string[] = []
    const flatten = (nodes: LayerNode[]): void => {
      nodes.forEach(n => {
        ids.push(n.id)
        if (n.children.length > 0 && expandedNodeIds.has(n.id)) {
          flatten(n.children)
        }
      })
    }
    flatten(filteredNodes)
    return ids
  }, [filteredNodes, expandedNodeIds])

  const handleDragOver = useCallback(
    (e: React.DragEvent, nodeId: string) => {
      e.preventDefault()
      if (draggedNodeId === null || nodeId === draggedNodeId) return

      const targetNode = nodes.find((n) => n.id === nodeId)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const y = e.clientY - rect.top
      const height = rect.height

      // Determine drop position based on cursor location
      if (targetNode?.data.type === 'project' && y > height * 0.25 && y < height * 0.75) {
        // Middle 50% of a project node: drop inside
        e.dataTransfer.dropEffect = 'move'
        setDragOverNodeId(nodeId)
        setDropPosition('inside')
      } else if (y < height * 0.5) {
        // Top half: insert before
        e.dataTransfer.dropEffect = 'move'
        setDragOverNodeId(nodeId)
        setDropPosition('before')
      } else {
        // Bottom half: insert after
        e.dataTransfer.dropEffect = 'move'
        setDragOverNodeId(nodeId)
        setDropPosition('after')
      }
    },
    [nodes, draggedNodeId]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, targetNodeId: string) => {
      e.preventDefault()
      const targetNode = nodes.find((n) => n.id === targetNodeId)

      // Try parsing as JSON (multi-node drag)
      let sourceNodeIds: string[] = []
      try {
        const jsonData = e.dataTransfer.getData('application/json')
        if (jsonData) {
          sourceNodeIds = JSON.parse(jsonData)
        }
      } catch {
        // Fallback to single node (old format)
        const singleId = e.dataTransfer.getData('text/plain')
        if (singleId) {
          sourceNodeIds = [singleId]
        }
      }

      if (sourceNodeIds.length > 0 && !sourceNodeIds.includes(targetNodeId)) {
        if (dropPosition === 'inside' && targetNode?.data.type === 'project') {
          // Drop inside a project node
          sourceNodeIds.forEach((nodeId) => {
            if (nodeId !== targetNodeId) {
              addNodeToProject(nodeId, targetNodeId)
            }
          })
        } else if (dropPosition === 'before' || dropPosition === 'after') {
          // Reorder: compute target index in flat list
          const targetIdx = flatNodeIds.indexOf(targetNodeId)
          if (targetIdx !== -1) {
            const insertIdx = dropPosition === 'after' ? targetIdx + 1 : targetIdx
            reorderLayers(sourceNodeIds, insertIdx)
          }
        }
      }
      setDragOverNodeId(null)
      setDraggedNodeId(null)
      setDropPosition(null)
    },
    [nodes, addNodeToProject, dropPosition, flatNodeIds, reorderLayers]
  )

  const handleDragLeave = useCallback(() => {
    setDragOverNodeId(null)
    setDropPosition(null)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragOverNodeId(null)
    setDraggedNodeId(null)
    setDropPosition(null)
  }, [])

  // Context menu handler
  const openContextMenu = useContextMenuStore((state) => state.open)
  const handleContextMenu = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      // If the right-clicked node is already selected, show context menu for all selected nodes
      // Otherwise, select just this node and show context menu for it
      if (selectedNodeIds.includes(nodeId)) {
        if (selectedNodeIds.length > 1) {
          openContextMenu(
            { x: event.clientX, y: event.clientY },
            { type: 'nodes', nodeIds: selectedNodeIds }
          )
        } else {
          openContextMenu(
            { x: event.clientX, y: event.clientY },
            { type: 'node', nodeId }
          )
        }
      } else {
        setSelectedNodes([nodeId])
        openContextMenu(
          { x: event.clientX, y: event.clientY },
          { type: 'node', nodeId }
        )
      }
    },
    [selectedNodeIds, setSelectedNodes, openContextMenu]
  )

  // Theme-aware classes - using GUI CSS variables
  const borderClass = 'gui-border'
  const inputBgClass = 'gui-input'
  const activeButtonClass = 'gui-panel-secondary gui-text'
  const inactiveButtonClass = 'gui-text-secondary'

  return (
    <div className="h-full flex flex-col">
      {/* Search bar */}
      <div className={`p-2 border-b ${borderClass}`}>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 gui-text-secondary" />
          <input
            type="text"
            value={layersFilter}
            onChange={(e) => setLayersFilter(e.target.value)}
            placeholder="Search nodes..."
            className={`w-full ${inputBgClass} border rounded pl-8 pr-3 py-1.5 text-xs focus:outline-none`}
            style={{ borderColor: 'var(--gui-border-strong)' }}
          />
        </div>
      </div>

      {/* Sort mode toggle */}
      <div className={`px-2 py-1.5 border-b ${borderClass} flex items-center ${isCompact ? 'justify-center' : 'justify-between'}`}>
        {!isCompact && <span className="text-xs gui-text-secondary">Sort by:</span>}
        <div className="flex gap-1">
          <button
            onClick={() => setLayersSortMode('hierarchy')}
            className={`p-1 rounded transition-colors ${
              layersSortMode === 'hierarchy'
                ? activeButtonClass
                : inactiveButtonClass
            }`}
            title="Hierarchy"
          >
            <Network className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLayersSortMode('type')}
            className={`p-1 rounded transition-colors ${
              layersSortMode === 'type'
                ? activeButtonClass
                : inactiveButtonClass
            }`}
            title="By Type"
          >
            <ArrowDownAZ className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLayersSortMode('recent')}
            className={`p-1 rounded transition-colors ${
              layersSortMode === 'recent'
                ? activeButtonClass
                : inactiveButtonClass
            }`}
            title="Recent"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          {manualLayerOrder && (
            <button
              onClick={() => setLayersSortMode('manual')}
              className={`p-1 rounded transition-colors ${
                layersSortMode === 'manual'
                  ? activeButtonClass
                  : inactiveButtonClass
              }`}
              title="Manual (drag to reorder)"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Show Members toggle - only show when a project is selected */}
      {(() => {
        const selectedProject = selectedNodeIds.length === 1 &&
          nodes.find(n => n.id === selectedNodeIds[0] && n.data.type === 'project')
        if (!selectedProject) return null

        const isShowingMembers = showMembersProjectId === selectedProject.id
        return (
          <div className={`px-2 py-1.5 border-b ${borderClass} flex items-center justify-between`}>
            <span className="text-xs gui-text-secondary truncate">
              {isShowingMembers ? 'Showing members of:' : 'Show members of:'}
            </span>
            <button
              onClick={() => setShowMembersProject(isShowingMembers ? null : selectedProject.id)}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                isShowingMembers
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'gui-text-secondary hover:gui-panel-secondary'
              }`}
              title={isShowingMembers ? 'Hide members view' : 'Show only members of this project'}
            >
              {isShowingMembers ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="truncate max-w-[80px]">{String(selectedProject.data.title || 'Untitled')}</span>
            </button>
          </div>
        )
      })()}

      {/* Node list */}
      <ScrollArea className="flex-1">
        {filteredNodes.length === 0 ? (
          <div className="p-4 text-center gui-text-secondary text-xs">
            {layersFilter ? 'No matching nodes' : 'No nodes yet'}
          </div>
        ) : (
          <div className="py-1">
            {filteredNodes.map((node) => (
              <LayerItem
                key={node.id}
                node={node}
                selectedNodeIds={selectedNodeIds}
                expandedNodeIds={expandedNodeIds}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onToggleExpand={toggleNodeExpanded}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={handleDragLeave}
                onDragEnd={handleDragEnd}
                dragOverNodeId={dragOverNodeId}
                dropPosition={dropPosition}
                isLightMode={isLightMode}
                nodeColors={themeSettings.nodeColors}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Stats footer */}
      <div className="px-3 py-2 border-t gui-border text-xs gui-text-secondary">
        {nodes.length} node{nodes.length !== 1 ? 's' : ''}
        {selectedNodeIds.length > 0 && ` · ${selectedNodeIds.length} selected`}
      </div>
    </div>
  )
}

// Layer item component
interface LayerItemProps {
  node: LayerNode
  selectedNodeIds: string[]
  expandedNodeIds: Set<string>
  onNodeClick: (nodeId: string, event: React.MouseEvent) => void
  onNodeDoubleClick: (nodeId: string) => void
  onToggleExpand: (nodeId: string) => void
  onDragStart: (e: React.DragEvent, nodeId: string) => void
  onDragOver: (e: React.DragEvent, nodeId: string) => void
  onDrop: (e: React.DragEvent, targetNodeId: string) => void
  onDragLeave: () => void
  isLightMode: boolean
  onDragEnd: () => void
  dragOverNodeId: string | null
  dropPosition: 'before' | 'inside' | 'after' | null
  nodeColors: Record<string, string>
  onContextMenu: (nodeId: string, event: React.MouseEvent) => void
}

function LayerItemComponent({
  node,
  selectedNodeIds,
  expandedNodeIds,
  onNodeClick,
  onNodeDoubleClick,
  onToggleExpand,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
  onDragEnd,
  dragOverNodeId,
  dropPosition,
  isLightMode,
  nodeColors,
  onContextMenu
}: LayerItemProps): JSX.Element {
  const isSelected = selectedNodeIds.includes(node.id)
  const isExpanded = expandedNodeIds.has(node.id)
  const hasChildren = node.children.length > 0
  const isDragOver = dragOverNodeId === node.id
  const isProject = node.type === 'project'
  const showDropBefore = isDragOver && dropPosition === 'before'
  const showDropAfter = isDragOver && dropPosition === 'after'
  const showDropInside = isDragOver && dropPosition === 'inside' && isProject

  const getIcon = (): JSX.Element => {
    const color = nodeColors[node.type] || '#9ca3af'
    switch (node.type) {
      case 'conversation':
        return <MessageSquare className="w-3.5 h-3.5" style={{ color }} />
      case 'project':
        return <Folder className="w-3.5 h-3.5" style={{ color }} />
      case 'note':
        return <FileText className="w-3.5 h-3.5" style={{ color }} />
      case 'task':
        return <CheckSquare className="w-3.5 h-3.5" style={{ color }} />
      case 'artifact':
        return <Code className="w-3.5 h-3.5" style={{ color }} />
      case 'workspace':
        return <Boxes className="w-3.5 h-3.5" style={{ color }} />
      case 'text':
        return <Type className="w-3.5 h-3.5" style={{ color }} />
      case 'orchestrator':
        return <Workflow className="w-3.5 h-3.5" style={{ color }} />
      default:
        return <Code className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
    }
  }

  // Theme-aware classes for the item - keep selection/drag colors, use GUI text
  const defaultClass = 'gui-text'
  const selectedClass = isLightMode ? 'bg-blue-100' : 'bg-blue-900/50'
  const dragOverClass = isLightMode ? 'bg-blue-100 ring-1 ring-blue-500' : 'bg-blue-900/40 ring-1 ring-blue-500'
  const expandButtonHoverClass = 'gui-button'

  return (
    <div className="relative">
      {/* Drop indicator: before */}
      {showDropBefore && (
        <div className="absolute top-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full z-10" />
      )}
      <div
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors ${
          isSelected
            ? selectedClass
            : showDropInside
              ? dragOverClass
              : defaultClass
        }`}
        style={{ paddingLeft: `${8 + node.depth * 16}px` }}
        draggable
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragOver={(e) => onDragOver(e, node.id)}
        onDrop={(e) => onDrop(e, node.id)}
        onDragLeave={onDragLeave}
        onDragEnd={onDragEnd}
        onClick={(e) => onNodeClick(node.id, e)}
        onDoubleClick={() => onNodeDoubleClick(node.id)}
        onContextMenu={(e) => onContextMenu(node.id, e)}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(node.id)
            }}
            className={`p-0.5 ${expandButtonHoverClass} rounded`}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <div className="w-4" /> // Spacer
        )}

        {/* Icon */}
        {getIcon()}

        {/* Title */}
        <span className="text-xs truncate flex-1">{node.title}</span>

        {/* Child count badge */}
        {hasChildren && (
          <span className="text-xs gui-text-secondary">{node.children.length}</span>
        )}
      </div>

      {/* Drop indicator: after */}
      {showDropAfter && !hasChildren && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full z-10" />
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <LayerItemComponent
              key={child.id}
              node={child}
              selectedNodeIds={selectedNodeIds}
              expandedNodeIds={expandedNodeIds}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onToggleExpand={onToggleExpand}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragLeave={onDragLeave}
              onDragEnd={onDragEnd}
              dragOverNodeId={dragOverNodeId}
              dropPosition={dropPosition}
              isLightMode={isLightMode}
              nodeColors={nodeColors}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}

      {/* Drop indicator: after (when has children or after expanded) */}
      {showDropAfter && hasChildren && (
        <div className="relative">
          <div className="absolute top-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full z-10" />
        </div>
      )}
    </div>
  )
}

const LayerItem = memo(LayerItemComponent)
export const LayersPanel = memo(LayersPanelComponent)
