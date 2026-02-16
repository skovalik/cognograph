/**
 * Interactive AI Evaluator
 *
 * Uses Claude Sonnet vision to ATTEMPT tasks in the running app,
 * not just look at screenshots. The AI agent sees the screen,
 * decides what to click/type, Playwright executes the action,
 * and the loop repeats until the task is done or the agent is stuck.
 *
 * Zero new dependencies — uses existing Playwright + Anthropic SDK.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Page } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'

// ── Types ──────────────────────────────────────────────────────────

export interface ActionStep {
  thinking: string
  action: 'click' | 'double-click' | 'type' | 'keyboard' | 'scroll' | 'done' | 'stuck'
  target: string
  x?: number
  y?: number
  text?: string
  reason?: string
  confidence: 'certain' | 'likely' | 'guessing'
}

export interface StepRecord {
  stepNumber: number
  action: ActionStep
  screenshotPath: string
  timestamp: string
  durationMs: number
}

export interface TaskAttemptResult {
  task: string
  persona: string
  completed: boolean
  stuckReason: string | null
  steps: StepRecord[]
  totalSteps: number
  totalDurationMs: number
  cost: {
    inputTokens: number
    outputTokens: number
    estimatedUsd: number
  }
}

export interface AttemptOptions {
  maxSteps?: number
  screenshotDir?: string
  resultsDir?: string
  model?: string
  temperature?: number
  /** Slug used for file naming (auto-generated from task if omitted) */
  slug?: string
}

// ── Interactive Evaluator ──────────────────────────────────────────

