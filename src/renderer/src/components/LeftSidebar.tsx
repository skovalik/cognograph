import { memo, useCallback, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useUIStore, selectLeftSidebarTab } from '../stores/uiStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { AnimatedContent } from './ui/react-bits'
import { LayersPanel } from './LayersPanel'
import { ActivityFeedPanel } from './ActivityFeedPanel'
import { DispatchPanel } from './DispatchPanel'
import { BridgeLogPanel } from './bridge/BridgeLogPanel'
import { hasTerminalAccess } from '../utils/terminalAccess'

function LeftSidebarComponent(): JSX.Element | null {
  const isMobile = useIsMobile()
  const leftSidebarOpen = useWorkspaceStore((state) => state.leftSidebarOpen)
  const leftSidebarWidth = useWorkspaceStore((state) => state.leftSidebarWidth)
  const setLeftSidebarWidth = useWorkspaceStore((state) => state.setLeftSidebarWidth)
  const activeTab = useUIStore(selectLeftSidebarTab)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
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
  }, [leftSidebarWidth, setLeftSidebarWidth])

  // Hidden on mobile — PFD R1: canvas-only default
  if (isMobile) return null

  // Collapsed state
  if (!leftSidebarOpen) {
    return null
  }

  // Section header label
  const tabLabels: Record<string, string> = {
    'layers': 'Outline',
    'extractions': 'Outline',
    'activity': 'Activity',
    'dispatch': 'Dispatch',
    'bridge-log': 'Bridge Log',
  }

  return (
    <div
      className="relative h-full flex flex-col gui-panel gui-border gui-sidebar"
      style={{
        width: leftSidebarWidth,
        borderRight: '1px solid var(--glass-border)',
        transition: 'width 150ms var(--ease-default)',
      }}
    >
      {/* Panel header — display font, italic, accent-glow */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: '20px',
          color: 'var(--accent-glow)',
        }}>
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
        {hasTerminalAccess() && activeTab === 'dispatch' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical" className="h-full">
            <DispatchPanel sidebarWidth={leftSidebarWidth} />
          </AnimatedContent>
        )}
        {hasTerminalAccess() && activeTab === 'bridge-log' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical" className="h-full">
            <BridgeLogPanel sidebarWidth={leftSidebarWidth} />
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
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 p-0.5 transition-opacity ${
          isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <GripVertical className={`w-3 h-3 ${isResizing ? 'text-white' : 'gui-text-secondary'}`} />
        </div>
      </div>
    </div>
  )
}

export const LeftSidebar = memo(LeftSidebarComponent)
