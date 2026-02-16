/**
 * Screenshot Capture Utilities for AI Vision Analysis
 *
 * Captures clean screenshots with proper stabilization and metadata.
 */

import type { Page } from '@playwright/test'
import { waitForFullyRendered } from './react-flow-stabilizer'
import path from 'path'
import fs from 'fs/promises'

export interface ScreenshotMetadata {
  /** Test name or scenario */
  scenario: string
  /** Timestamp */
  timestamp: string
  /** Screen state description */
  state: string
  /** Window dimensions */
  viewport: { width: number; height: number }
  /** Node count at time of capture */
  nodeCount: number
}

export interface CaptureOptions {
  /** Output directory */
  outputDir?: string
  /** Scenario name */
  scenario?: string
  /** State description */
  state?: string
  /** Wait for stabilization */
  waitForStable?: boolean
}

/**
 * Capture screenshot with metadata
 */
export async function captureWithMetadata(
  page: Page,
  filename: string,
  options: CaptureOptions = {}
): Promise<{ path: string; metadata: ScreenshotMetadata }> {
  const {
    outputDir = 'e2e/smart-e2e/screenshots',
    scenario = 'unknown',
    state = 'unknown',
    waitForStable = true
  } = options

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true })

  // Wait for stability if requested
  if (waitForStable) {
    await waitForFullyRendered(page)
  }

  // Get viewport size
  const viewport = page.viewportSize() || { width: 0, height: 0 }

  // Get node count
  const nodeCount = await page.locator('.react-flow__node').count()

  // Create metadata
  const metadata: ScreenshotMetadata = {
    scenario,
    state,
    timestamp: new Date().toISOString(),
    viewport,
    nodeCount
  }

  // Generate full path
  const screenshotPath = path.join(outputDir, `${filename}.png`)
  const metadataPath = path.join(outputDir, `${filename}.json`)

  // Capture screenshot
  await page.screenshot({ path: screenshotPath, fullPage: true })

  // Write metadata
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

  return { path: screenshotPath, metadata }
}

/**
 * Capture multiple screenshots for a sequence
 */
export async function captureSequence(
  page: Page,
  baseFilename: string,
  states: Array<{ state: string; action?: () => Promise<void> }>,
  options: CaptureOptions = {}
): Promise<Array<{ path: string; metadata: ScreenshotMetadata }>> {
  const results: Array<{ path: string; metadata: ScreenshotMetadata }> = []

  for (let i = 0; i < states.length; i++) {
    const { state, action } = states[i]

    // Execute action if provided
    if (action) {
      await action()
    }

    // Capture
    const result = await captureWithMetadata(
      page,
      `${baseFilename}-${i + 1}-${state.replace(/\s+/g, '-')}`,
      { ...options, state }
    )

    results.push(result)
  }

  return results
}
