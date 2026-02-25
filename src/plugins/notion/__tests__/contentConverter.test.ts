// ContentConverter Unit Tests
// Covers: htmlToNotionBlocks, notionBlocksToHtml, hashContent, chunkBlocks,
//         rich text annotations, 2000-char splitting, lossy conversion tracking

import { describe, it, expect } from 'vitest'
import {
  htmlToNotionBlocks,
  notionBlocksToHtml,
  hashContent,
  chunkBlocks,
  RICH_TEXT_CHAR_LIMIT,
  MAX_BLOCKS_PER_APPEND
} from '../main/contentConverter'

// ---------------------------------------------------------------------------
// htmlToNotionBlocks — Block-level conversion
// ---------------------------------------------------------------------------

describe('htmlToNotionBlocks', () => {
  it('converts a paragraph', () => {
    const result = htmlToNotionBlocks('<p>Hello world</p>')

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('paragraph')
    expect(result.blocks[0].paragraph).toBeDefined()
    expect(result.lossyConversion).toBe(false)
  })

  it('converts headings h1-h3', () => {
    const result = htmlToNotionBlocks(
      '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>'
    )

    expect(result.blocks).toHaveLength(3)
    expect(result.blocks[0].type).toBe('heading_1')
    expect(result.blocks[1].type).toBe('heading_2')
    expect(result.blocks[2].type).toBe('heading_3')
  })

  it('converts blockquote', () => {
    const result = htmlToNotionBlocks('<blockquote>A wise quote</blockquote>')

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('quote')
  })

  it('converts horizontal rule', () => {
    const result = htmlToNotionBlocks('<hr>')

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('divider')
  })

  it('converts code block with language', () => {
    const result = htmlToNotionBlocks(
      '<pre><code class="language-typescript">const x = 1;</code></pre>'
    )

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('code')
    expect(result.blocks[0].code.language).toBe('typescript')
  })

  it('converts code block without language', () => {
    const result = htmlToNotionBlocks('<pre><code>plain code</code></pre>')

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].code.language).toBe('plain text')
  })

  it('converts unordered list', () => {
    const result = htmlToNotionBlocks(
      '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>'
    )

    expect(result.blocks).toHaveLength(3)
    result.blocks.forEach(block => {
      expect(block.type).toBe('bulleted_list_item')
    })
  })

  it('converts ordered list', () => {
    const result = htmlToNotionBlocks(
      '<ol><li>First</li><li>Second</li></ol>'
    )

    expect(result.blocks).toHaveLength(2)
    result.blocks.forEach(block => {
      expect(block.type).toBe('numbered_list_item')
    })
  })

  it('converts external image', () => {
    const result = htmlToNotionBlocks(
      '<img src="https://example.com/photo.jpg" />'
    )

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('image')
    expect(result.blocks[0].image.external.url).toBe('https://example.com/photo.jpg')
    expect(result.lossyConversion).toBe(false)
  })

  it('marks local images as lossy', () => {
    const result = htmlToNotionBlocks('<img src="file:///local/image.png" />')

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('paragraph')
    expect(result.lossyConversion).toBe(true)
  })

  it('marks tables as lossy', () => {
    const result = htmlToNotionBlocks(
      '<table><tr><td>Cell</td></tr></table>'
    )

    expect(result.blocks).toHaveLength(1)
    expect(result.lossyConversion).toBe(true)
  })

  it('marks media elements as lossy', () => {
    const iframeResult = htmlToNotionBlocks('<iframe src="https://yt.com"></iframe>')
    expect(iframeResult.lossyConversion).toBe(true)

    const videoResult = htmlToNotionBlocks('<video src="clip.mp4"></video>')
    expect(videoResult.lossyConversion).toBe(true)

    const audioResult = htmlToNotionBlocks('<audio src="track.mp3"></audio>')
    expect(audioResult.lossyConversion).toBe(true)
  })

  it('treats plain text as a paragraph', () => {
    const result = htmlToNotionBlocks('Just plain text')

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('paragraph')
  })

  it('returns empty array for empty input', () => {
    const result = htmlToNotionBlocks('')

    expect(result.blocks).toHaveLength(0)
    expect(result.blockCount).toBe(0)
  })

  it('includes contentHash and blockCount', () => {
    const html = '<p>Test</p>'
    const result = htmlToNotionBlocks(html)

    expect(result.contentHash).toBe(hashContent(html))
    expect(result.blockCount).toBe(result.blocks.length)
  })

  it('handles mixed content', () => {
    const result = htmlToNotionBlocks(
      '<h1>Title</h1><p>Paragraph</p><ul><li>Item</li></ul><hr><blockquote>Quote</blockquote>'
    )

    expect(result.blocks).toHaveLength(5)
    expect(result.blocks[0].type).toBe('heading_1')
    expect(result.blocks[1].type).toBe('paragraph')
    expect(result.blocks[2].type).toBe('bulleted_list_item')
    expect(result.blocks[3].type).toBe('divider')
    expect(result.blocks[4].type).toBe('quote')
  })
})

