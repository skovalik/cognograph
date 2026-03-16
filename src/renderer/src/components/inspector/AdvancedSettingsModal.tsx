// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * AdvancedSettingsModal — Radix Dialog with tabs for deep node property editing.
 *
 * This is Tier 3 of the 3-tier property editing system:
 *   Tier 1: Inline controls on nodes
 *   Tier 2: NodeInspector quick popover
 *   Tier 3: This modal — full advanced property editing
 *
 * Triggered via the "Advanced Settings..." link in NodeInspector.
 * Context, Agent, Extraction, and Attachments tabs render real extracted
 * section components. General and Advanced tabs remain placeholders.
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import {
  ContextSection,
  AgentSection,
  ExtractionsSection,
  AttachmentsSection,
} from './sections'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdvancedSettingsModalProps {
  nodeId: string
  nodeType: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: string
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'context', label: 'Context' },
  { value: 'agent', label: 'Agent' },
  { value: 'extraction', label: 'Extraction' },
  { value: 'attachments', label: 'Attachments' },
  { value: 'advanced', label: 'Advanced' },
] as const

type TabValue = (typeof TABS)[number]['value']

const DEFAULT_TAB: TabValue = 'general'

// ---------------------------------------------------------------------------
// Placeholder descriptions for tabs that are not yet wired to real content
// ---------------------------------------------------------------------------

const TAB_PLACEHOLDERS: Partial<Record<TabValue, string>> = {
  general: 'Title, description, tags, status, and priority will appear here.',
  advanced: 'Version history, property schema, and custom properties will appear here.',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdvancedSettingsModal({
  nodeId,
  nodeType,
  open,
  onOpenChange,
  defaultTab,
}: AdvancedSettingsModalProps): JSX.Element {
  const node = useWorkspaceStore((state) => state.nodes.find((n) => n.id === nodeId))
  const [activeTab, setActiveTab] = useState<TabValue>(
    (defaultTab as TabValue) ?? DEFAULT_TAB,
  )

  const title = (node?.data as Record<string, unknown>)?.title as string | undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="advanced-settings-modal"
        className={cn(
          'w-[640px] max-w-[90vw] max-h-[80vh] p-0 gap-0',
          'rounded-[var(--radius-lg)]',
          'border border-[var(--border-subtle)]',
          'bg-[var(--surface-panel)]',
          'shadow-[var(--shadow-modal)]',
          'flex flex-col overflow-hidden',
        )}
      >
        {/* ---- Header ---- */}
        <DialogHeader className="px-6 pt-5 pb-0 space-y-1">
          <DialogTitle className="text-base font-semibold text-[var(--text-primary)] pr-8">
            {title || 'Untitled'}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-[var(--text-secondary)] capitalize">
            {nodeType} — Advanced Settings
          </DialogDescription>
        </DialogHeader>

        {/* ---- Tabs ---- */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Tab triggers */}
          <TabsList
            className={cn(
              'flex w-full h-auto gap-0 p-0 rounded-none',
              'bg-transparent',
              'border-b border-[var(--border-subtle)]',
              'px-2 mt-3',
            )}
          >
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  'relative rounded-none px-3 py-2',
                  'text-[length:var(--text-label)] font-[number:var(--weight-medium)]',
                  'text-[var(--text-secondary)]',
                  'bg-transparent shadow-none',
                  'transition-colors duration-[var(--duration-fast)]',
                  // Active state: accent underline + primary text
                  'data-[state=active]:text-[var(--text-primary)]',
                  'data-[state=active]:bg-transparent',
                  'data-[state=active]:shadow-none',
                  // Accent underline via pseudo-element
                  'after:absolute after:bottom-0 after:left-2 after:right-2',
                  'after:h-[2px] after:rounded-full',
                  'after:bg-[var(--accent-primary)]',
                  'after:scale-x-0 after:transition-transform after:duration-[var(--duration-normal)]',
                  'data-[state=active]:after:scale-x-100',
                  // Hover
                  'hover:text-[var(--text-primary)]',
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab content panels */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* General — placeholder */}
            <TabsContent value="general" className="mt-0">
              <p
                data-testid="tab-placeholder-general"
                className="text-sm text-[var(--text-secondary)] italic"
              >
                {TAB_PLACEHOLDERS.general}
              </p>
            </TabsContent>

            {/* Context — real section */}
            <TabsContent value="context" className="mt-0">
              <ContextSection nodeId={nodeId} />
            </TabsContent>

            {/* Agent — real section */}
            <TabsContent value="agent" className="mt-0">
              <AgentSection nodeId={nodeId} />
            </TabsContent>

            {/* Extraction — real section */}
            <TabsContent value="extraction" className="mt-0">
              <ExtractionsSection nodeId={nodeId} defaultExpanded />
            </TabsContent>

            {/* Attachments — real section */}
            <TabsContent value="attachments" className="mt-0">
              <AttachmentsSection nodeId={nodeId} defaultExpanded />
            </TabsContent>

            {/* Advanced — placeholder */}
            <TabsContent value="advanced" className="mt-0">
              <p
                data-testid="tab-placeholder-advanced"
                className="text-sm text-[var(--text-secondary)] italic"
              >
                {TAB_PLACEHOLDERS.advanced}
              </p>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
