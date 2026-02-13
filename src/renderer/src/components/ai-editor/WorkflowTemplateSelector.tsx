/**
 * Workflow Template Selector
 *
 * Component for browsing and selecting workflow templates.
 * Supports search, category filtering, and variable input.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import {
  Search,
  X,
  ChevronRight,
  Briefcase,
  Code2,
  BookOpen,
  Megaphone,
  Target,
  FolderPlus,
  MessageSquare,
  Layers,
  Star,
  Sparkles
} from 'lucide-react'
import {
  WORKFLOW_TEMPLATES,
  CATEGORY_LABELS,
  searchTemplates,
  getTemplatesByCategory,
  type WorkflowTemplate,
  type TemplateCategory,
  type TemplateVariable
} from '../../data/workflowTemplates'
import { useWorkspaceStore } from '../../stores/workspaceStore'

// -----------------------------------------------------------------------------
// Icon Mapping
// -----------------------------------------------------------------------------

const CATEGORY_ICONS: Record<TemplateCategory, typeof Briefcase> = {
  'project-management': Briefcase,
  'development': Code2,
  'research': BookOpen,
  'creative': Megaphone,
  'business': Briefcase,
  'personal': Target,
  'custom': Layers
}

const TEMPLATE_ICONS: Record<string, typeof Briefcase> = {
  Briefcase,
  Code2,
  BookOpen,
  Megaphone,
  Target,
  FolderPlus,
  MessageSquare,
  Layers
}

// -----------------------------------------------------------------------------
// Template Card
// -----------------------------------------------------------------------------

interface TemplateCardProps {
  template: WorkflowTemplate
  isSelected: boolean
  onSelect: (template: WorkflowTemplate) => void
  isLightMode: boolean
}

const TemplateCard = memo(function TemplateCard({
  template,
  isSelected,
  onSelect,
  isLightMode: _isLightMode
}: TemplateCardProps) {
  const Icon = TEMPLATE_ICONS[template.icon] ?? Layers

  return (
    <button
      onClick={() => onSelect(template)}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[var(--surface-panel-secondary)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${
          isSelected
            ? 'bg-blue-500 text-white'
            : 'bg-[var(--surface-panel-secondary)] text-[var(--text-secondary)]'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate text-[var(--text-primary)]">
              {template.name}
            </span>
            {template.builtIn && (
              <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs mt-0.5 line-clamp-2 text-[var(--text-secondary)]">
            {template.description}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {template.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-panel-secondary)] text-[var(--text-secondary)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 flex-shrink-0 text-[var(--text-muted)]" />
      </div>
    </button>
  )
})

// -----------------------------------------------------------------------------
// Variable Input
// -----------------------------------------------------------------------------

interface VariableInputProps {
  variable: TemplateVariable
  value: string
  onChange: (value: string) => void
  isLightMode: boolean
}

const VariableInput = memo(function VariableInput({
  variable,
  value,
  onChange,
  isLightMode: _isLightMode
}: VariableInputProps) {
  const inputClasses = `w-full px-3 py-2 text-sm rounded-lg border transition-colors bg-[var(--surface-panel)] border-[var(--border-subtle)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`

  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
        {variable.label}
        {variable.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {variable.type === 'select' ? (
        <select
          value={value || variable.default || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        >
          <option value="">Select...</option>
          {variable.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : variable.type === 'date' ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      ) : (
        <input
          type={variable.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={variable.placeholder}
          className={inputClasses}
        />
      )}
      {variable.description && (
        <p className="text-[10px] mt-1 text-[var(--text-secondary)]">
          {variable.description}
        </p>
      )}
    </div>
  )
})

// -----------------------------------------------------------------------------
// Category Tabs
// -----------------------------------------------------------------------------

interface CategoryTabsProps {
  selectedCategory: TemplateCategory | 'all'
  onSelect: (category: TemplateCategory | 'all') => void
  isLightMode: boolean
}

const CategoryTabs = memo(function CategoryTabs({
  selectedCategory,
  onSelect,
  isLightMode: _isLightMode
}: CategoryTabsProps) {
  const categories: Array<TemplateCategory | 'all'> = [
    'all',
    'project-management',
    'development',
    'research',
    'creative',
    'personal'
  ]

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
      {categories.map(cat => {
        const isSelected = selectedCategory === cat
        const Icon = cat === 'all' ? Sparkles : CATEGORY_ICONS[cat]
        const label = cat === 'all' ? 'All' : CATEGORY_LABELS[cat]

        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              isSelected
                ? 'bg-blue-500 text-white'
                : 'bg-[var(--surface-panel-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel)]'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        )
      })}
    </div>
  )
})

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

interface WorkflowTemplateSelectorProps {
  onSelect: (template: WorkflowTemplate, variables: Record<string, string>) => void
  onCancel: () => void
}

function WorkflowTemplateSelectorComponent({
  onSelect,
  onCancel
}: WorkflowTemplateSelectorProps): JSX.Element {
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const isLightMode = themeSettings.mode === 'light'

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})

  // Filter templates
  const filteredTemplates = useMemo((): WorkflowTemplate[] => {
    let templates: WorkflowTemplate[] = WORKFLOW_TEMPLATES

    if (search) {
      templates = searchTemplates(search)
    } else if (selectedCategory !== 'all') {
      templates = getTemplatesByCategory(selectedCategory)
    }

    return templates
  }, [search, selectedCategory])

  // Handle template selection
  const handleTemplateSelect = useCallback((template: WorkflowTemplate) => {
    setSelectedTemplate(template)
    // Initialize variables with defaults
    const defaults: Record<string, string> = {}
    for (const v of template.variables) {
      if (v.default !== undefined) {
        defaults[v.name] = String(v.default)
      }
    }
    setVariableValues(defaults)
  }, [])

  // Handle variable change
  const handleVariableChange = useCallback((name: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [name]: value }))
  }, [])

  // Handle apply
  const handleApply = useCallback(() => {
    if (!selectedTemplate) return

    // Validate required variables
    const missingRequired = selectedTemplate.variables
      .filter(v => v.required && !variableValues[v.name])
      .map(v => v.label)

    if (missingRequired.length > 0) {
      // Could show a toast here
      console.warn('Missing required variables:', missingRequired)
      return
    }

    onSelect(selectedTemplate, variableValues)
  }, [selectedTemplate, variableValues, onSelect])

  // Check if can apply
  const canApply = selectedTemplate && selectedTemplate.variables
    .filter(v => v.required)
    .every(v => variableValues[v.name])

  const bgClass = 'bg-[var(--surface-panel)]'
  const borderClass = 'border-[var(--border-subtle)]'
  const textClass = 'text-[var(--text-primary)]'
  const textMutedClass = 'text-[var(--text-secondary)]'

  return (
    <div className={`flex flex-col h-full ${bgClass}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${borderClass}`}>
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5" style={{ color: 'var(--gui-accent-primary)' }} />
          <span className={`font-medium ${textClass}`}>
            {selectedTemplate ? 'Configure Template' : 'Choose Template'}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-panel-secondary)]"
        >
          <X className={`w-4 h-4 ${textMutedClass}`} />
        </button>
      </div>

      {selectedTemplate ? (
        // Variable configuration view
        <div className="flex-1 overflow-auto">
          {/* Template info */}
          <div className={`p-4 border-b ${borderClass}`}>
            <button
              onClick={() => setSelectedTemplate(null)}
              className={`text-xs ${textMutedClass} hover:text-blue-500 mb-2 flex items-center gap-1`}
            >
              <ChevronRight className="w-3 h-3 rotate-180" />
              Back to templates
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500 text-white">
                {(() => {
                  const Icon = TEMPLATE_ICONS[selectedTemplate.icon] ?? Layers
                  return <Icon className="w-5 h-5" />
                })()}
              </div>
              <div>
                <h3 className={`font-medium ${textClass}`}>{selectedTemplate.name}</h3>
                <p className={`text-xs ${textMutedClass}`}>{selectedTemplate.description}</p>
              </div>
            </div>
          </div>

          {/* Variables */}
          <div className="p-4 space-y-4">
            {selectedTemplate.variables.length === 0 ? (
              <p className={`text-sm ${textMutedClass}`}>
                This template has no configuration options.
              </p>
            ) : (
              selectedTemplate.variables.map(variable => (
                <VariableInput
                  key={variable.name}
                  variable={variable}
                  value={variableValues[variable.name] || ''}
                  onChange={(v) => handleVariableChange(variable.name, v)}
                  isLightMode={isLightMode}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        // Template browser view
        <div className="flex-1 overflow-auto">
          {/* Search */}
          <div className="p-4 pb-2">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textMutedClass}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-colors bg-[var(--surface-panel-secondary)] border-[var(--border-subtle)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="px-4 pb-3">
            <CategoryTabs
              selectedCategory={selectedCategory}
              onSelect={(cat) => {
                setSelectedCategory(cat)
                setSearch('')
              }}
              isLightMode={isLightMode}
            />
          </div>

          {/* Template list */}
          <div className="px-4 pb-4 space-y-2">
            {filteredTemplates.length === 0 ? (
              <p className={`text-sm text-center py-8 ${textMutedClass}`}>
                No templates found
              </p>
            ) : (
              // @ts-expect-error - TypeScript incorrectly narrows filteredTemplates to never after length check with noUncheckedIndexedAccess
              filteredTemplates.map((template: WorkflowTemplate) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplate?.id === template.id}
                  onSelect={handleTemplateSelect}
                  isLightMode={isLightMode}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {selectedTemplate && (
        <div className={`flex justify-end gap-2 px-4 py-3 border-t ${borderClass}`}>
          <button
            onClick={() => setSelectedTemplate(null)}
            className="px-4 py-2 text-sm rounded-lg transition-colors hover:bg-[var(--surface-panel-secondary)] text-[var(--text-secondary)]"
          >
            Back
          </button>
          <button
            onClick={handleApply}
            disabled={!canApply}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              canApply
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-[var(--surface-panel-secondary)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            Use Template
          </button>
        </div>
      )}
    </div>
  )
}

export const WorkflowTemplateSelector = memo(WorkflowTemplateSelectorComponent)
export default WorkflowTemplateSelector
