// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Incremental JSON parser for streaming batch_create tool input.
 *
 * Detects complete objects inside `"nodes":[...]` and `"edges":[...]` arrays
 * as partial JSON chunks stream in from the Anthropic API. Handles both key
 * orderings (nodes-first or edges-first). String-aware depth tracking ensures
 * braces inside quoted strings don't affect object boundary detection.
 */

export type IncrementalParseEvent =
  | { type: 'node'; data: Record<string, unknown> }
  | { type: 'edge'; data: Record<string, unknown> }
  | { type: 'error'; message: string }

export class IncrementalBatchParser {
  private buffer = ''
  private processedUpTo = 0
  private phase: 'seeking-nodes' | 'in-nodes' | 'seeking-edges' | 'in-edges' | 'done' =
    'seeking-nodes'
  private depth = 0
  private inString = false
  private escapeNext = false
  private objectStart = -1

  /**
   * Feed a partial JSON chunk. Returns any complete objects parsed from this chunk.
   */
  feed(chunk: string): IncrementalParseEvent[] {
    if (!chunk) return []
    const events: IncrementalParseEvent[] = []
    this.buffer += chunk

    for (let i = this.processedUpTo; i < this.buffer.length; i++) {
      const ch = this.buffer[i]

      // Handle string escaping
      if (this.escapeNext) {
        this.escapeNext = false
        continue
      }
      if (ch === '\\' && this.inString) {
        this.escapeNext = true
        continue
      }
      if (ch === '"') {
        this.inString = !this.inString
        continue
      }
      if (this.inString) continue // skip characters inside strings

      // Phase transitions
      if (this.phase === 'seeking-nodes') {
        // Look for "nodes":[ or "edges":[ — handle whichever key comes first
        const remaining = this.buffer.slice(i)
        if (remaining.startsWith('"nodes"')) {
          const bracketIdx = this.buffer.indexOf('[', i)
          if (bracketIdx !== -1) {
            this.phase = 'in-nodes'
            i = bracketIdx // skip to opening bracket
          }
        } else if (remaining.startsWith('"edges"')) {
          // Edge-before-node key order — handle edges first, then seek nodes
          const bracketIdx = this.buffer.indexOf('[', i)
          if (bracketIdx !== -1) {
            this.phase = 'in-edges'
            i = bracketIdx
          }
        }
        continue
      }

      if (this.phase === 'seeking-edges') {
        const remaining = this.buffer.slice(i)
        if (remaining.startsWith('"edges"')) {
          const bracketIdx = this.buffer.indexOf('[', i)
          if (bracketIdx !== -1) {
            this.phase = 'in-edges'
            i = bracketIdx
          }
        } else if (remaining.startsWith('"nodes"')) {
          // Reverse key order — edges were parsed first, now seek nodes
          const bracketIdx = this.buffer.indexOf('[', i)
          if (bracketIdx !== -1) {
            this.phase = 'in-nodes'
            i = bracketIdx
          }
        }
        continue
      }

      // Inside nodes or edges array — track object depth
      if (this.phase === 'in-nodes' || this.phase === 'in-edges') {
        if (ch === '{') {
          if (this.depth === 0) this.objectStart = i
          this.depth++
        } else if (ch === '}') {
          this.depth--
          if (this.depth === 0 && this.objectStart !== -1) {
            // Complete object found
            const objectStr = this.buffer.slice(this.objectStart, i + 1)
            try {
              const parsed = JSON.parse(objectStr)
              events.push({
                type: this.phase === 'in-nodes' ? 'node' : 'edge',
                data: parsed,
              })
            } catch {
              events.push({ type: 'error', message: `Failed to parse: ${objectStr.slice(0, 100)}` })
            }
            this.objectStart = -1
          }
        } else if (ch === ']' && this.depth === 0) {
          // Array closed — seek the other key (handles both key orderings)
          if (this.phase === 'in-nodes') {
            this.phase = 'seeking-edges'
          } else if (this.phase === 'in-edges') {
            this.phase = 'seeking-nodes' // may find nodes next, or reach done
          }
        }
      }
    }

    // Track how far we've scanned so the next feed() starts from here, not 0
    this.processedUpTo = this.buffer.length

    // Trim consumed buffer — keep only from the current object start or end
    if (this.objectStart !== -1) {
      // Mid-object — keep from objectStart
      const sliceOffset = this.objectStart
      this.buffer = this.buffer.slice(sliceOffset)
      this.objectStart = 0
      this.processedUpTo -= sliceOffset
    } else {
      // Between objects — keep last 50 chars for phase detection overlap
      const sliceOffset = Math.max(0, this.buffer.length - 50)
      this.buffer = this.buffer.slice(sliceOffset)
      this.processedUpTo -= sliceOffset
    }

    return events
  }

  reset(): void {
    this.buffer = ''
    this.processedUpTo = 0
    this.phase = 'seeking-nodes'
    this.depth = 0
    this.inString = false
    this.escapeNext = false
    this.objectStart = -1
  }
}
