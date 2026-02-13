import type { EdgeTypes } from '@xyflow/react'
import { CustomEdge } from './CustomEdge'
import { GhostEdge } from '../bridge/GhostEdge'

// Note: We use 'as EdgeTypes' because React Flow's typing is strict about the component signature
// Our CustomEdge uses a simplified props interface that's compatible at runtime
export const edgeTypes = {
  custom: CustomEdge,
  ghost: GhostEdge,
} as EdgeTypes

export { CustomEdge }
