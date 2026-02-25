// Notion Plugin IPC Contract
// Shared between main and renderer processes

import type { MethodMap } from '../types'

export interface NotionMethods extends MethodMap {
  testConnection: {
    args: []
    return: { success: boolean; workspaceName?: string; error?: string }
  }
  isConnected: {
    args: []
    return: { connected: boolean; config: { workflowsDbId: string; execLogDbId: string } | null }
  }
  health: {
    args: []
    return: { circuitState: string; syncEnabled: boolean; hasToken: boolean; hasConfig: boolean }
  }
  // Settings/credential methods needed by NotionSettingsTab:
  getApiKey: {
    args: []
    return: string | null
  }
  setApiKey: {
    args: [token: string]
    return: void
  }
  getConfig: {
    args: []
    return: { workflowsDbId: string; execLogDbId: string; syncEnabled: boolean }
  }
  setConfig: {
    args: [config: { workflowsDbId: string; execLogDbId: string; syncEnabled: boolean }]
    return: void
  }
  // Debug method to fetch actual database schema
  getWorkflowsSchema: {
    args: []
    return: { properties: Record<string, { type: string }> } | { error: string }
  }
}
