// PageNoteBody — Renders inside NoteNode when noteMode === 'page'
// Displays route, component list, status badge, and SEO summary

import { memo, useCallback, useState } from 'react'
import { FileText, Plus, X, GripVertical } from 'lucide-react'
import type { PageNoteFields, ComponentRef, PageStatus } from '@shared/types'

const PAGE_STATUS_COLORS: Record<PageStatus, string> = {
  planned: '#6b7280',
  wireframed: '#f59e0b',
  designed: '#8b5cf6',
  built: '#22c55e',
  live: '#3b82f6',
}

const TEMPLATE_OPTIONS = ['default', 'full-width', 'sidebar', 'landing', 'blog']

interface PageNoteBodyProps {
  page: PageNoteFields | undefined
  onChange: (page: PageNoteFields) => void
  selected: boolean | undefined
}

function getDefaultPage(): PageNoteFields {
  return {
    route: '/',
    title: 'Untitled Page',
    components: [],
    status: 'planned',
  }
}

/**
 * Normalize a route string: collapse consecutive slashes,
 * ensure leading slash, strip trailing slash (except root "/").
 */
function normalizeRoute(route: string): string {
  let normalized = route.replace(/\/+/g, '/')
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

function PageNoteBodyComponent({ page, onChange, selected }: PageNoteBodyProps): JSX.Element {
  const data = page || getDefaultPage()
  const [showAddComponent, setShowAddComponent] = useState(false)
  const [newComponentName, setNewComponentName] = useState('')

  const updateField = useCallback(
    <K extends keyof PageNoteFields>(field: K, value: PageNoteFields[K]) => {
      onChange({ ...data, [field]: value })
    },
    [data, onChange]
  )

  const handleRouteBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const normalized = normalizeRoute(e.target.value || '/')
      updateField('route', normalized)
    },
    [updateField]
  )

  const handleAddComponent = useCallback(() => {
    if (!newComponentName.trim()) return
    const newRef: ComponentRef = {
      name: newComponentName.trim(),
      order: data.components.length + 1,
    }
    updateField('components', [...data.components, newRef])
    setNewComponentName('')
    setShowAddComponent(false)
  }, [newComponentName, data.components, updateField])

  const handleRemoveComponent = useCallback(
    (index: number) => {
      const updated = data.components
        .filter((_, i) => i !== index)
        .map((c, i) => ({ ...c, order: i + 1 }))
      updateField('components', updated)
    },
    [data.components, updateField]
  )

  const statusColor = PAGE_STATUS_COLORS[data.status]

  return (
    <div className="flex flex-col gap-1.5 w-full nodrag nowheel" data-focusable="true">
      {/* Route display */}
      <div className="flex items-center gap-1 px-1">
        <FileText className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--node-text-secondary)' }} />
        {selected ? (
          <input
            type="text"
            value={data.route}
            onChange={(e) => updateField('route', e.target.value)}
            onBlur={handleRouteBlur}
            className="flex-1 text-[11px] font-mono bg-transparent border-none outline-none px-0.5"
            style={{ color: 'var(--node-text-primary)' }}
            placeholder="/route"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-[11px] font-mono truncate"
            style={{ color: 'var(--node-text-primary)' }}
            title={data.route}
          >
            {data.route}
          </span>
        )}
      </div>

      {/* Template selector (when selected) */}
      {selected && (
        <div className="flex items-center gap-1 px-1">
          <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>Layout:</span>
          <select
            value={data.template || 'default'}
            onChange={(e) => updateField('template', e.target.value)}
            className="text-[10px] bg-transparent border-none outline-none cursor-pointer flex-1"
            style={{ color: 'var(--node-text-secondary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {TEMPLATE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {/* Component list */}
      <div className="flex flex-col gap-0.5 px-1">
        {data.components.length === 0 ? (
          <div className="text-[10px] italic opacity-50 py-0.5" style={{ color: 'var(--node-text-muted)' }}>
            No components added
          </div>
        ) : (
          data.components.map((comp, index) => (
            <div
              key={`${comp.name}-${index}`}
              className="flex items-center gap-1 text-[10px] group"
              style={{ color: 'var(--node-text-secondary)' }}
            >
              <GripVertical className="w-2.5 h-2.5 opacity-30 flex-shrink-0" />
              <span className="font-mono flex-1 truncate">{comp.order}. {comp.name}</span>
              {selected && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveComponent(index) }}
                  className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                  title="Remove component"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add component (when selected) */}
      {selected && (
        <div className="px-1">
          {showAddComponent ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newComponentName}
                onChange={(e) => setNewComponentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddComponent()
                  if (e.key === 'Escape') setShowAddComponent(false)
                }}
                placeholder="Component name"
                className="flex-1 text-[10px] font-mono bg-transparent border rounded px-1 py-0.5 outline-none"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--node-text-primary)',
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleAddComponent() }}
                className="text-[10px] px-1 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddComponent(true) }}
              className="flex items-center gap-0.5 text-[10px] opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--node-text-muted)' }}
            >
              <Plus className="w-2.5 h-2.5" />
              Add component
            </button>
          )}
        </div>
      )}

      {/* Status badge */}
      <div className="flex items-center gap-1 px-1 mt-0.5">
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
            onChange={(e) => updateField('status', e.target.value as PageStatus)}
            className="text-[9px] bg-transparent border-none outline-none cursor-pointer"
            style={{ color: statusColor }}
            onClick={(e) => e.stopPropagation()}
          >
            {Object.keys(PAGE_STATUS_COLORS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        {data.contentSource && (
          <span
            className="px-1 py-0.5 rounded text-[9px]"
            style={{
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: 'rgba(139, 92, 246, 0.9)',
            }}
          >
            {data.contentSource}
          </span>
        )}
      </div>
    </div>
  )
}

export const PageNoteBody = memo(PageNoteBodyComponent)
