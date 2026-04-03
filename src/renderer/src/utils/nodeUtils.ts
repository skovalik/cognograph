// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Node utility functions
 *
 * Text measurement has moved to ./textMeasure.ts — re-exported here for
 * backward compatibility.
 */
export {
  measureTextWidth,
  calculateAutoFitDimensions,
  measureContentDimensions,
  AUTO_FIT_CONSTRAINTS,
  TYPE_BADGE_H,
  MIN_BODY_H
} from './textMeasure'

/**
 * Checks if a string contains HTML tags.
 */
export function isHtmlContent(content: string): boolean {
  // Check for common HTML tags that TipTap uses
  return /<(p|br|ul|ol|li|strong|em|h[1-6]|code|pre|blockquote|a)\b/i.test(content)
}

/**
 * Converts plain text with newlines to HTML paragraphs for TipTap.
 * 
 * This is necessary because TipTap expects HTML content with <p> tags,
 * but content may be stored as plain text with \n characters.
 * 
 * @param text - Plain text content that may contain \n characters
 * @returns HTML content with <p> tags wrapping each line
 */
export function plainTextToHtml(text: string): string {
  if (!text || text.trim() === '') {
    return ''
  }
  
  // If already HTML, return as-is
  if (isHtmlContent(text)) {
    return text
  }
  
  // Split by newlines and wrap each non-empty line in <p> tags
  const lines = text.split(/\r?\n/)
  
  // Map lines to paragraphs, preserving empty lines as empty paragraphs
  const paragraphs = lines.map(line => {
    const trimmed = line.trim()
    return trimmed === '' ? '<p></p>' : `<p>${escapeHtml(trimmed)}</p>`
  })
  
  return paragraphs.join('')
}

/**
 * Escapes HTML special characters to prevent XSS and ensure proper display.
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return text.replace(/[&<>"']/g, char => htmlEscapes[char] ?? char)
}

/**
 * Normalizes content for TipTap editor.
 * Converts plain text to HTML if needed.
 */
export function normalizeContentForEditor(content: string | undefined): string {
  if (!content) {
    return ''
  }

  // If content has HTML tags, return as-is
  if (isHtmlContent(content)) {
    return content
  }

  // Convert plain text with newlines to HTML
  return plainTextToHtml(content)
}
