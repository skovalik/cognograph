import { memo, useState } from 'react'
import { History, RotateCcw, ChevronDown, ChevronUp, Clock, User, Cpu, GitFork } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { toast } from 'react-hot-toast'
import type { ArtifactNodeData, ArtifactVersion } from '@shared/types'

interface VersionHistoryPanelProps {
  nodeId: string
  data: ArtifactNodeData
}

function VersionHistoryPanelComponent({ nodeId, data }: VersionHistoryPanelProps): JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false)
  const [previewingVersion, setPreviewingVersion] = useState<number | null>(null)
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  const { version, versionHistory } = data

  // No history? Don't show panel
  if (versionHistory.length === 0) {
    return null
  }

  // Get change source icon and color
  const getSourceInfo = (source: ArtifactVersion['changeSource']): { icon: JSX.Element; label: string } => {
    switch (source) {
      case 'user-edit':
        return { icon: <User className="w-3 h-3" />, label: 'Manual edit' }
      case 'llm-update':
        return { icon: <Cpu className="w-3 h-3" />, label: 'LLM update' }
      case 'fork':
        return { icon: <GitFork className="w-3 h-3" />, label: 'Forked' }
    }
  }

  const handleRestoreVersion = (versionToRestore: ArtifactVersion): void => {
    // Save current state to history before restoring
    const currentVersion: ArtifactVersion = {
      version: data.version,
      content: data.content,
      timestamp: Date.now(),
      changeSource: 'user-edit' // Restoring is a user action
    }

    // Create new history with current at the front
    const newHistory = [currentVersion, ...versionHistory.filter(v => v.version !== versionToRestore.version)]
      .slice(0, 10) // Keep max 10 versions

    // Update with restored content
    updateNode(nodeId, {
      content: versionToRestore.content,
      version: data.version + 1, // Increment version
      versionHistory: newHistory,
      updatedAt: Date.now()
    } as Partial<ArtifactNodeData>)

    setPreviewingVersion(null)
    toast.success(`Restored to v${versionToRestore.version}`)
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const previewedVersion = previewingVersion !== null
    ? versionHistory.find(v => v.version === previewingVersion)
    : null

  return (
    <div className="border-t border-[var(--border-subtle)] mt-3 pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          <span>Version History</span>
          <span className="text-[var(--text-muted)]">({versionHistory.length})</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1.5">
          {/* Current version indicator */}
          <div className="flex items-center gap-2 px-2 py-1.5 bg-cyan-900/20 border border-cyan-800/50 rounded text-xs">
            <span className="text-cyan-400 font-medium">v{version}</span>
            <span className="text-[var(--text-secondary)]">Current</span>
          </div>

          {/* Version history list */}
          {versionHistory.map((v) => {
            const sourceInfo = getSourceInfo(v.changeSource)
            const isPreviewing = previewingVersion === v.version

            return (
              <div
                key={v.version}
                className={`px-2 py-1.5 rounded text-xs transition-colors ${
                  isPreviewing
                    ? 'bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)]'
                    : 'bg-[var(--surface-panel)]/50 border border-transparent hover:bg-[var(--surface-panel)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)] font-medium">v{v.version}</span>
                    <span className="flex items-center gap-1 text-[var(--text-muted)]">
                      {sourceInfo.icon}
                      {sourceInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="flex items-center gap-1 text-[var(--text-muted)]">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(v.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Preview/restore buttons */}
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={() => setPreviewingVersion(isPreviewing ? null : v.version)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      isPreviewing
                        ? 'bg-[var(--surface-panel)] text-[var(--text-primary)]'
                        : 'bg-[var(--surface-panel-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel)]'
                    }`}
                  >
                    {isPreviewing ? 'Hide Preview' : 'Preview'}
                  </button>
                  <button
                    onClick={() => handleRestoreVersion(v)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-cyan-900/50 hover:bg-cyan-900 text-cyan-300 rounded text-xs transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>
                </div>
              </div>
            )
          })}

          {/* Preview pane */}
          {previewedVersion && (
            <div className="mt-2 p-2 bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Preview: v{previewedVersion.version}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {previewedVersion.content.split('\n').length} lines
                </span>
              </div>
              <pre className="text-xs text-[var(--text-secondary)] font-mono overflow-x-auto max-h-32 overflow-y-auto bg-[var(--surface-panel)] p-2 rounded">
                {previewedVersion.content.slice(0, 1000)}
                {previewedVersion.content.length > 1000 && '...'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const VersionHistoryPanel = memo(VersionHistoryPanelComponent)
