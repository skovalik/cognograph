// Notion Plugin (Main Process)
// Wraps existing Notion services with the plugin interface

import type { PluginMain, PluginContext } from '../../types'
import type { NotionMethods } from '../contract'
// Import existing singleton services (will be refactored to constructor injection in future)
import { notionService } from '../../../main/services/notionService'
import { workflowSync } from '../../../main/services/notionSync'
import { execLogWriter } from '../../../main/services/notionExecLog'
import { nodeSyncEngine } from './nodeSyncEngine'

export default function createNotionPlugin(): PluginMain<NotionMethods> {
  let ctx: PluginContext

  return {
    async init(pluginCtx: PluginContext) {
      ctx = pluginCtx
      ctx.log.info('Notion plugin initialized')

      // Replay queued syncs from previous session
      await workflowSync.initialize()

      // Initialize node-level sync engine (Section 10a)
      await nodeSyncEngine.init(pluginCtx)
    },

    ipcHandlers: {
      testConnection: async () => notionService.testConnection(),

      isConnected: async () => ({
        connected: notionService.isConnected(),
        config: notionService.getConfig()
      }),

      health: async () => ({
        circuitState: notionService.getCircuitBreakerState(),
        syncEnabled: notionService.isSyncEnabled(),
        hasToken: notionService.hasToken(),
        hasConfig: notionService.hasConfig()
      }),

      getApiKey: async () => notionService.getToken(),

      setApiKey: async (...args) => {
        const [token] = args
        notionService.setToken(token as string)
      },

      getConfig: async () => {
        const config = notionService.getConfig()
        return {
          workflowsDbId: config?.workflowsDbId ?? '',
          execLogDbId: config?.execLogDbId ?? '',
          syncEnabled: notionService.isSyncEnabled()
        }
      },

      setConfig: async (...args) => {
        const [config] = args
        const cfg = config as { workflowsDbId: string; execLogDbId: string; syncEnabled: boolean }
        notionService.setConfig(cfg.workflowsDbId, cfg.execLogDbId)
        notionService.setSyncEnabled(cfg.syncEnabled)
      },

      getWorkflowsSchema: async () => {
        try {
          const result = await notionService.getWorkflowsSchema()
          console.log('[notion plugin] getWorkflowsSchema result:', result)
          return result
        } catch (err) {
          console.error('[notion plugin] getWorkflowsSchema error:', err)
          return { error: String(err) }
        }
      },
    },

    eventHandlers: {
      'workspace:loaded': (data) => {
        nodeSyncEngine.onWorkspaceLoaded(data).catch(err =>
          console.error('[notion] node sync load error:', err)
        )
      },
      'workspace:saved': (data) => {
        workflowSync.onWorkspaceSaved(data)
        nodeSyncEngine.onWorkspaceSaved(data).catch(err =>
          console.error('[notion] node sync save error:', err)
        )
      },
      'orchestrator:run-complete': (data) => {
        execLogWriter.log(data).catch(err =>
          console.error('[notion] exec log error:', err)
        )
      },
      'app:quit': () => {
        nodeSyncEngine.onAppQuit().catch(err =>
          console.error('[notion] node sync quit error:', err)
        )
      }
    }
  }
}
