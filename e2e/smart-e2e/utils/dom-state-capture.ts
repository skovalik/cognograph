/**
 * DOM State Capture for Hallucination Detection
 *
 * Captures actual clickable elements from DOM to verify AI's claimed
 * click targets exist and are visible.
 */

import type { Page } from '@playwright/test'

export interface ClickableElement {
  /** Element type */
  type: string
  /** Text content (if any) */
  text: string
  /** ARIA label or title */
  label: string | null
  /** CSS selector (best effort) */
  selector: string
  /** Bounding box */
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Is visible */
  visible: boolean
  /** Data attributes */
  dataAttrs: Record<string, string>
}

export interface DOMState {
  /** Timestamp */
  timestamp: string
  /** All clickable elements */
  clickables: ClickableElement[]
  /** React Flow nodes */
  nodes: Array<{ id: string; type: string; position: { x: number; y: number } }>
  /** React Flow edges */
  edges: Array<{ id: string; source: string; target: string }>
}

/**
 * Capture all clickable elements from the page
 */
export async function captureClickableElements(page: Page): Promise<ClickableElement[]> {
  return page.evaluate(() => {
    const clickableSelectors = [
      'button',
      'a',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]',
      'input[type="button"]',
      'input[type="submit"]',
      '[onclick]',
      '[data-testid]'
    ]

    const elements = document.querySelectorAll(clickableSelectors.join(','))
    const result: ClickableElement[] = []

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect()

      // Check visibility (use checkVisibility if available, fallback to dimension check)
      const visible = (el as HTMLElement).checkVisibility?.() ?? (rect.width > 0 && rect.height > 0)

      // Get data attributes
      const dataAttrs: Record<string, string> = {}
      if (el instanceof HTMLElement) {
        Array.from(el.attributes).forEach((attr) => {
          if (attr.name.startsWith('data-')) {
            dataAttrs[attr.name] = attr.value
          }
        })
      }

      // Try to generate a selector
      let selector = el.tagName.toLowerCase()
      if (el.id) {
        selector = `#${el.id}`
      } else if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(Boolean).slice(0, 2)
        if (classes.length) {
          selector = `${selector}.${classes.join('.')}`
        }
      }

      result.push({
        type: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().substring(0, 100),
        label: el.getAttribute('aria-label') || el.getAttribute('title'),
        selector,
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        },
        visible,
        dataAttrs
      })
    })

    return result
  })
}

/**
 * Capture React Flow graph state
 */
export async function captureGraphState(page: Page): Promise<{
  nodes: Array<{ id: string; type: string; position: { x: number; y: number } }>
  edges: Array<{ id: string; source: string; target: string }>
}> {
  return page.evaluate(() => {
    const nodeElements = document.querySelectorAll('.react-flow__node')
    const edgeElements = document.querySelectorAll('.react-flow__edge')

    const nodes: Array<{ id: string; type: string; position: { x: number; y: number } }> = []
    const edges: Array<{ id: string; source: string; target: string }> = []

    nodeElements.forEach((el) => {
      const id = el.getAttribute('data-id') || ''
      const type = el.classList.toString().match(/react-flow__node-(\w+)/)?.[1] || 'unknown'
      const transform = window.getComputedStyle(el).transform
      const match = transform.match(/matrix\(1, 0, 0, 1, ([\d.-]+), ([\d.-]+)\)/)
      const x = match ? parseFloat(match[1]) : 0
      const y = match ? parseFloat(match[2]) : 0

      nodes.push({ id, type, position: { x, y } })
    })

    edgeElements.forEach((el) => {
      const id = el.getAttribute('data-id') || ''
      const source = el.getAttribute('data-source') || ''
      const target = el.getAttribute('data-target') || ''

      edges.push({ id, source, target })
    })

    return { nodes, edges }
  })
}

/**
 * Capture complete DOM state
 */
export async function captureDOMState(page: Page): Promise<DOMState> {
  const [clickables, graph] = await Promise.all([
    captureClickableElements(page),
    captureGraphState(page)
  ])

  return {
    timestamp: new Date().toISOString(),
    clickables,
    nodes: graph.nodes,
    edges: graph.edges
  }
}

/**
 * Verify AI's claimed click target exists in DOM
 */
export function verifyClickTarget(
  domState: DOMState,
  aiClaim: { target: string; location?: string }
): { exists: boolean; matches: ClickableElement[]; confidence: 'high' | 'medium' | 'low' } {
  const target = aiClaim.target.toLowerCase()
  const matches: ClickableElement[] = []

  // Search for matching elements
  domState.clickables.forEach((el) => {
    const textMatch = el.text.toLowerCase().includes(target)
    const labelMatch = el.label?.toLowerCase().includes(target)
    const selectorMatch = el.selector.toLowerCase().includes(target)

    if ((textMatch || labelMatch || selectorMatch) && el.visible) {
      matches.push(el)
    }
  })

  const exists = matches.length > 0
  const confidence = matches.length === 1 ? 'high' : matches.length > 1 ? 'medium' : 'low'

  return { exists, matches, confidence }
}
