import { memo, useCallback, useState, useMemo } from 'react'
import { X, Trash2, MessageSquare, Folder, FileText, CheckSquare, ChevronDown, ChevronRight, Tag, Plus, Code, Sparkles, Files, GripVertical, Power, Zap, Link2, Boxes, Bot, Compass, Users, Eye, EyeOff, Link2Off, HelpCircle, ExternalLink, Paperclip, Square, Circle, Hexagon, RectangleHorizontal, Workflow, CheckCircle, XCircle, Search, BarChart3, AlertTriangle } from 'lucide-react'
import { Slider } from './ui/slider'
import { useReactFlow } from '@xyflow/react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { PropertyInput, AddPropertyPopover, CreatePropertyModal, AIPropertyAssist } from './properties'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { getPropertiesForNodeType, BUILTIN_PROPERTIES } from '../constants/properties'
import { IconPicker } from './IconPicker'
import { MultiSelectProperties } from './MultiSelectProperties'
import { useAttachments } from '../hooks/useAttachments'
import { RichTextEditor } from './RichTextEditor'
import type {
  NodeData,
  ConversationNodeData,
  ProjectNodeData,
  NoteNodeData,
  TaskNodeData,
  ArtifactNodeData,
  WorkspaceNodeData,
  ActionNodeData,
  OrchestratorNodeData,
  TextNodeData,
  WorkspaceLLMSettings,
  WorkspaceContextRules,
  ArtifactFile,
  ArtifactContentType,
  Attachment,
  ContextMetadata,
  PropertyDefinition,
  ExtractionSettings,
  NodeActivationCondition,
  ActivationTrigger,
  NodeShape
} from '@shared/types'
import { ActionPropertiesFields } from './action/ActionPropertiesFields'
import { DEFAULT_EXTRACTION_SETTINGS } from '@shared/types'
import { AGENT_PRESETS, getPresetById } from '../constants/agentPresets'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui'
import { AgentMemoryViewer } from './agent/AgentMemoryViewer'
import { AgentSettingsEditor } from './agent/AgentSettingsEditor'
import { AgentRunHistoryViewer } from './agent/AgentRunHistoryViewer'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'


// Help tooltip component - positioned below and to the left to stay within right-side panels
function HelpTooltip({ text }: { text: string }): JSX.Element {
  return (
    <span className="relative group ml-1 inline-flex items-center">
      <HelpCircle className="w-3 h-3 gui-text-secondary cursor-help" />
      <span className="absolute top-full left-0 mt-1 px-2 py-1.5 text-xs gui-text glass-fluid gui-panel border gui-border rounded shadow-lg whitespace-normal w-52 text-left hidden group-hover:block transition-opacity z-[100]">
        {text}
      </span>
    </span>
  )
}

interface PropertiesPanelProps {
  compact?: boolean
  hideHeader?: boolean // When embedded in FloatingPropertiesModal, hide the header
  nodeId?: string // Override which node to display (for pinned floating modals)
}

