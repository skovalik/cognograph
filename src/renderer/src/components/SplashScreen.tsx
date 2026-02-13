import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Splash Screen - Node Constellation
 *
 * Shows a constellation of colored nodes with edges connecting them.
 * Flow paths cycle through, lighting up different nodes to show
 * the concept of context flowing through the graph.
 */

// Node types with their colors (matching design tokens)
const NODE_TYPES = [
  { type: 'conversation', color: '#3b82f6' },
  { type: 'project', color: '#a855f7' },
  { type: 'note', color: '#f59e0b' },
  { type: 'project', color: '#a855f7' },
  { type: 'task', color: '#10b981' },
  { type: 'artifact', color: '#06b6d4' },
  { type: 'action', color: '#f97316' },
  { type: 'note', color: '#f59e0b' },
  { type: 'project', color: '#a855f7' },
  { type: 'note', color: '#f59e0b' }
]

// Base positions for nodes (will be jittered)
const BASE_POSITIONS = [
  { x: 184, y: 51 },
  { x: 104, y: 91 },
  { x: 264, y: 86 },
  { x: 54, y: 141 },
  { x: 134, y: 146 },
  { x: 184, y: 146 },
  { x: 234, y: 141 },
  { x: 304, y: 136 },
  { x: 84, y: 191 },
  { x: 284, y: 186 }
]

// Edge definitions: [fromNode, toNode]
const EDGES = [
  [0, 1], [0, 2],  // From conversation
  [1, 3], [1, 4],  // From project-1
  [2, 6], [2, 7],  // From note-1
  [4, 5],          // Task → Artifact
  [5, 6],          // Artifact → Action
  [3, 8],          // Project → Project-child
  [7, 9]           // Note → Note-child
]

// Flow paths: which nodes light up for each animation cycle
const FLOW_PATHS = [
  [0, 1, 4],           // Conversation → Project → Task
  [0, 2, 6],           // Conversation → Note → Action
  [4, 5, 6],           // Task → Artifact → Action
  [0, 1, 3, 8],        // Conversation → Project chain
  [0, 2, 7, 9],        // Conversation → Note chain
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] // All lit
]

interface NodeData {
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
  color: string
  delay: number
}

