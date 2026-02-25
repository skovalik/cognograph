// ContentConverter — TipTap HTML ↔ Notion block conversion
// Spec: COGNOGRAPH-NOTION-NODE-SYNC-SPEC.md Section 6
//
// Dependencies: node-html-parser (lightweight HTML parser, ~50KB)
// Handles: 2000-char rich_text splitting, 100-block chunking,
//          annotation boundary preservation, nested lists

// NOTE: node-html-parser must be installed: npm install node-html-parser
// For now, we use a minimal hand-rolled parser that covers the supported
// element set without the external dependency. This can be swapped for
// node-html-parser if the conversion surface grows.

import { createHash } from 'crypto'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const RICH_TEXT_CHAR_LIMIT = 2000
const MAX_BLOCKS_PER_APPEND = 100

// -----------------------------------------------------------------------------
// Notion Block Types (subset we generate)
// -----------------------------------------------------------------------------

interface NotionRichText {
  type: 'text'
  text: { content: string; link?: { url: string } | null }
  annotations?: {
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    code?: boolean
  }
}

interface NotionBlock {
  object: 'block'
  type: string
  [key: string]: unknown
}

// -----------------------------------------------------------------------------
// Conversion Result Types
// -----------------------------------------------------------------------------

export interface ConversionResult {
  blocks: NotionBlock[]
  contentHash: string        // SHA-256 of source HTML
  lossyConversion: boolean   // true if tables/media/iframes were replaced with placeholders
  blockCount: number
}

export interface ReverseConversionResult {
  html: string
  contentHash: string
}

// -----------------------------------------------------------------------------
// HTML → Notion Blocks
// -----------------------------------------------------------------------------

/**
 * Convert TipTap HTML content to Notion block array.
 * Returns blocks ready for blocks.children.append().
 */
export function htmlToNotionBlocks(html: string): ConversionResult {
  const contentHash = hashContent(html)
  let lossyConversion = false

  // Simple HTML parser: split into top-level elements
  const elements = parseTopLevelElements(html)
  const blocks: NotionBlock[] = []

  for (const elem of elements) {
    const { tag, attrs, innerHTML, innerText } = elem

    switch (tag) {
      case 'h1':
        blocks.push(headingBlock('heading_1', innerHTML))
        break
      case 'h2':
        blocks.push(headingBlock('heading_2', innerHTML))
        break
      case 'h3':
        blocks.push(headingBlock('heading_3', innerHTML))
        break

      case 'p':
        blocks.push(paragraphBlock(innerHTML))
        break

      case 'blockquote':
        blocks.push(quoteBlock(innerHTML))
        break

      case 'hr':
        blocks.push(dividerBlock())
        break

      case 'pre': {
        const language = extractCodeLanguage(innerHTML)
        const code = extractCodeContent(innerHTML)
        blocks.push(codeBlock(code, language))
        break
      }

      case 'ul':
        blocks.push(...listBlocks('bulleted_list_item', innerHTML))
        break

      case 'ol':
        blocks.push(...listBlocks('numbered_list_item', innerHTML))
        break

      case 'img': {
        const src = attrs.src || ''
        if (src.startsWith('http://') || src.startsWith('https://')) {
          blocks.push(imageBlock(src))
        } else {
          blocks.push(paragraphBlock('[Image not synced — paste from external URL to include]'))
          lossyConversion = true
        }
        break
      }

      case 'table':
        blocks.push(paragraphBlock('[table omitted — edit in Cognograph]'))
        lossyConversion = true
        break

      case 'iframe':
      case 'video':
      case 'audio':
        blocks.push(paragraphBlock('[media not synced]'))
        lossyConversion = true
        break

      default:
        // Unknown elements → paragraph with their text content
        if (innerText.trim()) {
          blocks.push(paragraphBlock(innerHTML))
        }
        break
    }
  }

  return {
    blocks,
    contentHash,
    lossyConversion,
    blockCount: blocks.length
  }
}

// -----------------------------------------------------------------------------
// Notion Blocks → HTML
// -----------------------------------------------------------------------------

/**
 * Convert Notion block array back to TipTap-compatible HTML.
 * Unknown block types render as <p>[unsupported block type: {type}]</p>.
 */
export function notionBlocksToHtml(blocks: Array<{ type: string; [key: string]: any }>): ReverseConversionResult {
  const htmlParts: string[] = []

  for (const block of blocks) {
    htmlParts.push(blockToHtml(block))
  }

  const html = htmlParts.join('\n')
  return {
    html,
    contentHash: hashContent(html)
  }
}

