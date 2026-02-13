// DesignTokenEditor — Renders inside NoteNode when noteMode === 'design-tokens'
// Provides a monospace textarea for editing DesignTokenSet JSON with validation

import { memo, useCallback, useState, useRef, useEffect } from 'react'
import type { DesignTokenSet, DesignToken } from '@shared/types'

interface DesignTokenEditorProps {
  content: string
  onChange: (content: string) => void
}

/**
 * Attempt to parse the content as a DesignTokenSet JSON.
 * Returns the parsed set or null if invalid.
 */
function tryParseTokenSet(content: string): { set: DesignTokenSet | null; error: string | null } {
  if (!content || !content.trim()) {
    return { set: null, error: null }
  }
  try {
    const parsed = JSON.parse(content)
    if (typeof parsed !== 'object' || parsed === null) {
      return { set: null, error: 'Token data must be a JSON object' }
    }
    if (typeof parsed.name !== 'string') {
      return { set: null, error: 'Missing required field: "name"' }
    }
    if (parsed.tokens && typeof parsed.tokens !== 'object') {
      return { set: null, error: '"tokens" must be an object' }
    }
    return { set: parsed as DesignTokenSet, error: null }
  } catch (e) {
    return { set: null, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

/**
 * Renders a color swatch if the token type is 'color'.
 */
function TokenSwatch({ token }: { token: DesignToken }): JSX.Element | null {
  if (token.type !== 'color') return null
  return (
    <span
      className="inline-block w-3 h-3 rounded-sm border flex-shrink-0"
      style={{
        backgroundColor: token.value,
        borderColor: 'var(--node-border-color, rgba(255,255,255,0.15))'
      }}
      title={token.value}
    />
  )
}

/**
 * Renders the parsed token grid (read-only summary).
 */
function TokenGrid({ tokenSet }: { tokenSet: DesignTokenSet }): JSX.Element {
  const entries = Object.entries(tokenSet.tokens || {})

  if (entries.length === 0) {
    return (
      <div className="text-[10px] opacity-50 italic px-1 py-0.5" style={{ color: 'var(--node-text-muted)' }}>
        No tokens defined. Edit JSON below.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 mb-1 max-h-[80px] overflow-y-auto">
      {entries.slice(0, 12).map(([name, token]) => (
        <div key={name} className="flex items-center gap-1 px-1 text-[10px]" style={{ color: 'var(--node-text-secondary)' }}>
          <TokenSwatch token={token} />
          <span className="font-mono truncate flex-1" title={name}>{name}</span>
          <span
            className="px-1 py-0 rounded text-[9px] font-medium flex-shrink-0"
            style={{
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: 'rgba(139, 92, 246, 0.9)'
            }}
          >
            {token.type}
          </span>
          <span className="font-mono truncate max-w-[80px] opacity-70" title={token.value}>{token.value}</span>
        </div>
      ))}
      {entries.length > 12 && (
        <div className="text-[9px] opacity-50 px-1" style={{ color: 'var(--node-text-muted)' }}>
          +{entries.length - 12} more tokens
        </div>
      )}
    </div>
  )
}

function DesignTokenEditorComponent({ content, onChange }: DesignTokenEditorProps): JSX.Element {
  const [localContent, setLocalContent] = useState(content || '')
  const [parseError, setParseError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync from parent when not editing (e.g., external updates)
  useEffect(() => {
    if (!isEditing) {
      setLocalContent(content || '')
      const { error } = tryParseTokenSet(content || '')
      setParseError(error)
    }
  }, [content, isEditing])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value)
  }, [])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    const { error } = tryParseTokenSet(localContent)
    setParseError(error)
    // Always persist the content, even if invalid JSON (user might be mid-edit)
    if (localContent !== content) {
      onChange(localContent)
    }
  }, [localContent, content, onChange])

  const handleFocus = useCallback(() => {
    setIsEditing(true)
  }, [])

  // Parse for display (non-editing state)
  const { set: tokenSet } = tryParseTokenSet(localContent)

  return (
    <div className="flex flex-col gap-1 w-full nodrag nowheel" data-focusable="true">
      {/* Token grid summary (when we have valid tokens) */}
      {tokenSet && !isEditing && <TokenGrid tokenSet={tokenSet} />}

      {/* Monospace textarea for JSON editing */}
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder='{\n  "name": "My Design System",\n  "tokens": {}\n}'
        spellCheck={false}
        className="w-full font-mono text-[11px] leading-tight resize-none rounded px-1.5 py-1 outline-none border nodrag nowheel"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderColor: parseError ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.08)',
          color: 'var(--node-text-primary, #e0e0e0)',
          minHeight: isEditing ? '120px' : '60px',
          maxHeight: '200px',
          tabSize: 2,
          whiteSpace: 'pre',
          overflowWrap: 'normal',
          overflowX: 'auto'
        }}
      />

      {/* Parse error display */}
      {parseError && (
        <div
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'rgba(239, 68, 68, 0.9)'
          }}
        >
          JSON Error: {parseError}
        </div>
      )}
    </div>
  )
}

export const DesignTokenEditor = memo(DesignTokenEditorComponent)
