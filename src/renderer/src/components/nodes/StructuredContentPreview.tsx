/**
 * StructuredContentPreview — Content density preview for zoomed-out LOD.
 *
 * Two rendering modes based on zoom level:
 * - far/ultra-far: Skeleton lines (abstract bars representing text density)
 *   with legible heading text. Zero text rendering for body = fast.
 * - mid: Actual readable text with heading hierarchy.
 *
 * Maximum 2 DOM elements at far zoom. No TipTap editor mounted.
 */

import { memo, useMemo } from 'react'
import type { ZoomLevel } from '../../hooks/useSemanticZoom'

interface StructuredContentPreviewProps {
  content: string
  zoomLevel: ZoomLevel
}

interface PreviewData {
  heading: string | null
  headingLevel: 1 | 2 | 3
  wordCount: number
  body: string
}

/** Single-pass extraction: first heading + word count + body text */
function extractPreview(html: string): PreviewData {
  let heading: string | null = null
  let headingLevel: 1 | 2 | 3 = 1

  const headingMatch = html.match(/<(h[1-3])[^>]*>(.*?)<\/\1>/i)
  if (headingMatch) {
    headingLevel = parseInt(headingMatch[1][1]) as 1 | 2 | 3
    heading = headingMatch[2].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  }

  const body = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = body ? body.split(/\s+/).length : 0

  return { heading, headingLevel, wordCount, body }
}

/** Heading font sizes by level and zoom */
const HEADING_SIZE: Record<ZoomLevel, [number, number, number]> = {
  'ultra-far': [10, 9, 8],
  'far':       [12, 11, 10],
  'mid':       [16, 14, 13],
  'close':     [20, 18, 16],
  'ultra-close': [20, 18, 16]
}

/**
 * Skeleton line rendering for far/ultra-far zoom.
 * Uses a single div with repeating-linear-gradient to create horizontal
 * bars representing text density. Zero child elements for body.
 *
 * Line height in canvas-space: 5px bar + 6px gap = 11px per line (4+5=9px at ultra-far).
 * At 25% zoom this renders as ~2.75px per line on screen — visible as texture.
 */
function SkeletonLines({ wordCount, heading, headingLevel, zoomLevel }: {
  wordCount: number
  heading: string | null
  headingLevel: 1 | 2 | 3
  zoomLevel: ZoomLevel
}): JSX.Element {
  // Approximate lines: ~3 words per line at typical node width
  const lineCount = Math.max(1, Math.ceil(wordCount / 3))
  const headingSizes = HEADING_SIZE[zoomLevel]
  const barHeight = zoomLevel === 'ultra-far' ? 4 : 5
  const gapHeight = zoomLevel === 'ultra-far' ? 5 : 6
  const step = barHeight + gapHeight
  const skeletonHeight = lineCount * step

  return (
    <div style={{ padding: '2px 4px', overflow: 'hidden' }}>
      {heading && (
        <div
          style={{
            fontSize: `${headingSizes[headingLevel - 1]}px`,
            fontWeight: headingLevel === 1 ? 700 : headingLevel === 2 ? 600 : 500,
            color: 'var(--node-text-primary)',
            lineHeight: 1.15,
            marginBottom: '3px',
            wordBreak: 'break-word'
          }}
        >
          {heading}
        </div>
      )}
      <div
        style={{
          height: `${skeletonHeight}px`,
          background: `repeating-linear-gradient(
            to bottom,
            var(--node-text-primary) 0px,
            var(--node-text-primary) ${barHeight}px,
            transparent ${barHeight}px,
            transparent ${step}px
          )`,
          opacity: 0.12,
          borderRadius: '1px',
          maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)'
        }}
      />
    </div>
  )
}

/**
 * Mid-zoom readable preview: actual text with heading hierarchy.
 */
function ReadablePreview({ heading, headingLevel, body, zoomLevel }: {
  heading: string | null
  headingLevel: 1 | 2 | 3
  body: string
  zoomLevel: ZoomLevel
}): JSX.Element {
  const headingSizes = HEADING_SIZE[zoomLevel]

  return (
    <div style={{ padding: '2px 6px', overflow: 'hidden' }}>
      {heading && (
        <div
          style={{
            fontSize: `${headingSizes[headingLevel - 1]}px`,
            fontWeight: headingLevel === 1 ? 700 : headingLevel === 2 ? 600 : 500,
            color: 'var(--node-text-primary)',
            lineHeight: 1.2,
            marginBottom: '2px',
            wordBreak: 'break-word'
          }}
        >
          {heading}
        </div>
      )}
      <div
        style={{
          fontSize: '11px',
          lineHeight: 1.3,
          color: 'var(--node-text-primary)',
          opacity: 0.8,
          wordBreak: 'break-word'
        }}
      >
        {body}
      </div>
    </div>
  )
}

function StructuredContentPreviewComponent({ content, zoomLevel }: StructuredContentPreviewProps): JSX.Element | null {
  const { heading, headingLevel, wordCount, body } = useMemo(() => extractPreview(content), [content])

  if (!body) {
    return (
      <div style={{ padding: '2px 4px', fontSize: '8px', color: 'var(--node-text-muted)', fontStyle: 'italic' }}>
        Empty
      </div>
    )
  }

  // Far/ultra-far: skeleton lines (abstract density representation)
  if (zoomLevel === 'far' || zoomLevel === 'ultra-far') {
    return <SkeletonLines wordCount={wordCount} heading={heading} headingLevel={headingLevel} zoomLevel={zoomLevel} />
  }

  // Mid: readable text preview
  return <ReadablePreview heading={heading} headingLevel={headingLevel} body={body} zoomLevel={zoomLevel} />
}

export const StructuredContentPreview = memo(StructuredContentPreviewComponent)
