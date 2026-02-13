// =============================================================================
// AI CONFIG QUESTIONS COMPONENT
// =============================================================================
// Renders clarifying questions from AI

import { memo, useState, useCallback } from 'react'
import { HelpCircle, ChevronRight } from 'lucide-react'
import type { AIClarifyingQuestion } from '@shared/actionTypes'

interface AIConfigQuestionsProps {
  questions: AIClarifyingQuestion[]
  round: number
  maxRounds: number
  onSubmit: (answers: Record<string, string>) => void
  onCancel: () => void
}

function AIConfigQuestionsComponent({
  questions,
  round,
  maxRounds,
  onSubmit,
  onCancel
}: AIConfigQuestionsProps): JSX.Element {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    // Initialize with defaults
    const initial: Record<string, string> = {}
    questions.forEach(q => {
      if (q.default) {
        initial[q.id] = q.default
      }
    })
    return initial
  })

  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }, [])

  const handleSubmit = useCallback(() => {
    onSubmit(answers)
  }, [answers, onSubmit])

  const canSubmit = questions
    .filter(q => q.required)
    .every(q => answers[q.id] && answers[q.id].trim())

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium gui-text">Clarification needed</span>
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">
          Round {round} of {maxRounds}
        </span>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((question, index) => (
          <QuestionInput
            key={question.id}
            question={question}
            value={answers[question.id] || ''}
            onChange={(value) => handleAnswerChange(question.id, value)}
            autoFocus={index === 0}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs gui-text-secondary hover:gui-text rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
        >
          Continue
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// Individual question input
interface QuestionInputProps {
  question: AIClarifyingQuestion
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

function QuestionInput({ question, value, onChange, autoFocus }: QuestionInputProps): JSX.Element {
  return (
    <div className="space-y-1.5">
      {/* Question text */}
      <label className="block text-xs gui-text">
        {question.question}
        {question.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      {/* Context/help text */}
      {question.context && (
        <p className="text-[10px] text-[var(--text-muted)]">{question.context}</p>
      )}

      {/* Input based on type */}
      {question.type === 'select' && (
        <SelectInput
          options={question.options}
          value={value}
          onChange={onChange}
          autoFocus={autoFocus}
        />
      )}

      {question.type === 'multiselect' && (
        <MultiSelectInput
          options={question.options}
          value={value}
          onChange={onChange}
        />
      )}

      {question.type === 'text' && (
        <TextInput
          placeholder={question.placeholder}
          value={value}
          onChange={onChange}
          autoFocus={autoFocus}
        />
      )}

      {question.type === 'slider' && (
        <SliderInput
          min={question.min}
          max={question.max}
          step={question.step}
          unit={question.unit}
          value={value ? Number(value) : question.min}
          onChange={(v) => onChange(String(v))}
        />
      )}

      {question.type === 'node-picker' && (
        <NodePickerInput
          nodeTypeFilter={question.nodeTypeFilter}
          value={value}
          onChange={onChange}
        />
      )}

      {/* Skip with default */}
      {!question.required && question.default && (
        <button
          onClick={() => onChange(question.default!)}
          className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
        >
          Use default: {question.default}
        </button>
      )}
    </div>
  )
}

// Select input
interface SelectInputProps {
  options: Array<{ value: string; label: string; description?: string }>
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

function SelectInput({ options, value, onChange, autoFocus }: SelectInputProps): JSX.Element {
  return (
    <div className="space-y-1">
      {options.map((option, index) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          autoFocus={autoFocus && index === 0}
          className={`w-full flex items-start gap-2 p-2 rounded text-left transition-colors ${
            value === option.value
              ? 'bg-purple-600/20 border border-purple-500/50'
              : 'bg-[var(--surface-panel)]/50 border border-transparent hover:bg-[var(--surface-panel-secondary)]'
          }`}
        >
          <div
            className={`w-3 h-3 mt-0.5 rounded-full border-2 flex-shrink-0 ${
              value === option.value
                ? 'border-purple-500 bg-purple-500'
                : 'border-[var(--text-muted)]'
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs gui-text">{option.label}</div>
            {option.description && (
              <div className="text-[10px] text-[var(--text-muted)]">{option.description}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

// Multi-select input
interface MultiSelectInputProps {
  options: Array<{ value: string; label: string; description?: string }>
  value: string // comma-separated values
  onChange: (value: string) => void
}

function MultiSelectInput({ options, value, onChange }: MultiSelectInputProps): JSX.Element {
  const selectedValues = new Set(value ? value.split(',') : [])

  const toggleOption = (optionValue: string) => {
    const newSelected = new Set(selectedValues)
    if (newSelected.has(optionValue)) {
      newSelected.delete(optionValue)
    } else {
      newSelected.add(optionValue)
    }
    onChange([...newSelected].join(','))
  }

  return (
    <div className="space-y-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => toggleOption(option.value)}
          className={`w-full flex items-start gap-2 p-2 rounded text-left transition-colors ${
            selectedValues.has(option.value)
              ? 'bg-purple-600/20 border border-purple-500/50'
              : 'bg-[var(--surface-panel)]/50 border border-transparent hover:bg-[var(--surface-panel-secondary)]'
          }`}
        >
          <div
            className={`w-3 h-3 mt-0.5 rounded flex-shrink-0 border ${
              selectedValues.has(option.value)
                ? 'border-purple-500 bg-purple-500'
                : 'border-[var(--text-muted)]'
            }`}
          >
            {selectedValues.has(option.value) && (
              <svg className="w-full h-full text-white" viewBox="0 0 12 12">
                <path
                  fill="currentColor"
                  d="M9.707 3.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L5 6.586l3.293-3.293a1 1 0 011.414 0z"
                />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs gui-text">{option.label}</div>
            {option.description && (
              <div className="text-[10px] text-[var(--text-muted)]">{option.description}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

// Text input
interface TextInputProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

function TextInput({ placeholder, value, onChange, autoFocus }: TextInputProps): JSX.Element {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Enter your answer...'}
      autoFocus={autoFocus}
      className="w-full px-2 py-1.5 text-xs gui-input rounded outline-none focus:ring-1 focus:ring-purple-500/50"
    />
  )
}

// Slider input
interface SliderInputProps {
  min: number
  max: number
  step: number
  unit?: string
  value: number
  onChange: (value: number) => void
}

function SliderInput({ min, max, step, unit, value, onChange }: SliderInputProps): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
        <span>{min}{unit}</span>
        <span className="font-medium gui-text">{value}{unit}</span>
        <span>{max}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-[var(--surface-panel-secondary)] rounded-lg appearance-none cursor-pointer accent-purple-500"
      />
    </div>
  )
}

// Node picker input (simplified - uses dropdown for now)
interface NodePickerInputProps {
  nodeTypeFilter?: string
  value: string
  onChange: (value: string) => void
}

function NodePickerInput({ nodeTypeFilter, value, onChange }: NodePickerInputProps): JSX.Element {
  // In a full implementation, this would fetch nodes from the workspace
  // For now, show a text input with a hint
  return (
    <div className="space-y-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${nodeTypeFilter || 'node'} ID or title...`}
        className="w-full px-2 py-1.5 text-xs gui-input rounded outline-none focus:ring-1 focus:ring-purple-500/50"
      />
      <p className="text-[10px] text-[var(--text-muted)]">
        Tip: You can use node IDs or titles{nodeTypeFilter ? ` (filtered to ${nodeTypeFilter} nodes)` : ''}
      </p>
    </div>
  )
}

export const AIConfigQuestions = memo(AIConfigQuestionsComponent)
