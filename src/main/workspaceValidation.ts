/**
 * Workspace Data Validation
 *
 * Loose Zod schema for validating workspace JSON files at the load boundary.
 * Validates structural integrity (required fields, correct types) without
 * deeply validating every nested node data type — that's the renderer's job.
 *
 * This prevents corrupted/partial workspace files from crashing the app
 * with obscure runtime errors deep in the component tree.
 */

import { z } from 'zod'

/**
 * Loose schema: validates the shape of WorkspaceData without being overly strict
 * about optional fields or nested node/edge data (which have many variants).
 */
const WorkspaceDataSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number()
    }),
    data: z.object({
      type: z.string()
    }).passthrough()
  }).passthrough()),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string()
  }).passthrough()),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number()
  }),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number()
}).passthrough() // Allow all optional fields (themeSettings, contextSettings, etc.)

export type ValidatedWorkspaceData = z.infer<typeof WorkspaceDataSchema>

/**
 * Validate parsed JSON against the workspace schema.
 * Returns the validated data or throws a descriptive error.
 */
export function validateWorkspaceData(data: unknown): ValidatedWorkspaceData {
  const result = WorkspaceDataSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3) // Show at most 3 issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid workspace data:\n${issues}`)
  }
  return result.data
}
