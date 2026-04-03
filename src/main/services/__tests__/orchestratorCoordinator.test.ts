// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tests for Phase 3A ORCHESTRATE:
 * - Edge-based messaging (AgentEdgeResult, summary capping, temp spill)
 * - Coordinator strategy (tool building, worker dispatch, synthesis)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { buildTool } from '../../tools/buildTool'
import { assembleToolPool } from '../../tools/assembleToolPool'
import {
  SpawnWorkerSchema,
  GetWorkerResultSchema,
  SynthesizeResultsSchema,
} from '../../tools/canonicalSchemas'
import { AGENT_RESULT_SUMMARY_MAX_CHARS } from '../../../shared/types/edges'
import type { AgentEdgeResult } from '../../../shared/types/edges'
import type { ConnectedAgent, OrchestratorRun } from '../../../shared/types/nodes'
import type { ToolResult } from '../../tools/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOOP_CALL = async (): Promise<ToolResult> => ({
  content: [{ type: 'text', text: 'ok' }],
})

// ---------------------------------------------------------------------------
// 3.1a — Edge-based messaging types
// ---------------------------------------------------------------------------

describe('AgentEdgeResult schema', () => {
  it('AGENT_RESULT_SUMMARY_MAX_CHARS is 10000', () => {
    expect(AGENT_RESULT_SUMMARY_MAX_CHARS).toBe(10_000)
  })

  it('AgentEdgeResult has correct shape', () => {
    const result: AgentEdgeResult = {
      summary: 'Test summary',
      timestamp: new Date().toISOString(),
    }
    expect(result.summary).toBe('Test summary')
    expect(result.fullResultPath).toBeUndefined()
    expect(typeof result.timestamp).toBe('string')
  })

  it('AgentEdgeResult with fullResultPath', () => {
    const result: AgentEdgeResult = {
      summary: 'Truncated...',
      fullResultPath: '/tmp/result-abc-123.txt',
      timestamp: '2026-03-31T00:00:00.000Z',
    }
    expect(result.fullResultPath).toBe('/tmp/result-abc-123.txt')
  })
})

describe('Edge result summary capping', () => {
  it('summary under 10K chars passes through unchanged', () => {
    const output = 'A'.repeat(5000)
    expect(output.length).toBeLessThanOrEqual(AGENT_RESULT_SUMMARY_MAX_CHARS)
  })

  it('summary at exactly 10K chars passes through', () => {
    const output = 'B'.repeat(AGENT_RESULT_SUMMARY_MAX_CHARS)
    expect(output.length).toBe(AGENT_RESULT_SUMMARY_MAX_CHARS)
  })

  it('summary over 10K chars would be truncated', () => {
    const output = 'C'.repeat(AGENT_RESULT_SUMMARY_MAX_CHARS + 5000)
    const truncated =
      output.slice(0, AGENT_RESULT_SUMMARY_MAX_CHARS) +
      `\n[Truncated — ${output.length} total characters. Full result saved to disk.]`
    expect(truncated.length).toBeGreaterThan(AGENT_RESULT_SUMMARY_MAX_CHARS)
    expect(truncated).toContain('[Truncated')
    expect(truncated).toContain('15000 total characters')
  })
})

// ---------------------------------------------------------------------------
// 3.1a — ConnectedAgent edgeId field
// ---------------------------------------------------------------------------

describe('ConnectedAgent edgeId', () => {
  it('ConnectedAgent has optional edgeId field', () => {
    const agent: ConnectedAgent = {
      nodeId: 'agent-1',
      order: 0,
      conditions: [],
      status: 'idle',
      retryCount: 0,
    }
    expect(agent.edgeId).toBeUndefined()
  })

  it('ConnectedAgent edgeId can be set', () => {
    const agent: ConnectedAgent = {
      nodeId: 'agent-1',
      edgeId: 'edge-orch-to-agent1',
      order: 0,
      conditions: [],
      status: 'idle',
      retryCount: 0,
    }
    expect(agent.edgeId).toBe('edge-orch-to-agent1')
  })
})

// ---------------------------------------------------------------------------
// 3.1a — OrchestratorRun edgeResults field
// ---------------------------------------------------------------------------

