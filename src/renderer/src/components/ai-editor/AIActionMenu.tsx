/**
 * AIActionMenu Component
 *
 * Dropdown menu for quick access to AI Editor modes.
 * Shows all available AI actions with keyboard shortcuts.
 * Accessible via keyboard navigation.
 */

import { memo, useState, useEffect, useRef, useCallback } from 'react'
import {
  Sparkles,
  Pencil,
  LayoutGrid,
  Zap,
  HelpCircle,
  MessageSquare,
  Slash,
  ChevronRight,
  Keyboard
} from 'lucide-react'
// Types imported from aiEditorStore
import { useAIEditorStore } from '../../stores/aiEditorStore'

interface AIActionMenuProps {
  isOpen: boolean
  onClose: () => void
  anchorRect: DOMRect | null
  onToggleAISidebar?: () => void
}

interface MenuItem {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  action: () => void
  separator?: boolean
}

function AIActionMenuComponent({ isOpen, onClose, anchorRect, onToggleAISidebar }: AIActionMenuProps): JSX.Element | null {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const openModal = useAIEditorStore((state) => state.openModal)

  const menuItems: MenuItem[] = [
    {
      id: 'generate',
      label: 'Generate Content',
      description: 'Create new nodes, ideas, or content',
      icon: Sparkles,
      shortcut: 'Ctrl+E',
      action: () => openModal({ mode: 'generate' })
    },
    {
      id: 'edit',
      label: 'Edit Selection',
      description: 'Modify or improve selected nodes',
      icon: Pencil,
      action: () => openModal({ mode: 'edit', scope: 'selection' })
    },
    {
      id: 'organize',
      label: 'Organize Layout',
      description: 'Arrange and structure nodes',
      icon: LayoutGrid,
      action: () => openModal({ mode: 'organize' })
    },
    {
      id: 'automate',
      label: 'Create Automation',
      description: 'Set up triggers and workflows',
      icon: Zap,
      action: () => openModal({ mode: 'automate' })
    },
    {
      id: 'ask',
      label: 'Ask Question',
      description: 'Query your workspace',
      icon: HelpCircle,
      action: () => openModal({ mode: 'ask' })
    },
    {
      id: 'separator-1',
      label: '',
      description: '',
      icon: () => null,
      action: () => {},
      separator: true
    },
    {
      id: 'sidebar',
      label: 'AI Sidebar',
      description: 'Open persistent AI chat',
      icon: MessageSquare,
      shortcut: 'Ctrl+Shift+I',
      action: () => {
        onToggleAISidebar?.()
        onClose()
      }
    },
    {
      id: 'quick-prompt',
      label: 'Quick Prompt',
      description: 'Inline prompt at cursor',
      icon: Slash,
      shortcut: '/',
      action: () => {
        // Quick prompt is triggered by '/' key, just inform user
        onClose()
      }
    }
  ]

  // Filter out separators for navigation
  const navigableItems = menuItems.filter((item) => !item.separator)

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % navigableItems.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + navigableItems.length) % navigableItems.length)
          break
        case 'Enter':
          e.preventDefault()
          navigableItems[selectedIndex]?.action()
          onClose()
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab':
          // Allow tab to close menu naturally
          onClose()
          break
      }
    },
    [isOpen, selectedIndex, navigableItems, onClose]
  )

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown, onClose])

  // Reset selection when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
    }
  }, [isOpen])

  if (!isOpen || !anchorRect) return null

  // Position below the anchor
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
    zIndex: 9999
  }

  return (
    <div
      ref={menuRef}
      className="ai-action-menu"
      style={menuStyle}
      role="menu"
      aria-label="AI Actions"
    >
      {menuItems.map((item) => {
        if (item.separator) {
          return <div key={item.id} className="menu-separator" role="separator" />
        }

        const navIndex = navigableItems.findIndex((n) => n.id === item.id)
        const isSelected = navIndex === selectedIndex

        return (
          <button
            key={item.id}
            className={`menu-item ${isSelected ? 'selected' : ''}`}
            role="menuitem"
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              item.action()
              onClose()
            }}
            onMouseEnter={() => setSelectedIndex(navIndex)}
          >
            <item.icon className="menu-icon" />
            <div className="menu-content">
              <span className="menu-label">{item.label}</span>
              <span className="menu-description">{item.description}</span>
            </div>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
            <ChevronRight className="menu-arrow" />
          </button>
        )
      })}

      {/* Footer with keyboard hint */}
      <div className="menu-footer">
        <Keyboard className="footer-icon" />
        <span>Press ? for all shortcuts</span>
      </div>

      <style>{`
        .ai-action-menu {
          width: 280px;
          background: rgba(23, 23, 23, 0.98);
          border: 1px solid #444;
          border-radius: 10px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          overflow: hidden;
          padding: 4px;
        }

        .menu-separator {
          height: 1px;
          background: #333;
          margin: 4px 8px;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }

        .menu-item:hover,
        .menu-item.selected {
          background: rgba(124, 58, 237, 0.15);
        }

        .menu-item.selected {
          outline: 1px solid rgba(124, 58, 237, 0.4);
        }

        .menu-icon {
          width: 18px;
          height: 18px;
          color: var(--gui-accent-primary, #7c3aed);
          flex-shrink: 0;
        }

        .menu-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .menu-label {
          font-size: 13px;
          font-weight: 500;
          color: #f0f0f0;
        }

        .menu-description {
          font-size: 11px;
          color: #888;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .menu-shortcut {
          font-size: 11px;
          color: #666;
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: ui-monospace, monospace;
          flex-shrink: 0;
        }

        .menu-arrow {
          width: 14px;
          height: 14px;
          color: #555;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.1s;
        }

        .menu-item:hover .menu-arrow,
        .menu-item.selected .menu-arrow {
          opacity: 1;
        }

        .menu-footer {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-top: 1px solid #333;
          margin-top: 4px;
          font-size: 10px;
          color: #666;
        }

        .footer-icon {
          width: 12px;
          height: 12px;
        }

        /* Light mode */
        [data-theme="light"] .ai-action-menu {
          background: rgba(255, 255, 255, 0.98);
          border-color: #e5e7eb;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }

        [data-theme="light"] .menu-separator {
          background: #e5e7eb;
        }

        [data-theme="light"] .menu-item:hover,
        [data-theme="light"] .menu-item.selected {
          background: rgba(124, 58, 237, 0.08);
        }

        [data-theme="light"] .menu-label {
          color: #1f2937;
        }

        [data-theme="light"] .menu-description {
          color: #6b7280;
        }

        [data-theme="light"] .menu-shortcut {
          background: rgba(0, 0, 0, 0.05);
          color: #6b7280;
        }

        [data-theme="light"] .menu-footer {
          border-top-color: #e5e7eb;
          color: #9ca3af;
        }
      `}</style>
    </div>
  )
}

const AIActionMenu = memo(AIActionMenuComponent)
export default AIActionMenu
