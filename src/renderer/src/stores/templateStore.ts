/**
 * Template Store
 *
 * Zustand store for managing template library state.
 * Templates are stored globally at %APPDATA%/cognograph/templates/library.json
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type {
  TemplateLibrary,
  NodeTemplate,
  TemplateFolder
} from '@shared/types'
import { DEFAULT_TEMPLATE_LIBRARY } from '@shared/types'

// -----------------------------------------------------------------------------
// Context Types for Modals
// -----------------------------------------------------------------------------

export interface SaveTemplateContext {
  nodeIds: string[]
  edgeIds: string[]
  suggestedName: string
  bounds: { width: number; height: number }
  rootNodeId: string
}

export interface PasteTemplateContext {
  templateId: string
  position: { x: number; y: number }
  connectToNodeId?: string
}

// -----------------------------------------------------------------------------
// Store Interface
// -----------------------------------------------------------------------------

interface TemplateState {
  // Library data
  library: TemplateLibrary
  isLoaded: boolean
  isLoading: boolean
  loadError: string | null

  // UI State
  browserOpen: boolean
  selectedTemplateId: string | null
  selectedFolderId: string | null
  searchQuery: string
  viewMode: 'grid' | 'list'

  // Save modal state
  saveModalOpen: boolean
  saveModalContext: SaveTemplateContext | null

  // Paste modal state
  pasteModalOpen: boolean
  pasteModalContext: PasteTemplateContext | null
}

interface TemplateActions {
  // Library loading
  loadLibrary: () => Promise<void>
  saveLibrary: () => Promise<void>

  // Template CRUD
  addTemplate: (
    template: Omit<NodeTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'schemaVersion'>
  ) => string
  updateTemplate: (id: string, updates: Partial<NodeTemplate>) => void
  deleteTemplate: (id: string) => void
  duplicateTemplate: (id: string) => string | null

  // Folder CRUD
  addFolder: (name: string, parentId?: string) => string
  updateFolder: (id: string, updates: Partial<TemplateFolder>) => void
  deleteFolder: (id: string) => void

  // Favorites & usage
  toggleFavorite: (templateId: string) => void
  incrementUsage: (templateId: string) => void
  addToLastUsed: (templateId: string) => void

  // UI actions
  openBrowser: () => void
  closeBrowser: () => void
  toggleBrowser: () => void
  setSelectedTemplate: (id: string | null) => void
  setSelectedFolder: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setViewMode: (mode: 'grid' | 'list') => void

  // Save modal
  openSaveModal: (context: SaveTemplateContext) => void
  closeSaveModal: () => void

  // Paste modal
  openPasteModal: (context: PasteTemplateContext) => void
  closePasteModal: () => void

  // Getters
  getTemplate: (id: string) => NodeTemplate | undefined
  getFolder: (id: string) => TemplateFolder | undefined
  getTemplatesInFolder: (folderId: string | null) => NodeTemplate[]
  getFoldersInFolder: (parentId: string | null) => TemplateFolder[]
  searchTemplates: (query: string) => NodeTemplate[]
  getFavoriteTemplates: () => NodeTemplate[]
  getLastUsedTemplates: (limit?: number) => NodeTemplate[]
}

type TemplateStore = TemplateState & TemplateActions

// -----------------------------------------------------------------------------
// Store Implementation
// -----------------------------------------------------------------------------

export const useTemplateStore = create<TemplateStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      library: { ...DEFAULT_TEMPLATE_LIBRARY },
      isLoaded: false,
      isLoading: false,
      loadError: null,
      browserOpen: false,
      selectedTemplateId: null,
      selectedFolderId: null,
      searchQuery: '',
      viewMode: 'grid',
      saveModalOpen: false,
      saveModalContext: null,
      pasteModalOpen: false,
      pasteModalContext: null,

      // ---------------------------------------------------------------------
      // Library Loading
      // ---------------------------------------------------------------------

      loadLibrary: async () => {
        if (get().isLoading) return

        set((state) => {
          state.isLoading = true
          state.loadError = null
        })

        try {
          const result = await window.api.templates.load()
          if (result.success && result.data) {
            set((state) => {
              state.library = result.data as TemplateLibrary
              state.isLoaded = true
              state.isLoading = false
            })
          } else {
            set((state) => {
              state.loadError = result.error || 'Failed to load template library'
              state.isLoading = false
            })
          }
        } catch (error) {
          set((state) => {
            state.loadError = String(error)
            state.isLoading = false
          })
        }
      },

      saveLibrary: async () => {
        try {
          const result = await window.api.templates.save(get().library)
          if (!result.success) {
            console.error('[TemplateStore] Failed to save library:', result.error)
          }
        } catch (error) {
          console.error('[TemplateStore] Error saving library:', error)
        }
      },

      // ---------------------------------------------------------------------
      // Template CRUD
      // ---------------------------------------------------------------------

      addTemplate: (template) => {
        const id = uuid()
        const now = Date.now()

        set((state) => {
          state.library.templates.push({
            ...template,
            id,
            schemaVersion: 1,
            createdAt: now,
            updatedAt: now,
            usageCount: 0
          })
        })

        // Persist to disk
        get().saveLibrary()

        return id
      },

      updateTemplate: (id, updates) => {
        set((state) => {
          const index = state.library.templates.findIndex((t) => t.id === id)
          if (index !== -1) {
            const existing = state.library.templates[index]
            if (existing) {
              Object.assign(existing, updates, { updatedAt: Date.now() })
            }
          }
        })

        get().saveLibrary()
      },

      deleteTemplate: (id) => {
        // Protect system templates from deletion
        const template = get().library.templates.find((t) => t.id === id)
        if (template?.source === 'system') {
          console.warn('[TemplateStore] Cannot delete system templates')
          return
        }

        set((state) => {
          state.library.templates = state.library.templates.filter((t) => t.id !== id)
          state.library.favoriteTemplateIds = state.library.favoriteTemplateIds.filter(
            (fid) => fid !== id
          )
          state.library.lastUsedTemplateIds = state.library.lastUsedTemplateIds.filter(
            (lid) => lid !== id
          )
          if (state.selectedTemplateId === id) {
            state.selectedTemplateId = null
          }
        })

        get().saveLibrary()
      },

      duplicateTemplate: (id) => {
        const original = get().library.templates.find((t) => t.id === id)
        if (!original) return null

        const newId = uuid()
        const now = Date.now()

        set((state) => {
          state.library.templates.push({
            ...original,
            id: newId,
            name: `${original.name} (Copy)`,
            createdAt: now,
            updatedAt: now,
            usageCount: 0,
            source: 'user'
          })
        })

        get().saveLibrary()

        return newId
      },

      // ---------------------------------------------------------------------
      // Folder CRUD
      // ---------------------------------------------------------------------

      addFolder: (name, parentId) => {
        const id = uuid()
        const now = Date.now()

        // Calculate sort order (append to end)
        const siblingFolders = get().library.folders.filter((f) => f.parentId === parentId)
        const maxSortOrder = Math.max(0, ...siblingFolders.map((f) => f.sortOrder))

        set((state) => {
          state.library.folders.push({
            id,
            name,
            parentId,
            sortOrder: maxSortOrder + 1,
            createdAt: now
          })
        })

        get().saveLibrary()

        return id
      },

      updateFolder: (id, updates) => {
        set((state) => {
          const index = state.library.folders.findIndex((f) => f.id === id)
          if (index !== -1) {
            const existing = state.library.folders[index]
            if (existing) {
              Object.assign(existing, updates)
            }
          }
        })

        get().saveLibrary()
      },

      deleteFolder: (id) => {
        set((state) => {
          // Move templates in this folder to root
          state.library.templates.forEach((t) => {
            if (t.folderId === id) {
              t.folderId = undefined
            }
          })

          // Move subfolders to root
          state.library.folders.forEach((f) => {
            if (f.parentId === id) {
              f.parentId = undefined
            }
          })

          // Remove the folder
          state.library.folders = state.library.folders.filter((f) => f.id !== id)

          if (state.selectedFolderId === id) {
            state.selectedFolderId = null
          }
        })

        get().saveLibrary()
      },

      // ---------------------------------------------------------------------
      // Favorites & Usage
      // ---------------------------------------------------------------------

      toggleFavorite: (templateId) => {
        set((state) => {
          const index = state.library.favoriteTemplateIds.indexOf(templateId)
          if (index === -1) {
            state.library.favoriteTemplateIds.push(templateId)
          } else {
            state.library.favoriteTemplateIds.splice(index, 1)
          }
        })

        get().saveLibrary()
      },

      incrementUsage: (templateId) => {
        set((state) => {
          const template = state.library.templates.find((t) => t.id === templateId)
          if (template) {
            template.usageCount += 1
          }
        })

        get().saveLibrary()
      },

      addToLastUsed: (templateId) => {
        set((state) => {
          // Remove if already in list
          state.library.lastUsedTemplateIds = state.library.lastUsedTemplateIds.filter(
            (id) => id !== templateId
          )
          // Add to front
          state.library.lastUsedTemplateIds.unshift(templateId)
          // Keep only last 10
          if (state.library.lastUsedTemplateIds.length > 10) {
            state.library.lastUsedTemplateIds = state.library.lastUsedTemplateIds.slice(0, 10)
          }
        })

        get().saveLibrary()
      },

      // ---------------------------------------------------------------------
      // UI Actions
      // ---------------------------------------------------------------------

      openBrowser: () => set({ browserOpen: true }),
      closeBrowser: () => set({ browserOpen: false }),
      toggleBrowser: () => set((state) => ({ browserOpen: !state.browserOpen })),

      setSelectedTemplate: (id) => set({ selectedTemplateId: id }),
      setSelectedFolder: (id) => set({ selectedFolderId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setViewMode: (mode) => set({ viewMode: mode }),

      // Save modal
      openSaveModal: (context) =>
        set({
          saveModalOpen: true,
          saveModalContext: context
        }),

      closeSaveModal: () =>
        set({
          saveModalOpen: false,
          saveModalContext: null
        }),

      // Paste modal
      openPasteModal: (context) =>
        set({
          pasteModalOpen: true,
          pasteModalContext: context
        }),

      closePasteModal: () =>
        set({
          pasteModalOpen: false,
          pasteModalContext: null
        }),

      // ---------------------------------------------------------------------
      // Getters
      // ---------------------------------------------------------------------

      getTemplate: (id) => {
        return get().library.templates.find((t) => t.id === id)
      },

      getFolder: (id) => {
        return get().library.folders.find((f) => f.id === id)
      },

      getTemplatesInFolder: (folderId) => {
        return get().library.templates.filter((t) =>
          folderId === null ? !t.folderId : t.folderId === folderId
        )
      },

      getFoldersInFolder: (parentId) => {
        return get()
          .library.folders.filter((f) => (parentId === null ? !f.parentId : f.parentId === parentId))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      },

      searchTemplates: (query) => {
        const q = query.toLowerCase().trim()
        if (!q) return get().library.templates

        return get().library.templates.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.tags?.some((tag) => tag.toLowerCase().includes(q))
        )
      },

      getFavoriteTemplates: () => {
        const favoriteIds = get().library.favoriteTemplateIds
        return get().library.templates.filter((t) => favoriteIds.includes(t.id))
      },

      getLastUsedTemplates: (limit = 5) => {
        const lastUsedIds = get().library.lastUsedTemplateIds.slice(0, limit)
        return lastUsedIds
          .map((id) => get().library.templates.find((t) => t.id === id))
          .filter((t): t is NodeTemplate => t !== undefined)
      }
    }))
  )
)

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const useTemplates = (): NodeTemplate[] =>
  useTemplateStore((s) => s.library.templates)

export const useFolders = (): TemplateFolder[] =>
  useTemplateStore((s) => s.library.folders)

export const useFavoriteIds = (): string[] =>
  useTemplateStore((s) => s.library.favoriteTemplateIds)

export const useIsBrowserOpen = (): boolean =>
  useTemplateStore((s) => s.browserOpen)

export const useIsTemplateLibraryLoaded = (): boolean =>
  useTemplateStore((s) => s.isLoaded)

export const useTemplateSearchQuery = (): string =>
  useTemplateStore((s) => s.searchQuery)

export const useSelectedTemplateId = (): string | null =>
  useTemplateStore((s) => s.selectedTemplateId)

export const useSelectedFolderId = (): string | null =>
  useTemplateStore((s) => s.selectedFolderId)

export const useSaveModalState = (): { open: boolean; context: SaveTemplateContext | null } =>
  useTemplateStore((s) => ({
    open: s.saveModalOpen,
    context: s.saveModalContext
  }))

export const usePasteModalState = (): { open: boolean; context: PasteTemplateContext | null } =>
  useTemplateStore((s) => ({
    open: s.pasteModalOpen,
    context: s.pasteModalContext
  }))