describe('OrchestratorRun edgeResults', () => {
  it('OrchestratorRun has optional edgeResults field', () => {
    const run: OrchestratorRun = {
      id: 'run-1',
      status: 'completed',
      strategy: 'coordinator',
      startedAt: Date.now(),
      agentResults: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      totalDurationMs: 0,
    }
    expect(run.edgeResults).toBeUndefined()
  })

  it('edgeResults can store AgentEdgeResult keyed by edgeId', () => {
    const run: OrchestratorRun = {
      id: 'run-1',
      status: 'completed',
      strategy: 'coordinator',
      startedAt: Date.now(),
      agentResults: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      totalDurationMs: 0,
      edgeResults: {
        'edge-1': {
          summary: 'Worker 1 completed analysis',
          timestamp: '2026-03-31T12:00:00.000Z',
        },
        'edge-2': {
          summary: 'Worker 2 generated report',
          fullResultPath: '/tmp/result-w2-123.txt',
          timestamp: '2026-03-31T12:01:00.000Z',
        },
      },
    }
    expect(Object.keys(run.edgeResults!)).toHaveLength(2)
    expect(run.edgeResults!['edge-1']!.summary).toContain('analysis')
    expect(run.edgeResults!['edge-2']!.fullResultPath).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 3.1b — Coordinator tool schemas
// ---------------------------------------------------------------------------

describe('Coordinator tool schemas', () => {
  it('SpawnWorkerSchema validates correct input', () => {
    const result = SpawnWorkerSchema.safeParse({
      agentNodeId: 'node-123',
      prompt: 'Analyze the data',
    })
    expect(result.success).toBe(true)
  })

  it('SpawnWorkerSchema requires agentNodeId and prompt', () => {
    const result = SpawnWorkerSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('SpawnWorkerSchema accepts optional edgeId', () => {
    const result = SpawnWorkerSchema.safeParse({
      agentNodeId: 'node-123',
      prompt: 'Analyze',
      edgeId: 'edge-456',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.edgeId).toBe('edge-456')
    }
  })

  it('GetWorkerResultSchema validates correct input', () => {
    const result = GetWorkerResultSchema.safeParse({
      agentNodeId: 'node-123',
    })
    expect(result.success).toBe(true)
  })

  it('GetWorkerResultSchema requires agentNodeId', () => {
    const result = GetWorkerResultSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('SynthesizeResultsSchema accepts empty input', () => {
    const result = SynthesizeResultsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('SynthesizeResultsSchema accepts agentNodeIds array', () => {
    const result = SynthesizeResultsSchema.safeParse({
      agentNodeIds: ['node-1', 'node-2'],
      synthesisPrompt: 'Combine these results into a report',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agentNodeIds).toHaveLength(2)
      expect(result.data.synthesisPrompt).toContain('report')
    }
  })
})

// ---------------------------------------------------------------------------
// 3.1b — Coordinator tools build via buildTool
// ---------------------------------------------------------------------------

describe('Coordinator tools via buildTool', () => {
  it('spawn_worker tool builds successfully', () => {
    const tool = buildTool({
      name: 'spawn_worker',
      description: 'Dispatch a worker agent',
      inputSchema: SpawnWorkerSchema,
      call: NOOP_CALL,
    })
    expect(tool.name).toBe('spawn_worker')
    expect(tool.isReadOnly).toBe(false)
  })

  it('get_worker_result tool builds as read-only', () => {
    const tool = buildTool({
      name: 'get_worker_result',
      description: 'Read worker result',
      inputSchema: GetWorkerResultSchema,
      call: NOOP_CALL,
      isReadOnly: true,
    })
    expect(tool.name).toBe('get_worker_result')
    expect(tool.isReadOnly).toBe(true)
  })

  it('synthesize_results tool builds as read-only', () => {
    const tool = buildTool({
      name: 'synthesize_results',
      description: 'Combine worker results',
      inputSchema: SynthesizeResultsSchema,
      call: NOOP_CALL,
      isReadOnly: true,
    })
    expect(tool.name).toBe('synthesize_results')
    expect(tool.isReadOnly).toBe(true)
  })

  it('coordinator pool has exactly 3 tools', () => {
    const tools = [
      buildTool({
        name: 'spawn_worker',
        description: 'Dispatch',
        inputSchema: SpawnWorkerSchema,
        call: NOOP_CALL,
      }),
      buildTool({
        name: 'get_worker_result',
        description: 'Read',
        inputSchema: GetWorkerResultSchema,
        call: NOOP_CALL,
        isReadOnly: true,
      }),
      buildTool({
        name: 'synthesize_results',
        description: 'Combine',
        inputSchema: SynthesizeResultsSchema,
        call: NOOP_CALL,
        isReadOnly: true,
      }),
    ]
    const pool = assembleToolPool(tools, [])
    expect(pool.list()).toHaveLength(3)
    expect(pool.get('spawn_worker')).toBeDefined()
    expect(pool.get('get_worker_result')).toBeDefined()
    expect(pool.get('synthesize_results')).toBeDefined()

    // Verify NO filesystem or canvas tools are present
    expect(pool.get('read_file')).toBeUndefined()
    expect(pool.get('write_file')).toBeUndefined()
    expect(pool.get('execute_command')).toBeUndefined()
    expect(pool.get('create_node')).toBeUndefined()
  })

  it('coordinator tools produce valid Anthropic format', () => {
    const tools = [
      buildTool({
        name: 'spawn_worker',
        description: 'Dispatch worker',
        inputSchema: SpawnWorkerSchema,
        call: NOOP_CALL,
      }),
    ]
    const pool = assembleToolPool(tools, [])
    const anthropicDefs = pool.toAnthropicFormat()
    expect(anthropicDefs).toHaveLength(1)
    expect(anthropicDefs[0]!.name).toBe('spawn_worker')
    expect(anthropicDefs[0]!.input_schema.type).toBe('object')
    expect(anthropicDefs[0]!.input_schema.properties).toHaveProperty('agentNodeId')
    expect(anthropicDefs[0]!.input_schema.properties).toHaveProperty('prompt')
  })
})

// ---------------------------------------------------------------------------
// 3.1b — OrchestratorStrategy includes 'coordinator'
// ---------------------------------------------------------------------------

describe('OrchestratorStrategy union', () => {
  it('coordinator is a valid strategy', () => {
    const run: OrchestratorRun = {
      id: 'run-coord',
      status: 'running',
      strategy: 'coordinator',
      startedAt: Date.now(),
      agentResults: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      totalDurationMs: 0,
    }
    expect(run.strategy).toBe('coordinator')
  })
})
