/**
 * Workflow Progress Component
 *
 * Floating progress indicator that shows real-time workflow execution.
 * Displays steps, trust levels, approval requests, and allows user control.
 */

import { memo, useEffect, useState } from 'react'
import {
  X,
  Check,
  Circle,
  Loader2,
  AlertCircle,
  SkipForward,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Pause,
  XCircle
} from 'lucide-react'
import {
  useWorkflowStore,
  useCurrentWorkflow,
  useWorkflowProgress,
  useCurrentStep,
  useNeedsApproval,
  useApprovalContext,
  useIsProgressVisible,
  type WorkflowStep,
  type TrustLevel
} from '../../stores/workflowStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

// -----------------------------------------------------------------------------
// Trust Level Indicators
// -----------------------------------------------------------------------------

const TrustIndicator = memo(function TrustIndicator({
  level,
  status
}: {
  level: TrustLevel
  status: WorkflowStep['status']
}) {
  const colors = {
    auto: { bg: 'bg-green-500', text: 'text-green-500', label: 'Auto' },
    prompt_once: { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'Ask Once' },
    always_approve: { bg: 'bg-red-500', text: 'text-red-500', label: 'Approve' }
  }

  const config = colors[level]

  // Override color if completed
  if (status === 'completed' || status === 'skipped') {
    return (
      <span className="w-2 h-2 rounded-full bg-green-500" title="Completed" />
    )
  }

  if (status === 'failed') {
    return (
      <span className="w-2 h-2 rounded-full bg-red-500" title="Failed" />
    )
  }

  return (
    <span
      className={`w-2 h-2 rounded-full ${config.bg}`}
      title={config.label}
    />
  )
})

// -----------------------------------------------------------------------------
// Step Item
// -----------------------------------------------------------------------------

