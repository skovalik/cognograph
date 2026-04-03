// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useCommandRegistry — shared slash-command registry.
 *
 * Extracts the command list from CommandPalette so that both the full
 * Cmd+K dialog and the BottomCommandBar prefix router can consume the
 * same set of actions.  Only the commands themselves are defined here;
 * the UI rendering is the caller's responsibility.
 */

import {
  Bot,
  Boxes,
  CheckSquare,
  ClipboardPaste,
  Code,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Keyboard,
  Layers,
  Layout,
  LayoutGrid,
  Link,
  MessageSquare,
  Pencil,
  Plus,
  Redo2,
  Save,
  Scissors,
  Sparkles,
  Undo2,
  Unlink,
  Wand2,
  Workflow,
  Zap,
} from 'lucide-react'
import { useMemo } from 'react'
import { useShortcutHelpStore } from '../components/KeyboardShortcutsHelp'
import { sciFiToast } from '../components/ui/SciFiToast'
import { useAIEditorStore } from '../stores/aiEditorStore'
import { useProgramStore } from '../stores/programStore'
import { useTemplateStore } from '../stores/templateStore'
import { getHistoryActionLabel, useWorkspaceStore } from '../stores/workspaceStore'

// ── Types ──

export type CommandCategory = 'create' | 'edit' | 'view' | 'workspace' | 'tools' | 'ai'

export interface CommandRegistryItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  category: CommandCategory
  shortcut?: string
  action: () => void
  disabled?: boolean
  /** Slash alias, e.g. "note" so the user can type /note */
  alias?: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  create: 'Create',
  edit: 'Edit',
  view: 'View',
  tools: 'Tools',
  workspace: 'Workspace',
  ai: 'AI Commands',
}

// ── Hook ──

interface UseCommandRegistryOpts {
  /** Function to call when a command finishes (e.g. close palette). */
  onDone?: () => void
  /** screenToFlowPosition from useReactFlow — needed for viewport-center creation. */
  screenToFlowPosition?: (pos: { x: number; y: number }) => { x: number; y: number }
}