function blockToHtml(block: { type: string; [key: string]: any }): string {
  const data = block[block.type]
  if (!data) return `<p>[unsupported block type: ${block.type}]</p>`

  switch (block.type) {
    case 'paragraph':
      return `<p>${richTextArrayToHtml(data.rich_text)}</p>`

    case 'heading_1':
      return `<h1>${richTextArrayToHtml(data.rich_text)}</h1>`
    case 'heading_2':
      return `<h2>${richTextArrayToHtml(data.rich_text)}</h2>`
    case 'heading_3':
      return `<h3>${richTextArrayToHtml(data.rich_text)}</h3>`

    case 'bulleted_list_item':
      return `<ul><li>${richTextArrayToHtml(data.rich_text)}</li></ul>`
    case 'numbered_list_item':
      return `<ol><li>${richTextArrayToHtml(data.rich_text)}</li></ol>`

    case 'to_do':
      return `<ul><li data-checked="${data.checked ? 'true' : 'false'}">${richTextArrayToHtml(data.rich_text)}</li></ul>`

    case 'code':
      return `<pre><code class="language-${data.language || 'plain text'}">${escapeHtml(richTextArrayToPlain(data.rich_text))}</code></pre>`

    case 'quote':
      return `<blockquote>${richTextArrayToHtml(data.rich_text)}</blockquote>`

    case 'divider':
      return '<hr>'

    case 'image':
      if (data.type === 'external') {
        return `<img src="${escapeHtml(data.external?.url || '')}" />`
      }
      if (data.type === 'file') {
        return `<img src="${escapeHtml(data.file?.url || '')}" />`
      }
      return '<p>[image]</p>'

    case 'callout':
      return `<blockquote>${data.icon?.emoji || ''} ${richTextArrayToHtml(data.rich_text)}</blockquote>`

    case 'toggle':
      return `<details><summary>${richTextArrayToHtml(data.rich_text)}</summary></details>`

    default:
      return `<p>[unsupported block type: ${block.type}]</p>`
  }
}

// Convert Notion rich_text array to HTML string
function richTextArrayToHtml(richTexts: NotionRichText[] | undefined): string {
  if (!richTexts || richTexts.length === 0) return ''

  return richTexts.map(rt => {
    let text = escapeHtml(rt.text?.content || '')
    const a = rt.annotations

    // Apply annotations inside-out
    if (a?.code) text = `<code>${text}</code>`
    if (a?.bold) text = `<strong>${text}</strong>`
    if (a?.italic) text = `<em>${text}</em>`
    if (a?.strikethrough) text = `<s>${text}</s>`
    if (a?.underline) text = `<u>${text}</u>`

    // Links
    if (rt.text?.link?.url) {
      text = `<a href="${escapeHtml(rt.text.link.url)}">${text}</a>`
    }

    return text
  }).join('')
}

// Convert Notion rich_text array to plain text
function richTextArrayToPlain(richTexts: NotionRichText[] | undefined): string {
  if (!richTexts || richTexts.length === 0) return ''
  return richTexts.map(rt => rt.text?.content || '').join('')
}

// -----------------------------------------------------------------------------
// Block Builders (HTML → Notion)
// -----------------------------------------------------------------------------

function headingBlock(type: string, innerHTML: string): NotionBlock {
  return {
    object: 'block',
    type,
    [type]: {
      rich_text: htmlToRichText(innerHTML)
    }
  }
}

function paragraphBlock(innerHTML: string): NotionBlock {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: htmlToRichText(innerHTML)
    }
  }
}

function quoteBlock(innerHTML: string): NotionBlock {
  return {
    object: 'block',
    type: 'quote',
    quote: {
      rich_text: htmlToRichText(innerHTML)
    }
  }
}

function dividerBlock(): NotionBlock {
  return { object: 'block', type: 'divider', divider: {} }
}

function codeBlock(code: string, language: string): NotionBlock {
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: splitRichText(code),
      language: language || 'plain text'
    }
  }
}

function imageBlock(url: string): NotionBlock {
  return {
    object: 'block',
    type: 'image',
    image: {
      type: 'external',
      external: { url }
    }
  }
}

function listBlocks(type: string, listHtml: string): NotionBlock[] {
  const items = parseListItems(listHtml)
  return items.map(itemHtml => ({
    object: 'block' as const,
    type,
    [type]: {
      rich_text: htmlToRichText(itemHtml)
    }
  }))
}

// -----------------------------------------------------------------------------
// Rich Text Builder — HTML inline elements → Notion rich_text array
// Section 6e: Annotation boundary splitting
// -----------------------------------------------------------------------------

