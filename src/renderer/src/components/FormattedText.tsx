/**
 * FormattedText Component
 *
 * Renders text with simple markdown-like formatting:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - ~~strikethrough~~
 * - `code`
 *
 * Used for node titles and edge labels.
 */

import { memo, useMemo } from 'react'

interface FormattedTextProps {
  text: string
  className?: string
  style?: React.CSSProperties
  onDoubleClick?: (e: React.MouseEvent) => void
}

interface TextSegment {
  text: string
  bold?: boolean
  italic?: boolean
  strikethrough?: boolean
  code?: boolean
}

/**
 * Parse text with markdown-like formatting into segments
 */
function parseFormattedText(text: string): TextSegment[] {
  const segments: TextSegment[] = []

  // Regex patterns for formatting (non-greedy)
  // Order matters: more specific patterns first
  const patterns = [
    { regex: /\*\*(.+?)\*\*/g, format: 'bold' as const },
    { regex: /__(.+?)__/g, format: 'bold' as const },
    { regex: /\*(.+?)\*/g, format: 'italic' as const },
    { regex: /_(.+?)_/g, format: 'italic' as const },
    { regex: /~~(.+?)~~/g, format: 'strikethrough' as const },
    { regex: /`(.+?)`/g, format: 'code' as const },
  ]

  // Find all matches with their positions
  interface Match {
    start: number
    end: number
    text: string
    format: 'bold' | 'italic' | 'strikethrough' | 'code'
  }

  const matches: Match[] = []

  for (const { regex, format } of patterns) {
    let match
    // Reset regex lastIndex
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      // Check if this range overlaps with existing matches
      const start = match.index
      const end = match.index + match[0].length
      const overlaps = matches.some(m =>
        (start >= m.start && start < m.end) ||
        (end > m.start && end <= m.end) ||
        (start <= m.start && end >= m.end)
      )

      if (!overlaps) {
        matches.push({
          start,
          end,
          text: match[1], // Captured group (content without markers)
          format
        })
      }
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start)

  // Build segments
  let lastEnd = 0

  for (const match of matches) {
    // Add plain text before this match
    if (match.start > lastEnd) {
      segments.push({ text: text.slice(lastEnd, match.start) })
    }

    // Add formatted segment
    segments.push({
      text: match.text,
      [match.format]: true
    })

    lastEnd = match.end
  }

  // Add remaining plain text
  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd) })
  }

  // If no matches, return single plain segment
  if (segments.length === 0) {
    segments.push({ text })
  }

  return segments
}

/**
 * Check if text contains any formatting markers
 */
export function hasFormatting(text: string): boolean {
  return /\*\*|__|\*|_|~~|`/.test(text)
}

function FormattedTextComponent({ text, className, style, onDoubleClick }: FormattedTextProps): JSX.Element {
  const segments = useMemo(() => parseFormattedText(text), [text])

  // Fast path: if only one segment with no formatting, return plain span
  const firstSegment = segments[0]
  if (segments.length === 1 && firstSegment && !firstSegment.bold && !firstSegment.italic && !firstSegment.strikethrough && !firstSegment.code) {
    return <span className={className} style={style} onDoubleClick={onDoubleClick}>{text}</span>
  }

  return (
    <span className={className} style={style} onDoubleClick={onDoubleClick}>
      {segments.map((segment, index) => {
        let content: React.ReactNode = segment.text

        // Apply formatting in order: code, strikethrough, italic, bold
        if (segment.code) {
          content = (
            <code
              className="px-1 py-0.5 rounded text-[0.9em]"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--gui-text-primary) 10%, transparent)',
                fontFamily: 'monospace'
              }}
            >
              {content}
            </code>
          )
        }

        if (segment.strikethrough) {
          content = <s className="opacity-60">{content}</s>
        }

        if (segment.italic) {
          content = <em>{content}</em>
        }

        if (segment.bold) {
          content = <strong className="font-semibold">{content}</strong>
        }

        return <span key={index}>{content}</span>
      })}
    </span>
  )
}

export const FormattedText = memo(FormattedTextComponent)
