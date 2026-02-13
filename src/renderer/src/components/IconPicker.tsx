/**
 * IconPicker Component
 *
 * A compact icon picker for selecting custom node icons.
 * Uses Lucide icons with categories for easy browsing.
 */

import { memo, useState, useCallback, useMemo } from 'react'
import {
  // Default/Clear
  X,
  // General
  Star, Heart, Bookmark, Flag, Tag, Pin,
  // Status
  Check, CheckCircle, AlertCircle, AlertTriangle, Info, HelpCircle,
  // Actions
  Zap, Rocket, Target, Trophy, Medal, Award,
  // Objects
  Lightbulb, Key, Lock, Unlock, Shield, Eye,
  // Communication
  MessageSquare, MessageCircle, Mail, Bell, Megaphone, Mic,
  // Documents
  FileText, File, Files, Folder, FolderOpen, Archive,
  // Code/Tech
  Code, Terminal, Cpu, Database, Server, Cloud,
  // Navigation
  Home, Map, Compass, Navigation, Globe, Search,
  // Time
  Clock, Calendar, Timer, History, Hourglass,
  // People
  User, Users, UserPlus, UserCheck, Crown,
  // Nature
  Sun, Moon, CloudSun, Leaf, Flower2, TreePine,
  // Shapes
  Circle, Square, Triangle, Hexagon, Octagon, Pentagon,
  // Misc
  Sparkles, Flame, Gem, Gift, Music, Camera,
  type LucideIcon
} from 'lucide-react'

// Icon categories with their icons
const ICON_CATEGORIES = {
  'General': [
    { name: 'star', icon: Star },
    { name: 'heart', icon: Heart },
    { name: 'bookmark', icon: Bookmark },
    { name: 'flag', icon: Flag },
    { name: 'tag', icon: Tag },
    { name: 'pin', icon: Pin },
  ],
  'Status': [
    { name: 'check', icon: Check },
    { name: 'check-circle', icon: CheckCircle },
    { name: 'alert-circle', icon: AlertCircle },
    { name: 'alert-triangle', icon: AlertTriangle },
    { name: 'info', icon: Info },
    { name: 'help-circle', icon: HelpCircle },
  ],
  'Actions': [
    { name: 'zap', icon: Zap },
    { name: 'rocket', icon: Rocket },
    { name: 'target', icon: Target },
    { name: 'trophy', icon: Trophy },
    { name: 'medal', icon: Medal },
    { name: 'award', icon: Award },
  ],
  'Objects': [
    { name: 'lightbulb', icon: Lightbulb },
    { name: 'key', icon: Key },
    { name: 'lock', icon: Lock },
    { name: 'unlock', icon: Unlock },
    { name: 'shield', icon: Shield },
    { name: 'eye', icon: Eye },
  ],
  'Communication': [
    { name: 'message-square', icon: MessageSquare },
    { name: 'message-circle', icon: MessageCircle },
    { name: 'mail', icon: Mail },
    { name: 'bell', icon: Bell },
    { name: 'megaphone', icon: Megaphone },
    { name: 'mic', icon: Mic },
  ],
  'Documents': [
    { name: 'file-text', icon: FileText },
    { name: 'file', icon: File },
    { name: 'files', icon: Files },
    { name: 'folder', icon: Folder },
    { name: 'folder-open', icon: FolderOpen },
    { name: 'archive', icon: Archive },
  ],
  'Code/Tech': [
    { name: 'code', icon: Code },
    { name: 'terminal', icon: Terminal },
    { name: 'cpu', icon: Cpu },
    { name: 'database', icon: Database },
    { name: 'server', icon: Server },
    { name: 'cloud', icon: Cloud },
  ],
  'Navigation': [
    { name: 'home', icon: Home },
    { name: 'map', icon: Map },
    { name: 'compass', icon: Compass },
    { name: 'navigation', icon: Navigation },
    { name: 'globe', icon: Globe },
    { name: 'search', icon: Search },
  ],
  'Time': [
    { name: 'clock', icon: Clock },
    { name: 'calendar', icon: Calendar },
    { name: 'timer', icon: Timer },
    { name: 'history', icon: History },
    { name: 'hourglass', icon: Hourglass },
  ],
  'People': [
    { name: 'user', icon: User },
    { name: 'users', icon: Users },
    { name: 'user-plus', icon: UserPlus },
    { name: 'user-check', icon: UserCheck },
    { name: 'crown', icon: Crown },
  ],
  'Nature': [
    { name: 'sun', icon: Sun },
    { name: 'moon', icon: Moon },
    { name: 'cloud-sun', icon: CloudSun },
    { name: 'leaf', icon: Leaf },
    { name: 'flower', icon: Flower2 },
    { name: 'tree', icon: TreePine },
  ],
  'Shapes': [
    { name: 'circle', icon: Circle },
    { name: 'square', icon: Square },
    { name: 'triangle', icon: Triangle },
    { name: 'hexagon', icon: Hexagon },
    { name: 'octagon', icon: Octagon },
    { name: 'pentagon', icon: Pentagon },
  ],
  'Misc': [
    { name: 'sparkles', icon: Sparkles },
    { name: 'flame', icon: Flame },
    { name: 'gem', icon: Gem },
    { name: 'gift', icon: Gift },
    { name: 'music', icon: Music },
    { name: 'camera', icon: Camera },
  ],
} as const

