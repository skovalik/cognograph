// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { executeTool } from './agentTools'

/**
 * Initialize the SDK tool bridge — listens for tool calls from the main process
 * Agent SDK MCP server and dispatches them to the renderer's executeTool.
 * Only activates in Electron builds where the preload exposes sdkTool API.
 *
 * @deprecated Phase 2C: RENDERER-PASSIVIZE — SDK tools now execute in the main
 * process via setSdkToolPool() in builtinTools.ts. This bridge is no longer
 * needed for the SDK path. The builtinTools system handles canvas tools via
 * its own executeInRenderer IPC bridge, and filesystem/MCP tools execute
 * directly in the main process.
 *
 * This file is kept temporarily for backward compatibility during the
 * transition. Remove once the main-process tool pool is confirmed stable
 * and the sdkTool IPC channel is removed from the preload.
 *
 * TODO(Phase 2C): Remove this file and its import from App.tsx after
 * confirming sdkToolBridge is no longer called.
 */
export function initSdkToolBridge(): void {
  if (!(window as any).api?.sdkTool) return

  ;(window as any).api.sdkTool.onCall(
    async (data: {
      id: string
      toolName: string
      args: Record<string, unknown>
      conversationId?: string
    }) => {
      try {
        // executeTool requires 3 args: (toolName, args, conversationId)
        const result = await executeTool(data.toolName, data.args, data.conversationId || '')
        ;(window as any).api.sdkTool.sendResult(data.id, result)
      } catch (error: any) {
        ;(window as any).api.sdkTool.sendResult(data.id, {
          success: false,
          error: error.message || 'Tool execution failed',
        })
      }
    },
  )
}
