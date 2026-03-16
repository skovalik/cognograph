// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useState, useCallback, useRef } from 'react'
import {
  MessageSquare,
  Bot,
  Folder,
  FileText,
  CheckSquare,
  Save,
  SaveAll,
  FolderOpen,
  FilePlus,
  Undo2,
  Redo2,
  Code,
  Boxes,
  Wand2,
  Type,
  Zap,
  Workflow,
  Plus,
  ChevronDown,
  Terminal,
  Palette,
  Settings,
  X,
  Layers,
  Activity,
  Share2,
  User
} from 'lucide-react'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from './ui'
import { useReactFlow } from '@xyflow/react'
import { toast } from 'react-hot-toast'
import { useWorkspaceStore, getHistoryActionLabel } from '../stores/workspaceStore'
import AIActionMenu from './ai-editor/AIActionMenu'

import { hasTerminalAccess } from '../utils/terminalAccess'
import { useIsMobile } from '../hooks/useIsMobile'
import type { NodeData } from '@shared/types'

interface ToolbarProps {
  onSave: () => void
  onSaveAs: () => void
  onNew: () => void
  onOpen: () => void
  onToggleAISidebar?: () => void
  onOpenInlinePrompt?: () => void
  onOpenThemeSettings?: () => void
}

const Divider = (): JSX.Element => <div className="toolbar-divider" />

