import { useState, useCallback, memo } from 'react'
import {
  Check,
  ChevronDown,
  Calendar,
  ExternalLink
} from 'lucide-react'
import type { PropertyDefinition, PropertyOption } from '@shared/types'
import { getMergedPropertyOptions } from '../../constants/properties'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { UnifiedPropertyDropdown } from './UnifiedPropertyDropdown'
import { TagsDropdown } from './TagsDropdown'
import { RichTextEditor } from '../RichTextEditor'

// -----------------------------------------------------------------------------
// PropertyInput Main Component
// -----------------------------------------------------------------------------

interface PropertyInputProps {
  definition: PropertyDefinition
  value: unknown
  onChange: (value: unknown) => void
  onAddOption?: (option: Omit<PropertyOption, 'value'>) => void
  disabled?: boolean
  compact?: boolean
  showEditButton?: boolean // Show edit options button for select types
}

const PropertyInput = memo(function PropertyInput({
  definition,
  value,
  onChange,
  disabled = false,
  showEditButton = false
}: PropertyInputProps) {
  // Get merged options (built-in + user-added) from workspace schema
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const addPropertyOption = useWorkspaceStore((state) => state.addPropertyOption)
  const updatePropertyOption = useWorkspaceStore((state) => state.updatePropertyOption)
  const deletePropertyOption = useWorkspaceStore((state) => state.deletePropertyOption)
  const mergedOptions = getMergedPropertyOptions(definition.id, propertySchema) || []

  switch (definition.type) {
    case 'text':
      return (
        <TextInput
          value={(value as string) || ''}
          onChange={onChange}
          disabled={disabled}
          placeholder={`Enter ${definition.name.toLowerCase()}...`}
        />
      )

    case 'textarea':
      return (
        <TextareaInput
          value={(value as string) || ''}
          onChange={onChange}
          disabled={disabled}
          placeholder={`Enter ${definition.name.toLowerCase()}...`}
          enableRichText={definition.enableRichText}
        />
      )

    case 'number':
      return (
        <NumberInput
          value={value as number | undefined}
          onChange={onChange}
          disabled={disabled}
          min={definition.min}
          max={definition.max}
        />
      )

    case 'select':
    case 'status':
    case 'priority':
      return (
        <UnifiedPropertyDropdown
          value={(value as string) || ''}
          options={mergedOptions.length > 0 ? mergedOptions : (definition.options || [])}
          onSelect={(v) => onChange(v)}
          onCreateOption={(opt) => {
            const newValue = addPropertyOption(definition.id, opt)
            // Optionally select the newly created option
            onChange(newValue)
          }}
          onUpdateOption={(optValue, updates) => updatePropertyOption(definition.id, optValue, updates)}
          onDeleteOption={(optValue) => deletePropertyOption(definition.id, optValue)}
          disabled={disabled}
          allowCreate={true}
          allowEdit={showEditButton}
        />
      )

    case 'multi-select':
      return (
        <TagsDropdown
          value={(value as string[]) || []}
          options={mergedOptions.length > 0 ? mergedOptions : (definition.options || [])}
          onChange={onChange}
          onCreateOption={(opt) => addPropertyOption(definition.id, opt)}
          onUpdateOption={(optValue, updates) => updatePropertyOption(definition.id, optValue, updates)}
          onDeleteOption={(optValue) => deletePropertyOption(definition.id, optValue)}
          disabled={disabled}
          allowCreate={true}
          allowEdit={showEditButton}
        />
      )

    case 'checkbox':
      return (
        <CheckboxInput
          value={(value as boolean) || false}
          onChange={onChange}
          disabled={disabled}
          label={definition.name}
        />
      )

    case 'date':
      return (
        <DateInput
          value={value as number | undefined}
          onChange={onChange}
          disabled={disabled}
        />
      )

    case 'datetime':
      return (
        <DateTimeInput
          value={value as number | undefined}
          onChange={onChange}
          disabled={disabled}
        />
      )

    case 'url':
      return (
        <UrlInput
          value={(value as string) || ''}
          onChange={onChange}
          disabled={disabled}
        />
      )

    case 'email':
      return (
        <EmailInput
          value={(value as string) || ''}
          onChange={onChange}
          disabled={disabled}
        />
      )

    case 'relation':
      return (
        <RelationInput
          value={value as string | undefined}
          onChange={onChange}
          disabled={disabled}
        />
      )

    default:
      return <span className="text-[var(--text-muted)]">Unsupported type: {definition.type}</span>
  }
})

// -----------------------------------------------------------------------------
// Text Input
// -----------------------------------------------------------------------------

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

const TextInput = memo(function TextInput({
  value,
  onChange,
  disabled,
  placeholder
}: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      spellCheck={true}
      className="w-full px-2 py-1.5 text-sm gui-input border rounded
                 focus:outline-none focus:gui-border-active
                 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
})

// -----------------------------------------------------------------------------
// Textarea Input
// -----------------------------------------------------------------------------

interface TextareaInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  rows?: number
  enableRichText?: boolean
}

const TextareaInput = memo(function TextareaInput({
  value,
  onChange,
  disabled,
  placeholder,
  rows = 4,
  enableRichText = false
}: TextareaInputProps) {
  if (enableRichText) {
    return (
      <div className="rounded border gui-border overflow-hidden">
        <RichTextEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          enableLists={true}
          enableFormatting={true}
          enableHeadings={false}
          enableAlignment={true}
          showToolbar="on-focus"
          minHeight={rows * 24}
          editable={!disabled}
        />
      </div>
    )
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows}
      spellCheck={true}
      className="w-full px-2 py-1.5 text-sm gui-input border rounded
                 focus:outline-none focus:gui-border-active
                 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
    />
  )
})