export class InteractiveEvaluator {
  private client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY
    })
  }

  /**
   * Have an AI agent attempt a task by interacting with the live app.
   * Returns a detailed trace of every step: what it saw, what it did, where it got stuck.
   */
  async attemptTask(
    page: Page,
    task: string,
    persona: string,
    options: AttemptOptions = {}
  ): Promise<TaskAttemptResult> {
    const {
      maxSteps = 12,
      screenshotDir = 'e2e/smart-e2e/screenshots/tier2-interactive',
      resultsDir = 'e2e/smart-e2e/results/tier2-interactive',
      model = 'claude-sonnet-4-5-20250929',
      temperature = 0.3,
      slug = task
        .slice(0, 50)
        .replace(/[^a-z0-9]+/gi, '-')
        .toLowerCase()
        .replace(/-+$/, '')
    } = options

    await fs.mkdir(screenshotDir, { recursive: true })
    await fs.mkdir(resultsDir, { recursive: true })

    const steps: StepRecord[] = []
    let totalInputTokens = 0
    let totalOutputTokens = 0
    const startTime = Date.now()

    const viewport = page.viewportSize() || { width: 1280, height: 720 }

    for (let i = 0; i < maxSteps; i++) {
      const stepStart = Date.now()

      // Capture current state
      const screenshotPath = path.join(screenshotDir, `${slug}-step-${i}.png`)
      await page.screenshot({ path: screenshotPath })

      // Ask Claude what to do next
      const { action, inputTokens, outputTokens } = await this.getNextAction(
        screenshotPath,
        task,
        persona,
        steps,
        viewport,
        model,
        temperature
      )

      totalInputTokens += inputTokens
      totalOutputTokens += outputTokens

      steps.push({
        stepNumber: i,
        action,
        screenshotPath,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - stepStart
      })

      // Terminal: task complete
      if (action.action === 'done') {
        const result = this.buildResult(task, persona, true, null, steps, startTime, model, totalInputTokens, totalOutputTokens)
        await this.saveResult(resultsDir, slug, result)
        return result
      }

      // Terminal: agent is stuck
      if (action.action === 'stuck') {
        const result = this.buildResult(task, persona, false, action.reason || 'Unknown', steps, startTime, model, totalInputTokens, totalOutputTokens)
        await this.saveResult(resultsDir, slug, result)
        return result
      }

      // Execute the action
      await this.executeAction(page, action, viewport)

      // Wait for UI to settle
      await page.waitForTimeout(600)
    }

    // Max steps exhausted
    const result = this.buildResult(task, persona, false, `Exhausted ${maxSteps} steps without completing`, steps, startTime, model, totalInputTokens, totalOutputTokens)
    await this.saveResult(resultsDir, slug, result)
    return result
  }

  // ── Private: Ask Claude for the next action ────────────────────

  private async getNextAction(
    screenshotPath: string,
    task: string,
    persona: string,
    history: StepRecord[],
    viewport: { width: number; height: number },
    model: string,
    temperature: number
  ): Promise<{ action: ActionStep; inputTokens: number; outputTokens: number }> {
    const imageData = await fs.readFile(screenshotPath)
    const base64Image = imageData.toString('base64')

    const historyText =
      history.length === 0
        ? 'None yet — this is your first look.'
        : history
            .map(
              (s) =>
                `Step ${s.stepNumber}: ${s.action.action}${s.action.target ? ` on "${s.action.target}"` : ''}${s.action.x != null ? ` at (${s.action.x}, ${s.action.y})` : ''}${s.action.text ? ` text="${s.action.text}"` : ''} [${s.action.confidence}]`
            )
            .join('\n')

    const systemPrompt = `You are simulating a power user interacting with a desktop application.

You are: ${persona}
Your background: You use node-based tools daily (n8n, ComfyUI, Blender nodes). You use knowledge tools (Obsidian, Notion, Roam). You build AI workflows (Claude Projects, Cursor, LangChain). You know what "context injection", "graph traversal", and "edge properties" mean.

RULES:
- Look at the screenshot carefully. Describe what you see before acting.
- You can ONLY interact with what is visible on screen.
- If you recognize UI patterns from tools you know, use that knowledge.
- Try the most obvious interaction first (click visible buttons before trying shortcuts).
- If a previous action didn't work as expected, try a different approach.
- If you genuinely cannot proceed after trying alternatives, say "stuck".
- Coordinates are pixels from top-left. Screen is ${viewport.width}x${viewport.height}.

COMPLETION RULES:
- After each action, ask yourself: "Has the task goal been achieved?"
- If the UI now shows the result the task asked for, say "done" IMMEDIATELY.
- Do NOT keep exploring after the task is complete. Do NOT try to "verify" or "improve" a completed task.
- Examples of "done": node appeared on canvas, settings panel is open showing the right section, properties are visible, shortcut dialog is showing.
- If you've taken 3+ actions and the screen shows the expected outcome, you are DONE.

AVAILABLE ACTIONS:
- click: Single click at (x, y)
- double-click: Double click at (x, y)
- type: Type text into the currently focused element
- keyboard: Press a key combo (examples: "Shift+N", "Escape", "Enter", "Control+K", "Backspace")
- scroll: Scroll at current mouse position (set text to "up" or "down")
- done: Task is complete (explain what you accomplished in "reason")
- stuck: Cannot proceed (explain exactly what's missing in "reason")

Reply with a single JSON object. No markdown, no code fences, just JSON:
{
  "thinking": "What I see on screen and what I should do next",
  "action": "click|double-click|type|keyboard|scroll|done|stuck",
  "target": "description of the element",
  "x": 0,
  "y": 0,
  "text": "",
  "reason": "",
  "confidence": "certain|likely|guessing"
}`

    const userPrompt = `TASK: "${task}"

STEPS SO FAR:
${historyText}

Look at the screenshot. What is your next action?`

    const response = await this.client.messages.create({
      model,
      max_tokens: 500,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64Image }
            },
            { type: 'text', text: userPrompt }
          ]
        }
      ]
    })

    const textContent = response.content.find((c) => c.type === 'text')
    const raw = textContent && 'text' in textContent ? textContent.text : ''

    let action: ActionStep
    try {
      // Strip markdown fences if present
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      action = JSON.parse(jsonStr)
    } catch {
      // If parsing fails, treat as stuck
      action = {
        thinking: `Failed to parse AI response: ${raw.slice(0, 200)}`,
        action: 'stuck',
        target: 'N/A',
        reason: 'AI returned unparseable response',
        confidence: 'guessing'
      }
    }

    return {
      action,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens
    }
  }

  // ── Private: Execute an action via Playwright ──────────────────

  private async executeAction(
    page: Page,
    action: ActionStep,
    viewport: { width: number; height: number }
  ): Promise<void> {
    // Clamp coordinates to viewport
    const x = Math.max(0, Math.min(action.x ?? 0, viewport.width - 1))
    const y = Math.max(0, Math.min(action.y ?? 0, viewport.height - 1))

    switch (action.action) {
      case 'click':
        await page.mouse.click(x, y)
        break

      case 'double-click':
        await page.mouse.dblclick(x, y)
        break

      case 'type':
        if (action.text) {
          await page.keyboard.type(action.text, { delay: 30 })
        }
        break

      case 'keyboard':
        if (action.text) {
          // Playwright expects "Shift+KeyN" style, but Claude might say "Shift+N"
          // Normalize common patterns
          const combo = action.text
            .replace(/Ctrl\+/g, 'Control+')
            .replace(/Cmd\+/g, 'Meta+')
          await page.keyboard.press(combo)
        }
        break

      case 'scroll':
        await page.mouse.move(x, y)
        const direction = action.text?.toLowerCase() === 'up' ? -3 : 3
        await page.mouse.wheel(0, direction * 120)
        break

      // done and stuck are terminal — no execution needed
    }
  }

  // ── Private: Build result object ───────────────────────────────

  private buildResult(
    task: string,
    persona: string,
    completed: boolean,
    stuckReason: string | null,
    steps: StepRecord[],
    startTime: number,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): TaskAttemptResult {
    return {
      task,
      persona,
      completed,
      stuckReason,
      steps,
      totalSteps: steps.length,
      totalDurationMs: Date.now() - startTime,
      cost: this.calculateCost(model, inputTokens, outputTokens)
    }
  }

  // ── Private: Save result to disk ───────────────────────────────

  private async saveResult(
    resultsDir: string,
    slug: string,
    result: TaskAttemptResult
  ): Promise<void> {
    const resultPath = path.join(resultsDir, `${slug}-result.json`)
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2))
  }

  // ── Private: Cost calculation ──────────────────────────────────

  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): { inputTokens: number; outputTokens: number; estimatedUsd: number } {
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
      'claude-opus-4-6': { input: 15.0, output: 75.0 },
      'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 }
    }
    const rates = pricing[model] || pricing['claude-sonnet-4-5-20250929']
    const estimatedUsd =
      (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output

    return { inputTokens, outputTokens, estimatedUsd }
  }
}
