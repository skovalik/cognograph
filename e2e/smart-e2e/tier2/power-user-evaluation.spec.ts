/**
 * Tier 2: Power User Evaluation (v2)
 *
 * Evaluates UX through the lens of professional power users who are familiar with:
 * - Node graph tools (n8n, Blender, ComfyUI, Node-RED)
 * - Thinking tools (Obsidian, Roam, Miro, Notion)
 * - AI automation (Cursor, LangChain, multi-agent systems)
 *
 * This replaces the consumer-focused evaluation which incorrectly flagged
 * power-user features as "too complex" or "confusing".
 */

import { test, expect } from '../fixtures/smart-e2e-fixture'
import { waitForFullyRendered } from '../utils/react-flow-stabilizer'
import fs from 'fs/promises'
import type { Page } from '@playwright/test'

// Helper to create a Conversation node using keyboard shortcut
async function createConversationNode(window: Page) {
  await window.keyboard.press('Shift+C')
  await window.waitForTimeout(500)
}

// Helper to create a Note node
async function createNoteNode(window: Page) {
  await window.keyboard.press('Shift+N')
  await window.waitForTimeout(500)
}

// Power user test scenarios
const POWER_USER_SCENARIOS = [
  {
    id: 'fresh-workspace',
    setup: async (window: Page) => {
      // Empty canvas - power user just dismissed onboarding
    },
    task: 'Set up your first agent workflow: create a conversation node and connect a reference note to it',
    persona: 'Marcus (n8n workflow builder)',
    expectedBehavior: 'Quickly creates 2 nodes and connects them using edge handles'
  },
  {
    id: 'active-workflow',
    setup: async (window: Page) => {
      // Create conversation + 2 connected notes
      await createConversationNode(window)
      await window.waitForTimeout(300)
      await createNoteNode(window)
      await window.waitForTimeout(300)

      // Connect them with Shift+Drag
      const nodes = window.locator('.react-flow__node')
      const firstBox = await nodes.nth(1).boundingBox() // Note
      const secondBox = await nodes.first().boundingBox() // Conversation

      if (firstBox && secondBox) {
        await window.keyboard.down('Shift')
        await window.mouse.move(firstBox.x + firstBox.width - 5, firstBox.y + firstBox.height / 2)
        await window.mouse.down()
        await window.mouse.move(secondBox.x + 5, secondBox.y + secondBox.height / 2, { steps: 20 })
        await window.mouse.up()
        await window.keyboard.up('Shift')
        await window.waitForTimeout(500)
      }

      // Open chat
      await window.locator('.react-flow__node').first().click()
      await window.waitForTimeout(500)
    },
    task: 'Verify which notes are being sent as context to this AI conversation',
    persona: 'Jake (AI automation engineer)',
    expectedBehavior: 'Looks for context indicators, connection visualization, or inspects node properties'
  },
  {
    id: 'complex-graph',
    setup: async (window: Page) => {
      // Create 8 nodes in a grid
      const positions = [
        { x: 200, y: 200 }, { x: 450, y: 200 }, { x: 700, y: 200 }, { x: 950, y: 200 },
        { x: 200, y: 400 }, { x: 450, y: 400 }, { x: 700, y: 400 }, { x: 950, y: 400 }
      ]

      for (const pos of positions) {
        await window.locator('.react-flow__pane').dblclick({ position: pos })
        await window.waitForTimeout(200)
      }

      await window.waitForTimeout(500)
    },
    task: 'Find and select all notes (not conversations or tasks) in this workspace',
    persona: 'Sarah (Obsidian power user)',
    expectedBehavior: 'Uses filter/search, or visually identifies notes by color/icon'
  },
  {
    id: 'api-config',
    setup: async (window: Page) => {
      // Open settings
      const settingsBtn = window.locator('button[aria-label*="Settings"], button[title*="Settings"]').first()
      if (await settingsBtn.count() > 0) {
        await settingsBtn.click()
        await window.waitForTimeout(500)
      }

      // Navigate to AI & Connectors tab
      const aiTab = window.locator('button:has-text("AI & Connectors"), [data-tab="ai"]')
      if (await aiTab.count() > 0) {
        await aiTab.first().click()
        await window.waitForTimeout(300)
      }
    },
    task: 'Add your Anthropic API key and set the default model to Claude Opus 4',
    persona: 'Jake (AI automation engineer)',
    expectedBehavior: 'Fills in API key field, selects model from dropdown'
  },
  {
    id: 'context-debugging',
    setup: async (window: Page) => {
      // Create conversation + note, connect them, select conversation
      await createConversationNode(window)
      await window.waitForTimeout(300)
      await createNoteNode(window)
      await window.waitForTimeout(300)

      // Connect Note → Conversation
      const nodes = window.locator('.react-flow__node')
      const noteBox = await nodes.nth(1).boundingBox()
      const convBox = await nodes.first().boundingBox()

      if (noteBox && convBox) {
        await window.keyboard.down('Shift')
        await window.mouse.move(noteBox.x + noteBox.width - 5, noteBox.y + noteBox.height / 2)
        await window.mouse.down()
        await window.mouse.move(convBox.x + 5, convBox.y + convBox.height / 2, { steps: 20 })
        await window.mouse.up()
        await window.keyboard.up('Shift')
        await window.waitForTimeout(500)
      }

      // Select conversation to open properties
      await window.locator('.react-flow__node').first().click()
      await window.waitForTimeout(500)
    },
    task: 'Change the context injection role for the connected note from "Reference" to "System Prompt"',
    persona: 'Jake (AI automation engineer)',
    expectedBehavior: 'Finds connection properties or node settings, changes role dropdown'
  },
  {
    id: 'workflow-template',
    setup: async (window: Page) => {
      // Create a simple 3-node workflow
      await createConversationNode(window)
      await window.waitForTimeout(200)
      await createNoteNode(window)
      await window.waitForTimeout(200)
      await createNoteNode(window)
      await window.waitForTimeout(500)

      // Select all nodes
      await window.keyboard.press('Control+A')
      await window.waitForTimeout(300)
    },
    task: 'Save these selected nodes as a template called "Research Assistant"',
    persona: 'Ravi (strategy consultant)',
    expectedBehavior: 'Right-clicks selection or uses toolbar, finds "Save as Template", names it'
  }
]