// ---------------------------------------------------------------------------
// htmlToNotionBlocks — Inline formatting (rich text)
// ---------------------------------------------------------------------------

describe('htmlToNotionBlocks — rich text', () => {
  it('preserves bold annotations', () => {
    const result = htmlToNotionBlocks('<p><strong>bold text</strong></p>')
    const richText = result.blocks[0].paragraph.rich_text

    const boldSegment = richText.find((rt: any) => rt.annotations?.bold)
    expect(boldSegment).toBeDefined()
    expect(boldSegment.text.content).toBe('bold text')
  })

  it('preserves italic annotations', () => {
    const result = htmlToNotionBlocks('<p><em>italic text</em></p>')
    const richText = result.blocks[0].paragraph.rich_text

    const italicSegment = richText.find((rt: any) => rt.annotations?.italic)
    expect(italicSegment).toBeDefined()
    expect(italicSegment.text.content).toBe('italic text')
  })

  it('preserves inline code', () => {
    const result = htmlToNotionBlocks('<p><code>inline code</code></p>')
    const richText = result.blocks[0].paragraph.rich_text

    const codeSegment = richText.find((rt: any) => rt.annotations?.code)
    expect(codeSegment).toBeDefined()
    expect(codeSegment.text.content).toBe('inline code')
  })

  it('preserves strikethrough', () => {
    const result = htmlToNotionBlocks('<p><s>deleted</s></p>')
    const richText = result.blocks[0].paragraph.rich_text

    const sSegment = richText.find((rt: any) => rt.annotations?.strikethrough)
    expect(sSegment).toBeDefined()
  })

  it('preserves underline', () => {
    const result = htmlToNotionBlocks('<p><u>underlined</u></p>')
    const richText = result.blocks[0].paragraph.rich_text

    const uSegment = richText.find((rt: any) => rt.annotations?.underline)
    expect(uSegment).toBeDefined()
  })

  it('preserves links', () => {
    const result = htmlToNotionBlocks(
      '<p><a href="https://example.com">click here</a></p>'
    )
    const richText = result.blocks[0].paragraph.rich_text

    const linkSegment = richText.find((rt: any) => rt.text.link)
    expect(linkSegment).toBeDefined()
    expect(linkSegment.text.link.url).toBe('https://example.com')
    expect(linkSegment.text.content).toBe('click here')
  })

  it('handles nested annotations (bold + italic)', () => {
    const result = htmlToNotionBlocks('<p><strong><em>bold italic</em></strong></p>')
    const richText = result.blocks[0].paragraph.rich_text

    const nestedSegment = richText.find(
      (rt: any) => rt.annotations?.bold && rt.annotations?.italic
    )
    expect(nestedSegment).toBeDefined()
  })

  it('handles mixed plain and formatted text', () => {
    const result = htmlToNotionBlocks(
      '<p>plain <strong>bold</strong> more plain</p>'
    )
    const richText = result.blocks[0].paragraph.rich_text

    expect(richText.length).toBeGreaterThanOrEqual(2)
    // Should have at least one segment without annotations and one with bold
    const plainSegment = richText.find(
      (rt: any) => !rt.annotations && rt.text.content.includes('plain')
    )
    const boldSegment = richText.find((rt: any) => rt.annotations?.bold)
    expect(plainSegment).toBeDefined()
    expect(boldSegment).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// notionBlocksToHtml
// ---------------------------------------------------------------------------

describe('notionBlocksToHtml', () => {
  it('converts paragraph block', () => {
    const result = notionBlocksToHtml([{
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: 'Hello' } }]
      }
    }])

    expect(result.html).toContain('<p>')
    expect(result.html).toContain('Hello')
  })

  it('converts heading blocks', () => {
    const result = notionBlocksToHtml([
      { type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: 'H1' } }] } },
      { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: 'H2' } }] } },
      { type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: 'H3' } }] } }
    ])

    expect(result.html).toContain('<h1>H1</h1>')
    expect(result.html).toContain('<h2>H2</h2>')
    expect(result.html).toContain('<h3>H3</h3>')
  })

  it('converts list items', () => {
    const result = notionBlocksToHtml([
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Bullet' } }] } },
      { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: 'Number' } }] } }
    ])

    expect(result.html).toContain('<ul><li>Bullet</li></ul>')
    expect(result.html).toContain('<ol><li>Number</li></ol>')
  })

  it('converts code block with language', () => {
    const result = notionBlocksToHtml([{
      type: 'code',
      code: {
        rich_text: [{ type: 'text', text: { content: 'const x = 1;' } }],
        language: 'javascript'
      }
    }])

    expect(result.html).toContain('<pre><code class="language-javascript">')
    expect(result.html).toContain('const x = 1;')
  })

  it('converts quote block', () => {
    const result = notionBlocksToHtml([{
      type: 'quote',
      quote: {
        rich_text: [{ type: 'text', text: { content: 'Wisdom' } }]
      }
    }])

    expect(result.html).toContain('<blockquote>Wisdom</blockquote>')
  })

  it('converts divider', () => {
    const result = notionBlocksToHtml([{ type: 'divider', divider: {} }])

    expect(result.html).toContain('<hr>')
  })

  it('converts external image', () => {
    const result = notionBlocksToHtml([{
      type: 'image',
      image: { type: 'external', external: { url: 'https://img.com/pic.png' } }
    }])

    expect(result.html).toContain('<img src="https://img.com/pic.png"')
  })

  it('converts file-type image', () => {
    const result = notionBlocksToHtml([{
      type: 'image',
      image: { type: 'file', file: { url: 'https://s3.amazonaws.com/pic.png' } }
    }])

    expect(result.html).toContain('<img src="https://s3.amazonaws.com/pic.png"')
  })

  it('converts to_do block', () => {
    const result = notionBlocksToHtml([{
      type: 'to_do',
      to_do: {
        rich_text: [{ type: 'text', text: { content: 'Buy milk' } }],
        checked: true
      }
    }])

    expect(result.html).toContain('data-checked="true"')
    expect(result.html).toContain('Buy milk')
  })

  it('converts callout with emoji', () => {
    const result = notionBlocksToHtml([{
      type: 'callout',
      callout: {
        rich_text: [{ type: 'text', text: { content: 'Important!' } }],
        icon: { emoji: '!' }
      }
    }])

    expect(result.html).toContain('<blockquote>')
    expect(result.html).toContain('Important!')
  })

  it('converts toggle block', () => {
    const result = notionBlocksToHtml([{
      type: 'toggle',
      toggle: {
        rich_text: [{ type: 'text', text: { content: 'Click to expand' } }]
      }
    }])

    expect(result.html).toContain('<details>')
    expect(result.html).toContain('<summary>')
  })

  it('handles unknown block types', () => {
    const result = notionBlocksToHtml([{
      type: 'table_of_contents',
      table_of_contents: {}
    }])

    expect(result.html).toContain('[unsupported block type: table_of_contents]')
  })

  it('converts rich text annotations to HTML', () => {
    const result = notionBlocksToHtml([{
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content: 'formatted' },
          annotations: { bold: true, italic: true }
        }]
      }
    }])

    expect(result.html).toContain('<strong>')
    expect(result.html).toContain('<em>')
  })

  it('includes contentHash', () => {
    const result = notionBlocksToHtml([{
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: 'Test' } }] }
    }])

    expect(result.contentHash).toBeTruthy()
    expect(typeof result.contentHash).toBe('string')
    expect(result.contentHash.length).toBe(64) // SHA-256 hex
  })
})

