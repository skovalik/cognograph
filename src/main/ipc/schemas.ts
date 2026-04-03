// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * IPC Input Validation Schemas (SEC-0.1j)
 *
 * Zod schemas for the 10 security-critical IPC handlers.
 * Schemas in owned files (folder:list, credentials:*) are integrated directly.
 * Schemas for non-owned files are exported here for subsequent merge integration.
 *
 * Integration status:
 * - [x] credentials:getReal — integrated in index.ts
 * - [x] credentials:set — integrated in index.ts
 * - [x] folder:list — integrated in folderHandler.ts
 * - [x] workspace:save — integrated in workspace.ts
 * - [x] workspace:loadFromPath — integrated in workspace.ts
 * - [x] workspace:delete — integrated in workspace.ts
 * - [x] fs:executeCommand — integrated in filesystemTools.ts
 * - [x] fs:writeFile — integrated in filesystemTools.ts
 * - [x] fs:editFile — integrated in filesystemTools.ts
 * - [x] llm:send — integrated in llm.ts
 *
 * Remaining unvalidated handlers that should get schemas in future passes:
 * - cc-bridge:dispatchTask
 * - cc-bridge:cancelDispatch
 * - llm:extract
 *
 * Completed in Phase 6A TESTS-ROUTES:
 * - [x] credentials:getMasked — integrated in index.ts
 * - [x] credentials:delete — integrated in index.ts
 * - [x] credentials:list — integrated in index.ts
 * - [x] fs:readFile — integrated in filesystemTools.ts
 * - [x] fs:listDirectory — integrated in filesystemTools.ts
 * - [x] fs:searchFiles — integrated in filesystemTools.ts
 * - [x] workspace:load — integrated in workspace.ts
 * - [x] workspace:saveAs — integrated in workspace.ts
 * - [x] workspace:watch — integrated in workspace.ts
 */

import { z } from 'zod'

// -----------------------------------------------------------------------------
// Shared Validators
// -----------------------------------------------------------------------------

/** Non-empty trimmed string */
const nonEmptyString = z.string().min(1, 'Must not be empty').max(10_000)

/** Workspace ID: UUID-like string, no path separators, no reserved prefixes */
const workspaceIdSchema = z.string()
  .min(1, 'Workspace ID is required')
  .max(256, 'Workspace ID too long')
  .refine(s => !s.includes('/') && !s.includes('\\'), 'Workspace ID must not contain path separators')
  .refine(s => !s.includes('\x00'), 'Workspace ID must not contain null bytes')

/** Credential key: alphanumeric + dashes/underscores/dots */
const credentialKeySchema = z.string()
  .min(1, 'Credential key is required')
  .max(256, 'Credential key too long')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Credential key must be alphanumeric with dots, dashes, or underscores')

/** Absolute file path (basic check — further validation happens at handler level) */
const absolutePathSchema = z.string()
  .min(1, 'Path is required')
  .max(4096, 'Path too long')
  .refine(s => !s.includes('\x00'), 'Path must not contain null bytes')

/** Array of absolute paths for allowedPaths parameter */
const allowedPathsSchema = z.array(absolutePathSchema).min(0).max(100)

// -----------------------------------------------------------------------------
// 1. credentials:getReal
// -----------------------------------------------------------------------------

export const CredentialsGetRealSchema = z.object({
  workspaceId: workspaceIdSchema,
  credentialKey: credentialKeySchema,
})

// -----------------------------------------------------------------------------
// 2. credentials:set
// -----------------------------------------------------------------------------

export const CredentialsSetSchema = z.object({
  workspaceId: workspaceIdSchema,
  credentialKey: credentialKeySchema,
  value: z.string().min(1, 'Credential value is required').max(65_536, 'Credential value too large'),
  label: z.string().min(1, 'Label is required').max(256, 'Label too long'),
  credentialType: z.string().min(1, 'Credential type is required').max(64, 'Credential type too long'),
})

// -----------------------------------------------------------------------------
// 3. workspace:save
// -----------------------------------------------------------------------------

export const WorkspaceSaveSchema = z.object({
  id: workspaceIdSchema,
  name: z.string().min(1).max(512),
  nodes: z.array(z.object({}).passthrough()),
  edges: z.array(z.object({}).passthrough()),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number().int().nonnegative(),
}).passthrough() // Allow propertySchema, contextSettings, etc.

