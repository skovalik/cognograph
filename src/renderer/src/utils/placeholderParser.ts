/**
 * Placeholder Parser Utility
 *
 * Detects and resolves placeholders in template content.
 * Placeholder types are processed in specificity order:
 *   1. {{date:...}} - Date placeholders
 *   2. {{describe:...}} - AI instruction placeholders
 *   3. {{link:...}} - Node reference placeholders
 *   4. {{selection:N}} - Selection placeholders
 *   5. {{key}} - Simple string placeholders (processed last)
 */

import type { PlaceholderDefinition, PlaceholderType, NodeData } from '@shared/types'
import { PLACEHOLDER_PATTERNS } from '@shared/types'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface DetectedPlaceholder {
  key: string
  type: PlaceholderType
  fullMatch: string
  param?: string // For date type, instruction key, etc.
  location: {
    start: number
    end: number
  }
}

export interface PlaceholderValue {
  key: string
  value: string
  nodeId?: string // For node-reference type
}

// -----------------------------------------------------------------------------
// Detection Functions
// -----------------------------------------------------------------------------

/**
 * Detect all placeholders in content, processing in specificity order
 */
export function detectPlaceholders(content: string): DetectedPlaceholder[] {
  const found: DetectedPlaceholder[] = []
  const seenMatches = new Set<string>()

  // Process patterns in order of specificity (most specific first)
  const patterns: [PlaceholderType, RegExp][] = [
    ['date', new RegExp(PLACEHOLDER_PATTERNS.date.source, 'gi')],
    ['node-instruction', new RegExp(PLACEHOLDER_PATTERNS.instruction.source, 'gi')],
    ['node-reference', new RegExp(PLACEHOLDER_PATTERNS.link.source, 'gi')],
    ['selection', new RegExp(PLACEHOLDER_PATTERNS.selection.source, 'gi')],
    ['string', new RegExp(PLACEHOLDER_PATTERNS.simple.source, 'gi')]
  ]

  for (const [type, pattern] of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const fullMatch = match[0]
      const key = match[1]

      // Skip if this exact match was already found by a more specific pattern
      if (seenMatches.has(fullMatch)) continue
      seenMatches.add(fullMatch)

      found.push({
        key,
        type,
        fullMatch,
        param: type !== 'string' ? match[1] : undefined,
        location: {
          start: match.index,
          end: match.index + fullMatch.length
        }
      })
    }
  }

  // Sort by location
  found.sort((a, b) => a.location.start - b.location.start)

  return found
}

/**
 * Detect placeholders in all string values within node data
 */
export function detectPlaceholdersInNodeData(
  data: Partial<NodeData>
): DetectedPlaceholder[] {
  const found: DetectedPlaceholder[] = []

  function scanValue(value: unknown): void {
    if (typeof value === 'string') {
      const detected = detectPlaceholders(value)
      for (const p of detected) {
        // Avoid duplicates by key
        if (!found.some((existing) => existing.key === p.key && existing.type === p.type)) {
          found.push(p)
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        scanValue(item)
      }
    } else if (value && typeof value === 'object') {
      for (const v of Object.values(value)) {
        scanValue(v)
      }
    }
  }

  scanValue(data)

  return found
}

// -----------------------------------------------------------------------------
// Definition Building
// -----------------------------------------------------------------------------

/**
 * Build placeholder definitions from detected placeholders
 */
export function buildPlaceholderDefinitions(
  detected: DetectedPlaceholder[]
): PlaceholderDefinition[] {
  const definitions: PlaceholderDefinition[] = []
  const seenKeys = new Set<string>()

  for (const p of detected) {
    // Use a composite key for uniqueness (key + type)
    const compositeKey = `${p.type}:${p.key}`
    if (seenKeys.has(compositeKey)) continue
    seenKeys.add(compositeKey)

    const definition: PlaceholderDefinition = {
      key: p.key,
      type: p.type,
      label: formatKeyAsLabel(p.key),
      required: true
    }

    // Type-specific defaults
    switch (p.type) {
      case 'date':
        definition.defaultValue = p.param || 'today'
        definition.description = `Date value (${p.param || 'today'})`
        break
      case 'node-instruction':
        definition.instruction = ''
        definition.description = 'AI will generate content based on instruction'
        break
      case 'node-reference':
        definition.description = 'Reference to another node in the workspace'
        break
      case 'selection':
        definition.selectionIndex = parseInt(p.param || '0', 10)
        definition.description = `Will use selection item ${definition.selectionIndex}`
        break
      case 'string':
        definition.description = 'Text value'
        break
    }

    definitions.push(definition)
  }

  return definitions
}

// -----------------------------------------------------------------------------
// Resolution Functions
// -----------------------------------------------------------------------------

/**
 * Resolve date placeholder to actual date string
 */
export function resolveDatePlaceholder(dateType: string): string {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0] ?? ''

  switch (dateType) {
    case 'today':
    case 'created':
      return todayStr
    case 'tomorrow': {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow.toISOString().split('T')[0] ?? ''
    }
    case 'next_week': {
      const nextWeek = new Date(now)
      nextWeek.setDate(nextWeek.getDate() + 7)
      return nextWeek.toISOString().split('T')[0] ?? ''
    }
    default:
      return todayStr
  }
}

