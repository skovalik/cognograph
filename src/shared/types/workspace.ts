// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// =============================================================================
// workspace.ts -- Workspace persistence and settings
//
// Contains: WorkspaceData, WorkspaceInfo, AppSettings, LLMStreamOptions,
// IPCResponse, ContextSettings, WorkspacePreferences
// =============================================================================

import type { Edge, Node } from '@xyflow/react'
import type { SpatialRegion } from '../actionTypes'
import type { PropertySchema } from './common'
import type { EdgeData } from './edges'
import type { Message, NodeData } from './nodes'
import type { ThemeSettings } from './theme'

// -----------------------------------------------------------------------------
// Command Bar Types
// -----------------------------------------------------------------------------

export interface CommandLogEntry {
  id: string
  input: string
  tier: 1 | 2 | 3
  status: 'running' | 'done' | 'error' | 'cancelled'
  narration: string
  affectedNodeIds: string[]
  affectedEdgeIds?: string[]
  agentNodeId?: string
  timestamp: number
  duration?: number
  model?: string
  tokenUsage?: { input: number; output: number; cost: number }
}

// -----------------------------------------------------------------------------
// Workspace Types
// -----------------------------------------------------------------------------

export interface WorkspaceData {
  id: string
  name: string
  nodes: Node<NodeData>[]
  edges: Edge<EdgeData>[]
  viewport: { x: number; y: number; zoom: number }
  createdAt: number
  updatedAt: number
  version: number
  propertySchema?: PropertySchema // Workspace property definitions
  contextSettings?: ContextSettings // Global context traversal settings
  themeSettings?: ThemeSettings // Node color theme settings
  workspacePreferences?: WorkspacePreferences // UI preferences
  layersSortMode?: 'hierarchy' | 'type' | 'recent' | 'manual'
  manualLayerOrder?: string[] | null
  spatialRegions?: SpatialRegion[]
  syncMode?: 'local' | 'multiplayer' // Collaboration mode
  multiplayerServerUrl?: string // Hocuspocus server URL
  multiplayerToken?: string // Auth token for multiplayer

  // Session state restoration (ND feature - "where was I?")
  sessionState?: {
    selectedNodeIds?: string[]
    leftSidebarOpen?: boolean
    leftSidebarTab?: 'layers' | 'extractions'
    expandedNodeIds?: string[]
  }

  // Command bar persistence
  commandLog?: CommandLogEntry[]
  workspaceConversation?: { id: string; messages: Message[] }
}

export interface WorkspaceInfo {
  id: string
  name: string
  path: string
  updatedAt: number
  nodeCount: number
}

// -----------------------------------------------------------------------------
// Settings Types
// -----------------------------------------------------------------------------

export interface AppSettings {
  theme: 'dark' | 'light'
  autoSave: boolean
  autoSaveInterval: number
  defaultProvider: 'anthropic' | 'gemini' | 'openai'
  apiKeys: {
    anthropic?: string
    gemini?: string
    openai?: string
  }
  recentWorkspaces: string[]
}

// -----------------------------------------------------------------------------
// IPC Types
// -----------------------------------------------------------------------------

export interface LLMStreamOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// -----------------------------------------------------------------------------
// Context Settings Types
// -----------------------------------------------------------------------------

export interface ContextSettings {
  globalDepth: number // default: 2
  traversalMode: 'all' | 'ancestors-only' | 'custom'
}

export const DEFAULT_CONTEXT_SETTINGS: ContextSettings = {
  globalDepth: 2,
  traversalMode: 'all',
}

// Context node used during traversal
export interface ContextNode {
  node: Node<NodeData>
  depth: number
  path: string[] // for cycle detection
  weight: number // from edge
}

// -----------------------------------------------------------------------------
// Workspace Preferences Types
// -----------------------------------------------------------------------------

export type PropertiesDisplayMode = 'modal' | 'sidebar'
export type ChatDisplayMode = 'modal' | 'column'

// -----------------------------------------------------------------------------
// Project Type + Credential Types
// -----------------------------------------------------------------------------

export interface MCPRecommendation {
  name: string
  package: string
  description: string
  required: boolean
  setupCommand: string
  envVars?: Record<string, string>
}

export interface ProjectType {
  id: string
  name: string
  description: string
  icon: string
  noteModes: string[]
  actionPresets: string[]
  mcpRecommendations: MCPRecommendation[]
  templateId?: string
  configNodeId?: string
}

export interface EncryptedCredential {
  label: string
  encryptedValue: string
  updatedAt: number
  credentialType: string
}

export interface WorkspacePreferences {
  artifactPropertiesDisplay: PropertiesDisplayMode
  /** Controls whether node properties show in sidebar or floating modal for all nodes */
  propertiesDisplayMode: PropertiesDisplayMode
  /** Controls whether chat panels show as floating modals or in a right column */
  chatDisplayMode: ChatDisplayMode
  /** Width of the properties sidebar in pixels */
  propertiesSidebarWidth: number
  /** Show token estimates and cost in chat panels */
  showTokenEstimates: boolean
  /** User preference for vertical toolbar layout (independent of window size) */
  preferVerticalToolbar: boolean
  /** Allow nodes to auto-connect when dragged into proximity */
  enableProximityConnect?: boolean
  /** Active project type for this workspace */
  projectType?: ProjectType
  /** Per-workspace encrypted credential store */
  credentials?: Record<string, EncryptedCredential>
}

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  artifactPropertiesDisplay: 'modal',
  propertiesDisplayMode: 'sidebar', // Default to sidebar for backwards compatibility
  chatDisplayMode: 'column', // Default to column (current behavior)
  propertiesSidebarWidth: 320, // Default width
  showTokenEstimates: true, // Show token/cost estimates by default
  preferVerticalToolbar: false, // Default to horizontal toolbar
  enableProximityConnect: true,
}
