import { notionService } from './notionService'
import type { OrchestratorRun } from '@shared/types'

// -----------------------------------------------------------------------------
// Execution Log Writer
// -----------------------------------------------------------------------------

interface ExecLogPayload {
  orchestratorId: string
  canvasId: string
  status: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  totalCostUSD: number
  model: string
  agentCount: number
  startedAt: string
  completedAt: string
  durationMs: number
  outputSummary?: string
}

class ExecLogWriter {

  async log(run: OrchestratorRun): Promise<void> {
    // Capture data synchronously
    const payload: ExecLogPayload = {
      orchestratorId: run.id,
      canvasId: run.workspaceId || 'unknown',
      status: run.status,
      totalInputTokens: run.totalInputTokens || 0,
      totalOutputTokens: run.totalOutputTokens || 0,
      totalCacheCreationTokens: this.sumCacheTokens(run, 'creation'),
      totalCacheReadTokens: this.sumCacheTokens(run, 'read'),
      totalCostUSD: run.totalCostUSD || 0,
      model: this.extractFirstModel(run),
      agentCount: run.agentResults?.length || 0,
      startedAt: new Date(run.startedAt).toISOString(),
      completedAt: new Date(run.completedAt || Date.now()).toISOString(),
      durationMs: run.totalDurationMs || 0,
      outputSummary: this.extractOutputSummary(run)
    }

    // Queue the write asynchronously (fire-and-forget)
    this.writeToNotion(payload).catch(err => {
      console.error('[ExecLogWriter] Failed to write to Notion:', err)
      // Error handling: payload is already captured, will retry via queue
    })
  }

  private sumCacheTokens(run: OrchestratorRun, type: 'creation' | 'read'): number {
    if (!run.agentResults) return 0

    return run.agentResults.reduce((sum, result) => {
      const tokens = type === 'creation'
        ? (result.cacheCreationTokens || 0)
        : (result.cacheReadTokens || 0)
      return sum + tokens
    }, 0)
  }

  private extractFirstModel(run: OrchestratorRun): string {
    // Extract model from run data or first agent's config
    if (run.model) return run.model
    if (run.agentResults && run.agentResults.length > 0) {
      const firstAgent = run.agentResults[0]
      if (firstAgent.model) return firstAgent.model
    }
    return 'claude-sonnet-4-20250514'
  }

  private extractOutputSummary(run: OrchestratorRun): string | undefined {
    // Get last assistant message from the final agent, truncated to 1500 chars
    if (!run.agentResults || run.agentResults.length === 0) return undefined

    const lastAgent = run.agentResults[run.agentResults.length - 1]
    if (!lastAgent) return undefined

    const output = lastAgent.output || ''

    return output.length > 1500
      ? output.slice(0, 1497) + '...'
      : output
  }

  private async writeToNotion(payload: ExecLogPayload): Promise<void> {
    const config = notionService.getConfig()
    if (!config) {
      console.warn('[ExecLogWriter] Notion not configured, skipping exec log write')
      return
    }

    const result = await notionService.request(
      async (client) => {
        return await client.pages.create({
          parent: { database_id: config.execLogDbId },
          properties: {
            'Orchestrator ID': {
              title: [{ text: { content: payload.orchestratorId } }]
            },
            'Canvas ID': {
              rich_text: [{ text: { content: payload.canvasId } }]
            },
            'Status': {
              select: { name: this.mapStatus(payload.status) }
            },
            'Model': {
              rich_text: [{ text: { content: payload.model } }]
            },
            'Input Tokens': {
              number: payload.totalInputTokens
            },
            'Output Tokens': {
              number: payload.totalOutputTokens
            },
            'Cache Creation Tokens': {
              number: payload.totalCacheCreationTokens || 0
            },
            'Cache Read Tokens': {
              number: payload.totalCacheReadTokens || 0
            },
            'Cost (USD)': {
              number: payload.totalCostUSD
            },
            'Agent Count': {
              number: payload.agentCount
            },
            'Duration (ms)': {
              number: payload.durationMs
            },
            'Started At': {
              date: { start: payload.startedAt }
            },
            'Completed At': {
              date: { start: payload.completedAt }
            },
            ...(payload.outputSummary ? {
              'Output Summary': {
                rich_text: [{ text: { content: payload.outputSummary } }]
              }
            } : {})
          }
        })
      },
      'createExecLog'
    )

    if (!result.success) {
      console.error('[ExecLogWriter] Failed to write exec log:', result.error)
      // Errors will be queued by the persistent queue mechanism
    }
  }

  private mapStatus(status: string): string {
    // Map orchestrator status to Notion select options
    const statusMap: Record<string, string> = {
      'completed': 'Completed',
      'completed-with-errors': 'Partial',
      'failed': 'Failed',
      'cancelled': 'Cancelled',
      'aborted': 'Cancelled',
      'error': 'Error'
    }
    return statusMap[status] || 'Unknown'
  }
}

// Singleton instance
export const execLogWriter = new ExecLogWriter()