/**
 * Resolve all placeholders in content with provided values
 */
export function resolvePlaceholders(
  content: string,
  values: Record<string, string>
): string {
  let result = content

  // First, resolve all date placeholders (auto-resolved)
  result = result.replace(
    new RegExp(PLACEHOLDER_PATTERNS.date.source, 'gi'),
    (_match, dateType) => resolveDatePlaceholder(dateType)
  )

  // Then resolve other placeholders from provided values
  for (const [key, value] of Object.entries(values)) {
    // Replace simple {{key}}
    result = result.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'gi'), value)
    // Replace {{describe:key}}
    result = result.replace(
      new RegExp(`\\{\\{describe:${escapeRegex(key)}\\}\\}`, 'gi'),
      value
    )
    // Replace {{link:key}}
    result = result.replace(
      new RegExp(`\\{\\{link:${escapeRegex(key)}\\}\\}`, 'gi'),
      value
    )
    // Replace {{selection:N}}
    result = result.replace(
      new RegExp(`\\{\\{selection:${escapeRegex(key)}\\}\\}`, 'gi'),
      value
    )
  }

  return result
}

/**
 * Resolve placeholders in node data (recursive)
 */
export function resolvePlaceholdersInNodeData<T extends Record<string, unknown>>(
  data: T,
  values: Record<string, string>
): T {
  const result: Record<string, unknown> = { ...data }

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      result[key] = resolvePlaceholders(value, values)
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? resolvePlaceholders(item, values)
          : typeof item === 'object' && item !== null
            ? resolvePlaceholdersInNodeData(item as Record<string, unknown>, values)
            : item
      )
    } else if (value && typeof value === 'object') {
      result[key] = resolvePlaceholdersInNodeData(
        value as Record<string, unknown>,
        values
      )
    }
  }

  return result as T
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

/**
 * Check if all required placeholders have values
 */
export function validatePlaceholderValues(
  definitions: PlaceholderDefinition[],
  values: Record<string, string>
): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  for (const def of definitions) {
    if (def.required && def.type !== 'date') {
      // Date placeholders are auto-resolved
      const value = values[def.key]
      if (!value || value.trim() === '') {
        missing.push(def.key)
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Get unresolved placeholders in content (placeholders still present after resolution)
 */
export function getUnresolvedPlaceholders(content: string): string[] {
  const detected = detectPlaceholders(content)
  // Filter out date placeholders as they auto-resolve
  return detected.filter((p) => p.type !== 'date').map((p) => p.key)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Convert placeholder key to human-readable label
 * e.g., "project_name" -> "Project Name"
 */
export function formatKeyAsLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Convert label back to placeholder key
 * e.g., "Project Name" -> "project_name"
 */
export function formatLabelAsKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Check if a string contains any placeholders
 */
export function containsPlaceholders(content: string): boolean {
  return detectPlaceholders(content).length > 0
}

/**
 * Create a placeholder string
 */
export function createPlaceholder(key: string, type: PlaceholderType = 'string'): string {
  switch (type) {
    case 'date':
      return `{{date:${key}}}`
    case 'node-instruction':
      return `{{describe:${key}}}`
    case 'node-reference':
      return `{{link:${key}}}`
    case 'selection':
      return `{{selection:${key}}}`
    case 'string':
    default:
      return `{{${key}}}`
  }
}
