// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * AgentSection — Agent preset, memory, settings, and run history for
 * conversation nodes running in agent mode.
 *
 * Extracted from the ConversationFields section of PropertiesPanel.tsx
 * for reuse in AdvancedSettingsModal.
 *
 * Only renders content when the node is a conversation in agent mode.
 */

import type { ConversationNodeData, NodeData } from '@shared/types'
// Help tooltip — duplicated locally so extracted section stays self-contained
import { HelpCircle } from 'lucide-react'
import { useCallback } from 'react'
import { AGENT_PRESETS, getPresetById } from '../../../constants/agentPresets'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { AgentMemoryViewer } from '../../agent/AgentMemoryViewer'
import { AgentRunHistoryViewer } from '../../agent/AgentRunHistoryViewer'
import { AgentSettingsEditor } from '../../agent/AgentSettingsEditor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui'

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
// Props
// ---------------------------------------------------------------------------

export interface AgentSectionProps {
  nodeId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentSection({ nodeId }: AgentSectionProps): JSX.Element | null {
  const nodeData = useWorkspaceStore((state) => state.nodes.find((n) => n.id === nodeId)?.data)
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      updateNode(nodeId, { [field]: value } as Partial<NodeData>)
    },
    [nodeId, updateNode],
  )

  if (!nodeData || nodeData.type !== 'conversation') return null

  const data = nodeData as ConversationNodeData

  // Only render when in agent mode
  if (data.mode !== 'agent') {
    return (
      <p className="text-xs gui-text-secondary italic">
        Switch this conversation to Agent mode to configure agent settings.
      </p>
    )
  }

  return (
    <>
      <div className="space-y-1">
        <label className="panel-section-label">
          Agent Preset
          <HelpTooltip text="Pre-configured agent behaviors: Research Assistant explores topics deeply, Task Manager organizes work, Code Helper writes and explains code, General Purpose handles any task." />
        </label>
        <Select
          value={data.agentPreset || 'custom'}
          onValueChange={(v) => {
            const preset = getPresetById(v)
            if (preset) handleChange('agentPreset', v)
          }}
        >
          <SelectTrigger className="w-full h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Agent Deep UI Components */}
      <AgentMemoryViewer
        nodeId={data.id || ''}
        memory={
          data.agentMemory || {
            entries: [],
            maxEntries: 50,
            maxKeyLength: 100,
            maxValueLength: 10000,
          }
        }
        onChange={(memory) => handleChange('agentMemory', memory)}
      />

      <AgentSettingsEditor
        nodeId={data.id || ''}
        settings={data.agentSettings || {}}
        preset={data.agentPreset || 'custom'}
        onChange={(settings) => {
          handleChange('agentSettings', settings)
          handleChange('agentPreset', 'custom')
        }}
      />

      <AgentRunHistoryViewer nodeId={data.id || ''} history={data.agentRunHistory || []} />
    </>
  )
}
