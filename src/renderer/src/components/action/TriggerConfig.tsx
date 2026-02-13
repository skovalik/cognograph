import { memo, useCallback } from 'react'
import type { ActionTrigger, ActionTriggerType } from '@shared/actionTypes'
import { useSpatialRegionStore } from '../../stores/spatialRegionStore'

const TRIGGER_TYPE_OPTIONS: { value: ActionTriggerType; label: string; description: string }[] = [
  { value: 'manual', label: 'Manual', description: 'Triggered by clicking the play button' },
  { value: 'property-change', label: 'Property Change', description: 'When a node property changes value' },
  { value: 'node-created', label: 'Node Created', description: 'When a new node is added to the canvas' },
  { value: 'connection-made', label: 'Connection Made', description: 'When an edge is created between nodes' },
  { value: 'schedule', label: 'Schedule', description: 'On a timed interval (cron expression)' },
  { value: 'children-complete', label: 'Children Complete', description: 'When all connected child nodes reach a target value' },
  { value: 'ancestor-change', label: 'Ancestor Change', description: 'When an ancestor node property changes' },
  { value: 'connection-count', label: 'Connection Count', description: 'When connection count crosses a threshold' },
  { value: 'isolation', label: 'Isolation', description: 'When a node has zero connections' },
  { value: 'region-enter', label: 'Region Enter', description: 'When a node is dragged into a spatial region' },
  { value: 'region-exit', label: 'Region Exit', description: 'When a node leaves a spatial region' },
  { value: 'cluster-size', label: 'Cluster Size', description: 'When N nodes are in a region' },
  { value: 'proximity', label: 'Proximity', description: 'When a node gets close to another node' }
]

interface TriggerConfigProps {
  trigger: ActionTrigger
  onChange: (trigger: ActionTrigger) => void
}

