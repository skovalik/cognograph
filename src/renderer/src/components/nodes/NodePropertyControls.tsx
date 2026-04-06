// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { BooleanChip } from './widgets/BooleanChip'
import { PriorityIcon } from './widgets/PriorityIcon'
import { SelectChip } from './widgets/SelectChip'
import { StatusChip } from './widgets/StatusChip'

/**
 * INLINE_FIELDS: Maps node type to the compact inline property fields shown
 * in NodePropertyControls. Max 4 fields per node type.
 *
 * These are DIFFERENT from PropertyBadges — they are ultra-compact (20px height),
 * always visible in the footer/header area, and cycle on click.
 */
const INLINE_FIELDS: Record<string, string[]> = {
  task: ['status', 'priority'],
  note: ['noteMode'],
  conversation: ['provider', 'mode'],
  artifact: ['contentType'],
  project: ['color'],
  action: ['enabled'],
  orchestrator: ['strategy'],
}

// Options for select-type fields
const FIELD_OPTIONS: Record<string, string[]> = {
  noteMode: [
    'general',
    'persona',
    'reference',
    'examples',
    'background',
    'design-tokens',
    'page',
    'component',
    'content-model',
    'wp-config',
  ],
  provider: ['anthropic', 'openai', 'google', 'ollama', 'openrouter'],
  mode: ['chat', 'agent'],
  contentType: ['code', 'markdown', 'html', 'text', 'json', 'csv', 'svg', 'image', 'mermaid'],
  strategy: ['sequential', 'parallel', 'conditional'],
}

// Human-readable labels for field option values
const FIELD_LABELS: Record<string, Record<string, string>> = {
  noteMode: {
    general: 'General',
    persona: 'Persona',
    reference: 'Reference',
    examples: 'Examples',
    background: 'Background',
    'design-tokens': 'Tokens',
    page: 'Page',
    component: 'Component',
    'content-model': 'Model',
    'wp-config': 'WP Config',
  },
  provider: {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    ollama: 'Ollama',
    openrouter: 'OpenRouter',
  },
  mode: {
    chat: 'Chat',
    agent: 'Agent',
  },
  contentType: {
    code: 'Code',
    markdown: 'Markdown',
    html: 'HTML',
    text: 'Text',
    json: 'JSON',
    csv: 'CSV',
    svg: 'SVG',
    image: 'Image',
    mermaid: 'Diagram',
  },
  strategy: {
    sequential: 'Sequential',
    parallel: 'Parallel',
    conditional: 'Conditional',
  },
}

interface NodePropertyControlsProps {
  nodeId: string
  nodeType: string
  data: Record<string, unknown>
}

export const NodePropertyControls = memo(function NodePropertyControls({
  nodeId,
  nodeType,
  data,
}: NodePropertyControlsProps) {
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  const handleChange = useCallback(
    (fieldId: string, value: unknown) => {
      updateNode(nodeId, { [fieldId]: value })
    },
    [nodeId, updateNode],
  )

  const fields = INLINE_FIELDS[nodeType]
  if (!fields || fields.length === 0) return null

  return (
    <div className="node-property-controls">
      {fields.map((fieldId) => {
        const value = data[fieldId]

        // Status chip (task status)
        if (fieldId === 'status') {
          return (
            <StatusChip
              key={fieldId}
              value={(value as string) || 'todo'}
              onChange={(v) => handleChange(fieldId, v)}
            />
          )
        }

        // Priority icon (task priority)
        if (fieldId === 'priority') {
          return (
            <PriorityIcon
              key={fieldId}
              value={(value as string) || 'none'}
              onChange={(v) => handleChange(fieldId, v)}
            />
          )
        }

        // Boolean chip (action enabled)
        if (fieldId === 'enabled') {
          return (
            <BooleanChip
              key={fieldId}
              value={value !== false}
              onChange={(v) => handleChange(fieldId, v)}
              fieldName="Enabled"
            />
          )
        }

        // Select chip for enum fields
        if (FIELD_OPTIONS[fieldId]) {
          return (
            <SelectChip
              key={fieldId}
              value={(value as string) || FIELD_OPTIONS[fieldId][0]}
              options={FIELD_OPTIONS[fieldId]}
              labels={FIELD_LABELS[fieldId]}
              onChange={(v) => handleChange(fieldId, v)}
              fieldName={fieldId}
            />
          )
        }

        // Skip fields without a known widget
        return null
      })}
    </div>
  )
})
