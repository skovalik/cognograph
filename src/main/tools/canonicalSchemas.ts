// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Canonical Zod Schemas — single source of truth for all tool input validation.
 *
 * Unifies the three competing schema sources:
 *   - sdkTools.ts (flat params, Zod-based)
 *   - agentTools.ts (JSON Schema, renderer-side)
 *   - MCP tools (JSON Schema, nested structure)
 *
 * Design decisions (per plan decision #6):
 *   - Takes MCP's nested, explicitly-typed structure as the canonical shape
 *   - Covers the superset of all capabilities from all 3 schemas
 *   - JSON Schema generated downstream via zod-to-json-schema (assembleToolPool.ts)
 *   - Node type enums include all types observed across all schemas
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/** All node types across sdkTools, agentTools, and MCP */
export const NodeTypeEnum = z.enum([
  'note',
  'task',
  'artifact',
  'project',
  'text',
  'conversation',
  'orchestrator',
  'workspace',
  'action',
])

/** Content types for artifact nodes */
export const ContentTypeEnum = z.enum([
  'text',
  'markdown',
  'code',
  'html',
  'json',
  'svg',
  'mermaid',
])

/** Task status values */
export const TaskStatusEnum = z.enum(['todo', 'in-progress', 'done'])

/** Task priority values */
export const TaskPriorityEnum = z.enum(['none', 'low', 'medium', 'high'])

/** 2D position on canvas */
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

// ---------------------------------------------------------------------------
// Canvas Tool Schemas
// ---------------------------------------------------------------------------

/** create_node — create a single node on the canvas */
export const CreateNodeSchema = z.object({
  type: NodeTypeEnum.describe('Node type'),
  title: z.string().describe('Node title'),
  content: z.string().optional().describe('Node content (text, HTML, code)'),
  description: z.string().optional().describe('Node description'),
  contentType: ContentTypeEnum.optional().describe(
    'Content type for artifact nodes. Use "html" for rendered HTML.'
  ),
  status: TaskStatusEnum.optional().describe('Status for task nodes'),
  priority: TaskPriorityEnum.optional().describe('Priority for task nodes'),
  position: PositionSchema.optional().describe(
    'Position in workspace. If omitted, positions near the agent conversation.'
  ),
  connectTo: z
    .string()
    .optional()
    .describe('Node ID to connect to after creation'),
})

/** batch_create — create multiple nodes and edges in one call */
export const BatchCreateSchema = z.object({
  nodes: z
    .array(
      z.object({
        temp_id: z
          .string()
          .describe('Temporary ID to reference in edges (e.g. "phase1", "task1")'),
        type: NodeTypeEnum.describe('Node type'),
        title: z.string().describe('Node title'),
        content: z.string().optional().describe('Content for notes/artifacts'),
        description: z.string().optional().describe('Description for projects/tasks'),
        contentType: ContentTypeEnum.optional().describe(
          'Content type for artifact nodes'
        ),
        status: TaskStatusEnum.optional().describe('Status for tasks'),
        priority: TaskPriorityEnum.optional().describe('Priority for tasks'),
      })
    )
    .describe('Array of nodes to create'),
  edges: z
    .array(
      z.object({
        source: z.string().describe('Source temp_id or real node ID'),
        target: z.string().describe('Target temp_id or real node ID'),
        label: z.string().optional().describe('Optional edge label'),
      })
    )
    .optional()
    .describe('Array of edges to create'),
})

/** update_node — update properties of an existing node */
export const UpdateNodeSchema = z.object({
  nodeId: z.string().describe('Node ID to update'),
  title: z.string().optional().describe('New title'),
  content: z.string().optional().describe('New content (for notes/artifacts)'),
  description: z
    .string()
    .optional()
    .describe('New description (for projects/tasks)'),
  contentType: ContentTypeEnum.optional().describe(
    'Content type for artifact nodes'
  ),
  status: TaskStatusEnum.optional().describe('New status (for tasks)'),
  priority: TaskPriorityEnum.optional().describe('New priority (for tasks)'),
  tags: z
    .array(z.string())
    .optional()
    .describe('New tags array'),
})

/** delete_node — remove a node from the canvas */
export const DeleteNodeSchema = z.object({
  nodeId: z.string().describe('The ID of the node to delete'),
})

/** link_nodes — connect two nodes with a directed edge */
export const LinkNodesSchema = z.object({
  source: z.string().describe('Source node ID'),
  target: z.string().describe('Target node ID'),
  label: z.string().optional().describe('Edge label'),
})

/** unlink_nodes — remove an edge between two nodes */
export const UnlinkNodesSchema = z.object({
  sourceId: z.string().describe('Source node ID'),
  targetId: z.string().describe('Target node ID'),
})

/** search_nodes — search for nodes by type, title, or tags */
export const SearchNodesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Search query (substring match on title/content)'),
  type: NodeTypeEnum.optional().describe('Filter by node type'),
  titleContains: z
    .string()
    .optional()
    .describe('Filter by title substring (case-insensitive)'),
  hasTag: z.string().optional().describe('Filter by tag'),
  limit: z.number().optional().describe('Max results (default: 10)'),
})

