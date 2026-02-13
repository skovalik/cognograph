/**
 * UndoToast Component
 *
 * Toast notification that appears after applying AI Editor changes.
 * Shows operation count and provides undo option.
 * Auto-dismisses after 10 seconds.
 */

import { memo, useState, useEffect, useCallback } from 'react'
import { Undo2, X, CheckCircle } from 'lucide-react'

interface UndoToastProps {
  operationCount: number
  onUndo: () => void
  onDismiss: () => void
  autoHideDelay?: number // ms before auto-hide, default 10000
}

function UndoToastComponent({
  operationCount,
  onUndo,
  onDismiss,
  autoHideDelay = 10000
}: UndoToastProps): JSX.Element {
  const [isUndoing, setIsUndoing] = useState(false)
  const [progress, setProgress] = useState(100)

  // Auto-dismiss timer with progress bar
  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / autoHideDelay) * 100)
      setProgress(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
        onDismiss()
      }
    }, 50)

    return () => clearInterval(interval)
  }, [autoHideDelay, onDismiss])

  // Handle undo click
  const handleUndo = useCallback(() => {
    if (isUndoing) return
    setIsUndoing(true)
    onUndo()
  }, [isUndoing, onUndo])

  return (
    <div className="undo-toast" role="alert" aria-live="polite">
      {/* Progress bar */}
      <div className="progress-bar" style={{ width: `${progress}%` }} />

      {/* Content */}
      <div className="toast-content">
        <CheckCircle className="success-icon" />
        <span className="toast-message">
          Applied {operationCount} change{operationCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Actions */}
      <div className="toast-actions">
        <button
          className="undo-button"
          onClick={handleUndo}
          disabled={isUndoing}
          aria-label="Undo changes"
        >
          <Undo2 className="undo-icon" />
          <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
        </button>
        <button
          className="dismiss-button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <X className="dismiss-icon" />
        </button>
      </div>

      <style>{`
        .undo-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: rgba(30, 30, 30, 0.98);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 9999;
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, #22c55e, #4ade80);
          transition: width 0.1s linear;
        }

        .toast-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .success-icon {
          width: 18px;
          height: 18px;
          color: #22c55e;
        }

        .toast-message {
          font-size: 14px;
          color: #f0f0f0;
          font-weight: 500;
        }

        .toast-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .undo-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: #f0f0f0;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .undo-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          border-color: var(--gui-accent-primary, #7c3aed);
        }

        .undo-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .undo-icon {
          width: 14px;
          height: 14px;
        }

        .dismiss-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
          transition: all 0.15s;
        }

        .dismiss-button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ccc;
        }

        .dismiss-icon {
          width: 16px;
          height: 16px;
        }

        /* Light mode */
        [data-theme="light"] .undo-toast {
          background: rgba(255, 255, 255, 0.98);
          border-color: rgba(34, 197, 94, 0.3);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }

        [data-theme="light"] .toast-message {
          color: #1f2937;
        }

        [data-theme="light"] .undo-button {
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.15);
          color: #374151;
        }

        [data-theme="light"] .undo-button:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </div>
  )
}

const UndoToast = memo(UndoToastComponent)
export default UndoToast