// ---------------------------------------------------------------------------
// hashContent
// ---------------------------------------------------------------------------

describe('hashContent', () => {
  it('produces deterministic output', () => {
    const hash1 = hashContent('hello')
    const hash2 = hashContent('hello')
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for different inputs', () => {
    const hash1 = hashContent('hello')
    const hash2 = hashContent('world')
    expect(hash1).not.toBe(hash2)
  })

  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashContent('test')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('handles empty string', () => {
    const hash = hashContent('')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ---------------------------------------------------------------------------
// chunkBlocks
// ---------------------------------------------------------------------------

describe('chunkBlocks', () => {
  const makeBlocks = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      object: 'block' as const,
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: `Block ${i}` } }] }
    }))

  it('returns single chunk when under limit', () => {
    const blocks = makeBlocks(50)
    const chunks = chunkBlocks(blocks)

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(50)
  })

  it('returns single chunk at exactly the limit', () => {
    const blocks = makeBlocks(MAX_BLOCKS_PER_APPEND)
    const chunks = chunkBlocks(blocks)

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(MAX_BLOCKS_PER_APPEND)
  })

  it('splits into multiple chunks above limit', () => {
    const blocks = makeBlocks(MAX_BLOCKS_PER_APPEND + 50)
    const chunks = chunkBlocks(blocks)

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(MAX_BLOCKS_PER_APPEND)
    expect(chunks[1]).toHaveLength(50)
  })

  it('handles empty array', () => {
    const chunks = chunkBlocks([])
    expect(chunks).toHaveLength(0)
  })

  it('handles exact multiples of limit', () => {
    const blocks = makeBlocks(MAX_BLOCKS_PER_APPEND * 3)
    const chunks = chunkBlocks(blocks)

    expect(chunks).toHaveLength(3)
    chunks.forEach(chunk => {
      expect(chunk).toHaveLength(MAX_BLOCKS_PER_APPEND)
    })
  })
})

// ---------------------------------------------------------------------------
// Rich text splitting (2000-char limit)
// ---------------------------------------------------------------------------

describe('rich text splitting', () => {
  it('handles text within the 2000-char limit', () => {
    const shortText = 'a'.repeat(100)
    const result = htmlToNotionBlocks(`<p>${shortText}</p>`)
    const richText = result.blocks[0].paragraph.rich_text

    expect(richText).toHaveLength(1)
    expect(richText[0].text.content).toBe(shortText)
  })

  it('splits text exceeding 2000 chars for code blocks', () => {
    const longCode = 'x'.repeat(RICH_TEXT_CHAR_LIMIT + 500)
    const result = htmlToNotionBlocks(
      `<pre><code>${longCode}</code></pre>`
    )

    const richText = result.blocks[0].code.rich_text
    expect(richText.length).toBeGreaterThan(1)

    // Verify no segment exceeds limit
    for (const rt of richText) {
      expect(rt.text.content.length).toBeLessThanOrEqual(RICH_TEXT_CHAR_LIMIT)
    }

    // Verify all content is preserved
    const total = richText.map((rt: any) => rt.text.content).join('')
    expect(total.length).toBe(longCode.length)
  })
})
