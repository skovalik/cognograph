/**
 * ArtboardOverlay — Full-viewport glassmorphic overlay for artboard mode
 *
 * When a node enters artboard mode (Cmd/Ctrl+Enter), this overlay:
 * - Dims surrounding content (opacity 0.4, backdrop-filter: blur(1px))
 * - Renders a centered panel at 60% viewport width, max-height 80vh
 * - Renders per-type editing panels for all node types
 * - Close button (x) and Escape to exit
 * - Smooth 200ms fade-in/out animation
 *
 * Also exports FocusModeHint — a tooltip shown below a selected node after 1s
 * indicating the Cmd/Ctrl+Enter shortcut for discoverability.
 */

import { memo, useEffect, useState, useCallback, type CSSProperties } from 'react'
import { X, Maximize2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUIStore } from '../stores/uiStore'
import { useNodesStore } from '../stores/nodesStore'
import { useSelectionStore } from '../stores/selectionStore'
import type { NodeData } from '@shared/types'
import { ConversationArtboard } from './artboards/ConversationArtboard'
import { ArtifactArtboard } from './artboards/ArtifactArtboard'
import { TaskArtboard } from './artboards/TaskArtboard'
import { ProjectArtboard } from './artboards/ProjectArtboard'
import { OrchestratorArtboard } from './artboards/OrchestratorArtboard'
import { NoteArtboard } from './artboards/NoteArtboard'
import { TextArtboard } from './artboards/TextArtboard'

// =============================================================================
// Platform Detection
// =============================================================================

