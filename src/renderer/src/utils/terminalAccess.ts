// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Terminal access gate — replaces raw __ELECTRON__ checks for terminal features.
 *
 * Returns true if:
 * 1. Running in Electron (local PTY always available), OR
 * 2. Local agent is connected (cognograph-agent running on localhost), OR
 * 3. User is authenticated (plan is 'free' or 'pro', not null)
 *    - Free tier: 30min/day cloud terminal
 *    - Pro tier: unlimited cloud terminal
 *    - The real security boundary is the server-side JWT check in terminalRelay.ts
 */

import { useEntitlementsStore } from '../stores/entitlementsStore'

export function hasTerminalAccess(): boolean {
  // Electron always has local terminal
  if ((window as any).__ELECTRON__) return true

  // Local agent running (probe sets this flag)
  const agentConnected = localStorage.getItem('cognograph:localAgentConnected') === 'true'
  if (agentConnected) return true

  // Cloud terminal: any authenticated user (plan !== null means entitlements were fetched)
  const { plan } = useEntitlementsStore.getState()
  return plan !== null
}
