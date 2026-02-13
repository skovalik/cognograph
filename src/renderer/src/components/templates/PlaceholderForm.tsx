/**
 * Placeholder Form Component
 *
 * Renders form fields for template placeholders.
 * Used in both SaveTemplateModal (for editing) and PasteTemplateModal (for filling).
 */

import { memo, useCallback } from 'react'
import { Calendar, Link, Wand2, Hash, Type } from 'lucide-react'
import type { PlaceholderDefinition, PlaceholderType, NodeData } from '@shared/types'
import type { Node } from '@xyflow/react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PlaceholderFormProps {
  placeholders: PlaceholderDefinition[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  errors?: Record<string, string>
  mode?: 'fill' | 'edit'
  availableNodes?: Node<NodeData>[] // For node-reference type
}

interface PlaceholderFieldProps {
  placeholder: PlaceholderDefinition
  value: string
  onChange: (value: string) => void
  error?: string
  mode: 'fill' | 'edit'
  availableNodes?: Node<NodeData>[]
}

// -----------------------------------------------------------------------------
// Icon Helper
// -----------------------------------------------------------------------------

function getPlaceholderIcon(type: PlaceholderType): JSX.Element {
  switch (type) {
    case 'date':
      return <Calendar className="w-4 h-4 text-blue-400" />
    case 'node-instruction':
      return <Wand2 className="w-4 h-4 text-violet-400" />
    case 'node-reference':
      return <Link className="w-4 h-4 text-green-400" />
    case 'selection':
      return <Hash className="w-4 h-4 text-orange-400" />
    case 'string':
    default:
      return <Type className="w-4 h-4 text-[var(--text-secondary)]" />
  }
}

// -----------------------------------------------------------------------------
// Placeholder Field Component
// -----------------------------------------------------------------------------

function PlaceholderFieldComponent({
  placeholder,
  value,
  onChange,
  error,
  // mode is available for future use (edit vs fill mode styling)
  mode: _mode,
  availableNodes
}: PlaceholderFieldProps): JSX.Element {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  const renderInput = (): JSX.Element => {
    switch (placeholder.type) {
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={handleChange}
            className="w-full bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
          />
        )

      case 'node-reference':
        return (
          <select
            value={value}
            onChange={handleChange}
            className="w-full bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
          >
            <option value="">Select a node...</option>
            {availableNodes?.map((node) => (
              <option key={node.id} value={node.id}>
                {(node.data.title as string) || 'Untitled'} ({node.data.type})
              </option>
            ))}
          </select>
        )

      case 'node-instruction':
        return (
          <textarea
            value={value}
            onChange={handleChange}
            rows={3}
            placeholder="Enter instructions for AI generation..."
            className="w-full bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 resize-none"
          />
        )

      case 'string':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder.defaultValue || ''}
            className="w-full bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
          />
        )
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
        {getPlaceholderIcon(placeholder.type)}
        <span>{placeholder.label}</span>
        {placeholder.required && <span className="text-red-400">*</span>}
      </label>

      {placeholder.description && (
        <p className="text-xs text-[var(--text-muted)]">{placeholder.description}</p>
      )}

      {renderInput()}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

const PlaceholderField = memo(PlaceholderFieldComponent)

// -----------------------------------------------------------------------------
// Placeholder Form Component
// -----------------------------------------------------------------------------

function PlaceholderFormComponent({
  placeholders,
  values,
  onChange,
  errors = {},
  mode = 'fill',
  availableNodes
}: PlaceholderFormProps): JSX.Element {
  const handleFieldChange = useCallback(
    (key: string) => (value: string) => {
      onChange(key, value)
    },
    [onChange]
  )

  if (placeholders.length === 0) {
    return (
      <div className="text-sm text-[var(--text-muted)] italic text-center py-4">
        No placeholders to fill
      </div>
    )
  }

  // Group placeholders by type
  const groupedPlaceholders = placeholders.reduce(
    (acc, p) => {
      if (!acc[p.type]) acc[p.type] = []
      acc[p.type].push(p)
      return acc
    },
    {} as Record<PlaceholderType, PlaceholderDefinition[]>
  )

  const typeOrder: PlaceholderType[] = [
    'string',
    'date',
    'node-reference',
    'node-instruction',
    'selection'
  ]

  return (
    <div className="space-y-4">
      {typeOrder.map((type) => {
        const group = groupedPlaceholders[type]
        if (!group || group.length === 0) return null

        return (
          <div key={type} className="space-y-3">
            {group.map((placeholder) => (
              <PlaceholderField
                key={placeholder.key}
                placeholder={placeholder}
                value={values[placeholder.key] || ''}
                onChange={handleFieldChange(placeholder.key)}
                error={errors[placeholder.key]}
                mode={mode}
                availableNodes={availableNodes}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

export const PlaceholderForm = memo(PlaceholderFormComponent)
