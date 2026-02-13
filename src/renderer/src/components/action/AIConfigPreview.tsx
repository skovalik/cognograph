// =============================================================================
// AI CONFIG PREVIEW COMPONENT
// =============================================================================
// Shows the generated configuration before applying - clean, readable format

import { memo, useState } from 'react'
import {
  Play, RefreshCw, Clock, PlusCircle, Link, CheckCircle,
  ArrowUp, Hash, Circle, MapPin, LogOut, Users, Target,
  Pencil, Plus, Trash2, Move, Unlink, Timer, GitBranch,
  Sparkles, Globe, AlertTriangle, Zap
} from 'lucide-react'
import type { AIGeneratedConfig, ActionTrigger, ActionStep, ActionCondition } from '@shared/actionTypes'

interface AIConfigPreviewProps {
  config: AIGeneratedConfig
  suggestedTitle?: string
  currentTitle: string
  warnings: string[]
  onApply: (useTitle: boolean) => void
  onApplyAndRun: (useTitle: boolean) => void
  onEdit: () => void
  onCancel: () => void
}

// Trigger type icons
const TRIGGER_ICONS: Record<string, typeof Play> = {
  manual: Play,
  'property-change': RefreshCw,
  schedule: Clock,
  'node-created': PlusCircle,
  'connection-made': Link,
  'children-complete': CheckCircle,
  'ancestor-change': ArrowUp,
  'connection-count': Hash,
  isolation: Circle,
  'region-enter': MapPin,
  'region-exit': LogOut,
  'cluster-size': Users,
  proximity: Target
}

// Step type icons
const STEP_ICONS: Record<string, typeof Pencil> = {
  'update-property': Pencil,
  'create-node': Plus,
  'delete-node': Trash2,
  'move-node': Move,
  'link-nodes': Link,
  'unlink-nodes': Unlink,
  wait: Timer,
  condition: GitBranch,
  'llm-call': Sparkles,
  'http-request': Globe
}

