interface WorkspaceManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function WorkspaceManager({ isOpen, onClose }: WorkspaceManagerProps) {
  if (!isOpen) return null
  return null
}
