import StarterKit from '@tiptap/starter-kit'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'

export interface EditorExtensionOptions {
  enableLists?: boolean
  enableHeadings?: boolean
  enableFormatting?: boolean
  enableAlignment?: boolean
  placeholder?: string
}

export function createEditorExtensions(options?: EditorExtensionOptions) {
  const {
    enableLists = true,
    enableHeadings = false,
    enableFormatting = true,
    enableAlignment = true,
    placeholder = ''
  } = options || {}

  const extensions = [
    StarterKit.configure({
      // undoRedo: false - renamed from 'history' in Tiptap v3
      bulletList: false,
      orderedList: false,
      listItem: false,
      bold: enableFormatting ? undefined : false,
      italic: enableFormatting ? undefined : false,
      strike: enableFormatting ? undefined : false,
      heading: enableHeadings ? { levels: [1, 2, 3, 4, 5, 6] } : false,
    }),
    Placeholder.configure({
      placeholder,
    }),
  ]

  if (enableLists) {
    extensions.push(
      BulletList.configure({}) as unknown as typeof extensions[number],
      OrderedList.configure({}) as unknown as typeof extensions[number],
      ListItem.configure({}) as unknown as typeof extensions[number]
    )
  }

  if (enableAlignment) {
    extensions.push(
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }) as unknown as typeof extensions[number]
    )
  }

  return extensions
}
