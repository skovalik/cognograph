/**
 * Tier 2: Interactive Power User Evaluation
 *
 * Instead of showing Claude a screenshot and asking "could you do this?",
 * this test has Claude actually ATTEMPT each task by clicking, typing, and
 * navigating the live Electron app. Real interaction → real signal.
 *
 * Each scenario:
 * 1. Sets up an initial state (empty canvas, pre-created nodes, etc.)
 * 2. Gives the AI agent a goal and a persona
 * 3. The agent looks at the screen, decides what to do, Playwright executes it
 * 4. Loop repeats until done, stuck, or max steps
 * 5. Result: ground truth on whether the task was completable + step trace
 *
 * Cost: ~$0.30-0.50 per full run (6 scenarios × ~5 steps × Sonnet vision)
 */

import { test, expect } from '../fixtures/smart-e2e-fixture'
import { waitForFullyRendered } from '../utils/react-flow-stabilizer'
import { InteractiveEvaluator, type TaskAttemptResult } from '../utils/interactive-evaluator'
import fs from 'fs/promises'
import type { Page } from '@playwright/test'

// ── Helpers ────────────────────────────────────────────────────────

/** Robustly dismiss the onboarding modal */
async function dismissOnboarding(window: Page): Promise<void> {
  // Try clicking "Skip" button
  const skipBtn = window.locator('button:has-text("Skip"), button[title="Skip onboarding"]')
  if ((await skipBtn.count()) > 0) {
    await skipBtn.first().click()
    await window.waitForTimeout(300)
  }

  // Press Escape to close any modal
  await window.keyboard.press('Escape')
  await window.waitForTimeout(300)

  // Click on canvas background to dismiss overlays (avoid toolbar at top ~60px)
  const pane = window.locator('.react-flow__pane')
  if ((await pane.count()) > 0) {
    await pane.click({ position: { x: 400, y: 400 }, force: true })
    await window.waitForTimeout(300)
  }

  // Press Escape again in case clicking opened something
  await window.keyboard.press('Escape')
  await window.waitForTimeout(200)
}

// ── Scenarios ──────────────────────────────────────────────────────

interface Scenario {
  id: string
  task: string
  persona: string
  /** Setup function to run before the AI agent takes over */
  setup: (window: Page) => Promise<void>
  /** Maximum steps the agent gets */
  maxSteps: number
}

const SCENARIOS: Scenario[] = [
  {
    id: 'create-note-node',
    task: 'Create a new note on the canvas. You can use keyboard shortcuts, the toolbar, or any other method you can find.',
    persona: 'Sarah — Obsidian power user (5000+ notes, uses keyboard shortcuts daily)',
    setup: async (window) => {
      await dismissOnboarding(window)
    },
    maxSteps: 8
  },
  {
    id: 'create-conversation-node',
    task: 'Create a new AI conversation node on the canvas so you can chat with Claude.',
    persona: 'Jake — AI automation engineer (builds multi-agent workflows, uses n8n and Cursor daily)',
    setup: async (window) => {
      await dismissOnboarding(window)
    },
    maxSteps: 8
  },
  {
    id: 'open-settings-find-api',
    task: 'Open the application settings and find where to configure your Anthropic API key.',
    persona: 'Jake — AI automation engineer (expects API config in Settings → AI/Connectors section)',
    setup: async (window) => {
      await dismissOnboarding(window)
    },
    maxSteps: 8
  },
  {
    id: 'select-node-view-properties',
    task: 'Click on the note node to select it, then find where its properties are displayed (title, content, metadata).',
    persona: 'Marcus — n8n workflow builder (expects a properties panel when selecting a node)',
    setup: async (window) => {
      await dismissOnboarding(window)
      // Pre-create a note node
      await window.keyboard.press('Shift+N')
      await window.waitForTimeout(600)
      // Click somewhere neutral to deselect (avoid toolbar at top ~60px)
      await window.locator('.react-flow__pane').click({ position: { x: 400, y: 400 }, force: true })
      await window.waitForTimeout(300)
    },
    maxSteps: 8
  },
  {
    id: 'open-keyboard-shortcuts',
    task: 'Find and open the keyboard shortcuts reference. You want to see all available shortcuts in this tool.',
    persona: 'Sarah — Obsidian power user (first thing she does in any tool: learn the shortcuts)',
    setup: async (window) => {
      await dismissOnboarding(window)
    },
    maxSteps: 8
  },
  {
    id: 'create-and-connect-two-nodes',
    task: 'Create a note node and a conversation node, then connect them with an edge so the note provides context to the conversation. The connection method involves Shift+dragging from one node edge handle to another.',
    persona: 'Marcus — n8n workflow builder (connects nodes by dragging from output to input handles)',
    setup: async (window) => {
      await dismissOnboarding(window)
    },
    maxSteps: 15
  }
]

