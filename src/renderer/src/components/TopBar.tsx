// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { getFlag } from '@shared/featureFlags'
import type { NodeData } from '@shared/types'
import { useReactFlow } from '@xyflow/react'
import {
  Activity,
  Bot,
  Boxes,
  CheckSquare,
  ChevronDown,
  Code,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  HelpCircle,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Plus,
  Redo2,
  Save,
  SaveAll,
  ScrollText,
  Settings,
  Share2,
  Sparkles,
  Terminal,
  Type,
  Undo2,
  User,
  Wand2,
  Workflow,
  Zap,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
// Cloud features disabled in open-source build (src/web/ not included)
const ElementBadge = ((_props: { name: string | null; size: number; avatarUrl?: string | null }) => null) as any
const isAuthEnabled = (): boolean => false
const supabase: any = null
import { useIsMobile } from '../hooks/useIsMobile'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { selectLeftSidebarTab, useUIStore } from '../stores/uiStore'
import { getHistoryActionLabel, useWorkspaceStore } from '../stores/workspaceStore'
import { hasTerminalAccess } from '../utils/terminalAccess'
import AIActionMenu from './ai-editor/AIActionMenu'
import { useShortcutHelpStore } from './KeyboardShortcutsHelp'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui'
import '../styles/top-bar.css'

/* ── Sidebar tab definitions (ported from IconRail) ── */

type SidebarTab =
  | 'layers'
  | 'extractions'
  | 'activity'
  | 'dispatch'
  | 'cc-bridge'
  | 'agent-log'
  | 'console'

const RAIL_TABS: Array<{
  id: SidebarTab
  label: string
  icon: typeof Layers
  electronOnly?: boolean
}> = [
  { id: 'layers', label: 'Outline', icon: Layers },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'agent-log', label: 'Agent Log', icon: Sparkles },
  { id: 'dispatch', label: 'Dispatch', icon: Zap },
  { id: 'cc-bridge', label: 'CC Bridge', icon: Terminal, electronOnly: true },
  { id: 'console', icon: ScrollText, label: 'Console' },
]

/* ── Divider ── */

const Divider = (): JSX.Element => <div className="top-bar__divider" />

/* ── Props ── */

interface TopBarProps {
  onSave: () => void
  onSaveAs: () => void
  onNew: () => void
  onOpen: () => void
  onOpenThemeSettings: () => void
  onToggleAISidebar?: () => void
  onOpenInlinePrompt?: () => void
}

interface UserInfo {
  name: string | null
  email: string | null
  avatarUrl: string | null
}

/* ── Component ── */

