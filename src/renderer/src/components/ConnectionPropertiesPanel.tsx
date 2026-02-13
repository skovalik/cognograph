import { X, ArrowRight, ArrowLeftRight, Trash2, RefreshCw, Type, Bold, Italic, Palette, RotateCcw, Minus, Circle, Diamond, ChevronRight, Spline, CornerDownRight, MoveRight, GitBranch, Layers } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { EdgeData, EdgeLineStyle, EdgeArrowStyle, EdgeStrokePreset, EdgeStyle, EdgeStrength } from '@shared/types'
import { EDGE_LABEL_PRESETS, DEFAULT_EDGE_DATA, DEFAULT_LINK_COLORS_DARK, DEFAULT_LINK_COLORS_LIGHT } from '@shared/types'
import { ColorPicker } from './ColorPicker'
import { ScrollArea, Checkbox, Separator } from './ui'

// Edge style options
const EDGE_STYLES: { value: EdgeStyle; label: string; icon: React.ReactNode }[] = [
  { value: 'rounded', label: 'Rounded', icon: <CornerDownRight className="w-3.5 h-3.5" /> },
  { value: 'smooth', label: 'Smooth', icon: <Spline className="w-3.5 h-3.5" /> },
  { value: 'straight', label: 'Straight', icon: <MoveRight className="w-3.5 h-3.5" /> },
  { value: 'sharp', label: 'Sharp', icon: <GitBranch className="w-3.5 h-3.5" /> },
  { value: 'spline', label: 'Spline', icon: <Spline className="w-3.5 h-3.5" /> },
  { value: 'curved-elbow', label: 'Curved Elbow', icon: <CornerDownRight className="w-3.5 h-3.5" /> }
]

// Line style options
const LINE_STYLES: { value: EdgeLineStyle; label: string; preview: string }[] = [
  { value: 'solid', label: 'Solid', preview: '━━━━━━' },
  { value: 'dashed', label: 'Dashed', preview: '╌ ╌ ╌ ╌' },
  { value: 'dotted', label: 'Dotted', preview: '· · · · · ·' },
  { value: 'animated', label: 'Animated', preview: '→ → →' }
]

// Arrow style options
const ARROW_STYLES: { value: EdgeArrowStyle; label: string; icon: React.ReactNode }[] = [
  { value: 'filled', label: 'Filled', icon: <ChevronRight className="w-3.5 h-3.5 fill-current" /> },
  { value: 'outline', label: 'Outline', icon: <ChevronRight className="w-3.5 h-3.5" /> },
  { value: 'dot', label: 'Dot', icon: <Circle className="w-3 h-3 fill-current" /> },
  { value: 'diamond', label: 'Diamond', icon: <Diamond className="w-3 h-3 fill-current" /> },
  { value: 'none', label: 'None', icon: <Minus className="w-3.5 h-3.5" /> }
]

// Stroke preset options
const STROKE_PRESETS: { value: EdgeStrokePreset; label: string; width: number }[] = [
  { value: 'thin', label: 'Thin', width: 1 },
  { value: 'normal', label: 'Normal', width: 2 },
  { value: 'bold', label: 'Bold', width: 3 },
  { value: 'heavy', label: 'Heavy', width: 4 }
]

// Edge strength options (replaces weight slider)
const STRENGTH_OPTIONS: { value: EdgeStrength; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'Lower priority — dashed line, reduced opacity' },
  { value: 'normal', label: 'Normal', description: 'Standard connection — solid line' },
  { value: 'strong', label: 'Strong', description: 'High priority — thick solid line' }
]

interface ConnectionPropertiesPanelProps {
  edgeId: string  // Can be single ID or comma-separated IDs for multi-select
  onClose: () => void
}

// Full color palette (same as node colors)
const COLOR_PALETTE = {
  warm: ['#ef4444', '#f97316', '#f59e0b', '#facc15'],
  green: ['#84cc16', '#22c55e', '#10b981', '#14b8a6'],
  cool: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'],
  purple: ['#8b5cf6', '#a855f7', '#d946ef', '#ec4899'],
  neutral: ['#64748b', '#71717a', '#78716c', '#737373']
}
const ALL_COLORS = Object.values(COLOR_PALETTE).flat()

// Helper to compute shared value across multiple edges
function getSharedValue<T>(values: T[]): T | 'mixed' | undefined {
  if (values.length === 0) return undefined
  const first = values[0]
  return values.every(v => v === first) ? first : 'mixed'
}

