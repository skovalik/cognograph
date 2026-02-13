/**
 * CollaborativeEditor — Rich text editor wrapper for multiplayer mode.
 *
 * When in multiplayer mode, uses a Y.XmlFragment as the content source
 * instead of raw HTML. Changes are synced in real-time via the Yjs CRDT.
 *
 * Falls back to the standard RichTextEditor in solo mode.
 */

import { memo, useMemo, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { createEditorExtensions } from '../utils/tiptapConfig'
import { createCollabExtensions, COLLAB_CURSOR_STYLES } from '../utils/tiptapCollabConfig'
import { RichTextToolbar } from './RichTextToolbar'
import { useCollaborativeProvider } from '../sync'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface CollaborativeEditorProps {
  /** Node ID — used to key the Y.XmlFragment */
  nodeId: string
  /** Field name within the node (e.g., 'content', 'notes') */
  fieldName?: string
  /** Placeholder text */
  placeholder?: string
  /** Additional CSS classes */
  className?: string
  /** Enable list extensions */
  enableLists?: boolean
  /** Enable heading extensions */
  enableHeadings?: boolean
  /** Enable formatting */
  enableFormatting?: boolean
  /** Whether editor is editable */
  editable?: boolean
  /** Minimum height */
  minHeight?: number
  /** Show toolbar */
  showToolbar?: boolean | 'on-focus'
}

export const CollaborativeEditor = memo(function CollaborativeEditor({
  nodeId,
  fieldName = 'content',
  placeholder = 'Start typing...',
  className = '',
  enableLists = true,
  enableHeadings = false,
  enableFormatting = true,
  editable = true,
  minHeight = 60,
  showToolbar = 'on-focus'
}: CollaborativeEditorProps) {
  const collaborativeProvider = useCollaborativeProvider()
  const syncMode = useWorkspaceStore((s) => s.syncMode)

  // Get or create the Y.XmlFragment for this node's content
  const fragment = useMemo(() => {
    if (!collaborativeProvider || syncMode !== 'multiplayer') return null

    const doc = collaborativeProvider.getDoc()
    // Each node's rich text content gets its own Y.XmlFragment
    // Keyed as: `node-{nodeId}-{fieldName}`
    return doc.getXmlFragment(`node-${nodeId}-${fieldName}`)
  }, [collaborativeProvider, syncMode, nodeId, fieldName])

  const awareness = useMemo(() => {
    if (!collaborativeProvider) return null
    return collaborativeProvider.getAwareness()
  }, [collaborativeProvider])

  // Get user info from awareness local state
  const localUser = useMemo(() => {
    if (!awareness) return { name: 'User', color: '#6366f1' }
    try {
      const localState = awareness.getLocalState()
      return {
        name: localState?.user?.name || 'User',
        color: localState?.user?.color || '#6366f1'
      }
    } catch {
      return { name: 'User', color: '#6366f1' }
    }
  }, [awareness])

  // Build extensions: base + collaboration
  const extensions = useMemo(() => {
    const baseExtensions = createEditorExtensions({
      enableLists,
      enableHeadings,
      enableFormatting,
      placeholder
    })

    if (fragment && awareness) {
      const collabExtensions = createCollabExtensions({
        fragment,
        awareness,
        user: localUser
      })
      return [...baseExtensions, ...collabExtensions]
    }

    return baseExtensions
  }, [fragment, awareness, localUser, enableLists, enableHeadings, enableFormatting, placeholder])

  const editor = useEditor({
    extensions,
    editable,
    // In collab mode, content comes from Y.XmlFragment, not from a string
    content: fragment ? undefined : '',
  }, [extensions, editable])

  // Inject collaboration cursor styles
  useEffect(() => {
    if (!fragment) return

    const styleId = 'collab-cursor-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = COLLAB_CURSOR_STYLES
      document.head.appendChild(style)
    }
  }, [fragment])

  if (!editor) return null

  const shouldShowToolbar = showToolbar === true ||
    (showToolbar === 'on-focus' && editor.isFocused)

  return (
    <div className={`collaborative-editor ${className}`}>
      {shouldShowToolbar && enableFormatting && (
        <RichTextToolbar
          editor={editor}
          enableLists={enableLists}
          enableHeadings={enableHeadings}
        />
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none"
        style={{ minHeight: `${minHeight}px` }}
      />
    </div>
  )
})
