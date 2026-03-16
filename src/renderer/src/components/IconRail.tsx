// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useCallback, useState, useEffect, useRef } from 'react'
import { Layers, Activity, Zap, Terminal, Settings, Share2, PanelRight, User, LayoutDashboard, LogOut } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useUIStore, selectLeftSidebarTab } from '../stores/uiStore'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { hasTerminalAccess } from '../utils/terminalAccess'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui'
import { toast } from 'react-hot-toast'
import ElementBadge from '../../../web/components/ElementBadge'
import { isAuthEnabled, supabase } from '../../../web/lib/supabase'
import '../styles/icon-rail.css'

type SidebarTab = 'layers' | 'extractions' | 'activity' | 'dispatch' | 'bridge-log'

const RAIL_TABS: Array<{ id: SidebarTab; label: string; icon: typeof Layers; electronOnly?: boolean }> = [
  { id: 'layers', label: 'Outline', icon: Layers },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'dispatch', label: 'Dispatch', icon: Zap, electronOnly: true },
  { id: 'bridge-log', label: 'Bridge Log', icon: Terminal, electronOnly: true },
]

interface IconRailProps {
  onOpenSettings: () => void
}

interface UserInfo {
  name: string | null
  email: string | null
  avatarUrl: string | null
}

function IconRailComponent({ onOpenSettings }: IconRailProps): JSX.Element {
  const leftSidebarOpen = useWorkspaceStore((s) => s.leftSidebarOpen)
  const toggleLeftSidebar = useWorkspaceStore((s) => s.toggleLeftSidebar)
  const activeTab = useUIStore(selectLeftSidebarTab)
  const setActiveTab = useUIStore((s) => s.setLeftSidebarTab)
  const workspacePreferences = useWorkspaceStore((s) => s.workspacePreferences)
  const setPropertiesDisplayMode = useWorkspaceStore((s) => s.setPropertiesDisplayMode)
  const { isMultiplayer, shareWorkspace, connectionStatus } = useMultiplayer()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Check for authenticated user (canvas has no AuthProvider, read Supabase directly)
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
    const dashboardUrl = window.location.hostname === 'canvas.cognograph.app'
      ? 'https://cognograph.app/dashboard'
      : '/dashboard'
    window.location.href = dashboardUrl
  }, [])

  const dashboardHref = window.location.hostname === 'canvas.cognograph.app'
    ? 'https://cognograph.app/dashboard'
    : '/dashboard'
  const profileHref = window.location.hostname === 'canvas.cognograph.app'
    ? 'https://cognograph.app/profile'
    : '/profile'

  const handleShare = useCallback(async () => {
    const result = await shareWorkspace()
    if (result.success && result.inviteUrl) {
      await navigator.clipboard.writeText(result.inviteUrl)
      toast.success('Invite link copied to clipboard!')
    } else if (result.error) {
      toast.error(result.error)
    }
  }, [shareWorkspace])

  const handleTabClick = useCallback((tabId: SidebarTab) => {
    if (leftSidebarOpen && activeTab === tabId) {
      // Clicking active tab closes sidebar
      toggleLeftSidebar()
    } else if (!leftSidebarOpen) {
      // Open sidebar and set tab
      toggleLeftSidebar()
      setActiveTab(tabId)
    } else {
      // Switch tab
      setActiveTab(tabId)
    }
  }, [leftSidebarOpen, activeTab, toggleLeftSidebar, setActiveTab])

  const visibleTabs = RAIL_TABS.filter(t => !t.electronOnly || hasTerminalAccess())

  return (
    <nav className="icon-rail" aria-label="Workspace navigation">
      {/* Logo mark — [Co] bracket notation matching website CoMark, links to dashboard */}
      <a
        href={window.location.hostname === 'canvas.cognograph.app'
          ? 'https://cognograph.app/dashboard'
          : '/dashboard'}
        className="icon-rail__logo"
        aria-label="Back to Dashboard"
        title="Dashboard"
      >
        <span style={{ fontWeight: 300, color: 'var(--accent-glow)' }}>[</span>
        <span style={{ fontStyle: 'italic' }}>Co</span>
        <span style={{ fontWeight: 300, color: 'var(--accent-glow)' }}>]</span>
      </a>

      {/* Tab buttons */}
      <div className="icon-rail__tabs">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                className={`icon-rail__btn ${leftSidebarOpen && activeTab === id ? 'icon-rail__btn--active' : ''}`}
                onClick={() => handleTabClick(id)}
                aria-label={label}
                aria-pressed={leftSidebarOpen && activeTab === id}
              >
                <Icon size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Bottom section */}
      <div className="icon-rail__bottom">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={`icon-rail__btn ${isMultiplayer ? 'icon-rail__btn--active' : ''}`}
              onClick={handleShare}
              aria-label="Share workspace"
            >
              <Share2 size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isMultiplayer ? `Multiplayer: ${connectionStatus}` : 'Share workspace'}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="icon-rail__btn"
              onClick={() => setPropertiesDisplayMode(
                workspacePreferences.propertiesDisplayMode === 'modal' ? 'sidebar' : 'modal'
              )}
              aria-label="Toggle properties display mode"
            >
              <PanelRight size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Properties: {workspacePreferences.propertiesDisplayMode === 'modal' ? 'Modal' : 'Sidebar'}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="icon-rail__btn"
              onClick={onOpenSettings}
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>

        {/* User avatar — web auth only */}
        {userInfo && (
          <div className="icon-rail__user" ref={menuRef}>
            <button
              className="icon-rail__avatar-btn"
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
              <div className="icon-rail__user-menu" role="menu">
                <div className="icon-rail__user-menu-header">
                  <span className="icon-rail__user-menu-name">
                    {userInfo.name || userInfo.email}
                  </span>
                  {userInfo.name && userInfo.email && (
                    <span className="icon-rail__user-menu-email">{userInfo.email}</span>
                  )}
                </div>
                <div className="icon-rail__user-menu-divider" />
                <a href={profileHref} className="icon-rail__user-menu-item" role="menuitem">
                  <User size={14} />
                  Profile
                </a>
                <a href={dashboardHref} className="icon-rail__user-menu-item" role="menuitem">
                  <LayoutDashboard size={14} />
                  Dashboard
                </a>
                <div className="icon-rail__user-menu-divider" />
                <button
                  className="icon-rail__user-menu-item icon-rail__user-menu-item--danger"
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
  )
}

export const IconRail = memo(IconRailComponent)
