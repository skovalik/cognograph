// Plugin Renderer Registry
// Manages plugin UI components and creates typed bridges for renderer-side plugin calls

import type { TypedPluginBridge, MethodMap } from './types'
import { rendererEntries } from './plugins.renderer'

/**
 * RegisteredTab wraps a plugin component with its own bridge factory.
 * The `render` function creates the correctly-typed bridge per plugin,
 * avoiding the TypedPluginBridge<any> erasure problem.
 *
 * Each plugin's renderer/index.ts exports a `render` function that creates
 * the component with the correctly-typed bridge. The registry doesn't need
 * to know the method map — each plugin handles its own type narrowing.
 */
interface RegisteredTab {
  pluginId: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Renders the settings tab with a correctly-typed bridge (type narrowing stays inside the plugin) */
  render: () => React.ReactElement
}

const pluginTabs: RegisteredTab[] = []

/**
 * Called once at app startup to register all plugin renderer components.
 * Optionally validates renderer IDs against enabled plugin IDs from main process.
 */
export async function initRendererPlugins(): Promise<void> {
  // Validate renderer IDs match registered main-process plugins.
  // Uses a dedicated IPC channel (not plugin:call) to avoid regex validation issues.
  try {
    const enabledIds = await window.api.plugins.getEnabledIds() as string[]
    for (const { id } of rendererEntries) {
      if (!enabledIds.includes(id)) {
        console.warn(`[plugin-renderer] Plugin '${id}' registered in renderer but not found in main process`)
      }
    }
  } catch {
    // Skip validation in tests or if channel not registered
  }

  for (const { id, renderer } of rendererEntries) {
    if (renderer.settingsTab) {
      const tab = renderer.settingsTab
      pluginTabs.push({
        pluginId: id,
        label: tab.label,
        icon: tab.icon,
        render: () => {
          const Component = tab.component
          const bridge = createPluginBridge(id)
          return <Component plugin={bridge} />
        }
      })
    }
  }
}

/** Called by SettingsModal to get plugin tabs */
export function getPluginSettingsTabs(): RegisteredTab[] {
  return pluginTabs
}

/**
 * Create a typed plugin bridge for a specific plugin.
 *
 * TRUST BOUNDARY NOTE: The generic M is caller-asserted — nothing structurally
 * links the pluginId string to the method map M at the type level. This is an
 * inherent limitation of any cross-process typed system in Electron, since the
 * preload bridge serializes all data through structured clone. The type safety
 * guarantee is: if both main and renderer import the same contract.ts file,
 * the types match. This is enforced by convention + code review, not by the
 * type system. See plugin-system.md Section 24 for a full discussion of inherent limitations.
 */
export function createPluginBridge<M extends MethodMap>(pluginId: string): TypedPluginBridge<M> {
  return {
    call: <K extends keyof M & string>(method: K, ...args: M[K]['args']) =>
      window.api.plugin.call(pluginId, method, ...args) as Promise<M[K]['return']>,
    on: (event: string, callback: (...args: unknown[]) => void) =>
      window.api.plugin.on(pluginId, event, callback)
  }
}
