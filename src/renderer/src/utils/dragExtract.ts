// dragExtract — PFD Phase 5C: Drag-Extract Provenance Tracking
//
// Pure utility for creating extraction data: when a user selects text inside
// a node and extracts it to a new NoteNode, we generate the node + edge data
// with provenance metadata linking back to the source.
//
// This is a pure function — it does NOT call any store or produce side effects.
// The caller is responsible for dispatching the returned data to the store.

import { v4 as uuid } from 'uuid'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Provenance reference embedded in the edge data */
export interface ProvenanceSourceRef {
  nodeId: string
  timestamp: number
}

/** Data for the new NoteNode to be created */
export interface ExtractionNodeData {
  id: string
  type: 'note'
  position: { x: number; y: number }
  data: {
    type: 'note'
    title: string
    content: string
    color: string
    createdAt: number
    updatedAt: number
    contextMetadata: {
      contextRole: 'reference'
      contextPriority: 'medium'
      contextLabel: string
    }
  }
}

/** Data for the provenance edge linking extraction back to source */
export interface ExtractionEdgeData {
  id: string
  source: string
  target: string
  type: 'default'
  data: {
    contextRole: 'excerpt'
    sourceRef: ProvenanceSourceRef
    label: string
  }
}

/** Complete result from createExtractionWithProvenance */
export interface ExtractionResult {
  node: ExtractionNodeData
  edge: ExtractionEdgeData
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Creates the data needed to extract selected content into a new NoteNode
 * with a provenance edge back to the source node.
 *
 * @param sourceNodeId - The ID of the node the content was extracted from
 * @param content - The selected/extracted text content
 * @param position - Canvas position for the new node
 * @returns Object with `node` (NoteNode data) and `edge` (provenance edge data)
 */
export function createExtractionWithProvenance(
  sourceNodeId: string,
  content: string,
  position: { x: number; y: number }
): ExtractionResult {
  const now = Date.now()
  const nodeId = uuid()
  const edgeId = uuid()

  // Derive a short title from content (first line, truncated)
  const title = deriveTitle(content)

  const node: ExtractionNodeData = {
    id: nodeId,
    type: 'note',
    position,
    data: {
      type: 'note',
      title,
      content,
      color: '#6B7280', // neutral gray — inherited extraction color
      createdAt: now,
      updatedAt: now,
      contextMetadata: {
        contextRole: 'reference',
        contextPriority: 'medium',
        contextLabel: `Excerpt from ${sourceNodeId}`
      }
    }
  }

  const edge: ExtractionEdgeData = {
    id: edgeId,
    source: sourceNodeId,
    target: nodeId,
    type: 'default',
    data: {
      contextRole: 'excerpt',
      sourceRef: {
        nodeId: sourceNodeId,
        timestamp: now
      },
      label: 'excerpt'
    }
  }

  return { node, edge }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a short title from extracted content.
 * Takes the first line, trims whitespace, truncates to 60 characters.
 */
function deriveTitle(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? ''
  if (firstLine.length <= 60) return firstLine || 'Extracted note'
  return firstLine.slice(0, 57) + '...'
}