function AIConfigPreviewComponent({
  config,
  suggestedTitle,
  currentTitle,
  warnings,
  onApply,
  onApplyAndRun,
  onEdit,
  onCancel
}: AIConfigPreviewProps): JSX.Element {
  const [useSuggestedTitle, setUseSuggestedTitle] = useState(!!suggestedTitle)

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-2 p-2 bg-yellow-900/20 border border-yellow-600/30 rounded">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-300/90">
            {warnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Title */}
      {suggestedTitle && suggestedTitle !== currentTitle && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[var(--text-secondary)]">Name:</span>
            <span className="text-purple-300 font-medium">{suggestedTitle}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setUseSuggestedTitle(true)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                useSuggestedTitle
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Use
            </button>
            <button
              onClick={() => setUseSuggestedTitle(false)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                !useSuggestedTitle
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Keep current
            </button>
          </div>
        </div>
      )}

      {/* Configuration Summary - Clean list format */}
      <div className="space-y-3">
        {/* Trigger */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-500/20 flex-shrink-0">
            <TriggerIcon type={config.trigger.type} />
          </div>
          <div>
            <div className="text-xs font-medium gui-text">Trigger</div>
            <div className="text-xs gui-text-secondary">
              <TriggerDescription trigger={config.trigger} />
            </div>
          </div>
        </div>

        {/* Conditions */}
        {config.conditions.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-yellow-500/20 flex-shrink-0">
              <GitBranch className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <div>
              <div className="text-xs font-medium gui-text">Conditions</div>
              <div className="text-xs gui-text-secondary space-y-0.5">
                {config.conditions.map((condition, i) => (
                  <div key={i}>
                    <ConditionDescription condition={condition} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-emerald-500/20 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium gui-text mb-1">
              Steps ({config.actions.length})
            </div>
            <div className="space-y-1.5">
              {config.actions.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono w-4 flex-shrink-0">
                    {i + 1}.
                  </span>
                  <StepDescription step={step} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      {config.explanation && (
        <p className="text-xs text-[var(--text-muted)] italic border-l-2 border-[var(--border-subtle)] pl-3">
          {config.explanation}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs gui-text-secondary hover:gui-text rounded transition-colors"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-xs bg-[var(--surface-panel-secondary)] hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
          >
            Edit First
          </button>
          <button
            onClick={() => onApply(useSuggestedTitle)}
            className="px-3 py-1.5 text-xs bg-[var(--surface-panel-secondary)] hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
          >
            Apply Only
          </button>
          <button
            onClick={() => onApplyAndRun(useSuggestedTitle)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded font-medium transition-colors"
            title="Apply configuration and run the action immediately"
          >
            <Zap className="w-3 h-3" />
            Apply & Run
          </button>
        </div>
      </div>
    </div>
  )
}

// Trigger icon component
function TriggerIcon({ type }: { type: string }): JSX.Element {
  const Icon = TRIGGER_ICONS[type] || Play
  const colors: Record<string, string> = {
    manual: 'text-[var(--text-secondary)]',
    'property-change': 'text-blue-400',
    schedule: 'text-yellow-400',
    'node-created': 'text-green-400',
    'connection-made': 'text-purple-400'
  }
  return <Icon className={`w-3.5 h-3.5 ${colors[type] || 'text-blue-400'}`} />
}

// Trigger description
function TriggerDescription({ trigger }: { trigger: ActionTrigger }): JSX.Element {
  let description = ''

  switch (trigger.type) {
    case 'manual':
      description = 'When you click the play button'
      break
    case 'property-change': {
      const t = trigger as { property?: string; toValue?: unknown; nodeFilter?: string }
      description = `When ${t.nodeFilter || 'any node'}'s "${t.property || 'property'}" changes`
      if (t.toValue !== undefined) {
        description += ` to "${t.toValue}"`
      }
      break
    }
    case 'schedule': {
      const t = trigger as { cron?: string }
      description = describeCron(t.cron || '0 9 * * *')
      break
    }
    case 'node-created': {
      const t = trigger as { nodeTypeFilter?: string }
      description = `When a new ${t.nodeTypeFilter || 'node'} is created`
      break
    }
    case 'connection-made': {
      const t = trigger as { direction?: string; nodeTypeFilter?: string }
      description = `When ${t.direction || 'a'} connection is made`
      if (t.nodeTypeFilter) {
        description += ` to a ${t.nodeTypeFilter}`
      }
      break
    }
    case 'children-complete': {
      const t = trigger as { property?: string; targetValue?: unknown; requireAll?: boolean }
      description = `When ${t.requireAll ? 'all' : 'any'} children have ${t.property} = "${t.targetValue}"`
      break
    }
    case 'isolation':
      description = 'When node has no connections'
      break
    default:
      description = `${trigger.type} trigger`
  }

  return <span>{description}</span>
}

// Condition description
function ConditionDescription({ condition }: { condition: ActionCondition }): JSX.Element {
  const operators: Record<string, string> = {
    equals: 'equals',
    'not-equals': 'does not equal',
    contains: 'contains',
    'not-contains': 'does not contain',
    'greater-than': 'is greater than',
    'less-than': 'is less than',
    'is-empty': 'is empty',
    'is-not-empty': 'is not empty'
  }

  const op = operators[condition.operator] || condition.operator
  const target = condition.target === 'trigger-node' ? 'trigger node' : condition.target

  if (condition.operator === 'is-empty' || condition.operator === 'is-not-empty') {
    return <span>If {target}'s {condition.field} {op}</span>
  }

  return <span>If {target}'s {condition.field} {op} "{String(condition.value)}"</span>
}

// Step description
function StepDescription({ step }: { step: ActionStep }): JSX.Element {
  const Icon = STEP_ICONS[step.type] || Sparkles
  const colors: Record<string, string> = {
    'create-node': 'text-green-400',
    'update-property': 'text-blue-400',
    'delete-node': 'text-red-400',
    'llm-call': 'text-purple-400',
    'link-nodes': 'text-cyan-400',
    'http-request': 'text-orange-400'
  }

  let description = ''
  const config = step.config as Record<string, unknown>

  switch (step.type) {
    case 'create-node':
      description = `Create ${config.nodeType} "${config.title}"`
      if (config.variableName) description += ` (save as $${config.variableName})`
      break
    case 'update-property':
      description = `Set ${config.target}'s ${config.property} to "${config.value}"`
      break
    case 'delete-node':
      description = `Delete ${config.target}`
      break
    case 'llm-call':
      description = `Ask AI: "${truncate(String(config.prompt || ''), 50)}"`
      if (config.variableName) description += ` (save as $${config.variableName})`
      break
    case 'link-nodes':
      description = `Connect ${config.source} to ${config.target}`
      break
    case 'unlink-nodes':
      description = `Disconnect ${config.source} from ${config.target}`
      break
    case 'wait':
      description = `Wait ${config.duration}ms`
      break
    case 'condition':
      description = `If ${config.field} ${config.operator} "${config.value}", skip ${config.skipCount} steps`
      break
    case 'http-request':
      description = `${config.method} request to ${truncate(String(config.url || ''), 40)}`
      break
    case 'move-node':
      description = `Move ${config.target} to (${config.x}, ${config.y})`
      break
    default:
      description = `${step.type} step`
  }

  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`w-3 h-3 flex-shrink-0 ${colors[step.type] || 'text-[var(--text-secondary)]'}`} />
      <span className="text-xs gui-text-secondary">{description}</span>
    </div>
  )
}

// Helper: Describe cron expression in plain English
function describeCron(cron: string): string {
  const parts = cron.split(' ')
  if (parts.length < 5) return `On schedule: ${cron}`

  const [minute, hour, , , dayOfWeek] = parts

  // Common patterns
  if (minute === '0' && hour !== '*' && dayOfWeek === '*') {
    const h = parseInt(hour)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `Every day at ${hour12}:00 ${ampm}`
  }
  if (minute === '0' && hour === '9' && dayOfWeek === '1') {
    return 'Every Monday at 9:00 AM'
  }
  if (minute === '0' && hour.includes(',')) {
    const hours = hour.split(',').map(h => {
      const num = parseInt(h)
      const ampm = num >= 12 ? 'PM' : 'AM'
      const hour12 = num > 12 ? num - 12 : num === 0 ? 12 : num
      return `${hour12}:00 ${ampm}`
    })
    return `Every day at ${hours.join(' and ')}`
  }
  if (minute.startsWith('*/')) {
    return `Every ${minute.slice(2)} minutes`
  }
  if (hour === '*' && minute === '0') {
    return 'Every hour'
  }

  return `On schedule: ${cron}`
}

// Helper: Truncate string
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

export const AIConfigPreview = memo(AIConfigPreviewComponent)
