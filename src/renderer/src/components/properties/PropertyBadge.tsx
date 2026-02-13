import { memo } from 'react'
import {
  Tag,
  Flag,
  Circle,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react'
import type { PropertyDefinition, PropertyOption } from '@shared/types'
import { ICON_MAP } from '../IconPicker'
import { getMergedPropertyOptions } from '../../constants/properties'
import { useWorkspaceStore } from '../../stores/workspaceStore'

// -----------------------------------------------------------------------------
// PropertyBadge Component
// -----------------------------------------------------------------------------

interface PropertyBadgeProps {
  definition: PropertyDefinition
  value: unknown
  compact?: boolean
  onCycle?: (propertyId: string, newValue: string) => void
}

export const PropertyBadge = memo(function PropertyBadge({
  definition,
  value,
  compact = false,
  onCycle
}: PropertyBadgeProps) {
  // Get propertySchema to access user-customized options
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)

  if (value === undefined || value === null || value === '') return null

  // Get merged options (user customizations + built-in defaults)
  const mergedOptions = getMergedPropertyOptions(definition.id, propertySchema) || definition.options || []

  // Render based on property type
  switch (definition.type) {
    case 'status':
    case 'priority':
    case 'select':
      return (
        <SelectBadge
          options={mergedOptions}
          value={value as string}
          compact={compact}
          type={definition.type}
          onCycle={onCycle ? (newValue) => onCycle(definition.id, newValue) : undefined}
        />
      )

    case 'multi-select':
      return (
        <MultiSelectBadge
          options={mergedOptions}
          values={(value as string[]) || []}
          compact={compact}
        />
      )

    case 'checkbox':
      return <CheckboxBadge checked={value as boolean} label={definition.name} compact={compact} />

    case 'date':
    case 'datetime':
      return <DateBadge date={value as string | number} compact={compact} />

    default:
      // For text, number, etc. - don't show badges (too noisy)
      return null
  }
})

// -----------------------------------------------------------------------------
// Select Badge (status, priority, single select)
// -----------------------------------------------------------------------------

interface SelectBadgeProps {
  options: PropertyOption[]
  value: string
  compact: boolean
  type: string
  onCycle?: (newValue: string) => void
}

const SelectBadge = memo(function SelectBadge({
  options,
  value,
  compact,
  type,
  onCycle
}: SelectBadgeProps) {
  const option = options.find((o) => o.value === value)
  if (!option) return null

  // Get icon - prefer option's custom icon, fallback to type-based icon
  const CustomIcon = option.icon ? ICON_MAP[option.icon] : null
  const DefaultIcon = type === 'status' ? Circle : type === 'priority' ? Flag : Tag
  const Icon = CustomIcon || DefaultIcon

  const handleClick = onCycle ? (e: React.MouseEvent) => {
    e.stopPropagation()
    const currentIndex = options.findIndex((o) => o.value === value)
    const nextIndex = (currentIndex + 1) % options.length
    const nextOption = options[nextIndex]
    if (nextOption) onCycle(nextOption.value)
  } : undefined

  return (
    <span
      onClick={handleClick}
      onMouseDown={onCycle ? (e) => e.stopPropagation() : undefined}
      className={`inline-flex items-center gap-1 rounded-full font-medium ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      } ${onCycle ? 'cursor-pointer hover:brightness-125 transition-all' : ''}`}
      style={{
        backgroundColor: option.color ? `${option.color}30` : 'rgba(255,255,255,0.15)',
        color: option.color || 'inherit'
      }}
      title={onCycle ? `Click to cycle ${type}` : undefined}
    >
      <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {option.label}
    </span>
  )
})

// -----------------------------------------------------------------------------
// Multi-Select Badge
// -----------------------------------------------------------------------------

interface MultiSelectBadgeProps {
  options: PropertyOption[]
  values: string[]
  compact: boolean
}

