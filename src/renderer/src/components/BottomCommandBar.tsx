// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useState, useRef, useCallback, useEffect } from 'react'
import {
  Sparkles, ArrowUp, FileUp, X,
  MessageSquare, FileText, CheckSquare, Folder, Code, Boxes, Zap, Workflow
} from 'lucide-react'
import { sciFiToast } from './ui/SciFiToast'
import { useIsMobile } from '../hooks/useIsMobile'
import { useUIStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useConnectorStore } from '../stores/connectorStore'
import { executeCommand } from '../services/WorkspaceCommandService'
import { SuggestedPrompts } from './SuggestedPrompts'
import '../styles/bottom-command-bar.css'

// ── Node type icon map (same as CommandPalette.tsx) ──
const NODE_ICONS: Record<string, typeof FileText> = {
  conversation: MessageSquare,
  note: FileText,
  task: CheckSquare,
  project: Folder,
  artifact: Code,
  workspace: Boxes,
  action: Zap,
  text: FileText,
  orchestrator: Workflow,
}

// ── Helpers ──

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null ||
         document.querySelector('[data-radix-popper-content-wrapper]') !== null
}

// ── Component ──

function BottomCommandBarComponent(): JSX.Element | null {
  // ALL hooks MUST be called before any conditional return (React rules of hooks)
  const isMobile = useIsMobile()
  const commandLog = useWorkspaceStore(s => s.commandLog)
  const selectedNodeIds = useWorkspaceStore(s => s.selectedNodeIds)
  const nodes = useWorkspaceStore(s => s.nodes)
  const defaultLLMId = useConnectorStore(s => s.defaultLLMId)
  const connectors = useConnectorStore(s => s.connectors)
  const defaultConnector = connectors.find(c => c.id === defaultLLMId) ?? null

  const [input, setInput] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{
    filename: string
    storedPath: string
    inlineContent?: string
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)

  // ── Keyboard: "/" to focus, Escape to blur ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === '/' && !isInputFocused() && !isModalOpen()) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Close model dropdown on outside click ──
  useEffect(() => {
    if (!modelDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [modelDropdownOpen])

  // ── Drag-and-drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    try {
      const text = await file.text()
      if (text && text.length <= 50000) {
        setAttachedFile({ filename: file.name, storedPath: '', inlineContent: text })
      } else {
        setAttachedFile({ filename: file.name, storedPath: '' })
      }
    } catch {
      setAttachedFile({ filename: file.name, storedPath: '' })
    }
  }, [])

  // ── Attach file handler ──
  const handleAttachFile = useCallback(async () => {
    const result = await (window as any).api.attachment.add()
    if (result.success && result.data) {
      setAttachedFile({ filename: result.data.filename, storedPath: result.data.storedPath })
    } else if (!(window as any).__ELECTRON__) {
      sciFiToast('File attachment requires the desktop app', 'info', 2000)
    }
  }, [])

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isExecuting) return
    setIsExecuting(true)
    const cmd = input.trim()
    setInput('')

    // Open the response panel so user sees output, reset prompt to expanded
    useUIStore.getState().setResponsePanelOpen(true)
    useUIStore.getState().setPromptCollapsed(false)

    // Read attached file content if present
    let fileContext: { filename: string; content: string } | undefined
    if (attachedFile) {
      if (attachedFile.inlineContent) {
        fileContext = { filename: attachedFile.filename, content: attachedFile.inlineContent }
      } else if (attachedFile.storedPath) {
        try {
          const textResult = await (window as any).api.attachment.readText(attachedFile.storedPath)
          if (textResult.success && textResult.data) {
            fileContext = { filename: attachedFile.filename, content: textResult.data }
          }
        } catch {}
      }
      setAttachedFile(null)
    }

    try {
      await executeCommand(cmd, fileContext ? { fileContext } : undefined)
      // Set active command to the latest entry
      const log = useWorkspaceStore.getState().commandLog
      const latest = log[log.length - 1]
      if (latest) {
        useUIStore.getState().setActiveCommandId(latest.id)
      }
    } finally {
      setIsExecuting(false)
    }
  }, [input, isExecuting, attachedFile])

  // ── Input key handler (Enter to submit) ──
  // NOTE: Arrow-key history cycling intentionally removed — the Agent Log
  // in CommandResponsePanel replaces keyboard history navigation with a
  // clickable visual list. This is a deliberate UX change, not an omission.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // Early return AFTER all hooks
  if (isMobile) return null

  // ── Context subject: selected node pill ──
  const contextNode = selectedNodeIds.length === 1
    ? nodes.find(n => n.id === selectedNodeIds[0])
    : null
  const contextTitle = contextNode ? (contextNode.data as any).title || 'Untitled' : null
  const contextType = contextNode?.data.type || null
  const ContextIcon = contextType ? NODE_ICONS[contextType] || FileText : null

  // Context indicator for toolbar
  const contextText = selectedNodeIds.length > 1
    ? `${selectedNodeIds.length} nodes selected`
    : selectedNodeIds.length === 1
      ? '1 node selected'
      : 'canvas scope'

  // Suppress unused variable warning — commandLog is read to satisfy hook rules
  void commandLog

  return (
    <div className="bottom-command-bar">
      {/* Suggested prompts — hidden when typing or executing */}
      {!input && !isExecuting && (
        <SuggestedPrompts onSelect={(text) => { setInput(text); inputRef.current?.focus() }} />
      )}

      {/* ═══ UNIFIED BAR — input + toolbar ═══ */}
      <div
        className={`bottom-command-bar__bar glass-soft ${isExecuting ? 'is-thinking' : ''} ${isDragging ? 'is-dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Input row */}
        <div className="bottom-command-bar__input-row">
          <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-glow)' }} />

          {/* Context subject pill */}
          {contextTitle && ContextIcon && (
            <div className="bottom-command-bar__subject">
              <ContextIcon className="w-3 h-3 flex-shrink-0" />
              <span className="bottom-command-bar__subject-text">{contextTitle}</span>
              <button
                className="bottom-command-bar__subject-close"
                onClick={() => useWorkspaceStore.getState().setSelectedNodes([])}
                title="Clear selection"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Attachment pill */}
          {attachedFile && (
            <div className="bottom-command-bar__attachment">
              <FileUp className="w-3 h-3 flex-shrink-0" />
              <span className="bottom-command-bar__attachment-text">{attachedFile.filename}</span>
              <button
                className="bottom-command-bar__subject-close"
                onClick={() => setAttachedFile(null)}
                title="Remove file"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            className="bottom-command-bar__input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command...  (/ to focus)"
            aria-label="Workspace command"
          />
          <button className="bottom-command-bar__send" onClick={handleSubmit} disabled={!input.trim() || isExecuting}>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toolbar — inside the bar, below input */}
        <div className="bottom-command-bar__toolbar-row">
          {(window as any).__ELECTRON__ && (
            <button className="bottom-command-bar__toolbar-btn" title="Attach file" onClick={handleAttachFile}>
              <FileUp className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="bottom-command-bar__divider" />
          <div ref={modelRef} style={{ position: 'relative' }}>
            <button
              className="bottom-command-bar__model"
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            >
              <Sparkles className="w-2.5 h-2.5" />
              {defaultConnector?.model || 'claude-sonnet-4-6'}
            </button>
            {modelDropdownOpen && connectors.length > 0 && (
              <div className="bottom-command-bar__model-dropdown glass-soft">
                {connectors.map(c => (
                  <button
                    key={c.id}
                    className={`bottom-command-bar__model-option ${c.id === defaultLLMId ? 'bottom-command-bar__model-option--active' : ''}`}
                    onClick={() => { useConnectorStore.getState().setDefaultLLM(c.id); setModelDropdownOpen(false) }}
                  >
                    {c.model}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="bottom-command-bar__context">{contextText}</span>
        </div>
      </div>
    </div>
  )
}

export const BottomCommandBar = memo(BottomCommandBarComponent)
