// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, vi } from 'vitest'
import { generateImageTool } from '../tools/generateImage'
import { getAvailableMediaTools } from '../agentToolRegistry'
import { getAdapterForProvider } from '../adapterFactory'

vi.mock('../../../../../web/stores/apiKeyStore', () => {
  throw new Error('Not in web mode')
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
    localStorage.clear()
    const tools = getAvailableMediaTools()
    expect(tools).toHaveLength(0)
  })

  it('registry returns generate_image when stability key exists', () => {
    localStorage.setItem('cognograph:apikey:stability', 'sk-test')
    const tools = getAvailableMediaTools()
    expect(tools.some(t => t.name === 'generate_image')).toBe(true)
    localStorage.clear()
  })

  it('adapterFactory throws for unknown provider', () => {
    expect(() => getAdapterForProvider('nonexistent', ['image_gen'])).toThrow('Unknown provider')
  })

  it('adapterFactory throws when no key for provider', () => {
    localStorage.clear()
    expect(() => getAdapterForProvider('stability', ['image_gen'])).toThrow('No API key')
  })

  it('adapterFactory returns adapter when key exists', () => {
    localStorage.setItem('cognograph:apikey:stability', 'sk-test')
    const adapter = getAdapterForProvider('stability', ['image_gen'])
    expect(adapter.name).toBe('stability')
    localStorage.clear()
  })

  it('auto provider selects first available', () => {
    localStorage.setItem('cognograph:apikey:openai', 'sk-test')
    const adapter = getAdapterForProvider('auto', ['image_gen'])
    // Should find stability first if key exists, otherwise openai
    expect(['stability', 'openai', 'gemini', 'replicate']).toContain(adapter.name)
    localStorage.clear()
  })
})
