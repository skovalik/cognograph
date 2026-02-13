import { memo, useState, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold, Italic, Strikethrough,
  List, ListOrdered,
  Heading1, Heading2, Heading3,
  Indent, Outdent, RemoveFormatting,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  MoreHorizontal
} from 'lucide-react'

interface RichTextToolbarProps {
  editor: Editor
  enableLists?: boolean
  enableHeadings?: boolean
  enableFormatting?: boolean
  enableAlignment?: boolean
  className?: string
  floating?: boolean
  onBeforeAction?: () => void
}

function ToolbarButton({
  onClick,
  isActive,
  icon: Icon,
  title,
  disabled
}: {
  onClick: () => void
  isActive?: boolean
  icon: React.ComponentType<{ className?: string }>
  title: string
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1 rounded transition-colors hover:bg-white/10 ${
        isActive ? 'bg-white/20 text-blue-400' : 'text-[var(--text-secondary)]'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

// Width thresholds for showing/hiding button groups
// Tuned for balance: show most buttons on typical cards (~200px), overflow on narrow ones
// - Formatting (4 btns): always visible (~85px)
// - Lists (4 btns): show on most cards
// - Alignment (4 btns): show on wider cards/panels
// - Headings (3 btns): show on wide panels only
const SHOW_HEADINGS_THRESHOLD = 280  // Headings only on wide containers
const SHOW_LISTS_THRESHOLD = 180     // Lists on most node cards
const SHOW_ALIGNMENT_THRESHOLD = 220 // Alignment on medium+ containers

function RichTextToolbarComponent({
  editor,
  enableLists = true,
  enableHeadings = false,
  enableFormatting = true,
  enableAlignment = true,
  className = '',
  floating = false,
  onBeforeAction
}: RichTextToolbarProps): JSX.Element {
  const [containerWidth, setContainerWidth] = useState<number>(Infinity)
  const [isOverflowOpen, setIsOverflowOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track container width with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Click-outside handler for overflow dropdown
  useEffect(() => {
    if (!isOverflowOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOverflowOpen])

  // Escape key to close dropdown
  useEffect(() => {
    if (!isOverflowOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOverflowOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOverflowOpen])

  // Determine which button groups to show inline vs in overflow
  const showHeadingsInline = containerWidth > SHOW_HEADINGS_THRESHOLD
  const showListsInline = containerWidth > SHOW_LISTS_THRESHOLD
  const showAlignmentInline = containerWidth > SHOW_ALIGNMENT_THRESHOLD

  // Check if we have any overflow items
  const hasOverflow =
    (enableHeadings && !showHeadingsInline) ||
    (enableLists && !showListsInline) ||
    (enableAlignment && !showAlignmentInline)

  // Render headings buttons
  const renderHeadings = () => (
    <>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        icon={Heading1}
        title="Heading 1"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        icon={Heading2}
        title="Heading 2"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        icon={Heading3}
        title="Heading 3"
      />
    </>
  )

  // Render list buttons
  const renderLists = () => (
    <>
      <ToolbarButton
        onClick={() => {
          onBeforeAction?.()
          editor.chain().focus().toggleBulletList().run()
        }}
        isActive={editor.isActive('bulletList')}
        icon={List}
        title="Bullet List (Ctrl+Shift+8)"
      />
      <ToolbarButton
        onClick={() => {
          onBeforeAction?.()
          editor.chain().focus().toggleOrderedList().run()
        }}
        isActive={editor.isActive('orderedList')}
        icon={ListOrdered}
        title="Numbered List (Ctrl+Shift+7)"
      />
      <ToolbarButton
        onClick={() => {
          onBeforeAction?.()
          editor.chain().focus().sinkListItem('listItem').run()
        }}
        disabled={!editor.can().sinkListItem('listItem')}
        icon={Indent}
        title="Indent (Tab)"
      />
      <ToolbarButton
        onClick={() => {
          onBeforeAction?.()
          editor.chain().focus().liftListItem('listItem').run()
        }}
        disabled={!editor.can().liftListItem('listItem')}
        icon={Outdent}
        title="Outdent (Shift+Tab)"
      />
    </>
  )

  // Render alignment buttons
  const renderAlignment = () => (
    <>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        icon={AlignLeft}
        title="Align Left"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        icon={AlignCenter}
        title="Center"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        icon={AlignRight}
        title="Align Right"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        icon={AlignJustify}
        title="Justify"
      />
    </>
  )

  return (
    <div
      ref={containerRef}
      className={`flex items-center gap-0.5 p-1 ${
        floating ? 'absolute -top-9 left-0 bg-[var(--surface-panel)] rounded-lg shadow-lg z-50 border border-[var(--border-subtle)]' : 'border-b border-white/10'
      } ${className}`}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Formatting - always visible */}
      {enableFormatting && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            icon={Bold}
            title="Bold (Ctrl+B)"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            icon={Italic}
            title="Italic (Ctrl+I)"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            icon={Strikethrough}
            title="Strikethrough"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
            icon={RemoveFormatting}
            title="Clear formatting"
          />
          {(enableHeadings || enableLists || enableAlignment) && (
            <div className="w-px h-4 bg-white/20 mx-0.5" />
          )}
        </>
      )}

      {/* Headings - shown inline if space */}
      {enableHeadings && showHeadingsInline && (
        <>
          {renderHeadings()}
          {(enableLists || enableAlignment) && (
            <div className="w-px h-4 bg-white/20 mx-0.5" />
          )}
        </>
      )}

      {/* Lists - shown inline if space */}
      {enableLists && showListsInline && (
        <>
          {renderLists()}
          {enableAlignment && showAlignmentInline && (
            <div className="w-px h-4 bg-white/20 mx-0.5" />
          )}
        </>
      )}

      {/* Alignment - shown inline if space */}
      {enableAlignment && showAlignmentInline && renderAlignment()}

      {/* Overflow dropdown */}
      {hasOverflow && (
        <div className="relative">
          <ToolbarButton
            onClick={() => setIsOverflowOpen(!isOverflowOpen)}
            icon={MoreHorizontal}
            title="More formatting"
            isActive={isOverflowOpen}
          />
          {isOverflowOpen && (
            <div
              className="absolute top-full left-0 mt-1 bg-[var(--surface-panel)] rounded-lg shadow-lg z-[100] border border-[var(--border-subtle)] p-1 min-w-max"
              onMouseDown={(e) => e.preventDefault()}
            >
              {/* Overflow headings */}
              {enableHeadings && !showHeadingsInline && (
                <div className="flex items-center gap-0.5 p-0.5">
                  {renderHeadings()}
                </div>
              )}
              {/* Overflow lists */}
              {enableLists && !showListsInline && (
                <div className="flex items-center gap-0.5 p-0.5">
                  {renderLists()}
                </div>
              )}
              {/* Overflow alignment */}
              {enableAlignment && !showAlignmentInline && (
                <div className="flex items-center gap-0.5 p-0.5">
                  {renderAlignment()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const RichTextToolbar = memo(RichTextToolbarComponent)
