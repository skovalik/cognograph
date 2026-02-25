import { useState, useCallback, memo } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { PropertyType, PropertyDefinition, PropertyOption } from '@shared/types'
import { PROPERTY_TYPE_LABELS } from '../../constants/properties'

// -----------------------------------------------------------------------------
// CreatePropertyModal Component
// -----------------------------------------------------------------------------

interface CreatePropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateProperty: (property: Omit<PropertyDefinition, 'id'>) => void
}

const PROPERTY_TYPES: PropertyType[] = [
  'text',
  'textarea',
  'number',
  'select',
  'multi-select',
  'checkbox',
  'date',
  'datetime',
  'url',
  'email'
]

export const CreatePropertyModal = memo(function CreatePropertyModal({
  isOpen,
  onClose,
  onCreateProperty
}: CreatePropertyModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<PropertyType>('text')
  const [options, setOptions] = useState<PropertyOption[]>([])
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [showInCard, setShowInCard] = useState(false)
  const [showInList, setShowInList] = useState(true)
  const [required, setRequired] = useState(false)

  const needsOptions = type === 'select' || type === 'multi-select'

  const handleAddOption = useCallback(() => {
    if (newOptionLabel.trim()) {
      const value = newOptionLabel.trim().toLowerCase().replace(/\s+/g, '-')
      // Generate a random color for the option
      const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a78bfa', '#ec4899']
      const color = colors[options.length % colors.length]
      setOptions([...options, { value, label: newOptionLabel.trim(), color }])
      setNewOptionLabel('')
    }
  }, [newOptionLabel, options])

  const handleRemoveOption = useCallback((value: string) => {
    setOptions(options.filter((o) => o.value !== value))
  }, [options])

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return

    const property: Omit<PropertyDefinition, 'id'> = {
      name: name.trim(),
      type,
      showInCard,
      showInList,
      required
    }

    if (needsOptions && options.length > 0) {
      property.options = options
    }

    onCreateProperty(property)

    // Reset form
    setName('')
    setType('text')
    setOptions([])
    setNewOptionLabel('')
    setShowInCard(false)
    setShowInList(true)
    setRequired(false)
    onClose()
  }, [name, type, options, showInCard, showInList, required, needsOptions, onCreateProperty, onClose])

  const handleClose = useCallback(() => {
    // Reset form
    setName('')
    setType('text')
    setOptions([])
    setNewOptionLabel('')
    setShowInCard(false)
    setShowInList(true)
    setRequired(false)
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--surface-panel)] glass-fluid rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Create Custom Property</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Property Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Estimated Hours"
              className="w-full bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Property Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PropertyType)}
              className="w-full bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t] || t}
                </option>
              ))}
            </select>
          </div>

          {/* Options (for select/multi-select) */}
          {needsOptions && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Options
              </label>
              <div className="space-y-2">
                {/* Existing options */}
                {options.map((opt) => (
                  <div
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-1 bg-[var(--surface-panel)] rounded"
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span className="flex-1 text-sm text-[var(--text-secondary)]">{opt.label}</span>
                    <button
                      onClick={() => handleRemoveOption(opt.value)}
                      className="p-0.5 hover:bg-[var(--surface-panel-secondary)] rounded"
                    >
                      <Trash2 className="w-3 h-3 text-[var(--text-muted)] hover:text-red-400" />
                    </button>
                  </div>
                ))}

                {/* Add new option */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOptionLabel}
                    onChange={(e) => setNewOptionLabel(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                    placeholder="Add option..."
                    className="flex-1 bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleAddOption}
                    disabled={!newOptionLabel.trim()}
                    className="px-2 py-1 bg-[var(--surface-panel-secondary)] hover:brightness-110 disabled:opacity-50 rounded text-xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Display Options */}
          <div className="pt-3 border-t border-[var(--border-subtle)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
              Display Settings
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={showInCard}
                  onChange={(e) => setShowInCard(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] bg-[var(--surface-panel)] text-blue-500 focus:ring-blue-500"
                />
                Show on node
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={showInList}
                  onChange={(e) => setShowInList(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] bg-[var(--surface-panel)] text-blue-500 focus:ring-blue-500"
                />
                Show in layers panel
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] bg-[var(--surface-panel)] text-blue-500 focus:ring-blue-500"
                />
                Required field
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border-subtle)]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || (needsOptions && options.length === 0)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
          >
            Create Property
          </button>
        </div>
      </div>
    </div>
  )
})
