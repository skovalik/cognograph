/**
 * Quick Actions for AI Property Suggestions
 *
 * Node-type-specific shortcuts for common property operations.
 * Extracted from AIPropertyAssist to improve maintainability.
 */

import {
  MessageSquare,
  Network,
  Flag,
  Tag,
  Code,
  Sparkles,
  Boxes,
  Bot,
  Users,
  FileText
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { NodeData } from '@shared/types'

export interface QuickAction {
  label: string
  prompt: string
  icon: LucideIcon
  description?: string
}

/**
 * Node-type-specific quick actions
 * Each action is tailored to the content and purpose of that node type
 */
export const QUICK_ACTIONS_BY_NODE_TYPE: Record<NodeData['type'], QuickAction[]> = {
  conversation: [
    {
      label: 'From messages',
      prompt: 'Suggest properties from conversation content',
      icon: MessageSquare,
      description: 'Analyze conversation messages for relevant properties'
    },
    {
      label: 'From context',
      prompt: 'Suggest properties from connected nodes',
      icon: Network,
      description: 'Inherit properties from connected nodes'
    }
  ],

  task: [
    {
      label: 'Priority',
      prompt: 'Suggest priority based on urgency keywords',
      icon: Flag,
      description: 'Analyze content for urgency indicators'
    },
    {
      label: 'Tags',
      prompt: 'Suggest relevant tags for this task',
      icon: Tag,
      description: 'Generate tags from task description'
    }
  ],

  note: [
    {
      label: 'Tags',
      prompt: 'Suggest tags from note content',
      icon: Tag,
      description: 'Generate tags from note content'
    },
    {
      label: 'From neighbors',
      prompt: 'Inherit tags from connected nodes',
      icon: Network,
      description: 'Inherit properties from connected nodes'
    }
  ],

  project: [
    {
      label: 'From children',
      prompt: 'Aggregate properties from child nodes',
      icon: Boxes,
      description: 'Roll up properties from child tasks'
    },
    {
      label: 'Priority',
      prompt: 'Suggest priority from critical children',
      icon: Flag,
      description: 'Inherit highest priority from children'
    }
  ],

  artifact: [
    {
      label: 'Tech tags',
      prompt: 'Suggest tags from code language and imports',
      icon: Code,
      description: 'Extract tech stack from code'
    },
    {
      label: 'From context',
      prompt: 'Suggest properties from connected nodes',
      icon: Network,
      description: 'Inherit properties from connected nodes'
    }
  ],

  action: [
    {
      label: 'Priority',
      prompt: 'Suggest priority from trigger criticality',
      icon: Flag,
      description: 'Analyze trigger urgency'
    },
    {
      label: 'Tags',
      prompt: 'Suggest tags from automation purpose',
      icon: Tag,
      description: 'Generate tags from action type'
    }
  ],

  text: [
    {
      label: 'Tags',
      prompt: 'Suggest tags from text content',
      icon: Tag,
      description: 'Generate tags from text content'
    },
    {
      label: 'Analyze',
      prompt: 'Analyze content and suggest all properties',
      icon: Sparkles,
      description: 'Full AI analysis of text'
    }
  ],

  workspace: [
    {
      label: 'Tags',
      prompt: 'Suggest tags for workspace categorization',
      icon: Tag,
      description: 'Categorize workspace by purpose'
    },
    {
      label: 'From members',
      prompt: 'Suggest properties from member activity',
      icon: Users,
      description: 'Analyze collaborative patterns'
    }
  ],

  orchestrator: [
    {
      label: 'From agents',
      prompt: 'Suggest properties from connected agents',
      icon: Bot,
      description: 'Analyze agent pipeline'
    },
    {
      label: 'Priority',
      prompt: 'Suggest priority from pipeline criticality',
      icon: Flag,
      description: 'Assess pipeline importance'
    }
  ]
}

/**
 * Generic quick actions (used in full mode or as fallback)
 */
export const GENERIC_QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Analyze all',
    prompt: 'Analyze this node and suggest all relevant properties based on its content',
    icon: Sparkles,
    description: 'Comprehensive AI analysis'
  },
  {
    label: 'Tags',
    prompt: 'Suggest relevant tags based on content and context',
    icon: Tag,
    description: 'Generate tags from content'
  },
  {
    label: 'Priority',
    prompt: 'Suggest appropriate priority based on content urgency',
    icon: Flag,
    description: 'Assess content urgency'
  },
  {
    label: 'From neighbors',
    prompt: 'Suggest properties based on connected nodes',
    icon: Network,
    description: 'Inherit from connections'
  }
]

/**
 * Get quick actions for a specific node type
 */
export function getQuickActionsForNode(nodeType: NodeData['type']): QuickAction[] {
  return QUICK_ACTIONS_BY_NODE_TYPE[nodeType] || QUICK_ACTIONS_BY_NODE_TYPE.text
}
