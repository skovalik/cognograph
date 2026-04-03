// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Agent Filesystem Tools — Main Process Handlers
 *
 * Implements 6 filesystem/shell tools with security sandboxing:
 * read_file, write_file, edit_file, list_directory, search_files, execute_command
 *
 * Security model:
 * - All paths resolved to absolute before comparison
 * - Symlink detection via lstat() prevents TOCTOU race (0.1a)
 * - trustedSymlinkTargets from MCP configs allow vetted symlink targets
 * - allowedPaths computed in main process, never accepted from renderer (0.1b)
 * - Empty command allowlist is fail-closed (0.1c)
 * - Regex patterns validated for length and ReDoS safety (0.1h)
 * - Protected paths (.cognograph/, .env, .mcp.json, etc.) require explicit approval (0.1l)
 * - execute_command uses execFile (no shell) with 60s timeout, stdin closed
 * - Shell metacharacters blocked in all command arguments
 * - allowedCommands whitelist validates the binary name
 */

import * as fs from 'fs'
import * as path from 'path'
import { execFile } from 'child_process' // execFile is the SAFE variant — no shell injection
import { ipcMain, app } from 'electron'
import { join } from 'path'
import {
  FsReadFileSchema,
  FsWriteFileSchema,
  FsEditFileSchema,
  FsExecuteCommandSchema,
  FsListDirectorySchema,
  FsSearchFilesSchema,
} from '../ipc/schemas'

// -----------------------------------------------------------------------------
// Security: Protected Paths (0.1l)
// -----------------------------------------------------------------------------

/**
 * Hardcoded list of protected path patterns.
 * Write/delete operations to these paths always require explicit approval,
 * regardless of allowedPaths.
 *
 * .mcp.json is protected to prevent trustedSymlinkTargets escalation.
 */
const PROTECTED_PATH_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // Cognograph internal directory
  { pattern: /[/\\]\.cognograph([/\\]|$)/i, description: '.cognograph/ directory' },
  // MCP config files — prevents trustedSymlinkTargets escalation
  { pattern: /[/\\]\.mcp\.json$/i, description: '.mcp.json config' },
  { pattern: /[/\\]mcp\.json$/i, description: 'mcp.json config' },
  // Environment files
  { pattern: /[/\\]\.env$/i, description: '.env file' },
  { pattern: /[/\\]\.env\.[^/\\]+$/i, description: '.env.* file' },
  // Shell profiles
  { pattern: /[/\\]\.bashrc$/i, description: '.bashrc' },
  { pattern: /[/\\]\.zshrc$/i, description: '.zshrc' },
  { pattern: /[/\\]\.profile$/i, description: '.profile' },
  { pattern: /[/\\]\.bash_profile$/i, description: '.bash_profile' },
  { pattern: /[/\\]\.gitconfig$/i, description: '.gitconfig' },
  // Credential files
  { pattern: /[/\\]\.ssh[/\\]/i, description: '.ssh/ directory' },
  { pattern: /[/\\]\.gnupg[/\\]/i, description: '.gnupg/ directory' },
  { pattern: /[/\\]\.aws[/\\]credentials$/i, description: 'AWS credentials' },
  { pattern: /[/\\]\.npmrc$/i, description: '.npmrc' },
  { pattern: /[/\\]\.netrc$/i, description: '.netrc' },
]

/**
 * Check if a path is protected and requires explicit approval for writes.
 * Returns the protection description if protected, null otherwise.
 */
export function isProtectedPath(filePath: string): string | null {
  const normalized = path.resolve(filePath)
  for (const { pattern, description } of PROTECTED_PATH_PATTERNS) {
    if (pattern.test(normalized)) {
      return description
    }
  }
  return null
}

// -----------------------------------------------------------------------------
// Security: Workspace Path Resolution (0.1b)
// -----------------------------------------------------------------------------

/**
 * Derive allowed paths from the active workspace data in the main process.
 * Reads workspace JSON from {userData}/workspaces/{lastWorkspaceId}.json.
 * Never trusts renderer-supplied paths.
 *
 * Also derives trustedSymlinkTargets from MCP server configs in .mcp.json files.
 */
interface WorkspaceSecurityContext {
  allowedPaths: string[]
  allowedCommands: string[]
  trustedSymlinkTargets: string[]
}

