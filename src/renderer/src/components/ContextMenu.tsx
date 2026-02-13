/**
 * Context Menu Component
 *
 * Right-click context menu for canvas, nodes, and edges.
 * Shows different menu items based on the target type.
 */

import { memo, useCallback, useEffect, useRef } from 'react'
import {
  MessageSquare,
  FileText,
  CheckSquare,
  Layers,
  Trash2,
  Save,
  Copy,
  ExternalLink,
  Settings2,
  FolderOpen,
  Code,
  Folder,
  ArrowUpDown,
  Undo2,
  Redo2,
  Download,
  Boxes,
  Wand2,
  ChevronDown,
  ChevronUp,
  Palette,
  Pin,
  PinOff,
  Eye,
  Star,
  Type,
  Link2,
  Unlink2,
  GitBranch,
  Zap,
  Plus,
  RotateCcw,
  Info,
  Archive,
  Send,
  Workflow,
  Bot,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  useContextMenuStore,
  useIsContextMenuOpen,
  useContextMenuTarget,
  useContextMenuPosition
} from '../stores/contextMenuStore'
import { Separator } from './ui'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useTemplateStore } from '../stores/templateStore'
import { useAIEditorStore } from '../stores/aiEditorStore'
import { suggestTemplateName } from '../utils/templateUtils'
import type { Node as FlowNode } from '@xyflow/react'
import type { NodeData } from '@shared/types'
import { getConversionTargets } from '../utils/nodeConversion'
import { useCCBridgeStore } from '../stores/ccBridgeStore'

// -----------------------------------------------------------------------------
// Menu Item Component
// -----------------------------------------------------------------------------

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  shortcut?: string
  danger?: boolean
  disabled?: boolean
}

