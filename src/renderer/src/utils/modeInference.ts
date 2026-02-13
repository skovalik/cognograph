/**
 * Mode Inference Utility
 *
 * Infers the AI Editor mode from prompt keywords.
 */

import type { AIEditorMode } from '@shared/types'

interface ModePattern {
  mode: AIEditorMode
  keywords: string[]
  patterns: RegExp[]
}

const modePatterns: ModePattern[] = [
  {
    mode: 'generate',
    keywords: [
      'create',
      'make',
      'add',
      'new',
      'build',
      'generate',
      'brainstorm',
      'design',
      'draft',
      'write',
      'compose',
      'start'
    ],
    patterns: [
      /^create\s+/i,
      /^make\s+/i,
      /^add\s+a?\s*/i,
      /^new\s+/i,
      /^build\s+/i,
      /^generate\s+/i,
      /^brainstorm\s+/i,
      /let's?\s+(create|make|build)/i
    ]
  },
  {
    mode: 'edit',
    keywords: [
      'edit',
      'change',
      'update',
      'modify',
      'fix',
      'refactor',
      'improve',
      'rewrite',
      'revise',
      'adjust',
      'correct',
      'enhance',
      'simplify',
      'expand',
      'condense'
    ],
    patterns: [
      /^edit\s+/i,
      /^change\s+/i,
      /^update\s+/i,
      /^fix\s+/i,
      /^refactor\s+/i,
      /^improve\s+/i,
      /^make\s+(it|this|these)\s+(more|less|better)/i,
      /^rewrite\s+/i
    ]
  },
  {
    mode: 'organize',
    keywords: [
      'organize',
      'arrange',
      'layout',
      'sort',
      'group',
      'cluster',
      'align',
      'position',
      'move',
      'reorder',
      'structure',
      'categorize',
      'distribute'
    ],
    patterns: [
      /^organize\s+/i,
      /^arrange\s+/i,
      /^layout\s+/i,
      /^sort\s+/i,
      /^group\s+/i,
      /^align\s+/i,
      /^move\s+(all|these|the)\s+/i,
      /^put\s+(these|all)\s+/i,
      /^position\s+/i
    ]
  },
  {
    mode: 'automate',
    keywords: [
      'automate',
      'trigger',
      'when',
      'whenever',
      'if',
      'schedule',
      'every',
      'daily',
      'weekly',
      'automatically',
      'workflow',
      'action'
    ],
    patterns: [
      /^when\s+/i,
      /^whenever\s+/i,
      /^if\s+/i,
      /^every\s+(day|week|hour|time)/i,
      /^schedule\s+/i,
      /^automate\s+/i,
      /automatically\s+/i,
      /^trigger\s+/i
    ]
  },
  {
    mode: 'ask',
    keywords: [
      'what',
      'how',
      'why',
      'where',
      'which',
      'explain',
      'describe',
      'summarize',
      'tell',
      'show',
      'find',
      'search',
      'list',
      'count',
      'analyze'
    ],
    patterns: [
      /^what\s+/i,
      /^how\s+/i,
      /^why\s+/i,
      /^where\s+/i,
      /^which\s+/i,
      /^explain\s+/i,
      /^describe\s+/i,
      /^summarize\s+/i,
      /^tell\s+me/i,
      /^show\s+me/i,
      /^find\s+/i,
      /^list\s+(all|the)/i,
      /^count\s+/i,
      /^analyze\s+/i,
      /\?$/
    ]
  }
]

/**
 * Infer the most likely AI Editor mode from a prompt string.
 * Returns null if no clear mode can be inferred.
 */
export function inferModeFromPrompt(prompt: string): AIEditorMode | null {
  if (!prompt.trim()) return null

  const normalizedPrompt = prompt.toLowerCase().trim()
  const scores: Record<AIEditorMode, number> = {
    generate: 0,
    edit: 0,
    organize: 0,
    automate: 0,
    ask: 0
  }

  // Check patterns first (higher weight)
  for (const { mode, patterns } of modePatterns) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedPrompt)) {
        scores[mode] += 3
      }
    }
  }

  // Check keywords
  const words = normalizedPrompt.split(/\s+/)
  for (const { mode, keywords } of modePatterns) {
    for (const keyword of keywords) {
      if (words.some((word) => word === keyword || word.startsWith(keyword))) {
        scores[mode] += 1
      }
    }
  }

  // Find highest scoring mode
  let maxScore = 0
  let inferredMode: AIEditorMode | null = null

  for (const [mode, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      inferredMode = mode as AIEditorMode
    }
  }

  // Only return if we have a meaningful score
  return maxScore >= 1 ? inferredMode : null
}

/**
 * Get suggestions for mode-specific prompts.
 */
export function getModeSuggestions(mode: AIEditorMode): string[] {
  switch (mode) {
    case 'generate':
      return [
        'Create a project plan for...',
        'Brainstorm ideas about...',
        'Generate notes summarizing...',
        'Build a task list for...'
      ]
    case 'edit':
      return [
        'Make this more concise',
        'Expand on this topic',
        'Fix the issues in...',
        'Improve the clarity of...'
      ]
    case 'organize':
      return [
        'Organize by topic',
        'Arrange in a timeline',
        'Group related items',
        'Sort by priority'
      ]
    case 'automate':
      return [
        'When a task is completed...',
        'Every morning, create...',
        'If this note is updated...',
        'Schedule weekly review...'
      ]
    case 'ask':
      return [
        'Summarize these notes',
        'What are the key points?',
        'How are these connected?',
        'Analyze the patterns in...'
      ]
    default:
      return []
  }
}
