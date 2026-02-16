/**
 * Agent Filesystem Tools — Main Process Handlers
 *
 * Implements 6 filesystem/shell tools with security sandboxing:
 * read_file, write_file, edit_file, list_directory, search_files, execute_command
 *
 * Security model:
 * - All paths resolved to absolute before comparison
 * - Symlink resolution prevents escape via fs.realpath()
 * - allowedPaths enforced at every tool invocation
 * - execute_command has 60s timeout, stdin closed
 * - exec() is intentionally used (not execFile) because agent commands
 *   need shell features: pipes, redirects, env var expansion.
 *   Security is enforced via canExecuteCommands gate + allowedCommands whitelist.
 */

import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { ipcMain } from 'electron'

// -----------------------------------------------------------------------------
// Security: Path Validation
// -----------------------------------------------------------------------------

/**
 * Validate that a path is within the allowed paths list.
 * Resolves symlinks and normalizes paths to prevent traversal attacks.
 */
export function validatePath(targetPath: string, allowedPaths: string[]): { valid: boolean; resolved: string; error?: string } {
  if (allowedPaths.length === 0) {
    return { valid: false, resolved: '', error: 'No allowed paths configured. Connect artifact nodes to grant filesystem access.' }
  }

  try {
    const resolved = path.resolve(targetPath)

    // Check if the resolved path starts with any allowed path
    const isAllowed = allowedPaths.some(allowed => {
      const resolvedAllowed = path.resolve(allowed)
      return resolved === resolvedAllowed || resolved.startsWith(resolvedAllowed + path.sep)
    })

    if (!isAllowed) {
      return { valid: false, resolved, error: `Path "${resolved}" is outside allowed directories: ${allowedPaths.join(', ')}` }
    }

    // Additional symlink check — resolve real path if the file exists
    if (fs.existsSync(resolved)) {
      const realPath = fs.realpathSync(resolved)
      const isRealAllowed = allowedPaths.some(allowed => {
        const resolvedAllowed = path.resolve(allowed)
        return realPath === resolvedAllowed || realPath.startsWith(resolvedAllowed + path.sep)
      })

      if (!isRealAllowed) {
        return { valid: false, resolved: realPath, error: `Symlink target "${realPath}" is outside allowed directories` }
      }
    }

    return { valid: true, resolved }
  } catch (err) {
    return { valid: false, resolved: '', error: `Path validation failed: ${(err as Error).message}` }
  }
}

/**
 * Validate a command against the allowed commands whitelist.
 */
export function validateCommand(command: string, allowedCommands: string[]): { valid: boolean; error?: string } {
  if (allowedCommands.length === 0) {
    // Empty whitelist = all commands allowed (when canExecuteCommands is true)
    return { valid: true }
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
  endLine?: number
): FilesystemToolResult {
  const validation = validatePath(filePath, allowedPaths)
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
  allowedPaths: string[]
): FilesystemToolResult {
  const validation = validatePath(filePath, allowedPaths)
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
  allowedPaths: string[]
): FilesystemToolResult {
  const validation = validatePath(filePath, allowedPaths)
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
  allowedPaths: string[]
): FilesystemToolResult {
  const validation = validatePath(dirPath, allowedPaths)
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
  fileGlob?: string
): FilesystemToolResult {
  const validation = validatePath(dirPath, allowedPaths)
  if (!validation.valid) return { success: false, error: validation.error }

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

// NOTE: exec() with shell: true is intentional here. Agent commands need shell
// features (pipes, redirects, env vars) for commands like `npm test | head -50`.
// Security is enforced via: canExecuteCommands gate (default false),
// allowedCommands whitelist, allowedPaths for cwd, and 60s timeout.
export function executeCommand(
  command: string,
  allowedPaths: string[],
  allowedCommands: string[],
  cwd?: string,
  timeoutMs: number = 60000
): Promise<FilesystemToolResult> {
  const cmdValidation = validateCommand(command, allowedCommands)
  if (!cmdValidation.valid) return Promise.resolve({ success: false, error: cmdValidation.error })

  // Use first allowed path as default cwd
  const workingDir = cwd ? path.resolve(cwd) : (allowedPaths[0] ? path.resolve(allowedPaths[0]) : process.cwd())

  // Validate cwd is within allowed paths
  if (cwd) {
    const cwdValidation = validatePath(cwd, allowedPaths)
    if (!cwdValidation.valid) return Promise.resolve({ success: false, error: cwdValidation.error })
  }

  return new Promise((resolve) => {
    const child = exec(command, {
      cwd: workingDir,
      timeout: timeoutMs,
      maxBuffer: 100 * 1024, // 100KB
      shell: true,
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

// Helper: convert simple glob to regex
function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

// -----------------------------------------------------------------------------
// IPC Handlers — Register with Electron main process
// -----------------------------------------------------------------------------

export function registerFilesystemHandlers(): void {
  ipcMain.handle('fs:readFile', async (_event, filePath: string, allowedPaths: string[], startLine?: number, endLine?: number) => {
    return readFile(filePath, allowedPaths, startLine, endLine)
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string, allowedPaths: string[]) => {
    return writeFile(filePath, content, allowedPaths)
  })

  ipcMain.handle('fs:editFile', async (_event, filePath: string, oldString: string, newString: string, allowedPaths: string[]) => {
    return editFile(filePath, oldString, newString, allowedPaths)
  })

  ipcMain.handle('fs:listDirectory', async (_event, dirPath: string, allowedPaths: string[]) => {
    return listDirectory(dirPath, allowedPaths)
  })

  ipcMain.handle('fs:searchFiles', async (_event, dirPath: string, pattern: string, allowedPaths: string[], fileGlob?: string) => {
    return searchFiles(dirPath, pattern, allowedPaths, fileGlob)
  })

  ipcMain.handle('fs:executeCommand', async (_event, command: string, allowedPaths: string[], allowedCommands: string[], cwd?: string, timeoutMs?: number) => {
    return executeCommand(command, allowedPaths, allowedCommands, cwd, timeoutMs)
  })
}