// -----------------------------------------------------------------------------
// 4. workspace:loadFromPath
// -----------------------------------------------------------------------------

export const WorkspaceLoadFromPathSchema = z.object({
  filePath: absolutePathSchema,
})

// -----------------------------------------------------------------------------
// 5. workspace:delete
// -----------------------------------------------------------------------------

export const WorkspaceDeleteSchema = z.object({
  id: workspaceIdSchema,
})

// -----------------------------------------------------------------------------
// 6. fs:executeCommand
// -----------------------------------------------------------------------------

export const FsExecuteCommandSchema = z.object({
  command: nonEmptyString,
  allowedPaths: allowedPathsSchema,
  allowedCommands: z.array(z.string().min(1).max(256)).min(0).max(100),
  cwd: absolutePathSchema.optional(),
  timeoutMs: z.number().int().positive().max(300_000).optional(),
})

// -----------------------------------------------------------------------------
// 7. fs:writeFile
// -----------------------------------------------------------------------------

export const FsWriteFileSchema = z.object({
  filePath: absolutePathSchema,
  content: z.string().max(10_000_000, 'Content too large (10 MB max)'),
  allowedPaths: allowedPathsSchema,
})

// -----------------------------------------------------------------------------
// 8. fs:editFile
// -----------------------------------------------------------------------------

export const FsEditFileSchema = z.object({
  filePath: absolutePathSchema,
  oldString: z.string().max(1_000_000),
  newString: z.string().max(1_000_000),
  allowedPaths: allowedPathsSchema,
})

// -----------------------------------------------------------------------------
// 9. folder:list
// -----------------------------------------------------------------------------

export const FolderListInputSchema = z.object({
  folderPath: absolutePathSchema.refine(
    s => s.trim().length > 0,
    'Path must not be empty or whitespace'
  ),
})

// -----------------------------------------------------------------------------
// 10. llm:send
// -----------------------------------------------------------------------------

export const LlmSendSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required').max(256),
  provider: z.enum(['anthropic', 'gemini', 'openai']),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).min(1, 'At least one message is required'),
  systemPrompt: z.string().max(500_000).optional(),
  model: z.string().max(128).optional(),
  maxTokens: z.number().int().positive().max(1_000_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
})

// -----------------------------------------------------------------------------
// 11. credentials:getMasked
// -----------------------------------------------------------------------------

export const CredentialsGetMaskedSchema = z.object({
  workspaceId: workspaceIdSchema,
  credentialKey: credentialKeySchema,
})

// -----------------------------------------------------------------------------
// 12. credentials:delete
// -----------------------------------------------------------------------------

export const CredentialsDeleteSchema = z.object({
  workspaceId: workspaceIdSchema,
  credentialKey: credentialKeySchema,
})

// -----------------------------------------------------------------------------
// 13. credentials:list
// -----------------------------------------------------------------------------

export const CredentialsListSchema = z.object({
  workspaceId: workspaceIdSchema,
})

// -----------------------------------------------------------------------------
// 14. fs:readFile
// -----------------------------------------------------------------------------

export const FsReadFileSchema = z.object({
  filePath: absolutePathSchema,
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
})

// -----------------------------------------------------------------------------
// 15. fs:listDirectory
// -----------------------------------------------------------------------------

export const FsListDirectorySchema = z.object({
  dirPath: absolutePathSchema,
})

// -----------------------------------------------------------------------------
// 16. fs:searchFiles
// -----------------------------------------------------------------------------

export const FsSearchFilesSchema = z.object({
  dirPath: absolutePathSchema,
  pattern: z.string().min(1, 'Pattern is required').max(256, 'Pattern too long'),
  fileGlob: z.string().max(256).optional(),
})

// -----------------------------------------------------------------------------
// 17. workspace:load
// -----------------------------------------------------------------------------

export const WorkspaceLoadSchema = z.object({
  id: workspaceIdSchema,
})

// -----------------------------------------------------------------------------
// 18. workspace:saveAs
// -----------------------------------------------------------------------------

export const WorkspaceSaveAsSchema = z.object({
  data: WorkspaceSaveSchema,
  filePath: absolutePathSchema,
})

// -----------------------------------------------------------------------------
// 19. workspace:watch
// -----------------------------------------------------------------------------

export const WorkspaceWatchSchema = z.object({
  id: workspaceIdSchema,
})
