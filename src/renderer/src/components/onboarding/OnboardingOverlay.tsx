/**
 * OnboardingOverlay — 5-step glassmorphic onboarding walkthrough
 *
 * Steps 0-2 (Welcome, Template Gallery, First Node) — Task 24
 * Steps 3-4 (Context Connection, First Success) — Task 25
 *
 * Renders a full-screen modal overlay with:
 * - Step indicator dots (5 dots, current highlighted)
 * - Step content area with custom renderers for interactive steps
 * - Skip button (always visible)
 * - Next/Continue button with smooth transitions
 *
 * Step 0 (Welcome): Brand moment with [Cognograph] bracket logo and value prop.
 * Step 1 (Template Gallery): 4 starter templates — selecting one creates nodes.
 * Step 2 (First Node): Pulsing "+" indicator. Auto-advances when first node is created.
 *   Skipped if a template with nodes was chosen in step 1.
 * Step 3 (Context Connection): Semi-transparent overlay — user can interact with canvas.
 *   Watches edge count and auto-advances when the first edge is created.
 * Step 4 (First Success): Celebration moment showing spatial context works.
 *   Displays connected node name if available. "You're ready" + dismiss.
 *
 * Visibility rules:
 * - Hidden when onboarding is completed (persisted in localStorage)
 * - Hidden when a workspace is already loaded (workspaceId exists)
 *
 * Uses the project's glass.css tier system for the modal card.
 */

import { memo, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  X,
  Check,
  Sparkles,
  Plus,
  Link2,
  PartyPopper,
  Rocket,
  FileText,
  Search,
  MessagesSquare,
  GitBranch,
  LayoutGrid
} from 'lucide-react'
import { useOnboardingStore } from '../../stores/onboardingStore'
import { usePersistenceStore } from '../../stores/persistenceStore'
import { useEdgesStore } from '../../stores/edgesStore'
import { useNodesStore } from '../../stores/nodesStore'
import { useAnalyticsStore } from '../../stores/analyticsStore'

// =============================================================================
// Constants
// =============================================================================

const TOTAL_STEPS = 5

// =============================================================================
// Starter Template Definitions (Step 1)
// =============================================================================

interface StarterTemplate {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  /** Node layout to create when this template is selected */
  nodes: Array<{
    type: 'conversation' | 'note' | 'task' | 'artifact' | 'project'
    title: string
    position: { x: number; y: number }
  }>
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'empty',
    title: 'Empty Canvas',
    description: 'Start from scratch with a blank workspace.',
    icon: LayoutGrid,
    nodes: []
  },
  {
    id: 'research',
    title: 'Research Pipeline',
    description: 'Notes, sources, and AI analysis in one flow.',
    icon: Search,
    nodes: [
      { type: 'note', title: 'Research Brief', position: { x: 100, y: 200 } },
      { type: 'note', title: 'Sources', position: { x: 100, y: 400 } },
      { type: 'conversation', title: 'AI Analysis', position: { x: 450, y: 300 } },
      { type: 'artifact', title: 'Findings', position: { x: 800, y: 300 } }
    ]
  },
  {
    id: 'multi-agent',
    title: 'Multi-Agent Chat',
    description: 'Multiple AI conversations sharing context.',
    icon: MessagesSquare,
    nodes: [
      { type: 'note', title: 'Shared Context', position: { x: 350, y: 100 } },
      { type: 'conversation', title: 'Claude', position: { x: 100, y: 350 } },
      { type: 'conversation', title: 'GPT-4', position: { x: 450, y: 350 } },
      { type: 'artifact', title: 'Combined Output', position: { x: 275, y: 550 } }
    ]
  },
  {
    id: 'code-review',
    title: 'Code Review Flow',
    description: 'Code artifacts with AI review and task tracking.',
    icon: GitBranch,
    nodes: [
      { type: 'artifact', title: 'Code to Review', position: { x: 100, y: 200 } },
      { type: 'conversation', title: 'Code Review AI', position: { x: 450, y: 200 } },
      { type: 'task', title: 'Review Checklist', position: { x: 450, y: 420 } },
      { type: 'note', title: 'Review Notes', position: { x: 100, y: 420 } }
    ]
  }
]

// =============================================================================
// Step Dots
// =============================================================================

interface StepDotsProps {
  current: number
  total: number
}

