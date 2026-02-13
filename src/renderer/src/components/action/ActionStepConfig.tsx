import { memo, useCallback } from 'react'
import type { ActionStep, ActionStepType, ActionStepErrorBehavior } from '@shared/actionTypes'

const STEP_TYPE_OPTIONS: { value: ActionStepType; label: string }[] = [
  { value: 'update-property', label: 'Update Property' },
  { value: 'create-node', label: 'Create Node' },
  { value: 'delete-node', label: 'Delete Node' },
  { value: 'move-node', label: 'Move Node' },
  { value: 'link-nodes', label: 'Link Nodes' },
  { value: 'unlink-nodes', label: 'Unlink Nodes' },
  { value: 'wait', label: 'Wait' },
  { value: 'condition', label: 'Condition (If)' },
  { value: 'llm-call', label: 'LLM Call' },
  { value: 'http-request', label: 'HTTP Request' }
]

const ERROR_BEHAVIOR_OPTIONS: { value: ActionStepErrorBehavior; label: string }[] = [
  { value: 'stop', label: 'Stop' },
  { value: 'continue', label: 'Continue' },
  { value: 'retry', label: 'Retry (3x)' }
]

const TARGET_OPTIONS = [
  { value: 'trigger-node', label: 'Trigger Node' },
  { value: 'action-node', label: 'Action Node' },
  { value: 'specific-node', label: 'Specific Node' },
  { value: 'created-node', label: 'Created Node' }
]

interface ActionStepConfigProps {
  step: ActionStep
  onChange: (step: ActionStep) => void
}