// Map icon names to components for rendering
const ICON_MAP: Record<string, LucideIcon> = {}
Object.values(ICON_CATEGORIES).forEach(icons => {
  icons.forEach(({ name, icon }) => {
    ICON_MAP[name] = icon
  })
})

// Export the icon map for use in other components
export { ICON_MAP }

interface IconPickerProps {
  value?: string // Current icon name
  onChange: (iconName: string | undefined) => void
  color?: string // Icon color
}

function IconPickerComponent({
  value,
  onChange,
  color = '#6b7280'
}: IconPickerProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Get current icon component
  const CurrentIcon = value ? ICON_MAP[value] : null

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!searchTerm) {
      return selectedCategory
        ? { [selectedCategory]: ICON_CATEGORIES[selectedCategory as keyof typeof ICON_CATEGORIES] }
        : ICON_CATEGORIES
    }

    const term = searchTerm.toLowerCase()
    const filtered: Record<string, typeof ICON_CATEGORIES[keyof typeof ICON_CATEGORIES]> = {}

    Object.entries(ICON_CATEGORIES).forEach(([category, icons]) => {
      const matchedIcons = icons.filter(({ name }) =>
        name.toLowerCase().includes(term)
      )
      if (matchedIcons.length > 0) {
        filtered[category] = matchedIcons as unknown as typeof ICON_CATEGORIES[keyof typeof ICON_CATEGORIES]
      }
    })

    return filtered
  }, [searchTerm, selectedCategory])

  const handleSelect = useCallback((iconName: string) => {
    onChange(iconName)
    setIsExpanded(false)
    setSearchTerm('')
  }, [onChange])

  const handleClear = useCallback(() => {
    onChange(undefined)
    setIsExpanded(false)
    setSearchTerm('')
  }, [onChange])

  return (
    <div className="flex items-center gap-2 relative">
      <label className="text-xs font-medium gui-text-secondary shrink-0">Icon</label>

      {/* Current icon / toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-6 h-6 rounded border-2 transition-all shrink-0 flex items-center justify-center ${
          isExpanded ? 'gui-ring-active' : 'gui-border hover:border-[var(--gui-text-secondary)]'
        }`}
        title={value ? `Current: ${value}` : 'Select an icon'}
      >
        {CurrentIcon ? (
          <CurrentIcon className="w-4 h-4" style={{ color }} />
        ) : (
          <span className="text-[10px] gui-text-secondary">--</span>
        )}
      </button>

      {/* Clear button */}
      {value && !isExpanded && (
        <button
          onClick={handleClear}
          className="text-[10px] gui-text-secondary hover:gui-text transition-colors"
          title="Remove icon"
        >
          clear
        </button>
      )}

      {/* Dropdown picker */}
      {isExpanded && (
        <div
          className="absolute z-50 top-full left-0 mt-1 gui-panel glass-fluid gui-border rounded-lg shadow-lg p-2 w-64"
        >
          {/* Search */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search icons..."
            className="w-full gui-input rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:gui-border-active"
            autoFocus
          />

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                selectedCategory === null
                  ? 'gui-bg-accent text-white'
                  : 'gui-panel-secondary gui-button gui-text-secondary'
              }`}
            >
              All
            </button>
            {Object.keys(ICON_CATEGORIES).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                  selectedCategory === category
                    ? 'gui-bg-accent text-white'
                    : 'gui-panel-secondary gui-button gui-text-secondary'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Icons grid */}
          <div className="max-h-48 overflow-y-auto">
            {Object.entries(filteredIcons).map(([category, icons]) => (
              <div key={category} className="mb-2">
                {!selectedCategory && (
                  <div className="text-[10px] gui-text-secondary mb-1 uppercase">{category}</div>
                )}
                <div className="flex flex-wrap gap-1">
                  {icons.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      onClick={() => handleSelect(name)}
                      className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                        value === name
                          ? 'gui-ring-active'
                          : 'gui-button'
                      }`}
                      title={name}
                    >
                      <Icon className="w-4 h-4" style={{ color: value === name ? color : undefined }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {Object.keys(filteredIcons).length === 0 && (
              <div className="text-center py-4 gui-text-secondary text-xs">
                No icons found
              </div>
            )}
          </div>

          {/* Clear button at bottom */}
          {value && (
            <button
              onClick={handleClear}
              className="w-full mt-2 px-2 py-1 rounded text-xs flex items-center justify-center gap-1 gui-panel-secondary gui-button gui-text transition-colors"
            >
              <X className="w-3 h-3" />
              Remove icon
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export const IconPicker = memo(IconPickerComponent)
