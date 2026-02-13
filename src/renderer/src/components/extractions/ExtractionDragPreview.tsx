import { memo, useEffect, useCallback } from 'react'
import { FileText, CheckSquare } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useExtractionDrag, useWorkspaceStore } from '../../stores/workspaceStore'

function ExtractionDragPreviewComponent(): JSX.Element | null {
  const drag = useExtractionDrag()
  const updateExtractionDragPosition = useWorkspaceStore((state) => state.updateExtractionDragPosition)
  const dropExtraction = useWorkspaceStore((state) => state.dropExtraction)
  const cancelExtractionDrag = useWorkspaceStore((state) => state.cancelExtractionDrag)

  const { screenToFlowPosition } = useReactFlow()

  // Track mouse movement during drag
  useEffect(() => {
    if (!drag) return

    const handleMouseMove = (e: MouseEvent): void => {
      updateExtractionDragPosition({ x: e.clientX, y: e.clientY })
    }

    const handleMouseUp = (e: MouseEvent): void => {
      // Check if dropped on canvas (not on UI elements)
      const target = e.target as HTMLElement
      const isCanvas = target.closest('.react-flow__pane') !== null

      if (isCanvas) {
        // Convert screen position to flow position
        const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        dropExtraction(flowPosition)
      } else {
        cancelExtractionDrag()
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        cancelExtractionDrag()
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [drag, updateExtractionDragPosition, dropExtraction, cancelExtractionDrag, screenToFlowPosition])

  // Handle native drag events on the canvas
  const handleCanvasDragOver = useCallback((e: DragEvent): void => {
    if (e.dataTransfer?.types.includes('application/extraction')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }, [])

  const handleCanvasDrop = useCallback(
    (e: DragEvent): void => {
      const extractionId = e.dataTransfer?.getData('application/extraction')
      if (!extractionId) return

      e.preventDefault()
      const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      dropExtraction(flowPosition)
    },
    [dropExtraction, screenToFlowPosition]
  )

  // Add drag event listeners to canvas
  useEffect(() => {
    const canvas = document.querySelector('.react-flow__pane')
    if (!canvas) return

    canvas.addEventListener('dragover', handleCanvasDragOver as EventListener)
    canvas.addEventListener('drop', handleCanvasDrop as EventListener)

    return () => {
      canvas.removeEventListener('dragover', handleCanvasDragOver as EventListener)
      canvas.removeEventListener('drop', handleCanvasDrop as EventListener)
    }
  }, [handleCanvasDragOver, handleCanvasDrop])

  // Don't render if no drag
  if (!drag) return null

  const Icon = drag.type === 'task' ? CheckSquare : FileText
  const iconClass =
    drag.type === 'task'
      ? 'extraction-drag-preview__icon extraction-drag-preview__icon--task'
      : 'extraction-drag-preview__icon extraction-drag-preview__icon--note'

  const displayTitle = drag.title.length > 30 ? drag.title.slice(0, 30) + '...' : drag.title

  return (
    <div
      className="extraction-drag-preview"
      style={{
        left: drag.position.x,
        top: drag.position.y
      }}
    >
      <div className={iconClass}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="extraction-drag-preview__title">{displayTitle}</span>
    </div>
  )
}

export const ExtractionDragPreview = memo(ExtractionDragPreviewComponent)
