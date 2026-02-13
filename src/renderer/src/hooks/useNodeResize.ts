import { useEffect, useRef } from 'react'
import { useUpdateNodeInternals } from '@xyflow/react'

// Module-level singleton — one ResizeObserver for ALL nodes
let sharedObserver: ResizeObserver | null = null
const callbacks = new Map<Element, () => void>()

function getSharedObserver(): ResizeObserver {
  if (!sharedObserver) {
    sharedObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cb = callbacks.get(entry.target)
        if (cb) cb()
      }
    })
  }
  return sharedObserver
}

/**
 * Hook that monitors a node's DOM element for size changes and calls
 * updateNodeInternals when dimensions change. Uses a shared singleton
 * ResizeObserver across all nodes to avoid per-node observer overhead.
 *
 * Returns a ref to attach to the node's root container div.
 */
export function useNodeResize(id: string) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const updateNodeInternals = useUpdateNodeInternals()
  // Track previous dimensions to prevent no-op updates (guards against infinite loops)
  const prevSize = useRef({ w: 0, h: 0 })

  useEffect(() => {
    const el = nodeRef.current
    if (!el) return

    let timeoutId: ReturnType<typeof setTimeout>
    const observer = getSharedObserver()

    const callback = () => {
      const { offsetWidth: w, offsetHeight: h } = el
      // Skip if dimensions haven't actually changed
      if (w === prevSize.current.w && h === prevSize.current.h) return
      prevSize.current = { w, h }

      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => updateNodeInternals(id), 100)
    }

    callbacks.set(el, callback)
    observer.observe(el)

    return () => {
      clearTimeout(timeoutId)
      observer.unobserve(el)
      callbacks.delete(el)
    }
  }, [id, updateNodeInternals])

  return nodeRef
}
