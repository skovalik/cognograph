// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * ContextSection — Context injection settings (role, priority, label)
 * for nodes that carry ContextMetadata.
 *
 * Extracted from the per-type field components in PropertiesPanel.tsx
 * (NoteFields, ProjectFields, ArtifactFields) for reuse in
 * AdvancedSettingsModal.
 *
 * Adapts its UI to the node type — notes show "example" role option,
 * projects show "scope" role option, artifacts show "example" + injection
 * format, etc.
 */

import type { ContextMetadata, NodeData } from '@shared/types'
import { HelpCircle } from 'lucide-react'
import { useCallback } from 'react'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

// ---------------------------------------------------------------------------
// Inline HelpTooltip (self-contained — avoids cross-section dependency)
// ---------------------------------------------------------------------------

function HelpTooltip({ text }: { text: string }): JSX.Element {
  return (
    <span className="relative group ml-1 inline-flex items-center">
      <HelpCircle className="w-3 h-3 gui-text-secondary cursor-help" />
      <span className="absolute top-full left-0 mt-1 px-2 py-1.5 text-xs gui-text glass-fluid gui-panel border gui-border rounded shadow-lg whitespace-normal w-52 text-left hidden group-hover:block transition-opacity z-[100]">
        {text}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Role option sets per node type
// ---------------------------------------------------------------------------

type RoleOption = { value: string; label: string }

const NOTE_ROLES: RoleOption[] = [
  { value: 'reference', label: 'Reference (default)' },
  { value: 'instruction', label: 'Instruction (AI should follow)' },
  { value: 'example', label: 'Example (format/style guide)' },
  { value: 'background', label: 'Background (contextual info)' },
]

const PROJECT_ROLES: RoleOption[] = [
  { value: 'scope', label: 'Scope (defines project context)' },
  { value: 'reference', label: 'Reference (additional info)' },
  { value: 'instruction', label: 'Instruction (AI should follow)' },
  { value: 'background', label: 'Background (contextual info)' },
]

const ARTIFACT_ROLES: RoleOption[] = [
  { value: 'reference', label: 'Reference (code to use)' },
  { value: 'example', label: 'Example (format/style)' },
  { value: 'instruction', label: 'Instruction (follow this)' },
  { value: 'background', label: 'Background (context)' },
]

const DEFAULT_ROLES: RoleOption[] = [
  { value: 'reference', label: 'Reference' },
  { value: 'instruction', label: 'Instruction' },
  { value: 'background', label: 'Background' },
]

function getRolesForType(type: string): RoleOption[] {
  switch (type) {
    case 'note':
      return NOTE_ROLES
    case 'project':
      return PROJECT_ROLES
    case 'artifact':
      return ARTIFACT_ROLES
    default:
      return DEFAULT_ROLES
  }
}

function getDefaultRole(type: string): string {
  switch (type) {
    case 'project':
      return 'scope'
    default:
      return 'reference'
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ContextSectionProps {
  nodeId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContextSection({ nodeId }: ContextSectionProps): JSX.Element | null {
  const nodeData = useWorkspaceStore((state) => state.nodes.find((n) => n.id === nodeId)?.data)
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      updateNode(nodeId, { [field]: value } as Partial<NodeData>)
    },
    [nodeId, updateNode],
  )

  if (!nodeData) return null

  // Only node types with ContextMetadata context injection make sense here
  const supportedTypes = ['note', 'project', 'artifact', 'task', 'conversation']
  if (!supportedTypes.includes(nodeData.type)) {
    return (
      <p className="text-xs gui-text-secondary italic">
        Context injection is not available for {nodeData.type} nodes.
      </p>
    )
  }

  const data = nodeData as ContextMetadata & { type: string }
  const roles = getRolesForType(data.type)
  const defaultRole = getDefaultRole(data.type)

  // Priority options (same for all types that show them)
  const priorityOptions =
    data.type === 'note'
      ? [
          { value: 'low', label: 'Low (included if relevant)' },
          { value: 'medium', label: 'Medium (default)' },
          { value: 'high', label: 'High (always prominent)' },
        ]
      : [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium (default)' },
          { value: 'high', label: 'High (always prominent)' },
        ]

  return (
    <div className="pt-3">
      <p className="text-xs font-medium gui-text mb-2">
        Context Injection
        <HelpTooltip text="Controls how this node's content is presented to AI when connected to a conversation." />
      </p>

      <div className="space-y-2">
        {/* Role */}
        <div>
          <label className="block text-xs gui-text-secondary mb-1">
            Role
            <HelpTooltip text="How the AI interprets this content: Reference (info), Instruction (rules to follow), Example (format guide), Background (context)." />
          </label>
          <select
            value={data.contextRole || defaultRole}
            onChange={(e) => handleChange('contextRole', e.target.value)}
            className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs gui-text-secondary mb-1">
            Priority
            <HelpTooltip text="High priority content appears prominently in context. Low priority may be truncated if context limit reached." />
          </label>
          <select
            value={data.contextPriority || 'medium'}
            onChange={(e) => handleChange('contextPriority', e.target.value)}
            className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          >
            {priorityOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Label */}
        <div>
          <label className="block text-xs gui-text-secondary mb-1">
            Custom Label
            <HelpTooltip text="A descriptive label shown to the AI (e.g., 'Style Guide'). Helps AI understand what this content is for." />
          </label>
          <input
            type="text"
            value={data.contextLabel || ''}
            onChange={(e) => handleChange('contextLabel', e.target.value)}
            placeholder={
              data.type === 'project' ? 'e.g., Project Requirements' : 'e.g., Code Style Guide'
            }
            className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  )
}