function ActionStepConfigComponent({ step, onChange }: ActionStepConfigProps): JSX.Element {
  const handleTypeChange = useCallback((newType: ActionStepType) => {
    const base = { id: step.id, label: step.label, onError: step.onError, disabled: step.disabled }
    switch (newType) {
      case 'update-property':
        onChange({ ...base, type: 'update-property', config: { target: 'trigger-node', property: '', value: '' } })
        break
      case 'create-node':
        onChange({ ...base, type: 'create-node', config: { nodeType: 'note', title: 'New Node', position: 'near-trigger' } })
        break
      case 'delete-node':
        onChange({ ...base, type: 'delete-node', config: { target: 'trigger-node' } })
        break
      case 'move-node':
        onChange({ ...base, type: 'move-node', config: { target: 'trigger-node', position: 'relative', x: 300, y: 0 } })
        break
      case 'link-nodes':
        onChange({ ...base, type: 'link-nodes', config: { source: 'trigger-node', target: 'action-node' } })
        break
      case 'unlink-nodes':
        onChange({ ...base, type: 'unlink-nodes', config: { source: 'trigger-node', target: 'action-node' } })
        break
      case 'wait':
        onChange({ ...base, type: 'wait', config: { duration: 1000 } })
        break
      case 'condition':
        onChange({ ...base, type: 'condition', config: { field: 'status', operator: 'equals', value: '', target: 'trigger-node', skipCount: 1 } })
        break
      case 'llm-call':
        onChange({ ...base, type: 'llm-call', config: { prompt: '', variableName: 'llmResponse' } })
        break
      case 'http-request':
        onChange({ ...base, type: 'http-request', config: { method: 'GET', url: '' } })
        break
    }
  }, [step, onChange])

  const updateConfig = useCallback((updates: Record<string, unknown>) => {
    onChange({ ...step, config: { ...step.config, ...updates } } as ActionStep)
  }, [step, onChange])

  return (
    <div className="space-y-1.5">
      {/* Type + Error behavior row */}
      <div className="flex items-center gap-1.5">
        <select
          value={step.type}
          onChange={(e) => handleTypeChange(e.target.value as ActionStepType)}
          className="flex-1 text-[10px] gui-input rounded px-1.5 py-0.5"
        >
          {STEP_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={step.onError}
          onChange={(e) => onChange({ ...step, onError: e.target.value as ActionStepErrorBehavior })}
          className="text-[10px] gui-input rounded px-1 py-0.5"
          title="On error behavior"
        >
          {ERROR_BEHAVIOR_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Type-specific config */}
      {step.type === 'update-property' && (
        <div className="space-y-1">
          <select
            value={step.config.target}
            onChange={(e) => updateConfig({ target: e.target.value })}
            className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
          >
            {TARGET_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {step.config.target === 'specific-node' && (
            <input
              type="text"
              value={step.config.targetNodeId || ''}
              onChange={(e) => updateConfig({ targetNodeId: e.target.value })}
              placeholder="Node ID"
              className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
            />
          )}
          <div className="flex gap-1">
            <input
              type="text"
              value={step.config.property}
              onChange={(e) => updateConfig({ property: e.target.value })}
              placeholder="property"
              className="flex-1 text-[10px] gui-input rounded px-1.5 py-0.5"
            />
            <input
              type="text"
              value={String(step.config.value ?? '')}
              onChange={(e) => updateConfig({ value: e.target.value })}
              placeholder="value"
              className="flex-1 text-[10px] gui-input rounded px-1.5 py-0.5"
            />
          </div>
        </div>
      )}

      {step.type === 'create-node' && (
        <div className="space-y-1">
          <div className="flex gap-1">
            <select
              value={step.config.nodeType}
              onChange={(e) => updateConfig({ nodeType: e.target.value })}
              className="flex-1 text-[10px] gui-input rounded px-1.5 py-0.5"
            >
              <option value="note">Note</option>
              <option value="task">Task</option>
              <option value="conversation">Conversation</option>
              <option value="artifact">Artifact</option>
              <option value="project">Project</option>
            </select>
            <select
              value={step.config.position}
              onChange={(e) => updateConfig({ position: e.target.value })}
              className="flex-1 text-[10px] gui-input rounded px-2 py-0.5"
            >
              <option value="near-trigger">Near trigger</option>
              <option value="near-action">Near action</option>
              <option value="absolute">Absolute</option>
            </select>
          </div>
          <input
            type="text"
            value={step.config.title}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="Title"
            className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
          />
          <input
            type="text"
            value={step.config.variableName || ''}
            onChange={(e) => updateConfig({ variableName: e.target.value || undefined })}
            placeholder="Store ID as variable (optional)"
            className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
          />
        </div>
      )}

      {step.type === 'delete-node' && (
        <select
          value={step.config.target}
          onChange={(e) => updateConfig({ target: e.target.value })}
          className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
        >
          <option value="trigger-node">Trigger Node</option>
          <option value="specific-node">Specific Node</option>
          <option value="created-node">Created Node</option>
        </select>
      )}

      {step.type === 'move-node' && (
        <div className="space-y-1">
          <select
            value={step.config.target}
            onChange={(e) => updateConfig({ target: e.target.value })}
            className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
          >
            {TARGET_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <div className="flex-1">
              <label className="text-[9px] gui-text-secondary">X</label>
              <input
                type="number"
                value={step.config.x}
                onChange={(e) => updateConfig({ x: parseInt(e.target.value) || 0 })}
                className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] gui-text-secondary">Y</label>
              <input
                type="number"
                value={step.config.y}
                onChange={(e) => updateConfig({ y: parseInt(e.target.value) || 0 })}
                className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
              />
            </div>
          </div>
        </div>
      )}

      {step.type === 'wait' && (
        <div>
          <label className="text-[9px] gui-text-secondary">Duration (ms)</label>
          <input
            type="number"
            value={step.config.duration}
            onChange={(e) => updateConfig({ duration: parseInt(e.target.value) || 0 })}
            className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
            min={0}
            step={100}
          />
        </div>
      )}

      {step.type === 'llm-call' && (
        <div className="space-y-1">
          <input
            type="text"
            value={step.config.systemPrompt || ''}
            onChange={(e) => updateConfig({ systemPrompt: e.target.value || undefined })}
            placeholder="System prompt (optional)"
            className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
          />
          <textarea
            value={step.config.prompt}
            onChange={(e) => updateConfig({ prompt: e.target.value })}
            placeholder="Prompt (use {{triggerNode.title}}, {{triggerNode.status}}, etc.)"
            className="w-full text-[10px] gui-input rounded px-1.5 py-1 resize-y min-h-[40px]"
            rows={2}
          />
          <div className="flex gap-1">
            <input
              type="text"
              value={step.config.variableName || ''}
              onChange={(e) => updateConfig({ variableName: e.target.value || undefined })}
              placeholder="Response variable name"
              className="flex-1 text-[10px] gui-input rounded px-1.5 py-0.5"
            />
            <input
              type="number"
              value={step.config.maxTokens || ''}
              onChange={(e) => updateConfig({ maxTokens: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="Max tokens"
              className="w-20 text-[10px] gui-input rounded px-1.5 py-0.5"
              min={1}
              max={32000}
            />
          </div>
        </div>
      )}

      {step.type === 'http-request' && (
        <div className="space-y-1">
          <div className="flex gap-1">
            <select
              value={step.config.method}
              onChange={(e) => updateConfig({ method: e.target.value })}
              className="text-[10px] gui-input rounded px-1 py-0.5"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
            <input
              type="text"
              value={step.config.url}
              onChange={(e) => updateConfig({ url: e.target.value })}
              placeholder="URL"
              className="flex-1 text-[10px] gui-input rounded px-1.5 py-0.5"
            />
          </div>
          {(step.config.method !== 'GET') && (
            <textarea
              value={step.config.body || ''}
              onChange={(e) => updateConfig({ body: e.target.value || undefined })}
              placeholder="Body (JSON, supports {{variables}})"
              className="w-full text-[10px] gui-input rounded px-1.5 py-1 resize-y min-h-[30px]"
              rows={2}
            />
          )}
        </div>
      )}

      {step.type === 'condition' && (
        <div className="space-y-1">
          <div className="flex gap-1">
            <input
              type="text"
              value={step.config.field}
              onChange={(e) => updateConfig({ field: e.target.value })}
              placeholder="field"
              className="flex-1 text-[10px] gui-input rounded px-1.5 py-0.5"
            />
            <select
              value={step.config.operator}
              onChange={(e) => updateConfig({ operator: e.target.value })}
              className="text-[10px] gui-input rounded px-1 py-0.5"
            >
              <option value="equals">=</option>
              <option value="not-equals">!=</option>
              <option value="contains">has</option>
              <option value="greater-than">&gt;</option>
              <option value="less-than">&lt;</option>
              <option value="is-empty">empty</option>
              <option value="is-not-empty">!empty</option>
            </select>
            <input
              type="text"
              value={String(step.config.value ?? '')}
              onChange={(e) => updateConfig({ value: e.target.value })}
              placeholder="value"
              className="flex-1 text-[10px] gui-input rounded px-1.5 py-0.5"
            />
          </div>
          <div>
            <label className="text-[9px] gui-text-secondary">Skip N steps if false</label>
            <input
              type="number"
              value={step.config.skipCount}
              onChange={(e) => updateConfig({ skipCount: parseInt(e.target.value) || 1 })}
              className="w-full text-[10px] gui-input rounded px-1.5 py-0.5"
              min={1}
            />
          </div>
        </div>
      )}

      {(step.type === 'link-nodes' || step.type === 'unlink-nodes') && (
        <div className="space-y-1">
          <div className="flex gap-1">
            <div className="flex-1">
              <label className="text-[9px] gui-text-secondary">Source</label>
              <select
                value={step.config.source}
                onChange={(e) => updateConfig({ source: e.target.value })}
                className="w-full text-[10px] gui-input rounded px-1 py-0.5"
              >
                {TARGET_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[9px] gui-text-secondary">Target</label>
              <select
                value={step.config.target}
                onChange={(e) => updateConfig({ target: e.target.value })}
                className="w-full text-[10px] gui-input rounded px-1 py-0.5"
              >
                {TARGET_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const ActionStepConfig = memo(ActionStepConfigComponent)
