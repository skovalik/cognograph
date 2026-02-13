/**
 * Quick Actions Bar Component
 *
 * Displays contextual quick actions based on the current selection.
 * One-click operations that pre-fill the prompt with common commands.
 */

import { memo } from 'react'
import { Lightbulb } from 'lucide-react'
import type { QuickAction } from '../../hooks/useSmartDefaults'

interface QuickActionsBarProps {
  actions: QuickAction[]
  contextMessage: string
  onSelectAction: (action: QuickAction) => void
  selectedActionId?: string
}

function QuickActionsBarComponent({
  actions,
  contextMessage,
  onSelectAction,
  selectedActionId
}: QuickActionsBarProps): JSX.Element {
  return (
    <div className="quick-actions-container rounded-lg bg-white/5 border border-white/10 p-3 mb-3">
      {/* Context message */}
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb size={14} className="text-yellow-400" />
        <span className="text-sm text-[var(--text-secondary)]">{contextMessage}</span>
      </div>

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick actions">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onSelectAction(action)}
            className={`
              quick-action-button
              px-3 py-1.5
              text-sm font-medium
              rounded-md
              border
              transition-all duration-100
              ${
                selectedActionId === action.id
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : 'bg-white/5 border-white/10 text-[var(--text-secondary)] hover:bg-white/10 hover:border-white/20'
              }
              focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-transparent
              active:transform active:scale-95
            `}
            aria-label={`Quick action: ${action.label}`}
            aria-pressed={selectedActionId === action.id}
          >
            {action.icon && <span className="mr-1">{action.icon}</span>}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export const QuickActionsBar = memo(QuickActionsBarComponent)
export default QuickActionsBar
