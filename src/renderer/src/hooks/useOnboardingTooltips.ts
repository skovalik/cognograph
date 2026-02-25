import { useEffect, useRef, useCallback } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useProgramStore, selectDismissedTooltips, selectHasCompletedOnboarding } from '../stores/programStore'

/**
 * Tooltip definitions: each maps a trigger condition to a message.
 * Tooltips are shown once per trigger and dismissed permanently.
 */
export interface TooltipDefinition {
  id: string
  message: string
  /** Which node type to anchor near (optional — used for positioning) */
  anchorNodeType?: string
}

export const ONBOARDING_TOOLTIPS: Record<string, TooltipDefinition> = {
  'first-note': {
    id: 'first-note',
    message: 'Connect this note to a conversation — AI will use its content as context.',
    anchorNodeType: 'note'
  },
  'first-edge': {
    id: 'first-edge',
    message: 'Context flows along edges. Connected conversations can now see this node\'s content.'
  },
  'first-edge-to-conversation': {
    id: 'first-edge-to-conversation',
    message: 'This conversation now has context! Check the context indicator in the chat panel.'
  },
  'first-task': {
    id: 'first-task',
    message: 'Tasks have status and priority. Connect them to conversations to provide AI context.',
    anchorNodeType: 'task'
  },
  'first-project': {
    id: 'first-project',
    message: 'Projects are containers. Drag nodes into a project to group them.',
    anchorNodeType: 'project'
  },
  'first-action': {
    id: 'first-action',
    message: 'Action nodes respond to events. Configure a trigger to automate your workflow.',
    anchorNodeType: 'action'
  },
  'first-command-palette': {
    id: 'first-command-palette',
    message: 'The Command Palette gives you quick access to everything. Try typing a node name!'
  }
}

export interface ActiveTooltip {
  id: string
  message: string
  /** Screen position to render near */
  position: { x: number; y: number } | null
  /** The triggering node ID, if applicable */
  nodeId?: string
}

/**
 * Hook that monitors workspace changes and triggers contextual onboarding tooltips.
 *
 * Returns the currently active tooltip (if any) and a dismiss function.
 * Only one tooltip is shown at a time. Tooltips auto-dismiss after 8 seconds.
 */
