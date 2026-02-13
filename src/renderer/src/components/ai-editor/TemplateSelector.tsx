/**
 * TemplateSelector Component
 *
 * UI for selecting and applying action templates.
 * Supports category filtering, search, preview, and variable customization.
 */

import { memo, useState, useCallback, useMemo } from 'react'
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Play,
  Zap,
  Workflow,
  Link2,
  CheckSquare,
  FileText,
  MessageSquare,
  Calendar,
  Folder,
  Sparkles
} from 'lucide-react'
import { BUILT_IN_TEMPLATES, searchTemplates, getTemplatesByCategory } from '../../data/actionTemplates'
import type { ActionTemplate, TemplateVariable } from '@shared/types'

interface TemplateSelectorProps {
  isOpen: boolean
  onClose: () => void
  onApply: (template: ActionTemplate, variables: Record<string, unknown>) => void
}

type TemplateCategory = 'all' | ActionTemplate['category']

const CATEGORY_OPTIONS: { value: TemplateCategory; label: string; icon: typeof Zap }[] = [
  { value: 'all', label: 'All Templates', icon: Sparkles },
  { value: 'automation', label: 'Automation', icon: Zap },
  { value: 'workflow', label: 'Workflow', icon: Workflow },
  { value: 'integration', label: 'Integration', icon: Link2 }
]

const ICON_MAP: Record<string, typeof CheckSquare> = {
  CheckSquare,
  FileText,
  MessageSquare,
  Calendar,
  Folder,
  Sparkles,
  Zap,
  Workflow
}

