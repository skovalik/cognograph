/**
 * ProposalCard -- Batch approval dialog for agent proposals
 *
 * Shows all proposed changes with checkboxes for selective approval.
 * Includes Select All / Deselect All, expiration countdown, approve/reject.
 * Uses shadcn Dialog for modal presentation.
 */

import { memo, useState, useMemo, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../ui/dialog'
import { ScrollArea } from '../ui/scroll-area'
import { Card } from '../ui/card'
import { Checkbox } from '../ui/checkbox'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Separator } from '../ui/separator'
import { Bot, Clock, Check, X } from 'lucide-react'
import { useProposalStore } from '../../stores/proposalStore'
import type { Proposal, ProposedChange } from '@shared/types/bridge'
import { DEFAULT_BRIDGE_SETTINGS } from '@shared/types/bridge'

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatChangeDescription(change: ProposedChange): string {
  switch (change.type) {
    case 'create-node':
      return `Create ${change.nodeType || 'node'}: "${(change.nodeData?.title as string) || 'Untitled'}"`
    case 'update-node':
      return `Update node ${change.targetId?.slice(0, 8) || ''}...`
    case 'delete-node':
      return `Delete node ${change.targetId?.slice(0, 8) || ''}...`
    case 'create-edge':
      return `Connect ${change.edgeData?.source.slice(0, 8) || ''} -> ${change.edgeData?.target.slice(0, 8) || ''}`
    case 'delete-edge':
      return `Disconnect edge ${change.targetId?.slice(0, 8) || ''}...`
    default:
      return change.type
  }
}

// =============================================================================
// CHANGE TYPE COLORS
// =============================================================================

const TYPE_COLORS: Record<string, string> = {
  'create-node': 'bg-green-500/20 text-green-400',
  'update-node': 'bg-blue-500/20 text-blue-400',
  'delete-node': 'bg-red-500/20 text-red-400',
  'create-edge': 'bg-purple-500/20 text-purple-400',
  'delete-edge': 'bg-orange-500/20 text-orange-400',
}

// =============================================================================
// CHANGE CARD SUB-COMPONENT
// =============================================================================

function ChangeCard({
  change,
  selected,
  onToggle,
}: {
  change: ProposedChange
  selected: boolean
  onToggle: () => void
}): JSX.Element {
  return (
    <Card className={`p-2 flex items-start gap-2 transition-colors ${
      selected ? 'bg-accent/30' : 'opacity-50'
    }`}>
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge className={`text-[9px] px-1 ${TYPE_COLORS[change.type] || ''}`}>
            {change.type.replace('-', ' ')}
          </Badge>
          {change.nodeType && (
            <Badge variant="outline" className="text-[9px] px-1">
              {change.nodeType}
            </Badge>
          )}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>
          {formatChangeDescription(change)}
        </p>
        {change.position && (
          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
            Position: ({Math.round(change.position.x)}, {Math.round(change.position.y)})
          </p>
        )}
      </div>
    </Card>
  )
}

// =============================================================================
// PROPOSAL CARD COMPONENT
// =============================================================================

interface ProposalCardProps {
  proposal: Proposal
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ProposalCardComponent({ proposal, open, onOpenChange }: ProposalCardProps): JSX.Element {
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(
    new Set(proposal.changes.map(c => c.id))
  )
  const approveSelected = useProposalStore(s => s.approveSelected)
  const rejectProposal = useProposalStore(s => s.rejectProposal)

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    const expiresAt = proposal.createdAt + (DEFAULT_BRIDGE_SETTINGS.proposalTimeoutMs || 300000)
    return Math.max(0, expiresAt - Date.now())
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const expiresAt = proposal.createdAt + (DEFAULT_BRIDGE_SETTINGS.proposalTimeoutMs || 300000)
      const remaining = Math.max(0, expiresAt - Date.now())
      setTimeRemaining(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        onOpenChange(false)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [proposal.createdAt, onOpenChange])

  const toggleChange = (changeId: string): void => {
    const next = new Set(selectedChanges)
    if (next.has(changeId)) next.delete(changeId)
    else next.add(changeId)
    setSelectedChanges(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Bot className="w-4 h-4 text-blue-400" />
            {proposal.source.type === 'command-bar'
              ? `Command: "${proposal.source.commandText}"`
              : `Agent proposes ${proposal.changes.length} changes`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Review and approve or reject the proposed changes below.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-2">
          <div className="space-y-1.5">
            {proposal.changes.map(change => (
              <ChangeCard
                key={change.id}
                change={change}
                selected={selectedChanges.has(change.id)}
                onToggle={() => toggleChange(change.id)}
              />
            ))}
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex gap-2">
            <Button
              variant="ghost" size="sm" className="h-6 text-[10px]"
              onClick={() => setSelectedChanges(new Set(proposal.changes.map(c => c.id)))}
            >
              Select All
            </Button>
            <Button
              variant="ghost" size="sm" className="h-6 text-[10px]"
              onClick={() => setSelectedChanges(new Set())}
            >
              Deselect All
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Expires in {formatDuration(timeRemaining)}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
            onClick={() => {
              rejectProposal(proposal.id)
              onOpenChange(false)
            }}
          >
            <X className="w-4 h-4 mr-1" />
            Reject All
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={selectedChanges.size === 0}
            onClick={() => {
              approveSelected(proposal.id, Array.from(selectedChanges))
              onOpenChange(false)
            }}
          >
            <Check className="w-4 h-4 mr-1" />
            Approve ({selectedChanges.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const ProposalCard = memo(ProposalCardComponent)
