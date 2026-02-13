import { memo, useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * Mini Constellation Loader
 *
 * A small animated loader showing nodes with flowing edges,
 * matching the splash screen aesthetic.
 */

interface MiniConstellationLoaderProps {
  size?: number // Overall size (default 48)
  className?: string
}

// Mini node configuration
const MINI_NODES = [
  { x: 12, y: 8, color: '#a855f7' },   // Purple (project)
  { x: 28, y: 18, color: '#3b82f6' },  // Blue (conversation)
  { x: 8, y: 28, color: '#f59e0b' },   // Amber (note)
  { x: 24, y: 36, color: '#10b981' },  // Green (task)
  { x: 38, y: 28, color: '#f97316' }   // Orange (action)
]

// Edges connecting nodes
const MINI_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 3]
]

// Flow paths for animation
const FLOW_PATHS = [
  [0, 1, 2],
  [0, 1, 3],
  [0, 1, 4],
  [1, 2, 3],
  [0, 1, 2, 3, 4]
]

function MiniConstellationLoaderComponent({ size = 48, className = '' }: MiniConstellationLoaderProps): JSX.Element {
  const [activeNodes, setActiveNodes] = useState<Set<number>>(new Set())
  const flowIndexRef = useRef(0)

  // Cycle through flow paths
  useEffect(() => {
    const cycleDuration = 800 // Fast cycle for loading feel

    const cycleFlow = (): void => {
      const pathIndex = flowIndexRef.current % FLOW_PATHS.length
      setActiveNodes(new Set(FLOW_PATHS[pathIndex]))
      flowIndexRef.current++
    }

    // Start immediately
    cycleFlow()
    const interval = setInterval(cycleFlow, cycleDuration)

    return () => clearInterval(interval)
  }, [])

  const scale = size / 48

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 48 48"
        className="absolute inset-0 w-full h-full"
      >
        {/* Edges */}
        {MINI_EDGES.map(([from, to], idx) => {
          const fromNode = MINI_NODES[from]
          const toNode = MINI_NODES[to]
          const isActive = activeNodes.has(from) && activeNodes.has(to)

          return (
            <motion.line
              key={`edge-${idx}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={fromNode.color}
              strokeWidth={1.5}
              strokeLinecap="round"
              initial={{ opacity: 0.2 }}
              animate={{
                opacity: isActive ? 0.9 : 0.25,
                strokeDasharray: isActive ? '3 2' : 'none',
                strokeDashoffset: isActive ? [0, -5] : 0
              }}
              transition={{
                opacity: { duration: 0.3 },
                strokeDashoffset: isActive ? { duration: 0.4, repeat: Infinity, ease: 'linear' } : {}
              }}
            />
          )
        })}

        {/* Nodes */}
        {MINI_NODES.map((node, idx) => {
          const isActive = activeNodes.has(idx)
          const nodeSize = 6 * scale

          return (
            <motion.rect
              key={`node-${idx}`}
              x={node.x - 3}
              y={node.y - 3}
              width={6}
              height={6}
              rx={1}
              fill="rgba(13, 13, 20, 0.95)"
              stroke={node.color}
              strokeWidth={1.5}
              initial={{ opacity: 0.6 }}
              animate={{
                opacity: isActive ? 1 : 0.5,
                filter: isActive ? `drop-shadow(0 0 3px ${node.color})` : 'none'
              }}
              transition={{ duration: 0.3 }}
            />
          )
        })}
      </svg>
    </div>
  )
}

export const MiniConstellationLoader = memo(MiniConstellationLoaderComponent)