const StepItem = memo(function StepItem({
  step,
  isActive
}: {
  step: WorkflowStep
  isActive: boolean
}) {
  const duration = step.endTime && step.startTime
    ? ((step.endTime - step.startTime) / 1000).toFixed(1)
    : null

  const statusIcons = {
    pending: <Circle className="w-4 h-4 text-[var(--text-secondary)]" />,
    running: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
    completed: <Check className="w-4 h-4 text-green-400" />,
    failed: <XCircle className="w-4 h-4 text-red-400" />,
    skipped: <SkipForward className="w-4 h-4 text-[var(--text-secondary)]" />,
    waiting_approval: <Pause className="w-4 h-4 text-yellow-400" />
  }

  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 rounded transition-colors ${
        isActive ? 'bg-white/5' : ''
      }`}
    >
      <TrustIndicator level={step.trustLevel} status={step.status} />
      {statusIcons[step.status]}
      <span
        className={`flex-1 text-sm truncate ${
          step.status === 'completed'
            ? 'text-[var(--text-secondary)]'
            : step.status === 'running'
              ? 'text-white'
              : step.status === 'failed'
                ? 'text-red-400'
                : 'text-[var(--text-muted)]'
        }`}
      >
        {step.name}
      </span>
      {duration && (
        <span className="text-xs text-[var(--text-muted)]">{duration}s</span>
      )}
      {step.status === 'running' && (
        <span className="text-xs text-blue-400 animate-pulse">...</span>
      )}
    </div>
  )
})

// -----------------------------------------------------------------------------
// Approval Panel
// -----------------------------------------------------------------------------

const ApprovalPanel = memo(function ApprovalPanel({
  context,
  onApprove,
  onDeny,
  onSkip,
  onPreview
}: {
  context: { stepId: string; reason: string; preview?: string }
  onApprove: () => void
  onDeny: () => void
  onSkip: () => void
  onPreview?: () => void
}) {
  return (
    <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-medium text-yellow-400">Approval Required</span>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-3">{context.reason}</p>
      {context.preview && (
        <pre className="text-xs text-[var(--text-secondary)] bg-black/30 rounded p-2 mb-3 max-h-24 overflow-auto">
          {context.preview}
        </pre>
      )}
      <div className="flex gap-2">
        {onPreview && context.preview && (
          <button
            onClick={onPreview}
            className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
        )}
        <button
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded transition-colors"
        >
          <Check className="w-4 h-4" />
          Approve
        </button>
        <button
          onClick={onSkip}
          className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
        >
          <SkipForward className="w-4 h-4" />
          Skip
        </button>
        <button
          onClick={onDeny}
          className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:text-white hover:bg-red-600 rounded transition-colors"
        >
          <X className="w-4 h-4" />
          Deny
        </button>
      </div>
    </div>
  )
})

// -----------------------------------------------------------------------------
// Error Panel
// -----------------------------------------------------------------------------

const ErrorPanel = memo(function ErrorPanel({
  error,
  onRetry,
  onSkip,
  onCancel
}: {
  error: string
  onRetry: () => void
  onSkip: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-red-400" />
        <span className="text-sm font-medium text-red-400">Step Failed</span>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-3">{error}</p>
      <div className="flex gap-2">
        <button
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
        <button
          onClick={onSkip}
          className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
        >
          <SkipForward className="w-4 h-4" />
          Skip
        </button>
        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:text-white hover:bg-red-600 rounded transition-colors"
        >
          <X className="w-4 h-4" />
          Stop
        </button>
      </div>
    </div>
  )
})

// -----------------------------------------------------------------------------
// Progress Bar
// -----------------------------------------------------------------------------

const ProgressBar = memo(function ProgressBar({
  percent,
  current,
  total
}: {
  percent: number
  current: number
  total: number
}) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
        <span>{current}/{total} steps</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 bg-[var(--surface-panel)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
})

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

function WorkflowProgressComponent(): JSX.Element | null {
  const workflow = useCurrentWorkflow()
  const progress = useWorkflowProgress()
  const currentStep = useCurrentStep()
  const needsApproval = useNeedsApproval()
  const approvalContext = useApprovalContext()
  const isVisible = useIsProgressVisible()
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)

  const {
    cancelWorkflow,
    approveStep,
    denyStep,
    skipStep,
    retryStep,
    dismissProgress
  } = useWorkflowStore()

  const [isExpanded, setIsExpanded] = useState(true)
  const [showAllSteps, setShowAllSteps] = useState(false)

  // Auto-expand on errors or approvals
  useEffect(() => {
    if (needsApproval || currentStep?.status === 'failed') {
      setIsExpanded(true)
    }
  }, [needsApproval, currentStep?.status])

  // Auto-dismiss after successful completion
  useEffect(() => {
    if (workflow?.status === 'completed') {
      const timer = setTimeout(() => {
        dismissProgress()
      }, 2000) // Dismiss after 2 seconds
      return () => clearTimeout(timer)
    }
    return undefined
  }, [workflow?.status, dismissProgress])

  // Don't render if no workflow or not visible
  if (!workflow || !isVisible) return null

  const bgClass = 'bg-[var(--surface-panel)]'
  const borderClass = 'border-[var(--border-subtle)]'

  const isComplete = workflow.status === 'completed'
  const isCancelled = workflow.status === 'cancelled'
  const isFailed = workflow.status === 'failed'
  const isFinished = isComplete || isCancelled || isFailed

  // Determine which steps to show
  const visibleSteps = showAllSteps
    ? workflow.steps
    : workflow.steps.slice(
        Math.max(0, workflow.currentStepIndex - 1),
        Math.min(workflow.steps.length, workflow.currentStepIndex + 4)
      )

  const hiddenBefore = showAllSteps ? 0 : Math.max(0, workflow.currentStepIndex - 1)
  const hiddenAfter = showAllSteps
    ? 0
    : Math.max(0, workflow.steps.length - workflow.currentStepIndex - 4)

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-80 ${bgClass} border ${borderClass} rounded-lg shadow-xl overflow-hidden`}
      style={{
        transition: 'all 0.2s ease-out'
      }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 bg-[var(--surface-panel-secondary)] border-b ${borderClass} cursor-pointer`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {workflow.status === 'running' && (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          )}
          {workflow.status === 'paused' && (
            <Pause className="w-4 h-4 text-yellow-400" />
          )}
          {isComplete && (
            <Check className="w-4 h-4 text-green-400" />
          )}
          {(isCancelled || isFailed) && (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {workflow.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--text-secondary)]">
            {progress.current}/{progress.total}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          ) : (
            <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
          )}
          {isFinished && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                dismissProgress()
              }}
              className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded ml-1"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 max-h-80 overflow-auto">
          {/* Description */}
          {workflow.description && (
            <p className="text-xs text-[var(--text-secondary)] mb-3">{workflow.description}</p>
          )}

          {/* Hidden steps indicator (before) */}
          {hiddenBefore > 0 && (
            <button
              onClick={() => setShowAllSteps(true)}
              className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] py-1 mb-1"
            >
              + {hiddenBefore} earlier step{hiddenBefore > 1 ? 's' : ''}
            </button>
          )}

          {/* Steps */}
          <div className="space-y-0.5">
            {visibleSteps.map((step) => (
              <StepItem
                key={step.id}
                step={step}
                isActive={workflow.steps.indexOf(step) === workflow.currentStepIndex}
              />
            ))}
          </div>

          {/* Hidden steps indicator (after) */}
          {hiddenAfter > 0 && (
            <button
              onClick={() => setShowAllSteps(true)}
              className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] py-1 mt-1"
            >
              + {hiddenAfter} more step{hiddenAfter > 1 ? 's' : ''}
            </button>
          )}

          {/* Approval panel */}
          {needsApproval && approvalContext && (
            <ApprovalPanel
              context={approvalContext}
              onApprove={approveStep}
              onDeny={denyStep}
              onSkip={() => skipStep(approvalContext.stepId)}
            />
          )}

          {/* Error panel */}
          {currentStep?.status === 'failed' && currentStep.error && (
            <ErrorPanel
              error={currentStep.error}
              onRetry={retryStep}
              onSkip={() => skipStep(currentStep.id)}
              onCancel={cancelWorkflow}
            />
          )}

          {/* Progress bar */}
          <ProgressBar
            percent={progress.percent}
            current={progress.current}
            total={progress.total}
          />

          {/* Footer actions */}
          {!isFinished && workflow.status === 'running' && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={cancelWorkflow}
                className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          )}

          {/* Completion message */}
          {isComplete && (
            <div className="mt-3 p-2 rounded bg-green-500/10 border border-green-500/30 text-center">
              <span className="text-sm text-green-400">Workflow completed successfully</span>
            </div>
          )}

          {/* Cancelled message */}
          {isCancelled && (
            <div className="mt-3 p-2 rounded bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] text-center">
              <span className="text-sm text-[var(--text-secondary)]">Workflow cancelled</span>
            </div>
          )}

          {/* Trust level legend (shown on first use) */}
          {!isFinished && progress.current === 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Auto
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" /> Ask Once
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Approve
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const WorkflowProgress = memo(WorkflowProgressComponent)
export default WorkflowProgress
