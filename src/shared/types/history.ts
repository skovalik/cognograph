// =============================================================================
// history.ts -- History/Undo and Connector types
//
// Contains: HistoryAction union, ConnectorProvider, ConnectorStatus,
// LLMConnector, MCPConnector, Connector, ConnectorState
// =============================================================================

import type { Node, Edge } from '@xyflow/react'
import type { NodeData, Message } from './nodes'
import type { EdgeData } from './edges'

// -----------------------------------------------------------------------------
// History Types (for Undo/Redo)
// -----------------------------------------------------------------------------

export type HistoryAction =
  | { type: 'ADD_NODE'; node: Node<NodeData> }
  | { type: 'DELETE_NODE'; node: Node<NodeData> }
  | { type: 'UPDATE_NODE'; nodeId: string; before: Partial<NodeData>; after: Partial<NodeData> }
  | { type: 'BULK_UPDATE_NODES'; updates: Array<{ nodeId: string; before: NodeData; after: NodeData }> }
  | { type: 'ALIGN_NODES'; updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> }
  | { type: 'DISTRIBUTE_NODES'; updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> }
  | { type: 'SNAP_TO_GRID'; updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> }
  | { type: 'ARRANGE_GRID'; updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> }
  | { type: 'MOVE_NODE'; nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }
  | { type: 'RESIZE_NODE'; nodeId: string; before: { width: number; height: number }; after: { width: number; height: number } }
  | { type: 'ADD_EDGE'; edge: Edge<EdgeData> }
  | { type: 'DELETE_EDGE'; edge: Edge<EdgeData> }
  | { type: 'UPDATE_EDGE'; edgeId: string; before: Partial<EdgeData>; after: Partial<EdgeData> }
  | { type: 'REVERSE_EDGE'; edgeId: string; before: Edge<EdgeData>; after: Edge<EdgeData> }
  | { type: 'RECONNECT_EDGE'; edgeId: string; before: Edge<EdgeData>; after: Edge<EdgeData> }
  | { type: 'REORDER_LAYERS'; updates: Array<{ nodeId: string; before: number; after: number }> }
  | { type: 'ADD_MESSAGE'; nodeId: string; message: Message }
  | { type: 'DELETE_MESSAGE'; nodeId: string; message: Message; index: number }
  | { type: 'BATCH'; actions: HistoryAction[] }

// -----------------------------------------------------------------------------
// Connector Types
// -----------------------------------------------------------------------------

export type ConnectorProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'custom'

export type ConnectorStatus = 'untested' | 'connected' | 'error'

export interface LLMConnector {
  id: string
  type: 'llm'
  name: string
  provider: ConnectorProvider
  model: string
  baseUrl?: string // For ollama/custom providers
  status: ConnectorStatus
  lastTestedAt?: number
  lastError?: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export interface MCPConnector {
  id: string
  type: 'mcp'
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  status: ConnectorStatus
  lastTestedAt?: number
  lastError?: string
  discoveredTools?: number
  discoveredResources?: number
  createdAt: number
  updatedAt: number
}

export type Connector = LLMConnector | MCPConnector

export interface ConnectorState {
  connectors: Connector[]
  defaultLLMId: string | null
}

export const DEFAULT_CONNECTOR_STATE: ConnectorState = {
  connectors: [],
  defaultLLMId: null
}

export const CONNECTOR_PROVIDER_INFO: Record<ConnectorProvider, { label: string; defaultModel: string; requiresBaseUrl: boolean }> = {
  anthropic: { label: 'Anthropic', defaultModel: 'claude-sonnet-4-20250514', requiresBaseUrl: false },
  openai: { label: 'OpenAI', defaultModel: 'gpt-4-turbo-preview', requiresBaseUrl: false },
  gemini: { label: 'Google Gemini', defaultModel: 'gemini-1.5-flash', requiresBaseUrl: false },
  ollama: { label: 'Ollama (Local)', defaultModel: 'llama3', requiresBaseUrl: true },
  custom: { label: 'Custom (OpenAI-compatible)', defaultModel: '', requiresBaseUrl: true }
}
