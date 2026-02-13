/**
 * FeedbackToast Component
 *
 * Unified feedback toast for AI Editor operations.
 * Supports success, error, warning, and info variants.
 * Optionally includes undo action and auto-dismiss.
 * Respects reduced motion preferences.
 */

import { memo, useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, Undo2, X } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export type FeedbackType = 'success' | 'error' | 'warning' | 'info'

interface FeedbackToastProps {
  type: FeedbackType
  message: string
  /** Optional secondary message */
  description?: string
  /** Show undo button */
  showUndo?: boolean
  /** Called when undo is clicked */
  onUndo?: () => void
  /** Called when toast is dismissed */
  onDismiss: () => void
  /** Auto-hide delay in ms (0 = no auto-hide) */
  autoHideDelay?: number
}

const typeConfig: Record<FeedbackType, {
  icon: typeof CheckCircle
  color: string
  borderColor: string
  progressColor: string
}> = {
  success: {
    icon: CheckCircle,
    color: '#22c55e',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    progressColor: 'linear-gradient(90deg, #22c55e, #4ade80)'
  },
  error: {
    icon: XCircle,
    color: '#ef4444',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    progressColor: 'linear-gradient(90deg, #ef4444, #f87171)'
  },
  warning: {
    icon: AlertTriangle,
    color: '#f59e0b',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    progressColor: 'linear-gradient(90deg, #f59e0b, #fbbf24)'
  },
  info: {
    icon: Info,
    color: '#3b82f6',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    progressColor: 'linear-gradient(90deg, #3b82f6, #60a5fa)'
  }
}

function FeedbackToastComponent({
  type,
  message,
  description,
  showUndo = false,
  onUndo,
  onDismiss,
  autoHideDelay = 5000
}: FeedbackToastProps): JSX.Element {
  const reducedMotion = useReducedMotion()
  const [isUndoing, setIsUndoing] = useState(false)
  const [progress, setProgress] = useState(100)

  const config = typeConfig[type]
  const Icon = config.icon

  // Auto-dismiss timer with progress bar
  useEffect(() => {
    if (autoHideDelay <= 0) return

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
    if (isUndoing || !onUndo) return
    setIsUndoing(true)
    onUndo()
  }, [isUndoing, onUndo])

  return (
    <div
      className={`feedback-toast feedback-toast-${type} ${reducedMotion ? 'reduced-motion' : ''}`}
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      style={{ borderColor: config.borderColor }}
    >
      {/* Progress bar */}
      {autoHideDelay > 0 && (
        <div
          className="progress-bar"
          style={{ width: `${progress}%`, background: config.progressColor }}
        />
      )}

      {/* Content */}
      <div className="toast-content">
        <Icon className="toast-icon" style={{ color: config.color }} />
        <div className="toast-text">
          <span className="toast-message">{message}</span>
          {description && (
            <span className="toast-description">{description}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="toast-actions">
        {showUndo && onUndo && (
          <button
            className="undo-button"
            onClick={handleUndo}
            disabled={isUndoing}
            aria-label="Undo changes"
          >
            <Undo2 className="undo-icon" />
            <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
          </button>
        )}
        <button
          className="dismiss-button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <X className="dismiss-icon" />
        </button>
      </div>

      <style>{`
        .feedback-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: rgba(30, 30, 30, 0.98);
          border: 1px solid;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 9999;
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
          max-width: 90vw;
        }

        .feedback-toast.reduced-motion {
          animation: none;
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

        @media (prefers-reduced-motion: reduce) {
          .feedback-toast {
            animation: none !important;
          }
        }

        .progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          transition: width 0.1s linear;
        }

        .toast-content {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .toast-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .toast-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .toast-message {
          font-size: 14px;
          color: #f0f0f0;
          font-weight: 500;
        }

        .toast-description {
          font-size: 12px;
          color: #999;
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
        [data-theme="light"] .feedback-toast {
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }

        [data-theme="light"] .toast-message {
          color: #1f2937;
        }

        [data-theme="light"] .toast-description {
          color: #6b7280;
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

const FeedbackToast = memo(FeedbackToastComponent)
export default FeedbackToast
