import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Edit2, Check, X, HardDrive, Clock, MoreHorizontal, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useNodesStore, useEdgesStore, usePersistenceStore, useWorkspaceStore } from '../stores'

// Width thresholds for toolbar layout modes (must match Toolbar.tsx)
const VERTICAL_MODE_THRESHOLD = 900
const TWO_ROW_MODE_THRESHOLD = 1180

interface WorkspaceInfoProps {
  hasThemePanel?: boolean
  hasPropertiesPanel?: boolean
  propertiesPanelWidth?: number
}

function WorkspaceInfoComponent(_props: WorkspaceInfoProps): JSX.Element {
  const workspaceName = usePersistenceStore((s) => s.workspaceName)
  const saveStatus = usePersistenceStore((s) => s.saveStatus)
  const nodes = useNodesStore((s) => s.nodes)
  const edges = useEdgesStore((s) => s.edges)
  const preferVerticalToolbar = useWorkspaceStore((s) => s.workspacePreferences.preferVerticalToolbar) // Workspace preferences - stays in workspaceStore

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(workspaceName)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Listen to window resize
  useEffect(() => {
    const handleResize = (): void => {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Determine toolbar mode (must match Toolbar.tsx logic)
  const forceVertical = windowWidth < VERTICAL_MODE_THRESHOLD
  const isVerticalMode = forceVertical || preferVerticalToolbar
  const isTwoRowMode = !isVerticalMode && windowWidth < TWO_ROW_MODE_THRESHOLD

  // Calculate position based on toolbar mode
  // Note: WorkspaceInfo is positioned relative to the main canvas area (sibling to LeftSidebar),
  // so we don't need to account for sidebar width - it's handled by the flex layout
  const position = useMemo(() => {
    if (isVerticalMode) {
      // Vertical mode: position to the right of the vertical toolbar, top-aligned
      // Toolbar wrapper at top-4 (16px), toolbar content has 8px padding
      // Align WorkspaceInfo top with toolbar container top
      return {
        top: 16, // Same as toolbar's top-4
        left: 76, // Right of vertical toolbar with gap
        right: undefined
      }
    } else {
      // Horizontal mode (single row or two row): position below toolbar, left-aligned
      // Toolbar is at left: 16px within the canvas area, so we align with it
      const leftOffset = 16
      // Toolbar height: single row ~48px, two row ~88px, plus 16px top margin
      const topOffset = isTwoRowMode ? 108 : 68
      return {
        top: topOffset,
        left: leftOffset,
        right: undefined
      }
    }
  }, [isVerticalMode, isTwoRowMode])

  // Detect overflow
  useEffect(() => {
    const checkOverflow = (): void => {
      if (containerRef.current) {
        const isContentOverflowing = containerRef.current.scrollWidth > containerRef.current.clientWidth
        setIsOverflowing(isContentOverflowing)
      }
    }

    // Check on mount and when dependencies change
    checkOverflow()

    // Also check on resize
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [workspaceName, nodes.length, edges.length, saveStatus])

  // Calculate available width for the info bar
  // Note: availableWidth is relative to canvas area, not window, so we use a simpler calculation
  const availableWidth = useMemo(() => {
    if (isVerticalMode) {
      // In vertical mode, we have more horizontal space
      return windowWidth - 100 - 32 // 100 for left offset, 32 for margins
    }
    // In horizontal mode, limit width to avoid overlapping toolbar
    return Math.min(400, windowWidth - 64) // 64 for margins
  }, [windowWidth, isVerticalMode])

  // Determine what to show based on available width
  const isCompact = availableWidth < 350
  const isVeryCompact = availableWidth < 200

  const handleStartEdit = useCallback(() => {
    setEditName(workspaceName)
    setIsEditing(true)
  }, [workspaceName])

  const handleSaveName = useCallback(() => {
    if (editName.trim()) {
      // Update workspace name in store
      useWorkspaceStore.getState().updateWorkspaceName?.(editName.trim())
    }
    setIsEditing(false)
  }, [editName])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditName(workspaceName)
  }, [workspaceName])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }, [handleSaveName, handleCancelEdit])

  // Theme-aware styling using GUI theme CSS classes
  // Uses GUI panel background - colors are controlled by CSS variables
  const containerClasses = 'glass-soft gui-panel gui-border shadow-lg'
  const iconClasses = 'gui-text-secondary'
  const inputClasses = 'gui-input'
  const buttonHoverClasses = 'gui-button'
  const textClasses = 'gui-text'
  const dividerClasses = 'gui-border-strong'
  const statsClasses = 'gui-text-secondary'

  // Save status indicator config
  const saveIndicatorConfig = {
    saved: { icon: CheckCircle, text: 'Saved', className: 'text-green-500', animate: false },
    saving: { icon: Loader2, text: 'Saving...', className: 'text-blue-400', animate: true },
    unsaved: { icon: Clock, text: 'Unsaved', className: 'text-amber-500', animate: true },
    error: { icon: AlertTriangle, text: 'Save failed', className: 'text-red-500', animate: true }
  }
  const saveConfig = saveIndicatorConfig[saveStatus]
  const SaveIcon = saveConfig.icon

  // Hide completely if no space at all
  if (isVeryCompact) {
    return (
      <div
        className={`absolute z-40 flex items-center gap-2 backdrop-blur-sm rounded-lg px-2 py-2 border transition-all duration-200 ${containerClasses}`}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <span title={workspaceName}>
          <HardDrive className={`w-4 h-4 ${iconClasses}`} />
        </span>
        <span title={saveConfig.text}>
          <SaveIcon className={`w-3.5 h-3.5 ${saveConfig.className} ${saveConfig.animate ? 'animate-pulse' : ''}`} />
        </span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`absolute z-40 flex items-center gap-3 backdrop-blur-sm rounded-lg px-3 py-2 border overflow-hidden transition-all duration-200 ${containerClasses}`}
      style={{
        top: position.top,
        left: position.left,
        maxWidth: Math.max(200, availableWidth),
        
      }}
    >
      {/* Workspace name */}
      <div className="flex items-center gap-2 min-w-0">
        <HardDrive className={`w-4 h-4 flex-shrink-0 ${iconClasses}`} />

        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`border rounded px-2 py-0.5 text-sm focus:outline-none focus:border-blue-500 w-32 ${inputClasses}`}
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className={`p-1 ${buttonHoverClasses} rounded text-green-500 hover:text-green-400`}
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancelEdit}
              className={`p-1 ${buttonHoverClasses} rounded text-red-500 hover:text-red-400`}
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className={`flex items-center gap-1.5 text-sm ${textClasses} transition-colors group min-w-0`}
            title="Click to rename workspace"
          >
            <span className={`font-medium truncate ${isCompact ? 'max-w-[80px]' : 'max-w-[150px]'}`}>{workspaceName}</span>
            <Edit2 className={`w-3 h-3 flex-shrink-0 ${iconClasses} opacity-0 group-hover:opacity-100 transition-opacity`} />
          </button>
        )}
      </div>

      {/* Divider and stats - hidden when compact */}
      {!isCompact && (
        <>
          <div className={`w-px h-4 ${dividerClasses}`} />

          {/* Stats */}
          <div className={`flex items-center gap-3 text-xs ${statsClasses}`}>
            <span title="Nodes">{nodes.length} nodes</span>
            <span title="Edges">{edges.length} edges</span>
          </div>
        </>
      )}

      {/* Save status indicator - always visible for ND anxiety reduction */}
      <>
        <div className={`w-px h-4 ${dividerClasses}`} />
        <div className={`flex items-center gap-1.5 text-xs ${saveConfig.className}`} title={saveConfig.text}>
          <SaveIcon className={`w-3.5 h-3.5 ${saveConfig.animate ? 'animate-pulse' : ''} ${saveStatus === 'saving' ? 'animate-spin' : ''}`} />
          {!isCompact && <span>{saveConfig.text}</span>}
        </div>
      </>

      {/* Overflow indicator - uses inline style with CSS variable for gradient */}
      {isOverflowing && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center pr-1.5 pl-4 rounded-r-lg"
          style={{
            background: `linear-gradient(to left, var(--gui-panel-bg) 0%, color-mix(in srgb, var(--gui-panel-bg) 90%, transparent) 50%, transparent 100%)`
          }}
          title="More content hidden"
        >
          <MoreHorizontal className={`w-4 h-4 ${iconClasses}`} />
        </div>
      )}
    </div>
  )
}

export const WorkspaceInfo = memo(WorkspaceInfoComponent)
