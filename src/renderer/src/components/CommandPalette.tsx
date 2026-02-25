/**
 * Command Palette
 *
 * Full Cmd+K implementation for quick access to all app actions.
 * Uses shadcn CommandDialog (cmdk + Radix Dialog) for built-in keyboard navigation,
 * focus trap, and portal rendering.
 */

import { memo, useState, useCallback, useEffect, useMemo } from 'react'
import {
  MessageSquare,
  Bot,
  FileText,
  CheckSquare,
  Folder,
  Code,
  Boxes,
  Wand2,
  Save,
  FolderOpen,
  Plus,
  Undo2,
  Redo2,
  Copy,
  Scissors,
  ClipboardPaste,
  Link,
  Unlink,
  Layers,
  Zap,
  Eye,
  EyeOff,
  Keyboard,
  Sparkles,
  Pencil,
  LayoutGrid,
  Layout,
  HelpCircle,
  MapPin,
  GraduationCap,
  Workflow
} from 'lucide-react'
import { useWorkspaceStore, getHistoryActionLabel } from '../stores/workspaceStore'
import type { NodeData } from '@shared/types'
import { useTemplateStore } from '../stores/templateStore'
import { useAIEditorStore } from '../stores/aiEditorStore'
import { useProgramStore } from '../stores/programStore'
import { sciFiToast } from './ui/SciFiToast'
import { useShortcutHelpStore } from './KeyboardShortcutsHelp'
import { useReactFlow } from '@xyflow/react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from './ui'

interface CommandItemData {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  category: 'create' | 'edit' | 'view' | 'workspace' | 'tools' | 'ai' | 'nodes'
  shortcut?: string
  action: () => void
  disabled?: boolean
}

// Store for command palette state
interface CommandPaletteState {
  isOpen: boolean
  openPalette: () => void
  closePalette: () => void
  togglePalette: () => void
}

let commandPaletteState: CommandPaletteState | null = null

export function useCommandPalette(): CommandPaletteState {
  const [isOpen, setIsOpen] = useState(false)

  const openPalette = useCallback(() => {
    setIsOpen(true)
    window.dispatchEvent(new CustomEvent('command-palette-opened'))
  }, [])
  const closePalette = useCallback(() => setIsOpen(false), [])
  const togglePalette = useCallback(() => setIsOpen(prev => !prev), [])

  // Store reference for external access
  commandPaletteState = { isOpen, openPalette, closePalette, togglePalette }

  return { isOpen, openPalette, closePalette, togglePalette }
}

