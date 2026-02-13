// =============================================================================
// TEMPLATE SELECTOR COMPONENT
// =============================================================================
// Dropdown for selecting description templates

import { memo, useState, useMemo, useCallback } from 'react'
import { ChevronRight, Search, Lightbulb, Star } from 'lucide-react'
import { DESCRIPTION_TEMPLATES } from '../../services/actionAIService'
import { aiConfigLearning } from '../../services/aiConfigLearning'
import { aiConfigAnalytics } from '../../services/aiConfigAnalytics'
import type { AIDescriptionTemplate } from '@shared/actionTypes'

interface TemplateSelectorProps {
  onSelect: (template: string) => void
  isOpen: boolean
  onToggle: () => void
}

// Storage for favorites
const FAVORITES_KEY = 'ai_config_template_favorites'

function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(favorites: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]))
  } catch {
    // Ignore storage errors
  }
}

function TemplateSelectorComponent({ onSelect, isOpen, onToggle }: TemplateSelectorProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites())

  // Get templates with smart ordering
  const allTemplates = useMemo(() => {
    // Get learned patterns
    const patterns = aiConfigLearning.getTopPatterns(3)
    const learnedTemplates: AIDescriptionTemplate[] = patterns
      .filter(p => p.successRate > 0.5)
      .map((p, i) => ({
        id: `learned-${i}`,
        label: `Pattern: ${p.triggerType}`,
        template: generateTemplateFromPattern(p),
        category: 'triggers' as const
      }))

    return {
      recent: learnedTemplates,
      favorites: DESCRIPTION_TEMPLATES.filter(t => favorites.has(t.id)),
      triggers: DESCRIPTION_TEMPLATES.filter(t => t.category === 'triggers'),
      actions: DESCRIPTION_TEMPLATES.filter(t => t.category === 'actions'),
      complete: DESCRIPTION_TEMPLATES.filter(t => t.category === 'complete')
    }
  }, [favorites])

  // Filter templates by search
  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return null

    const lower = search.toLowerCase()
    return DESCRIPTION_TEMPLATES.filter(
      t => t.label.toLowerCase().includes(lower) || t.template.toLowerCase().includes(lower)
    )
  }, [search])

  const handleSelect = useCallback((template: AIDescriptionTemplate) => {
    onSelect(template.template)
    aiConfigAnalytics.trackTemplateUsed(template.id, template.category)
    onToggle()
  }, [onSelect, onToggle])

  const toggleFavorite = useCallback((templateId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(templateId)) {
        next.delete(templateId)
      } else {
        next.add(templateId)
      }
      saveFavorites(next)
      return next
    })
  }, [])

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
      >
        <Lightbulb className="w-3 h-3" />
        <span>Use a template</span>
      </button>
    )
  }

  return (
    <div className="absolute top-full left-0 mt-1 w-72 glass-fluid gui-panel-bg border border-[var(--border-subtle)] rounded-lg shadow-xl z-50 overflow-hidden">
      {/* Search */}
      <div className="p-2 border-b border-[var(--border-subtle)]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-7 pr-2 py-1 bg-[var(--surface-panel)] rounded text-xs gui-text placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-purple-500/50"
            autoFocus
          />
        </div>
      </div>

      {/* Template list */}
      <div className="max-h-64 overflow-y-auto">
        {filteredTemplates ? (
          // Search results
          filteredTemplates.length === 0 ? (
            <div className="p-3 text-xs text-[var(--text-muted)] text-center">No matching templates</div>
          ) : (
            <div className="p-1">
              {filteredTemplates.map(t => (
                <TemplateItem
                  key={t.id}
                  template={t}
                  isFavorite={favorites.has(t.id)}
                  onSelect={handleSelect}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )
        ) : (
          // Categories
          <div className="p-1 space-y-0.5">
            {/* Favorites */}
            {allTemplates.favorites.length > 0 && (
              <CategorySection
                name="favorites"
                label="Favorites"
                templates={allTemplates.favorites}
                favorites={favorites}
                expanded={expandedCategory === 'favorites'}
                onToggle={() => setExpandedCategory(expandedCategory === 'favorites' ? null : 'favorites')}
                onSelect={handleSelect}
                onToggleFavorite={toggleFavorite}
              />
            )}

            {/* Recent patterns */}
            {allTemplates.recent.length > 0 && (
              <CategorySection
                name="recent"
                label="Your patterns"
                templates={allTemplates.recent}
                favorites={favorites}
                expanded={expandedCategory === 'recent'}
                onToggle={() => setExpandedCategory(expandedCategory === 'recent' ? null : 'recent')}
                onSelect={handleSelect}
                onToggleFavorite={toggleFavorite}
              />
            )}

            {/* Complete examples (show first) */}
            <CategorySection
              name="complete"
              label="Complete examples"
              templates={allTemplates.complete}
              favorites={favorites}
              expanded={expandedCategory === 'complete' || expandedCategory === null}
              onToggle={() => setExpandedCategory(expandedCategory === 'complete' ? null : 'complete')}
              onSelect={handleSelect}
              onToggleFavorite={toggleFavorite}
            />

            {/* Trigger patterns */}
            <CategorySection
              name="triggers"
              label="Trigger patterns"
              templates={allTemplates.triggers}
              favorites={favorites}
              expanded={expandedCategory === 'triggers'}
              onToggle={() => setExpandedCategory(expandedCategory === 'triggers' ? null : 'triggers')}
              onSelect={handleSelect}
              onToggleFavorite={toggleFavorite}
            />

            {/* Action patterns */}
            <CategorySection
              name="actions"
              label="Action patterns"
              templates={allTemplates.actions}
              favorites={favorites}
              expanded={expandedCategory === 'actions'}
              onToggle={() => setExpandedCategory(expandedCategory === 'actions' ? null : 'actions')}
              onSelect={handleSelect}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        )}
      </div>

      {/* Close hint */}
      <div className="p-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] text-center">
        Press Escape or click outside to close
      </div>
    </div>
  )
}

// Category section component
interface CategorySectionProps {
  name: string
  label: string
  templates: AIDescriptionTemplate[]
  favorites: Set<string>
  expanded: boolean
  onToggle: () => void
  onSelect: (template: AIDescriptionTemplate) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
}

function CategorySection({
  name,
  label,
  templates,
  favorites,
  expanded,
  onToggle,
  onSelect,
  onToggleFavorite
}: CategorySectionProps): JSX.Element {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
      >
        <span className="text-xs font-medium gui-text-secondary">{label}</span>
        <ChevronRight
          className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="pl-2 space-y-0.5">
          {templates.map(t => (
            <TemplateItem
              key={`${name}-${t.id}`}
              template={t}
              isFavorite={favorites.has(t.id)}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Template item component
interface TemplateItemProps {
  template: AIDescriptionTemplate
  isFavorite: boolean
  onSelect: (template: AIDescriptionTemplate) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
}

function TemplateItem({ template, isFavorite, onSelect, onToggleFavorite }: TemplateItemProps): JSX.Element {
  return (
    <button
      onClick={() => onSelect(template)}
      className="w-full flex items-center gap-2 p-2 hover:bg-[var(--surface-panel-secondary)] rounded text-left group transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs gui-text truncate">{template.label}</div>
        <div className="text-[10px] text-[var(--text-muted)] truncate">{template.template}</div>
      </div>
      <button
        onClick={(e) => onToggleFavorite(template.id, e)}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-panel-secondary)] rounded transition-all"
      >
        <Star
          className={`w-3 h-3 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-[var(--text-secondary)]'}`}
        />
      </button>
    </button>
  )
}

// Helper to generate template from learned pattern
function generateTemplateFromPattern(pattern: { triggerType: string; stepTypes: string[] }): string {
  const triggerPhrases: Record<string, string> = {
    'property-change': 'When a [property] changes',
    'node-created': 'When a new [node type] is created',
    'connection-made': 'When nodes are connected',
    'schedule': 'On a schedule',
    'manual': 'When I click the button',
    'children-complete': 'When child tasks are complete'
  }

  const stepPhrases: Record<string, string> = {
    'create-node': 'create a new node',
    'update-property': 'update properties',
    'llm-call': 'use AI to analyze',
    'link-nodes': 'connect nodes',
    'delete-node': 'delete the node',
    'http-request': 'send a webhook'
  }

  const trigger = triggerPhrases[pattern.triggerType] || 'When something happens'
  const actions = pattern.stepTypes
    .slice(0, 2)
    .map(s => stepPhrases[s] || s)
    .join(', then ')

  return `${trigger}, ${actions}`
}

export const TemplateSelector = memo(TemplateSelectorComponent)
