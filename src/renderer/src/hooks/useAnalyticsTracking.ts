/**
 * Analytics Tracking Hook
 *
 * Automatically tracks onboarding metrics based on workspace activity.
 * Subscribes to workspace store changes and records first-time events.
 *
 * Created as part of Track 5 Phase 5.0: Analytics Baseline
 */

import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { useProgramStore } from '../stores/programStore'

export function useAnalyticsTracking() {
  const recordFirstNode = useAnalyticsStore((s) => s.recordFirstNode)
  const recordFirstConnection = useAnalyticsStore((s) => s.recordFirstConnection)
  const recordFirstChat = useAnalyticsStore((s) => s.recordFirstChat)
  const recordAhaMoment = useAnalyticsStore((s) => s.recordAhaMoment)
  const recordTutorialStarted = useAnalyticsStore((s) => s.recordTutorialStarted)
  const recordTutorialStepCompleted = useAnalyticsStore((s) => s.recordTutorialStepCompleted)
  const recordTutorialCompleted = useAnalyticsStore((s) => s.recordTutorialCompleted)

  // Track previous counts to detect new additions
  const prevNodeCount = useRef(0)
  const prevEdgeCount = useRef(0)
  const prevMessageCount = useRef(0)

  // Initialize baseline counts on mount
  useEffect(() => {
    const state = useWorkspaceStore.getState()
    prevNodeCount.current = state.nodes.length
    prevEdgeCount.current = state.edges.length

    // Count total messages across all conversation nodes
    const messageCount = state.nodes
      .filter((n) => n.data.type === 'conversation')
      .reduce((sum, n) => {
        const messages = (n.data as { messages?: unknown[] }).messages
        return sum + (messages?.length || 0)
      }, 0)
    prevMessageCount.current = messageCount
  }, [])

  // Subscribe to workspace changes
  useEffect(() => {
    const unsubscribe = useWorkspaceStore.subscribe(
      (state) => ({ nodes: state.nodes, edges: state.edges }),
      (current) => {
        // Detect first node creation
        if (current.nodes.length > prevNodeCount.current && prevNodeCount.current === 0) {
          recordFirstNode()
        }
        prevNodeCount.current = current.nodes.length

        // Detect first edge creation
        if (current.edges.length > prevEdgeCount.current && prevEdgeCount.current === 0) {
          recordFirstConnection()
        }
        prevEdgeCount.current = current.edges.length

        // Detect first AI message
        const messageCount = current.nodes
          .filter((n) => n.data.type === 'conversation')
          .reduce((sum, n) => {
            const messages = (n.data as { messages?: unknown[] }).messages
            return sum + (messages?.length || 0)
          }, 0)

        if (messageCount > prevMessageCount.current && prevMessageCount.current === 0) {
          recordFirstChat()
        }

        // Detect "aha! moment" — user sent message in conversation WITH connected context
        if (messageCount > prevMessageCount.current) {
          const conversationNodes = current.nodes.filter((n) => n.data.type === 'conversation')
          for (const convNode of conversationNodes) {
            // Check if this conversation has inbound edges (context sources)
            const hasContext = current.edges.some((e) => e.target === convNode.id)
            const messages = (convNode.data as { messages?: unknown[] }).messages || []

            // Aha moment = user message in a conversation with context
            if (hasContext && messages.length > 0) {
              const lastMessage = messages[messages.length - 1] as { role?: string }
              if (lastMessage.role === 'user') {
                recordAhaMoment()
                break
              }
            }
          }
        }

        prevMessageCount.current = messageCount
      },
      { equalityFn: (a, b) => a.nodes === b.nodes && a.edges === b.edges }
    )

    return unsubscribe
  }, [recordFirstNode, recordFirstConnection, recordFirstChat, recordAhaMoment])

  // Subscribe to tutorial state changes
  useEffect(() => {
    const unsubscribe = useProgramStore.subscribe(
      (state) => ({
        tutorialActive: state.tutorialActive,
        tutorialStep: state.tutorialStep,
        hasCompletedTutorial: state.hasCompletedTutorial
      }),
      (current, prev) => {
        // Tutorial started
        if (current.tutorialActive && !prev.tutorialActive) {
          recordTutorialStarted()
        }

        // Tutorial step completed
        if (current.tutorialStep !== prev.tutorialStep && prev.tutorialStep) {
          recordTutorialStepCompleted(prev.tutorialStep)
        }

        // Tutorial completed
        if (current.hasCompletedTutorial && !prev.hasCompletedTutorial) {
          recordTutorialCompleted()
        }
      }
    )

    return unsubscribe
  }, [recordTutorialStarted, recordTutorialStepCompleted, recordTutorialCompleted])

  // Record app launch on mount
  useEffect(() => {
    const recordAppLaunch = useAnalyticsStore.getState().recordAppLaunch
    recordAppLaunch()
  }, [])
}
