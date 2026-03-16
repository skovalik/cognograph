// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * ExtractionsSection — Auto-extraction settings for conversation nodes.
 *
 * Extracted from the ConversationFields section of PropertiesPanel.tsx
 * for reuse in AdvancedSettingsModal.
 *
 * Controls extraction types, trigger mode, confidence threshold, and
 * displays extracted item counts.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckSquare, FileText, Sparkles } from 'lucide-react'
import { Slider } from '../../ui/slider'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { DEFAULT_EXTRACTION_SETTINGS } from '@shared/types'
import type { ConversationNodeData, ExtractionSettings } from '@shared/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExtractionsSectionProps {
  nodeId: string
  /** When true, the section starts expanded */
  defaultExpanded?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExtractionsSection({
  nodeId,
  defaultExpanded = false,
}: ExtractionsSectionProps): JSX.Element | null {
  const [isExtractionExpanded, setIsExtractionExpanded] = useState(defaultExpanded)

  const nodeData = useWorkspaceStore(
    (state) => state.nodes.find((n) => n.id === nodeId)?.data,
  )
  const updateExtractionSettings = useWorkspaceStore(
    (state) => state.updateExtractionSettings,
  )

  if (!nodeData || nodeData.type !== 'conversation') return null

  const data = nodeData as ConversationNodeData
  const extractionSettings = data.extractionSettings || DEFAULT_EXTRACTION_SETTINGS

  const handleExtractionSettingsChange = (settings: Partial<ExtractionSettings>): void => {
    updateExtractionSettings(nodeId, settings)
  }

  const handleToggleExtractionType = (type: 'notes' | 'tasks'): void => {
    const current = extractionSettings.extractionTypes
    const newTypes = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    handleExtractionSettingsChange({
      extractionTypes: newTypes as ('notes' | 'tasks')[],
    })
  }

  return (
    <div className="pt-3">
      <button
        onClick={() => setIsExtractionExpanded(!isExtractionExpanded)}
        className="flex items-center gap-2 text-xs font-medium gui-text mb-2 w-full"
      >
        {isExtractionExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <Sparkles
          className="w-3.5 h-3.5"
          style={{ color: 'var(--gui-accent-primary)' }}
        />
        Auto-Extraction
        {extractionSettings.autoExtractEnabled && (
          <span
            className="ml-auto px-1.5 py-0.5 rounded text-[10px]"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--gui-accent-primary) 30%, transparent)',
              color: 'var(--gui-accent-primary)',
            }}
          >
            ON
          </span>
        )}
      </button>

      {isExtractionExpanded && (
        <div className="space-y-3 pl-5">
          {/* Enable toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`extraction-enabled-${nodeId}`}
              checked={extractionSettings.autoExtractEnabled}
              onChange={(e) =>
                handleExtractionSettingsChange({
                  autoExtractEnabled: e.target.checked,
                })
              }
              className="rounded gui-input"
              style={{ accentColor: 'var(--gui-accent-primary)' }}
            />
            <label
              htmlFor={`extraction-enabled-${nodeId}`}
              className="text-xs gui-text-secondary"
            >
              Enable auto-extraction
            </label>
          </div>

          {/* Extraction types */}
          <div>
            <label className="block text-xs gui-text-secondary mb-1">
              Extract Types
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 text-xs gui-text">
                <input
                  type="checkbox"
                  checked={extractionSettings.extractionTypes.includes('notes')}
                  onChange={() => handleToggleExtractionType('notes')}
                  className={`rounded gui-input text-amber-600 focus:ring-amber-500`}
                />
                <FileText className="w-3 h-3 text-amber-400" />
                Notes
              </label>
              <label className="flex items-center gap-1.5 text-xs gui-text">
                <input
                  type="checkbox"
                  checked={extractionSettings.extractionTypes.includes('tasks')}
                  onChange={() => handleToggleExtractionType('tasks')}
                  className={`rounded gui-input text-emerald-600 focus:ring-emerald-500`}
                />
                <CheckSquare className="w-3 h-3 text-emerald-400" />
                Tasks
              </label>
            </div>
          </div>

          {/* Trigger mode */}
          <div>
            <label className="block text-xs gui-text-secondary mb-1">
              Trigger Mode
            </label>
            <select
              value={extractionSettings.extractionTrigger}
              onChange={(e) =>
                handleExtractionSettingsChange({
                  extractionTrigger: e.target
                    .value as ExtractionSettings['extractionTrigger'],
                })
              }
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="on-demand">On-demand only</option>
              <option value="per-message">
                After each message (30s debounce)
              </option>
              <option value="on-close">When chat closes</option>
            </select>
          </div>

          {/* Confidence threshold */}
          <div>
            <label className="block text-xs gui-text-secondary mb-1">
              Confidence Threshold:{' '}
              {Math.round(
                extractionSettings.extractionConfidenceThreshold * 100,
              )}
              %
            </label>
            <Slider
              min={50}
              max={100}
              step={5}
              value={[extractionSettings.extractionConfidenceThreshold * 100]}
              onValueChange={(values) =>
                handleExtractionSettingsChange({
                  extractionConfidenceThreshold: (values[0] ?? 50) / 100,
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-[10px] gui-text-secondary mt-0.5">
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Extracted count */}
          {(data.extractedTitles?.length || 0) > 0 && (
            <div className="text-xs gui-text-secondary">
              {data.extractedTitles?.length} items extracted from this
              conversation
            </div>
          )}
        </div>
      )}
    </div>
  )
}
