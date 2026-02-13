/**
 * PermissionGate -- Agent permission request dialog
 *
 * When an agent with autoExecuteTools=false attempts a tool call,
 * this AlertDialog blocks execution until the user approves or denies.
 * Shows the tool name and full input for review.
 */

import { memo } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Card } from '../ui/card'
import { Bot } from 'lucide-react'

interface PermissionGateProps {
  agentName: string
  toolName: string
  toolInput: Record<string, unknown>
  onApprove: () => void
  onReject: () => void
  open: boolean
}

function PermissionGateComponent({
  agentName,
  toolName,
  toolInput,
  onApprove,
  onReject,
  open,
}: PermissionGateProps): JSX.Element {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-400" />
            {agentName} requests permission
          </AlertDialogTitle>
          <AlertDialogDescription>
            The agent wants to execute: <strong>{toolName}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Card className="p-3 text-xs font-mono" style={{ background: 'var(--surface-panel)' }}>
          <pre className="whitespace-pre-wrap overflow-auto max-h-[200px]" style={{ color: 'var(--text-primary)' }}>
            {JSON.stringify(toolInput, null, 2)}
          </pre>
        </Card>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReject}>Deny</AlertDialogCancel>
          <AlertDialogAction onClick={onApprove}>Allow</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const PermissionGate = memo(PermissionGateComponent)
