/**
 * Extraction Service
 *
 * Provides general-purpose node content extraction.
 * Extracts child notes/tasks from any node type's content.
 */

import type { NodeData, NoteNodeData, TaskNodeData, ConversationNodeData, ProjectNodeData } from '@shared/types'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { sciFiToast } from '../components/ui/SciFiToast'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ExtractedItem {
  type: 'note' | 'task'
  title: string
  description: string
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]
  confidence: number
}

// -----------------------------------------------------------------------------
// Content Extraction
// -----------------------------------------------------------------------------

function getNodeContent(data: NodeData): string {
  switch (data.type) {
    case 'conversation': {
      const convData = data as ConversationNodeData
      return convData.messages
        ?.map((m) => `${m.role}: ${m.content}`)
        .join('\n\n') || ''
    }
    case 'note':
      return (data as NoteNodeData).content || ''
    case 'task':
      return (data as TaskNodeData).description || ''
    case 'project':
      return (data as ProjectNodeData).description || ''
    case 'orchestrator':
      return (data as { description?: string }).description || ''
    default:
      return ''
  }
}

const EXTRACT_SYSTEM_PROMPT = `You are an extraction assistant. Analyze the content and extract actionable items.

For TASKS, identify action items, TODOs, things to do.
For NOTES, identify key insights, decisions, important facts worth preserving.

Respond ONLY with valid JSON:
{
  "extractions": [
    {
      "type": "task" | "note",
      "title": "Brief title (max 60 chars)",
      "description": "Full description",
      "priority": "low" | "medium" | "high",
      "tags": ["tag1"],
      "confidence": 0.0-1.0
    }
  ]
}

If nothing worth extracting, return: { "extractions": [] }
Return only JSON, no explanation.`

// -----------------------------------------------------------------------------
// Main Extract Function
// -----------------------------------------------------------------------------

export async function extractFromNode(nodeId: string): Promise<void> {
  const state = useWorkspaceStore.getState()
  const node = state.nodes.find((n) => n.id === nodeId)
  if (!node) return

  const content = getNodeContent(node.data)
  if (!content.trim()) {
    sciFiToast('No content to extract from', 'warning')
    return
  }

  state.setIsExtracting(nodeId)

  try {
    const result = await window.api.llm.extract({
      systemPrompt: EXTRACT_SYSTEM_PROMPT,
      userPrompt: `Extract actionable items from this content:\n\n${content.slice(0, 4000)}`
    })

    if (!result.success || !result.data) {
      sciFiToast('Extraction failed: ' + (result.error?.message || 'Unknown error'), 'warning')
      return
    }

    // Parse the response
    let parsed: { extractions: ExtractedItem[] }
    try {
      const jsonStr = result.data.replace(/```json\n?|\n?```/g, '').trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      sciFiToast('Failed to parse extraction results', 'warning')
      return
    }

    if (!parsed.extractions || parsed.extractions.length === 0) {
      sciFiToast('No items found to extract', 'info')
      return
    }

    // Add as pending extractions (uses existing infrastructure)
    const addPendingExtraction = state.addPendingExtraction
    for (const item of parsed.extractions) {
      if (item.confidence < 0.3) continue

      addPendingExtraction({
        sourceNodeId: nodeId,
        type: item.type,
        suggestedData: {
          title: item.title,
          content: item.description,
          ...(item.type === 'task' && {
            priority: item.priority || 'medium',
            status: 'todo',
            description: item.description
          }),
          tags: item.tags
        },
        confidence: item.confidence
      })
    }

    // Open extractions panel
    const leftSidebarOpen = state.leftSidebarOpen
    state.setLeftSidebarTab('extractions')
    if (!leftSidebarOpen) state.toggleLeftSidebar()

    sciFiToast(`Extracted ${parsed.extractions.length} items`, 'success')
  } catch (err) {
    sciFiToast('Extraction failed: ' + String(err), 'warning')
  } finally {
    state.setIsExtracting(null)
  }
}
