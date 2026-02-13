/**
 * Prompt Analysis Hook
 *
 * Analyzes user input to infer the intended mode and provide autocomplete suggestions.
 * Uses pattern matching to detect keywords that indicate fix, refactor, organize, or generate modes.
 */

import { useMemo } from 'react'
import { useDebounce } from './useDebounce'
import type { AIEditorMode } from '@shared/types'

export interface PromptAnalysis {
  inferredMode: AIEditorMode | null
  confidence: number
  suggestions: string[]
}

// Patterns that indicate each mode
const MODE_PATTERNS: Record<AIEditorMode, RegExp[]> = {
  fix: [
    /\bfix\b/i,
    /\bcorrect\b/i,
    /\brepair\b/i,
    /\bimprove\b/i,
    /\bupdate\b/i,
    /\brefine\b/i,
    /\benhance\b/i,
    /\badjust\b/i,
    /\bmodify\b/i,
    /\bchange\b/i,
    /\bedit\b/i,
    /\bexpand\b/i,
    /\bsummarize\b/i,
    /\bcontinue\b/i
  ],
  refactor: [
    /\brefactor\b/i,
    /\brestructure\b/i,
    /\bsimplify\b/i,
    /\bclean\s*up\b/i,
    /\boptimize\b/i,
    /\bsplit\b/i,
    /\bmerge\b/i,
    /\bconsolidate\b/i,
    /\bmodularize\b/i,
    /\bconvert\b/i,
    /\btransform\b/i
  ],
  organize: [
    /\borganize\b/i,
    /\bsort\b/i,
    /\bgroup\b/i,
    /\barrange\b/i,
    /\border\b/i,
    /\bprioritize\b/i,
    /\bcategorize\b/i,
    /\bconnect\b/i,
    /\blink\b/i,
    /\blayout\b/i,
    /\balign\b/i,
    /\bdistribute\b/i,
    /\bcluster\b/i,
    /\bmove\b/i,
    /\breposition\b/i,
    /\brearrange\b/i
  ],
  generate: [
    /\bcreate\b/i,
    /\badd\b/i,
    /\bgenerate\b/i,
    /\bmake\b/i,
    /\bbuild\b/i,
    /\bwrite\b/i,
    /\bset\s*up\b/i,
    /\bnew\b/i,
    /\bstart\b/i,
    /\bbrainstorm\b/i,
    /\bextract\b/i,
    /\bspawn\b/i,
    /\bfork\b/i,
    /\bbranch\b/i
  ]
}

// Autocomplete suggestions based on partial input
const COMPLETIONS: Record<string, string[]> = {
  org: ['organize by priority', 'organize by type', 'organize chronologically'],
  add: ['add a new task', 'add context notes', 'add connections'],
  cre: ['create a project for', 'create tasks from', 'create a summary'],
  create: ['create a project for', 'create tasks from', 'create a summary'],
  fix: ['fix any issues', 'fix formatting', 'fix connections'],
  con: ['connect related nodes', 'connect to context', 'connect all'],
  connect: ['connect related nodes', 'connect to context', 'connect all'],
  gro: ['group into project', 'group by type', 'group related items'],
  group: ['group into project', 'group by type', 'group related items'],
  sum: ['summarize this', 'summarize key points', 'summarize as tasks'],
  summarize: ['summarize this', 'summarize key points', 'summarize as tasks'],
  exp: ['expand on this', 'expand with details', 'expand the notes'],
  expand: ['expand on this', 'expand with details', 'expand the notes'],
  ext: ['extract tasks from', 'extract key points', 'extract notes'],
  extract: ['extract tasks from', 'extract key points', 'extract notes'],
  ref: ['refactor the structure', 'refactor into smaller pieces', 'refactor for clarity'],
  refactor: ['refactor the structure', 'refactor into smaller pieces', 'refactor for clarity'],
  bra: ['branch this conversation', 'brainstorm ideas for'],
  bui: ['build a workflow for', 'build a project structure'],
  new: ['new project for', 'new conversation about', 'new task'],
  arr: ['arrange by priority', 'arrange chronologically', 'arrange in grid'],
  arrange: ['arrange by priority', 'arrange chronologically', 'arrange in grid']
}

export function usePromptAnalysis(prompt: string): PromptAnalysis {
  const debouncedPrompt = useDebounce(prompt, 300)

  return useMemo(() => {
    if (!debouncedPrompt || debouncedPrompt.length < 3) {
      return { inferredMode: null, confidence: 0, suggestions: [] }
    }

    // Score each mode based on pattern matches
    const scores: Record<AIEditorMode, number> = {
      fix: 0,
      refactor: 0,
      organize: 0,
      generate: 0
    }

    for (const [mode, patterns] of Object.entries(MODE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(debouncedPrompt)) {
          scores[mode as AIEditorMode] += 1
        }
      }
    }

    // Find highest score
    const maxScore = Math.max(...Object.values(scores))
    if (maxScore === 0) {
      return { inferredMode: null, confidence: 0, suggestions: generateSuggestions(debouncedPrompt) }
    }

    const inferredMode = (Object.entries(scores).find(
      ([, score]) => score === maxScore
    )?.[0] ?? null) as AIEditorMode | null

    // Calculate confidence based on score and uniqueness
    const sortedScores = Object.values(scores).sort((a, b) => b - a)
    const secondHighest = sortedScores[1] ?? 0

    // Confidence is higher when there's a clear winner
    const confidence =
      maxScore > 0 ? Math.min(1, (maxScore - secondHighest + 1) / 3) : 0

    // Generate suggestions based on partial input
    const suggestions = generateSuggestions(debouncedPrompt)

    return { inferredMode, confidence, suggestions }
  }, [debouncedPrompt])
}

function generateSuggestions(prompt: string): string[] {
  const lowercasePrompt = prompt.toLowerCase().trim()

  // Look for matching completion prefixes
  for (const [prefix, suggestions] of Object.entries(COMPLETIONS)) {
    if (
      lowercasePrompt.startsWith(prefix) &&
      lowercasePrompt.length <= prefix.length + 5
    ) {
      // Filter to suggestions that match what user has typed
      return suggestions.filter((s) =>
        s.toLowerCase().startsWith(lowercasePrompt)
      )
    }
  }

  // If no prefix match, try to find partial matches in the middle
  const words = lowercasePrompt.split(/\s+/)
  const lastWord = words[words.length - 1]
  if (lastWord && lastWord.length >= 3) {
    for (const [prefix, suggestions] of Object.entries(COMPLETIONS)) {
      if (prefix.startsWith(lastWord)) {
        return suggestions
      }
    }
  }

  return []
}

export default usePromptAnalysis
