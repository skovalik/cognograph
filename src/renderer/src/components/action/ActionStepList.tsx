import { memo, useCallback } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Power } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import type { ActionStep } from '@shared/actionTypes'
import { ActionStepConfig } from './ActionStepConfig'

interface ActionStepListProps {
  steps: ActionStep[]
  onChange: (steps: ActionStep[]) => void
}

function ActionStepListComponent({ steps, onChange }: ActionStepListProps): JSX.Element {
  const handleAdd = useCallback(() => {
    const newStep: ActionStep = {
      id: uuid(),
      type: 'update-property',
      onError: 'stop',
      config: { target: 'trigger-node', property: '', value: '' }
    }
    onChange([...steps, newStep])
  }, [steps, onChange])

  const handleRemove = useCallback((id: string) => {
    onChange(steps.filter(s => s.id !== id))
  }, [steps, onChange])

  const handleUpdate = useCallback((id: string, updatedStep: ActionStep) => {
    onChange(steps.map(s => s.id === id ? updatedStep : s))
  }, [steps, onChange])

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return
    const newSteps = [...steps]
    const temp = newSteps[index - 1]!
    newSteps[index - 1] = newSteps[index]!
    newSteps[index] = temp
    onChange(newSteps)
  }, [steps, onChange])

  const handleMoveDown = useCallback((index: number) => {
    if (index === steps.length - 1) return
    const newSteps = [...steps]
    const temp = newSteps[index]!
    newSteps[index] = newSteps[index + 1]!
    newSteps[index + 1] = temp
    onChange(newSteps)
  }, [steps, onChange])

  const handleToggleDisabled = useCallback((id: string) => {
    onChange(steps.map(s => s.id === id ? { ...s, disabled: !s.disabled } : s))
  }, [steps, onChange])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium gui-text-secondary">
          Action Steps ({steps.length})
        </label>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 text-[10px] gui-text-secondary hover:gui-text px-1.5 py-0.5 rounded hover:bg-white/5"
        >
          <Plus className="w-3 h-3" />
          Add Step
        </button>
      </div>

      {steps.length === 0 && (
        <p className="text-[10px] gui-text-secondary opacity-60">No steps configured</p>
      )}

      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`p-2 rounded gui-panel-secondary border border-transparent ${step.disabled ? 'opacity-50' : ''}`}
        >
          {/* Step header with controls */}
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[9px] gui-text-secondary font-mono w-4">
              {index + 1}.
            </span>

            {/* Move up/down buttons */}
            <button
              onClick={() => handleMoveUp(index)}
              disabled={index === 0}
              className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
              title="Move up"
            >
              <ChevronUp className="w-3 h-3 gui-text-secondary" />
            </button>
            <button
              onClick={() => handleMoveDown(index)}
              disabled={index === steps.length - 1}
              className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
              title="Move down"
            >
              <ChevronDown className="w-3 h-3 gui-text-secondary" />
            </button>

            {/* Step label */}
            <input
              type="text"
              value={step.label || ''}
              onChange={(e) => handleUpdate(step.id, { ...step, label: e.target.value || undefined })}
              placeholder="step label"
              className="flex-1 min-w-0 text-[10px] bg-transparent border-none outline-none gui-text-secondary placeholder:opacity-40"
            />

            {/* Toggle enabled */}
            <button
              onClick={() => handleToggleDisabled(step.id)}
              className={`p-0.5 rounded hover:bg-white/10 ${step.disabled ? 'text-[var(--text-muted)]' : 'text-emerald-400'}`}
              title={step.disabled ? 'Enable step' : 'Disable step'}
            >
              <Power className="w-3 h-3" />
            </button>

            {/* Remove button */}
            <button
              onClick={() => handleRemove(step.id)}
              className="p-0.5 rounded hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400"
              title="Remove step"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Step configuration */}
          <ActionStepConfig
            step={step}
            onChange={(updated) => handleUpdate(step.id, updated)}
          />
        </div>
      ))}
    </div>
  )
}

export const ActionStepList = memo(ActionStepListComponent)
