// src/renderer/src/components/edges/__tests__/CustomEdge.lod.test.tsx

import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePerfStore } from '../../../stores/perfStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { CustomEdge } from '../CustomEdge'

const mockEdgeProps = {
  id: 'e1',
  source: 'a',
  target: 'b',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  data: { strength: 'normal', semanticType: 'custom' },
} as any

describe('CustomEdge LOD by effectiveTier', () => {
  beforeEach(() => {
    localStorage.clear()
    usePerfStore.setState({
      perfMode: 'auto',
      zoomTier: 'full',
      nodeCountTier: 'full',
      fpsTier: 'full',
      effectiveTier: 'full',
    })
    // Seed minimum workspace state — CustomEdge reads themeSettings.{edgeStyle, mode, linkColors, linkGradientEnabled}
    // and node lookups via useWorkspaceStore selectors. Without these the component throws on render.
    useWorkspaceStore.setState(
      {
        nodes: [
          { id: 'a', type: 'task', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'b', type: 'task', position: { x: 100, y: 100 }, data: { label: 'B' } },
        ],
        edges: [],
        themeSettings: {
          edgeStyle: 'smooth',
          mode: 'dark',
          linkColors: {},
          linkGradientEnabled: true,
          nodeColors: {},
        } as any,
      } as any,
      false,
    )
  })

  it('effectiveTier=full → renders defs (gradients allowed)', () => {
    usePerfStore.setState({ effectiveTier: 'full' })
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge {...mockEdgeProps} />
        </svg>
      </ReactFlowProvider>,
    )
    // Full edge has either marker-end OR a label; skeleton has neither
    const hasFullDOM = container.querySelector('[marker-end]') || container.querySelector('text')
    expect(hasFullDOM).toBeTruthy()
  })

  it('effectiveTier=minimal → renders skeleton (single path + arrow polygon, no defs)', () => {
    usePerfStore.setState({ effectiveTier: 'minimal' })
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge {...mockEdgeProps} />
        </svg>
      </ReactFlowProvider>,
    )
    expect(container.querySelector('text')).toBeNull()
    expect(container.querySelector('[marker-end]')).toBeNull()
    expect(container.querySelector('polygon')).toBeTruthy()
  })

  it('effectiveTier=reduced → renders without color tint (semantic-strip)', () => {
    usePerfStore.setState({ effectiveTier: 'reduced' })
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <CustomEdge {...mockEdgeProps} />
        </svg>
      </ReactFlowProvider>,
    )
    const path = container.querySelector('path')
    expect(path?.getAttribute('style') ?? '').not.toMatch(/color-mix/)
  })
})
