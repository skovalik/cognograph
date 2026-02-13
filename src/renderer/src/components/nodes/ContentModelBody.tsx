// ContentModelBody -- Renders inside NoteNode when noteMode === 'content-model'
// Displays WordPress CPT definition: post type, fields, taxonomies, and GraphQL names

import { memo, useCallback, useState } from 'react'
import { FileJson, Plus, X, ChevronDown, ChevronRight } from 'lucide-react'
import type {
  ContentModelFields,
  ACFFieldGroup,
  ACFField,
  ACFFieldType,
  TaxonomyRef,
  ContentModelSupport,
} from '@shared/types'

const SUPPORT_OPTIONS: ContentModelSupport[] = ['title', 'editor', 'thumbnail', 'excerpt', 'custom-fields']

const ACF_FIELD_TYPES: ACFFieldType[] = [
  'text', 'textarea', 'wysiwyg', 'number', 'url', 'email',
  'image', 'gallery', 'select', 'checkbox', 'radio',
  'repeater', 'flexible_content', 'relationship',
  'date_picker', 'color_picker', 'true_false', 'file',
]

interface ContentModelBodyProps {
  contentModel: ContentModelFields | undefined
  onChange: (contentModel: ContentModelFields) => void
  selected: boolean | undefined
}

function getDefaultContentModel(): ContentModelFields {
  return {
    postType: 'custom_type',
    singularLabel: 'Item',
    pluralLabel: 'Items',
    slug: 'items',
    supports: ['title', 'editor', 'thumbnail'],
    fieldGroups: [],
    taxonomies: [],
  }
}

