// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { BrowserWindow } from 'electron'

type LogLevel = 'log' | 'warn' | 'error' | 'info'

export interface ConsoleLogEntry {
  id: string
  timestamp: number
  level: LogLevel
  source: string // extracted from [Agent], [NotionSync], etc.
  message: string
}

// Ring buffer — keep last 500 entries to avoid unbounded memory
const LOG_BUFFER_SIZE = 500
const logBuffer: ConsoleLogEntry[] = []

function extractSource(msg: string): string {
  const match = msg.match(/^\[([^\]]+)\]/)
  return match ? match[1] : 'main'
}

function serializeArg(a: unknown): string {
  if (typeof a === 'string') return a
  if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack}`
  try {
    return JSON.stringify(a, null, 2)
  } catch {
    return '[unserializable]'
  }
}

let idCounter = 0

function forward(level: LogLevel, args: unknown[]): void {
  const message = args.map(serializeArg).join(' ')
  const ts = Date.now()
  const entry: ConsoleLogEntry = {
    id: `${ts}-${idCounter++}`,
    timestamp: ts,
    level,
    source: extractSource(message),
    message,
  }

  // Ring buffer
  logBuffer.push(entry)
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift()

  // Forward to all renderer windows
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('main-process-log', entry)
    }
  }
}

export function interceptConsole(): void {
  const origLog = console.log
  const origWarn = console.warn
  const origError = console.error
  const origInfo = console.info

  console.log = (...args) => {
    origLog(...args)
    forward('log', args)
  }
  console.warn = (...args) => {
    origWarn(...args)
    forward('warn', args)
  }
  console.error = (...args) => {
    origError(...args)
    forward('error', args)
  }
  console.info = (...args) => {
    origInfo(...args)
    forward('info', args)
  }
}

export function getLogBuffer(): ConsoleLogEntry[] {
  return [...logBuffer]
}
