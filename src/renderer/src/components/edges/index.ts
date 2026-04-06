// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { EdgeTypes } from '@xyflow/react'
import { GhostEdge } from '../bridge/GhostEdge'
import { CustomEdge } from './CustomEdge'

// Note: We use 'as EdgeTypes' because React Flow's typing is strict about the component signature
// Our CustomEdge uses a simplified props interface that's compatible at runtime
export const edgeTypes = {
  custom: CustomEdge,
  ghost: GhostEdge,
} as EdgeTypes

export { CustomEdge }