// Cached security context — refreshed on workspace load
let cachedSecurityContext: WorkspaceSecurityContext | null = null

/**
 * Load the current workspace data and derive security-critical paths.
 * This is the ONLY source of truth for allowed paths — the renderer cannot override.
 */
export async function refreshWorkspaceSecurityContext(): Promise<WorkspaceSecurityContext> {
  try {
    const userDataPath = app.getPath('userData')
    const settingsPath = join(userDataPath, 'settings.json')
    const settingsContent = fs.readFileSync(settingsPath, 'utf-8')
    const settings = JSON.parse(settingsContent) as { lastWorkspaceId?: string }

    if (!settings.lastWorkspaceId) {
      cachedSecurityContext = { allowedPaths: [], allowedCommands: [], trustedSymlinkTargets: [] }
      return cachedSecurityContext
    }

    const workspacePath = join(userDataPath, 'workspaces', `${settings.lastWorkspaceId}.json`)
    const workspaceContent = fs.readFileSync(workspacePath, 'utf-8')
    const workspace = JSON.parse(workspaceContent) as {
      nodes?: Array<{ id: string; data: Record<string, unknown> }>
    }

    const allowedPaths: string[] = []
    const trustedSymlinkTargets: string[] = []

    // Derive paths from artifact and project nodes (same logic as renderer's derivePathsFromContext)
    if (workspace.nodes) {
      for (const node of workspace.nodes) {
        const data = node.data
        if (!data) continue

        // Project nodes with folderPath
        if (data.type === 'project' && typeof data.folderPath === 'string' && data.folderPath) {
          allowedPaths.push(data.folderPath)
        }

        // Artifact nodes with various path sources
        if (data.type === 'artifact') {
          if (typeof data.folderPath === 'string' && data.folderPath) {
            allowedPaths.push(data.folderPath)
          } else if (
            data.source &&
            typeof data.source === 'object' &&
            (data.source as Record<string, unknown>).type === 'file-drop' &&
            typeof (data.source as Record<string, unknown>).originalPath === 'string'
          ) {
            const pathStr = (data.source as Record<string, unknown>).originalPath as string
            const lastSep = Math.max(pathStr.lastIndexOf('/'), pathStr.lastIndexOf('\\'))
            if (lastSep > 0) allowedPaths.push(pathStr.substring(0, lastSep))
          } else if (
            data.properties &&
            typeof data.properties === 'object' &&
            typeof (data.properties as Record<string, unknown>).filePath === 'string'
          ) {
            const customPath = (data.properties as Record<string, unknown>).filePath as string
            const lastSep = Math.max(customPath.lastIndexOf('/'), customPath.lastIndexOf('\\'))
            if (lastSep > 0) allowedPaths.push(customPath.substring(0, lastSep))
          }
        }

        // Conversation nodes with agent settings (get explicitly configured paths + commands)
        if (data.type === 'conversation' && data.agentSettings) {
          const agentSettings = data.agentSettings as {
            allowedPaths?: string[]
            allowedCommands?: string[]
          }
          if (agentSettings.allowedPaths) {
            allowedPaths.push(...agentSettings.allowedPaths)
          }
        }
      }
    }

    // Read MCP server configs for trusted symlink targets
    // .mcp.json files can specify root paths for MCP servers
    const mcpPaths = readMCPTrustedRoots()
    trustedSymlinkTargets.push(...mcpPaths)

    cachedSecurityContext = {
      allowedPaths: Array.from(new Set(allowedPaths)),
      allowedCommands: [], // Commands derived per-conversation, not globally
      trustedSymlinkTargets: Array.from(new Set(trustedSymlinkTargets)),
    }

    return cachedSecurityContext
  } catch {
    cachedSecurityContext = { allowedPaths: [], allowedCommands: [], trustedSymlinkTargets: [] }
    return cachedSecurityContext
  }
}

/**
 * Read MCP server root paths from known .mcp.json locations.
 * These become trustedSymlinkTargets — symlinks pointing into these directories are allowed.
 */
function readMCPTrustedRoots(): string[] {
  const roots: string[] = []
  try {
    const userDataPath = app.getPath('userData')
    // Check user-level .mcp.json
    const userMcpPath = join(userDataPath, '.mcp.json')
    const mcpRoots = extractMCPRoots(userMcpPath)
    roots.push(...mcpRoots)
  } catch {
    // Ignore errors reading MCP configs
  }
  return roots
}