// -----------------------------------------------------------------------------
// Number Input
// -----------------------------------------------------------------------------

interface NumberInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  disabled?: boolean
  min?: number
  max?: number
  step?: number
}

const NumberInput = memo(function NumberInput({
  value,
  onChange,
  disabled,
  min,
  max,
  step = 1
}: NumberInputProps) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const val = e.target.value === '' ? undefined : parseFloat(e.target.value)
        onChange(val)
      }}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      className="w-full px-2 py-1.5 text-sm gui-input border rounded
                 focus:outline-none focus:gui-border-active
                 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
})

// -----------------------------------------------------------------------------
// Checkbox Input
// -----------------------------------------------------------------------------

interface CheckboxInputProps {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label?: string
}

const CheckboxInput = memo(function CheckboxInput({
  value,
  onChange,
  disabled,
  label
}: CheckboxInputProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded"
        style={{
          accentColor: 'var(--gui-accent-primary)',
          backgroundColor: 'var(--gui-panel-bg-secondary)',
          borderColor: 'var(--gui-border-strong)'
        }}
      />
      {label && <span className="text-sm gui-text">{label}</span>}
    </label>
  )
})

// -----------------------------------------------------------------------------
// Date Input
// -----------------------------------------------------------------------------

interface DateInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  disabled?: boolean
}

const DateInput = memo(function DateInput({ value, onChange, disabled }: DateInputProps) {
  const dateString = value ? new Date(value).toISOString().split('T')[0] : ''

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateValue = e.target.value
      if (dateValue) {
        onChange(new Date(dateValue).getTime())
      } else {
        onChange(undefined)
      }
    },
    [onChange]
  )

  return (
    <div className="relative">
      <input
        type="date"
        value={dateString}
        onChange={handleChange}
        disabled={disabled}
        className="w-full px-2 py-1.5 text-sm gui-input border rounded
                 focus:outline-none focus:gui-border-active
                 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <Calendar
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 gui-text-secondary pointer-events-none"
      />
    </div>
  )
})

// -----------------------------------------------------------------------------
// DateTime Input
// -----------------------------------------------------------------------------

interface DateTimeInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  disabled?: boolean
}

const DateTimeInput = memo(function DateTimeInput({
  value,
  onChange,
  disabled
}: DateTimeInputProps) {
  const dateTimeString = value ? new Date(value).toISOString().slice(0, 16) : ''

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateValue = e.target.value
      if (dateValue) {
        onChange(new Date(dateValue).getTime())
      } else {
        onChange(undefined)
      }
    },
    [onChange]
  )

  return (
    <input
      type="datetime-local"
      value={dateTimeString}
      onChange={handleChange}
      disabled={disabled}
      className="w-full px-2 py-1.5 text-sm gui-input border rounded
               focus:outline-none focus:gui-border-active
               disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
})

// -----------------------------------------------------------------------------
// URL Input
// -----------------------------------------------------------------------------

interface UrlInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const UrlInput = memo(function UrlInput({ value, onChange, disabled }: UrlInputProps) {
  const isValidUrl = value ? /^https?:\/\/.+/.test(value) : true

  return (
    <div className="flex items-center gap-1">
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="https://..."
        className={`flex-1 px-2 py-1.5 text-sm gui-input border rounded
                   focus:outline-none focus:gui-border-active
                   disabled:opacity-50 disabled:cursor-not-allowed
                   ${isValidUrl ? '' : 'border-red-500'}`}
      />
      {value && isValidUrl && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 gui-text-secondary hover:gui-text gui-button rounded"
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  )
})

// -----------------------------------------------------------------------------
// Email Input
// -----------------------------------------------------------------------------

interface EmailInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const EmailInput = memo(function EmailInput({ value, onChange, disabled }: EmailInputProps) {
  const isValidEmail = value ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : true

  return (
    <input
      type="email"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="email@example.com"
      className={`w-full px-2 py-1.5 text-sm gui-input border rounded
                 focus:outline-none focus:gui-border-active
                 disabled:opacity-50 disabled:cursor-not-allowed
                 ${isValidEmail ? '' : 'border-red-500'}`}
    />
  )
})

// -----------------------------------------------------------------------------
// Relation Input (Node Link)
// -----------------------------------------------------------------------------

interface RelationInputProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  disabled?: boolean
}

const RelationInput = memo(function RelationInput({
  value,
  onChange,
  disabled
}: RelationInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const nodes = useWorkspaceStore((state) => state.nodes)

  const selectedNode = nodes.find((n) => n.id === value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-2 py-1.5 text-sm gui-input
                 border rounded text-left
                 focus:outline-none focus:gui-border-active
                 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selectedNode ? (
          <span className="gui-text">{selectedNode.data.title as string}</span>
        ) : (
          <span className="gui-text-secondary">Select node...</span>
        )}
        <ChevronDown size={14} className="gui-text-secondary" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 glass-fluid gui-panel-secondary border gui-border rounded shadow-lg">
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange(undefined)
                setIsOpen(false)
              }}
              className="w-full px-2 py-1.5 text-sm text-left gui-text-secondary hover:brightness-110"
              style={{ backgroundColor: 'var(--gui-panel-bg-secondary)' }}
            >
              None
            </button>
            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => {
                  onChange(node.id)
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left hover:brightness-110"
                style={{
                  backgroundColor: value === node.id ? 'var(--gui-panel-bg)' : 'var(--gui-panel-bg-secondary)'
                }}
              >
                <span className="text-xs gui-text-secondary">[{node.data.type}]</span>
                <span className="gui-text">{node.data.title as string}</span>
                {value === node.id && <Check size={14} className="ml-auto" style={{ color: 'var(--gui-accent-primary)' }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

export default PropertyInput
