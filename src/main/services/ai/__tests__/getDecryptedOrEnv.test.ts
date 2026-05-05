// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * getDecryptedOrEnv.test.ts — provider key resolver helper + dev /test/injectKey IPC.
 *
 * Verifies the resolution priority ladder:
 *   1. Dev injection (via injectKeyForDev or the IPC route)
 *   2. Supabase decrypter (when wired + apiKeyId set)
 *   3. Local encrypted store (electron-store + safeStorage mock)
 *   4. Env-var fallback
 *   5. Throws if no source resolves
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ipcHandlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      ipcHandlers.set(channel, handler)
    }),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    decryptString: vi.fn(),
  },
}))

let mockEncryptedKeys: Record<string, string | undefined> = {}

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get(key: string, fallback?: unknown) {
        if (key === 'encryptedApiKeys') return mockEncryptedKeys
        return fallback
      }
      set(): void {}
    },
  }
})

import {
  __test,
  clearInjectedDevKeys,
  getDecryptedOrEnv,
  injectKeyForDev,
  registerDevInjectKeyIpc,
  setSupabaseDecryptor,
} from '../getDecryptedOrEnv'

beforeEach(() => {
  ipcHandlers.clear()
  mockEncryptedKeys = {}
  clearInjectedDevKeys()
  setSupabaseDecryptor(null)
  __test.resetCachedStore()
  delete process.env.NODE_ENV
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.OPENAI_API_KEY
  delete process.env.GEMINI_API_KEY
})

afterEach(() => {
  delete process.env.NODE_ENV
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.OPENAI_API_KEY
  delete process.env.GEMINI_API_KEY
})

describe('getDecryptedOrEnv — resolution ladder', () => {
  it('1. Dev injection takes priority', async () => {
    process.env.NODE_ENV = 'development'
    injectKeyForDev('anthropic', 'dev-injected-key')
    process.env.ANTHROPIC_API_KEY = 'env-key'
    mockEncryptedKeys = { anthropic: 'local-store-key' }

    const result = await getDecryptedOrEnv('anthropic')
    expect(result).toBe('dev-injected-key')
  })

  it('1. Dev injection is ignored in production', async () => {
    process.env.NODE_ENV = 'production'
    // injectKeyForDev throws in production — exercise the resolver path
    // separately by stashing into a NODE_ENV that allows injection then
    // flipping production for the resolution call.
    process.env.NODE_ENV = 'development'
    injectKeyForDev('anthropic', 'dev-injected-key')
    process.env.NODE_ENV = 'production'
    process.env.ANTHROPIC_API_KEY = 'env-key'
    const result = await getDecryptedOrEnv('anthropic')
    expect(result).toBe('env-key')
  })

  it('2. Supabase decrypter resolves when apiKeyId is set + decrypter is wired', async () => {
    setSupabaseDecryptor(async (apiKeyId) => `supabase-decrypted-${apiKeyId}`)
    process.env.ANTHROPIC_API_KEY = 'env-fallback'
    const result = await getDecryptedOrEnv('anthropic', 'key-row-123')
    expect(result).toBe('supabase-decrypted-key-row-123')
  })

  it('2. Supabase decrypter falls through if it returns null', async () => {
    setSupabaseDecryptor(async () => null)
    mockEncryptedKeys = { anthropic: 'local-store-key' }
    const result = await getDecryptedOrEnv('anthropic', 'key-row-123')
    expect(result).toBe('local-store-key')
  })

  it('3. Local encrypted store resolves when encryption is unavailable (passthrough)', async () => {
    mockEncryptedKeys = { anthropic: 'local-store-key' }
    const result = await getDecryptedOrEnv('anthropic')
    expect(result).toBe('local-store-key')
  })

  it('4. Env-var fallback when no other source resolves', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-anthropic'
    const result = await getDecryptedOrEnv('anthropic')
    expect(result).toBe('env-anthropic')
  })

  it('4. Env-var name follows <PROVIDER>_API_KEY convention for known + custom providers', async () => {
    expect(__test.envVarFor('anthropic')).toBe('ANTHROPIC_API_KEY')
    expect(__test.envVarFor('openai')).toBe('OPENAI_API_KEY')
    expect(__test.envVarFor('gemini')).toBe('GEMINI_API_KEY')
    // Custom providers get the uppercase-snake-case form
    expect(__test.envVarFor('mistral')).toBe('MISTRAL_API_KEY')
    expect(__test.envVarFor('foo-bar')).toBe('FOO_BAR_API_KEY')
  })

  it('5. Throws when no source resolves a key', async () => {
    await expect(getDecryptedOrEnv('anthropic')).rejects.toThrow(/no source resolved/)
  })

  it('Rejects empty provider', async () => {
    await expect(getDecryptedOrEnv('')).rejects.toThrow(TypeError)
  })

  it('injectKeyForDev throws in production', () => {
    process.env.NODE_ENV = 'production'
    expect(() => injectKeyForDev('anthropic', 'k')).toThrow(/disabled in production/)
  })

  it('injectKeyForDev requires both provider and key', () => {
    process.env.NODE_ENV = 'development'
    expect(() => injectKeyForDev('', 'k')).toThrow(TypeError)
    expect(() => injectKeyForDev('anthropic', '')).toThrow(TypeError)
  })
})

describe('registerDevInjectKeyIpc — dev /test/injectKey IPC route', () => {
  it('registers the dev:test:injectKey channel in non-production', async () => {
    process.env.NODE_ENV = 'development'
    const handle = vi.fn(
      (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
        ipcHandlers.set(channel, listener as (...args: unknown[]) => Promise<unknown>)
      },
    )

    registerDevInjectKeyIpc({ handle })
    expect(ipcHandlers.has('dev:test:injectKey')).toBe(true)

    const handler = ipcHandlers.get('dev:test:injectKey')!
    const result = await handler({}, { provider: 'anthropic', key: 'ipc-injected' })
    expect(result).toEqual({ success: true })

    // Resolution now picks up the IPC-injected key.
    const resolved = await getDecryptedOrEnv('anthropic')
    expect(resolved).toBe('ipc-injected')
  })

  it('is a no-op in production', () => {
    process.env.NODE_ENV = 'production'
    const handle = vi.fn()
    registerDevInjectKeyIpc({ handle })
    expect(handle).not.toHaveBeenCalled()
  })

  it('handler returns an error when payload is malformed', async () => {
    process.env.NODE_ENV = 'development'
    const handle = vi.fn(
      (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
        ipcHandlers.set(channel, listener as (...args: unknown[]) => Promise<unknown>)
      },
    )
    registerDevInjectKeyIpc({ handle })
    const handler = ipcHandlers.get('dev:test:injectKey')!

    const noPayload = await handler({})
    expect(noPayload).toMatchObject({ success: false, error: expect.any(String) })

    const missingKey = await handler({}, { provider: 'anthropic' })
    expect(missingKey).toMatchObject({ success: false, error: expect.any(String) })
  })
})
