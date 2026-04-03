// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * ShellPermissionCard — specialized permission card for shell commands.
 *
 * Renders the command in a monospace code block with syntax-aware highlighting:
 * - Binary and subcommand shown prominently
 * - Dangerous subcommands (rm -rf, git push --force, etc.) highlighted in red
 */

import { memo, useMemo } from 'react'
import type { ShellDisplay } from '@shared/transport/types'

// ---------------------------------------------------------------------------
// Dangerous command patterns
// ---------------------------------------------------------------------------

/**
 * Patterns that should be highlighted as dangerous in shell commands.
 * Each entry is [regex, label] — regex matches the dangerous segment.
 */
const DANGEROUS_PATTERNS: ReadonlyArray<RegExp> = [
  /\brm\s+-[^\s]*r[^\s]*f/,       // rm -rf, rm -fr, rm -rfi, etc.
  /\brm\s+-[^\s]*f[^\s]*r/,       // rm -fr variant
  /\bgit\s+push\s+--force\b/,     // git push --force
  /\bgit\s+push\s+-f\b/,          // git push -f
  /\bgit\s+reset\s+--hard\b/,     // git reset --hard
  /\bgit\s+clean\s+-[^\s]*f/,     // git clean -f, git clean -fd
  /\bgit\s+checkout\s+--\s*\./,   // git checkout -- .
  /\bgit\s+branch\s+-D\b/,        // git branch -D
  /\bchmod\s+777\b/,              // chmod 777
  /\bdd\s+if=/,                   // dd if= (disk destroy)
  /\bmkfs\b/,                     // mkfs (format)
  /\b:\(\)\s*\{\s*:\|:\s*&\s*\}/, // fork bomb
  /\bcurl\s+.*\|\s*bash/,         // curl | bash (pipe to shell)
  /\bwget\s+.*\|\s*bash/,         // wget | bash
]

/**
 * Check whether a command string contains any dangerous patterns.
 */
function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))
}

/**
 * Parse a command string into [binary, ...rest] for display.
 * Returns { binary, subcommand, args } where subcommand is the first
 * argument that doesn't start with a dash (for tools like git, npm, etc.).
 */
function parseCommand(command: string): {
  binary: string
  subcommand: string | null
  rest: string
} {
  const trimmed = command.trim()
  const parts = trimmed.split(/\s+/)
  const binary = parts[0] ?? ''

  // Tools that use subcommands
  const SUBCOMMAND_BINARIES = new Set([
    'git', 'npm', 'npx', 'yarn', 'pnpm', 'docker', 'kubectl',
    'cargo', 'go', 'pip', 'brew', 'apt', 'apt-get', 'systemctl',
    'wrangler', 'vercel', 'gh', 'az', 'aws', 'gcloud',
  ])

  if (SUBCOMMAND_BINARIES.has(binary) && parts.length > 1) {
    const subcommand = parts[1] ?? null
    const rest = parts.slice(2).join(' ')
    return { binary, subcommand, rest }
  }

  return { binary, subcommand: null, rest: parts.slice(1).join(' ') }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShellPermissionCardProps {
  display: ShellDisplay
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ShellPermissionCard = memo(function ShellPermissionCard({
  display,
}: ShellPermissionCardProps) {
  const { command } = display
  const dangerous = useMemo(() => isDangerousCommand(command), [command])
  const parsed = useMemo(() => parseCommand(command), [command])

  return (
    <div className="mb-2">
      {/* Binary + subcommand prominence line */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-mono font-bold text-violet-300">
          {parsed.binary}
        </span>
        {parsed.subcommand && (
          <span
            className={`text-[10px] font-mono font-semibold ${
              dangerous ? 'text-red-400' : 'text-white/60'
            }`}
          >
            {parsed.subcommand}
          </span>
        )}
      </div>

      {/* Full command code block */}
      <code
        className={`
          text-xs bg-black/30 px-1.5 py-1 rounded font-mono break-all
          block max-h-24 overflow-y-auto leading-relaxed
          ${dangerous
            ? 'text-red-300 border border-red-500/30'
            : 'text-white/70'
          }
        `}
      >
        {command}
      </code>

      {/* Danger warning */}
      {dangerous && (
        <p className="text-[10px] text-red-400/80 mt-1 font-medium leading-tight">
          This command may be destructive. Review carefully before approving.
        </p>
      )}
    </div>
  )
})
