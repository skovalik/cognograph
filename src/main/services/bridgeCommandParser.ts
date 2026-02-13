/**
 * Bridge Command Parser Service -- Main process NL command interpretation
 *
 * Interprets natural language commands from the Command Bar and converts them
 * into structured proposals with spatial positioning.
 *
 * Uses regex-based intent classification for simple commands (instant),
 * and the Canvas Agent for complex commands (1-3s LLM latency).
 *
 * Optimization #7: Simple commands resolved locally without LLM.
 */

import type {
  BridgeCommand,
  CommandIntent,
  ProposedChange,
  Proposal,
} from '../../shared/types/bridge'
import crypto from 'crypto'

// =============================================================================
// SYSTEM PROMPT FOR CANVAS AGENT
// =============================================================================

export const COMMAND_SYSTEM_PROMPT = `You are the Cognograph Bridge Command Interpreter.

Your job is to interpret natural language commands and convert them into spatial canvas operations.

Available operations:
- create_node: Create a node (types: note, task, conversation, project, orchestrator, artifact, text)
- link_nodes: Connect two nodes with an edge
- update_node: Modify a node's properties
- search_nodes: Find nodes by criteria
- get_context_chain: Read context for a node

When the user gives a command:
1. Classify the intent (create-workflow, create-node, connect-nodes, run-orchestrator, modify-canvas, query-canvas, control-agent, set-policy)
2. Determine which nodes/edges need to be created or modified
3. Suggest spatial positions (spread nodes with ~200px spacing)
4. Return a structured plan as tool calls in "propose" mode

Always explain what you understood and what you plan to do.`

// =============================================================================
// INTENT CLASSIFIER
// =============================================================================

export function classifyIntent(text: string): CommandIntent {
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

// =============================================================================
// WORKSPACE CONTEXT (passed from renderer)
// =============================================================================

export interface WorkspaceContext {
  nodeCount: number
  nodeTypes: Record<string, number>
  viewportCenter: { x: number; y: number }
  recentNodes: Array<{ id: string; title: string; type: string }>
}

// =============================================================================
// SIMPLE PROPOSAL GENERATION (Optimization #7 - No LLM needed)
// =============================================================================

function generateSimpleProposal(
  intent: CommandIntent,
  rawText: string,
  context: WorkspaceContext
): {
  parsed: BridgeCommand['parsed']
  proposalId: string
  changes: ProposedChange[]
} {
  const proposalId = crypto.randomUUID()
  const center = context.viewportCenter || { x: 0, y: 0 }

  switch (intent) {
    case 'create-node': {
      // Extract node type and title from text
      const match = rawText.match(/(?:create|add|new)\s+(?:a\s+)?(note|task|conversation|project|text|action)\s+(?:about\s+|called\s+|named\s+)?(.+)/i)
      const nodeType = match?.[1]?.toLowerCase() || 'note'
      const title = match?.[2]?.trim() || 'New Node'

      return {
        parsed: {
          intent,
          confidence: 0.9,
          targets: [],
          parameters: { nodeType, title },
          explanation: `Creating a new ${nodeType} node: "${title}"`,
        },
        proposalId,
        changes: [{
          id: crypto.randomUUID(),
          type: 'create-node',
          nodeType,
          nodeData: { title },
          position: {
            x: center.x + (Math.random() * 100 - 50),
            y: center.y + (Math.random() * 100 - 50),
          },
          agentNodeId: 'command-bar',
          agentName: 'Command Bar',
        }],
      }
    }
    case 'set-policy': {
      const budgetMatch = rawText.match(/\$(\d+(?:\.\d+)?)/i)
      const budget = budgetMatch ? parseFloat(budgetMatch[1]!) : undefined

      return {
        parsed: {
          intent,
          confidence: budget ? 0.9 : 0.5,
          targets: [],
          parameters: { budget },
          explanation: budget ? `Setting budget limit to $${budget}` : 'Updating policy settings',
        },
        proposalId,
        changes: [], // Policy changes don't create nodes/edges
      }
    }
    default: {
      return {
        parsed: {
          intent,
          confidence: 0.3,
          targets: [],
          parameters: {},
          explanation: `Intent recognized as "${intent}" but requires LLM for detailed interpretation`,
        },
        proposalId,
        changes: [],
      }
    }
  }
}

// =============================================================================
// MAIN PARSER
// =============================================================================

export async function parseCommand(
  rawText: string,
  workspaceContext: WorkspaceContext
): Promise<{
  parsed: BridgeCommand['parsed']
  proposalId: string
  changes: ProposedChange[]
  proposal?: Proposal
}> {
  // 1. Classify intent (lightweight, no LLM needed)
  const intent = classifyIntent(rawText)

  // 2. For simple, high-confidence intents, generate proposals locally
  if (intent === 'create-node' || intent === 'set-policy') {
    const result = generateSimpleProposal(intent, rawText, workspaceContext)

    // Create proposal object if there are changes
    const proposal: Proposal | undefined = result.changes.length > 0
      ? {
          id: result.proposalId,
          status: 'pending',
          changes: result.changes,
          createdAt: Date.now(),
          source: {
            type: 'command-bar',
            commandText: rawText,
          },
        }
      : undefined

    return { ...result, proposal }
  }

  // 3. For complex intents, use Canvas Agent (LLM)
  // This path would call the Canvas Agent with COMMAND_SYSTEM_PROMPT
  // For now, return a placeholder that indicates LLM is needed
  if (intent === 'create-workflow' || intent === 'modify-canvas' || intent === 'unknown') {
    // TODO: Integrate with Canvas Agent for complex command interpretation
    // For now, return a low-confidence result indicating LLM interpretation needed
    return {
      parsed: {
        intent,
        confidence: intent === 'unknown' ? 0.1 : 0.3,
        targets: [],
        parameters: {},
        explanation: intent === 'unknown'
          ? 'Command not recognized. Try "Create a note about..." or "Set up a workflow for..."'
          : `Complex "${intent}" command requires AI interpretation (not yet connected)`,
      },
      proposalId: crypto.randomUUID(),
      changes: [],
    }
  }

  // 4. For medium-complexity intents, generate basic proposals
  const result = generateSimpleProposal(intent, rawText, workspaceContext)
  return result
}
