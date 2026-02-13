// =============================================================================
// ACTION AI STREAMING SERVICE
// =============================================================================
// Handles streaming responses for real-time configuration preview

import type {
  AIStreamingState,
  AIConfigResponse,
  AIGeneratedConfig,
  AIActionContext,
  AIStreamingPhase
} from '@shared/actionTypes'
import { buildPrompt, parseAIResponse } from './actionAIService'
import { aiConfigAnalytics } from './aiConfigAnalytics'

// =============================================================================
// LINE-DELIMITED JSON PARSER
// =============================================================================

interface ParsedLine {
  phase: AIStreamingPhase | 'questions'
  trigger?: unknown
  conditions?: unknown[]
  step?: unknown
  questions?: unknown[]
  suggestedTitle?: string
  reasoning?: string
}

class LineDelimitedJSONParser {
  private buffer = ''
  private parsedLines: ParsedLine[] = []

  feed(chunk: string): { newItems: ParsedLine[]; complete: boolean } {
    this.buffer += chunk
    const newItems: ParsedLine[] = []

    // Split on newlines
    const lines = this.buffer.split('\n')

    // Keep incomplete last line in buffer
    this.buffer = lines.pop() || ''

    // Parse complete lines
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const parsed = JSON.parse(trimmed) as ParsedLine
        this.parsedLines.push(parsed)
        newItems.push(parsed)
      } catch {
        // Try to extract from partial JSON
        const partial = this.tryExtractPartial(trimmed)
        if (partial) {
          this.parsedLines.push(partial)
          newItems.push(partial)
        }
      }
    }

    const complete = newItems.some(item => item.phase === 'complete')
    return { newItems, complete }
  }

  private tryExtractPartial(text: string): ParsedLine | null {
    // Look for phase indicator
    const phaseMatch = text.match(/"phase"\s*:\s*"(\w+)"/)
    if (!phaseMatch) return null

    const phase = phaseMatch[1] as AIStreamingPhase

    try {
      // Try to parse the whole thing
      return JSON.parse(text)
    } catch {
      // Return just the phase
      return { phase }
    }
  }

  getConfig(): AIConfigResponse {
    const trigger = this.parsedLines.find(l => l.phase === 'trigger')?.trigger
    const conditions = this.parsedLines.find(l => l.phase === 'conditions')?.conditions || []
    const steps = this.parsedLines.filter(l => l.phase === 'steps').map(l => l.step)
    const complete = this.parsedLines.find(l => l.phase === 'complete')
    const questions = this.parsedLines.find(l => l.phase === 'questions')?.questions

    if (questions && Array.isArray(questions)) {
      return {
        confidence: 'low',
        questions: questions as AIConfigResponse['questions'],
        reasoning: complete?.reasoning || ''
      }
    }

    return {
      confidence: 'high',
      config: {
        trigger: trigger as AIGeneratedConfig['trigger'],
        conditions: conditions as AIGeneratedConfig['conditions'],
        actions: steps as AIGeneratedConfig['actions'],
        explanation: ''
      },
      suggestedTitle: complete?.suggestedTitle,
      reasoning: complete?.reasoning || ''
    }
  }

  reset(): void {
    this.buffer = ''
    this.parsedLines = []
  }
}

// =============================================================================
// STREAMING STATE MANAGER
// =============================================================================

export type StreamingCallback = (state: AIStreamingState) => void
export type ErrorCallback = (error: Error) => void
export type CompleteCallback = (response: AIConfigResponse) => void

interface StreamingSession {
  abortController: AbortController
  parser: LineDelimitedJSONParser
  phaseStartTime: number
  currentPhase: AIStreamingPhase
}

// =============================================================================
// STREAMING SERVICE
// =============================================================================

class ActionAIStreamingService {
  private activeSession: StreamingSession | null = null

  // -------------------------------------------------------------------------
  // Start Streaming
  // -------------------------------------------------------------------------

