// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * NodeInspector — Radix Popover anchored to a React Flow node.
 *
 * Shows an editable title at the top plus interactive type-specific property
 * fields that write directly to the workspace store on change.
 *
 * Positioning: Uses PopoverPrimitive.Anchor with a virtualRef that resolves
 * to the node's DOM element via `document.querySelector([data-id="..."])`.
 *
 * Dismissal: Escape key (Radix built-in) + parent calls onClose on viewport
 * change (pan/zoom).
 */

import { useRef, useCallback, useEffect, useMemo } from 'react'
import { Popover, PopoverContent } from '@/components/ui/popover'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { PropertyField } from './fields'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodeInspectorProps {
  nodeId: string
  nodeType: string
  onClose: () => void
  onOpenAdvanced?: () => void
}

// ---------------------------------------------------------------------------
// Inspector field mapping — which properties to surface per node type
// ---------------------------------------------------------------------------

const INSPECTOR_FIELDS: Record<string, string[]> = {
  task: ['status', 'priority', 'tags', 'dueDate'],
  note: ['noteMode', 'tags'],
  conversation: ['provider', 'mode'],
  artifact: ['contentType', 'tags'],
  project: ['color', 'tags'],
  action: ['enabled'],
  orchestrator: ['strategy'],
  text: ['tags'],
  workspace: ['showOnCanvas'],
}

// ---------------------------------------------------------------------------
// Inspector-specific property definitions — supplements BUILTIN_PROPERTIES
// for fields that are node-type-specific and not registered globally.
// ---------------------------------------------------------------------------

export const INSPECTOR_PROPERTY_DEFS: Record<
  string,
  { name: string; type: string; options?: { value: string; label: string }[] }
> = {
  noteMode: {
    name: 'Mode',
    type: 'select',
    options: [
      { value: 'general', label: 'General' },
      { value: 'persona', label: 'Persona' },
      { value: 'reference', label: 'Reference' },
      { value: 'examples', label: 'Examples' },
      { value: 'background', label: 'Background' },
      { value: 'design-tokens', label: 'Design Tokens' },
      { value: 'page', label: 'Page' },
      { value: 'component', label: 'Component' },
      { value: 'content-model', label: 'Content Model' },
      { value: 'wp-config', label: 'WP Config' },
    ],
  },
  contentType: {
    name: 'Content Type',
    type: 'select',
    options: [
      { value: 'code', label: 'Code' },
      { value: 'markdown', label: 'Markdown' },
      { value: 'html', label: 'HTML' },
      { value: 'svg', label: 'SVG' },
      { value: 'mermaid', label: 'Mermaid' },
      { value: 'json', label: 'JSON' },
      { value: 'text', label: 'Text' },
      { value: 'csv', label: 'CSV' },
      { value: 'image', label: 'Image' },
      { value: 'custom', label: 'Custom' },
    ],
  },
  strategy: {
    name: 'Strategy',
    type: 'select',
    options: [
      { value: 'sequential', label: 'Sequential' },
      { value: 'parallel', label: 'Parallel' },
      { value: 'conditional', label: 'Conditional' },
    ],
  },
  provider: {
    name: 'Provider',
    type: 'select',
    options: [
      { value: 'anthropic', label: 'Anthropic' },
      { value: 'gemini', label: 'Gemini' },
      { value: 'openai', label: 'OpenAI' },
    ],
  },
  mode: {
    name: 'Mode',
    type: 'select',
    options: [
      { value: 'chat', label: 'Chat' },
      { value: 'agent', label: 'Agent' },
      { value: 'terminal', label: 'Terminal' },
    ],
  },
  showOnCanvas: {
    name: 'Show on Canvas',
    type: 'checkbox',
  },
  enabled: {
    name: 'Enabled',
    type: 'checkbox',
  },
  color: {
    name: 'Color',
    type: 'text',
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NodeInspector({
  nodeId,
  nodeType,
  onClose,
  onOpenAdvanced,
}: NodeInspectorProps): JSX.Element | null {
  const node = useWorkspaceStore((state) => state.nodes.find((n) => n.id === nodeId))
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  // Build a virtualRef pointing at the node's DOM element so Radix can
  // anchor the popover to it.
  const virtualRef = useRef<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect: () => {
      const el = document.querySelector(`[data-id="${nodeId}"]`)
      if (el) return el.getBoundingClientRect()
      // Fallback: centre of the viewport
      return new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0)
    },
  })

  // Resolve fields for this node type
  const fields = useMemo(() => INSPECTOR_FIELDS[nodeType] ?? [], [nodeType])

  // Title change handler
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNode(nodeId, { title: e.target.value })
    },
    [nodeId, updateNode],
  )

  // Escape key dismissal (belt-and-suspenders — Radix also handles this)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!node) return null

  const data = node.data as Record<string, unknown>
  const title = (data.title as string) ?? ''

  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverPrimitive.Anchor virtualRef={virtualRef} />

      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        avoidCollisions
        className={cn(
          'w-[320px] max-h-[480px] p-0',
          'rounded-[var(--radius-lg)]',
          'border border-[var(--border-subtle)]',
          'bg-[var(--surface-panel)]',
          'shadow-[var(--shadow-panel)]',
          'overflow-hidden',
        )}
        onOpenAutoFocus={(e) => {
          // Don't steal focus from the canvas; let the title input be
          // focused explicitly if the user clicks into it.
          e.preventDefault()
        }}
      >
        {/* ---- Header: editable title ---- */}
        <div
          className={cn(
            'px-4 pt-3 pb-2',
            'border-b border-[var(--border-subtle)]',
          )}
        >
          <input
            data-testid="inspector-title"
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled"
            className={cn(
              'w-full bg-transparent outline-none',
              'text-[var(--text-primary)] font-semibold text-sm',
              'placeholder:text-[var(--text-secondary)]',
              'focus:ring-1 focus:ring-[var(--accent-primary)] rounded px-1 -mx-1',
              'transition-shadow duration-[var(--duration-fast)]',
            )}
          />
          <span className="text-[10px] text-[var(--text-secondary)] capitalize mt-0.5 block">
            {nodeType}
          </span>
        </div>

        {/* ---- Property fields (interactive) ---- */}
        <div className="px-4 py-2 space-y-2 overflow-y-auto max-h-[340px]">
          {fields.map((fieldId) => (
            <PropertyField key={fieldId} nodeId={nodeId} fieldId={fieldId} extraDefs={INSPECTOR_PROPERTY_DEFS} />
          ))}

          {fields.length === 0 && (
            <p className="text-[11px] text-[var(--text-secondary)] italic">
              No properties configured for this type.
            </p>
          )}
        </div>

        {/* ---- Footer ---- */}
        <div className="px-4 py-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            className={cn(
              'text-[11px] text-[var(--accent-primary)]',
              'hover:underline cursor-pointer',
              'transition-colors duration-[var(--duration-fast)]',
            )}
            onClick={() => {
              onClose()
              onOpenAdvanced?.()
            }}
          >
            Advanced Settings&hellip;
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
