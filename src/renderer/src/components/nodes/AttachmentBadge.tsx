import { memo } from 'react'
import { Paperclip } from 'lucide-react'

interface AttachmentBadgeProps {
  count?: number
}

function AttachmentBadgeComponent({ count }: AttachmentBadgeProps): JSX.Element | null {
  if (!count || count === 0) return null

  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] opacity-70"
      style={{ color: 'var(--node-text-secondary)' }}
      title={`${count} attachment${count !== 1 ? 's' : ''}`}
    >
      <Paperclip className="w-2.5 h-2.5" />
      {count}
    </span>
  )
}

export const AttachmentBadge = memo(AttachmentBadgeComponent)
