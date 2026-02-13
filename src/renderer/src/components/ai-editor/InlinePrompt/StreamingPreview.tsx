/**
 * StreamingPreview Sub-Component
 *
 * Live preview of operations as they stream in.
 * Shows progress indicator and cancel button.
 */

import { memo } from 'react'
import {
  Plus,
  Trash2,
  Edit3,
  Move,
  Link,
  Unlink,
  Loader2,
  X,
  CheckCircle,
  XCircle,
  Play
} from 'lucide-react'
import type { MutationOp, StreamingPhase } from '@shared/types'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import LiveRegion from '../../a11y/LiveRegion'

interface StreamingPreviewProps {
  phase: StreamingPhase
  operations: MutationOp[]
  onCancel: () => void
  onApply?: () => void
  error?: string | null
}

const phaseMessages: Partial<Record<StreamingPhase, string>> = {
  connecting: 'Connecting...',
  analyzing: 'Analyzing workspace...',
  thinking: 'Planning changes...',
  generating: 'Generating operations...',
  parsing: 'Finalizing...',
  complete: 'Ready to apply!',
  cancelled: 'Cancelled',
  error: 'An error occurred'
}

function StreamingPreviewComponent({
  phase,
  operations,
  onCancel,
  onApply,
  error
}: StreamingPreviewProps): JSX.Element | null {
  const reducedMotion = useReducedMotion()
  const isActive = !['idle', 'complete', 'cancelled', 'error'].includes(phase)
  const isComplete = phase === 'complete'
  const isCancelled = phase === 'cancelled'
  const isError = phase === 'error'

  // Build announcement message for screen readers
  const announcementMessage = phaseMessages[phase] || ''

  if (phase === 'idle') {
    return null
  }

  const getOpIcon = (op: MutationOp) => {
    switch (op.op) {
      case 'create-node':
        return <Plus className="op-icon create" />
      case 'delete-node':
        return <Trash2 className="op-icon delete" />
      case 'update-node':
        return <Edit3 className="op-icon update" />
      case 'move-node':
        return <Move className="op-icon move" />
      case 'create-edge':
        return <Link className="op-icon connect" />
      case 'delete-edge':
        return <Unlink className="op-icon disconnect" />
      default:
        return null
    }
  }

  const getOpLabel = (op: MutationOp) => {
    switch (op.op) {
      case 'create-node':
        return `Create ${op.type} node`
      case 'delete-node':
        return 'Delete node'
      case 'update-node':
        return 'Update node'
      case 'move-node':
        return 'Move node'
      case 'create-edge':
        return 'Connect nodes'
      case 'delete-edge':
        return 'Disconnect nodes'
      default:
        return op.op
    }
  }

  return (
    <div className={`streaming-preview ${isComplete ? 'complete' : ''} ${isError ? 'error' : ''} ${reducedMotion ? 'reduced-motion' : ''}`}>
      {/* Screen reader announcement */}
      <LiveRegion message={announcementMessage} priority={isError ? 'assertive' : 'polite'} />

      {/* Header with phase */}
      <div className="preview-header">
        <div className="phase-indicator">
          {isActive && <Loader2 className="spinner" />}
          {isComplete && <CheckCircle className="status-icon complete" />}
          {isError && <XCircle className="status-icon error" />}
          {isCancelled && <XCircle className="status-icon cancelled" />}
          <span className="phase-message">{phaseMessages[phase]}</span>
        </div>
        {isActive && (
          <button className="cancel-btn" onClick={onCancel} aria-label="Cancel generation">
            <X className="cancel-icon" />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Operations list */}
      {operations.length > 0 && (
        <div className="operations-list">
          {operations.map((op, index) => (
            <div key={index} className="operation-item">
              {getOpIcon(op)}
              <span className="op-label">{getOpLabel(op)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {operations.length > 0 && (
        <div className="operations-summary">
          {operations.length} operation{operations.length !== 1 ? 's' : ''} planned
        </div>
      )}

      {/* Apply button when complete */}
      {isComplete && onApply && (
        <button className="apply-btn" onClick={onApply} aria-label="Apply plan to canvas">
          <Play className="apply-icon" />
          Apply to Canvas
        </button>
      )}

      <style>{`
        .streaming-preview {
          background: rgba(25, 25, 25, 0.95);
          border: 1px solid #444;
          border-radius: 8px;
          padding: 12px;
          margin-top: 8px;
        }

        .streaming-preview.complete {
          border-color: #22c55e;
        }

        .streaming-preview.error {
          border-color: #ef4444;
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .phase-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .spinner {
          width: 16px;
          height: 16px;
          color: var(--gui-accent-primary, #7c3aed);
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .status-icon {
          width: 16px;
          height: 16px;
        }

        .status-icon.complete {
          color: #22c55e;
        }

        .status-icon.error,
        .status-icon.cancelled {
          color: #ef4444;
        }

        .phase-message {
          font-size: 12px;
          font-weight: 500;
          color: #ccc;
        }

        .cancel-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.1s ease;
        }

        .cancel-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .cancel-icon {
          width: 14px;
          height: 14px;
          color: #888;
        }

        .cancel-btn:hover .cancel-icon {
          color: #ef4444;
        }

        .error-message {
          padding: 8px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 4px;
          color: #fca5a5;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .operations-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 120px;
          overflow-y: auto;
        }

        .operation-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
        }

        .op-icon {
          width: 12px;
          height: 12px;
          flex-shrink: 0;
        }

        .op-icon.create { color: #22c55e; }
        .op-icon.delete { color: #ef4444; }
        .op-icon.update { color: #3b82f6; }
        .op-icon.move { color: #f59e0b; }
        .op-icon.connect { color: #8b5cf6; }
        .op-icon.disconnect { color: #6b7280; }

        .op-label {
          font-size: 11px;
          color: #999;
        }

        .operations-summary {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 11px;
          color: #666;
          text-align: center;
        }

        .apply-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          margin-top: 8px;
          padding: 8px 12px;
          background: var(--gui-accent-primary, #7c3aed);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .apply-btn:hover {
          background: var(--gui-accent-hover, #6d28d9);
        }

        .apply-icon {
          width: 14px;
          height: 14px;
        }

        /* Light mode */
        [data-theme="light"] .streaming-preview {
          background: rgba(255, 255, 255, 0.95);
          border-color: #e5e7eb;
        }

        [data-theme="light"] .phase-message {
          color: #374151;
        }

        [data-theme="light"] .operation-item {
          background: rgba(0, 0, 0, 0.03);
        }

        [data-theme="light"] .op-label {
          color: #6b7280;
        }

        /* Reduced motion - no spinner animation */
        .streaming-preview.reduced-motion .spinner {
          animation: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .spinner {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}

const StreamingPreview = memo(StreamingPreviewComponent)
export default StreamingPreview
