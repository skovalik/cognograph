import { memo, useCallback, useRef, useState } from 'react'
import { Layers, ChevronLeft, GripVertical, Activity, Send, ScrollText } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useUIStore, selectLeftSidebarTab } from '../stores/uiStore'
import { AnimatedContent } from './ui/react-bits'
import { LayersPanel } from './LayersPanel'
import { ActivityFeedPanel } from './ActivityFeedPanel'
import { DispatchPanel } from './DispatchPanel'
import { BridgeLogPanel } from './bridge/BridgeLogPanel'

type SidebarTab = 'layers' | 'extractions' | 'activity' | 'dispatch' | 'bridge-log'

const TAB_CONFIG: Array<{ id: SidebarTab; label: string; icon: typeof Layers }> = [
  { id: 'layers', label: 'Outline', icon: Layers },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'dispatch', label: 'Dispatch', icon: Send },
  { id: 'bridge-log', label: 'Bridge Log', icon: ScrollText },
]

function LeftSidebarComponent(): JSX.Element | null {
  const leftSidebarOpen = useWorkspaceStore((state) => state.leftSidebarOpen)
  const leftSidebarWidth = useWorkspaceStore((state) => state.leftSidebarWidth)
  const toggleLeftSidebar = useWorkspaceStore((state) => state.toggleLeftSidebar)
  const setLeftSidebarWidth = useWorkspaceStore((state) => state.setLeftSidebarWidth)
  const activeTab = useUIStore(selectLeftSidebarTab)
  const setActiveTab = useUIStore((s) => s.setLeftSidebarTab)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Responsive thresholds based on sidebar width
  const isCompact = leftSidebarWidth < 200

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

  // Collapsed state - return null (toggle is now in Toolbar)
  if (!leftSidebarOpen) {
    return null
  }

  return (
    <div
      className="relative h-full border-r flex flex-col gui-panel glass-soft gui-border"
      style={{ width: leftSidebarWidth }}
    >
      {/* Header with tab buttons */}
      <div className="flex items-center justify-between px-2 py-2 border-b gui-border">
        <div className="flex gap-1">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`gui-tab ${activeTab === id ? 'gui-tab-active' : ''} ${isCompact ? 'px-2' : ''}`}
              title={label}
              onClick={() => setActiveTab(id)}
              style={{ color: activeTab === id ? 'var(--gui-toolbar-icon-2)' : 'var(--text-muted)' }}
            >
              <Icon className="w-3.5 h-3.5" />
              {!isCompact && label}
            </button>
          ))}
        </div>
        <button
          onClick={toggleLeftSidebar}
          className="p-1 gui-button rounded transition-colors"
          title="Close sidebar"
        >
          <ChevronLeft className="w-4 h-4 gui-text-secondary" />
        </button>
      </div>

      {/* Content area - shows active tab panel */}
      <div className="flex-1 overflow-hidden">
        {(activeTab === 'layers' || activeTab === 'extractions') && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical">
            <LayersPanel sidebarWidth={leftSidebarWidth} />
          </AnimatedContent>
        )}
        {activeTab === 'activity' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical">
            <ActivityFeedPanel sidebarWidth={leftSidebarWidth} />
          </AnimatedContent>
        )}
        {activeTab === 'dispatch' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical">
            <DispatchPanel sidebarWidth={leftSidebarWidth} />
          </AnimatedContent>
        )}
        {activeTab === 'bridge-log' && (
          <AnimatedContent distance={20} duration={0.25} direction="vertical">
            <BridgeLogPanel sidebarWidth={leftSidebarWidth} />
          </AnimatedContent>
        )}
      </div>

      {/* Resize handle - wider hit area for easier grabbing */}
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
