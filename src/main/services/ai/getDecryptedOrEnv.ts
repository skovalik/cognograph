// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * getDecryptedOrEnv.ts — Centralized AI provider key resolver.
 *
 * Resolution priority ladder:
 *   1. Dev /test/injectKey injection (NODE_ENV !== 'production' only).
 *   2. Supabase api_keys.decrypt(apiKeyId)         — when apiKeyId is set
 *      AND a Supabase decrypter is wired via setSupabaseDecryptor(). The
 *      apiKeyId path is wired-ready but not yet used by call sites
 *      (call sites pass `provider` only); the hook is here so the future
 *      session-context refactor can wire it in without touching call
 *      sites again.
 *   3. Local encrypted-store + safeStorage decrypt — current production
 *      path (electron-store under `encryptedApiKeys.<provider>`, decrypted
 *      via `safeStorage.decryptString`). Preserves the first-run
 *      workflow where keys are entered via the Settings UI.
 *   4. Env-var fallback — `process.env.<PROVIDER>_API_KEY` (e.g.
 *      ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY).
 *   5. Throws if no source resolves.
 *
 * The helper is async so the Supabase apiKeyId path can be a network call
 * without backflipping the caller's signature later. Existing call sites
 * change from `const k = getApiKey('anthropic')` to
 * `const k = await getDecryptedOrEnv('anthropic')`.
 *
 * Test injection: `vi.mock('electron')` + `vi.mock('electron-store')` per
 * the existing `src/main/__tests__/llm.test.ts` pattern. No Electron at
 * runtime in tests.
 */

import { safeStorage as electronSafeStorage, ipcMain } from 'electron'
import Store from 'electron-store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Provider = 'anthropic' | 'openai' | 'gemini' | string

interface EncryptedKeysShape {
  anthropic?: string
  openai?: string
  gemini?: string
  [provider: string]: string | undefined
}

const ENV_NAME_BY_PROVIDER: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
}

function envVarFor(provider: string): string {
  return (
    ENV_NAME_BY_PROVIDER[provider] ?? `${provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`
  )
}

// ---------------------------------------------------------------------------
// Dev injection (priority 1)
// ---------------------------------------------------------------------------

const devInjectedKeys = new Map<string, string>()

/**
 * Inject a key for a provider via the dev path. Used by the
 * `dev:test:injectKey` IPC route and by unit tests. Throws in production
 * to fail-closed.
 */
export function injectKeyForDev(provider: string, key: string): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('injectKeyForDev disabled in production')
  }
  if (!provider || !key) {
    throw new TypeError('injectKeyForDev: provider and key are required')
  }
  devInjectedKeys.set(provider, key)
}

/** Clear all dev-injected keys. */
export function clearInjectedDevKeys(): void {
  devInjectedKeys.clear()
}

/** @internal — for tests. */
export function _peekInjectedKeyForTesting(provider: string): string | undefined {
  return devInjectedKeys.get(provider)
}

// ---------------------------------------------------------------------------
// Supabase decrypter hook (priority 2)
// ---------------------------------------------------------------------------

export type SupabaseDecryptor = (apiKeyId: string) => Promise<string | null>

let supabaseDecryptor: SupabaseDecryptor | null = null

/**
 * Wire a Supabase api_keys decrypter. Production call sites that have a
 * session context (with apiKeyId) will hit this path; otherwise the helper
 * falls through to the local + env-var paths.
 */
export function setSupabaseDecryptor(fn: SupabaseDecryptor | null): void {
  supabaseDecryptor = fn
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

let cachedStore: Store | null = null
function getStore(): Store {
  if (!cachedStore) cachedStore = new Store()
  return cachedStore
}

function getEncryptedKeys(): EncryptedKeysShape {
  try {
    return ((getStore().get('encryptedApiKeys') as EncryptedKeysShape | undefined) ??
      {}) as EncryptedKeysShape
  } catch {
    return {}
  }
}

function decryptLocal(provider: string): string | null {
  try {
    const encrypted = getEncryptedKeys()[provider]
    if (!encrypted) return null
    if (electronSafeStorage.isEncryptionAvailable()) {
      return electronSafeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    }
    // Encryption unavailable — value was stored as-is at write time.
    return encrypted
  } catch {
    return null
  }
}

/**
 * Resolve a decrypted API key for a provider. See module header for the
 * priority ladder. Throws if no source resolves.
 */
export async function getDecryptedOrEnv(provider: string, apiKeyId?: string): Promise<string> {
  if (!provider) throw new TypeError('getDecryptedOrEnv: provider is required')

  // 1. Dev injection
  if (process.env.NODE_ENV !== 'production') {
    const dev = devInjectedKeys.get(provider)
    if (dev) return dev
  }

  // 2. Supabase decrypter (apiKeyId-gated)
  if (apiKeyId && supabaseDecryptor) {
    const k = await supabaseDecryptor(apiKeyId)
    if (k) return k
  }

  // 3. Local encrypted-store + safeStorage
  const local = decryptLocal(provider)
  if (local) return local

  // 4. Env-var fallback
  const envValue = process.env[envVarFor(provider)]
  if (envValue) return envValue

  throw new Error(
    `getDecryptedOrEnv: no source resolved a key for provider="${provider}" ` +
      `(checked dev injection, ${apiKeyId ? 'Supabase, ' : ''}local store, env ${envVarFor(provider)})`,
  )
}

// ---------------------------------------------------------------------------
// Dev /test/injectKey IPC route (NODE_ENV !== 'production' only)
// ---------------------------------------------------------------------------

/**
 * Register the dev /test/injectKey IPC handler. Gated on
 * `process.env.NODE_ENV !== 'production'`; in production this is a no-op.
 *
 * The handler accepts `{ provider, key }` and stashes the key in the
 * in-memory dev injection map. Subsequent `getDecryptedOrEnv(provider)`
 * calls from the renderer-driven flow will resolve to the injected value.
 *
 * For unit testing, pass a mock IPC object (`{ handle: vi.fn(...) }`).
 */
export interface IpcLike {
  handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => void
}

export function registerDevInjectKeyIpc(ipc: IpcLike = ipcMain as unknown as IpcLike): void {
  if (process.env.NODE_ENV === 'production') return
  ipc.handle('dev:test:injectKey', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as { provider?: string; key?: string } | undefined
    if (!payload || !payload.provider || !payload.key) {
      return { success: false, error: 'provider and key are required' }
    }
    try {
      injectKeyForDev(payload.provider, payload.key)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })
}

/** @internal — exposed for testing. */
export const __test = {
  envVarFor,
  decryptLocal,
  resetCachedStore: () => {
    cachedStore = null
  },
}
