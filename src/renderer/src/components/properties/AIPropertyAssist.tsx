/**
 * AI Property Assist
 *
 * Provides AI-powered property suggestions for nodes.
 * Accessible via Sparkles button in PropertiesPanel header.
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  Sparkles,
  X,
  Check,
  ArrowLeft,
  Loader2,
  Tag,
  Tags,
  Flag,
  Network,
  AlertCircle,
  Settings,
  RotateCcw,
  CheckCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { NodeData, PropertyDefinition, Edge, EdgeData } from '@shared/types'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { getPropertiesForNodeType } from '../../constants/properties'
import {
  getQuickActionsForNode,
  GENERIC_QUICK_ACTIONS
} from '../../constants/aiPropertyQuickActions'
import {
  extractNodeContent,
  buildPropertyPrompt,
  parsePropertyResponse,
  validateAndFilterSuggestions,
  computeContextHash,
  getCachedResponse,
  cacheResponse,
  type PropertySuggestion,
  type PropertyAIContext,
  type ConnectedNodeContext,
  type GraphStats,
  type ConfidenceLevel
} from '../../services/propertyAIService'

// =============================================================================
// Types
// =============================================================================

interface AIPropertyAssistProps {
  nodeId: string
  nodeData: NodeData
  disabled?: boolean
  compact?: boolean  // For node card usage (smaller UI, fewer actions)
  onOpen?: () => void  // Callback when popover opens
}

interface UndoEntry {
  propertyId: string
  previousValue: unknown
  newValue: unknown
}

// =============================================================================
// Constants
// =============================================================================

const QUICK_ACTION_ICONS: Record<string, typeof Sparkles> = {
  Sparkles,
  Tag,
  Tags,
  Flag,
  Network,
  CheckCircle
}

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: 'text-green-500',
  medium: 'text-yellow-500',
  low: 'text-[var(--text-secondary)]'
}

const CONFIDENCE_DOTS: Record<ConfidenceLevel, number> = {
  high: 4,
  medium: 3,
  low: 2
}

// =============================================================================
// Confidence Indicator Component
// =============================================================================

const ConfidenceIndicator = memo(function ConfidenceIndicator({
  confidence
}: {
  confidence: ConfidenceLevel
}) {
  const filled = CONFIDENCE_DOTS[confidence]
  const color = CONFIDENCE_COLORS[confidence]

  return (
    <div className="flex items-center gap-0.5" title={`Confidence: ${confidence}`}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= filled ? color.replace('text-', 'bg-') : 'bg-[var(--surface-panel-secondary)]'
          }`}
        />
      ))}
      <span className={`text-[10px] ml-1 capitalize ${color}`}>{confidence}</span>
    </div>
  )
})

// =============================================================================
// Suggestion Card Component
// =============================================================================

interface SuggestionCardProps {
  suggestion: PropertySuggestion
  propertyDef?: PropertyDefinition
  onAccept: () => void
  onReject: () => void
  isAnimatingOut?: boolean
}

const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  propertyDef,
  onAccept,
  onReject,
  isAnimatingOut
}: SuggestionCardProps) {
  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null) return '—'
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]'
      return `[${value.join(', ')}]`
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return String(value)
  }

  const propertyName = propertyDef?.name || suggestion.propertyId

  return (
    <div
      className={`
        gui-panel-secondary rounded-lg p-3 border gui-border
        transition-all duration-200
        ${isAnimatingOut ? 'opacity-0 scale-95 -translate-x-4' : 'opacity-100'}
      `}
      role="option"
      aria-label={`${propertyName}: ${formatValue(suggestion.value)}, confidence ${suggestion.confidence}`}
    >
      {/* Header: Property name + confidence */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium gui-text">{propertyName}</span>
        <ConfidenceIndicator confidence={suggestion.confidence} />
      </div>

      {/* Value diff */}
      <div className="text-xs gui-text-secondary mb-2 font-mono">
        <span className="opacity-60">{formatValue(suggestion.currentValue)}</span>
        <span className="mx-2">→</span>
        <span className="text-blue-400">{formatValue(suggestion.value)}</span>
      </div>

      {/* Reasoning */}
      {suggestion.reasoning && (
        <p className="text-[11px] gui-text-secondary italic mb-2 line-clamp-2">
          "{suggestion.reasoning}"
        </p>
      )}

      {/* New option warning */}
      {suggestion.needsOptionCreation && (
        <p className="text-[10px] text-yellow-500 mb-2">
          Will create new option(s)
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onReject}
          className="p-1.5 rounded gui-button hover:bg-red-500/20 transition-colors"
          title="Reject suggestion"
          aria-label="Reject"
        >
          <X className="w-4 h-4 text-red-400" />
        </button>
        <button
          onClick={onAccept}
          className="p-1.5 rounded gui-button hover:bg-green-500/20 transition-colors"
          title="Accept suggestion"
          aria-label="Accept"
        >
          <Check className="w-4 h-4 text-green-400" />
        </button>
      </div>
    </div>
  )
})

