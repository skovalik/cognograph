import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type { SpatialRegion } from '@shared/actionTypes'

interface SpatialRegionState {
  // All defined regions
  regions: SpatialRegion[]

  // Node membership tracking: nodeId -> array of regionIds the node is inside
  nodeRegionMembership: Record<string, string[]>

  // Actions
  addRegion: (region: Omit<SpatialRegion, 'id'>) => string
  updateRegion: (regionId: string, updates: Partial<SpatialRegion>) => void
  deleteRegion: (regionId: string) => void

  // Membership checks
  checkNodePosition: (nodeId: string, x: number, y: number, width: number, height: number) => {
    entered: string[]
    exited: string[]
  }

  // Get regions for an action
  getRegionsForAction: (actionId: string) => SpatialRegion[]

  // Load/save state
  loadRegions: (regions: SpatialRegion[]) => void
}

export const useSpatialRegionStore = create<SpatialRegionState>()(
  immer((set, get) => ({
    regions: [],
    nodeRegionMembership: {},

    addRegion: (regionData) => {
      const id = uuid()
      const region: SpatialRegion = { id, ...regionData }
      set((state) => {
        state.regions.push(region)
      })
      return id
    },

    updateRegion: (regionId, updates) => {
      set((state) => {
        const region = state.regions.find(r => r.id === regionId)
        if (region) {
          Object.assign(region, updates)
        }
      })
    },

    deleteRegion: (regionId) => {
      set((state) => {
        state.regions = state.regions.filter(r => r.id !== regionId)
        // Clean up membership tracking
        for (const nodeId of Object.keys(state.nodeRegionMembership)) {
          state.nodeRegionMembership[nodeId] = state.nodeRegionMembership[nodeId]!.filter(id => id !== regionId)
        }
      })
    },

    checkNodePosition: (nodeId, x, y, width, height) => {
      const state = get()
      const entered: string[] = []
      const exited: string[] = []

      // Get current membership
      const currentMembership = state.nodeRegionMembership[nodeId] || []
      const newMembership: string[] = []

      // Check each region for intersection
      for (const region of state.regions) {
        const isInside = rectsOverlap(
          { x, y, width, height },
          region.bounds
        )

        if (isInside) {
          newMembership.push(region.id)
          if (!currentMembership.includes(region.id)) {
            entered.push(region.id)
          }
        } else {
          if (currentMembership.includes(region.id)) {
            exited.push(region.id)
          }
        }
      }

      // Update membership
      if (entered.length > 0 || exited.length > 0) {
        set((state) => {
          state.nodeRegionMembership[nodeId] = newMembership
        })
      }

      return { entered, exited }
    },

    getRegionsForAction: (actionId) => {
      return get().regions.filter(r => r.linkedActionIds.includes(actionId))
    },

    loadRegions: (regions) => {
      set((state) => {
        state.regions = regions
        state.nodeRegionMembership = {}
      })
    }
  }))
)

// Check if two rectangles overlap
function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}