  async startStreaming(
    description: string,
    context: AIActionContext,
    connectorId: string | undefined,
    callbacks: {
      onUpdate: StreamingCallback
      onError: ErrorCallback
      onComplete: CompleteCallback
    }
  ): Promise<void> {
    // Cancel any existing session
    this.cancel()

    // Create new session
    this.activeSession = {
      abortController: new AbortController(),
      parser: new LineDelimitedJSONParser(),
      phaseStartTime: Date.now(),
      currentPhase: 'analyzing'
    }

    const { onUpdate, onError, onComplete } = callbacks

    // Initial state
    onUpdate({
      phase: 'analyzing',
      partialConfig: {},
      message: 'Analyzing your description...'
    })

    try {
      // Build prompt
      const { systemPrompt, userPrompt } = buildPrompt(description, context)

      // Check if streaming is supported
      const supportsStreaming = await this.checkStreamingSupport(connectorId)

      if (supportsStreaming) {
        await this.doStreamingCall(
          systemPrompt,
          userPrompt,
          connectorId,
          onUpdate,
          onComplete
        )
      } else {
        await this.doSimulatedStreaming(
          systemPrompt,
          userPrompt,
          connectorId,
          onUpdate,
          onComplete
        )
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Cancelled, don't report as error
        return
      }
      onError(error as Error)
    } finally {
      this.activeSession = null
    }
  }

  // -------------------------------------------------------------------------
  // Streaming Call (if supported)
  // -------------------------------------------------------------------------

