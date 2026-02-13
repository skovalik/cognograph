import { ipcMain, safeStorage } from 'electron'
import Store from 'electron-store'

interface SettingsSchema {
  theme: 'dark' | 'light'
  autoSave: boolean
  autoSaveInterval: number
  defaultProvider: 'anthropic' | 'gemini' | 'openai'
  recentWorkspaces: string[]
  encryptedApiKeys: {
    anthropic?: string
    gemini?: string
    openai?: string
  }
}

const store = new Store<SettingsSchema>({
  defaults: {
    theme: 'dark',
    autoSave: true,
    autoSaveInterval: 2000,
    defaultProvider: 'anthropic',
    recentWorkspaces: [],
    encryptedApiKeys: {}
  }
})

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', (_event, key: keyof SettingsSchema) => {
    return store.get(key)
  })

  ipcMain.handle('settings:set', (_event, key: keyof SettingsSchema, value: unknown) => {
    store.set(key, value as SettingsSchema[typeof key])
  })

  ipcMain.handle('settings:getApiKey', (_event, provider: string) => {
    try {
      const encryptedKeys = store.get('encryptedApiKeys', {})
      const encrypted = encryptedKeys[provider as keyof typeof encryptedKeys]
      if (!encrypted) return null

      if (safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
        return decrypted
      }
      // Fallback: return as-is (not encrypted)
      return encrypted
    } catch {
      return null
    }
  })

  ipcMain.handle('settings:setApiKey', async (_event, provider: string, key: string) => {
    try {
      console.log(`[Settings] Setting API key for provider: ${provider}`)
      console.log(`[Settings] Key length: ${key?.length || 0}`)

      const encryptedKeys = store.get('encryptedApiKeys') || {}
      console.log(`[Settings] Current encrypted keys object:`, Object.keys(encryptedKeys))

      const isEncryptionAvailable = safeStorage.isEncryptionAvailable()
      console.log(`[Settings] Encryption available: ${isEncryptionAvailable}`)

      if (isEncryptionAvailable) {
        const encrypted = safeStorage.encryptString(key).toString('base64')
        encryptedKeys[provider as keyof typeof encryptedKeys] = encrypted
        console.log(`[Settings] API key encrypted for: ${provider}`)
      } else {
        // Fallback: store as-is (not recommended for production)
        console.log(`[Settings] Encryption not available, storing key as-is for: ${provider}`)
        encryptedKeys[provider as keyof typeof encryptedKeys] = key
      }

      store.set('encryptedApiKeys', encryptedKeys)
      console.log(`[Settings] API key saved successfully for: ${provider}`)
      return { success: true }
    } catch (error) {
      console.error(`[Settings] Failed to save API key for ${provider}:`, error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })
}
