// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { getFlag } from '@shared/featureFlags'
import {
  Activity,
  GripVertical,
  Layers,
  MessageCircle,
  ScrollText,
  Sparkles,
  Terminal as TerminalIcon,
  X,
  Zap,
} from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { selectLeftSidebarTab, useUIStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { hasTerminalAccess } from '../utils/terminalAccess'
import { ActivityFeedPanel } from './ActivityFeedPanel'
import { BridgeLogPanel } from './bridge/BridgeLogPanel'
import { ConsolePanel } from './ConsolePanel'
import { DispatchPanel } from './DispatchPanel'
import { LayersPanel } from './LayersPanel'
import { AnimatedContent } from './ui/react-bits'

function AgentLogSidebarContent(): JSX.Element {
  const commandLog = useWorkspaceStore((s) => s.commandLog)
  const activeCommandId = useUIStore((s) => s.activeCommandId)
  const setActiveCommandId = useUIStore((s) => s.setActiveCommandId)
  const setResponsePanelOpen = useUIStore((s) => s.setResponsePanelOpen)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {commandLog.length === 0 ? (
        <div
          className="flex-1 flex items-center justify-center"
          style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}
        >
          No commands yet
        </div>
      ) : (
        <div className="flex flex-col gap-1 p-3">
          {commandLog
            .slice()
            .reverse()
            .map((entry) => (
              <button
                key={entry.id}
                className={`flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors ${
                  entry.id === activeCommandId
                    ? 'bg-[var(--accent-glow-subtle)]'
                    : 'hover:bg-[var(--surface-panel-secondary)]'
                }`}
                style={{
                  color:
                    entry.id === activeCommandId ? 'var(--accent-glow)' : 'var(--text-secondary)',
                }}
                onClick={() => {
                  setActiveCommandId(entry.id)
                  setResponsePanelOpen(true)
                }}
              >
                <span className="flex-1 truncate">{entry.input}</span>
                <span
                  className="flex-shrink-0 text-[10px]"
                  style={{
                    color:
                      entry.status === 'done'
                        ? 'var(--accent-glow)'
                        : entry.status === 'running'
                          ? 'var(--text-secondary)'
                          : entry.status === 'error'
                            ? '#ef4444'
                            : 'var(--text-muted)',
                  }}
                >
                  {entry.status === 'done'
                    ? 'done'
                    : entry.status === 'running'
                      ? 'running'
                      : entry.status}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

function LeftSidebarComponent(): JSX.Element | null {
  const isMobile = useIsMobile()
  const leftSidebarOpen = useWorkspaceStore((state) => state.leftSidebarOpen)
  const leftSidebarWidth = useWorkspaceStore((state) => state.leftSidebarWidth)
  const setLeftSidebarWidth = useWorkspaceStore((state) => state.setLeftSidebarWidth)
  const toggleLeftSidebar = useWorkspaceStore((state) => state.toggleLeftSidebar)
  const activeTab = useUIStore(selectLeftSidebarTab)
  const setActiveTab = useUIStore((s) => s.setLeftSidebarTab)
  const toggleResponsePanel = useUIStore((s) => s.toggleResponsePanel)
  const responsePanelOpen = useUIStore((s) => s.responsePanelOpen)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Handle resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)

      const startX = e.clientX
      const startWidth = leftSidebarWidth

      const handleMouseMove = (e: MouseEvent): void => {
        const delta = e.clientX - startX
        setLeftSidebarWidth(startWidth + delta)
      }

      const handleMouseUp = (): void => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [leftSidebarWidth, setLeftSidebarWidth],
  )

  // Hidden on mobile when responsive flag is off
  if (isMobile && !getFlag('MOBILE_RESPONSIVE')) return null

  // Section header label
  const tabLabels: Record<string, string> = {
    layers: 'Outline',
    extractions: 'Outline',
    activity: 'Activity',
    dispatch: 'Dispatch',
    'cc-bridge': 'CC Bridge',
    'agent-log': 'Agent Log',
    console: 'Console',
  }

  const drawerTabs: Array<{ id: string; label: string; icon: typeof Layers }> = [
    { id: 'layers', label: 'Outline', icon: Layers },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'agent-log', label: 'Agent Log', icon: Sparkles },
    { id: 'dispatch', label: 'Dispatch', icon: Zap },
    ...(hasTerminalAccess()
      ? [{ id: 'cc-bridge' as const, label: 'CC Bridge', icon: TerminalIcon as typeof Layers }]
      : []),
    { id: 'console', label: 'Console', icon: ScrollText },
  ]

  // Mobile drawer layout
  if (isMobile && getFlag('MOBILE_RESPONSIVE')) {
    if (!leftSidebarOpen) return null
    return (
      <>
        <div className="mobile-drawer-backdrop" onClick={() => toggleLeftSidebar()} />
        <div className="mobile-drawer glass-soft">
          <div className="mobile-drawer__header">
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '20px',
                color: 'var(--accent-glow)',
              }}
            >
              {tabLabels[activeTab] || 'Outline'}
            </span>
            <button
              className="touch-target"
              onClick={() => toggleLeftSidebar()}
              aria-label="Close drawer"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
          {/* Tab navigation strip */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              padding: '8px 12px',
              overflowX: 'auto',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {drawerTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  flexShrink: 0,
                  background: activeTab === id ? 'rgba(200, 150, 62, 0.15)' : 'transparent',
                  color: activeTab === id ? 'var(--accent-glow)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                  transition: 'background 150ms ease, color 150ms ease',
                }}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
            {/* Response Panel toggle */}
            <button
              type="button"
              onClick={() => {
                toggleResponsePanel()
                toggleLeftSidebar()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                flexShrink: 0,
                background: responsePanelOpen ? 'rgba(200, 150, 62, 0.15)' : 'transparent',
                color: responsePanelOpen ? 'var(--accent-glow)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                whiteSpace: 'nowrap',
              }}
            >
              <MessageCircle size={14} />
              <span>Response</span>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {(activeTab === 'layers' || activeTab === 'extractions') && (
              <AnimatedContent
                distance={20}
                duration={0.25}
                direction="vertical"
                className="h-full"
              >
                <LayersPanel sidebarWidth={Math.min(window.innerWidth * 0.85, 360)} />
              </AnimatedContent>
            )}
            {activeTab === 'activity' && (
              <AnimatedContent
                distance={20}
                duration={0.25}
                direction="vertical"
                className="h-full"
              >
                <ActivityFeedPanel sidebarWidth={Math.min(window.innerWidth * 0.85, 360)} />
              </AnimatedContent>
            )}
            {activeTab === 'dispatch' && (
              <AnimatedContent
                distance={20}
                duration={0.25}
                direction="vertical"
                className="h-full"
              >
                <DispatchPanel sidebarWidth={Math.min(window.innerWidth * 0.85, 360)} />
              </AnimatedContent>
            )}
            {hasTerminalAccess() && activeTab === 'cc-bridge' && (
              <AnimatedContent
                distance={20}
                duration={0.25}
                direction="vertical"
                className="h-full"
              >
                <BridgeLogPanel sidebarWidth={Math.min(window.innerWidth * 0.85, 360)} />
              </AnimatedContent>
            )}
            {activeTab === 'agent-log' && (
              <AnimatedContent
                distance={20}
                duration={0.25}
                direction="vertical"
                className="h-full"
              >
                <AgentLogSidebarContent />
              </AnimatedContent>
            )}
            {activeTab === 'console' && (
              <AnimatedContent
                distance={20}
                duration={0.25}
                direction="vertical"
                className="h-full"
              >
                <ConsolePanel />
              </AnimatedContent>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <div
      className="left-sidebar-float glass-soft flex flex-col"
      style={{ width: leftSidebarWidth, transition: 'width 150ms var(--ease-default)' }}
      data-collapsed={!leftSidebarOpen}
    >
      {/* Panel header — display font, italic, accent-glow */}
      <div
        style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: '20px',
            color: 'var(--accent-glow)',
          }}
        >
          {tabLabels[activeTab] || 'Outline'}
        </span>
      </div>

      {/* Content area - shows active tab panel */}
      <div className="flex-1 overflow-hidden">
        {(activeTab === 'layers' || activeTab === 'extractions') && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical" className="h-full">
            <LayersPanel sidebarWidth={leftSidebarWidth} />
          </AnimatedContent>
        )}
        {activeTab === 'activity' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical" className="h-full">
            <ActivityFeedPanel sidebarWidth={leftSidebarWidth} />
          </AnimatedContent>
        )}
        {activeTab === 'dispatch' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical" className="h-full">
            <DispatchPanel sidebarWidth={leftSidebarWidth} />
          </AnimatedContent>
        )}
        {hasTerminalAccess() && activeTab === 'cc-bridge' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical" className="h-full">
            <BridgeLogPanel sidebarWidth={leftSidebarWidth} />
          </AnimatedContent>
        )}
        {activeTab === 'agent-log' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical" className="h-full">
            <AgentLogSidebarContent />
          </AnimatedContent>
        )}
        {activeTab === 'console' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical" className="h-full">
            <ConsolePanel />
          </AnimatedContent>
        )}
      </div>

      {/* Resize handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className={`gui-resize-handle right-0 group z-10 ${isResizing ? 'active' : ''}`}
        style={{ marginRight: '-4px' }}
      >
        <div
          className={`absolute right-0 top-1/2 -translate-y-1/2 p-0.5 transition-opacity ${
            isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <GripVertical className={`w-3 h-3 ${isResizing ? 'text-white' : 'gui-text-secondary'}`} />
        </div>
      </div>
    </div>
  )
}

export const LeftSidebar = memo(LeftSidebarComponent)
