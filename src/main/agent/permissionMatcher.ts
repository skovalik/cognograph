// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Permission Matcher — Subcommand-level shell permission evaluation
 *
 * Parses shell commands into structured parts (binary, subcommand, flags)
 * and evaluates them against deny/allow/ask rule tables.
 *
 * Design:
 *   1. Deny-first: dangerous commands are blocked before anything else
 *   2. Allow-list: known safe (read-only) commands pass without prompting
 *   3. Everything else → 'ask' (prompt user via PermissionQueue)
 */

import type { PermissionVerdict } from '../tools/types'

// ---------------------------------------------------------------------------
// Parsed Command
// ---------------------------------------------------------------------------

export interface ParsedCommand {
  /** The base binary name, e.g. 'git', 'npm', 'node' */
  binary: string
  /** First positional argument after binary, e.g. 'push', 'install' */
  subcommand: string | null
  /** All flags extracted from the command (--force, -v, etc.) */
  flags: string[]
  /** The full raw command string */
  raw: string
}

// ---------------------------------------------------------------------------
// Rule types
// ---------------------------------------------------------------------------

/**
 * A permission rule. The key format is: `Shell.<binary>[.<subcommand>[.<flag>]]`
 *
 * Examples:
 *   Shell.git.credential        → matches `git credential <anything>`
 *   Shell.git.push.--force      → matches `git push` only when --force is present
 *   Shell.git.status            → matches `git status`
 */
interface PermissionRule {
  binary: string
  subcommand?: string
  flag?: string
  verdict: PermissionVerdict
}

// ---------------------------------------------------------------------------
// Deny rules (evaluated first — order matters, most specific first)
// ---------------------------------------------------------------------------

const DENY_RULES: PermissionRule[] = [
  // Credential theft
  { binary: 'git', subcommand: 'credential', verdict: 'deny' },
  // Global config mutation
  { binary: 'git', subcommand: 'config', flag: '--global', verdict: 'deny' },
  { binary: 'git', subcommand: 'config', flag: '--system', verdict: 'deny' },
  // Force-push (data loss)
  { binary: 'git', subcommand: 'push', flag: '--force', verdict: 'deny' },
  { binary: 'git', subcommand: 'push', flag: '-f', verdict: 'deny' },
  { binary: 'git', subcommand: 'push', flag: '--force-with-lease', verdict: 'deny' },
  // Remote URL hijack
  { binary: 'git', subcommand: 'remote', flag: 'set-url', verdict: 'deny' },
  // Destructive resets
  { binary: 'git', subcommand: 'clean', flag: '-f', verdict: 'deny' },
  { binary: 'git', subcommand: 'clean', flag: '--force', verdict: 'deny' },
  // Dangerous rm
  { binary: 'rm', flag: '-rf', verdict: 'deny' },
  { binary: 'rm', flag: '-fr', verdict: 'deny' },
  // Prevent curl piping to shell (eval/exec patterns caught at higher level)
  { binary: 'eval', verdict: 'deny' },
  { binary: 'exec', verdict: 'deny' },
]

// ---------------------------------------------------------------------------
// Allow rules (safe read-only commands — evaluated after deny rules)
// ---------------------------------------------------------------------------

const ALLOW_RULES: PermissionRule[] = [
  // Git read-only
  { binary: 'git', subcommand: 'status', verdict: 'allow' },
  { binary: 'git', subcommand: 'log', verdict: 'allow' },
  { binary: 'git', subcommand: 'diff', verdict: 'allow' },
  { binary: 'git', subcommand: 'branch', verdict: 'allow' },
  { binary: 'git', subcommand: 'show', verdict: 'allow' },
  { binary: 'git', subcommand: 'rev-parse', verdict: 'allow' },
  { binary: 'git', subcommand: 'ls-files', verdict: 'allow' },
  { binary: 'git', subcommand: 'blame', verdict: 'allow' },
  { binary: 'git', subcommand: 'shortlog', verdict: 'allow' },
  { binary: 'git', subcommand: 'describe', verdict: 'allow' },
  { binary: 'git', subcommand: 'tag', verdict: 'allow' },
  // Safe general commands
  { binary: 'ls', verdict: 'allow' },
  { binary: 'cat', verdict: 'allow' },
  { binary: 'head', verdict: 'allow' },
  { binary: 'tail', verdict: 'allow' },
  { binary: 'wc', verdict: 'allow' },
  { binary: 'find', verdict: 'allow' },
  { binary: 'grep', verdict: 'allow' },
  { binary: 'rg', verdict: 'allow' },
  { binary: 'which', verdict: 'allow' },
  { binary: 'echo', verdict: 'allow' },
  { binary: 'pwd', verdict: 'allow' },
  { binary: 'date', verdict: 'allow' },
  { binary: 'whoami', verdict: 'allow' },
]

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw command string into structured parts.
 * Handles quoted arguments, but not shell features (pipes, redirects, etc.)
 * since those are blocked at the metacharacter level in filesystemTools.ts.
 */