  private async doStreamingCall(
    systemPrompt: string,
    userPrompt: string,
    connectorId: string | undefined,
    onUpdate: StreamingCallback,
    onComplete: CompleteCallback
  ): Promise<void> {
    if (!this.activeSession) return

    const session = this.activeSession

    // Use window.api for LLM call with streaming
    // Note: This assumes the API supports streaming. If not, fallback will be used.
    const streamResponse = await window.api.llm.stream?.({
      systemPrompt,
      userPrompt,
      connectorId,
      signal: session.abortController.signal
    })

    if (!streamResponse) {
      // Streaming not available, fallback
      await this.doSimulatedStreaming(systemPrompt, userPrompt, connectorId, onUpdate, onComplete)
      return
    }

    // Process streaming response
    for await (const chunk of streamResponse) {
      if (session.abortController.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const { newItems, complete } = session.parser.feed(chunk)

      for (const item of newItems) {
        const phase = item.phase as AIStreamingPhase
        if (phase !== session.currentPhase) {
          aiConfigAnalytics.trackStreamingPhase(session.currentPhase)
          session.currentPhase = phase
          session.phaseStartTime = Date.now()
        }

        onUpdate(this.buildStreamingState(session.parser, phase))
      }

      if (complete) {
        const configResponse = session.parser.getConfig()
        onComplete(configResponse)
        return
      }
    }

    // Stream ended without complete marker
    const finalResponse = session.parser.getConfig()
    onComplete(finalResponse)
  }

  // -------------------------------------------------------------------------
  // Simulated Streaming (fallback)
  // -------------------------------------------------------------------------

  private async doSimulatedStreaming(
    systemPrompt: string,
    userPrompt: string,
    connectorId: string | undefined,
    onUpdate: StreamingCallback,
    onComplete: CompleteCallback
  ): Promise<void> {
    if (!this.activeSession) return

    const session = this.activeSession

    // Show analyzing phase
    onUpdate({
      phase: 'analyzing',
      partialConfig: {},
      message: 'Analyzing your description...'
    })

    await this.delay(500)
    if (session.abortController.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    // Make the actual LLM call
    const response = await window.api.llm.extract({
      systemPrompt,
      userPrompt,
      maxTokens: 2048
    })

    if (session.abortController.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    // Check for API errors first
    if (!response.success) {
      throw new Error(response.error?.message || 'LLM call failed')
    }

    // Ensure we have content to parse
    if (!response.data) {
      throw new Error('LLM returned empty response')
    }

    // Parse the content string (not the response object)
    const parsed = parseAIResponse(response.data)

    // Validate parsed response has either config or questions
    if (!parsed.config && (!parsed.questions || parsed.questions.length === 0)) {
      throw new Error(parsed.reasoning || 'AI response missing both config and questions')
    }

    // If questions, show immediately
    if (parsed.questions && parsed.questions.length > 0) {
      onComplete(parsed)
      return
    }

    // Otherwise, reveal config progressively
    if (parsed.config) {
      // Show trigger
      onUpdate({
        phase: 'trigger',
        partialConfig: { trigger: parsed.config.trigger },
        message: 'Detected trigger...'
      })
      aiConfigAnalytics.trackStreamingPhase('trigger')

      await this.delay(300)
      if (session.abortController.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      // Show conditions
      if (parsed.config.conditions.length > 0) {
        onUpdate({
          phase: 'conditions',
          partialConfig: {
            trigger: parsed.config.trigger,
            conditions: parsed.config.conditions
          },
          message: 'Checking conditions...'
        })
        aiConfigAnalytics.trackStreamingPhase('conditions')

        await this.delay(200)
      }

      // Show steps one by one
      for (let i = 0; i < parsed.config.actions.length; i++) {
        if (session.abortController.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }

        onUpdate({
          phase: 'steps',
          partialConfig: {
            trigger: parsed.config.trigger,
            conditions: parsed.config.conditions,
            actions: parsed.config.actions.slice(0, i + 1)
          },
          currentStep: i + 1,
          message: `Building step ${i + 1}...`
        })

        await this.delay(200)
      }
      aiConfigAnalytics.trackStreamingPhase('steps')

      // Complete
      onUpdate({
        phase: 'complete',
        partialConfig: parsed.config,
        message: 'Configuration ready!'
      })
      aiConfigAnalytics.trackStreamingPhase('complete')
    }

    onComplete(parsed)
  }

  // -------------------------------------------------------------------------
  // Helper Methods
  // -------------------------------------------------------------------------

  private buildStreamingState(
    parser: LineDelimitedJSONParser,
    phase: AIStreamingPhase
  ): AIStreamingState {
    const config = parser.getConfig()

    const messages: Record<AIStreamingPhase, string> = {
      analyzing: 'Analyzing your description...',
      trigger: 'Detected trigger...',
      conditions: 'Checking conditions...',
      steps: 'Building action steps...',
      complete: 'Configuration ready!'
    }

    return {
      phase,
      partialConfig: config.config || {},
      currentStep: config.config?.actions?.length,
      message: messages[phase]
    }
  }

  private async checkStreamingSupport(_connectorId: string | undefined): Promise<boolean> {
    // Check if the API supports streaming
    // For now, assume it doesn't and use simulated streaming
    return false
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  cancel(): void {
    if (this.activeSession) {
      this.activeSession.abortController.abort()
      this.activeSession = null
    }
  }

  isActive(): boolean {
    return this.activeSession !== null
  }
}

// Singleton instance
export const actionAIStreaming = new ActionAIStreamingService()

// =============================================================================
// REACT HOOK
// =============================================================================

import { useCallback, useRef, useState } from 'react'

export interface UseStreamingResult {
  state: AIStreamingState | null
  error: Error | null
  response: AIConfigResponse | null
  isStreaming: boolean
  start: (description: string, context: AIActionContext, connectorId?: string) => void
  cancel: () => void
}

export function useAIConfigStreaming(): UseStreamingResult {
  const [state, setState] = useState<AIStreamingState | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [response, setResponse] = useState<AIConfigResponse | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  // Throttle state updates
  const lastUpdateRef = useRef(0)
  const pendingStateRef = useRef<AIStreamingState | null>(null)
  const THROTTLE_MS = 100

  const throttledSetState = useCallback((newState: AIStreamingState) => {
    const now = Date.now()
    if (now - lastUpdateRef.current >= THROTTLE_MS) {
      setState(newState)
      lastUpdateRef.current = now
    } else {
      pendingStateRef.current = newState
    }
  }, [])

  const start = useCallback((
    description: string,
    context: AIActionContext,
    connectorId?: string
  ) => {
    setError(null)
    setResponse(null)
    setState(null)
    setIsStreaming(true)

    actionAIStreaming.startStreaming(description, context, connectorId, {
      onUpdate: (newState) => {
        throttledSetState(newState)
        // Flush pending state on phase change or complete
        if (newState.phase === 'complete' && pendingStateRef.current) {
          setState(pendingStateRef.current)
          pendingStateRef.current = null
        }
      },
      onError: (err) => {
        setError(err)
        setIsStreaming(false)
        // Flush any pending state
        if (pendingStateRef.current) {
          setState(pendingStateRef.current)
          pendingStateRef.current = null
        }
      },
      onComplete: (resp) => {
        setResponse(resp)
        setIsStreaming(false)
        // Final state update
        if (pendingStateRef.current) {
          setState(pendingStateRef.current)
          pendingStateRef.current = null
        }
      }
    })
  }, [throttledSetState])

  const cancel = useCallback(() => {
    actionAIStreaming.cancel()
    setIsStreaming(false)
  }, [])

  return {
    state,
    error,
    response,
    isStreaming,
    start,
    cancel
  }
}
