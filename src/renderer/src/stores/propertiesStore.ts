/**
 * Properties Store
 *
 * Manages property schema, custom properties, and property CRUD operations.
 * Extracted from workspaceStore as part of Week 2 Stream B Track 2 Phase 2.2a.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { PropertySchema, PropertyDefinition, PropertyOption, NodeData } from '@shared/types'
import { DEFAULT_PROPERTY_SCHEMA, BUILTIN_PROPERTIES, getPropertiesForNodeType } from '../constants/properties'

// =============================================================================
// Store State
// =============================================================================

interface PropertiesState {
  propertySchema: PropertySchema
  customProperties: Map<string, PropertyDefinition> // Custom user-defined properties
}

// =============================================================================
// Store Actions
// =============================================================================

interface PropertiesActions {
  // Property schema
  setPropertySchema: (schema: PropertySchema) => void
  resetPropertySchema: () => void

  // Custom property CRUD
  addCustomProperty: (definition: Omit<PropertyDefinition, 'id'>) => string
  updateCustomProperty: (propertyId: string, updates: Partial<PropertyDefinition>) => void
  deleteCustomProperty: (propertyId: string) => void
  getCustomProperty: (propertyId: string) => PropertyDefinition | undefined

  // Property options
  addPropertyOption: (propertyId: string, option: Omit<PropertyOption, 'value'>) => string
  updatePropertyOption: (propertyId: string, value: string, updates: Partial<PropertyOption>) => void
  deletePropertyOption: (propertyId: string, value: string) => void

  // Node type property assignment
  addPropertyToNodeType: (nodeType: NodeData['type'], propertyId: string) => void
  removePropertyFromNodeType: (nodeType: NodeData['type'], propertyId: string) => void
  updatePropertyDefaults: (nodeType: string, defaults: Record<string, unknown>) => void

  // Property retrieval
  getPropertiesForNode: (nodeType: NodeData['type']) => PropertyDefinition[]
  getPropertyDefinition: (propertyId: string) => PropertyDefinition | undefined
  getAllProperties: () => PropertyDefinition[]
}

// =============================================================================
// Store Type
// =============================================================================

type PropertiesStore = PropertiesState & PropertiesActions

// =============================================================================
// Initial State
// =============================================================================

const initialState: PropertiesState = {
  propertySchema: { ...DEFAULT_PROPERTY_SCHEMA },
  customProperties: new Map()
}

// =============================================================================
// Store Implementation
// =============================================================================

export const usePropertiesStore = create<PropertiesStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ---------------------------------------------------------------------
      // Property schema
      // ---------------------------------------------------------------------

      setPropertySchema: (schema) => {
        set((state) => {
          state.propertySchema = schema
        })
      },

      resetPropertySchema: () => {
        set((state) => {
          state.propertySchema = { ...DEFAULT_PROPERTY_SCHEMA }
          state.customProperties.clear()
        })
      },

      // ---------------------------------------------------------------------
      // Custom property CRUD
      // ---------------------------------------------------------------------

      addCustomProperty: (definition) => {
        const id = uuid()
        const newProperty: PropertyDefinition = {
          ...definition,
          id
        }

        set((state) => {
          state.customProperties.set(id, newProperty)
          // Add to schema
          if (!state.propertySchema.properties) {
            state.propertySchema.properties = []
          }
          state.propertySchema.properties.push(newProperty)
        })

        return id
      },

      updateCustomProperty: (propertyId, updates) => {
        set((state) => {
          const property = state.customProperties.get(propertyId)
          if (property) {
            Object.assign(property, updates)
            // Update in schema as well
            const schemaProperty = state.propertySchema.properties?.find((p) => p.id === propertyId)
            if (schemaProperty) {
              Object.assign(schemaProperty, updates)
            }
          }
        })
      },

      deleteCustomProperty: (propertyId) => {
        set((state) => {
          state.customProperties.delete(propertyId)
          // Remove from schema
          if (state.propertySchema.properties) {
            state.propertySchema.properties = state.propertySchema.properties.filter(
              (p) => p.id !== propertyId
            )
          }
          // Remove from node type assignments
          if (state.propertySchema.nodeTypeProperties) {
            for (const nodeType in state.propertySchema.nodeTypeProperties) {
              const props = state.propertySchema.nodeTypeProperties[nodeType]
              if (props) {
                state.propertySchema.nodeTypeProperties[nodeType] = props.filter(
                  (id) => id !== propertyId
                )
              }
            }
          }
        })
      },

      getCustomProperty: (propertyId) => {
        return get().customProperties.get(propertyId)
      },

      // ---------------------------------------------------------------------
      // Property options
      // ---------------------------------------------------------------------

      addPropertyOption: (propertyId, option) => {
        const value = uuid()
        const newOption: PropertyOption = {
          ...option,
          value
        }

        set((state) => {
          const property = state.customProperties.get(propertyId)
          if (property && property.type === 'select') {
            if (!property.options) {
              property.options = []
            }
            property.options.push(newOption)

            // Update in schema as well
            const schemaProperty = state.propertySchema.properties?.find((p) => p.id === propertyId)
            if (schemaProperty && schemaProperty.type === 'select') {
              if (!schemaProperty.options) {
                schemaProperty.options = []
              }
              schemaProperty.options.push(newOption)
            }
          }
        })

        return value
      },

      updatePropertyOption: (propertyId, value, updates) => {
        set((state) => {
          const property = state.customProperties.get(propertyId)
          if (property && property.type === 'select' && property.options) {
            const option = property.options.find((o) => o.value === value)
            if (option) {
              Object.assign(option, updates)

              // Update in schema as well
              const schemaProperty = state.propertySchema.properties?.find(
                (p) => p.id === propertyId
              )
              if (schemaProperty && schemaProperty.type === 'select' && schemaProperty.options) {
                const schemaOption = schemaProperty.options.find((o) => o.value === value)
                if (schemaOption) {
                  Object.assign(schemaOption, updates)
                }
              }
            }
          }
        })
      },

      deletePropertyOption: (propertyId, value) => {
        set((state) => {
          const property = state.customProperties.get(propertyId)
          if (property && property.type === 'select' && property.options) {
            property.options = property.options.filter((o) => o.value !== value)

            // Update in schema as well
            const schemaProperty = state.propertySchema.properties?.find((p) => p.id === propertyId)
            if (schemaProperty && schemaProperty.type === 'select' && schemaProperty.options) {
              schemaProperty.options = schemaProperty.options.filter((o) => o.value !== value)
            }
          }
        })
      },

      // ---------------------------------------------------------------------
      // Node type property assignment
      // ---------------------------------------------------------------------

      addPropertyToNodeType: (nodeType, propertyId) => {
        set((state) => {
          if (!state.propertySchema.nodeTypeProperties) {
            state.propertySchema.nodeTypeProperties = {}
          }
          if (!state.propertySchema.nodeTypeProperties[nodeType]) {
            state.propertySchema.nodeTypeProperties[nodeType] = []
          }
          const props = state.propertySchema.nodeTypeProperties[nodeType]!
          if (!props.includes(propertyId)) {
            props.push(propertyId)
          }
        })
      },

      removePropertyFromNodeType: (nodeType, propertyId) => {
        set((state) => {
          if (state.propertySchema.nodeTypeProperties?.[nodeType]) {
            state.propertySchema.nodeTypeProperties[nodeType] =
              state.propertySchema.nodeTypeProperties[nodeType]!.filter((id) => id !== propertyId)
          }
        })
      },

      updatePropertyDefaults: (nodeType, defaults) => {
        set((state) => {
          if (!state.propertySchema.defaults) {
            state.propertySchema.defaults = {}
          }
          state.propertySchema.defaults[nodeType] = defaults
        })
      },

      // ---------------------------------------------------------------------
      // Property retrieval
      // ---------------------------------------------------------------------

      getPropertiesForNode: (nodeType) => {
        // Get built-in properties for this node type
        const builtinProps = getPropertiesForNodeType(nodeType)

        // Get custom properties assigned to this node type
        const customPropertyIds = get().propertySchema.nodeTypeProperties?.[nodeType] || []
        const customProps = customPropertyIds
          .map((id) => get().customProperties.get(id))
          .filter((p): p is PropertyDefinition => p !== undefined)

        return [...builtinProps, ...customProps]
      },

      getPropertyDefinition: (propertyId) => {
        // Check built-in properties first
        const builtinProperty = BUILTIN_PROPERTIES.find((p) => p.id === propertyId)
        if (builtinProperty) return builtinProperty

        // Check custom properties
        return get().customProperties.get(propertyId)
      },

      getAllProperties: () => {
        const customProps = Array.from(get().customProperties.values())
        return [...BUILTIN_PROPERTIES, ...customProps]
      }
    }))
  )
)

// =============================================================================
// Selector Hooks
// =============================================================================

export const usePropertySchema = (): PropertySchema =>
  usePropertiesStore((state) => state.propertySchema)

export const usePropertiesForNodeType = (nodeType: NodeData['type']): PropertyDefinition[] =>
  usePropertiesStore((state) => state.getPropertiesForNode(nodeType))

export const usePropertyDefinition = (propertyId: string): PropertyDefinition | undefined =>
  usePropertiesStore((state) => state.getPropertyDefinition(propertyId))

export const useAllProperties = (): PropertyDefinition[] =>
  usePropertiesStore((state) => state.getAllProperties())

export const useCustomProperties = (): PropertyDefinition[] =>
  usePropertiesStore((state) => Array.from(state.customProperties.values()))
