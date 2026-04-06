// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Builtin Tools — wraps the 8 SDK canvas tools + filesystem/command/memory tools
 * using the canonical Tool interface via buildTool().
 *
 * Each tool uses a canonical Zod schema from canonicalSchemas.ts and delegates
 * its call() to the existing implementation (IPC to renderer for canvas tools,
 * filesystemTools.ts for filesystem/command tools).
 *
 * The renderer IPC bridge and filesystem tool functions are injected via the
 * BuiltinToolDeps interface to keep this module testable without Electron.
 */

import { buildTool } from './buildTool'
import {
  AddCommentSchema,
  AddMemorySchema,
  BatchCreateSchema,
  CreateNodeSchema,
  DeleteMemorySchema,
  DeleteNodeSchema,
  EditFileSchema,
  ExecuteCommandSchema,
  GetContextChainSchema,
  GetInitialContextSchema,
  GetMemorySchema,
  GetNodeSchema,
  GetSelectionSchema,
  GetTodosSchema,
  LinkNodesSchema,
  ListDirectorySchema,
  ListMemoriesSchema,
  MoveNodeSchema,
  ReadFileSchema,
  SearchFilesSchema,
  SearchNodesSchema,
  UnlinkNodesSchema,
  UpdateNodeSchema,
  WriteFileSchema,
} from './canonicalSchemas'
import type { Tool, ToolResult } from './types'

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

/**
 * External dependencies required by builtin tools.
 *
 * Injected at construction time so tools can be tested without Electron IPC,
 * filesystem access, or other main-process singletons.
 */
export interface BuiltinToolDeps {
  /** Send a tool call to the renderer via IPC and await the result */
  executeInRenderer: (
    toolName: string,
    args: Record<string, unknown>,
    conversationId?: string,
  ) => Promise<unknown>

  /** Get the current conversation ID for context positioning */
  getCurrentConversationId: () => string | undefined

  /** Filesystem: read_file */
  readFile: (
    path: string,
    allowedPaths: string[],
    startLine?: number,
    endLine?: number,
  ) => { success: boolean; result?: unknown; error?: string }

  /** Filesystem: write_file */
  writeFile: (
    path: string,
    content: string,
    allowedPaths: string[],
  ) => { success: boolean; result?: unknown; error?: string }

  /** Filesystem: edit_file */
  editFile: (
    path: string,
    oldString: string,
    newString: string,
    allowedPaths: string[],
  ) => { success: boolean; result?: unknown; error?: string }

  /** Filesystem: list_directory */
  listDirectory: (
    path: string,
    allowedPaths: string[],
  ) => { success: boolean; result?: unknown; error?: string }

  /** Filesystem: search_files */
  searchFiles: (
    path: string,
    pattern: string,
    allowedPaths: string[],
    fileGlob?: string,
  ) => { success: boolean; result?: unknown; error?: string }

  /** Shell: execute_command */
  executeCommand: (
    command: string,
    allowedPaths: string[],
    allowedCommands: string[],
    cwd?: string,
  ) => Promise<{ success: boolean; result?: unknown; error?: string }>

  /** Get current security context for filesystem/command tools */
  getSecurityContext: () => {
    allowedPaths: string[]
    allowedCommands: string[]
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap a renderer IPC result into a ToolResult */
function rendererResult(result: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  }
}

/** Convert a FilesystemToolResult into a ToolResult */
function fsResult(res: { success: boolean; result?: unknown; error?: string }): ToolResult {
  if (!res.success) {
    return {
      content: [{ type: 'text', text: res.error ?? 'Unknown error' }],
      isError: true,
    }
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(res.result) }],
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create all builtin tools, wired to the given dependencies.
 *
 * Returns an array of frozen Tool objects ready for assembleToolPool().
 */
export function createBuiltinTools(deps: BuiltinToolDeps): Tool[] {
  // Canvas helper — validates input, calls renderer, wraps result
  function canvasTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return deps.executeInRenderer(name, args, deps.getCurrentConversationId())
  }

