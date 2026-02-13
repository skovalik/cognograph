/**
 * Shift+Drag Edge Creation Hook
 *
 * Enables creating edges by holding Shift and dragging from one node to another.
 * This is a direct manipulation pattern common in tools like MindNode, Figma, etc.
 *
 * Interaction flow:
 * 1. User holds Shift over a node → cursor becomes crosshair, tooltip shows "drag to connect"
 * 2. User starts dragging (Shift+mousedown+drag) → dashed preview line follows cursor
 * 3. User releases over valid target → edge created
 * 4. User releases over canvas/invalid target → no edge, line disappears
 * 5. User presses Escape or releases Shift → cancels drag
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'

export interface ShiftDragState {
  isActive: boolean
  isShiftHeld: boolean
  sourceNodeId: string | null
  sourcePosition: { x: number; y: number } | null
  cursorPosition: { x: number; y: number } | null
  targetNodeId: string | null
  isValidTarget: boolean
}

const initialState: ShiftDragState = {
  isActive: false,
  isShiftHeld: false,
  sourceNodeId: null,
  sourcePosition: null,
  cursorPosition: null,
  targetNodeId: null,
  isValidTarget: false
}

interface UseShiftDragEdgeCreationOptions {
  onEdgeCreate: (sourceId: string, targetId: string) => void
  existingEdges: Array<{ source: string; target: string }>
}

export function useShiftDragEdgeCreation({
  onEdgeCreate,
  existingEdges
}: UseShiftDragEdgeCreationOptions) {
  const [state, setState] = useState<ShiftDragState>(initialState)
  const { getNodes, screenToFlowPosition } = useReactFlow()
  const stateRef = useRef(state)
  stateRef.current = state

  // Reset to initial state
  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  // Check if an edge already exists between two nodes
  const edgeExists = useCallback(
    (sourceId: string, targetId: string): boolean => {
      return existingEdges.some(
        (e) =>
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)
      )
    },
    [existingEdges]
  )

  // Find node under cursor position (in screen coordinates)
  const findNodeAtPosition = useCallback(
    (screenX: number, screenY: number): string | null => {
      const nodes = getNodes()
      const flowPos = screenToFlowPosition({ x: screenX, y: screenY })

      for (const node of nodes) {
        const nodeWidth = (node.width as number) || node.measured?.width || 280
        const nodeHeight = (node.height as number) || node.measured?.height || 140

        if (
          flowPos.x >= node.position.x &&
          flowPos.x <= node.position.x + nodeWidth &&
          flowPos.y >= node.position.y &&
          flowPos.y <= node.position.y + nodeHeight
        ) {
          return node.id
        }
      }
      return null
    },
    [getNodes, screenToFlowPosition]
  )

  // Get node center position in flow coordinates
  const getNodeCenter = useCallback(
    (nodeId: string): { x: number; y: number } | null => {
      const nodes = getNodes()
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return null

      const width = (node.width as number) || node.measured?.width || 280
      const height = (node.height as number) || node.measured?.height || 140

      return {
        x: node.position.x + width / 2,
        y: node.position.y + height / 2
      }
    },
    [getNodes]
  )

  // Start the shift+drag edge creation
  const startDrag = useCallback(
    (nodeId: string, screenX: number, screenY: number) => {
      const sourcePos = getNodeCenter(nodeId)
      if (!sourcePos) return

      const flowPos = screenToFlowPosition({ x: screenX, y: screenY })

      setState({
        isActive: true,
        sourceNodeId: nodeId,
        sourcePosition: sourcePos,
        cursorPosition: flowPos,
        targetNodeId: null,
        isValidTarget: false
      })
    },
    [getNodeCenter, screenToFlowPosition]
  )

  // Update cursor position during drag
  const updateDrag = useCallback(
    (screenX: number, screenY: number) => {
      if (!stateRef.current.isActive || !stateRef.current.sourceNodeId) return

      const flowPos = screenToFlowPosition({ x: screenX, y: screenY })
      const targetNodeId = findNodeAtPosition(screenX, screenY)

      // Check if target is valid (not self, not already connected)
      let isValidTarget = false
      if (targetNodeId && targetNodeId !== stateRef.current.sourceNodeId) {
        isValidTarget = !edgeExists(stateRef.current.sourceNodeId, targetNodeId)
      }

      setState((s) => ({
        ...s,
        cursorPosition: flowPos,
        targetNodeId,
        isValidTarget
      }))
    },
    [screenToFlowPosition, findNodeAtPosition, edgeExists]
  )

  // End the drag and potentially create edge
  const endDrag = useCallback(() => {
    const currentState = stateRef.current
    if (
      currentState.isActive &&
      currentState.sourceNodeId &&
      currentState.targetNodeId &&
      currentState.isValidTarget
    ) {
      onEdgeCreate(currentState.sourceNodeId, currentState.targetNodeId)
    }
    reset()
  }, [onEdgeCreate, reset])

  // Find node ID from a React Flow node DOM element
  const getNodeIdFromElement = (element: HTMLElement | null): string | null => {
    while (element) {
      // React Flow nodes have data-id attribute
      const nodeId = element.getAttribute('data-id')
      if (nodeId && element.classList.contains('react-flow__node')) {
        return nodeId
      }
      element = element.parentElement
    }
    return null
  }

  // Global event listeners
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Only trigger on Shift+left click
      if (!e.shiftKey || e.button !== 0) return

      // Check if the click is on a node
      const nodeId = getNodeIdFromElement(e.target as HTMLElement)
      if (!nodeId) return

      // Check if clicking on a handle (don't interfere with normal connection)
      if ((e.target as HTMLElement).closest('.react-flow__handle')) return

      // Check if clicking on interactive elements inside nodes
      const interactive = (e.target as HTMLElement).closest(
        'input, textarea, button, [contenteditable], .tiptap, .ProseMirror'
      )
      if (interactive) return

      // Start the edge creation
      e.preventDefault()
      e.stopPropagation()
      startDrag(nodeId, e.clientX, e.clientY)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (stateRef.current.isActive) {
        updateDrag(e.clientX, e.clientY)
      }
    }

    const handleMouseUp = () => {
      if (stateRef.current.isActive) {
        endDrag()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cancel on Escape
      if (e.key === 'Escape' && stateRef.current.isActive) {
        reset()
      }
      // Track Shift key state for cursor feedback
      if (e.key === 'Shift' && !stateRef.current.isShiftHeld) {
        setState((s) => ({ ...s, isShiftHeld: true }))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Cancel if Shift is released during drag
      if (e.key === 'Shift') {
        if (stateRef.current.isActive) {
          reset()
        } else {
          setState((s) => ({ ...s, isShiftHeld: false }))
        }
      }
    }

    // Use capture phase to intercept before React Flow
    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [startDrag, updateDrag, endDrag, reset])

  // No longer need handleNodeMouseDown since we use global event listener
  return {
    state,
    reset
  }
}