// ── Test Suite ─────────────────────────────────────────────────────

test.describe('Tier 2: Interactive Power User Evaluation', () => {
  // Each scenario involves multiple Claude API calls (screenshot → think → act → repeat)
  // Budget ~10s per step: 3s API call + 1s screenshot + 1s action + 5s settle/margin
  test.setTimeout(180_000) // 3 minutes per test

  let evaluator: InteractiveEvaluator
  const allResults: Array<{ id: string; result: TaskAttemptResult }> = []

  test.beforeAll(async () => {
    evaluator = new InteractiveEvaluator()
    await fs.mkdir('e2e/smart-e2e/results/tier2-interactive', { recursive: true })
    await fs.mkdir('e2e/smart-e2e/screenshots/tier2-interactive', { recursive: true })
  })

  test.beforeEach(async ({ window }) => {
    // Reset workspace for clean state
    try {
      await window.evaluate(async () => {
        await (window as any).api.workspace.resetForTest()
        localStorage.clear()
        sessionStorage.clear()
      })
    } catch {
      // resetForTest may not exist in all builds
    }

    await window.reload()
    await waitForFullyRendered(window, { timeout: 15000 })
  })

  for (const scenario of SCENARIOS) {
    test(`${scenario.id}: ${scenario.task.slice(0, 80)}...`, async ({ window }) => {
      // Let the app settle
      await waitForFullyRendered(window)

      // Run scenario setup
      await scenario.setup(window)
      await waitForFullyRendered(window)

      // Let the AI agent attempt the task
      console.log(`\n${'='.repeat(60)}`)
      console.log(`SCENARIO: ${scenario.id}`)
      console.log(`PERSONA:  ${scenario.persona}`)
      console.log(`TASK:     ${scenario.task}`)
      console.log('='.repeat(60))

      const result = await evaluator.attemptTask(window, scenario.task, scenario.persona, {
        maxSteps: scenario.maxSteps,
        slug: scenario.id
      })

      allResults.push({ id: scenario.id, result })

      // Log result summary
      console.log(`\nRESULT: ${result.completed ? 'COMPLETED' : 'FAILED'}`)
      if (result.stuckReason) {
        console.log(`STUCK:  ${result.stuckReason}`)
      }
      console.log(`STEPS:  ${result.totalSteps}`)
      console.log(`COST:   $${result.cost.estimatedUsd.toFixed(4)}`)
      console.log(`TIME:   ${(result.totalDurationMs / 1000).toFixed(1)}s`)

      for (const step of result.steps) {
        const a = step.action
        const loc = a.x != null ? ` @ (${a.x},${a.y})` : ''
        const txt = a.text ? ` "${a.text}"` : ''
        console.log(
          `  [${step.stepNumber}] ${a.action}${loc}${txt} → ${a.target} [${a.confidence}]`
        )
        if (a.thinking) {
          console.log(`        thinking: ${a.thinking.slice(0, 120)}`)
        }
      }
    })
  }

  test.afterAll(async () => {
    // Generate summary report
    const summary = {
      timestamp: new Date().toISOString(),
      tier: 2,
      method: 'interactive-ai-agent',
      scenariosRun: allResults.length,
      completed: allResults.filter((r) => r.result.completed).length,
      stuck: allResults.filter((r) => !r.result.completed).length,
      totalCost: allResults.reduce((sum, r) => sum + r.result.cost.estimatedUsd, 0),
      scenarios: allResults.map(({ id, result }) => ({
        id,
        completed: result.completed,
        stuckReason: result.stuckReason,
        steps: result.totalSteps,
        cost: result.cost.estimatedUsd,
        stepTrace: result.steps.map((s) => ({
          step: s.stepNumber,
          action: s.action.action,
          target: s.action.target,
          confidence: s.action.confidence,
          thinking: s.action.thinking
        }))
      }))
    }

    await fs.writeFile(
      'e2e/smart-e2e/results/tier2-interactive/summary.json',
      JSON.stringify(summary, null, 2)
    )

    console.log('\n' + '='.repeat(60))
    console.log('INTERACTIVE POWER USER EVALUATION — SUMMARY')
    console.log('='.repeat(60))
    console.log(`Scenarios: ${summary.scenariosRun}`)
    console.log(
      `Completed: ${summary.completed}/${summary.scenariosRun} (${((summary.completed / Math.max(summary.scenariosRun, 1)) * 100).toFixed(0)}%)`
    )
    console.log(`Total cost: $${summary.totalCost.toFixed(4)}`)
    console.log('='.repeat(60))
  })
})
