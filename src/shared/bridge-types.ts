/**
 * Claude Code Bridge Types
 *
 * Shared type definitions for the Claude Code bridge:
 * - Observation layer (activity events, file touches, sessions)
 * - Dispatch layer (task queue, dispatch messages, auto-dispatch rules)
 *
 * Used by main process (activityWatcher, ccBridgeService), preload (IPC),
 * and renderer (ccBridgeStore).
 *
 * @module bridge-types
 */

// -----------------------------------------------------------------------------
// Activity Event
// -----------------------------------------------------------------------------

/**
 * A single Claude Code activity event, written by the CC PostToolUse hook
 * and read by the Cognograph activityWatcher via fs.watch on events.jsonl.
 */
export interface CCActivityEvent {
  /** Event type discriminator */
  type: 'tool_use' | 'message' | 'session_start' | 'session_end' | 'error'
  /** Unix ms timestamp */
  timestamp: number
  /** Claude Code session identifier (from hook environment) */
  sessionId: string
  /** Event payload */
  data: {
    /** Tool name (e.g., 'Edit', 'Write', 'Read', 'Bash', 'Glob', 'Grep') */
    toolName?: string
    /** Tool input parameters (sanitized subset) */
    toolInput?: Record<string, unknown>
    /** Human-readable summary of the event */
    content?: string
    /** File paths affected by this tool call */
    filePaths?: string[]
    /** Working directory of the Claude Code session */
    workingDirectory?: string
  }
}

// -----------------------------------------------------------------------------
// Bridge Configuration
// -----------------------------------------------------------------------------

/**
 * Configuration for the Claude Code activity bridge.
 * Stored in electron-store settings under 'ccBridge'.
 */
export interface CCBridgeConfig {
  /** Whether the bridge is enabled (user opt-in) */
  enabled: boolean
  /** Directory name for activity files (relative to project root) */
  activityDir: string
  /** Debounce interval for fs.watch events (Windows fires duplicates) */
  watchDebounceMs: number
  /** Maximum events to retain in the renderer store (FIFO eviction) */
  maxEvents: number
}

/**
 * Dispatch server configuration — separate from activity bridge.
 * Controls the localhost HTTP server that sends tasks to Claude Code.
 */
export interface CCDispatchConfig {
  /** Whether the dispatch server is enabled (user opt-in, separate from observation) */
  dispatchEnabled: boolean
  /** Port for the localhost dispatch HTTP server */
  dispatchPort: number
  /** Maximum port range to scan if primary port is occupied (tries port to port+8) */
  dispatchPortRange: number
  /** Shared secret token for authentication (required for all dispatch endpoints) */
  sharedSecret: string
  /** Rate limit: max GET requests per minute */
  rateLimitGet: number
  /** Rate limit: max POST requests per minute */
  rateLimitPost: number
  /** Maximum dispatch content payload size in bytes */
  maxPayloadBytes: number
  /** Maximum context payload size in bytes (content + aggregated context) */
  maxContextBytes: number
  /** Dispatch timeout: seconds to wait before marking dispatch as unresponsive */
  dispatchTimeoutSec: number
  /** Whether to auto-update task status on canvas when CC reports completion */
  autoUpdateTaskStatus: boolean
}

/**
 * Default bridge configuration values.
 */
export const DEFAULT_CC_BRIDGE_CONFIG: CCBridgeConfig = {
  enabled: false,
  activityDir: '.cognograph-activity',
  watchDebounceMs: 500,
  maxEvents: 1000,
}

/**
 * Default dispatch configuration values.
 */
export const DEFAULT_CC_DISPATCH_CONFIG: CCDispatchConfig = {
  dispatchEnabled: false,
  dispatchPort: 17242,
  dispatchPortRange: 8,
  sharedSecret: '',
  rateLimitGet: 60,
  rateLimitPost: 10,
  maxPayloadBytes: 102400,
  maxContextBytes: 1048576,
  dispatchTimeoutSec: 30,
  autoUpdateTaskStatus: true,
}

// -----------------------------------------------------------------------------
// Dispatch Types
// -----------------------------------------------------------------------------

/** Priority level for dispatched tasks */
export type CCDispatchPriority = 'high' | 'normal' | 'low'

/** Type of dispatch message */
export type CCDispatchType = 'task' | 'context' | 'instruction'

/** Lifecycle status of a dispatch message */
export type CCDispatchStatus = 'pending' | 'acknowledged' | 'completed' | 'failed' | 'timeout'

/**
 * A dispatch message queued for Claude Code to pick up.
 * These are ephemeral (in-memory only, never persisted to disk).
 * @internal
 */
