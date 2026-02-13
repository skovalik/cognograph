import { memo } from 'react'

interface TetherLineProps {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

function TetherLineComponent({ sourceX, sourceY, targetX, targetY }: TetherLineProps): JSX.Element {
  // Calculate SVG bounds
  const minX = Math.min(sourceX, targetX)
  const minY = Math.min(sourceY, targetY)
  const width = Math.abs(targetX - sourceX) + 10
  const height = Math.abs(targetY - sourceY) + 10

  // Adjust points relative to SVG origin
  const x1 = sourceX - minX + 5
  const y1 = sourceY - minY + 5
  const x2 = targetX - minX + 5
  const y2 = targetY - minY + 5

  return (
    <svg
      className="extraction-tether"
      style={{
        left: minX - 5,
        top: minY - 5,
        width,
        height
      }}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
    </svg>
  )
}

export const TetherLine = memo(TetherLineComponent)
