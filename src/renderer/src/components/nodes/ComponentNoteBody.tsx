// ComponentNoteBody — Renders inside NoteNode when noteMode === 'component'
// Displays component name, props list (collapsed by default), library badge, and status

import { memo, useCallback, useState } from 'react'
import { Component, Plus, X, ChevronDown, ChevronRight } from 'lucide-react'
import type {
  ComponentNoteFields,
  ComponentStatus,
  ComponentType,
  ComponentLibrary,
  PropDefinition,
  PropType,
} from '@shared/types'

const COMPONENT_STATUS_COLORS: Record<ComponentStatus, string> = {
  planned: '#6b7280',
  designed: '#8b5cf6',
  built: '#22c55e',
  tested: '#3b82f6',
}

const COMPONENT_TYPES: ComponentType[] = ['section', 'layout', 'ui', 'form', 'nav', 'footer', 'utility']
const LIBRARY_OPTIONS: ComponentLibrary[] = ['custom', 'shadcn', 'reactbits', 'reactbits-pro']
const PROP_TYPES: PropType[] = ['string', 'number', 'boolean', 'image', 'richtext', 'array', 'enum']

interface ComponentNoteBodyProps {
  component: ComponentNoteFields | undefined
  onChange: (component: ComponentNoteFields) => void
  selected: boolean | undefined
}

function getDefaultComponent(): ComponentNoteFields {
  return {
    name: 'Untitled',
    type: 'ui',
    props: [],
    status: 'planned',
  }
}

