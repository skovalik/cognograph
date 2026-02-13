/**
 * TagsDropdown Component
 *
 * A multi-select dropdown for tags following the unified inline edit pattern.
 * Features:
 * - Chips in trigger with × to remove
 * - Embedded search input in trigger
 * - Inline edit mode for tag name and color
 * - Toggle selection (stays open for multi-select)
 * - Create new tags with quick-create (Enter) or full edit flow
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import {
  ChevronLeft,
  Check,
  Pencil,
  Plus,
  X,
  Pipette
} from 'lucide-react'
import type { PropertyOption } from '@shared/types'

// Preset colors for quick selection (circles)
const PRESET_COLORS = [
  '#6b7280', // gray
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
]

type DropdownMode = 'closed' | 'selecting' | 'editing' | 'creating'

interface TagsDropdownProps {
  value: string[]
  options: PropertyOption[]
  onChange: (value: string[]) => void
  onCreateOption?: (option: { label: string; color?: string }) => string
  onUpdateOption?: (optionValue: string, updates: Partial<PropertyOption>) => void
  onDeleteOption?: (optionValue: string) => void
  disabled?: boolean
  placeholder?: string
  allowCreate?: boolean
  allowEdit?: boolean
}

function TagsDropdownComponent({
  value,
  options,
  onChange,
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
  disabled = false,
  placeholder = 'Add tags...',
  allowCreate = true,
  allowEdit = true
}: TagsDropdownProps): JSX.Element {
  // State machine
  const [mode, setMode] = useState<DropdownMode>('closed')
  const [editingOption, setEditingOption] = useState<PropertyOption | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // showColorPicker state reserved for inline color picker feature
  const [, setShowColorPicker] = useState(false)
  void setShowColorPicker

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

  // Get selected options
  const selectedOptions = options.filter((o) => value.includes(o.value))

  // Filter options by search (show all, including selected, so user can see/edit them)
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if search query matches any option exactly
  const queryMatchesOption = options.some(
    (o) => o.label.toLowerCase() === searchQuery.toLowerCase()
  )

  // Close on click outside
  useEffect(() => {
    if (mode === 'closed') return

    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mode])

  // Close on escape
  useEffect(() => {
    if (mode === 'closed') return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (mode === 'editing' || mode === 'creating') {
          handleBackToSelection()
        } else {
          handleClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mode])

  // Focus search input when opening selection mode
  useEffect(() => {
    if (mode === 'selecting' && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [mode])

  // Focus name input when entering edit mode
  useEffect(() => {
    if ((mode === 'editing' || mode === 'creating') && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [mode])

  const handleClose = useCallback(() => {
    setMode('closed')
    setSearchQuery('')
    setEditingOption(null)
    setShowDeleteConfirm(false)
    setShowColorPicker(false)
  }, [])

  const handleOpen = useCallback(() => {
    if (!disabled) {
      setMode('selecting')
    }
  }, [disabled])

  const handleToggle = useCallback(
    (optionValue: string) => {
      if (value.includes(optionValue)) {
        onChange(value.filter((v) => v !== optionValue))
      } else {
        onChange([...value, optionValue])
      }
      // Don't close - stay open for multi-select
    },
    [value, onChange]
  )

  const handleRemoveTag = useCallback(
    (optionValue: string, e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(value.filter((v) => v !== optionValue))
    },
    [value, onChange]
  )

  const handleStartEdit = useCallback((option: PropertyOption, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingOption(option)
    setEditName(option.label)
    setEditColor(option.color || '#6b7280')
    setMode('editing')
    setShowDeleteConfirm(false)
    setShowColorPicker(false)
  }, [])

  const handleStartCreate = useCallback(() => {
    setEditingOption(null)
    setEditName(searchQuery)
    setEditColor('#6b7280') // Default gray
    setMode('creating')
    setShowDeleteConfirm(false)
    setShowColorPicker(false)
  }, [searchQuery])

  const handleBackToSelection = useCallback(() => {
    setMode('selecting')
    setEditingOption(null)
    setShowDeleteConfirm(false)
    setShowColorPicker(false)
    setSearchQuery('')
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!editingOption || !onUpdateOption) return
    if (!editName.trim()) return

    onUpdateOption(editingOption.value, {
      label: editName.trim(),
      color: editColor
    })
    handleBackToSelection()
  }, [editingOption, editName, editColor, onUpdateOption, handleBackToSelection])

  const handleSaveCreate = useCallback(() => {
    if (!onCreateOption) return
    if (!editName.trim()) return

    const newValue = onCreateOption({
      label: editName.trim(),
      color: editColor
    })
    // Auto-select the new tag
    onChange([...value, newValue])
    handleBackToSelection()
  }, [editName, editColor, onCreateOption, onChange, value, handleBackToSelection])

  const handleQuickCreate = useCallback(() => {
    if (!searchQuery.trim() || !onCreateOption) return

    const newValue = onCreateOption({
      label: searchQuery.trim(),
      color: '#6b7280' // Default gray for quick create
    })
    // Auto-select the new tag
    onChange([...value, newValue])
    setSearchQuery('')
  }, [searchQuery, onCreateOption, onChange, value])

  const handleDeleteOption = useCallback(() => {
    if (!editingOption || !onDeleteOption) return
    onDeleteOption(editingOption.value)
    // Also remove from selection if selected
    if (value.includes(editingOption.value)) {
      onChange(value.filter((v) => v !== editingOption.value))
    }
    handleBackToSelection()
  }, [editingOption, onDeleteOption, value, onChange, handleBackToSelection])

  const handleColorPickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditColor(e.target.value)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger - shows chips and embedded search when open */}
      <div
        onClick={mode === 'closed' ? handleOpen : undefined}
        className={`min-h-[36px] w-full flex flex-wrap gap-1.5 items-center gui-input border rounded px-2 py-1.5 ${
          mode !== 'closed' ? 'gui-border-active' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {selectedOptions.map((opt) => (
          <span
            key={opt.value}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded"
            style={{
              backgroundColor: `${opt.color || '#6b7280'}30`,
              color: opt.color || '#6b7280'
            }}
          >
            {opt.label}
            <button
              type="button"
              onClick={(e) => handleRemoveTag(opt.value, e)}
              className="hover:opacity-70"
            >
              <X size={12} />
            </button>
          </span>
        ))}

        {mode === 'selecting' ? (
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery && !queryMatchesOption && allowCreate) {
                handleQuickCreate()
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder={selectedOptions.length === 0 ? placeholder : 'Search...'}
            className="flex-1 min-w-[60px] bg-transparent text-sm outline-none gui-text placeholder:gui-text-secondary"
          />
        ) : selectedOptions.length === 0 ? (
          <span className="text-sm gui-text-secondary">{placeholder}</span>
        ) : null}
      </div>

      {/* Dropdown */}
      {mode !== 'closed' && (
        <div
          className="absolute top-full left-0 right-0 mt-1 gui-panel-secondary glass-fluid border gui-border rounded-lg shadow-xl z-[100] overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {mode === 'selecting' ? (
            // Selection mode
            <>
              {/* Options list */}
              <div className="py-1 max-h-48 overflow-y-auto">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => {
                    const isSelected = value.includes(option.value)

                    return (
                      <div
                        key={option.value}
                        onClick={() => handleToggle(option.value)}
                        className={`flex items-center justify-between px-3 py-1.5 cursor-pointer group hover:brightness-110 ${
                          isSelected ? 'bg-[var(--gui-accent-primary)]/10' : ''
                        }`}
                        style={{ backgroundColor: isSelected ? undefined : 'var(--gui-panel-bg-secondary)' }}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5" style={{ color: 'var(--gui-accent-primary)' }} />
                          ) : (
                            <div className="w-3.5 h-3.5" />
                          )}
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: option.color || '#6b7280' }}
                          />
                          <span className="text-sm gui-text">{option.label}</span>
                        </div>
                        {allowEdit && (
                          <button
                            onClick={(e) => handleStartEdit(option, e)}
                            className="opacity-0 group-hover:opacity-100 gui-text-secondary hover:gui-text p-0.5"
                            title="Edit tag"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })
                ) : searchQuery ? (
                  <div className="px-3 py-2 text-sm gui-text-secondary">
                    No matching tags
                  </div>
                ) : (
                  <div className="px-3 py-2 text-sm gui-text-secondary">
                    No tags available
                  </div>
                )}
              </div>

              {/* Create new option */}
              {allowCreate && searchQuery && !queryMatchesOption && (
                <div className="border-t gui-border">
                  <button
                    onClick={handleStartCreate}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:brightness-110 text-left"
                    style={{ backgroundColor: 'var(--gui-panel-bg-secondary)' }}
                  >
                    <Plus className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
                    <span className="text-sm">
                      <span style={{ color: 'var(--gui-accent-primary)' }}>Create "</span>
                      <span className="gui-text">{searchQuery}</span>
                      <span style={{ color: 'var(--gui-accent-primary)' }}>"</span>
                    </span>
                  </button>
                </div>
              )}

              {/* Footer hint */}
              <div className="px-3 py-2 border-t gui-border">
                <span className="text-xs gui-text-secondary">Type to filter or create</span>
              </div>
            </>
          ) : (
            // Edit/Create mode
            <>
              {/* Back header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b gui-border gui-panel">
                <button
                  onClick={handleBackToSelection}
                  className="gui-text-secondary hover:gui-text"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm gui-text-secondary">
                  {mode === 'creating' ? 'New tag' : 'Edit tag'}
                </span>
              </div>

              {/* Edit form */}
              <div className="p-3 space-y-3">
                {/* Name input */}
                <div>
                  <label className="text-xs gui-text-secondary mb-1 block">Name</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        mode === 'creating' ? handleSaveCreate() : handleSaveEdit()
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full gui-input border rounded px-2.5 py-1.5 text-sm focus:gui-border-active"
                  />
                </div>

                {/* Color picker */}
                <div>
                  <label className="text-xs gui-text-secondary mb-1.5 block">Color</label>
                  <div className="flex flex-wrap gap-1.5 items-center">
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
                    {/* Custom color button */}
                    <button
                      onClick={() => colorInputRef.current?.click()}
                      className="w-5 h-5 rounded-full flex items-center justify-center gui-input border transition-all hover:scale-110"
                      style={{
                        backgroundColor: !PRESET_COLORS.includes(editColor) ? editColor : undefined,
                        boxShadow: !PRESET_COLORS.includes(editColor) ? '0 0 0 2px var(--gui-accent-primary)' : undefined
                      }}
                      title="Custom color"
                    >
                      <Pipette className="w-3 h-3 gui-text-secondary" />
                    </button>
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={editColor}
                      onChange={handleColorPickerChange}
                      className="sr-only"
                    />
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between px-3 py-2 border-t gui-border gui-panel">
                {mode === 'editing' && onDeleteOption && !showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                ) : mode === 'editing' && onDeleteOption && showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400">Delete?</span>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-xs gui-text-secondary hover:gui-text"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteOption}
                      className="text-xs text-red-400 hover:text-red-300 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div />
                )}
                <button
                  onClick={mode === 'creating' ? handleSaveCreate : handleSaveEdit}
                  disabled={!editName.trim()}
                  className="text-xs gui-accent disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 rounded"
                >
                  {mode === 'creating' ? 'Create' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export const TagsDropdown = memo(TagsDropdownComponent)
