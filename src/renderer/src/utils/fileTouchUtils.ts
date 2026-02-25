import type { FileTouchRecord, FileTouchEdgeData, FileConflict } from './fileTouchTypes'

/**
 * Generate visual-only file touch edge data between a session's ConversationNode
 * and ArtifactNodes representing files the session touched.
 *
 * @param touchRecords - All file touch records for active sessions
 * @param artifactNodeMap - Map of filePath to artifactNodeId for nodes on canvas
 * @returns Array of edge data objects (source=conversationNodeId, target=artifactNodeId)
 */
export function generateFileTouchEdges(
  touchRecords: FileTouchRecord[],
  artifactNodeMap: Map<string, string> // filePath -> nodeId
): Array<{ source: string; target: string; data: FileTouchEdgeData }> {
  const edges: Array<{ source: string; target: string; data: FileTouchEdgeData }> = []

  for (const record of touchRecords) {
    const artifactNodeId = artifactNodeMap.get(record.filePath)
    if (!artifactNodeId) continue // No artifact node on canvas for this file

    edges.push({
      source: record.nodeId,
      target: artifactNodeId,
      data: {
        isFileTouchEdge: true,
        sessionAccentColor: record.accentColor,
        visible: true,
        filePath: record.filePath,
        sessionId: record.sessionId
      }
    })
  }

  return edges
}

/**
 * Detect file conflicts: files touched by 2+ different sessions.
 *
 * @param touchRecords - All file touch records
 * @returns Array of conflicts (only files with 2+ sessions)
 */
export function detectFileConflicts(touchRecords: FileTouchRecord[]): FileConflict[] {
  // Group by file path
  const fileMap = new Map<
    string,
    Array<{ sessionId: string; nodeId: string; accentColor: string }>
  >()

  for (const record of touchRecords) {
    if (!fileMap.has(record.filePath)) {
      fileMap.set(record.filePath, [])
    }
    const sessions = fileMap.get(record.filePath)!
    // Deduplicate by sessionId
    if (!sessions.some((s) => s.sessionId === record.sessionId)) {
      sessions.push({
        sessionId: record.sessionId,
        nodeId: record.nodeId,
        accentColor: record.accentColor
      })
    }
  }

  // Filter to only conflicts (2+ sessions)
  const conflicts: FileConflict[] = []
  for (const [filePath, sessions] of fileMap) {
    if (sessions.length >= 2) {
      conflicts.push({ filePath, sessions })
    }
  }

  return conflicts
}

/**
 * Get the CSS style for a file touch edge.
 * Returns inline style object for the edge path element.
 */
export function getFileTouchEdgeStyle(accentColor: string): {
  stroke: string
  strokeDasharray: string
  strokeWidth: number
  opacity: number
  fill: string
} {
  return {
    stroke: accentColor,
    strokeDasharray: '5,5',
    strokeWidth: 2,
    opacity: 0.7,
    fill: 'none'
  }
}

/**
 * Check if an edge data object represents a file touch edge.
 * Type guard for use in CustomEdge rendering.
 */
export function isFileTouchEdge(data: unknown): data is FileTouchEdgeData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'isFileTouchEdge' in data &&
    (data as FileTouchEdgeData).isFileTouchEdge === true
  )
}
