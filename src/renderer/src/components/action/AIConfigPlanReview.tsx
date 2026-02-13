// =============================================================================
// AI CONFIG PLAN REVIEW COMPONENT
// =============================================================================
// Shows a plain-English summary of the AI's plan for user approval

import { memo, useState } from 'react'
import { FileText, MessageSquare, Check, ChevronRight } from 'lucide-react'
import type { AIGeneratedConfig, ActionTrigger, ActionStep } from '@shared/actionTypes'

interface AIConfigPlanReviewProps {
  config: AIGeneratedConfig
  planSummary: string
  warnings: string[]
  onApprove: () => void
  onRequestClarification: (feedback: string) => void
  onCancel: () => void
}

function AIConfigPlanReviewComponent({
  config,
  planSummary,
  warnings,
  onApprove,
  onRequestClarification,
  onCancel
}: AIConfigPlanReviewProps): JSX.Element {
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')

  const handleSubmitFeedback = () => {
    if (feedback.trim()) {
      onRequestClarification(feedback.trim())
    }
  }

  // Generate plain-English plan description
  const planDescription = generatePlanDescription(config)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium gui-text">Review my plan</span>
      </div>

      {/* AI's Understanding */}
      <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded">
        <div className="text-xs font-medium text-purple-300 mb-1">
          Here's what I understood:
        </div>
        <p className="text-xs gui-text-secondary">{planSummary}</p>
      </div>

      {/* Plan Summary */}
      <div className="p-3 gui-panel-secondary rounded space-y-2">
        <div className="text-xs font-medium gui-text">My plan:</div>
        <div className="text-xs gui-text-secondary space-y-1">
          {planDescription.map((line, i) => (
            <p key={i}>&bull; {line}</p>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-2 bg-yellow-900/20 border border-yellow-600/30 rounded">
          <div className="text-xs font-medium text-yellow-400 mb-1">Warnings:</div>
          <ul className="text-[10px] text-yellow-300/80 space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>&bull; {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Feedback Input (shown when user clicks "I have questions") */}
      {showFeedback && (
        <div className="p-3 gui-panel-secondary rounded space-y-2">
          <label className="text-xs gui-text">What would you like to change?</label>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Describe what's different from what you expected..."
            className="w-full text-xs gui-input rounded px-2 py-1.5 resize-none h-20"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowFeedback(false)}
              className="px-2 py-1 text-xs gui-text-secondary hover:gui-text rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitFeedback}
              disabled={!feedback.trim()}
              className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded"
            >
              Update Plan
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!showFeedback && (
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs gui-text-secondary hover:gui-text rounded"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFeedback(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--surface-panel-secondary)] hover:bg-[var(--surface-panel-secondary)] rounded"
            >
              <MessageSquare className="w-3 h-3" />
              I have questions
            </button>
            <button
              onClick={onApprove}
              className="flex items-center gap-1 px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded font-medium"
            >
              <Check className="w-3 h-3" />
              Looks good
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Generate plain-English plan description
function generatePlanDescription(config: AIGeneratedConfig): string[] {
  const lines: string[] = []

  // Trigger
  const trigger = describeTrigger(config.trigger)
  lines.push(`**When:** ${trigger}`)

  // Conditions
  if (config.conditions.length > 0) {
    const conds = config.conditions
      .map(c => `${c.field} ${c.operator} "${c.value}"`)
      .join(' AND ')
    lines.push(`**If:** ${conds}`)
  }

  // Actions
  lines.push(`**Then:**`)
  config.actions.forEach((step, i) => {
    lines.push(`  ${i + 1}. ${describeStep(step)}`)
  })

  return lines
}

function describeTrigger(trigger: ActionTrigger): string {
  switch (trigger.type) {
    case 'manual':
      return 'You click the play button'
    case 'property-change':
      return 'A property changes'
    case 'schedule':
      return 'On a schedule'
    case 'node-created':
      return 'A new node is created'
    case 'connection-made':
      return 'Nodes are connected'
    case 'children-complete':
      return 'Child nodes complete'
    case 'ancestor-change':
      return 'A parent node changes'
    case 'connection-count':
      return 'Connection count crosses threshold'
    case 'isolation':
      return 'Node becomes isolated'
    case 'region-enter':
      return 'Node enters a region'
    case 'region-exit':
      return 'Node exits a region'
    case 'cluster-size':
      return 'Region reaches node count'
    case 'proximity':
      return 'Node gets close to another'
    default:
      return trigger.type
  }
}

function describeStep(step: ActionStep): string {
  const c = step.config as Record<string, unknown>
  switch (step.type) {
    case 'create-node':
      return `Create a new ${c.nodeType} called "${c.title}"`
    case 'update-property':
      return `Set ${c.property} to "${c.value}"`
    case 'llm-call':
      return `Ask AI: "${String(c.prompt || '').slice(0, 50)}..."`
    case 'delete-node':
      return 'Delete the node'
    case 'link-nodes':
      return 'Connect the nodes'
    case 'unlink-nodes':
      return 'Disconnect the nodes'
    case 'move-node':
      return 'Move the node'
    case 'wait':
      return `Wait ${c.duration}ms`
    case 'condition':
      return `Check if ${c.field} ${c.operator} "${c.value}"`
    case 'http-request':
      return `Make ${c.method} request to ${c.url}`
    default:
      return step.type
  }
}

export const AIConfigPlanReview = memo(AIConfigPlanReviewComponent)
