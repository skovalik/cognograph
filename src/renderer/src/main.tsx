// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// Sentry error tracking — init before React render so early errors are captured.
// In the Electron renderer, @sentry/electron/renderer re-exports @sentry/browser
// with Electron-aware transport. Guard on SENTRY_DSN injected via Vite define.
import * as Sentry from '@sentry/electron/renderer'
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
  })
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
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
}
