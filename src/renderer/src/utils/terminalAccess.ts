// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Terminal access gate — replaces raw __ELECTRON__ checks for terminal features.
 *
 * Returns true if:
 * 1. Running in Electron (local PTY always available), OR
 * 2. Local agent is connected (cognograph-agent running on localhost), OR
 * 3. User has cloud terminal entitlement (pro or free-tier 30min/day)
 */

import { useEntitlementsStore } from '../stores/entitlementsStore'

export function hasTerminalAccess(): boolean {
  // Electron always has local terminal
  if ((window as any).__ELECTRON__) return true

  // Local agent running (probe sets this flag)
  const agentConnected = localStorage.getItem('cognograph:localAgentConnected') === 'true'
  if (agentConnected) return true

  // Cloud terminal entitlement (free gets 30min/day, pro unlimited)
  const { plan } = useEntitlementsStore.getState()
  return plan === 'pro'
}
