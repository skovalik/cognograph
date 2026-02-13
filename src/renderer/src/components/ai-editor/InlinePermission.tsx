/**
 * Inline Permission Component
 *
 * Displays permission requests inline within the AI Editor response stream.
 * Following conversational UX pattern - not a modal interruption.
 *
 * According to the plan:
 * - Permission request is PART of the conversation, not an interruption
 * - User sees what will happen BEFORE granting permission
 * - "Remember this" checkbox reduces future friction
 * - Three levels: permanent, once, deny
 */

import { memo, useState } from 'react'
import { Lock, Unlock, FolderOpen, Globe, FileText, AlertTriangle } from 'lucide-react'

export type PermissionType = 'filesystem_read' | 'filesystem_write' | 'network_fetch' | 'shell_execute'

export type PermissionDuration = 'once' | 'session' | 'workspace' | 'permanent'

export interface PermissionRequest {
  id: string
  type: PermissionType
  path?: string
  domain?: string
  reason: string
  preview?: string
}

interface InlinePermissionProps {
  request: PermissionRequest
  onGrant: (duration: PermissionDuration) => void
  onDeny: () => void
  isLoading?: boolean
}

const TYPE_CONFIG: Record<PermissionType, {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
}> = {
  filesystem_read: {
    icon: FolderOpen,
    label: 'Read Files',
    description: 'Read files from your computer'
  },
  filesystem_write: {
    icon: FileText,
    label: 'Write Files',
    description: 'Create or modify files on your computer'
  },
  network_fetch: {
    icon: Globe,
    label: 'Fetch URL',
    description: 'Fetch content from the web'
  },
  shell_execute: {
    icon: AlertTriangle,
    label: 'Run Command',
    description: 'Execute a shell command'
  }
}

function InlinePermissionComponent({
  request,
  onGrant,
  onDeny,
  isLoading = false
}: InlinePermissionProps): JSX.Element {
  const [rememberChoice, setRememberChoice] = useState(false)
  const config = TYPE_CONFIG[request.type]
  const Icon = config.icon

  const handleGrant = (): void => {
    const duration: PermissionDuration = rememberChoice ? 'workspace' : 'once'
    onGrant(duration)
  }

  const isHighRisk = request.type === 'filesystem_write' || request.type === 'shell_execute'

  return (
    <div className={`
      inline-permission
      rounded-lg
      border
      p-4
      my-3
      ${isHighRisk
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-blue-500/10 border-blue-500/30'
      }
    `}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Lock className={`w-4 h-4 ${isHighRisk ? 'text-amber-400' : 'text-blue-400'}`} />
        <span className={`text-sm font-medium ${isHighRisk ? 'text-amber-400' : 'text-blue-400'}`}>
          Permission Request
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] mb-3">
        {request.reason}
      </p>

      {/* Resource being accessed */}
      <div className="flex items-center gap-2 p-2 rounded bg-black/20 mb-3">
        <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
            {config.label}
          </div>
          <div className="text-sm text-[var(--text-secondary)] truncate">
            {request.path || request.domain || 'Unknown resource'}
          </div>
        </div>
      </div>

      {/* Preview (if available) */}
      {request.preview && (
        <div className="mb-3">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">
            Preview
          </div>
          <pre className="text-xs text-[var(--text-secondary)] bg-black/30 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
            {request.preview}
          </pre>
        </div>
      )}

      {/* Remember checkbox */}
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={rememberChoice}
          onChange={(e) => setRememberChoice(e.target.checked)}
          className="
            w-4 h-4 rounded
            border-[var(--border-subtle)]
            bg-[var(--surface-panel)]
            text-blue-500
            focus:ring-blue-500 focus:ring-offset-0
          "
        />
        <span className="text-sm text-[var(--text-secondary)]">
          Remember this for future requests in this workspace
        </span>
      </label>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleGrant}
          disabled={isLoading}
          className={`
            flex-1 flex items-center justify-center gap-2
            px-4 py-2
            rounded-lg
            font-medium text-sm
            transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isHighRisk
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
            }
          `}
        >
          <Unlock className="w-4 h-4" />
          {rememberChoice ? 'Allow for Workspace' : 'Allow Once'}
        </button>

        <button
          onClick={onDeny}
          disabled={isLoading}
          className="
            px-4 py-2
            rounded-lg
            font-medium text-sm
            text-[var(--text-secondary)]
            hover:text-[var(--text-primary)]
            hover:bg-[var(--surface-panel-secondary)]
            transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          Deny
        </button>
      </div>

      {/* High risk warning */}
      {isHighRisk && (
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            This action can modify files or execute commands. Review carefully before allowing.
          </span>
        </div>
      )}
    </div>
  )
}

export const InlinePermission = memo(InlinePermissionComponent)
export default InlinePermission
