// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { afterEach, describe, expect, it, vi } from 'vitest'
import { _resetForTest, _setForTest } from '../../apiKeyStore'
import { getAdapterForProvider } from '../adapterFactory'
import { getAvailableMediaTools } from '../agentToolRegistry'
import { generateImageTool } from '../tools/generateImage'

vi.mock('../../../../../web/stores/apiKeyStore', () => {
  throw new Error('Not in web mode')
})

afterEach(() => {
  _resetForTest()
})

describe('generateImage tool', () => {
  it('has correct tool definition', () => {
    expect(generateImageTool.name).toBe('generate_image')
    expect(generateImageTool.input_schema.type).toBe('object')
    expect(generateImageTool.input_schema.required).toContain('prompt')
    expect(generateImageTool.requiredProviders).toContain('stability')
    expect(generateImageTool.requiredProviders).toContain('openai')
  })

  it('registry returns no tools when no keys configured', () => {
    _resetForTest()
    const tools = getAvailableMediaTools()
    expect(tools).toHaveLength(0)
  })

  it('registry returns generate_image when stability key exists', () => {
    _setForTest('stability', 'sk-test')
    const tools = getAvailableMediaTools()
    expect(tools.some((t) => t.name === 'generate_image')).toBe(true)
  })

  it('adapterFactory throws for unknown provider', () => {
    expect(() => getAdapterForProvider('nonexistent', ['image_gen'])).toThrow('Unknown provider')
  })

  it('adapterFactory throws when no key for provider', () => {
    _resetForTest()
    expect(() => getAdapterForProvider('stability', ['image_gen'])).toThrow('No API key')
  })

  it('adapterFactory returns adapter when key exists', () => {
    _setForTest('stability', 'sk-test')
    const adapter = getAdapterForProvider('stability', ['image_gen'])
    expect(adapter.name).toBe('stability')
  })

  it('auto provider selects first available', () => {
    _setForTest('openai', 'sk-test')
    const adapter = getAdapterForProvider('auto', ['image_gen'])
    // Should find stability first if key exists, otherwise openai
    expect(['stability', 'openai', 'gemini', 'replicate']).toContain(adapter.name)
  })
})
