// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Command Palette
 *
 * Full Cmd+K implementation for quick access to all app actions.
 * Uses shadcn CommandDialog (cmdk + Radix Dialog) for built-in keyboard navigation,
 * focus trap, and portal rendering.
 *
 * Command definitions are sourced from useCommandRegistry (shared with BottomCommandBar).
 */

import { memo, useState, useCallback, useEffect, useMemo } from 'react'
import {
  MessageSquare,
  FileText,
  CheckSquare,
  Folder,
  Code,
  Boxes,
  Zap,
  MapPin,
} from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { NodeData } from '@shared/types'
import { useReactFlow } from '@xyflow/react'
import { useCommandRegistry, CATEGORY_LABELS } from '../hooks/useCommandRegistry'
import type { CommandRegistryItem } from '../hooks/useCommandRegistry'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from './ui'

// Extend with node results which have category 'nodes'
interface PaletteItem extends Omit<CommandRegistryItem, 'category' | 'alias'> {
  category: string
}

// Store for command palette state
interface CommandPaletteState {
  isOpen: boolean
  openPalette: () => void
  closePalette: () => void
  togglePalette: () => void
}

let commandPaletteState: CommandPaletteState | null = null

export function useCommandPalette(): CommandPaletteState {
  const [isOpen, setIsOpen] = useState(false)

  const openPalette = useCallback(() => {
    setIsOpen(true)
    window.dispatchEvent(new CustomEvent('command-palette-opened'))
  }, [])
  const closePalette = useCallback(() => setIsOpen(false), [])
  const togglePalette = useCallback(() => setIsOpen(prev => !prev), [])

  // Store reference for external access
  commandPaletteState = { isOpen, openPalette, closePalette, togglePalette }

  return { isOpen, openPalette, closePalette, togglePalette }
}

export function getCommandPaletteState(): CommandPaletteState | null {
  return commandPaletteState
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

const FULL_CATEGORY_LABELS: Record<string, string> = {
  ...CATEGORY_LABELS,
  nodes: 'Go to Node',
}

function CommandPaletteComponent({ isOpen, onClose }: CommandPaletteProps): JSX.Element {
  const { screenToFlowPosition, setCenter } = useReactFlow()

  const nodes = useWorkspaceStore(state => state.nodes)
  const setSelectedNodes = useWorkspaceStore(state => state.setSelectedNodes)

  // Search state for node results
  const [search, setSearch] = useState('')

  // Reset search when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearch('')
    }
  }, [isOpen])

  // Shared command registry
  const commands = useCommandRegistry({
    onDone: onClose,
    screenToFlowPosition,
  })

  // Node type to icon mapping for "Go to Node" results
  const nodeTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = useMemo(() => ({
    conversation: MessageSquare,
    note: FileText,
    task: CheckSquare,
    project: Folder,
    artifact: Code,
    workspace: Boxes,
    action: Zap,
    text: FileText
  }), [])

  // Build dynamic node search results (only when searching)
  const nodeResults: PaletteItem[] = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return []
    const query = search.toLowerCase()

    return nodes
      .filter(node => {
        const data = node.data as NodeData
        const title = (data.title || data.label || '').toLowerCase()
        const type = data.type.toLowerCase()
        return title.includes(query) || type.includes(query)
      })
      .slice(0, 8)
      .map(node => {
        const data = node.data as NodeData
        const title = data.title || data.label || `Untitled ${data.type}`
        const Icon = nodeTypeIcons[data.type] || MapPin

        return {
          id: `goto-${node.id}`,
          label: title,
          description: `${data.type} node`,
          icon: Icon,
          category: 'nodes',
          action: () => {
            const nodeWidth = node.measured?.width || 280
            const nodeHeight = node.measured?.height || 140
            setCenter(
              node.position.x + nodeWidth / 2,
              node.position.y + nodeHeight / 2,
              { duration: 300, zoom: 1 }
            )
            setSelectedNodes([node.id])
            onClose()
          }
        }
      })
  }, [search, nodes, nodeTypeIcons, setCenter, setSelectedNodes, onClose])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {}
    for (const cmd of commands) {
      const cat = cmd.category
      if (!groups[cat]) groups[cat] = []
      groups[cat]!.push(cmd)
    }
    // Add node results as a separate group
    if (nodeResults.length > 0) {
      groups['nodes'] = nodeResults
    }
    return groups
  }, [commands, nodeResults])

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No commands found</CommandEmpty>
        {Object.entries(groupedCommands).map(([category, items]) => (
          <CommandGroup key={category} heading={FULL_CATEGORY_LABELS[category] || category}>
            {items.map(cmd => {
              const Icon = cmd.icon
              return (
                <CommandItem
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.description || ''}`}
                  onSelect={() => { if (!cmd.disabled) cmd.action() }}
                  disabled={cmd.disabled}
                  className="gap-3"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{cmd.label}</div>
                    {cmd.description && (
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {cmd.description}
                      </div>
                    )}
                  </div>
                  {cmd.shortcut && (
                    <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}

export const CommandPalette = memo(CommandPaletteComponent)
