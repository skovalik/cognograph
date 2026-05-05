// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// Sentry error tracking — init before React render so early errors are captured.
// Routed through ./services/sentry initSentry() helper to apply privacy controls
// (PII redaction in messages, fetch-URL scrubbing, replay text/media masking,
// production-only enable). Direct Sentry.init bypasses those.
// Keep all renderer Sentry init in src/renderer/src/services/sentry.ts.
import { initSentry } from './services/sentry'

initSentry()

// Hydrate the API-key cache from main-process safeStorage and migrate any
// legacy plaintext localStorage entries off disk. Fire-and-forget at
// startup; consumers see null until hydrate resolves, which matches the
// prior "no key configured" behavior.
import { hydrateFromMain as hydrateApiKeys } from './services/apiKeyStore'

void hydrateApiKeys()

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Test mode — expose stores for E2E test injection
// IMPORTANT: import.meta.env.DEV/MODE are dead in production builds (statically replaced by Vite).
// process.env.NODE_ENV is also unavailable in renderer (nodeIntegration: false).
// Only window.__TEST_MODE__ works — it's set by the preload at runtime via contextBridge.
if ((window as any).__TEST_MODE__) {
  import('./stores/workspaceStore').then(({ useWorkspaceStore }) => {
    ;(window as any).__workspaceStore = useWorkspaceStore
  })
  import('./stores/uiStore').then(({ useUIStore }) => {
    ;(window as any).__uiStore = useUIStore
  })
  import('./stores/permissionStore').then(({ usePermissionStore }) => {
    ;(window as any).__permissionStore = usePermissionStore
  })
  import('./stores/orchestratorStore').then(({ useOrchestratorStore }) => {
    ;(window as any).__orchestratorStore = useOrchestratorStore
  })
  import('./stores/notificationStore').then(({ useNotificationStore }) => {
    ;(window as any).__notificationStore = useNotificationStore
  })
  // programStore exposes hasPassedFirstRunGate — E2E tests call
  // setFirstRunGatePassed() at setup so the FirstRunSetup modal (which would
  // otherwise intercept all pointer events behind a z-9999 backdrop) does not
  // block node clicks. Only exposed under __TEST_MODE__.
  import('./stores/programStore').then(({ useProgramStore }) => {
    ;(window as any).__programStore = useProgramStore
  })
}
