// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { beforeEach, describe, expect, it } from 'vitest'
import { _resetForTest, _setForTest } from '../../../apiKeyStore'
import { getAvailableMediaTools } from '../../agentToolRegistry'

describe('Provider flow (integration)', () => {
  beforeEach(() => {
    _resetForTest()
  })

  it('all 6 tools available when all providers keyed', () => {
    _setForTest('stability', 'sk-test')
    _setForTest('openai', 'sk-test')
    _setForTest('google', 'gk-test')
    _setForTest('replicate', 'r8-test')
    _setForTest('runway', 'rw-test')
    _setForTest('elevenlabs', 'el-test')

    const tools = getAvailableMediaTools()
    const names = tools.map((t) => t.name)

    expect(names).toContain('generate_image')
    expect(names).toContain('edit_image')
    expect(names).toContain('generate_audio')
    expect(names).toContain('analyze_media')
    expect(names).toContain('generate_video')
    expect(names).toContain('generate_3d')
  })

  it('only image tools available with stability key only', () => {
    _setForTest('stability', 'sk-test')
    const tools = getAvailableMediaTools()
    const names = tools.map((t) => t.name)

    expect(names).toContain('generate_image')
    expect(names).not.toContain('generate_audio')
    expect(names).not.toContain('generate_video')
  })

  it('openai key enables image + analysis tools', () => {
    _setForTest('openai', 'sk-test')
    const tools = getAvailableMediaTools()
    const names = tools.map((t) => t.name)

    expect(names).toContain('generate_image')
    // OpenAI doesn't have audio or video
    expect(names).not.toContain('generate_audio')
  })

  it('google/gemini key enables image gen + analysis', () => {
    _setForTest('google', 'gk-test')
    const tools = getAvailableMediaTools()
    const names = tools.map((t) => t.name)

    expect(names).toContain('generate_image')
    expect(names).toContain('analyze_media')
  })

  it('replicate key enables image + 3D tools', () => {
    _setForTest('replicate', 'r8-test')
    const tools = getAvailableMediaTools()
    const names = tools.map((t) => t.name)

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
