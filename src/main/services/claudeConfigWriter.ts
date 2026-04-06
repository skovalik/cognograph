// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * claudeConfigWriter.ts — Generates .mcp.json and CLAUDE.md for Claude Code
 * workspace awareness when running inside Cognograph terminal nodes.
 *
 * When a terminal node spawns, this service:
 * 1. Resolves the workspace JSON file path
 * 2. Resolves the path to the cognograph-mcp CLI binary
 * 3. Generates .mcp.json with the MCP server config
 * 4. Generates CLAUDE.md with workspace context + available tools
 * 5. Provides cleanup to remove generated files on terminal exit
 */

import { app } from 'electron'
import { promises as fs } from 'fs'
import { join, resolve } from 'path'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sentinel markers for the Cognograph section appended to user's CLAUDE.md */
const COGNOGRAPH_SECTION_START = '<!-- COGNOGRAPH-CONTEXT-START -->'
const COGNOGRAPH_SECTION_END = '<!-- COGNOGRAPH-CONTEXT-END -->'

/** Backup file name for original CLAUDE.md content */
const CLAUDE_MD_BACKUP = '.cognograph-claude-backup'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeConfigResult {
  /** Absolute path to the generated .mcp.json file */
  mcpConfigPath: string
  /** Absolute path to the CLAUDE.md file (may be user's existing file with appended section) */
  claudeMdPath: string
  /** Whether files were successfully written */
  success: boolean
  /** Error message if generation failed */
  error?: string
  /** If true, we appended to an existing user CLAUDE.md rather than creating a new one */
  appendedToExisting: boolean
  /** Path to backup of original CLAUDE.md content (only set when appendedToExisting is true) */
  backupPath?: string
}

export interface ClaudeConfigInput {
  /** The node ID of the terminal node */
  nodeId: string
  /** Working directory where files will be written */
  cwd: string
  /** Node title for context */
  nodeTitle?: string
  /** Pre-built context markdown from contextWriter (optional, will be embedded in CLAUDE.md) */
  contextMarkdown?: string
  /** Active workspace ID from renderer — constructs workspace path directly */
  workspaceId?: string
}

// ---------------------------------------------------------------------------
// MCP Binary Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the path to the cognograph-mcp CLI binary.
 *
 * In development: uses the project's dist/cognograph-mcp.cjs (built via `npm run build:mcp`).
 * In production: uses the bundled binary in the app's resources directory.
 */
function getMCPBinaryPath(): string {
  // Allow override via env var (useful for dev/testing)
  if (process.env.COGNOGRAPH_MCP_PATH) {
    return resolve(process.env.COGNOGRAPH_MCP_PATH)
  }

  if (app.isPackaged) {
    // Production: binary is in the app's resources/mcp directory
    return join(process.resourcesPath, 'mcp', 'cognograph-mcp.cjs')
  }
  // Development: use the dist build from project root
  return join(app.getAppPath(), 'dist', 'cognograph-mcp.cjs')
}

// ---------------------------------------------------------------------------
// .mcp.json Generation
// ---------------------------------------------------------------------------

/**
 * Generate the .mcp.json content for Claude Code.
 *
 * Configures a stdio-based MCP server pointing to the cognograph-mcp CLI
 * with the current workspace path and node ID.
 */
interface MCPConfig {
  mcpServers: Record<string, unknown>
  [key: string]: unknown
}

function buildMCPConfig(mcpBinaryPath: string, workspacePath: string, nodeId: string): MCPConfig {
  return {
    mcpServers: {
      cognograph: {
        command: 'node',
        args: [mcpBinaryPath, '--workspace-path', workspacePath],
        env: {
          COGNOGRAPH_NODE_ID: nodeId,
        },
      },
    },
  }
}

// ---------------------------------------------------------------------------
// CLAUDE.md Generation
// ---------------------------------------------------------------------------

/**
 * Generate CLAUDE.md content that gives Claude Code full workspace awareness.
 *
 * This file tells Claude Code:
 * - It's running inside a Cognograph terminal node
 * - What node it's in and what's connected
 * - What MCP tools are available and how to use them
 * - Behavioral guidelines for canvas interaction
 */