function TopBarComponent({
  onSave,
  onSaveAs,
  onNew,
  onOpen,
  onOpenThemeSettings,
  onToggleAISidebar,
  onOpenInlinePrompt,
}: TopBarProps): JSX.Element {
  /* ── Mobile detection ── */
  const isMobile = useIsMobile()
  const mobileResponsive = isMobile && getFlag('MOBILE_RESPONSIVE')

  /* ── Sidebar tab state (from IconRail) ── */
  const leftSidebarOpen = useWorkspaceStore((s) => s.leftSidebarOpen)
  const toggleLeftSidebar = useWorkspaceStore((s) => s.toggleLeftSidebar)
  const activeTab = useUIStore(selectLeftSidebarTab)
  const setActiveTab = useUIStore((s) => s.setLeftSidebarTab)

  /* ── Multiplayer / share (from IconRail) ── */
  const { isMultiplayer, shareWorkspace, connectionStatus } = useMultiplayer()

  /* ── Workspace name ── */
  const workspaceName = useWorkspaceStore((s) => s.workspaceName)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState(workspaceName || 'Untitled Workspace')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditingName) setEditNameValue(workspaceName || 'Untitled Workspace')
  }, [workspaceName, isEditingName])

  /* ── Toolbar state (from Toolbar desktop) ── */
  const addNode = useWorkspaceStore((s) => s.addNode)
  const addAgentNode = useWorkspaceStore((s) => s.addAgentNode)
  const undo = useWorkspaceStore((s) => s.undo)
  const redo = useWorkspaceStore((s) => s.redo)
  const history = useWorkspaceStore((s) => s.history)
  const historyIndex = useWorkspaceStore((s) => s.historyIndex)
  const isDirty = useWorkspaceStore((s) => s.isDirty)
  const themeSettings = useWorkspaceStore((s) => s.themeSettings)
  const lastCanvasClick = useWorkspaceStore((s) => s.lastCanvasClick)
  const { getViewport } = useReactFlow()

  const historyLength = history.length
  const canUndoValue = historyIndex >= 0
  const canRedoValue = historyIndex < historyLength - 1

  const undoAction = canUndoValue ? history[historyIndex] : null
  const redoAction = canRedoValue ? history[historyIndex + 1] : null
  const undoTitle = undoAction
    ? `Undo: ${getHistoryActionLabel(undoAction)} (Ctrl+Z)`
    : 'Undo (Ctrl+Z)'
  const redoTitle = redoAction
    ? `Redo: ${getHistoryActionLabel(redoAction)} (Ctrl+Shift+Z)`
    : 'Redo (Ctrl+Shift+Z)'

  /* ── AI Action Menu state (from Toolbar) ── */
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [aiMenuAnchor, setAiMenuAnchor] = useState<DOMRect | null>(null)
  const aiButtonRef = useRef<HTMLButtonElement>(null)

  const handleAIButtonClick = useCallback(() => {
    if (aiButtonRef.current) {
      setAiMenuAnchor(aiButtonRef.current.getBoundingClientRect())
      setAiMenuOpen((prev) => !prev)
    }
  }, [])

  const handleAIMenuClose = useCallback(() => {
    setAiMenuOpen(false)
  }, [])

  /* ── User auth state (from IconRail) ── */
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthEnabled() || !supabase) return
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (user) {
        setUserInfo({
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          email: user.email || null,
          avatarUrl: user.user_metadata?.avatar_url || null,
        })
      }
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      if (user) {
        setUserInfo({
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          email: user.email || null,
          avatarUrl: user.user_metadata?.avatar_url || null,
        })
      } else {
        setUserInfo(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  const handleSignOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUserMenuOpen(false)
    window.location.href = '/dashboard'
  }, [])

  /* ── Href helpers (from IconRail) ── */
  const dashboardHref = '/dashboard'
  const profileHref = '/profile'

  /* ── Share handler (from IconRail) ── */
  const handleShare = useCallback(async () => {
    const result = await shareWorkspace()
    if (result.success && result.inviteUrl) {
      await navigator.clipboard.writeText(result.inviteUrl)
      toast.success('Invite link copied to clipboard!')
    } else if (result.error) {
      toast.error(result.error)
    }
  }, [shareWorkspace])

  /* ── Tab click handler (from IconRail) ── */
  const handleTabClick = useCallback(
    (tabId: SidebarTab) => {
      if (leftSidebarOpen && activeTab === tabId) {
        toggleLeftSidebar()
      } else if (!leftSidebarOpen) {
        toggleLeftSidebar()
        setActiveTab(tabId)
      } else {
        setActiveTab(tabId)
      }
    },
    [leftSidebarOpen, activeTab, toggleLeftSidebar, setActiveTab],
  )

  const visibleTabs = RAIL_TABS.filter((t) => !t.electronOnly || hasTerminalAccess())

  /* ── Node creation handlers (from Toolbar) ── */
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
        accentColor: 'var(--accent-glow)',
      },
    })
  }, [addNode, lastCanvasClick, getViewport])

  /* ── Render ── */

  return (
    <>
      <nav className="top-bar" aria-label="Workspace toolbar">
        {/* ── LEFT ZONE ── */}
        <div className="top-bar__left">
          {/* Hamburger — mobile only, opens sidebar drawer */}
          {mobileResponsive && (
            <button
              className="top-bar__tab touch-target"
              onClick={() => toggleLeftSidebar()}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
          )}

          {/* [Co] logo */}
          <a
            href={dashboardHref}
            className="top-bar__logo"
            aria-label="Back to Dashboard"
            title="Dashboard"
          >
            <span style={{ fontWeight: 300, color: 'var(--accent-glow)' }}>[</span>
            <span style={{ fontStyle: 'italic' }}>Co</span>
            <span style={{ fontWeight: 300, color: 'var(--accent-glow)' }}>]</span>
          </a>

          {/* Sidebar tab buttons — hidden on mobile (use hamburger + drawer) */}
          {!mobileResponsive &&
            visibleTabs.map(({ id, label, icon: Icon }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    className={`top-bar__tab ${leftSidebarOpen && activeTab === id ? 'top-bar__tab--active' : ''}`}
                    onClick={() => handleTabClick(id)}
                    aria-label={label}
                    aria-pressed={leftSidebarOpen && activeTab === id}
                  >
                    <Icon size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{label}</TooltipContent>
              </Tooltip>
            ))}

          {!mobileResponsive && <Divider />}

          {/* Workspace name — double-click to rename */}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              className="top-bar__workspace-name-input"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onBlur={() => {
                const trimmed = editNameValue.trim()
                if (trimmed && trimmed !== workspaceName) {
                  useWorkspaceStore.getState().updateWorkspaceName(trimmed)
                }
                setIsEditingName(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') {
                  setEditNameValue(workspaceName || 'Untitled Workspace')
                  setIsEditingName(false)
                }
              }}
              autoFocus
            />
          ) : (
            <button
              className="top-bar__workspace-name"
              title={workspaceName}
              onDoubleClick={() => {
                setIsEditingName(true)
                setEditNameValue(workspaceName || 'Untitled Workspace')
              }}
            >
              {workspaceName || 'Untitled Workspace'}
            </button>
          )}
        </div>

        {/* ── CENTER ZONE ── */}
        <div className="top-bar__center">
          {/* File ops — hidden on mobile (in overflow menu) */}
          {!mobileResponsive && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="top-bar__tab" onClick={onNew} aria-label="New Workspace">
                    <FilePlus size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New Workspace (N)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="top-bar__tab" onClick={onOpen} aria-label="Open Workspace">
                    <FolderOpen size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open Workspace (O)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="top-bar__tab"
                    onClick={onSave}
                    aria-label="Save Workspace"
                    style={{ position: 'relative' }}
                  >
                    <Save size={18} />
                    {isDirty && <span className="top-bar__dirty-dot" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Save Workspace (Ctrl+S)</TooltipContent>
              </Tooltip>
              {(window as any).__ELECTRON__ && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="top-bar__tab" onClick={onSaveAs} aria-label="Save As">
                      <SaveAll size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Save As... (Ctrl+Shift+E)</TooltipContent>
                </Tooltip>
              )}

              <Divider />

              {/* Undo / Redo */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="top-bar__tab"
                    onClick={() => {
                      const action = history[historyIndex]
                      undo()
                      if (action)
                        toast(`Undo: ${getHistoryActionLabel(action)}`, { duration: 1500 })
                    }}
                    disabled={!canUndoValue}
                    aria-label="Undo"
                  >
                    <Undo2 size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{undoTitle}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="top-bar__tab"
                    onClick={() => {
                      const action = history[historyIndex + 1]
                      redo()
                      if (action)
                        toast(`Redo: ${getHistoryActionLabel(action)}`, { duration: 1500 })
                    }}
                    disabled={!canRedoValue}
                    aria-label="Redo"
                  >
                    <Redo2 size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{redoTitle}</TooltipContent>
              </Tooltip>

              <Divider />
            </>
          )}

          {/* Node creation dropdown */}
          {!mobileResponsive && (
            <>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="top-bar__tab"
                        aria-label="Add node"
                        style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
                      >
                        <Plus size={18} />
                        <ChevronDown size={12} style={{ opacity: 0.5 }} />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Add Node</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  <DropdownMenuLabel>Add Node</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAddNode('conversation')}>
                    <MessageSquare
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.conversation }}
                    />{' '}
                    Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('note')}>
                    <FileText
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.note }}
                    />{' '}
                    Note
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('task')}>
                    <CheckSquare
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.task }}
                    />{' '}
                    Task
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('project')}>
                    <Folder
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.project }}
                    />{' '}
                    Project
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('artifact')}>
                    <Code
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.artifact }}
                    />{' '}
                    Artifact
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('text')}>
                    <Type
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.text }}
                    />{' '}
                    Text
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('workspace')}>
                    <Boxes
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.workspace }}
                    />{' '}
                    Workspace
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('action')}>
                    <Zap
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.action }}
                    />{' '}
                    Action
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('orchestrator')}>
                    <Workflow
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.orchestrator }}
                    />{' '}
                    Orchestrator
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleAddAgent}>
                    <Bot
                      className="w-4 h-4 mr-2"
                      style={{ color: themeSettings.nodeColors.conversation }}
                    />{' '}
                    Agent
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

              <Divider />
            </>
          )}

          {/* AI wand — hidden on mobile */}
          {!mobileResponsive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={aiButtonRef}
                  className={`top-bar__tab ${aiMenuOpen ? 'top-bar__tab--active' : ''}`}
                  onClick={handleAIButtonClick}
                  aria-label="AI Actions"
                  aria-expanded={aiMenuOpen}
                  aria-haspopup="menu"
                >
                  <Wand2 size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">AI Actions (Ctrl+E)</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ── RIGHT ZONE ── */}
        <div className="top-bar__right">
          {mobileResponsive ? (
            /* Mobile: undo/redo + settings cog */
            <>
              <button
                className="top-bar__tab"
                onClick={() => {
                  const action = history[historyIndex]
                  undo()
                  if (action) toast(`Undo: ${getHistoryActionLabel(action)}`, { duration: 1500 })
                }}
                disabled={!canUndoValue}
                aria-label="Undo"
              >
                <Undo2 size={18} />
              </button>
              <button
                className="top-bar__tab"
                onClick={() => {
                  const action = history[historyIndex + 1]
                  redo()
                  if (action) toast(`Redo: ${getHistoryActionLabel(action)}`, { duration: 1500 })
                }}
                disabled={!canRedoValue}
                aria-label="Redo"
              >
                <Redo2 size={18} />
              </button>
              <button
                className="top-bar__tab"
                onClick={onOpenThemeSettings}
                aria-label="Theme settings"
              >
                <Palette size={18} />
              </button>
            </>
          ) : (
            /* Desktop: full action buttons */
            <>
              {/* Share */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`top-bar__tab ${isMultiplayer ? 'top-bar__tab--active' : ''}`}
                    onClick={handleShare}
                    aria-label="Share workspace"
                  >
                    <Share2 size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isMultiplayer ? `Multiplayer: ${connectionStatus}` : 'Share workspace'}
                </TooltipContent>
              </Tooltip>

              <Divider />

              {/* Theme settings */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="top-bar__tab"
                    onClick={onOpenThemeSettings}
                    aria-label="Theme Settings"
                  >
                    <Palette size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Theme Settings</TooltipContent>
              </Tooltip>

              {/* Settings */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="top-bar__tab"
                    onClick={() => window.dispatchEvent(new Event('open-settings'))}
                    aria-label="Settings"
                  >
                    <Settings size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Settings</TooltipContent>
              </Tooltip>

              {/* Help / keyboard shortcuts */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="top-bar__tab"
                    onClick={() => useShortcutHelpStore.getState().toggle()}
                    aria-label="Keyboard shortcuts"
                  >
                    <HelpCircle size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Keyboard shortcuts (?)</TooltipContent>
              </Tooltip>
            </>
          )}

          {/* User avatar + dropdown — web auth only */}
          {!mobileResponsive && userInfo && (
            <div className="top-bar__user" ref={menuRef}>
              <button
                className="top-bar__avatar-btn"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <ElementBadge
                  name={userInfo.name || userInfo.email}
                  size={32}
                  avatarUrl={userInfo.avatarUrl}
                />
              </button>
              {userMenuOpen && (
                <div className="top-bar__user-menu" role="menu">
                  <div className="top-bar__user-menu-header">
                    <span className="top-bar__user-menu-name">
                      {userInfo.name || userInfo.email}
                    </span>
                    {userInfo.name && userInfo.email && (
                      <span className="top-bar__user-menu-email">{userInfo.email}</span>
                    )}
                  </div>
                  <div className="top-bar__user-menu-divider" />
                  <a href={profileHref} className="top-bar__user-menu-item" role="menuitem">
                    <User size={14} />
                    Profile
                  </a>
                  <a href={dashboardHref} className="top-bar__user-menu-item" role="menuitem">
                    <LayoutDashboard size={14} />
                    Dashboard
                  </a>
                  <div className="top-bar__user-menu-divider" />
                  <button
                    className="top-bar__user-menu-item top-bar__user-menu-item--danger"
                    onClick={handleSignOut}
                    role="menuitem"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* AI Action Menu portal — rendered outside the top-bar for proper stacking */}
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

export const TopBar = memo(TopBarComponent)
