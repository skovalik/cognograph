// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { create } from 'zustand'

export interface ConsoleLogEntry {
  timestamp: number
  level: 'log' | 'warn' | 'error' | 'info'
  source: string
  message: string
  id?: string
}

interface ConsoleLogState {
  entries: ConsoleLogEntry[]
  filter: string // source filter ('' = all)
  addEntry: (entry: ConsoleLogEntry) => void
  setFilter: (filter: string) => void
  clear: () => void
}

export const useConsoleLogStore = create<ConsoleLogState>((set) => ({
  entries: [],
  filter: '',
  addEntry: (entry) => set((state) => ({
    entries: [...state.entries.slice(-499), entry] // keep last 500
  })),
  setFilter: (filter) => set({ filter }),
  clear: () => set({ entries: [] }),
}))

// Initialize: fetch buffer + subscribe to new entries
// Returns cleanup function for useEffect teardown
export async function initConsoleLogBridge(): Promise<(() => void) | undefined> {
  if (!window.api?.mainLog) return undefined // web build — no main process

  // Fetch buffered entries from before renderer loaded
  const buffer = await window.api.mainLog.getBuffer()
  const store = useConsoleLogStore.getState()
  for (const entry of buffer) {
    store.addEntry(entry)
  }

  // Subscribe to live entries — onEntry returns an unsubscribe function
  const unsubscribe = window.api.mainLog.onEntry((entry) => {
    useConsoleLogStore.getState().addEntry(entry)
  })

  return unsubscribe
}