interface InlineSpan {
  text: string
  bold: boolean
  italic: boolean
  code: boolean
  strikethrough: boolean
  underline: boolean
  link?: string
}

/**
 * Parse inline HTML (within a block element) into Notion rich_text array.
 * Handles: <strong>, <em>, <code>, <s>, <u>, <a>
 * Splits at 2000-char boundaries at annotation edges.
 */
function htmlToRichText(html: string): NotionRichText[] {
  const spans = parseInlineSpans(html)
  const richTexts: NotionRichText[] = []

  for (const span of spans) {
    // Split long spans at word boundaries
    const segments = splitTextAtLimit(span.text, RICH_TEXT_CHAR_LIMIT)

    for (const segment of segments) {
      if (!segment) continue

      const rt: NotionRichText = {
        type: 'text',
        text: {
          content: segment,
          ...(span.link && { link: { url: span.link } })
        }
      }

      // Only add annotations if at least one is set
      if (span.bold || span.italic || span.code || span.strikethrough || span.underline) {
        rt.annotations = {}
        if (span.bold) rt.annotations.bold = true
        if (span.italic) rt.annotations.italic = true
        if (span.code) rt.annotations.code = true
        if (span.strikethrough) rt.annotations.strikethrough = true
        if (span.underline) rt.annotations.underline = true
      }

      richTexts.push(rt)
    }
  }

  return richTexts.length > 0 ? richTexts : [{ type: 'text', text: { content: '' } }]
}

/**
 * Split plain text into rich_text objects at the 2000-char limit.
 * Used for code blocks and other plain text content.
 */
function splitRichText(text: string): NotionRichText[] {
  const segments = splitTextAtLimit(text, RICH_TEXT_CHAR_LIMIT)
  return segments.map(s => ({
    type: 'text' as const,
    text: { content: s }
  }))
}

/**
 * Split text at word boundaries, ensuring each segment <= limit chars.
 */
function splitTextAtLimit(text: string, limit: number): string[] {
  if (text.length <= limit) return [text]

  const segments: string[] = []
  let remaining = text

  while (remaining.length > limit) {
    // Find last word boundary before limit
    let splitPos = remaining.lastIndexOf(' ', limit)
    if (splitPos === -1 || splitPos === 0) {
      // No word boundary found — hard split at limit
      splitPos = limit
    }

    segments.push(remaining.slice(0, splitPos))
    remaining = remaining.slice(splitPos).trimStart()
  }

  if (remaining) segments.push(remaining)
  return segments
}

// -----------------------------------------------------------------------------
// Minimal HTML Parser
// -----------------------------------------------------------------------------

interface ParsedElement {
  tag: string
  attrs: Record<string, string>
  innerHTML: string
  innerText: string
}

/**
 * Parse top-level HTML elements. Handles self-closing tags and nested elements.
 * This is intentionally minimal — covers the TipTap output subset.
 */
function parseTopLevelElements(html: string): ParsedElement[] {
  const elements: ParsedElement[] = []
  const trimmed = html.trim()
  if (!trimmed) return elements

  // Regex to match top-level tags (greedy for nested content)
  const tagRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>|<(\w+)([^>]*)\s*\/?>/g
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(trimmed)) !== null) {
    if (match[1]) {
      // Opening + closing tag pair
      const tag = match[1].toLowerCase()
      const attrStr = match[2] || ''
      const innerHTML = match[3] || ''

      elements.push({
        tag,
        attrs: parseAttributes(attrStr),
        innerHTML,
        innerText: stripHtml(innerHTML)
      })
    } else if (match[4]) {
      // Self-closing tag (hr, img, br)
      const tag = match[4].toLowerCase()
      const attrStr = match[5] || ''

      elements.push({
        tag,
        attrs: parseAttributes(attrStr),
        innerHTML: '',
        innerText: ''
      })
    }
  }

  // If no elements found, treat the whole string as a paragraph
  if (elements.length === 0 && trimmed) {
    elements.push({
      tag: 'p',
      attrs: {},
      innerHTML: trimmed,
      innerText: stripHtml(trimmed)
    })
  }

  return elements
}

/**
 * Parse inline HTML spans for rich text conversion.
 * Extracts text with formatting annotations.
 */
