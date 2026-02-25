// NodeHoverPreview — PFD Phase 5B: Quick-Look
// Shows a tooltip-like preview of node content after 300ms hover.
// Reduces decision cost of "should I look at this node?"
//
// Renders as a fixed-position element near the cursor.
// Does NOT render during: drag, context viz active, or in-place expansion.

import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { NodeData, NoteNodeData, TaskNodeData, ArtifactNodeData, ProjectNodeData } from '@shared/types'

const HOVER_DELAY_MS = 300
const OFFSET_X = 16
const OFFSET_Y = 16

function NodeHoverPreviewComponent(): JSX.Element | null {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentNodeRef = useRef<string | null>(null)

  const clearHover = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    currentNodeRef.current = null
    setVisible(false)
    setHoveredNodeId(null)
  }, [])

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      // Find the closest React Flow node element
      const nodeEl = (e.target as HTMLElement).closest('.react-flow__node')
      if (!nodeEl) {
        clearHover()
        return
      }

      const nodeId = nodeEl.getAttribute('data-id')
      if (!nodeId || nodeId === currentNodeRef.current) return

      // Don't show preview during drag
      if (nodeEl.classList.contains('dragging')) {
        clearHover()
        return
      }

      // Don't show if the node is selected (user is already focused on it)
      if (nodeEl.classList.contains('selected')) {
        clearHover()
        return
      }

      // Cancel previous timer
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      currentNodeRef.current = nodeId
      setPosition({ x: e.clientX + OFFSET_X, y: e.clientY + OFFSET_Y })

      timerRef.current = setTimeout(() => {
        if (currentNodeRef.current === nodeId) {
          setHoveredNodeId(nodeId)
          setVisible(true)
        }
      }, HOVER_DELAY_MS)
    }

    const handleMouseOut = (e: MouseEvent) => {
      const nodeEl = (e.target as HTMLElement).closest('.react-flow__node')
      const relatedEl = (e.relatedTarget as HTMLElement)?.closest?.('.react-flow__node')

      if (nodeEl && nodeEl !== relatedEl) {
        clearHover()
      }
    }

    // Track mouse position for preview positioning
    const handleMouseMove = (e: MouseEvent) => {
      if (currentNodeRef.current && !visible) {
        setPosition({ x: e.clientX + OFFSET_X, y: e.clientY + OFFSET_Y })
      }
    }

    document.addEventListener('mouseover', handleMouseOver, true)
    document.addEventListener('mouseout', handleMouseOut, true)
    document.addEventListener('mousemove', handleMouseMove, true)

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true)
      document.removeEventListener('mouseout', handleMouseOut, true)
      document.removeEventListener('mousemove', handleMouseMove, true)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [clearHover, visible])

  if (!visible || !hoveredNodeId) return null

  const node = nodes.find(n => n.id === hoveredNodeId)
  if (!node) return null

  const preview = getNodePreview(node.data)
  if (!preview) return null

  // Clamp position to viewport bounds
  const clampedX = Math.min(position.x, window.innerWidth - 340)
  const clampedY = Math.min(position.y, window.innerHeight - 120)

  return (
    <div
      className="node-hover-preview"
      style={{ left: clampedX, top: clampedY }}
    >
      <div className="node-hover-preview__title">{preview.title}</div>
      {preview.meta && <div className="node-hover-preview__meta">{preview.meta}</div>}
      {preview.content ? (
        <div className="node-hover-preview__content">{preview.content}</div>
      ) : (
        <div className="node-hover-preview__empty">No content</div>
      )}
    </div>
  )
}

interface PreviewData {
  title: string
  meta?: string
  content?: string
}

function getNodePreview(data: NodeData): PreviewData | null {
  switch (data.type) {
    case 'note': {
      const noteData = data as NoteNodeData
      const content = noteData.content
        ? stripHtml(noteData.content).slice(0, 200)
        : undefined
      return {
        title: noteData.title || 'Untitled Note',
        meta: noteData.noteMode ? `Note · ${noteData.noteMode}` : 'Note',
        content
      }
    }
    case 'task': {
      const taskData = data as TaskNodeData
      return {
        title: taskData.title || 'Untitled Task',
        meta: `Task · ${taskData.status} · ${taskData.priority}`,
        content: taskData.description?.slice(0, 200)
      }
    }
    case 'artifact': {
      const artData = data as ArtifactNodeData
      const content = artData.content?.slice(0, 200)
      return {
        title: artData.title || 'Untitled Artifact',
        meta: `Artifact · ${artData.contentType}${artData.language ? ` · ${artData.language}` : ''}`,
        content
      }
    }
    case 'project': {
      const projData = data as ProjectNodeData
      return {
        title: projData.title || 'Untitled Project',
        meta: `Project · ${projData.childNodeIds.length} items`,
        content: projData.description?.slice(0, 200)
      }
    }
    default:
      return null
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export const NodeHoverPreview = memo(NodeHoverPreviewComponent)