function StepDots({ current, total }: StepDotsProps): JSX.Element {
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Onboarding progress">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          role="tab"
          aria-selected={i === current}
          aria-label={`Step ${i + 1} of ${total}`}
          className="transition-all duration-300 rounded-full"
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            background:
              i === current
                ? 'var(--accent-glow, #C8963E)'
                : i < current
                  ? 'var(--text-secondary, #9E978D)'
                  : 'var(--text-muted, #5A554E)',
            opacity: i === current ? 1 : i < current ? 0.7 : 0.4
          }}
        />
      ))}
    </div>
  )
}

// =============================================================================
// Step 0: Welcome
// =============================================================================

interface WelcomeStepProps {
  onStart: () => void
}

function WelcomeStep({ onStart }: WelcomeStepProps): JSX.Element {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Bracket logo */}
      <div className="mb-6 mt-2">
        <span
          style={{
            fontFamily: 'var(--font-display, "Instrument Serif"), serif',
            fontStyle: 'italic',
            fontSize: '2.25rem',
            letterSpacing: '-0.02em',
            color: 'var(--text-primary, #EDE8E0)'
          }}
        >
          <span style={{ color: 'var(--accent-glow, #C8963E)', fontWeight: 400 }}>
            [
          </span>
          Cognograph
          <span style={{ color: 'var(--accent-glow, #C8963E)', fontWeight: 400 }}>
            ]
          </span>
        </span>
      </div>

      {/* Value prop */}
      <p
        className="text-base leading-relaxed mb-8 max-w-[360px]"
        style={{ color: 'var(--text-secondary, #9E978D)' }}
      >
        Orchestrate AI workflows spatially. Connect conversations, notes, and
        context on an infinite canvas.
      </p>

      {/* Start button */}
      <button
        onClick={onStart}
        className="gui-btn gui-btn-accent flex items-center gap-2 cursor-pointer px-6 py-2.5 text-sm"
      >
        Get Started
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// =============================================================================
// Step 1: Template Gallery
// =============================================================================

interface TemplateGalleryStepProps {
  onSelectTemplate: (template: StarterTemplate) => void
  selectedId: string | null
}

