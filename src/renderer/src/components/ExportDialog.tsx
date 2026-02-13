/**
 * ExportDialog - Workspace export modal
 *
 * Lets users choose format (Markdown/HTML/JSON), scope (all/selected),
 * and whether to include edges. Uses the native save dialog for file path.
 */

import { memo, useState, useCallback } from 'react'
import { X, Download, FileText, Code, Globe } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useWorkspaceStore } from '../stores/workspaceStore'
import {
  exportWorkspace,
  type ExportFormat,
  type ExportScope
} from '../utils/exportWorkspace'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: typeof FileText; description: string }[] = [
  { value: 'markdown', label: 'Markdown', icon: FileText, description: 'Readable document with headers, checklists, and quotes' },
  { value: 'html', label: 'HTML', icon: Globe, description: 'Self-contained web page with styling' },
  { value: 'json', label: 'JSON', icon: Code, description: 'Machine-readable format for import/integration' }
]

function ExportDialogComponent({ isOpen, onClose }: ExportDialogProps): JSX.Element | null {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [scope, setScope] = useState<ExportScope>('all')
  const [includeEdges, setIncludeEdges] = useState(true)
  const [exporting, setExporting] = useState(false)

  const nodes = useWorkspaceStore((s) => s.nodes)
  const edges = useWorkspaceStore((s) => s.edges)
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const workspaceName = useWorkspaceStore((s) => s.workspaceName)

  const selectedCount = selectedNodeIds.length
  const hasSelection = selectedCount > 0

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      // Get nodes based on scope
      const exportNodes = scope === 'selected' && hasSelection
        ? nodes.filter(n => selectedNodeIds.includes(n.id))
        : nodes.filter(n => !n.data.isArchived)

      // Get relevant edges
      const nodeIdSet = new Set(exportNodes.map(n => n.id))
      const exportEdges = includeEdges
        ? edges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
        : []

      const content = exportWorkspace(exportNodes, exportEdges, {
        format,
        scope,
        includeEdges,
        workspaceName: workspaceName || 'Untitled Workspace'
      })

      const contentType = format === 'html' ? 'html' : format === 'json' ? 'text' : 'markdown'
      const sanitizedName = (workspaceName || 'workspace').replace(/[^a-zA-Z0-9_-]/g, '_')

      // Use artifact download API — it handles save dialog + file writing
      const result = await window.api.artifact.download({
        title: sanitizedName,
        content,
        contentType
      })

      if (result.canceled) {
        setExporting(false)
        return
      }

      if (!result.success) {
        throw new Error(result.error || 'Download failed')
      }

      toast.success(`Exported ${exportNodes.length} nodes as ${format.toUpperCase()}`)
      onClose()
    } catch (err) {
      console.error('[ExportDialog] Export failed:', err)
      toast.error('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }, [format, scope, includeEdges, nodes, edges, selectedNodeIds, hasSelection, workspaceName, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative w-[420px] max-w-[90vw] rounded-xl overflow-hidden gui-panel glass-fluid border gui-border shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b gui-border">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5" style={{ color: 'var(--gui-accent-secondary)' }} />
            <h2 className="text-base font-semibold gui-text">Export Workspace</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded gui-text-secondary hover:gui-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* Format selector */}
          <div>
            <label className="text-xs font-medium gui-text-secondary uppercase tracking-wider mb-2 block">
              Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setFormat(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-all ${
                    format === value
                      ? 'border-[var(--gui-accent-secondary)] bg-[var(--gui-accent-secondary)]/10'
                      : 'gui-border hover:gui-surface-secondary'
                  }`}
                >
                  <Icon className="w-5 h-5" style={{ color: format === value ? 'var(--gui-accent-secondary)' : undefined }} />
                  <span className={`text-xs font-medium ${format === value ? 'gui-text' : 'gui-text-secondary'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] gui-text-muted mt-1.5">
              {FORMAT_OPTIONS.find(o => o.value === format)?.description}
            </p>
          </div>

          {/* Scope selector */}
          <div>
            <label className="text-xs font-medium gui-text-secondary uppercase tracking-wider mb-2 block">
              Scope
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setScope('all')}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-all ${
                  scope === 'all'
                    ? 'border-[var(--gui-accent-secondary)] bg-[var(--gui-accent-secondary)]/10 gui-text'
                    : 'gui-border gui-text-secondary hover:gui-surface-secondary'
                }`}
              >
                All Nodes ({nodes.filter(n => !n.data.isArchived).length})
              </button>
              <button
                onClick={() => setScope('selected')}
                disabled={!hasSelection}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-all ${
                  scope === 'selected'
                    ? 'border-[var(--gui-accent-secondary)] bg-[var(--gui-accent-secondary)]/10 gui-text'
                    : hasSelection
                      ? 'gui-border gui-text-secondary hover:gui-surface-secondary'
                      : 'gui-border gui-text-muted cursor-not-allowed opacity-50'
                }`}
              >
                Selected ({selectedCount})
              </button>
            </div>
          </div>

          {/* Include edges toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeEdges}
              onChange={(e) => setIncludeEdges(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--gui-accent-secondary)]"
            />
            <div>
              <span className="text-sm gui-text">Include connections</span>
              <span className="text-xs gui-text-muted ml-1">({edges.length} edges)</span>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t gui-border">
          <button
            onClick={onClose}
            className="gui-btn gui-btn-sm gui-text-secondary hover:gui-text"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="gui-btn gui-btn-accent gui-btn-sm flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const ExportDialog = memo(ExportDialogComponent)
export default ExportDialog
