import type { NodeTypes } from '@xyflow/react'
import { ConversationNode } from './ConversationNode'
import { ProjectNode } from './ProjectNode'
import { NoteNode } from './NoteNode'
import { TaskNode } from './TaskNode'
import { ArtifactNode } from './ArtifactNode'
import { WorkspaceNode } from './WorkspaceNode'
import { TextNode } from './TextNode'
import { ActionNode } from './ActionNode'
import { OrchestratorNode } from './OrchestratorNode'
import { GhostNode } from '../bridge/GhostNode'

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
