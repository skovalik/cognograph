// =============================================================================
// agentPresets.ts -- Built-in agent preset templates
//
// Presets are pre-configured templates that set initial agentSettings,
// system prompt prefix, and suggested connections. They are stored as a
// constant registry in the renderer, not as persisted data.
// =============================================================================

import type { AgentPreset, AgentSettings } from '@shared/types'
import { DEFAULT_AGENT_SETTINGS } from '@shared/types'

// -----------------------------------------------------------------------------
// Built-In Presets
// -----------------------------------------------------------------------------

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'canvas',
    name: 'Canvas Agent',
    description: 'Organizes and manipulates nodes on the spatial canvas.',
    icon: 'layout-grid',
    systemPromptPrefix:
      'You are a spatial canvas organizer. Your job is to help the user arrange, connect, and manage nodes on their workspace canvas. Focus on creating clear visual structures, meaningful connections, and organized layouts.',
    agentSettings: {
      canCreateNodes: true,
      canDeleteNodes: true,
      canModifyNodes: true,
      canCreateEdges: true,
      canDeleteEdges: true,
      autoExecuteTools: true,
      maxToolCallsPerTurn: 20,
      scopeMode: 'workspace'
    },
    suggestedConnections: ['note', 'task', 'project']
  },
  {
    id: 'code',
    name: 'Code Agent',
    description: 'Reads, writes, and edits code files. Runs tests and builds.',
    icon: 'code-2',
    systemPromptPrefix:
      'You are a code assistant with filesystem access. You can read and write files, run shell commands, and help the user implement features, fix bugs, and refactor code. Always verify changes by reading files after writing them.',
    agentSettings: {
      canCreateNodes: true,
      canDeleteNodes: false,
      canModifyNodes: true,
      canCreateEdges: true,
      canDeleteEdges: false,
      canReadFiles: true,
      canWriteFiles: true,
      canExecuteCommands: true,
      autoExecuteTools: false, // Require confirmation for destructive ops
      maxToolCallsPerTurn: 50,
      scopeMode: 'connected'
    },
    suggestedConnections: ['artifact']
  },
  {
    id: 'research',
    name: 'Research Agent',
    description: 'Gathers information and creates structured notes from findings.',
    icon: 'search',
    systemPromptPrefix:
      'You are a research assistant. Your job is to help the user gather, organize, and synthesize information. Create well-structured notes from your findings and connect them to relevant existing nodes.',
    agentSettings: {
      canCreateNodes: true,
      canDeleteNodes: false,
      canModifyNodes: true,
      canCreateEdges: true,
      canDeleteEdges: false,
      autoExecuteTools: true,
      maxToolCallsPerTurn: 30,
      scopeMode: 'connected'
    },
    suggestedConnections: ['note', 'artifact']
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Configure your own tools, permissions, and behavior.',
    icon: 'settings-2',
    agentSettings: {
      // Empty -- resolvePresetSettings() returns DEFAULT_AGENT_SETTINGS
    },
    suggestedConnections: []
  }
]

// -----------------------------------------------------------------------------
// Preset Helpers
// -----------------------------------------------------------------------------

/**
 * Merge preset's agentSettings with DEFAULT_AGENT_SETTINGS.
 * The preset overlays on top of defaults — it does not replace them.
 * Order matters: { ...defaults, ...preset } means preset values win.
 */
export function resolvePresetSettings(
  preset: AgentPreset,
  baseSettings?: Partial<AgentSettings>
): AgentSettings {
  return {
    ...DEFAULT_AGENT_SETTINGS,
    ...(baseSettings || {}),
    ...preset.agentSettings
  }
}

/**
 * Find a preset by ID from the built-in registry.
 */
export function getPresetById(id: string): AgentPreset | undefined {
  return AGENT_PRESETS.find((p) => p.id === id)
}
