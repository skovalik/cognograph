/**
 * PreviewControls Component
 *
 * Controls shown when a mutation plan is previewed.
 * Shows a summary of changes and Apply/Cancel buttons.
 */

import { memo } from 'react'
import { Check, X, Eye, EyeOff, AlertTriangle, Info } from 'lucide-react'
import type { MutationPreviewState, PlanWarning } from '@shared/types'
import { getPreviewSummary, formatPreviewSummary } from '../../utils/previewBuilder'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import LiveRegion from '../a11y/LiveRegion'

interface PreviewControlsProps {
  preview: MutationPreviewState
  warnings?: PlanWarning[]
  reasoning?: string
  isExecuting: boolean
  isPreviewVisible: boolean
  onApply: () => void
  onCancel: () => void
  onToggleVisibility: () => void
}

function PreviewControlsComponent({
  preview,
  warnings = [],
  reasoning,
  isExecuting,
  isPreviewVisible,
  onApply,
  onCancel,
  onToggleVisibility
}: PreviewControlsProps): JSX.Element {
  const reducedMotion = useReducedMotion()
  const summary = getPreviewSummary(preview)
  const summaryText = formatPreviewSummary(summary)

  const hasErrors = warnings.some((w) => w.level === 'error')
  // hasWarnings could be used for warning styling in the future
  void warnings.some((w) => w.level === 'warning')

  // Build status message for screen readers
  const statusMessage = isExecuting
    ? 'Applying changes...'
    : hasErrors
      ? `Preview has ${warnings.filter((w) => w.level === 'error').length} errors that must be resolved`
      : summaryText

  return (
    <div
      className={`preview-controls ${reducedMotion ? 'reduced-motion' : ''}`}
      role="region"
      aria-label="Preview controls"
    >
      {/* Screen reader status */}
      <LiveRegion message={statusMessage} priority={isExecuting ? 'assertive' : 'polite'} />
      {/* Summary header */}
      <div className="preview-controls-header">
        <div className="preview-title">
          <span className="preview-title-text">Preview Changes</span>
          <button
            className="preview-visibility-toggle"
            onClick={onToggleVisibility}
            title={isPreviewVisible ? 'Hide preview' : 'Show preview'}
            aria-label={isPreviewVisible ? 'Hide preview overlay' : 'Show preview overlay'}
            aria-pressed={isPreviewVisible}
          >
            {isPreviewVisible ? (
              <EyeOff className="toggle-icon" />
            ) : (
              <Eye className="toggle-icon" />
            )}
          </button>
        </div>
        <div className="preview-summary">{summaryText}</div>
      </div>

      {/* Reasoning */}
      {reasoning && (
        <div className="preview-reasoning">
          <Info className="reasoning-icon" />
          <span>{reasoning}</span>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="preview-warnings">
          {warnings.map((warning, index) => (
            <div
              key={index}
              className={`preview-warning preview-warning-${warning.level}`}
            >
              <AlertTriangle className="warning-icon" />
              <div className="warning-content">
                <span className="warning-message">{warning.message}</span>
                {warning.suggestion && (
                  <span className="warning-suggestion">{warning.suggestion}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="preview-stats">
        {summary.nodesCreated > 0 && (
          <div className="stat stat-created">
            <span className="stat-value">{summary.nodesCreated}</span>
            <span className="stat-label">Created</span>
          </div>
        )}
        {summary.nodesDeleted > 0 && (
          <div className="stat stat-deleted">
            <span className="stat-value">{summary.nodesDeleted}</span>
            <span className="stat-label">Deleted</span>
          </div>
        )}
        {summary.nodesUpdated > 0 && (
          <div className="stat stat-updated">
            <span className="stat-value">{summary.nodesUpdated}</span>
            <span className="stat-label">Updated</span>
          </div>
        )}
        {summary.nodesMoved > 0 && (
          <div className="stat stat-moved">
            <span className="stat-value">{summary.nodesMoved}</span>
            <span className="stat-label">Moved</span>
          </div>
        )}
        {(summary.edgesCreated > 0 || summary.edgesDeleted > 0) && (
          <div className="stat stat-edges">
            <span className="stat-value">
              {summary.edgesCreated + summary.edgesDeleted}
            </span>
            <span className="stat-label">Edges</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="preview-actions">
        <button
          className="preview-button preview-button-cancel"
          onClick={onCancel}
          disabled={isExecuting}
          aria-label="Cancel and discard changes"
        >
          <X className="button-icon" />
          Cancel
        </button>
        <button
          className="preview-button preview-button-apply"
          onClick={onApply}
          disabled={isExecuting || hasErrors}
          aria-label={hasErrors ? 'Cannot apply - resolve errors first' : 'Apply all changes'}
          aria-busy={isExecuting}
        >
          {isExecuting ? (
            <>
              <div className="button-spinner" />
              Applying...
            </>
          ) : (
            <>
              <Check className="button-icon" />
              Apply Changes
            </>
          )}
        </button>
      </div>

      <style>{`
        .preview-controls {
          background: rgba(23, 23, 23, 0.95);
          border: 1px solid #333;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 280px;
          max-width: 360px;
          backdrop-filter: blur(8px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .preview-controls-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .preview-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .preview-title-text {
          font-size: 14px;
          font-weight: 600;
          color: #f0f0f0;
        }

        .preview-visibility-toggle {
          background: transparent;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #888;
          border-radius: 4px;
          transition: all 0.15s;
        }

        .preview-visibility-toggle:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .toggle-icon {
          width: 16px;
          height: 16px;
        }

        .preview-summary {
          font-size: 12px;
          color: #888;
        }

        .preview-reasoning {
          display: flex;
          gap: 8px;
          padding: 8px 10px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          font-size: 12px;
          color: #93c5fd;
        }

        .reasoning-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .preview-warnings {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .preview-warning {
          display: flex;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 6px;
          font-size: 12px;
        }

        .preview-warning-info {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #93c5fd;
        }

        .preview-warning-warning {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #fcd34d;
        }

        .preview-warning-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .warning-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .warning-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .warning-message {
          font-weight: 500;
        }

        .warning-suggestion {
          opacity: 0.8;
          font-size: 11px;
        }

        .preview-stats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 12px;
          border-radius: 6px;
          min-width: 50px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 600;
        }

        .stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.7;
        }

        .stat-created {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .stat-deleted {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .stat-updated {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }

        .stat-moved {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
        }

        .stat-edges {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
        }

        .preview-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .preview-button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .preview-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .preview-button-cancel {
          background: rgba(255, 255, 255, 0.1);
          color: #ccc;
        }

        .preview-button-cancel:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }

        .preview-button-apply {
          background: #22c55e;
          color: white;
        }

        .preview-button-apply:hover:not(:disabled) {
          background: #16a34a;
        }

        .button-icon {
          width: 16px;
          height: 16px;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Light mode */
        [data-theme="light"] .preview-controls {
          background: rgba(255, 255, 255, 0.95);
          border-color: #e5e7eb;
        }

        [data-theme="light"] .preview-title-text {
          color: #111827;
        }

        [data-theme="light"] .preview-summary {
          color: #6b7280;
        }

        [data-theme="light"] .preview-button-cancel {
          background: #f3f4f6;
          color: #374151;
        }

        [data-theme="light"] .preview-button-cancel:hover:not(:disabled) {
          background: #e5e7eb;
        }

        /* Reduced motion - disable spinner animation */
        .preview-controls.reduced-motion .button-spinner {
          animation: none;
          border-color: white;
        }

        @media (prefers-reduced-motion: reduce) {
          .button-spinner {
            animation: none !important;
            border-color: white;
          }
        }
      `}</style>
    </div>
  )
}

const PreviewControls = memo(PreviewControlsComponent)
export default PreviewControls