function buildClaudeMd(nodeId: string, nodeTitle: string, contextMarkdown: string): string {
  // The content between sentinel markers. When appended to an existing CLAUDE.md,
  // the markers allow precise extraction during cleanup.
  return `${COGNOGRAPH_SECTION_START}

---

# Cognograph Workspace Context

You are running inside a **Cognograph terminal node**. Cognograph is a spatial AI workflow orchestration canvas where nodes (conversations, notes, tasks, artifacts, projects) are connected by edges that define context flow.

## Your Identity

- **Node ID:** \`${nodeId}\`
- **Node Title:** ${nodeTitle}
- **Environment:** Embedded terminal inside Cognograph canvas

## MCP Tools Available

MCP tools may be available via the \`cognograph\` server configured in .mcp.json. If tool calls fail or the server is unresponsive, proceed without them — your core task does not depend on MCP. Available tools when the server is running:

### Read Operations
| Tool | Description |
|------|-------------|
| \`get_initial_context\` | Get full BFS context for your node (connected nodes, their content). Call this first. |
| \`get_node\` | Get full details of any node by ID |
| \`search_nodes\` | Search nodes by title/content (substring match). Filter by type. |
| \`get_context_chain\` | Get context chain (incoming edges) for any node up to depth N |
| \`get_todos\` | Get task nodes, filter by status/priority/tags/project |

### Write Operations
| Tool | Description |
|------|-------------|
| \`create_node\` | Create a new node (task, note, artifact, etc.) with optional edge from existing node |
| \`update_node\` | Update node properties (title, content, status, etc.) |
| \`add_comment\` | Append timestamped comment to a node |
| \`link_nodes\` | Create an edge between two nodes |
| \`unlink_nodes\` | Remove an edge between two nodes |

### Specialized Tools
| Tool | Description |
|------|-------------|
| \`cognograph_tokens_get\` | Get design tokens from workspace (raw/CSS/Tailwind format) |
| \`cognograph_site_get_pages\` | Get site architecture (page nodes + components) |
| \`cognograph_site_get_components\` | Get full page spec with component details |
| \`cognograph_site_get_sitemap\` | Update the build status of a page node (planned/wireframed/designed/built/live) |
| \`cognograph_web_get_content_models\` | Get WordPress CPT definitions |
| \`cognograph_web_get_wp_config\` | Get WordPress connection config |

## Connected Node Context

${contextMarkdown || '_No connected nodes. Use `get_initial_context` to refresh._'}

## Guidelines

1. **Start with context:** Call \`get_initial_context\` at the beginning of your session to understand what nodes are connected to your terminal.
2. **Create artifacts:** When you produce code, plans, or documents, use \`create_node\` with type \`artifact\` or \`note\` and \`linkFrom: "${nodeId}"\` to attach them to this terminal's node on the canvas.
3. **Update tasks:** If connected task nodes exist, update their status as you complete work using \`update_node\`.
4. **Spatial awareness:** New nodes are placed at position {x: 0, y: 0} by default. To place them near this terminal, use the position from \`get_node\` on this terminal's ID and offset by ~300px.
5. **Search before creating:** Use \`search_nodes\` to check if a relevant node already exists before creating duplicates.
6. **Leave breadcrumbs:** Use \`add_comment\` on this terminal's node to log significant actions or decisions for future reference.
7. **HTML content type:** When creating artifact nodes with HTML content, ALWAYS set \`contentType\` to \`"html"\` in the data object. This makes content render as a visual web page preview instead of raw code. Example: \`create_node({ type: "artifact", data: { title: "My Page", content: "<html>...</html>", contentType: "html" } })\`

${COGNOGRAPH_SECTION_END}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate .mcp.json and CLAUDE.md in the terminal's working directory.
 *
 * This is called by terminalManager before spawning the PTY process.
 * Both files are placed in `cwd` so Claude Code discovers them on startup.
 *
 * Returns paths to both files for cleanup on terminal exit.
 */
export async function writeClaudeConfig(input: ClaudeConfigInput): Promise<ClaudeConfigResult> {
  const { nodeId, cwd, nodeTitle = 'Terminal', contextMarkdown = '', workspaceId } = input

  const mcpConfigPath = join(cwd, '.mcp.json')
  const claudeMdPath = join(cwd, 'CLAUDE.md')

  // Recover from any crash that left stale markers from a previous session
  await recoverClaudeMd(cwd)

  try {
    // Resolve workspace path — require explicit workspaceId (always current).
    // Do NOT fall back to settings.json which can be stale.
    let workspacePath: string | null = null
    if (workspaceId) {
      const { getAppPath } = await import('./contextWriter')
      workspacePath = join(getAppPath('userData'), 'workspaces', `${workspaceId}.json`)
    }
    if (!workspacePath) {
      return {
        mcpConfigPath,
        claudeMdPath,
        success: false,
        error: 'No active workspace found (no workspaceId passed)',
        appendedToExisting: false,
      }
    }

    // Verify workspace file exists before writing .mcp.json pointing to it
    try {
      await fs.access(workspacePath)
    } catch {
      return {
        mcpConfigPath,
        claudeMdPath,
        success: false,
        error: `Workspace file not found: ${workspacePath}`,
        appendedToExisting: false,
      }
    }

    // Resolve MCP binary path
    const mcpBinaryPath = getMCPBinaryPath()

    // Generate .mcp.json -- merge with existing if present
    const mcpConfig = buildMCPConfig(mcpBinaryPath, workspacePath, nodeId)
    let finalMcpConfig: MCPConfig = mcpConfig

    try {
      const existingContent = await fs.readFile(mcpConfigPath, 'utf-8')
      const existingConfig = JSON.parse(existingContent) as Record<string, unknown>
      if (existingConfig.mcpServers && typeof existingConfig.mcpServers === 'object') {
        // Merge: add our server to existing config, preserving other servers
        finalMcpConfig = {
          ...existingConfig,
          mcpServers: {
            ...(existingConfig.mcpServers as Record<string, unknown>),
            ...mcpConfig.mcpServers,
          },
        }
      }
    } catch {
      // No existing file or invalid JSON -- use our config only
    }

    await fs.writeFile(mcpConfigPath, JSON.stringify(finalMcpConfig, null, 2), 'utf-8')

    // Also write to user-level ~/.claude/.mcp.json as fallback.
    // Claude Code may detect a different project root than cwd, so having the
    // MCP config at the user level ensures the cognograph server is always available.
    const homeDir = process.env.HOME || process.env.USERPROFILE || ''
    if (homeDir) {
      const userMcpDir = join(homeDir, '.claude')
      const userMcpPath = join(userMcpDir, '.mcp.json')
      try {
        await fs.mkdir(userMcpDir, { recursive: true })
        let userMcpConfig: MCPConfig = mcpConfig
        try {
          const existingUserContent = await fs.readFile(userMcpPath, 'utf-8')
          const existingUserConfig = JSON.parse(existingUserContent) as Record<string, unknown>
          if (existingUserConfig.mcpServers && typeof existingUserConfig.mcpServers === 'object') {
            userMcpConfig = {
              ...existingUserConfig,
              mcpServers: {
                ...(existingUserConfig.mcpServers as Record<string, unknown>),
                ...mcpConfig.mcpServers,
              },
            }
          }
        } catch {
          // No existing user-level config or invalid JSON
        }
        await fs.writeFile(userMcpPath, JSON.stringify(userMcpConfig, null, 2), 'utf-8')
      } catch {
        // Non-fatal — cwd-level config is the primary path
      }
    }

    // Generate CLAUDE.md -- append to existing if user has their own
    const claudeMd = buildClaudeMd(nodeId, nodeTitle, contextMarkdown)
    let appendedToExisting = false
    let backupPath: string | undefined

    try {
      const existingClaudeMd = await fs.readFile(claudeMdPath, 'utf-8')

      if (existingClaudeMd.includes(COGNOGRAPH_SECTION_START)) {
        // Our section is already in the file (re-spawn or duplicate terminal).
        // Replace the existing Cognograph section in-place.
        const startIdx = existingClaudeMd.indexOf(COGNOGRAPH_SECTION_START)
        const endIdx = existingClaudeMd.indexOf(COGNOGRAPH_SECTION_END)
        if (endIdx !== -1) {
          const before = existingClaudeMd.slice(0, startIdx)
          const after = existingClaudeMd.slice(endIdx + COGNOGRAPH_SECTION_END.length)
          await fs.writeFile(claudeMdPath, before + claudeMd + after, 'utf-8')
          appendedToExisting = true
          // Backup should already exist from the first append; don't overwrite it
          const existingBackup = join(cwd, CLAUDE_MD_BACKUP)
          try {
            await fs.access(existingBackup)
            backupPath = existingBackup
          } catch {
            // No backup exists — this shouldn't happen but isn't fatal
          }
        } else {
          // Malformed: START marker without END. Append fresh section at end.
          await fs.writeFile(claudeMdPath, existingClaudeMd + '\n\n' + claudeMd, 'utf-8')
          appendedToExisting = true
        }
      } else if (!existingClaudeMd.startsWith('# Cognograph Workspace Context')) {
        // User has their own CLAUDE.md — back it up and append our section
        backupPath = join(cwd, CLAUDE_MD_BACKUP)
        await fs.writeFile(backupPath, existingClaudeMd, 'utf-8')
        await fs.writeFile(claudeMdPath, existingClaudeMd + '\n\n' + claudeMd, 'utf-8')
        appendedToExisting = true
      } else {
        // File starts with our header (Cognograph-only CLAUDE.md from previous run) — overwrite
        await fs.writeFile(claudeMdPath, claudeMd, 'utf-8')
      }
    } catch {
      // No existing CLAUDE.md — write a new one
      await fs.writeFile(claudeMdPath, claudeMd, 'utf-8')
    }

    return { mcpConfigPath, claudeMdPath, success: true, appendedToExisting, backupPath }
  } catch (err) {
    return {
      mcpConfigPath,
      claudeMdPath,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      appendedToExisting: false,
    }
  }
}

/**
 * Remove Cognograph-generated config from the working directory.
 *
 * Called on terminal exit. Handles three CLAUDE.md scenarios:
 * 1. Cognograph-only CLAUDE.md (starts with marker) → delete entire file
 * 2. User's CLAUDE.md with appended section → strip section, restore original
 * 3. User's CLAUDE.md untouched → no-op
 *
 * For .mcp.json: removes the `cognograph` server entry. If no other servers
 * remain, deletes the file. Otherwise writes back without our server.
 *
 * Failures are non-fatal — files may already be deleted or directory gone.
 */
export async function cleanupClaudeConfig(cwd: string): Promise<void> {
  const mcpConfigPath = join(cwd, '.mcp.json')
  const claudeMdPath = join(cwd, 'CLAUDE.md')
  const backupPath = join(cwd, CLAUDE_MD_BACKUP)

  // --- .mcp.json cleanup (cwd-level) ---
  try {
    const content = await fs.readFile(mcpConfigPath, 'utf-8')
    const config = JSON.parse(content)
    if (config?.mcpServers?.cognograph) {
      delete config.mcpServers.cognograph
      if (Object.keys(config.mcpServers).length === 0) {
        await fs.unlink(mcpConfigPath)
      } else {
        await fs.writeFile(mcpConfigPath, JSON.stringify(config, null, 2), 'utf-8')
      }
    }
  } catch {
    // File doesn't exist or can't be parsed — skip
  }

  // --- .mcp.json cleanup (user-level ~/.claude/.mcp.json) ---
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  if (homeDir) {
    const userMcpPath = join(homeDir, '.claude', '.mcp.json')
    try {
      const content = await fs.readFile(userMcpPath, 'utf-8')
      const config = JSON.parse(content)
      if (config?.mcpServers?.cognograph) {
        delete config.mcpServers.cognograph
        if (Object.keys(config.mcpServers).length === 0) {
          await fs.unlink(userMcpPath)
        } else {
          await fs.writeFile(userMcpPath, JSON.stringify(config, null, 2), 'utf-8')
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // --- CLAUDE.md cleanup ---
  try {
    const content = await fs.readFile(claudeMdPath, 'utf-8')

    if (content.includes(COGNOGRAPH_SECTION_START)) {
      const startIdx = content.indexOf(COGNOGRAPH_SECTION_START)
      const endIdx = content.indexOf(COGNOGRAPH_SECTION_END)

      if (endIdx !== -1) {
        // Strip the Cognograph section (and the preceding \n\n if present)
        let before = content.slice(0, startIdx)
        const after = content.slice(endIdx + COGNOGRAPH_SECTION_END.length)

        // Remove trailing whitespace/newlines before the marker
        before = before.replace(/\n{1,2}$/, '')

        const restored = (before + after).trim()

        if (restored.length === 0) {
          // The entire file was our content — delete it
          await fs.unlink(claudeMdPath)
        } else {
          // Restore user's content without our section
          await fs.writeFile(claudeMdPath, restored + '\n', 'utf-8')
        }
      }
      // If START exists but END doesn't (malformed), leave file untouched
      // to avoid data loss
    } else if (content.startsWith('# Cognograph Workspace Context')) {
      // Legacy: Cognograph-only file without markers (from before this fix)
      await fs.unlink(claudeMdPath)
    }
    // If neither marker nor legacy header → user's file, don't touch it
  } catch {
    // File doesn't exist or can't be read — skip
  }

  // --- Backup cleanup ---
  // Prefer restoring from backup (belt-and-suspenders alongside marker stripping)
  // Only delete the backup; the marker-based cleanup above handles CLAUDE.md
  try {
    await fs.unlink(backupPath)
  } catch {
    // No backup exists — skip
  }
}

/**
 * Recover from a crash that left stale Cognograph context in CLAUDE.md.
 *
 * Called at the start of writeClaudeConfig to check if a previous session
 * crashed without cleanup. Recovery ONLY fires when a backup file exists
 * (`.cognograph-claude-backup`), which definitively indicates a crash.
 *
 * If markers exist without a backup, we do NOT strip them — another
 * terminal may be actively using them. The main writeClaudeConfig logic
 * handles that case (replaces markers in-place).
 *
 * This is idempotent — safe to call multiple times.
 */
export async function recoverClaudeMd(cwd: string): Promise<void> {
  const claudeMdPath = join(cwd, 'CLAUDE.md')
  const backupPath = join(cwd, CLAUDE_MD_BACKUP)

  // Only recover if backup file exists (definitive crash indicator)
  try {
    const backupContent = await fs.readFile(backupPath, 'utf-8')
    // Backup exists — restore original CLAUDE.md and remove backup
    await fs.writeFile(claudeMdPath, backupContent, 'utf-8')
    await fs.unlink(backupPath)
  } catch {
    // No backup file — nothing to recover.
    // Markers without backup could mean another terminal is active.
  }
}
