// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Sanitize user-provided content before embedding in AI context.
 *
 * Strips or neutralizes prompt injection patterns without modifying
 * the user's actual stored content. Only applied at the point where
 * content is injected into LLM system prompts / context.
 */

const INJECTION_PATTERNS = [
  // Role/system prompt hijacking
  /^SYSTEM:\s*/gim,
  /^HUMAN:\s*/gim,
  /^ASSISTANT:\s*/gim,
  /^<\|?(system|user|assistant)\|?>/gim,
  // Instruction override attempts
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /disregard\s+(all\s+)?prior\s+(instructions|context)/gi,
  /forget\s+(everything|all)\s+(above|before)/gi,
  /you\s+are\s+now\s+(?:a|an)\s+(?:evil|malicious|unrestricted)/gi,
  // XML/JSON system tags that could confuse the model
  /```system\b/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\/?system>/gi,
]

export function sanitizeForContext(content: string): string {
  if (!content) return content
  let sanitized = content
  for (const pattern of INJECTION_PATTERNS) {
    // Reset lastIndex since patterns use the global flag
    pattern.lastIndex = 0
    sanitized = sanitized.replace(pattern, (match) => {
      // Replace with a neutralized version that preserves readability
      return `[sanitized: ${match.trim().slice(0, 20)}]`
    })
  }
  return sanitized
}
