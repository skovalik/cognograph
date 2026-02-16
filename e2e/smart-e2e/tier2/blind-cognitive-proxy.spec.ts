/**
 * Tier 2: Blind Cognitive Proxy (Phase A - 10 states, Pass A + B)
 *
 * Uses AI vision to evaluate UX without prior knowledge of the app.
 * This is the highest-ROI tier according to RL validation.
 */

import { test, expect } from '../fixtures/smart-e2e-fixture'
import { waitForFullyRendered } from '../utils/react-flow-stabilizer'
import { captureWithMetadata } from '../utils/screenshot-capture'
import { AIVisionEvaluator } from '../utils/ai-vision-evaluator'
import { captureDOMState, verifyClickTarget } from '../utils/dom-state-capture'
import fs from 'fs/promises'
import path from 'path'

// Note: No viewport setup needed - fitView maxZoom:1.0 in App.tsx prevents over-zooming

// Helper to create a Conversation node using toolbar button
async function createConversationNode(window) {
  // Use keyboard shortcut (most reliable)
  await window.keyboard.press('Shift+C')
  await window.waitForTimeout(500)
}

// 10 screen states for Phase A with their tasks
const PHASE_A_STATES = [
  {
    id: 'empty-canvas',
    setup: async (window) => {
    },
    task: 'Create your first note'
  },
  {
    id: 'single-node',
    setup: async (window) => {
      await window.locator('.react-flow__pane').dblclick({ position: { x: 400, y: 300 } })
      await window.waitForTimeout(500)
    },
    task: 'Open this node and change its title'
  },
  {
    id: 'two-connected',
    setup: async (window) => {
      // Create a Note node and a Conversation node
      await window.locator('.react-flow__pane').dblclick({ position: { x: 250, y: 300 } })
      await window.waitForTimeout(500)
      
      // Create Conversation node for the second one
      await createConversationNode(window)
      
      // Deselect
      await window.locator('.react-flow__pane').click({ position: { x: 100, y: 100 } })
      await window.waitForTimeout(300)

      // Connect with Shift+Drag (Note → Conversation)
      const nodes = window.locator('.react-flow__node')
      const firstBox = await nodes.first().boundingBox()
      const secondBox = await nodes.nth(1).boundingBox()

      if (firstBox && secondBox) {
        await window.keyboard.down('Shift')
        await window.mouse.move(firstBox.x + firstBox.width - 5, firstBox.y + firstBox.height / 2)
        await window.mouse.down()
        await window.mouse.move(secondBox.x + 5, secondBox.y + secondBox.height / 2, { steps: 20 })
        await window.mouse.up()
        await window.keyboard.up('Shift')
        await window.waitForTimeout(500)
      }
    },
    task: 'Make the AI use the first note as context when answering in the conversation'
  },
  {
    id: 'chat-open',
    setup: async (window) => {
      // FIXED: Create a Conversation node (not Note node) for chat test
      await createConversationNode(window)
      
      // Click node to open chat panel
      await window.locator('.react-flow__node').first().click()
      await window.waitForTimeout(1000)
    },
    task: 'Send a message to the AI'
  },
  {
    id: 'toolbar-visible',
    setup: async (window) => {
    },
    task: 'Create a new conversation node'
  },
  {
    id: 'settings-open',
    setup: async (window) => {
      // Open settings (look for settings button/menu)
      const settingsBtn = window.locator('button[aria-label*="Settings"], button[title*="Settings"], button:has-text("Settings")').first()
      if (await settingsBtn.count() > 0) {
        await settingsBtn.click()
        await window.waitForTimeout(500)
      }
    },
    task: 'Configure your API key so AI features work'
  },
  {
    id: 'sidebar-open',
    setup: async (window) => {
      // Ensure left sidebar is visible
      const sidebar = window.locator('.left-sidebar, [data-testid="left-sidebar"]')
      if (await sidebar.count() > 0) {
        // Already visible, nothing to do
      }
    },
    task: 'View your recent conversations'
  },
  {
    id: 'node-selected',
    setup: async (window) => {
      await window.locator('.react-flow__pane').dblclick({ position: { x: 400, y: 300 } })
      await window.waitForTimeout(500)
      await window.locator('.react-flow__node').first().click()
      await window.waitForTimeout(500)
    },
    task: 'Edit the node title'
  },
  {
    id: 'multiple-nodes',
    setup: async (window) => {
      // Create 5 nodes spread out at proper zoom level
      const positions = [
        { x: 200, y: 200 },
        { x: 500, y: 200 },
        { x: 800, y: 200 },
        { x: 350, y: 450 },
        { x: 650, y: 450 }
      ]

      for (const pos of positions) {
        await window.locator('.react-flow__pane').dblclick({ position: pos })
        await window.waitForTimeout(300)
      }
    },
    task: 'Find the oldest node'
  },
  {
    id: 'context-menu',
    setup: async (window) => {
      await window.locator('.react-flow__pane').dblclick({ position: { x: 400, y: 300 } })
      await window.waitForTimeout(500)
      // Right-click node
      await window.locator('.react-flow__node').first().click({ button: 'right' })
      await window.waitForTimeout(500)
    },
    task: 'Delete this node'
  }
]

