/**
 * Node utility functions
 */

/**
 * Measures the rendered width of a text string using Canvas API.
 */
export function measureTextWidth(text: string, font: string = '14px Inter, sans-serif'): number {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  return ctx.measureText(text).width
}

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

/**
 * Auto-fit size constraints
 */
export const AUTO_FIT_CONSTRAINTS = {
  minWidth: 100,
  maxWidth: 600,
  minHeight: 60,
  maxHeight: 800,
  padding: 32 // 16px on each side
}

/**
 * Measures the dimensions needed to fit content within a node.
 * Uses DOM measurement for accurate text sizing.
 *
 * @param element - The DOM element containing the content to measure
 * @param options - Optional constraints for min/max dimensions
 * @returns The ideal width and height to fit the content
 */
export function measureContentDimensions(
  element: HTMLElement,
  options: Partial<typeof AUTO_FIT_CONSTRAINTS> = {}
): { width: number; height: number } {
  const constraints = { ...AUTO_FIT_CONSTRAINTS, ...options }

  // Create a clone to measure without affecting layout
  const clone = element.cloneNode(true) as HTMLElement
  clone.style.position = 'absolute'
  clone.style.visibility = 'hidden'
  clone.style.width = 'auto'
  clone.style.height = 'auto'
  clone.style.maxWidth = `${constraints.maxWidth - constraints.padding}px`
  clone.style.whiteSpace = 'pre-wrap'
  clone.style.wordWrap = 'break-word'

  document.body.appendChild(clone)

  const rect = clone.getBoundingClientRect()

  document.body.removeChild(clone)

  // Calculate dimensions with constraints
  const width = Math.max(
    constraints.minWidth,
    Math.min(constraints.maxWidth, Math.ceil(rect.width + constraints.padding))
  )
  const height = Math.max(
    constraints.minHeight,
    Math.min(constraints.maxHeight, Math.ceil(rect.height + constraints.padding))
  )

  return { width, height }
}

/**
 * Calculates auto-fit dimensions for a node based on its title and content.
 *
 * @param title - The node's title text
 * @param content - The node's HTML content (optional)
 * @param headerHeight - Height of header section (default: 40px)
 * @param footerHeight - Height of footer section (default: 36px)
 * @returns The ideal width and height for the node
 */
export function calculateAutoFitDimensions(
  title: string,
  content?: string,
  headerHeight: number = 40,
  footerHeight: number = 36
): { width: number; height: number } {
  const constraints = AUTO_FIT_CONSTRAINTS

  // Measure title width
  const titleWidth = measureTextWidth(title, '600 14px Inter, sans-serif')
  const iconAndPadding = 60 // icon (24) + gaps + padding
  const titleRequiredWidth = Math.ceil(titleWidth + iconAndPadding)

  // Calculate content dimensions if present
  let contentWidth = 0
  let contentHeight = 0

  if (content) {
    // Strip HTML and measure plain text
    const plainContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    if (plainContent.length > 0) {
      // Estimate content dimensions
      // Assume ~7.5px per character at 14px font size
      const charsPerLine = Math.floor((constraints.maxWidth - constraints.padding) / 7.5)
      const lineCount = Math.ceil(plainContent.length / charsPerLine)
      const lineHeight = 20 // Approximate line height

      // Calculate based on actual line breaks in HTML
      const htmlLines = content.split(/<\/p>|<br\s*\/?>/i).filter(Boolean).length
      const effectiveLines = Math.max(lineCount, htmlLines)

      contentHeight = effectiveLines * lineHeight
      contentWidth = Math.min(
        constraints.maxWidth,
        Math.ceil(plainContent.length * 7.5) + constraints.padding
      )
    }
  }

  // Calculate final dimensions
  const width = Math.max(
    constraints.minWidth,
    Math.min(constraints.maxWidth, Math.max(titleRequiredWidth, contentWidth))
  )

  const height = Math.max(
    constraints.minHeight,
    Math.min(
      constraints.maxHeight,
      headerHeight + contentHeight + footerHeight + constraints.padding
    )
  )

  return { width, height }
}
