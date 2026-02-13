/**
 * AlignmentToolbar Component
 *
 * A floating toolbar that appears when multiple nodes are selected.
 * Provides alignment and distribution actions for selected nodes.
 */

import { memo, useMemo, useState } from 'react'
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Grid3x3,
  LayoutGrid,
  ArrowDownAZ,
  Link,
  Unlink,
  Network,
  ChevronDown,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowLeft,
  Circle,
  Atom,
  Check
} from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { SpacingPreset } from '../utils/layoutAlgorithms'

function AlignmentToolbarComponent(): JSX.Element | null {
  const selectedNodeIds = useWorkspaceStore((state) => state.selectedNodeIds)
  const edges = useWorkspaceStore((state) => state.edges)
  const alignNodes = useWorkspaceStore((state) => state.alignNodes)
  const distributeNodes = useWorkspaceStore((state) => state.distributeNodes)
  const snapToGrid = useWorkspaceStore((state) => state.snapToGrid)
  const arrangeInGrid = useWorkspaceStore((state) => state.arrangeInGrid)
  const sortByType = useWorkspaceStore((state) => state.sortByType)
  const linkSelectedNodes = useWorkspaceStore((state) => state.linkSelectedNodes)
  const unlinkSelectedNodes = useWorkspaceStore((state) => state.unlinkSelectedNodes)
  const applyAutoLayout = useWorkspaceStore((state) => state.applyAutoLayout)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const updateThemeSettings = useWorkspaceStore((state) => state.updateThemeSettings)

  // Layout dropdown state
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)

  // Current spacing preset from settings
  const currentSpacing: SpacingPreset = themeSettings.layoutSpacing || 'default'

  // Check if there are any edges between selected nodes
  const hasEdgesBetweenSelected = useMemo(() => {
    if (selectedNodeIds.length < 2) return false
    const nodeIdSet = new Set(selectedNodeIds)
    return edges.some((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
  }, [selectedNodeIds, edges])

  // Don't show if less than 2 nodes selected
  if (selectedNodeIds.length < 2) {
    return null
  }

  const canDistribute = selectedNodeIds.length >= 3

  const buttonClass = 'p-1.5 rounded transition-colors hover:bg-[var(--surface-panel-secondary)] text-[var(--text-secondary)]'

  const disabledClass = 'opacity-30 cursor-not-allowed'

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 backdrop-blur-sm rounded-lg p-1.5 border shadow-lg"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--gui-panel-bg-secondary) 90%, transparent)',
        borderColor: 'var(--gui-border)'
      }}
    >
      {/* Horizontal Alignment */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => alignNodes(selectedNodeIds, 'left')}
          className={buttonClass}
          title="Align left edges"
        >
          <AlignStartVertical className="w-4 h-4" />
        </button>
        <button
          onClick={() => alignNodes(selectedNodeIds, 'center')}
          className={buttonClass}
          title="Align horizontal centers"
        >
          <AlignCenterVertical className="w-4 h-4" />
        </button>
        <button
          onClick={() => alignNodes(selectedNodeIds, 'right')}
          className={buttonClass}
          title="Align right edges"
        >
          <AlignEndVertical className="w-4 h-4" />
        </button>
      </div>

      <div
        className="w-px h-5 mx-1"
        style={{ backgroundColor: 'var(--gui-border-strong)' }}
      />

      {/* Vertical Alignment */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => alignNodes(selectedNodeIds, 'top')}
          className={buttonClass}
          title="Align top edges"
        >
          <AlignStartHorizontal className="w-4 h-4" />
        </button>
        <button
          onClick={() => alignNodes(selectedNodeIds, 'middle')}
          className={buttonClass}
          title="Align vertical centers"
        >
          <AlignCenterHorizontal className="w-4 h-4" />
        </button>
        <button
          onClick={() => alignNodes(selectedNodeIds, 'bottom')}
          className={buttonClass}
          title="Align bottom edges"
        >
          <AlignEndHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div
        className="w-px h-5 mx-1"
        style={{ backgroundColor: 'var(--gui-border-strong)' }}
      />

      {/* Distribution */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => canDistribute && distributeNodes(selectedNodeIds, 'horizontal')}
          className={`${buttonClass} ${!canDistribute ? disabledClass : ''}`}
          title={canDistribute ? 'Distribute horizontally' : 'Select 3+ nodes to distribute'}
          disabled={!canDistribute}
        >
          <AlignHorizontalSpaceAround className="w-4 h-4" />
        </button>
        <button
          onClick={() => canDistribute && distributeNodes(selectedNodeIds, 'vertical')}
          className={`${buttonClass} ${!canDistribute ? disabledClass : ''}`}
          title={canDistribute ? 'Distribute vertically' : 'Select 3+ nodes to distribute'}
          disabled={!canDistribute}
        >
          <AlignVerticalSpaceAround className="w-4 h-4" />
        </button>
      </div>

      <div
        className="w-px h-5 mx-1"
        style={{ backgroundColor: 'var(--gui-border-strong)' }}
      />

      {/* Grid Actions */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => snapToGrid(selectedNodeIds)}
          className={buttonClass}
          title="Snap to grid (20px)"
        >
          <Grid3x3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => arrangeInGrid(selectedNodeIds)}
          className={buttonClass}
          title="Arrange in grid"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => sortByType(selectedNodeIds)}
          className={buttonClass}
          title="Sort by type"
        >
          <ArrowDownAZ className="w-4 h-4" />
        </button>
      </div>

      <div
        className="w-px h-5 mx-1"
        style={{ backgroundColor: 'var(--gui-border-strong)' }}
      />

      {/* Link/Unlink */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => linkSelectedNodes(selectedNodeIds)}
          className={buttonClass}
          title="Link nodes in chain (by position)"
        >
          <Link className="w-4 h-4" />
        </button>
        <button
          onClick={() => unlinkSelectedNodes(selectedNodeIds)}
          className={`${buttonClass} ${!hasEdgesBetweenSelected ? disabledClass : ''}`}
          title={hasEdgesBetweenSelected ? 'Remove links between selected' : 'No links between selected nodes'}
          disabled={!hasEdgesBetweenSelected}
        >
          <Unlink className="w-4 h-4" />
        </button>
      </div>

      <div
        className="w-px h-5 mx-1"
        style={{ backgroundColor: 'var(--gui-border-strong)' }}
      />

      {/* Auto-Layout */}
      <div className="relative">
        <button
          onClick={() => setShowLayoutMenu(!showLayoutMenu)}
          className={`${buttonClass} flex items-center gap-0.5`}
          title="Auto-arrange layout"
        >
          <Network className="w-4 h-4" />
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Layout dropdown menu */}
        {showLayoutMenu && (
          <div
            className="absolute bottom-full mb-2 left-0 rounded-lg border shadow-xl py-1 min-w-[180px]"
            style={{
              backgroundColor: 'var(--gui-panel-bg-secondary)',
              borderColor: 'var(--gui-border)'
            }}
          >
            <div className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--gui-text-muted)' }}>
              Hierarchical
            </div>
            <button
              onClick={() => { applyAutoLayout('hierarchical-down', selectedNodeIds, currentSpacing); setShowLayoutMenu(false) }}
              className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-[var(--surface-panel-secondary)]"
              style={{ color: 'var(--gui-text-primary)' }}
            >
              <ArrowDown className="w-4 h-4" /> Tree (Down)
            </button>
            <button
              onClick={() => { applyAutoLayout('hierarchical-right', selectedNodeIds, currentSpacing); setShowLayoutMenu(false) }}
              className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-[var(--surface-panel-secondary)]"
              style={{ color: 'var(--gui-text-primary)' }}
            >
              <ArrowRight className="w-4 h-4" /> Tree (Right)
            </button>
            <button
              onClick={() => { applyAutoLayout('hierarchical-up', selectedNodeIds, currentSpacing); setShowLayoutMenu(false) }}
              className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-[var(--surface-panel-secondary)]"
              style={{ color: 'var(--gui-text-primary)' }}
            >
              <ArrowUp className="w-4 h-4" /> Tree (Up)
            </button>
            <button
              onClick={() => { applyAutoLayout('hierarchical-left', selectedNodeIds, currentSpacing); setShowLayoutMenu(false) }}
              className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-[var(--surface-panel-secondary)]"
              style={{ color: 'var(--gui-text-primary)' }}
            >
              <ArrowLeft className="w-4 h-4" /> Tree (Left)
            </button>

            <div className="my-1 border-t" style={{ borderColor: 'var(--gui-border)' }} />

            <div className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--gui-text-muted)' }}>
              Other
            </div>
            <button
              onClick={() => { applyAutoLayout('force', selectedNodeIds, currentSpacing); setShowLayoutMenu(false) }}
              className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-[var(--surface-panel-secondary)]"
              style={{ color: 'var(--gui-text-primary)' }}
            >
              <Atom className="w-4 h-4" /> Force-directed
            </button>
            <button
              onClick={() => { applyAutoLayout('circular', selectedNodeIds, currentSpacing); setShowLayoutMenu(false) }}
              className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-[var(--surface-panel-secondary)]"
              style={{ color: 'var(--gui-text-primary)' }}
            >
              <Circle className="w-4 h-4" /> Circular
            </button>

            <div className="my-1 border-t" style={{ borderColor: 'var(--gui-border)' }} />

            {/* Spacing Presets */}
            <div className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--gui-text-muted)' }}>
              Spacing
            </div>
            <button
              onClick={() => updateThemeSettings({ layoutSpacing: 'narrow' })}
              className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-[var(--surface-panel-secondary)]"
              style={{ color: 'var(--gui-text-primary)' }}
            >
              {currentSpacing === 'narrow' ? <Check className="w-4 h-4" /> : <div className="w-4 h-4" />}
              Narrow
            </button>
            <button
              onClick={() => updateThemeSettings({ layoutSpacing: 'default' })}
              className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-[var(--surface-panel-secondary)]"
              style={{ color: 'var(--gui-text-primary)' }}
            >
              {currentSpacing === 'default' ? <Check className="w-4 h-4" /> : <div className="w-4 h-4" />}
              Default
            </button>
            <button
              onClick={() => updateThemeSettings({ layoutSpacing: 'wide' })}
              className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-[var(--surface-panel-secondary)]"
              style={{ color: 'var(--gui-text-primary)' }}
            >
              {currentSpacing === 'wide' ? <Check className="w-4 h-4" /> : <div className="w-4 h-4" />}
              Wide
            </button>
          </div>
        )}
      </div>

      {/* Selection count badge */}
      <div
        className="ml-1 px-2 py-0.5 rounded text-xs"
        style={{
          backgroundColor: 'var(--gui-accent-primary)',
          color: 'white'
        }}
      >
        {selectedNodeIds.length}
      </div>
    </div>
  )
}

export const AlignmentToolbar = memo(AlignmentToolbarComponent)
