/**
 * Extraction Service
 *
 * Extracts actionable Notes and Tasks from conversation messages using LLM analysis.
 */

import type { Message, ExtractionSettings, ExtractionResult } from '@shared/types'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const EXTRACTION_SYSTEM_PROMPT = `You are an extraction assistant. Analyze the conversation and extract actionable items.

For TASKS, identify:
- Action items explicitly mentioned ("we need to...", "let's...", "TODO:")
- Deadlines or time-sensitive items
- Commitments or promises made

For NOTES, identify:
- Key decisions made
- Important facts or preferences stated
- Reference information worth preserving
- Insights or realizations

Respond ONLY with valid JSON in this format:
{
  "extractions": [
    {
      "type": "task" | "note",
      "title": "Brief title (max 60 chars)",
      "content": "Full description",
      "confidence": 0.0-1.0,
      "priority": "low" | "medium" | "high",
      "tags": ["tag1", "tag2"]
    }
  ]
}

If nothing worth extracting, return: { "extractions": [] }
Do not explain your reasoning. Return only the JSON object.`

// -----------------------------------------------------------------------------
// Prompt Building
// -----------------------------------------------------------------------------

/**
 * Build the extraction prompt from conversation messages
 */
export function buildExtractionPrompt(
  messages: Message[],
  existingTitles: string[]
): string {
  const conversationText = messages
    .filter((m) => m.content.trim())
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const excludeList =
    existingTitles.length > 0
      ? `\n\nAlready extracted (do not duplicate these): ${existingTitles.join(', ')}`
      : ''

  return `Analyze this conversation and extract actionable items:

${conversationText}
${excludeList}`
}

// -----------------------------------------------------------------------------
// Extraction Service
// -----------------------------------------------------------------------------

/**
 * Run extraction on conversation messages
 */
export async function runExtraction(
  _nodeId: string,
  messages: Message[],
  settings: ExtractionSettings,
  existingTitles: string[] = []
): Promise<ExtractionResult[]> {
  if (messages.length === 0) return []

  const prompt = buildExtractionPrompt(messages, existingTitles)

  try {
    const response = await window.api.llm.extract({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userPrompt: prompt,
      model: 'claude-3-haiku-20240307',
      maxTokens: 1500
    })

    if (!response.success || !response.data) {
      console.error('[Extraction] API call failed:', response.error?.message)
      return []
    }

    // Parse JSON response
    let parsed: { extractions: ExtractionResult[] }
    try {
      // Handle potential markdown code blocks in response
      let content = response.data.trim()
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      parsed = JSON.parse(content)
    } catch (parseError) {
      console.error('[Extraction] Failed to parse response:', parseError)
      console.error('[Extraction] Response was:', response.data)
      return []
    }

    if (!parsed.extractions || !Array.isArray(parsed.extractions)) {
      console.error('[Extraction] Invalid response format:', parsed)
      return []
    }

    // Filter by settings
    return parsed.extractions.filter((e) => {
      // Check confidence threshold
      if (e.confidence < settings.extractionConfidenceThreshold) return false
      // Check extraction types
      if (e.type === 'task' && !settings.extractionTypes.includes('tasks')) return false
      if (e.type === 'note' && !settings.extractionTypes.includes('notes')) return false
      return true
    })
  } catch (error) {
    console.error('[Extraction] Error:', error)
    return []
  }
}

// -----------------------------------------------------------------------------
// Debounce Helper for Per-Message Extraction
// -----------------------------------------------------------------------------

const extractionTimers = new Map<string, NodeJS.Timeout>()
const EXTRACTION_DEBOUNCE_MS = 30000 // 30 seconds

/**
 * Debounce extraction to avoid excessive API calls in per-message mode
 */
export function debounceExtraction(
  nodeId: string,
  callback: () => Promise<void>
): void {
  const existingTimer = extractionTimers.get(nodeId)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const timer = setTimeout(async () => {
    extractionTimers.delete(nodeId)
    await callback()
  }, EXTRACTION_DEBOUNCE_MS)

  extractionTimers.set(nodeId, timer)
}

/**
 * Cancel a pending debounced extraction
 */
export function cancelDebouncedExtraction(nodeId: string): void {
  const timer = extractionTimers.get(nodeId)
  if (timer) {
    clearTimeout(timer)
    extractionTimers.delete(nodeId)
  }
}

/**
 * Check if there's a pending extraction for a node
 */
export function hasPendingDebouncedExtraction(nodeId: string): boolean {
  return extractionTimers.has(nodeId)
}
