// Token format converters for the cognograph_tokens_get MCP tool
// Converts DesignTokenSet JSON to various output formats

import type { DesignTokenSet, DesignToken } from '../../../shared/types/common'

export type TokenFormat = 'raw' | 'css' | 'tailwind'

/**
 * Format a merged DesignTokenSet into the requested output format.
 */
export function formatTokens(tokenSet: DesignTokenSet, format: TokenFormat): string {
  switch (format) {
    case 'raw':
      return JSON.stringify(tokenSet, null, 2)
    case 'css':
      return formatAsCssCustomProperties(tokenSet)
    case 'tailwind':
      return formatAsTailwindConfig(tokenSet)
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

/**
 * Check if a color value looks valid (hex, rgb, hsl, or named color).
 */
function isLikelyValidColor(value: string): boolean {
  // Hex colors
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return true
  // rgb/rgba/hsl/hsla
  if (/^(rgb|rgba|hsl|hsla)\(/.test(value)) return true
  // Named colors (common ones)
  if (/^[a-z]{3,20}$/i.test(value)) return true
  return false
}

/**
 * Sanitize a token name for use as a CSS variable name.
 * Converts spaces and special characters to hyphens.
 */
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Convert DesignTokenSet to CSS custom properties format.
 */
function formatAsCssCustomProperties(tokenSet: DesignTokenSet): string {
  const lines: string[] = []
  lines.push(`/* Design Tokens: ${tokenSet.name} */`)
  lines.push(`:root {`)

  const tokens = tokenSet.tokens || {}
  const entries = Object.entries(tokens)

  // Group by type
  const groups: Record<string, Array<[string, DesignToken]>> = {}
  for (const [name, token] of entries) {
    const type = token.type || 'custom'
    if (!groups[type]) groups[type] = []
    groups[type].push([name, token])
  }

  // Emit each group
  for (const [type, groupEntries] of Object.entries(groups)) {
    lines.push(`  /* ${type} */`)
    for (const [name, token] of groupEntries) {
      const varName = `--${sanitizeName(type)}-${sanitizeName(name)}`

      // Add warning comment for potentially invalid color values
      if (token.type === 'color' && !isLikelyValidColor(token.value)) {
        lines.push(`  /* WARNING: possibly invalid color value */`)
      }

      lines.push(`  ${varName}: ${token.value};`)
    }
  }

  lines.push(`}`)
  return lines.join('\n')
}

/**
 * Convert DesignTokenSet to Tailwind config extend format.
 */
function formatAsTailwindConfig(tokenSet: DesignTokenSet): string {
  const tokens = tokenSet.tokens || {}
  const entries = Object.entries(tokens)

  // Build Tailwind theme.extend structure
  const config: Record<string, Record<string, string>> = {}

  for (const [name, token] of entries) {
    const safeName = sanitizeName(name)

    switch (token.type) {
      case 'color': {
        if (!config.colors) config.colors = {}
        config.colors[safeName] = token.value
        break
      }
      case 'spacing': {
        if (!config.spacing) config.spacing = {}
        config.spacing[safeName] = token.value
        break
      }
      case 'typography': {
        if (!config.fontFamily) config.fontFamily = {}
        config.fontFamily[safeName] = token.value
        break
      }
      case 'shadow': {
        if (!config.boxShadow) config.boxShadow = {}
        config.boxShadow[safeName] = token.value
        break
      }
      case 'border': {
        if (!config.borderRadius) config.borderRadius = {}
        config.borderRadius[safeName] = token.value
        break
      }
      case 'opacity': {
        if (!config.opacity) config.opacity = {}
        config.opacity[safeName] = token.value
        break
      }
      default: {
        // Custom tokens go into a generic extend section
        if (!config.custom) config.custom = {}
        config.custom[safeName] = token.value
        break
      }
    }
  }

  // Remove empty custom if nothing landed there
  if (config.custom && Object.keys(config.custom).length === 0) {
    delete config.custom
  }

  const header = `// Tailwind config theme.extend — generated from "${tokenSet.name}"\n// Paste into tailwind.config.js theme.extend\n`
  return header + JSON.stringify(config, null, 2)
}
