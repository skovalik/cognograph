// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { getFlag } from '@shared/featureFlags'
import type { NodeData } from '@shared/types'
import {
  ArrowUp,
  AtSign,
  Boxes,
  CheckSquare,
  Code,
  FileText,
  FileUp,
  Folder,
  MapPin,
  MessageSquare,
  Slash,
  Sparkles,
  TerminalSquare,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CommandRegistryItem } from '../hooks/useCommandRegistry'
import { CATEGORY_LABELS, useCommandRegistry } from '../hooks/useCommandRegistry'
import { useIsMobile } from '../hooks/useIsMobile'
import { executeCommand } from '../services/WorkspaceCommandService'
import { useConnectorStore } from '../stores/connectorStore'
import { useUIStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { SuggestedPrompts } from './SuggestedPrompts'
import { sciFiToast } from './ui/SciFiToast'
import '../styles/bottom-command-bar.css'

// ── Prefix mode detection ──

export type PrefixMode = 'slash' | 'mention' | 'terminal' | 'none'

export function detectPrefixMode(input: string): PrefixMode {
  if (input.startsWith('/')) return 'slash'
  if (input.startsWith('@')) return 'mention'
  if (input.startsWith('!')) return 'terminal'
  return 'none'
}

/** Extract the query portion after the prefix character. */
export function getPrefixQuery(input: string, mode: PrefixMode): string {
  if (mode === 'none') return input
  return input.slice(1)
}

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

// ── Prefix mode labels & icons ──

const PREFIX_CONFIG: Record<
  Exclude<PrefixMode, 'none'>,
  { label: string; icon: typeof Slash; color: string }
> = {
  slash: { label: 'Commands', icon: Slash, color: 'var(--accent-glow)' },
  mention: { label: 'Go to node', icon: AtSign, color: '#60a5fa' },
  terminal: { label: 'Terminal', icon: TerminalSquare, color: '#a78bfa' },
}

// ── Helpers ──

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

function isModalOpen(): boolean {
  return (
    document.querySelector('[role="dialog"]') !== null ||
    document.querySelector('[data-radix-popper-content-wrapper]') !== null
  )
}

// ── Completion item type ──

interface CompletionItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  disabled?: boolean
  category?: string
}

// ── Component ──

