/**
 * ArtifactArtboard — Full-viewport artboard for artifact nodes (ArtboardOverlay system).
 *
 * Tab bar: Preview | Source | Diff | History
 * File tabs for multi-file artifacts (switches active file context).
 * Renders content based on contentType: code, markdown, image, html, svg, json, csv, etc.
 *
 * Task 21 of the design-system-v3 implementation plan.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import {
  Code,
  FileText,
  Image,
  FileJson,
  Table,
  Globe,
  GitBranch,
  Eye,
  FileCode,
  FileDiff,
  History,
  Video,
  Volume2,
  Box,
} from 'lucide-react'
import { useNodesStore } from '../../stores/nodesStore'
import type {
  ArtifactNodeData,
  ArtifactContentType,
  ArtifactFile,
  NodeData,
} from '@shared/types'

// =============================================================================
// Types
// =============================================================================

interface ArtifactArtboardProps {
  nodeId: string
}

type ArtifactTab = 'preview' | 'source' | 'diff' | 'history'

// =============================================================================
// Constants
// =============================================================================

const TABS: { id: ArtifactTab; label: string; icon: typeof Eye }[] = [
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'source', label: 'Source', icon: FileCode },
  { id: 'diff', label: 'Diff', icon: FileDiff },
  { id: 'history', label: 'History', icon: History },
]

// =============================================================================
// Helpers
// =============================================================================

function getContentTypeIcon(contentType: ArtifactContentType): JSX.Element {
  switch (contentType) {
    case 'code':
      return <Code className="w-3.5 h-3.5" />
    case 'markdown':
      return <FileText className="w-3.5 h-3.5" />
    case 'html':
      return <Globe className="w-3.5 h-3.5" />
    case 'svg':
      return <Image className="w-3.5 h-3.5" />
    case 'mermaid':
      return <GitBranch className="w-3.5 h-3.5" />
    case 'json':
      return <FileJson className="w-3.5 h-3.5" />
    case 'csv':
      return <Table className="w-3.5 h-3.5" />
    case 'image':
      return <Image className="w-3.5 h-3.5" />
    case 'video':
      return <Video className="w-3.5 h-3.5" />
    case 'audio':
      return <Volume2 className="w-3.5 h-3.5" />
    case '3d-model':
      return <Box className="w-3.5 h-3.5" />
    case 'text':
    default:
      return <FileText className="w-3.5 h-3.5" />
  }
}

function getContentTypeLabel(contentType: ArtifactContentType, customType?: string): string {
  const labels: Record<string, string> = {
    code: 'Code',
    markdown: 'Markdown',
    html: 'HTML',
    svg: 'SVG',
    mermaid: 'Diagram',
    json: 'JSON',
    csv: 'CSV',
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    '3d-model': '3D Model',
    text: 'Text',
    custom: customType || 'Custom',
  }
  return labels[contentType] || 'File'
}

/**
 * Resolve the active file content. In multi-file mode, uses activeFileId
 * or falls back to first file. In single-file mode, uses root content.
 */
function getActiveContent(
  nodeData: ArtifactNodeData,
  overrideFileId?: string
): { content: string; contentType: ArtifactContentType; language?: string; filename?: string } {
  if (nodeData.files && nodeData.files.length > 0) {
    const targetId = overrideFileId || nodeData.activeFileId
    const activeFile = targetId
      ? nodeData.files.find((f) => f.id === targetId)
      : nodeData.files[0]

    if (activeFile) {
      return {
        content: activeFile.content,
        contentType: activeFile.contentType,
        language: activeFile.language,
        filename: activeFile.filename,
      }
    }
  }

  return {
    content: nodeData.content,
    contentType: nodeData.contentType,
    language: nodeData.language,
  }
}

// =============================================================================
// Sub-components
// =============================================================================