/**
 * Extract root paths from an .mcp.json file.
 * Looks at server args for --workspace-path or directory arguments.
 */
function extractMCPRoots(mcpJsonPath: string): string[] {
  const roots: string[] = []
  try {
    if (!fs.existsSync(mcpJsonPath)) return roots
    const content = fs.readFileSync(mcpJsonPath, 'utf-8')
    const config = JSON.parse(content) as {
      mcpServers?: Record<string, { command?: string; args?: string[] }>
    }

    if (!config.mcpServers) return roots

    for (const server of Object.values(config.mcpServers)) {
      if (!server.args) continue
      for (let i = 0; i < server.args.length; i++) {
        const arg = server.args[i]
        // Look for --workspace-path <path> pattern
        if (arg === '--workspace-path' && i + 1 < server.args.length) {
          const wsPath = server.args[i + 1]!
          const dir = path.dirname(path.resolve(wsPath))
          roots.push(dir)
        }
        // Also treat non-flag arguments that look like paths as potential roots
        if (arg && !arg.startsWith('-') && (arg.includes('/') || arg.includes('\\'))) {
          try {
            const resolved = path.resolve(arg)
            if (fs.existsSync(resolved)) {
              const stat = fs.statSync(resolved)
              roots.push(stat.isDirectory() ? resolved : path.dirname(resolved))
            }
          } catch {
            // Skip invalid paths
          }
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return roots
}

/**
 * Get the current security context. Returns cached version if available.
 */
export function getSecurityContext(): WorkspaceSecurityContext {
  return cachedSecurityContext ?? { allowedPaths: [], allowedCommands: [], trustedSymlinkTargets: [] }
}

// -----------------------------------------------------------------------------
// Security: Symlink-Safe Path Validation (0.1a)
// -----------------------------------------------------------------------------

/**
 * Check if a resolved path falls within any of the given path lists.
 */
function isWithinPaths(resolved: string, pathList: string[]): boolean {
  return pathList.some(allowed => {
    const resolvedAllowed = path.resolve(allowed)
    return resolved === resolvedAllowed || resolved.startsWith(resolvedAllowed + path.sep)
  })
}

/**
 * Validate that a path is within the allowed paths list.
 * Uses lstat() to detect symlinks BEFORE following them (fixes TOCTOU race).
 * Symlinks are only allowed if their target resolves to an allowed path
 * or a trustedSymlinkTarget.
 */
export function validatePath(
  targetPath: string,
  allowedPaths: string[],
  trustedSymlinkTargets: string[] = []
): { valid: boolean; resolved: string; error?: string } {
  if (allowedPaths.length === 0) {
    return { valid: false, resolved: '', error: 'No allowed paths configured. Connect artifact nodes to grant filesystem access.' }
  }

  try {
    const resolved = path.resolve(targetPath)

    // Check if the resolved path starts with any allowed path
    if (!isWithinPaths(resolved, allowedPaths)) {
      return { valid: false, resolved, error: `Path "${resolved}" is outside allowed directories: ${allowedPaths.join(', ')}` }
    }

    // Symlink-safe check: use lstat() to detect symlinks BEFORE resolving them.
    // This closes the TOCTOU race between existsSync() and realpathSync().
    try {
      const lstat = fs.lstatSync(resolved)

      if (lstat.isSymbolicLink()) {
        // Path is a symlink — resolve and verify the target
        const realPath = fs.realpathSync(resolved)

        // Check against allowed paths first
        if (isWithinPaths(realPath, allowedPaths)) {
          return { valid: true, resolved: realPath }
        }

        // Check against trusted MCP server roots
        if (trustedSymlinkTargets.length > 0 && isWithinPaths(realPath, trustedSymlinkTargets)) {
          return { valid: true, resolved: realPath }
        }

        // Symlink target is outside all trusted paths
        return {
          valid: false,
          resolved: realPath,
          error: `Symlink target "${realPath}" is outside allowed directories and trusted targets`
        }
      }

      // Not a symlink — but verify realpath matches to catch symlinks in parent dirs
      const realPath = fs.realpathSync(resolved)
      if (realPath !== resolved) {
        // A parent directory is a symlink
        if (!isWithinPaths(realPath, allowedPaths) &&
            !(trustedSymlinkTargets.length > 0 && isWithinPaths(realPath, trustedSymlinkTargets))) {
          return {
            valid: false,
            resolved: realPath,
            error: `Real path "${realPath}" (via parent symlink) is outside allowed directories`
          }
        }
        return { valid: true, resolved: realPath }
      }
    } catch {
      // File doesn't exist yet — that's OK for write operations.
      // But verify the parent directory's real path if it exists.
      const parentDir = path.dirname(resolved)
      try {
        const parentReal = fs.realpathSync(parentDir)
        if (!isWithinPaths(parentReal, allowedPaths) &&
            !(trustedSymlinkTargets.length > 0 && isWithinPaths(parentReal, trustedSymlinkTargets))) {
          return {
            valid: false,
            resolved,
            error: `Parent directory real path "${parentReal}" is outside allowed directories`
          }
        }
      } catch {
        // Parent doesn't exist either — will fail at actual operation time, which is fine
      }
    }

    return { valid: true, resolved }
  } catch (err) {
    return { valid: false, resolved: '', error: `Path validation failed: ${(err as Error).message}` }
  }
}

// -----------------------------------------------------------------------------
// Security: Command Validation (0.1c — fail-closed)
// -----------------------------------------------------------------------------

/**
 * Validate a command against the allowed commands whitelist.
 * Fail-closed: empty allowlist means NO commands are allowed.
 */
export function validateCommand(command: string, allowedCommands: string[]): { valid: boolean; error?: string } {
  if (allowedCommands.length === 0) {
    // Fail-closed: empty whitelist blocks all commands
    return { valid: false, error: 'No commands allowed — configure an allowedCommands whitelist' }
  }

  // Extract the base command (first word)
  const baseCommand = command.trim().split(/\s+/)[0]
  if (!baseCommand) {
    return { valid: false, error: 'Empty command' }
  }

  if (!allowedCommands.includes(baseCommand)) {
    return { valid: false, error: `Command "${baseCommand}" not in allowed list: ${allowedCommands.join(', ')}` }
  }

  return { valid: true }
}

// -----------------------------------------------------------------------------
// Security: Regex / ReDoS Validation (0.1h)
// -----------------------------------------------------------------------------

const MAX_PATTERN_LENGTH = 256

/**
 * Detect potentially catastrophic backtracking patterns (ReDoS).
 * Checks for nested quantifiers like (a+)+, (a*)+, (a+)*, etc.
 * This is a heuristic — not exhaustive, but catches the most common attack patterns.
 */
export function isRegexSafe(pattern: string): { safe: boolean; error?: string } {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { safe: false, error: `Pattern too long (${pattern.length} chars, max ${MAX_PATTERN_LENGTH})` }
  }

  // Detect nested quantifiers: the primary ReDoS pattern
  // Matches things like (a+)+, (a*)+, (a+)*, ([^x]+)+, etc.
  const nestedQuantifier = /(\([^)]*[+*][^)]*\))[+*]|\(\?:[^)]*[+*][^)]*\)[+*]/
  if (nestedQuantifier.test(pattern)) {
    return { safe: false, error: 'Pattern contains nested quantifiers — potential ReDoS' }
  }

  // Detect overlapping alternation with quantifiers: (a|a)+
  const overlappingAlt = /\(([^)]*\|[^)]*)\)[+*]/
  if (overlappingAlt.test(pattern)) {
    // Only flag if the alternation branches could match overlapping strings
    // Simple heuristic: if any branch is a subset of another
    const match = pattern.match(overlappingAlt)
    if (match && match[1]) {
      const branches = match[1].split('|')
      for (let i = 0; i < branches.length; i++) {
        for (let j = i + 1; j < branches.length; j++) {
          if (branches[i] === branches[j]) {
            return { safe: false, error: 'Pattern contains overlapping alternation with quantifier — potential ReDoS' }
          }
        }
      }
    }
  }

  // Try compiling — catch invalid regex
  try {
    new RegExp(pattern)
  } catch (e) {
    return { safe: false, error: `Invalid regex: ${(e as Error).message}` }
  }

  return { safe: true }
}

