// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Media-provider fetch dispatcher (provider-host + key-leak hardening).
 *
 * The 6 media adapters (stability, openai, gemini, replicate, runway,
 * elevenlabs) used to run `fetch()` from the renderer process with the
 * API key on the wire. Sentry's renderer SDK auto-captured fetch
 * breadcrumbs — so:
 *   - Gemini's `?key=<key>` URL ended up in Sentry breadcrumbs (key exfil)
 *   - Other adapters' `Authorization: Bearer <key>` requests put the
 *     provider host (api.openai.com, api.replicate.com, etc.) in
 *     breadcrumbs (privacy regression)
 *
 * This module is the main-process dispatcher every adapter now calls
 * via IPC. Adapters pass request shape (URL, method, body, non-auth
 * headers, response type) and the provider name. The dispatcher:
 *   1. Resolves the API key from safeStorage by provider name
 *      (encrypted at rest)
 *   2. Injects auth based on the provider's documented style:
 *        - bearer        → Authorization: Bearer <key>
 *        - xi-api-key    → xi-api-key: <key>            (ElevenLabs)
 *        - query-key     → ?key=<key>                    (Gemini)
 *        - none          → no auth (output URL fetches)
 *   3. Performs `fetch()` from the main process — the renderer never
 *      sees the key, the URL with key, or the auth header.
 *   4. Returns either parsed JSON or a binary ArrayBuffer + mimeType.
 *
 * The renderer adapters become thin shims that build request shapes
 * and parse responses. They no longer hold any provider keys.
 */

import { safeStorage } from 'electron'
import Store from 'electron-store'

interface SettingsStore {
  encryptedApiKeys: Record<string, string>
}

let settingsStoreInstance: Store<SettingsStore> | null = null
function getSettingsStore(): Store<SettingsStore> {
  if (!settingsStoreInstance) {
    settingsStoreInstance = new Store<SettingsStore>({
      defaults: { encryptedApiKeys: {} },
    })
  }
  return settingsStoreInstance
}

export type MediaProvider =
  | 'stability'
  | 'openai'
  | 'google'
  | 'gemini'
  | 'replicate'
  | 'runway'
  | 'elevenlabs'

export type AuthStyle = 'bearer' | 'xi-api-key' | 'query-key' | 'none'

const PROVIDER_AUTH_STYLE: Record<string, AuthStyle> = {
  stability: 'bearer',
  openai: 'bearer',
  replicate: 'bearer',
  runway: 'bearer',
  elevenlabs: 'xi-api-key',
  google: 'query-key',
  gemini: 'query-key',
}

const PROVIDER_KEY_LOOKUP: Record<string, string> = {
  // Maps provider name → safeStorage settings-key used by settings.ts
  // (which keys off `encryptedApiKeys[provider]`). 'gemini' aliases to
  // 'google' for backwards compat with existing user storage.
  stability: 'stability',
  openai: 'openai',
  replicate: 'replicate',
  runway: 'runway',
  elevenlabs: 'elevenlabs',
  google: 'google',
  gemini: 'google',
}

export interface SerializedFormField {
  name: string
  /**
   * 'string' fields are sent as plain strings.
   * 'blob' fields are sent as { bytes: ArrayBuffer, mimeType, filename? }
   */
  kind: 'string' | 'blob'
  value?: string
  blob?: { bytes: ArrayBuffer; mimeType: string; filename?: string }
}

export interface MediaFetchRequest {
  provider: MediaProvider | string
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Headers other than the auth header (e.g. Content-Type, X-Runway-Version, Accept). */
  headers?: Record<string, string>
  /** Request body kind. Defaults to 'none' for GET, 'json' for POST. */
  bodyKind?: 'json' | 'form' | 'none'
  bodyJson?: unknown
  bodyForm?: SerializedFormField[]
  /** Response handling. JSON parses + returns object; binary returns ArrayBuffer + mimeType. */
  responseKind: 'json' | 'binary'
  /**
   * Override default auth style. Use 'none' for output-URL fetches (Replicate
   * /Runway return CDN URLs whose responses don't need provider auth).
   */
  authStyleOverride?: AuthStyle
}

