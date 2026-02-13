import { memo, useCallback, useState, useRef } from 'react'
import { Power } from 'lucide-react'
import type { ActionNodeData } from '@shared/actionTypes'
import type { ActionTrigger, ActionCondition, ActionStep } from '@shared/actionTypes'
import { TriggerConfig } from './TriggerConfig'
import { ConditionList } from './ConditionList'
import { ActionStepList } from './ActionStepList'
import { AIConfigButton } from './AIConfigButton'
import { TemplateSelector } from './TemplateSelector'
import { PromptHistoryDropdown } from './PromptHistoryDropdown'

interface ActionPropertiesFieldsProps {
  nodeId: string
  data: ActionNodeData
  onChange: (field: string, value: unknown) => void
}

function ActionPropertiesFieldsComponent({ nodeId, data, onChange }: ActionPropertiesFieldsProps): JSX.Element {
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  const handleTriggerChange = useCallback((trigger: ActionTrigger) => {
    onChange('trigger', trigger)
  }, [onChange])

  const handleConditionsChange = useCallback((conditions: ActionCondition[]) => {
    onChange('conditions', conditions)
  }, [onChange])

  const handleStepsChange = useCallback((actions: ActionStep[]) => {
    onChange('actions', actions)
  }, [onChange])

  const handleToggleEnabled = useCallback(() => {
    onChange('enabled', !data.enabled)
  }, [data.enabled, onChange])

  const handleApplyAIConfig = useCallback((config: {
    trigger: ActionTrigger
    conditions: ActionCondition[]
    actions: ActionStep[]
    title?: string
  }) => {
    // Batch all config updates into a single onChange call
    // The _batch field signals PropertiesPanel to merge all properties at once
    onChange('_batch', {
      trigger: config.trigger,
      conditions: config.conditions,
      actions: config.actions,
      ...(config.title && { title: config.title })
    })
  }, [onChange])

  const handleSelectTemplate = useCallback((template: string) => {
    onChange('description', template)
    setIsTemplateSelectorOpen(false)
    // Focus and highlight placeholders
    requestAnimationFrame(() => {
      if (descriptionRef.current) {
        descriptionRef.current.focus()
        const match = template.match(/\[([^\]]+)\]/)
        if (match?.index !== undefined) {
          descriptionRef.current.setSelectionRange(match.index, match.index + match[0].length)
        }
      }
    })
  }, [onChange])

  const handleSelectFromHistory = useCallback((prompt: string) => {
    onChange('description', prompt)
    setIsHistoryOpen(false)
    requestAnimationFrame(() => descriptionRef.current?.focus())
  }, [onChange])

  return (
    <div className="space-y-4">
      {/* Enabled toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium gui-text-secondary">Status</label>
        <button
          onClick={handleToggleEnabled}
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
            data.enabled
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-[var(--text-muted)]/20 text-[var(--text-secondary)] hover:bg-[var(--text-muted)]/30'
          }`}
        >
          <Power className="w-3 h-3" />
          {data.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Description */}
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium gui-text-secondary">Description</label>
          <div className="flex items-center gap-2">
            <PromptHistoryDropdown
              onSelect={handleSelectFromHistory}
              isOpen={isHistoryOpen}
              onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
            />
            <TemplateSelector
              onSelect={handleSelectTemplate}
              isOpen={isTemplateSelectorOpen}
              onToggle={() => setIsTemplateSelectorOpen(!isTemplateSelectorOpen)}
            />
          </div>
        </div>
        <div className="relative">
          <textarea
            ref={descriptionRef}
            value={data.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Describe what this action should do...&#10;&#10;Examples:&#10;• When a task is marked complete, create a summary note&#10;• Every morning at 9am, list all incomplete tasks&#10;• When I click the button, send a webhook to my API"
            className="w-full text-xs gui-input rounded px-2 py-1.5 pr-10 resize-y min-h-[160px] focus:min-h-[200px] transition-all duration-200"
            rows={8}
          />
          <AIConfigButton
            nodeId={nodeId}
            data={data}
            description={data.description || ''}
            onApplyConfig={handleApplyAIConfig}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border-subtle)]" />

      {/* Trigger Configuration */}
      <TriggerConfig trigger={data.trigger} onChange={handleTriggerChange} />

      {/* Divider */}
      <div className="border-t border-[var(--border-subtle)]" />

      {/* Conditions */}
      <ConditionList conditions={data.conditions} onChange={handleConditionsChange} />

      {/* Divider */}
      <div className="border-t border-[var(--border-subtle)]" />

      {/* Action Steps */}
      <ActionStepList steps={data.actions} onChange={handleStepsChange} />

      {/* Divider */}
      <div className="border-t border-[var(--border-subtle)]" />

      {/* Execution Stats (read-only) */}
      <div>
        <label className="block text-xs font-medium gui-text-secondary mb-1">Execution Stats</label>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="gui-panel-secondary rounded p-1.5 text-center">
            <div className="font-mono text-sm gui-text">{data.runCount}</div>
            <div className="gui-text-secondary">Runs</div>
          </div>
          <div className="gui-panel-secondary rounded p-1.5 text-center">
            <div className="font-mono text-sm text-red-400">{data.errorCount}</div>
            <div className="gui-text-secondary">Errors</div>
          </div>
          <div className="gui-panel-secondary rounded p-1.5 text-center">
            <div className="font-mono text-sm gui-text">
              {data.lastRun ? new Date(data.lastRun).toLocaleDateString() : '-'}
            </div>
            <div className="gui-text-secondary">Last Run</div>
          </div>
        </div>
        {data.lastError && (
          <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 rounded p-1.5">
            {data.lastError}
          </div>
        )}
      </div>
    </div>
  )
}

export const ActionPropertiesFields = memo(ActionPropertiesFieldsComponent)