export function getCommandPaletteState(): CommandPaletteState | null {
  return commandPaletteState
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

const categoryLabels: Record<string, string> = {
  create: 'Create',
  edit: 'Edit',
  view: 'View',
  tools: 'Tools',
  workspace: 'Workspace',
  ai: 'AI Commands',
  nodes: 'Go to Node'
}

function CommandPaletteComponent({ isOpen, onClose }: CommandPaletteProps): JSX.Element {
  const { screenToFlowPosition, setCenter } = useReactFlow()

  // Workspace actions
  const addNode = useWorkspaceStore(state => state.addNode)
  const addAgentNode = useWorkspaceStore(state => state.addAgentNode)
  const nodes = useWorkspaceStore(state => state.nodes)
  const setSelectedNodes = useWorkspaceStore(state => state.setSelectedNodes)
  const undo = useWorkspaceStore(state => state.undo)
  const redo = useWorkspaceStore(state => state.redo)
  const history = useWorkspaceStore(state => state.history)
  const historyIndex = useWorkspaceStore(state => state.historyIndex)
  const selectedNodeIds = useWorkspaceStore(state => state.selectedNodeIds)
  const copyNodes = useWorkspaceStore(state => state.copyNodes)
  const cutNodes = useWorkspaceStore(state => state.cutNodes)
  const pasteNodes = useWorkspaceStore(state => state.pasteNodes)
  const clipboardState = useWorkspaceStore(state => state.clipboardState)
  const linkAllNodes = useWorkspaceStore(state => state.linkAllNodes)
  const unlinkSelectedNodes = useWorkspaceStore(state => state.unlinkSelectedNodes)
  const toggleLeftSidebar = useWorkspaceStore(state => state.toggleLeftSidebar)
  const leftSidebarOpen = useWorkspaceStore(state => state.leftSidebarOpen)
  const focusModeNodeId = useWorkspaceStore(state => state.focusModeNodeId)
  const toggleFocusMode = useWorkspaceStore(state => state.toggleFocusMode)
  const getWorkspaceData = useWorkspaceStore(state => state.getWorkspaceData)
  const markClean = useWorkspaceStore(state => state.markClean)
  const newWorkspace = useWorkspaceStore(state => state.newWorkspace)

  // Template store
  const openTemplateBrowser = useTemplateStore(state => state.openBrowser)

  // AI Editor store
  const openAIEditor = useAIEditorStore(state => state.openModal)

  // Search state for node results
  const [search, setSearch] = useState('')

  // Reset search when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearch('')
    }
  }, [isOpen])

  // Build commands list
  const commands: CommandItemData[] = useMemo(() => {
    const getViewportCenter = () => screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    })

    return [
      // Create commands
      {
        id: 'create-conversation',
        label: 'New Conversation',
        description: 'Create a new AI conversation node',
        icon: MessageSquare,
        category: 'create',
        action: () => { addNode('conversation', getViewportCenter()); onClose() }
      },
      {
        id: 'create-agent',
        label: 'New Agent',
        description: 'Create an autonomous agent node',
        icon: Bot,
        category: 'create',
        action: () => { addAgentNode(getViewportCenter()); onClose() }
      },
      {
        id: 'create-note',
        label: 'New Note',
        description: 'Create a new note node',
        icon: FileText,
        category: 'create',
        action: () => { addNode('note', getViewportCenter()); onClose() }
      },
      {
        id: 'create-task',
        label: 'New Task',
        description: 'Create a new task node',
        icon: CheckSquare,
        category: 'create',
        action: () => { addNode('task', getViewportCenter()); onClose() }
      },
      {
        id: 'create-project',
        label: 'New Project',
        description: 'Create a new project container',
        icon: Folder,
        category: 'create',
        action: () => { addNode('project', getViewportCenter()); onClose() }
      },
      {
        id: 'create-artifact',
        label: 'New Artifact',
        description: 'Create a new code/content artifact',
        icon: Code,
        category: 'create',
        action: () => { addNode('artifact', getViewportCenter()); onClose() }
      },
      {
        id: 'create-workspace',
        label: 'New Workspace Node',
        description: 'Create a workspace context container',
        icon: Boxes,
        category: 'create',
        action: () => { addNode('workspace', getViewportCenter()); onClose() }
      },
      {
        id: 'create-action',
        label: 'New Action',
        description: 'Create an automation action node',
        icon: Zap,
        category: 'create',
        action: () => { addNode('action', getViewportCenter()); onClose() }
      },
      {
        id: 'create-orchestrator',
        label: 'New Orchestrator',
        description: 'Create an AI orchestration pipeline',
        icon: Workflow,
        category: 'create',
        action: () => { addNode('orchestrator', getViewportCenter()); onClose() }
      },

      // Edit commands
      {
        id: 'undo',
        label: 'Undo',
        description: historyIndex >= 0 ? `Undo: ${getHistoryActionLabel(history[historyIndex]!)}` : 'Nothing to undo',
        icon: Undo2,
        category: 'edit',
        shortcut: 'Ctrl+Z',
        disabled: historyIndex < 0,
        action: () => { if (historyIndex >= 0) { undo(); onClose() } }
      },
      {
        id: 'redo',
        label: 'Redo',
        description: historyIndex < history.length - 1 ? `Redo: ${getHistoryActionLabel(history[historyIndex + 1]!)}` : 'Nothing to redo',
        icon: Redo2,
        category: 'edit',
        shortcut: 'Ctrl+Shift+Z',
        disabled: historyIndex >= history.length - 1,
        action: () => { if (historyIndex < history.length - 1) { redo(); onClose() } }
      },
      {
        id: 'copy',
        label: 'Copy Selection',
        description: 'Copy selected nodes',
        icon: Copy,
        category: 'edit',
        shortcut: 'Ctrl+C',
        disabled: selectedNodeIds.length === 0,
        action: () => { if (selectedNodeIds.length > 0) { copyNodes(selectedNodeIds); onClose() } }
      },
      {
        id: 'cut',
        label: 'Cut Selection',
        description: 'Cut selected nodes',
        icon: Scissors,
        category: 'edit',
        shortcut: 'Ctrl+X',
        disabled: selectedNodeIds.length === 0,
        action: () => { if (selectedNodeIds.length > 0) { cutNodes(selectedNodeIds); onClose() } }
      },
      {
        id: 'paste',
        label: 'Paste',
        description: 'Paste copied nodes',
        icon: ClipboardPaste,
        category: 'edit',
        shortcut: 'Ctrl+V',
        disabled: !clipboardState,
        action: () => { if (clipboardState) { pasteNodes(getViewportCenter()); onClose() } }
      },
      {
        id: 'link-nodes',
        label: 'Link Selected Nodes',
        description: 'Connect all selected nodes',
        icon: Link,
        category: 'edit',
        shortcut: 'Ctrl+L',
        disabled: selectedNodeIds.length < 2,
        action: () => { if (selectedNodeIds.length >= 2) { linkAllNodes(selectedNodeIds); onClose() } }
      },
      {
        id: 'unlink-nodes',
        label: 'Unlink Selected Nodes',
        description: 'Remove connections between selected nodes',
        icon: Unlink,
        category: 'edit',
        shortcut: 'Ctrl+Shift+L',
        disabled: selectedNodeIds.length < 2,
        action: () => { if (selectedNodeIds.length >= 2) { unlinkSelectedNodes(selectedNodeIds); onClose() } }
      },

      // View commands
      {
        id: 'toggle-outline',
        label: leftSidebarOpen ? 'Hide Outline Panel' : 'Show Outline Panel',
        description: 'Toggle the outline/layers sidebar',
        icon: Layers,
        category: 'view',
        shortcut: 'Ctrl+\\',
        action: () => { toggleLeftSidebar(); onClose() }
      },
      {
        id: 'toggle-focus-mode',
        label: focusModeNodeId ? 'Exit Focus Mode' : 'Enter Focus Mode',
        description: focusModeNodeId
          ? 'Exit focus mode and show all nodes'
          : selectedNodeIds.length === 1
            ? 'Dim all nodes except the selected one'
            : 'Select a single node to focus on it',
        icon: focusModeNodeId ? EyeOff : Eye,
        category: 'view',
        shortcut: 'F',
        disabled: !focusModeNodeId && selectedNodeIds.length !== 1,
        action: () => {
          toggleFocusMode()
          onClose()
          if (focusModeNodeId) {
            sciFiToast('Focus mode disabled', 'info')
          } else if (selectedNodeIds.length === 1) {
            sciFiToast('Focus mode enabled — press F to exit', 'success')
          }
        }
      },
      {
        id: 'keyboard-shortcuts',
        label: 'Keyboard Shortcuts',
        description: 'Show all keyboard shortcuts',
        icon: Keyboard,
        category: 'view',
        shortcut: '?',
        action: () => { onClose(); useShortcutHelpStore.getState().open() }
      },

      // Tools commands
      {
        id: 'ai-editor',
        label: 'AI Workspace Editor',
        description: 'Open AI-powered workspace editor',
        icon: Wand2,
        category: 'tools',
        shortcut: 'Ctrl+E',
        action: () => { onClose(); openAIEditor() }
      },
      {
        id: 'template-browser',
        label: 'Browse Templates',
        description: 'Open template library',
        icon: Layout,
        category: 'tools',
        shortcut: 'Ctrl+T',
        action: () => { onClose(); openTemplateBrowser() }
      },
      {
        id: 'starter-template',
        label: 'New from Starter Template',
        description: 'Populate workspace with a pre-built layout',
        icon: Layout,
        category: 'workspace',
        action: () => { onClose(); window.dispatchEvent(new CustomEvent('open-template-picker')) }
      },

      // AI commands
      {
        id: 'ai:generate',
        label: 'AI: Generate Content',
        description: 'Create new nodes, ideas, or content with AI',
        icon: Sparkles,
        category: 'ai',
        action: () => { onClose(); openAIEditor({ mode: 'generate' }) }
      },
      {
        id: 'ai:edit',
        label: 'AI: Edit Selection',
        description: 'Modify, refine, or improve selected nodes',
        icon: Pencil,
        category: 'ai',
        disabled: selectedNodeIds.length === 0,
        action: () => { onClose(); openAIEditor({ mode: 'edit', scope: 'selection' }) }
      },
      {
        id: 'ai:organize',
        label: 'AI: Organize Layout',
        description: 'Arrange and structure connected nodes',
        icon: LayoutGrid,
        category: 'ai',
        action: () => { onClose(); openAIEditor({ mode: 'organize' }) }
      },
      {
        id: 'ai:automate',
        label: 'AI: Create Automation',
        description: 'Set up triggers and workflows',
        icon: Zap,
        category: 'ai',
        action: () => { onClose(); openAIEditor({ mode: 'automate' }) }
      },
      {
        id: 'ai:ask',
        label: 'AI: Ask Question',
        description: 'Query your workspace or get insights',
        icon: HelpCircle,
        category: 'ai',
        action: () => { onClose(); openAIEditor({ mode: 'ask' }) }
      },
      {
        id: 'ai:summarize',
        label: 'AI: Summarize Selection',
        description: 'Get a summary of selected nodes',
        icon: FileText,
        category: 'ai',
        disabled: selectedNodeIds.length === 0,
        action: () => {
          onClose()
          openAIEditor({
            mode: 'ask',
            scope: 'selection',
            prompt: 'Summarize the content of these selected notes'
          })
        }
      },

      // Tutorial
      {
        id: 'start-tutorial',
        label: 'Start Interactive Tutorial',
        description: 'Learn the core workflow in 3 minutes',
        icon: GraduationCap,
        category: 'tools',
        action: () => { onClose(); useProgramStore.getState().startTutorial() }
      },

      // Workspace commands
      {
        id: 'save',
        label: 'Save Workspace',
        description: 'Save current workspace',
        icon: Save,
        category: 'workspace',
        shortcut: 'Ctrl+S',
        action: async () => {
          const data = getWorkspaceData()
          const result = await window.api.workspace.save(data)
          if (result.success) {
            markClean()
            sciFiToast('Workspace saved', 'success')
          }
          onClose()
        }
      },
      {
        id: 'new-workspace',
        label: 'New Workspace',
        description: 'Create a new workspace',
        icon: Plus,
        category: 'workspace',
        shortcut: 'Ctrl+N',
        action: () => {
          newWorkspace()
          sciFiToast('New workspace created', 'success')
          onClose()
        }
      },
      {
        id: 'open-workspace',
        label: 'Open Workspace',
        description: 'Open workspace from file',
        icon: FolderOpen,
        category: 'workspace',
        shortcut: 'Ctrl+O',
        action: async () => {
          onClose()
          window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'o',
            ctrlKey: true,
            metaKey: true
          }))
        }
      }
    ]
  }, [
    addNode, screenToFlowPosition, onClose, undo, redo, history, historyIndex,
    selectedNodeIds, copyNodes, cutNodes, pasteNodes, clipboardState,
    linkAllNodes, unlinkSelectedNodes, toggleLeftSidebar, leftSidebarOpen,
    focusModeNodeId, toggleFocusMode,
    openAIEditor, openTemplateBrowser, getWorkspaceData, markClean, newWorkspace
  ])

  // Node type to icon mapping for "Go to Node" results
  const nodeTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = useMemo(() => ({
    conversation: MessageSquare,
    note: FileText,
    task: CheckSquare,
    project: Folder,
    artifact: Code,
    workspace: Boxes,
    action: Zap,
    text: FileText
  }), [])

  // Build dynamic node search results (only when searching)
  const nodeResults: CommandItemData[] = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return []
    const query = search.toLowerCase()

    return nodes
      .filter(node => {
        const data = node.data as NodeData
        const title = (data.title || data.label || '').toLowerCase()
        const type = data.type.toLowerCase()
        return title.includes(query) || type.includes(query)
      })
      .slice(0, 8)
      .map(node => {
        const data = node.data as NodeData
        const title = data.title || data.label || `Untitled ${data.type}`
        const Icon = nodeTypeIcons[data.type] || MapPin

        return {
          id: `goto-${node.id}`,
          label: title,
          description: `${data.type} node`,
          icon: Icon,
          category: 'nodes' as const,
          action: () => {
            const nodeWidth = node.measured?.width || 280
            const nodeHeight = node.measured?.height || 140
            setCenter(
              node.position.x + nodeWidth / 2,
              node.position.y + nodeHeight / 2,
              { duration: 300, zoom: 1 }
            )
            setSelectedNodes([node.id])
            onClose()
          }
        }
      })
  }, [search, nodes, nodeTypeIcons, setCenter, setSelectedNodes, onClose])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItemData[]> = {}
    for (const cmd of commands) {
      if (!groups[cmd.category]) groups[cmd.category] = []
      groups[cmd.category]!.push(cmd)
    }
    // Add node results as a separate group
    if (nodeResults.length > 0) {
      groups['nodes'] = nodeResults
    }
    return groups
  }, [commands, nodeResults])

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No commands found</CommandEmpty>
        {Object.entries(groupedCommands).map(([category, items]) => (
          <CommandGroup key={category} heading={categoryLabels[category] || category}>
            {items.map(cmd => {
              const Icon = cmd.icon
              return (
                <CommandItem
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.description || ''}`}
                  onSelect={() => { if (!cmd.disabled) cmd.action() }}
                  disabled={cmd.disabled}
                  className="gap-3"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{cmd.label}</div>
                    {cmd.description && (
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {cmd.description}
                      </div>
                    )}
                  </div>
                  {cmd.shortcut && (
                    <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}

export const CommandPalette = memo(CommandPaletteComponent)
