/**
 * PropertyOptionsEditor Component
 *
 * A modal/popover for editing property options (like Notion's property customization).
 * Allows users to:
 * - Add new options
 * - Edit option labels, colors, and icons
 * - Delete options
 * - Reorder options (future)
 *
 * Works with select, multi-select, status, and priority property types.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import {
  X, Plus, Trash2,
  // Common icons for quick selection
  Circle, Star, Flag, Tag, Check, AlertTriangle, Zap, Target, Clock, Calendar,
  type LucideIcon
} from 'lucide-react'
import type { PropertyDefinition, PropertyOption } from '@shared/types'
import { getMergedPropertyOptions, BUILTIN_PROPERTIES } from '../../constants/properties'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { ICON_MAP } from '../IconPicker'

// Quick icon selection - most commonly used for property options
const QUICK_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: 'circle', icon: Circle },
  { name: 'star', icon: Star },
  { name: 'flag', icon: Flag },
  { name: 'tag', icon: Tag },
  { name: 'check', icon: Check },
  { name: 'alert-triangle', icon: AlertTriangle },
  { name: 'zap', icon: Zap },
  { name: 'target', icon: Target },
  { name: 'clock', icon: Clock },
  { name: 'calendar', icon: Calendar },
]

// Preset colors for quick selection - same as node color picker for consistency
const PRESET_COLORS = [
  '#6b7280', // gray
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
]

interface PropertyOptionsEditorProps {
  definition: PropertyDefinition
  onClose: () => void
}

function PropertyOptionsEditorComponent({
  definition,
  onClose
}: PropertyOptionsEditorProps): JSX.Element {
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const addPropertyOption = useWorkspaceStore((state) => state.addPropertyOption)
  const updatePropertyOption = useWorkspaceStore((state) => state.updatePropertyOption)
  const deletePropertyOption = useWorkspaceStore((state) => state.deletePropertyOption)

  // Get current options (built-in merged with user-added)
  const builtinOptions = BUILTIN_PROPERTIES[definition.id]?.options || []
  const allOptions = getMergedPropertyOptions(definition.id, propertySchema) || []

  // State for new option
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [newOptionColor, setNewOptionColor] = useState(PRESET_COLORS[0])
  const [newOptionIcon, setNewOptionIcon] = useState<string | undefined>(undefined)
  const [editingOption, setEditingOption] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editIcon, setEditIcon] = useState<string | undefined>(undefined)

  const modalRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Check if an option is built-in (can't be deleted, but can be hidden/customized)
  const isBuiltinOption = useCallback((value: string): boolean => {
    return builtinOptions.some((o) => o.value === value)
  }, [builtinOptions])

  // Handle adding new option
  const handleAddOption = useCallback(() => {
    if (!newOptionLabel.trim()) return
    addPropertyOption(definition.id, {
      label: newOptionLabel.trim(),
      color: newOptionColor,
      icon: newOptionIcon
    })
    setNewOptionLabel('')
    setNewOptionColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
    setNewOptionIcon(undefined)
  }, [definition.id, newOptionLabel, newOptionColor, newOptionIcon, addPropertyOption])

  // Handle starting edit
  const handleStartEdit = useCallback((option: PropertyOption) => {
    setEditingOption(option.value)
    setEditLabel(option.label)
    setEditColor(option.color || '#6b7280')
    setEditIcon(option.icon)
  }, [])

  // Handle saving edit
  const handleSaveEdit = useCallback(() => {
    if (!editingOption || !editLabel.trim()) return
    updatePropertyOption(definition.id, editingOption, {
      label: editLabel.trim(),
      color: editColor,
      icon: editIcon
    })
    setEditingOption(null)
    setEditLabel('')
    setEditColor('')
    setEditIcon(undefined)
  }, [definition.id, editingOption, editLabel, editColor, editIcon, updatePropertyOption])

  // Handle delete option
  const handleDeleteOption = useCallback((value: string) => {
    deletePropertyOption(definition.id, value)
  }, [definition.id, deletePropertyOption])

  return (
    <div
      ref={modalRef}
      className="absolute z-[200] right-0 top-full mt-1 w-72 glass-fluid gui-panel-secondary border gui-border rounded-lg shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b gui-border">
        <span className="text-sm font-medium gui-text">
          Edit {definition.name} Options
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded gui-text-secondary hover:brightness-110"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Options list */}
      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
        {allOptions.map((option) => (
          <div
            key={option.value}
            className={`rounded hover:brightness-110 group ${editingOption === option.value ? 'gui-ring-active' : ''}`}
            style={{ backgroundColor: 'var(--gui-panel-bg-secondary)' }}
          >
            {editingOption === option.value ? (
              // Edit mode - expanded view
              <div className="p-2 space-y-2">
                {/* Label input row */}
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: editColor }}
                  >
                    {(() => {
                      const IconComponent = editIcon ? ICON_MAP[editIcon] : null
                      return IconComponent ? <IconComponent className="w-2.5 h-2.5 text-white" /> : null
                    })()}
                  </span>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') setEditingOption(null)
                    }}
                    className="flex-1 px-2 py-1 text-sm gui-input border rounded focus:outline-none focus:gui-border-active"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="px-2 py-1 text-xs rounded gui-accent"
                  >
                    Save
                  </button>
                </div>
                {/* Inline color swatches */}
                <div className="flex items-center gap-1 flex-wrap pl-6">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className="w-5 h-5 rounded-full transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        boxShadow: editColor === color ? '0 0 0 2px var(--gui-accent-primary)' : undefined
                      }}
                    />
                  ))}
                </div>
                {/* Inline icon selection */}
                <div className="flex items-center gap-1 flex-wrap pl-6">
                  <button
                    onClick={() => setEditIcon(undefined)}
                    className="w-5 h-5 rounded flex items-center justify-center transition-all gui-input border hover:scale-110"
                    style={{
                      borderColor: !editIcon ? 'var(--gui-accent-primary)' : undefined
                    }}
                    title="No icon"
                  >
                    <X className="w-3 h-3 opacity-50" />
                  </button>
                  {QUICK_ICONS.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      onClick={() => setEditIcon(name)}
                      className="w-5 h-5 rounded flex items-center justify-center transition-all gui-input border hover:scale-110"
                      style={{
                        borderColor: editIcon === name ? 'var(--gui-accent-primary)' : undefined
                      }}
                      title={name}
                    >
                      <Icon className="w-3 h-3" style={{ color: editColor }} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Display mode - single row
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span
                  className="w-4 h-4 rounded-full shrink-0 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: option.color || '#6b7280' }}
                  onClick={() => handleStartEdit(option)}
                  title="Click to edit"
                >
                  {(() => {
                    const IconComponent = option.icon ? ICON_MAP[option.icon] : null
                    return IconComponent ? <IconComponent className="w-2.5 h-2.5 text-white" /> : null
                  })()}
                </span>
                <span
                  className="flex-1 text-sm gui-text cursor-pointer"
                  onClick={() => handleStartEdit(option)}
                >
                  {option.label}
                </span>
                {isBuiltinOption(option.value) ? (
                  <span className="text-[10px] gui-text-secondary opacity-0 group-hover:opacity-100">
                    built-in
                  </span>
                ) : (
                  <button
                    onClick={() => handleDeleteOption(option.value)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-red-500 hover:brightness-110"
                    title="Delete option"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {allOptions.length === 0 && (
          <div className="text-center py-4 gui-text-secondary text-sm">
            No options defined
          </div>
        )}
      </div>

      {/* Add new option */}
      <div className="p-2 border-t gui-border space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
            style={{ backgroundColor: newOptionColor }}
          >
            {(() => {
              const IconComponent = newOptionIcon ? ICON_MAP[newOptionIcon] : null
              return IconComponent ? <IconComponent className="w-2.5 h-2.5 text-white" /> : null
            })()}
          </span>
          <input
            type="text"
            value={newOptionLabel}
            onChange={(e) => setNewOptionLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddOption()
            }}
            placeholder="New option..."
            className="flex-1 px-2 py-1.5 text-sm gui-input border rounded focus:outline-none focus:gui-border-active"
          />
          <button
            onClick={handleAddOption}
            disabled={!newOptionLabel.trim()}
            className="p-1.5 rounded disabled:opacity-30 gui-accent"
            title="Add option"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {/* Inline color swatches for new option */}
        <div className="flex items-center gap-1 flex-wrap pl-6">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setNewOptionColor(color)}
              className="w-5 h-5 rounded-full transition-all hover:scale-110"
              style={{
                backgroundColor: color,
                boxShadow: newOptionColor === color ? '0 0 0 2px var(--gui-accent-primary)' : undefined
              }}
            />
          ))}
        </div>
        {/* Inline icon selection for new option */}
        <div className="flex items-center gap-1 flex-wrap pl-6">
          <button
            onClick={() => setNewOptionIcon(undefined)}
            className="w-5 h-5 rounded flex items-center justify-center transition-all gui-input border hover:scale-110"
            style={{
              borderColor: !newOptionIcon ? 'var(--gui-accent-primary)' : undefined
            }}
            title="No icon"
          >
            <X className="w-3 h-3 opacity-50" />
          </button>
          {QUICK_ICONS.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => setNewOptionIcon(name)}
              className="w-5 h-5 rounded flex items-center justify-center transition-all gui-input border hover:scale-110"
              style={{
                borderColor: newOptionIcon === name ? 'var(--gui-accent-primary)' : undefined
              }}
              title={name}
            >
              <Icon className="w-3 h-3" style={{ color: newOptionColor }} />
            </button>
          ))}
        </div>
      </div>

      {/* Help text */}
      <div className="px-3 py-2 text-[10px] gui-text-secondary border-t gui-border">
        Click an option to edit. New options are saved to your workspace.
      </div>
    </div>
  )
}

export const PropertyOptionsEditor = memo(PropertyOptionsEditorComponent)
