// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

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
}
