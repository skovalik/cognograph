// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * SettingsPopover — Tabbed settings popover shell.
 *
 * 4 tabs: Appearance, Canvas, Glass & Effects, Typography.
 * Real content will be wired in Tasks 1.2-1.5; each tab renders a placeholder for now.
 *
 * Tab state persists across open/close cycles (useState, not reset on unmount
 * because Radix keeps the DOM mounted while the popover is simply hidden).
 */

import * as PopoverPrimitive from '@radix-ui/react-popover'
import { useMemo, useState } from 'react'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
// Cloud features disabled in open-source build (src/web/ not included)
const isAuthEnabled = (): boolean => false
import { getAvailableMediaTools } from '../../services/media/agentToolRegistry'
import { hasTerminalAccess } from '../../utils/terminalAccess'
import { AccountTab } from './AccountTab'
import { AgentToolsTab } from './AgentToolsTab'
import { ApiKeysTab } from './ApiKeysTab'
import { AppearanceTab } from './AppearanceTab'
import { CanvasTab } from './CanvasTab'
import { EffectsTab } from './EffectsTab'
import { TerminalTab } from './TerminalTab'
import { TypographyTab } from './TypographyTab'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef?: React.RefObject<HTMLButtonElement>
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

interface TabDef {
  value: string
  label: string
}

const BASE_TABS: TabDef[] = [
  { value: 'appearance', label: 'Appearance' },
  { value: 'canvas', label: 'Canvas' },
  { value: 'glass', label: 'Glass & Effects' },
  { value: 'typography', label: 'Typography' },
]

const DEFAULT_TAB = 'appearance'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsPopover({
  open,
  onOpenChange,
  triggerRef,
}: SettingsPopoverProps): JSX.Element {
  // Tab state lives outside the popover open/close cycle so it persists
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)

  // Build tab list with progressive disclosure
  const tabs = useMemo(() => {
    const result = [...BASE_TABS]
    // Terminal tab: only show if terminal access is available
    if (hasTerminalAccess()) {
      result.push({ value: 'terminal', label: 'Terminal' })
    }
    // API Keys + Account: only show when auth is enabled (cloud mode)
    if (isAuthEnabled()) {
      result.push({ value: 'apikeys', label: 'API Keys' })
      result.push({ value: 'account', label: 'Account' })
    }
    // Agent Tools: only show when at least one media provider key is configured
    if (getAvailableMediaTools().length > 0) {
      result.push({ value: 'agenttools', label: 'Agent Tools' })
    }
    return result
  }, [])

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {/* Virtual anchor — the real trigger button lives in the Toolbar and
          forwards its ref here so Radix can position the popover correctly. */}
      {triggerRef ? <PopoverPrimitive.Anchor virtualRef={triggerRef} /> : null}

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className={cn(
          'w-[380px] max-h-[480px] p-0',
          'rounded-[var(--radius-lg)]',
          'border border-[var(--border-subtle)]',
          'bg-[var(--surface-panel)]',
          'shadow-[var(--shadow-panel)]',
          'overflow-hidden',
        )}
        onOpenAutoFocus={(e) => {
          // Prevent Radix from stealing focus from the active tab trigger;
          // the tab list already manages focus via arrow keys.
          e.preventDefault()
        }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* ---- Tab triggers ---- */}
          <TabsList
            className={cn(
              'flex w-full h-auto gap-0 p-0 rounded-none',
              'bg-transparent',
              'border-b border-[var(--border-subtle)]',
            )}
          >
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  'relative flex-1 rounded-none px-3 py-2.5',
                  'text-[length:var(--text-label)] font-[number:var(--weight-medium)]',
                  'text-[var(--text-secondary)]',
                  'bg-transparent shadow-none',
                  'transition-colors duration-[var(--duration-fast)]',
                  // Active state: gold underline + primary text
                  'data-[state=active]:text-[var(--text-primary)]',
                  'data-[state=active]:bg-transparent',
                  'data-[state=active]:shadow-none',
                  // Gold underline via pseudo-element
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

          {/* ---- Tab content panels ---- */}
          <div className="flex-1 overflow-y-auto p-4">
            <TabsContent value="appearance" className="mt-0">
              <AppearanceTab />
            </TabsContent>

            <TabsContent value="canvas" className="mt-0">
              <CanvasTab />
            </TabsContent>

            <TabsContent value="glass" className="mt-0">
              <EffectsTab />
            </TabsContent>

            <TabsContent value="typography" className="mt-0">
              <TypographyTab />
            </TabsContent>

            <TabsContent value="terminal" className="mt-0">
              <TerminalTab />
            </TabsContent>

            <TabsContent value="apikeys" className="mt-0">
              <ApiKeysTab />
            </TabsContent>

            <TabsContent value="account" className="mt-0">
              <AccountTab />
            </TabsContent>

            <TabsContent value="agenttools" className="mt-0">
              <AgentToolsTab />
            </TabsContent>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