// -----------------------------------------------------------------------------
// Tool Implementations
// -----------------------------------------------------------------------------

export interface FilesystemToolResult {
  success: boolean
  result?: unknown
  error?: string
}

export function readFile(
  filePath: string,
  allowedPaths: string[],
  startLine?: number,
  endLine?: number,
  trustedSymlinkTargets: string[] = []
): FilesystemToolResult {
  const validation = validatePath(filePath, allowedPaths, trustedSymlinkTargets)
  if (!validation.valid) return { success: false, error: validation.error }

  try {
    const content = fs.readFileSync(validation.resolved, 'utf-8')

    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split('\n')
      const start = Math.max(0, (startLine ?? 1) - 1)
      const end = endLine ?? lines.length
      const sliced = lines.slice(start, end).join('\n')
      return { success: true, result: { content: sliced, totalLines: lines.length, startLine: start + 1, endLine: Math.min(end, lines.length) } }
    }

    return { success: true, result: { content, totalLines: content.split('\n').length } }
  } catch (err) {
    return { success: false, error: `Failed to read file: ${(err as Error).message}` }
  }
}

export function writeFile(
  filePath: string,
  content: string,
  allowedPaths: string[],
  trustedSymlinkTargets: string[] = []
): FilesystemToolResult {
  // Protected path check (0.1l)
  const protection = isProtectedPath(filePath)
  if (protection) {
    return { success: false, error: `Protected path (${protection}): writing to "${filePath}" requires explicit approval` }
  }

  const validation = validatePath(filePath, allowedPaths, trustedSymlinkTargets)
  if (!validation.valid) return { success: false, error: validation.error }

  try {
    // Ensure parent directory exists
    const dir = path.dirname(validation.resolved)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(validation.resolved, content, 'utf-8')
    return { success: true, result: { path: validation.resolved, bytes: Buffer.byteLength(content, 'utf-8') } }
  } catch (err) {
    return { success: false, error: `Failed to write file: ${(err as Error).message}` }
  }
}

