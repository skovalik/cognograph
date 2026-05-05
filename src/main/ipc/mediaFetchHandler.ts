// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * IPC handler for `media:fetch` — main-process media-provider dispatcher.
 *
 * See `src/main/services/mediaFetch.ts` for the full security rationale
 * (media-fetch dispatcher hardening).
 */

import { ipcMain } from 'electron'
import {
  executeMediaFetch,
  type MediaFetchRequest,
  type MediaFetchResult,
} from '../services/mediaFetch'

export function registerMediaFetchHandlers(): void {
  ipcMain.handle(
    'media:fetch',
    async (_event, req: MediaFetchRequest): Promise<MediaFetchResult> => {
      return executeMediaFetch(req)
    },
  )
}