export interface MediaFetchResult {
  status: number
  /** True iff status is 2xx. */
  ok: boolean
  json?: unknown
  binary?: { bytes: ArrayBuffer; mimeType: string }
  /** Error description when fetch itself failed (network error, key missing, etc.). */
  error?: string
}

function decryptKey(provider: string): string | null {
  try {
    const settingsKey = PROVIDER_KEY_LOOKUP[provider] ?? provider
    const store = getSettingsStore()
    const encrypted = store.get('encryptedApiKeys')?.[settingsKey]
    if (!encrypted) return null
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    }
    return encrypted
  } catch {
    return null
  }
}

function applyAuth(
  url: string,
  headers: Record<string, string>,
  authStyle: AuthStyle,
  key: string,
): { url: string; headers: Record<string, string> } {
  if (authStyle === 'none') return { url, headers }
  if (authStyle === 'bearer') {
    return { url, headers: { ...headers, Authorization: `Bearer ${key}` } }
  }
  if (authStyle === 'xi-api-key') {
    return { url, headers: { ...headers, 'xi-api-key': key } }
  }
  if (authStyle === 'query-key') {
    const sep = url.includes('?') ? '&' : '?'
    return { url: `${url}${sep}key=${encodeURIComponent(key)}`, headers }
  }
  return { url, headers }
}

function buildBody(req: MediaFetchRequest): {
  body: BodyInit | undefined
  bodyHeaders: Record<string, string>
} {
  const kind = req.bodyKind ?? (req.method === 'POST' || req.method === 'PUT' ? 'json' : 'none')

  if (kind === 'none') return { body: undefined, bodyHeaders: {} }

  if (kind === 'json') {
    return {
      body: JSON.stringify(req.bodyJson ?? {}),
      bodyHeaders: { 'Content-Type': 'application/json' },
    }
  }

  if (kind === 'form') {
    const fd = new FormData()
    for (const field of req.bodyForm ?? []) {
      if (field.kind === 'string') {
        fd.append(field.name, field.value ?? '')
      } else if (field.kind === 'blob' && field.blob) {
        const blob = new Blob([field.blob.bytes], { type: field.blob.mimeType })
        if (field.blob.filename) fd.append(field.name, blob, field.blob.filename)
        else fd.append(field.name, blob)
      }
    }
    // Don't set Content-Type for FormData — fetch sets it with the boundary.
    return { body: fd, bodyHeaders: {} }
  }

  return { body: undefined, bodyHeaders: {} }
}

/**
 * Execute a media-provider fetch from the main process.
 * Resolves API key, injects auth, performs fetch, returns parsed result.
 */
export async function executeMediaFetch(req: MediaFetchRequest): Promise<MediaFetchResult> {
  const authStyle = req.authStyleOverride ?? PROVIDER_AUTH_STYLE[req.provider] ?? 'bearer'

  let url = req.url
  let headers: Record<string, string> = { ...(req.headers ?? {}) }

  if (authStyle !== 'none') {
    const key = decryptKey(req.provider)
    if (!key) {
      return {
        status: 0,
        ok: false,
        error: `No API key configured for provider '${req.provider}'`,
      }
    }
    const authed = applyAuth(url, headers, authStyle, key)
    url = authed.url
    headers = authed.headers
  }

  const { body, bodyHeaders } = buildBody(req)
  headers = { ...bodyHeaders, ...headers }

  let res: Response
  try {
    res = await fetch(url, {
      method: req.method ?? 'POST',
      headers,
      body,
    })
  } catch (err) {
    return {
      status: 0,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  if (req.responseKind === 'json') {
    try {
      const json = await res.json()
      return { status: res.status, ok: res.ok, json }
    } catch (err) {
      return {
        status: res.status,
        ok: false,
        error: `Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  // binary
  try {
    const ab = await res.arrayBuffer()
    const mimeType = res.headers.get('content-type') ?? 'application/octet-stream'
    return { status: res.status, ok: res.ok, binary: { bytes: ab, mimeType } }
  } catch (err) {
    return {
      status: res.status,
      ok: false,
      error: `Failed to read binary response: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * For tests only — reset cached store so tests can rebuild after env changes.
 */
export function _resetForTest(): void {
  settingsStoreInstance = null
}