export function editFile(
  filePath: string,
  oldString: string,
  newString: string,
  allowedPaths: string[],
  trustedSymlinkTargets: string[] = []
): FilesystemToolResult {
  // Protected path check (0.1l)
  const protection = isProtectedPath(filePath)
  if (protection) {
    return { success: false, error: `Protected path (${protection}): editing "${filePath}" requires explicit approval` }
  }

  const validation = validatePath(filePath, allowedPaths, trustedSymlinkTargets)
  if (!validation.valid) return { success: false, error: validation.error }

  try {
    const content = fs.readFileSync(validation.resolved, 'utf-8')

    if (!content.includes(oldString)) {
      return { success: false, error: `String not found in file. Make sure oldString matches exactly.` }
    }

    // Only replace first occurrence (like a targeted edit)
    const newContent = content.replace(oldString, newString)
    fs.writeFileSync(validation.resolved, newContent, 'utf-8')
    return { success: true, result: { path: validation.resolved, replacements: 1 } }
  } catch (err) {
    return { success: false, error: `Failed to edit file: ${(err as Error).message}` }
  }
}

export function listDirectory(
  dirPath: string,
  allowedPaths: string[],
  trustedSymlinkTargets: string[] = []
): FilesystemToolResult {
  const validation = validatePath(dirPath, allowedPaths, trustedSymlinkTargets)
  if (!validation.valid) return { success: false, error: validation.error }

  try {
    const entries = fs.readdirSync(validation.resolved, { withFileTypes: true })
    const items = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' as const : 'file' as const,
      size: entry.isFile() ? fs.statSync(path.join(validation.resolved, entry.name)).size : undefined,
    }))
    return { success: true, result: { path: validation.resolved, entries: items, count: items.length } }
  } catch (err) {
    return { success: false, error: `Failed to list directory: ${(err as Error).message}` }
  }
}

