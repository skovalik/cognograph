/**
 * ApplyButton Component
 *
 * Button to apply the current AI Editor preview to the workspace.
 * Shows operation count, confirmation on click, disabled during execution.
 */

import { memo, useState, useCallback } from 'react'
import { Play, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import type { MutationPlan } from '@shared/types'

interface ApplyButtonProps {
  plan: MutationPlan
  onApply: () => Promise<void>
  isExecuting?: boolean
  disabled?: boolean
}

function ApplyButtonComponent({
  plan,
  onApply,
  isExecuting = false,
  disabled = false
}: ApplyButtonProps): JSX.Element {
  const [showConfirm, setShowConfirm] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)

  const operationCount = plan.operations.length
  const hasWarnings = plan.warnings && plan.warnings.length > 0
  const hasErrors = plan.warnings?.some(w => w.level === 'error')

  // Handle click - show confirmation or apply directly
  const handleClick = useCallback(() => {
    if (isExecuting || disabled) return

    if (hasErrors) {
      // Don't allow apply with errors
      return
    }

    if (hasWarnings && !showConfirm) {
      // Show confirmation for warnings
      setShowConfirm(true)
      return
    }

    // Apply the plan
    setShowConfirm(false)
    onApply().then(() => {
      setHasApplied(true)
      setTimeout(() => setHasApplied(false), 2000)
    })
  }, [isExecuting, disabled, hasErrors, hasWarnings, showConfirm, onApply])

  // Cancel confirmation
  const handleCancel = useCallback(() => {
    setShowConfirm(false)
  }, [])

  // Determine button state
  const getButtonState = () => {
    if (hasApplied) return 'success'
    if (isExecuting) return 'executing'
    if (hasErrors) return 'error'
    if (showConfirm) return 'confirm'
    return 'ready'
  }

  const state = getButtonState()

  return (
    <div className="apply-button-wrapper">
      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-message">
            <AlertTriangle className="warning-icon" />
            <span>Plan has {plan.warnings?.length} warning{plan.warnings?.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="confirm-actions">
            <button className="cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
            <button className="confirm-btn" onClick={handleClick}>
              Apply Anyway
            </button>
          </div>
        </div>
      )}

      <button
        className={`apply-button ${state}`}
        onClick={handleClick}
        disabled={disabled || isExecuting || hasErrors}
        aria-label={`Apply ${operationCount} operation${operationCount !== 1 ? 's' : ''}`}
      >
        {state === 'executing' && <Loader2 className="button-icon spinning" />}
        {state === 'success' && <CheckCircle className="button-icon" />}
        {state === 'error' && <AlertTriangle className="button-icon" />}
        {(state === 'ready' || state === 'confirm') && <Play className="button-icon" />}

        <span className="button-text">
          {state === 'executing' && 'Applying...'}
          {state === 'success' && 'Applied!'}
          {state === 'error' && 'Cannot Apply'}
          {(state === 'ready' || state === 'confirm') && `Apply ${operationCount} Change${operationCount !== 1 ? 's' : ''}`}
        </span>
      </button>

      <style>{`
        .apply-button-wrapper {
          position: relative;
        }

        .confirm-overlay {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          padding: 12px 16px;
          background: rgba(30, 30, 30, 0.98);
          border: 1px solid #f59e0b;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          z-index: 10;
          min-width: 200px;
        }

        .confirm-message {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f59e0b;
          font-size: 12px;
          margin-bottom: 10px;
        }

        .warning-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .confirm-actions {
          display: flex;
          gap: 8px;
        }

        .cancel-btn,
        .confirm-btn {
          flex: 1;
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cancel-btn {
          background: rgba(255, 255, 255, 0.1);
          color: #ccc;
        }

        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .confirm-btn {
          background: #f59e0b;
          color: #000;
        }

        .confirm-btn:hover {
          background: #d97706;
        }

        .apply-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--gui-accent-primary, #7c3aed);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          min-width: 160px;
        }

        .apply-button:hover:not(:disabled) {
          background: var(--gui-accent-secondary, #6d28d9);
        }

        .apply-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .apply-button.executing {
          background: #3b82f6;
        }

        .apply-button.success {
          background: #22c55e;
        }

        .apply-button.error {
          background: #ef4444;
          cursor: not-allowed;
        }

        .button-icon {
          width: 16px;
          height: 16px;
        }

        .button-icon.spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .button-text {
          white-space: nowrap;
        }

        /* Light mode */
        [data-theme="light"] .confirm-overlay {
          background: rgba(255, 255, 255, 0.98);
          border-color: #f59e0b;
        }

        [data-theme="light"] .cancel-btn {
          background: rgba(0, 0, 0, 0.08);
          color: #374151;
        }
      `}</style>
    </div>
  )
}

const ApplyButton = memo(ApplyButtonComponent)
export default ApplyButton