function PropertiesPanelComponent({ compact: _compact = false, hideHeader = false, nodeId }: PropertiesPanelProps): JSX.Element | null {
  const { updateNodeInternals } = useReactFlow()
  const selectedNodeIds = useWorkspaceStore((state) => state.selectedNodeIds)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const updateBulkNodes = useWorkspaceStore((state) => state.updateBulkNodes)
  const changeNodeType = useWorkspaceStore((state) => state.changeNodeType)
  const deleteNodes = useWorkspaceStore((state) => state.deleteNodes)
  const closeProperties = useWorkspaceStore((state) => state.closeProperties)
  const openChat = useWorkspaceStore((state) => state.openChat)
  const setNodeProperty = useWorkspaceStore((state) => state.setNodeProperty)
  const addPropertyOption = useWorkspaceStore((state) => state.addPropertyOption)
  const addCustomProperty = useWorkspaceStore((state) => state.addCustomProperty)
  const addPropertyToNodeType = useWorkspaceStore((state) => state.addPropertyToNodeType)
  const removePropertyFromNodeType = useWorkspaceStore((state) => state.removePropertyFromNodeType)
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const updateExtractionSettings = useWorkspaceStore((state) => state.updateExtractionSettings)

  const [showCreatePropertyModal, setShowCreatePropertyModal] = useState(false)

  // Track multi-selection state
  const isMultiSelection = !nodeId && selectedNodeIds.length > 1

  // Use provided nodeId or fall back to first selected node
  const targetNodeId = nodeId || selectedNodeIds[0]
  // Targeted selector: only re-renders when THIS node's data changes, not all nodes
  const selectedNode = useWorkspaceStore((state) =>
    targetNodeId ? state.nodes.find((n) => n.id === targetNodeId) : undefined
  )

  const handleClose = useCallback(() => {
    closeProperties()
  }, [closeProperties])

  const handleDelete = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      deleteNodes(selectedNodeIds)
      closeProperties()
    }
  }, [selectedNodeIds, deleteNodes, closeProperties])

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      if (targetNodeId) {
        // Special handling for batch updates (multiple fields at once)
        if (field === '_batch' && typeof value === 'object' && value !== null) {
          updateNode(targetNodeId, value as Partial<NodeData>)
        } else {
          updateNode(targetNodeId, { [field]: value } as Partial<NodeData>)
        }
      }
    },
    [targetNodeId, updateNode]
  )

  const handleTypeChange = useCallback(
    (newType: NodeData['type']) => {
      if (targetNodeId && selectedNode && newType !== selectedNode.data.type) {
        changeNodeType(targetNodeId, newType)
        // Force React Flow to recalculate handle positions after type change
        requestAnimationFrame(() => {
          updateNodeInternals(targetNodeId)
        })
      }
    },
    [targetNodeId, selectedNode, changeNodeType, updateNodeInternals]
  )

  // Property-specific change handler (stores in properties object)
  const handlePropertyChange = useCallback(
    (propertyId: string, value: unknown) => {
      if (targetNodeId) {
        setNodeProperty(targetNodeId, propertyId, value)
      }
    },
    [targetNodeId, setNodeProperty]
  )

  // Handler for adding new options to select/multi-select properties
  const handleAddOption = useCallback(
    (propertyId: string, option: { label: string; color?: string }) => {
      // The store action generates the value from the label
      addPropertyOption(propertyId, option)
    },
    [addPropertyOption]
  )

  // Handler for adding an existing property to the current node type
  const handleAddPropertyToNode = useCallback(
    (propertyId: string) => {
      const nodeType = selectedNode?.data.type
      if (nodeType) {
        addPropertyToNodeType(nodeType, propertyId)
      }
    },
    [selectedNode?.data.type, addPropertyToNodeType]
  )

  // Handler for creating a new custom property
  const handleCreateProperty = useCallback(
    (property: Omit<PropertyDefinition, 'id'>) => {
      // Create the custom property and get its ID
      const propertyId = addCustomProperty(property)
      // Add it to the current node type
      const nodeType = selectedNode?.data.type
      if (nodeType) {
        addPropertyToNodeType(nodeType, propertyId)
      }
    },
    [selectedNode?.data.type, addCustomProperty, addPropertyToNodeType]
  )

  // Handler for removing a property from the current node type
  const handleRemovePropertyFromNode = useCallback(
    (propertyId: string) => {
      const nodeType = selectedNode?.data.type
      if (nodeType) {
        removePropertyFromNodeType(nodeType, propertyId)
      }
    },
    [selectedNode?.data.type, removePropertyFromNodeType]
  )

  // Handler for toggling property visibility on the node card
  const handleToggleHidden = useCallback(
    (propertyId: string) => {
      if (!targetNodeId || !selectedNode) return
      const current = (selectedNode.data as { hiddenProperties?: string[] }).hiddenProperties || []
      const updated = current.includes(propertyId)
        ? current.filter((id: string) => id !== propertyId)
        : [...current, propertyId]
      updateNode(targetNodeId, { hiddenProperties: updated } as Partial<NodeData>)
    },
    [targetNodeId, selectedNode, updateNode]
  )

  // Handler for updating extraction settings on conversation nodes
  const handleExtractionSettingsChange = useCallback(
    (settings: Partial<ExtractionSettings>) => {
      if (targetNodeId) {
        updateExtractionSettings(targetNodeId, settings)
      }
    },
    [targetNodeId, updateExtractionSettings]
  )

  const themeSettings = useWorkspaceStore((state) => state.themeSettings)

  if (!selectedNode) return null

  const nodeData = selectedNode.data
  const currentPropertyIds = propertySchema.nodeTypeProperties[nodeData.type] || []

  return (
    <div className={`h-full w-full gui-panel glass-soft ${hideHeader ? '' : 'border-l gui-border shadow-xl'} gui-z-panels flex flex-col`}>
      {/* Header - hidden when embedded in floating modal */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b gui-border">
          <div className="flex items-center gap-2">
            <NodeIcon type={nodeData.type} nodeColors={themeSettings.nodeColors} />
            <select
              value={nodeData.type}
              onChange={(e) => handleTypeChange(e.target.value as NodeData['type'])}
              className="font-medium gui-text capitalize gui-input border-none cursor-pointer rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Change node type"
            >
              <option value="conversation">Conversation</option>
              <option value="note">Note</option>
              <option value="task">Task</option>
              <option value="project">Project</option>
              <option value="artifact">Artifact</option>
              <option value="workspace">Workspace</option>
              <option value="action">Action</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            {/* AI Property Assist - only for single selection */}
            {!isMultiSelection && targetNodeId && (
              <AIPropertyAssist
                nodeId={targetNodeId}
                nodeData={nodeData}
                disabled={isMultiSelection}
              />
            )}
            <button
              onClick={handleClose}
              className="p-1 gui-button rounded transition-colors"
            >
              <X className="w-5 h-5 gui-text-secondary" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title - common to all */}
        <div>
          <label className="block text-xs font-medium gui-text-secondary mb-1">Title</label>
          <input
            type="text"
            value={nodeData.title as string}
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Color - common to all node types, supports bulk change */}
        <NodeColorPicker
          nodeData={nodeData}
          onChange={handleChange}
          selectedNodeIds={isMultiSelection ? selectedNodeIds : undefined}
          onBulkChange={isMultiSelection ? updateBulkNodes : undefined}
        />

        {/* Bulk property editing for multi-selection */}
        {isMultiSelection && (
          <MultiSelectProperties nodeIds={selectedNodeIds} />
        )}

        {/* Icon - custom icon for all node types */}
        {!isMultiSelection && (
          <IconPicker
            value={(nodeData as ContextMetadata).icon}
            onChange={(iconName) => handleChange('icon', iconName)}
            color={(nodeData as { color?: string }).color || themeSettings.nodeColors[nodeData.type]}
          />
        )}

        {/* Shape - node border shape picker */}
        {!isMultiSelection && (
          <NodeShapePicker
            nodeData={nodeData}
            onChange={handleChange}
          />
        )}

        {/* Enabled/Disabled Toggle */}
        <NodeEnabledToggle
          nodeId={selectedNode.id}
          nodeData={nodeData}
          onChange={handleChange}
        />

        {/* Type-specific fields */}
        {nodeData.type === 'conversation' && (
          <ConversationFields
            data={nodeData}
            onChange={handleChange}
            onOpenChat={() => openChat(selectedNode.id)}
            onExtractionSettingsChange={handleExtractionSettingsChange}
          />
        )}
        {nodeData.type === 'project' && <ProjectFields data={nodeData} onChange={handleChange} />}
        {nodeData.type === 'note' && <NoteFields data={nodeData} onChange={handleChange} hiddenProperties={(nodeData as { hiddenProperties?: string[] }).hiddenProperties} onToggleHidden={handleToggleHidden} />}
        {nodeData.type === 'text' && <TextFields data={nodeData as TextNodeData} onChange={handleChange} />}
        {nodeData.type === 'task' && <TaskFields data={nodeData} onChange={handleChange} onAddOption={handleAddOption} hiddenProperties={(nodeData as { hiddenProperties?: string[] }).hiddenProperties} onToggleHidden={handleToggleHidden} />}
        {nodeData.type === 'artifact' && <ArtifactFields nodeId={selectedNode.id} data={nodeData} onChange={handleChange} />}
        {nodeData.type === 'workspace' && <WorkspaceFields nodeId={selectedNode.id} data={nodeData} onChange={handleChange} />}
        {nodeData.type === 'action' && <ActionPropertiesFields nodeId={selectedNode.id} data={nodeData as ActionNodeData} onChange={handleChange} />}
        {nodeData.type === 'orchestrator' && <OrchestratorFields data={nodeData as OrchestratorNodeData} onChange={handleChange} />}

        {/* Dynamic Properties Section */}
        <DynamicPropertiesSection
          nodeType={nodeData.type}
          properties={(nodeData.properties || {}) as Record<string, unknown>}
          hiddenProperties={(nodeData as { hiddenProperties?: string[] }).hiddenProperties}
          onPropertyChange={handlePropertyChange}
          onAddOption={handleAddOption}
          onRemoveProperty={handleRemovePropertyFromNode}
          onToggleHidden={handleToggleHidden}
        />

        {/* URL Field - available for all node types, placed below tags/properties */}
        <div className="group">
          <label className="block text-xs font-medium mb-1 gui-text-secondary">
            <Link2 className="w-3 h-3 inline mr-1" />
            URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={((nodeData.properties as Record<string, unknown> | undefined)?.url as string) || ''}
              onChange={(e) => handlePropertyChange('url', e.target.value)}
              placeholder="https://..."
              className="flex-1 gui-input px-2 py-1.5 rounded text-sm border focus:outline-none focus:border-blue-500"
            />
            {((nodeData.properties as Record<string, unknown> | undefined)?.url as string) && (
              <button
                onClick={() => window.open((nodeData.properties as Record<string, unknown> | undefined)?.url as string, '_blank')}
                className="p-1.5 rounded transition-colors gui-text-secondary hover:text-blue-400 gui-button"
                title="Open URL"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Add Property Button */}
        <div className="pt-2">
          <AddPropertyPopover
            nodeType={nodeData.type}
            currentPropertyIds={currentPropertyIds}
            onAddProperty={handleAddPropertyToNode}
            onCreateCustom={() => setShowCreatePropertyModal(true)}
          />
        </div>

        {/* Attachments Section (collapsible) */}
        {!isMultiSelection && targetNodeId && (
          <AttachmentsSection nodeId={targetNodeId} nodeData={nodeData} />
        )}

        {/* Node Metadata Section (collapsible) */}
        <MetadataSection data={nodeData} onChange={handleChange} />

        {/* Outgoing Edge Color Section (collapsible) */}
        <OutgoingEdgeColorSection nodeId={selectedNode.id} data={nodeData} />

        {/* Timestamps */}
        <div className="pt-4 border-t gui-border">
          <p className="text-xs gui-text-secondary">
            Created: {new Date(nodeData.createdAt).toLocaleString()}
          </p>
          <p className="text-xs gui-text-secondary">
            Updated: {new Date(nodeData.updatedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t gui-border">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Node
        </button>
      </div>

      {/* Create Property Modal */}
      <CreatePropertyModal
        isOpen={showCreatePropertyModal}
        onClose={() => setShowCreatePropertyModal(false)}
        onCreateProperty={handleCreateProperty}
      />
    </div>
  )
}

// Node color picker component - compact inline design
// Supports multi-selection for bulk color changes
function NodeColorPicker({
  nodeData,
  onChange,
  selectedNodeIds,
  onBulkChange
}: {
  nodeData: NodeData
  onChange: (field: string, value: unknown) => void
  selectedNodeIds?: string[]
  onBulkChange?: (nodeIds: string[], data: Partial<NodeData>) => void
}): JSX.Element {
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const [isExpanded, setIsExpanded] = useState(false)

  // Check if we're in multi-selection mode
  const isMultiSelection = selectedNodeIds && selectedNodeIds.length > 1 && onBulkChange

  // Preset colors organized by hue
  const presetColors = [
    '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b',
    '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#64748b'
  ]

  // Get current color or default
  const defaultColor = themeSettings.nodeColors[nodeData.type]
  const currentColor = (nodeData as { color?: string }).color || defaultColor
  const hasCustomColor = !!(nodeData as { color?: string }).color

  // Handle color change - bulk or single
  const handleColorChange = (color: string | undefined): void => {
    if (isMultiSelection) {
      onBulkChange(selectedNodeIds, { color } as Partial<NodeData>)
    } else {
      onChange('color', color)
    }
    setIsExpanded(false)
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium gui-text-secondary shrink-0">
        Color {isMultiSelection && <span className="text-blue-400">({selectedNodeIds.length})</span>}
      </label>

      {/* Current color indicator / toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-5 h-5 rounded-full border-2 transition-all shrink-0 ${
          isExpanded ? 'gui-ring-active' : 'border-[var(--gui-border-strong)] hover:border-[var(--gui-text-secondary)]'
        }`}
        style={{ backgroundColor: isMultiSelection ? '#6b7280' : currentColor }}
        title={isMultiSelection ? `Change color for ${selectedNodeIds.length} nodes` : 'Click to change color'}
      >
        {isMultiSelection && <span className="text-white text-[8px] font-bold">+</span>}
      </button>

      {/* Inline color swatches - show when expanded */}
      {isExpanded && (
        <div className="flex items-center gap-1 flex-wrap">
          {presetColors.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className={`w-4 h-4 rounded-full border transition-all ${
                !isMultiSelection && currentColor === color
                  ? 'border-[var(--gui-text-primary)] scale-110'
                  : 'border-transparent hover:border-[var(--gui-text-secondary)] hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          {/* Reset button */}
          {(hasCustomColor || isMultiSelection) && (
            <button
              onClick={() => handleColorChange(undefined)}
              className="w-4 h-4 rounded-full border border-[var(--gui-border-strong)] gui-panel-secondary flex items-center justify-center text-[8px] gui-text-secondary transition-all"
              title={isMultiSelection ? 'Reset all to default' : 'Reset to default'}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Show reset indicator when collapsed but has custom color */}
      {!isExpanded && hasCustomColor && !isMultiSelection && (
        <button
          onClick={() => handleColorChange(undefined)}
          className="text-[10px] gui-text-secondary transition-colors"
          title="Reset to default"
        >
          reset
        </button>
      )}
    </div>
  )
}

// Node shape picker component - inline design similar to color picker
function NodeShapePicker({
  nodeData,
  onChange
}: {
  nodeData: NodeData
  onChange: (field: string, value: unknown) => void
}): JSX.Element {
  const currentShape = (nodeData as ContextMetadata).nodeShape || 'rectangle'

  // Available shapes with their display info
  const shapes: { value: NodeShape; label: string; icon: JSX.Element }[] = [
    { value: 'rectangle', label: 'Rectangle', icon: <Square className="w-3 h-3" /> },
    { value: 'rounded', label: 'Rounded', icon: <RectangleHorizontal className="w-3 h-3" /> },
    { value: 'pill', label: 'Pill', icon: <Circle className="w-3 h-3" /> },
    { value: 'hexagon', label: 'Hexagon', icon: <Hexagon className="w-3 h-3" /> }
  ]

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium gui-text-secondary shrink-0">Shape</label>
      <div className="flex items-center gap-1">
        {shapes.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => onChange('nodeShape', value === 'rectangle' ? undefined : value)}
            className={`p-1.5 rounded transition-all ${
              currentShape === value
                ? 'gui-panel-secondary gui-ring-active'
                : 'gui-text-secondary hover:gui-text-primary hover:gui-panel-tertiary'
            }`}
            title={label}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}

// Node icon component
function NodeIcon({ type, nodeColors }: { type: NodeData['type']; nodeColors?: Record<string, string> }): JSX.Element {
  // Use theme colors if provided, otherwise fallback to defaults
  const colors = nodeColors || {
    conversation: '#60a5fa',
    project: '#a78bfa',
    note: '#fbbf24',
    task: '#34d399',
    artifact: '#22d3ee',
    workspace: '#8b5cf6'
  }

  switch (type) {
    case 'conversation':
      return <MessageSquare className="w-5 h-5" style={{ color: colors.conversation }} />
    case 'project':
      return <Folder className="w-5 h-5" style={{ color: colors.project }} />
    case 'note':
      return <FileText className="w-5 h-5" style={{ color: colors.note }} />
    case 'task':
      return <CheckSquare className="w-5 h-5" style={{ color: colors.task }} />
    case 'artifact':
      return <Code className="w-5 h-5" style={{ color: colors.artifact }} />
    case 'workspace':
      return <Boxes className="w-5 h-5" style={{ color: colors.workspace }} />
    case 'action':
      return <Zap className="w-5 h-5" style={{ color: colors.action || '#f97316' }} />
    case 'text':
      return <FileText className="w-5 h-5" style={{ color: colors.text || '#9ca3af' }} />
    case 'orchestrator':
      return <Workflow className="w-5 h-5" style={{ color: colors.orchestrator || '#8b5cf6' }} />
  }
}

// Node enabled toggle component with conditional activation
function NodeEnabledToggle({
  nodeId,
  nodeData,
  onChange
}: {
  nodeId: string
  nodeData: NodeData
  onChange: (field: string, value: unknown) => void
}): JSX.Element {
  const [isConditionExpanded, setIsConditionExpanded] = useState(false)
  const nodes = useWorkspaceStore((state) => state.nodes)
  const edges = useWorkspaceStore((state) => state.edges)

  // Get the enabled state (default to true if not set)
  const isEnabled = (nodeData as ContextMetadata).enabled !== false
  const activationCondition = (nodeData as ContextMetadata).activationCondition

  // Find connected nodes for the "specific node" trigger option
  const connectedNodes = useMemo(() => {
    const incomingEdges = edges.filter(e => e.target === nodeId)
    return incomingEdges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.source)
      return sourceNode ? { id: sourceNode.id, title: sourceNode.data.title, type: sourceNode.data.type } : null
    }).filter(Boolean) as { id: string; title: string; type: string }[]
  }, [edges, nodes, nodeId])

  const handleToggleEnabled = (): void => {
    onChange('enabled', !isEnabled)
  }

  const handleSetCondition = (condition: NodeActivationCondition | undefined): void => {
    onChange('activationCondition', condition)
  }

  const handleTriggerChange = (trigger: ActivationTrigger): void => {
    if (!trigger) {
      handleSetCondition(undefined)
      return
    }
    const firstConnectedNode = connectedNodes[0]
    handleSetCondition({
      trigger,
      sourceNodeId: trigger === 'specific-node' && firstConnectedNode ? firstConnectedNode.id : undefined
    })
  }

  return (
    <div className="pt-3 border-t gui-border">
      {/* Main enabled toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Power className={`w-4 h-4 ${isEnabled ? 'text-emerald-400' : 'gui-text-secondary'}`} />
          <span className="text-xs font-medium gui-text">Node Enabled</span>
        </div>
        <button
          onClick={handleToggleEnabled}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            isEnabled ? 'bg-emerald-600' : 'gui-panel-secondary'
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              isEnabled ? 'left-5' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* Conditional activation section */}
      <button
        onClick={() => setIsConditionExpanded(!isConditionExpanded)}
        className="flex items-center gap-2 text-xs gui-text-secondary w-full"
      >
        {isConditionExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Zap className="w-3 h-3" />
        Conditional Activation
        {activationCondition && (
          <span
            className="ml-auto px-1.5 py-0.5 rounded text-[10px]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 30%, transparent)',
              color: 'var(--gui-accent-primary)'
            }}
          >
            ON
          </span>
        )}
      </button>

      {isConditionExpanded && (
        <div className="mt-2 pl-5 space-y-2">
          {/* Trigger type select */}
          <div>
            <label className="block text-xs gui-text-secondary mb-1">Activation Trigger</label>
            <select
              value={activationCondition?.trigger || ''}
              onChange={(e) => handleTriggerChange(e.target.value as ActivationTrigger)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="">Manual only (no condition)</option>
              <option value="any-connected">Any connected node enabled</option>
              <option value="all-connected">All connected nodes enabled</option>
              <option value="specific-node">Specific node enabled</option>
              <option value="edge-property">Based on edge property</option>
            </select>
          </div>

          {/* Specific node selector */}
          {activationCondition?.trigger === 'specific-node' && (
            <div>
              <label className="block text-xs gui-text-secondary mb-1">
                <Link2 className="w-3 h-3 inline mr-1" />
                Source Node
              </label>
              {connectedNodes.length > 0 ? (
                <select
                  value={activationCondition.sourceNodeId || ''}
                  onChange={(e) => handleSetCondition({
                    ...activationCondition,
                    sourceNodeId: e.target.value
                  })}
                  className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                >
                  {connectedNodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.title} ({node.type})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs gui-text-secondary italic">No incoming connections</p>
              )}
            </div>
          )}

          {/* Edge property selector */}
          {activationCondition?.trigger === 'edge-property' && (
            <>
              <div>
                <label className="block text-xs gui-text-secondary mb-1">Property Name</label>
                <input
                  type="text"
                  value={activationCondition.edgeProperty || ''}
                  onChange={(e) => handleSetCondition({
                    ...activationCondition,
                    edgeProperty: e.target.value
                  })}
                  placeholder="e.g., active, completed"
                  className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs gui-text-secondary mb-1">Expected Value</label>
                <input
                  type="text"
                  value={String(activationCondition.edgePropertyValue || '')}
                  onChange={(e) => handleSetCondition({
                    ...activationCondition,
                    edgePropertyValue: e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value
                  })}
                  placeholder="e.g., true, active"
                  className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          {/* Invert option */}
          {activationCondition && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="invert-condition"
                checked={activationCondition.invert || false}
                onChange={(e) => handleSetCondition({
                  ...activationCondition,
                  invert: e.target.checked
                })}
                className="rounded gui-input"
                style={{ accentColor: 'var(--gui-accent-primary)' }}
              />
              <label htmlFor="invert-condition" className="text-xs gui-text-secondary">
                Invert condition (disable when condition is met)
              </label>
            </div>
          )}

          {/* Clear condition button */}
          {activationCondition && (
            <button
              onClick={() => handleSetCondition(undefined)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear condition
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Conversation-specific fields
function ConversationFields({
  data,
  onChange,
  onOpenChat,
  onExtractionSettingsChange
}: {
  data: ConversationNodeData
  onChange: (field: string, value: unknown) => void
  onOpenChat: () => void
  onExtractionSettingsChange: (settings: Partial<ExtractionSettings>) => void
}): JSX.Element {
  const extractionSettings = data.extractionSettings || DEFAULT_EXTRACTION_SETTINGS
  const [isExtractionExpanded, setIsExtractionExpanded] = useState(false)

  const handleToggleExtractionType = (type: 'notes' | 'tasks'): void => {
    const current = extractionSettings.extractionTypes
    const newTypes = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    onExtractionSettingsChange({ extractionTypes: newTypes as ('notes' | 'tasks')[] })
  }

  return (
    <>
      {/* Mode selector */}
      <div>
        <label className="block text-xs font-medium gui-text-secondary mb-1">
          Mode
          <HelpTooltip text="Chat mode is for interactive conversations. Agent mode allows the AI to autonomously create nodes, tasks, and connections that configure context." />
        </label>
        <select
          value={data.mode || 'chat'}
          onChange={(e) => {
            const newMode = e.target.value as 'chat' | 'agent'
            onChange('mode', newMode)
            if (newMode === 'agent') {
              // Initialize agent defaults if switching to agent mode
              if (!data.agentPreset) onChange('agentPreset', 'custom')
              if (!data.agentStatus) onChange('agentStatus', 'idle')
            }
          }}
          className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="chat">💬 Chat — Standard conversation</option>
          <option value="agent">🤖 Agent — Autonomous tool-using AI</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium gui-text-secondary mb-1">
          Provider
          <HelpTooltip text="Choose which AI service to use: Claude (Anthropic) for best reasoning, Gemini (Google) for speed, or GPT (OpenAI) for broad capabilities." />
        </label>
        <select
          value={data.provider}
          onChange={(e) => onChange('provider', e.target.value)}
          className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="gemini">Google (Gemini)</option>
          <option value="openai">OpenAI (GPT)</option>
        </select>
      </div>

      <div>
        <p className={`text-xs gui-text-secondary mb-2`}>{data.messages.length} messages</p>
        <button
          onClick={onOpenChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-900/50 hover:bg-blue-900 text-blue-300 rounded transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Open Chat
        </button>
      </div>

      {/* Agent Preset — shown when mode is 'agent' */}
      {data.mode === 'agent' && (
        <>
          <div className="space-y-1">
            <label className="block text-xs font-medium gui-text-secondary">
              Agent Preset
              <HelpTooltip text="Pre-configured agent behaviors: Research Assistant explores topics deeply, Task Manager organizes work, Code Helper writes and explains code, General Purpose handles any task." />
            </label>
            <Select
              value={data.agentPreset || 'custom'}
              onValueChange={(v) => {
                const preset = getPresetById(v)
                if (preset) onChange('agentPreset', v)
              }}
            >
              <SelectTrigger className="w-full h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agent Deep UI Components */}
          <AgentMemoryViewer
            nodeId={data.id || ''}
            memory={data.agentMemory || { entries: [], maxEntries: 50, maxKeyLength: 100, maxValueLength: 10000 }}
            onChange={(memory) => onChange('agentMemory', memory)}
          />

          <AgentSettingsEditor
            nodeId={data.id || ''}
            settings={data.agentSettings || {}}
            preset={data.agentPreset || 'custom'}
            onChange={(settings) => {
              onChange('agentSettings', settings)
              onChange('agentPreset', 'custom')
            }}
          />

          <AgentRunHistoryViewer
            nodeId={data.id || ''}
            history={data.agentRunHistory || []}
          />
        </>
      )}

      {/* Extraction Settings */}
      <div className="pt-3 border-t gui-border">
        <button
          onClick={() => setIsExtractionExpanded(!isExtractionExpanded)}
          className="flex items-center gap-2 text-xs font-medium gui-text mb-2 w-full"
        >
          {isExtractionExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--gui-accent-primary)' }} />
          Auto-Extraction
          {extractionSettings.autoExtractEnabled && (
            <span
              className="ml-auto px-1.5 py-0.5 rounded text-[10px]"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 30%, transparent)',
                color: 'var(--gui-accent-primary)'
              }}
            >
              ON
            </span>
          )}
        </button>

        {isExtractionExpanded && (
          <div className="space-y-3 pl-5">
            {/* Enable toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="extraction-enabled"
                checked={extractionSettings.autoExtractEnabled}
                onChange={(e) => onExtractionSettingsChange({ autoExtractEnabled: e.target.checked })}
                className="rounded gui-input"
                style={{ accentColor: 'var(--gui-accent-primary)' }}
              />
              <label htmlFor="extraction-enabled" className="text-xs gui-text-secondary">
                Enable auto-extraction
              </label>
            </div>

            {/* Extraction types */}
            <div>
              <label className="block text-xs gui-text-secondary mb-1">Extract Types</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-xs gui-text">
                  <input
                    type="checkbox"
                    checked={extractionSettings.extractionTypes.includes('notes')}
                    onChange={() => handleToggleExtractionType('notes')}
                    className={`rounded gui-input text-amber-600 focus:ring-amber-500`}
                  />
                  <FileText className="w-3 h-3 text-amber-400" />
                  Notes
                </label>
                <label className="flex items-center gap-1.5 text-xs gui-text">
                  <input
                    type="checkbox"
                    checked={extractionSettings.extractionTypes.includes('tasks')}
                    onChange={() => handleToggleExtractionType('tasks')}
                    className={`rounded gui-input text-emerald-600 focus:ring-emerald-500`}
                  />
                  <CheckSquare className="w-3 h-3 text-emerald-400" />
                  Tasks
                </label>
              </div>
            </div>

            {/* Trigger mode */}
            <div>
              <label className="block text-xs gui-text-secondary mb-1">Trigger Mode</label>
              <select
                value={extractionSettings.extractionTrigger}
                onChange={(e) => onExtractionSettingsChange({ extractionTrigger: e.target.value as ExtractionSettings['extractionTrigger'] })}
                className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="on-demand">On-demand only</option>
                <option value="per-message">After each message (30s debounce)</option>
                <option value="on-close">When chat closes</option>
              </select>
            </div>

            {/* Confidence threshold */}
            <div>
              <label className="block text-xs gui-text-secondary mb-1">
                Confidence Threshold: {Math.round(extractionSettings.extractionConfidenceThreshold * 100)}%
              </label>
              <Slider
                min={50}
                max={100}
                step={5}
                value={[extractionSettings.extractionConfidenceThreshold * 100]}
                onValueChange={(values) => onExtractionSettingsChange({ extractionConfidenceThreshold: (values[0] ?? 50) / 100 })}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] gui-text-secondary mt-0.5">
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Extracted count */}
            {(data.extractedTitles?.length || 0) > 0 && (
              <div className="text-xs gui-text-secondary">
                {data.extractedTitles?.length} items extracted from this conversation
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// Project-specific fields
function ProjectFields({
  data,
  onChange
}: {
  data: ProjectNodeData
  onChange: (field: string, value: unknown) => void
}): JSX.Element {

  return (
    <>
      <div>
        <label className="block text-xs font-medium gui-text-secondary mb-1">Description</label>
        <textarea
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          rows={3}
          className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y min-h-[60px] max-h-[300px]"
        />
      </div>

      <div>
        <p className="text-xs gui-text-secondary">{data.childNodeIds.length} child nodes</p>
      </div>

      {/* Context Injection Settings */}
      <div className="pt-3 border-t gui-border">
        <p className="text-xs font-medium gui-text mb-2">Context Injection</p>

        <div className="space-y-2">
          <div>
            <label className="block text-xs gui-text-secondary mb-1">Role</label>
            <select
              value={data.contextRole || 'scope'}
              onChange={(e) => onChange('contextRole', e.target.value)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="scope">Scope (defines project context)</option>
              <option value="reference">Reference (additional info)</option>
              <option value="instruction">Instruction (AI should follow)</option>
              <option value="background">Background (contextual info)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs gui-text-secondary mb-1">Priority</label>
            <select
              value={data.contextPriority || 'medium'}
              onChange={(e) => onChange('contextPriority', e.target.value)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium (default)</option>
              <option value="high">High (always prominent)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs gui-text-secondary mb-1">Custom Label</label>
            <input
              type="text"
              value={data.contextLabel || ''}
              onChange={(e) => onChange('contextLabel', e.target.value)}
              placeholder="e.g., Project Requirements"
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </>
  )
}

// Orchestrator-specific fields
// Sortable Agent Item for drag-to-reorder
interface SortableAgentItemProps {
  agent: { nodeId: string; order: number; conditions?: OrchestratorCondition[] }
  index: number
  agentName: string
  isAgentMode: boolean
  strategy: string
  children?: React.ReactNode
}

function SortableAgentItem({
  agent,
  index,
  agentName,
  isAgentMode,
  strategy,
  children
}: SortableAgentItemProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: agent.nodeId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded p-2 bg-gray-500/5"
    >
      {/* Agent row */}
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-[var(--text-muted)]" />
        </div>
        {isAgentMode ? <Bot className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
        <span className="text-xs gui-text-primary flex-1 truncate" title={agentName}>
          {agentName}
        </span>
        <span className="text-[10px] gui-text-muted px-1.5 py-0.5 rounded bg-gray-500/20">
          {index + 1}
        </span>
      </div>

      {/* Conditions section passed as children */}
      {children}
    </div>
  )
}

function OrchestratorFields({
  data,
  onChange
}: {
  data: OrchestratorNodeData
  onChange: (field: string, value: unknown) => void
}): JSX.Element {
  const [isBudgetExpanded, setIsBudgetExpanded] = useState(false)
  const [isAgentsExpanded, setIsAgentsExpanded] = useState(false)
  const [isAddingCondition, setIsAddingCondition] = useState<number | null>(null)
  const [newConditionType, setNewConditionType] = useState('agent-succeeded')
  const [newConditionValue, setNewConditionValue] = useState('')
  const [newConditionInvert, setNewConditionInvert] = useState(false)

  const nodes = useWorkspaceStore((state) => state.nodes)

  // Drag-and-drop sensors for reordering agents
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Handle drag end for agent reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && data.connectedAgents) {
      const oldIndex = data.connectedAgents.findIndex((a) => a.nodeId === active.id)
      const newIndex = data.connectedAgents.findIndex((a) => a.nodeId === over.id)

      // Reorder the array
      const reordered = arrayMove(data.connectedAgents, oldIndex, newIndex)

      // Update order values to match new positions
      const updatedAgents = reordered.map((agent, index) => ({
        ...agent,
        order: index
      }))

      onChange('connectedAgents', updatedAgents)
    }
  }

  return (
    <>
      {/* Strategy */}
      <div>
        <label className="block text-xs font-medium gui-text-secondary mb-1">Strategy</label>
        <select
          value={data.strategy}
          onChange={(e) => onChange('strategy', e.target.value)}
          className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="sequential">→→→ Sequential — Run agents one after another</option>
          <option value="parallel">⇶ Parallel — Run agents simultaneously</option>
          <option value="conditional">➊ Conditional — Run agents based on conditions</option>
        </select>
      </div>

      {/* Failure Policy */}
      <div>
        <label className="block text-xs font-medium gui-text-secondary mb-1">Failure Policy</label>
        <select
          value={data.failurePolicy}
          onChange={(e) => onChange('failurePolicy', e.target.value)}
          className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="retry-and-continue">Retry & Continue</option>
          <option value="skip-failed">Skip Failed</option>
          <option value="abort-all">Abort All</option>
        </select>
      </div>

      {/* Max Retries */}
      <div>
        <label className="block text-xs font-medium gui-text-secondary mb-1">Max Retries</label>
        <input
          type="number"
          min="0"
          max="5"
          value={data.maxRetries ?? 2}
          onChange={(e) => onChange('maxRetries', parseInt(e.target.value, 10))}
          className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Budget Limits (collapsible) */}
      <div className="border rounded">
        <button
          onClick={() => setIsBudgetExpanded(!isBudgetExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium gui-text-secondary hover:bg-gray-500/10 transition-colors"
        >
          <span>Budget Limits</span>
          {isBudgetExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {isBudgetExpanded && (
          <div className="px-3 pb-3 space-y-3 border-t">
            <div>
              <label className="block text-xs font-medium gui-text-secondary mb-1">Max Total Tokens</label>
              <input
                type="number"
                min="0"
                value={data.budget.maxTotalTokens || ''}
                onChange={(e) => onChange('budget', { ...data.budget, maxTotalTokens: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                placeholder="Unlimited"
                className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium gui-text-secondary mb-1">Max Total Cost (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={data.budget.maxTotalCostUSD || ''}
                onChange={(e) => onChange('budget', { ...data.budget, maxTotalCostUSD: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Unlimited"
                className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Connected Agents (with drag-to-reorder) */}
      <div className="border rounded">
        <button
          onClick={() => setIsAgentsExpanded(!isAgentsExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium gui-text-secondary hover:bg-gray-500/10 transition-colors"
        >
          <span>Connected Agents ({data.connectedAgents?.length || 0})</span>
          {isAgentsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {isAgentsExpanded && (
          <div className="border-t px-3 pb-3">
            {data.connectedAgents && data.connectedAgents.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={data.connectedAgents.map((a) => a.nodeId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 mt-2">
                    {data.connectedAgents
                      .sort((a, b) => a.order - b.order)
                      .map((agent, index) => {
                        const agentNode = nodes.find((n) => n.id === agent.nodeId)
                        const agentName = agentNode?.data.title || 'Unknown Agent'
                        const isAgentMode = agentNode?.type === 'conversation' && agentNode.data.mode === 'agent'

                        return (
                          <SortableAgentItem
                            key={agent.nodeId}
                            agent={agent}
                            index={index}
                            agentName={agentName}
                            isAgentMode={isAgentMode}
                            strategy={data.strategy}
                          >
                            {/* Conditions (only for conditional strategy) */}
                            {data.strategy === 'conditional' && (
                              <div className="mt-2 pl-5 space-y-1">
                                {agent.conditions && agent.conditions.length > 0 ? (
                                  agent.conditions.map((cond, condIndex) => (
                                    <div key={condIndex} className="text-[10px] gui-text-secondary flex items-start gap-1">
                                      <span className="font-semibold flex items-center gap-1">
                                        {cond.invert && 'NOT '}
                                        {cond.type === 'agent-succeeded' && (
                                          <>
                                            <CheckCircle className="w-3 h-3 text-green-500 inline-block" />
                                            <span>Prev succeeded</span>
                                          </>
                                        )}
                                        {cond.type === 'agent-failed' && (
                                          <>
                                            <XCircle className="w-3 h-3 text-red-500 inline-block" />
                                            <span>Prev failed</span>
                                          </>
                                        )}
                                        {cond.type === 'output-contains' && (
                                          <>
                                            <FileText className="w-3 h-3 text-blue-500 inline-block" />
                                            <span>Output contains "{cond.value}"</span>
                                          </>
                                        )}
                                        {cond.type === 'output-matches' && (
                                          <>
                                            <Search className="w-3 h-3 text-gray-500 inline-block" />
                                            <span>Output matches /{cond.value}/</span>
                                          </>
                                        )}
                                        {cond.type === 'token-count-below' && (
                                          <>
                                            <BarChart3 className="w-3 h-3 text-purple-500 inline-block" />
                                            <span>Tokens &lt; {cond.value}</span>
                                          </>
                                        )}
                                      </span>
                                      <button
                                        onClick={() => {
                                          const updatedAgents = [...data.connectedAgents!]
                                          updatedAgents[index].conditions = agent.conditions!.filter((_, i) => i !== condIndex)
                                          onChange('connectedAgents', updatedAgents)
                                        }}
                                        className="ml-auto p-0.5 hover:bg-red-500/20 rounded"
                                        title="Delete condition"
                                        aria-label="Delete condition"
                                      >
                                        <Trash2 className="w-2.5 h-2.5 text-red-500" />
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] gui-text-muted italic">No conditions — always runs</p>
                                )}

                                {/* Add Condition */}
                                {isAddingCondition === index ? (
                                  <div className="mt-2 p-2 border rounded bg-gray-500/10 space-y-2">
                                    <select
                                      value={newConditionType}
                                      onChange={(e) => setNewConditionType(e.target.value)}
                                      className="w-full gui-input border rounded px-2 py-1 text-xs"
                                    >
                                      <option value="agent-succeeded">Previous agent succeeded</option>
                                      <option value="agent-failed">Previous agent failed</option>
                                      <option value="output-contains">Output contains text</option>
                                      <option value="output-matches">Output matches regex</option>
                                      <option value="token-count-below">Token count below threshold</option>
                                    </select>

                                    {(newConditionType === 'output-contains' ||
                                      newConditionType === 'output-matches' ||
                                      newConditionType === 'token-count-below') && (
                                      <input
                                        type={newConditionType === 'token-count-below' ? 'number' : 'text'}
                                        placeholder={
                                          newConditionType === 'token-count-below'
                                            ? 'e.g., 5000'
                                            : newConditionType === 'output-matches'
                                            ? 'e.g., error|failed'
                                            : 'e.g., success'
                                        }
                                        value={newConditionValue}
                                        onChange={(e) => setNewConditionValue(e.target.value)}
                                        className="w-full gui-input border rounded px-2 py-1 text-xs"
                                      />
                                    )}

                                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={newConditionInvert}
                                        onChange={(e) => setNewConditionInvert(e.target.checked)}
                                        className="w-3 h-3"
                                      />
                                      <span className="gui-text-secondary">NOT (invert condition)</span>
                                    </label>

                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          const needsValue =
                                            newConditionType === 'output-contains' ||
                                            newConditionType === 'output-matches' ||
                                            newConditionType === 'token-count-below'

                                          if (needsValue && !newConditionValue.trim()) return

                                          const newCond: OrchestratorCondition = {
                                            id: crypto.randomUUID(),
                                            type: newConditionType as OrchestratorConditionType,
                                            ...(needsValue && { value: newConditionValue }),
                                            invert: newConditionInvert
                                          }

                                          const updatedAgents = [...data.connectedAgents!]
                                          updatedAgents[index].conditions = [
                                            ...(updatedAgents[index].conditions || []),
                                            newCond
                                          ]
                                          onChange('connectedAgents', updatedAgents)

                                          setIsAddingCondition(null)
                                          setNewConditionType('agent-succeeded')
                                          setNewConditionValue('')
                                          setNewConditionInvert(false)
                                        }}
                                        className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30"
                                        aria-label="Save condition"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setIsAddingCondition(null)
                                          setNewConditionType('agent-succeeded')
                                          setNewConditionValue('')
                                          setNewConditionInvert(false)
                                        }}
                                        className="px-2 py-1 rounded text-xs gui-text-secondary hover:bg-gray-500/10"
                                        aria-label="Cancel adding condition"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setIsAddingCondition(index)}
                                    className="text-[10px] text-blue-400 hover:underline mt-1"
                                    aria-label="Add condition to agent"
                                  >
                                    + Add Condition
                                  </button>
                                )}

                                <p className="text-[10px] gui-text-muted italic mt-1">
                                  ℹ️ All conditions must be true
                                </p>
                              </div>
                            )}
                          </SortableAgentItem>
                        )
                      })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-xs gui-text-muted italic mt-2">
                No agents connected. Draw edges from this orchestrator to agent-mode conversation nodes.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Stub disclosure */}
      <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/30">
        <p className="text-xs gui-text-muted italic flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <span>
            Orchestrator execution engine is under active development.
            Connected agents can be triggered individually via their own run controls.
          </span>
        </p>
      </div>
    </>
  )
}

// Note-specific fields
function NoteFields({
  data,
  onChange,
  hiddenProperties,
  onToggleHidden
}: {
  data: NoteNodeData
  onChange: (field: string, value: unknown) => void
  hiddenProperties?: string[]
  onToggleHidden?: (propertyId: string) => void
}): JSX.Element {

  // Word count - strip HTML tags first
  const wordCount = data.content
    ? data.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter((w) => w.length > 0).length
    : 0

  return (
    <>
      <div className="group">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium gui-text-secondary">Content</label>
          {onToggleHidden && (
            <button
              onClick={() => onToggleHidden('content')}
              className={`p-1 ${hiddenProperties?.includes('content') ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'} gui-button rounded transition-all`}
              title={hiddenProperties?.includes('content') ? 'Show on node' : 'Hide from node'}
            >
              {hiddenProperties?.includes('content') ? <EyeOff className="w-3 h-3 gui-text-secondary" /> : <Eye className="w-3 h-3 gui-text-secondary" />}
            </button>
          )}
        </div>
        <div className="rounded border gui-border overflow-hidden">
          <RichTextEditor
            value={data.content || ''}
            onChange={(html) => onChange('content', html)}
            placeholder="Write your note here..."
            enableLists={true}
            enableFormatting={true}
            enableHeadings={false}
            showToolbar="on-focus"
            minHeight={120}
          />
        </div>
        <p className="text-xs gui-text-secondary mt-1">{wordCount} words</p>
      </div>

      {/* Context Injection Settings */}
      <div className="pt-3 border-t gui-border">
        <p className="text-xs font-medium gui-text mb-2">
          Context Injection
          <HelpTooltip text="Controls how this note's content is presented to AI when connected to a conversation" />
        </p>

        <div className="space-y-2">
          <div>
            <label className="block text-xs gui-text-secondary mb-1">
              Role
              <HelpTooltip text="How the AI interprets this content: Reference (info), Instruction (rules to follow), Example (format guide), Background (context)" />
            </label>
            <select
              value={data.contextRole || 'reference'}
              onChange={(e) => onChange('contextRole', e.target.value)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="reference">Reference (default)</option>
              <option value="instruction">Instruction (AI should follow)</option>
              <option value="example">Example (format/style guide)</option>
              <option value="background">Background (contextual info)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs gui-text-secondary mb-1">
              Priority
              <HelpTooltip text="High priority content appears prominently in context. Low priority may be truncated if context limit reached." />
            </label>
            <select
              value={data.contextPriority || 'medium'}
              onChange={(e) => onChange('contextPriority', e.target.value)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="low">Low (included if relevant)</option>
              <option value="medium">Medium (default)</option>
              <option value="high">High (always prominent)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs gui-text-secondary mb-1">
              Custom Label
              <HelpTooltip text="A descriptive label shown to the AI (e.g., 'Style Guide'). Helps AI understand what this content is for." />
            </label>
            <input
              type="text"
              value={data.contextLabel || ''}
              onChange={(e) => onChange('contextLabel', e.target.value)}
              placeholder="e.g., Code Style Guide"
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </>
  )
}

// Text-specific fields (minimal - just content editor)
function TextFields({
  data,
  onChange
}: {
  data: TextNodeData
  onChange: (field: string, value: unknown) => void
}): JSX.Element {
  // Word count - strip HTML tags first
  const wordCount = data.content
    ? data.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter((w) => w.length > 0).length
    : 0

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium gui-text-secondary">Content</label>
      </div>
      <div className="rounded border gui-border overflow-hidden">
        <RichTextEditor
          value={data.content || ''}
          onChange={(html) => onChange('content', html)}
          placeholder="Type here..."
          enableLists={true}
          enableFormatting={true}
          enableHeadings={true}
          enableAlignment={true}
          showToolbar="on-focus"
          minHeight={120}
        />
      </div>
      <p className="text-xs gui-text-secondary mt-1">{wordCount} words</p>
    </div>
  )
}

// Task-specific fields
function TaskFields({
  data,
  onChange,
  onAddOption,
  hiddenProperties,
  onToggleHidden
}: {
  data: TaskNodeData
  onChange: (field: string, value: unknown) => void
  onAddOption: (propertyId: string, option: { label: string; color?: string }) => void
  hiddenProperties?: string[]
  onToggleHidden?: (propertyId: string) => void
}): JSX.Element {
  const [isEstimating, setIsEstimating] = useState(false)

  // Get property definitions for status, priority, and complexity
  const statusDef = BUILTIN_PROPERTIES.status!
  const priorityDef = BUILTIN_PROPERTIES.priority!
  const complexityDef = BUILTIN_PROPERTIES.complexity!

  // AI complexity estimation
  const handleAiEstimateComplexity = useCallback(async () => {
    if (isEstimating || !data.description) return
    setIsEstimating(true)
    try {
      const result = await window.api.llm.extract({
        systemPrompt: 'You are a task complexity estimator. Given a task description, estimate its complexity as one of: simple, moderate, complex. Respond with ONLY one of these three words, nothing else.',
        userPrompt: `Estimate the complexity of this task:\n\n${data.title || ''}\n${data.description}`,
        model: 'claude-sonnet-4-20250514',
        maxTokens: 10
      })
      if (result.success && result.data) {
        const complexity = result.data.trim().toLowerCase()
        if (['simple', 'moderate', 'complex'].includes(complexity)) {
          onChange('complexity', complexity)
        }
      }
    } catch (err) {
      console.error('Failed to estimate complexity:', err)
    } finally {
      setIsEstimating(false)
    }
  }, [isEstimating, data.description, data.title, onChange])

  return (
    <>
      <div className="group">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium gui-text-secondary">Content</label>
          {onToggleHidden && (
            <button
              onClick={() => onToggleHidden('description')}
              className={`p-1 ${hiddenProperties?.includes('description') ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'} gui-button rounded transition-all`}
              title={hiddenProperties?.includes('description') ? 'Show on node' : 'Hide from node'}
            >
              {hiddenProperties?.includes('description') ? <EyeOff className="w-3 h-3 gui-text-secondary" /> : <Eye className="w-3 h-3 gui-text-secondary" />}
            </button>
          )}
        </div>
        <div className="rounded border gui-border overflow-hidden">
          <RichTextEditor
            value={data.description || ''}
            onChange={(html) => onChange('description', html)}
            placeholder="Add content..."
            enableLists={true}
            enableFormatting={true}
            enableHeadings={false}
            showToolbar="on-focus"
            minHeight={60}
          />
        </div>
      </div>

      <div className="group">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium gui-text-secondary">Status</label>
          {onToggleHidden && (
            <button
              onClick={() => onToggleHidden('status')}
              className={`p-1 ${hiddenProperties?.includes('status') ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'} gui-button rounded transition-all`}
              title={hiddenProperties?.includes('status') ? 'Show on node' : 'Hide from node'}
            >
              {hiddenProperties?.includes('status') ? <EyeOff className="w-3 h-3 gui-text-secondary" /> : <Eye className="w-3 h-3 gui-text-secondary" />}
            </button>
          )}
        </div>
        <PropertyInput
          definition={statusDef}
          value={data.status}
          onChange={(value) => onChange('status', value)}
          onAddOption={(opt) => onAddOption('status', opt)}
          showEditButton={true}
        />
      </div>

      <div className="group">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium gui-text-secondary">Priority</label>
          {onToggleHidden && (
            <button
              onClick={() => onToggleHidden('priority')}
              className={`p-1 ${hiddenProperties?.includes('priority') ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'} gui-button rounded transition-all`}
              title={hiddenProperties?.includes('priority') ? 'Show on node' : 'Hide from node'}
            >
              {hiddenProperties?.includes('priority') ? <EyeOff className="w-3 h-3 gui-text-secondary" /> : <Eye className="w-3 h-3 gui-text-secondary" />}
            </button>
          )}
        </div>
        <PropertyInput
          definition={priorityDef}
          value={data.priority}
          onChange={(value) => onChange('priority', value)}
          onAddOption={(opt) => onAddOption('priority', opt)}
          showEditButton={true}
        />
      </div>

      <div className="group">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium gui-text-secondary">Complexity</label>
          {onToggleHidden && (
            <button
              onClick={() => onToggleHidden('complexity')}
              className={`p-1 ${hiddenProperties?.includes('complexity') ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'} gui-button rounded transition-all`}
              title={hiddenProperties?.includes('complexity') ? 'Show on node' : 'Hide from node'}
            >
              {hiddenProperties?.includes('complexity') ? <EyeOff className="w-3 h-3 gui-text-secondary" /> : <Eye className="w-3 h-3 gui-text-secondary" />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <PropertyInput
              definition={complexityDef}
              value={data.complexity || 'moderate'}
              onChange={(value) => onChange('complexity', value)}
              onAddOption={(opt) => onAddOption('complexity', opt)}
              showEditButton={true}
            />
          </div>
          <button
            onClick={handleAiEstimateComplexity}
            disabled={isEstimating || !data.description}
            className={`p-1.5 rounded transition-colors ${
              isEstimating ? 'animate-pulse text-purple-400' :
              !data.description ? 'opacity-30 cursor-not-allowed gui-text-secondary' :
              'gui-button gui-text-secondary hover:text-purple-400'
            }`}
            title={!data.description ? 'Add a description first' : 'AI estimate complexity'}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  )
}

// Artifact-specific fields
function ArtifactFields({
  nodeId,
  data,
  onChange
}: {
  nodeId: string
  data: ArtifactNodeData
  onChange: (field: string, value: unknown) => void
}): JSX.Element {
  const [isFilesExpanded, setIsFilesExpanded] = useState(false)
  const [newFileName, setNewFileName] = useState('')

  const isMultiFile = data.files && data.files.length > 0
  const files = data.files || []
  const firstFile = files[0]
  const activeFileId = data.activeFileId || (firstFile ? firstFile.id : undefined)
  const activeFile = files.find(f => f.id === activeFileId)

  // For single-file mode, use root content; for multi-file, use active file
  const currentContent = isMultiFile && activeFile ? activeFile.content : data.content
  const currentContentType = isMultiFile && activeFile ? activeFile.contentType : data.contentType
  const currentLanguage = isMultiFile && activeFile ? activeFile.language : data.language

  const lineCount = currentContent ? currentContent.split('\n').length : 0
  const charCount = currentContent ? currentContent.length : 0

  // Get source description
  const getSourceDescription = (): string => {
    switch (data.source.type) {
      case 'file-drop':
        return `Dropped: ${data.source.filename}`
      case 'llm-response':
        return `From conversation`
      case 'url':
        return `URL: ${data.source.url}`
      case 'created':
        return data.source.method === 'manual' ? 'Created manually' : 'Auto-extracted'
    }
  }

  // Convert to multi-file mode
  const handleConvertToMultiFile = (): void => {
    const newFile: ArtifactFile = {
      id: `file-${Date.now()}`,
      filename: data.title || 'main',
      content: data.content,
      contentType: data.contentType,
      customContentType: data.customContentType,
      language: data.language,
      order: 0
    }
    onChange('files', [newFile])
    onChange('activeFileId', newFile.id)
  }

  // Add a new file
  const handleAddFile = (): void => {
    if (!newFileName.trim()) return

    const newFile: ArtifactFile = {
      id: `file-${Date.now()}`,
      filename: newFileName.trim(),
      content: '',
      contentType: 'text',
      order: files.length
    }

    onChange('files', [...files, newFile])
    onChange('activeFileId', newFile.id)
    setNewFileName('')
  }

  // Delete a file
  const handleDeleteFile = (fileId: string): void => {
    const newFiles = files.filter(f => f.id !== fileId)
    onChange('files', newFiles)

    // If we deleted the active file, select another
    const remainingFirstFile = newFiles[0]
    if (activeFileId === fileId && remainingFirstFile) {
      onChange('activeFileId', remainingFirstFile.id)
    }

    // If no files left, convert back to single-file mode
    if (newFiles.length === 0) {
      onChange('files', undefined)
      onChange('activeFileId', undefined)
    }
  }

  // Update a file property
  const handleUpdateFile = (fileId: string, updates: Partial<ArtifactFile>): void => {
    const newFiles = files.map(f => f.id === fileId ? { ...f, ...updates } : f)
    onChange('files', newFiles)
  }

  // Handle content type change for the current active file or root
  const handleContentTypeChange = (value: string): void => {
    if (isMultiFile && activeFile) {
      handleUpdateFile(activeFile.id, { contentType: value as ArtifactContentType })
    } else {
      onChange('contentType', value)
    }
  }

  // Handle language change
  const handleLanguageChange = (value: string): void => {
    if (isMultiFile && activeFile) {
      handleUpdateFile(activeFile.id, { language: value || undefined })
    } else {
      onChange('language', value || undefined)
    }
  }

  return (
    <>
      {/* Multi-file Management Section */}
      <div className="pt-3 border-t gui-border">
        <button
          onClick={() => setIsFilesExpanded(!isFilesExpanded)}
          className="flex items-center gap-2 text-xs font-medium gui-text mb-2 w-full"
        >
          {isFilesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Files className="w-3.5 h-3.5 text-cyan-400" />
          Files
          {isMultiFile && (
            <span className="ml-auto px-1.5 py-0.5 bg-cyan-600/30 text-cyan-300 rounded text-[10px]">
              {files.length}
            </span>
          )}
        </button>

        {isFilesExpanded && (
          <div className="space-y-2 pl-5">
            {!isMultiFile ? (
              <button
                onClick={handleConvertToMultiFile}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 gui-card gui-text gui-button rounded text-xs transition-colors"
              >
                <Plus className="w-3 h-3" />
                Convert to Multi-file
              </button>
            ) : (
              <>
                {/* File list */}
                <div className="space-y-1">
                  {files.sort((a, b) => a.order - b.order).map((file) => (
                    <div
                      key={file.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                        activeFileId === file.id
                          ? 'gui-panel-secondary gui-text'
                          : 'gui-text-secondary gui-button'
                      }`}
                    >
                      <GripVertical className="w-3 h-3 gui-text-secondary cursor-grab" />
                      <button
                        onClick={() => onChange('activeFileId', file.id)}
                        className="flex-1 text-left truncate"
                      >
                        {file.filename}
                      </button>
                      <span className="text-[10px] gui-text-secondary">{file.contentType}</span>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-0.5 hover:text-red-400 transition-colors"
                        title="Delete file"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add file input */}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="filename.ext"
                    className="flex-1 gui-input border rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddFile()}
                  />
                  <button
                    onClick={handleAddFile}
                    disabled={!newFileName.trim()}
                    className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white rounded text-xs transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Active file name editor */}
                {activeFile && (
                  <div>
                    <label className="block text-xs gui-text-secondary mb-1">Selected File Name</label>
                    <input
                      type="text"
                      value={activeFile.filename}
                      onChange={(e) => handleUpdateFile(activeFile.id, { filename: e.target.value })}
                      className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Content Type */}
      <div>
        <label className="block text-xs font-medium gui-text-secondary mb-1">
          Content Type {isMultiFile && activeFile && <span className="gui-text-secondary">({activeFile.filename})</span>}
        </label>
        <select
          value={currentContentType}
          onChange={(e) => handleContentTypeChange(e.target.value)}
          className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="code">Code</option>
          <option value="markdown">Markdown</option>
          <option value="html">HTML</option>
          <option value="svg">SVG</option>
          <option value="mermaid">Mermaid Diagram</option>
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="text">Plain Text</option>
          <option value="image">Image</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Custom Content Type Input */}
      {currentContentType === 'custom' && (
        <div>
          <label className="block text-xs font-medium gui-text-secondary mb-1">Custom Type Name</label>
          <input
            type="text"
            value={isMultiFile && activeFile ? activeFile.customContentType || '' : data.customContentType || ''}
            onChange={(e) => {
              if (isMultiFile && activeFile) {
                handleUpdateFile(activeFile.id, { customContentType: e.target.value })
              } else {
                onChange('customContentType', e.target.value)
              }
            }}
            placeholder="e.g., schema, config, template..."
            className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Language (for code) */}
      {currentContentType === 'code' && (
        <div>
          <label className="block text-xs font-medium gui-text-secondary mb-1">Language</label>
          <select
            value={currentLanguage || ''}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">Auto-detect</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="rust">Rust</option>
            <option value="go">Go</option>
            <option value="java">Java</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="csharp">C#</option>
            <option value="php">PHP</option>
            <option value="ruby">Ruby</option>
            <option value="swift">Swift</option>
            <option value="kotlin">Kotlin</option>
            <option value="sql">SQL</option>
            <option value="shell">Shell/Bash</option>
            <option value="yaml">YAML</option>
            <option value="toml">TOML</option>
            <option value="css">CSS</option>
            <option value="scss">SCSS</option>
          </select>
        </div>
      )}

      {/* Stats */}
      <div className="text-xs gui-text-secondary">
        {isMultiFile ? (
          <>
            {files.length} files · {activeFile ? `${lineCount} lines in ${activeFile.filename}` : 'No file selected'}
          </>
        ) : (
          <>{lineCount} lines · {charCount} characters</>
        )}
      </div>

      {/* Source info */}
      <div className="text-xs gui-text-secondary">
        Source: {getSourceDescription()}
      </div>

      {/* Injection Format */}
      <div className="pt-3 border-t gui-border">
        <p className="text-xs font-medium gui-text mb-2">Context Injection</p>

        <div className="space-y-2">
          <div>
            <label className="block text-xs gui-text-secondary mb-1">Injection Format</label>
            <select
              value={data.injectionFormat}
              onChange={(e) => onChange('injectionFormat', e.target.value)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="full">Full (complete content)</option>
              <option value="summary">Summary (truncated)</option>
              <option value="chunked">Chunked (paginated)</option>
              <option value="reference-only">Reference Only (title only)</option>
            </select>
          </div>

          {data.injectionFormat === 'chunked' && (
            <div>
              <label className="block text-xs gui-text-secondary mb-1">Max Tokens</label>
              <input
                type="number"
                value={data.maxInjectionTokens || 2000}
                onChange={(e) => onChange('maxInjectionTokens', parseInt(e.target.value) || 2000)}
                min={100}
                max={10000}
                step={100}
                className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs gui-text-secondary mb-1">
              Context Role
              <HelpTooltip text="How AI should treat this content: Reference = documentation to use, Example = format/style to follow, Instruction = commands to obey, Background = supporting context." />
            </label>
            <select
              value={data.contextRole || 'reference'}
              onChange={(e) => onChange('contextRole', e.target.value)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="reference">Reference (code to use)</option>
              <option value="example">Example (format/style)</option>
              <option value="instruction">Instruction (follow this)</option>
              <option value="background">Background (context)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs gui-text-secondary mb-1">
              Context Priority
              <HelpTooltip text="How important this content is when building AI context. High priority content is included first when token budget is limited. Low priority content may be truncated." />
            </label>
            <select
              value={data.contextPriority || 'medium'}
              onChange={(e) => onChange('contextPriority', e.target.value)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Versioning */}
      <div className="pt-3 border-t gui-border">
        <p className="text-xs font-medium gui-text mb-2">Versioning</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs gui-text-secondary">Current Version</span>
            <span className="text-xs text-cyan-400">v{data.version}</span>
          </div>

          <div>
            <label className="block text-xs gui-text-secondary mb-1">Update Mode</label>
            <select
              value={data.versioningMode}
              onChange={(e) => onChange('versioningMode', e.target.value)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="update">Update in place (keep history)</option>
              <option value="fork">Fork (create new node)</option>
            </select>
          </div>

          {data.versionHistory.length > 0 && (
            <div className="text-xs gui-text-secondary">
              {data.versionHistory.length} version{data.versionHistory.length !== 1 ? 's' : ''} in history
            </div>
          )}
        </div>
      </div>

      {/* Display Settings */}
      <div className="pt-3 border-t gui-border">
        <p className="text-xs font-medium gui-text mb-2">Display</p>

        <div className="space-y-2">
          <div>
            <label className="block text-xs gui-text-secondary mb-1">Preview Lines</label>
            <input
              type="number"
              value={data.previewLines}
              onChange={(e) => onChange('previewLines', parseInt(e.target.value) || 10)}
              min={1}
              max={50}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="artifact-collapsed"
              checked={data.collapsed}
              onChange={(e) => onChange('collapsed', e.target.checked)}
              className="rounded gui-input"
            />
            <label htmlFor="artifact-collapsed" className="text-xs gui-text-secondary">
              Collapsed by default
            </label>
          </div>
        </div>
      </div>

      {/* Version History */}
      <VersionHistoryPanel nodeId={nodeId} data={data} />
    </>
  )
}

// Workspace-specific fields
function WorkspaceFields({
  nodeId,
  data,
  onChange
}: {
  nodeId: string
  data: WorkspaceNodeData
  onChange: (field: string, value: unknown) => void
}): JSX.Element {
  const [isMembersExpanded, setIsMembersExpanded] = useState(false)
  const [isLLMExpanded, setIsLLMExpanded] = useState(true)
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const [isThemeExpanded, setIsThemeExpanded] = useState(false)

  const nodes = useWorkspaceStore((state) => state.nodes)
  const selectedNodeIds = useWorkspaceStore((state) => state.selectedNodeIds)
  const addNodesToWorkspace = useWorkspaceStore((state) => state.addNodesToWorkspace)
  const removeNodesFromWorkspace = useWorkspaceStore((state) => state.removeNodesFromWorkspace)
  const excludeNodesFromWorkspace = useWorkspaceStore((state) => state.excludeNodesFromWorkspace)
  const includeNodesInWorkspace = useWorkspaceStore((state) => state.includeNodesInWorkspace)
  const updateWorkspaceLLMSettings = useWorkspaceStore((state) => state.updateWorkspaceLLMSettings)
  const updateWorkspaceContextRules = useWorkspaceStore((state) => state.updateWorkspaceContextRules)

  // Get member nodes (actual node objects)
  const memberNodes = useMemo(() => {
    const included = data.includedNodeIds ?? []
    const excluded = data.excludedNodeIds ?? []
    return included
      .filter((id) => !excluded.includes(id))
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean)
  }, [data.includedNodeIds, data.excludedNodeIds, nodes])

  const excludedNodes = useMemo(() => {
    const excluded = data.excludedNodeIds ?? []
    return excluded
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean)
  }, [data.excludedNodeIds, nodes])

  // Get selectable nodes (not already in this workspace)
  const selectableForAdd = useMemo(() => {
    const included = data.includedNodeIds ?? []
    return selectedNodeIds.filter(
      (id) =>
        id !== nodeId &&
        !included.includes(id) &&
        nodes.find((n) => n.id === id)?.data.type !== 'workspace'
    )
  }, [selectedNodeIds, nodeId, data.includedNodeIds, nodes])

  const handleAddSelected = (): void => {
    if (selectableForAdd.length > 0) {
      addNodesToWorkspace(nodeId, selectableForAdd)
    }
  }

  const handleAddAll = (): void => {
    const allNonWorkspaceNodes = nodes
      .filter((n) => n.data.type !== 'workspace' && n.id !== nodeId)
      .map((n) => n.id)
    addNodesToWorkspace(nodeId, allNonWorkspaceNodes)
  }

  const handleRemoveAll = (): void => {
    removeNodesFromWorkspace(nodeId, data.includedNodeIds ?? [])
  }

  const handleLLMSettingsChange = (key: keyof WorkspaceLLMSettings, value: unknown): void => {
    updateWorkspaceLLMSettings(nodeId, { [key]: value })
  }

  const handleContextRulesChange = (key: keyof WorkspaceContextRules, value: unknown): void => {
    updateWorkspaceContextRules(nodeId, { [key]: value })
  }

  return (
    <>
      {/* Description */}
      <div>
        <label className="block text-xs font-medium gui-text-secondary mb-1">Description</label>
        <textarea
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          rows={2}
          placeholder="What is this workspace for?"
          className="w-full gui-input border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y min-h-[60px] max-h-[300px]"
        />
      </div>

      {/* Visibility Settings */}
      <div className="pt-3 border-t gui-border">
        <p className="text-xs font-medium gui-text mb-2">Visibility</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {data.showOnCanvas ? (
                <Eye className="w-4 h-4 gui-text-secondary" />
              ) : (
                <EyeOff className="w-4 h-4 gui-text-secondary" />
              )}
              <span className="text-xs gui-text">Show on Canvas</span>
            </div>
            <button
              onClick={() => onChange('showOnCanvas', !data.showOnCanvas)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                data.showOnCanvas ? 'bg-violet-600' : 'gui-panel-secondary'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  data.showOnCanvas ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {data.showLinks ? (
                <Link2 className="w-4 h-4" style={{ color: data.linkColor }} />
              ) : (
                <Link2Off className="w-4 h-4 gui-text-secondary" />
              )}
              <span className="text-xs gui-text">Show Member Links</span>
            </div>
            <button
              onClick={() => onChange('showLinks', !data.showLinks)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                data.showLinks ? 'bg-violet-600' : 'gui-panel-secondary'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  data.showLinks ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Link Color */}
          {data.showLinks && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-xs gui-text-secondary">Link Color</span>
              <input
                type="color"
                value={data.linkColor || '#ef4444'}
                onChange={(e) => onChange('linkColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer bg-transparent"
              />
            </div>
          )}

          {/* Link Direction */}
          {data.showLinks && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-xs gui-text-secondary">Link Direction</span>
              <select
                value={data.linkDirection || 'to-members'}
                onChange={(e) => onChange('linkDirection', e.target.value as 'to-members' | 'from-members' | 'bidirectional')}
                className="gui-input text-xs rounded px-2 py-1 focus:ring-1 focus:ring-red-500 focus:border-red-500"
              >
                <option value="to-members">To Members →</option>
                <option value="from-members">From Members ←</option>
                <option value="bidirectional">Bidirectional ↔</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Members Section */}
      <div className="pt-3 border-t gui-border">
        <button
          onClick={() => setIsMembersExpanded(!isMembersExpanded)}
          className="flex items-center gap-2 text-xs font-medium gui-text mb-2 w-full"
        >
          {isMembersExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Users className="w-3.5 h-3.5 text-violet-400" />
          Members
          <span className="ml-auto px-1.5 py-0.5 bg-violet-600/30 text-violet-300 rounded text-[10px]">
            {memberNodes.length}
          </span>
        </button>

        {isMembersExpanded && (
          <div className="space-y-2 pl-5">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={handleAddSelected}
                disabled={selectableForAdd.length === 0}
                className="px-2 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded text-xs transition-colors"
              >
                Add Selected ({selectableForAdd.length})
              </button>
              <button
                onClick={handleAddAll}
                className="px-2 py-1 gui-panel-secondary gui-button gui-text rounded text-xs transition-colors"
              >
                Add All
              </button>
              <button
                onClick={handleRemoveAll}
                disabled={(data.includedNodeIds ?? []).length === 0}
                className="px-2 py-1 gui-panel-secondary gui-button disabled:opacity-40 gui-text rounded text-xs transition-colors"
              >
                Remove All
              </button>
            </div>

            {/* Member list */}
            {memberNodes.length > 0 ? (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {memberNodes.map((node) => (
                  <div
                    key={node!.id}
                    className="flex items-center justify-between px-2 py-1 gui-panel-secondary rounded text-xs"
                  >
                    <span className="gui-text truncate flex-1">{node!.data.title as string}</span>
                    <span className="gui-text-secondary text-[10px] mx-2">{node!.data.type}</span>
                    <button
                      onClick={() => excludeNodesFromWorkspace(nodeId, [node!.id])}
                      className="gui-text-secondary hover:text-amber-400"
                      title="Exclude from workspace"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs gui-text-secondary italic">No members yet. Select nodes and click "Add Selected".</p>
            )}

            {/* Excluded nodes */}
            {excludedNodes.length > 0 && (
              <>
                <p className="text-xs gui-text-secondary mt-2">Excluded ({excludedNodes.length})</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {excludedNodes.map((node) => (
                    <div
                      key={node!.id}
                      className="flex items-center justify-between px-2 py-1 gui-panel-secondary rounded text-xs opacity-60"
                    >
                      <span className="gui-text-secondary truncate flex-1">{node!.data.title as string}</span>
                      <button
                        onClick={() => includeNodesInWorkspace(nodeId, [node!.id])}
                        className="gui-text-secondary hover:text-emerald-400"
                        title="Re-include in workspace"
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* LLM Settings Section */}
      <div className="pt-3 border-t gui-border">
        <button
          onClick={() => setIsLLMExpanded(!isLLMExpanded)}
          className="flex items-center gap-2 text-xs font-medium gui-text mb-2 w-full"
        >
          {isLLMExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Bot className="w-3.5 h-3.5 text-violet-400" />
          LLM Defaults
          {!isLLMExpanded && (() => {
            const customItems: string[] = []
            if (data.llmSettings.provider !== 'anthropic') customItems.push(data.llmSettings.provider)
            if (data.llmSettings.model) customItems.push('model')
            if (data.llmSettings.systemPrompt) customItems.push('prompt')
            if (data.llmSettings.temperature !== undefined && data.llmSettings.temperature !== 0.7) customItems.push(`t=${data.llmSettings.temperature}`)
            return customItems.length > 0 ? (
              <span className="ml-auto px-1.5 py-0.5 bg-violet-600/30 text-violet-300 rounded text-[10px]" title={customItems.join(', ')}>
                {customItems.slice(0, 2).join(', ')}{customItems.length > 2 ? '...' : ''}
              </span>
            ) : null
          })()}
        </button>

        {isLLMExpanded && (
          <div className="space-y-2 pl-5">
            <div>
              <label className="block text-xs gui-text-secondary mb-1">Provider</label>
              <select
                value={data.llmSettings.provider}
                onChange={(e) => handleLLMSettingsChange('provider', e.target.value)}
                className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="gemini">Google (Gemini)</option>
                <option value="openai">OpenAI (GPT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs gui-text-secondary mb-1">Model (optional)</label>
              <input
                type="text"
                value={data.llmSettings.model || ''}
                onChange={(e) => handleLLMSettingsChange('model', e.target.value || undefined)}
                placeholder="e.g., claude-3-opus"
                className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs gui-text-secondary mb-1">
                Temperature: {data.llmSettings.temperature ?? 0.7}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={(data.llmSettings.temperature ?? 0.7) * 100}
                onChange={(e) => handleLLMSettingsChange('temperature', parseInt(e.target.value) / 100)}
                className="w-full h-1.5 gui-panel-secondary rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs gui-text-secondary mb-1">Max Tokens</label>
              <input
                type="number"
                value={data.llmSettings.maxTokens ?? 4096}
                onChange={(e) => handleLLMSettingsChange('maxTokens', parseInt(e.target.value) || 4096)}
                min={256}
                max={128000}
                step={256}
                className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs gui-text-secondary mb-1">System Prompt (optional)</label>
              <textarea
                value={data.llmSettings.systemPrompt || ''}
                onChange={(e) => handleLLMSettingsChange('systemPrompt', e.target.value || undefined)}
                rows={3}
                placeholder="Custom system prompt for all conversations in this workspace..."
                className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 resize-y min-h-[60px] max-h-[300px]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Context Rules Section */}
      <div className="pt-3 border-t gui-border">
        <button
          onClick={() => setIsContextExpanded(!isContextExpanded)}
          className="flex items-center gap-2 text-xs font-medium gui-text mb-2 w-full"
        >
          {isContextExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Compass className="w-3.5 h-3.5 text-violet-400" />
          Context Rules
          {!isContextExpanded && (() => {
            const customItems: string[] = []
            if (data.contextRules.maxTokens !== 8000) customItems.push(`${Math.round(data.contextRules.maxTokens / 1000)}k tokens`)
            if (data.contextRules.maxDepth !== 2) customItems.push(`depth ${data.contextRules.maxDepth}`)
            if (data.contextRules.traversalMode !== 'all') customItems.push(data.contextRules.traversalMode)
            if (data.contextRules.includeDisabledNodes) customItems.push('+disabled')
            return customItems.length > 0 ? (
              <span className="ml-auto px-1.5 py-0.5 bg-violet-600/30 text-violet-300 rounded text-[10px]" title={customItems.join(', ')}>
                {customItems.slice(0, 2).join(', ')}{customItems.length > 2 ? '...' : ''}
              </span>
            ) : null
          })()}
        </button>

        {isContextExpanded && (
          <div className="space-y-2 pl-5">
            <div>
              <label className="block text-xs gui-text-secondary mb-1">Max Context Tokens</label>
              <input
                type="number"
                value={data.contextRules.maxTokens}
                onChange={(e) => handleContextRulesChange('maxTokens', parseInt(e.target.value) || 8000)}
                min={1000}
                max={100000}
                step={1000}
                className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs gui-text-secondary mb-1">Max Traversal Depth</label>
              <input
                type="number"
                value={data.contextRules.maxDepth}
                onChange={(e) => handleContextRulesChange('maxDepth', parseInt(e.target.value) || 2)}
                min={1}
                max={10}
                className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs gui-text-secondary mb-1">Traversal Mode</label>
              <select
                value={data.contextRules.traversalMode}
                onChange={(e) => handleContextRulesChange('traversalMode', e.target.value)}
                className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="all">All connected nodes</option>
                <option value="ancestors-only">Ancestors only (upstream)</option>
                <option value="custom">Custom (use edge settings)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="include-disabled"
                checked={data.contextRules.includeDisabledNodes}
                onChange={(e) => handleContextRulesChange('includeDisabledNodes', e.target.checked)}
                className="rounded gui-input text-violet-600 focus:ring-violet-500"
              />
              <label htmlFor="include-disabled" className="text-xs gui-text-secondary">
                Include disabled nodes in context
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Theme Defaults Section */}
      <div className="pt-3 border-t gui-border">
        <button
          onClick={() => setIsThemeExpanded(!isThemeExpanded)}
          className="flex items-center gap-2 text-xs font-medium gui-text mb-2 w-full"
        >
          {isThemeExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Tag className="w-3.5 h-3.5 text-violet-400" />
          Theme Defaults
          {!isThemeExpanded && (() => {
            const customTypes = Object.keys(data.themeDefaults || {}) as string[]
            return customTypes.length > 0 ? (
              <span className="ml-auto px-1.5 py-0.5 bg-violet-600/30 text-violet-300 rounded text-[10px]" title={customTypes.join(', ')}>
                {customTypes.length} color{customTypes.length !== 1 ? 's' : ''}
              </span>
            ) : null
          })()}
        </button>

        {isThemeExpanded && (
          <div className="space-y-2 pl-5">
            <p className="text-xs gui-text-secondary mb-2">
              Override default colors for nodes in this workspace.
            </p>

            {(['conversation', 'note', 'task', 'artifact'] as const).map((nodeType) => (
              <div key={nodeType} className="flex items-center gap-2">
                <span className="text-xs gui-text-secondary capitalize w-24">{nodeType}</span>
                <input
                  type="color"
                  value={data.themeDefaults[nodeType] || '#6b7280'}
                  onChange={(e) => {
                    const newDefaults = { ...data.themeDefaults, [nodeType]: e.target.value }
                    onChange('themeDefaults', newDefaults)
                  }}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent"
                />
                {data.themeDefaults[nodeType] && (
                  <button
                    onClick={() => {
                      const newDefaults = { ...data.themeDefaults }
                      delete newDefaults[nodeType]
                      onChange('themeDefaults', newDefaults)
                    }}
                    className="text-xs gui-text-secondary hover:gui-text"
                  >
                    reset
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// File attachments section (collapsible)
function AttachmentsSection({
  nodeId,
  nodeData
}: {
  nodeId: string
  nodeData: NodeData
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const { addAttachment, deleteAttachment, openAttachment, isLoading } = useAttachments()
  const attachments: Attachment[] = (nodeData as ContextMetadata).attachments || []

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="pt-3 border-t gui-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs font-medium gui-text mb-2 w-full"
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Paperclip className="w-3 h-3" />
        Attachments
        {attachments.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 bg-blue-600/30 text-blue-300 rounded text-[10px]">
            {attachments.length}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="space-y-2">
          {/* Attachment list */}
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 p-1.5 rounded text-xs group gui-button"
            >
              {/* Thumbnail for images */}
              {attachment.thumbnail ? (
                <img
                  src={attachment.thumbnail}
                  alt={attachment.filename}
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 gui-panel-secondary">
                  <FileText className="w-4 h-4 gui-text-secondary" />
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => openAttachment(attachment.storedPath)}
                  className="block text-left truncate w-full gui-text hover:text-blue-400"
                  title={`Open ${attachment.filename}`}
                >
                  {attachment.filename}
                </button>
                <span className="text-[10px] gui-text-secondary">
                  {formatSize(attachment.size)}
                </span>
              </div>

              {/* Delete button */}
              <button
                onClick={() => deleteAttachment(nodeId, attachment.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/50 text-red-400"
                title="Remove attachment"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Add button */}
          <button
            onClick={() => addAttachment(nodeId)}
            disabled={isLoading}
            className={`flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs transition-colors gui-text-secondary gui-button ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus className="w-3 h-3" />
            {isLoading ? 'Adding...' : 'Add File'}
          </button>
        </div>
      )}
    </div>
  )
}

// Common metadata section for all node types
// Note: Tags are now managed through the Properties system (not here)
function MetadataSection({
  data,
  onChange
}: {
  data: ContextMetadata & { type: string; properties?: Record<string, unknown> }
  onChange: (field: string, value: unknown) => void
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="pt-3 border-t gui-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs font-medium gui-text mb-2 w-full"
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Node Metadata
        {!isExpanded && (() => {
          const customItems: string[] = []
          if (data.summary) customItems.push('summary')
          if (data.keyEntities && data.keyEntities.length > 0) customItems.push(`${data.keyEntities.length} key entit${data.keyEntities.length !== 1 ? 'ies' : 'y'}`)
          if (data.relationshipType) customItems.push('rel. type')
          return customItems.length > 0 ? (
            <span className="ml-auto px-1.5 py-0.5 bg-blue-600/30 text-blue-300 rounded text-[10px]" title={customItems.join(', ')}>
              {customItems.slice(0, 2).join(', ')}{customItems.length > 2 ? '...' : ''}
            </span>
          ) : null
        })()}
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {/* Summary */}
          <div>
            <label className="block text-xs gui-text-secondary mb-1">Summary (for AI context)</label>
            <textarea
              value={data.summary || ''}
              onChange={(e) => onChange('summary', e.target.value)}
              rows={2}
              placeholder="Brief summary for AI to understand this node's purpose..."
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 resize-y min-h-[60px] max-h-[300px]"
            />
          </div>

          {/* Key Entities */}
          <div>
            <label className="block text-xs gui-text-secondary mb-1">Key Concepts (comma-separated)</label>
            <input
              type="text"
              value={(data.keyEntities || []).join(', ')}
              onChange={(e) => onChange('keyEntities', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="e.g., authentication, API, database"
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Relationship Type */}
          <div>
            <label className="block text-xs gui-text-secondary mb-1">Relationship Hint</label>
            <select
              value={data.relationshipType || ''}
              onChange={(e) => onChange('relationshipType', e.target.value || undefined)}
              className="w-full gui-input border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="">None (auto-detect)</option>
              <option value="depends-on">Depends on connected nodes</option>
              <option value="related-to">Related to connected nodes</option>
              <option value="implements">Implements connected nodes</option>
              <option value="references">References connected nodes</option>
              <option value="blocks">Blocks/is blocked by connected nodes</option>
            </select>
          </div>

          {/* Usage stats (read-only) */}
          {data.accessCount !== undefined && (
            <div className="text-xs gui-text-secondary">
              Accessed {data.accessCount} times
              {data.lastAccessedAt && (
                <span> · Last: {new Date(data.lastAccessedAt).toLocaleDateString()}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Outgoing edge color section - allows setting color for new outgoing edges
function OutgoingEdgeColorSection({
  nodeId,
  data
}: {
  nodeId: string
  data: ContextMetadata & { type: string }
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const setOutgoingEdgeColor = useWorkspaceStore((state) => state.setOutgoingEdgeColor)
  const updateAllOutgoingEdges = useWorkspaceStore((state) => state.updateAllOutgoingEdges)
  const resetOutgoingEdges = useWorkspaceStore((state) => state.resetOutgoingEdges)
  const edges = useWorkspaceStore((state) => state.edges)

  // Count outgoing edges
  const outgoingEdgeCount = edges.filter((e) => e.source === nodeId).length

  // Preset colors
  const presetColors = [
    '#64748b', // slate (default)
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#84cc16', // lime
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
    '#8b5cf6', // purple
    '#6366f1'  // indigo
  ]

  const currentColor = data.outgoingEdgeColor || '#64748b'
  const hasCustomColor = !!data.outgoingEdgeColor

  return (
    <div className="pt-3 border-t gui-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs font-medium gui-text mb-2"
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Link2 className="w-3 h-3" />
        Outgoing Edge Color
        {hasCustomColor && (
          <span
            className="w-3 h-3 rounded-full ml-1"
            style={{ backgroundColor: currentColor }}
          />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-3 pl-4">
          {/* Color for next outgoing edge */}
          <div>
            <label className="block text-xs gui-text-secondary mb-1">
              Color for New Outgoing Links
            </label>
            <div className="flex items-center gap-1 flex-wrap">
              {presetColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setOutgoingEdgeColor(nodeId, color)}
                  className={`w-5 h-5 rounded-full transition-all ${
                    currentColor === color
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--gui-panel-bg)] scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Apply to all existing outgoing edges */}
          <div className="flex gap-2">
            <button
              onClick={() => updateAllOutgoingEdges(nodeId, currentColor)}
              disabled={outgoingEdgeCount === 0}
              className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                outgoingEdgeCount === 0
                  ? 'gui-panel-secondary gui-text-secondary cursor-not-allowed opacity-40'
                  : 'gui-panel-secondary gui-button gui-text'
              }`}
              title={outgoingEdgeCount === 0 ? 'No outgoing edges' : `Apply to ${outgoingEdgeCount} outgoing edge(s)`}
            >
              Apply to All ({outgoingEdgeCount})
            </button>
            <button
              onClick={() => resetOutgoingEdges(nodeId)}
              disabled={!hasCustomColor && outgoingEdgeCount === 0}
              className={`px-2 py-1.5 text-xs rounded transition-colors ${
                !hasCustomColor && outgoingEdgeCount === 0
                  ? 'gui-panel-secondary gui-text-secondary cursor-not-allowed opacity-40'
                  : 'gui-panel-secondary gui-button gui-text'
              }`}
              title="Reset to default color"
            >
              Reset
            </button>
          </div>

          {hasCustomColor && (
            <p className="text-xs gui-text-secondary">
              New edges from this node will use the selected color.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Dynamic properties section using the property system
function DynamicPropertiesSection({
  nodeType,
  properties,
  hiddenProperties,
  onPropertyChange,
  onAddOption,
  onRemoveProperty,
  onToggleHidden
}: {
  nodeType: NodeData['type']
  properties: Record<string, unknown>
  hiddenProperties?: string[]
  onPropertyChange: (propertyId: string, value: unknown) => void
  onAddOption: (propertyId: string, option: { label: string; color?: string }) => void
  onRemoveProperty?: (propertyId: string) => void
  onToggleHidden?: (propertyId: string) => void
}): JSX.Element {
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const propertyDefinitions = getPropertiesForNodeType(nodeType, propertySchema)
  // Filter out properties that are handled by type-specific fields
  const handledByTypeFields = getHandledPropertyIds(nodeType)
  const dynamicProperties = propertyDefinitions.filter(
    (def) => !handledByTypeFields.includes(def.id)
  )

  // Check if a property is custom (not built-in)
  const isCustomProperty = (propertyId: string): boolean => {
    return propertySchema.customProperties.some(p => p.id === propertyId)
  }

  if (dynamicProperties.length === 0) {
    return <></>
  }

  return (
    <div className="space-y-3">
      {dynamicProperties.map((definition) => {
        const isHidden = hiddenProperties?.includes(definition.id)
        return (
          <div key={definition.id} className="group">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium gui-text-secondary">
                {definition.name}
                {isCustomProperty(definition.id) && (
                  <span className="ml-1 text-[10px] gui-text-secondary">(custom)</span>
                )}
              </label>
              <div className="flex items-center gap-0.5">
                {/* Toggle visibility on card */}
                {onToggleHidden && (
                  <button
                    onClick={() => onToggleHidden(definition.id)}
                    className={`p-1 ${isHidden ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'} gui-button rounded transition-all`}
                    title={isHidden ? 'Show on node' : 'Hide from node'}
                  >
                    {isHidden ? (
                      <EyeOff className="w-3 h-3 gui-text-secondary" />
                    ) : (
                      <Eye className="w-3 h-3 gui-text-secondary" />
                    )}
                  </button>
                )}
                {/* Remove property button */}
                {onRemoveProperty && (
                  <button
                    onClick={() => onRemoveProperty(definition.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 gui-button rounded transition-all"
                    title="Remove property from this node type"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                )}
              </div>
            </div>
            <PropertyInput
              definition={definition}
              value={properties[definition.id]}
              onChange={(value) => onPropertyChange(definition.id, value)}
              onAddOption={(opt) => onAddOption(definition.id, opt)}
              showEditButton={true}
            />
          </div>
        )
      })}
    </div>
  )
}

// Helper to determine which properties are handled by type-specific field components
function getHandledPropertyIds(nodeType: NodeData['type']): string[] {
  switch (nodeType) {
    case 'task':
      // TaskFields handles status, priority, and complexity directly
      return ['status', 'priority', 'complexity', 'dueDate']
    case 'project':
      // ProjectFields handles contextRole, contextPriority
      return ['contextRole', 'contextPriority']
    case 'note':
      // NoteFields handles contextRole, contextPriority
      return ['contextRole', 'contextPriority']
    case 'conversation':
      // ConversationFields handles contextPriority
      return ['contextPriority']
    case 'artifact':
      // ArtifactFields handles contextRole, contextPriority
      return ['contextRole', 'contextPriority']
    case 'workspace':
      // WorkspaceFields handles all workspace-specific fields
      return ['llmSettings', 'contextRules', 'themeDefaults', 'includedNodeIds', 'excludedNodeIds']
    case 'orchestrator':
      // Orchestrator handles strategy, failurePolicy, budget, connectedAgents
      return ['strategy', 'failurePolicy', 'budget', 'connectedAgents']
    default:
      return []
  }
}

export const PropertiesPanel = memo(PropertiesPanelComponent)
