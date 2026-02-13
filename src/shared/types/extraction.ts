// =============================================================================
// extraction.ts -- Extraction system types
//
// Contains: ExtractionSettings, PendingExtraction, ExtractionResult,
// spatial extraction types, drag/undo data
// =============================================================================

import type { NoteNodeData, TaskNodeData } from './nodes'

// -----------------------------------------------------------------------------
// Extraction System Types
// -----------------------------------------------------------------------------

export interface ExtractionSettings {
  autoExtractEnabled: boolean
  extractionTypes: ('notes' | 'tasks')[]
  extractionTrigger: 'per-message' | 'on-demand' | 'on-close'
  extractionConfidenceThreshold: number // 0-1
}

export const DEFAULT_EXTRACTION_SETTINGS: ExtractionSettings = {
  autoExtractEnabled: false,
  extractionTypes: ['notes', 'tasks'],
  extractionTrigger: 'on-demand',
  extractionConfidenceThreshold: 0.7
}

export interface PendingExtraction {
  id: string
  sourceNodeId: string
  sourceMessageId?: string
  type: 'note' | 'task'
  suggestedData: Partial<NoteNodeData | TaskNodeData>
  confidence: number
  status: 'pending' | 'accepted' | 'dismissed' | 'edited'
  createdAt: number
}

export interface ExtractionResult {
  type: 'note' | 'task'
  title: string
  content: string
  confidence: number
  priority?: 'none' | 'low' | 'medium' | 'high'
  tags?: string[]
}

// -----------------------------------------------------------------------------
// Spatial Extraction System Types
// -----------------------------------------------------------------------------

/** Node types that support extraction */
export const EXTRACTABLE_NODE_TYPES = [
  'conversation',
  'note',
  'task',
  'text',
  'project',
] as const

export type ExtractableNodeType = (typeof EXTRACTABLE_NODE_TYPES)[number]

/** Artifact types that support extraction (text-based only) */
export const EXTRACTABLE_ARTIFACT_TYPES = ['markdown', 'text', 'json', 'csv'] as const

export type ExtractableArtifactType = (typeof EXTRACTABLE_ARTIFACT_TYPES)[number]

/** Check if a node type supports extraction */
export function isExtractableNodeType(nodeType: string): nodeType is ExtractableNodeType {
  return EXTRACTABLE_NODE_TYPES.includes(nodeType as ExtractableNodeType)
}

/** Check if an artifact type supports extraction */
export function isExtractableArtifactType(artifactType: string): artifactType is ExtractableArtifactType {
  return EXTRACTABLE_ARTIFACT_TYPES.includes(artifactType as ExtractableArtifactType)
}

/** Extraction drag operation data */
export interface ExtractionDragData {
  extractionId: string
  position: { x: number; y: number }
  type: 'note' | 'task'
  title: string
}

/** Undo data for extraction accept */
export interface ExtractionUndoData {
  extractionData: PendingExtraction
  createdNodeId: string
  createdEdgeId: string
  timestamp: number
}
