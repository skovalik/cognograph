// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * File Listing Store — transient Zustand store for folder contents cache.
 *
 * NOT persisted. Populated via IPC `folder:list` on demand.
 * Shared by LayersPanel (full listing) and FilePreviewSection (compact preview).
 *
 * Must be a Zustand store (not a plain Map) so consumers re-render when cache populates.
 */

import { create } from 'zustand'

export interface FsEntry {
  name: string
  type: 'file' | 'directory'
}

export interface FolderListing {
  entries: FsEntry[]
  total: number
  truncated: boolean
  fetchedAt: number
  error?: string
  loading?: boolean
}

interface FileListingState {
  listings: Record<string, FolderListing>

  /** Fetch a folder listing via IPC. Caches result. */
  fetchListing: (folderPath: string) => Promise<void>

  /** Invalidate a specific cache entry (triggers re-fetch on next access). */
  invalidate: (folderPath: string) => void

  /** Check if a listing is stale (older than thresholdMs). */
  isStale: (folderPath: string, thresholdMs: number) => boolean

  /** Get a listing from cache (returns undefined if not cached). */
  getListing: (folderPath: string) => FolderListing | undefined
}

/** 5-second threshold for expand-triggered refreshes */
export const EXPAND_THRESHOLD_MS = 5_000
/** 60-second threshold for rapid expand/collapse cycles */
export const BACKGROUND_TTL_MS = 60_000

export const useFileListingStore = create<FileListingState>((set, get) => ({
  listings: {},

  fetchListing: async (folderPath: string) => {
    // Mark as loading
    set((state) => ({
      listings: {
        ...state.listings,
        [folderPath]: {
          ...(state.listings[folderPath] || {
            entries: [],
            total: 0,
            truncated: false,
            fetchedAt: 0,
          }),
          loading: true,
        },
      },
    }))

    try {
      const result = await window.api.folder.list(folderPath)

      set((state) => ({
        listings: {
          ...state.listings,
          [folderPath]: {
            entries: result.entries || [],
            total: result.total || 0,
            truncated: result.truncated || false,
            fetchedAt: Date.now(),
            error: result.success ? undefined : result.error,
            loading: false,
          },
        },
      }))
    } catch (err) {
      set((state) => ({
        listings: {
          ...state.listings,
          [folderPath]: {
            entries: [],
            total: 0,
            truncated: false,
            fetchedAt: Date.now(),
            error: err instanceof Error ? err.message : 'Failed to read folder',
            loading: false,
          },
        },
      }))
    }
  },

  invalidate: (folderPath: string) => {
    set((state) => {
      const { [folderPath]: _, ...rest } = state.listings
      return { listings: rest }
    })
  },

  isStale: (folderPath: string, thresholdMs: number) => {
    const listing = get().listings[folderPath]
    if (!listing) return true
    return Date.now() - listing.fetchedAt > thresholdMs
  },

  getListing: (folderPath: string) => {
    return get().listings[folderPath]
  },
}))