const isMac =
  typeof navigator !== 'undefined' &&
  (navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac'))

// =============================================================================
// ArtboardOverlay
// =============================================================================

function ArtboardOverlayComponent(): JSX.Element | null {
  const artboardNodeId = useUIStore((s) => s.artboardNodeId)
  const exitArtboard = useUIStore((s) => s.exitArtboard)
  const nodes = useNodesStore((s) => s.nodes)

  const activeNode = artboardNodeId
    ? nodes.find((n) => n.id === artboardNodeId)
    : null

  const nodeData = activeNode?.data as NodeData | undefined
  const title = nodeData?.title || 'Untitled'
  const nodeType = nodeData?.type || 'unknown'

  const handleClose = useCallback(() => {
    exitArtboard()
  }, [exitArtboard])

  // Click on backdrop dismisses
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose()
      }
    },
    [handleClose]
  )

  // Node type display label
  const typeLabel = nodeType.charAt(0).toUpperCase() + nodeType.slice(1)

  // Node type accent color (matches existing node color conventions)
  const typeColor = getNodeTypeColor(nodeType)

  return (
    <AnimatePresence>
      {artboardNodeId && (
        <motion.div
          key="artboard-overlay"
          className="fixed inset-0 flex items-center justify-center"
          style={{
            zIndex: 9000,
            pointerEvents: 'auto'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={handleBackdropClick}
        >
          {/* Dim backdrop */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(1px)',
              WebkitBackdropFilter: 'blur(1px)'
            }}
          />

          {/* Artboard panel */}
          <motion.div
            className="relative glass-soft"
            style={{
              width: '60vw',
              maxWidth: '1200px',
              minWidth: '400px',
              maxHeight: '80vh',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            } as CSSProperties}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Header bar */}
            <div
              className="flex items-center justify-between px-5 py-3 shrink-0"
              style={{
                borderBottom: '1px solid var(--gui-border)'
              }}
            >
              <div className="flex items-center gap-3">
                <Maximize2
                  className="w-4 h-4"
                  style={{ color: typeColor }}
                />
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${typeColor} 15%, transparent)`,
                      color: typeColor
                    }}
                  >
                    {typeLabel}
                  </span>
                  <span
                    className="text-sm font-medium truncate max-w-[400px]"
                    style={{ color: 'var(--gui-text-primary)' }}
                  >
                    {title}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--gui-bg-secondary)',
                    color: 'var(--gui-text-muted)'
                  }}
                >
                  Esc
                </span>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-md transition-colors duration-150"
                  style={{
                    color: 'var(--gui-text-muted)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gui-bg-tertiary)'
                    e.currentTarget.style.color = 'var(--gui-text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--gui-text-muted)'
                  }}
                  aria-label="Close artboard"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content area — per-type artboard panels */}
            <div
              className="flex-1 overflow-hidden"
              style={{ minHeight: '300px' }}
            >
              {renderArtboardContent(nodeType, artboardNodeId!, title, typeLabel, typeColor)}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const ArtboardOverlay = memo(ArtboardOverlayComponent)

// =============================================================================
// FocusModeHint — Discoverability Tooltip
// =============================================================================

/**
 * Shows a subtle tooltip below a selected node after 1s:
 * "Cmd+Enter Focus mode" (macOS) or "Ctrl+Enter Focus mode" (Windows)
 *
 * Fades in on selection, fades out on deselection.
 * Not shown when artboard is already active.
 */
function FocusModeHintComponent(): JSX.Element | null {
  const selectedNodeIds = useSelectionStore((s) => s.selectedNodeIds)
  const artboardNodeId = useUIStore((s) => s.artboardNodeId)
  const [visible, setVisible] = useState(false)

  const singleSelectedId =
    selectedNodeIds.length === 1 ? selectedNodeIds[0] : null
  const shouldShow = singleSelectedId !== null && artboardNodeId === null

  useEffect(() => {
    if (!shouldShow) {
      setVisible(false)
      return
    }

    // Delay 1s before showing
    const timer = setTimeout(() => {
      setVisible(true)
    }, 1000)

    return () => {
      clearTimeout(timer)
      setVisible(false)
    }
  }, [shouldShow, singleSelectedId])

  if (!visible) return null

  const shortcutText = isMac ? '\u2318\u21B5 Focus mode' : 'Ctrl+Enter Focus mode'

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: 8000 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.2 }}
        className="px-3 py-1.5 rounded-md text-xs"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--gui-bg-tertiary) 95%, transparent)',
          border: '1px solid var(--gui-border)',
          color: 'var(--gui-text-muted)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        }}
      >
        {shortcutText}
      </motion.div>
    </div>
  )
}

export const FocusModeHint = memo(FocusModeHintComponent)

// =============================================================================
// Helpers
// =============================================================================

/**
 * Render the per-type artboard content panel.
 * Covers all 9 node types: conversation, artifact, task, project,
 * orchestrator, note, text, plus fallback for action/workspace/unknown.
 */
function renderArtboardContent(
  nodeType: string,
  nodeId: string,
  title: string,
  typeLabel: string,
  typeColor: string
): JSX.Element {
  switch (nodeType) {
    case 'conversation':
      return <ConversationArtboard nodeId={nodeId} />
    case 'artifact':
      return <ArtifactArtboard nodeId={nodeId} />
    case 'task':
      return <TaskArtboard nodeId={nodeId} />
    case 'project':
      return <ProjectArtboard nodeId={nodeId} />
    case 'orchestrator':
      return <OrchestratorArtboard nodeId={nodeId} />
    case 'note':
      return <NoteArtboard nodeId={nodeId} />
    case 'text':
      return <TextArtboard nodeId={nodeId} />
    default:
      return (
        <div
          className="flex items-center justify-center h-full p-8"
          style={{ color: 'var(--gui-text-muted)' }}
        >
          <div className="text-center">
            <Maximize2
              className="w-12 h-12 mx-auto mb-4 opacity-30"
              style={{ color: typeColor }}
            />
            <p className="text-sm mb-1" style={{ color: 'var(--gui-text-primary)' }}>
              Artboard Mode
            </p>
            <p className="text-xs" style={{ color: 'var(--gui-text-muted)' }}>
              Editing panel for {typeLabel} nodes coming soon.
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--gui-text-muted)' }}>
              Node: <span style={{ color: typeColor }}>{title}</span> ({typeLabel})
            </p>
          </div>
        </div>
      )
  }
}

/**
 * Map node type to accent color — matches the existing node color conventions
 * used throughout the codebase.
 */
function getNodeTypeColor(type: string): string {
  switch (type) {
    case 'conversation':
      return 'var(--node-conversation)'
    case 'note':
      return 'var(--node-note)'
    case 'task':
      return 'var(--node-task)'
    case 'project':
      return 'var(--node-project)'
    case 'artifact':
      return 'var(--node-artifact)'
    case 'workspace':
      return 'var(--node-workspace)'
    case 'text':
      return 'var(--node-text)'
    case 'action':
      return 'var(--node-action)'
    case 'orchestrator':
      return 'var(--node-orchestrator)'
    default:
      return 'var(--gui-text-muted)'
  }
}
