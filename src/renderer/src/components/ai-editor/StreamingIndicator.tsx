/**
 * StreamingIndicator Component
 *
 * Visual progress indicator for AI streaming operations.
 * Shows current phase, progress bar, elapsed time, and cancel button.
 * Respects reduced motion preferences.
 */

import { memo, useState, useEffect, useRef } from 'react'
import { Radio, Eye, Brain, Sparkles, FileCheck, Loader2, X, CheckCircle, XCircle } from 'lucide-react'
import type { StreamingPhase } from '@shared/types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import LiveRegion from '../a11y/LiveRegion'

interface StreamingIndicatorProps {
  phase: StreamingPhase
  onCancel?: () => void
  /** Position: 'corner' (fixed bottom-right) or 'inline' (relative) */
  position?: 'corner' | 'inline'
}

const phaseConfig: Record<StreamingPhase, {
  icon: typeof Radio
  label: string
  description: string
  progress: number // 0-100 estimated progress
}> = {
  idle: {
    icon: Loader2,
    label: 'Ready',
    description: 'Waiting for input',
    progress: 0
  },
  connecting: {
    icon: Radio,
    label: 'Connecting',
    description: 'Establishing connection to AI...',
    progress: 10
  },
  analyzing: {
    icon: Eye,
    label: 'Analyzing',
    description: 'Analyzing your workspace...',
    progress: 25
  },
  thinking: {
    icon: Brain,
    label: 'Thinking',
    description: 'Reasoning about your request...',
    progress: 45
  },
  generating: {
    icon: Sparkles,
    label: 'Generating',
    description: 'Creating plan operations...',
    progress: 70
  },
  parsing: {
    icon: FileCheck,
    label: 'Finalizing',
    description: 'Processing response...',
    progress: 90
  },
  complete: {
    icon: CheckCircle,
    label: 'Complete',
    description: 'Plan ready for review',
    progress: 100
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    description: 'Operation cancelled',
    progress: 0
  },
  error: {
    icon: XCircle,
    label: 'Error',
    description: 'An error occurred',
    progress: 0
  }
}

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function StreamingIndicatorComponent({
  phase,
  onCancel,
  position = 'corner'
}: StreamingIndicatorProps): JSX.Element | null {
  const reducedMotion = useReducedMotion()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef<number | null>(null)

  const config = phaseConfig[phase]
  const Icon = config.icon
  const isActive = !['idle', 'complete', 'cancelled', 'error'].includes(phase)
  const isTerminal = ['complete', 'cancelled', 'error'].includes(phase)

  // Track elapsed time
  useEffect(() => {
    if (isActive && !startTimeRef.current) {
      startTimeRef.current = Date.now()
    }

    if (!isActive && isTerminal) {
      startTimeRef.current = null
      setElapsedSeconds(0)
      return
    }

    if (!isActive) return

    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, isTerminal])

  // Don't render if idle
  if (phase === 'idle') {
    return null
  }

  return (
    <div
      className={`streaming-indicator streaming-indicator-${position} ${reducedMotion ? 'reduced-motion' : ''} ${isTerminal ? `streaming-indicator-${phase}` : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`AI status: ${config.label}`}
    >
      {/* Screen reader announcement */}
      <LiveRegion message={config.description} priority="polite" />

      {/* Progress bar */}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${config.progress}%` }}
        />
      </div>

      {/* Main content */}
      <div className="indicator-content">
        <div className="indicator-icon-container">
          <Icon className={`indicator-icon ${isActive ? 'spinning' : ''}`} />
        </div>
        <div className="indicator-text">
          <span className="indicator-label">{config.label}</span>
          <span className="indicator-description">{config.description}</span>
        </div>
      </div>

      {/* Footer with time and cancel */}
      <div className="indicator-footer">
        {isActive && (
          <span className="elapsed-time">
            {formatElapsedTime(elapsedSeconds)}
          </span>
        )}
        {isActive && onCancel && (
          <button
            className="cancel-button"
            onClick={onCancel}
            aria-label="Cancel AI generation"
          >
            <X className="cancel-icon" />
            <span>Cancel</span>
          </button>
        )}
      </div>

      <style>{`
        .streaming-indicator {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(25, 25, 25, 0.95);
          border: 1px solid #444;
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          min-width: 220px;
          max-width: 280px;
          backdrop-filter: blur(8px);
        }

        .streaming-indicator-corner {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9990;
          animation: slideIn 0.3s ease-out;
        }

        .streaming-indicator-inline {
          position: relative;
        }

        .streaming-indicator.reduced-motion {
          animation: none;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .streaming-indicator {
            animation: none !important;
          }
        }

        /* Terminal states */
        .streaming-indicator-complete {
          border-color: rgba(34, 197, 94, 0.5);
        }

        .streaming-indicator-error,
        .streaming-indicator-cancelled {
          border-color: rgba(239, 68, 68, 0.5);
        }

        .progress-track {
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--gui-accent-primary, #7c3aed), var(--gui-accent-secondary, #a78bfa));
          transition: width 0.3s ease-out;
        }

        .streaming-indicator-complete .progress-fill {
          background: linear-gradient(90deg, #22c55e, #4ade80);
        }

        .streaming-indicator-error .progress-fill,
        .streaming-indicator-cancelled .progress-fill {
          background: linear-gradient(90deg, #ef4444, #f87171);
        }

        .indicator-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .indicator-icon-container {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(124, 58, 237, 0.15);
          border-radius: 8px;
        }

        .streaming-indicator-complete .indicator-icon-container {
          background: rgba(34, 197, 94, 0.15);
        }

        .streaming-indicator-error .indicator-icon-container,
        .streaming-indicator-cancelled .indicator-icon-container {
          background: rgba(239, 68, 68, 0.15);
        }

        .indicator-icon {
          width: 18px;
          height: 18px;
          color: var(--gui-accent-primary, #7c3aed);
        }

        .indicator-icon.spinning {
          animation: spin 1s linear infinite;
        }

        .streaming-indicator.reduced-motion .indicator-icon.spinning {
          animation: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .indicator-icon.spinning {
            animation: none !important;
          }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .streaming-indicator-complete .indicator-icon {
          color: #22c55e;
        }

        .streaming-indicator-error .indicator-icon,
        .streaming-indicator-cancelled .indicator-icon {
          color: #ef4444;
        }

        .indicator-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .indicator-label {
          font-size: 13px;
          font-weight: 600;
          color: #f0f0f0;
        }

        .indicator-description {
          font-size: 11px;
          color: #888;
        }

        .indicator-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 4px;
        }

        .elapsed-time {
          font-size: 11px;
          color: #666;
          font-variant-numeric: tabular-nums;
        }

        .cancel-button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.5);
          border-radius: 4px;
          color: #f87171;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cancel-button:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
        }

        .cancel-icon {
          width: 12px;
          height: 12px;
        }

        /* Light mode */
        [data-theme="light"] .streaming-indicator {
          background: rgba(255, 255, 255, 0.95);
          border-color: #e5e7eb;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        [data-theme="light"] .indicator-label {
          color: #1f2937;
        }

        [data-theme="light"] .indicator-description {
          color: #6b7280;
        }

        [data-theme="light"] .elapsed-time {
          color: #9ca3af;
        }

        [data-theme="light"] .progress-track {
          background: rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </div>
  )
}

const StreamingIndicator = memo(StreamingIndicatorComponent)
export default StreamingIndicator