function TemplateGalleryStep({
  onSelectTemplate,
  selectedId
}: TemplateGalleryStepProps): JSX.Element {
  return (
    <div>
      {/* Header */}
      <div className="mb-1">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
          style={{
            background: 'var(--accent-glow-subtle, rgba(200, 150, 62, 0.15))',
            border: '1px solid var(--accent-glow-subtle, rgba(200, 150, 62, 0.15))'
          }}
        >
          <FileText className="w-5 h-5" style={{ color: 'var(--accent-glow, #C8963E)' }} />
        </div>
        <h2
          className="text-lg font-semibold mb-1"
          style={{ color: 'var(--text-primary, #EDE8E0)' }}
        >
          Choose a starting point
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-muted, #5A554E)' }}>
          Pick a template or start with a blank canvas. You can always change later.
        </p>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        {STARTER_TEMPLATES.map((template) => {
          const isSelected = selectedId === template.id
          const Icon = template.icon
          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className="text-left rounded-xl p-3.5 transition-all duration-200 cursor-pointer group"
              style={{
                background: isSelected
                  ? 'var(--accent-glow-subtle, rgba(200, 150, 62, 0.15))'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isSelected
                  ? '1px solid var(--accent-glow, #C8963E)'
                  : '1px solid var(--border-subtle, rgba(240, 237, 232, 0.06))',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                  e.currentTarget.style.borderColor =
                    'var(--border-default, rgba(240, 237, 232, 0.12))'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                  e.currentTarget.style.borderColor =
                    'var(--border-subtle, rgba(240, 237, 232, 0.06))'
                }
              }}
              aria-pressed={isSelected}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: isSelected
                      ? 'var(--accent-glow-subtle, rgba(200, 150, 62, 0.2))'
                      : 'rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{
                      color: isSelected
                        ? 'var(--accent-glow, #C8963E)'
                        : 'var(--text-secondary, #9E978D)'
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[13px] font-medium mb-0.5 truncate"
                    style={{
                      color: isSelected
                        ? 'var(--text-primary, #EDE8E0)'
                        : 'var(--text-secondary, #9E978D)'
                    }}
                  >
                    {template.title}
                  </div>
                  <div
                    className="text-[11px] leading-snug"
                    style={{ color: 'var(--text-muted, #5A554E)' }}
                  >
                    {template.description}
                  </div>
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <motion.div
                  className="flex items-center justify-end mt-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--accent-glow, #C8963E)' }}
                  >
                    <Check className="w-3 h-3 text-black" />
                  </div>
                </motion.div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// Step 2: First Node
// =============================================================================

interface FirstNodeStepProps {
  nodeCount: number
}

function FirstNodeStep({ nodeCount }: FirstNodeStepProps): JSX.Element {
  const hasNodes = nodeCount > 0

  return (
    <div className="flex flex-col items-center text-center">
      {/* Pulsing + indicator */}
      <div className="relative mb-6 mt-2">
        <motion.div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'var(--accent-glow-subtle, rgba(200, 150, 62, 0.15))',
            border: '1px solid var(--accent-glow-subtle, rgba(200, 150, 62, 0.2))'
          }}
          animate={
            hasNodes
              ? {}
              : {
                  boxShadow: [
                    '0 0 0 0px rgba(200, 150, 62, 0.3)',
                    '0 0 0 12px rgba(200, 150, 62, 0)',
                    '0 0 0 0px rgba(200, 150, 62, 0.3)'
                  ]
                }
          }
          transition={
            hasNodes
              ? {}
              : {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }
          }
        >
          {hasNodes ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Check
                className="w-7 h-7"
                style={{ color: 'var(--accent-glow, #C8963E)' }}
              />
            </motion.div>
          ) : (
            <Plus
              className="w-7 h-7"
              style={{ color: 'var(--accent-glow, #C8963E)' }}
            />
          )}
        </motion.div>
      </div>

      {/* Title */}
      <h2
        className="text-lg font-semibold mb-2"
        style={{ color: 'var(--text-primary, #EDE8E0)' }}
      >
        {hasNodes ? 'Node created!' : 'Create your first node'}
      </h2>

      {/* Description */}
      <p
        className="text-sm leading-relaxed mb-4 max-w-[340px]"
        style={{ color: 'var(--text-secondary, #9E978D)' }}
      >
        {hasNodes
          ? 'Great start. Nodes are the building blocks of your workspace.'
          : 'Double-click anywhere on the canvas, or use the + button in the toolbar to add a node.'}
      </p>

      {/* Hint text */}
      {!hasNodes && (
        <div
          className="text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{
            color: 'var(--text-muted, #5A554E)',
            background: 'rgba(255, 255, 255, 0.03)'
          }}
        >
          <Sparkles className="w-3 h-3" />
          Tip: Try right-clicking the canvas for more options
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Handle Spotlight Visual (SVG diagram for Step 3)
// =============================================================================

function HandleSpotlight(): JSX.Element {
  return (
    <div
      className="flex items-center justify-center gap-3 py-3 px-4 rounded-lg mb-2"
      style={{
        background: 'var(--accent-glow-subtle, rgba(200, 150, 62, 0.08))',
        border: '1px solid var(--accent-glow-subtle, rgba(200, 150, 62, 0.1))'
      }}
    >
      {/* Simplified node-to-node connection diagram */}
      <svg width="200" height="48" viewBox="0 0 200 48" fill="none">
        {/* Left node */}
        <rect x="4" y="10" width="56" height="28" rx="6" fill="rgba(200,150,62,0.15)" stroke="rgba(200,150,62,0.4)" strokeWidth="1" />
        <text x="32" y="28" textAnchor="middle" fill="#9E978D" fontSize="9" fontFamily="sans-serif">Note</text>
        {/* Right handle of left node */}
        <circle cx="64" cy="24" r="5" fill="#C8963E" stroke="#C8963E" strokeWidth="1.5">
          <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" />
        </circle>
        {/* Connection line (animated dash) */}
        <line x1="70" y1="24" x2="130" y2="24" stroke="#C8963E" strokeWidth="1.5" strokeDasharray="4 3">
          <animate attributeName="stroke-dashoffset" values="0;-14" dur="1s" repeatCount="indefinite" />
        </line>
        {/* Arrow */}
        <polygon points="128,20 136,24 128,28" fill="#C8963E" />
        {/* Left handle of right node */}
        <circle cx="136" cy="24" r="5" fill="#C8963E" stroke="#C8963E" strokeWidth="1.5">
          <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
          <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
        </circle>
        {/* Right node */}
        <rect x="140" y="10" width="56" height="28" rx="6" fill="rgba(200,150,62,0.15)" stroke="rgba(200,150,62,0.4)" strokeWidth="1" />
        <text x="168" y="28" textAnchor="middle" fill="#9E978D" fontSize="9" fontFamily="sans-serif">Chat</text>
      </svg>
    </div>
  )
}

// =============================================================================
// Celebration Visual (Step 4)
// =============================================================================

interface CelebrationContentProps {
  connectedNodeName: string | null
}

function CelebrationContent({ connectedNodeName }: CelebrationContentProps): JSX.Element {
  return (
    <div className="space-y-3">
      {/* Context proof banner */}
      {connectedNodeName && (
        <motion.div
          className="flex items-center gap-2.5 py-2.5 px-3.5 rounded-lg"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)'
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Check
            className="w-4 h-4 flex-shrink-0"
            style={{ color: '#10b981' }}
          />
          <span className="text-xs leading-relaxed" style={{ color: '#9FE2BF' }}>
            Context from <strong style={{ color: '#EDE8E0' }}>{connectedNodeName}</strong> is now
            available in connected conversations.
          </span>
        </motion.div>
      )}

      {/* Quick-start hints */}
      <div className="flex gap-2">
        {[
          { label: 'Templates', hint: 'Pre-built workflows' },
          { label: 'Themes', hint: 'Customize your look' },
          { label: 'Shortcuts', hint: 'Press ? for keys' }
        ].map(({ label, hint }) => (
          <div
            key={label}
            className="flex-1 py-2 px-2.5 rounded-lg text-center"
            style={{
              background: 'var(--accent-glow-subtle, rgba(200, 150, 62, 0.06))',
              border: '1px solid var(--accent-glow-subtle, rgba(200, 150, 62, 0.08))'
            }}
          >
            <div
              className="text-[11px] font-medium mb-0.5"
              style={{ color: 'var(--text-primary, #EDE8E0)' }}
            >
              {label}
            </div>
            <div
              className="text-[10px]"
              style={{ color: 'var(--text-muted, #5A554E)' }}
            >
              {hint}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Step metadata for steps 3-4 (used by generic renderer)
// =============================================================================

interface StepMeta {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  interactive?: boolean
  detail?: string
}

const STEP_META: Record<number, StepMeta> = {
  3: {
    title: 'Connect Context',
    description:
      'Drag from one node\'s handle to another to share context. Connected notes automatically feed into AI conversations.',
    icon: Link2,
    interactive: true,
    detail:
      'Hover over a node to reveal its handles (the small circles on each edge). Click and drag from a handle to another node to create a connection.'
  },
  4: {
    title: 'You\'re Ready',
    description:
      'You\'ve got the basics. Explore templates, customize your theme, and build your knowledge graph.',
    icon: Rocket
  }
}

// =============================================================================
// Main Component
// =============================================================================

function OnboardingOverlayComponent(): JSX.Element | null {
  const step = useOnboardingStore((s) => s.step)
  const completed = useOnboardingStore((s) => s.completed)
  const advance = useOnboardingStore((s) => s.advance)
  const goToStep = useOnboardingStore((s) => s.goToStep)
  const skip = useOnboardingStore((s) => s.skip)
  const selectedTemplate = useOnboardingStore((s) => s.selectedTemplate)
  const setSelectedTemplate = useOnboardingStore((s) => s.setSelectedTemplate)
  const workspaceId = usePersistenceStore((s) => s.workspaceId)

  // Node count for step 2 (First Node) auto-advance
  const nodeCount = useNodesStore((s) => s.nodes.length)
  const addNode = useNodesStore((s) => s.addNode)
  const recordTemplateUsed = useAnalyticsStore((s) => s.recordTemplateUsed)

  // Edge count for auto-advance on Step 3 (Context Connection)
  const edgeCount = useEdgesStore((s) => s.edges.length)
  const edgeCountAtStepEntry = useRef<number | null>(null)

  // Track first connected node name for Step 4 celebration
  const connectedNodeNameRef = useRef<string | null>(null)
  const edges = useEdgesStore((s) => s.edges)
  const nodes = useNodesStore((s) => s.nodes)

  // Track whether we've already auto-advanced from step 2 (First Node)
  const hasAutoAdvancedStep2 = useRef(false)

  // --- Step 2: Auto-advance when first node is created ---
  useEffect(() => {
    if (step === 2 && nodeCount > 0 && !hasAutoAdvancedStep2.current) {
      hasAutoAdvancedStep2.current = true
      // Brief delay so the user sees the checkmark animation
      const timer = setTimeout(() => {
        advance()
      }, 800)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [step, nodeCount, advance])

  // Reset auto-advance ref when step changes away from 2
  useEffect(() => {
    if (step !== 2) {
      hasAutoAdvancedStep2.current = false
    }
  }, [step])

  // --- Step 3: Capture edge count when entering, auto-advance on new edge ---
  useEffect(() => {
    if (step === 3) {
      edgeCountAtStepEntry.current = edgeCount
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 3) return undefined
    if (edgeCountAtStepEntry.current === null) return undefined
    if (edgeCount > edgeCountAtStepEntry.current) {
      // An edge was created — find the connected node name for the celebration
      const latestEdge = edges[edges.length - 1]
      if (latestEdge) {
        const sourceNode = nodes.find((n) => n.id === latestEdge.source)
        const targetNode = nodes.find((n) => n.id === latestEdge.target)
        const name =
          (sourceNode?.data as { title?: string })?.title ||
          (targetNode?.data as { title?: string })?.title ||
          null
        connectedNodeNameRef.current = name
      }
      const timer = setTimeout(() => advance(), 600)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [step, edgeCount, edges, nodes, advance])

  // Derive connected node name for step 4
  const connectedNodeName = useMemo(() => {
    if (step !== 4) return null
    if (connectedNodeNameRef.current) return connectedNodeNameRef.current
    if (edges.length > 0) {
      const firstEdge = edges[0]
      if (firstEdge) {
        const sourceNode = nodes.find((n) => n.id === firstEdge.source)
        return (sourceNode?.data as { title?: string })?.title || null
      }
    }
    return null
  }, [step, edges, nodes])

  // --- Handlers ---

  const handleSkip = useCallback(() => {
    skip()
  }, [skip])

  const handleNext = useCallback(() => {
    advance()
  }, [advance])

  const handleWelcomeStart = useCallback(() => {
    advance()
  }, [advance])

  const handleSelectTemplate = useCallback(
    (template: StarterTemplate) => {
      setSelectedTemplate(template.id)
    },
    [setSelectedTemplate]
  )

  const handleTemplateConfirm = useCallback(() => {
    const template = STARTER_TEMPLATES.find((t) => t.id === selectedTemplate)

    if (template && template.nodes.length > 0) {
      // Create nodes from template
      for (const nodeDef of template.nodes) {
        const nodeId = addNode(nodeDef.type, nodeDef.position)
        useNodesStore.getState().updateNode(nodeId, { title: nodeDef.title })
      }
      recordTemplateUsed(template.id)
      // Skip First Node step (step 2) — template already has nodes
      goToStep(3)
    } else {
      // Empty canvas — go to First Node step
      if (selectedTemplate) {
        recordTemplateUsed(selectedTemplate)
      }
      advance()
    }
  }, [selectedTemplate, addNode, advance, goToStep, recordTemplateUsed])

  // --- Render guards ---

  if (completed) return null
  if (workspaceId) return null

  const isLastStep = step >= TOTAL_STEPS - 1
  const isWelcomeStep = step === 0
  const isTemplateStep = step === 1
  const isFirstNodeStep = step === 2
  const currentMeta = STEP_META[step]
  const isInteractiveStep =
    (isFirstNodeStep && nodeCount === 0) || (currentMeta?.interactive === true)

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9998] flex items-end justify-center"
        style={{
          pointerEvents: isInteractiveStep ? 'none' : 'auto',
          alignItems: currentMeta?.interactive ? 'flex-end' : 'center',
          paddingBottom: currentMeta?.interactive ? '24px' : '0'
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Backdrop — lighter on interactive steps so canvas is visible */}
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            background: isInteractiveStep
              ? 'rgba(0, 0, 0, 0.25)'
              : 'rgba(0, 0, 0, 0.6)',
            backdropFilter: isInteractiveStep ? 'none' : 'blur(4px)',
            pointerEvents: isInteractiveStep ? 'none' : 'auto'
          }}
        />

        {/* Card — uses glass-soft for consistent glassmorphism */}
        <motion.div
          className={`relative ${isTemplateStep ? 'w-[560px]' : 'w-[520px]'} max-w-[90vw] glass-soft rounded-2xl overflow-hidden`}
          style={{
            boxShadow:
              '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(200, 150, 62, 0.08)',
            pointerEvents: 'auto'
          }}
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          layout
        >
          {/* Skip button — always visible */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1.5 rounded-lg gui-text-secondary hover:gui-text transition-colors opacity-60 hover:opacity-100 cursor-pointer z-10"
            title="Skip onboarding"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="px-8 pt-8 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                {/* Step 0: Welcome */}
                {isWelcomeStep && <WelcomeStep onStart={handleWelcomeStart} />}

                {/* Step 1: Template Gallery */}
                {isTemplateStep && (
                  <TemplateGalleryStep
                    onSelectTemplate={handleSelectTemplate}
                    selectedId={selectedTemplate}
                  />
                )}

                {/* Step 2: First Node */}
                {isFirstNodeStep && <FirstNodeStep nodeCount={nodeCount} />}

                {/* Step 3: Connect Context */}
                {step === 3 && currentMeta && (() => {
                  const StepIcon = currentMeta.icon
                  return (
                    <>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                        style={{
                          background: 'var(--accent-glow-subtle, rgba(200, 150, 62, 0.15))',
                          border: '1px solid var(--accent-glow-subtle, rgba(200, 150, 62, 0.15))'
                        }}
                      >
                        <StepIcon
                          className="w-6 h-6"
                          style={{ color: 'var(--accent-glow, #C8963E)' }}
                        />
                      </div>
                      <h2
                        className="text-xl font-semibold mb-2"
                        style={{ color: 'var(--text-primary, #EDE8E0)' }}
                      >
                        {currentMeta.title}
                      </h2>
                      <p
                        className="text-sm leading-relaxed mb-3"
                        style={{ color: 'var(--text-secondary, #9E978D)' }}
                      >
                        {currentMeta.description}
                      </p>
                      <HandleSpotlight />
                      <p
                        className="text-xs leading-relaxed mb-4"
                        style={{ color: 'var(--text-muted, #5A554E)' }}
                      >
                        {currentMeta.detail}
                      </p>
                      <div
                        className="flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-md mb-3"
                        style={{
                          background: 'rgba(200, 150, 62, 0.06)',
                          color: 'var(--text-secondary, #9E978D)'
                        }}
                      >
                        <Sparkles className="w-3 h-3" style={{ color: 'var(--accent-glow, #C8963E)' }} />
                        Create a connection and this step will complete automatically
                      </div>
                    </>
                  )
                })()}

                {/* Step 4: You're Ready */}
                {step === 4 && currentMeta && (() => {
                  const StepIcon = currentMeta.icon
                  return (
                    <>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.25)'
                        }}
                      >
                        <StepIcon
                          className="w-6 h-6"
                          style={{ color: '#10b981' }}
                        />
                      </div>
                      <h2
                        className="text-xl font-semibold mb-2"
                        style={{ color: 'var(--text-primary, #EDE8E0)' }}
                      >
                        {currentMeta.title}
                      </h2>
                      <p
                        className="text-sm leading-relaxed mb-3"
                        style={{ color: 'var(--text-secondary, #9E978D)' }}
                      >
                        {currentMeta.description}
                      </p>
                      <CelebrationContent connectedNodeName={connectedNodeName} />
                    </>
                  )
                })()}
              </motion.div>
            </AnimatePresence>

            {/* Step dots + action buttons */}
            {!isWelcomeStep && (
              <div className="flex items-center justify-between mt-5">
                <StepDots current={step} total={TOTAL_STEPS} />

                {isTemplateStep ? (
                  <button
                    onClick={handleTemplateConfirm}
                    className="gui-btn gui-btn-accent gui-btn-sm flex items-center gap-1.5 cursor-pointer"
                    disabled={selectedTemplate === null}
                    style={{
                      opacity: selectedTemplate === null ? 0.5 : 1
                    }}
                  >
                    Continue
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : isFirstNodeStep ? (
                  nodeCount > 0 ? (
                    <button
                      onClick={handleNext}
                      className="gui-btn gui-btn-accent gui-btn-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      Continue
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span
                      className="text-[11px]"
                      style={{ color: 'var(--text-muted, #5A554E)' }}
                    >
                      Waiting for first node...
                    </span>
                  )
                ) : (
                  <button
                    onClick={handleNext}
                    className="gui-btn gui-btn-accent gui-btn-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {isLastStep ? (
                      <>
                        Get Started
                        <PartyPopper className="w-3.5 h-3.5" />
                      </>
                    ) : step === 3 ? (
                      <>
                        Skip Step
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-8 py-3 flex items-center justify-end"
            style={{
              borderTop: '1px solid var(--border-subtle, rgba(240,237,232,0.06))'
            }}
          >
            <button
              onClick={handleSkip}
              className="text-[11px] transition-colors underline underline-offset-2 cursor-pointer"
              style={{ color: 'var(--text-muted, #5A554E)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = 'var(--text-secondary, #9E978D)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = 'var(--text-muted, #5A554E)')
              }
            >
              Skip — I'll explore on my own
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export const OnboardingOverlay = memo(OnboardingOverlayComponent)
export default OnboardingOverlay
