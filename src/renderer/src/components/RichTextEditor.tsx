import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { createEditorExtensions } from '../utils/tiptapConfig'
import { createCollabExtensions, COLLAB_CURSOR_STYLES } from '../utils/tiptapCollabConfig'
import { RichTextToolbar } from './RichTextToolbar'
import { normalizeContentForEditor } from '../utils/nodeUtils'
import type { XmlFragment as YXmlFragment } from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  enableLists?: boolean
  enableHeadings?: boolean
  enableFormatting?: boolean
  enableAlignment?: boolean
  floatingToolbar?: boolean
  showToolbar?: boolean | 'on-focus'
  minHeight?: number
  editable?: boolean
  editOnDoubleClick?: boolean
  onEditingChange?: (isEditing: boolean) => void
  onOverflowChange?: (isOverflowing: boolean) => void
  observeOverflow?: boolean
  // Collaboration props (optional — when provided, uses Yjs for content)
  yjsFragment?: YXmlFragment
  awareness?: Awareness
  collaborativeUser?: { name: string; color: string }
}

function RichTextEditorComponent({
  value,
  onChange,
  placeholder = 'Start typing...',
  className = '',
  enableLists = true,
  enableHeadings = false,
  enableFormatting = true,
  enableAlignment = true,
  floatingToolbar = false,
  showToolbar = 'on-focus',
  minHeight = 60,
  editable = true,
  editOnDoubleClick = false,
  onEditingChange,
  onOverflowChange,
  observeOverflow = true,
  yjsFragment,
  awareness,
  collaborativeUser,
}: RichTextEditorProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Debounce timer for batching text edits into single undo entries
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEmittedHTML = useRef<string>(value)

  // Blur guard — suppress blur events triggered by toolbar DOM operations
  const suppressBlurRef = useRef(false)

  // Determine effective editable state
  const effectiveEditable = editOnDoubleClick ? isEditing : editable

  // Keep lastEmittedHTML in sync with external value changes
  useEffect(() => {
    lastEmittedHTML.current = value
  }, [value])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  // Build extensions: base + optional collaboration
  const extensions = useMemo(() => {
    const base = createEditorExtensions({
      enableLists,
      enableHeadings,
      enableFormatting,
      enableAlignment,
      placeholder,
    })

    if (yjsFragment && awareness && collaborativeUser) {
      const collab = createCollabExtensions({
        fragment: yjsFragment,
        awareness,
        user: collaborativeUser,
      })
      return [...base, ...collab]
    }

    return base
  }, [enableLists, enableHeadings, enableFormatting, enableAlignment, placeholder, yjsFragment, awareness, collaborativeUser])

  // Inject collab cursor CSS when in collaborative mode
  useEffect(() => {
    if (!yjsFragment) return
    const styleId = 'collab-cursor-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = COLLAB_CURSOR_STYLES
      document.head.appendChild(style)
    }
  }, [yjsFragment])

  const editor = useEditor({
    extensions,
    content: normalizeContentForEditor(value),
    editable: effectiveEditable,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      const isEmpty = html === '<p></p>' || html === ''
      const normalized = isEmpty ? '' : html

      // Debounce onChange to batch rapid edits into single undo entries
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      debounceTimer.current = setTimeout(() => {
        if (normalized !== lastEmittedHTML.current) {
          lastEmittedHTML.current = normalized
          onChange(normalized)
        }
      }, 500)
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => {
      // Ignore blur events triggered by toolbar DOM operations (indent/outdent/list toggle)
      if (suppressBlurRef.current) {
        suppressBlurRef.current = false
        return
      }

      // Flush any pending debounced change before exiting
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
        const html = editor?.getHTML() || ''
        const isEmpty = html === '<p></p>' || html === ''
        const normalized = isEmpty ? '' : html
        if (normalized !== lastEmittedHTML.current) {
          lastEmittedHTML.current = normalized
          onChange(normalized)
        }
      }

      setIsFocused(false)
      if (editOnDoubleClick) {
        setIsEditing(false)
        onEditingChange?.(false)
      }
    },
  })

  // Sync external value changes
  useEffect(() => {
    if (!editor) return
    const currentHTML = editor.getHTML()
    const normalizedCurrent = currentHTML === '<p></p>' ? '' : currentHTML
    const normalizedValue = normalizeContentForEditor(value)
    if (normalizedCurrent !== normalizedValue) {
      editor.commands.setContent(normalizedValue || '<p></p>', { emitUpdate: false })
    }
  }, [value, editor])

  // Sync editable state with editor
  useEffect(() => {
    if (editor) {
      editor.setEditable(effectiveEditable)
    }
  }, [effectiveEditable, editor])

  // Detect content overflow (only when observeOverflow is true to avoid ResizeObserver churn during zoom)
  useEffect(() => {
    if (!contentRef.current || !onOverflowChange || !observeOverflow) return
    const el = contentRef.current
    const check = () => onOverflowChange(el.scrollHeight > el.clientHeight)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [onOverflowChange, value, observeOverflow])

  // Toolbar action callback — suppress the next blur to keep editing mode active
  const handleToolbarAction = useCallback(() => {
    suppressBlurRef.current = true
    setTimeout(() => { suppressBlurRef.current = false }, 150)
  }, [])

  // Double-click to enter edit mode
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!editOnDoubleClick || !editor) return
    e.stopPropagation()
    e.preventDefault()
    setIsEditing(true)
    onEditingChange?.(true)
    // Focus after editable state takes effect — no position arg so user clicks where they want
    setTimeout(() => {
      editor.commands.focus()
    }, 0)
  }, [editOnDoubleClick, editor, onEditingChange])

  // Prevent node drag when editing; block middle-click auto-scroll always
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing || !editOnDoubleClick) {
      e.stopPropagation()
    }
    if (e.button === 1) {
      e.preventDefault()
    }
  }, [isEditing, editOnDoubleClick])

  // Only stop click propagation when editing (so node selection works when not editing)
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isEditing || !editOnDoubleClick) {
      e.stopPropagation()
    }
  }, [isEditing, editOnDoubleClick])

  if (!editor) return <div className="min-h-[30px]" />

  const shouldShowToolbar =
    (showToolbar === true || (showToolbar === 'on-focus' && isFocused)) &&
    (editOnDoubleClick ? isEditing : true)

  return (
    <div
      className={`rich-text-editor ${isEditing ? 'is-editing nodrag' : ''} ${className}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      ref={contentRef}
    >
      {shouldShowToolbar && (
        <RichTextToolbar
          editor={editor}
          enableLists={enableLists}
          enableHeadings={enableHeadings}
          enableFormatting={enableFormatting}
          enableAlignment={enableAlignment}
          floating={floatingToolbar}
          onBeforeAction={handleToolbarAction}
        />
      )}
      <EditorContent
        editor={editor}
        className="rich-text-content"
        style={{
          minHeight,
        }}
      />
    </div>
  )
}

export const RichTextEditor = memo(RichTextEditorComponent)