export function useCommandRegistry(opts: UseCommandRegistryOpts = {}): CommandRegistryItem[] {
  const { onDone = () => {}, screenToFlowPosition } = opts

  const addNode = useWorkspaceStore((s) => s.addNode)
  const addAgentNode = useWorkspaceStore((s) => s.addAgentNode)
  const undo = useWorkspaceStore((s) => s.undo)
  const redo = useWorkspaceStore((s) => s.redo)
  const history = useWorkspaceStore((s) => s.history)
  const historyIndex = useWorkspaceStore((s) => s.historyIndex)
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const copyNodes = useWorkspaceStore((s) => s.copyNodes)
  const cutNodes = useWorkspaceStore((s) => s.cutNodes)
  const pasteNodes = useWorkspaceStore((s) => s.pasteNodes)
  const clipboardState = useWorkspaceStore((s) => s.clipboardState)
  const linkAllNodes = useWorkspaceStore((s) => s.linkAllNodes)
  const unlinkSelectedNodes = useWorkspaceStore((s) => s.unlinkSelectedNodes)
  const toggleLeftSidebar = useWorkspaceStore((s) => s.toggleLeftSidebar)
  const leftSidebarOpen = useWorkspaceStore((s) => s.leftSidebarOpen)
  const focusModeNodeId = useWorkspaceStore((s) => s.focusModeNodeId)
  const toggleFocusMode = useWorkspaceStore((s) => s.toggleFocusMode)
  const getWorkspaceData = useWorkspaceStore((s) => s.getWorkspaceData)
  const markClean = useWorkspaceStore((s) => s.markClean)
  const newWorkspace = useWorkspaceStore((s) => s.newWorkspace)

  const openTemplateBrowser = useTemplateStore((s) => s.openBrowser)
  const openAIEditor = useAIEditorStore((s) => s.openModal)

  return useMemo(() => {
    const getViewportCenter = () =>
      screenToFlowPosition
        ? screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
        : { x: 400 + Math.random() * 200, y: 300 + Math.random() * 200 }

    const cmds: CommandRegistryItem[] = [
      // ── Create ──
      {
        id: 'create-conversation',
        label: 'New Conversation',
        alias: 'conversation',
        description: 'Create a new AI conversation node',
        icon: MessageSquare,
        category: 'create',
        action: () => {
          addNode('conversation', getViewportCenter())
          onDone()
        },
      },
      {
        id: 'create-agent',
        label: 'New Agent',
        alias: 'agent',
        description: 'Create an autonomous agent node',
        icon: Bot,
        category: 'create',
        action: () => {
          addAgentNode(getViewportCenter())
          onDone()
        },
      },
      {
        id: 'create-note',
        label: 'New Note',
        alias: 'note',
        description: 'Create a new note node',
        icon: FileText,
        category: 'create',
        action: () => {
          addNode('note', getViewportCenter())
          onDone()
        },
      },
      {
        id: 'create-task',
        label: 'New Task',
        alias: 'task',
        description: 'Create a new task node',
        icon: CheckSquare,
        category: 'create',
        action: () => {
          addNode('task', getViewportCenter())
          onDone()
        },
      },
      {
        id: 'create-project',
        label: 'New Project',
        alias: 'project',
        description: 'Create a new project container',
        icon: Folder,
        category: 'create',
        action: () => {
          addNode('project', getViewportCenter())
          onDone()
        },
      },
      {
        id: 'create-artifact',
        label: 'New Artifact',
        alias: 'artifact',
        description: 'Create a new code/content artifact',
        icon: Code,
        category: 'create',
        action: () => {
          addNode('artifact', getViewportCenter())
          onDone()
        },
      },
      {
        id: 'create-workspace',
        label: 'New Workspace Node',
        alias: 'workspace',
        description: 'Create a workspace context container',
        icon: Boxes,
        category: 'create',
        action: () => {
          addNode('workspace', getViewportCenter())
          onDone()
        },
      },
      {
        id: 'create-action',
        label: 'New Action',
        alias: 'action',
        description: 'Create an automation action node',
        icon: Zap,
        category: 'create',
        action: () => {
          addNode('action', getViewportCenter())
          onDone()
        },
      },
      {
        id: 'create-orchestrator',
        label: 'New Orchestrator',
        alias: 'orchestrator',
        description: 'Create an AI orchestration pipeline',
        icon: Workflow,
        category: 'create',
        action: () => {
          addNode('orchestrator', getViewportCenter())
          onDone()
        },
      },

      // ── Edit ──
      {
        id: 'undo',
        label: 'Undo',
        alias: 'undo',
        description:
          historyIndex >= 0
            ? `Undo: ${getHistoryActionLabel(history[historyIndex]!)}`
            : 'Nothing to undo',
        icon: Undo2,
        category: 'edit',
        shortcut: 'Ctrl+Z',
        disabled: historyIndex < 0,
        action: () => {
          if (historyIndex >= 0) {
            undo()
            onDone()
          }
        },
      },
      {
        id: 'redo',
        label: 'Redo',
        alias: 'redo',
        description:
          historyIndex < history.length - 1
            ? `Redo: ${getHistoryActionLabel(history[historyIndex + 1]!)}`
            : 'Nothing to redo',
        icon: Redo2,
        category: 'edit',
        shortcut: 'Ctrl+Shift+Z',
        disabled: historyIndex >= history.length - 1,
        action: () => {
          if (historyIndex < history.length - 1) {
            redo()
            onDone()
          }
        },
      },
      {
        id: 'copy',
        label: 'Copy Selection',
        alias: 'copy',
        description: 'Copy selected nodes',
        icon: Copy,
        category: 'edit',
        shortcut: 'Ctrl+C',
        disabled: selectedNodeIds.length === 0,
        action: () => {
          if (selectedNodeIds.length > 0) {
            copyNodes(selectedNodeIds)
            onDone()
          }
        },
      },
      {
        id: 'cut',
        label: 'Cut Selection',
        alias: 'cut',
        description: 'Cut selected nodes',
        icon: Scissors,
        category: 'edit',
        shortcut: 'Ctrl+X',
        disabled: selectedNodeIds.length === 0,
        action: () => {
          if (selectedNodeIds.length > 0) {
            cutNodes(selectedNodeIds)
            onDone()
          }
        },
      },
      {
        id: 'paste',
        label: 'Paste',
        alias: 'paste',
        description: 'Paste copied nodes',
        icon: ClipboardPaste,
        category: 'edit',
        shortcut: 'Ctrl+V',
        disabled: !clipboardState,
        action: () => {
          if (clipboardState) {
            pasteNodes(getViewportCenter())
            onDone()
          }
        },
      },
      {
        id: 'link-nodes',
        label: 'Link Selected Nodes',
        alias: 'link',
        description: 'Connect all selected nodes',
        icon: Link,
        category: 'edit',
        shortcut: 'Ctrl+L',
        disabled: selectedNodeIds.length < 2,
        action: () => {
          if (selectedNodeIds.length >= 2) {
            linkAllNodes(selectedNodeIds)
            onDone()
          }
        },
      },
      {
        id: 'unlink-nodes',
        label: 'Unlink Selected Nodes',
        alias: 'unlink',
        description: 'Remove connections between selected nodes',
        icon: Unlink,
        category: 'edit',
        shortcut: 'Ctrl+Shift+L',
        disabled: selectedNodeIds.length < 2,
        action: () => {
          if (selectedNodeIds.length >= 2) {
            unlinkSelectedNodes(selectedNodeIds)
            onDone()
          }
        },
      },

      // ── View ──
      {
        id: 'toggle-outline',
        label: leftSidebarOpen ? 'Hide Outline Panel' : 'Show Outline Panel',
        alias: 'outline',
        description: 'Toggle the outline/layers sidebar',
        icon: Layers,
        category: 'view',
        shortcut: 'Ctrl+\\',
        action: () => {
          toggleLeftSidebar()
          onDone()
        },
      },
      {
        id: 'toggle-focus-mode',
        label: focusModeNodeId ? 'Exit Focus Mode' : 'Enter Focus Mode',
        alias: 'focus',
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
          onDone()
          if (focusModeNodeId) {
            sciFiToast('Focus mode disabled', 'info')
          } else if (selectedNodeIds.length === 1) {
            sciFiToast('Focus mode enabled — press F to exit', 'success')
          }
        },
      },
      {
        id: 'keyboard-shortcuts',
        label: 'Keyboard Shortcuts',
        alias: 'shortcuts',
        description: 'Show all keyboard shortcuts',
        icon: Keyboard,
        category: 'view',
        shortcut: '?',
        action: () => {
          onDone()
          useShortcutHelpStore.getState().open()
        },
      },

      // ── Tools ──
      {
        id: 'ai-editor',
        label: 'AI Workspace Editor',
        alias: 'ai-editor',
        description: 'Open AI-powered workspace editor',
        icon: Wand2,
        category: 'tools',
        shortcut: 'Ctrl+E',
        action: () => {
          onDone()
          openAIEditor()
        },
      },
      {
        id: 'template-browser',
        label: 'Browse Templates',
        alias: 'templates',
        description: 'Open template library',
        icon: Layout,
        category: 'tools',
        shortcut: 'Ctrl+T',
        action: () => {
          onDone()
          openTemplateBrowser()
        },
      },
      {
        id: 'starter-template',
        label: 'New from Starter Template',
        alias: 'starter',
        description: 'Populate workspace with a pre-built layout',
        icon: Layout,
        category: 'workspace',
        action: () => {
          onDone()
          window.dispatchEvent(new CustomEvent('open-template-picker'))
        },
      },
      {
        id: 'start-tutorial',
        label: 'Start Interactive Tutorial',
        alias: 'tutorial',
        description: 'Learn the core workflow in 3 minutes',
        icon: GraduationCap,
        category: 'tools',
        action: () => {
          onDone()
          useProgramStore.getState().startTutorial()
        },
      },

      // ── AI ──
      {
        id: 'ai:generate',
        label: 'AI: Generate Content',
        alias: 'generate',
        description: 'Create new nodes, ideas, or content with AI',
        icon: Sparkles,
        category: 'ai',
        action: () => {
          onDone()
          openAIEditor({ mode: 'generate' })
        },
      },
      {
        id: 'ai:edit',
        label: 'AI: Edit Selection',
        alias: 'edit',
        description: 'Modify, refine, or improve selected nodes',
        icon: Pencil,
        category: 'ai',
        disabled: selectedNodeIds.length === 0,
        action: () => {
          onDone()
          openAIEditor({ mode: 'edit', scope: 'selection' })
        },
      },
      {
        id: 'ai:organize',
        label: 'AI: Organize Layout',
        alias: 'organize',
        description: 'Arrange and structure connected nodes',
        icon: LayoutGrid,
        category: 'ai',
        action: () => {
          onDone()
          openAIEditor({ mode: 'organize' })
        },
      },
      {
        id: 'ai:automate',
        label: 'AI: Create Automation',
        alias: 'automate',
        description: 'Set up triggers and workflows',
        icon: Zap,
        category: 'ai',
        action: () => {
          onDone()
          openAIEditor({ mode: 'automate' })
        },
      },
      {
        id: 'ai:ask',
        label: 'AI: Ask Question',
        alias: 'ask',
        description: 'Query your workspace or get insights',
        icon: HelpCircle,
        category: 'ai',
        action: () => {
          onDone()
          openAIEditor({ mode: 'ask' })
        },
      },
      {
        id: 'ai:summarize',
        label: 'AI: Summarize Selection',
        alias: 'summarize',
        description: 'Get a summary of selected nodes',
        icon: FileText,
        category: 'ai',
        disabled: selectedNodeIds.length === 0,
        action: () => {
          onDone()
          openAIEditor({
            mode: 'ask',
            scope: 'selection',
            prompt: 'Summarize the content of these selected notes',
          })
        },
      },

      // ── Workspace ──
      {
        id: 'save',
        label: 'Save Workspace',
        alias: 'save',
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
          onDone()
        },
      },
      {
        id: 'new-workspace',
        label: 'New Workspace',
        alias: 'new',
        description: 'Create a new workspace',
        icon: Plus,
        category: 'workspace',
        shortcut: 'Ctrl+N',
        action: () => {
          newWorkspace()
          sciFiToast('New workspace created', 'success')
          onDone()
        },
      },
      {
        id: 'open-workspace',
        label: 'Open Workspace',
        alias: 'open',
        description: 'Open workspace from file',
        icon: FolderOpen,
        category: 'workspace',
        shortcut: 'Ctrl+O',
        action: async () => {
          onDone()
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, metaKey: true }),
          )
        },
      },
      {
        id: 'workspaces',
        label: 'Recent Workspaces',
        alias: 'recent',
        description: 'Browse and switch workspaces',
        icon: FolderOpen,
        category: 'workspace',
        action: () => {
          window.dispatchEvent(new CustomEvent('open-workspace-manager'))
          onDone()
        },
      },
    ]

    return cmds
  }, [
    addNode,
    addAgentNode,
    screenToFlowPosition,
    onDone,
    undo,
    redo,
    history,
    historyIndex,
    selectedNodeIds,
    copyNodes,
    cutNodes,
    pasteNodes,
    clipboardState,
    linkAllNodes,
    unlinkSelectedNodes,
    toggleLeftSidebar,
    leftSidebarOpen,
    focusModeNodeId,
    toggleFocusMode,
    openAIEditor,
    openTemplateBrowser,
    getWorkspaceData,
    markClean,
    newWorkspace,
  ])
}
