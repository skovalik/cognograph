/**
 * EditableText Component
 *
 * An inline-editable multiline text component for nodes.
 * - Double-click to enter edit mode
 * - Click outside or blur to save
 * - Escape to cancel
 *
 * Used for node descriptions and other multiline content.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'

interface EditableTextProps {
  value: string
  onChange: (newValue: string) => void
  className?: string
  placeholder?: string
  maxRows?: number
}

function EditableTextComponent({
  value,
  onChange,
  className = '',
  placeholder = 'No description',
  maxRows: _maxRows = 4
}: EditableTextProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync edit value when prop changes (while not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value)
    }
  }, [value, isEditing])

  // Focus textarea when entering edit mode and auto-resize
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
      // Auto-resize to content
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [isEditing])

  // Auto-resize textarea as content changes
  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [])

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
    if (trimmed !== value) {
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
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
    // Note: Enter creates new line in textarea, so we don't save on Enter
    // User saves by clicking outside (blur)
  }, [handleCancel])

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value)
    autoResize()
  }, [autoResize])

  // Handle blur - save changes
  const handleBlur = useCallback(() => {
    handleSave()
  }, [handleSave])

  // Stop propagation when editing to prevent node selection changes
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation()
    }
  }, [isEditing])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation()
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        spellCheck={true}
        className={`${className} bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1 resize-none overflow-hidden`}
        style={{
          color: 'inherit',
          font: 'inherit',
          width: '100%',
          minHeight: '1.5em'
        }}
        placeholder={placeholder}
        rows={1}
      />
    )
  }

  return (
    <p
      className={`${className} cursor-text`}
      style={!value ? { color: 'var(--node-text-muted)', fontStyle: 'italic' } : undefined}
      onDoubleClick={handleDoubleClick}
    >
      {value || placeholder}
    </p>
  )
}

export const EditableText = memo(EditableTextComponent)