function TriggerConfigComponent({ trigger, onChange }: TriggerConfigProps): JSX.Element {
  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as ActionTriggerType
    // Create default trigger for the new type
    switch (newType) {
      case 'manual':
        onChange({ type: 'manual' })
        break
      case 'property-change':
        onChange({ type: 'property-change', property: 'status' })
        break
      case 'node-created':
        onChange({ type: 'node-created' })
        break
      case 'connection-made':
        onChange({ type: 'connection-made', direction: 'any' })
        break
      case 'schedule':
        onChange({ type: 'schedule', cron: '*/5 * * * *' })
        break
      case 'children-complete':
        onChange({ type: 'children-complete', property: 'status', targetValue: 'done', requireAll: true })
        break
      case 'ancestor-change':
        onChange({ type: 'ancestor-change', property: 'status' })
        break
      case 'connection-count':
        onChange({ type: 'connection-count', threshold: 3, comparison: 'gte', direction: 'any' })
        break
      case 'isolation':
        onChange({ type: 'isolation' })
        break
      case 'region-enter':
        onChange({ type: 'region-enter', regionId: '' })
        break
      case 'region-exit':
        onChange({ type: 'region-exit', regionId: '' })
        break
      case 'cluster-size':
        onChange({ type: 'cluster-size', regionId: '', threshold: 5, comparison: 'gte' })
        break
      case 'proximity':
        onChange({ type: 'proximity', targetNodeId: '', distance: 200, direction: 'entering' })
        break
    }
  }, [onChange])

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium gui-text-secondary">Trigger Type</label>
      <select
        value={trigger.type}
        onChange={handleTypeChange}
        className="w-full text-xs gui-input rounded px-2 py-1.5"
      >
        {TRIGGER_TYPE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Per-type config fields */}
      {trigger.type === 'property-change' && (
        <div className="space-y-2 mt-2">
          <div>
            <label className="block text-[10px] gui-text-secondary mb-0.5">Property to watch</label>
            <input
              type="text"
              value={trigger.property || ''}
              onChange={(e) => onChange({ ...trigger, property: e.target.value })}
              placeholder="e.g. status, priority, tags"
              className="w-full text-xs gui-input rounded px-2 py-1"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] gui-text-secondary mb-0.5">From (optional)</label>
              <input
                type="text"
                value={String(trigger.fromValue ?? '')}
                onChange={(e) => onChange({ ...trigger, fromValue: e.target.value || undefined })}
                placeholder="any"
                className="w-full text-xs gui-input rounded px-2 py-1"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] gui-text-secondary mb-0.5">To (optional)</label>
              <input
                type="text"
                value={String(trigger.toValue ?? '')}
                onChange={(e) => onChange({ ...trigger, toValue: e.target.value || undefined })}
                placeholder="any"
                className="w-full text-xs gui-input rounded px-2 py-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] gui-text-secondary mb-0.5">Node type filter (optional)</label>
            <select
              value={trigger.nodeFilter || ''}
              onChange={(e) => onChange({ ...trigger, nodeFilter: e.target.value || undefined })}
              className="w-full text-xs gui-input rounded px-2 py-1"
            >
              <option value="">Any type</option>
              <option value="task">Task</option>
              <option value="note">Note</option>
              <option value="conversation">Conversation</option>
              <option value="project">Project</option>
              <option value="artifact">Artifact</option>
            </select>
          </div>
        </div>
      )}

      {trigger.type === 'schedule' && (
        <div className="mt-2">
          <label className="block text-[10px] gui-text-secondary mb-0.5">Cron expression</label>
          <input
            type="text"
            value={trigger.cron || ''}
            onChange={(e) => onChange({ ...trigger, cron: e.target.value })}
            placeholder="*/5 * * * * (every 5 min)"
            className="w-full text-xs gui-input rounded px-2 py-1"
          />
          <p className="text-[10px] gui-text-secondary mt-1 opacity-60">
            Format: min hour day month weekday
          </p>
        </div>
      )}

      {trigger.type === 'node-created' && (
        <div className="mt-2">
          <label className="block text-[10px] gui-text-secondary mb-0.5">Node type filter (optional)</label>
          <select
            value={trigger.nodeTypeFilter || ''}
            onChange={(e) => onChange({ ...trigger, nodeTypeFilter: e.target.value || undefined })}
            className="w-full text-xs gui-input rounded px-2 py-1"
          >
            <option value="">Any type</option>
            <option value="task">Task</option>
            <option value="note">Note</option>
            <option value="conversation">Conversation</option>
            <option value="project">Project</option>
            <option value="artifact">Artifact</option>
            <option value="action">Action</option>
          </select>
        </div>
      )}

      {trigger.type === 'connection-made' && (
        <div className="mt-2">
          <label className="block text-[10px] gui-text-secondary mb-0.5">Direction</label>
          <select
            value={trigger.direction || 'any'}
            onChange={(e) => onChange({ ...trigger, direction: e.target.value as 'incoming' | 'outgoing' | 'any' })}
            className="w-full text-xs gui-input rounded px-2 py-1"
          >
            <option value="any">Any</option>
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
          </select>
        </div>
      )}

      {trigger.type === 'children-complete' && (
        <div className="space-y-2 mt-2">
          <div>
            <label className="block text-[10px] gui-text-secondary mb-0.5">Property to check</label>
            <input
              type="text"
              value={trigger.property || ''}
              onChange={(e) => onChange({ ...trigger, property: e.target.value })}
              placeholder="e.g. status"
              className="w-full text-xs gui-input rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-[10px] gui-text-secondary mb-0.5">Target value</label>
            <input
              type="text"
              value={String(trigger.targetValue ?? '')}
              onChange={(e) => onChange({ ...trigger, targetValue: e.target.value })}
              placeholder="e.g. done"
              className="w-full text-xs gui-input rounded px-2 py-1"
            />
          </div>
          <label className="flex items-center gap-2 text-xs gui-text-secondary">
            <input
              type="checkbox"
              checked={trigger.requireAll}
              onChange={(e) => onChange({ ...trigger, requireAll: e.target.checked })}
              className="rounded"
            />
            Require all children
          </label>
        </div>
      )}

      {trigger.type === 'connection-count' && (
        <div className="space-y-2 mt-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] gui-text-secondary mb-0.5">Comparison</label>
              <select
                value={trigger.comparison}
                onChange={(e) => onChange({ ...trigger, comparison: e.target.value as 'gte' | 'lte' | 'eq' })}
                className="w-full text-xs gui-input rounded px-2 py-1"
              >
                <option value="gte">&gt;=</option>
                <option value="lte">&lt;=</option>
                <option value="eq">=</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] gui-text-secondary mb-0.5">Threshold</label>
              <input
                type="number"
                value={trigger.threshold}
                onChange={(e) => onChange({ ...trigger, threshold: parseInt(e.target.value) || 0 })}
                className="w-full text-xs gui-input rounded px-2 py-1"
                min={0}
              />
            </div>
          </div>
        </div>
      )}

      {trigger.type === 'ancestor-change' && (
        <div className="mt-2">
          <label className="block text-[10px] gui-text-secondary mb-0.5">Property to watch on ancestor</label>
          <input
            type="text"
            value={trigger.property || ''}
            onChange={(e) => onChange({ ...trigger, property: e.target.value })}
            placeholder="e.g. status, priority"
            className="w-full text-xs gui-input rounded px-2 py-1"
          />
        </div>
      )}

      {trigger.type === 'region-enter' && (
        <RegionSelector
          regionId={trigger.regionId}
          onChange={(regionId) => onChange({ ...trigger, regionId })}
        />
      )}

      {trigger.type === 'region-exit' && (
        <RegionSelector
          regionId={trigger.regionId}
          onChange={(regionId) => onChange({ ...trigger, regionId })}
        />
      )}

      {trigger.type === 'cluster-size' && (
        <div className="space-y-2 mt-2">
          <RegionSelector
            regionId={trigger.regionId}
            onChange={(regionId) => onChange({ ...trigger, regionId })}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] gui-text-secondary mb-0.5">Comparison</label>
              <select
                value={trigger.comparison}
                onChange={(e) => onChange({ ...trigger, comparison: e.target.value as 'gte' | 'lte' | 'eq' })}
                className="w-full text-xs gui-input rounded px-2 py-1"
              >
                <option value="gte">&gt;=</option>
                <option value="lte">&lt;=</option>
                <option value="eq">=</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] gui-text-secondary mb-0.5">Node count</label>
              <input
                type="number"
                value={trigger.threshold}
                onChange={(e) => onChange({ ...trigger, threshold: parseInt(e.target.value) || 0 })}
                className="w-full text-xs gui-input rounded px-2 py-1"
                min={1}
              />
            </div>
          </div>
        </div>
      )}

      {trigger.type === 'proximity' && (
        <div className="space-y-2 mt-2">
          <div>
            <label className="block text-[10px] gui-text-secondary mb-0.5">Target node ID</label>
            <input
              type="text"
              value={trigger.targetNodeId || ''}
              onChange={(e) => onChange({ ...trigger, targetNodeId: e.target.value })}
              placeholder="Node ID to watch proximity to"
              className="w-full text-xs gui-input rounded px-2 py-1"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] gui-text-secondary mb-0.5">Distance (px)</label>
              <input
                type="number"
                value={trigger.distance}
                onChange={(e) => onChange({ ...trigger, distance: parseInt(e.target.value) || 200 })}
                className="w-full text-xs gui-input rounded px-2 py-1"
                min={10}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] gui-text-secondary mb-0.5">Direction</label>
              <select
                value={trigger.direction || 'entering'}
                onChange={(e) => onChange({ ...trigger, direction: e.target.value as 'entering' | 'leaving' })}
                className="w-full text-xs gui-input rounded px-2 py-1"
              >
                <option value="entering">Entering range</option>
                <option value="leaving">Leaving range</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Description of selected trigger */}
      <p className="text-[10px] gui-text-secondary opacity-60 mt-1">
        {TRIGGER_TYPE_OPTIONS.find(o => o.value === trigger.type)?.description}
      </p>
    </div>
  )
}

// Helper component for selecting a spatial region
function RegionSelector({ regionId, onChange }: { regionId: string; onChange: (id: string) => void }): JSX.Element {
  const regions = useSpatialRegionStore((state) => state.regions)

  return (
    <div className="mt-2">
      <label className="block text-[10px] gui-text-secondary mb-0.5">Region</label>
      {regions.length === 0 ? (
        <p className="text-[10px] gui-text-secondary opacity-60">
          No regions defined. Create a spatial region first.
        </p>
      ) : (
        <select
          value={regionId}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs gui-input rounded px-2 py-1"
        >
          <option value="">Select a region...</option>
          {regions.map(r => (
            <option key={r.id} value={r.id}>{r.name || `Region ${r.id.slice(0, 6)}`}</option>
          ))}
        </select>
      )}
    </div>
  )
}

export const TriggerConfig = memo(TriggerConfigComponent)