// AI Vision Evaluator with Power User Prompts
class PowerUserEvaluator {
  async evaluateFirstImpression(screenshotPath: string) {
    // This would call Claude API with the power-user prompt
    // For now, returning mock structure
    return {
      model: 'claude-sonnet-4-5-20250929',
      prompt: `You are evaluating professional tooling software...`,
      response: {},
      metadata: {
        timestamp: new Date().toISOString(),
        screenshot_path: screenshotPath,
        cost_usd: 0.01
      }
    }
  }

  async evaluateTaskCompletion(screenshotPath: string, task: string, persona: string) {
    return {
      model: 'claude-sonnet-4-5-20250929',
      prompt: `You are ${persona} evaluating this tool...`,
      response: {},
      metadata: {
        timestamp: new Date().toISOString(),
        screenshot_path: screenshotPath,
        cost_usd: 0.01
      }
    }
  }

  async evaluateInformationScent(screenshotPath: string, targetFeature: string) {
    return {
      model: 'claude-sonnet-4-5-20250929',
      prompt: `You're scanning for: ${targetFeature}...`,
      response: {},
      metadata: {
        timestamp: new Date().toISOString(),
        screenshot_path: screenshotPath,
        cost_usd: 0.01
      }
    }
  }
}

test.describe('Tier 2: Power User Evaluation (v2)', () => {
  const resultsDir = 'e2e/smart-e2e/results/tier2-poweruser'
  let evaluator: PowerUserEvaluator

  test.beforeAll(async () => {
    await fs.mkdir(resultsDir, { recursive: true })
    evaluator = new PowerUserEvaluator()
  })

  test.beforeEach(async ({ window }) => {
    // Reset workspace
    await window.evaluate(async () => {
      await window.api.workspace.resetForTest()
      localStorage.clear()
      sessionStorage.clear()
    })

    await window.reload()
    await waitForFullyRendered(window, { timeout: 15000 })

    // Dismiss onboarding
    const skipButton = window.locator('button:has-text("Skip"), button[title="Skip onboarding"]')
    if ((await skipButton.count()) > 0) {
      await skipButton.first().click()
      await window.waitForTimeout(500)
    }

    // Close modals with ESC
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)
  })

  for (const scenario of POWER_USER_SCENARIOS) {
    test(`${scenario.id}: ${scenario.task}`, async ({ window }) => {
      await waitForFullyRendered(window)

      // Setup scenario
      await scenario.setup(window)
      await waitForFullyRendered(window)
      await window.waitForTimeout(500)

      // Capture screenshot
      const screenshotPath = `e2e/smart-e2e/screenshots/tier2-poweruser-${scenario.id}.png`
      await window.screenshot({ path: screenshotPath, fullPage: false })

      // Three-pass evaluation
      const passA = await evaluator.evaluateFirstImpression(screenshotPath)
      const passB = await evaluator.evaluateTaskCompletion(screenshotPath, scenario.task, scenario.persona)

      // Save results
      await fs.writeFile(
        `${resultsDir}/${scenario.id}-results.json`,
        JSON.stringify({
          scenario: scenario.id,
          task: scenario.task,
          persona: scenario.persona,
          expectedBehavior: scenario.expectedBehavior,
          passA,
          passB
        }, null, 2)
      )

      console.log(`\n=== ${scenario.id} ===`)
      console.log(`Persona: ${scenario.persona}`)
      console.log(`Task: ${scenario.task}`)
      console.log(`Screenshot: ${screenshotPath}`)
    })
  }

  test.afterAll(async () => {
    // Generate summary report
    console.log('\n' + '='.repeat(60))
    console.log('POWER USER EVALUATION COMPLETE')
    console.log('Next: Implement full AIVisionEvaluator with power-user prompts')
    console.log('='.repeat(60))
  })
})