function TemplateSelectorComponent({
  isOpen,
  onClose,
  onApply
}: TemplateSelectorProps): JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, unknown>>({})
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = BUILT_IN_TEMPLATES

    if (searchQuery) {
      templates = searchTemplates(searchQuery)
    } else if (selectedCategory !== 'all') {
      templates = getTemplatesByCategory(selectedCategory)
    }

    return templates
  }, [searchQuery, selectedCategory])

  // Handle template selection
  const handleSelectTemplate = useCallback((template: ActionTemplate) => {
    setSelectedTemplate(template)
    // Initialize variable values with defaults
    const defaults: Record<string, unknown> = {}
    for (const v of template.variables) {
      defaults[v.name] = v.defaultValue
    }
    setVariableValues(defaults)
  }, [])

  // Handle variable change
  const handleVariableChange = useCallback((name: string, value: unknown) => {
    setVariableValues(prev => ({ ...prev, [name]: value }))
  }, [])

  // Handle apply
  const handleApply = useCallback(() => {
    if (selectedTemplate) {
      onApply(selectedTemplate, variableValues)
      onClose()
    }
  }, [selectedTemplate, variableValues, onApply, onClose])

  // Get icon component
  const getIcon = (iconName?: string) => {
    if (!iconName) return Sparkles
    return ICON_MAP[iconName] || Sparkles
  }

  if (!isOpen) return null

  const titleId = 'template-selector-title'

  return (
    <div
      className="template-selector-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="template-selector">
        {/* Header */}
        <div className="selector-header">
          <h2 id={titleId}>Action Templates</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close template selector">
            <X className="close-icon" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="selector-filters">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              autoFocus
              aria-label="Search templates"
            />
          </div>

          <div className="category-tabs">
            {CATEGORY_OPTIONS.map((cat) => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.value}
                  className={`category-tab ${selectedCategory === cat.value ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.value)}
                  aria-pressed={selectedCategory === cat.value}
                >
                  <Icon className="category-icon" />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Template List and Details */}
        <div className="selector-content">
          {/* Templates List */}
          <div className="templates-list" role="listbox" aria-label="Available templates">
            {filteredTemplates.length === 0 ? (
              <div className="no-results">
                <Sparkles className="no-results-icon" />
                <p>No templates found</p>
              </div>
            ) : (
              filteredTemplates.map((template) => {
                const Icon = getIcon(template.icon)
                const isSelected = selectedTemplate?.id === template.id
                const isExpanded = expandedTemplate === template.id

                return (
                  <div
                    key={template.id}
                    className={`template-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectTemplate(template)}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSelectTemplate(template)}
                  >
                    <div className="template-header">
                      <Icon className="template-icon" />
                      <div className="template-info">
                        <span className="template-name">{template.name}</span>
                        <span className="template-category">{template.category}</span>
                      </div>
                      <button
                        className="expand-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedTemplate(isExpanded ? null : template.id)
                        }}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                      >
                        {isExpanded ? <ChevronUp /> : <ChevronDown />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="template-details">
                        <p className="template-description">{template.description}</p>
                        <div className="template-meta">
                          <span>{template.triggers.length} trigger{template.triggers.length !== 1 ? 's' : ''}</span>
                          <span>{template.steps.length} step{template.steps.length !== 1 ? 's' : ''}</span>
                          {template.variables.length > 0 && (
                            <span>{template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Template Configuration */}
          {selectedTemplate && (
            <div className="template-config">
              <h3>Configure Template</h3>
              <p className="config-description">{selectedTemplate.description}</p>

              {/* Variables */}
              {selectedTemplate.variables.length > 0 && (
                <div className="variables-section">
                  <h4>Variables</h4>
                  {selectedTemplate.variables.map((variable) => (
                    <VariableInput
                      key={variable.name}
                      variable={variable}
                      value={variableValues[variable.name]}
                      onChange={(value) => handleVariableChange(variable.name, value)}
                    />
                  ))}
                </div>
              )}

              {/* Triggers Preview */}
              <div className="triggers-section">
                <h4>Triggers</h4>
                {selectedTemplate.triggers.map((trigger, i) => (
                  <div key={i} className="trigger-item">
                    <Zap className="trigger-icon" />
                    <span>{formatTrigger(trigger)}</span>
                  </div>
                ))}
              </div>

              {/* Steps Preview */}
              <div className="steps-section">
                <h4>Actions</h4>
                {selectedTemplate.steps.map((step, i) => (
                  <div key={i} className="step-item">
                    <span className="step-number">{i + 1}</span>
                    <span>{formatStep(step)}</span>
                  </div>
                ))}
              </div>

              {/* Apply Button */}
              <button className="apply-btn" onClick={handleApply} aria-label={`Apply ${selectedTemplate.name} template`}>
                <Play className="apply-icon" />
                Apply Template
              </button>
            </div>
          )}
        </div>

        <style>{`
          .template-selector-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .template-selector {
            width: 800px;
            max-width: 90vw;
            max-height: 80vh;
            background: rgba(25, 25, 25, 0.98);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .selector-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .selector-header h2 {
            font-size: 18px;
            font-weight: 600;
            color: #f0f0f0;
            margin: 0;
          }

          .close-btn {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          }

          .close-btn:hover {
            background: rgba(255, 255, 255, 0.1);
          }

          .close-icon {
            width: 18px;
            height: 18px;
            color: #888;
          }

          .selector-filters {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .search-wrapper {
            position: relative;
            margin-bottom: 12px;
          }

          .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            width: 16px;
            height: 16px;
            color: #666;
          }

          .search-wrapper input {
            width: 100%;
            padding: 10px 12px 10px 40px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: #f0f0f0;
            font-size: 14px;
            outline: none;
          }

          .search-wrapper input:focus {
            border-color: var(--gui-accent-primary, #7c3aed);
          }

          .category-tabs {
            display: flex;
            gap: 8px;
          }

          .category-tab {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 6px;
            color: #888;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s;
          }

          .category-tab:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #ccc;
          }

          .category-tab.active {
            background: rgba(124, 58, 237, 0.15);
            border-color: var(--gui-accent-primary, #7c3aed);
            color: var(--gui-accent-primary, #7c3aed);
          }

          .category-icon {
            width: 14px;
            height: 14px;
          }

          .selector-content {
            flex: 1;
            display: flex;
            overflow: hidden;
          }

          .templates-list {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            border-right: 1px solid rgba(255, 255, 255, 0.1);
          }

          .no-results {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px;
            color: #666;
          }

          .no-results-icon {
            width: 32px;
            height: 32px;
            margin-bottom: 12px;
            opacity: 0.5;
          }

          .template-item {
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.15s;
            margin-bottom: 8px;
          }

          .template-item:hover {
            background: rgba(255, 255, 255, 0.05);
          }

          .template-item.selected {
            background: rgba(124, 58, 237, 0.15);
            border: 1px solid var(--gui-accent-primary, #7c3aed);
          }

          .template-header {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .template-icon {
            width: 20px;
            height: 20px;
            color: var(--gui-accent-primary, #7c3aed);
            flex-shrink: 0;
          }

          .template-info {
            flex: 1;
            min-width: 0;
          }

          .template-name {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #e0e0e0;
          }

          .template-category {
            display: block;
            font-size: 11px;
            color: #888;
            text-transform: capitalize;
          }

          .expand-btn {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            border-radius: 4px;
            color: #666;
            cursor: pointer;
          }

          .expand-btn:hover {
            background: rgba(255, 255, 255, 0.1);
          }

          .template-details {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }

          .template-description {
            font-size: 12px;
            color: #999;
            line-height: 1.5;
            margin: 0 0 8px;
          }

          .template-meta {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: #666;
          }

          .template-config {
            width: 320px;
            padding: 16px;
            overflow-y: auto;
          }

          .template-config h3 {
            font-size: 16px;
            font-weight: 600;
            color: #f0f0f0;
            margin: 0 0 8px;
          }

          .config-description {
            font-size: 13px;
            color: #888;
            margin: 0 0 16px;
            line-height: 1.5;
          }

          .template-config h4 {
            font-size: 12px;
            font-weight: 600;
            color: #ccc;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 16px 0 8px;
          }

          .variables-section,
          .triggers-section,
          .steps-section {
            margin-bottom: 16px;
          }

          .trigger-item,
          .step-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
            margin-bottom: 6px;
            font-size: 12px;
            color: #ccc;
          }

          .trigger-icon {
            width: 14px;
            height: 14px;
            color: #f59e0b;
          }

          .step-number {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--gui-accent-primary, #7c3aed);
            border-radius: 50%;
            font-size: 11px;
            font-weight: 600;
            color: white;
          }

          .apply-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 12px;
            background: var(--gui-accent-primary, #7c3aed);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s;
            margin-top: 16px;
          }

          .apply-btn:hover {
            background: var(--gui-accent-secondary, #6d28d9);
          }

          .apply-icon {
            width: 16px;
            height: 16px;
          }

          /* Light mode */
          [data-theme="light"] .template-selector {
            background: rgba(255, 255, 255, 0.98);
          }

          [data-theme="light"] .selector-header h2 {
            color: #1f2937;
          }

          [data-theme="light"] .template-name {
            color: #1f2937;
          }

          [data-theme="light"] .search-wrapper input {
            background: rgba(0, 0, 0, 0.03);
            color: #1f2937;
          }
        `}</style>
      </div>
    </div>
  )
}

// Variable Input Component
interface VariableInputProps {
  variable: TemplateVariable
  value: unknown
  onChange: (value: unknown) => void
}

function VariableInput({ variable, value, onChange }: VariableInputProps): JSX.Element {
  switch (variable.type) {
    case 'boolean':
      return (
        <label className="variable-input boolean">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{variable.label}</span>
          {variable.description && <small>{variable.description}</small>}
        </label>
      )

    case 'number':
      return (
        <div className="variable-input number">
          <label>{variable.label}</label>
          <input
            type="number"
            value={Number(value) || 0}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          {variable.description && <small>{variable.description}</small>}
        </div>
      )

    case 'string':
    default:
      if (variable.options) {
        return (
          <div className="variable-input select">
            <label>{variable.label}</label>
            <select
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
            >
              {variable.options.map((opt) => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
            {variable.description && <small>{variable.description}</small>}
          </div>
        )
      }
      return (
        <div className="variable-input string">
          <label>{variable.label}</label>
          <input
            type="text"
            value={String(value) || ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {variable.description && <small>{variable.description}</small>}
        </div>
      )
  }
}

// Helper functions
function formatTrigger(trigger: ActionTemplate['triggers'][0]): string {
  switch (trigger.type) {
    case 'node-created':
      return `When a ${trigger.nodeType || 'node'} is created`
    case 'node-updated':
      return `When a ${trigger.nodeType || 'node'} is updated`
    case 'node-completed':
      return `When a ${trigger.nodeType || 'task'} is completed`
    case 'edge-created':
      return 'When nodes are connected'
    case 'schedule':
      return `${trigger.schedule?.frequency || 'scheduled'} at ${trigger.schedule?.time || 'specified time'}`
    case 'manual':
      return 'Run manually'
    default:
      return trigger.type
  }
}

function formatStep(step: ActionTemplate['steps'][0]): string {
  switch (step.type) {
    case 'ai-generate':
      return 'Generate content with AI'
    case 'ai-summarize':
      return 'Summarize with AI'
    case 'create-node':
      return 'Create a new node'
    case 'update-node':
      return 'Update node'
    case 'create-edge':
      return 'Connect nodes'
    case 'notify':
      return 'Send notification'
    default:
      return step.type
  }
}

const TemplateSelector = memo(TemplateSelectorComponent)
export default TemplateSelector
