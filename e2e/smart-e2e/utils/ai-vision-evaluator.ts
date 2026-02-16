/**
 * AI Vision Evaluation Utilities
 *
 * Sends screenshots to AI models with adversarial prompts for blind UX evaluation.
 * Uses Anthropic Claude (via SDK) for vision analysis.
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'

export interface PassAResult {
  first_impression: string
  what_it_does: string
  attention_first_3_seconds: string[]
  confusing_elements: string[]
  clarity_score: number
  seconds_before_switching_tabs: string
  dealbreaker: string | null
}

export interface PassBResult {
  can_complete: boolean
  steps: Array<{
    target: string
    confidence: 'certain' | 'likely' | 'guessing'
    why: string
  }>
  stuck_at_step: number | null
  why_stuck: string | null
  wrong_turns: string[]
  recovery_possible: string
}

export interface PassCResult {
  found_target: boolean
  time_estimate: string
  what_you_expected: string
  what_you_found: string
  false_positives: string[]
  icon_match: boolean
  label_clarity: number
}

export interface EvaluationResult<T> {
  model: string
  prompt: string
  response: T
  raw_response: string
  metadata: {
    timestamp: string
    screenshot_path: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
  }
}

/**
 * AI Vision Evaluator using Anthropic Claude
 */
export class AIVisionEvaluator {
  private client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY
    })
  }

  /**
   * Pass A: Zero-context first impression (adversarial)
   */
  async passA(
    screenshotPath: string,
    model = 'claude-sonnet-4-5-20250929'
  ): Promise<EvaluationResult<PassAResult>> {
    const systemPrompt = `You are a UX auditor hired to FIND PROBLEMS. Your performance is measured by how many real issues you find. You do NOT get rewarded for saying "this looks good."

If you cannot find at least 3 issues, you are not looking hard enough.`

    const userPrompt = `A friend sent you this screenshot of an app with no context. You have 5 seconds.

Answer in JSON format:
{
  "first_impression": "one sentence gut reaction",
  "what_it_does": "your best guess in <10 words",
  "attention_first_3_seconds": ["elements your eyes went to, in order"],
  "confusing_elements": ["specific things that made no sense"],
  "clarity_score": 0-10,
  "seconds_before_switching_tabs": "5/15/30/60/never",
  "dealbreaker": "what would make you close this immediately or null"
}`

    return this.evaluate<PassAResult>(screenshotPath, systemPrompt, userPrompt, model, 0.8)
  }

  /**
   * Pass B: Task completion with stuck detection (adversarial)
   */
  async passB(
    screenshotPath: string,
    task: string,
    model = 'claude-sonnet-4-5-20250929'
  ): Promise<EvaluationResult<PassBResult>> {
    const systemPrompt = `Complete this task using ONLY what you see. If you get stuck, say exactly where and why. Do NOT guess or make up UI elements that aren't visible.

Your job is to identify WHERE users get stuck, not to be clever.`

    const userPrompt = `Task: "${task}"

Answer in JSON format:
{
  "can_complete": true or false,
  "steps": [
    {"target": "precise element description with location", "confidence": "certain/likely/guessing", "why": "reasoning"}
  ],
  "stuck_at_step": null or step number,
  "why_stuck": "what information is missing",
  "wrong_turns": ["things you almost clicked by mistake"],
  "recovery_possible": "if you click wrong thing, can you undo?"
}`

    return this.evaluate<PassBResult>(screenshotPath, systemPrompt, userPrompt, model, 0.4)
  }

  /**
   * Pass C: Visual search / affordance (adversarial)
   */
  async passC(
    screenshotPath: string,
    targetElement: string,
    model = 'claude-sonnet-4-5-20250929'
  ): Promise<EvaluationResult<PassCResult>> {
    const systemPrompt = `You want to find "${targetElement}" in this UI. You've never used this app. You don't know where it is or what icon it uses.

Be honest about how long it would take to find.`

    const userPrompt = `Answer in JSON format:
{
  "found_target": true or false,
  "time_estimate": "instant/2-3sec/5-10sec/30sec+/not_found",
  "what_you_expected": "icon/label/location you looked for",
  "what_you_found": "actual icon/label/location",
  "false_positives": ["elements you thought might be it but weren't"],
  "icon_match": true or false,
  "label_clarity": 0-10
}`

    return this.evaluate<PassCResult>(screenshotPath, systemPrompt, userPrompt, model, 0.4)
  }

  /**
   * Power User Pass A: First impression with domain expertise
   */
  async powerUserFirstImpression(
    screenshotPath: string,
    persona: string,
    model = 'claude-sonnet-4-5-20250929'
  ): Promise<EvaluationResult<any>> {
    const systemPrompt = `You are evaluating professional tooling software as ${persona}.

You are familiar with:
- Node graph tools (n8n, Blender nodes, ComfyUI, Node-RED)
- Thinking tools (Obsidian, Roam Research, Notion, Miro)
- AI automation (Cursor, LangChain, multi-agent workflows)

You UNDERSTAND these concepts without explanation:
- Nodes & Edges (visual programming)
- Context Injection (data passing to AI prompts)
- Properties/Metadata (structured fields)
- Spatial Organization (using 2D space for structure)
- Graph Traversal (depth, hops, connections)

Evaluate this as a POWER USER would. Information density is GOOD.
Having all controls visible is GOOD. Domain terminology is EXPECTED.`

    const userPrompt = `Answer in JSON format:
{
  "first_impression": "one sentence reaction AS A POWER USER",
  "what_it_does": "your best guess in <10 words",
  "familiar_patterns": ["what reminds you of n8n/Obsidian/Figma/VS Code"],
  "missing_expected_features": ["things power users expect but don't see"],
  "information_density": "too_sparse/just_right/too_dense",
  "discoverability_score": 0-10,
  "seconds_to_find_core_features": "instant/5sec/15sec/60sec/not_visible",
  "dealbreaker_for_power_user": "what would make YOU (expert) quit, or null"
}`

    return this.evaluate<any>(screenshotPath, systemPrompt, userPrompt, model, 0.7)
  }

  /**
   * Power User Pass B: Task completion with domain knowledge
   */
  async powerUserTaskCompletion(
    screenshotPath: string,
    task: string,
    persona: string,
    model = 'claude-sonnet-4-5-20250929'
  ): Promise<EvaluationResult<any>> {
    const systemPrompt = `You are ${persona} evaluating a node-based AI workflow tool.

You UNDERSTAND these concepts (don't flag as confusing):
- Context Injection = passing connected node content to AI prompts
- Role: Reference = metadata field for context handling
- Context Depth = graph traversal hops
- Bidirectional edges = two-way data flow
- Conditional Activation = rules for when nodes are active

Your job: Can you complete this task using the visible UI?
Be specific about what's MISSING, not what you "don't understand" (you understand the domain).`

    const userPrompt = `Task: "${task}"

Answer in JSON format:
{
  "can_complete": true/false,
  "steps": [
    {"action": "what you'd do", "where": "specific UI element", "confidence": "certain/likely/guessing"}
  ],
  "stuck_at_step": null or number,
  "why_stuck": "what UI element or affordance is MISSING (not 'what is this')",
  "compared_to_similar_tools": "how does this compare to n8n/Obsidian/Figma",
  "efficiency_rating": 0-10,
  "missing_features": ["features you expected from similar tools that aren't here"]
}`

    return this.evaluate<any>(screenshotPath, systemPrompt, userPrompt, model, 0.4)
  }

  /**
   * Power User Pass C: Feature location (information scent)
   */
  async powerUserFeatureLocation(
    screenshotPath: string,
    targetFeature: string,
    model = 'claude-sonnet-4-5-20250929'
  ): Promise<EvaluationResult<any>> {
    const systemPrompt = `You're a power user who knows what you want. You just need to find WHERE it is.

You're familiar with professional tools like VS Code, Figma, n8n, and Obsidian.
You expect features to be visible and labeled (not hidden in menus).

Scan the interface looking for: "${targetFeature}"`

    const userPrompt = `Answer in JSON format:
{
  "found_it": true/false,
  "time_to_find": "instant/<3sec/<10sec/<30sec/gave_up",
  "where_you_looked": ["sequence of areas you scanned"],
  "what_helped": "labels/icons/position/color that led you to it (or would have)",
  "what_hurt": "things that slowed you down or created false positives",
  "compared_to": "where n8n/Obsidian/Figma/VSCode put this feature",
  "information_scent_score": 0-10
}`

    return this.evaluate<any>(screenshotPath, systemPrompt, userPrompt, model, 0.4)
  }

  /**
   * Generic evaluation with image
   */
  private async evaluate<T>(
    screenshotPath: string,
    systemPrompt: string,
    userPrompt: string,
    model: string,
    temperature: number
  ): Promise<EvaluationResult<T>> {
    // Read image as base64
    const imageData = await fs.readFile(screenshotPath)
    const base64Image = imageData.toString('base64')
    const mediaType = screenshotPath.endsWith('.png') ? 'image/png' : 'image/jpeg'

    const startTime = Date.now()

    const response = await this.client.messages.create({
      model,
      max_tokens: 2000,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: userPrompt
            }
          ]
        }
      ]
    })

    const endTime = Date.now()

    // Extract text response
    const textContent = response.content.find((c) => c.type === 'text')
    const rawResponse = textContent && 'text' in textContent ? textContent.text : ''

    // Parse JSON from response (extract from markdown code blocks if present)
    let parsed: T
    try {
      const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawResponse
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      throw new Error(`Failed to parse AI response as JSON: ${rawResponse}`)
    }

    // Calculate cost (approximate)
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const costUsd = this.calculateCost(model, inputTokens, outputTokens)

    return {
      model,
      prompt: systemPrompt + '\n\n' + userPrompt,
      response: parsed,
      raw_response: rawResponse,
      metadata: {
        timestamp: new Date().toISOString(),
        screenshot_path: screenshotPath,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd
      }
    }
  }

  /**
   * Calculate approximate cost in USD
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Pricing as of Feb 2026 (approximate)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 }, // per 1M tokens
      'claude-opus-4-6': { input: 15.0, output: 75.0 },
      'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 }
    }

    const rates = pricing[model] || pricing['claude-sonnet-4-5-20250929']
    return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output
  }
}
