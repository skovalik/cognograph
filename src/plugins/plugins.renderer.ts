// Static Plugin Registry (Renderer Process)
// ADD ONE LINE HERE when adding a new plugin

import type { PluginRenderer } from './types'
import { renderer as notionRenderer } from './notion/renderer'

// Future plugins:
// import { renderer as githubRenderer } from './github/renderer'

export const rendererEntries: Array<{ id: string; renderer: PluginRenderer }> = [
  { id: 'notion', renderer: notionRenderer },
  // { id: 'github', renderer: githubRenderer },
]
