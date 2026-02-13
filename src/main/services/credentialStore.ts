// credentialStore -- Encrypted credential storage for workspace-scoped secrets
//
// Uses Electron's safeStorage API to encrypt/decrypt credentials at rest.
// Each workspace has its own credential namespace to prevent cross-workspace access.
// Credentials are NEVER logged, included in error messages, or exposed to template resolution.

import { safeStorage } from 'electron'
import Store from 'electron-store'

interface CredentialEntry {
  encryptedValue: string
  label: string
  credentialType: string
  updatedAt: number
}

interface CredentialStoreSchema {
  credentials: Record<string, Record<string, CredentialEntry>>
}

const store = new Store<CredentialStoreSchema>({
  name: 'cognograph-credentials',
  defaults: {
    credentials: {},
  },
})

/**
 * Returns a masked version of the credential for display (e.g., "****word").
 * Returns null if the credential does not exist or decryption fails.
 */
export function getMaskedCredential(workspaceId: string, credentialKey: string): string | null {
  const real = getRealCredential(workspaceId, credentialKey)
  if (!real) return null

  if (real.length <= 4) {
    return '****'
  }
  return '****' + real.slice(-4)
}

/**
 * Returns the decrypted credential value.
 * ONLY use this at the HTTP execution layer, never in template resolution or logging.
 * Returns null if the credential is not found or decryption fails.
 */
export function getRealCredential(workspaceId: string, credentialKey: string): string | null {
  const allCredentials = store.get('credentials', {})
  const workspaceCredentials = allCredentials[workspaceId]
  if (!workspaceCredentials) return null

  const entry = workspaceCredentials[credentialKey]
  if (!entry) return null

  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(entry.encryptedValue, 'base64'))
    }
    // Fallback: return as-is if encryption not available
    return entry.encryptedValue
  } catch {
    // Decryption failed (keychain corrupted, machine changed)
    return null
  }
}

/**
 * Store an encrypted credential scoped to a workspace.
 */
export function setCredential(
  workspaceId: string,
  credentialKey: string,
  value: string,
  label: string,
  credentialType: string,
): void {
  const allCredentials = store.get('credentials', {})
  if (!allCredentials[workspaceId]) {
    allCredentials[workspaceId] = {}
  }

  let encryptedValue: string
  if (safeStorage.isEncryptionAvailable()) {
    encryptedValue = safeStorage.encryptString(value).toString('base64')
  } else {
    // Fallback: store as-is (not recommended for production)
    encryptedValue = value
  }

  allCredentials[workspaceId][credentialKey] = {
    encryptedValue,
    label,
    credentialType,
    updatedAt: Date.now(),
  }

  store.set('credentials', allCredentials)
}

/**
 * Delete a credential from a workspace.
 */
export function deleteCredential(workspaceId: string, credentialKey: string): void {
  const allCredentials = store.get('credentials', {})
  const workspaceCredentials = allCredentials[workspaceId]
  if (!workspaceCredentials) return

  delete workspaceCredentials[credentialKey]

  // Clean up empty workspace entries
  if (Object.keys(workspaceCredentials).length === 0) {
    delete allCredentials[workspaceId]
  }

  store.set('credentials', allCredentials)
}

/**
 * List all credential keys for a workspace (without values).
 */
export function listCredentials(workspaceId: string): Array<{
  key: string
  label: string
  credentialType: string
  updatedAt: number
  masked: string
}> {
  const allCredentials = store.get('credentials', {})
  const workspaceCredentials = allCredentials[workspaceId]
  if (!workspaceCredentials) return []

  return Object.entries(workspaceCredentials).map(([key, entry]) => ({
    key,
    label: entry.label,
    credentialType: entry.credentialType,
    updatedAt: entry.updatedAt,
    masked: getMaskedCredential(workspaceId, key) || '****',
  }))
}
