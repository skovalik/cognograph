/**
 * MultiSelectProperties Component
 *
 * Shows when 2+ nodes are selected. Displays common properties across
 * selected node types with mixed-value indicators.
 */

import { memo, useMemo, useCallback } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { getPropertiesForNodeType, getMergedPropertyOptions } from '../constants/properties'
import type { PropertyDefinition } from '@shared/types'

interface MultiSelectPropertiesProps {
  nodeIds: string[]
}

function MultiSelectPropertiesComponent({ nodeIds }: MultiSelectPropertiesProps): JSX.Element {
  const nodes = useWorkspaceStore(s => s.nodes)
  const setNodeProperty = useWorkspaceStore(s => s.setNodeProperty)
  const propertySchema = useWorkspaceStore(s => s.propertySchema)
  const themeSettings = useWorkspaceStore(s => s.themeSettings)
  const isLightMode = themeSettings.mode === 'light'

  // Get selected nodes' data
  const selectedNodes = useMemo(() => {
    return nodes.filter(n => nodeIds.includes(n.id))
  }, [nodes, nodeIds])

  // Find property definitions that are common to ALL selected node types
  const commonProperties = useMemo(() => {
    if (selectedNodes.length === 0) return []

    const types = [...new Set(selectedNodes.map(n => n.data.type))]

    // Get properties for each type
    const propertySets = types.map(type => {
      const defs = getPropertiesForNodeType(type, propertySchema)
      return new Set(defs.map(d => d.id))
    })

    // Intersect all sets
    if (propertySets.length === 0 || !propertySets[0]) return []
    const firstSet = propertySets[0]
    const intersection = [...firstSet].filter(id =>
      propertySets.every(set => set.has(id))
    )

    // Get definitions for intersected properties
    const firstType = types[0]
    if (!firstType) return []
    const allDefs = getPropertiesForNodeType(firstType, propertySchema)
    return intersection
      .map(id => allDefs.find(d => d.id === id))
      .filter((d): d is PropertyDefinition => d !== undefined)
  }, [selectedNodes, propertySchema])

  // Get the value for a property across all selected nodes
  const getPropertyValue = useCallback((propertyId: string): { uniform: boolean; value: unknown } => {
    if (selectedNodes.length === 0) return { uniform: true, value: undefined }

    const values = selectedNodes.map(n => n.data.properties?.[propertyId])
    const firstValue = values[0]
    const uniform = values.every(v => JSON.stringify(v) === JSON.stringify(firstValue))
    return { uniform, value: uniform ? firstValue : undefined }
  }, [selectedNodes])

  // Set property on all selected nodes
  const handlePropertyChange = useCallback((propertyId: string, value: unknown) => {
    for (const nodeId of nodeIds) {
      setNodeProperty(nodeId, propertyId, value)
    }
  }, [nodeIds, setNodeProperty])

  const textClasses = 'text-[var(--text-primary)]'
  const textMutedClasses = 'text-[var(--text-secondary)]'
  const bgClasses = 'bg-[var(--surface-panel-secondary)]'
  const borderClasses = 'border-[var(--border-subtle)]'

  if (commonProperties.length === 0) {
    return (
      <div className={`text-xs ${textMutedClasses} italic`}>
        No common properties across selected node types.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className={`text-xs ${textMutedClasses} font-medium`}>
        Bulk edit ({nodeIds.length} nodes)
      </div>
      {commonProperties.map(definition => {
        const { uniform, value } = getPropertyValue(definition.id)
        return (
          <BulkPropertyField
            key={definition.id}
            definition={definition}
            value={value}
            isMixed={!uniform}
            onChange={(val) => handlePropertyChange(definition.id, val)}
            isLightMode={isLightMode}
            textClasses={textClasses}
            textMutedClasses={textMutedClasses}
            bgClasses={bgClasses}
            borderClasses={borderClasses}
            propertySchema={propertySchema}
          />
        )
      })}
    </div>
  )
}

// Individual bulk property field
function BulkPropertyField({
  definition,
  value,
  isMixed,
  onChange,
  isLightMode: _isLightMode,
  textClasses,
  textMutedClasses,
  bgClasses,
  borderClasses,
  propertySchema
}: {
  definition: PropertyDefinition
  value: unknown
  isMixed: boolean
  onChange: (value: unknown) => void
  isLightMode: boolean
  textClasses: string
  textMutedClasses: string
  bgClasses: string
  borderClasses: string
  propertySchema: { builtinPropertyOptions: Record<string, unknown[]>; customProperties: unknown[] }
}): JSX.Element {
  const options = getMergedPropertyOptions(definition.id, propertySchema as Parameters<typeof getMergedPropertyOptions>[1])

  // Render based on property type
  const renderField = (): JSX.Element => {
    switch (definition.type) {
      case 'select':
      case 'status':
      case 'priority': {
        const currentValue = isMixed ? '' : ((value as string) || (definition.defaultValue as string) || '')
        return (
          <select
            value={currentValue}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`w-full ${bgClasses} border ${borderClasses} rounded px-2 py-1.5 text-xs ${textClasses} focus:outline-none focus:border-blue-500`}
          >
            {isMixed && <option value="">— Mixed —</option>}
            {(options || []).map((opt) => (
              <option key={(opt as { value: string }).value} value={(opt as { value: string }).value}>
                {(opt as { label: string }).label}
              </option>
            ))}
          </select>
        )
      }

      case 'multi-select': {
        const currentTags = isMixed ? [] : ((value as string[]) || [])
        return (
          <div className="space-y-1">
            {isMixed && (
              <span className={`text-xs ${textMutedClasses} italic`}>— Mixed —</span>
            )}
            <div className="flex flex-wrap gap-1">
              {currentTags.map(tag => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${bgClasses} ${textClasses}`}
                >
                  {tag}
                  <button
                    onClick={() => onChange(currentTags.filter(t => t !== tag))}
                    className="text-[var(--text-secondary)] hover:text-red-400"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder={isMixed ? 'Add tag to all...' : 'Add tag...'}
              className={`w-full ${bgClasses} border ${borderClasses} rounded px-2 py-1 text-xs ${textClasses} focus:outline-none focus:border-blue-500`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  const newTag = e.currentTarget.value.trim()
                  const newTags = [...currentTags, newTag]
                  onChange([...new Set(newTags)])
                  e.currentTarget.value = ''
                }
              }}
            />
          </div>
        )
      }

      case 'text': {
        const currentValue = isMixed ? '' : ((value as string) || '')
        return (
          <input
            type="text"
            value={currentValue}
            placeholder={isMixed ? '— Mixed —' : ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`w-full ${bgClasses} border ${borderClasses} rounded px-2 py-1.5 text-xs ${textClasses} focus:outline-none focus:border-blue-500`}
          />
        )
      }

      case 'date': {
        const currentValue = isMixed ? '' : ((value as string) || '')
        return (
          <input
            type="date"
            value={currentValue}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`w-full ${bgClasses} border ${borderClasses} rounded px-2 py-1.5 text-xs ${textClasses} focus:outline-none focus:border-blue-500`}
          />
        )
      }

      default:
        return (
          <span className={`text-xs ${textMutedClasses} italic`}>
            {isMixed ? '— Mixed —' : String(value ?? '')}
          </span>
        )
    }
  }

  return (
    <div>
      <label className={`block text-xs font-medium ${textMutedClasses} mb-1`}>
        {definition.name}
        {isMixed && <span className="ml-1 text-yellow-500">(mixed)</span>}
      </label>
      {renderField()}
    </div>
  )
}

export const MultiSelectProperties = memo(MultiSelectPropertiesComponent)