function MenuItem({
  icon,
  label,
  onClick,
  shortcut,
  danger,
  disabled
}: MenuItemProps): JSX.Element {
  const handleClick = useCallback(() => {
    if (!disabled) {
      onClick()
    }
  }, [onClick, disabled])

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${
        disabled
          ? 'gui-text-muted cursor-not-allowed'
          : danger
            ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
            : 'gui-text hover:gui-surface-secondary'
      }`}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-xs gui-text-muted">{shortcut}</span>}
    </button>
  )
}

// -----------------------------------------------------------------------------
// Menu Separator
// -----------------------------------------------------------------------------

function MenuSeparator(): JSX.Element {
  return <Separator className="my-1" />
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function calculateBounds(nodes: FlowNode<NodeData>[]): { width: number; height: number } {
  if (nodes.length === 0) return { width: 0, height: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const w = node.width || 280
    const h = node.height || 120
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + w)
    maxY = Math.max(maxY, node.position.y + h)
  }

  return { width: maxX - minX, height: maxY - minY }
}

function findRootNode(nodes: FlowNode<NodeData>[]): FlowNode<NodeData> {
  return nodes.reduce((best, node) => {
    const score = node.position.y * 10000 + node.position.x
    const bestScore = best.position.y * 10000 + best.position.x
    return score < bestScore ? node : best
  })
}

// Color presets for multi-select color change
const COLOR_PRESETS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#ffffff']

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

function ContextMenuComponent(): JSX.Element | null {
  const isOpen = useIsContextMenuOpen()
  const target = useContextMenuTarget()
  const position = useContextMenuPosition()
  const close = useContextMenuStore((s) => s.close)
  const menuRef = useRef<HTMLDivElement>(null)

  // Workspace actions
  const addNode = useWorkspaceStore((s) => s.addNode)
  const addAgentNode = useWorkspaceStore((s) => s.addAgentNode)
  const addNodeToProject = useWorkspaceStore((s) => s.addNodeToProject)
  const deleteNodes = useWorkspaceStore((s) => s.deleteNodes)
  const deleteEdges = useWorkspaceStore((s) => s.deleteEdges)
  const openChat = useWorkspaceStore((s) => s.openChat)
  const nodes = useWorkspaceStore((s) => s.nodes)
  const edges = useWorkspaceStore((s) => s.edges)
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const updateBulkNodes = useWorkspaceStore((s) => s.updateBulkNodes)
  const reverseEdge = useWorkspaceStore((s) => s.reverseEdge)
  const linkAllNodes = useWorkspaceStore((s) => s.linkAllNodes)
  const linkSelectedNodes = useWorkspaceStore((s) => s.linkSelectedNodes)
  const unlinkSelectedNodes = useWorkspaceStore((s) => s.unlinkSelectedNodes)
  const setSelectedEdges = useWorkspaceStore((s) => s.setSelectedEdges)
  const archiveNodes = useWorkspaceStore((s) => s.archiveNodes)
  const changeNodeType = useWorkspaceStore((s) => s.changeNodeType)
  const undo = useWorkspaceStore((s) => s.undo)
  const redo = useWorkspaceStore((s) => s.redo)
  const canUndo = useWorkspaceStore((s) => s.canUndo)
  const canRedo = useWorkspaceStore((s) => s.canRedo)

  // Template actions
  const openBrowser = useTemplateStore((s) => s.openBrowser)
  const openSaveModal = useTemplateStore((s) => s.openSaveModal)

  // AI Editor actions
  const openAIEditor = useAIEditorStore((s) => s.openModal)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        close()
      }
    }

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        close()
      }
    }

    // Use timeout to avoid closing immediately when the menu opens
    // Use capture phase so the listener fires before React Flow can stop propagation
    // (React Flow intercepts mousedown on nodes for drag/selection)
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    // Close on window blur (switching apps) and scroll
    window.addEventListener('blur', close)
    document.addEventListener('scroll', close, true)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('blur', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [isOpen, close])

  // Handle add node
  const handleAddNode = useCallback(
    (type: NodeData['type']) => {
      if (target?.type === 'canvas') {
        addNode(type, target.position)
      }
      close()
    },
    [target, addNode, close]
  )

  // Handle add agent node
  const handleAddAgent = useCallback(() => {
    if (target?.type === 'canvas') {
      addAgentNode(target.position)
    }
    close()
  }, [target, addAgentNode, close])

  // Handle add node to project
  const handleAddNodeToProject = useCallback(
    (type: NodeData['type']) => {
      if (target?.type === 'project-body') {
        const newNodeId = addNode(type, target.position)
        addNodeToProject(newNodeId, target.projectId)
      }
      close()
    },
    [target, addNode, addNodeToProject, close]
  )

  // Handle paste template
  const handlePasteTemplate = useCallback(() => {
    openBrowser()
    close()
  }, [openBrowser, close])

  // Handle save as template
  const handleSaveAsTemplate = useCallback(() => {
    const nodeIdsToSave =
      target?.type === 'node'
        ? [target.nodeId]
        : target?.type === 'nodes'
          ? target.nodeIds
          : selectedNodeIds

    if (nodeIdsToSave.length === 0) return

    const selectedNodes = nodes.filter((n) => nodeIdsToSave.includes(n.id))
    const selectedEdges = edges.filter(
      (e) => nodeIdsToSave.includes(e.source) && nodeIdsToSave.includes(e.target)
    )

    const bounds = calculateBounds(selectedNodes)
    const rootNode = findRootNode(selectedNodes)

    openSaveModal({
      nodeIds: nodeIdsToSave,
      edgeIds: selectedEdges.map((e) => e.id),
      suggestedName: suggestTemplateName(selectedNodes),
      bounds,
      rootNodeId: rootNode.id
    })

    close()
  }, [target, selectedNodeIds, nodes, edges, openSaveModal, close])

  // Handle open node
  const handleOpenNode = useCallback(() => {
    if (target?.type === 'node') {
      const node = nodes.find((n) => n.id === target.nodeId)
      if (node?.data.type === 'conversation') {
        openChat(target.nodeId)
      }
    }
    close()
  }, [target, nodes, openChat, close])

  // Handle delete
  const handleDelete = useCallback(() => {
    if (target?.type === 'node') {
      deleteNodes([target.nodeId])
    } else if (target?.type === 'nodes') {
      deleteNodes(target.nodeIds)
    } else if (target?.type === 'edge') {
      deleteEdges([target.edgeId])
    }
    close()
  }, [target, deleteNodes, deleteEdges, close])

  // Handle archive
  const handleArchive = useCallback(() => {
    if (target?.type === 'node') {
      archiveNodes([target.nodeId])
    } else if (target?.type === 'nodes') {
      archiveNodes(target.nodeIds)
    }
    close()
  }, [target, archiveNodes, close])

  // Handle duplicate nodes
  const handleDuplicate = useCallback(() => {
    // For now, just log - full duplicate implementation would need more work
    console.log('[ContextMenu] Duplicate not yet implemented')
    close()
  }, [close])

  if (!isOpen || !target) return null

  // Calculate menu position (keep within viewport)
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 200),
    top: Math.min(position.y, window.innerHeight - 300),
  }

  // Render different menus based on target type
  const renderMenuItems = (): JSX.Element => {
    switch (target.type) {
      case 'canvas':
        return (
          <>
            <div className="px-3 py-2 text-xs font-medium text-[var(--text-muted)] uppercase">Create</div>
            <MenuItem
              icon={<MessageSquare className="w-4 h-4" />}
              label="New Conversation"
              onClick={() => handleAddNode('conversation')}
            />
            <MenuItem
              icon={<Bot className="w-4 h-4" />}
              label="New Agent"
              onClick={handleAddAgent}
            />
            <MenuItem
              icon={<FileText className="w-4 h-4" />}
              label="New Note"
              onClick={() => handleAddNode('note')}
            />
            <MenuItem
              icon={<CheckSquare className="w-4 h-4" />}
              label="New Task"
              onClick={() => handleAddNode('task')}
            />
            <MenuItem
              icon={<Folder className="w-4 h-4" />}
              label="New Project"
              onClick={() => handleAddNode('project')}
            />
            <MenuItem
              icon={<Code className="w-4 h-4" />}
              label="New Artifact"
              onClick={() => handleAddNode('artifact')}
            />
            <MenuItem
              icon={<Boxes className="w-4 h-4" />}
              label="New Workspace"
              onClick={() => handleAddNode('workspace')}
            />
            <MenuItem
              icon={<Zap className="w-4 h-4" />}
              label="New Action"
              onClick={() => handleAddNode('action')}
            />
            <MenuItem
              icon={<Type className="w-4 h-4" />}
              label="New Text"
              onClick={() => handleAddNode('text')}
            />
            <MenuItem
              icon={<Workflow className="w-4 h-4" />}
              label="New Orchestrator"
              onClick={() => handleAddNode('orchestrator')}
            />
            <MenuSeparator />
            <div className="px-3 py-2 text-xs font-medium text-[var(--text-muted)] uppercase">Templates</div>
            <MenuItem
              icon={<FolderOpen className="w-4 h-4" />}
              label="Browse Templates"
              onClick={handlePasteTemplate}
              shortcut="Ctrl+T"
            />
            <MenuItem
              icon={<Layers className="w-4 h-4" />}
              label="Paste from Template"
              onClick={handlePasteTemplate}
            />
            {selectedNodeIds.length > 0 && (
              <MenuItem
                icon={<Save className="w-4 h-4" />}
                label="Save Selection as Template"
                onClick={handleSaveAsTemplate}
                shortcut="Ctrl+Shift+S"
              />
            )}
            {/* Template file import — deferred to post-audit roadmap Phase 4 */}
            <MenuSeparator />
            <div className="px-3 py-2 text-xs font-medium text-[var(--text-muted)] uppercase">Edit</div>
            <MenuItem
              icon={<Undo2 className="w-4 h-4" />}
              label="Undo"
              onClick={() => { undo(); close() }}
              shortcut="Ctrl+Z"
              disabled={!canUndo()}
            />
            <MenuItem
              icon={<Redo2 className="w-4 h-4" />}
              label="Redo"
              onClick={() => { redo(); close() }}
              shortcut="Ctrl+Y"
              disabled={!canRedo()}
            />
          </>
        )

      case 'node': {
        const node = nodes.find((n) => n.id === target.nodeId)
        const isConversation = node?.data.type === 'conversation'
        const isArtifact = node?.data.type === 'artifact'
        const isProject = node?.data.type === 'project'

        // Get project children for "Select All Children" action
        const getProjectChildren = (): string[] => {
          if (!isProject || !node) return []
          const children: string[] = []
          const findChildren = (parentId: string): void => {
            nodes.forEach((n) => {
              if ((n.data as { parentId?: string }).parentId === parentId) {
                children.push(n.id)
                findChildren(n.id)
              }
            })
          }
          findChildren(node.id)
          return children
        }

        // Download handler for artifacts
        const handleDownloadArtifact = async (): Promise<void> => {
          if (!node || node.data.type !== 'artifact') return
          const artifactData = node.data as import('@shared/types').ArtifactNodeData

          // Get active content
          let content = artifactData.content
          let contentType = artifactData.contentType
          let language = artifactData.language

          if (artifactData.files && artifactData.files.length > 0) {
            const activeFile = artifactData.activeFileId
              ? artifactData.files.find(f => f.id === artifactData.activeFileId)
              : artifactData.files[0]
            if (activeFile) {
              content = activeFile.content
              contentType = activeFile.contentType
              language = activeFile.language
            }
          }

          try {
            const result = await window.api.artifact.download({
              title: artifactData.title,
              content,
              contentType,
              language,
              files: artifactData.files && artifactData.files.length > 1
                ? artifactData.files.map(f => ({ filename: f.filename, content: f.content, contentType: f.contentType }))
                : undefined,
              isBase64: contentType === 'image'
            })

            if (result.success) {
              toast.success('Artifact saved')
              if (result.note) {
                toast(result.note, { icon: <Info size={16} className="text-blue-400" />, duration: 4000 })
              }
            } else if (!result.canceled) {
              toast.error('Failed to save: ' + (result.error || 'Unknown error'))
            }
          } catch (error) {
            toast.error('Failed to save artifact')
            console.error('Download error:', error)
          }
          close()
        }

        return (
          <>
            {isConversation && (
              <>
                <MenuItem
                  icon={<ExternalLink className="w-4 h-4" />}
                  label="Open Chat"
                  onClick={handleOpenNode}
                />
                <MenuSeparator />
              </>
            )}
            {isArtifact && (
              <>
                <MenuItem
                  icon={<Download className="w-4 h-4" />}
                  label="Download"
                  onClick={handleDownloadArtifact}
                />
                <MenuSeparator />
              </>
            )}
            {isProject && (
              <>
                <MenuItem
                  icon={node.data.type === 'project' && (node.data as import('@shared/types').ProjectNodeData).collapsed
                    ? <ChevronDown className="w-4 h-4" />
                    : <ChevronUp className="w-4 h-4" />
                  }
                  label={node.data.type === 'project' && (node.data as import('@shared/types').ProjectNodeData).collapsed
                    ? 'Expand'
                    : 'Collapse'
                  }
                  onClick={() => {
                    const projectData = node!.data as import('@shared/types').ProjectNodeData
                    useWorkspaceStore.getState().updateNode(target.nodeId, { collapsed: !projectData.collapsed })
                    close()
                  }}
                />
                <MenuItem
                  icon={<Layers className="w-4 h-4" />}
                  label="Select All Children"
                  onClick={() => {
                    const children = getProjectChildren()
                    useWorkspaceStore.getState().setSelectedNodes([target.nodeId, ...children])
                    close()
                  }}
                />
                {(() => {
                  const childrenOnly = getProjectChildren()
                  return (
                    <MenuItem
                      icon={<Layers className="w-4 h-4" />}
                      label="Select children only"
                      onClick={() => {
                        if (childrenOnly.length > 0) {
                          useWorkspaceStore.getState().setSelectedNodes(childrenOnly)
                        }
                        close()
                      }}
                      disabled={childrenOnly.length === 0}
                    />
                  )
                })()}
                <MenuItem
                  icon={<FolderOpen className="w-4 h-4" />}
                  label="Expand in Outline"
                  onClick={() => {
                    const store = useWorkspaceStore.getState()
                    if (!store.expandedNodeIds.has(target.nodeId)) {
                      store.toggleNodeExpanded(target.nodeId)
                    }
                    if (!store.leftSidebarOpen) {
                      store.toggleLeftSidebar()
                    }
                    store.setLeftSidebarTab('layers')
                    close()
                  }}
                />
                <MenuSeparator />
                <div className="px-3 py-1">
                  <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                    <Palette className="w-3 h-3" /> Color
                  </span>
                  <div className="flex flex-wrap gap-1 py-1">
                    {COLOR_PRESETS.map(color => (
                      <button
                        key={color}
                        className="w-5 h-5 rounded-full border border-white/20 hover:scale-125 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          useWorkspaceStore.getState().updateNode(target.nodeId, { color })
                          close()
                        }}
                      />
                    ))}
                    <button
                      className="px-1.5 h-5 rounded text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel-secondary)] transition-colors"
                      onClick={() => {
                        useWorkspaceStore.getState().updateNode(target.nodeId, { color: undefined })
                        close()
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <MenuSeparator />
              </>
            )}
            <MenuItem
              icon={<Settings2 className="w-4 h-4" />}
              label={isArtifact ? "Open Properties..." : "Properties"}
              onClick={() => {
                // Select node to open properties panel (or floating modal for artifacts based on preference)
                useWorkspaceStore.getState().setSelectedNodes([target.nodeId])
                if (isArtifact) {
                  const prefs = useWorkspaceStore.getState().workspacePreferences
                  if (prefs.artifactPropertiesDisplay === 'modal') {
                    useWorkspaceStore.getState().openFloatingProperties(target.nodeId)
                  }
                  // If sidebar, selection already shows the properties panel
                }
                close()
              }}
            />
            <MenuItem
              icon={(() => {
                const isPinned = useWorkspaceStore.getState().pinnedWindows.some(w => w.nodeId === target.nodeId)
                return isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />
              })()}
              label={useWorkspaceStore.getState().pinnedWindows.some(w => w.nodeId === target.nodeId) ? 'Unpin from screen' : 'Pin to screen'}
              onClick={() => {
                const store = useWorkspaceStore.getState()
                const isPinned = store.pinnedWindows.some(w => w.nodeId === target.nodeId)
                if (isPinned) {
                  store.unpinNode(target.nodeId)
                } else {
                  store.pinNode(target.nodeId)
                }
                close()
              }}
            />
            <MenuItem
              icon={<Eye className="w-4 h-4" />}
              label={useWorkspaceStore.getState().focusModeNodeId === target.nodeId ? 'Exit Focus Mode' : 'Focus on this node'}
              onClick={() => {
                const store = useWorkspaceStore.getState()
                if (store.focusModeNodeId === target.nodeId) {
                  store.setFocusModeNode(null)
                } else {
                  store.setFocusModeNode(target.nodeId)
                }
                close()
              }}
              shortcut="F"
            />
            <MenuItem
              icon={<Star className="w-4 h-4" />}
              label={useWorkspaceStore.getState().bookmarkedNodeId === target.nodeId ? 'Remove bookmark' : 'Bookmark this node'}
              onClick={() => {
                const store = useWorkspaceStore.getState()
                if (store.bookmarkedNodeId === target.nodeId) {
                  store.setBookmarkedNode(null)
                } else {
                  store.setBookmarkedNode(target.nodeId)
                }
                close()
              }}
              shortcut="B"
            />
            <MenuItem
              icon={<Save className="w-4 h-4" />}
              label="Save as Template..."
              onClick={handleSaveAsTemplate}
              shortcut="Ctrl+Shift+S"
            />
            <MenuItem
              icon={<Copy className="w-4 h-4" />}
              label="Duplicate"
              onClick={handleDuplicate}
              disabled
            />
            <MenuItem
              icon={<Archive className="w-4 h-4" />}
              label="Archive"
              onClick={handleArchive}
            />
            {/* Convert to... submenu */}
            {(() => {
              const targets = getConversionTargets(node.data.type)
              if (targets.length === 0) return null
              return (
                <>
                  <MenuSeparator />
                  <div className="px-3 py-1 text-[10px] font-medium gui-text-muted uppercase tracking-wider">
                    Convert to...
                  </div>
                  {targets.map(({ targetType, label }) => (
                    <MenuItem
                      key={targetType}
                      icon={<ArrowUpDown className="w-4 h-4" />}
                      label={label}
                      onClick={() => {
                        changeNodeType(target.nodeId, targetType)
                        close()
                      }}
                    />
                  ))}
                </>
              )
            })()}
            <MenuSeparator />
            <MenuItem
              icon={<Wand2 className="w-4 h-4" />}
              label="AI Edit..."
              onClick={() => {
                openAIEditor({ scope: 'single', targetNodeId: target.nodeId })
                close()
              }}
              shortcut="Ctrl+K"
            />
            {/* CC Bridge: Send to Claude Code (append-only, Phase 3 dispatch) */}
            <MenuItem
              icon={<Send className="w-4 h-4" />}
              label="Send to Claude Code"
              onClick={async () => {
                const store = useWorkspaceStore.getState()
                const targetNode = store.nodes.find((n) => n.id === target.nodeId)
                if (!targetNode) {
                  toast.error('Node not found')
                  close()
                  return
                }

                // Gather BFS context chain
                const contextText = store.getContextForNode(target.nodeId)

                // Build dispatch content from node data
                const nodeData = targetNode.data
                let content = ''
                let dispatchType: 'task' | 'context' | 'instruction' = 'instruction'
                const filePaths: string[] = []

                if (nodeData.type === 'task') {
                  const taskData = nodeData as import('@shared/types').TaskNodeData
                  content = `Task: ${taskData.title || 'Untitled'}\n`
                  if (taskData.description) content += `Description: ${taskData.description}\n`
                  content += `Status: ${taskData.status || 'todo'}\n`
                  content += `Priority: ${taskData.priority || 'medium'}\n`
                  dispatchType = 'task'
                } else if (nodeData.type === 'conversation') {
                  const convData = nodeData as import('@shared/types').ConversationNodeData
                  content = `Conversation: ${convData.title || 'Untitled'}\n`
                  if (convData.messages && convData.messages.length > 0) {
                    const lastMessages = convData.messages.slice(-5)
                    content += '\nRecent messages:\n'
                    for (const msg of lastMessages) {
                      content += `[${msg.role}]: ${typeof msg.content === 'string' ? msg.content.slice(0, 500) : '(complex content)'}\n`
                    }
                  }
                  dispatchType = 'context'
                } else if (nodeData.type === 'note') {
                  const noteData = nodeData as import('@shared/types').NoteNodeData
                  content = `Note: ${noteData.title || 'Untitled'}\n`
                  if (noteData.content) content += noteData.content.slice(0, 2000)
                  dispatchType = 'instruction'
                } else if (nodeData.type === 'artifact') {
                  const artifactData = nodeData as import('@shared/types').ArtifactNodeData
                  content = `Artifact: ${artifactData.title || 'Untitled'}\n`
                  content += `Type: ${artifactData.contentType || 'unknown'}\n`
                  if (artifactData.content) content += artifactData.content.slice(0, 2000)
                  dispatchType = 'context'
                } else {
                  content = `Node: ${(nodeData as { title?: string }).title || target.nodeId}`
                  dispatchType = 'instruction'
                }

                // Collect file paths from connected artifact nodes (Patent P2 Claim 5)
                const connectedNodes = store.getConnectedNodes(target.nodeId)
                for (const cn of connectedNodes) {
                  if (cn.data.type === 'artifact') {
                    const artData = cn.data as import('@shared/types').ArtifactNodeData
                    if (artData.files) {
                      for (const f of artData.files) {
                        if (f.filename) filePaths.push(f.filename)
                      }
                    }
                  }
                }

                const dispatch = {
                  id: crypto.randomUUID(),
                  type: dispatchType,
                  priority: 'normal' as const,
                  content,
                  contextNodeIds: [target.nodeId],
                  contextText: contextText ? contextText.slice(0, 16000) : undefined,
                  filePaths: filePaths.length > 0 ? filePaths : undefined,
                  sourceNodeId: target.nodeId,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  status: 'pending' as const,
                }

                try {
                  const result = await window.api.ccBridge.dispatchTask(dispatch)
                  if (result.success && result.dispatch) {
                    useCCBridgeStore.getState().addDispatch(result.dispatch)
                    toast.success('Dispatched to Claude Code')
                  } else {
                    toast.error(result.error || 'Failed to dispatch')
                  }
                } catch (err) {
                  toast.error('Failed to dispatch to Claude Code')
                  console.error('[ContextMenu] Dispatch error:', err)
                }
                close()
              }}
            />
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 className="w-4 h-4" />}
              label="Delete"
              onClick={handleDelete}
              danger
            />
          </>
        )
      }

      case 'nodes': {
        // Compute edge statistics for link/unlink items
        const nodeIdSet = new Set(target.nodeIds)
        const totalPairs = target.nodeIds.length * (target.nodeIds.length - 1) / 2
        const linkedPairs = edges.filter(
          (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
        ).length
        const unlinkedPairs = totalPairs - linkedPairs

        return (
          <>
            <div className="px-3 py-2 text-xs font-medium text-[var(--text-muted)]">
              {target.nodeIds.length} nodes selected
            </div>
            <MenuItem
              icon={<Save className="w-4 h-4" />}
              label="Save as Template..."
              onClick={handleSaveAsTemplate}
              shortcut="Ctrl+Shift+S"
            />
            <MenuItem
              icon={<Copy className="w-4 h-4" />}
              label="Duplicate All"
              onClick={handleDuplicate}
              disabled
            />
            <MenuItem
              icon={<Archive className="w-4 h-4" />}
              label="Archive Selected"
              onClick={handleArchive}
            />
            <MenuSeparator />
            <MenuItem
              icon={<Link2 className="w-4 h-4" />}
              label={`Link all together${unlinkedPairs > 0 ? ` (${unlinkedPairs})` : ''}`}
              onClick={() => {
                linkAllNodes(target.nodeIds)
                close()
              }}
              shortcut="Ctrl+L"
              disabled={unlinkedPairs === 0}
            />
            <MenuItem
              icon={<GitBranch className="w-4 h-4" />}
              label="Chain link (sequence)"
              onClick={() => {
                linkSelectedNodes(target.nodeIds)
                close()
              }}
            />
            <MenuItem
              icon={<Unlink2 className="w-4 h-4" />}
              label={`Unlink all${linkedPairs > 0 ? ` (${linkedPairs})` : ''}`}
              onClick={() => {
                unlinkSelectedNodes(target.nodeIds)
                close()
              }}
              shortcut="Ctrl+Shift+L"
              disabled={linkedPairs === 0}
            />
            <MenuSeparator />
            <MenuItem
              icon={<Wand2 className="w-4 h-4" />}
              label="AI Edit Selection..."
              onClick={() => {
                openAIEditor({ scope: 'selection' })
                close()
              }}
              shortcut="Ctrl+K"
            />
            <MenuSeparator />
            <div className="px-3 py-1">
              <span className="text-xs text-[var(--text-secondary)] px-0">Color</span>
              <div className="flex flex-wrap gap-1 py-1">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    className="w-5 h-5 rounded-full border border-white/20 hover:scale-125 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      updateBulkNodes(target.nodeIds, { color })
                      close()
                    }}
                  />
                ))}
                <button
                  className="px-1.5 h-5 rounded text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel-secondary)] transition-colors"
                  onClick={() => {
                    updateBulkNodes(target.nodeIds, { color: undefined })
                    close()
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 className="w-4 h-4" />}
              label="Delete All"
              onClick={handleDelete}
              danger
            />
          </>
        )
      }

      case 'project-body':
        return (
          <>
            <div className="px-3 py-2 text-xs font-medium text-[var(--text-muted)] uppercase">Add to Project</div>
            <MenuItem
              icon={<MessageSquare className="w-4 h-4" />}
              label="New Conversation"
              onClick={() => handleAddNodeToProject('conversation')}
            />
            <MenuItem
              icon={<FileText className="w-4 h-4" />}
              label="New Note"
              onClick={() => handleAddNodeToProject('note')}
            />
            <MenuItem
              icon={<CheckSquare className="w-4 h-4" />}
              label="New Task"
              onClick={() => handleAddNodeToProject('task')}
            />
            <MenuItem
              icon={<Code className="w-4 h-4" />}
              label="New Artifact"
              onClick={() => handleAddNodeToProject('artifact')}
            />
            <MenuItem
              icon={<Zap className="w-4 h-4" />}
              label="New Action"
              onClick={() => handleAddNodeToProject('action')}
            />
            <MenuItem
              icon={<Type className="w-4 h-4" />}
              label="New Text"
              onClick={() => handleAddNodeToProject('text')}
            />
            <MenuItem
              icon={<Workflow className="w-4 h-4" />}
              label="New Orchestrator"
              onClick={() => handleAddNodeToProject('orchestrator')}
            />
          </>
        )

      case 'edge': {
        const edge = edges.find(e => e.id === target.edgeId)
        const edgeData = edge?.data || {}
        const hasWaypoints = (edgeData.waypoints && edgeData.waypoints.length > 0) ||
          (edgeData.centerOffset && (Math.abs(edgeData.centerOffset.x) > 5 || Math.abs(edgeData.centerOffset.y) > 5))

        return (
          <>
            {target.position && (
              <MenuItem
                icon={<Plus className="w-4 h-4" />}
                label="Add Waypoint Here"
                onClick={() => {
                  const updateEdge = useWorkspaceStore.getState().updateEdge
                  const currentWaypoints = edgeData.waypoints || []
                  const newWaypoint = { x: target.position!.x, y: target.position!.y }

                  if (currentWaypoints.length >= 20) {
                    toast.error('Maximum waypoints (20) reached')
                    close()
                    return
                  }

                  updateEdge(target.edgeId, {
                    waypoints: [...currentWaypoints, newWaypoint],
                    centerOffset: undefined
                  })
                  close()
                }}
              />
            )}
            <MenuItem
              icon={<RotateCcw className="w-4 h-4" />}
              label="Reset Path"
              onClick={() => {
                const updateEdge = useWorkspaceStore.getState().updateEdge
                updateEdge(target.edgeId, {
                  waypoints: undefined,
                  centerOffset: { x: 0, y: 0 }
                })
                close()
              }}
              disabled={!hasWaypoints}
            />
            <MenuSeparator />
            <MenuItem
              icon={<ArrowUpDown className="w-4 h-4" />}
              label="Reverse Direction"
              onClick={() => {
                reverseEdge(target.edgeId)
                close()
              }}
            />
            <MenuItem
              icon={<Settings2 className="w-4 h-4" />}
              label="Properties"
              onClick={() => {
                // Select edge to open properties panel
                setSelectedEdges([target.edgeId])
                close()
              }}
            />
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 className="w-4 h-4" />}
              label="Delete Connection"
              onClick={handleDelete}
              danger
            />
          </>
        )
      }

      case 'waypoint': {
        const edge = edges.find(e => e.id === target.edgeId)
        const edgeData = edge?.data || {}
        const waypoints = edgeData.waypoints || []
        const waypoint = waypoints[target.waypointIndex]

        // Snap to grid helper (20px grid)
        const snapToGrid = (val: number): number => Math.round(val / 20) * 20

        return (
          <>
            <div className="px-3 py-2 text-xs font-medium text-[var(--text-muted)]">
              Waypoint {target.waypointIndex + 1}
            </div>
            <MenuItem
              icon={<Trash2 className="w-4 h-4" />}
              label="Remove Waypoint"
              onClick={() => {
                const updateEdge = useWorkspaceStore.getState().updateEdge
                const newWaypoints = [...waypoints]
                newWaypoints.splice(target.waypointIndex, 1)
                updateEdge(target.edgeId, {
                  waypoints: newWaypoints.length > 0 ? newWaypoints : undefined,
                  centerOffset: newWaypoints.length === 0 ? { x: 0, y: 0 } : undefined
                })
                close()
              }}
              shortcut="Del"
              danger
            />
            <MenuItem
              icon={<RotateCcw className="w-4 h-4" />}
              label="Straighten Edge"
              onClick={() => {
                const updateEdge = useWorkspaceStore.getState().updateEdge
                updateEdge(target.edgeId, {
                  waypoints: undefined,
                  centerOffset: { x: 0, y: 0 }
                })
                toast('Edge straightened', { duration: 1500, icon: '📏' })
                close()
              }}
              shortcut="Dbl-click"
              disabled={waypoints.length === 0}
            />
            <MenuSeparator />
            <MenuItem
              icon={<Settings2 className="w-4 h-4" />}
              label="Snap to Grid"
              onClick={() => {
                if (!waypoint) return
                const updateEdge = useWorkspaceStore.getState().updateEdge
                const newWaypoints = [...waypoints]
                newWaypoints[target.waypointIndex] = {
                  x: snapToGrid(waypoint.x),
                  y: snapToGrid(waypoint.y)
                }
                updateEdge(target.edgeId, { waypoints: newWaypoints })
                close()
              }}
              disabled={!waypoint}
            />
            <MenuItem
              icon={<Copy className="w-4 h-4" />}
              label="Duplicate Waypoint"
              onClick={() => {
                if (!waypoint || waypoints.length >= 20) {
                  if (waypoints.length >= 20) {
                    toast.error('Maximum waypoints (20) reached')
                  }
                  close()
                  return
                }
                const updateEdge = useWorkspaceStore.getState().updateEdge
                const newWaypoints = [...waypoints]
                // Insert duplicate 20px offset
                newWaypoints.splice(target.waypointIndex + 1, 0, {
                  x: waypoint.x + 20,
                  y: waypoint.y + 20
                })
                updateEdge(target.edgeId, { waypoints: newWaypoints })
                close()
              }}
              disabled={!waypoint || waypoints.length >= 20}
            />
          </>
        )
      }
    }
  }

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="min-w-[180px] gui-z-dropdowns bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-lg shadow-xl py-1"
    >
      {renderMenuItems()}
    </div>
  )
}

export const ContextMenu = memo(ContextMenuComponent)