// =============================================================================
// Main Component
// =============================================================================

function AIPropertyAssistComponent({
  nodeId,
  nodeData,
  disabled = false,
  compact = false,
  onOpen
}: AIPropertyAssistProps): JSX.Element {
  // Refs
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // State
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [animatingOutId, setAnimatingOutId] = useState<string | null>(null)

  // Store — only subscribe to nodes/edges when popover is open to avoid re-renders during drag
  const setNodeProperty = useWorkspaceStore((state) => state.setNodeProperty)
  const addPropertyOption = useWorkspaceStore((state) => state.addPropertyOption)
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const nodes = useWorkspaceStore((state) => isOpen ? state.nodes : null)
  const edges = useWorkspaceStore((state) => isOpen ? state.edges : null)
  const llmSettings = useWorkspaceStore((state) => state.llmSettings)

  // Get available properties for this node type
  const availableProperties = useMemo(() => {
    return getPropertiesForNodeType(nodeData.type, propertySchema)
  }, [nodeData.type, propertySchema])

  // Get quick actions (node-specific in compact mode, generic in full mode)
  const quickActions = useMemo(() => {
    return compact
      ? getQuickActionsForNode(nodeData.type)
      : GENERIC_QUICK_ACTIONS
  }, [compact, nodeData.type])

  // Get connected nodes with full edge context and compute graph stats
  const { connectedNodes, graphStats } = useMemo(() => {
    // When popover is closed, nodes/edges are null — return empty defaults
    if (!nodes || !edges) return { connectedNodes: [] as ConnectedNodeContext[], graphStats: { incomingCount: 0, outgoingCount: 0, highPriorityConnections: 0, sharedTags: [] } as GraphStats }

    const connected: ConnectedNodeContext[] = []
    const tagCounts = new Map<string, number>()
    let highPriorityCount = 0

    // Filter edges for this node, excluding inactive edges
    const nodeEdges = edges.filter(
      (e: Edge) => (e.source === nodeId || e.target === nodeId) && (e.data as EdgeData | undefined)?.active !== false
    )

    // Sort by weight descending to prioritize important connections
    const sortedEdges = [...nodeEdges].sort((a, b) =>
      ((b.data as EdgeData | undefined)?.weight ?? 5) - ((a.data as EdgeData | undefined)?.weight ?? 5)
    )

    for (const edge of sortedEdges) {
      const isOutgoing = edge.source === nodeId
      const otherId = isOutgoing ? edge.target : edge.source
      const otherNode = nodes.find((n) => n.id === otherId)

      if (otherNode) {
        const edgeData = edge.data as EdgeData | undefined
        const otherProps = otherNode.data.properties as Record<string, unknown> | undefined
        const otherTags = otherProps?.tags as string[] | undefined
        const otherPriority = otherProps?.priority as string | undefined
        const otherStatus = otherProps?.status as string | undefined

        // Track high priority connections
        if (otherPriority === 'high' || otherPriority === 'critical') {
          highPriorityCount++
        }

        // Track tag frequency for sharedTags computation
        if (otherTags) {
          for (const tag of otherTags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
          }
        }

        connected.push({
          id: otherNode.id,
          type: otherNode.data.type,
          title: otherNode.data.title as string,
          properties: {
            tags: otherTags,
            priority: otherPriority,
            status: otherStatus
          },
          edgeLabel: edgeData?.label,
          edgeWeight: edgeData?.weight ?? 5,
          edgeDirection: isOutgoing ? 'outgoing' : 'incoming',
          edgeActive: edgeData?.active !== false
        })
      }

      if (connected.length >= 8) break  // Limit for prompt size
    }

    // Compute shared tags (appearing in 2+ connected nodes)
    const sharedTags = Array.from(tagCounts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([tag]) => tag)
      .slice(0, 5)

    // Compute graph stats
    const stats: GraphStats = {
      incomingCount: connected.filter(n => n.edgeDirection === 'incoming').length,
      outgoingCount: connected.filter(n => n.edgeDirection === 'outgoing').length,
      highPriorityConnections: highPriorityCount,
      sharedTags
    }

    return { connectedNodes: connected, graphStats: stats }
  }, [nodeId, nodes, edges])

  // Check if API key is configured
  const hasApiKey = useMemo(() => {
    return !!(llmSettings?.openaiKey || llmSettings?.anthropicKey)
  }, [llmSettings])

  // Auto-focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Click-outside handler
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        handleClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Keyboard handler
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Handlers
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setPrompt('')
    setSuggestions([])
    setError(null)
    abortControllerRef.current?.abort()
  }, [])

  const handleSubmit = useCallback(
    async (customPrompt?: string) => {
      const userPrompt = customPrompt || prompt
      if (!userPrompt.trim()) return

      // Cancel any in-flight request
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      setIsLoading(true)
      setError(null)
      setSuggestions([])

      try {
        // Build context with full graph information
        const { content, contentType } = extractNodeContent(nodeData)
        const context: PropertyAIContext = {
          nodeId,
          nodeType: nodeData.type,
          title: nodeData.title as string,
          content,
          contentType,
          currentProperties: (nodeData.properties as Record<string, unknown>) || {},
          availableProperties,
          connectedNodes,
          graphStats,
          userPrompt
        }

        // Check cache
        const cacheKey = computeContextHash(context)
        const cached = getCachedResponse(cacheKey)
        if (cached) {
          setSuggestions(cached.suggestions)
          setIsLoading(false)
          return
        }

        // Build prompt
        const { systemPrompt, userPrompt: builtPrompt } = buildPropertyPrompt(context)

        // Make API call
        const response = await window.api.llm.extract({
          systemPrompt,
          userPrompt: builtPrompt,
          maxTokens: 1024
        })

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) return

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'No response from AI')
        }

        // Parse response
        const parsed = parsePropertyResponse(response.data)

        // Validate suggestions
        const validated = validateAndFilterSuggestions(
          parsed.suggestions,
          propertySchema,
          availableProperties
        )

        // Attach current values for diff display
        const withCurrentValues = validated.map((s) => ({
          ...s,
          currentValue:
            s.currentValue ??
            ((nodeData.properties as Record<string, unknown>)?.[s.propertyId] ?? undefined)
        }))

        // Cache response
        cacheResponse(cacheKey, { suggestions: withCurrentValues, summary: parsed.summary })

        setSuggestions(withCurrentValues)

        if (withCurrentValues.length === 0) {
          setError('No relevant suggestions for this content')
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        console.error('AI Property Assist error:', err)
        setError((err as Error).message || 'Failed to get suggestions')
      } finally {
        setIsLoading(false)
      }
    },
    [prompt, nodeId, nodeData, availableProperties, connectedNodes, graphStats, propertySchema]
  )

  const handleAccept = useCallback(
    (suggestion: PropertySuggestion) => {
      // Animate out
      setAnimatingOutId(suggestion.propertyId)

      setTimeout(() => {
        // Store previous value for undo
        const previousValue = (nodeData.properties as Record<string, unknown>)?.[
          suggestion.propertyId
        ]

        // Handle option creation for select/multi-select
        if (suggestion.needsOptionCreation) {
          const values = Array.isArray(suggestion.value)
            ? suggestion.value
            : [suggestion.value]
          for (const val of values) {
            addPropertyOption(suggestion.propertyId, { label: String(val) })
          }
        }

        // Apply the value
        setNodeProperty(nodeId, suggestion.propertyId, suggestion.value)

        // Add to undo stack
        setUndoStack((prev) => [
          ...prev,
          {
            propertyId: suggestion.propertyId,
            previousValue,
            newValue: suggestion.value
          }
        ])

        // Remove from suggestions
        setSuggestions((prev) => prev.filter((s) => s.propertyId !== suggestion.propertyId))
        setAnimatingOutId(null)

        toast.success(`Set ${suggestion.propertyId}`)
      }, 200)
    },
    [nodeId, nodeData, setNodeProperty, addPropertyOption]
  )

  const handleReject = useCallback((suggestion: PropertySuggestion) => {
    setAnimatingOutId(suggestion.propertyId)

    setTimeout(() => {
      setSuggestions((prev) => prev.filter((s) => s.propertyId !== suggestion.propertyId))
      setAnimatingOutId(null)
    }, 200)
  }, [])

  const handleUndo = useCallback(() => {
    const lastEntry = undoStack[undoStack.length - 1]
    if (!lastEntry) return

    setNodeProperty(nodeId, lastEntry.propertyId, lastEntry.previousValue)
    setUndoStack((prev) => prev.slice(0, -1))
    toast.success(`Undid ${lastEntry.propertyId}`)
  }, [nodeId, undoStack, setNodeProperty])

  const handleQuickAction = useCallback(
    (actionPrompt: string) => {
      setPrompt(actionPrompt)
      handleSubmit(actionPrompt)
    },
    [handleSubmit]
  )

  // Find property definition for a suggestion
  const getPropertyDef = useCallback(
    (propertyId: string): PropertyDefinition | undefined => {
      return availableProperties.find((p) => p.id === propertyId)
    },
    [availableProperties]
  )

  // Render
  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          const newState = !isOpen
          setIsOpen(newState)
          if (newState && onOpen) {
            onOpen()
          }
        }}
        disabled={disabled}
        className={`
          ${compact ? 'p-1' : 'p-1.5'} rounded-lg transition-all
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'gui-button hover:text-blue-400'}
          ${isOpen ? 'text-blue-500 bg-blue-500/10' : 'gui-text-secondary'}
        `}
        title="AI Property Suggestions (Ctrl+Shift+A)"
        aria-label="AI Property Suggestions"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Sparkles className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isLoading ? 'animate-pulse' : ''}`} />
        {suggestions.length > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          id="ai-property-popover"
          role="dialog"
          aria-label="AI Property Suggestions"
          aria-modal="true"
          className="absolute right-0 top-full mt-2 w-80 glass-fluid gui-panel border gui-border rounded-xl shadow-xl z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b gui-border">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="font-medium gui-text text-sm">
                {suggestions.length > 0
                  ? `${suggestions.length} Suggestion${suggestions.length !== 1 ? 's' : ''}`
                  : 'AI Property Suggestions'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {undoStack.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="p-1 rounded gui-button hover:text-blue-400 transition-colors"
                  title="Undo last accept"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-1 rounded gui-button transition-colors"
              >
                <X className="w-4 h-4 gui-text-secondary" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* No API Key State */}
            {!hasApiKey && (
              <div className="text-center py-4">
                <Settings className="w-8 h-8 mx-auto mb-2 gui-text-secondary" />
                <p className="text-sm gui-text mb-1">API key required</p>
                <p className="text-xs gui-text-secondary mb-3">
                  Add your OpenAI or Anthropic key in workspace settings.
                </p>
                <button
                  onClick={() => {
                    handleClose()
                    window.dispatchEvent(new CustomEvent('open-settings'))
                  }}
                  className="px-3 py-1.5 text-xs rounded gui-button bg-blue-500/20 text-blue-400"
                >
                  Open Settings
                </button>
              </div>
            )}

            {/* Input Section */}
            {hasApiKey && suggestions.length === 0 && !isLoading && !error && (
              <>
                <div className="relative mb-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit()
                      }
                    }}
                    placeholder="Describe what you need..."
                    className="w-full gui-input border gui-border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleSubmit()}
                    disabled={!prompt.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded gui-button disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-blue-400" />
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {quickActions.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action.prompt)}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-full gui-button gui-panel-secondary transition-colors"
                        title={action.description}
                      >
                        <Icon className="w-3 h-3" />
                        {action.label}
                      </button>
                    )
                  })}
                </div>

                {/* Hint */}
                <p className="text-[11px] gui-text-secondary">
                  Try: "add tags for this {nodeData.type}"
                </p>
              </>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-sm gui-text-secondary">
                    Analyzing "{nodeData.title}"...
                  </span>
                </div>
                {/* Skeleton cards */}
                <div className="h-20 gui-panel-secondary rounded-lg animate-pulse" />
                <div className="h-20 gui-panel-secondary rounded-lg animate-pulse delay-75" />
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="text-center py-4">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                <p className="text-sm gui-text mb-1">{error}</p>
                <div className="flex justify-center gap-2 mt-3">
                  <button
                    onClick={() => handleSubmit()}
                    className="px-3 py-1.5 text-xs rounded gui-button bg-blue-500/20 text-blue-400"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => {
                      setError(null)
                      setPrompt('')
                    }}
                    className="px-3 py-1.5 text-xs rounded gui-button"
                  >
                    Change Prompt
                  </button>
                </div>
              </div>
            )}

            {/* Suggestions List */}
            {suggestions.length > 0 && !isLoading && (
              <div className="space-y-2" role="listbox">
                {suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.propertyId}
                    suggestion={suggestion}
                    propertyDef={getPropertyDef(suggestion.propertyId)}
                    onAccept={() => handleAccept(suggestion)}
                    onReject={() => handleReject(suggestion)}
                    isAnimatingOut={animatingOutId === suggestion.propertyId}
                  />
                ))}

                {/* Try another prompt */}
                <button
                  onClick={() => {
                    setSuggestions([])
                    setPrompt('')
                  }}
                  className="w-full text-xs gui-text-secondary hover:text-blue-400 py-2 transition-colors"
                >
                  Try another prompt...
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export const AIPropertyAssist = memo(AIPropertyAssistComponent)
export default AIPropertyAssist
