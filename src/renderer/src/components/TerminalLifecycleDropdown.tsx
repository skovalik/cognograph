// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { Pin, PinOff, Square } from 'lucide-react'
import { memo, useCallback } from 'react'
import { SessionStatusIndicator } from './SessionStatusIndicator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface TerminalLifecycleDropdownProps {
  nodeId: string
  terminalState: 'running' | 'idle' | 'exited'
  userPinned: boolean
  accentColor: string
  onPin: () => void
  onUnpin: () => void
  onKill: () => void
}

function TerminalLifecycleDropdownComponent({
  nodeId: _nodeId,
  terminalState,
  userPinned,
  accentColor,
  onPin,
  onUnpin,
  onKill,
}: TerminalLifecycleDropdownProps): JSX.Element {
  const isExited = terminalState === 'exited'
  const effectivePinned = !isExited && userPinned

  const label = isExited
    ? 'Exited'
    : effectivePinned
      ? 'Pinned'
      : terminalState === 'running'
        ? 'Running'
        : 'Idle'

  const handlePin = useCallback(() => {
    if (!isExited) onPin()
  }, [isExited, onPin])

  const handleUnpin = useCallback(() => {
    if (!isExited) onUnpin()
  }, [isExited, onUnpin])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded text-[10px] font-medium transition-all hover:brightness-110"
          style={{
            minWidth: '24px',
            minHeight: '24px',
            padding: '4px 6px',
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}40`,
            color: accentColor,
          }}
          aria-label={`Terminal session status: ${label}`}
          onClick={(e) => e.stopPropagation()}
        >
          <SessionStatusIndicator state={terminalState} accentColor={accentColor} size={8} />
          {effectivePinned && <Pin className="w-2.5 h-2.5" />}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" collisionPadding={8} className="w-44">
        <div className="px-2 py-1.5 text-[11px] text-[var(--text-secondary)]">
          Status: <span className="font-medium">{label}</span>
        </div>
        <DropdownMenuSeparator />
        {effectivePinned ? (
          <DropdownMenuItem onSelect={handleUnpin} disabled={isExited}>
            <PinOff className="w-3.5 h-3.5 mr-2" />
            Unpin (allow idle)
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={handlePin} disabled={isExited}>
            <Pin className="w-3.5 h-3.5 mr-2" />
            Pin (keep alive)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onKill} disabled={isExited}>
          <Square className="w-3.5 h-3.5 mr-2" />
          Kill session
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const TerminalLifecycleDropdown = memo(TerminalLifecycleDropdownComponent)