export function parseCommand(raw: string): ParsedCommand {
  const trimmed = raw.trim()
  const parts = splitCommandParts(trimmed)

  if (parts.length === 0) {
    return { binary: '', subcommand: null, flags: [], raw: trimmed }
  }

  const binary = extractBinaryName(parts[0]!)
  const flags: string[] = []
  let subcommand: string | null = null

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!
    if (part.startsWith('-')) {
      flags.push(part)
    } else if (subcommand === null) {
      subcommand = part
    }
    // Additional positional args are ignored for matching purposes
  }

  return { binary, subcommand, flags, raw: trimmed }
}

/**
 * Extract the binary name from a path or plain name.
 * '/usr/bin/git' → 'git', 'C:\\Program Files\\git\\git.exe' → 'git'
 */
function extractBinaryName(binaryPart: string): string {
  // Strip path separators
  const base = binaryPart.split('/').pop()?.split('\\').pop() ?? binaryPart
  // Strip .exe / .cmd / .bat extensions on Windows
  return base.replace(/\.(exe|cmd|bat|ps1)$/i, '').toLowerCase()
}

/**
 * Split a command into parts respecting single and double quotes.
 */
function splitCommandParts(cmd: string): string[] {
  const parts: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i]!

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
    } else if ((ch === ' ' || ch === '\t') && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        parts.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }

  if (current.length > 0) parts.push(current)
  return parts
}

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

/**
 * Check if a single rule matches a parsed command.
 *
 * Matching logic:
 *   - binary must match
 *   - if rule specifies subcommand, parsed subcommand must match
 *   - if rule specifies flag, that flag must be present in parsed flags
 *     (for 'set-url' style pseudo-flags, we also check positional args)
 */
function ruleMatches(rule: PermissionRule, parsed: ParsedCommand): boolean {
  if (rule.binary !== parsed.binary) return false

  if (rule.subcommand !== undefined) {
    if (parsed.subcommand !== rule.subcommand) return false
  }

  if (rule.flag !== undefined) {
    // Check flags array
    if (parsed.flags.includes(rule.flag)) return true

    // For pseudo-flags like 'set-url' that are actually positional args,
    // check if any part of the raw command contains this arg after the subcommand.
    // We do a conservative check: the raw command must contain the flag as a word.
    const rawParts = splitCommandParts(parsed.raw)
    const flagPresent = rawParts.some((p) => p === rule.flag)
    return flagPresent
  }

  return true
}

/**
 * Evaluate a command string against the permission rule tables.
 *
 * Evaluation order:
 *   1. Parse command into structured parts
 *   2. Check deny rules — if any match, return 'deny'
 *   3. Check allow rules — if any match, return 'allow'
 *   4. Default → 'ask'
 */
export function evaluatePermission(command: string): PermissionVerdict {
  const parsed = parseCommand(command)

  if (!parsed.binary) return 'deny'

  // Deny-first pass
  for (const rule of DENY_RULES) {
    if (ruleMatches(rule, parsed)) {
      return 'deny'
    }
  }

  // Allow pass
  for (const rule of ALLOW_RULES) {
    if (ruleMatches(rule, parsed)) {
      return 'allow'
    }
  }

  // Default: ask the user
  return 'ask'
}

/**
 * Get a human-readable reason for a deny verdict.
 * Returns null if the command would not be denied.
 */
export function getDenyReason(command: string): string | null {
  const parsed = parseCommand(command)

  if (!parsed.binary) return 'Empty command'

  for (const rule of DENY_RULES) {
    if (ruleMatches(rule, parsed)) {
      const parts = ['Shell', rule.binary]
      if (rule.subcommand) parts.push(rule.subcommand)
      if (rule.flag) parts.push(rule.flag)
      return `Blocked by deny rule: ${parts.join('.')}`
    }
  }

  return null
}

/**
 * Format a parsed command into a dot-notation permission key.
 * Used for display in the permission UI.
 *
 * Examples:
 *   `git push --force` → 'Shell.git.push.--force'
 *   `npm install` → 'Shell.npm.install'
 */
export function formatPermissionKey(command: string): string {
  const parsed = parseCommand(command)
  const parts = ['Shell', parsed.binary]
  if (parsed.subcommand) parts.push(parsed.subcommand)
  for (const flag of parsed.flags) {
    parts.push(flag)
  }
  return parts.join('.')
}
