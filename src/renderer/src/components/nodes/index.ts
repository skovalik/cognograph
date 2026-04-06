// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { NodeTypes } from '@xyflow/react'
import { GhostNode } from '../bridge/GhostNode'
import { ActionNode } from './ActionNode'
import { ArtifactNode } from './ArtifactNode'
import { ConversationNode } from './ConversationNode'
import { NoteNode } from './NoteNode'
import { OrchestratorNode } from './OrchestratorNode'
import { ProjectNode } from './ProjectNode'
import { TaskNode } from './TaskNode'
import { TextNode } from './TextNode'
import { WorkspaceNode } from './WorkspaceNode'

export const nodeTypes: NodeTypes = {
  conversation: ConversationNode,
  project: ProjectNode,
  note: NoteNode,
  task: TaskNode,
  artifact: ArtifactNode,
  workspace: WorkspaceNode,
  text: TextNode,
  action: ActionNode,
  orchestrator: OrchestratorNode,
  ghost: GhostNode,
}