/** get_node — get full details of a specific node */
export const GetNodeSchema = z.object({
  nodeId: z.string().describe('The ID of the node to get details for'),
})

/** get_initial_context — get overview of all nodes and edges */
export const GetInitialContextSchema = z.object({
  includeContent: z
    .boolean()
    .optional()
    .describe('Include full node content in results (default: false for brevity)'),
})

/** get_context_chain — get content of connected nodes */
export const GetContextChainSchema = z.object({
  nodeId: z
    .string()
    .optional()
    .describe('Node ID to get context for (optional, defaults to current conversation)'),
})

/** get_selection — get currently selected nodes (no params) */
export const GetSelectionSchema = z.object({})

/** get_todos — get task nodes with optional filters */
export const GetTodosSchema = z.object({
  status: TaskStatusEnum.optional().describe('Filter by task status'),
  priority: TaskPriorityEnum.optional().describe('Filter by task priority'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Filter by tags (tasks must have all specified tags)'),
  projectId: z
    .string()
    .optional()
    .describe('Filter by project node ID (tasks connected to this project)'),
  limit: z.number().optional().describe('Max results (default: 20)'),
})

/** add_comment — append a timestamped comment to a node */
export const AddCommentSchema = z.object({
  nodeId: z.string().describe('The ID of the node to add a comment to'),
  comment: z.string().describe('The comment text to append'),
})

/** move_node — move a node to a new position */
export const MoveNodeSchema = z.object({
  nodeId: z.string().describe('The ID of the node to move'),
  position: PositionSchema.describe('New position coordinates'),
})

// ---------------------------------------------------------------------------
// Filesystem Tool Schemas
// ---------------------------------------------------------------------------

/** read_file — read the contents of a file */
export const ReadFileSchema = z.object({
  path: z.string().describe('Absolute or relative file path'),
  startLine: z.number().optional().describe('Start line (1-indexed, optional)'),
  endLine: z.number().optional().describe('End line (inclusive, optional)'),
})

/** write_file — write content to a file */
export const WriteFileSchema = z.object({
  path: z.string().describe('File path to write to'),
  content: z.string().describe('Content to write'),
})

/** edit_file — make a targeted edit to a file */
export const EditFileSchema = z.object({
  path: z.string().describe('File path to edit'),
  oldString: z.string().describe('Exact string to find (must match exactly)'),
  newString: z.string().describe('Replacement string'),
})

/** list_directory — list the contents of a directory */
export const ListDirectorySchema = z.object({
  path: z.string().describe('Directory path to list'),
})

/** search_files — search for a regex pattern across files */
export const SearchFilesSchema = z.object({
  path: z.string().describe('Directory to search in'),
  pattern: z.string().describe('Regex pattern to search for'),
  fileGlob: z
    .string()
    .optional()
    .describe('Optional file name filter (e.g., "*.ts")'),
})

// ---------------------------------------------------------------------------
// Command Tool Schema
// ---------------------------------------------------------------------------

/** execute_command — execute a shell command */
export const ExecuteCommandSchema = z.object({
  command: z.string().describe('Shell command to execute'),
  cwd: z
    .string()
    .optional()
    .describe('Working directory (optional, defaults to first allowed path)'),
})

// ---------------------------------------------------------------------------
// Memory Tool Schemas
// ---------------------------------------------------------------------------

/** add_memory — store a key-value pair in persistent memory */
export const AddMemorySchema = z.object({
  key: z
    .string()
    .max(100)
    .describe(
      'A descriptive key for this memory (e.g., "project_root", "test_command"). Max 100 characters.'
    ),
  value: z
    .string()
    .max(10000)
    .describe('The information to remember. Max 10000 characters.'),
})

/** get_memory — retrieve a specific memory entry by key */
export const GetMemorySchema = z.object({
  key: z.string().describe('The key of the memory entry to retrieve'),
})

/** list_memories — list all stored memory entries (no params) */
export const ListMemoriesSchema = z.object({})

/** delete_memory — delete a specific memory entry by key */
export const DeleteMemorySchema = z.object({
  key: z.string().describe('The key of the memory entry to delete'),
})

// ---------------------------------------------------------------------------
// Coordinator Tool Schemas (Orchestrator coordinator strategy)
// ---------------------------------------------------------------------------

/** spawn_worker — dispatch a worker agent on a connected conversation node */
export const SpawnWorkerSchema = z.object({
  agentNodeId: z.string().describe('Node ID of the connected conversation/agent node to run'),
  prompt: z.string().describe('Prompt to send to the worker agent'),
  edgeId: z.string().optional().describe('Edge ID linking the orchestrator to the agent (for result storage)'),
})

/** get_worker_result — read the result from a completed worker */
export const GetWorkerResultSchema = z.object({
  agentNodeId: z.string().describe('Node ID of the worker agent to get results from'),
})

/** synthesize_results — combine multiple worker results into a final output */
export const SynthesizeResultsSchema = z.object({
  agentNodeIds: z.array(z.string()).optional().describe(
    'Node IDs of workers to synthesize. If omitted, uses all completed workers.'
  ),
  synthesisPrompt: z.string().optional().describe(
    'Optional instructions for how to combine the results. Defaults to comprehensive synthesis.'
  ),
})

// ---------------------------------------------------------------------------
// Schema registry — for programmatic access
// ---------------------------------------------------------------------------

/**
 * All canonical schemas indexed by tool name.
 * Used by builtinTools.ts and tests to ensure every tool has a schema.
 */
export const CANONICAL_SCHEMAS = {
  // Canvas tools
  create_node: CreateNodeSchema,
  batch_create: BatchCreateSchema,
  update_node: UpdateNodeSchema,
  delete_node: DeleteNodeSchema,
  link_nodes: LinkNodesSchema,
  unlink_nodes: UnlinkNodesSchema,
  search_nodes: SearchNodesSchema,
  get_node: GetNodeSchema,
  get_initial_context: GetInitialContextSchema,
  get_context_chain: GetContextChainSchema,
  get_selection: GetSelectionSchema,
  get_todos: GetTodosSchema,
  add_comment: AddCommentSchema,
  move_node: MoveNodeSchema,
  // Filesystem tools
  read_file: ReadFileSchema,
  write_file: WriteFileSchema,
  edit_file: EditFileSchema,
  list_directory: ListDirectorySchema,
  search_files: SearchFilesSchema,
  // Command tool
  execute_command: ExecuteCommandSchema,
  // Memory tools
  add_memory: AddMemorySchema,
  get_memory: GetMemorySchema,
  list_memories: ListMemoriesSchema,
  delete_memory: DeleteMemorySchema,
  // Coordinator tools
  spawn_worker: SpawnWorkerSchema,
  get_worker_result: GetWorkerResultSchema,
  synthesize_results: SynthesizeResultsSchema,
} as const

export type CanonicalToolName = keyof typeof CANONICAL_SCHEMAS