function BottomCommandBarComponent(): JSX.Element | null {
  // ALL hooks MUST be called before any conditional return (React rules of hooks)
  const isMobile = useIsMobile()
  const commandLog = useWorkspaceStore((s) => s.commandLog)
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const nodes = useWorkspaceStore((s) => s.nodes)
  const defaultLLMId = useConnectorStore((s) => s.defaultLLMId)
  const connectors = useConnectorStore((s) => s.connectors)
  const defaultConnector = connectors.find((c) => c.id === defaultLLMId) ?? null
  const [input, setInput] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{
    filename: string
    storedPath: string
    inlineContent?: string
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)
  const completionRef = useRef<HTMLDivElement>(null)

  // ── Prefix mode ──
  const prefixMode = detectPrefixMode(input)
  const prefixQuery = getPrefixQuery(input, prefixMode)

  // ── Command registry for / prefix ──
  const commands = useCommandRegistry({ onDone: () => setInput('') })

  // ── Slash completions ──
  const slashCompletions: CompletionItem[] = useMemo(() => {
    if (prefixMode !== 'slash') return []
    const q = prefixQuery.toLowerCase()
    return commands
      .filter((cmd) => {
        if (cmd.disabled) return false
        if (!q) return true // empty query = show all
        return (
          cmd.label.toLowerCase().includes(q) ||
          (cmd.alias && cmd.alias.toLowerCase().includes(q)) ||
          (cmd.description && cmd.description.toLowerCase().includes(q))
        )
      })
      .slice(0, 12)
      .map((cmd) => ({
        id: cmd.id,
        label: cmd.alias ? `/${cmd.alias}` : cmd.label,
        description: cmd.description,
        icon: cmd.icon,
        action: cmd.action,
        disabled: cmd.disabled,
        category: cmd.category,
      }))
  }, [prefixMode, prefixQuery, commands])

  // ── @ mention completions (node search) ──
  const mentionCompletions: CompletionItem[] = useMemo(() => {
    if (prefixMode !== 'mention') return []
    const q = prefixQuery.toLowerCase()

    return nodes
      .filter((node) => {
        const data = node.data as NodeData
        if (data.isArchived) return false
        const title = (data.title || data.label || '').toLowerCase()
        const type = data.type.toLowerCase()
        if (!q) return true // empty query = show all nodes (capped)
        return title.includes(q) || type.includes(q)
      })
      .slice(0, 12)
      .map((node) => {
        const data = node.data as NodeData
        const title = data.title || data.label || `Untitled ${data.type}`
        const Icon = NODE_ICONS[data.type] || MapPin

        return {
          id: `mention-${node.id}`,
          label: title,
          description: `${data.type} node`,
          icon: Icon,
          action: () => {
            // Select and center on the node
            useWorkspaceStore.getState().setSelectedNodes([node.id])
            // Dispatch a custom event so the canvas can center on it
            window.dispatchEvent(new CustomEvent('center-on-node', { detail: { nodeId: node.id } }))
            setInput('')
            sciFiToast(`Selected: ${title}`, 'info', 1500)
          },
        }
      })
  }, [prefixMode, prefixQuery, nodes])

  // ── Active completions based on mode ──
  const completions: CompletionItem[] = useMemo(() => {
    switch (prefixMode) {
      case 'slash':
        return slashCompletions
      case 'mention':
        return mentionCompletions
      case 'terminal':
        return [] // no completions for terminal mode
      default:
        return []
    }
  }, [prefixMode, slashCompletions, mentionCompletions])

  // Reset selected index when completions change
  useEffect(() => {
    setSelectedCompletionIndex(0)
  }, [completions.length, prefixMode, prefixQuery])

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

  // ── Terminal dispatch ──
  const dispatchToTerminal = useCallback(
    (cmd: string) => {
      // Find the active terminal node — prefer first conversation node
      const terminalNodeId =
        nodes.find((n) => (n.data as NodeData).type === 'conversation')?.id ?? null

      if (!terminalNodeId) {
        sciFiToast('No active terminal found', 'error', 2000)
        return
      }

      if ((window as any).__ELECTRON__ && (window as any).api?.terminal?.write) {
        // Send command + newline to the PTY
        ;(window as any).api.terminal.write(terminalNodeId, cmd + '\n').catch(() => {
          sciFiToast('Failed to send command to terminal', 'error', 2000)
        })
        sciFiToast(`Sent to terminal: ${cmd}`, 'info', 1500)
      } else {
        sciFiToast('Terminal requires the desktop app', 'info', 2000)
      }
    },
    [nodes],
  )

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isExecuting) return

    // ── Handle prefix modes ──
    if (prefixMode === 'slash' && completions.length > 0) {
      // Execute the selected completion
      const selected = completions[selectedCompletionIndex]
      if (selected && !selected.disabled) {
        selected.action()
        setInput('')
      }
      return
    }

    if (prefixMode === 'mention' && completions.length > 0) {
      const selected = completions[selectedCompletionIndex]
      if (selected) {
        selected.action()
        setInput('')
      }
      return
    }

    if (prefixMode === 'terminal') {
      const cmd = prefixQuery.trim()
      if (cmd) {
        dispatchToTerminal(cmd)
        setInput('')
      }
      return
    }

    // ── Default mode: regular command submission ──
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
        } catch {
          /* ignore */
        }
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
  }, [
    input,
    isExecuting,
    attachedFile,
    prefixMode,
    prefixQuery,
    completions,
    selectedCompletionIndex,
    dispatchToTerminal,
  ])

  // ── Input key handler ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Arrow navigation for completion list
      if (completions.length > 0 && prefixMode !== 'none') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedCompletionIndex((i) => Math.min(i + 1, completions.length - 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedCompletionIndex((i) => Math.max(i - 1, 0))
          return
        }
        if (e.key === 'Tab') {
          e.preventDefault()
          // Tab-complete the selected item label into the input
          const selected = completions[selectedCompletionIndex]
          if (selected && prefixMode === 'slash') {
            // Extract the alias from the label (e.g. "/note" -> "note")
            const alias = selected.label.startsWith('/') ? selected.label : `/${selected.label}`
            setInput(alias)
          }
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, completions, selectedCompletionIndex, prefixMode],
  )

  // Early return AFTER all hooks — mobile gets FAB + bottom sheet when flag enabled
  if (isMobile && !getFlag('MOBILE_RESPONSIVE')) return null

  if (isMobile && getFlag('MOBILE_RESPONSIVE')) {
    return null // FAB removed — chat input handled by Toolbar
  }

  // ── Context subject: selected node pill ──
  const contextNode =
    selectedNodeIds.length === 1 ? nodes.find((n) => n.id === selectedNodeIds[0]) : null
  const contextTitle = contextNode ? (contextNode.data as any).title || 'Untitled' : null
  const contextType = contextNode?.data.type || null
  const ContextIcon = contextType ? NODE_ICONS[contextType] || FileText : null

  // Context indicator for toolbar
  const contextText =
    selectedNodeIds.length > 1
      ? `${selectedNodeIds.length} nodes selected`
      : selectedNodeIds.length === 1
        ? '1 node selected'
        : 'canvas scope'

  // Suppress unused variable warning — commandLog is read to satisfy hook rules
  void commandLog

  // Active prefix config
  const activePrefixConfig = prefixMode !== 'none' ? PREFIX_CONFIG[prefixMode] : null

  return (
    <div className="bottom-command-bar">
      {/* Suggested prompts — hidden when typing or executing */}
      {!input && !isExecuting && (
        <SuggestedPrompts
          onSelect={(text) => {
            setInput(text)
            inputRef.current?.focus()
          }}
        />
      )}

      {/* ═══ COMPLETION POPOVER ═══ */}
      {completions.length > 0 && prefixMode !== 'none' && (
        <div className="bottom-command-bar__completions glass-soft" ref={completionRef}>
          {completions.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`bottom-command-bar__completion-item ${i === selectedCompletionIndex ? 'is-selected' : ''} ${item.disabled ? 'is-disabled' : ''}`}
                onClick={() => {
                  if (!item.disabled) {
                    item.action()
                    setInput('')
                  }
                }}
                onMouseEnter={() => setSelectedCompletionIndex(i)}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="bottom-command-bar__completion-label">{item.label}</span>
                {item.description && (
                  <span className="bottom-command-bar__completion-desc">{item.description}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ═══ TERMINAL HINT ═══ */}
      {prefixMode === 'terminal' && prefixQuery.trim() && (
        <div className="bottom-command-bar__terminal-hint">
          <TerminalSquare className="w-3 h-3" />
          <span>Press Enter to send to terminal</span>
        </div>
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
          {/* Mode indicator — shows prefix icon when in a mode */}
          {activePrefixConfig ? (
            <div
              className="bottom-command-bar__mode-badge"
              style={{ color: activePrefixConfig.color }}
            >
              <activePrefixConfig.icon className="w-4 h-4 flex-shrink-0" />
            </div>
          ) : (
            <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-glow)' }} />
          )}

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

          <textarea
            ref={inputRef}
            className="bottom-command-bar__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              const maxH = Math.floor(window.innerHeight * 0.5)
              target.style.height = `${Math.min(target.scrollHeight, maxH)}px`
            }}
            placeholder={
              prefixMode === 'slash'
                ? 'Search commands...'
                : prefixMode === 'mention'
                  ? 'Search nodes...'
                  : prefixMode === 'terminal'
                    ? 'Type command for terminal...'
                    : 'Type a command...  (/ to focus)'
            }
            rows={1}
            aria-label="Workspace command"
          />
          <button
            className="bottom-command-bar__send"
            onClick={handleSubmit}
            disabled={!input.trim() || isExecuting}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toolbar — inside the bar, below input */}
        <div className="bottom-command-bar__toolbar-row">
          {(window as any).__ELECTRON__ && (
            <button
              className="bottom-command-bar__toolbar-btn"
              title="Attach file"
              onClick={handleAttachFile}
            >
              <FileUp className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Prefix mode shortcuts */}
          <button
            className={`bottom-command-bar__toolbar-btn ${prefixMode === 'slash' ? 'is-active' : ''}`}
            title="Slash commands"
            onClick={() => {
              setInput('/')
              inputRef.current?.focus()
            }}
          >
            <Slash className="w-3.5 h-3.5" />
          </button>
          <button
            className={`bottom-command-bar__toolbar-btn ${prefixMode === 'mention' ? 'is-active' : ''}`}
            title="Go to node"
            onClick={() => {
              setInput('@')
              inputRef.current?.focus()
            }}
          >
            <AtSign className="w-3.5 h-3.5" />
          </button>
          <button
            className={`bottom-command-bar__toolbar-btn ${prefixMode === 'terminal' ? 'is-active' : ''}`}
            title="Terminal command"
            onClick={() => {
              setInput('!')
              inputRef.current?.focus()
            }}
          >
            <TerminalSquare className="w-3.5 h-3.5" />
          </button>

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
                {connectors.map((c) => (
                  <button
                    key={c.id}
                    className={`bottom-command-bar__model-option ${c.id === defaultLLMId ? 'bottom-command-bar__model-option--active' : ''}`}
                    onClick={() => {
                      useConnectorStore.getState().setDefaultLLM(c.id)
                      setModelDropdownOpen(false)
                    }}
                  >
                    {c.model}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="bottom-command-bar__context">
            {activePrefixConfig ? activePrefixConfig.label : contextText}
          </span>
        </div>
      </div>
    </div>
  )
}

export const BottomCommandBar = memo(BottomCommandBarComponent)
