// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * artifactThemeSync — broadcasts Cognograph's global theme mode to every
 * registered artifact iframe. Three-tier fallback:
 *
 *   Tier 1 — postMessage handshake (preferred, opt-in for new artifacts)
 *            Artifact posts { type: 'cognograph:theme-capable', modes } on load.
 *            App replies with current theme and re-broadcasts on every change.
 *
 *   Tier 2 — scan-for-toggle-button (primary fallback for existing artifacts)
 *            On iframe load, if no Tier-1 handshake within HANDSHAKE_MS, scan
 *            the contentDocument for a day/night toggle button using a ranked
 *            selector list. Cache the winning selector per node. On theme
 *            change, read the current state and click the button only if the
 *            current state ≠ target state.
 *
 *   Tier 3 — direct data-theme attribute write (last resort)
 *            For same-origin iframes with no button found, write
 *            documentElement.dataset.theme = mode. Works for CSS-only
 *            themed artifacts (e.g. the shader background). Does NOT fire
 *            artifact-internal setTheme side effects — Tier 2 is preferred
 *            when a button exists.
 *
 * Cross-origin iframes silently skip Tier 2 and Tier 3. Tier 1 (postMessage)
 * works cross-origin and is the recommended long-term path.
 */

export type ThemeMode = 'light' | 'dark'

export const CAPABILITY_MESSAGE_TYPE = 'cognograph:theme-capable'
export const THEME_MESSAGE_TYPE = 'cognograph:theme'

const HANDSHAKE_MS = 500

type Registration = {
  iframe: HTMLIFrameElement
  themeCapable: boolean
  toggleSelector: string | null // Tier-2 cached selector (null = not scanned yet / not found)
  tier2Scanned: boolean
}

const registry = new Map<string, Registration>()
let currentMode: ThemeMode = 'dark'

// -----------------------------------------------------------------------------
// Registration
// -----------------------------------------------------------------------------

export function registerArtifactIframe(iframe: HTMLIFrameElement, nodeId: string): void {
  if (registry.has(nodeId)) {
    // Re-registering (iframe src changed) — reset capability + scan state
    const reg = registry.get(nodeId)!
    reg.iframe = iframe
    reg.themeCapable = false
    reg.toggleSelector = null
    reg.tier2Scanned = false
  } else {
    registry.set(nodeId, {
      iframe,
      themeCapable: false,
      toggleSelector: null,
      tier2Scanned: false,
    })
  }

  // Give the artifact 500ms to send the capability handshake. If nothing
  // arrives, kick Tier 2 (button scan).
  const scheduledNodeId = nodeId
  window.setTimeout(() => {
    const r = registry.get(scheduledNodeId)
    if (!r || r.themeCapable || r.tier2Scanned) return
    scanForTier2(scheduledNodeId)
    applyTheme(scheduledNodeId, currentMode)
  }, HANDSHAKE_MS)

  // Send current theme immediately in case capability already declared on load
  // (artifact's inline script ran before this registration). If artifact hasn't
  // set up a listener yet, this message is a no-op; we'll re-send on handshake.
  try {
    iframe.contentWindow?.postMessage({ type: THEME_MESSAGE_TYPE, value: currentMode }, '*')
  } catch {
    // cross-origin send can still succeed via postMessage; any throw is noise
  }
}

export function unregisterArtifactIframe(nodeId: string): void {
  registry.delete(nodeId)
}

// -----------------------------------------------------------------------------
// Capability handshake — called by ArtifactNode's message listener when it
// receives a `cognograph:theme-capable` message from its iframe.
// -----------------------------------------------------------------------------

export function markCapable(nodeId: string): void {
  const reg = registry.get(nodeId)
  if (!reg) return
  reg.themeCapable = true
  reg.tier2Scanned = true // skip scan — Tier 1 is authoritative
  // Send current theme so the artifact syncs immediately
  try {
    reg.iframe.contentWindow?.postMessage({ type: THEME_MESSAGE_TYPE, value: currentMode }, '*')
  } catch {
    // ignore
  }
}

// -----------------------------------------------------------------------------
// Broadcast — called by App.tsx when workspace theme mode changes
// -----------------------------------------------------------------------------

export function broadcastTheme(mode: ThemeMode): void {
  currentMode = mode
  for (const nodeId of registry.keys()) {
    applyTheme(nodeId, mode)
  }
}