test.describe('Tier 2: Blind Cognitive Proxy (Phase A)', () => {
  const resultsDir = 'e2e/smart-e2e/results/tier2'
  let evaluator: AIVisionEvaluator

  test.beforeAll(async () => {
    // Create results directory
    await fs.mkdir(resultsDir, { recursive: true })

    // Initialize evaluator
    evaluator = new AIVisionEvaluator()
  })

  test.beforeEach(async ({ window }) => {
    // CRITICAL: Reset workspace to prevent node accumulation between tests
    // Bug: Autosave persists nodes from previous tests, creating visual chaos
    await window.evaluate(async () => {
      await window.api.workspace.resetForTest()
      localStorage.clear()
      sessionStorage.clear()
    })

    // Reload to apply fresh state
    await window.reload()
    await waitForFullyRendered(window, { timeout: 15000 })

    // Dismiss welcome overlay if present
    const skipButton = window.locator('button:has-text("Skip"), button[title="Skip onboarding"]')
    if ((await skipButton.count()) > 0) {
      await skipButton.first().click()
      await window.waitForTimeout(500)
    }

    // Dismiss any other modal overlays
    const closeButtons = window.locator('.gui-panel button:has-text("Close"), .gui-panel button:has-text("Got it"), .gui-panel button:has-text("Dismiss"), .gui-panel [aria-label*="close"]')
    const count = await closeButtons.count()
    for (let i = 0; i < count; i++) {
      try {
        await closeButtons.nth(i).click({ timeout: 1000 })
        await window.waitForTimeout(300)
      } catch {
        // Ignore if button not clickable
      }
    }

    // Also try ESC key to close modals
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)
  })

  for (const state of PHASE_A_STATES) {
    test(`State: ${state.id} - Pass A (zero-context) + Pass B (task completion)`, async ({
      window
    }) => {
      await waitForFullyRendered(window)

      // Setup state
      await state.setup(window)

      // Wait for stabilization
      await waitForFullyRendered(window)
      await window.waitForTimeout(500)

      // Capture screenshot
      const screenshotPath = `e2e/smart-e2e/screenshots/tier2-${state.id}.png`
      await window.screenshot({ path: screenshotPath, fullPage: false })

      // Capture DOM state for hallucination detection
      const domState = await captureDOMState(window)
      await fs.writeFile(
        `${resultsDir}/${state.id}-dom.json`,
        JSON.stringify(domState, null, 2)
      )

      // Pass A: Zero-context first impression
      const passAResult = await evaluator.passA(screenshotPath)
      await fs.writeFile(
        `${resultsDir}/${state.id}-pass-a.json`,
        JSON.stringify(passAResult, null, 2)
      )

      // Pass B: Task completion
      const passBResult = await evaluator.passB(screenshotPath, state.task)
      await fs.writeFile(
        `${resultsDir}/${state.id}-pass-b.json`,
        JSON.stringify(passBResult, null, 2)
      )

      // Cross-check Pass B steps against DOM
      if (passBResult.response.can_complete) {
        for (const step of passBResult.response.steps) {
          const verification = verifyClickTarget(domState, { target: step.target })
          if (!verification.exists) {
            console.warn(
              `[HALLUCINATION] Step "${step.target}" not found in DOM (state: ${state.id})`
            )
          }
        }
      }

      // Assert basic expectations (don't fail on low scores, just collect data)
      expect(passAResult.response.clarity_score).toBeGreaterThanOrEqual(0)
      expect(passAResult.response.clarity_score).toBeLessThanOrEqual(10)

      // Log results for manual review
      console.log(`\n=== ${state.id} ===`)
      console.log(`Pass A - Clarity: ${passAResult.response.clarity_score}/10`)
      console.log(`Pass A - First impression: ${passAResult.response.first_impression}`)
      console.log(`Pass B - Can complete: ${passBResult.response.can_complete}`)
      console.log(`Pass B - Steps: ${passBResult.response.steps.length}`)
      if (passBResult.response.stuck_at_step !== null) {
        console.log(`Pass B - STUCK at step ${passBResult.response.stuck_at_step}: ${passBResult.response.why_stuck}`)
      }
      console.log(`Cost: $${(passAResult.metadata.cost_usd + passBResult.metadata.cost_usd).toFixed(4)}`)
    })
  }

  test.afterAll(async () => {
    // Generate summary report (only for states that completed)
    const allResults = await Promise.all(
      PHASE_A_STATES.map(async (state) => {
        try {
          const passA = JSON.parse(
            await fs.readFile(`${resultsDir}/${state.id}-pass-a.json`, 'utf-8')
          )
          const passB = JSON.parse(
            await fs.readFile(`${resultsDir}/${state.id}-pass-b.json`, 'utf-8')
          )
          return {
            state: state.id,
            task: state.task,
            passA,
            passB
          }
        } catch (e) {
          // State didn't complete, skip it
          return null
        }
      })
    ).then((results) => results.filter((r) => r !== null))

    // Calculate aggregate metrics
    const avgClarity =
      allResults.reduce((sum, r) => sum + r.passA.response.clarity_score, 0) /
      allResults.length
    const completionRate =
      allResults.filter((r) => r.passB.response.can_complete).length / allResults.length
    const totalCost = allResults.reduce(
      (sum, r) => sum + r.passA.metadata.cost_usd + r.passB.metadata.cost_usd,
      0
    )

    const summary = {
      timestamp: new Date().toISOString(),
      tier: 2,
      phase: 'A',
      states_evaluated: allResults.length,
      metrics: {
        avg_clarity_score: avgClarity,
        completion_rate: completionRate,
        states_with_dealbreakers: allResults.filter(
          (r) => r.passA.response.dealbreaker !== null
        ).length,
        avg_confusing_elements: allResults.reduce(
          (sum, r) => sum + r.passA.response.confusing_elements.length,
          0
        ) / allResults.length
      },
      cost: {
        total_usd: totalCost,
        per_state_usd: totalCost / allResults.length
      },
      results: allResults
    }

    await fs.writeFile(
      `${resultsDir}/tier2-phase-a-summary.json`,
      JSON.stringify(summary, null, 2)
    )

    console.log('\n' + '='.repeat(60))
    console.log('TIER 2 PHASE A SUMMARY')
    console.log('='.repeat(60))
    console.log(`States evaluated: ${summary.states_evaluated}`)
    console.log(`Average clarity: ${avgClarity.toFixed(1)}/10`)
    console.log(`Task completion rate: ${(completionRate * 100).toFixed(1)}%`)
    console.log(`Total cost: $${totalCost.toFixed(2)}`)
    console.log('='.repeat(60))
  })
})
