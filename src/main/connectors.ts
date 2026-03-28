// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { ipcMain } from 'electron'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

interface ConnectorTestRequest {
  provider: string
  apiKey: string
  model: string
  baseUrl?: string
}

interface ConnectorTestResponse {
  success: boolean
  error?: string
}

interface MCPTestRequest {
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface MCPTestResponse {
  success: boolean
  error?: string
  toolCount?: number
  resourceCount?: number
  serverName?: string
  serverVersion?: string
}

async function testAnthropic(apiKey: string, model: string): Promise<ConnectorTestResponse> {
  try {
    const client = new Anthropic({ apiKey })
    await client.messages.create({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }]
    })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('401') || message.includes('authentication') || message.includes('invalid')) {
      return { success: false, error: 'Invalid API key' }
    }
    return { success: false, error: message }
  }
}

/**
 * Validate a base URL to prevent SSRF attacks.
 * Allows HTTPS only, except localhost for local dev servers (Ollama, LM Studio, etc.).
 * Blocks internal/link-local IP ranges.
 */
function validateBaseUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname

    // Allow localhost for local servers
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { valid: true }
    }

    // Block non-HTTPS for remote URLs
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: `Only HTTPS allowed for remote URLs (got ${parsed.protocol})` }
    }

    // Block internal/private IP ranges
    const internalPatterns = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
      /^192\.168\./,             // 192.168.0.0/16
      /^169\.254\./,             // Link-local
      /^0\./,                    // Current network
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Shared address space
    ]

    for (const pattern of internalPatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, error: `Internal IP addresses are not allowed: ${hostname}` }
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: `Invalid URL: ${url}` }
  }
}

async function testOpenAI(apiKey: string, model: string, baseUrl?: string): Promise<ConnectorTestResponse> {
  try {
    if (baseUrl) {
      const urlCheck = validateBaseUrl(baseUrl)
      if (!urlCheck.valid) return { success: false, error: urlCheck.error }
    }
    const client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {})
    })
    await client.chat.completions.create({
      model: model || 'gpt-4-turbo-preview',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }]
    })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('401') || message.includes('Incorrect API key')) {
      return { success: false, error: 'Invalid API key' }
    }
    return { success: false, error: message }
  }
}

async function testGemini(apiKey: string, model: string): Promise<ConnectorTestResponse> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const genModel = genAI.getGenerativeModel({ model: model || 'gemini-1.5-flash' })
    await genModel.generateContent('Hi')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('API_KEY_INVALID') || message.includes('401')) {
      return { success: false, error: 'Invalid API key' }
    }
    return { success: false, error: message }
  }
}

async function testOllama(baseUrl: string, model: string): Promise<ConnectorTestResponse> {
  try {
    const effectiveUrl = baseUrl || 'http://localhost:11434'
    const urlCheck = validateBaseUrl(effectiveUrl)
    if (!urlCheck.valid) return { success: false, error: urlCheck.error }
    const client = new OpenAI({
      apiKey: 'ollama',
      baseURL: `${effectiveUrl}/v1`
    })
    await client.chat.completions.create({
      model: model || 'llama3',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }]
    })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('ECONNREFUSED')) {
      return { success: false, error: 'Cannot connect to Ollama. Is it running?' }
    }
    return { success: false, error: message }
  }
}

async function testCustom(apiKey: string, model: string, baseUrl?: string): Promise<ConnectorTestResponse> {
  if (!baseUrl) {
    return { success: false, error: 'Base URL is required for custom providers' }
  }
  const urlCheck = validateBaseUrl(baseUrl)
  if (!urlCheck.valid) return { success: false, error: urlCheck.error }
  return testOpenAI(apiKey, model, baseUrl)
}

async function testMCPServer(request: MCPTestRequest): Promise<MCPTestResponse> {
  // Validate command — block shell metacharacters in args
  if (request.args) {
    const shellMetachars = /[;&|`$(){}!<>]/
    for (const arg of request.args) {
      if (shellMetachars.test(arg)) {
        return { success: false, error: `Shell metacharacters not allowed in MCP server args: "${arg}"` }
      }
    }
  }

  let transport: StdioClientTransport | null = null
  let client: Client | null = null

  try {
    // Merge user-provided env vars with default inherited environment
    const env = {
      ...process.env,
      ...(request.env || {})
    } as Record<string, string>

    transport = new StdioClientTransport({
      command: request.command,
      args: request.args,
      env
    })

    client = new Client({
      name: 'cognograph-test',
      version: '1.0.0'
    })

    // Connect with a 15s timeout
    const connectPromise = client.connect(transport)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out after 15 seconds')), 15000)
    )
    await Promise.race([connectPromise, timeoutPromise])

    // Query tools and resources
    let toolCount = 0
    let resourceCount = 0

    try {
      const toolsResult = await client.listTools()
      toolCount = toolsResult.tools?.length || 0
    } catch {
      // Server may not support tools — not an error
    }

    try {
      const resourcesResult = await client.listResources()
      resourceCount = resourcesResult.resources?.length || 0
    } catch {
      // Server may not support resources — not an error
    }

    const serverInfo = client.getServerVersion()

    return {
      success: true,
      toolCount,
      resourceCount,
      serverName: serverInfo?.name,
      serverVersion: serverInfo?.version
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('ENOENT') || message.includes('not found')) {
      return { success: false, error: `Command not found: ${request.command}` }
    }
    if (message.includes('EACCES') || message.includes('permission')) {
      return { success: false, error: `Permission denied: ${request.command}` }
    }
    return { success: false, error: message }
  } finally {
    // Clean up: close client and transport
    try {
      if (client) await client.close()
    } catch {
      // Ignore cleanup errors
    }
    try {
      if (transport) await transport.close()
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function registerConnectorHandlers(): void {
  ipcMain.handle('connector:test', async (_event, request: ConnectorTestRequest): Promise<ConnectorTestResponse> => {
    const { provider, apiKey, model, baseUrl } = request

    try {
      switch (provider) {
        case 'anthropic':
          return await testAnthropic(apiKey, model)
        case 'openai':
          return await testOpenAI(apiKey, model, baseUrl)
        case 'gemini':
          return await testGemini(apiKey, model)
        case 'ollama':
          return await testOllama(baseUrl || 'http://localhost:11434', model)
        case 'custom':
          return await testCustom(apiKey, model, baseUrl)
        default:
          return { success: false, error: `Unknown provider: ${provider}` }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  })

  ipcMain.handle('connector:testMCP', async (_event, request: MCPTestRequest): Promise<MCPTestResponse> => {
    return testMCPServer(request)
  })
}
