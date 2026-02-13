/**
 * ActorBadge Component
 *
 * Renders a compact badge differentiating User, Agent, and System actors
 * in the Bridge Log audit trail.
 */

import { memo } from 'react'
import { User, Bot, Cpu } from 'lucide-react'
import { Badge } from '../ui/Badge'
import type { AuditActor } from '@shared/types/bridge'

interface ActorBadgeProps {
  actor: AuditActor
}

function ActorBadgeComponent({ actor }: ActorBadgeProps): JSX.Element {
  switch (actor.type) {
    case 'user':
      return (
        <Badge variant="outline" className="h-4 text-[10px] px-1 gap-0.5">
          <User className="w-2.5 h-2.5" />
          You
        </Badge>
      )
    case 'agent':
      return (
        <Badge
          variant="secondary"
          className="h-4 text-[10px] px-1 gap-0.5"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: 'var(--color-info, #3b82f6)',
          }}
        >
          <Bot className="w-2.5 h-2.5" />
          {actor.agentName}
        </Badge>
      )
    case 'system':
      return (
        <Badge
          variant="outline"
          className="h-4 text-[10px] px-1 gap-0.5"
          style={{ color: 'var(--text-muted)' }}
        >
          <Cpu className="w-2.5 h-2.5" />
          System
        </Badge>
      )
  }
}

export const ActorBadge = memo(ActorBadgeComponent)