export function useOnboardingTooltips(): {
  activeTooltip: ActiveTooltip | null
  dismiss: () => void
} {
  const dismissedTooltips = useProgramStore(selectDismissedTooltips)
  const hasCompletedOnboarding = useProgramStore(selectHasCompletedOnboarding)
  const dismissTooltip = useProgramStore((s) => s.dismissTooltip)

  const activeTooltipRef = useRef<ActiveTooltip | null>(null)
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Use a simple state-like ref + forceUpdate pattern to avoid excessive re-renders
  const forceUpdateRef = useRef(0)
  const setActiveTooltip = useCallback((tooltip: ActiveTooltip | null) => {
    activeTooltipRef.current = tooltip
    // Clear any existing auto-dismiss timer
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current)
      autoDismissTimerRef.current = null
    }
    // Set auto-dismiss timer for 8 seconds
    if (tooltip) {
      autoDismissTimerRef.current = setTimeout(() => {
        if (activeTooltipRef.current?.id === tooltip.id) {
          dismissTooltip(tooltip.id)
          activeTooltipRef.current = null
          forceUpdateRef.current++
          // Trigger re-render
          window.dispatchEvent(new CustomEvent('onboarding-tooltip-update'))
        }
      }, 8000)
    }
    forceUpdateRef.current++
    window.dispatchEvent(new CustomEvent('onboarding-tooltip-update'))
  }, [dismissTooltip])

  const dismiss = useCallback(() => {
    const current = activeTooltipRef.current
    if (current) {
      dismissTooltip(current.id)
      setActiveTooltip(null)
    }
  }, [dismissTooltip, setActiveTooltip])

  // Listen for tooltip update events to trigger re-renders
  useEffect(() => {
    // We use a small trick: listen for our own custom event to force re-renders
    const handler = (): void => { forceUpdateRef.current++ }
    window.addEventListener('onboarding-tooltip-update', handler)
    return () => window.removeEventListener('onboarding-tooltip-update', handler)
  }, [])

  // Track previous counts for detecting "first time" events
  const prevCountsRef = useRef<{
    notes: number
    tasks: number
    projects: number
    actions: number
    edges: number
    edgesToConversation: number
  } | null>(null)

  useEffect(() => {
    // Don't show tooltips if onboarding hasn't been completed
    // (the WelcomeOverlay handles initial guidance)
    if (!hasCompletedOnboarding) return

    const dismissed = new Set(dismissedTooltips)

    function shouldShow(id: string): boolean {
      return !dismissed.has(id) && activeTooltipRef.current === null
    }

    function getNodeScreenPosition(nodeId: string): { x: number; y: number } | null {
      const el = document.querySelector(`[data-id="${nodeId}"]`)
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top - 10 }
    }

    // Subscribe to nodes and edges
    const unsubNodes = useWorkspaceStore.subscribe(
      (state) => state.nodes,
      (nodes) => {
        const counts = {
          notes: 0,
          tasks: 0,
          projects: 0,
          actions: 0,
          edges: useWorkspaceStore.getState().edges.length,
          edgesToConversation: 0
        }

        let lastNoteId = ''
        let lastTaskId = ''
        let lastProjectId = ''
        let lastActionId = ''

        for (const node of nodes) {
          if (node.data.isArchived) continue
          switch (node.data.type) {
            case 'note': counts.notes++; lastNoteId = node.id; break
            case 'task': counts.tasks++; lastTaskId = node.id; break
            case 'project': counts.projects++; lastProjectId = node.id; break
            case 'action': counts.actions++; lastActionId = node.id; break
          }
        }

        const prev = prevCountsRef.current
        if (!prev) {
          // First load — just record counts, don't show tooltips
          prevCountsRef.current = counts
          return
        }

        // Check for first-time creations
        if (counts.notes > prev.notes && prev.notes === 0 && shouldShow('first-note')) {
          setActiveTooltip({
            id: 'first-note',
            message: ONBOARDING_TOOLTIPS['first-note'].message,
            position: getNodeScreenPosition(lastNoteId),
            nodeId: lastNoteId
          })
        } else if (counts.tasks > prev.tasks && prev.tasks === 0 && shouldShow('first-task')) {
          setActiveTooltip({
            id: 'first-task',
            message: ONBOARDING_TOOLTIPS['first-task'].message,
            position: getNodeScreenPosition(lastTaskId),
            nodeId: lastTaskId
          })
        } else if (counts.projects > prev.projects && prev.projects === 0 && shouldShow('first-project')) {
          setActiveTooltip({
            id: 'first-project',
            message: ONBOARDING_TOOLTIPS['first-project'].message,
            position: getNodeScreenPosition(lastProjectId),
            nodeId: lastProjectId
          })
        } else if (counts.actions > prev.actions && prev.actions === 0 && shouldShow('first-action')) {
          setActiveTooltip({
            id: 'first-action',
            message: ONBOARDING_TOOLTIPS['first-action'].message,
            position: getNodeScreenPosition(lastActionId),
            nodeId: lastActionId
          })
        }

        prevCountsRef.current = counts
      },
      { equalityFn: Object.is }
    )

    const unsubEdges = useWorkspaceStore.subscribe(
      (state) => state.edges,
      (edges, prevEdges) => {
        if (!prevCountsRef.current) return

        const prev = prevCountsRef.current
        const newEdgeCount = edges.length

        // Detect first edge ever
        if (newEdgeCount > prev.edges && prev.edges === 0 && shouldShow('first-edge')) {
          setActiveTooltip({
            id: 'first-edge',
            message: ONBOARDING_TOOLTIPS['first-edge'].message,
            position: null
          })
        }
        // Detect first edge to a conversation node
        else if (newEdgeCount > (prevEdges?.length || 0) && shouldShow('first-edge-to-conversation')) {
          const nodes = useWorkspaceStore.getState().nodes
          const prevEdgeIds = new Set(prevEdges?.map(e => e.id) || [])
          const newEdges = edges.filter(e => !prevEdgeIds.has(e.id))

          for (const edge of newEdges) {
            const targetNode = nodes.find(n => n.id === edge.target)
            if (targetNode?.data.type === 'conversation') {
              setActiveTooltip({
                id: 'first-edge-to-conversation',
                message: ONBOARDING_TOOLTIPS['first-edge-to-conversation'].message,
                position: null,
                nodeId: edge.target
              })
              break
            }
          }
        }

        if (prevCountsRef.current) {
          prevCountsRef.current.edges = newEdgeCount
        }
      },
      { equalityFn: Object.is }
    )

    // Listen for command palette open (first time)
    const handleCommandPalette = (): void => {
      if (shouldShow('first-command-palette')) {
        setActiveTooltip({
          id: 'first-command-palette',
          message: ONBOARDING_TOOLTIPS['first-command-palette'].message,
          position: null
        })
      }
    }
    window.addEventListener('command-palette-opened', handleCommandPalette)

    return () => {
      unsubNodes()
      unsubEdges()
      window.removeEventListener('command-palette-opened', handleCommandPalette)
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current)
      }
    }
  }, [hasCompletedOnboarding, dismissedTooltips, setActiveTooltip])

  return {
    activeTooltip: activeTooltipRef.current,
    dismiss
  }
}
