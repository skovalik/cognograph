/**
 * NoteArtboard — Mode-specific expanded note panel for ArtboardOverlay.
 *
 * Renders differently based on noteMode:
 * - general: Full TipTap editor with formatting toolbar
 * - reference: Split view with iframe placeholder + notes
 * - design-tokens: Editor + swatch preview area
 * - page/component/content-model/wp-config: Structured mode editors
 * - persona/examples/background: Full TipTap with mode-specific hints
 */

import { memo, useCallback, useMemo } from 'react'
import {
  StickyNote,
  Bot,
  BookOpen,
  Code2,
  Layers,
  Palette,
  FileText,
  Component,
  FileJson,
  Settings,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useNodesStore } from '../../stores/nodesStore'
import { RichTextEditor } from '../RichTextEditor'
import { DesignTokenEditor } from '../nodes/DesignTokenEditor'
import { PageNoteBody } from '../nodes/PageNoteBody'
import { ComponentNoteBody } from '../nodes/ComponentNoteBody'
import { ContentModelBody } from '../nodes/ContentModelBody'
import { WPConfigBody } from '../nodes/WPConfigBody'
import type { NoteNodeData, NoteMode } from '@shared/types'

interface NoteArtboardProps {
  nodeId: string
}

// Mode configuration
const NOTE_MODE_INFO: Record<
  NoteMode,
  { label: string; icon: typeof StickyNote; color: string; hint: string }
> = {
  general: {
    label: 'General Note',
    icon: StickyNote,
    color: '#f59e0b',
    hint: 'A general-purpose note. Write freely.',
  },
  persona: {
    label: 'Persona / Instructions',
    icon: Bot,
    color: '#8b5cf6',
    hint: 'AI personality and instructions. This content shapes how connected conversations behave.',
  },
  reference: {
    label: 'Reference Material',
    icon: BookOpen,
    color: '#3b82f6',
    hint: 'Reference material for connected conversations. Used as background context.',
  },
  examples: {
    label: 'Style Guide / Examples',
    icon: Code2,
    color: '#f59e0b',
    hint: 'Code or writing examples. Connected conversations will match this style.',
  },
  background: {
    label: 'Background Context',
    icon: Layers,
    color: '#6b7280',
    hint: 'Supporting context injected at low priority into connected conversations.',
  },
  'design-tokens': {
    label: 'Design Tokens',
    icon: Palette,
    color: '#ec4899',
    hint: 'Theme colors, fonts, and spacing tokens. Use CSS custom property format.',
  },
  page: {
    label: 'Page',
    icon: FileText,
    color: '#3b82f6',
    hint: 'Web page documentation with route, SEO, and component mapping.',
  },
  component: {
    label: 'Component',
    icon: Component,
    color: '#8b5cf6',
    hint: 'UI component specification with props, slots, and responsive behavior.',
  },
  'content-model': {
    label: 'Content Model',
    icon: FileJson,
    color: '#f97316',
    hint: 'WordPress CPT + ACF field group definition.',
  },
  'wp-config': {
    label: 'WordPress Config',
    icon: Settings,
    color: '#21759b',
    hint: 'WordPress site connection settings.',
  },
}

function NoteArtboardComponent({ nodeId }: NoteArtboardProps): JSX.Element {
  const nodes = useNodesStore((s) => s.nodes)
  const updateNode = useWorkspaceStore((s) => s.updateNode)

  const node = nodes.find((n) => n.id === nodeId)
  const nodeData = node?.data as NoteNodeData | undefined

  const currentMode = nodeData?.noteMode || 'general'
  const modeInfo = NOTE_MODE_INFO[currentMode]

  const handleContentChange = useCallback(
    (html: string) => {
      updateNode(nodeId, { content: html })
    },
    [nodeId, updateNode]
  )

  const handleDesignTokenChange = useCallback(
    (content: string) => {
      updateNode(nodeId, { content, contentFormat: 'plain' })
    },
    [nodeId, updateNode]
  )

  // Word count
  const wordCount = useMemo(() => {
    if (!nodeData?.content) return 0
    const plain = nodeData.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return plain ? plain.split(/\s+/).filter((w) => w.length > 0).length : 0
  }, [nodeData?.content])

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

  const ModeIcon = modeInfo.icon

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mode indicator bar */}
      <div
        className="flex items-center gap-3 px-5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--gui-border)' }}
      >
        <ModeIcon
          className="w-4 h-4 flex-shrink-0"
          style={{ color: modeInfo.color }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: modeInfo.color }}
        >
          {modeInfo.label}
        </span>
        <span
          className="text-[10px] flex-1"
          style={{ color: 'var(--gui-text-muted)' }}
        >
          {modeInfo.hint}
        </span>
        <span
          className="text-[10px] flex-shrink-0"
          style={{ color: 'var(--gui-text-muted)' }}
        >
          {wordCount} words
        </span>
      </div>

      {/* Mode-specific content */}
      <div className="flex-1 overflow-auto">
        {currentMode === 'page' ? (
          <div className="p-5">
            <PageNoteBody
              page={nodeData.page}
              onChange={(page) => updateNode(nodeId, { page })}
              selected={true}
            />
          </div>
        ) : currentMode === 'component' ? (
          <div className="p-5">
            <ComponentNoteBody
              component={nodeData.component}
              onChange={(component) => updateNode(nodeId, { component })}
              selected={true}
            />
          </div>
        ) : currentMode === 'content-model' ? (
          <div className="p-5">
            <ContentModelBody
              contentModel={nodeData.contentModel}
              onChange={(contentModel) =>
                updateNode(nodeId, { contentModel })
              }
              selected={true}
            />
          </div>
        ) : currentMode === 'wp-config' ? (
          <div className="p-5">
            <WPConfigBody
              wpConfig={nodeData.wpConfig}
              onChange={(wpConfig) => updateNode(nodeId, { wpConfig })}
              selected={true}
            />
          </div>
        ) : currentMode === 'design-tokens' ? (
          <div className="p-5 h-full">
            <DesignTokenEditor
              content={nodeData.content || ''}
              onChange={handleDesignTokenChange}
            />
          </div>
        ) : currentMode === 'reference' ? (
          /* Reference mode: split layout — iframe area + notes */
          <div className="flex h-full">
            <div
              className="flex-1 flex items-center justify-center"
              style={{
                backgroundColor: 'var(--gui-bg-secondary)',
                borderRight: '1px solid var(--gui-border)',
              }}
            >
              <div
                className="text-center"
                style={{ color: 'var(--gui-text-muted)' }}
              >
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Reference iframe</p>
                <p className="text-[10px]">
                  Connect a URL node for live preview
                </p>
              </div>
            </div>
            <div className="flex-1 p-5">
              <RichTextEditor
                value={nodeData.content || ''}
                onChange={handleContentChange}
                placeholder="Add reference notes..."
                enableLists={true}
                enableFormatting={true}
                enableHeadings={true}
                showToolbar={true}
                minHeight={200}
              />
            </div>
          </div>
        ) : (
          /* General, persona, examples, background: Full editor */
          <div className="p-5 h-full">
            <RichTextEditor
              value={nodeData.content || ''}
              onChange={handleContentChange}
              placeholder={
                currentMode === 'persona'
                  ? 'Define the AI persona and instructions...'
                  : currentMode === 'examples'
                  ? 'Add code or writing style examples...'
                  : currentMode === 'background'
                  ? 'Add background context...'
                  : 'Start writing...'
              }
              enableLists={true}
              enableFormatting={true}
              enableHeadings={true}
              showToolbar={true}
              minHeight={200}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export const NoteArtboard = memo(NoteArtboardComponent)
