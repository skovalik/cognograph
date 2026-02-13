/**
 * Connector Store
 *
 * Zustand store for managing LLM and MCP connector state.
 * Connector metadata (name, provider, model, status) is persisted locally.
 * API keys are stored separately via secure IPC (settings:setApiKey/getApiKey).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { LLMConnector, MCPConnector, ConnectorStatus } from '@shared/types'

// -----------------------------------------------------------------------------
// Store Interface
// -----------------------------------------------------------------------------

interface ConnectorStoreState {
  // Data
  connectors: LLMConnector[]
  mcpConnectors: MCPConnector[]
  defaultLLMId: string | null

  // LLM Actions
  addConnector: (connector: Omit<LLMConnector, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isDefault'>) => string
  updateConnector: (id: string, updates: Partial<LLMConnector>) => void
  removeConnector: (id: string) => void
  setDefaultLLM: (id: string | null) => void
  setConnectorStatus: (id: string, status: ConnectorStatus, error?: string) => void
  getDefaultConnector: () => LLMConnector | null
  getConnectorById: (id: string) => LLMConnector | undefined

  // MCP Actions
  addMCPConnector: (connector: Omit<MCPConnector, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => string
  updateMCPConnector: (id: string, updates: Partial<MCPConnector>) => void
  removeMCPConnector: (id: string) => void
  setMCPConnectorStatus: (id: string, status: ConnectorStatus, error?: string) => void
  getMCPConnectorById: (id: string) => MCPConnector | undefined
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useConnectorStore = create<ConnectorStoreState>()(
  persist(
    (set, get) => ({
      connectors: [],
      mcpConnectors: [],
      defaultLLMId: null,

      addConnector: (connectorData) => {
        const id = uuid()
        const now = Date.now()
        const connector: LLMConnector = {
          ...connectorData,
          id,
          type: 'llm',
          status: 'untested',
          isDefault: false,
          createdAt: now,
          updatedAt: now
        }

        set((state) => ({
          connectors: [...state.connectors, connector],
          // If this is the first connector, make it default
          defaultLLMId: state.connectors.length === 0 ? id : state.defaultLLMId
        }))

        return id
      },

      updateConnector: (id, updates) => {
        set((state) => ({
          connectors: state.connectors.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
          )
        }))
      },

      removeConnector: (id) => {
        set((state) => {
          const newConnectors = state.connectors.filter((c) => c.id !== id)
          return {
            connectors: newConnectors,
            defaultLLMId: state.defaultLLMId === id
              ? (newConnectors[0]?.id ?? null)
              : state.defaultLLMId
          }
        })
      },

      setDefaultLLM: (id) => {
        set((state) => ({
          defaultLLMId: id,
          connectors: state.connectors.map((c) => ({
            ...c,
            isDefault: c.id === id
          }))
        }))
      },

      setConnectorStatus: (id, status, error) => {
        set((state) => ({
          connectors: state.connectors.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status,
                  lastTestedAt: Date.now(),
                  lastError: error,
                  updatedAt: Date.now()
                }
              : c
          )
        }))
      },

      getDefaultConnector: () => {
        const state = get()
        if (!state.defaultLLMId) return null
        return state.connectors.find((c) => c.id === state.defaultLLMId) || null
      },

      getConnectorById: (id) => {
        return get().connectors.find((c) => c.id === id)
      },

      // MCP Connector Actions
      addMCPConnector: (connectorData) => {
        const id = uuid()
        const now = Date.now()
        const connector: MCPConnector = {
          ...connectorData,
          id,
          type: 'mcp',
          status: 'untested',
          createdAt: now,
          updatedAt: now
        }
        set((state) => ({
          mcpConnectors: [...state.mcpConnectors, connector]
        }))
        return id
      },

      updateMCPConnector: (id, updates) => {
        set((state) => ({
          mcpConnectors: state.mcpConnectors.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
          )
        }))
      },

      removeMCPConnector: (id) => {
        set((state) => ({
          mcpConnectors: state.mcpConnectors.filter((c) => c.id !== id)
        }))
      },

      setMCPConnectorStatus: (id, status, error) => {
        set((state) => ({
          mcpConnectors: state.mcpConnectors.map((c) =>
            c.id === id
              ? { ...c, status, lastTestedAt: Date.now(), lastError: error, updatedAt: Date.now() }
              : c
          )
        }))
      },

      getMCPConnectorById: (id) => {
        return get().mcpConnectors.find((c) => c.id === id)
      }
    }),
    {
      name: 'cognograph-connectors',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        if (version < 2) {
          return { ...(persisted as Record<string, unknown>), mcpConnectors: [] }
        }
        return persisted as ConnectorStoreState
      }
    }
  )
)
