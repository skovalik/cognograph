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
      model: model || 'claude-sonnet-4-20250514',
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

async function testOpenAI(apiKey: string, model: string, baseUrl?: string): Promise<ConnectorTestResponse> {
  try {
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
    const client = new OpenAI({
      apiKey: 'ollama',
      baseURL: `${baseUrl || 'http://localhost:11434'}/v1`
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
  return testOpenAI(apiKey, model, baseUrl)
}

async function testMCPServer(request: MCPTestRequest): Promise<MCPTestResponse> {
  let transport: StdioClientTransport | null = null
  let client: Client | null = null

  try {
    // Merge user-provided env vars with default inherited environment
    const env = {
      ...process.env,
      ...(request.env || {})
    }

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
