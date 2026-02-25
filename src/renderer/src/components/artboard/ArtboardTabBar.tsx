import React, { memo, useCallback } from 'react'

interface ArtboardTab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface ArtboardTabBarProps {
  tabs: ArtboardTab[]
  activeTabId: string
  onTabChange: (tabId: string) => void
  nodeColor: string
}

/**
 * ArtboardTabBar - Horizontal tab bar for switching artboard panels.
 *
 * Active tab has an underline accent using the node's color, with
 * muted styling for inactive tabs. Only the active tab's content
 * is mounted (lazy rendering handled by the parent component).
 */
export const ArtboardTabBar = memo(function ArtboardTabBar({
  tabs,
  activeTabId,
  onTabChange,
  nodeColor
}: ArtboardTabBarProps): React.JSX.Element {
  const handleTabClick = useCallback(
    (tabId: string) => {
      onTabChange(tabId)
    },
    [onTabChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, tabId: string, index: number) => {
      let targetIndex = -1

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        targetIndex = (index + 1) % tabs.length
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        targetIndex = (index - 1 + tabs.length) % tabs.length
      } else if (e.key === 'Home') {
        e.preventDefault()
        targetIndex = 0
      } else if (e.key === 'End') {
        e.preventDefault()
        targetIndex = tabs.length - 1
      }

      if (targetIndex >= 0) {
        onTabChange(tabs[targetIndex].id)
        // Focus the new tab button
        const tabList = (e.target as HTMLElement).parentElement
        const buttons = tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        buttons?.[targetIndex]?.focus()
      }
    },
    [onTabChange, tabs]
  )

  return (
    <div
      className="artboard-tab-bar"
      role="tablist"
      aria-label="Artboard panels"
      style={{ '--node-accent': nodeColor } as React.CSSProperties}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId
        return (
          <button
            key={tab.id}
            className={`artboard-tab ${isActive ? 'artboard-tab--active' : ''}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`artboard-panel-${tab.id}`}
            id={`artboard-tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id, index)}
            type="button"
          >
            {tab.icon && <span className="artboard-tab__icon">{tab.icon}</span>}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
})

export type { ArtboardTab, ArtboardTabBarProps }
