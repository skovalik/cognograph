// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Shared helpers for welcome screen E2E tests.
 *
 * Imported by both:
 *   - foundation-welcome.spec.ts  (Electron, uses fixtures/electronApp.ts)
 *   - web-welcome.spec.ts         (Web, uses baseURL from playwright.config.ts)
 *
 * CSS selectors follow the BEM convention used throughout the codebase —
 * no data-testid attributes.
 *
 * SSE mock format matches the event types parsed by agentAdapter.ts:
 *   chunk → text_delta
 *   complete → done (with usage shape)
 */

import type { Page } from '@playwright/test'

// ── CSS Selectors ─────────────────────────────────────────────────────────────

export const WELCOME_SELECTORS = {
  welcomeScreen: '.welcome-screen',
  heading: '.welcome-screen__heading',
  input: '.welcome-screen__input',
  submit: '.welcome-screen__submit',
  backdrop: '.welcome-screen__backdrop',
  intro: '.welcome-screen__intro',
  bottomCommandBar: '.bottom-command-bar',
  commandInput: '.bottom-command-bar__input',
  commandCompletions: '.bottom-command-bar__completions',
  responseNarration: '.cmd-response-panel__entry-response',
  reactFlowNode: '.react-flow__node',
  reactFlow: '.react-flow',
}

// ── Welcome dismiss helpers ────────────────────────────────────────────────────

/**
 * Seed a node via the workspace store to make the welcome screen hide.
 *
 * Welcome visibility is now: `nodeCount === 0 && !sessionDismissed`.
 * Adding a node sets nodeCount > 0, which hides the welcome screen.
 */
export async function seedNodeToDismissWelcome(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as any).__workspaceStore
    if (store) store.getState().addNode('note', { x: 300, y: 300 })
  })
  await page.waitForTimeout(300)
}

/**
 * Submit the welcome form by typing text and pressing Enter.
 * This triggers onComplete which sets sessionDismissed = true.
 */
export async function submitWelcome(page: Page, text = 'Test command'): Promise<void> {
  const input = page.locator(WELCOME_SELECTORS.input)
  await input.fill(text)
  await page.keyboard.press('Enter')
  // Wait for morph animation + unmount
  const ws = page.locator(WELCOME_SELECTORS.welcomeScreen)
  await ws.waitFor({ state: 'hidden', timeout: 10000 })
}

/**
 * Inject a BYOK API key so the welcome screen doesn't block on key entry.
 * @param key - API key string (defaults to a safe test sentinel)
 */
export async function setBYOKKey(page: Page, key = 'test-api-key'): Promise<void> {
  await page.evaluate((k) => {
    localStorage.setItem('cognograph:apikey:anthropic', k)
  }, key)
}

// ── Mock helpers (web tests only) ─────────────────────────────────────────────
// These helpers intercept network requests via page.route().
// They are no-ops in Electron tests where requests go through the main process.

/**
 * Mock Supabase Auth endpoints so web tests don't need a live Supabase instance.
 * Returns a minimal anonymous session that satisfies the auth store.
 */
export async function mockSupabaseAuth(page: Page): Promise<void> {
  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'test-jwt-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh',
        user: { id: 'test-anon-user', aud: 'authenticated', role: 'anon' },
      }),
    })
  })
}

/**
 * Mock the /api/chat SSE endpoint.
 *
 * The SSE event format matches what agentAdapter.ts parses:
 *   - `chunk`    → emits text_delta
 *   - `complete` → emits done with usage
 *
 * @param responseText - The assistant reply text to stream back.
 */
export async function mockChatAPI(
  page: Page,
  responseText = 'Done. Created a note about testing.',
): Promise<void> {
  await page.route('**/api/chat', async (route) => {
    const body = [
      `data: {"type":"chunk","content":"${responseText}"}\n\n`,
      'data: {"type":"complete","usage":{"inputTokens":100,"outputTokens":50}}\n\n',
    ].join('')
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    })
  })
}

/**
 * Mock /api/chat to return an error response.
 * Useful for testing error-state rendering in the response panel.
 *
 * @param status - HTTP status code (defaults to 500)
 */
export async function mockChatAPIError(page: Page, status = 500): Promise<void> {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({ status, body: 'Internal Server Error' })
  })
}
