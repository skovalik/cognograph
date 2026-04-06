// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * StreamingMarkdown — optimized markdown renderer for streaming LLM output.
 *
 * Problem: ReactMarkdown re-parses the entire string on every chunk,
 * causing O(n^2) work and layout thrash during streaming.
 *
 * Solution: Split the markdown into stable blocks (paragraphs, code fences,
 * headers, lists, HRs). Already-complete blocks are memoized and skip
 * re-parsing. Only the trailing incomplete block re-renders on each chunk.
 * Result: O(n) block array with O(1) reconciliation per memoized child.
 */

import { memo, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'

// ---------------------------------------------------------------------------
// Block splitter
// ---------------------------------------------------------------------------

/**
 * Splits markdown text into discrete blocks. A "block boundary" is a blank
 * line that isn't inside a fenced code block.
 *
 * Returns an array of raw markdown strings, each representing one logical
 * block (paragraph, code fence, heading, list run, etc.).
 */
export function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let inCodeFence = false

  for (const line of lines) {
    // Track fenced code blocks so blank lines inside them don't split
    if (/^```/.test(line.trimEnd())) {
      inCodeFence = !inCodeFence
    }

    if (!inCodeFence && line.trim() === '' && current.length > 0) {
      // Blank line outside a code fence → flush current block
      blocks.push(current.join('\n'))
      current = []
    } else {
      current.push(line)
    }
  }

  // Always push whatever remains (the "tail" block, possibly incomplete)
  if (current.length > 0) {
    blocks.push(current.join('\n'))
  }

  return blocks
}

// ---------------------------------------------------------------------------
// Shared ReactMarkdown component config
// ---------------------------------------------------------------------------

interface MarkdownBlockProps {
  content: string
  inlineCodeClasses: string
  copyButtonClasses: string
}

/**
 * A single memoized markdown block. Because each block's `content` prop is
 * stable once the block is "complete" (a new block started after it), React
 * skips re-rendering entirely thanks to memo.
 */
const MarkdownBlock = memo(function MarkdownBlock({
  content,
  inlineCodeClasses,
  copyButtonClasses,
}: MarkdownBlockProps): JSX.Element {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p({ children }) {
          return (
            <p style={{ display: 'block', marginTop: '0.75em', marginBottom: '0.75em' }}>
              {children}
            </p>
          )
        },
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const isInlineCode = !match

          if (isInlineCode) {
            return (
              <code className={`${inlineCodeClasses} px-1 py-0.5 rounded text-sm`} {...props}>
                {children}
              </code>
            )
          }

          return (
            <div className="relative group overflow-hidden">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
                  toast.success('Copied to clipboard')
                }}
                className={`absolute top-2 right-2 px-2 py-1 ${copyButtonClasses} rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10`}
              >
                Copy
              </button>
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: '0.5rem',
                  overflowX: 'auto',
                  maxWidth: '100%',
                }}
                wrapLongLines={false}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
})

MarkdownBlock.displayName = 'MarkdownBlock'

// ---------------------------------------------------------------------------
// StreamingMarkdown
// ---------------------------------------------------------------------------

interface StreamingMarkdownProps {
  /** The full markdown string (grows during streaming) */
  content: string
  /** Whether the LLM is actively streaming */
  isStreaming: boolean
  /** Prose wrapper classes (light/dark theme) — applied by parent container */
  proseClasses?: string
  /** Inline code styling classes */
  inlineCodeClasses: string
  /** Copy button styling classes */
  copyButtonClasses: string
}

function StreamingMarkdownInner({
  content,
  isStreaming,
  inlineCodeClasses,
  copyButtonClasses,
}: StreamingMarkdownProps): JSX.Element {
  const blocks = useMemo(() => splitMarkdownBlocks(content), [content])

  // When not streaming, render everything as one block (simpler, avoids
  // any edge-case from splitting)
  if (!isStreaming) {
    return (
      <MarkdownBlock
        content={content}
        inlineCodeClasses={inlineCodeClasses}
        copyButtonClasses={copyButtonClasses}
      />
    )
  }

  return (
    <>
      {blocks.map((block, i) => (
        <MarkdownBlock
          // Stable blocks get a content-derived key so React reuses them.
          // The last block (tail) uses a special key that changes with content
          // to force re-render only on the active block.
          key={i < blocks.length - 1 ? `stable-${i}` : `tail-${block.length}`}
          content={block}
          inlineCodeClasses={inlineCodeClasses}
          copyButtonClasses={copyButtonClasses}
        />
      ))}
    </>
  )
}

export const StreamingMarkdown = memo(StreamingMarkdownInner)
StreamingMarkdown.displayName = 'StreamingMarkdown'
