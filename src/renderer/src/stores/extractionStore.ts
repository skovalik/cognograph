/**
 * Extraction Store
 *
 * Manages AI extraction state: pending extractions, extraction panel, drag state.
 * Extracted from workspaceStore as part of Week 2 Stream B Track 2 Phase 2.2a.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { PendingExtraction, ExtractionSettings } from '@shared/types'
import type { ExtractionDragState, LastAcceptedExtraction } from './types'

// =============================================================================
// Store State
// =============================================================================

interface ExtractionState {
  pendingExtractions: PendingExtraction[]
  extractionSourceFilter: string | null
  isExtracting: string | null // nodeId currently being extracted
  openExtractionPanelNodeId: string | null
  extractionDrag: ExtractionDragState | null
  lastAcceptedExtraction: LastAcceptedExtraction | null
  extractionSettings: Map<string, ExtractionSettings> // Per-node extraction settings
}

// =============================================================================
// Store Actions
// =============================================================================

interface ExtractionActions {
  // Pending extractions
  addPendingExtraction: (extraction: Omit<PendingExtraction, 'id' | 'status' | 'createdAt'>) => string
  editExtraction: (extractionId: string, data: Partial<PendingExtraction['suggestedData']>) => void
  dismissExtraction: (extractionId: string) => void
  clearAllExtractions: (sourceNodeId?: string) => void
  acceptExtraction: (
    extractionId: string,
    position?: { x: number; y: number }
  ) => { nodeId: string; edgeId: string } | null

  // Extraction filtering
  setExtractionSourceFilter: (nodeId: string | null) => void
  getExtractionsForNode: (nodeId: string) => PendingExtraction[]

  // Extraction state
  setIsExtracting: (nodeId: string | null) => void

  // Extraction panel
  openExtractionPanel: (nodeId: string) => void
  closeExtractionPanel: () => void

  // Spatial extraction drag
  startExtractionDrag: (extractionId: string, position: { x: number; y: number }) => void
  updateExtractionDragPosition: (position: { x: number; y: number }) => void
  dropExtraction: (flowPosition: { x: number; y: number }) => void
  cancelExtractionDrag: () => void

  // Batch operations
  acceptAllExtractions: (sourceNodeId: string) => string[]
  undoLastExtraction: () => void
  clearUndoExtraction: () => void

  // Extraction settings
  updateExtractionSettings: (nodeId: string, settings: Partial<ExtractionSettings>) => void
  getExtractionSettings: (nodeId: string) => ExtractionSettings | undefined
  addExtractedTitle: (nodeId: string, title: string) => void
}

// =============================================================================
// Store Type
// =============================================================================

type ExtractionStore = ExtractionState & ExtractionActions

// =============================================================================
// Initial State
// =============================================================================

const initialState: ExtractionState = {
  pendingExtractions: [],
  extractionSourceFilter: null,
  isExtracting: null,
  openExtractionPanelNodeId: null,
  extractionDrag: null,
  lastAcceptedExtraction: null,
  extractionSettings: new Map()
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useExtractionStore = create<ExtractionStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ---------------------------------------------------------------------
      // Pending extractions
      // ---------------------------------------------------------------------

      addPendingExtraction: (extraction) => {
        const id = uuid()
        const newExtraction: PendingExtraction = {
          ...extraction,
          id,
          status: 'pending',
          createdAt: Date.now()
        }

        set((state) => {
          state.pendingExtractions.push(newExtraction)
        })

        return id
      },

      editExtraction: (extractionId, data) => {
        set((state) => {
          const extraction = state.pendingExtractions.find((e) => e.id === extractionId)
          if (extraction) {
            Object.assign(extraction.suggestedData, data)
          }
        })
      },

      dismissExtraction: (extractionId) => {
        set((state) => {
          state.pendingExtractions = state.pendingExtractions.filter((e) => e.id !== extractionId)
        })
      },

      clearAllExtractions: (sourceNodeId) => {
        set((state) => {
          if (sourceNodeId) {
            state.pendingExtractions = state.pendingExtractions.filter(
              (e) => e.sourceNodeId !== sourceNodeId
            )
          } else {
            state.pendingExtractions = []
          }
        })
      },

      acceptExtraction: (extractionId, position) => {
        const extraction = get().pendingExtractions.find((e) => e.id === extractionId)
        if (!extraction) return null

        // This would typically create a node and edge
        // For now, we'll return placeholder IDs
        const nodeId = uuid()
        const edgeId = uuid()

        // Store for undo
        set((state) => {
          state.lastAcceptedExtraction = {
            extractionData: extraction,
            createdNodeId: nodeId,
            createdEdgeId: edgeId,
            timestamp: Date.now()
          }

          // Remove from pending
          state.pendingExtractions = state.pendingExtractions.filter((e) => e.id !== extractionId)
        })

        return { nodeId, edgeId }
      },

      // ---------------------------------------------------------------------
      // Extraction filtering
      // ---------------------------------------------------------------------

      setExtractionSourceFilter: (nodeId) => {
        set((state) => {
          state.extractionSourceFilter = nodeId
        })
      },

      getExtractionsForNode: (nodeId) => {
        return get().pendingExtractions.filter((e) => e.sourceNodeId === nodeId)
      },

      // ---------------------------------------------------------------------
      // Extraction state
      // ---------------------------------------------------------------------

      setIsExtracting: (nodeId) => {
        set((state) => {
          state.isExtracting = nodeId
        })
      },

      // ---------------------------------------------------------------------
      // Extraction panel
      // ---------------------------------------------------------------------

      openExtractionPanel: (nodeId) => {
        set((state) => {
          state.openExtractionPanelNodeId = nodeId
        })
      },

      closeExtractionPanel: () => {
        set((state) => {
          state.openExtractionPanelNodeId = null
        })
      },

      // ---------------------------------------------------------------------
      // Spatial extraction drag
      // ---------------------------------------------------------------------

      startExtractionDrag: (extractionId, position) => {
        const extraction = get().pendingExtractions.find((e) => e.id === extractionId)
        if (!extraction) return

        set((state) => {
          state.extractionDrag = {
            extractionId,
            position,
            type: extraction.type,
            title: extraction.suggestedData.title
          }
        })
      },

      updateExtractionDragPosition: (position) => {
        set((state) => {
          if (state.extractionDrag) {
            state.extractionDrag.position = position
          }
        })
      },

      dropExtraction: (flowPosition) => {
        const drag = get().extractionDrag
        if (!drag) return

        // Accept the extraction at the drop position
        get().acceptExtraction(drag.extractionId, flowPosition)

        // Clear drag state
        set((state) => {
          state.extractionDrag = null
        })
      },

      cancelExtractionDrag: () => {
        set((state) => {
          state.extractionDrag = null
        })
      },

      // ---------------------------------------------------------------------
      // Batch operations
      // ---------------------------------------------------------------------

      acceptAllExtractions: (sourceNodeId) => {
        const extractions = get().pendingExtractions.filter((e) => e.sourceNodeId === sourceNodeId)
        const createdNodeIds: string[] = []

        extractions.forEach((extraction) => {
          const result = get().acceptExtraction(extraction.id)
          if (result) {
            createdNodeIds.push(result.nodeId)
          }
        })

        return createdNodeIds
      },

      undoLastExtraction: () => {
        const last = get().lastAcceptedExtraction
        if (!last) return

        // Only allow undo within 10 seconds
        if (Date.now() - last.timestamp > 10000) {
          set((state) => {
            state.lastAcceptedExtraction = null
          })
          return
        }

        set((state) => {
          // Restore the extraction to pending
          state.pendingExtractions.push(last.extractionData)

          // Clear undo state
          state.lastAcceptedExtraction = null
        })
      },

      clearUndoExtraction: () => {
        set((state) => {
          state.lastAcceptedExtraction = null
        })
      },

      // ---------------------------------------------------------------------
      // Extraction settings
      // ---------------------------------------------------------------------

      updateExtractionSettings: (nodeId, settings) => {
        set((state) => {
          const currentSettings = state.extractionSettings.get(nodeId) || {}
          state.extractionSettings.set(nodeId, { ...currentSettings, ...settings })
        })
      },

      getExtractionSettings: (nodeId) => {
        return get().extractionSettings.get(nodeId)
      },

      addExtractedTitle: (nodeId, title) => {
        set((state) => {
          const settings = state.extractionSettings.get(nodeId) || {}
          if (!settings.extractedTitles) {
            settings.extractedTitles = []
          }
          settings.extractedTitles.push(title)
          state.extractionSettings.set(nodeId, settings)
        })
      }
    }))
  )
)

// =============================================================================
// Selector Hooks
// =============================================================================

export const usePendingExtractions = (): PendingExtraction[] =>
  useExtractionStore((state) => state.pendingExtractions)

export const useExtractionsForNode = (nodeId: string): PendingExtraction[] =>
  useExtractionStore((state) => state.pendingExtractions.filter((e) => e.sourceNodeId === nodeId))

export const useExtractionCountForNode = (nodeId: string): number =>
  useExtractionStore((state) => state.pendingExtractions.filter((e) => e.sourceNodeId === nodeId).length)

export const useSortedExtractionsForNode = (nodeId: string): PendingExtraction[] =>
  useExtractionStore((state) =>
    state.pendingExtractions
      .filter((e) => e.sourceNodeId === nodeId)
      .sort((a, b) => b.confidence - a.confidence)
  )

export const useIsExtracting = (): string | null =>
  useExtractionStore((state) => state.isExtracting)

export const useOpenExtractionPanelNodeId = (): string | null =>
  useExtractionStore((state) => state.openExtractionPanelNodeId)

export const useIsExtractionPanelOpen = (nodeId: string): boolean =>
  useExtractionStore((state) => state.openExtractionPanelNodeId === nodeId)

export const useExtractionDrag = () => useExtractionStore((state) => state.extractionDrag)

export const useLastAcceptedExtraction = () =>
  useExtractionStore((state) => state.lastAcceptedExtraction)
