/**
 * PipelineDiagram — Visual pipeline of orchestrator agents as status circles.
 *
 * Renders agents as a horizontal pipeline of status circles with arrows
 * between them.  WCAG: shape redundancy for each status (not just color):
 * - pending:  hollow circle (gray)
 * - running:  filled circle + pulse (green)
 * - complete: checkmark in circle (green)
 * - error:    triangle (red)
 *
 * Phase 3B artboard panel.
 */

import React, { memo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentPipelineStatus = 'pending' | 'running' | 'complete' | 'error'

export interface PipelineAgent {
  id: string
  name: string
  status: AgentPipelineStatus
}

export interface PipelineDiagramProps {
  agents: PipelineAgent[]
  className?: string
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  AgentPipelineStatus,
  { fill: string; stroke: string; label: string }
> = {
  pending:  { fill: 'none',    stroke: '#6b7280', label: 'Pending' },
  running:  { fill: '#22c55e', stroke: '#22c55e', label: 'Running' },
  complete: { fill: '#22c55e', stroke: '#22c55e', label: 'Complete' },
  error:    { fill: '#ef4444', stroke: '#ef4444', label: 'Error' },
}

const CIRCLE_R = 14
const SPACING = 80
const PADDING_X = 30
const PADDING_Y = 20
const LABEL_Y_OFFSET = 24

// ---------------------------------------------------------------------------
// SVG shapes per status (WCAG shape redundancy)
// ---------------------------------------------------------------------------

function PendingShape({ cx, cy }: { cx: number; cy: number }): JSX.Element {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={CIRCLE_R}
      fill="none"
      stroke="#6b7280"
      strokeWidth={2}
      strokeDasharray="4 2"
    />
  )
}

function RunningShape({ cx, cy }: { cx: number; cy: number }): JSX.Element {
  return (
    <>
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill="#22c55e" stroke="#22c55e" strokeWidth={2}>
        <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
      {/* Pulse ring */}
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill="none" stroke="#22c55e" strokeWidth={1}>
        <animate attributeName="r" values={`${CIRCLE_R};${CIRCLE_R + 6}`} dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </>
  )
}

function CompleteShape({ cx, cy }: { cx: number; cy: number }): JSX.Element {
  return (
    <>
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill="#22c55e" stroke="#22c55e" strokeWidth={2} />
      {/* Checkmark */}
      <polyline
        points={`${cx - 5},${cy} ${cx - 1},${cy + 4} ${cx + 6},${cy - 5}`}
        fill="none"
        stroke="#fff"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  )
}

function ErrorShape({ cx, cy }: { cx: number; cy: number }): JSX.Element {
  const s = CIRCLE_R
  return (
    <>
      {/* Triangle */}
      <polygon
        points={`${cx},${cy - s} ${cx - s},${cy + s * 0.7} ${cx + s},${cy + s * 0.7}`}
        fill="#ef4444"
        stroke="#ef4444"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      {/* Exclamation mark */}
      <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 2} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy + 6} r={1.2} fill="#fff" />
    </>
  )
}

const SHAPE_COMPONENTS: Record<AgentPipelineStatus, React.FC<{ cx: number; cy: number }>> = {
  pending: PendingShape,
  running: RunningShape,
  complete: CompleteShape,
  error: ErrorShape,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PipelineDiagramComponent({ agents, className }: PipelineDiagramProps): JSX.Element {
  if (agents.length === 0) {
    return (
      <div
        className={`pipeline-diagram flex items-center justify-center h-full text-xs ${className ?? ''}`}
        style={{ color: 'var(--text-muted, #888)' }}
        aria-label="Pipeline diagram"
      >
        No agents in pipeline.
      </div>
    )
  }

  const svgWidth = PADDING_X * 2 + (agents.length - 1) * SPACING + CIRCLE_R * 2
  const svgHeight = PADDING_Y * 2 + CIRCLE_R * 2 + LABEL_Y_OFFSET + 12

  return (
    <div
      className={`pipeline-diagram flex items-center justify-center overflow-x-auto p-2 ${className ?? ''}`}
      aria-label="Pipeline diagram"
      role="img"
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="flex-shrink-0"
      >
        {/* Arrows between agents */}
        {agents.slice(0, -1).map((_, i) => {
          const x1 = PADDING_X + CIRCLE_R + i * SPACING + CIRCLE_R + 4
          const x2 = PADDING_X + CIRCLE_R + (i + 1) * SPACING - CIRCLE_R - 4
          const cy = PADDING_Y + CIRCLE_R
          return (
            <g key={`arrow-${i}`}>
              <line
                x1={x1}
                y1={cy}
                x2={x2}
                y2={cy}
                stroke="var(--text-muted, #555)"
                strokeWidth={1.5}
              />
              {/* Arrowhead */}
              <polygon
                points={`${x2},${cy} ${x2 - 5},${cy - 3} ${x2 - 5},${cy + 3}`}
                fill="var(--text-muted, #555)"
              />
            </g>
          )
        })}

        {/* Agent nodes */}
        {agents.map((agent, i) => {
          const cx = PADDING_X + CIRCLE_R + i * SPACING
          const cy = PADDING_Y + CIRCLE_R
          const Shape = SHAPE_COMPONENTS[agent.status]
          const cfg = STATUS_CONFIG[agent.status]

          return (
            <g key={agent.id} role="img" aria-label={`${agent.name}: ${cfg.label}`}>
              <Shape cx={cx} cy={cy} />
              {/* Label below */}
              <text
                x={cx}
                y={cy + CIRCLE_R + LABEL_Y_OFFSET - 8}
                textAnchor="middle"
                fill="var(--text-secondary, #bbb)"
                fontSize={10}
                fontFamily="Inter, sans-serif"
              >
                {agent.name.length > 10 ? agent.name.slice(0, 9) + '\u2026' : agent.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export const PipelineDiagram = memo(PipelineDiagramComponent)