function ContentModelBodyComponent({ contentModel, onChange, selected }: ContentModelBodyProps): JSX.Element {
  const data = contentModel || getDefaultContentModel()
  const [fieldsExpanded, setFieldsExpanded] = useState(false)
  const [showAddField, setShowAddField] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<ACFFieldType>('text')
  const [showAddTaxonomy, setShowAddTaxonomy] = useState(false)
  const [newTaxonomyName, setNewTaxonomyName] = useState('')

  const updateField = useCallback(
    <K extends keyof ContentModelFields>(field: K, value: ContentModelFields[K]) => {
      onChange({ ...data, [field]: value })
    },
    [data, onChange],
  )

  // Count total fields across all groups
  const totalFields = data.fieldGroups.reduce((sum, group) => sum + group.fields.length, 0)

  const handleAddField = useCallback(() => {
    if (!newFieldName.trim()) return
    const field: ACFField = {
      name: newFieldName.trim().toLowerCase().replace(/\s+/g, '_'),
      label: newFieldName.trim(),
      type: newFieldType,
      required: false,
    }
    // Add to first group, or create a default group
    const groups = data.fieldGroups.length > 0
      ? data.fieldGroups.map((g, i) =>
        i === 0 ? { ...g, fields: [...g.fields, field] } : g
      )
      : [{ name: 'default', label: 'Fields', fields: [field] }]
    updateField('fieldGroups', groups)
    setNewFieldName('')
    setNewFieldType('text')
    setShowAddField(false)
  }, [newFieldName, newFieldType, data.fieldGroups, updateField])

  const handleRemoveField = useCallback(
    (groupIndex: number, fieldIndex: number) => {
      const groups = data.fieldGroups.map((g, gi) =>
        gi === groupIndex
          ? { ...g, fields: g.fields.filter((_, fi) => fi !== fieldIndex) }
          : g
      ).filter((g) => g.fields.length > 0)
      updateField('fieldGroups', groups)
    },
    [data.fieldGroups, updateField],
  )

  const handleAddTaxonomy = useCallback(() => {
    if (!newTaxonomyName.trim()) return
    const tax: TaxonomyRef = {
      name: newTaxonomyName.trim().toLowerCase().replace(/\s+/g, '_'),
      label: newTaxonomyName.trim(),
      hierarchical: true,
    }
    updateField('taxonomies', [...data.taxonomies, tax])
    setNewTaxonomyName('')
    setShowAddTaxonomy(false)
  }, [newTaxonomyName, data.taxonomies, updateField])

  const handleRemoveTaxonomy = useCallback(
    (index: number) => {
      updateField('taxonomies', data.taxonomies.filter((_, i) => i !== index))
    },
    [data.taxonomies, updateField],
  )

  const handleToggleSupport = useCallback(
    (support: ContentModelSupport) => {
      const current = data.supports
      const updated = current.includes(support)
        ? current.filter((s) => s !== support)
        : [...current, support]
      updateField('supports', updated)
    },
    [data.supports, updateField],
  )

  return (
    <div className="flex flex-col gap-1.5 w-full nodrag nowheel" data-focusable="true">
      {/* CPT header */}
      <div className="flex items-center gap-1 px-1">
        <FileJson className="w-3 h-3 flex-shrink-0" style={{ color: '#f97316' }} />
        {selected ? (
          <input
            type="text"
            value={data.singularLabel}
            onChange={(e) => {
              const label = e.target.value
              updateField('singularLabel', label)
              updateField('slug', label.toLowerCase().replace(/\s+/g, '-') + 's')
              updateField('pluralLabel', label + 's')
            }}
            className="flex-1 text-[11px] font-mono bg-transparent border-none outline-none px-0.5"
            style={{ color: 'var(--node-text-primary)' }}
            placeholder="Post Type"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-[11px] font-semibold truncate"
            style={{ color: 'var(--node-text-primary)' }}
          >
            CPT: {data.singularLabel}
          </span>
        )}
      </div>

      {/* Slug display */}
      <div className="flex items-center gap-1 px-1">
        <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>/{data.slug}</span>
      </div>

      {/* Supports (when selected) */}
      {selected && (
        <div className="flex items-center gap-1 px-1 flex-wrap">
          <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>Supports:</span>
          {SUPPORT_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); handleToggleSupport(s) }}
              className="px-1 py-0 rounded text-[9px] font-mono cursor-pointer transition-opacity"
              style={{
                backgroundColor: data.supports.includes(s) ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: data.supports.includes(s) ? '#f97316' : 'var(--node-text-muted)',
                opacity: data.supports.includes(s) ? 1 : 0.5,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Fields section */}
      <div className="px-1">
        {totalFields === 0 && !selected ? (
          <div className="text-[10px] italic opacity-50 py-0.5" style={{ color: 'var(--node-text-muted)' }}>
            No fields defined
          </div>
        ) : !fieldsExpanded && totalFields > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); setFieldsExpanded(true) }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: 'rgba(249, 115, 22, 0.12)',
              color: 'rgba(249, 115, 22, 0.9)',
            }}
          >
            <ChevronRight className="w-2.5 h-2.5" />
            {totalFields} field{totalFields !== 1 ? 's' : ''}
          </button>
        ) : (
          <div className="flex flex-col gap-0.5">
            {totalFields > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setFieldsExpanded(false) }}
                className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-80 transition-opacity mb-0.5"
                style={{ color: 'var(--node-text-muted)' }}
              >
                <ChevronDown className="w-2.5 h-2.5" />
                {totalFields} field{totalFields !== 1 ? 's' : ''}
              </button>
            )}
            {data.fieldGroups.map((group, gi) =>
              group.fields.map((field, fi) => (
                <div
                  key={`${group.name}-${field.name}-${fi}`}
                  className="flex items-center gap-1 text-[10px] group"
                  style={{ color: 'var(--node-text-secondary)' }}
                >
                  <span className="font-mono truncate flex-1" title={field.name}>
                    {field.name}: <span className="opacity-60">{field.type}</span>
                    {field.required && (
                      <span style={{ color: '#ef4444' }}> *</span>
                    )}
                  </span>
                  {selected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveField(gi, fi) }}
                      className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                      title="Remove field"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add field (when selected) */}
      {selected && (
        <div className="px-1">
          {showAddField ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddField()
                  if (e.key === 'Escape') setShowAddField(false)
                }}
                placeholder="Field name"
                className="flex-1 text-[10px] font-mono bg-transparent border rounded px-1 py-0.5 outline-none"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--node-text-primary)',
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as ACFFieldType)}
                className="text-[10px] bg-transparent border-none outline-none cursor-pointer"
                style={{ color: 'var(--node-text-secondary)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {ACF_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={(e) => { e.stopPropagation(); handleAddField() }}
                className="text-[10px] px-1 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#f97316' }}
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddField(true) }}
              className="flex items-center gap-0.5 text-[10px] opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--node-text-muted)' }}
            >
              <Plus className="w-2.5 h-2.5" />
              Add field
            </button>
          )}
        </div>
      )}

      {/* Taxonomies */}
      {(data.taxonomies.length > 0 || selected) && (
        <div className="flex flex-col gap-0.5 px-1">
          {data.taxonomies.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px]" style={{ color: 'var(--node-text-muted)' }}>Tax:</span>
              {data.taxonomies.map((tax, index) => (
                <span
                  key={tax.name}
                  className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-mono group"
                  style={{
                    backgroundColor: 'rgba(249, 115, 22, 0.12)',
                    color: 'rgba(249, 115, 22, 0.9)',
                  }}
                >
                  {tax.label}
                  {selected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveTaxonomy(index) }}
                      className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {selected && !showAddTaxonomy && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddTaxonomy(true) }}
              className="flex items-center gap-0.5 text-[10px] opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--node-text-muted)' }}
            >
              <Plus className="w-2.5 h-2.5" />
              Add taxonomy
            </button>
          )}
          {selected && showAddTaxonomy && (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newTaxonomyName}
                onChange={(e) => setNewTaxonomyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTaxonomy()
                  if (e.key === 'Escape') setShowAddTaxonomy(false)
                }}
                placeholder="Taxonomy name"
                className="flex-1 text-[10px] font-mono bg-transparent border rounded px-1 py-0.5 outline-none"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--node-text-primary)',
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleAddTaxonomy() }}
                className="text-[10px] px-1 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#f97316' }}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* GraphQL names (compact, read-only) */}
      {(data.graphqlSingleName || data.graphqlPluralName) && (
        <div className="flex items-center gap-1 px-1">
          <span className="text-[9px] font-mono" style={{ color: 'var(--node-text-muted)' }}>
            GQL: {data.graphqlSingleName || data.postType} / {data.graphqlPluralName || data.slug}
          </span>
        </div>
      )}
    </div>
  )
}

export const ContentModelBody = memo(ContentModelBodyComponent)
