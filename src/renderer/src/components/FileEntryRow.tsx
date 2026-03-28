// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * FileEntryRow — shared component for rendering a single filesystem entry.
 * Used by LayersPanel (FilesystemSection) and FilePreviewSection (node body).
 */

import { memo, useCallback } from 'react'
import {
  File,
  FileCode,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Folder,
} from 'lucide-react'
import { getFileIconName, type FileIconName } from '../utils/fileIconMap'
import { cn } from '../lib/utils'

interface FileEntryRowProps {
  name: string
  type: 'file' | 'directory'
  fullPath: string
  highlighted?: boolean
  compact?: boolean
  onClick?: () => void
  onCopyPath?: () => void
}

const ICON_MAP: Record<FileIconName, typeof File> = {
  File,
  FileCode,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Folder,
}

function FileEntryRowComponent({
  name,
  type,
  fullPath,
  highlighted = false,
  compact = false,
  onClick,
  onCopyPath,
}: FileEntryRowProps): JSX.Element {
  const isDotfile = name.startsWith('.')
  const iconName = getFileIconName(name, type === 'directory')
  const IconComponent = ICON_MAP[iconName]
  const fontSize = compact ? 'text-[11px]' : 'text-xs'

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick()
    } else if (window.api?.shell?.openPath) {
      window.api.shell.openPath(fullPath)
    }
  }, [onClick, fullPath])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Simple context menu: copy path
      if (onCopyPath) {
        onCopyPath()
      } else {
        navigator.clipboard.writeText(fullPath).catch(() => {})
      }
    },
    [onCopyPath, fullPath]
  )

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 cursor-pointer transition-colors rounded-sm',
        'hover:bg-[var(--bg-hover,rgba(255,255,255,0.05))]',
        isDotfile && 'opacity-60',
        highlighted && 'font-semibold text-[var(--accent)]'
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={fullPath}
      role="listitem"
    >
      <IconComponent
        className={cn('shrink-0', compact ? 'w-3 h-3' : 'w-3.5 h-3.5')}
        style={{ color: highlighted ? 'var(--accent)' : 'var(--fg-secondary, #9ca3af)' }}
      />
      <span
        className={cn(
          fontSize,
          'truncate font-mono',
          highlighted ? 'text-[var(--accent)]' : 'gui-text-secondary'
        )}
      >
        {name}
      </span>
    </div>
  )
}

export const FileEntryRow = memo(FileEntryRowComponent)
