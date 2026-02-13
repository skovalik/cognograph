import { describe, it, expect } from 'vitest'
import {
  isHtmlContent,
  plainTextToHtml,
  normalizeContentForEditor
} from '../nodeUtils'

describe('nodeUtils', () => {
  describe('isHtmlContent', () => {
    it('should return true for content with HTML paragraph tags', () => {
      expect(isHtmlContent('<p>Hello world</p>')).toBe(true)
    })

    it('should return true for content with various HTML tags', () => {
      expect(isHtmlContent('<strong>Bold</strong>')).toBe(true)
      expect(isHtmlContent('<em>Italic</em>')).toBe(true)
      expect(isHtmlContent('<ul><li>Item</li></ul>')).toBe(true)
      expect(isHtmlContent('<h1>Heading</h1>')).toBe(true)
      expect(isHtmlContent('<code>code</code>')).toBe(true)
      expect(isHtmlContent('<br>')).toBe(true)
      expect(isHtmlContent('<a href="#">Link</a>')).toBe(true)
    })

    it('should return false for plain text', () => {
      expect(isHtmlContent('Hello world')).toBe(false)
      expect(isHtmlContent('No HTML here')).toBe(false)
    })

    it('should return false for text with angle brackets that are not HTML', () => {
      expect(isHtmlContent('x < y > z')).toBe(false)
      expect(isHtmlContent('5 < 10')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isHtmlContent('')).toBe(false)
    })
  })

  describe('plainTextToHtml', () => {
    it('should wrap single line text in paragraph tags', () => {
      expect(plainTextToHtml('Hello world')).toBe('<p>Hello world</p>')
    })

    it('should convert newlines to separate paragraphs', () => {
      const input = 'Line 1\nLine 2\nLine 3'
      const expected = '<p>Line 1</p><p>Line 2</p><p>Line 3</p>'
      expect(plainTextToHtml(input)).toBe(expected)
    })

    it('should handle Windows-style line endings (CRLF)', () => {
      const input = 'Line 1\r\nLine 2'
      const expected = '<p>Line 1</p><p>Line 2</p>'
      expect(plainTextToHtml(input)).toBe(expected)
    })

    it('should preserve empty lines as empty paragraphs', () => {
      const input = 'Line 1\n\nLine 3'
      const expected = '<p>Line 1</p><p></p><p>Line 3</p>'
      expect(plainTextToHtml(input)).toBe(expected)
    })

    it('should escape HTML special characters', () => {
      const input = 'Use <div> tags & "quotes"'
      expect(plainTextToHtml(input)).toBe('<p>Use &lt;div&gt; tags &amp; &quot;quotes&quot;</p>')
    })

    it('should return empty string for empty input', () => {
      expect(plainTextToHtml('')).toBe('')
      expect(plainTextToHtml('   ')).toBe('')
    })

    it('should return HTML content unchanged', () => {
      const html = '<p>Already HTML</p>'
      expect(plainTextToHtml(html)).toBe(html)
    })
  })

  describe('normalizeContentForEditor', () => {
    it('should return empty string for undefined', () => {
      expect(normalizeContentForEditor(undefined)).toBe('')
    })

    it('should return empty string for empty string', () => {
      expect(normalizeContentForEditor('')).toBe('')
    })

    it('should pass through HTML content unchanged', () => {
      const html = '<p>Paragraph</p><ul><li>Item</li></ul>'
      expect(normalizeContentForEditor(html)).toBe(html)
    })

    it('should convert plain text to HTML', () => {
      expect(normalizeContentForEditor('Plain text')).toBe('<p>Plain text</p>')
    })

    it('should convert multi-line plain text to paragraphs', () => {
      const input = 'First line\nSecond line'
      const expected = '<p>First line</p><p>Second line</p>'
      expect(normalizeContentForEditor(input)).toBe(expected)
    })
  })
})
