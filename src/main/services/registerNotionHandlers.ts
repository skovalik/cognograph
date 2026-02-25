import { ipcMain } from 'electron'
import { notionService } from './notionService'

export function registerNotionHandlers(): void {
  // Test Notion connection
  ipcMain.handle('notion:testConnection', async () => {
    try {
      return await notionService.testConnection()
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  })

  // Check if Notion is connected
  ipcMain.handle('notion:isConnected', async () => {
    const token = notionService.getToken()
    const config = notionService.getConfig()
    return {
      connected: !!(token && config),
      config
    }
  })

  // Get health status
  ipcMain.handle('notion:health', async () => {
    return {
      circuitState: notionService.getCircuitBreakerState(),
      syncEnabled: notionService.isSyncEnabled(),
      hasToken: !!notionService.getToken(),
      hasConfig: !!notionService.getConfig()
    }
  })
}
