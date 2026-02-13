import { memo, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { BUILTIN_PROPERTIES, NODE_DEFAULT_PROPERTIES } from '../../constants/properties'
import type { NodeData, PropertyDefinition } from '@shared/types'

const NODE_TYPES: Array<{ type: NodeData['type']; label: string }> = [
  { type: 'task', label: 'Task' },
  { type: 'note', label: 'Note' },
  { type: 'conversation', label: 'Conversation' },
  { type: 'project', label: 'Project' },
  { type: 'artifact', label: 'Artifact' }
]

export const DefaultPropertySettings = memo(function DefaultPropertySettings() {
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const updatePropertyDefaults = useWorkspaceStore((state) => state.updatePropertyDefaults)

  const handleDefaultChange = useCallback((nodeType: string, propertyId: string, value: unknown) => {
    const currentDefaults = propertySchema?.defaults?.[nodeType] || {}
    const typeDefaults = { ...currentDefaults }

    if (value === '' || value === undefined || value === null) {
      delete typeDefaults[propertyId]
    } else {
      typeDefaults[propertyId] = value
    }

    updatePropertyDefaults(nodeType, typeDefaults)
  }, [propertySchema, updatePropertyDefaults])

  const getDefaultValue = (nodeType: string, propertyId: string): unknown => {
    return propertySchema?.defaults?.[nodeType]?.[propertyId] ?? ''
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold gui-text">Default Values</h3>
        <p className="text-sm mt-1 gui-text-secondary">
          Set default property values for newly created nodes of each type.
        </p>
      </div>

      {NODE_TYPES.map(({ type, label }) => {
        const propertyIds = NODE_DEFAULT_PROPERTIES[type] || []
        const editableProperties = propertyIds
          .map((id) => BUILTIN_PROPERTIES[id])
          .filter((def): def is PropertyDefinition =>
            def !== undefined && (def.type === 'select' || def.type === 'status' || def.type === 'priority')
          )

        if (editableProperties.length === 0) return null

        return (
          <div
            key={type}
            className="gui-card p-3 rounded-lg"
          >
            <h4 className="text-sm font-medium mb-2 gui-text-secondary">{label}</h4>
            <div className="space-y-2">
              {editableProperties.map((def) => (
                <div key={def.id} className="flex items-center gap-3">
                  <label className="text-xs w-24 gui-text-secondary">{def.name}</label>
                  <select
                    value={(getDefaultValue(type, def.id) as string) || ''}
                    onChange={(e) => handleDefaultChange(type, def.id, e.target.value || undefined)}
                    className="gui-input flex-1 px-2 py-1 rounded text-sm"
                  >
                    <option value="">— No default —</option>
                    {def.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
})