function ComponentNoteBodyComponent({ component, onChange, selected }: ComponentNoteBodyProps): JSX.Element {
  const data = component || getDefaultComponent()
  const [propsExpanded, setPropsExpanded] = useState(false)
  const [showAddProp, setShowAddProp] = useState(false)
  const [newPropName, setNewPropName] = useState('')
  const [newPropType, setNewPropType] = useState<PropType>('string')

  const updateField = useCallback(
    <K extends keyof ComponentNoteFields>(field: K, value: ComponentNoteFields[K]) => {
      onChange({ ...data, [field]: value })
    },
    [data, onChange]
  )

  const handleAddProp = useCallback(() => {
    if (!newPropName.trim()) return
    const newProp: PropDefinition = {
      name: newPropName.trim(),
      type: newPropType,
      required: false,
    }
    updateField('props', [...data.props, newProp])
    setNewPropName('')
    setNewPropType('string')
    setShowAddProp(false)
  }, [newPropName, newPropType, data.props, updateField])

  const handleRemoveProp = useCallback(
    (index: number) => {
      updateField('props', data.props.filter((_, i) => i !== index))
    },
    [data.props, updateField]
  )

  const handleTogglePropRequired = useCallback(
    (index: number) => {
      const updated = data.props.map((p, i) =>
        i === index ? { ...p, required: !p.required } : p
      )
      updateField('props', updated)
    },
    [data.props, updateField]
  )

  const statusColor = COMPONENT_STATUS_COLORS[data.status]

  return (
    <div className="flex flex-col gap-1.5 w-full nodrag nowheel" data-focusable="true">
      {/* Component name with JSX-style display */}
      <div className="flex items-center gap-1 px-1">
        <Component className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--node-text-secondary)' }} />
        {selected ? (
          <input
            type="text"
            value={data.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="flex-1 text-[11px] font-mono bg-transparent border-none outline-none px-0.5"
            style={{ color: 'var(--node-text-primary)' }}
            placeholder="ComponentName"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-[11px] font-mono truncate"
            style={{ color: 'var(--node-text-primary)' }}
          >
            {'<'}{data.name}{' />'}
          </span>
        )}
      </div>

      {/* Type and library selectors (when selected) */}
      {selected && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>Type:</span>
            <select
              value={data.type}
              onChange={(e) => updateField('type', e.target.value as ComponentType)}
              className="text-[10px] bg-transparent border-none outline-none cursor-pointer"
              style={{ color: 'var(--node-text-secondary)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {COMPONENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>Lib:</span>
            <select
              value={data.library || 'custom'}
              onChange={(e) => updateField('library', e.target.value as ComponentLibrary)}
              className="text-[10px] bg-transparent border-none outline-none cursor-pointer"
              style={{ color: 'var(--node-text-secondary)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {LIBRARY_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Props section: collapsed badge or expanded list */}
      <div className="px-1">
        {data.props.length === 0 && !selected ? (
          <div
            className="text-[10px] italic opacity-50 py-0.5"
            style={{ color: 'var(--node-text-muted)' }}
          >
            No props defined
          </div>
        ) : !propsExpanded && data.props.length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); setPropsExpanded(true) }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              color: 'rgba(139, 92, 246, 0.9)',
            }}
          >
            <ChevronRight className="w-2.5 h-2.5" />
            {data.props.length} prop{data.props.length !== 1 ? 's' : ''}
          </button>
        ) : (
          <div className="flex flex-col gap-0.5">
            {data.props.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setPropsExpanded(false) }}
                className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-80 transition-opacity mb-0.5"
                style={{ color: 'var(--node-text-muted)' }}
              >
                <ChevronDown className="w-2.5 h-2.5" />
                {data.props.length} prop{data.props.length !== 1 ? 's' : ''}
              </button>
            )}
            {data.props.map((prop, index) => (
              <div
                key={`${prop.name}-${index}`}
                className="flex items-center gap-1 text-[10px] group"
                style={{ color: 'var(--node-text-secondary)' }}
              >
                <span className="font-mono truncate flex-1" title={prop.name}>
                  {prop.name}: <span className="opacity-60">{prop.type}</span>
                  {prop.required && (
                    <span style={{ color: '#ef4444' }}> *</span>
                  )}
                </span>
                {selected && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-60">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTogglePropRequired(index) }}
                      className="text-[8px] px-0.5 rounded hover:opacity-100"
                      title={prop.required ? 'Make optional' : 'Make required'}
                      style={{
                        color: prop.required ? '#ef4444' : 'var(--node-text-muted)',
                      }}
                    >
                      req
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveProp(index) }}
                      className="hover:opacity-100"
                      title="Remove prop"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add prop (when selected) */}
      {selected && (
        <div className="px-1">
          {showAddProp ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newPropName}
                onChange={(e) => setNewPropName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddProp()
                  if (e.key === 'Escape') setShowAddProp(false)
                }}
                placeholder="prop name"
                className="flex-1 text-[10px] font-mono bg-transparent border rounded px-1 py-0.5 outline-none"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--node-text-primary)',
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <select
                value={newPropType}
                onChange={(e) => setNewPropType(e.target.value as PropType)}
                className="text-[10px] bg-transparent border-none outline-none cursor-pointer"
                style={{ color: 'var(--node-text-secondary)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {PROP_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={(e) => { e.stopPropagation(); handleAddProp() }}
                className="text-[10px] px-1 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' }}
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddProp(true) }}
              className="flex items-center gap-0.5 text-[10px] opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--node-text-muted)' }}
            >
              <Plus className="w-2.5 h-2.5" />
              Add prop
            </button>
          )}
        </div>
      )}

      {/* Slots (read-only summary) */}
      {data.slots && data.slots.length > 0 && (
        <div className="flex items-center gap-1 px-1 flex-wrap">
          <span className="text-[9px]" style={{ color: 'var(--node-text-muted)' }}>Slots:</span>
          {data.slots.map((slot) => (
            <span
              key={slot}
              className="px-1 py-0 rounded text-[9px] font-mono"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: 'rgba(59, 130, 246, 0.9)',
              }}
            >
              {slot}
            </span>
          ))}
        </div>
      )}

      {/* Footer: library badge + status */}
      <div className="flex items-center gap-1 px-1 mt-0.5">
        {data.library && data.library !== 'custom' && (
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-medium"
            style={{
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: 'rgba(139, 92, 246, 0.9)',
            }}
          >
            {data.library}
          </span>
        )}
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
          style={{
            backgroundColor: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {data.status}
        </span>
        {selected && (
          <select
            value={data.status}
            onChange={(e) => updateField('status', e.target.value as ComponentStatus)}
            className="text-[9px] bg-transparent border-none outline-none cursor-pointer"
            style={{ color: statusColor }}
            onClick={(e) => e.stopPropagation()}
          >
            {Object.keys(COMPONENT_STATUS_COLORS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

export const ComponentNoteBody = memo(ComponentNoteBodyComponent)
