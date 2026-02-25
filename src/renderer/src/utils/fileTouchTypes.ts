/** Represents a file touched by a CC session */
export interface FileTouchRecord {
  filePath: string
  sessionId: string
  nodeId: string // ConversationNode that owns this session
  accentColor: string
  lastTouchedAt: number
}

/** Edge data for visual-only file touch edges */
export interface FileTouchEdgeData {
  isFileTouchEdge: true
  sessionAccentColor: string
  visible: boolean
  filePath: string
  sessionId: string
}

/** Conflict info when 2+ sessions touch the same file */
export interface FileConflict {
  filePath: string
  sessions: Array<{
    sessionId: string
    nodeId: string
    accentColor: string
  }>
}

/** Props for conflict badge on ArtifactNode */
export interface ConflictBadgeProps {
  conflicts: FileConflict[]
  onViewConflicts?: (conflict: FileConflict) => void
}