export interface CCDispatchMessage {
  /** Unique dispatch identifier */
  id: string
  /** Dispatch type discriminator */
  type: CCDispatchType
  /** Priority level */
  priority: CCDispatchPriority
  /** Instruction text (the actual task description) */
  content: string
  /** Optional node IDs whose BFS context was aggregated */
  contextNodeIds?: string[]
  /** Aggregated context text from BFS traversal of connected nodes */
  contextText?: string
  /** File paths to focus on (validated: must be within project directory) */
  filePaths?: string[]
  /** Source node ID on canvas that originated this dispatch */
  sourceNodeId?: string
  /** Unix ms timestamp when created */
  createdAt: number
  /** Unix ms timestamp when status last changed */
  updatedAt: number
  /** Current lifecycle status */
  status: CCDispatchStatus
  /** Completion message (if CC reports completion details) */
  completionMessage?: string
}

/**
 * Result payload returned by CC when acknowledging or completing a dispatch.
 */
export interface CCDispatchResult {
  /** The dispatch ID being reported on */
  dispatchId: string
  /** New status */
  status: 'acknowledged' | 'completed' | 'failed'
  /** Optional message from CC */
  message?: string
  /** Files CC modified during this dispatch (reported on completion) */
  filesModified?: string[]
}

/**
 * Health check response from the dispatch server.
 */
export interface CCDispatchHealthCheck {
  status: 'ok'
  pendingCount: number
  acknowledgedCount: number
  port: number
  uptime: number
}

// -----------------------------------------------------------------------------
// File Touch Tracking
// -----------------------------------------------------------------------------

/** Operation type for file touches */
export type FileTouchOperation = 'read' | 'edit' | 'write' | 'grep'

/**
 * Tracks how a specific CC session has interacted with a file.
 */
export interface FileTouch {
  /** Absolute file path */
  filePath: string
  /** File path relative to project root */
  fileRelative: string
  /** CC session that touched the file */
  sessionId: string
  /** Unix ms timestamp of last interaction */
  lastTouched: number
  /** Total number of interactions with this file */
  touchCount: number
  /** Types of operations performed on this file */
  operations: FileTouchOperation[]
}

// -----------------------------------------------------------------------------
// Session Tracking
// -----------------------------------------------------------------------------

/** Lifecycle status of a CC session */
export type CCSessionStatus = 'active' | 'idle' | 'ended'

/**
 * Metadata for a tracked Claude Code session.
 */
export interface CCSessionData {
  /** Session identifier from CC hooks */
  sessionId: string
  /** Unix ms timestamp when session was first observed */
  startedAt: number
  /** Current lifecycle status */
  status: CCSessionStatus
  /** Total tool calls observed in this session */
  toolCallCount: number
  /** Files modified by this session */
  filesModified: string[]
  /** Unix ms timestamp of last observed activity */
  lastActivity: number
  /** Accent color for visual differentiation (auto-assigned) */
  accentColor: string
}

/** Timeout thresholds for session status transitions (milliseconds) */
export const CC_SESSION_TIMEOUTS = {
  /** No events for this long -> status = 'idle' */
  idle: 60_000,
  /** No events for this long -> status = 'ended' */
  ended: 300_000,
  /** Heartbeat check interval */
  heartbeatInterval: 15_000,
} as const

// -----------------------------------------------------------------------------
// Auto-Dispatch Rules
// -----------------------------------------------------------------------------

/** Trigger condition for auto-dispatch */
export type AutoDispatchTrigger =
  | 'node-created'
  | 'node-updated'
  | 'task-status-changed'
  | 'edge-created'

/**
 * An auto-dispatch rule that triggers a dispatch when canvas state changes.
 */
export interface AutoDispatchRule {
  /** Unique rule identifier */
  id: string
  /** Human-readable rule name */
  name: string
  /** Whether this rule is currently active */
  enabled: boolean
  /** What triggers this rule */
  trigger: AutoDispatchTrigger
  /** Optional node type filter (only trigger for this node type) */
  nodeTypeFilter?: string
  /** Template content for the dispatch (supports {{title}}, {{content}} placeholders) */
  templateContent: string
  /** Dispatch priority */
  priority: CCDispatchPriority
  /** Whether to include BFS context from connected nodes */
  includeContext: boolean
  /** Unix ms timestamp when rule was created */
  createdAt: number
}

// -----------------------------------------------------------------------------
// Dispatch Template
// -----------------------------------------------------------------------------

/**
 * A pre-configured dispatch template for common instructions.
 */
export interface CCDispatchTemplate {
  /** Unique template identifier */
  id: string
  /** Human-readable template name */
  name: string
  /** Template content (supports {{title}}, {{content}}, {{filePaths}} placeholders) */
  content: string
  /** Default dispatch type */
  type: CCDispatchType
  /** Default priority */
  priority: CCDispatchPriority
  /** Whether to include BFS context */
  includeContext: boolean
  /** Unix ms timestamp when created */
  createdAt: number
}
