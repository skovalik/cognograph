#!/usr/bin/env node

// Standalone MCP CLI entry point - Phase 14
// Runs the Cognograph MCP server without Electron

import { existsSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { FileSyncProvider } from './provider'
import { createMCPServer } from './server'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  let workspacePath: string | null = null

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--workspace-path': {
        const pathVal = args[++i] ?? ''
        if (!pathVal || pathVal.startsWith('-')) {
          console.error('Error: --workspace-path requires a value')
          process.exit(1)
        }
        workspacePath = pathVal
        break
      }
      case '--workspace-id': {
        const id = args[++i] ?? ''
        if (!id || id.startsWith('-')) {
          console.error('Error: --workspace-id requires a value')
          process.exit(1)
        }
        const dataDir = getDataDir(args)
        workspacePath = join(dataDir, `${id}.json`)
        break
      }
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
        break
      case '--version':
        console.error('cognograph-mcp v1.0.0')
        process.exit(0)
        break
    }
  }

  // If no workspace path resolved from flags, try positional arg with env
  if (!workspacePath && args.length > 0 && args[0] && !args[0].startsWith('-')) {
    const dataDir = getDataDir(args)
    workspacePath = join(dataDir, `${args[0]}.json`)
  }

  if (!workspacePath) {
    console.error('Error: No workspace specified.')
    console.error('')
    printUsage()
    process.exit(1)
  }

  // Resolve to absolute path
  workspacePath = resolve(workspacePath)

  if (!existsSync(workspacePath)) {
    console.error(`Error: Workspace file not found: ${workspacePath}`)
    process.exit(1)
  }

  if (!statSync(workspacePath).isFile()) {
    console.error(`Error: Path is not a file: ${workspacePath}`)
    process.exit(1)
  }

  console.error(`[MCP] Loading workspace: ${workspacePath}`)

  // Create provider and load workspace
  const provider = new FileSyncProvider(workspacePath)
  await provider.load()

  console.error(`[MCP] Workspace loaded: ${provider.getWorkspaceName()} (${provider.getWorkspaceId()})`)

  // Create and start MCP server
  const server = await createMCPServer(provider)

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.error('[MCP] Shutting down...')
    await provider.flush()
    provider.close()
    await server.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function getDataDir(args: string[]): string {
  // Check --data-dir flag
  const dataDirIdx = args.indexOf('--data-dir')
  const dataDirArg = dataDirIdx !== -1 ? args[dataDirIdx + 1] : undefined
  if (dataDirArg) {
    return resolve(dataDirArg)
  }

  // Check environment variable
  if (process.env.COGNOGRAPH_DATA_DIR) {
    return resolve(process.env.COGNOGRAPH_DATA_DIR)
  }

  // Platform-specific default
  const platform = process.platform
  if (platform === 'win32') {
    return join(process.env.APPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Roaming'), 'cognograph', 'workspaces')
  } else if (platform === 'darwin') {
    return join(process.env.HOME || '', 'Library', 'Application Support', 'cognograph', 'workspaces')
  } else {
    // Linux / other
    return join(process.env.XDG_CONFIG_HOME || join(process.env.HOME || '', '.config'), 'cognograph', 'workspaces')
  }
}

function printUsage(): void {
  console.error(`Usage: cognograph-mcp [options]

Options:
  --workspace-path <path>  Direct path to workspace JSON file
  --workspace-id <id>      Workspace ID (combined with --data-dir or defaults)
  --data-dir <dir>         Directory containing workspace files
  --help, -h               Show this help
  --version                Show version

Environment:
  COGNOGRAPH_DATA_DIR      Default workspace directory

Examples:
  cognograph-mcp --workspace-path ./my-workspace.json
  cognograph-mcp --workspace-id abc123
  cognograph-mcp --workspace-id abc123 --data-dir ~/cognograph/workspaces
`)
}

main().catch((err) => {
  console.error('[MCP] Fatal error:', err)
  process.exit(1)
})
