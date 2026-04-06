// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// Static Plugin Registry (Renderer Process)
// ADD ONE LINE HERE when adding a new plugin

import { renderer as notionRenderer } from './notion/renderer'
import type { PluginRenderer } from './types'

// Future plugins:
// import { renderer as githubRenderer } from './github/renderer'

export const rendererEntries: Array<{ id: string; renderer: PluginRenderer }> = [
  { id: 'notion', renderer: notionRenderer },
  // { id: 'github', renderer: githubRenderer },
]