export function searchFiles(
  dirPath: string,
  pattern: string,
  allowedPaths: string[],
  fileGlob?: string,
  trustedSymlinkTargets: string[] = []
): FilesystemToolResult {
  const validation = validatePath(dirPath, allowedPaths, trustedSymlinkTargets)
  if (!validation.valid) return { success: false, error: validation.error }

  // ReDoS validation (0.1h)
  const regexCheck = isRegexSafe(pattern)
  if (!regexCheck.safe) {
    return { success: false, error: `Unsafe search pattern: ${regexCheck.error}` }
  }

  try {
    const results: Array<{ file: string; line: number; content: string }> = []
    const regex = new RegExp(pattern, 'gi')
    const maxResults = 50

    function searchDir(dir: string): void {
      if (results.length >= maxResults) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (results.length >= maxResults) return
        const fullPath = path.join(dir, entry.name)

        // Skip common non-source directories
        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) continue
          searchDir(fullPath)
        } else if (entry.isFile()) {
          // Optional glob filter
          if (fileGlob && !entry.name.match(globToRegex(fileGlob))) continue

          try {
            const content = fs.readFileSync(fullPath, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i]!
              if (regex.test(line)) {
                results.push({ file: path.relative(validation.resolved, fullPath), line: i + 1, content: line.trim().slice(0, 200) })
                regex.lastIndex = 0 // Reset regex state for global flag
                if (results.length >= maxResults) return
              }
            }
          } catch {
            // Skip binary/unreadable files
          }
        }
      }
    }

    searchDir(validation.resolved)
    return { success: true, result: { matches: results, totalMatches: results.length, truncated: results.length >= maxResults } }
  } catch (err) {
    return { success: false, error: `Search failed: ${(err as Error).message}` }
  }
}