/** Tab bar for switching between Preview / Source / Diff / History */
function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: ArtifactTab
  onTabChange: (tab: ArtifactTab) => void
}): JSX.Element {
  return (
    <div
      className="flex items-center gap-0.5 px-3 shrink-0"
      style={{
        borderBottom: '1px solid var(--gui-border)',
        backgroundColor: 'color-mix(in srgb, var(--gui-bg-secondary) 50%, transparent)',
      }}
      role="tablist"
      aria-label="Artifact view tabs"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`artifact-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors duration-150 relative"
            style={{
              color: isActive ? 'var(--gui-text-primary)' : 'var(--gui-text-muted)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
            }}
            onClick={() => onTabChange(tab.id)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--gui-text-secondary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--gui-text-muted)'
              }
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
            {/* Active indicator underline */}
            {isActive && (
              <span
                className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                style={{ backgroundColor: '#EC4899' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** File tabs for multi-file artifacts */
function FileTabs({
  files,
  activeFileId,
  onFileChange,
}: {
  files: ArtifactFile[]
  activeFileId: string
  onFileChange: (fileId: string) => void
}): JSX.Element {
  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => a.order - b.order),
    [files]
  )

  return (
    <div
      className="flex items-center gap-0.5 px-3 py-1 overflow-x-auto shrink-0"
      style={{
        borderBottom: '1px solid var(--gui-border)',
        backgroundColor: 'color-mix(in srgb, var(--gui-bg-tertiary) 30%, transparent)',
      }}
      role="tablist"
      aria-label="Artifact files"
    >
      {sortedFiles.map((file) => {
        const isActive = file.id === activeFileId
        return (
          <button
            key={file.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors duration-150 whitespace-nowrap"
            style={{
              color: isActive ? 'var(--gui-text-primary)' : 'var(--gui-text-muted)',
              backgroundColor: isActive
                ? 'color-mix(in srgb, #EC4899 12%, transparent)'
                : 'transparent',
              cursor: 'pointer',
              border: 'none',
            }}
            onClick={() => onFileChange(file.id)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--gui-bg-tertiary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            {getContentTypeIcon(file.contentType)}
            <span>{file.filename}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Preview panel — renders content based on type */
function PreviewPanel({
  content,
  contentType,
  language,
  title,
}: {
  content: string
  contentType: ArtifactContentType
  language?: string
  title: string
}): JSX.Element {
  if (contentType === 'image') {
    return (
      <div className="flex items-center justify-center p-6 h-full">
        <img
          src={content}
          alt={title}
          className="max-w-full max-h-full object-contain rounded"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)' }}
        />
      </div>
    )
  }

  if (contentType === 'html' || contentType === 'svg') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <Globe className="w-8 h-8 opacity-30" style={{ color: '#EC4899' }} />
        <span className="text-xs" style={{ color: 'var(--gui-text-muted)' }}>
          Sandboxed {contentType.toUpperCase()} preview
        </span>
        <div
          className="w-full max-w-2xl overflow-auto rounded border"
          style={{
            borderColor: 'var(--gui-border)',
            backgroundColor: 'var(--gui-bg-primary)',
            maxHeight: '60vh',
          }}
        >
          <pre
            className="text-xs p-4 font-mono whitespace-pre-wrap"
            style={{ color: 'var(--gui-text-primary)' }}
          >
            {content.slice(0, 5000)}
            {content.length > 5000 ? '\n\n... (truncated)' : ''}
          </pre>
        </div>
      </div>
    )
  }

  if (contentType === 'markdown') {
    return (
      <div
        className="p-6 text-sm overflow-auto h-full whitespace-pre-wrap leading-relaxed"
        style={{ color: 'var(--gui-text-primary)' }}
      >
        {content}
      </div>
    )
  }

  if (contentType === 'code' || contentType === 'json' || contentType === 'csv') {
    return (
      <div className="h-full overflow-auto">
        <div className="flex items-center gap-2 px-4 py-1.5 shrink-0" style={{ borderBottom: '1px solid var(--gui-border)' }}>
          {getContentTypeIcon(contentType)}
          <span className="text-[10px] font-medium" style={{ color: 'var(--gui-text-muted)' }}>
            {getContentTypeLabel(contentType)}
            {language ? ` \u00B7 ${language}` : ''}
          </span>
        </div>
        <pre
          className="text-xs p-4 font-mono overflow-auto"
          style={{
            color: 'var(--gui-text-primary)',
            backgroundColor: 'color-mix(in srgb, var(--gui-bg-primary) 80%, black)',
            minHeight: 'calc(100% - 32px)',
            margin: 0,
            tabSize: 2,
          }}
        >
          {content}
        </pre>
      </div>
    )
  }

  // Fallback: plain text / mermaid / custom
  return (
    <div
      className="p-6 text-xs overflow-auto h-full whitespace-pre-wrap font-mono"
      style={{ color: 'var(--gui-text-primary)' }}
    >
      {content}
    </div>
  )
}

/** Source tab — full-width editor placeholder (Monaco integration point) */
function SourcePanel({
  content,
  language,
}: {
  content: string
  language?: string
}): JSX.Element {
  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center gap-2 px-4 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid var(--gui-border)' }}
      >
        <FileCode className="w-3.5 h-3.5" style={{ color: 'var(--gui-text-muted)' }} />
        <span className="text-[10px] font-medium" style={{ color: 'var(--gui-text-muted)' }}>
          Source{language ? ` \u00B7 ${language}` : ''}
        </span>
        <span
          className="text-[9px] px-1.5 py-0.5 rounded ml-auto"
          style={{
            backgroundColor: 'color-mix(in srgb, #EC4899 10%, transparent)',
            color: '#EC4899',
          }}
        >
          Monaco editor — coming soon
        </span>
      </div>
      <pre
        className="flex-1 text-xs p-4 font-mono overflow-auto"
        style={{
          color: 'var(--gui-text-primary)',
          backgroundColor: 'color-mix(in srgb, var(--gui-bg-primary) 80%, black)',
          margin: 0,
          tabSize: 2,
        }}
      >
        {content}
      </pre>
    </div>
  )
}

/** Diff tab — side-by-side diff placeholder */
function DiffPanel({
  nodeData,
}: {
  nodeData: ArtifactNodeData
}): JSX.Element {
  const currentVersion = nodeData.version
  const prevVersion = nodeData.versionHistory?.length
    ? nodeData.versionHistory[nodeData.versionHistory.length - 1]
    : null

  if (!prevVersion) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <FileDiff className="w-8 h-8 opacity-30" style={{ color: '#EC4899' }} />
        <span className="text-xs" style={{ color: 'var(--gui-text-muted)' }}>
          No previous version to diff against.
        </span>
        <span className="text-[10px]" style={{ color: 'var(--gui-text-muted)' }}>
          Current version: v{currentVersion}
        </span>
      </div>
    )
  }

  // Show a basic side-by-side text comparison
  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center gap-2 px-4 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid var(--gui-border)' }}
      >
        <FileDiff className="w-3.5 h-3.5" style={{ color: 'var(--gui-text-muted)' }} />
        <span className="text-[10px] font-medium" style={{ color: 'var(--gui-text-muted)' }}>
          v{prevVersion.version} → v{currentVersion}
        </span>
        <span
          className="text-[9px] px-1.5 py-0.5 rounded ml-auto"
          style={{
            backgroundColor: 'color-mix(in srgb, #EC4899 10%, transparent)',
            color: '#EC4899',
          }}
        >
          Inline diff — coming soon
        </span>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {/* Previous version */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--gui-border)' }}>
          <div className="px-3 py-1 text-[10px] font-medium shrink-0" style={{ color: 'var(--gui-text-muted)', backgroundColor: 'color-mix(in srgb, #ef4444 8%, transparent)' }}>
            v{prevVersion.version} &mdash; {new Date(prevVersion.timestamp).toLocaleString()}
          </div>
          <pre
            className="flex-1 text-xs p-3 font-mono overflow-auto"
            style={{
              color: 'var(--gui-text-secondary)',
              backgroundColor: 'color-mix(in srgb, var(--gui-bg-primary) 90%, black)',
              margin: 0,
              tabSize: 2,
            }}
          >
            {prevVersion.content.slice(0, 5000)}
            {prevVersion.content.length > 5000 ? '\n\n... (truncated)' : ''}
          </pre>
        </div>
        {/* Current version */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-1 text-[10px] font-medium shrink-0" style={{ color: 'var(--gui-text-muted)', backgroundColor: 'color-mix(in srgb, #22c55e 8%, transparent)' }}>
            v{currentVersion} &mdash; current
          </div>
          <pre
            className="flex-1 text-xs p-3 font-mono overflow-auto"
            style={{
              color: 'var(--gui-text-primary)',
              backgroundColor: 'color-mix(in srgb, var(--gui-bg-primary) 80%, black)',
              margin: 0,
              tabSize: 2,
            }}
          >
            {nodeData.content.slice(0, 5000)}
            {nodeData.content.length > 5000 ? '\n\n... (truncated)' : ''}
          </pre>
        </div>
      </div>
    </div>
  )
}

/** History tab — version timeline */
function HistoryPanel({
  nodeData,
}: {
  nodeData: ArtifactNodeData
}): JSX.Element {
  const history = nodeData.versionHistory ?? []

  return (
    <div className="p-4 overflow-auto h-full">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-3.5 h-3.5" style={{ color: 'var(--gui-text-muted)' }} />
        <span className="text-[10px] uppercase font-medium tracking-wider" style={{ color: 'var(--gui-text-muted)' }}>
          Version History
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'color-mix(in srgb, #EC4899 12%, transparent)',
            color: '#EC4899',
          }}
        >
          v{nodeData.version}
        </span>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <History className="w-6 h-6 opacity-20" style={{ color: 'var(--gui-text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--gui-text-muted)' }}>
            No version history yet.
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Current version marker */}
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-md text-xs"
            style={{
              backgroundColor: 'color-mix(in srgb, #EC4899 8%, transparent)',
              border: '1px solid color-mix(in srgb, #EC4899 20%, transparent)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: '#EC4899' }}
            />
            <span className="font-medium" style={{ color: 'var(--gui-text-primary)' }}>
              v{nodeData.version}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--gui-text-muted)' }}>
              current
            </span>
            <span className="text-[10px] ml-auto" style={{ color: 'var(--gui-text-muted)' }}>
              {new Date(nodeData.updatedAt).toLocaleString()}
            </span>
          </div>

          {/* Previous versions (newest first) */}
          {[...history].reverse().slice(0, 10).map((v, i) => (
            <div
              key={`${v.version}-${i}`}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-xs transition-colors duration-150"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--gui-bg-tertiary) 50%, transparent)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gui-bg-tertiary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  'color-mix(in srgb, var(--gui-bg-tertiary) 50%, transparent)'
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--gui-text-muted)', opacity: 0.4 }}
              />
              <span style={{ color: 'var(--gui-text-secondary)' }}>
                v{v.version}
              </span>
              <span
                className="text-[10px] capitalize px-1.5 py-0.5 rounded"
                style={{
                  color: 'var(--gui-text-muted)',
                  backgroundColor: 'color-mix(in srgb, var(--gui-bg-secondary) 60%, transparent)',
                }}
              >
                {v.changeSource}
              </span>
              <span className="text-[10px] ml-auto" style={{ color: 'var(--gui-text-muted)' }}>
                {new Date(v.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

function ArtifactArtboardComponent({ nodeId }: ArtifactArtboardProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<ArtifactTab>('preview')
  const [activeFileId, setActiveFileId] = useState<string | null>(null)

  const node = useNodesStore((s) => s.nodes.find((n) => n.id === nodeId))
  const nodeData = node?.data as ArtifactNodeData | undefined

  // Resolve active content (handles multi-file artifacts)
  const activeContent = useMemo(() => {
    if (!nodeData) return { content: '', contentType: 'text' as ArtifactContentType }
    return getActiveContent(nodeData, activeFileId ?? undefined)
  }, [nodeData, activeFileId])

  const handleFileChange = useCallback((fileId: string) => {
    setActiveFileId(fileId)
  }, [])

  if (!nodeData) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: 'var(--gui-text-muted)' }}
      >
        <span className="text-xs">Artifact node not found.</span>
      </div>
    )
  }

  const hasMultipleFiles = (nodeData.files?.length ?? 0) > 1
  const resolvedFileId = activeFileId ?? nodeData.activeFileId ?? nodeData.files?.[0]?.id ?? ''

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* File tabs (only for multi-file artifacts) */}
      {hasMultipleFiles && nodeData.files && (
        <FileTabs
          files={nodeData.files}
          activeFileId={resolvedFileId}
          onFileChange={handleFileChange}
        />
      )}

      {/* Content metadata bar */}
      <div
        className="flex items-center gap-2 px-4 py-1 shrink-0"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--gui-bg-secondary) 30%, transparent)',
          borderBottom: '1px solid var(--gui-border)',
        }}
      >
        {getContentTypeIcon(activeContent.contentType)}
        <span className="text-[10px]" style={{ color: 'var(--gui-text-muted)' }}>
          {getContentTypeLabel(activeContent.contentType)}
          {activeContent.language ? ` \u00B7 ${activeContent.language}` : ''}
          {activeContent.filename ? ` \u00B7 ${activeContent.filename}` : ''}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--gui-text-muted)' }}>
          v{nodeData.version}
          {' \u00B7 '}
          {activeContent.content.length.toLocaleString()} chars
        </span>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden" role="tabpanel" aria-label={`${activeTab} tab`}>
        {activeTab === 'preview' && (
          <PreviewPanel
            content={activeContent.content}
            contentType={activeContent.contentType}
            language={activeContent.language}
            title={nodeData.title}
          />
        )}
        {activeTab === 'source' && (
          <SourcePanel
            content={activeContent.content}
            language={activeContent.language}
          />
        )}
        {activeTab === 'diff' && (
          <DiffPanel nodeData={nodeData} />
        )}
        {activeTab === 'history' && (
          <HistoryPanel nodeData={nodeData} />
        )}
      </div>
    </div>
  )
}

export const ArtifactArtboard = memo(ArtifactArtboardComponent)
