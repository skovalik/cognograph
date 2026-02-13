import { describe, it, expect } from 'vitest'
import { classifyIntent, parseCommand, type WorkspaceContext } from '../bridgeCommandParser'

// =============================================================================
// TEST HELPERS
// =============================================================================

const DEFAULT_CONTEXT: WorkspaceContext = {
  nodeCount: 10,
  nodeTypes: { note: 5, task: 3, conversation: 2 },
  viewportCenter: { x: 0, y: 0 },
  recentNodes: [
    { id: 'node-1', title: 'Research Notes', type: 'note' },
    { id: 'node-2', title: 'Sprint Tasks', type: 'project' },
  ],
}

// =============================================================================
// TESTS
// =============================================================================

describe('bridgeCommandParser', () => {
  describe('classifyIntent', () => {
    it('classifies create-node commands', () => {
      expect(classifyIntent('Create a note about testing')).toBe('create-node')
      expect(classifyIntent('Add a task for review')).toBe('create-node')
      expect(classifyIntent('New note about AI workflows')).toBe('create-node')
    })

    it('classifies create-workflow commands', () => {
      expect(classifyIntent('Set up a workflow for content creation')).toBe('create-workflow')
      expect(classifyIntent('Create a workflow pipeline')).toBe('create-workflow')
      expect(classifyIntent('Build a workflow for research')).toBe('create-workflow')
    })

    it('classifies connect-nodes commands', () => {
      expect(classifyIntent('Connect the research notes to the project')).toBe('connect-nodes')
      expect(classifyIntent('Link all tasks together')).toBe('connect-nodes')
    })

    it('classifies run-orchestrator commands', () => {
      expect(classifyIntent('Run the analysis pipeline')).toBe('run-orchestrator')
      expect(classifyIntent('Start the research workflow')).toBe('run-orchestrator')
      expect(classifyIntent('Execute the content generation')).toBe('run-orchestrator')
    })

    it('classifies modify-canvas commands', () => {
      expect(classifyIntent('Move all task nodes to the right')).toBe('modify-canvas')
      expect(classifyIntent('Arrange the notes in a grid')).toBe('modify-canvas')
      expect(classifyIntent('Organize by type')).toBe('modify-canvas')
    })

    it('classifies query-canvas commands', () => {
      expect(classifyIntent('How many nodes are connected to the project?')).toBe('query-canvas')
      expect(classifyIntent('What tasks are overdue?')).toBe('query-canvas')
      expect(classifyIntent('List all notes')).toBe('query-canvas')
      expect(classifyIntent('Show all agents')).toBe('query-canvas')
      expect(classifyIntent('Find nodes about testing')).toBe('query-canvas')
    })

    it('classifies control-agent commands', () => {
      expect(classifyIntent('Pause the code agent')).toBe('control-agent')
      expect(classifyIntent('Stop all agents')).toBe('control-agent')
      expect(classifyIntent('Resume the research agent')).toBe('control-agent')
      expect(classifyIntent('Abort the current run')).toBe('control-agent')
    })

    it('classifies set-policy commands', () => {
      expect(classifyIntent('Set budget limit to $5')).toBe('set-policy')
      expect(classifyIntent('Change budget to $10')).toBe('set-policy')
      expect(classifyIntent('Update policy for agents')).toBe('set-policy')
    })

    it('returns unknown for unrecognizable commands', () => {
      expect(classifyIntent('xyzzy magic nonsense')).toBe('unknown')
      expect(classifyIntent('hello world')).toBe('unknown')
    })
  })

  describe('parseCommand', () => {
    it('generates proposal for create-node command', async () => {
      const result = await parseCommand('Create a note about testing', DEFAULT_CONTEXT)

      expect(result.parsed).toBeDefined()
      expect(result.parsed!.intent).toBe('create-node')
      expect(result.parsed!.confidence).toBeGreaterThanOrEqual(0.9)
      expect(result.proposalId).toBeDefined()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].type).toBe('create-node')
      expect(result.changes[0].nodeType).toBe('note')
      expect(result.changes[0].nodeData?.title).toBe('testing')
      expect(result.changes[0].position).toBeDefined()
    })

    it('generates proposal for create task command', async () => {
      const result = await parseCommand('Create a task called Review PR', DEFAULT_CONTEXT)

      expect(result.changes[0].nodeType).toBe('task')
      expect(result.changes[0].nodeData?.title).toBe('Review PR')
    })

    it('creates a Proposal object when changes exist', async () => {
      const result = await parseCommand('Create a note about widgets', DEFAULT_CONTEXT)

      expect(result.proposal).toBeDefined()
      expect(result.proposal!.status).toBe('pending')
      expect(result.proposal!.changes).toHaveLength(1)
      expect(result.proposal!.source.type).toBe('command-bar')
      expect(result.proposal!.source.commandText).toBe('Create a note about widgets')
    })

    it('parses budget from set-policy command', async () => {
      const result = await parseCommand('Set budget limit to $5.50', DEFAULT_CONTEXT)

      expect(result.parsed!.intent).toBe('set-policy')
      expect(result.parsed!.parameters.budget).toBe(5.50)
      expect(result.changes).toHaveLength(0) // Policy changes don't create nodes
    })

    it('returns low confidence for unknown commands', async () => {
      const result = await parseCommand('xyzzy magic', DEFAULT_CONTEXT)

      expect(result.parsed!.intent).toBe('unknown')
      expect(result.parsed!.confidence).toBeLessThanOrEqual(0.1)
      expect(result.changes).toHaveLength(0)
    })

    it('positions new nodes near viewport center', async () => {
      const context: WorkspaceContext = {
        ...DEFAULT_CONTEXT,
        viewportCenter: { x: 500, y: 300 },
      }

      const result = await parseCommand('Create a note about test', context)

      const pos = result.changes[0].position!
      // Should be within 50px of viewport center (random offset)
      expect(pos.x).toBeGreaterThanOrEqual(450)
      expect(pos.x).toBeLessThanOrEqual(550)
      expect(pos.y).toBeGreaterThanOrEqual(250)
      expect(pos.y).toBeLessThanOrEqual(350)
    })
  })
})