function ToolbarComponent({ onSave, onSaveAs, onNew, onOpen, onToggleAISidebar, onOpenInlinePrompt, onOpenThemeSettings }: ToolbarProps): JSX.Element | null {
  const isMobile = useIsMobile()
  const addNode = useWorkspaceStore((state) => state.addNode)
  const addAgentNode = useWorkspaceStore((state) => state.addAgentNode)
  const undo = useWorkspaceStore((state) => state.undo)
  const redo = useWorkspaceStore((state) => state.redo)
  const history = useWorkspaceStore((state) => state.history)
  const historyIndex = useWorkspaceStore((state) => state.historyIndex)
  const historyLength = history.length

  // Computed based on subscribed state
  const canUndoValue = historyIndex >= 0
  const canRedoValue = historyIndex < historyLength - 1

  const undoAction = canUndoValue ? history[historyIndex] : null
  const redoAction = canRedoValue ? history[historyIndex + 1] : null
  const undoTitle = undoAction ? `Undo: ${getHistoryActionLabel(undoAction)} (Ctrl+Z)` : 'Undo (Ctrl+Z)'
  const redoTitle = redoAction ? `Redo: ${getHistoryActionLabel(redoAction)} (Ctrl+Shift+Z)` : 'Redo (Ctrl+Shift+Z)'
  const isDirty = useWorkspaceStore((state) => state.isDirty)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)


  // AI Action Menu state
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [aiMenuAnchor, setAiMenuAnchor] = useState<DOMRect | null>(null)
  const aiButtonRef = useRef<HTMLButtonElement>(null)

  const handleAIButtonClick = useCallback(() => {
    if (aiButtonRef.current) {
      setAiMenuAnchor(aiButtonRef.current.getBoundingClientRect())
      setAiMenuOpen(prev => !prev)
    }
  }, [])

  const handleAIMenuClose = useCallback(() => {
    setAiMenuOpen(false)
  }, [])

  // Canvas position tracking for node spawning
  const lastCanvasClick = useWorkspaceStore((state) => state.lastCanvasClick)
  const { getViewport } = useReactFlow()

  const handleAddNode = useCallback((type: NodeData['type']): void => {
    let position: { x: number; y: number }

    if (lastCanvasClick && Date.now() - lastCanvasClick.time < 2000) {
      position = { x: lastCanvasClick.x, y: lastCanvasClick.y }
    } else {
      const currentViewport = getViewport()
      const centerX = (-currentViewport.x + window.innerWidth / 2) / currentViewport.zoom
      const centerY = (-currentViewport.y + window.innerHeight / 2) / currentViewport.zoom
      position = {
        x: centerX + (Math.random() - 0.5) * 50,
        y: centerY + (Math.random() - 0.5) * 50
      }
    }

    addNode(type, position)
  }, [addNode, lastCanvasClick, getViewport])

  const handleAddAgent = useCallback((): void => {
    let position: { x: number; y: number }
    if (lastCanvasClick && Date.now() - lastCanvasClick.time < 2000) {
      position = { x: lastCanvasClick.x, y: lastCanvasClick.y }
    } else {
      const vp = getViewport()
      position = {
        x: (-vp.x + window.innerWidth / 2) / vp.zoom + (Math.random() - 0.5) * 50,
        y: (-vp.y + window.innerHeight / 2) / vp.zoom + (Math.random() - 0.5) * 50,
      }
    }
    addAgentNode(position)
  }, [addAgentNode, lastCanvasClick, getViewport])

  const handleAddTerminal = useCallback((): void => {
    let position: { x: number; y: number }
    if (lastCanvasClick && Date.now() - lastCanvasClick.time < 2000) {
      position = { x: lastCanvasClick.x, y: lastCanvasClick.y }
    } else {
      const vp = getViewport()
      position = {
        x: (-vp.x + window.innerWidth / 2) / vp.zoom + (Math.random() - 0.5) * 50,
        y: (-vp.y + window.innerHeight / 2) / vp.zoom + (Math.random() - 0.5) * 50,
      }
    }
    const id = addNode('conversation', position)
    const sessionId = crypto.randomUUID()
    const updateNode = useWorkspaceStore.getState().updateNode
    updateNode(id, {
      title: 'Terminal',
      mode: 'terminal',
      terminal: {
        sessionId,
        origin: 'embedded',
        workingDirectory: '',
        terminalState: 'idle',
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
        accentColor: '#22d3ee',
      },
    })
  }, [addNode, lastCanvasClick, getViewport])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  if (isMobile) {
    const btn: React.CSSProperties = {
      background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '2px', padding: '6px 0', minWidth: '56px', minHeight: '44px',
      color: 'var(--fg-dim, #a09888)', fontSize: '9px', fontFamily: 'var(--font-mono, monospace)',
      letterSpacing: '0.02em',
    }
    const btnActive: React.CSSProperties = { ...btn, color: 'var(--gold, #C8963E)' }

    const nodeTypes = [
      { type: 'conversation' as const, icon: MessageSquare, label: 'Chat' },
      { type: 'note' as const, icon: FileText, label: 'Note' },
      { type: 'task' as const, icon: CheckSquare, label: 'Task' },
      { type: 'project' as const, icon: Folder, label: 'Project' },
      { type: 'artifact' as const, icon: Code, label: 'Artifact' },
      { type: 'text' as const, icon: Type, label: 'Text' },
      { type: 'workspace' as const, icon: Boxes, label: 'Space' },
      { type: 'action' as const, icon: Zap, label: 'Action' },
      { type: 'orchestrator' as const, icon: Workflow, label: 'Orch.' },
    ]

    return (
      <>
        {/* Node picker popup */}
        {mobileMenuOpen && (
          <div style={{
            position: 'fixed', bottom: '68px', left: '8px', right: '8px',
            zIndex: 9989, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px',
            padding: '8px', borderRadius: '12px',
            background: 'rgba(15, 15, 26, 0.95)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(200, 150, 62, 0.2)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
          }}>
            {nodeTypes.map(({ type, icon: Icon, label }) => (
              <button key={type} onClick={() => { handleAddNode(type); setMobileMenuOpen(false) }}
                style={{ ...btn, padding: '10px 4px' }}>
                <Icon size={16} /><span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* More submenu popup */}
        {moreMenuOpen && (
          <div style={{
            position: 'fixed', bottom: '68px', right: '8px',
            zIndex: 9989, display: 'flex', flexDirection: 'column', gap: '2px',
            padding: '8px', borderRadius: '12px', minWidth: '160px',
            background: 'rgba(15, 15, 26, 0.95)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(200, 150, 62, 0.2)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
          }}>
            {[
              { icon: FilePlus, label: 'New workspace', action: onNew },
              { icon: FolderOpen, label: 'Open', action: onOpen },
              { icon: Save, label: 'Save', action: onSave },
              { icon: Undo2, label: 'Undo', action: undo },
              { icon: Redo2, label: 'Redo', action: redo },
              { icon: Share2, label: 'Share', action: () => {
                const url = window.location.href
                if (navigator.share) navigator.share({ title: 'Cognograph', url })
                else navigator.clipboard.writeText(url)
              }},
              { icon: Settings, label: 'Settings', action: () => window.dispatchEvent(new Event('open-settings')) },
              { icon: User, label: 'Profile', action: () => { window.location.href = 'https://cognograph.app/profile' } },
            ].map(({ icon: Icon, label, action }) => (
              <button key={label} onClick={() => { action(); setMoreMenuOpen(false) }}
                style={{
                  ...btn, flexDirection: 'row', gap: '10px', padding: '10px 12px',
                  minWidth: 'unset', minHeight: 'unset', fontSize: '13px',
                  fontFamily: 'var(--font-body, system-ui)',
                }}>
                <Icon size={16} /><span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Backdrop for popups */}
        {(mobileMenuOpen || moreMenuOpen) && (
          <div onClick={() => { setMobileMenuOpen(false); setMoreMenuOpen(false) }}
            style={{ position: 'fixed', inset: 0, zIndex: 9988 }} />
        )}

        {/* Bottom bar — 5 buttons, fixed */}
        <div style={{
          position: 'fixed', bottom: '8px', left: '8px', right: '8px',
          zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          padding: '4px 0', borderRadius: '16px',
          background: 'rgba(15, 15, 26, 0.92)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(200, 150, 62, 0.12)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
        }}>
          <button onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setMoreMenuOpen(false) }}
            style={mobileMenuOpen ? btnActive : btn}>
            {mobileMenuOpen ? <X size={20} /> : <Plus size={20} />}
            <span>Add</span>
          </button>
          <button onClick={onToggleAISidebar} style={btn}>
            <Wand2 size={20} /><span>AI</span>
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('toggle-canvas-toc'))} style={btn}>
            <Layers size={20} /><span>Outline</span>
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('toggle-activity'))} style={btn}>
            <Activity size={20} /><span>Activity</span>
          </button>
          <button onClick={() => { setMoreMenuOpen(!moreMenuOpen); setMobileMenuOpen(false) }}
            style={moreMenuOpen ? btnActive : btn}>
            {moreMenuOpen ? <X size={20} /> : <ChevronDown size={20} style={{ transform: 'rotate(180deg)' }} />}
            <span>More</span>
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div
        className="absolute gui-z-panels transition-all duration-200"
        style={{ top: '16px', left: '50%', transform: 'translateX(-50%)' }}
      >
        <div className="gui-toolbar">
          {/* File ops */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onNew} aria-label="New Workspace">
                <FilePlus className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>New Workspace (N)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onOpen} aria-label="Open Workspace">
                <FolderOpen className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Open Workspace (O)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onSave} aria-label="Save Workspace" className="relative">
                <Save className="w-5 h-5" />
                {isDirty && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Save Workspace (Ctrl+S)</TooltipContent>
          </Tooltip>
          {(window as any).__ELECTRON__ && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onSaveAs} aria-label="Save As">
                  <SaveAll className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Save As... (Ctrl+Shift+E)</TooltipContent>
            </Tooltip>
          )}

          {/* 4. Divider */}
          <Divider />

          {/* 5. Undo/Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const action = history[historyIndex]
                  undo()
                  if (action) toast(`Undo: ${getHistoryActionLabel(action)}`, { duration: 1500 })
                }}
                disabled={!canUndoValue}
                aria-label="Undo"
              >
                <Undo2 className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{undoTitle}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const action = history[historyIndex + 1]
                  redo()
                  if (action) toast(`Redo: ${getHistoryActionLabel(action)}`, { duration: 1500 })
                }}
                disabled={!canRedoValue}
                aria-label="Redo"
              >
                <Redo2 className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{redoTitle}</TooltipContent>
          </Tooltip>

          {/* 6. Divider */}
          <Divider />

          {/* 7. Node creation dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Add node" className="flex items-center gap-0.5">
                    <Plus className="w-5 h-5" />
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Add Node</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              <DropdownMenuLabel>Add Node</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAddNode('conversation')}>
                <MessageSquare className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.conversation }} /> Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddNode('note')}>
                <FileText className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.note }} /> Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddNode('task')}>
                <CheckSquare className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.task }} /> Task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddNode('project')}>
                <Folder className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.project }} /> Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddNode('artifact')}>
                <Code className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.artifact }} /> Artifact
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddNode('text')}>
                <Type className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.text }} /> Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddNode('workspace')}>
                <Boxes className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.workspace }} /> Workspace
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddNode('action')}>
                <Zap className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.action }} /> Action
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddNode('orchestrator')}>
                <Workflow className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.orchestrator }} /> Orchestrator
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleAddAgent}>
                <Bot className="w-4 h-4 mr-2" style={{ color: themeSettings.nodeColors.conversation }} /> Agent
              </DropdownMenuItem>
              {hasTerminalAccess() && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleAddTerminal}>
                    <Terminal className="w-4 h-4 mr-2" style={{ color: '#22d3ee' }} /> Terminal
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 8. Divider */}
          <Divider />

          {/* 9. AI wand */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                ref={aiButtonRef}
                onClick={handleAIButtonClick}
                className={aiMenuOpen ? 'active' : ''}
                aria-label="AI Actions"
                aria-expanded={aiMenuOpen}
                aria-haspopup="menu"
              >
                <Wand2 className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>AI Actions (Ctrl+E)</TooltipContent>
          </Tooltip>

          <Divider />

          {/* 10. Theme settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onOpenThemeSettings} aria-label="Theme Settings">
                <Palette className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Theme Settings</TooltipContent>
          </Tooltip>

        </div>
      </div>
      <AIActionMenu
        isOpen={aiMenuOpen}
        onClose={handleAIMenuClose}
        anchorRect={aiMenuAnchor}
        onToggleAISidebar={onToggleAISidebar}
        onOpenInlinePrompt={onOpenInlinePrompt}
      />
    </>
  )
}

export const Toolbar = memo(ToolbarComponent)
