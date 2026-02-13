import { memo, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import type { ActionCondition, ConditionOperator } from '@shared/actionTypes'

const OPERATOR_OPTIONS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'not-equals', label: '!=' },
  { value: 'contains', label: 'contains' },
  { value: 'not-contains', label: '!contains' },
  { value: 'greater-than', label: '>' },
  { value: 'less-than', label: '<' },
  { value: 'is-empty', label: 'empty' },
  { value: 'is-not-empty', label: '!empty' },
  { value: 'matches-regex', label: 'regex' }
]

const TARGET_OPTIONS: { value: ActionCondition['target']; label: string }[] = [
  { value: 'trigger-node', label: 'Trigger Node' },
  { value: 'action-node', label: 'This Action' },
  { value: 'specific-node', label: 'Specific Node' }
]

interface ConditionListProps {
  conditions: ActionCondition[]
  onChange: (conditions: ActionCondition[]) => void
}

function ConditionListComponent({ conditions, onChange }: ConditionListProps): JSX.Element {
  const handleAdd = useCallback(() => {
    onChange([
      ...conditions,
      {
        id: uuid(),
        field: 'status',
        operator: 'equals',
        value: '',
        target: 'trigger-node'
      }
    ])
  }, [conditions, onChange])

  const handleRemove = useCallback((id: string) => {
    onChange(conditions.filter(c => c.id !== id))
  }, [conditions, onChange])

  const handleUpdate = useCallback((id: string, updates: Partial<ActionCondition>) => {
    onChange(conditions.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [conditions, onChange])

  const needsValue = (op: ConditionOperator) => !['is-empty', 'is-not-empty'].includes(op)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium gui-text-secondary">Conditions</label>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 text-[10px] gui-text-secondary hover:gui-text px-1.5 py-0.5 rounded hover:bg-white/5"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {conditions.length === 0 && (
        <p className="text-[10px] gui-text-secondary opacity-60">No conditions (always execute)</p>
      )}

      {conditions.map((condition) => (
        <div key={condition.id} className="flex flex-col gap-1 p-2 rounded gui-panel-secondary text-xs">
          <div className="flex items-center gap-1">
            {/* Target selector */}
            <select
              value={condition.target}
              onChange={(e) => handleUpdate(condition.id, { target: e.target.value as ActionCondition['target'] })}
              className="text-[10px] gui-input rounded px-1 py-0.5 flex-shrink-0"
            >
              {TARGET_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Remove button */}
            <button
              onClick={() => handleRemove(condition.id)}
              className="ml-auto p-0.5 rounded hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Field */}
            <input
              type="text"
              value={condition.field}
              onChange={(e) => handleUpdate(condition.id, { field: e.target.value })}
              placeholder="field"
              className="flex-1 min-w-0 text-[10px] gui-input rounded px-1.5 py-0.5"
            />

            {/* Operator */}
            <select
              value={condition.operator}
              onChange={(e) => handleUpdate(condition.id, { operator: e.target.value as ConditionOperator })}
              className="text-[10px] gui-input rounded px-1 py-0.5"
            >
              {OPERATOR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Value */}
            {needsValue(condition.operator) && (
              <input
                type="text"
                value={String(condition.value ?? '')}
                onChange={(e) => handleUpdate(condition.id, { value: e.target.value })}
                placeholder="value"
                className="flex-1 min-w-0 text-[10px] gui-input rounded px-1.5 py-0.5"
              />
            )}
          </div>

          {/* Specific node ID input */}
          {condition.target === 'specific-node' && (
            <input
              type="text"
              value={condition.targetNodeId || ''}
              onChange={(e) => handleUpdate(condition.id, { targetNodeId: e.target.value })}
              placeholder="Node ID"
              className="text-[10px] gui-input rounded px-1.5 py-0.5"
            />
          )}
        </div>
      ))}
    </div>
  )
}

export const ConditionList = memo(ConditionListComponent)
