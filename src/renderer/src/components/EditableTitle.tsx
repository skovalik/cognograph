/**
 * EditableTitle Component
 *
 * An inline-editable title component for nodes.
 * - Double-click to enter edit mode
 * - Enter or blur to save
 * - Escape to cancel
 *
 * Used across all node types for inline title editing.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { FormattedText } from './FormattedText'

interface EditableTitleProps {
  value: string
  onChange: (newValue: string) => void
  className?: string
  placeholder?: string
}

function EditableTitleComponent({
  value,
  onChange,
  className = '',
  placeholder = 'Untitled'
}: EditableTitleProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync edit value when prop changes (while not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value)
    }
  }, [value, isEditing])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Enter edit mode on double-click
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsEditing(true)
    setEditValue(value)
  }, [value])

  // Save changes
  const handleSave = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== value) {
      onChange(trimmed)
    }
    setIsEditing(false)
  }, [editValue, value, onChange])

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditValue(value)
    setIsEditing(false)
  }, [value])

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }, [handleSave, handleCancel])

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }, [])

  // Handle blur - save changes
  const handleBlur = useCallback(() => {
    handleSave()
  }, [handleSave])

  // Stop click propagation when editing to prevent node selection changes
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation()
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={handleClick}
        spellCheck={true}
        className={`${className} bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1`}
        style={{
          color: 'inherit',
          font: 'inherit',
          width: '100%'
        }}
        placeholder={placeholder}
      />
    )
  }

  return (
    <FormattedText
      text={value || placeholder}
      className={`${className} cursor-text`}
      style={!value ? { opacity: 0.5, fontStyle: 'italic' } : undefined}
      onDoubleClick={handleDoubleClick}
    />
  )
}

export const EditableTitle = memo(EditableTitleComponent)
