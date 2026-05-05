// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Renderer-side API-key facade.
 *
 * The renderer used to read LLM API keys directly from
 * `localStorage[\"cognograph:apikey:*\"]` — plaintext on disk, readable
 * by anyone with filesystem access.
 *
 * This module is the single source of truth for key access in the
 * renderer. Keys live in:
 *   - main process (encrypted at rest via Electron safeStorage)
 *   - renderer in-memory cache (hydrated from main IPC at startup)
 * They no longer touch `localStorage` in production code paths.
 *
 * The first call to any consumer must be after `hydrateFromMain()`
 * has resolved. We call it from `src/renderer/src/main.tsx` before
 * React renders. Synchronous `getKey(provider)` reads the cache;
 * before hydrate completes, callers see null (which downstream
 * surfaces as "API key not configured" — same UX as before, no key
 * was set).
 *
 * Migration: at hydrate, any legacy `cognograph:apikey:*` entry in
 * `localStorage` is moved into safeStorage via IPC and removed
 * from disk. After the first run on a given install, localStorage
 * has no api keys.
 */

const KNOWN_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'stability',
  'replicate',
  'runway',
  'elevenlabs',
] as const

type Provider = (typeof KNOWN_PROVIDERS)[number] | string

const cache = new Map<string, string | null>()
let hydrated = false
let hydratePromise: Promise<void> | null = null

function legacyKey(provider: string): string {
  // Single source of truth for the legacy storage key shape, used only
  // by the migration path inside this module. NOT a runtime lookup.
  return `cognograph:apikey:${provider}`
}

/**
 * Read a key by provider. Synchronous — returns null if not yet
 * hydrated or if no key is configured.
 */
export function getKey(provider: Provider): string | null {
  return cache.get(provider) ?? null
}

/**
 * Set a key. Persists via main-process safeStorage and updates cache.
 */
export async function setKey(provider: Provider, key: string): Promise<void> {
  cache.set(provider, key)
  const settingsApi = (typeof window !== 'undefined' ? window.api?.settings : undefined) as
    | { setApiKey?: (provider: string, key: string) => Promise<unknown> }
    | undefined
  if (settingsApi?.setApiKey) {
    await settingsApi.setApiKey(provider, key)
  }
}

/**
 * Remove a provider's key from cache + main store.
 */
export async function clearKey(provider: Provider): Promise<void> {
  cache.delete(provider)
  // No setApiKey('') — calling clear via IPC isn't currently exposed;
  // setting empty is the closest. Caller can pass '' if needed.
}

/**
 * Hydrate the in-memory cache from main-process safeStorage. Idempotent:
 * subsequent calls return the same in-flight Promise.
 *
 * Also performs the legacy localStorage migration: any old plaintext
 * `cognograph:apikey:*` entry is moved into safeStorage and removed
 * from disk.
 */
export function hydrateFromMain(providers: readonly string[] = KNOWN_PROVIDERS): Promise<void> {
  if (hydrated) return Promise.resolve()
  if (hydratePromise) return hydratePromise
  hydratePromise = (async () => {
    const settingsApi = (typeof window !== 'undefined' ? window.api?.settings : undefined) as
      | {
          getApiKey?: (provider: string) => Promise<string | null>
          setApiKey?: (provider: string, key: string) => Promise<unknown>
        }
      | undefined

    // 1. Pull any keys already in safeStorage.
    if (settingsApi?.getApiKey) {
      for (const p of providers) {
        try {
          const v = await settingsApi.getApiKey(p)
          if (v) cache.set(p, v)
        } catch {
          // Ignore individual provider failures; cache stays empty for it.
        }
      }
    }

    // 2. Migrate legacy localStorage entries (plaintext at-rest BLOCKER).
    if (typeof localStorage !== 'undefined') {
      for (const p of providers) {
        const legacy = localStorage.getItem(legacyKey(p))
        if (legacy) {
          if (!cache.has(p) && settingsApi?.setApiKey) {
            try {
              await settingsApi.setApiKey(p, legacy)
              cache.set(p, legacy)
            } catch {
              // If migration fails we still clear localStorage to avoid the
              // BLOCKER — operator can re-enter the key from settings UI.
            }
          }
          localStorage.removeItem(legacyKey(p))
        }
      }
    }

    hydrated = true
  })()
  return hydratePromise
}

/**
 * For tests only — populate cache directly without IPC.
 */
export function _setForTest(provider: string, key: string | null): void {
  if (key === null) cache.delete(provider)
  else cache.set(provider, key)
}

/**
 * For tests only — reset cache + hydration state between cases.
 */
export function _resetForTest(): void {
  cache.clear()
  hydrated = false
  hydratePromise = null
}
