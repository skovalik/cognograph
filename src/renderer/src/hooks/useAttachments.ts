import { useCallback, useState } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { Attachment, NodeData } from '@shared/types'

interface UseAttachmentsReturn {
  addAttachment: (nodeId: string) => Promise<void>
  deleteAttachment: (nodeId: string, attachmentId: string) => Promise<void>
  openAttachment: (storedPath: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

export function useAttachments(): UseAttachmentsReturn {
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addAttachment = useCallback(async (nodeId: string) => {
    if (!window.api?.attachment) {
      setError('Attachment API not available')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.attachment.add()
      if (!result.success) {
        setError(result.error || 'Failed to add attachment')
        return
      }
      if (!result.data) return // User cancelled

      const attachment = result.data as Attachment
      const { nodes } = useWorkspaceStore.getState()
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const currentAttachments = (node.data as { attachments?: Attachment[] }).attachments || []
      updateNode(nodeId, {
        attachments: [...currentAttachments, attachment]
      } as Partial<NodeData>)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [updateNode])

  const deleteAttachment = useCallback(async (nodeId: string, attachmentId: string) => {
    if (!window.api?.attachment) return
    setError(null)
    try {
      const { nodes } = useWorkspaceStore.getState()
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const currentAttachments = (node.data as { attachments?: Attachment[] }).attachments || []
      const attachment = currentAttachments.find((a) => a.id === attachmentId)
      if (!attachment) return

      // Delete file from disk
      await window.api.attachment.delete(attachment.storedPath)

      // Remove from node data
      updateNode(nodeId, {
        attachments: currentAttachments.filter((a) => a.id !== attachmentId)
      } as Partial<NodeData>)
    } catch (err) {
      setError(String(err))
    }
  }, [updateNode])

  const openAttachment = useCallback(async (storedPath: string) => {
    if (!window.api?.attachment) return
    setError(null)
    try {
      const result = await window.api.attachment.open(storedPath)
      if (!result.success) {
        setError(result.error || 'Failed to open attachment')
      }
    } catch (err) {
      setError(String(err))
    }
  }, [])

  return { addAttachment, deleteAttachment, openAttachment, isLoading, error }
}
