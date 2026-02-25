// Static Plugin Registry (Main Process)
// ADD ONE LINE HERE when adding a new plugin

import type { PluginManifest, PluginMain, MethodMap } from './types'
import { manifest as notionManifest } from './notion/manifest'
import createNotionPlugin from './notion/main'

// Future plugins:
// import { manifest as githubManifest } from './github/manifest'
// import createGitHubPlugin from './github/main'

/** Each entry pairs a manifest with a factory that returns a PluginMain instance.
 * The generic M is erased at this level — type safety lives inside each plugin's
 * contract.ts + main/index.ts pairing, not in the registry array.
 */
export const pluginEntries: Array<{ manifest: PluginManifest; create: () => PluginMain<MethodMap> }> = [
  { manifest: notionManifest, create: createNotionPlugin },
  // { manifest: githubManifest, create: createGitHubPlugin },
]
