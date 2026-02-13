/**
 * Command Bar Store -- Natural language command interface state
 *
 * Manages the command bar visibility, input state, command history,
 * and suggestions. Submits commands to the main process for parsing
 * and proposal generation.
 *
 * Includes Optimization #7: Optimistic command preview via regex-based
 * intent classification before LLM response arrives.
 */

import { create } from 'zustand'
import type {
  BridgeCommand,
  CommandSuggestion,
  CommandStatus,
  CommandIntent,
} from '@shared/types/bridge'
import { useProposalStore } from './proposalStore'
import type { Proposal } from '@shared/types/bridge'

// =============================================================================
// OPTIMISTIC PREVIEW (Optimization #7)
// Instant regex preview hides 1-3s LLM latency
// =============================================================================

function classifyIntent(text: string): CommandIntent {
  const lower = text.toLowerCase()

  if (lower.match(/^(create|add|new)\s+(a\s+)?(note|task|node)/)) return 'create-node'
  if (lower.match(/^(set up|create|build)\s+(a\s+)?workflow/)) return 'create-workflow'
  if (lower.match(/^(connect|link)\s/)) return 'connect-nodes'
  if (lower.match(/^(run|start|execute)\s/)) return 'run-orchestrator'
  if (lower.match(/^(move|arrange|organize)\s/)) return 'modify-canvas'
  if (lower.match(/^(how many|what|list|show|find)\s/)) return 'query-canvas'
  if (lower.match(/^(pause|stop|resume|abort)\s/)) return 'control-agent'
  if (lower.match(/^(set|change|update)\s+(budget|limit|policy)/)) return 'set-policy'

  return 'unknown'
}

/** Generate an optimistic preview description for immediate feedback */
function getOptimisticDescription(text: string, intent: CommandIntent): string {
  switch (intent) {
    case 'create-node': return 'Creating a new node...'
    case 'create-workflow': return 'Setting up a workflow...'
    case 'connect-nodes': return 'Connecting nodes...'
    case 'run-orchestrator': return 'Starting orchestrator...'
    case 'modify-canvas': return 'Modifying canvas layout...'
    case 'query-canvas': return 'Searching canvas...'
    case 'control-agent': return 'Controlling agent...'
    case 'set-policy': return 'Updating policy...'
    default: return 'Interpreting command...'
  }
}

// =============================================================================
// TEMPLATE SUGGESTIONS
// =============================================================================

const TEMPLATE_SUGGESTIONS: CommandSuggestion[] = [
  { text: 'Create a new note about ', intent: 'create-node', description: 'Create a note node', source: 'template' },
  { text: 'Set up a workflow for ', intent: 'create-workflow', description: 'Create orchestrated workflow', source: 'template' },
  { text: 'Connect all notes to ', intent: 'connect-nodes', description: 'Create edges between nodes', source: 'template' },
  { text: 'Run the ', intent: 'run-orchestrator', description: 'Start an orchestrator', source: 'template' },
  { text: 'Set budget limit to $', intent: 'set-policy', description: 'Configure budget', source: 'template' },
]

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface CommandBarStoreState {
  // Visibility
  isVisible: boolean

  // Current command
  currentCommand: BridgeCommand | null
  currentStatus: CommandStatus

  // Optimistic preview
  optimisticIntent: CommandIntent | null

  // History
  history: BridgeCommand[]
  maxHistory: number

  // Suggestions
  suggestions: CommandSuggestion[]

  // Actions
  submitCommand: (text: string) => Promise<void>
  cancelCommand: () => void
  toggleVisibility: () => void
  setVisibility: (visible: boolean) => void
  loadSuggestions: (inputText: string) => void
  clearHistory: () => void
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useCommandBarStore = create<CommandBarStoreState>((set, get) => ({
  isVisible: false,  // Hidden by default, toggle with keyboard shortcut
  currentCommand: null,
  currentStatus: 'composing',
  optimisticIntent: null,
  history: [],
  maxHistory: 100,
  suggestions: [],

  submitCommand: async (text: string): Promise<void> => {
    // Optimization #7: Instant optimistic preview
    const intent = classifyIntent(text)
    const optimisticDescription = getOptimisticDescription(text, intent)

    const command: BridgeCommand = {
      id: crypto.randomUUID(),
      raw: text,
      status: 'parsing',
      createdAt: Date.now(),
    }

    set({
      currentCommand: command,
      currentStatus: 'parsing',
      optimisticIntent: intent,
    })

    try {
      // Check if bridge API is available (main process command parser)
      if (window.api?.bridge?.submitCommand) {
        const result = await window.api.bridge.submitCommand(text)

        if (result.success && result.data) {
          const parsed = result.data.parsed
          const proposalId = result.data.proposalId

          command.parsed = parsed
          command.proposalId = proposalId
          command.status = 'proposed'

          set({
            currentCommand: command,
            currentStatus: 'proposed',
            optimisticIntent: null,
            history: [command, ...get().history].slice(0, get().maxHistory),
          })

          // If a proposal was generated, add it to proposalStore
          if (result.data.proposal) {
            useProposalStore.getState().addProposal(result.data.proposal as Proposal)
          }
        } else {
          command.status = 'failed'
          command.error = result.error || 'Failed to parse command'

          set({
            currentCommand: command,
            currentStatus: 'failed',
            optimisticIntent: null,
          })
        }
      } else {
        // Bridge API not available -- use local-only fallback
        // Generate a simple proposal based on regex intent classification
        command.parsed = {
          intent,
          confidence: intent === 'unknown' ? 0.1 : 0.5,
          targets: [],
          parameters: {},
          explanation: optimisticDescription,
        }
        command.status = intent === 'unknown' ? 'failed' : 'proposed'
        command.error = intent === 'unknown' ? 'Command not recognized. Try "Create a note about..." or "Set up a workflow for..."' : undefined

        set({
          currentCommand: command,
          currentStatus: command.status as CommandStatus,
          optimisticIntent: null,
          history: [command, ...get().history].slice(0, get().maxHistory),
        })
      }
    } catch (err) {
      command.status = 'failed'
      command.error = (err as Error).message

      set({
        currentCommand: command,
        currentStatus: 'failed',
        optimisticIntent: null,
      })
    }
  },

  cancelCommand: (): void => {
    set({ currentCommand: null, currentStatus: 'composing', optimisticIntent: null })
  },

  toggleVisibility: (): void => {
    set((state) => ({ isVisible: !state.isVisible }))
  },

  setVisibility: (visible): void => {
    set({ isVisible: visible })
  },

  loadSuggestions: (inputText: string): void => {
    const history = get().history
    const suggestions: CommandSuggestion[] = []

    if (!inputText.trim()) {
      set({ suggestions: [] })
      return
    }

    // Recent commands matching input
    for (const cmd of history.slice(0, 5)) {
      if (cmd.raw.toLowerCase().includes(inputText.toLowerCase())) {
        suggestions.push({
          text: cmd.raw,
          intent: cmd.parsed?.intent || 'unknown',
          description: cmd.parsed?.explanation || '',
          source: 'recent',
        })
      }
    }

    // Template suggestions matching input
    for (const tmpl of TEMPLATE_SUGGESTIONS) {
      if (
        tmpl.text.toLowerCase().includes(inputText.toLowerCase()) ||
        inputText.toLowerCase().includes(tmpl.text.slice(0, 5).toLowerCase())
      ) {
        suggestions.push(tmpl)
      }
    }

    set({ suggestions: suggestions.slice(0, 8) })
  },

  clearHistory: (): void => {
    set({ history: [] })
  },
}))
