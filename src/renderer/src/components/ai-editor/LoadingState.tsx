/**
 * LoadingState Component
 *
 * A loading spinner with message shown during plan generation.
 * Respects prefers-reduced-motion preference.
 */

import { memo } from 'react'
import { Sparkles, Brain, Radio, Eye, Cog, FileCheck, XCircle } from 'lucide-react'
import type { AIEditorMode, StreamingPhase } from '@shared/types'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import LiveRegion from '../a11y/LiveRegion'

interface LoadingStateProps {
  mode: AIEditorMode
  message?: string
  streamingPhase?: StreamingPhase
  streamingText?: string
  onCancel?: () => void
}

const modeMessages: Record<AIEditorMode, string[]> = {
  fix: [
    'Analyzing issues...',
    'Finding problems...',
    'Planning fixes...',
    'Checking connections...'
  ],
  refactor: [
    'Analyzing structure...',
    'Planning improvements...',
    'Reorganizing nodes...',
    'Optimizing layout...'
  ],
  organize: [
    'Analyzing positions...',
    'Calculating layout...',
    'Arranging nodes...',
    'Aligning elements...'
  ],
  generate: [
    'Understanding context...',
    'Planning new nodes...',
    'Generating content...',
    'Creating structure...'
  ]
}

const phaseMessages: Partial<Record<StreamingPhase, string>> = {
  idle: 'Ready',
  connecting: 'Connecting to AI...',
  analyzing: 'Analyzing workspace...',
  thinking: 'Reasoning about request...',
  generating: 'Generating plan...',
  parsing: 'Finalizing plan...',
  complete: 'Complete!',
  cancelled: 'Cancelled',
  error: 'Error occurred'
}

const PhaseIcon: React.FC<{ phase?: StreamingPhase }> = ({ phase }) => {
  switch (phase) {
    case 'connecting':
      return <Radio className="center-icon" />
    case 'analyzing':
      return <Eye className="center-icon" />
    case 'thinking':
      return <Brain className="center-icon" />
    case 'generating':
      return <Sparkles className="center-icon" />
    case 'parsing':
      return <FileCheck className="center-icon" />
    default:
      return <Cog className="center-icon" />
  }
}

function LoadingStateComponent({ mode, message, streamingPhase, streamingText, onCancel }: LoadingStateProps): JSX.Element {
  const reducedMotion = useReducedMotion()
  const messages = modeMessages[mode]
  const displayMessage = streamingPhase
    ? phaseMessages[streamingPhase] || messages[0]
    : message || messages[Math.floor(Math.random() * messages.length)]

  // Truncate streaming text for preview
  const textPreview = streamingText && streamingText.length > 100
    ? streamingText.slice(-100) + '...'
    : streamingText

  return (
    <div
      className={`loading-state ${reducedMotion ? 'reduced-motion' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="AI generation in progress"
    >
      {/* Screen reader announcement */}
      <LiveRegion message={displayMessage} priority="polite" />
      <div className="loading-icon-container">
        <div className="loading-ring loading-ring-outer" />
        <div className="loading-ring loading-ring-inner" />
        <div className="loading-center">
          {streamingPhase ? (
            <PhaseIcon phase={streamingPhase} />
          ) : mode === 'generate' ? (
            <Sparkles className="center-icon" />
          ) : (
            <Brain className="center-icon" />
          )}
        </div>
      </div>

      <div className="loading-text">
        <span className="loading-message" aria-live="polite">{displayMessage}</span>
        <span className="loading-dots" aria-hidden="true">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
      </div>

      {/* Streaming text preview */}
      {textPreview && (
        <div className="streaming-preview">
          <span className="streaming-label">Receiving:</span>
          <span className="streaming-text">{textPreview}</span>
        </div>
      )}

      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="cancel-button"
          title="Cancel generation"
          aria-label="Cancel AI generation"
        >
          <XCircle className="cancel-icon" />
          Cancel
        </button>
      )}

      <style>{`
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 32px;
        }

        .loading-icon-container {
          position: relative;
          width: 80px;
          height: 80px;
        }

        .loading-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid transparent;
        }

        .loading-ring-outer {
          inset: 0;
          border-top-color: #7c3aed;
          border-right-color: #7c3aed;
          animation: spin 1.5s linear infinite;
        }

        .loading-ring-inner {
          inset: 8px;
          border-bottom-color: #3b82f6;
          border-left-color: #3b82f6;
          animation: spin 1s linear infinite reverse;
        }

        .loading-center {
          position: absolute;
          inset: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 50%;
        }

        .center-icon {
          width: 24px;
          height: 24px;
          color: #a78bfa;
          animation: pulse 2s ease-in-out infinite;
        }

        .loading-text {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .loading-message {
          color: #e0e0e0;
          font-size: 14px;
          font-weight: 500;
        }

        .loading-dots {
          display: flex;
          gap: 4px;
        }

        .dot {
          width: 6px;
          height: 6px;
          background: #7c3aed;
          border-radius: 50%;
          animation: dot-bounce 1.4s ease-in-out infinite;
        }

        .dot:nth-child(1) {
          animation-delay: 0s;
        }

        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        @keyframes dot-bounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          40% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }

        /* Streaming preview */
        .streaming-preview {
          margin-top: 16px;
          padding: 12px;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 8px;
          max-width: 100%;
          overflow: hidden;
        }

        .streaming-label {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #a78bfa;
          margin-bottom: 4px;
        }

        .streaming-text {
          display: block;
          font-size: 12px;
          color: #d1d5db;
          font-family: 'SF Mono', Monaco, Consolas, monospace;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 80px;
          overflow-y: auto;
        }

        /* Cancel button */
        .cancel-button {
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: transparent;
          border: 1px solid #ef4444;
          color: #f87171;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cancel-button:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .cancel-icon {
          width: 16px;
          height: 16px;
        }

        /* Light mode */
        [data-theme="light"] .loading-message {
          color: #374151;
        }

        [data-theme="light"] .streaming-text {
          color: #374151;
        }

        /* Reduced motion mode */
        .loading-state.reduced-motion .loading-ring-outer,
        .loading-state.reduced-motion .loading-ring-inner {
          animation: none;
        }

        .loading-state.reduced-motion .center-icon {
          animation: none;
          opacity: 1;
        }

        .loading-state.reduced-motion .dot {
          animation: none;
          opacity: 0.7;
        }

        /* Also respect system preference */
        @media (prefers-reduced-motion: reduce) {
          .loading-ring-outer,
          .loading-ring-inner,
          .center-icon,
          .dot {
            animation: none !important;
          }

          .center-icon {
            opacity: 1;
          }

          .dot {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  )
}

const LoadingState = memo(LoadingStateComponent)
export default LoadingState
