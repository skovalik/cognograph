/**
 * UnifiedPropertyDropdown Component
 *
 * A unified dropdown that combines selection and editing into one component.
 * Three states: closed, selecting, editing
 *
 * - Closed: Shows current value with chevron
 * - Selecting: Shows options list with search, hover reveals edit pencil
 * - Editing: Inline edit form within the same dropdown (name, color, icon)
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Check,
  Pencil,
  Plus,
  X,
  // Quick icons for selection
  Circle,
  Star,
  Flag,
  Tag,
  AlertTriangle,
  Zap,
  Target,
  Clock,
  Calendar,
  type LucideIcon
} from 'lucide-react'
import type { PropertyOption } from '@shared/types'
import { ICON_MAP } from '../IconPicker'

// Quick icon selection for edit mode
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
  { name: 'calendar', icon: Calendar }
]

// Preset colors
const PRESET_COLORS = [
  '#6b7280', // gray
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899' // pink
]

type DropdownMode = 'closed' | 'selecting' | 'editing'

interface UnifiedPropertyDropdownProps {
  label?: string
  value: string
  options: PropertyOption[]
  onSelect: (optionValue: string) => void
  onCreateOption?: (option: { label: string; color?: string; icon?: string }) => void
  onUpdateOption?: (optionValue: string, updates: Partial<PropertyOption>) => void
  onDeleteOption?: (optionValue: string) => void
  placeholder?: string
  disabled?: boolean
  allowCreate?: boolean
  allowEdit?: boolean
}

function UnifiedPropertyDropdownComponent({
  label,
  value,
  options,
  onSelect,
  onCreateOption,
  onUpdateOption,
  onDeleteOption,
  placeholder = 'Select...',
  disabled = false,
  allowCreate = true,
  allowEdit = true
}: UnifiedPropertyDropdownProps): JSX.Element {
  // State machine
  const [mode, setMode] = useState<DropdownMode>('closed')
  const [editingOption, setEditingOption] = useState<PropertyOption | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editIcon, setEditIcon] = useState<string | undefined>(undefined)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Get selected option
  const selectedOption = options.find((o) => o.value === value)

  // Filter options by search
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if search query matches any option
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
        if (mode === 'editing') {
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
    if (mode === 'editing' && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [mode])

  const handleClose = useCallback(() => {
    setMode('closed')
    setSearchQuery('')
    setEditingOption(null)
    setShowDeleteConfirm(false)
  }, [])

  const handleOpen = useCallback(() => {
    if (!disabled) {
      setMode('selecting')
    }
  }, [disabled])

  const handleSelect = useCallback(
    (optionValue: string) => {
      onSelect(optionValue)
      handleClose()
    },
    [onSelect, handleClose]
  )

  const handleStartEdit = useCallback((option: PropertyOption, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingOption(option)
    setEditName(option.label)
    setEditColor(option.color || '#6b7280')
    setEditIcon(option.icon)
    setMode('editing')
    setShowDeleteConfirm(false)
  }, [])

  const handleBackToSelection = useCallback(() => {
    setMode('selecting')
    setEditingOption(null)
    setShowDeleteConfirm(false)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!editingOption || !onUpdateOption) return
    if (!editName.trim()) return

    onUpdateOption(editingOption.value, {
      label: editName.trim(),
      color: editColor,
      icon: editIcon
    })
    handleBackToSelection()
  }, [editingOption, editName, editColor, editIcon, onUpdateOption, handleBackToSelection])

  const handleDeleteOption = useCallback(() => {
    if (!editingOption || !onDeleteOption) return
    onDeleteOption(editingOption.value)
    handleBackToSelection()
  }, [editingOption, onDeleteOption, handleBackToSelection])

  const handleCreateOption = useCallback(() => {
    if (!searchQuery.trim() || !onCreateOption) return
    onCreateOption({
      label: searchQuery.trim(),
      color: '#6b7280'
    })
    setSearchQuery('')
  }, [searchQuery, onCreateOption])

  // Render selected option display
  const renderSelectedDisplay = (): JSX.Element => {
    if (selectedOption) {
      const IconComponent = selectedOption.icon ? ICON_MAP[selectedOption.icon] : null
      return (
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: selectedOption.color || '#6b7280' }}
          >
            {IconComponent && <IconComponent className="w-1.5 h-1.5 text-white" />}
          </div>
          <span className="text-sm">{selectedOption.label}</span>
        </div>
      )
    }
    return <span className="text-sm gui-text-secondary">{placeholder}</span>
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Label */}
      {label && <label className="gui-text-secondary text-xs mb-1 block">{label}</label>}

      {/* Trigger button */}
      <button
        type="button"
        onClick={mode === 'closed' ? handleOpen : handleClose}
        disabled={disabled}
        className={`w-full flex items-center justify-between gui-input border rounded px-3 py-2 hover:brightness-110 ${
          mode !== 'closed' ? 'gui-border-active' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {renderSelectedDisplay()}
        {mode === 'closed' ? (
          <ChevronDown className="w-4 h-4 gui-text-secondary" />
        ) : (
          <ChevronUp className="w-4 h-4 gui-text-secondary" />
        )}
      </button>

      {/* Dropdown */}
      {mode !== 'closed' && (
        <div
          className="absolute top-full left-0 right-0 mt-1 glass-fluid gui-panel-secondary border gui-border rounded-lg shadow-xl z-[100] overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {mode === 'selecting' ? (
            // Selection mode
            <>
              {/* Search/Create input */}
              {(allowCreate || options.length > 5) && (
                <div className="p-2 border-b gui-border">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery && !queryMatchesOption && allowCreate) {
                        handleCreateOption()
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Search or create..."
                    className="w-full gui-input border rounded px-2.5 py-1.5 text-sm focus:gui-border-active"
                  />
                </div>
              )}

              {/* Options list */}
              <div className="py-1 max-h-48 overflow-y-auto">
                {filteredOptions.map((option) => {
                  const isSelected = option.value === value
                  const IconComponent = option.icon ? ICON_MAP[option.icon] : null

                  return (
                    <div
                      key={option.value}
                      onClick={() => handleSelect(option.value)}
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer group hover:brightness-110 ${
                        isSelected ? 'bg-[var(--gui-accent-primary)]/10' : ''
                      }`}
                      style={{ backgroundColor: isSelected ? undefined : 'var(--gui-panel-bg-secondary)' }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: option.color || '#6b7280' }}
                        >
                          {IconComponent && <IconComponent className="w-1.5 h-1.5 text-white" />}
                        </div>
                        <span className="text-sm gui-text">{option.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isSelected && <Check className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />}
                        {allowEdit && (
                          <button
                            onClick={(e) => handleStartEdit(option, e)}
                            className="opacity-0 group-hover:opacity-100 gui-text-secondary hover:gui-text p-0.5 ml-1"
                            title="Edit option"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Create new option */}
                {allowCreate && searchQuery && !queryMatchesOption && (
                  <div
                    onClick={handleCreateOption}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:brightness-110"
                    style={{ backgroundColor: 'var(--gui-panel-bg-secondary)' }}
                  >
                    <Plus className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
                    <span className="text-sm" style={{ color: 'var(--gui-accent-primary)' }}>Create "{searchQuery}"</span>
                  </div>
                )}

                {filteredOptions.length === 0 && !searchQuery && (
                  <div className="px-3 py-4 text-center gui-text-secondary text-sm">
                    No options available
                  </div>
                )}
              </div>

            </>
          ) : (
            // Edit mode
            <>
              {/* Back header */}
              <div
                className="flex items-center gap-2 px-3 py-2 border-b gui-border gui-panel"
              >
                <button
                  onClick={handleBackToSelection}
                  className="gui-text-secondary hover:gui-text"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm gui-text-secondary">Edit option</span>
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
                      if (e.key === 'Enter') handleSaveEdit()
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full gui-input border rounded px-2.5 py-1.5 text-sm focus:gui-border-active"
                  />
                </div>

                {/* Color picker */}
                <div>
                  <label className="text-xs gui-text-secondary mb-1.5 block">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditColor(color)}
                        className="w-6 h-6 rounded transition-all"
                        style={{
                          backgroundColor: color,
                          boxShadow: editColor === color ? '0 0 0 2px var(--gui-accent-primary)' : undefined
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon picker */}
                <div>
                  <label className="text-xs gui-text-secondary mb-1.5 block">Icon (optional)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {/* No icon option */}
                    <button
                      onClick={() => setEditIcon(undefined)}
                      className="w-6 h-6 rounded gui-input border flex items-center justify-center"
                      style={{
                        borderColor: !editIcon ? 'var(--gui-accent-primary)' : undefined
                      }}
                    >
                      <X className="w-3 h-3 opacity-50" />
                    </button>
                    {QUICK_ICONS.map(({ name, icon: Icon }) => (
                      <button
                        key={name}
                        onClick={() => setEditIcon(name)}
                        className="w-6 h-6 rounded gui-input border flex items-center justify-center"
                        style={{
                          borderColor: editIcon === name ? 'var(--gui-accent-primary)' : undefined
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: editColor }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div
                className="flex items-center justify-between px-3 py-2 border-t gui-border gui-panel"
              >
                {onDeleteOption && !showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                ) : onDeleteOption && showDeleteConfirm ? (
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
                  onClick={handleSaveEdit}
                  disabled={!editName.trim()}
                  className="text-xs gui-accent disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 rounded"
                >
                  Save
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export const UnifiedPropertyDropdown = memo(UnifiedPropertyDropdownComponent)
