/**
 * Node Type Conversion Utilities
 *
 * Defines conversion rules and compatibility between node types.
 * Used by ContextMenu to show the "Convert to..." submenu.
 */

import type { NodeData } from '@shared/types'

export type ConvertibleType = 'note' | 'task' | 'conversation' | 'artifact' | 'text'

interface ConversionRule {
  targetType: ConvertibleType
  label: string
  description: string
}

/**
 * Get valid conversion targets for a given node type.
 * Returns only types the source can meaningfully convert to.
 */
export function getConversionTargets(sourceType: NodeData['type']): ConversionRule[] {
  switch (sourceType) {
    case 'note':
      return [
        { targetType: 'task', label: 'Task', description: 'Content becomes description' },
        { targetType: 'conversation', label: 'Conversation', description: 'Content becomes first message' },
        { targetType: 'artifact', label: 'Artifact', description: 'Content preserved as markdown' },
        { targetType: 'text', label: 'Text Label', description: 'Becomes a simple text node' }
      ]
    case 'task':
      return [
        { targetType: 'note', label: 'Note', description: 'Description becomes content' },
        { targetType: 'conversation', label: 'Conversation', description: 'Description becomes first message' },
        { targetType: 'text', label: 'Text Label', description: 'Becomes a simple text node' }
      ]
    case 'conversation':
      return [
        { targetType: 'note', label: 'Note', description: 'Messages are not preserved' },
        { targetType: 'task', label: 'Task', description: 'Title preserved, messages dropped' }
      ]
    case 'artifact':
      return [
        { targetType: 'note', label: 'Note', description: 'Content preserved' },
        { targetType: 'text', label: 'Text Label', description: 'Becomes a simple text node' }
      ]
    case 'text':
      return [
        { targetType: 'note', label: 'Note', description: 'Content becomes note body' },
        { targetType: 'task', label: 'Task', description: 'Content becomes description' },
        { targetType: 'conversation', label: 'Conversation', description: 'Content becomes first message' }
      ]
    // Project, workspace, and action nodes can't be meaningfully converted
    default:
      return []
  }
}

/**
 * Check if a node type supports conversion.
 */
export function isConvertible(type: NodeData['type']): boolean {
  return getConversionTargets(type).length > 0
}
