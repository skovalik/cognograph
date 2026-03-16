/**
 * TextArtboard — Chrome-free TipTap editor for ArtboardOverlay.
 *
 * Minimal — just the text content with a floating toolbar.
 * No header, no footer, no metadata. The overlay provides the frame.
 */

import { memo, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useNodesStore } from '../../stores/nodesStore'
import { RichTextEditor } from '../RichTextEditor'
import type { TextNodeData } from '@shared/types'

interface TextArtboardProps {
  nodeId: string
}

function TextArtboardComponent({ nodeId }: TextArtboardProps): JSX.Element {
  const nodes = useNodesStore((s) => s.nodes)
  const updateNode = useWorkspaceStore((s) => s.updateNode)

  const node = nodes.find((n) => n.id === nodeId)
  const nodeData = node?.data as TextNodeData | undefined

  const handleContentChange = useCallback(
    (html: string) => {
      updateNode(nodeId, { content: html })
    },
    [nodeId, updateNode]
  )

  if (!nodeData) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: 'var(--gui-text-muted)' }}
      >
        Node not found
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <RichTextEditor
        value={nodeData.content || ''}
        onChange={handleContentChange}
        placeholder="Type here..."
        enableLists={true}
        enableFormatting={true}
        enableHeadings={true}
        enableAlignment={true}
        floatingToolbar={true}
        showToolbar="on-focus"
        minHeight={300}
      />
    </div>
  )
}

export const TextArtboard = memo(TextArtboardComponent)
