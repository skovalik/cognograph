// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it } from 'vitest'
import {
  CognographHighlighter,
  cognographTheme,
  getLanguageForContentType,
} from '../../../themes/cognographPrism'

describe('cognographPrism', () => {
  describe('cognographTheme', () => {
    it('has root code and pre selectors', () => {
      expect(cognographTheme['code[class*="language-"]']).toBeDefined()
      expect(cognographTheme['pre[class*="language-"]']).toBeDefined()
    })

    it('has all core token groups', () => {
      const requiredTokens = [
        'comment',
        'keyword',
        'string',
        'function',
        'variable',
        'operator',
        'number',
        'property',
        'tag',
        'punctuation',
      ]
      for (const token of requiredTokens) {
        expect(cognographTheme[token]).toBeDefined()
        expect(cognographTheme[token].color).toBeTruthy()
      }
    })

    it('uses CSS custom properties for background and base text', () => {
      const codeStyle = cognographTheme['code[class*="language-"]']
      expect(codeStyle.background).toContain('var(')
      expect(codeStyle.color).toContain('var(')
    })
  })

  describe('getLanguageForContentType', () => {
    it('returns explicit language for code type', () => {
      expect(getLanguageForContentType('code', 'typescript')).toBe('typescript')
      expect(getLanguageForContentType('code', 'python')).toBe('python')
    })

    it('falls back to text for code type with no language', () => {
      expect(getLanguageForContentType('code', undefined)).toBe('text')
      expect(getLanguageForContentType('code', '')).toBe('text')
    })

    it('maps known content types to Prism languages', () => {
      expect(getLanguageForContentType('markdown')).toBe('markdown')
      expect(getLanguageForContentType('json')).toBe('json')
      expect(getLanguageForContentType('csv')).toBe('csv')
    })

    it('maps html and svg source view to markup', () => {
      expect(getLanguageForContentType('html')).toBe('markup')
      expect(getLanguageForContentType('svg')).toBe('markup')
    })

    it('maps mermaid to its own grammar', () => {
      expect(getLanguageForContentType('mermaid')).toBe('mermaid')
    })

    it('returns text for non-highlightable types', () => {
      expect(getLanguageForContentType('text')).toBe('text')
      expect(getLanguageForContentType('image')).toBe('text')
    })

    it('uses language field for custom type', () => {
      expect(getLanguageForContentType('custom', 'yaml')).toBe('yaml')
      expect(getLanguageForContentType('custom')).toBe('text')
    })
  })

  describe('CognographHighlighter export', () => {
    it('is defined and a React component', () => {
      expect(CognographHighlighter).toBeDefined()
      // PrismLight is a class component — typeof matches 'function' or 'object'
      // depending on the bundler output. Either is fine for JSX usage.
      expect(['function', 'object']).toContain(typeof CognographHighlighter)
    })
  })
})