const MultiSelectBadge = memo(function MultiSelectBadge({
  options,
  values,
  compact
}: MultiSelectBadgeProps) {
  if (values.length === 0) return null

  // Show first few tags, then "+N more"
  const maxVisible = compact ? 2 : 3
  const visibleValues = values.slice(0, maxVisible)
  const hiddenCount = values.length - maxVisible

  return (
    <div className="flex flex-wrap gap-1">
      {visibleValues.map((val) => {
        const option = options.find((o) => o.value === val)
        if (!option) {
          // For user-created tags that don't have option definitions
          return (
            <span
              key={val}
              className={`inline-flex items-center gap-1 rounded-full font-medium bg-[var(--surface-panel-secondary)] ${
                compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
              }`}
            >
              <Tag className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              {val}
            </span>
          )
        }
        // Get icon - prefer option's custom icon, fallback to Tag
        const CustomIcon = option.icon ? ICON_MAP[option.icon] : null
        const Icon = CustomIcon || Tag
        return (
          <span
            key={val}
            className={`inline-flex items-center gap-1 rounded-full font-medium ${
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
            }`}
            style={{
              backgroundColor: option.color ? `${option.color}30` : 'rgba(255,255,255,0.15)',
              color: option.color || 'inherit'
            }}
          >
            <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {option.label}
          </span>
        )
      })}
      {hiddenCount > 0 && (
        <span
          className={`text-[var(--text-muted)] ${compact ? 'text-[10px]' : 'text-xs'}`}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  )
})

// -----------------------------------------------------------------------------
// Checkbox Badge
// -----------------------------------------------------------------------------

interface CheckboxBadgeProps {
  checked: boolean
  label: string
  compact: boolean
}

const CheckboxBadge = memo(function CheckboxBadge({
  checked,
  label,
  compact
}: CheckboxBadgeProps) {
  const Icon = checked ? CheckCircle2 : XCircle
  const color = checked ? '#22c55e' : '#6b7280'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
      style={{
        backgroundColor: `${color}30`,
        color
      }}
    >
      <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {label}
    </span>
  )
})

// -----------------------------------------------------------------------------
// Date Badge
// -----------------------------------------------------------------------------

interface DateBadgeProps {
  date: string | number
  compact: boolean
}

const DateBadge = memo(function DateBadge({ date, compact }: DateBadgeProps) {
  const dateObj = typeof date === 'number' ? new Date(date) : new Date(date)
  if (isNaN(dateObj.getTime())) return null

  const now = new Date()
  const isOverdue = dateObj < now
  const isToday =
    dateObj.getDate() === now.getDate() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getFullYear() === now.getFullYear()

  let color = '#6b7280' // default gray
  if (isOverdue) color = '#ef4444' // red for overdue
  else if (isToday) color = '#f59e0b' // amber for today

  const Icon = isOverdue ? Clock : Calendar

  // Format date as short string
  const formatted = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
      style={{
        backgroundColor: `${color}30`,
        color
      }}
    >
      <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {formatted}
    </span>
  )
})

// -----------------------------------------------------------------------------
// PropertyBadges Container
// -----------------------------------------------------------------------------

interface PropertyBadgesProps {
  properties: Record<string, unknown>
  definitions: PropertyDefinition[]
  compact?: boolean
  maxVisible?: number
  hiddenProperties?: string[]
  onPropertyChange?: (propertyId: string, newValue: string) => void
}

export const PropertyBadges = memo(function PropertyBadges({
  properties,
  definitions,
  compact = false,
  maxVisible = 6,
  showLabel = false,
  hiddenProperties,
  onPropertyChange
}: PropertyBadgesProps & { showLabel?: boolean }) {
  // Filter to only showInCard properties that have values and aren't hidden
  const visibleProps = definitions
    .filter((def) => def.showInCard && properties[def.id] !== undefined && properties[def.id] !== null && !hiddenProperties?.includes(def.id))
    .slice(0, maxVisible)

  if (visibleProps.length === 0) return null

  // Separate multi-select (tags) from single-value badges
  const tagProps = visibleProps.filter((def) => def.type === 'multi-select')
  const badgeProps = visibleProps.filter((def) => def.type !== 'multi-select')

  return (
    <div className="property-badges flex flex-col gap-1.5">
      {showLabel && (
        <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Properties</div>
      )}
      {/* Tags in their own row */}
      {tagProps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tagProps.map((def) => (
            <PropertyBadge
              key={def.id}
              definition={def}
              value={properties[def.id]}
              compact={compact}
            />
          ))}
        </div>
      )}
      {/* Other badges (status, priority, complexity, dates) in a row */}
      {badgeProps.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {badgeProps.map((def) => (
            <PropertyBadge
              key={def.id}
              definition={def}
              value={properties[def.id]}
              compact={compact}
              onCycle={onPropertyChange}
            />
          ))}
        </div>
      )}
    </div>
  )
})
