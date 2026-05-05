// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Renderer-side wrapper around `window.api.media.fetch`.
 *
 * Adapters build request shapes and call this client. The main process
 * (see `src/main/services/mediaFetch.ts`) resolves the API key from
 * safeStorage, injects auth, performs `fetch()`, and returns either
 * parsed JSON or a binary ArrayBuffer.
 *
 * The renderer never holds provider keys, never sets the auth header,
 * and never sees provider URLs in its fetch breadcrumb stream.
 */

export type AuthStyle = 'bearer' | 'xi-api-key' | 'query-key' | 'none'

export interface SerializedFormField {
  name: string
  kind: 'string' | 'blob'
  value?: string
  blob?: { bytes: ArrayBuffer; mimeType: string; filename?: string }
}

export interface MediaFetchOpts {
  provider: string
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  bodyKind?: 'json' | 'form' | 'none'
  bodyJson?: unknown
  bodyForm?: SerializedFormField[]
  responseKind: 'json' | 'binary'
  authStyleOverride?: AuthStyle
}

export interface MediaFetchJsonResult {
  status: number
  ok: boolean
  json: unknown
}

export interface MediaFetchBinaryResult {
  status: number
  ok: boolean
  blob: Blob
  mimeType: string
}

class MediaFetchHttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'MediaFetchHttpError'
    this.status = status
  }
}

function getApi(): { fetch: (opts: MediaFetchOpts) => Promise<unknown> } | null {
  if (typeof window === 'undefined') return null
  const api = (
    window as unknown as { api?: { media?: { fetch: (o: MediaFetchOpts) => Promise<unknown> } } }
  ).api
  if (!api?.media?.fetch) return null
  return api.media
}

/**
 * Helper for adapters that expect JSON. Throws an `MediaFetchHttpError`
 * with `status` set if the response is non-2xx (matches the prior
 * `fetch` + `if (!res.ok) throw err` pattern, so withRetry's 429 / 5xx
 * detection keeps working).
 */
export async function mediaFetchJson(opts: Omit<MediaFetchOpts, 'responseKind'>): Promise<unknown> {
  const api = getApi()
  if (!api) throw new Error('media.fetch IPC bridge not available (non-Electron context?)')
  const result = (await api.fetch({ ...opts, responseKind: 'json' })) as {
    status: number
    ok: boolean
    json?: unknown
    error?: string
  }
  if (result.error) {
    throw new MediaFetchHttpError(result.error, result.status)
  }
  if (!result.ok) {
    throw new MediaFetchHttpError(`${opts.provider} API error: ${result.status}`, result.status)
  }
  return result.json
}

/**
 * Helper for adapters that expect a binary response (image/video/audio bytes).
 * Returns a Blob reconstructed from the ArrayBuffer + mimeType the dispatcher
 * sent over IPC. Throws on non-2xx the same way `mediaFetchJson` does.
 */
export async function mediaFetchBinary(
  opts: Omit<MediaFetchOpts, 'responseKind'>,
): Promise<{ blob: Blob; mimeType: string }> {
  const api = getApi()
  if (!api) throw new Error('media.fetch IPC bridge not available (non-Electron context?)')
  const result = (await api.fetch({ ...opts, responseKind: 'binary' })) as {
    status: number
    ok: boolean
    binary?: { bytes: ArrayBuffer; mimeType: string }
    error?: string
  }
  if (result.error) {
    throw new MediaFetchHttpError(result.error, result.status)
  }
  if (!result.ok || !result.binary) {
    throw new MediaFetchHttpError(`${opts.provider} API error: ${result.status}`, result.status)
  }
  return {
    blob: new Blob([result.binary.bytes], { type: result.binary.mimeType }),
    mimeType: result.binary.mimeType,
  }
}

/** For tests + adapters that need to surface the typed error class. */
export { MediaFetchHttpError }

/**
 * Convenience: serialize a renderer-side Blob into the IPC-safe shape the
 * dispatcher's `bodyForm` expects.
 */
export async function blobToFormField(
  name: string,
  blob: Blob,
  filename?: string,
): Promise<SerializedFormField> {
  const bytes = await blob.arrayBuffer()
  return { name, kind: 'blob', blob: { bytes, mimeType: blob.type, filename } }
}
