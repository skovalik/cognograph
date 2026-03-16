// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, beforeEach } from 'vitest'
import { getAvailableMediaTools } from '../../agentToolRegistry'

describe('Provider flow (integration)', () => {
  beforeEach(() => {
    const providerNames = ['stability', 'openai', 'google', 'replicate', 'runway', 'elevenlabs']
    for (const p of providerNames) {
      localStorage.removeItem(`cognograph:apikey:${p}`)
    }
  })

  it('all 6 tools available when all providers keyed', () => {
    localStorage.setItem('cognograph:apikey:stability', 'sk-test')
    localStorage.setItem('cognograph:apikey:openai', 'sk-test')
    localStorage.setItem('cognograph:apikey:google', 'gk-test')
    localStorage.setItem('cognograph:apikey:replicate', 'r8-test')
    localStorage.setItem('cognograph:apikey:runway', 'rw-test')
    localStorage.setItem('cognograph:apikey:elevenlabs', 'el-test')

    const tools = getAvailableMediaTools()
    const names = tools.map(t => t.name)

    expect(names).toContain('generate_image')
    expect(names).toContain('edit_image')
    expect(names).toContain('generate_audio')
    expect(names).toContain('analyze_media')
    expect(names).toContain('generate_video')
    expect(names).toContain('generate_3d')
  })

  it('only image tools available with stability key only', () => {
    localStorage.setItem('cognograph:apikey:stability', 'sk-test')
    const tools = getAvailableMediaTools()
    const names = tools.map(t => t.name)

    expect(names).toContain('generate_image')
    expect(names).not.toContain('generate_audio')
    expect(names).not.toContain('generate_video')
  })

  it('openai key enables image + analysis tools', () => {
    localStorage.setItem('cognograph:apikey:openai', 'sk-test')
    const tools = getAvailableMediaTools()
    const names = tools.map(t => t.name)

    expect(names).toContain('generate_image')
    // OpenAI doesn't have audio or video
    expect(names).not.toContain('generate_audio')
  })

  it('google/gemini key enables image gen + analysis', () => {
    localStorage.setItem('cognograph:apikey:google', 'gk-test')
    const tools = getAvailableMediaTools()
    const names = tools.map(t => t.name)

    expect(names).toContain('generate_image')
    expect(names).toContain('analyze_media')
  })

  it('replicate key enables image + 3D tools', () => {
    localStorage.setItem('cognograph:apikey:replicate', 'r8-test')
    const tools = getAvailableMediaTools()
    const names = tools.map(t => t.name)

    expect(names).toContain('generate_image')
    expect(names).toContain('generate_3d')
  })

  it('tool registry modules are importable', async () => {
    const registry = await import('../../agentToolRegistry')
    expect(registry.getAvailableMediaTools).toBeDefined()

    const factory = await import('../../adapterFactory')
    expect(factory.getAdapterForProvider).toBeDefined()

    const piping = await import('../../mediaPiping')
    expect(piping.isMediaArtifact).toBeDefined()
    expect(piping.serializeArtifactForContext).toBeDefined()
  })

  it('GenerationProgress component is importable', async () => {
    const mod = await import('../../../../components/nodes/GenerationProgress')
    expect(mod.GenerationProgress).toBeDefined()
  })

  it('AgentToolsTab is importable', async () => {
    const mod = await import('../../../../components/Settings/AgentToolsTab')
    expect(mod.AgentToolsTab).toBeDefined()
  })
})
