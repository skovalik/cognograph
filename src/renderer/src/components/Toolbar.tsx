// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { NodeData } from '@shared/types'
import { useReactFlow } from '@xyflow/react'
import {
  ArrowUp,
  Boxes,
  CheckSquare,
  Code,
  Download,
  FileText,
  Folder,
  FolderOpen,
  MessageCircle,
  MessageSquare,
  Plus,
  Save,
  SaveAll,
  Settings,
  Sparkles,
  Type,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { executeCommand } from '../services/WorkspaceCommandService'
import { useUIStore } from '../stores/uiStore'
import { getHistoryActionLabel, useWorkspaceStore } from '../stores/workspaceStore'
import { SuggestedPrompts } from './SuggestedPrompts'

interface ToolbarProps {
  onSave: () => void
  onSaveAs: () => void
  onNew: () => void
  onOpen: () => void
  onToggleAISidebar?: () => void
  onOpenInlinePrompt?: () => void
  onOpenThemeSettings?: () => void
  /** Hide the mobile toolbar (e.g. during WelcomeScreen) */
  hidden?: boolean
}

const _Divider = (): JSX.Element => <div className="toolbar-divider" />

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: toolbar renders desktop + mobile variants with feature flags
function ToolbarComponent({
  onSave,
  onSaveAs,
  onNew,
  onOpen,
  onToggleAISidebar: _onToggleAISidebar,
  onOpenInlinePrompt: _onOpenInlinePrompt,
  onOpenThemeSettings,
  hidden,
}: ToolbarProps): JSX.Element | null {
  const isMobile = useIsMobile()
  const _toggleResponsePanel = useUIStore((s) => s.toggleResponsePanel)
  const _responsePanelOpen = useUIStore((s) => s.responsePanelOpen)
  const addNode = useWorkspaceStore((state) => state.addNode)
  const addAgentNode = useWorkspaceStore((state) => state.addAgentNode)
  const _undo = useWorkspaceStore((state) => state.undo)
  const _redo = useWorkspaceStore((state) => state.redo)
  const history = useWorkspaceStore((state) => state.history)
  const historyIndex = useWorkspaceStore((state) => state.historyIndex)
  const historyLength = history.length

  // Computed based on subscribed state
  const canUndoValue = historyIndex >= 0
  const canRedoValue = historyIndex < historyLength - 1

  const undoAction = canUndoValue ? history[historyIndex] : null
  const redoAction = canRedoValue ? history[historyIndex + 1] : null
  const _undoTitle = undoAction
    ? `Undo: ${getHistoryActionLabel(undoAction)} (Ctrl+Z)`
    : 'Undo (Ctrl+Z)'
  const _redoTitle = redoAction
    ? `Redo: ${getHistoryActionLabel(redoAction)} (Ctrl+Shift+Z)`
    : 'Redo (Ctrl+Shift+Z)'
  const _isDirty = useWorkspaceStore((state) => state.isDirty)
  const _themeSettings = useWorkspaceStore((state) => state.themeSettings)

  // AI Action Menu state
  const [_aiMenuOpen, setAiMenuOpen] = useState(false)
  const [_aiMenuAnchor, setAiMenuAnchor] = useState<DOMRect | null>(null)
  const aiButtonRef = useRef<HTMLButtonElement>(null)

  const _handleAIButtonClick = useCallback(() => {
    if (aiButtonRef.current) {
      setAiMenuAnchor(aiButtonRef.current.getBoundingClientRect())
      setAiMenuOpen((prev) => !prev)
    }
  }, [])

  const _handleAIMenuClose = useCallback(() => {
    setAiMenuOpen(false)
  }, [])

  // Canvas position tracking for node spawning
  const lastCanvasClick = useWorkspaceStore((state) => state.lastCanvasClick)
  const { getViewport } = useReactFlow()

  const handleAddNode = useCallback(
    (type: NodeData['type']): void => {
      let position: { x: number; y: number }

      if (lastCanvasClick && Date.now() - lastCanvasClick.time < 2000) {
        position = { x: lastCanvasClick.x, y: lastCanvasClick.y }
      } else {
        const currentViewport = getViewport()
        const centerX = (-currentViewport.x + window.innerWidth / 2) / currentViewport.zoom
        const centerY = (-currentViewport.y + window.innerHeight / 2) / currentViewport.zoom
        position = {
          x: centerX + (Math.random() - 0.5) * 50,
          y: centerY + (Math.random() - 0.5) * 50,
        }
      }

      addNode(type, position)
    },
    [addNode, lastCanvasClick, getViewport],
  )

  const _handleAddAgent = useCallback((): void => {
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

  const _handleAddTerminal = useCallback((): void => {
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
        accentColor: 'var(--accent-glow)',
      },
    })
  }, [addNode, lastCanvasClick, getViewport])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [chatInputOpen, setChatInputOpen] = useState(false)
  const [chatValue, setChatValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  if (isMobile && hidden) return null

  if (isMobile) {
    const btn: React.CSSProperties = {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2px',
      padding: '6px 0',
      minWidth: '56px',
      minHeight: '44px',
      color: 'var(--fg-dim, #a09888)',
      fontSize: '9px',
      fontFamily: 'var(--font-mono, monospace)',
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
      { type: 'orchestrator' as const, icon: Workflow, label: 'Orchestrator' },
    ]

    const handleChatSubmit = async () => {
      const cmd = chatValue.trim()
      if (!cmd || isSending) return
      setIsSending(true)
      setChatValue('')
      setChatInputOpen(false)
      useUIStore.getState().setResponsePanelOpen(true)
      try {
        await executeCommand(cmd)
        const log = useWorkspaceStore.getState().commandLog
        const latest = log[log.length - 1]
        if (latest) useUIStore.getState().setActiveCommandId(latest.id)
      } catch (_) {}
      setIsSending(false)
    }

    return (
      <>
        {/* Node picker popup — vertical list, left-aligned */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              bottom: '68px',
              left: '8px',
              zIndex: 91,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '8px',
              borderRadius: '12px',
              maxHeight: '60vh',
              overflowY: 'auto',
              background: 'rgba(15, 15, 26, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(200, 150, 62, 0.2)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
            }}
          >
            {nodeTypes.map(({ type, icon: Icon, label }) => (
              <button
                type="button"
                key={type}
                onClick={() => {
                  handleAddNode(type)
                  setMobileMenuOpen(false)
                }}
                style={{
                  ...btn,
                  flexDirection: 'row',
                  gap: '12px',
                  padding: '12px 16px',
                  minWidth: 'unset',
                  minHeight: 'unset',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans, system-ui)',
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* File menu popup */}
        {fileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              bottom: '68px',
              left: '8px',
              zIndex: 91,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '8px',
              borderRadius: '12px',
              background: 'rgba(15, 15, 26, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(200, 150, 62, 0.2)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
            }}
          >
            {[
              { icon: FileText, label: 'New', action: onNew },
              { icon: FolderOpen, label: 'Open', action: onOpen },
              { icon: Save, label: 'Save', action: onSave },
              { icon: SaveAll, label: 'Save As', action: onSaveAs },
              {
                icon: Download,
                label: 'Export JSON',
                action: () => {
                  const { nodes, edges } = useWorkspaceStore.getState()
                  const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
                    type: 'application/json',
                  })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `workspace-${new Date().toISOString().slice(0, 10)}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                },
              },
            ].map(({ icon: Icon, label, action }) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  action?.()
                  setFileMenuOpen(false)
                }}
                style={{
                  ...btn,
                  flexDirection: 'row',
                  gap: '12px',
                  padding: '12px 16px',
                  minWidth: 'unset',
                  minHeight: 'unset',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans, system-ui)',
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Chat input panel */}
        {chatInputOpen && (
          <div
            style={{
              position: 'fixed',
              bottom: '68px',
              left: '8px',
              right: '8px',
              zIndex: 91,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {/* Suggestion chips — above the input */}
            {!chatValue && (
              <SuggestedPrompts
                onSelect={(text) => {
                  setChatValue(text)
                  chatInputRef.current?.focus()
                }}
              />
            )}
            <div
              style={{
                padding: '12px',
                borderRadius: '12px',
                background: 'rgba(15, 15, 26, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(200, 150, 62, 0.2)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-end',
              }}
            >
              <textarea
                ref={chatInputRef}
                value={chatValue}
                onChange={(e) => setChatValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleChatSubmit()
                  }
                }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = `${Math.min(t.scrollHeight, window.innerHeight * 0.3)}px`
                }}
                placeholder="Ask anything..."
                rows={1}
                // biome-ignore lint/a11y/noAutofocus: intentional — user tapped Chat button
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '15px',
                  lineHeight: '1.5',
                  resize: 'none',
                  padding: '8px 0',
                }}
              />
              <button
                type="button"
                onClick={handleChatSubmit}
                disabled={!chatValue.trim() || isSending}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: chatValue.trim() ? 'var(--accent-glow)' : 'var(--surface-elevated)',
                  color: chatValue.trim() ? 'var(--surface-canvas)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 150ms ease, color 150ms ease',
                }}
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Backdrop for popups */}
        {(mobileMenuOpen || fileMenuOpen || chatInputOpen) && (
          // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss pattern
          // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss pattern
          <div
            onClick={() => {
              setMobileMenuOpen(false)
              setFileMenuOpen(false)
              setChatInputOpen(false)
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 88 }}
          />
        )}

        {/* Bottom bar — 4 buttons, fixed */}
        <div
          style={{
            position: 'fixed',
            bottom: '8px',
            left: '8px',
            right: '8px',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-evenly',
            padding: '4px 0',
            borderRadius: '16px',
            background: 'rgba(15, 15, 26, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(200, 150, 62, 0.12)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(!mobileMenuOpen)
              setFileMenuOpen(false)
              setChatInputOpen(false)
            }}
            style={mobileMenuOpen ? btnActive : btn}
            aria-label={mobileMenuOpen ? 'Close add menu' : 'Add node'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Plus size={20} />}
            <span>Add</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setChatInputOpen(!chatInputOpen)
              setMobileMenuOpen(false)
              setFileMenuOpen(false)
            }}
            style={chatInputOpen ? btnActive : btn}
            aria-label={chatInputOpen ? 'Close prompt' : 'Ask the workspace AI'}
            aria-expanded={chatInputOpen}
          >
            <Sparkles size={20} />
            <span>Ask</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFileMenuOpen(!fileMenuOpen)
              setMobileMenuOpen(false)
              setChatInputOpen(false)
            }}
            style={fileMenuOpen ? btnActive : btn}
            aria-label={fileMenuOpen ? 'Close file menu' : 'File operations'}
            aria-expanded={fileMenuOpen}
          >
            {fileMenuOpen ? <X size={20} /> : <FolderOpen size={20} />}
            <span>File</span>
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-settings'))}
            style={btn}
            aria-label="Settings"
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>
      </>
    )
  }

  // Desktop rendering handled by TopBar (V4 chrome)
  return null
}

export const Toolbar = memo(ToolbarComponent)
