/**
 * InlineIconPicker Component
 *
 * An inline icon picker for use directly on nodes.
 * Click the icon to open a dropdown with color circles and icon selection.
 */

import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  MessageSquare,
  Folder,
  FileText,
  CheckSquare,
  Code,
  Boxes,
  type LucideIcon
} from 'lucide-react'
import { ICON_MAP } from './IconPicker'
import type { NodeData } from '@shared/types'

// Default icons for each node type (imported directly since they may not be in ICON_MAP)
const DEFAULT_NODE_ICONS: Record<string, LucideIcon> = {
  conversation: MessageSquare,
  project: Folder,
  note: FileText,
  task: CheckSquare,
  artifact: Code,
  workspace: Boxes
}

// Icon categories (subset for inline picker - most useful ones)
const ICON_CATEGORIES = {
  'General': ['star', 'heart', 'bookmark', 'flag', 'tag', 'pin'],
  'Status': ['check', 'check-circle', 'alert-circle', 'alert-triangle', 'info', 'help-circle'],
  'Actions': ['zap', 'rocket', 'target', 'trophy', 'medal', 'award'],
  'Objects': ['lightbulb', 'key', 'lock', 'unlock', 'shield', 'eye'],
  'Communication': ['message-square', 'message-circle', 'mail', 'bell', 'megaphone', 'mic'],
  'Documents': ['file-text', 'file', 'files', 'folder', 'folder-open', 'archive'],
  'Code/Tech': ['code', 'terminal', 'cpu', 'database', 'server', 'cloud'],
  'Time': ['clock', 'calendar', 'timer', 'history', 'hourglass'],
  'People': ['user', 'users', 'user-plus', 'user-check', 'crown'],
  'Nature': ['sun', 'moon', 'cloud-sun', 'leaf', 'flower', 'tree'],
  'Shapes': ['circle', 'square', 'triangle', 'hexagon', 'octagon', 'pentagon'],
  'Misc': ['sparkles', 'flame', 'gem', 'gift', 'music', 'camera'],
} as const

// Preset colors for quick selection
const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
  '#ffffff', // white
]

// Default icon names for display in picker (these map to ICON_MAP keys)
// Reserved for potential future use
/* const DEFAULT_ICON_NAMES: Record<string, string> = {
  conversation: 'message-square',
  project: 'folder',
  note: 'file-text',
  task: 'check',
  artifact: 'code',
  workspace: 'database'
} */

interface InlineIconPickerProps {
  nodeData: NodeData
  nodeColor: string // The node's theme color (used as default icon color)
  onIconChange: (icon: string | undefined) => void
  onIconColorChange: (color: string | undefined) => void
  className?: string
}

function InlineIconPickerComponent({
  nodeData,
  nodeColor,
  onIconChange,
  onIconColorChange,
  className = 'w-5 h-5'
}: InlineIconPickerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Get current icon and color
  const currentIconName = (nodeData as { icon?: string }).icon
  const currentIconColor = (nodeData as { iconColor?: string }).iconColor || nodeColor

  // Get the default icon component directly (not from ICON_MAP since some aren't in it)
  const DefaultIcon = DEFAULT_NODE_ICONS[nodeData.type] || FileText

  // Get the icon component - use custom icon from ICON_MAP, or fall back to default
  const IconComponent = currentIconName && ICON_MAP[currentIconName]
    ? ICON_MAP[currentIconName]
    : DefaultIcon

  // Filter icons based on search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return ICON_CATEGORIES

    const term = searchTerm.toLowerCase()
    const filtered: Record<string, string[]> = {}

    Object.entries(ICON_CATEGORIES).forEach(([category, icons]) => {
      const matchedIcons = icons.filter((name) => name.includes(term))
      if (matchedIcons.length > 0) {
        filtered[category] = matchedIcons
      }
    })

    return filtered
  }, [searchTerm])

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const dropdownHeight = 350 // approximate max height
      const dropdownWidth = 260

      // Position below trigger by default, flip up if too close to bottom
      const flipUp = rect.bottom + 4 + dropdownHeight > window.innerHeight
      const top = flipUp ? Math.max(4, rect.top - dropdownHeight - 4) : rect.bottom + 4
      const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8)

      setDropdownPosition({ top, left })
    }
  }, [isOpen])

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Focus search when opening
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [isOpen])

  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen(!isOpen)
  }, [isOpen])

  const handleSelectIcon = useCallback((iconName: string) => {
    onIconChange(iconName)
    setIsOpen(false)
    setSearchTerm('')
  }, [onIconChange])

  const handleSelectColor = useCallback((color: string) => {
    onIconColorChange(color === nodeColor ? undefined : color)
  }, [onIconColorChange, nodeColor])

  const handleClearIcon = useCallback(() => {
    onIconChange(undefined)
    onIconColorChange(undefined)
    setIsOpen(false)
    setSearchTerm('')
  }, [onIconChange, onIconColorChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
    }
  }, [])

  return (
    <div className="relative">
      {/* Clickable icon */}
      <button
        ref={triggerRef}
        onClick={handleIconClick}
        onMouseDown={(e) => e.stopPropagation()}
        className={`${className} flex-shrink-0 hover:opacity-70 transition-opacity cursor-pointer`}
        title="Click to change icon"
      >
        {IconComponent && <IconComponent className="w-full h-full" style={{ color: currentIconColor }} />}
      </button>

      {/* Dropdown - rendered via portal to avoid overflow clipping */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-lg shadow-xl p-2"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: 260
          }}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Color circles */}
          <div className="mb-2">
            <div className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase">Color</div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleSelectColor(color)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    currentIconColor === color || (color === nodeColor && !currentIconColor)
                      ? 'border-white scale-110'
                      : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              {/* Node color option */}
              <button
                onClick={() => handleSelectColor(nodeColor)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  !currentIconColor || currentIconColor === nodeColor
                    ? 'border-white scale-110'
                    : 'border-transparent hover:scale-110'
                }`}
                style={{
                  backgroundColor: nodeColor,
                  boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.3)'
                }}
                title="Node color (default)"
              />
            </div>
          </div>

          {/* Search */}
          <input
            ref={searchRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search icons..."
            className="w-full bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] mb-2 focus:outline-none focus:border-blue-500"
          />

          {/* Icons grid */}
          <div className="max-h-48 overflow-y-auto">
            {Object.entries(filteredCategories).map(([category, icons]) => (
              <div key={category} className="mb-2">
                <div className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase">{category}</div>
                <div className="flex flex-wrap gap-1">
                  {icons.map((name) => {
                    const Icon = ICON_MAP[name]
                    if (!Icon) return null
                    return (
                      <button
                        key={name}
                        onClick={() => handleSelectIcon(name)}
                        className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                          currentIconName === name
                            ? 'bg-blue-600 ring-2 ring-blue-400'
                            : 'hover:bg-[var(--surface-panel-secondary)]'
                        }`}
                        title={name}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{ color: currentIconName === name ? currentIconColor : '#9ca3af' }}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {Object.keys(filteredCategories).length === 0 && (
              <div className="text-center py-4 text-[var(--text-secondary)] text-xs">
                No icons found
              </div>
            )}
          </div>

          {/* Clear button */}
          {currentIconName && (
            <button
              onClick={handleClearIcon}
              className="w-full mt-2 px-2 py-1 rounded text-xs flex items-center justify-center gap-1 bg-[var(--surface-panel-secondary)] hover:bg-[var(--surface-panel)] text-[var(--text-secondary)] transition-colors"
            >
              <X className="w-3 h-3" />
              Reset to default
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export const InlineIconPicker = memo(InlineIconPickerComponent)