  return [
    // -----------------------------------------------------------------
    // Canvas tools (8 from sdkTools.ts + extras from agentTools.ts)
    // -----------------------------------------------------------------

    buildTool({
      name: 'create_node',
      description:
        'Create a node on the Cognograph canvas. Types: note (text content), task (actionable items), artifact (code/HTML/media), project (groups), action (operations).',
      inputSchema: CreateNodeSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = CreateNodeSchema.parse(input)
        return rendererResult(await canvasTool('create_node', args))
      },
    }),

    buildTool({
      name: 'batch_create',
      description:
        'Create multiple nodes and edges in one call. ALWAYS use this when creating 2+ nodes.',
      inputSchema: BatchCreateSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = BatchCreateSchema.parse(input)
        return rendererResult(await canvasTool('batch_create', args))
      },
    }),

    buildTool({
      name: 'link_nodes',
      description: 'Connect two nodes with a directed edge.',
      inputSchema: LinkNodesSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = LinkNodesSchema.parse(input)
        return rendererResult(await canvasTool('link_nodes', args))
      },
    }),

    buildTool({
      name: 'update_node',
      description: 'Update properties of an existing node.',
      inputSchema: UpdateNodeSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = UpdateNodeSchema.parse(input)
        return rendererResult(await canvasTool('update_node', args))
      },
    }),

    buildTool({
      name: 'delete_node',
      description: 'Delete a node from the canvas.',
      inputSchema: DeleteNodeSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = DeleteNodeSchema.parse(input)
        return rendererResult(await canvasTool('delete_node', args))
      },
    }),

    buildTool({
      name: 'search_nodes',
      description: 'Search for nodes by title, type, tags, or content.',
      inputSchema: SearchNodesSchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = SearchNodesSchema.parse(input)
        return rendererResult(await canvasTool('search_nodes', args))
      },
    }),

    buildTool({
      name: 'get_initial_context',
      description:
        "Get a complete overview of ALL nodes and edges on the canvas. Use this when asked what exists in the workspace, what the user's canvas looks like, or to detect changes.",
      inputSchema: GetInitialContextSchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = GetInitialContextSchema.parse(input)
        return rendererResult(await canvasTool('get_initial_context', args))
      },
    }),

    buildTool({
      name: 'get_context_chain',
      description: 'Get the context chain for the current conversation or a specific node.',
      inputSchema: GetContextChainSchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = GetContextChainSchema.parse(input)
        return rendererResult(await canvasTool('get_context_chain', args))
      },
    }),

    buildTool({
      name: 'get_selection',
      description: 'Get the currently selected nodes on the canvas.',
      inputSchema: GetSelectionSchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        GetSelectionSchema.parse(input)
        return rendererResult(await canvasTool('get_selection', {}))
      },
    }),

    buildTool({
      name: 'get_node',
      description: 'Get full details of a specific node.',
      inputSchema: GetNodeSchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = GetNodeSchema.parse(input)
        return rendererResult(await canvasTool('get_node', args))
      },
    }),

    buildTool({
      name: 'get_todos',
      description: 'Get task nodes with optional filters.',
      inputSchema: GetTodosSchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = GetTodosSchema.parse(input)
        return rendererResult(await canvasTool('get_todos', args))
      },
    }),

    buildTool({
      name: 'add_comment',
      description: 'Append a timestamped comment to a node.',
      inputSchema: AddCommentSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = AddCommentSchema.parse(input)
        return rendererResult(await canvasTool('add_comment', args))
      },
    }),

    buildTool({
      name: 'unlink_nodes',
      description: 'Remove an edge between two nodes.',
      inputSchema: UnlinkNodesSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = UnlinkNodesSchema.parse(input)
        return rendererResult(await canvasTool('unlink_nodes', args))
      },
    }),

    buildTool({
      name: 'move_node',
      description: 'Move a node to a new position in the workspace.',
      inputSchema: MoveNodeSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = MoveNodeSchema.parse(input)
        return rendererResult(await canvasTool('move_node', args))
      },
    }),

    // -----------------------------------------------------------------
    // Filesystem tools (read-only)
    // -----------------------------------------------------------------

    buildTool({
      name: 'read_file',
      description:
        'Read the contents of a file. Returns text content and total line count. Use startLine/endLine for large files.',
      inputSchema: ReadFileSchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = ReadFileSchema.parse(input)
        const ctx = deps.getSecurityContext()
        return fsResult(deps.readFile(args.path, ctx.allowedPaths, args.startLine, args.endLine))
      },
    }),

    buildTool({
      name: 'list_directory',
      description:
        'List the contents of a directory. Returns file names, types (file/directory), and sizes.',
      inputSchema: ListDirectorySchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = ListDirectorySchema.parse(input)
        const ctx = deps.getSecurityContext()
        return fsResult(deps.listDirectory(args.path, ctx.allowedPaths))
      },
    }),

    buildTool({
      name: 'search_files',
      description:
        'Search for a regex pattern across files in a directory. Returns matching file paths, line numbers, and content snippets.',
      inputSchema: SearchFilesSchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = SearchFilesSchema.parse(input)
        const ctx = deps.getSecurityContext()
        return fsResult(deps.searchFiles(args.path, args.pattern, ctx.allowedPaths, args.fileGlob))
      },
    }),

    // -----------------------------------------------------------------
    // Filesystem tools (write)
    // -----------------------------------------------------------------

    buildTool({
      name: 'write_file',
      description:
        'Write content to a file, creating it and parent directories if needed. Overwrites existing content.',
      inputSchema: WriteFileSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = WriteFileSchema.parse(input)
        const ctx = deps.getSecurityContext()
        return fsResult(deps.writeFile(args.path, args.content, ctx.allowedPaths))
      },
    }),

    buildTool({
      name: 'edit_file',
      description:
        'Make a targeted edit to a file by replacing the first occurrence of an exact string with new content.',
      inputSchema: EditFileSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = EditFileSchema.parse(input)
        const ctx = deps.getSecurityContext()
        return fsResult(deps.editFile(args.path, args.oldString, args.newString, ctx.allowedPaths))
      },
    }),

    // -----------------------------------------------------------------
    // Command tool
    // -----------------------------------------------------------------

    buildTool({
      name: 'execute_command',
      description:
        'Execute a shell command with 60s timeout. Supports pipes, redirects, and env vars.',
      inputSchema: ExecuteCommandSchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'block',
      async call(input) {
        const args = ExecuteCommandSchema.parse(input)
        const ctx = deps.getSecurityContext()
        return fsResult(
          await deps.executeCommand(args.command, ctx.allowedPaths, ctx.allowedCommands, args.cwd),
        )
      },
    }),

    // -----------------------------------------------------------------
    // Memory tools
    // -----------------------------------------------------------------

    buildTool({
      name: 'add_memory',
      description:
        'Store a key-value pair in persistent memory. Use this to remember important information across runs.',
      inputSchema: AddMemorySchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = AddMemorySchema.parse(input)
        return rendererResult(await canvasTool('add_memory', args))
      },
    }),

    buildTool({
      name: 'get_memory',
      description: 'Retrieve a specific memory entry by key.',
      inputSchema: GetMemorySchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = GetMemorySchema.parse(input)
        return rendererResult(await canvasTool('get_memory', args))
      },
    }),

    buildTool({
      name: 'list_memories',
      description: 'List all stored memory entries with their keys and values.',
      inputSchema: ListMemoriesSchema,
      isReadOnly: true,
      isConcurrencySafe: true,
      interruptBehavior: 'cancel',
      async call(input) {
        ListMemoriesSchema.parse(input)
        return rendererResult(await canvasTool('list_memories', {}))
      },
    }),

    buildTool({
      name: 'delete_memory',
      description:
        'Delete a specific memory entry by key. Use this to remove outdated or incorrect memories.',
      inputSchema: DeleteMemorySchema,
      isReadOnly: false,
      isConcurrencySafe: false,
      interruptBehavior: 'cancel',
      async call(input) {
        const args = DeleteMemorySchema.parse(input)
        return rendererResult(await canvasTool('delete_memory', args))
      },
    }),
  ]
}
