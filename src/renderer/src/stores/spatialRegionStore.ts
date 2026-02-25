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

  // PFD Phase 3B: District management
  addDistrict: (name: string, bounds: SpatialRegion['bounds'], style?: 'tint' | 'hatching') => string
  getDistricts: () => SpatialRegion[]

  // PFD Phase 5C: Presentation mode
  getRegionsForPresentation: () => SpatialRegion[]

  // Membership checks
  checkNodePosition: (nodeId: string, x: number, y: number, width: number, height: number) => {
    entered: string[]
    exited: string[]
  }

  // PFD Phase 5B: Auto-grow region when node extends beyond bounds
  autoGrowRegion: (regionId: string, nodeBounds: { x: number; y: number; width: number; height: number }) => void

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

    // PFD Phase 5B: Auto-grow region when node extends beyond bounds
    autoGrowRegion: (regionId, nodeBounds) => {
      const PADDING = 20

      set((state) => {
        const region = state.regions.find(r => r.id === regionId)
        if (!region) return

        const rb = region.bounds
        const nodeRight = nodeBounds.x + nodeBounds.width + PADDING
        const nodeBottom = nodeBounds.y + nodeBounds.height + PADDING
        const nodeLeft = nodeBounds.x - PADDING
        const nodeTop = nodeBounds.y - PADDING

        let changed = false

        // Expand right
        if (nodeRight > rb.x + rb.width) {
          rb.width = nodeRight - rb.x
          changed = true
        }
        // Expand bottom
        if (nodeBottom > rb.y + rb.height) {
          rb.height = nodeBottom - rb.y
          changed = true
        }
        // Expand left (shifts origin, increases width)
        if (nodeLeft < rb.x) {
          rb.width += rb.x - nodeLeft
          rb.x = nodeLeft
          changed = true
        }
        // Expand top (shifts origin, increases height)
        if (nodeTop < rb.y) {
          rb.height += rb.y - nodeTop
          rb.y = nodeTop
          changed = true
        }

        // changed is used for potential future debounce logging
        void changed
      })
    },

    getRegionsForAction: (actionId) => {
      return get().regions.filter(r => r.linkedActionIds?.includes(actionId) ?? false)
    },

    loadRegions: (regions) => {
      set((state) => {
        state.regions = regions
        state.nodeRegionMembership = {}
      })
    },

    // PFD Phase 3B: District management
    addDistrict: (name, bounds, style = 'tint') => {
      const id = uuid()
      const district: SpatialRegion = {
        id,
        name,
        bounds,
        isDistrict: true,
        districtStyle: style,
        districtOpacity: 0.04
      }
      set((state) => {
        state.regions.push(district)
      })
      return id
    },

    getDistricts: () => {
      return get().regions.filter(r => r.isDistrict)
    },

    // PFD Phase 5C: Presentation mode — returns regions sorted for slide order
    // If presentationOrder is set on any region, sort by that (ascending).
    // Otherwise fall back to left-to-right x-position ordering.
    getRegionsForPresentation: () => {
      const regions = get().regions
      // Include all non-district regions as slides (districts are visual groupings, not content slides)
      const presentable = regions.filter(r => !r.isDistrict)

      // Check if any region has an explicit presentationOrder
      const hasExplicitOrder = presentable.some(r => r.presentationOrder != null)

      if (hasExplicitOrder) {
        return [...presentable].sort((a, b) => {
          // Regions with explicit order come first, sorted ascending
          const aOrder = a.presentationOrder ?? Number.MAX_SAFE_INTEGER
          const bOrder = b.presentationOrder ?? Number.MAX_SAFE_INTEGER
          if (aOrder !== bOrder) return aOrder - bOrder
          // Tie-break by x-position
          return a.bounds.x - b.bounds.x
        })
      }

      // Default: sort by x-position (left to right)
      return [...presentable].sort((a, b) => a.bounds.x - b.bounds.x)
    }
  }))
)

// Phase 1C: Selector for district regions (minimap overlay)
export const selectDistricts = (state: SpatialRegionState): SpatialRegion[] =>
  state.regions.filter(r => r.isDistrict)

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
