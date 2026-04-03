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

/**
 * Redact sensitive patterns from log messages before storing.
 * Matches API keys, bearer tokens, and password query params.
 */
const SENSITIVE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /token=[A-Za-z0-9._-]+/gi,
  /password=[^\s&]+/gi,
]

function sanitizeMessage(msg: string): string {
  let result = msg
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
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
    entries: [...state.entries.slice(-499), {
      ...entry,
      message: sanitizeMessage(entry.message),
    }] // keep last 500
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

// ---------------------------------------------------------------------------
// Web log source: capture console.warn/error in production web builds
// ---------------------------------------------------------------------------

let _webLogInitialized = false

/**
 * In production web builds (no main process), monkey-patch console.warn and
 * console.error to push entries into the console log store. This gives web
 * users visibility into runtime warnings/errors via the Console tab.
 *
 * Call once at app startup. Safe to call multiple times (no-ops after first).
 */
export function initWebConsoleCapture(): void {
  // Only in production, only in web (no Electron main process)
  if (_webLogInitialized) return
  if (!import.meta.env.PROD) return
  if ((window as any).__ELECTRON__) return

  _webLogInitialized = true
  let _capturing = false // re-entrancy guard

  const originalWarn = console.warn
  const originalError = console.error

  console.warn = (...args: unknown[]) => {
    originalWarn.apply(console, args)
    if (_capturing) return
    _capturing = true
    try {
      useConsoleLogStore.getState().addEntry({
        timestamp: Date.now(),
        level: 'warn',
        source: 'web',
        message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
      })
    } finally {
      _capturing = false
    }
  }

  console.error = (...args: unknown[]) => {
    originalError.apply(console, args)
    if (_capturing) return
    _capturing = true
    try {
      useConsoleLogStore.getState().addEntry({
        timestamp: Date.now(),
        level: 'error',
        source: 'web',
        message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
      })
    } finally {
      _capturing = false
    }
  }
}
