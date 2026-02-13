import { useState, useCallback, useRef, useEffect, memo } from 'react'
import {
  Plus,
  Tag,
  Flag,
  Circle,
  Calendar,
  User,
  Link,
  MessageCircle,
  Zap,
  Hash,
  AlignLeft,
  CheckSquare,
  Clock,
  Mail,
  Type,
  ChevronRight,
  Trash2,
  Pencil
} from 'lucide-react'
import type { PropertyDefinition, NodeData } from '@shared/types'
import { BUILTIN_PROPERTIES, PROPERTY_TYPE_LABELS } from '../../constants/properties'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { toast } from 'react-hot-toast'

// -----------------------------------------------------------------------------
// Icon Lookup
// -----------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Tag,
  Flag,
  Circle,
  Calendar,
  User,
  Link,
  MessageCircle,
  Zap,
  Hash,
  AlignLeft,
  CheckSquare,
  Clock,
  Mail,
  Type
}

function getPropertyIcon(iconName?: string): React.ComponentType<{ className?: string }> {
  return iconName && ICON_MAP[iconName] ? ICON_MAP[iconName] : Type
}

// -----------------------------------------------------------------------------
// AddPropertyPopover Component
// -----------------------------------------------------------------------------

interface AddPropertyPopoverProps {
  nodeType: NodeData['type']
  currentPropertyIds: string[]
  onAddProperty: (propertyId: string) => void
  onCreateCustom: () => void
  onEditCustom?: (property: PropertyDefinition) => void
}

export const AddPropertyPopover = memo(function AddPropertyPopover({
  nodeType: _nodeType, // Reserved for future filtering by node type
  currentPropertyIds,
  onAddProperty,
  onCreateCustom,
  onEditCustom
}: AddPropertyPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const deleteCustomProperty = useWorkspaceStore((state) => state.deleteCustomProperty)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Get all available properties (built-in + custom) that aren't already added
  const availableProperties = useCallback(() => {
    const allProperties: PropertyDefinition[] = [
      ...Object.values(BUILTIN_PROPERTIES),
      ...propertySchema.customProperties
    ]

    return allProperties.filter((prop) => {
      // Filter out already added properties
      if (currentPropertyIds.includes(prop.id)) return false
      // Filter by search
      if (search && !prop.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [currentPropertyIds, propertySchema.customProperties, search])

  const handleSelect = useCallback(
    (propertyId: string) => {
      onAddProperty(propertyId)
      setIsOpen(false)
      setSearch('')
    },
    [onAddProperty]
  )

  const handleCreateCustom = useCallback(() => {
    onCreateCustom()
    setIsOpen(false)
    setSearch('')
  }, [onCreateCustom])

  const handleDeleteCustomProperty = useCallback((e: React.MouseEvent, propertyId: string, propertyName: string) => {
    e.stopPropagation()
    if (confirm(`Delete custom property "${propertyName}"? This will remove it from all node types.`)) {
      deleteCustomProperty(propertyId)
      toast.success(`Property "${propertyName}" deleted`)
    }
  }, [deleteCustomProperty])

  const handleEditCustomProperty = useCallback((e: React.MouseEvent, property: PropertyDefinition) => {
    e.stopPropagation()
    if (onEditCustom) {
      onEditCustom(property)
      setIsOpen(false)
    }
  }, [onEditCustom])

  const properties = availableProperties()
  const builtinProps = properties.filter((p) => p.id in BUILTIN_PROPERTIES)
  const customProps = properties.filter((p) => !(p.id in BUILTIN_PROPERTIES))

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
      >
        <Plus className="w-3 h-3" />
        Add property
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 mt-1 w-64 bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-lg shadow-xl z-50"
        >
          {/* Search */}
          <div className="p-2 border-b border-[var(--border-subtle)]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search properties..."
              autoFocus
              className="w-full bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Property List */}
          <div className="max-h-64 overflow-y-auto p-1">
            {/* Built-in Properties */}
            {builtinProps.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-[var(--text-muted)] uppercase">
                  Built-in
                </div>
                {builtinProps.map((prop) => {
                  const Icon = getPropertyIcon(prop.icon)
                  return (
                    <button
                      key={prop.id}
                      onClick={() => handleSelect(prop.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
                    >
                      <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                      <span className="flex-1">{prop.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {PROPERTY_TYPE_LABELS[prop.type] || prop.type}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Custom Properties (User-Made) */}
            {customProps.length > 0 && (
              <div className="mt-1">
                <div className="px-2 py-1 text-xs font-medium text-[var(--text-muted)] uppercase">
                  User-Made
                </div>
                {customProps.map((prop) => {
                  const Icon = getPropertyIcon(prop.icon)
                  return (
                    <div
                      key={prop.id}
                      className="group flex items-center gap-2 px-2 py-1.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
                    >
                      <button
                        onClick={() => handleSelect(prop.id)}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        <Icon className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                        <span className="flex-1 truncate">{prop.name}</span>
                      </button>
                      <span className="text-xs text-[var(--text-muted)] group-hover:hidden">
                        {PROPERTY_TYPE_LABELS[prop.type] || prop.type}
                      </span>
                      {/* Edit/Delete icons on hover */}
                      <div className="hidden group-hover:flex items-center gap-1">
                        {onEditCustom && (
                          <button
                            onClick={(e) => handleEditCustomProperty(e, prop)}
                            className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
                            title="Edit property"
                          >
                            <Pencil className="w-3 h-3 text-blue-400" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteCustomProperty(e, prop.id, prop.name)}
                          className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
                          title="Delete property"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* No Results */}
            {properties.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
                {search ? 'No matching properties' : 'All properties added'}
              </div>
            )}
          </div>

          {/* Create Custom */}
          <div className="p-1 border-t border-[var(--border-subtle)]">
            <button
              onClick={handleCreateCustom}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm text-blue-400 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="flex-1">Create custom property</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