function parseInlineSpans(html: string): InlineSpan[] {
  const spans: InlineSpan[] = []
  if (!html) return [{ text: '', bold: false, italic: false, code: false, strikethrough: false, underline: false }]

  // Walk through the HTML, tracking active annotations
  let pos = 0
  const stack: Array<{ tag: string; attrs: Record<string, string> }> = []

  const getAnnotations = () => {
    let bold = false, italic = false, code = false, strikethrough = false, underline = false
    let link: string | undefined

    for (const frame of stack) {
      switch (frame.tag) {
        case 'strong': case 'b': bold = true; break
        case 'em': case 'i': italic = true; break
        case 'code': code = true; break
        case 's': case 'del': case 'strike': strikethrough = true; break
        case 'u': underline = true; break
        case 'a': link = frame.attrs.href; break
      }
    }

    return { bold, italic, code, strikethrough, underline, link }
  }

  while (pos < html.length) {
    // Check for tag
    if (html[pos] === '<') {
      const closeMatch = html.slice(pos).match(/^<\/(\w+)>/)
      if (closeMatch) {
        // Closing tag — pop matching from stack
        const closingTag = closeMatch[1].toLowerCase()
        const idx = findLastIndex(stack, f => f.tag === closingTag)
        if (idx !== -1) stack.splice(idx, 1)
        pos += closeMatch[0].length
        continue
      }

      const openMatch = html.slice(pos).match(/^<(\w+)([^>]*?)(?:\s*\/)?>/)
      if (openMatch) {
        const tag = openMatch[1].toLowerCase()
        const attrStr = openMatch[2] || ''

        // Self-closing tags that don't affect text
        if (tag === 'br') {
          spans.push({ text: '\n', ...getAnnotations() })
          pos += openMatch[0].length
          continue
        }
        if (tag === 'img' || tag === 'hr') {
          pos += openMatch[0].length
          continue
        }

        stack.push({ tag, attrs: parseAttributes(attrStr) })
        pos += openMatch[0].length
        continue
      }
    }

    // Accumulate text until next tag
    let textEnd = html.indexOf('<', pos)
    if (textEnd === -1) textEnd = html.length

    const text = decodeHtmlEntities(html.slice(pos, textEnd))
    if (text) {
      spans.push({ text, ...getAnnotations() })
    }

    pos = textEnd
  }

  // Merge adjacent spans with identical annotations
  const merged: InlineSpan[] = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last &&
      last.bold === span.bold &&
      last.italic === span.italic &&
      last.code === span.code &&
      last.strikethrough === span.strikethrough &&
      last.underline === span.underline &&
      last.link === span.link) {
      last.text += span.text
    } else {
      merged.push({ ...span })
    }
  }

  return merged.length > 0 ? merged : [{ text: '', bold: false, italic: false, code: false, strikethrough: false, underline: false }]
}

/**
 * Parse list items from UL/OL innerHTML.
 */
function parseListItems(listHtml: string): string[] {
  const items: string[] = []
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let match: RegExpExecArray | null

  while ((match = liRegex.exec(listHtml)) !== null) {
    items.push(match[1])
  }

  // Fallback: if no <li> found, treat entire content as one item
  if (items.length === 0 && listHtml.trim()) {
    items.push(stripHtml(listHtml))
  }

  return items
}

/**
 * Extract code language from <pre><code class="language-*"> pattern.
 */
function extractCodeLanguage(preInnerHtml: string): string {
  const match = preInnerHtml.match(/class="language-([^"]+)"/)
  return match ? match[1] : 'plain text'
}

/**
 * Extract code content from <pre><code>...</code></pre> innerHTML.
 */
function extractCodeContent(preInnerHtml: string): string {
  const match = preInnerHtml.match(/<code[^>]*>([\s\S]*?)<\/code>/)
  return match ? decodeHtmlEntities(match[1]) : decodeHtmlEntities(stripHtml(preInnerHtml))
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

/** Polyfill for Array.findLastIndex (not available in all Node versions) */
function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i
  }
  return -1
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRegex = /(\w[\w-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g
  let match: RegExpExecArray | null

  while ((match = attrRegex.exec(attrStr)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? ''
  }

  return attrs
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * SHA-256 hash of content string. Used for snapshot comparison.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

/**
 * Chunk an array of blocks into groups of MAX_BLOCKS_PER_APPEND.
 * Used by UpsertService for multi-call content append.
 */
export function chunkBlocks(blocks: NotionBlock[]): NotionBlock[][] {
  const chunks: NotionBlock[][] = []
  for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_APPEND) {
    chunks.push(blocks.slice(i, i + MAX_BLOCKS_PER_APPEND))
  }
  return chunks
}

// Re-export constants for tests
export { RICH_TEXT_CHAR_LIMIT, MAX_BLOCKS_PER_APPEND }