function applyTheme(nodeId: string, mode: ThemeMode): void {
  const reg = registry.get(nodeId)
  if (!reg) return

  // Tier 1 — always attempt postMessage (works cross-origin)
  try {
    reg.iframe.contentWindow?.postMessage({ type: THEME_MESSAGE_TYPE, value: mode }, '*')
  } catch {
    // ignore
  }
  if (reg.themeCapable) return // Tier 1 is authoritative

  // Tier 2 / Tier 3 both require same-origin DOM access
  const doc = safeContentDocument(reg.iframe)
  if (!doc) return

  // Tier 2 — click cached toggle button if present and state differs
  if (reg.toggleSelector) {
    const btn = doc.querySelector(reg.toggleSelector) as HTMLElement | null
    if (btn) {
      const current = readCurrentMode(doc, btn)
      if (current !== mode) {
        btn.click()
      }
      return
    }
  }

  // Tier 3 — direct attribute write. Only write if the artifact is already
  // using a data-theme convention (indicates it's designed to respond to it).
  const hadAttr =
    doc.documentElement.hasAttribute('data-theme') || doc.body?.hasAttribute('data-theme')
  if (hadAttr) {
    doc.documentElement.setAttribute('data-theme', mode)
    doc.body?.setAttribute('data-theme', mode)
  }
}

// -----------------------------------------------------------------------------
// Tier 2 — scan for a theme toggle button
// -----------------------------------------------------------------------------

const TIER2_SELECTORS = [
  'button[aria-label*="theme" i]',
  'button[aria-label*="dark" i]',
  'button[aria-label*="light" i]',
  'button[aria-label*="mode" i]',
  'button[id*="theme" i]',
  'button[id*="daynight" i]',
  'button[id*="dark-mode" i]',
  'button[id*="mode-switch" i]',
  '[data-theme-toggle]',
  'button[class*="theme-toggle" i]',
  'button[class*="daynight" i]',
  'button[class*="dark-toggle" i]',
  'button[class*="mode-toggle" i]',
  'button[class*="theme-switch" i]',
  'button[title*="theme" i]',
  'button[title*="dark mode" i]',
  'button[title*="light mode" i]',
] as const

function scanForTier2(nodeId: string): void {
  const reg = registry.get(nodeId)
  if (!reg) return
  reg.tier2Scanned = true

  const doc = safeContentDocument(reg.iframe)
  if (!doc) return

  for (const selector of TIER2_SELECTORS) {
    const candidates = Array.from(doc.querySelectorAll(selector)) as HTMLElement[]
    if (candidates.length === 0) continue
    // Prefer candidates inside <header> or top 30% of body height
    const preferred = candidates.find((el) => isInHeaderArea(el, doc))
    const winner = preferred || candidates[0]
    if (winner) {
      reg.toggleSelector = selector
      return
    }
  }
}

function isInHeaderArea(el: HTMLElement, doc: Document): boolean {
  if (el.closest('header')) return true
  const bodyH = doc.body?.getBoundingClientRect().height || 0
  if (bodyH === 0) return false
  const rect = el.getBoundingClientRect()
  return rect.top < bodyH * 0.3
}

// -----------------------------------------------------------------------------
// Current-mode readers — check the iframe's state before clicking (avoid
// flipping an already-correct artifact)
// -----------------------------------------------------------------------------

function readCurrentMode(doc: Document, btn: HTMLElement): ThemeMode | null {
  const docTheme = doc.documentElement.getAttribute('data-theme')
  if (docTheme === 'dark' || docTheme === 'light') return docTheme
  const bodyTheme = doc.body?.getAttribute('data-theme')
  if (bodyTheme === 'dark' || bodyTheme === 'light') return bodyTheme
  // Tailwind convention
  if (doc.documentElement.classList.contains('dark')) return 'dark'
  // aria-pressed on the toggle button (true = dark mode by common convention)
  const pressed = btn.getAttribute('aria-pressed')
  if (pressed === 'true') return 'dark'
  if (pressed === 'false') return 'light'
  return null // unreadable — caller should skip rather than guess
}

// -----------------------------------------------------------------------------
// Cross-origin guard
// -----------------------------------------------------------------------------

function safeContentDocument(iframe: HTMLIFrameElement): Document | null {
  try {
    return iframe.contentDocument
  } catch {
    return null // cross-origin
  }
}
