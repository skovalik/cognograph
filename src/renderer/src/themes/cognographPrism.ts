// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Cognograph Prism Theme — syntax highlighting derived from CSS design tokens.
 * Uses CSS custom properties so theme auto-adapts to dark/light mode.
 */

import type { ArtifactContentType } from '@shared/types'
import type React from 'react'

import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'

// Core languages
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c'
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import csv from 'react-syntax-highlighter/dist/esm/languages/prism/csv'
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff'
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx'
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin'
import lua from 'react-syntax-highlighter/dist/esm/languages/prism/lua'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import mermaid from 'react-syntax-highlighter/dist/esm/languages/prism/mermaid'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift'
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'

SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('c', c)
SyntaxHighlighter.registerLanguage('cpp', cpp)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('csv', csv)
SyntaxHighlighter.registerLanguage('diff', diff)
SyntaxHighlighter.registerLanguage('docker', docker)
SyntaxHighlighter.registerLanguage('go', go)
SyntaxHighlighter.registerLanguage('graphql', graphql)
SyntaxHighlighter.registerLanguage('java', java)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('jsx', jsx)
SyntaxHighlighter.registerLanguage('kotlin', kotlin)
SyntaxHighlighter.registerLanguage('lua', lua)
SyntaxHighlighter.registerLanguage('markdown', markdown)
SyntaxHighlighter.registerLanguage('markup', markup)
SyntaxHighlighter.registerLanguage('mermaid', mermaid)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('ruby', ruby)
SyntaxHighlighter.registerLanguage('rust', rust)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('swift', swift)
SyntaxHighlighter.registerLanguage('toml', toml)
SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('yaml', yaml)

// Aliases — registerLanguage with the same grammar reference is a no-op past
// the first call, so use the runtime alias() method when available. Falls
// through silently if RSH dropped the API.
const aliasFn = (
  SyntaxHighlighter as unknown as {
    alias?: (name: string, aliases: string | string[]) => void
  }
).alias
if (typeof aliasFn === 'function') {
  aliasFn.call(SyntaxHighlighter, 'bash', ['sh', 'shell'])
  aliasFn.call(SyntaxHighlighter, 'javascript', ['js'])
  aliasFn.call(SyntaxHighlighter, 'typescript', ['ts'])
  aliasFn.call(SyntaxHighlighter, 'markup', ['html', 'xml', 'svg'])
  aliasFn.call(SyntaxHighlighter, 'docker', ['dockerfile'])
  aliasFn.call(SyntaxHighlighter, 'yaml', ['yml'])
}

export { SyntaxHighlighter as CognographHighlighter }

export const cognographTheme: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    background: 'var(--node-bg-secondary)',
    color: 'var(--node-text-secondary)',
    fontFamily: "var(--font-mono, 'Space Mono', 'JetBrains Mono', monospace)",
    lineHeight: '1.5',
    textShadow: 'none',
  },
  'pre[class*="language-"]': {
    background: 'var(--node-bg-secondary)',
    color: 'var(--node-text-secondary)',
    fontFamily: "var(--font-mono, 'Space Mono', 'JetBrains Mono', monospace)",
    lineHeight: '1.5',
    padding: '0.5rem',
    margin: '0',
    overflow: 'auto',
    borderRadius: '0.25rem',
    textShadow: 'none',
  },

  comment: { color: 'var(--text-muted)', fontStyle: 'italic' },
  prolog: { color: 'var(--text-muted)' },
  cdata: { color: 'var(--text-muted)' },
  doctype: { color: 'var(--node-text-secondary)' },
  punctuation: { color: 'var(--node-text-secondary)' },
  entity: { color: 'var(--node-text-secondary)', cursor: 'help' },

  keyword: { color: 'var(--cg-accent)' },
  atrule: { color: 'var(--cg-accent)' },
  important: { color: 'var(--cg-accent)', fontWeight: 'bold' },

  function: { color: 'var(--accent-glow)' },
  variable: { color: 'var(--accent-glow)' },
  operator: { color: 'var(--accent-glow)' },

  string: { color: 'var(--color-success)' },
  char: { color: 'var(--color-success)' },
  selector: { color: 'var(--color-success)' },
  builtin: { color: 'var(--color-success)' },
  inserted: { color: 'var(--color-success)' },
  regex: { color: 'var(--color-success)' },
  'attr-value': { color: 'var(--color-success)' },

  number: { color: 'var(--color-info)' },
  boolean: { color: 'var(--color-info)' },
  constant: { color: 'var(--color-info)' },

  'attr-name': { color: 'var(--color-warning)' },
  'class-name': { color: 'var(--color-warning)' },

  tag: { color: 'var(--color-error)' },
  symbol: { color: 'var(--color-error)' },
  deleted: { color: 'var(--color-error)' },
  property: { color: 'var(--color-error)' },

  url: { color: 'var(--color-info)' },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
  namespace: { opacity: 0.8 },
}

export function getLanguageForContentType(
  contentType: ArtifactContentType,
  language?: string,
): string {
  switch (contentType) {
    case 'code':
    case 'custom':
      return language || 'text'
    case 'markdown':
      return 'markdown'
    case 'json':
      return 'json'
    case 'csv':
      return 'csv'
    case 'html':
    case 'svg':
      return 'markup'
    case 'mermaid':
      return 'mermaid'
    default:
      return 'text'
  }
}