export const SplashScreen = memo(function SplashScreen() {
  const [nodes, setNodes] = useState<NodeData[]>([])
  const [activeNodes, setActiveNodes] = useState<Set<number>>(new Set())
  const [fadingNodes, setFadingNodes] = useState<Set<number>>(new Set())
  const flowIndexRef = useRef(0)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Initialize nodes with random sizes and positions
  useEffect(() => {
    const aspectRatios = [
      { w: 36, h: 18 },
      { w: 32, h: 18 },
      { w: 26, h: 20 },
      { w: 22, h: 22 },
      { w: 20, h: 26 },
      { w: 18, h: 30 }
    ]

    const nodeData: NodeData[] = []
    const jitter = 18

    BASE_POSITIONS.forEach((pos, index) => {
      const ratio = aspectRatios[Math.floor(Math.random() * aspectRatios.length)]
      const sizeScale = 0.9 + Math.random() * 0.2
      const w = Math.round(ratio.w * sizeScale)
      const h = Math.round(ratio.h * sizeScale)

      let x = pos.x + (Math.random() - 0.5) * jitter * 2
      let y = pos.y + (Math.random() - 0.5) * jitter * 1.5

      // Keep within bounds
      x = Math.max(15, Math.min(365 - w, x))
      y = Math.max(25, Math.min(240 - h, y))

      nodeData.push({
        x,
        y,
        w,
        h,
        cx: x + w / 2,
        cy: y + h / 2,
        color: NODE_TYPES[index].color,
        delay: index * 0.08
      })
    })

    setNodes(nodeData)
  }, [])

  // Cycle through flow paths
  useEffect(() => {
    if (nodes.length === 0) return

    const cycleDuration = 3000 // 3 seconds per path

    const cycleFlow = (): void => {
      const pathIndex = flowIndexRef.current % FLOW_PATHS.length
      const currentPath = FLOW_PATHS[pathIndex]
      const previousPath = FLOW_PATHS[(pathIndex - 1 + FLOW_PATHS.length) % FLOW_PATHS.length]

      // Set fading nodes (previous path that's not in current)
      const fading = new Set(previousPath.filter(n => !currentPath.includes(n)))
      setFadingNodes(fading)

      // After short delay, set active nodes
      setTimeout(() => {
        setActiveNodes(new Set(currentPath))
        setFadingNodes(new Set())
      }, 200)

      flowIndexRef.current++
    }

    // Initial activation after nodes appear
    const initialTimer = setTimeout(cycleFlow, 1500)
    const interval = setInterval(cycleFlow, cycleDuration)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [nodes])

  // Calculate edge endpoint at node border
  const getEdgePoint = (fromIdx: number, toIdx: number): { x: number; y: number } => {
    const from = nodes[fromIdx]
    const to = nodes[toIdx]
    if (!from || !to) return { x: 0, y: 0 }

    const angle = Math.atan2(to.cy - from.cy, to.cx - from.cx)
    const hw = from.w / 2 + 2
    const hh = from.h / 2 + 2

    const tanAngle = Math.abs(Math.tan(angle))
    if (tanAngle * hw <= hh) {
      const x = from.cx + (Math.cos(angle) > 0 ? hw : -hw)
      const y = from.cy + (Math.cos(angle) > 0 ? hw : -hw) * Math.tan(angle)
      return { x, y }
    } else {
      const y = from.cy + (Math.sin(angle) > 0 ? hh : -hh)
      const x = from.cx + (Math.sin(angle) > 0 ? hh : -hh) / Math.tan(angle)
      return { x, y }
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0d0d14 0%, #0f0f1a 50%, #0d0d14 100%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {/* Constellation container */}
      <div
        ref={canvasRef}
        className="relative"
        style={{ width: 400, height: 320 }}
      >
        {/* Edge layer (SVG) */}
        <svg
          className="absolute inset-0 pointer-events-none"
          viewBox="0 0 400 320"
          preserveAspectRatio="xMidYMid meet"
        >
          {nodes.length > 0 && EDGES.map(([from, to], idx) => {
            const start = getEdgePoint(from, to)
            const end = getEdgePoint(to, from)
            const isActive = activeNodes.has(from) && activeNodes.has(to)
            return (
              <motion.line
                key={idx}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={nodes[from]?.color || '#666'}
                strokeWidth={2}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: isActive ? 0.8 : 0.3,
                  strokeDasharray: isActive ? '6 4' : 'none',
                  strokeDashoffset: isActive ? [0, -10] : 0
                }}
                transition={{
                  pathLength: { delay: 0.8 + idx * 0.05, duration: 0.4 },
                  opacity: { delay: 0.8 + idx * 0.05, duration: 0.3 },
                  strokeDashoffset: isActive ? { duration: 0.5, repeat: Infinity, ease: 'linear' } : {}
                }}
              />
            )
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node, idx) => {
          const isActive = activeNodes.has(idx)
          const isFading = fadingNodes.has(idx)
          return (
            <motion.div
              key={idx}
              className="absolute rounded"
              style={{
                left: node.x,
                top: node.y,
                width: node.w,
                height: node.h,
                borderWidth: 2,
                borderStyle: 'solid',
                borderColor: node.color,
                background: 'rgba(13, 13, 20, 0.95)'
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                boxShadow: isActive
                  ? `0 0 8px ${node.color}, 0 0 16px ${node.color}`
                  : isFading
                    ? `0 0 4px ${node.color}`
                    : 'none'
              }}
              transition={{
                scale: { delay: node.delay, duration: 0.3, type: 'spring', stiffness: 300 },
                opacity: { delay: node.delay, duration: 0.3 },
                boxShadow: { duration: 0.4 }
              }}
            />
          )
        })}

        {/* Title */}
        <motion.h1
          className="absolute left-1/2 -translate-x-1/2 text-xl font-mono font-semibold"
          style={{ bottom: 44, color: '#e2e8f0' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.8 }}
        >
          Cognograph
        </motion.h1>

        {/* Status */}
        <motion.span
          className="absolute left-1/2 -translate-x-1/2 text-xs font-mono"
          style={{ bottom: 24, color: '#64748b' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.6 }}
        >
          Loading workspace...
        </motion.span>
      </div>
    </motion.div>
  )
})