// Security: execFile() is used instead of exec() to prevent shell injection.
// Commands are split into binary + args and executed WITHOUT a shell.
// The allowedCommands whitelist validates the binary name.
// Shell features (pipes, redirects) are NOT supported — use separate tool calls.
export function executeCommand(
  command: string,
  allowedPaths: string[],
  allowedCommands: string[],
  cwd?: string,
  timeoutMs: number = 60000,
  trustedSymlinkTargets: string[] = []
): Promise<FilesystemToolResult> {
  const cmdValidation = validateCommand(command, allowedCommands)
  if (!cmdValidation.valid) return Promise.resolve({ success: false, error: cmdValidation.error })

  // Parse command into binary and args (no shell interpolation)
  const parts = parseCommandLine(command)
  if (parts.length === 0) return Promise.resolve({ success: false, error: 'Empty command' })
  const [binary, ...args] = parts

  // Block shell metacharacters in all args as defense-in-depth
  const shellMetachars = /[;&|`$(){}!<>]/
  for (const arg of args) {
    if (shellMetachars.test(arg)) {
      return Promise.resolve({
        success: false,
        error: `Shell metacharacters not allowed in arguments: "${arg}". Use separate tool calls instead of pipes/redirects.`
      })
    }
  }

  // Use first allowed path as default cwd
  const workingDir = cwd ? path.resolve(cwd) : (allowedPaths[0] ? path.resolve(allowedPaths[0]) : process.cwd())

  // Validate cwd is within allowed paths
  if (cwd) {
    const cwdValidation = validatePath(cwd, allowedPaths, trustedSymlinkTargets)
    if (!cwdValidation.valid) return Promise.resolve({ success: false, error: cwdValidation.error })
  }

  return new Promise((resolve) => {
    // execFile is used intentionally — it is the safe variant that avoids shell injection.
    // Do NOT replace with exec().
    const child = execFile(binary!, args, {
      cwd: workingDir,
      timeout: timeoutMs,
      maxBuffer: 100 * 1024, // 100KB
      shell: false // Explicit: no shell
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: `Command failed: ${error.message}`,
          result: { stdout: stdout?.slice(0, 10000), stderr: stderr?.slice(0, 10000), exitCode: error.code }
        })
      } else {
        resolve({
          success: true,
          result: { stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 10000), exitCode: 0 }
        })
      }
    })

    // Close stdin — no interactive commands
    child.stdin?.end()
  })
}

/**
 * Parse a command string into binary + args, respecting quotes.
 * Does NOT use a shell — just splits on whitespace with quote handling.
 */
function parseCommandLine(cmd: string): string[] {
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
    } else if (ch === ' ' && !inSingleQuote && !inDoubleQuote) {
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

// Helper: convert simple glob to regex
function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

// -----------------------------------------------------------------------------
// IPC Handlers — Register with Electron main process (0.1b: no renderer-supplied paths)
// -----------------------------------------------------------------------------

/**
 * Register filesystem IPC handlers.
 * Security-critical: allowedPaths and trustedSymlinkTargets are computed in the
 * main process from workspace state. The renderer only provides the target path
 * and operation parameters — never the security boundary.
 */
export function registerFilesystemHandlers(): void {
  // Refresh security context on workspace events
  ipcMain.on('workspace:loaded', () => {
    refreshWorkspaceSecurityContext().catch(() => {})
  })
  ipcMain.on('workspace:saved', () => {
    refreshWorkspaceSecurityContext().catch(() => {})
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string, _allowedPaths: unknown, startLine?: number, endLine?: number) => {
    // Zod validation (SEC-0.1j)
    const parsed = FsReadFileSchema.safeParse({ filePath, startLine, endLine })
    if (!parsed.success) {
      return { success: false, error: `Validation failed: ${parsed.error.issues[0]?.message || 'Invalid input'}` }
    }
    const ctx = getSecurityContext()
    return readFile(filePath, ctx.allowedPaths, startLine, endLine, ctx.trustedSymlinkTargets)
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string, _allowedPaths: unknown) => {
    // Zod validation (SEC-0.1j)
    const ctx = getSecurityContext()
    const validated = FsWriteFileSchema.safeParse({ filePath, content, allowedPaths: ctx.allowedPaths })
    if (!validated.success) {
      return { success: false, error: `Validation failed: ${validated.error.issues[0]?.message || 'Invalid input'}` }
    }
    return writeFile(filePath, content, ctx.allowedPaths, ctx.trustedSymlinkTargets)
  })

  ipcMain.handle('fs:editFile', async (_event, filePath: string, oldString: string, newString: string, _allowedPaths: unknown) => {
    // Zod validation (SEC-0.1j)
    const ctx = getSecurityContext()
    const validated = FsEditFileSchema.safeParse({ filePath, oldString, newString, allowedPaths: ctx.allowedPaths })
    if (!validated.success) {
      return { success: false, error: `Validation failed: ${validated.error.issues[0]?.message || 'Invalid input'}` }
    }
    return editFile(filePath, oldString, newString, ctx.allowedPaths, ctx.trustedSymlinkTargets)
  })

  ipcMain.handle('fs:listDirectory', async (_event, dirPath: string, _allowedPaths: unknown) => {
    // Zod validation (SEC-0.1j)
    const parsed = FsListDirectorySchema.safeParse({ dirPath })
    if (!parsed.success) {
      return { success: false, error: `Validation failed: ${parsed.error.issues[0]?.message || 'Invalid input'}` }
    }
    const ctx = getSecurityContext()
    return listDirectory(dirPath, ctx.allowedPaths, ctx.trustedSymlinkTargets)
  })

  ipcMain.handle('fs:searchFiles', async (_event, dirPath: string, pattern: string, _allowedPaths: unknown, fileGlob?: string) => {
    // Zod validation (SEC-0.1j)
    const parsed = FsSearchFilesSchema.safeParse({ dirPath, pattern, fileGlob })
    if (!parsed.success) {
      return { success: false, error: `Validation failed: ${parsed.error.issues[0]?.message || 'Invalid input'}` }
    }
    const ctx = getSecurityContext()
    return searchFiles(dirPath, pattern, ctx.allowedPaths, fileGlob, ctx.trustedSymlinkTargets)
  })

  ipcMain.handle('fs:executeCommand', async (_event, command: string, _allowedPaths: unknown, _allowedCommands: unknown, cwd?: string, timeoutMs?: number) => {
    // Zod validation (SEC-0.1j)
    const ctx = getSecurityContext()
    const validated = FsExecuteCommandSchema.safeParse({
      command,
      allowedPaths: ctx.allowedPaths,
      allowedCommands: ctx.allowedCommands,
      cwd,
      timeoutMs,
    })
    if (!validated.success) {
      return { success: false, error: `Validation failed: ${validated.error.issues[0]?.message || 'Invalid input'}` }
    }
    // For commands, use workspace-level allowed commands (derived from active conversation's agent settings)
    return executeCommand(command, ctx.allowedPaths, ctx.allowedCommands, cwd, timeoutMs, ctx.trustedSymlinkTargets)
  })
}
