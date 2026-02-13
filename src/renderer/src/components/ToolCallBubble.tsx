import { memo, useState } from 'react'
import { Wrench, ChevronDown, ChevronUp, AlertCircle, Check } from 'lucide-react'
import type { Message } from '@shared/types'

interface ToolCallBubbleProps {
  message: Message
  /** @deprecated No longer used - theme handled via CSS variables */
  isLightMode?: boolean
}

export const ToolCallBubble = memo(function ToolCallBubble({
  message,
  isLightMode: _isLightMode = false
}: ToolCallBubbleProps) {
  const [expanded, setExpanded] = useState(false)

  const isToolUse = message.role === 'tool_use'
  const isError = message.isError

  // Styling based on message type
  const bgClass = isToolUse
    ? 'bg-violet-500/10 border-violet-500/30'
    : isError
      ? 'bg-red-500/10 border-red-500/30'
      : 'bg-emerald-500/10 border-emerald-500/30'

  const textClass = isToolUse
    ? 'text-violet-400'
    : isError
      ? 'text-red-400'
      : 'text-emerald-400'

  const Icon = isToolUse ? Wrench : isError ? AlertCircle : Check

  // Format the tool name for display
  const formatToolName = (name?: string): string => {
    if (!name) return 'Unknown tool'
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[85%] px-3 py-2 rounded-lg border cursor-pointer transition-colors hover:brightness-110 ${bgClass}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`flex items-center gap-2 text-sm ${textClass}`}>
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">
            {isToolUse ? formatToolName(message.toolName) : isError ? 'Tool Error' : 'Tool Result'}
          </span>
          <span className="flex-1" />
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>

        {expanded && (
          <div className="mt-2 pt-2 border-t border-current/10">
            <pre
              className="text-xs overflow-x-auto max-h-48 whitespace-pre-wrap break-words text-[var(--text-secondary)]"
            >
              {isToolUse
                ? JSON.stringify(message.toolInput, null, 2)
                : message.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
})