export function ConnectionPropertiesPanel({ edgeId, onClose }: ConnectionPropertiesPanelProps): JSX.Element {
  const edges = useWorkspaceStore((state) => state.edges)
  const nodes = useWorkspaceStore((state) => state.nodes)
  const updateEdge = useWorkspaceStore((state) => state.updateEdge)
  const deleteEdges = useWorkspaceStore((state) => state.deleteEdges)
  const reverseEdge = useWorkspaceStore((state) => state.reverseEdge)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const addCustomColor = useWorkspaceStore((state) => state.addCustomColor)
  const removeCustomColor = useWorkspaceStore((state) => state.removeCustomColor)
  const selectedEdgeIds = useWorkspaceStore((state) => state.selectedEdgeIds)

  const [showColorPicker, setShowColorPicker] = useState(false)

  // Support multi-select: use selectedEdgeIds if multiple, otherwise single edgeId
  const edgeIds = useMemo(() => {
    if (selectedEdgeIds.length > 1) {
      return selectedEdgeIds
    }
    return [edgeId]
  }, [edgeId, selectedEdgeIds])

  const isMultiSelect = edgeIds.length > 1

  // Get all selected edges
  const selectedEdges = useMemo(() => {
    return edgeIds.map(id => edges.find(e => e.id === id)).filter(Boolean) as typeof edges
  }, [edgeIds, edges])

  // For single edge, get the first edge
  const edge = selectedEdges[0]
  const edgeData = edge?.data || DEFAULT_EDGE_DATA

  // Compute shared values for multi-select (P3-4)
  const sharedValues = useMemo(() => {
    if (!isMultiSelect) return null

    const allData = selectedEdges.map(e => e.data || DEFAULT_EDGE_DATA)

    return {
      direction: getSharedValue(allData.map(d => d.direction)),
      edgeStyle: getSharedValue(allData.map(d => d.edgeStyle)),
      lineStyle: getSharedValue(allData.map(d => d.lineStyle || 'solid')),
      arrowStyle: getSharedValue(allData.map(d => d.arrowStyle || 'filled')),
      strokePreset: getSharedValue(allData.map(d => d.strokePreset || 'normal')),
      color: getSharedValue(allData.map(d => d.color)),
      active: getSharedValue(allData.map(d => d.active)),
      strength: getSharedValue(allData.map(d => d.strength || 'normal')),
      totalWaypoints: allData.reduce((sum, d) => sum + (d.waypoints?.length || 0), 0)
    }
  }, [isMultiSelect, selectedEdges])

  // Get source and target node titles (single edge only)
  const sourceNode = nodes.find((n) => n.id === edge?.source)
  const targetNode = nodes.find((n) => n.id === edge?.target)

  const isLightMode = themeSettings.mode === 'light'
  const defaultLinkColors = isLightMode ? DEFAULT_LINK_COLORS_LIGHT : DEFAULT_LINK_COLORS_DARK
  const currentLinkColors = themeSettings.linkColors || defaultLinkColors

  if (selectedEdges.length === 0) {
    return (
      <div className="w-80 gui-panel glass-soft gui-border flex flex-col">
        <div className="p-4 gui-text-secondary">Connection not found</div>
      </div>
    )
  }

  // Update handler - supports both single and multi-select
  const handleUpdate = (updates: Partial<EdgeData>): void => {
    edgeIds.forEach(id => updateEdge(id, updates))
  }

  const handleDelete = (): void => {
    deleteEdges(edgeIds)
    onClose()
  }

  const handleResetColor = (): void => {
    handleUpdate({ color: undefined })
  }

  const handleColorPickerChange = useCallback((color: string): void => {
    handleUpdate({ color })
  }, [edgeIds])

  // Reset all paths for multi-select
  const handleResetAllPaths = (): void => {
    edgeIds.forEach(id => {
      updateEdge(id, { waypoints: undefined, centerOffset: { x: 0, y: 0 } })
    })
  }

  // Helper to render style button with mixed state support
  const renderStyleButton = <T extends string>(
    value: T,
    currentValue: T | 'mixed' | undefined,
    defaultValue: T,
    onClick: () => void,
    content: React.ReactNode,
    title: string,
    className?: string
  ) => {
    const isSelected = isMultiSelect
      ? currentValue === value
      : (currentValue || defaultValue) === value
    const isMixed = isMultiSelect && currentValue === 'mixed'

    return (
      <button
        onClick={onClick}
        className={`${className || 'flex-1 flex flex-col items-center gap-1 px-2 py-2 text-xs rounded transition-colors border'} ${
          isSelected
            ? 'gui-ring-active'
            : isMixed
              ? 'gui-border gui-button border-dashed'
              : 'gui-border gui-button'
        }`}
        style={isSelected ? {
          backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
          color: 'var(--gui-accent-primary)'
        } : undefined}
        title={isMixed ? `${title} (Mixed)` : title}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="w-80 gui-panel glass-soft gui-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <h2 className="font-semibold gui-text">
          Connection Properties
        </h2>
        <button
          onClick={onClose}
          className="p-1 gui-button rounded transition-colors"
        >
          <X className="w-5 h-5 gui-text-secondary" />
        </button>
      </div>
      <Separator />

      {/* Connection Info */}
      <div className="p-4">
        {isMultiSelect ? (
          // Multi-select header (P3-4)
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
            <span className="gui-text font-medium">{edgeIds.length} connections selected</span>
          </div>
        ) : (
          // Single edge info
          <>
            <div className="text-sm gui-text-secondary mb-1">Connection</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="gui-text truncate max-w-[100px]" title={sourceNode?.data.title as string | undefined}>
                {(sourceNode?.data.title as string) || 'Unknown'}
              </span>
              <ArrowRight className="w-4 h-4 gui-text-secondary flex-shrink-0" />
              <span className="gui-text truncate max-w-[100px]" title={targetNode?.data.title as string | undefined}>
                {(targetNode?.data.title as string) || 'Unknown'}
              </span>
            </div>
          </>
        )}
      </div>
      <Separator />

      {/* Content */}
      <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        {/* Direction - single edge only */}
        {!isMultiSelect && (
          <div>
            <label className="block text-sm font-medium gui-text mb-2">Direction</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdate({ direction: 'unidirectional' })}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border transition-colors ${
                  edgeData.direction === 'unidirectional'
                    ? 'gui-ring-active'
                    : 'gui-border gui-button'
                }`}
                style={edgeData.direction === 'unidirectional' ? {
                  backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                  color: 'var(--gui-accent-primary)'
                } : undefined}
              >
                <ArrowRight className="w-4 h-4" />
                <span className="text-sm">One-way</span>
              </button>
              <button
                onClick={() => handleUpdate({ direction: 'bidirectional' })}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border transition-colors ${
                  edgeData.direction === 'bidirectional'
                    ? 'gui-ring-active'
                    : 'gui-border gui-button'
                }`}
                style={edgeData.direction === 'bidirectional' ? {
                  backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                  color: 'var(--gui-accent-primary)'
                } : undefined}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span className="text-sm">Two-way</span>
              </button>
            </div>
            {/* Reverse Direction - only for unidirectional */}
            {edgeData.direction === 'unidirectional' && (
              <div className="mt-3">
                <button
                  onClick={() => reverseEdge(edgeId)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border gui-border gui-button transition-colors hover:gui-ring-active"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm">Reverse Direction</span>
                </button>
                <p className="text-xs gui-text-secondary mt-1 text-center">
                  Swap {(sourceNode?.data.title as string) || 'source'} ↔ {(targetNode?.data.title as string) || 'target'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Label - single edge only */}
        {!isMultiSelect && (
          <div>
            <label className="block text-sm font-medium gui-text mb-2">
              <Type className="w-4 h-4 inline-block mr-1" />
              Label
            </label>
            {/* Custom text input */}
            <input
              type="text"
              value={edgeData.label || ''}
              onChange={(e) => handleUpdate({ label: e.target.value || undefined })}
              placeholder="Enter custom label..."
              className="w-full px-3 py-2 gui-input rounded text-sm focus:outline-none focus:gui-border-active mb-2"
            />
            {/* Text styling toggles */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => handleUpdate({ labelBold: !edgeData.labelBold })}
                className={`flex items-center justify-center w-9 h-9 rounded border transition-colors ${
                  edgeData.labelBold
                    ? 'gui-ring-active'
                    : 'gui-border gui-button'
                }`}
                style={edgeData.labelBold ? {
                  backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                  color: 'var(--gui-accent-primary)'
                } : undefined}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleUpdate({ labelItalic: !edgeData.labelItalic })}
                className={`flex items-center justify-center w-9 h-9 rounded border transition-colors ${
                  edgeData.labelItalic
                    ? 'gui-ring-active'
                    : 'gui-border gui-button'
                }`}
                style={edgeData.labelItalic ? {
                  backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                  color: 'var(--gui-accent-primary)'
                } : undefined}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
            </div>
            {/* Preset buttons */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => handleUpdate({ label: undefined })}
                className={`px-2 py-1 text-xs rounded transition-colors border ${
                  !edgeData.label
                    ? 'gui-ring-active'
                    : 'gui-border gui-button'
                }`}
                style={!edgeData.label ? {
                  backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                  color: 'var(--gui-accent-primary)'
                } : undefined}
              >
                None
              </button>
              {EDGE_LABEL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleUpdate({ label: preset })}
                  className={`px-2 py-1 text-xs rounded transition-colors border ${
                    edgeData.label === preset
                      ? 'gui-ring-active'
                      : 'gui-border gui-button'
                  }`}
                  style={edgeData.label === preset ? {
                    backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                    color: 'var(--gui-accent-primary)'
                  } : undefined}
                >
                  {preset}
                </button>
              ))}
            </div>
            <p className="text-xs gui-text-secondary mt-2">
              Labels appear at the midpoint of the connection
            </p>
          </div>
        )}

        {/* Connection Strength */}
        <div>
          <label className="block text-sm font-medium gui-text mb-2">
            Connection Strength
          </label>
          <div className="flex gap-2">
            {STRENGTH_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => handleUpdate({ strength: value })}
                className={`flex-1 px-3 py-2 rounded-lg border transition-all ${
                  edgeData.strength === value
                    ? 'gui-bg-accent-subtle border-[var(--gui-accent-primary)] ring-1 ring-[var(--gui-accent-primary)]'
                    : 'gui-bg-secondary border-transparent hover:border-[var(--gui-border-color)]'
                }`}
                title={description}
              >
                <div className="text-sm font-medium gui-text">{label}</div>
              </button>
            ))}
          </div>
          <p className="text-xs gui-text-secondary mt-2">
            Affects context injection depth and visual prominence
          </p>
        </div>

        {/* Active Toggle - single edge only */}
        {!isMultiSelect && (
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={edgeData.active}
                onCheckedChange={(checked) => handleUpdate({ active: !!checked })}
              />
              <span className="text-sm gui-text">Active</span>
            </label>
            <p className="text-xs gui-text-secondary mt-1 ml-7">
              Inactive connections are ignored during context injection
            </p>
          </div>
        )}

        {/* Edge Style - supports multi-select (P3-4) */}
        <div>
          <label className="block text-sm font-medium gui-text mb-2">
            Edge Style
            {isMultiSelect && sharedValues?.edgeStyle === 'mixed' && (
              <span className="ml-2 text-xs gui-text-secondary">(Mixed)</span>
            )}
          </label>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => handleUpdate({ edgeStyle: undefined })}
              className={`px-2 py-1 text-xs rounded transition-colors border ${
                isMultiSelect
                  ? sharedValues?.edgeStyle === undefined ? 'gui-ring-active' : 'gui-border gui-button'
                  : !edgeData.edgeStyle ? 'gui-ring-active' : 'gui-border gui-button'
              }`}
              style={(isMultiSelect ? sharedValues?.edgeStyle === undefined : !edgeData.edgeStyle) ? {
                backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                color: 'var(--gui-accent-primary)'
              } : undefined}
              title="Use global theme setting"
            >
              Default
            </button>
            {EDGE_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => handleUpdate({ edgeStyle: style.value })}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors border ${
                  (isMultiSelect ? sharedValues?.edgeStyle : edgeData.edgeStyle) === style.value
                    ? 'gui-ring-active'
                    : 'gui-border gui-button'
                }`}
                style={(isMultiSelect ? sharedValues?.edgeStyle : edgeData.edgeStyle) === style.value ? {
                  backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                  color: 'var(--gui-accent-primary)'
                } : undefined}
                title={style.label}
              >
                {style.icon}
                <span>{style.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs gui-text-secondary mt-1">
            {isMultiSelect ? 'Apply style to all selected connections' : 'Override global edge style for this connection'}
          </p>
        </div>

        {/* Line Style - supports multi-select (P3-4) */}
        <div>
          <label className="block text-sm font-medium gui-text mb-2">
            Line Style
            {isMultiSelect && sharedValues?.lineStyle === 'mixed' && (
              <span className="ml-2 text-xs gui-text-secondary">(Mixed)</span>
            )}
          </label>
          <div className="flex gap-1">
            {LINE_STYLES.map((style) => {
              const currentValue = isMultiSelect ? sharedValues?.lineStyle : (edgeData.lineStyle || 'solid')
              const isSelected = currentValue === style.value
              const isMixed = isMultiSelect && currentValue === 'mixed'

              return (
                <button
                  key={style.value}
                  onClick={() => handleUpdate({ lineStyle: style.value })}
                  className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 text-xs rounded transition-colors border ${
                    isSelected
                      ? 'gui-ring-active'
                      : isMixed
                        ? 'gui-border gui-button border-dashed'
                        : 'gui-border gui-button'
                  }`}
                  style={isSelected ? {
                    backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                    color: 'var(--gui-accent-primary)'
                  } : undefined}
                  title={style.label}
                >
                  <span className="font-mono text-[10px] tracking-wider">{style.preview}</span>
                  <span>{style.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Arrow Style - supports multi-select (P3-4) */}
        <div>
          <label className="block text-sm font-medium gui-text mb-2">
            Arrow Style
            {isMultiSelect && sharedValues?.arrowStyle === 'mixed' && (
              <span className="ml-2 text-xs gui-text-secondary">(Mixed)</span>
            )}
          </label>
          <div className="flex gap-1">
            {ARROW_STYLES.map((style) => {
              const currentValue = isMultiSelect ? sharedValues?.arrowStyle : (edgeData.arrowStyle || 'filled')
              const isSelected = currentValue === style.value
              const isMixed = isMultiSelect && currentValue === 'mixed'

              return (
                <button
                  key={style.value}
                  onClick={() => handleUpdate({ arrowStyle: style.value })}
                  className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 text-xs rounded transition-colors border ${
                    isSelected
                      ? 'gui-ring-active'
                      : isMixed
                        ? 'gui-border gui-button border-dashed'
                        : 'gui-border gui-button'
                  }`}
                  style={isSelected ? {
                    backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                    color: 'var(--gui-accent-primary)'
                  } : undefined}
                  title={style.label}
                >
                  {style.icon}
                  <span>{style.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Stroke Thickness - supports multi-select (P3-4) */}
        <div>
          <label className="block text-sm font-medium gui-text mb-2">
            Stroke Thickness
            {isMultiSelect && sharedValues?.strokePreset === 'mixed' && (
              <span className="ml-2 text-xs gui-text-secondary">(Mixed)</span>
            )}
          </label>
          <div className="flex gap-1">
            {STROKE_PRESETS.map((preset) => {
              const currentValue = isMultiSelect ? sharedValues?.strokePreset : (edgeData.strokePreset || 'normal')
              const isSelected = currentValue === preset.value
              const isMixed = isMultiSelect && currentValue === 'mixed'

              return (
                <button
                  key={preset.value}
                  onClick={() => handleUpdate({ strokePreset: preset.value })}
                  className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 text-xs rounded transition-colors border ${
                    isSelected
                      ? 'gui-ring-active'
                      : isMixed
                        ? 'gui-border gui-button border-dashed'
                        : 'gui-border gui-button'
                  }`}
                  style={isSelected ? {
                    backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                    color: 'var(--gui-accent-primary)'
                  } : undefined}
                  title={preset.label}
                >
                  <div
                    className="w-8 rounded-full"
                    style={{
                      height: `${preset.width}px`,
                      backgroundColor: 'currentColor'
                    }}
                  />
                  <span>{preset.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Color - supports multi-select (P3-4) */}
        <div>
          <label className="block text-sm font-medium gui-text mb-2">
            Color
            {isMultiSelect && sharedValues?.color === 'mixed' && (
              <span className="ml-2 text-xs gui-text-secondary">(Mixed)</span>
            )}
          </label>
          {/* Full color palette */}
          <div className="flex gap-1 flex-wrap">
            {ALL_COLORS.map((color) => {
              const currentColor = isMultiSelect ? sharedValues?.color : edgeData.color
              const isSelected = currentColor === color

              return (
                <button
                  key={color}
                  onClick={() => handleUpdate({ color })}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    isSelected
                      ? 'gui-border-active scale-110'
                      : 'border-transparent hover:border-[var(--border-subtle)]'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              )
            })}
          </div>
          {/* Color picker and reset buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowColorPicker(true)}
              className="flex items-center gap-1.5 px-2 py-1 gui-button rounded text-[10px] transition-colors"
            >
              <Palette className="w-3 h-3" />
              Pick Color
            </button>
            <button
              onClick={handleResetColor}
              className="flex items-center gap-1.5 px-2 py-1 gui-button rounded text-[10px] transition-colors"
              title="Reset to theme default"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Path Routing */}
        <div>
          <label className="block text-sm font-medium gui-text mb-2">Path Routing</label>
          <div className="space-y-2">
            {isMultiSelect ? (
              // Multi-select: show total waypoints and reset all button (P3-4)
              <>
                <div className="text-xs gui-text-secondary">
                  Total waypoints across {edgeIds.length} connections: {sharedValues?.totalWaypoints || 0}
                </div>
                {(sharedValues?.totalWaypoints || 0) > 0 && (
                  <button
                    onClick={handleResetAllPaths}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 gui-button rounded text-sm transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Paths</span>
                  </button>
                )}
              </>
            ) : (
              // Single edge: show waypoint count with progress bar
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs gui-text-secondary">
                    <span>Waypoints:</span>
                    <span className={`font-mono ${(edgeData.waypoints?.length || 0) >= 20 ? 'text-amber-500 font-semibold' : (edgeData.waypoints?.length || 0) >= 15 ? 'text-yellow-500' : ''}`}>
                      {edgeData.waypoints?.length || (edgeData.centerOffset && (Math.abs(edgeData.centerOffset.x) > 5 || Math.abs(edgeData.centerOffset.y) > 5) ? 1 : 0)}
                      /20
                      {(edgeData.waypoints?.length || 0) >= 20 && ' (max)'}
                    </span>
                  </div>
                  {/* Visual progress bar */}
                  <div className="h-1 w-full bg-[var(--surface-panel-secondary)] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        (edgeData.waypoints?.length || 0) >= 20
                          ? 'bg-amber-500'
                          : (edgeData.waypoints?.length || 0) >= 15
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${((edgeData.waypoints?.length || 0) / 20) * 100}%` }}
                    />
                  </div>
                </div>

                {(edgeData.waypoints?.length || (edgeData.centerOffset && (Math.abs(edgeData.centerOffset.x) > 5 || Math.abs(edgeData.centerOffset.y) > 5))) ? (
                  <button
                    onClick={() => handleUpdate({ waypoints: undefined, centerOffset: { x: 0, y: 0 } })}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 gui-button rounded text-sm transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Path</span>
                  </button>
                ) : null}

                {/* Instructions with keyboard shortcuts */}
                <div className="text-xs gui-text-secondary space-y-1 pt-1">
                  <p>• Double-click edge to add waypoint</p>
                  <p>• Drag waypoint to reposition</p>
                  <p>• <kbd className="px-1 py-0.5 bg-[var(--surface-panel-secondary)] rounded text-[10px]">Shift</kbd> + drag to snap to grid</p>
                  <p>• <kbd className="px-1 py-0.5 bg-[var(--surface-panel-secondary)] rounded text-[10px]">Ctrl</kbd> + drag to lock axis</p>
                  <p>• <kbd className="px-1 py-0.5 bg-[var(--surface-panel-secondary)] rounded text-[10px]">Delete</kbd> or double-click to remove</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      </ScrollArea>

      {/* Delete Button */}
      <Separator />
      <div className="p-4">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>{isMultiSelect ? `Delete ${edgeIds.length} Connections` : 'Delete Connection'}</span>
        </button>
      </div>

      {/* Color Picker Modal */}
      {showColorPicker && (
        <div className="fixed inset-0 gui-z-modals flex items-center justify-center pointer-events-none">
          <div className="gui-panel glass-fluid gui-border rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 pointer-events-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
                <span className="font-medium text-sm gui-text">Connection Color</span>
              </div>
              <button onClick={() => setShowColorPicker(false)} className="p-1 gui-button rounded transition-colors">
                <X className="w-4 h-4 gui-text-secondary" />
              </button>
            </div>
            <ColorPicker
              color={edgeData.color || currentLinkColors.default}
              onChange={handleColorPickerChange}
              onSaveColor={addCustomColor}
              onRemoveSavedColor={removeCustomColor}
              savedColors={themeSettings.customColors || []}
              isLightMode={isLightMode}
              showAIGeneration={false}
              aiGenerationEnabled={false}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowColorPicker(false)}
                className="flex-1 px-3 py-1.5 gui-button rounded text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
