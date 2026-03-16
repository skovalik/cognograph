// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { PluginManifest } from '../types'

export const manifest: PluginManifest = {
  id: 'notion',
  name: 'Notion Integration',
  version: '0.1.0',
  apiVersion: 1,
  description: 'Syncs Cognograph workspaces and orchestrator runs to Notion databases',
  capabilities: [
    'ipc',
    'settings',
    'credentials',
    'network',
    'settings-tab',
    'filesystem',
    'workspace-read'
  ],
  events: ['workspace:saved', 'orchestrator:run-complete', 'workspace:loaded', 'app:quit'],
  dependencies: ['@notionhq/client']
}
