/**
 * TipTap collaboration extension configuration.
 *
 * Provides Collaboration and CollaborationCursor extensions
 * configured with a Y.XmlFragment for real-time collaborative editing.
 */

import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import type { XmlFragment as YXmlFragment } from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

export interface CollabExtensionOptions {
  /** The Y.XmlFragment to bind to */
  fragment: YXmlFragment
  /** The Yjs awareness instance for cursors */
  awareness: Awareness
  /** Local user display info */
  user: {
    name: string
    color: string
  }
}

/**
 * Create TipTap collaboration extensions.
 * These should be added to the base extensions from createEditorExtensions().
 */
export function createCollabExtensions(options: CollabExtensionOptions) {
  const { fragment, awareness, user } = options

  return [
    Collaboration.configure({
      fragment
    }),
    CollaborationCursor.configure({
      provider: { awareness } as any, // CollaborationCursor accepts provider with awareness
      user: {
        name: user.name,
        color: user.color
      }
    })
  ]
}

/**
 * CSS for collaboration cursors rendered by TipTap.
 * These styles are applied to the cursor elements inside the editor.
 */
export const COLLAB_CURSOR_STYLES = `
.collaboration-cursor__caret {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 1px solid;
  border-right: 1px solid;
  word-break: normal;
  pointer-events: none;
}

.collaboration-cursor__label {
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 10px;
  font-weight: 600;
  line-height: normal;
  white-space: nowrap;
  color: white;
  padding: 0.1rem 0.3rem;
  border-radius: 3px 3px 3px 0;
  user-select: none;
  pointer-events: none;
}
`
